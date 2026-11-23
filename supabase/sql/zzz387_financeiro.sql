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
    'acesso_prazo', 'acessos_historico', 'acesso_pedidos_listar', 'sessoes_listar', 'sessoes_encerrar_pessoa',
    'wa_pode_ver_numero'];
begin
  -- 1) funções: sou_admin() → sou_admin_pleno()
  for r in select p.oid from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where s.nspname = 'public' and p.prokind = 'f' and p.proname = any(alvo) loop
    d := pg_get_functiondef(r.oid);
    n := replace(d, 'public.sou_admin()', 'public.sou_admin_pleno()');
    n := regexp_replace(n, '([^a-z_.])sou_admin\(\)', '\1sou_admin_pleno()', 'g');
    if n <> d then execute n; end if;
  end loop;
  -- 2) aviso de "cliente esperando" no celular: o financeiro não recebe
  for r in select p.oid from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where s.nspname = 'public' and p.proname = 'wa_quem_ve_whatsapp' loop
    d := pg_get_functiondef(r.oid);
    if position('financeiro' in d) = 0 then
      n := replace(d, 'coalesce(p.eh_admin, false)', '(coalesce(p.eh_admin, false) and not coalesce(p.financeiro, false))');
      if n <> d then execute n; end if;
    end if;
  end loop;
  -- 3) políticas: todas as do WhatsApp; nas de Pessoas, só as de escrita (ler perfis é de todos: nomes e fotos)
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
