-- =====================================================================
-- PRESENÇA E PREFERÊNCIAS — build 2026-09-09-j
--
-- O que muda:
--  1. perfis.preferencias (jsonb): som, notificação do navegador e push,
--     por pessoa. Gravadas só pela própria pessoa, via função.
--  2. perfis.last_login_at / last_seen_at: quando entrou pela última vez
--     e quando o sistema a viu por último (heartbeat a cada 5 min).
--     ultimo_acesso continua existindo e é mantido igual a last_login_at
--     por trigger — versões antigas da função b7-auth seguem funcionando.
--  3. perfil_heartbeat(): grava last_seen_at = now() SÓ na linha de
--     auth.uid(). É security definer porque perfis não tem UPDATE para
--     authenticated (e não deve ter: papel e estado são do administrador).
--  4. minha_sessao recriada com as colunas novas (drop/create, nunca
--     "create or replace" com p.* — ver migration_fix.sql).
--
-- Aditiva e idempotente. Depende de migration_auth.sql, migration_portal.sql
-- (avatar_url) e migration_fix.sql (tocar_updated_at).
-- =====================================================================

alter table public.perfis add column if not exists preferencias jsonb not null default '{}'::jsonb;
alter table public.perfis add column if not exists last_login_at timestamptz;
alter table public.perfis add column if not exists last_seen_at timestamptz;

/* quem já entrou antes desta migration não vira "nunca acessou" */
update public.perfis set last_login_at = ultimo_acesso
 where last_login_at is null and ultimo_acesso is not null;

-- ---------------------------------------------------------------------
-- ultimo_acesso <-> last_login_at sempre iguais, venha de onde vier a
-- escrita. O heartbeat sozinho não mexe em updated_at: "atualizado em"
-- é sobre o cadastro, não sobre presença.
-- ---------------------------------------------------------------------
create or replace function public.perfis_presenca_sync()
returns trigger language plpgsql as $$
begin
  if new.last_login_at is distinct from old.last_login_at then
    new.ultimo_acesso := new.last_login_at;
  elsif new.ultimo_acesso is distinct from old.ultimo_acesso then
    new.last_login_at := new.ultimo_acesso;
  end if;
  /* só presença mudou: devolve o updated_at que o trigger anterior tocou */
  if new.last_seen_at is distinct from old.last_seen_at
     and row(new.username, new.nome, new.papel, new.estado, new.pode_aprovar, new.avatar_url,
             new.preferencias, new.last_login_at, new.ultimo_acesso)
       is not distinct from
         row(old.username, old.nome, old.papel, old.estado, old.pode_aprovar, old.avatar_url,
             old.preferencias, old.last_login_at, old.ultimo_acesso) then
    new.updated_at := old.updated_at;
  end if;
  return new;
end $$;

/* nome começa com "perfis_z" para rodar DEPOIS de perfis_updated
   (triggers do mesmo evento disparam em ordem alfabética) */
drop trigger if exists perfis_z_presenca on public.perfis;
create trigger perfis_z_presenca before update on public.perfis
  for each row execute function public.perfis_presenca_sync();

-- ---------------------------------------------------------------------
-- HEARTBEAT — a própria pessoa, e mais ninguém
-- ---------------------------------------------------------------------
create or replace function public.perfil_heartbeat()
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária.';
  end if;
  update public.perfis set last_seen_at = now()
   where id = auth.uid() and estado = 'ativa'
   returning last_seen_at into v;
  return v;
end $$;
revoke all on function public.perfil_heartbeat() from public;
grant execute on function public.perfil_heartbeat() to authenticated;

-- ---------------------------------------------------------------------
-- PREFERÊNCIAS — só as chaves conhecidas, só booleanas, só as próprias
-- ---------------------------------------------------------------------
create or replace function public.perfil_preferencias_gravar(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare limpo jsonb := '{}'::jsonb; k text; v jsonb; atual jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária.';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Preferências inválidas.';
  end if;
  for k, v in select * from jsonb_each(p) loop
    if k in ('som', 'navegador', 'push') and jsonb_typeof(v) = 'boolean' then
      limpo := limpo || jsonb_build_object(k, v);
    end if;
  end loop;
  update public.perfis
     set preferencias = coalesce(preferencias, '{}'::jsonb) || limpo
   where id = auth.uid()
   returning preferencias into atual;
  if atual is null then
    raise exception 'Perfil não encontrado.';
  end if;
  return atual;
end $$;
revoke all on function public.perfil_preferencias_gravar(jsonb) from public;
grant execute on function public.perfil_preferencias_gravar(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- minha_sessao com as colunas novas
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'perfis' and column_name = 'avatar_url') then
    raise notice 'perfis.avatar_url não existe: rode migration_auth.sql e migration_portal.sql antes.';
  else
    execute 'drop view if exists public.minha_sessao';
    execute $v$
      create view public.minha_sessao
      with (security_invoker = true) as
      select p.id, p.username, p.nome, p.papel, p.estado, p.pode_aprovar, p.avatar_url,
             coalesce(p.preferencias, '{}'::jsonb) as preferencias,
             p.last_login_at, p.last_seen_at,
             (select coalesce(json_agg(json_build_object(
                       'id', c.id, 'nome', c.nome, 'logo_url', c.logo_url,
                       'servico', coalesce(c.servico, 'ativo'),
                       'mensagem', c.servico_mensagem)), '[]'::json)
                from public.perfil_clientes pc
                join public.clientes c on c.id = pc.client_id
               where pc.perfil_id = p.id) as empresas
      from public.perfis p
      where p.id = auth.uid()
    $v$;
    execute 'grant select on public.minha_sessao to authenticated';
  end if;
end $$;

select 'migration_presenca aplicada' as resultado;
