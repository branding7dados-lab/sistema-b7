-- Teste do otto_acao SEM deixar rastro: cria, edita e exclui uma demanda
-- de teste e, no fim, desfaz tudo (o erro proposital desfaz a transação).
-- A saída esperada é um erro "TESTE_OTTO ..." com os resultados.
do $$
declare quem uuid; cli uuid; vm uuid; r1 jsonb; r2 jsonb; r3 jsonb; r0 jsonb;
begin
  select id into quem from public.perfis where estado = 'ativa' and papel = 'admin' and nome not ilike '%teste%' order by superadmin desc nulls last, created_at limit 1;
  select id into cli from public.clientes where deleted_at is null order by nome limit 1;
  select id into vm from public.perfis where estado = 'ativa' and papel = 'videomaker' limit 1;
  r0 := public.otto_acao(gen_random_uuid(), 'criar', '{}'::jsonb);
  r1 := public.otto_acao(quem, 'criar', jsonb_build_object('client_id', cli, 'titulo', 'TESTE OTTO', 'prazo', (current_date + 3)::text, 'referencia_link', 'https://exemplo.com/trend'));
  r2 := public.otto_acao(quem, 'editar', jsonb_build_object('id', r1->>'id', 'prioridade', 'urgente', 'videomaker_id', vm, 'prazo', (current_date + 5)::text));
  r3 := public.otto_acao(quem, 'excluir', jsonb_build_object('id', r1->>'id'));
  raise exception 'TESTE_OTTO sem_perfil=% | criar=% | editar=% | excluir=% | uid_depois=%', r0, r1, r2, r3,
    (select jsonb_build_object('prioridade', prioridade, 'vm', videomaker_id is not null, 'prazo', prazo, 'ref', referencia_link, 'apagada', deleted_at is not null, 'criado_por_ok', criado_por = quem) from public.demandas_edicao where id = (r1->>'id')::uuid);
end $$;
