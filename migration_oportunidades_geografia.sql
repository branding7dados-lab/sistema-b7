-- =====================================================================
-- OPORTUNIDADES — GEOGRAFIA, FERIADOS LOCAIS E DATAS MAIS AMPLAS (2026-10-02)
--
-- Evolui a fase 7 (migration_oportunidades*.sql) sem estrutura paralela:
--   municipios                  referência oficial do IBGE (código de 7 dígitos)
--   cliente_municipios          cidade(s) onde o cliente atua (várias por cliente)
--   oportunidades.municipio_ibge escopo municipal por código, não por nome
--   natureza 'facultativo'      ponto facultativo ≠ feriado ≠ comemorativa
--   fontes novas                ibge_municipios, feriados_br, datas_br
--   aplicar_lote                casamento por nome respeita o escopo: o
--                               "Aniversário da Cidade" de Jequié nunca se
--                               funde ao de Vitória da Conquista
--   temas novos                 Religião e comunidade, Infância e juventude,
--                               Contabilidade e finanças
--   datas curadas               com lei/órgão de referência (fonte gravada)
--   correção                    Carnaval e Corpus Christi são ponto
--                               facultativo; Páscoa é domingo (comemorativa)
--
-- Nada aqui cria conteúdo, tarefa ou aviso. Rodar de novo é seguro.
-- =====================================================================

-- --------------------------------------------------------------- temas
insert into public.temas (id, nome, pai, ordem) values
  ('infancia', 'Infância e juventude', null, 75),
  ('financas', 'Contabilidade e finanças', null, 125),
  ('religiao', 'Religião e comunidade', null, 160)
on conflict (id) do update set nome = excluded.nome, pai = excluded.pai, ordem = excluded.ordem;

-- ---------------------------------------------------------- municípios
create table if not exists public.municipios (
  ibge text primary key check (ibge ~ '^[0-9]{7}$'),
  nome text not null,
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  atualizado_em timestamptz not null default now()
);
create index if not exists municipios_uf on public.municipios(uf);
/* as cidades dos clientes já conhecidas (o resto vem do IBGE na sincronização) */
insert into public.municipios (ibge, nome, uf) values
  ('2933307', 'Vitória da Conquista', 'BA'),
  ('2918001', 'Jequié', 'BA'),
  ('2921906', 'Mucugê', 'BA'),
  ('2704302', 'Maceió', 'AL')
on conflict (ibge) do nothing;

create table if not exists public.cliente_municipios (
  client_id uuid not null references public.clientes(id) on delete cascade,
  municipio_ibge text not null references public.municipios(ibge),
  origem text not null default 'manual' check (origem in ('manual', 'sugerido')),
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now(),
  primary key (client_id, municipio_ibge)
);
create index if not exists cliente_municipios_mun on public.cliente_municipios(municipio_ibge);

alter table public.municipios enable row level security;
alter table public.cliente_municipios enable row level security;
do $$
declare t text;
begin
  foreach t in array array['municipios', 'cliente_municipios'] loop
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.sou_equipe_interna())', t || '_leitura', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
/* escrita: só pelas funções abaixo */

create or replace function public.cliente_municipios_definir(p_client_id uuid, p_ibges text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then raise exception 'Só admin/coordenação definem a cidade do cliente.' using errcode = '42501'; end if;
  if exists (select 1 from unnest(coalesce(p_ibges, '{}')) x where x not in (select ibge from public.municipios)) then
    raise exception 'Município desconhecido.';
  end if;
  delete from public.cliente_municipios where client_id = p_client_id and municipio_ibge <> all (coalesce(p_ibges, '{}'));
  insert into public.cliente_municipios (client_id, municipio_ibge, origem, criado_por)
    select p_client_id, x, 'manual', auth.uid() from unnest(coalesce(p_ibges, '{}')) x
  on conflict (client_id, municipio_ibge) do update set origem = 'manual';
end $$;
revoke execute on function public.cliente_municipios_definir(uuid, text[]) from public, anon;

/* municípios do IBGE: só o service_role grava (sincronização) */
create or replace function public.municipios_aplicar_lote(p_itens jsonb, p_erro text default null, p_disparo text default 'cron')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_exec bigint; n int; c_novos int; c_total int;
begin
  insert into public.oportunidade_sync_execucoes (fonte_id, status, disparo) values ('ibge_municipios', 'executando', p_disparo) returning id into v_exec;
  if p_erro is not null then
    update public.oportunidade_fontes set ultima_tentativa = now(), status = 'falha', erro = left(p_erro, 500) where id = 'ibge_municipios';
    update public.oportunidade_sync_execucoes set terminado_em = now(), status = 'falha', erro = left(p_erro, 500) where id = v_exec;
    return jsonb_build_object('status', 'falha', 'erro', p_erro);
  end if;
  n := coalesce(jsonb_array_length(p_itens), 0);
  /* o Brasil tem ~5.570 municípios: lista muito menor é resposta quebrada */
  if n < 5000 then
    update public.oportunidade_fontes set ultima_tentativa = now(), status = 'suspeita', itens_ultimo = n,
      erro = format('Lista com %s municípios (esperado ~5.570). Nada foi alterado.', n) where id = 'ibge_municipios';
    update public.oportunidade_sync_execucoes set terminado_em = now(), status = 'suspeita', buscados = n,
      erro = 'lista incompleta — dados locais preservados' where id = v_exec;
    return jsonb_build_object('status', 'suspeita', 'itens', n);
  end if;
  select count(*) into c_total from public.municipios;
  insert into public.municipios (ibge, nome, uf, atualizado_em)
    select x->>'ibge', btrim(x->>'nome'), upper(x->>'uf'), now() from jsonb_array_elements(p_itens) x
     where (x->>'ibge') ~ '^[0-9]{7}$' and coalesce(btrim(x->>'nome'), '') <> '' and upper(x->>'uf') ~ '^[A-Z]{2}$'
  on conflict (ibge) do update set nome = excluded.nome, uf = excluded.uf, atualizado_em = now();
  select count(*) - c_total into c_novos from public.municipios;
  /* município que sumiu da lista não é apagado (pode ter cliente ligado) */
  update public.oportunidade_fontes set ultima_tentativa = now(), ultimo_sucesso = now(), status = 'ok', erro = null,
    itens_ultimo = n, itens_referencia = n, criados_ultimo = c_novos, atualizados_ultimo = n - c_novos where id = 'ibge_municipios';
  update public.oportunidade_sync_execucoes set terminado_em = now(), status = 'ok', buscados = n, criados = c_novos,
    atualizados = n - c_novos where id = v_exec;
  return jsonb_build_object('status', 'ok', 'itens', n, 'criados', c_novos);
end $$;
revoke all on function public.municipios_aplicar_lote(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.municipios_aplicar_lote(jsonb, text, text) to service_role;

-- ------------------------------------------------ oportunidades: escopo
alter table public.oportunidades add column if not exists municipio_ibge text check (municipio_ibge ~ '^[0-9]{7}$');
create index if not exists oportunidades_local on public.oportunidades(abrangencia, uf, municipio_ibge) where ativo;
alter table public.oportunidades drop constraint if exists oportunidades_natureza_check;
alter table public.oportunidades add constraint oportunidades_natureza_check
  check (natureza in ('comemorativa', 'feriado', 'facultativo', 'campanha'));

-- --------------------------------------------------------------- fontes
insert into public.oportunidade_fontes (id, nome, autoridade, metodo, url, descricao, frequencia_dias) values
  ('ibge_municipios', 'IBGE — municípios (API de Localidades)', 'oficial', 'automatica',
     'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado',
     'Lista oficial dos municípios com código IBGE, usada para a cidade dos clientes. Não gera datas. API pública do IBGE, sem chave.', 30),
  ('feriados_br', 'Feriados estaduais e municipais — repositório feriados-brasil (MIT)', 'secundaria', 'automatica',
     'https://github.com/joaopbini/feriados-brasil',
     'Base comunitária (licença MIT) com feriados estaduais, municipais e pontos facultativos por código IBGE. Estaduais: todos; municipais: só das cidades dos clientes. Fonte secundária: tudo entra como "Pendente de verificação". Muitos feriados municipais vêm só como "Feriado Municipal", sem o motivo.', 7),
  ('datas_br', 'Datas populares — repositório feriados-brasil (MIT)', 'secundaria', 'automatica',
     'https://github.com/joaopbini/feriados-brasil/tree/master/dados/comemorativas',
     'Datas comemorativas populares e comerciais (Dia dos Namorados, Dia dos Pais, Dia das Crianças…). Entram como "Popular / comercial".', 30)
on conflict (id) do update set nome = excluded.nome, autoridade = excluded.autoridade, metodo = excluded.metodo,
  url = excluded.url, descricao = excluded.descricao, frequencia_dias = excluded.frequencia_dias;

-- --------------------------------- duplicata: só entre datas de escopo amplo
create or replace function public.op_candidato_duplicata(p_nome text, p_mes int, p_dia int, p_fonte text, p_palavras_pt jsonb, p_excluir uuid default null)
returns uuid language sql stable set search_path = public as $$
  select o.id from public.oportunidades o
   where o.ativo and o.id is distinct from p_excluir
     and o.abrangencia in ('internacional', 'nacional')
     and (   (o.tipo_data = 'fixa' and o.mes = p_mes and o.dia = p_dia)
          or exists (select 1 from public.oportunidade_datas d where d.oportunidade_id = o.id
                      and extract(month from d.data) = p_mes and extract(day from d.data) = p_dia))
     and not exists (select 1 from public.oportunidade_provas pv where pv.oportunidade_id = o.id and pv.fonte_id = p_fonte)
     and (   public.op_palavras(o.nome) && public.op_palavras(p_nome)
          or exists (select 1 from jsonb_array_elements_text(coalesce(p_palavras_pt, '[]')) p
                      where o.chave like '%' || public.op_normalizar(p) || '%'))
   order by o.criado_em limit 1
$$;
revoke all on function public.op_candidato_duplicata(text,int,int,text,jsonb,uuid) from public, anon;

-- ------------------------------------------------ aplicar_lote com escopo
CREATE OR REPLACE FUNCTION public.oportunidades_aplicar_lote(p_fonte text, p_itens jsonb, p_erro text DEFAULT NULL::text, p_disparo text DEFAULT 'cron'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  f public.oportunidade_fontes%rowtype;
  v_exec bigint; n int; it jsonb; v_op uuid; v_chave text; v_nome text; v_ref text; v_dup uuid;
  c_criados int := 0; c_atual int := 0; c_vinc int := 0; c_rev int := 0; d jsonb; v_pal text;
  v_refs text[] := '{}';
  v_local boolean; v_uf text; v_mun text; v_tipo text;
begin
  select * into f from public.oportunidade_fontes where id = p_fonte for update;
  if not found then raise exception 'Fonte desconhecida: %', p_fonte; end if;
  insert into public.oportunidade_sync_execucoes (fonte_id, status, disparo) values (p_fonte, 'executando', p_disparo) returning id into v_exec;

  if p_erro is not null then
    update public.oportunidade_fontes set ultima_tentativa = now(), status = 'falha', erro = left(p_erro, 500) where id = p_fonte;
    update public.oportunidade_sync_execucoes set terminado_em = now(), status = 'falha', erro = left(p_erro, 500) where id = v_exec;
    return jsonb_build_object('status', 'falha', 'erro', p_erro);
  end if;

  n := coalesce(jsonb_array_length(p_itens), 0);
  if n = 0 or (coalesce(f.itens_referencia, 0) >= 10 and n < f.itens_referencia * 0.5) then
    update public.oportunidade_fontes set ultima_tentativa = now(), status = 'suspeita', itens_ultimo = n,
      erro = format('Lote suspeito: %s itens (normal: %s). Nada foi alterado.', n, coalesce(f.itens_referencia::text, '?')) where id = p_fonte;
    update public.oportunidade_sync_execucoes set terminado_em = now(), status = 'suspeita', buscados = n,
      erro = 'lote vazio ou muito menor que o normal — dados locais preservados' where id = v_exec;
    return jsonb_build_object('status', 'suspeita', 'itens', n, 'referencia', f.itens_referencia);
  end if;

  for it in select * from jsonb_array_elements(p_itens) loop
    v_ref := it->>'referencia'; v_nome := btrim(it->>'nome');
    if v_ref is null or coalesce(v_nome, '') = '' or not public.op_item_valido(it) then continue; end if;
    /* data precisa ser válida: sem data, o item não entra */
    if (it->>'tipo_data') = 'fixa' and ((it->>'mes') is null or (it->>'dia') is null) then continue; end if;
    if (it->>'tipo_data') = 'regra' and coalesce(it->>'regra', '') = '' then continue; end if;
    if (it->>'tipo_data') = 'datas' and coalesce(jsonb_array_length(it->'datas'), 0) = 0 then continue; end if;
    /* escopo geográfico: estadual exige UF; municipal exige código IBGE */
    v_local := coalesce(it->>'abrangencia', 'nacional') in ('estadual', 'municipal');
    v_uf := nullif(upper(btrim(coalesce(it->>'uf', ''))), '');
    v_mun := nullif(btrim(coalesce(it->>'municipio_ibge', '')), '');
    if (it->>'abrangencia') = 'estadual' and (v_uf is null or v_uf !~ '^[A-Z]{2}$') then continue; end if;
    if (it->>'abrangencia') = 'municipal' and (v_mun is null or v_mun !~ '^[0-9]{7}$') then continue; end if;
    v_refs := v_refs || v_ref;
    /* a chave de uma data local carrega o lugar: mesmo nome em outra
       cidade/estado é OUTRA oportunidade */
    v_chave := public.op_normalizar(v_nome || case when (it->>'abrangencia') = 'municipal' then ' mun ' || v_mun
                                                   when (it->>'abrangencia') = 'estadual' then ' uf ' || v_uf else '' end);
    v_op := null; v_dup := null;

    /* 1) já visto nesta fonte (idempotência) */
    select oportunidade_id into v_op from public.oportunidade_provas where fonte_id = p_fonte and referencia = v_ref;
    if v_op is not null then
      c_atual := c_atual + 1;
    elsif v_local then
      /* 2') local: só a mesma chave (nome + lugar) */
      select id into v_op from public.oportunidades o where o.chave = v_chave limit 1;
      if v_op is not null then c_vinc := c_vinc + 1; end if;
    else
      /* 2) mesmo nome/alias canônico — entre datas de escopo amplo */
      select id into v_op from public.oportunidades o
       where o.abrangencia in ('internacional', 'nacional')
         and (o.chave = v_chave or v_chave = any (select public.op_normalizar(a) from unnest(o.aliases) a)
          or o.chave = any (select public.op_normalizar(a) from unnest(coalesce(array(select jsonb_array_elements_text(it->'aliases')), '{}')) a))
       limit 1;
      /* 3) mesma data fixa + palavra-chave em português informada pelo adaptador */
      if v_op is null and (it->>'tipo_data') = 'fixa' and jsonb_array_length(coalesce(it->'palavras_pt', '[]')) > 0 then
        select o.id into v_op from public.oportunidades o
         where o.tipo_data = 'fixa' and o.mes = (it->>'mes')::int and o.dia = (it->>'dia')::int and o.ativo
           and o.abrangencia in ('internacional', 'nacional')
           and exists (select 1 from jsonb_array_elements_text(it->'palavras_pt') p where o.chave like '%' || public.op_normalizar(p) || '%')
         order by o.criado_em limit 1;
      end if;
      if v_op is not null then c_vinc := c_vinc + 1; end if;
    end if;

    if v_op is null then
      /* 4) dúvida (só escopo amplo): mesma data + palavra em comum → revisão */
      if not v_local then
        if (it->>'tipo_data') = 'fixa' then
          v_dup := public.op_candidato_duplicata(v_nome, (it->>'mes')::int, (it->>'dia')::int, p_fonte, it->'palavras_pt');
        elsif (it->>'tipo_data') = 'datas' then
          v_dup := public.op_candidato_duplicata(v_nome, extract(month from (it->'datas'->0->>'data')::date)::int,
                     extract(day from (it->'datas'->0->>'data')::date)::int, p_fonte, it->'palavras_pt');
        end if;
      end if;
      /* chave única: se colidir, desambigua pela fonte (não funde) */
      if exists (select 1 from public.oportunidades where chave = v_chave) then v_chave := v_chave || ' ' || p_fonte; end if;
      insert into public.oportunidades (chave, nome, aliases, descricao, tipo_data, mes, dia, regra, duracao_dias, natureza, abrangencia,
        uf, municipio, municipio_ibge, categorias, tags, geral, confiabilidade, revisao, possivel_duplicata_de, verificado_em, sincronizado_em)
      values (v_chave, v_nome, coalesce(array(select jsonb_array_elements_text(it->'aliases')), '{}'), it->>'descricao',
        it->>'tipo_data', (it->>'mes')::int, (it->>'dia')::int, it->>'regra', coalesce((it->>'duracao')::int, 1),
        coalesce(it->>'natureza', 'comemorativa'), coalesce(it->>'abrangencia', 'nacional'),
        case when v_local then v_uf end, case when (it->>'abrangencia') = 'municipal' then nullif(btrim(it->>'municipio'), '') end,
        case when (it->>'abrangencia') = 'municipal' then v_mun end,
        coalesce(array(select jsonb_array_elements_text(it->'categorias')), '{}'),
        coalesce(array(select distinct public.op_normalizar(x) from jsonb_array_elements_text(coalesce(it->'tags', '[]')) x), '{}'),
        coalesce((it->>'geral')::boolean, false),
        /* fonte secundária nunca cria "Oficial" */
        case when f.autoridade = 'secundaria' and (it->>'confiabilidade') = 'oficial' then 'pendente' else coalesce(it->>'confiabilidade', 'pendente') end,
        case when v_dup is not null then 'revisar' else 'ok' end, v_dup, now(), now())
      returning id into v_op;
      c_criados := c_criados + 1;
      if v_dup is not null then c_rev := c_rev + 1; end if;
    end if;

    /* prova (proveniência) — idempotente */
    insert into public.oportunidade_provas (oportunidade_id, fonte_id, referencia, titulo_na_fonte, url, detalhe, visto_em, ativo)
      values (v_op, p_fonte, v_ref, coalesce(it->>'titulo_na_fonte', v_nome), it->>'url', it->>'detalhe', now(), true)
    on conflict (fonte_id, referencia) do update set titulo_na_fonte = excluded.titulo_na_fonte,
      url = coalesce(excluded.url, public.oportunidade_provas.url), detalhe = coalesce(excluded.detalhe, public.oportunidade_provas.detalhe),
      visto_em = now(), ativo = true;

    /* fonte oficial eleva a confiabilidade (nunca rebaixa); marca sincronização */
    update public.oportunidades set
      confiabilidade = case when f.autoridade = 'oficial' and (it->>'confiabilidade') = 'oficial' then 'oficial'
                            when confiabilidade = 'pendente' and (it->>'confiabilidade') = 'verificada' and f.autoridade <> 'secundaria' then 'verificada'
                            else confiabilidade end,
      categorias = (select array(select distinct x from unnest(categorias || coalesce(array(select jsonb_array_elements_text(it->'categorias')), '{}')) x)),
      sincronizado_em = now(), verificado_em = case when f.autoridade = 'oficial' then now() else verificado_em end, atualizado_em = now()
     where id = v_op
    returning tipo_data into v_tipo;

    /* datas por ano: só para oportunidade definida por datas (uma data
       fixa ou por regra já se resolve sozinha — não ganha datas soltas) */
    if v_tipo = 'datas' then
      for d in select * from jsonb_array_elements(coalesce(it->'datas', '[]')) loop
        insert into public.oportunidade_datas (oportunidade_id, data, data_fim, fonte_id)
          values (v_op, (d->>'data')::date, nullif(d->>'data_fim', '')::date, p_fonte)
        on conflict (oportunidade_id, data) do update set data_fim = excluded.data_fim;
      end loop;
    end if;
  end loop;

  /* o que a fonte deixou de trazer: prova inativa (revisão), nada apagado */
  update public.oportunidade_provas set ativo = false where fonte_id = p_fonte and ativo and referencia <> all (v_refs);

  update public.oportunidade_fontes set ultima_tentativa = now(), ultimo_sucesso = now(), status = 'ok', erro = null,
    itens_ultimo = n, itens_referencia = case when itens_referencia is null then n else round(itens_referencia * 0.5 + n * 0.5) end,
    criados_ultimo = c_criados, atualizados_ultimo = c_atual + c_vinc
   where id = p_fonte;
  update public.oportunidade_sync_execucoes set terminado_em = now(), status = 'ok', buscados = n, criados = c_criados,
    atualizados = c_atual, vinculados = c_vinc, para_revisao = c_rev where id = v_exec;
  return jsonb_build_object('status', 'ok', 'itens', n, 'criados', c_criados, 'atualizados', c_atual, 'vinculados', c_vinc, 'revisar', c_rev);
end $function$;
revoke all on function public.oportunidades_aplicar_lote(text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.oportunidades_aplicar_lote(text, jsonb, text, text) to service_role;

-- ----------------------------------------------- correção de natureza
/* A BrasilAPI marca Carnaval e Corpus Christi como "national", mas a lei
   federal de feriados (Lei 662/1949, Lei 6.802/1980, Lei 9.093/1995) não os
   inclui: no serviço público federal são ponto facultativo. Páscoa é
   domingo — data religiosa, não feriado. A sincronização não muda a
   natureza de uma oportunidade que já existe, então a correção fica. */
update public.oportunidades set natureza = 'facultativo', atualizado_em = now()
 where chave in ('carnaval', 'corpus christi') and natureza = 'feriado';
update public.oportunidades set natureza = 'comemorativa', categorias = (select array(select distinct x from unnest(categorias || array['religiao']) x)), atualizado_em = now()
 where chave = 'pascoa' and natureza = 'feriado';

-- ------------------------------------------------------ datas curadas
/* Cada uma com a fonte de referência. A chave casa com o nome que a
   sincronização usaria, então uma fonte futura soma prova em vez de duplicar. */
do $$
declare v uuid;
  r record;
begin
  for r in select * from (values
    ('Dia Nacional dos Desbravadores', 'fixa', 9, 20, null::text, 'comemorativa', array['religiao','infancia'], array['desbravadores','adventista','jovens'], false, 'oficial',
       'Homenagem aos clubes de Desbravadores, jovens da Igreja Adventista do Sétimo Dia que fazem serviço comunitário.', 'planalto',
       'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/L14665.htm', 'Lei nº 14.665, de 4 de setembro de 2023'),
    ('Dia Mundial dos Desbravadores', 'regra', 9, null::int, 'nth:9:6:3', 'comemorativa', array['religiao','infancia'], array['desbravadores','adventista','jovens'], false, 'verificada',
       'Celebrado pela Igreja Adventista do Sétimo Dia no terceiro sábado de setembro.', 'manual',
       'https://www.adventistas.org/pt/desbravadores/projeto/dia-mundial-dos-desbravadores/', 'Igreja Adventista do Sétimo Dia — Desbravadores: "acontece anualmente no terceiro sábado de setembro"'),
    ('Dia Nacional do Evangélico', 'fixa', 11, 30, null, 'comemorativa', array['religiao'], array['evangelico','evangelicos'], false, 'oficial',
       'Data comemorativa nacional (não é feriado nacional; alguns estados e municípios têm feriado próprio).', 'planalto',
       'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12328.htm', 'Lei nº 12.328, de 15 de setembro de 2010'),
    ('Dia do Farmacêutico', 'fixa', 1, 20, null, 'comemorativa', array['farmacia'], array['farmaceutico','farmacia'], false, 'oficial',
       'Dia Nacional do Farmacêutico.', 'planalto',
       'https://planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12338.htm', 'Lei nº 12.338, de 25 de novembro de 2010'),
    ('Dia do Contador', 'fixa', 9, 22, null, 'comemorativa', array['financas'], array['contador','contabilidade','contabil'], false, 'verificada',
       'Data da criação oficial dos cursos superiores de Ciências Contábeis (Decreto-Lei nº 7.988, de 22/09/1945), celebrada pelo Conselho Federal de Contabilidade.', 'conselho',
       'https://cfc.org.br/destaque/parabens-aos-contadores-e-palmas-a-ciencia-contabil/', 'Conselho Federal de Contabilidade'),
    ('Dia do Consumidor', 'fixa', 3, 15, null, 'comemorativa', array['comercio'], array['consumidor','varejo','promocao'], false, 'popular',
       'Dia Mundial dos Direitos do Consumidor; no varejo virou data de promoções.', 'manual',
       null, 'Data de mercado (Dia Mundial dos Direitos do Consumidor) — sem ato oficial federal'),
    ('Dia do Cliente', 'fixa', 9, 15, null, 'comemorativa', array['comercio'], array['cliente','varejo','promocao'], false, 'popular',
       'Data comercial usada pelo varejo e por serviços para ações de relacionamento.', 'manual',
       null, 'Data de mercado — sem ato oficial federal')
  ) as t(nome, tipo, mes, dia, regra, natureza, cats, tags, geral, conf, descr, fonte, url, detalhe) loop
    select id into v from public.oportunidades where chave = public.op_normalizar(r.nome)
       or public.op_normalizar(r.nome) = any (select public.op_normalizar(a) from unnest(aliases) a) limit 1;
    if v is null then
      insert into public.oportunidades (chave, nome, descricao, tipo_data, mes, dia, regra, natureza, abrangencia, categorias, tags, geral, confiabilidade, verificado_em)
      values (public.op_normalizar(r.nome), r.nome, r.descr, r.tipo, r.mes, r.dia, r.regra, r.natureza,
              case when r.nome like 'Dia Mundial%' then 'internacional' else 'nacional' end, r.cats, r.tags, r.geral, r.conf, now())
      returning id into v;
    end if;
    insert into public.oportunidade_provas (oportunidade_id, fonte_id, referencia, titulo_na_fonte, url, detalhe)
      values (v, r.fonte, 'manual:' || public.op_normalizar(r.nome), r.nome, r.url, r.detalhe)
    on conflict (fonte_id, referencia) do update set url = excluded.url, detalhe = excluded.detalhe, visto_em = now(), ativo = true;
  end loop;

  /* Black Friday: sexta-feira seguinte ao Dia de Ação de Graças dos EUA
     (4ª quinta-feira de novembro). Não é sempre a última sexta de novembro,
     então entra por datas, ano a ano. */
  select id into v from public.oportunidades where chave = 'black friday';
  if v is null then
    insert into public.oportunidades (chave, nome, descricao, tipo_data, natureza, abrangencia, categorias, tags, geral, confiabilidade, verificado_em)
    values ('black friday', 'Black Friday', 'Sexta-feira seguinte ao Dia de Ação de Graças dos EUA (4ª quinta-feira de novembro). Maior data de promoções do varejo.',
            'datas', 'comemorativa', 'internacional', array['comercio'], array['black friday','varejo','promocao'], false, 'popular', now())
    returning id into v;
  end if;
  insert into public.oportunidade_datas (oportunidade_id, data, fonte_id) values (v, '2026-11-27', 'manual'), (v, '2027-11-26', 'manual')
  on conflict do nothing;
  insert into public.oportunidade_provas (oportunidade_id, fonte_id, referencia, titulo_na_fonte, url, detalhe)
    values (v, 'manual', 'manual:black friday', 'Black Friday', null, 'Data de mercado — calculada pela regra da 4ª quinta-feira de novembro + 1 dia')
  on conflict (fonte_id, referencia) do nothing;
end $$;

-- ------------------------------------- sugestões a partir do cadastro do cliente
/* Só o que o próprio cadastro (Inteligência do cliente) diz com clareza.
   Entram como "sugerido": a equipe confirma ou corrige na tela do cliente. */
insert into public.cliente_municipios (client_id, municipio_ibge, origem)
select c.id, x.ibge, 'sugerido' from (values
  ('Mais Sorrisos', '2933307'), ('C6 Farma', '2933307'), ('Branding7', '2933307'),
  ('Atacadão dos Suplementos', '2933307'), ('Atacadão dos Suplementos', '2918001'),
  ('Infinite Fio', '2933307'), ('Infinite Fio', '2704302'), ('Águas Mucugê', '2921906')
) as x(nome, ibge)
join public.clientes c on c.nome = x.nome and c.deleted_at is null
on conflict (client_id, municipio_ibge) do nothing;

insert into public.cliente_segmentos (client_id, tema_id, origem)
select c.id, x.tema, 'sugerido' from (values
  ('BLW', 'financas'), ('Mercato Sadia', 'comercio'), ('Sabor da Feira', 'gastronomia'),
  ('Dr. Fabrício Laughton', 'medicina'), ('Águas Mucugê', 'imobiliario'), ('Chácaras Nova Andradina', 'imobiliario')
) as x(nome, tema)
join public.clientes c on c.nome = x.nome and c.deleted_at is null
where not exists (select 1 from public.cliente_segmentos s where s.client_id = c.id)
on conflict (client_id, tema_id) do nothing;
