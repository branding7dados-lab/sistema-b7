-- zzz251: conferência automática de permissões (só administração).
-- Cada linha devolvida é um problema de segurança. Nada volta = tudo certo.
-- Usada pelo botão "Conferir agora" em Configurações → Funções e permissões.
create or replace function public.conferir_permissoes()
returns table(gravidade text, tipo text, onde text, detalhe text)
language plpgsql security definer set search_path to 'public' as $$
declare
  orig text := current_setting('request.jwt.claims', true);
  eu uuid := auth.uid();
  conteudo text[] := array['clientes','cliente_inteligencia','produtos','provas','onboardings','atividades',
    'linhas_editoriais','conteudos','slides','frames','pilares','ideias','roteiros','cenas','gravacoes',
    'status_semanais','status_itens','status_versoes'];
  abertas_ok text[] := array['promo1010_visits','promo1010_leads'];   -- formulários públicos da landing
  sem_nivel_ok text[] := array['atividades_interna_insert'];          -- registro de atividade
  r record; nv int; p2 bool; p3 bool;
begin
  if not public.sou_admin() then raise exception 'Só administrador confere permissões.' using errcode = '42501'; end if;

  -- 1. tabelas sem RLS
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity loop
    return query select 'grave', 'tabela_sem_rls', r.relname::text, 'A tabela não tem segurança por linha: qualquer pessoa logada lê e escreve tudo.';
  end loop;

  -- 2. escrita liberada para qualquer um
  for r in select tablename, policyname from pg_policies
            where schemaname = 'public' and cmd <> 'SELECT' and permissive = 'PERMISSIVE'
              and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')
              and not (tablename = any(abertas_ok)) loop
    return query select 'grave', 'politica_aberta', r.tablename || ' / ' || r.policyname, 'Escrita liberada sem conferir quem é a pessoa.';
  end loop;

  -- 3. tabelas de conteúdo cuja escrita não passa pelo nível do módulo
  for r in select tablename, policyname, cmd from pg_policies
            where schemaname = 'public' and cmd <> 'SELECT' and permissive = 'PERMISSIVE'
              and tablename = any(conteudo) and not (policyname = any(sem_nivel_ok))
              and coalesce(qual, '') || coalesce(with_check, '') not like '%pode_nivel%' loop
    return query select 'grave', 'politica_sem_nivel', r.tablename || ' / ' || r.policyname,
      'Esta regra (' || r.cmd || ') não confere o nível Ver/Editar/Total da pessoa.';
  end loop;

  -- 4. cada pessoa ativa × módulo: o banco nunca pode deixar mais do que o nível dado
  for r in select p.id, p.nome, p.papel, p.eh_admin, m.id as modulo, m.rotulo
             from public.perfis p cross join public.modulos m
            where p.estado = 'ativa' order by p.nome, m.ordem loop
    perform set_config('request.jwt.claims', json_build_object('sub', r.id, 'role', 'authenticated')::text, true);
    nv := public.nivel_modulo(r.modulo, r.id);
    p2 := public.pode_nivel(r.modulo, 2);
    p3 := public.pode_nivel(r.modulo, 3);
    if r.papel = 'cliente' and (nv > 0 or p2) then
      return query select 'grave', 'cliente_com_modulo', r.nome || ' · ' || r.rotulo, 'Conta de cliente com acesso a um módulo da equipe.';
    elsif r.eh_admin and not p3 then
      return query select 'grave', 'admin_bloqueado', r.nome || ' · ' || r.rotulo, 'Administrador sem acesso total no banco.';
    elsif (p2 and nv < 2) or (p3 and nv < 3) then
      return query select 'grave', 'banco_deixa_mais', r.nome || ' · ' || r.rotulo,
        'O banco deixa ' || case when p3 then 'excluir' else 'alterar' end || ', mas o nível dado é ' ||
        case nv when 0 then 'Sem acesso' when 1 then 'Ver' else 'Editar' end || '.';
    end if;
  end loop;

  perform set_config('request.jwt.claims', coalesce(orig, ''), true);
  if auth.uid() is distinct from eu then raise exception 'Falha ao restaurar a sessão.'; end if;
end $$;
revoke all on function public.conferir_permissoes() from public, anon;
grant execute on function public.conferir_permissoes() to authenticated;

-- Todo dia às 8h45 (Brasília): se a conferência achar algo, avisa cada administrador
-- (um aviso por dia, com o total). Sem problemas, ninguém é incomodado.
create or replace function public._conferir_permissoes_diario()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare adm uuid; n int; ex text; d uuid;
begin
  select id into adm from public.perfis where eh_admin and estado = 'ativa' order by created_at limit 1;
  if adm is null then return 0; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  select count(*), min(onde) into n, ex from public.conferir_permissoes();
  perform set_config('request.jwt.claims', '', true);
  if n = 0 then return 0; end if;
  for d in select id from public.perfis where eh_admin and estado = 'ativa' loop
    if not exists (select 1 from public.notificacoes where destinatario_id = d and tipo = 'seguranca.permissoes' and created_at > now() - interval '20 hours') then
      perform public._acesso_notificar(d, 'seguranca.permissoes', 'Conferência de permissões achou ' || n || case when n = 1 then ' problema' else ' problemas' end,
        'Por exemplo: ' || ex || '. Veja em Configurações → Funções e permissões.', '#/config', null, jsonb_build_object('total', n));
    end if;
  end loop;
  return n;
end $$;
revoke all on function public._conferir_permissoes_diario() from public, anon, authenticated;
select cron.schedule('conferir-permissoes', '45 11 * * *', 'select public._conferir_permissoes_diario()');
