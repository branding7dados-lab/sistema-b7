-- =====================================================================
-- Tabelas do SITE DA BRANDING7 (branding7.com.br) no banco do N7.
-- Rodar UMA vez no SQL Editor do projeto do N7.
-- Só cria tabelas NOVAS com final "_b7" ("if not exists"): não altera nem
-- apaga nada que já existe no N7.
-- Quem preenche: a função n7-sync do Sistema B7, a cada 15 minutos.
-- RLS ligado e sem políticas: só a chave service_role e o painel leem.
-- Para o app do N7 ler com usuário logado, criem uma política de SELECT.
-- =====================================================================

-- contatos que chegaram pelo formulário do site
create table if not exists public.site_leads_b7 (
  id uuid primary key,                 -- mesmo id do Sistema B7
  criado_em timestamptz not null,
  nome text, whatsapp text, empresa text, cidade text,
  interesse text, mensagem text,
  origem jsonb not null default '{}'::jsonb,   -- utm_source, utm_campaign, fbclid, gclid, referrer...
  fonte text,                          -- meta | google-ads | instagram | google | direto | ...
  campanha text,                       -- utm_campaign
  status text,                         -- novo | em_contato | virou_cliente | descartado
  notas text,
  atualizado_em timestamptz,
  sincronizado_em timestamptz not null default now()
);

-- cada evento do site (sem dado pessoal: sessão aleatória do navegador)
create table if not exists public.site_eventos_b7 (
  id bigint primary key,               -- mesmo id do Sistema B7
  criado_em timestamptz not null,
  sessao text not null,
  tipo text not null,                  -- visita | engajou | video | whatsapp | formulario | lead | instagram
  pagina text, dispositivo text,
  origem jsonb not null default '{}'::jsonb,
  fonte text, campanha text,
  sincronizado_em timestamptz not null default now()
);
create index if not exists site_eventos_b7_data on public.site_eventos_b7 (criado_em desc);

-- números do dia (fuso de São Paulo)
create table if not exists public.site_metricas_dia_b7 (
  dia date primary key,
  visitantes int not null default 0,       -- pessoas diferentes (sessões)
  engajaram int not null default 0,        -- rolaram metade da página ou viram vídeo
  clicaram_contato int not null default 0, -- WhatsApp, formulário ou Instagram
  leads int not null default 0,            -- mandaram o formulário
  cliques_whatsapp int not null default 0,
  formularios_abertos int not null default 0,
  cliques_instagram int not null default 0,
  videos_assistidos int not null default 0,
  celular int not null default 0,
  computador int not null default 0,
  tablet int not null default 0,
  sincronizado_em timestamptz not null default now()
);

-- de onde vieram, por dia
create table if not exists public.site_origens_dia_b7 (
  dia date not null, fonte text not null,
  visitantes int not null default 0, leads int not null default 0,
  sincronizado_em timestamptz not null default now(),
  primary key (dia, fonte)
);

-- campanhas (utm_campaign), por dia
create table if not exists public.site_campanhas_dia_b7 (
  dia date not null, campanha text not null, fonte text,
  visitantes int not null default 0, leads int not null default 0,
  sincronizado_em timestamptz not null default now(),
  primary key (dia, campanha)
);

-- resumo pronto (7, 30 e 90 dias): funil, origens, campanhas, aparelhos, contatos
create table if not exists public.site_resumo_b7 (
  periodo_dias int primary key,
  dados jsonb not null,
  sincronizado_em timestamptz not null default now()
);

alter table public.site_leads_b7 enable row level security;
alter table public.site_eventos_b7 enable row level security;
alter table public.site_metricas_dia_b7 enable row level security;
alter table public.site_origens_dia_b7 enable row level security;
alter table public.site_campanhas_dia_b7 enable row level security;
alter table public.site_resumo_b7 enable row level security;
