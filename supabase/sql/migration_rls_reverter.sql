-- =====================================================================
-- VOLTA ATRÁS DO CORTE DO RLS
--
-- Use se o corte deixar alguém sem acesso e for preciso voltar ao estado
-- anterior enquanto o problema é investigado. Roda no SQL Editor do
-- Supabase, que não depende da aplicação — por isso funciona mesmo com
-- todo mundo trancado do lado de fora.
--
-- Isto devolve as políticas abertas: qualquer pessoa com a chave anon
-- volta a acessar os dados. É um passo de emergência, não um estado para
-- ficar.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['clientes','gravacoes','roteiros','cenas',
                           'linhas_editoriais','conteudos','slides','frames',
                           'ideias','cliente_inteligencia','produtos','provas',
                           'onboardings','atividades','pilares',
                           'status_semanais','status_itens','status_versoes']
  loop
    if exists (select 1 from information_schema.tables
                where table_schema='public' and table_name=t) then
      execute format('drop policy if exists %I on public.%I', t||'_leitura', t);
      execute format('drop policy if exists %I on public.%I', t||'_escrita', t);
      execute format('drop policy if exists %I on public.%I', t||'_equipe', t);
      execute format('drop policy if exists %I on public.%I', t||'_tudo', t);
      execute format($f$
        create policy %I on public.%I for all using (true) with check (true)
      $f$, t||'_tudo', t);
      execute format('grant all on public.%I to anon, authenticated', t);
    end if;
  end loop;
end $$;

grant usage on schema public to anon, authenticated;

/* As views também tinham perdido o acesso anon no corte; sem isto o modo
   sem sessão continua quebrado depois de reverter. */
do $$
declare v text;
begin
  foreach v in array array['clientes_resumo','gravacoes_resumo','linhas_resumo','status_resumo']
  loop
    if exists (select 1 from information_schema.views where table_schema='public' and table_name=v) then
      execute format('grant select on public.%I to anon, authenticated', v);
    end if;
  end loop;
end $$;

/* Storage volta ao estado aberto de antes do corte. */
drop policy if exists logos_escrita on storage.objects;
drop policy if exists logos_troca   on storage.objects;
drop policy if exists logos_remocao on storage.objects;
create policy logos_escrita on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'client-logos');
create policy logos_troca on storage.objects
  for update to anon, authenticated using (bucket_id = 'client-logos') with check (bucket_id = 'client-logos');
create policy logos_remocao on storage.objects
  for delete to anon, authenticated using (bucket_id = 'client-logos');
