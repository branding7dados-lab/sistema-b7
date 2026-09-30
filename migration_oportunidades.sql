-- =====================================================================
-- FASE 7 — OPORTUNIDADES (datas comemorativas com fonte verificada)
--
-- Oportunidade = data externa que PODE inspirar conteúdo. Não é tarefa,
-- post, roteiro, design, vídeo nem gravação. Nada aqui cria conteúdo.
--
--   temas                      vocabulário único: segmento de cliente e
--                              categoria de oportunidade (com "pai")
--   cliente_segmentos          cliente ↔ tema (vários por cliente)
--   oportunidades              definição canônica (1 por evento real)
--   oportunidade_datas         datas por ano (feriados móveis, ano único)
--   oportunidade_fontes        registro de fontes + saúde da sincronização
--   oportunidade_provas        proveniência: 1 oportunidade ← N fontes
--   oportunidade_sync_execucoes histórico de sincronizações
--   oportunidade_cliente_ajustes relevante / não relevante / ignorar (por cliente)
--   oportunidade_linhas        vínculo com Linha Editorial (sem gerar conteúdo)
--   conteudos.oportunidade_id  vínculo opcional de um criativo
--
-- Relevância automática NÃO é gravada: é recalculada (determinística)
-- a partir de temas/segmentos/tags. Só decisões manuais são gravadas.
-- =====================================================================

-- ---------------------------------------------------------------- temas
create table if not exists public.temas (
  id text primary key check (id ~ '^[a-z_]+$'),
  nome text not null,
  pai text references public.temas(id),
  ordem int not null default 100
);
insert into public.temas (id, nome, pai, ordem) values
  ('saude', 'Saúde', null, 10),
  ('odontologia', 'Odontologia', 'saude', 11),
  ('medicina', 'Medicina', 'saude', 12),
  ('farmacia', 'Farmácia', 'saude', 13),
  ('otica', 'Ótica e saúde visual', 'saude', 14),
  ('nutricao', 'Nutrição e suplementos', 'saude', 15),
  ('beleza', 'Beleza', null, 20),
  ('estetica', 'Estética', 'beleza', 21),
  ('educacao', 'Educação', null, 30),
  ('transito', 'Trânsito e autoescola', null, 40),
  ('gastronomia', 'Gastronomia', null, 50),
  ('comercio', 'Comércio e varejo', null, 60),
  ('familia', 'Família', null, 70),
  ('meio_ambiente', 'Meio ambiente', null, 80),
  ('cultura', 'Cultura', null, 90),
  ('tecnologia', 'Tecnologia', null, 100),
  ('esporte', 'Esporte', null, 110),
  ('direito', 'Direito', null, 120),
  ('imobiliario', 'Imobiliário', null, 130),
  ('agro', 'Agro', null, 140),
  ('marketing', 'Marketing e comunicação', null, 150)
on conflict (id) do update set nome = excluded.nome, pai = excluded.pai, ordem = excluded.ordem;

-- ------------------------------------------------- segmentos de cliente
create table if not exists public.cliente_segmentos (
  client_id uuid not null references public.clientes(id) on delete cascade,
  tema_id text not null references public.temas(id),
  origem text not null default 'manual' check (origem in ('manual', 'sugerido')),
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now(),
  primary key (client_id, tema_id)
);
create index if not exists cliente_segmentos_tema on public.cliente_segmentos(tema_id);

-- ------------------------------------------------------ oportunidades
create table if not exists public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,                          -- nome normalizado (dedup)
  nome text not null check (length(btrim(nome)) > 2),
  aliases text[] not null default '{}',
  descricao text,
  tipo_data text not null check (tipo_data in ('fixa', 'regra', 'datas')),
  mes int check (mes between 1 and 12),
  dia int check (dia between 1 and 31),
  regra text,                                          -- ex.: 'nth:5:0:2' (2º domingo de maio)
  duracao_dias int not null default 1 check (duracao_dias between 1 and 31),
  natureza text not null default 'comemorativa' check (natureza in ('comemorativa', 'feriado', 'campanha')),
  abrangencia text not null default 'nacional' check (abrangencia in ('internacional', 'nacional', 'estadual', 'municipal')),
  uf text, municipio text,
  categorias text[] not null default '{}',             -- ids de temas
  tags text[] not null default '{}',                   -- normalizadas (minúsculas, sem acento)
  geral boolean not null default false,                -- de interesse geral (ex.: Dia das Mães)
  confiabilidade text not null default 'pendente' check (confiabilidade in ('oficial', 'verificada', 'popular', 'pendente')),
  revisao text not null default 'ok' check (revisao in ('ok', 'revisar', 'ignorada')),
  possivel_duplicata_de uuid references public.oportunidades(id),
  ativo boolean not null default true,
  verificado_em timestamptz,
  sincronizado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((tipo_data = 'fixa' and mes is not null and dia is not null)
      or (tipo_data = 'regra' and regra is not null)
      or (tipo_data = 'datas'))
);
create index if not exists oportunidades_mes_dia on public.oportunidades(mes, dia) where ativo;
create index if not exists oportunidades_categorias on public.oportunidades using gin (categorias);
create index if not exists oportunidades_tags on public.oportunidades using gin (tags);

create table if not exists public.oportunidade_datas (
  oportunidade_id uuid not null references public.oportunidades(id) on delete cascade,
  data date not null,
  data_fim date,
  fonte_id text,
  primary key (oportunidade_id, data)
);
create index if not exists oportunidade_datas_data on public.oportunidade_datas(data);

-- ---------------------------------------------------- fontes / saúde
create table if not exists public.oportunidade_fontes (
  id text primary key,
  nome text not null,
  autoridade text not null check (autoridade in ('oficial', 'operacional', 'secundaria')),
  metodo text not null check (metodo in ('automatica', 'assistida', 'verificacao', 'nao_integrada')),
  url text,
  descricao text,
  frequencia_dias int not null default 7,
  ativo boolean not null default true,
  ultima_tentativa timestamptz,
  ultimo_sucesso timestamptz,
  status text not null default 'nunca' check (status in ('nunca', 'ok', 'falha', 'suspeita')),
  itens_ultimo int, itens_referencia int,
  criados_ultimo int, atualizados_ultimo int,
  erro text
);
insert into public.oportunidade_fontes (id, nome, autoridade, metodo, url, descricao, frequencia_dias) values
  ('ms_calendario', 'Ministério da Saúde — Calendário da Saúde', 'oficial', 'automatica',
     'https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/c/calendario/saude',
     'Página oficial (HTML) com as datas de saúde do ano. Licença CC BY-ND 3.0 — usada com atribuição e link.', 7),
  ('oms', 'Organização Mundial da Saúde — campanhas oficiais', 'oficial', 'automatica',
     'https://www.who.int/campaigns',
     'Lista oficial de dias/semanas mundiais da OMS (sem feed). Usada para confirmar/proveniência das datas de saúde global.', 7),
  ('onu', 'Nações Unidas — Dias e semanas internacionais', 'oficial', 'automatica',
     'https://www.un.org/en/observances/list-days-weeks',
     'Lista oficial (HTML, em inglês) das observâncias da ONU.', 7),
  ('brasilapi', 'BrasilAPI — Feriados nacionais', 'operacional', 'automatica',
     'https://brasilapi.com.br/api/feriados/v1/',
     'API pública para feriados nacionais (uso operacional; não é a autoridade legal).', 7),
  ('camara', 'Câmara dos Deputados — Datas comemorativas e outras datas significativas (2ª ed., 2025)', 'oficial', 'assistida',
     'https://bd.camara.leg.br/bd/items/dc788403-140e-4a14-8277-2b161daaa34b',
     'Compilação oficial das datas instituídas por lei (até 31/08/2025). PDF de 21 MB, sem API: entra por cadastro assistido.', 365),
  ('planalto', 'Planalto — legislação federal', 'oficial', 'verificacao',
     'https://www.planalto.gov.br/ccivil_03/',
     'Usado para verificar a base legal (lei/decreto) de uma data.', 365),
  ('conselho', 'Conselhos profissionais (CFO, CFM…)', 'oficial', 'verificacao',
     null, 'Páginas oficiais de conselhos federais dos segmentos dos clientes.', 365),
  ('calendarr', 'Calendarr (agregador)', 'secundaria', 'nao_integrada',
     'https://www.calendarr.com/brasil/',
     'Agregador secundário: sem termos de uso que autorizem acesso automatizado — não é lido automaticamente.', 365),
  ('manual', 'Cadastro manual verificado', 'oficial', 'assistida', null,
     'Cadastro feito por administrador, sempre com fonte/link.', 365)
on conflict (id) do update set nome = excluded.nome, autoridade = excluded.autoridade, metodo = excluded.metodo,
  url = excluded.url, descricao = excluded.descricao, frequencia_dias = excluded.frequencia_dias;

create table if not exists public.oportunidade_provas (
  id uuid primary key default gen_random_uuid(),
  oportunidade_id uuid not null references public.oportunidades(id) on delete cascade,
  fonte_id text not null references public.oportunidade_fontes(id),
  referencia text not null,                            -- chave estável na fonte (idempotência)
  titulo_na_fonte text,
  url text,
  detalhe text,                                        -- ex.: 'Decreto nº 52.682/1963, art. 1º'
  visto_em timestamptz not null default now(),
  ativo boolean not null default true,                 -- a fonte ainda traz o item?
  unique (fonte_id, referencia)
);
create index if not exists oportunidade_provas_op on public.oportunidade_provas(oportunidade_id);

create table if not exists public.oportunidade_sync_execucoes (
  id bigserial primary key,
  fonte_id text not null references public.oportunidade_fontes(id),
  iniciado_em timestamptz not null default now(),
  terminado_em timestamptz,
  status text not null,
  buscados int, criados int, atualizados int, vinculados int, para_revisao int,
  erro text,
  disparo text
);

-- ------------------------------------------ decisões por cliente / vínculos
create table if not exists public.oportunidade_cliente_ajustes (
  oportunidade_id uuid not null references public.oportunidades(id) on delete cascade,
  client_id uuid not null references public.clientes(id) on delete cascade,
  decisao text not null check (decisao in ('relevante', 'nao_relevante', 'ignorar')),
  por uuid references auth.users(id),
  em timestamptz not null default now(),
  primary key (oportunidade_id, client_id)
);
create index if not exists oportunidade_ajustes_cliente on public.oportunidade_cliente_ajustes(client_id);

create table if not exists public.oportunidade_linhas (
  oportunidade_id uuid not null references public.oportunidades(id) on delete cascade,
  linha_id uuid not null references public.linhas_editoriais(id) on delete cascade,
  data_ocorrencia date,
  observacao text,
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now(),
  primary key (oportunidade_id, linha_id)
);
create index if not exists oportunidade_linhas_linha on public.oportunidade_linhas(linha_id);

alter table public.conteudos add column if not exists oportunidade_id uuid references public.oportunidades(id) on delete set null;

-- -------------------------------------------------------------- RLS
alter table public.temas enable row level security;
alter table public.cliente_segmentos enable row level security;
alter table public.oportunidades enable row level security;
alter table public.oportunidade_datas enable row level security;
alter table public.oportunidade_fontes enable row level security;
alter table public.oportunidade_provas enable row level security;
alter table public.oportunidade_sync_execucoes enable row level security;
alter table public.oportunidade_cliente_ajustes enable row level security;
alter table public.oportunidade_linhas enable row level security;

do $$
declare t text;
begin
  /* leitura: equipe interna (nunca anon, nunca cliente do Portal) */
  foreach t in array array['temas','cliente_segmentos','oportunidades','oportunidade_datas','oportunidade_provas',
                           'oportunidade_cliente_ajustes','oportunidade_linhas'] loop
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.sou_equipe_interna())', t || '_leitura', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
  /* fontes e execuções: saúde técnica — só admin/coordenação */
  foreach t in array array['oportunidade_fontes','oportunidade_sync_execucoes'] loop
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.sou_equipe())', t || '_leitura', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
/* nenhuma escrita direta: tudo pelas funções abaixo (e pela sincronização, com service role) */

-- --------------------------------------------------------- utilidades
create or replace function public.op_normalizar(t text) returns text
language sql immutable set search_path = public as $$
  select btrim(regexp_replace(lower(translate(coalesce(t, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^a-z0-9]+', ' ', 'g'))
$$;

-- --------------------------------------------------------------- RPCs
/* segmentos do cliente: admin/coordenação */
create or replace function public.cliente_segmentos_definir(p_client_id uuid, p_temas text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then raise exception 'Só admin/coordenação definem segmentos de cliente.' using errcode = '42501'; end if;
  if exists (select 1 from unnest(coalesce(p_temas, '{}')) x where x not in (select id from public.temas)) then
    raise exception 'Segmento desconhecido.';
  end if;
  delete from public.cliente_segmentos where client_id = p_client_id and tema_id <> all (coalesce(p_temas, '{}'));
  insert into public.cliente_segmentos (client_id, tema_id, origem, criado_por)
    select p_client_id, x, 'manual', auth.uid() from unnest(coalesce(p_temas, '{}')) x
  on conflict (client_id, tema_id) do update set origem = 'manual';
end $$;

/* relevante / não relevante / ignorar (ou limpar com null) para um cliente */
create or replace function public.oportunidade_ajustar_cliente(p_oportunidade_id uuid, p_client_id uuid, p_decisao text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then raise exception 'Só admin/coordenação ajustam a relevância.' using errcode = '42501'; end if;
  if p_decisao is null then
    delete from public.oportunidade_cliente_ajustes where oportunidade_id = p_oportunidade_id and client_id = p_client_id;
    return;
  end if;
  if p_decisao not in ('relevante', 'nao_relevante', 'ignorar') then raise exception 'Decisão inválida.'; end if;
  insert into public.oportunidade_cliente_ajustes (oportunidade_id, client_id, decisao, por)
    values (p_oportunidade_id, p_client_id, p_decisao, auth.uid())
  on conflict (oportunidade_id, client_id) do update set decisao = excluded.decisao, por = excluded.por, em = now();
end $$;

/* "Usar na Linha Editorial": SÓ o vínculo. Nenhum conteúdo, roteiro,
   design, vídeo ou gravação é criado. */
create or replace function public.oportunidade_vincular_linha(p_oportunidade_id uuid, p_linha_id uuid, p_data date default null, p_observacao text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then raise exception 'Só admin/coordenação vinculam oportunidades a linhas.' using errcode = '42501'; end if;
  if not exists (select 1 from public.oportunidades where id = p_oportunidade_id and ativo) then raise exception 'Oportunidade não encontrada.'; end if;
  if not exists (select 1 from public.linhas_editoriais where id = p_linha_id and deleted_at is null) then raise exception 'Linha editorial não encontrada.'; end if;
  insert into public.oportunidade_linhas (oportunidade_id, linha_id, data_ocorrencia, observacao, criado_por)
    values (p_oportunidade_id, p_linha_id, p_data, nullif(btrim(coalesce(p_observacao, '')), ''), auth.uid())
  on conflict (oportunidade_id, linha_id) do update set data_ocorrencia = coalesce(excluded.data_ocorrencia, public.oportunidade_linhas.data_ocorrencia),
    observacao = coalesce(excluded.observacao, public.oportunidade_linhas.observacao);
end $$;
create or replace function public.oportunidade_desvincular_linha(p_oportunidade_id uuid, p_linha_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  delete from public.oportunidade_linhas where oportunidade_id = p_oportunidade_id and linha_id = p_linha_id;
end $$;

/* vínculo opcional de um criativo (conteúdo) a uma oportunidade */
create or replace function public.conteudo_definir_oportunidade(p_conteudo_id uuid, p_oportunidade_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  update public.conteudos set oportunidade_id = p_oportunidade_id where id = p_conteudo_id and deleted_at is null;
end $$;

/* admin: cadastro manual verificado (sempre com fonte) */
create or replace function public.oportunidade_cadastrar_manual(
  p_nome text, p_tipo_data text, p_mes int, p_dia int, p_regra text, p_duracao int,
  p_natureza text, p_abrangencia text, p_categorias text[], p_tags text[], p_geral boolean,
  p_confiabilidade text, p_descricao text, p_fonte_id text, p_fonte_url text, p_fonte_detalhe text, p_aliases text[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_chave text;
begin
  if not public.sou_admin() then raise exception 'Só administradores cadastram oportunidades manualmente.' using errcode = '42501'; end if;
  if coalesce(btrim(p_fonte_url), '') = '' and coalesce(btrim(p_fonte_detalhe), '') = '' then
    raise exception 'Informe a fonte (link ou referência) — oportunidade sem fonte não entra.';
  end if;
  if p_fonte_id not in ('camara', 'planalto', 'conselho', 'manual', 'ms_calendario', 'oms', 'onu') then raise exception 'Fonte inválida.'; end if;
  if p_confiabilidade = 'oficial' and p_fonte_id = 'calendarr' then raise exception 'Fonte secundária não sustenta "Oficial".'; end if;
  if exists (select 1 from unnest(coalesce(p_categorias, '{}')) x where x not in (select id from public.temas)) then raise exception 'Categoria desconhecida.'; end if;
  v_chave := public.op_normalizar(p_nome);
  select id into v_id from public.oportunidades where chave = v_chave or v_chave = any (select public.op_normalizar(a) from unnest(aliases) a) limit 1;
  if v_id is null then
    insert into public.oportunidades (chave, nome, aliases, descricao, tipo_data, mes, dia, regra, duracao_dias, natureza, abrangencia,
      categorias, tags, geral, confiabilidade, verificado_em)
    values (v_chave, btrim(p_nome), coalesce(p_aliases, '{}'), nullif(btrim(coalesce(p_descricao, '')), ''), p_tipo_data, p_mes, p_dia, p_regra,
      coalesce(p_duracao, 1), coalesce(p_natureza, 'comemorativa'), coalesce(p_abrangencia, 'nacional'),
      coalesce(p_categorias, '{}'), (select coalesce(array_agg(distinct public.op_normalizar(t)), '{}') from unnest(coalesce(p_tags, '{}')) t),
      coalesce(p_geral, false), coalesce(p_confiabilidade, 'verificada'), now())
    returning id into v_id;
  end if;
  insert into public.oportunidade_provas (oportunidade_id, fonte_id, referencia, titulo_na_fonte, url, detalhe)
    values (v_id, p_fonte_id, 'manual:' || v_chave || ':' || coalesce(p_fonte_detalhe, p_fonte_url), btrim(p_nome), nullif(btrim(coalesce(p_fonte_url, '')), ''), nullif(btrim(coalesce(p_fonte_detalhe, '')), ''))
  on conflict (fonte_id, referencia) do update set url = excluded.url, detalhe = excluded.detalhe, visto_em = now(), ativo = true;
  return v_id;
end $$;

/* admin: desativar/reativar globalmente, resolver revisão */
create or replace function public.oportunidade_definir_estado(p_id uuid, p_ativo boolean, p_revisao text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_admin() then raise exception 'Só administradores alteram o estado global.' using errcode = '42501'; end if;
  update public.oportunidades set ativo = coalesce(p_ativo, ativo), revisao = coalesce(p_revisao, revisao),
    possivel_duplicata_de = case when p_revisao = 'ok' then null else possivel_duplicata_de end, atualizado_em = now()
   where id = p_id;
end $$;

/* admin: juntar uma oportunidade (duplicata) em outra — move provas,
   ajustes e vínculos; a duplicata fica inativa (nunca apagada) */
create or replace function public.oportunidade_unir(p_manter uuid, p_duplicata uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.oportunidades%rowtype;
begin
  if not public.sou_admin() then raise exception 'Só administradores unem oportunidades.' using errcode = '42501'; end if;
  if p_manter = p_duplicata then return; end if;
  select * into d from public.oportunidades where id = p_duplicata;
  update public.oportunidade_provas set oportunidade_id = p_manter where oportunidade_id = p_duplicata;
  insert into public.oportunidade_cliente_ajustes select p_manter, client_id, decisao, por, em from public.oportunidade_cliente_ajustes where oportunidade_id = p_duplicata on conflict do nothing;
  insert into public.oportunidade_linhas select p_manter, linha_id, data_ocorrencia, observacao, criado_por, criado_em from public.oportunidade_linhas where oportunidade_id = p_duplicata on conflict do nothing;
  update public.conteudos set oportunidade_id = p_manter where oportunidade_id = p_duplicata;
  update public.oportunidades set aliases = (select array(select distinct x from unnest(aliases || array[d.nome] || d.aliases) x)),
    categorias = (select array(select distinct x from unnest(categorias || d.categorias) x)),
    tags = (select array(select distinct x from unnest(tags || d.tags) x)), atualizado_em = now() where id = p_manter;
  update public.oportunidades set ativo = false, revisao = 'ignorada', possivel_duplicata_de = p_manter, atualizado_em = now() where id = p_duplicata;
end $$;

revoke execute on function public.cliente_segmentos_definir(uuid, text[]) from public, anon;
revoke execute on function public.oportunidade_ajustar_cliente(uuid, uuid, text) from public, anon;
revoke execute on function public.oportunidade_vincular_linha(uuid, uuid, date, text) from public, anon;
revoke execute on function public.oportunidade_desvincular_linha(uuid, uuid) from public, anon;
revoke execute on function public.conteudo_definir_oportunidade(uuid, uuid) from public, anon;
revoke execute on function public.oportunidade_cadastrar_manual(text, text, int, int, text, int, text, text, text[], text[], boolean, text, text, text, text, text, text[]) from public, anon;
revoke execute on function public.oportunidade_definir_estado(uuid, boolean, text) from public, anon;
revoke execute on function public.oportunidade_unir(uuid, uuid) from public, anon;
