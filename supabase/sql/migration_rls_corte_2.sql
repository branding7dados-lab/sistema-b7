-- ============================================================
-- Corte do RLS 2 (2026-09-30-i)
--
-- Antes: 18 tabelas com política "true" para anon e authenticated
-- (qualquer um com a chave pública do site lia, alterava e apagava).
--
-- Depois:
--   • anon (sem login): nada.
--   • equipe interna logada (admin, coordenador, designer, videomaker):
--     exatamente o acesso de hoje (leitura e escrita), para não quebrar
--     nenhuma tela.
--   • cliente logado: só leitura, só da própria empresa (com serviço
--     ativo) e só o que foi liberado (visivel_cliente / publicado_em).
--   • demandas_edicao_resumo passa a respeitar o RLS de demandas_edicao
--     (antes a view ignorava o RLS e era legível por anon).
--
-- Reverter: migration_rls_corte_2_reverter.sql
-- ============================================================

do $$ begin
  if not exists (select 1 from public.perfis where papel = 'admin' and estado = 'ativa') then
    raise exception 'Nenhum admin ativo — corte abortado para não trancar todo mundo do lado de fora.';
  end if;
end $$;

-- 1) remove as políticas abertas
drop policy if exists acesso_interno_atividades           on public.atividades;
drop policy if exists acesso_interno_cenas                on public.cenas;
drop policy if exists acesso_interno_cliente_inteligencia on public.cliente_inteligencia;
drop policy if exists acesso_interno_clientes             on public.clientes;
drop policy if exists acesso_interno_conteudos            on public.conteudos;
drop policy if exists acesso_interno_frames               on public.frames;
drop policy if exists acesso_interno_gravacoes            on public.gravacoes;
drop policy if exists acesso_interno_ideias               on public.ideias;
drop policy if exists acesso_interno_linhas_editoriais    on public.linhas_editoriais;
drop policy if exists acesso_interno_onboardings          on public.onboardings;
drop policy if exists acesso_interno_pilares              on public.pilares;
drop policy if exists acesso_interno_produtos             on public.produtos;
drop policy if exists acesso_interno_provas               on public.provas;
drop policy if exists acesso_interno_roteiros             on public.roteiros;
drop policy if exists acesso_interno_slides               on public.slides;
drop policy if exists status_itens_tudo                   on public.status_itens;
drop policy if exists status_semanais_tudo                on public.status_semanais;
drop policy if exists status_versoes_tudo                 on public.status_versoes;

-- 2) equipe interna logada: mesmo acesso de antes
do $$
declare t text;
begin
  foreach t in array array['atividades','cenas','cliente_inteligencia','clientes','conteudos','frames','gravacoes',
    'ideias','linhas_editoriais','onboardings','pilares','produtos','provas','roteiros','slides',
    'status_itens','status_semanais','status_versoes']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_equipe', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.sou_equipe_interna()) with check (public.sou_equipe_interna())', t || '_equipe', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- 3) cliente logado: leitura do que é dele e foi liberado
drop policy if exists clientes_cliente_leitura on public.clientes;
create policy clientes_cliente_leitura on public.clientes for select to authenticated
  using (public.posso_ver_cliente(id));

drop policy if exists conteudos_cliente_leitura on public.conteudos;
create policy conteudos_cliente_leitura on public.conteudos for select to authenticated
  using (coalesce(visivel_cliente, false) and deleted_at is null and public.posso_ver_cliente(client_id));

drop policy if exists linhas_editoriais_cliente_leitura on public.linhas_editoriais;
create policy linhas_editoriais_cliente_leitura on public.linhas_editoriais for select to authenticated
  using (coalesce(visivel_cliente, false) and deleted_at is null and public.posso_ver_cliente(client_id));

drop policy if exists status_semanais_cliente_leitura on public.status_semanais;
create policy status_semanais_cliente_leitura on public.status_semanais for select to authenticated
  using (publicado_em is not null and deleted_at is null and public.posso_ver_cliente(client_id));

drop policy if exists status_itens_cliente_leitura on public.status_itens;
create policy status_itens_cliente_leitura on public.status_itens for select to authenticated
  using (deleted_at is null and exists (
    select 1 from public.status_semanais s
     where s.id = status_itens.report_id and s.publicado_em is not null and s.deleted_at is null
       and public.posso_ver_cliente(s.client_id)));

-- 4) view que ignorava o RLS
alter view public.demandas_edicao_resumo set (security_invoker = true);
revoke all on public.demandas_edicao_resumo from anon;
