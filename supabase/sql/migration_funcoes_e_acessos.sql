-- =====================================================================
-- FUNÇÕES E ACESSOS — fundação (zzz68, 07/10/2026)
--
-- Modelo novo de acesso da equipe interna:
--   conta → administrador (sim/não) → função principal → módulos padrão
--   da função → exceções por usuário → acesso efetivo.
--
-- FUNÇÃO ≠ ACESSO A MÓDULO. A função diz o que a pessoa FAZ (Painel,
-- elegibilidade para ser responsável, notificações da função). O acesso
-- a módulo diz quais áreas ela ABRE.
--
-- ESTRATÉGIA: ADITIVA, COM ESPELHO DO LEGADO.
--   • perfis.eh_admin e perfis.funcao passam a ser a fonte da verdade.
--   • perfis.papel e perfis_funcoes_extra continuam existindo e são
--     mantidos por gatilho como ESPELHO:
--         administrador            → papel 'admin'
--         administrador + função X → papel 'admin' + função extra X
--         não administrador        → papel = função
--         cliente                  → papel 'cliente' (inalterado)
--     Assim as 137 políticas de RLS, sou_equipe(), sou_videomaker(),
--     notificações e a view videomakers_elegiveis seguem funcionando
--     sem nenhuma alteração.
--
-- Nenhuma política existente é alterada. Nada é apagado.
-- A trava por módulo no banco (políticas por domínio) fica para um
-- pacote próprio: até lá, tirar um módulo de alguém esconde a tela e
-- bloqueia a rota, mas não muda o que o banco deixa ler.
-- =====================================================================

-- 1) Identidade nova em perfis -----------------------------------------
alter table public.perfis add column if not exists eh_admin boolean not null default false;
alter table public.perfis add column if not exists funcao text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_funcao_valida') then
    alter table public.perfis add constraint perfis_funcao_valida
      check (funcao is null or funcao in ('coordenador', 'designer', 'videomaker'));
  end if;
end $$;

-- 2) Migração das contas atuais (antes dos gatilhos) --------------------
--    admin sem função extra → administrador, sem função
--    admin com função extra → administrador + essa função (se houver mais
--      de uma: coordenador > videomaker > designer)
--    coordenador/designer/videomaker → função = papel
--    cliente → nada
update public.perfis p set
  eh_admin = (p.papel = 'admin'),
  funcao = case
    when p.papel in ('coordenador', 'designer', 'videomaker') then p.papel
    when p.papel = 'admin' then (
      select fe.funcao from public.perfis_funcoes_extra fe where fe.perfil_id = p.id
       order by case fe.funcao when 'coordenador' then 1 when 'videomaker' then 2 else 3 end limit 1)
    else null end
where p.papel <> 'cliente' and p.eh_admin = false and p.funcao is null;

-- admin que tinha mais de uma função extra fica só com a principal no espelho
delete from public.perfis_funcoes_extra fe using public.perfis p
 where p.id = fe.perfil_id and p.papel = 'admin' and fe.funcao is distinct from p.funcao;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_modelo_coerente') then
    alter table public.perfis add constraint perfis_modelo_coerente check (
      (papel = 'cliente' and eh_admin = false and funcao is null)
      or (papel = 'admin' and eh_admin = true)
      or (papel in ('coordenador', 'designer', 'videomaker') and eh_admin = false and funcao = papel));
  end if;
end $$;

-- 3) Gatilhos: novo modelo ⇄ espelho legado -----------------------------
create or replace function public._perfis_modelo() returns trigger
language plpgsql set search_path = public as $$
declare novo_mudou boolean; papel_mudou boolean;
begin
  if tg_op = 'INSERT' then
    novo_mudou := new.eh_admin or new.funcao is not null;
    papel_mudou := true;
  else
    novo_mudou := (new.eh_admin is distinct from old.eh_admin) or (new.funcao is distinct from old.funcao);
    papel_mudou := new.papel is distinct from old.papel;
  end if;

  if new.papel = 'cliente' and (papel_mudou or not novo_mudou) then
    new.eh_admin := false; new.funcao := null;                       -- cliente: fora do modelo interno
  elsif novo_mudou then
    if not new.eh_admin and new.funcao is null then
      raise exception 'Quem não é administrador precisa ter uma função (coordenador, designer ou videomaker).';
    end if;
    new.papel := case when new.eh_admin then 'admin' else new.funcao end;   -- novo → espelho
  elsif papel_mudou then                                             -- escrita legada só no papel
    if new.papel = 'admin' then
      new.eh_admin := true;
      if tg_op = 'UPDATE' and old.papel <> 'admin' then new.funcao := null; end if;
    else
      new.eh_admin := false; new.funcao := new.papel;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists perfis_b_modelo on public.perfis;
create trigger perfis_b_modelo before insert or update on public.perfis
  for each row execute function public._perfis_modelo();

create or replace function public._perfis_espelho_extra() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.eh_admin is not distinct from old.eh_admin
     and new.funcao is not distinct from old.funcao and new.papel is not distinct from old.papel then
    return null;
  end if;
  delete from public.perfis_funcoes_extra where perfil_id = new.id
     and not (new.eh_admin and funcao is not distinct from new.funcao);
  if new.eh_admin and new.funcao is not null then
    insert into public.perfis_funcoes_extra (perfil_id, funcao)
    select new.id, new.funcao
     where not exists (select 1 from public.perfis_funcoes_extra where perfil_id = new.id and funcao = new.funcao);
  end if;
  return null;
end $$;

drop trigger if exists perfis_y_espelho_extra on public.perfis;
create trigger perfis_y_espelho_extra after insert or update on public.perfis
  for each row execute function public._perfis_espelho_extra();

-- 4) Módulos, padrões por função e exceções por usuário -----------------
create table if not exists public.modulos (
  id text primary key check (id ~ '^[a-z_]{2,32}$'),
  rotulo text not null,
  ordem int not null default 0
);
create table if not exists public.funcao_modulos (
  funcao text not null check (funcao in ('coordenador', 'designer', 'videomaker')),
  modulo text not null references public.modulos(id) on delete cascade,
  primary key (funcao, modulo)
);
create table if not exists public.perfil_modulos (
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  modulo text not null references public.modulos(id) on delete cascade,
  efeito text not null check (efeito in ('permitir', 'negar')),
  alterado_por uuid,
  alterado_em timestamptz not null default now(),
  primary key (perfil_id, modulo)
);

insert into public.modulos (id, rotulo, ordem) values
  ('clientes', 'Clientes', 10),
  ('linhas', 'Linhas editoriais', 20),
  ('roteiros', 'Roteiros', 30),
  ('gravacoes', 'Gravações', 40),
  ('video', 'Vídeo', 50),
  ('design', 'Design', 60),
  ('publicacoes', 'Publicações do Dia', 70),
  ('aprovacoes', 'Aprovações', 80),
  ('semanas', 'Status semanal', 90),
  ('kanban', 'Produção (quadro)', 100),
  ('calendario', 'Calendário', 110),
  ('oportunidades', 'Oportunidades', 120)
on conflict (id) do nothing;

-- padrões iniciais = exatamente o que cada papel já abria (ninguém perde acesso)
insert into public.funcao_modulos (funcao, modulo)
select f, m from (values
  ('coordenador', 'clientes'), ('coordenador', 'linhas'), ('coordenador', 'roteiros'), ('coordenador', 'gravacoes'),
  ('coordenador', 'video'), ('coordenador', 'design'), ('coordenador', 'publicacoes'), ('coordenador', 'aprovacoes'),
  ('coordenador', 'semanas'), ('coordenador', 'kanban'), ('coordenador', 'calendario'), ('coordenador', 'oportunidades'),
  ('designer', 'design'), ('designer', 'linhas'), ('designer', 'calendario'),
  ('videomaker', 'video'), ('videomaker', 'gravacoes'), ('videomaker', 'roteiros'), ('videomaker', 'calendario')
) as v(f, m)
where not exists (select 1 from public.funcao_modulos)   -- só na primeira vez: depois quem manda é o admin
on conflict do nothing;

alter table public.modulos enable row level security;
alter table public.funcao_modulos enable row level security;
alter table public.perfil_modulos enable row level security;

revoke all on public.modulos, public.funcao_modulos, public.perfil_modulos from anon, public;
grant select on public.modulos, public.funcao_modulos, public.perfil_modulos to authenticated;

drop policy if exists "modulos leitura" on public.modulos;
create policy "modulos leitura" on public.modulos for select to authenticated
  using (public.sou_equipe_interna());
drop policy if exists "funcao_modulos leitura" on public.funcao_modulos;
create policy "funcao_modulos leitura" on public.funcao_modulos for select to authenticated
  using (public.sou_equipe_interna());
drop policy if exists "perfil_modulos leitura" on public.perfil_modulos;
create policy "perfil_modulos leitura" on public.perfil_modulos for select to authenticated
  using (perfil_id = (select auth.uid()) or public.sou_admin());
-- sem política de escrita: só o servidor (b7-auth, com checagem de administrador) grava.

-- 5) Acesso efetivo — UM lugar que resolve ------------------------------
create or replace function public.modulos_efetivos(p_id uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select case
    when p_id is distinct from auth.uid() and not public.sou_admin() then '{}'::text[]
    else coalesce((
      select case
        when p.estado <> 'ativa' or p.papel = 'cliente' then '{}'::text[]
        when p.eh_admin then (select array_agg(m.id order by m.ordem) from public.modulos m)
        else (select array_agg(m.id order by m.ordem) from public.modulos m
               where (exists (select 1 from public.funcao_modulos fm where fm.funcao = p.funcao and fm.modulo = m.id)
                      or exists (select 1 from public.perfil_modulos pm where pm.perfil_id = p.id and pm.modulo = m.id and pm.efeito = 'permitir'))
                 and not exists (select 1 from public.perfil_modulos pm where pm.perfil_id = p.id and pm.modulo = m.id and pm.efeito = 'negar'))
      end
      from public.perfis p where p.id = p_id), '{}'::text[])
  end
$$;

create or replace function public.tem_acesso_modulo(p_modulo text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_modulo = any(public.modulos_efetivos(auth.uid())), false)
$$;

create or replace function public.minha_funcao() returns text
language sql stable security definer set search_path = public as $$
  select p.funcao from public.perfis p where p.id = auth.uid() and p.estado = 'ativa'
$$;

revoke execute on function public.modulos_efetivos(uuid), public.tem_acesso_modulo(text), public.minha_funcao() from public, anon;
grant execute on function public.modulos_efetivos(uuid), public.tem_acesso_modulo(text), public.minha_funcao() to authenticated;
revoke execute on function public._perfis_modelo(), public._perfis_espelho_extra() from public, anon, authenticated;

-- 6) Sessão: o front recebe administrador, função e módulos prontos ------
create or replace view public.minha_sessao with (security_invoker = true) as
 select id, username, nome, papel, estado, pode_aprovar, avatar_url,
        coalesce(preferencias, '{}'::jsonb) as preferencias,
        last_login_at, last_seen_at,
        public.minhas_empresas() as empresas,
        coalesce((select array_agg(fe.funcao order by fe.funcao) from public.perfis_funcoes_extra fe
                   where fe.perfil_id = p.id), '{}'::text[]) as funcoes_extra,
        p.eh_admin, p.funcao,
        public.modulos_efetivos(p.id) as modulos
   from public.perfis p
  where id = auth.uid();
