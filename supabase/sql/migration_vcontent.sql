-- =====================================================================
--  MIGRATION vCONTENT — Roteiros B7 → Central de Conteúdo B7
--
--  Acrescenta as entidades de planejamento editorial. Não recria nem
--  apaga nada do que já existe: só cria tabelas novas e colunas novas.
--  Idempotente — pode rodar mais de uma vez.
--
--  Como rodar: Supabase → SQL Editor → New query → colar tudo → Run.
--  Ordem: supabase_setup.sql (ou migration_vnext.sql) primeiro, este depois.
--
--  MODELO
--    clientes
--      ├── cliente_inteligencia   (1:1  — contexto permanente da marca)
--      ├── produtos               (1:N)
--      ├── provas                 (1:N  — cases e depoimentos)
--      ├── onboardings            (1:N  — contexto do mês)
--      ├── ideias                 (1:N  — banco de ideias)
--      └── linhas_editoriais      (1:N  — planejamento do mês)
--            ├── pilares          (1:N)
--            └── conteudos        (1:N)
--                  ├── slides     (1:N  — carrossel)
--                  ├── frames     (1:N  — stories)
--                  └── script_id  (→ roteiros.id, para vídeo/reel)
--
--  Tudo que é estratégico é OPCIONAL. Nenhuma tabela exige preenchimento
--  além do vínculo com o cliente.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. INTELIGÊNCIA DO CLIENTE (1 registro por cliente, tudo opcional)
-- ---------------------------------------------------------------------
create table if not exists public.cliente_inteligencia (
  client_id    uuid primary key references public.clientes(id) on delete cascade,

  -- gerais
  nicho        text not null default '',
  site         text not null default '',
  instagram    text not null default '',
  descricao    text not null default '',
  observacoes  text not null default '',

  -- ICP
  icp_perfil       text not null default '',
  icp_segmento     text not null default '',
  icp_porte        text not null default '',
  icp_localizacao  text not null default '',
  icp_faturamento  text not null default '',
  icp_decisor      text not null default '',
  icp_necessidades text not null default '',
  icp_dores        text not null default '',
  icp_caracteristicas text not null default '',

  -- público / persona
  publico_principal text not null default '',
  publico_faixa     text not null default '',
  publico_regiao    text not null default '',
  publico_interesses text not null default '',
  publico_dores     text not null default '',
  publico_desejos   text not null default '',
  publico_objecoes  text not null default '',
  publico_comportamentos text not null default '',
  publico_observacoes text not null default '',

  -- brand voice
  voz_tom          text not null default '',
  voz_caracteristicas text not null default '',
  voz_usar         text not null default '',
  voz_evitar       text not null default '',
  voz_proibidas    text not null default '',
  voz_cta          text not null default '',
  voz_observacoes  text not null default '',

  -- posicionamento permanente (usado como base pela linha editorial)
  posicionamento   text not null default '',
  puv              text not null default '',
  percepcao        text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. PRODUTOS / SERVIÇOS  e  PROVAS / CASES
-- ---------------------------------------------------------------------
create table if not exists public.produtos (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clientes(id) on delete cascade,
  position    integer not null default 0,
  nome        text not null default '',
  descricao   text not null default '',
  beneficios  text not null default '',
  diferenciais text not null default '',
  publico     text not null default '',
  objecoes    text not null default '',
  cta         text not null default '',
  preco       text not null default '',
  observacoes text not null default '',
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists produtos_cliente_idx on public.produtos (client_id, position);

create table if not exists public.provas (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clientes(id) on delete cascade,
  position    integer not null default 0,
  tipo        text not null default 'Case',
  titulo      text not null default '',
  descricao   text not null default '',
  numero      text not null default '',
  observacoes text not null default '',
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists provas_cliente_idx on public.provas (client_id, position);

-- ---------------------------------------------------------------------
-- 3. ONBOARDING MENSAL (contexto do mês, separado da inteligência)
-- ---------------------------------------------------------------------
create table if not exists public.onboardings (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clientes(id) on delete cascade,
  mes         integer not null,
  ano         integer not null,
  objetivo    text not null default '',
  campanhas   text not null default '',
  prioritarios text not null default '',
  ofertas     text not null default '',
  datas       text not null default '',
  novidades   text not null default '',
  obrigatorios text not null default '',
  evitar      text not null default '',
  pedidos     text not null default '',
  quantidade  integer,
  observacoes text not null default '',
  archived_at timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint onboardings_mes_valido check (mes between 1 and 12)
);
create index if not exists onboardings_cliente_idx on public.onboardings (client_id, ano desc, mes desc);

-- ---------------------------------------------------------------------
-- 4. LINHA EDITORIAL
-- ---------------------------------------------------------------------
create table if not exists public.linhas_editoriais (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clientes(id) on delete cascade,
  onboarding_id uuid references public.onboardings(id) on delete set null,
  nome          text not null default '',       -- ex: "Setembro 2026"
  mes           integer not null,
  ano           integer not null,
  periodo_inicio date,
  periodo_fim    date,
  meta_conteudos integer,
  canais         text not null default '',      -- lista separada por vírgula
  objetivo       text not null default '',
  objetivo_detalhe text not null default '',
  posicionamento text not null default '',
  tom_voz        text not null default '',
  puv            text not null default '',
  percepcao      text not null default '',
  status         text not null default 'Em criação',
  is_pinned      boolean not null default false,
  archived_at    timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint linhas_mes_valido check (mes between 1 and 12),
  constraint linhas_status_valido
    check (status in ('Em criação','Em revisão','Aprovada','Finalizada'))
);
-- para bancos que já tinham a tabela sem estas colunas
alter table public.linhas_editoriais add column if not exists nome text not null default '';
alter table public.linhas_editoriais add column if not exists onboarding_id uuid references public.onboardings(id) on delete set null;

create index if not exists linhas_cliente_idx on public.linhas_editoriais (client_id, ano desc, mes desc);
create index if not exists linhas_lixeira_idx on public.linhas_editoriais (deleted_at);

-- ---------------------------------------------------------------------
-- 5. PILARES
-- ---------------------------------------------------------------------
create table if not exists public.pilares (
  id          uuid primary key default gen_random_uuid(),
  linha_id    uuid not null references public.linhas_editoriais(id) on delete cascade,
  position    integer not null default 0,
  nome        text not null default '',
  percentual  numeric(5,2) not null default 0,
  funil       text not null default 'Topo',
  objetivo    text not null default '',
  observacoes text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint pilares_funil_valido check (funil in ('Topo','Meio','Fundo'))
);
create index if not exists pilares_linha_idx on public.pilares (linha_id, position);

-- ---------------------------------------------------------------------
-- 6. CONTEÚDOS (a entidade central do planejamento)
--    Um conteúdo de vídeo aponta para um roteiro existente em vez de
--    duplicar o texto: script_id → roteiros.id
-- ---------------------------------------------------------------------
create table if not exists public.conteudos (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clientes(id) on delete cascade,
  linha_id    uuid references public.linhas_editoriais(id) on delete cascade,
  pilar_id    uuid references public.pilares(id) on delete set null,
  script_id   uuid references public.roteiros(id) on delete set null,
  produto_id  uuid references public.produtos(id) on delete set null,
  tipo        text not null default 'Reel',
  position    integer not null default 0,
  titulo      text not null default '',
  objetivo    text not null default '',
  ideia_geral text not null default '',
  tema        text not null default '',
  canal       text not null default '',
  data_postagem date,
  status      text not null default 'Ideia',

  -- campos por formato (vazios quando não se aplicam)
  headline     text not null default '',
  sub_headline text not null default '',
  cta          text not null default '',
  legenda      text not null default '',
  direcao      text not null default '',
  observacao_design text not null default '',

  is_pinned   boolean not null default false,
  archived_at timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint conteudos_tipo_valido check (tipo in ('Reel','Card','Carrossel','Story')),
  constraint conteudos_status_valido
    check (status in ('Ideia','Em criação','Em revisão','Aprovado','Programado','Publicado'))
);
create index if not exists conteudos_linha_idx   on public.conteudos (linha_id, position);
create index if not exists conteudos_cliente_idx on public.conteudos (client_id, updated_at desc);
create index if not exists conteudos_data_idx    on public.conteudos (data_postagem);
create index if not exists conteudos_lixeira_idx on public.conteudos (deleted_at);

-- ---------------------------------------------------------------------
-- 7. SLIDES (carrossel) e FRAMES (stories)
-- ---------------------------------------------------------------------
create table if not exists public.slides (
  id         uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.conteudos(id) on delete cascade,
  position   integer not null default 0,
  titulo     text not null default '',
  texto      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists slides_conteudo_idx on public.slides (content_id, position);

create table if not exists public.frames (
  id         uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.conteudos(id) on delete cascade,
  position   integer not null default 0,
  texto      text not null default '',
  direcao_visual text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists frames_conteudo_idx on public.frames (content_id, position);

-- ---------------------------------------------------------------------
-- 8. BANCO DE IDEIAS
-- ---------------------------------------------------------------------
create table if not exists public.ideias (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clientes(id) on delete cascade,
  content_id  uuid references public.conteudos(id) on delete set null,
  titulo      text not null default '',
  pilar       text not null default '',
  formato     text not null default '',
  objetivo    text not null default '',
  observacoes text not null default '',
  status      text not null default 'Ideia',
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint ideias_status_valido
    check (status in ('Ideia','Selecionada','Virou conteúdo','Arquivada'))
);
create index if not exists ideias_cliente_idx on public.ideias (client_id, updated_at desc);

-- ---------------------------------------------------------------------
-- 9. SCRIPT DNA — metadados estratégicos no roteiro (todos opcionais)
-- ---------------------------------------------------------------------
alter table public.roteiros add column if not exists content_id uuid references public.conteudos(id) on delete set null;
alter table public.roteiros add column if not exists pilar      text not null default '';
alter table public.roteiros add column if not exists funil      text not null default '';
alter table public.roteiros add column if not exists formato    text not null default '';
alter table public.roteiros add column if not exists tema       text not null default '';

-- ---------------------------------------------------------------------
-- 10. updated_at automático nas tabelas novas
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['cliente_inteligencia','produtos','provas','onboardings',
                           'linhas_editoriais','pilares','conteudos','slides','frames','ideias']
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I
                    for each row execute function public.tocar_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 11. VISÃO DE APOIO — resumo da linha editorial
-- ---------------------------------------------------------------------
drop view if exists public.linhas_resumo;
create view public.linhas_resumo
with (security_invoker = on) as
select
  l.*,
  c.nome as cliente_nome,
  c.logo_url as cliente_logo_url,
  (select count(*) from public.conteudos ct
     where ct.linha_id = l.id and ct.deleted_at is null) as total_conteudos,
  (select count(*) from public.conteudos ct
     where ct.linha_id = l.id and ct.deleted_at is null
       and ct.status in ('Em criação','Em revisão','Aprovado','Programado','Publicado')) as total_estruturados,
  (select count(*) from public.pilares p where p.linha_id = l.id) as total_pilares
from public.linhas_editoriais l
join public.clientes c on c.id = l.client_id;

-- ---------------------------------------------------------------------
-- 12. ACESSO (mesma política das demais tabelas: sistema sem login)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['cliente_inteligencia','produtos','provas','onboardings',
                           'linhas_editoriais','pilares','conteudos','slides','frames','ideias']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists acesso_interno_%I on public.%I', t, t);
    execute format('create policy acesso_interno_%I on public.%I
                    for all to anon, authenticated using (true) with check (true)', t, t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop;
end $$;

grant select on public.linhas_resumo to anon, authenticated;

-- =====================================================================
--  Fim. As entidades de planejamento estão criadas e relacionadas.
--  Nenhum campo estratégico é obrigatório: um cliente com apenas o nome
--  continua funcionando em todas as telas.
-- =====================================================================
