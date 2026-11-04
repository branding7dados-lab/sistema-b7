-- =====================================================================
-- CORTE 3 — devolve a escrita das tabelas editoriais à coordenação
--
-- O QUE ACONTECEU
-- migration_rls_corte_2.sql (30/09) trocou, em 18 tabelas, a política de
-- escrita de sou_equipe() [admin, coordenador] por sou_equipe_interna()
-- [admin, coordenador, designer, videomaker] — e com "for all", o que
-- antes era só leitura para o Designer virou insert/update/delete.
--
-- O desenho original está escrito em dois lugares:
--   • migration_rls.sql:124-127   -> "escrita: só a equipe" (sou_equipe)
--   • migration_design.sql:849-852 -> "política adicional DE LEITURA
--     (nunca escrita)" para o Designer
-- E o próprio sistema conta com isso: js/permissoes.js:44 afirma que
-- "o RLS do banco bloqueia a escrita de verdade mesmo se alguém pular a
-- UI". Desde o corte 2 isso deixou de ser verdade: um designer ou
-- videomaker autenticado podia chamar a API direto e apagar ou alterar
-- clientes, linhas editoriais, conteúdos, roteiros e gravações de
-- QUALQUER cliente.
--
-- O QUE ESTE ARQUIVO FAZ
--   • escrita (insert/update/delete) volta a exigir sou_equipe()
--   • leitura continua para toda a equipe interna (sou_equipe_interna),
--     que é o que Designer e Videomaker precisam para ver o briefing
--   • 'atividades' é a exceção: é o registro de "quem fez o quê", e o
--     Designer e o Videomaker precisam inserir ao concluir o trabalho
--     (js/database.js:123). Lá o insert continua liberado para a equipe
--     interna, mas update e delete passam a ser só da coordenação.
--
-- As políticas de leitura do cliente (corte 2, parte 3) não são tocadas.
--
-- SEGURO DE RODAR MAIS DE UMA VEZ.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) sou_equipe_interna() com uma definição só
--    migration_design.sql:42 criou sem videomaker e migration_video.sql:58
--    recriou com videomaker. Como é "create or replace", quem vale é a
--    última migração aplicada — ou seja, dependia da ordem. Fixamos na
--    versão com videomaker, que é a que o sistema de vídeo espera.
-- ---------------------------------------------------------------------
create or replace function public.sou_equipe_interna()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('admin', 'coordenador', 'designer', 'videomaker'), false)
$$;
revoke all on function public.sou_equipe_interna() from public;
grant execute on function public.sou_equipe_interna() to authenticated;

-- ---------------------------------------------------------------------
-- 2) as 17 tabelas editoriais: equipe interna lê, coordenação escreve
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['cenas','cliente_inteligencia','clientes','conteudos','frames','gravacoes',
    'ideias','linhas_editoriais','onboardings','pilares','produtos','provas','roteiros','slides',
    'status_itens','status_semanais','status_versoes']
  loop
    if not exists (select 1 from information_schema.tables
                   where table_schema = 'public' and table_name = t) then
      continue;
    end if;

    -- a política "for all" do corte 2 sai de cena
    execute format('drop policy if exists %I on public.%I', t || '_equipe', t);

    -- leitura: toda a equipe interna (inclui Designer e Videomaker)
    execute format('drop policy if exists %I on public.%I', t || '_interna_leitura', t);
    execute format('create policy %I on public.%I for select to authenticated
                      using (public.sou_equipe_interna())', t || '_interna_leitura', t);

    -- escrita: só admin e coordenador
    execute format('drop policy if exists %I on public.%I', t || '_equipe_escrita', t);
    execute format('create policy %I on public.%I for insert to authenticated
                      with check (public.sou_equipe())', t || '_equipe_escrita', t);

    execute format('drop policy if exists %I on public.%I', t || '_equipe_update', t);
    execute format('create policy %I on public.%I for update to authenticated
                      using (public.sou_equipe()) with check (public.sou_equipe())', t || '_equipe_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_equipe_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated
                      using (public.sou_equipe())', t || '_equipe_delete', t);

    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3) atividades: a equipe interna registra o que fez; só a coordenação
--    corrige ou apaga o registro
-- ---------------------------------------------------------------------
drop policy if exists atividades_equipe          on public.atividades;
drop policy if exists atividades_interna_leitura on public.atividades;
drop policy if exists atividades_interna_insert  on public.atividades;
drop policy if exists atividades_equipe_update   on public.atividades;
drop policy if exists atividades_equipe_delete   on public.atividades;

create policy atividades_interna_leitura on public.atividades for select to authenticated
  using (public.sou_equipe_interna());
create policy atividades_interna_insert on public.atividades for insert to authenticated
  with check (public.sou_equipe_interna());
create policy atividades_equipe_update on public.atividades for update to authenticated
  using (public.sou_equipe()) with check (public.sou_equipe());
create policy atividades_equipe_delete on public.atividades for delete to authenticated
  using (public.sou_equipe());

revoke all on public.atividades from anon;

-- ---------------------------------------------------------------------
-- 4) conferência — rode depois de aplicar.
--    Esperado: nenhuma linha com cmd = 'ALL' e sou_equipe_interna no
--    "using" para as tabelas acima.
-- ---------------------------------------------------------------------
-- select tablename, policyname, cmd, qual
--   from pg_policies
--  where schemaname = 'public'
--    and tablename in ('cenas','cliente_inteligencia','clientes','conteudos','frames',
--                      'gravacoes','ideias','linhas_editoriais','onboardings','pilares',
--                      'produtos','provas','roteiros','slides','status_itens',
--                      'status_semanais','status_versoes','atividades')
--  order by tablename, cmd;
