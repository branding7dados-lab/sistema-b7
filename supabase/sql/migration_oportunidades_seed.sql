-- Fase 7 — sementes verificadas (com proveniência) e segmentos SUGERIDOS
-- Só entra o que foi conferido na fonte oficial. Idempotente.
with novas(chave, nome, aliases, tipo_data, mes, dia, regra, natureza, categorias, tags, geral, descricao, fonte, ref, url, detalhe) as (values
  (public.op_normalizar('Dia do Professor'), 'Dia do Professor', array['Dia dos Professores'], 'fixa', 10, 15, null, 'comemorativa',
   array['educacao'], array['professor','escola','educacao'], false, 'Instituído como feriado escolar pelo Decreto nº 52.682/1963.',
   'planalto', 'planalto:decreto-52682-1963', 'https://www.planalto.gov.br/ccivil_03/decreto/1950-1969/d52682.htm', 'Decreto nº 52.682/1963, art. 1º'),
  (public.op_normalizar('Dia do Cirurgião-Dentista'), 'Dia do Cirurgião-Dentista', array['Dia do Dentista','Dia da Odontologia'], 'fixa', 10, 25, null, 'comemorativa',
   array['saude','odontologia'], array['dentista','odontologia','sorriso'], false, 'Data da profissão reconhecida pelo Conselho Federal de Odontologia.',
   'conselho', 'cfo:dia-do-cirurgiao-dentista', 'https://website.cfo.org.br/o-dia-do-cirurgiao-dentista-e-a-odontologia/', 'Conselho Federal de Odontologia (CFO)'),
  (public.op_normalizar('Dia das Mães'), 'Dia das Mães', array[]::text[], 'regra', 5, null, 'nth:5:0:2', 'comemorativa',
   array['familia'], array['maes','familia','presente'], true, 'Segundo domingo de maio (Decreto nº 21.366/1932).',
   'planalto', 'planalto:decreto-21366-1932', 'https://www.planalto.gov.br/ccivil_03/decreto/1930-1949/D21366.htm', 'Decreto nº 21.366/1932, art. 1º')
), ins as (
  insert into public.oportunidades (chave, nome, aliases, descricao, tipo_data, mes, dia, regra, duracao_dias, natureza, abrangencia,
    categorias, tags, geral, confiabilidade, revisao, verificado_em)
  select chave, nome, aliases, descricao, tipo_data, mes, dia, regra, 1, natureza, 'nacional', categorias, tags, geral, 'oficial', 'ok', now()
    from novas on conflict (chave) do nothing returning id, chave
)
insert into public.oportunidade_provas (oportunidade_id, fonte_id, referencia, titulo_na_fonte, url, detalhe, visto_em, ativo)
select coalesce((select i.id from ins i where i.chave = n.chave), (select o.id from public.oportunidades o where o.chave = n.chave)),
       n.fonte, n.ref, n.nome, n.url, n.detalhe, now(), true
  from novas n
on conflict (fonte_id, referencia) do nothing;

-- segmentos SUGERIDOS (origem 'sugerido' — a equipe confirma no cliente)
insert into public.cliente_segmentos (client_id, tema_id, origem)
select c.id, s.tema, 'sugerido' from (values
  ('Mais Sorrisos','odontologia'), ('Natu Restaurante','gastronomia'), ('AutoEscola Modelo','transito'),
  ('AutoEscola Sudoeste','transito'), ('Óticas Almeida','otica'), ('C6 Farma','farmacia'), ('Ensino Plus','educacao'),
  ('Instituto Aprender e Crescer','educacao'), ('Infinite Fio','estetica'), ('Infinite Fio','medicina'), ('Atacadão dos Suplementos','nutricao')
) s(nome, tema) join public.clientes c on c.nome = s.nome
on conflict do nothing;
