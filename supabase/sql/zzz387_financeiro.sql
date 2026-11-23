-- 4.86.0 — USUÁRIO FINANCEIRO
-- O financeiro é um ADMINISTRADOR (papel 'admin') com duas exceções, pedidas pelo Yury:
--   • sem WhatsApp (Central, números, Otto, configurações do WhatsApp);
--   • sem Pessoas e acessos (criar/remover pessoas, trocar função, liberar telas, encerrar sessões).
-- Como é feito: perfis.financeiro + dois ajudantes. Em vez de reescrever as funções com cópias que podem
-- estar velhas, a troca de sou_admin() → sou_admin_pleno() é feita NAS DEFINIÇÕES QUE ESTÃO NO AR, só nos
-- objetos de Pessoas (lista fechada abaixo) e do WhatsApp. Pode rodar mais de uma vez.

alter table public.perfis add column if not exists financeiro boolean not null default false;

create or replace function public.sou_financeiro()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select coalesce((select financeiro from public.perfis where id = auth.uid()), false) $$;
create or replace function public.sou_admin_pleno()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select coalesce(public.sou_admin(), false) and not public.sou_financeiro() $$;
grant execute on function public.sou_financeiro() to authenticated;
grant execute on function public.sou_admin_pleno() to authenticated;

-- trava: só o administrador pleno (ou o servidor) muda quem é administrador / financeiro
create or replace function public._perfis_trava_financeiro()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is not null and not public.sou_admin_pleno()
     and (new.financeiro is distinct from old.financeiro or new.eh_admin is distinct from old.eh_admin or new.papel is distinct from old.papel) then
    raise exception 'Só o administrador muda o tipo de acesso.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists perfis_trava_financeiro on public.perfis;
create trigger perfis_trava_financeiro before update on public.perfis for each row execute function public._perfis_trava_financeiro();

do $$
declare
  r record; d text; n text; q text; c text; sqlcmd text;
  -- Pessoas e acessos (o que a tela de Pessoas chama) + o acesso ao WhatsApp
  alvo text[] := array['perfil_definir_cargos', 'perfil_acao_definir', 'perfil_parceiro_definir', 'funcao_acao_definir',
    'funcao_personalizada_salvar', 'funcao_personalizada_excluir', 'acesso_decidir', 'acesso_revogar', 'acesso_ceder',
    'acesso_prazo', 'acessos_historico', 'acesso_pedidos_listar', 'sessoes_listar', 'sessoes_encerrar_pessoa', 'sessao_encerrar'];
begin
  -- 1) funções: sou_admin() → sou_admin_pleno()
  for r in select p.oid from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where s.nspname = 'public' and p.prokind = 'f' and p.proname = any(alvo) loop
    d := pg_get_functiondef(r.oid);
    n := replace(d, 'public.sou_admin()', 'public.sou_admin_pleno()');
    n := regexp_replace(n, '([^a-z_.])sou_admin\(\)', '\1sou_admin_pleno()', 'g');
    if n <> d then execute n; end if;
  end loop;
  -- 2) políticas: todas as do WhatsApp; nas de Pessoas, só as de escrita (ler perfis é de todos: nomes e fotos)
  for r in select tablename, policyname, cmd as c0, qual, with_check from pg_policies
            where schemaname = 'public'
              and (tablename ~ '^wa_' or (tablename in ('perfis', 'perfil_modulos', 'perfil_acoes', 'funcao_modulos', 'funcao_acoes',
                   'funcoes_personalizadas', 'perfil_funcoes_secundarias') and cmd <> 'SELECT')) loop
    q := r.qual; c := r.with_check;
    if q is not null then q := regexp_replace(replace(q, 'sou_admin()', 'sou_admin_pleno()'), 'sou_admin_pleno_pleno\(\)', 'sou_admin_pleno()', 'g'); end if;
    if c is not null then c := regexp_replace(replace(c, 'sou_admin()', 'sou_admin_pleno()'), 'sou_admin_pleno_pleno\(\)', 'sou_admin_pleno()', 'g'); end if;
    if q is distinct from r.qual or c is distinct from r.with_check then
      sqlcmd := format('alter policy %I on public.%I', r.policyname, r.tablename);
      if q is not null then sqlcmd := sqlcmd || ' using (' || q || ')'; end if;
      if c is not null then sqlcmd := sqlcmd || ' with check (' || c || ')'; end if;
      execute sqlcmd;
    end if;
  end loop;
end $$;

-- WhatsApp: o financeiro NUNCA vê, mesmo que também tenha uma função (ex.: videomaker) — revisão de segurança
create or replace function public.wa_pode_ver_numero(p_numero uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select not public.sou_financeiro() and (coalesce(public.sou_admin(), false) or exists (
    select 1 from public.wa_numeros n join public.perfis p on p.id = auth.uid()
     where n.id = p_numero and n.ativo and p.estado = 'ativa' and p.papel <> 'cliente'
       and (p.papel = any(n.equipes) or exists (select 1 from unnest(n.equipes) e where public.tenho_funcao_extra(e, p.id)))))
$$;
grant execute on function public.wa_pode_ver_numero(uuid) to authenticated;

-- aviso de "cliente esperando" no celular: o financeiro não recebe
create or replace function public.wa_quem_ve_whatsapp()
returns setof uuid language sql stable security definer set search_path to 'public'
as $$
  select p.id from public.perfis p
   where p.estado = 'ativa' and p.papel <> 'cliente' and not coalesce(p.financeiro, false)
     and (coalesce(p.eh_admin, false) or coalesce(public.eh_videomaker_elegivel(p.id), false))
$$;
revoke all on function public.wa_quem_ve_whatsapp() from public, anon, authenticated;
grant execute on function public.wa_quem_ve_whatsapp() to service_role;

-- conferência: as funções de Pessoas que existem precisam ter ficado só com o administrador pleno.
-- Se alguma não usa sou_admin() (e por isso não foi trocada), a migração PARA com o nome dela — melhor
-- falhar alto do que deixar o financeiro mexer em acessos sem ninguém saber.
do $$
declare r record; d text; ruins text[] := '{}';
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where s.nspname = 'public' and p.prokind = 'f' and p.proname = any(array['perfil_definir_cargos', 'perfil_acao_definir', 'perfil_parceiro_definir',
              'funcao_acao_definir', 'funcao_personalizada_salvar', 'funcao_personalizada_excluir', 'acesso_decidir', 'acesso_revogar', 'acesso_ceder',
              'acesso_prazo', 'acessos_historico', 'acesso_pedidos_listar', 'sessoes_listar', 'sessoes_encerrar_pessoa']) loop
    d := pg_get_functiondef(r.oid);
    if position('sou_admin_pleno()' in d) = 0 or d ~ '([^a-z_.])sou_admin\(\)' or d ~ 'public\.sou_admin\(\)' then ruins := ruins || r.proname; end if;
  end loop;
  if cardinality(ruins) > 0 then
    raise exception 'zzz387: estas funções de Pessoas não ficaram só com o administrador pleno: %', array_to_string(ruins, ', ');
  end if;
end $$;
