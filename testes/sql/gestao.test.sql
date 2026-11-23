-- Asserções da zzz388: Contratado × entregue, Clientes em risco, Prazos e retrabalho
\set ON_ERROR_STOP 1
insert into perfis (id, nome, papel) values ('00000000-0000-0000-0000-0000000000a1', 'Yury', 'admin'), ('00000000-0000-0000-0000-0000000000d1', 'Dani', 'designer'),
  ('00000000-0000-0000-0000-0000000000b1', 'Vic', 'videomaker');
insert into pacotes_producao (id, nome, itens) values ('00000000-0000-0000-0000-00000000aa01', 'Mensal', '[{"tipo":"Reel","qtd":4},{"tipo":"Card","qtd":8}]');
insert into clientes (id, nome, pacote_id) values ('00000000-0000-0000-0000-0000000000c1', 'Alfa', '00000000-0000-0000-0000-00000000aa01'),
  ('00000000-0000-0000-0000-0000000000c2', 'Beta', null), ('00000000-0000-0000-0000-0000000000c3', 'Gama', '00000000-0000-0000-0000-00000000aa01');
-- mês passado: Alfa publicou 2 Reels + 8 Cards (abaixo); Gama publicou tudo
insert into conteudos (client_id, tipo, status, data_postagem)
  select '00000000-0000-0000-0000-0000000000c1'::uuid, 'Reel', 'Publicado', (date_trunc('month', current_date) - interval '1 month')::date + 2 from generate_series(1, 2)
  union all select '00000000-0000-0000-0000-0000000000c1', 'Card', 'Publicado', (date_trunc('month', current_date) - interval '1 month')::date + 3 from generate_series(1, 8)
  union all select '00000000-0000-0000-0000-0000000000c3', 'Reel', 'Publicado', (date_trunc('month', current_date) - interval '1 month')::date + 2 from generate_series(1, 4)
  union all select '00000000-0000-0000-0000-0000000000c3', 'Card', 'Publicado', (date_trunc('month', current_date) - interval '1 month')::date + 3 from generate_series(1, 8);
-- designer: 2 artes no mês passado (1 no prazo, 1 atrasada), 1 atrasada aberta
insert into design_deliverables (client_id, designer_id, status, prazo, versao_atual, created_at, finalizado_em) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 'finalizado', (date_trunc('month', current_date) - interval '1 month')::date + 10, 1,
     date_trunc('month', current_date) - interval '1 month' + interval '6 days', date_trunc('month', current_date) - interval '1 month' + interval '8 days'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 'finalizado', (date_trunc('month', current_date) - interval '1 month')::date + 10, 3,
     date_trunc('month', current_date) - interval '1 month' + interval '6 days', date_trunc('month', current_date) - interval '1 month' + interval '14 days'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 'em_producao', current_date - 2, 1, now() - interval '5 days', null),
  ('00000000-0000-0000-0000-0000000000c1', null, 'aguardando_producao', current_date - 1, 1, now() - interval '3 days', null);
insert into cliente_satisfacao (client_id, nota, mes, created_at) values ('00000000-0000-0000-0000-0000000000c3', 5, date_trunc('month', current_date)::date, now());

-- não-admin é recusado
set role authenticated;
do $$ begin perform set_config('teste.uid', '00000000-0000-0000-0000-0000000000d1', false); end $$;
do $$ begin
  begin perform gestao_contratado(extract(year from current_date)::int, extract(month from current_date)::int); assert false, 'designer não abre';
  exception when insufficient_privilege then null; end;
end $$;
do $$ begin perform set_config('teste.uid', '00000000-0000-0000-0000-0000000000a1', false); end $$;
do $$
declare r jsonb; a jsonb; ant date := (date_trunc('month', current_date) - interval '1 month')::date;
begin
  r := gestao_contratado(extract(year from ant)::int, extract(month from ant)::int);
  a := (select x from jsonb_array_elements(r->'clientes') x where x->>'nome' = 'Alfa');
  assert (a->>'contratado')::int = 12 and (a->>'publicados')::int = 10, 'Alfa: 12 contratados, 10 publicados';
  assert (a->>'abaixo')::boolean and (a->>'faltam')::int = 2, 'Alfa ficou abaixo do contratado, faltaram 2';
  assert (select (x->>'publicados')::int from jsonb_array_elements(a->'itens') x where x->>'tipo' = 'Reel') = 2, 'por tipo: 2 Reels';
  assert not ((select x from jsonb_array_elements(r->'clientes') x where x->>'nome' = 'Gama')->>'abaixo')::boolean, 'Gama cumpriu';
  assert r->'sem_pacote' @> '[{"nome":"Beta"}]', 'Beta sem pacote';
  assert (r->>'fechado')::boolean, 'mês passado está fechado';
  r := gestao_contratado(extract(year from current_date)::int, extract(month from current_date)::int);
  assert not (r->>'fechado')::boolean and (r->>'ritmo')::numeric between 0 and 1, 'mês atual tem ritmo esperado';
end $$;
reset role;
-- histórico da saúde: registrar 1×/dia (rodar de novo no mesmo dia não duplica)
select cliente_saude_registrar() \g /dev/null
select cliente_saude_registrar() \g /dev/null
do $$ begin
  assert (select count(*) from cliente_saude_hist where dia = current_date) = 3, 'uma linha por cliente ativo no dia';
  assert (select pontos from cliente_saude_hist where client_id = '00000000-0000-0000-0000-0000000000c1' and dia = current_date) < 100, 'Alfa perde pontos pela arte atrasada';
end $$;
insert into cliente_saude_hist (client_id, dia, pontos) values ('00000000-0000-0000-0000-0000000000c1', current_date - 28, 95);
set role authenticated;
do $$ declare r jsonb; a jsonb; g jsonb; begin
  r := gestao_riscos();
  a := (select x from jsonb_array_elements(r->'clientes') x where x->>'nome' = 'Alfa');
  g := (select x from jsonb_array_elements(r->'clientes') x where x->>'nome' = 'Gama');
  assert a is not null and g is not null, 'Alfa e Gama em risco';
  assert (a->'motivos')::text like '%caiu%' and (a->'motivos')::text like '%abaixo do contratado%', 'Alfa: saúde caiu e ficou abaixo do contratado';
  assert (g->'motivos')::text like '%nota 5%', 'Gama: nota baixa na pesquisa';
  assert jsonb_array_length(a->'semanas') >= 1, 'série semanal da saúde';
  assert not exists (select 1 from jsonb_array_elements(r->'clientes') x where x->>'nome' = 'Beta'), 'Beta sem risco não aparece';
end $$;
do $$ declare r jsonb; d jsonb; ant text := to_char(date_trunc('month', current_date) - interval '1 month', 'YYYY-MM'); begin
  r := gestao_prazos(6);
  assert jsonb_array_length(r->'meses') = 6, '6 meses';
  d := (select x from jsonb_array_elements(r->'pessoas') x where x->>'nome' = 'Dani');
  assert (select (m->>'entregas')::int from jsonb_array_elements(d->'meses') m where m->>'mes' = ant) = 2, 'Dani: 2 entregas no mês passado';
  assert (select (m->>'no_prazo_pct')::int from jsonb_array_elements(d->'meses') m where m->>'mes' = ant) = 50, 'Dani: 50% no prazo';
  assert (select (m->>'versoes')::numeric from jsonb_array_elements(d->'meses') m where m->>'mes' = ant) = 2.0, 'Dani: 2 versões por arte';
  assert (select (m->>'dias')::numeric from jsonb_array_elements(d->'meses') m where m->>'mes' = ant) = 5.0, 'Dani: 5 dias em média para entregar';
  assert (d->>'atrasados_hoje')::int = 1, 'Dani: 1 atrasada hoje';
end $$;
reset role;
\echo 'gestão OK'
