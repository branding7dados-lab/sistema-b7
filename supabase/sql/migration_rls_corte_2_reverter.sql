-- Reverte o Corte do RLS 2 (volta ao estado ABERTO e inseguro, só para emergência).
do $$
declare t text;
begin
  foreach t in array array['atividades','cenas','cliente_inteligencia','clientes','conteudos','frames','gravacoes',
    'ideias','linhas_editoriais','onboardings','pilares','produtos','provas','roteiros','slides']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_equipe', t);
    execute format('create policy %I on public.%I for all to anon, authenticated using (true) with check (true)', 'acesso_interno_' || t, t);
    execute format('grant all on public.%I to anon', t);
  end loop;
  foreach t in array array['status_itens','status_semanais','status_versoes'] loop
    execute format('drop policy if exists %I on public.%I', t || '_equipe', t);
    execute format('create policy %I on public.%I for all using (true) with check (true)', t || '_tudo', t);
    execute format('grant all on public.%I to anon', t);
  end loop;
end $$;
drop policy if exists clientes_cliente_leitura on public.clientes;
drop policy if exists conteudos_cliente_leitura on public.conteudos;
drop policy if exists linhas_editoriais_cliente_leitura on public.linhas_editoriais;
drop policy if exists status_semanais_cliente_leitura on public.status_semanais;
drop policy if exists status_itens_cliente_leitura on public.status_itens;
alter view public.demandas_edicao_resumo reset (security_invoker);
grant select on public.demandas_edicao_resumo to anon;
