-- Asserções da zzz389: cadastro do cliente, marca, equipe e pacote por cliente
\set ON_ERROR_STOP 1
insert into perfis (id, nome, papel, funcao, nivel_clientes) values
  ('00000000-0000-0000-0000-0000000000a1', 'Yury', 'admin', null, 3),
  ('00000000-0000-0000-0000-0000000000f1', 'Bruna', 'admin', null, 3),
  ('00000000-0000-0000-0000-0000000000d1', 'Dani', 'designer', 'designer', 1),
  ('00000000-0000-0000-0000-0000000000b1', 'Vic', 'videomaker', 'videomaker', 1),
  ('00000000-0000-0000-0000-0000000000e1', 'Cora', 'coordenador', 'coordenador', 2),
  ('00000000-0000-0000-0000-0000000000cc', 'Dona Cliente', 'cliente', null, 0);
insert into pacotes_producao (id, nome, itens) values
  ('00000000-0000-0000-0000-00000000aa01', 'Pro', '[{"tipo":"Reel","qtd":4,"producao":"gravacao"},{"tipo":"Card","qtd":12}]'),
  ('00000000-0000-0000-0000-00000000aa02', 'Básico', '[{"tipo":"Card","qtd":8}]');
insert into clientes (id, nome, pacote_id) values
  ('00000000-0000-0000-0000-0000000000c1', 'Alfa', '00000000-0000-0000-0000-00000000aa01'),
  ('00000000-0000-0000-0000-0000000000c2', 'Beta', null);

create or replace function pg_temp.sou(p uuid) returns void language sql as $$ select set_config('teste.uid', p::text, false) $$;
create or replace function pg_temp.recusa(p_sql text, p_como text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then
    if p_como = '42501' and sqlstate <> '42501' then raise exception 'esperava 42501 em: % (veio %: %)', p_sql, sqlstate, sqlerrm; end if;
    if p_como <> '42501' and position(p_como in sqlerrm) = 0 then raise exception 'esperava "%" em: % (veio: %)', p_como, p_sql, sqlerrm; end if;
    return;
  end;
  raise exception 'deveria ter recusado: %', p_sql;
end $$;

set role authenticated;

-- 1) cliente do portal não lê nada do cadastro
select pg_temp.sou('00000000-0000-0000-0000-0000000000cc');
select pg_temp.recusa($$select cliente_cadastro('00000000-0000-0000-0000-0000000000c1')$$, '42501');
select pg_temp.recusa($$select cliente_pacote_efetivo('00000000-0000-0000-0000-0000000000c1')$$, '42501');
select pg_temp.recusa($$select cliente_cadastro_pessoas()$$, '42501');
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"marca":{"estilo":"x"}}')$$, '42501');

-- 2) designer lê, mas não edita
select pg_temp.sou('00000000-0000-0000-0000-0000000000d1');
do $$ begin assert (cliente_cadastro('00000000-0000-0000-0000-0000000000c1')->'cliente'->>'nome') = 'Alfa'; end $$;
do $$ begin assert (cliente_cadastro('00000000-0000-0000-0000-0000000000c1')->>'pode_editar')::boolean = false; end $$;
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"marca":{"estilo":"x"}}')$$, '42501');

-- 2b) coordenação com nível 2 edita; com a ação "editar cliente" negada, não (mesma regra do UPDATE em clientes)
select pg_temp.sou('00000000-0000-0000-0000-0000000000e1');
do $$ begin assert (cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c2', '{"marca":{"estilo":"ok"}}')->'marca'->>'estilo') = 'ok'; end $$;
reset role; insert into acoes_negadas values ('00000000-0000-0000-0000-0000000000e1', 'cliente.editar'); set role authenticated;
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c2', '{"marca":{"estilo":"x"}}')$$, '42501');
do $$ begin assert (cliente_cadastro('00000000-0000-0000-0000-0000000000c2')->>'pode_editar')::boolean = false; end $$;

-- 3) o Financeiro (admin) salva cada bloco; salvar um não mexe no outro
select pg_temp.sou('00000000-0000-0000-0000-0000000000f1');
do $$ declare r jsonb; begin
  r := cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"interno":{"cnpj":"12.345.678/0001-90","cidade":"Vitória da Conquista - BA",
        "resp_nome":"<img src=x onerror=alert(1)>","resp_cargo":"Dona","resp_whatsapp":"(77) 99999-0000","resp_email":" Dona@Alfa.com ",
        "combinado":"2 gravações por mês","inicio_servico":"2026-03-01","observacoes":"tom leve"},
      "perfil":{"nicho":"Clínica","site":"alfa.com.br","instagram":"@alfa"}}');
  assert r->'interno'->>'cnpj' = '12345678000190', r::text;
  assert r->'interno'->>'resp_whatsapp' = '77999990000';
  assert r->'interno'->>'resp_email' = 'dona@alfa.com';
  assert r->'interno'->>'resp_nome' = '<img src=x onerror=alert(1)>';   -- guardado como texto; a tela é que escapa
  assert r->'interno'->>'inicio_servico' = '2026-03-01';
  assert r->'perfil'->>'site' = 'https://alfa.com.br' and r->'perfil'->>'instagram' = 'alfa' and r->'perfil'->>'nicho' = 'Clínica';
  r := cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"marca":{"cores":[{"hex":"#1a2b3c","nome":"principal"},{"hex":"#FFFFFF"}],
        "fonte_titulo":"Montserrat","link":"https://drive.google.com/x","estilo":"fotos claras"}}');
  assert r->'marca'->'cores'->0->>'hex' = '#1A2B3C' and jsonb_array_length(r->'marca'->'cores') = 2;
  assert r->'marca'->>'fonte_titulo' = 'Montserrat' and r->'marca'->>'fonte_texto' = '';
  assert r->'interno'->>'cidade' = 'Vitória da Conquista - BA', 'salvar a marca não mexe no interno';
  r := cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"interno":{"cidade":"Salvador - BA"}}');
  assert r->'interno'->>'cidade' = 'Salvador - BA' and r->'interno'->>'cnpj' = '12345678000190', 'só a chave que veio muda';
end $$;

-- 4) validações (nada é gravado quando recusa)
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"interno":{"cidade":"NÃO GRAVAR","cnpj":"1234567800019"}}')$$, '14 números');
do $$ begin assert (cliente_cadastro('00000000-0000-0000-0000-0000000000c1')->'interno'->>'cidade') = 'Salvador - BA'; end $$;
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"interno":{"resp_whatsapp":"12345"}}')$$, '10 a 13');
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"interno":{"resp_email":"semarroba"}}')$$, 'e-mail');
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"marca":{"cores":[{"hex":"#12"}]}}')$$, '#RRGGBB');
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"marca":{"cores":[{"hex":"#000000"},{"hex":"#000001"},{"hex":"#000002"},{"hex":"#000003"},{"hex":"#000004"},{"hex":"#000005"},{"hex":"#000006"},{"hex":"#000007"},{"hex":"#000008"}]}}')$$, '8 cores');
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"marca":{"link":"http://x.com"}}')$$, 'https://');
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"marca":{"link":"javascript:alert(1)"}}')$$, 'https://');
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"pacote":{"ajuste":[{"tipo":"Card","qtd":0}]}}')$$, 'inválido');
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"pacote":{"ajuste":[{"tipo":"Banner","qtd":3}]}}')$$, 'inválido');
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"pacote":{"ajuste":[{"tipo":"Card","qtd":60},{"tipo":"Reel","qtd":60},{"tipo":"Story","qtd":1}]}}')$$, 'inválido');

-- 5) pacote efetivo: sem ajuste = padrão; com ajuste = ajuste; igual ao padrão não conta como ajuste
do $$ declare r jsonb; begin
  r := cliente_pacote_efetivo('00000000-0000-0000-0000-0000000000c1');
  assert (r->>'ajustado')::boolean = false and r->'itens' = r->'padrao' and r->>'nome' = 'Pro', r::text;
  r := cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"pacote":{"ajuste":[{"tipo":"Reel","qtd":4,"producao":"gravacao"},{"tipo":"Card","qtd":12}]}}')->'pacote';
  assert (r->>'ajustado')::boolean = false, 'ajuste igual ao padrão não é ajuste';
  r := cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"pacote":{"ajuste":[{"tipo":"Reel","qtd":2,"producao":"gravacao"},{"tipo":"Reel","qtd":1,"producao":"edicao"},{"tipo":"Card","qtd":10}]}}')->'pacote';
  assert (r->>'ajustado')::boolean and jsonb_array_length(r->'itens') = 3 and jsonb_array_length(r->'padrao') = 2, r::text;
  assert cliente_pacote_efetivo('00000000-0000-0000-0000-0000000000c2')->'itens' = '[]'::jsonb, 'sem pacote = lista vazia';
end $$;

-- 6) Contratado × entregue usa o ajuste (Reel 2+1 = 3; Card 10) e respeita o "vale desde"
select pg_temp.sou('00000000-0000-0000-0000-0000000000a1');
do $$ declare r jsonb; a jsonb; begin
  r := gestao_contratado(extract(year from current_date)::int, extract(month from current_date)::int);
  a := r->'clientes'->0;
  assert a->>'nome' = 'Alfa' and (a->>'contratado')::int = 13 and (a->>'ajustado')::boolean, r::text;
  assert (select (x->>'contratado')::int from jsonb_array_elements(a->'itens') x where x->>'tipo' = 'Reel') = 3;
  assert jsonb_array_length(r->'comeca') = 0;
  perform cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1',
    jsonb_build_object('pacote', jsonb_build_object('desde', (date_trunc('month', current_date) + interval '1 month')::date)));
  r := gestao_contratado(extract(year from current_date)::int, extract(month from current_date)::int);
  assert jsonb_array_length(r->'clientes') = 0 and r->'comeca'->0->>'nome' = 'Alfa', r::text;
  assert not exists (select 1 from jsonb_array_elements(r->'sem_pacote') x where x->>'nome' = 'Alfa');
  perform cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1',
    jsonb_build_object('pacote', jsonb_build_object('desde', date_trunc('month', current_date)::date)));
  assert jsonb_array_length(gestao_contratado(extract(year from current_date)::int, extract(month from current_date)::int)->'clientes') = 1;
  assert (cliente_pacote_efetivo('00000000-0000-0000-0000-0000000000c1')->>'ajustado')::boolean, 'mudar só o "desde" mantém o ajuste';
end $$;

-- 7) Nova linha editorial com o pacote do cliente nasce com o ajuste (13 conteúdos, 1 Reel só edição)
insert into linhas_editoriais (id, client_id, ano, mes) values ('00000000-0000-0000-0000-000000001111', '00000000-0000-0000-0000-0000000000c1',
  extract(year from current_date)::int, extract(month from current_date)::int);
do $$ begin
  assert linha_aplicar_pacote('00000000-0000-0000-0000-000000001111', '00000000-0000-0000-0000-00000000aa01') = 13;
  assert (select count(*) from conteudos where linha_id = '00000000-0000-0000-0000-000000001111' and tipo = 'Reel' and producao_video = 'edicao') = 1;
  assert (cliente_pacote_efetivo('00000000-0000-0000-0000-0000000000c1')->>'ajustado')::boolean, 'usar o próprio pacote mantém o ajuste';
end $$;

-- 8) trocar o pacote descarta o ajuste — pelo cadastro e pela linha editorial
do $$ declare r jsonb; begin
  r := cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"pacote":{"pacote_id":"00000000-0000-0000-0000-00000000aa02"}}')->'pacote';
  assert r->>'nome' = 'Básico' and (r->>'ajustado')::boolean = false and r->'itens' = '[{"tipo":"Card","qtd":8}]'::jsonb, r::text;
  -- pacote novo já com ajuste novo, na mesma gravação
  r := cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"pacote":{"pacote_id":"00000000-0000-0000-0000-00000000aa01","ajuste":[{"tipo":"Card","qtd":9}]}}')->'pacote';
  assert r->>'nome' = 'Pro' and (r->>'ajustado')::boolean and r->'itens' = '[{"tipo":"Card","qtd":9}]'::jsonb, r::text;
  -- "voltar ao padrão"
  r := cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"pacote":{"ajuste":null}}')->'pacote';
  assert (r->>'ajustado')::boolean = false and r->>'nome' = 'Pro';
  perform cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"pacote":{"ajuste":[{"tipo":"Card","qtd":9}]}}');
end $$;
insert into linhas_editoriais (id, client_id, ano, mes) values ('00000000-0000-0000-0000-000000002222', '00000000-0000-0000-0000-0000000000c1',
  extract(year from current_date)::int, extract(month from current_date)::int);
do $$ declare r jsonb; begin
  assert linha_aplicar_pacote('00000000-0000-0000-0000-000000002222', '00000000-0000-0000-0000-00000000aa02') = 8;
  r := cliente_pacote_efetivo('00000000-0000-0000-0000-0000000000c1');
  assert r->>'nome' = 'Básico' and (r->>'ajustado')::boolean = false, 'linha com outro pacote troca o pacote e limpa o ajuste: ' || r::text;
end $$;

-- 8b) ajuste inválido gravado direto na tabela (fora da função) é recusado
select pg_temp.recusa($$update clientes set pacote_ajuste = '[{"tipo":"Card","qtd":"x"}]' where id = '00000000-0000-0000-0000-0000000000c1'$$, 'inválido');

-- 9) pacote arquivado em uso continua valendo; não dá para escolher um arquivado novo; tirar o pacote limpa tudo
reset role;
update pacotes_producao set arquivado_em = now() where id in ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-00000000aa02');
set role authenticated;
do $$ declare r jsonb; begin
  r := cliente_pacote_efetivo('00000000-0000-0000-0000-0000000000c1');
  assert (r->>'arquivado')::boolean and jsonb_array_length(r->'itens') = 1, r::text;
  r := cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"pacote":{"ajuste":[{"tipo":"Card","qtd":6}]}}')->'pacote';
  assert (r->>'ajustado')::boolean, 'dá para ajustar quem já está num pacote arquivado';
  assert jsonb_array_length(gestao_contratado(extract(year from current_date)::int, extract(month from current_date)::int)->'clientes') = 1;
end $$;
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"pacote":{"pacote_id":"00000000-0000-0000-0000-00000000aa01"}}')$$, 'arquivado');
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"pacote":{"pacote_id":"00000000-0000-0000-0000-00000000ffff"}}')$$, 'não encontrado');
do $$ declare r jsonb; begin
  r := cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"pacote":{"pacote_id":null}}')->'pacote';
  assert r->>'pacote_id' is null and r->'itens' = '[]'::jsonb and (r->>'ajustado')::boolean = false, r::text;
end $$;

-- 10) equipe responsável: só quem é da função; null tira
do $$ declare r jsonb; begin
  r := cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"equipe":{"designer":"00000000-0000-0000-0000-0000000000d1","coordenador":"00000000-0000-0000-0000-0000000000a1"}}')->'equipe';
  assert r->'designer'->>'nome' = 'Dani' and r->'coordenador'->>'nome' = 'Yury' and r->'videomaker' = 'null'::jsonb, r::text;
  r := cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"equipe":{"designer":null}}')->'equipe';
  assert r->'designer' = 'null'::jsonb and r->'coordenador'->>'nome' = 'Yury';
  r := cliente_cadastro_pessoas();
  assert jsonb_array_length(r->'designer') = 1 and jsonb_array_length(r->'videomaker') = 1 and jsonb_array_length(r->'coordenador') = 3, r::text;
end $$;
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"equipe":{"designer":"00000000-0000-0000-0000-0000000000b1"}}')$$, 'não pode ser responsável');
select pg_temp.recusa($$select cliente_cadastro_salvar('00000000-0000-0000-0000-0000000000c1', '{"equipe":{"videomaker":"00000000-0000-0000-0000-0000000000cc"}}')$$, 'não pode ser responsável');

-- 11) as tabelas novas: equipe lê, cliente não lê, ninguém escreve direto
do $$ begin assert (select count(*) from cliente_marca) = 2 and (select count(*) from cliente_responsaveis) = 1; end $$;
select pg_temp.recusa($$insert into cliente_marca (client_id) values ('00000000-0000-0000-0000-0000000000c2')$$, '42501');
select pg_temp.recusa($$update cliente_responsaveis set perfil_id = '00000000-0000-0000-0000-0000000000d1'$$, '42501');
select pg_temp.sou('00000000-0000-0000-0000-0000000000cc');
do $$ begin assert (select count(*) from cliente_marca) = 0 and (select count(*) from cliente_responsaveis) = 0, 'cliente não lê marca nem equipe'; end $$;
select pg_temp.recusa($$select pacotes_uso()$$, '42501');
select pg_temp.sou('00000000-0000-0000-0000-0000000000f1');
do $$ begin assert pacotes_uso() = '{}'::jsonb; end $$;
reset role;
select 'cadastro OK';
