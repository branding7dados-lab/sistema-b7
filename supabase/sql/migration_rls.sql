-- =====================================================================
-- CORTE DO RLS — NÃO RODE ANTES DE CONSEGUIR ENTRAR COMO ADMIN
--
-- Até aqui as políticas eram abertas: qualquer pessoa com a chave anon
-- acessava tudo. Esta migration troca isso por acesso baseado em quem
-- está autenticado.
--
-- ORDEM OBRIGATÓRIA
--   1. migration_auth.sql rodado
--   2. função b7-auth publicada
--   3. bootstrap do Admin concluído
--   4. login testado, com a sessão funcionando
--   5. só então esta migration
--
-- Rodar antes do passo 4 tranca todo mundo do lado de fora, inclusive
-- você. Não há como reverter pela aplicação: seria preciso voltar às
-- políticas abertas pelo SQL Editor.
--
-- VOLTA ATRÁS: o arquivo migration_rls_reverter.sql, gerado junto,
-- devolve as políticas abertas. Guarde-o à mão antes de rodar isto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PRÉ-REQUISITOS
-- Falhar aqui, com a instrução na tela, é melhor do que quebrar no meio
-- e deixar metade das políticas trocadas.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'linhas_editoriais'
                    and column_name = 'visivel_cliente') then
    raise exception 'Falta rodar migration_portal.sql antes deste arquivo (a coluna visivel_cliente não existe).';
  end if;
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'perfis') then
    raise exception 'Falta rodar migration_auth.sql antes deste arquivo.';
  end if;
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'kanban_demandas') then
    raise exception 'Falta rodar migration_kanban.sql antes deste arquivo.';
  end if;
end $$;

do $$
declare
  admins int;
begin
  select count(*) into admins
    from public.perfis where papel = 'admin' and estado = 'ativa';
  if admins = 0 then
    raise exception
      'Nenhum administrador ativo encontrado. Rode o bootstrap antes do corte do RLS, senão ninguém consegue entrar.';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- LIMPEZA DAS POLÍTICAS ANTIGAS
--
-- Políticas RLS se somam: basta UMA antiga com `using (true)` para toda
-- a restrição nova virar decoração. Os nomes antigos variam
-- (acesso_interno_*, *_tudo, nomes do painel), então não dá para
-- adivinhá-los um a um — apagamos tudo que existe na tabela antes de
-- escrever as regras novas.
-- ---------------------------------------------------------------------
create or replace function public.limpar_politicas(p_tabela text)
returns void language plpgsql as $$
declare pol record;
begin
  for pol in select policyname from pg_policies
              where schemaname = 'public' and tablename = p_tabela
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, p_tabela);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- OPERACIONAL — a equipe trabalha, o cliente só vê o que é dele
--
-- Tabelas com client_id direto: o cliente enxerga as da própria empresa,
-- desde que o serviço esteja ativo (posso_ver_cliente cuida disso).
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clientes', 'linhas_editoriais',
                           'conteudos', 'status_semanais']
  loop
    execute format('alter table public.%I enable row level security', t);
    perform public.limpar_politicas(t);

    /* Leitura: a equipe vê tudo; o cliente vê o que é da empresa dele.
       Para conteúdos e linhas editoriais há um segundo filtro: só o que
       a equipe marcou como visível no portal. Existir no banco não torna
       um rascunho visível ao cliente. */
    if t = 'clientes' then
      execute format($f$
        create policy %I on public.%I for select to authenticated
          using (public.posso_ver_cliente(id))
      $f$, t || '_leitura', t);
    elsif t in ('conteudos', 'linhas_editoriais') then
      execute format($f$
        create policy %I on public.%I for select to authenticated
          using (public.sou_equipe() or
                 (public.posso_ver_cliente(client_id) and coalesce(visivel_cliente, false)))
      $f$, t || '_leitura', t);
    elsif t = 'status_semanais' then
      /* status semanal: o cliente vê o que foi publicado, não o rascunho */
      execute format($f$
        create policy %I on public.%I for select to authenticated
          using (public.sou_equipe() or
                 (public.posso_ver_cliente(client_id) and publicado_em is not null))
      $f$, t || '_leitura', t);
    else
      execute format($f$
        create policy %I on public.%I for select to authenticated
          using (public.posso_ver_cliente(client_id))
      $f$, t || '_leitura', t);
    end if;

    /* escrita: só a equipe. O cliente comenta e aprova por outras
       tabelas, nunca alterando o conteúdo canônico. */
    execute format($f$
      create policy %I on public.%I for all to authenticated
        using (public.sou_equipe()) with check (public.sou_equipe())
    $f$, t || '_escrita', t);

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- GRAVAÇÕES — operação interna da agência
-- O cliente acompanha o resultado, não a logística de gravação.
-- ---------------------------------------------------------------------
do $$
begin
  alter table public.gravacoes enable row level security;
  perform public.limpar_politicas('gravacoes');
  create policy gravacoes_equipe on public.gravacoes for all to authenticated
    using (public.sou_equipe()) with check (public.sou_equipe());
  revoke all on public.gravacoes from anon;
  grant select, insert, update, delete on public.gravacoes to authenticated;
end $$;

-- ---------------------------------------------------------------------
-- FILHAS — pertencem a um registro pai; a permissão vem de lá
-- ---------------------------------------------------------------------
do $$
begin
  /* roteiros → gravação → cliente */
  alter table public.roteiros enable row level security;
  perform public.limpar_politicas('roteiros');
  /* O cliente lê o roteiro pelo snapshot da versão enviada, não pela
     tabela: assim ele nunca vê uma edição em andamento, e a versão que
     ele aprovou não muda debaixo dele. Por isso a leitura direta é só
     da equipe. */
  create policy roteiros_leitura on public.roteiros for select to authenticated
    using (public.sou_equipe());
  create policy roteiros_escrita on public.roteiros for all to authenticated
    using (public.sou_equipe()) with check (public.sou_equipe());
  revoke all on public.roteiros from anon;
  grant select, insert, update, delete on public.roteiros to authenticated;

  /* cenas → roteiro → gravação → cliente */
  alter table public.cenas enable row level security;
  perform public.limpar_politicas('cenas');
  create policy cenas_leitura on public.cenas for select to authenticated
    using (public.sou_equipe());
  create policy cenas_escrita on public.cenas for all to authenticated
    using (public.sou_equipe()) with check (public.sou_equipe());
  revoke all on public.cenas from anon;
  grant select, insert, update, delete on public.cenas to authenticated;
end $$;

/* slides e frames → conteúdo → cliente */
do $$
declare t text;
begin
  foreach t in array array['slides', 'frames']
  loop
    execute format('alter table public.%I enable row level security', t);
    perform public.limpar_politicas(t);
    execute format($f$
      create policy %I on public.%I for select to authenticated
        using (public.sou_equipe() or exists (
                 select 1 from public.conteudos c
                  where c.id = content_id
                    and public.posso_ver_cliente(c.client_id)
                    and coalesce(c.visivel_cliente, false)))
    $f$, t || '_leitura', t);
    execute format($f$
      create policy %I on public.%I for all to authenticated
        using (public.sou_equipe()) with check (public.sou_equipe())
    $f$, t || '_escrita', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

/* itens e versões do status semanal → relatório → cliente */
do $$
declare t text;
begin
  foreach t in array array['status_itens', 'status_versoes']
  loop
    execute format('alter table public.%I enable row level security', t);
    perform public.limpar_politicas(t);
    execute format($f$
      create policy %I on public.%I for select to authenticated
        using (public.sou_equipe() or exists (
                 select 1 from public.status_semanais s
                  where s.id = report_id
                    and public.posso_ver_cliente(s.client_id)
                    and s.publicado_em is not null))
    $f$, t || '_leitura', t);
    execute format($f$
      create policy %I on public.%I for all to authenticated
        using (public.sou_equipe()) with check (public.sou_equipe())
    $f$, t || '_escrita', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- INTERNAS — o cliente não vê, nem por engano
--
-- Ideias, inteligência, onboarding, atividades e histórico de serviço são
-- material de trabalho da agência.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['ideias', 'cliente_inteligencia', 'produtos', 'provas',
                           'onboardings', 'atividades', 'pilares']
  loop
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I enable row level security', t);
      perform public.limpar_politicas(t);
      execute format($f$
        create policy %I on public.%I for all to authenticated
          using (public.sou_equipe()) with check (public.sou_equipe())
      $f$, t || '_equipe', t);
      execute format('revoke all on public.%I from anon', t);
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- STORAGE — logos continuam públicas para LEITURA (a folha A4 e o portal
-- mostram a logo). Subir, trocar e apagar passa a ser só da equipe
-- logada: antes, qualquer pessoa com a chave anon apagava todas as logos.
-- ---------------------------------------------------------------------
drop policy if exists logos_escrita on storage.objects;
drop policy if exists logos_troca   on storage.objects;
drop policy if exists logos_remocao on storage.objects;
create policy logos_escrita on storage.objects
  for insert to authenticated with check (bucket_id = 'client-logos' and public.sou_equipe());
create policy logos_troca on storage.objects
  for update to authenticated using (bucket_id = 'client-logos' and public.sou_equipe())
  with check (bucket_id = 'client-logos' and public.sou_equipe());
create policy logos_remocao on storage.objects
  for delete to authenticated using (bucket_id = 'client-logos' and public.sou_equipe());

-- ---------------------------------------------------------------------
-- A CHAVE ANON DEIXA DE ABRIR PORTAS
-- Ela continua necessária para o cliente-JS falar com o PostgREST, mas
-- sem sessão não alcança mais nenhuma tabela.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant usage on schema public to anon, authenticated;
grant usage on all sequences in schema public to authenticated;
