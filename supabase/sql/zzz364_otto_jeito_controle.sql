-- 4.73.0: configurações novas do Otto — jeito (tamanho, emojis, apelidos, zoação espontânea)
-- e controle (ferramentas desligadas, quem pode dar ordens, confirmar antes de agir, fim de semana em silêncio).
alter table public.wa_assistente add column if not exists tamanho text not null default 'auto';
alter table public.wa_assistente add column if not exists emojis text not null default 'pouco';
alter table public.wa_assistente add column if not exists apelidos_otto text not null default '';
alter table public.wa_assistente add column if not exists zoacao_espontanea int not null default 0;
alter table public.wa_assistente add column if not exists ferramentas_off text[] not null default '{}';
alter table public.wa_assistente add column if not exists ordens_quem text[] not null default '{}';
alter table public.wa_assistente add column if not exists confirmar_acoes boolean not null default false;
alter table public.wa_assistente add column if not exists fds_silencio boolean not null default false;
alter table public.wa_assistente drop constraint if exists wa_assistente_tamanho_chk;
alter table public.wa_assistente add constraint wa_assistente_tamanho_chk check (tamanho in ('auto', 'curta', 'media', 'detalhada'));
alter table public.wa_assistente drop constraint if exists wa_assistente_emojis_chk;
alter table public.wa_assistente add constraint wa_assistente_emojis_chk check (emojis in ('nada', 'pouco', 'bastante'));
alter table public.wa_assistente drop constraint if exists wa_assistente_zoacao_esp_chk;
alter table public.wa_assistente add constraint wa_assistente_zoacao_esp_chk check (zoacao_espontanea between 0 and 30);

-- "confirma?" do Otto: o plano fica guardado até a pessoa responder sim/não (10 min)
create table if not exists public.wa_otto_confirmar (
  id uuid primary key default gen_random_uuid(),
  jid text not null,
  autor text not null,
  autor_nome text,
  pedido text,
  acoes jsonb not null default '[]',
  criado_em timestamptz not null default now(),
  usado_em timestamptz,
  resposta text
);
create index if not exists wa_otto_confirmar_busca on public.wa_otto_confirmar (jid, autor, criado_em desc) where usado_em is null;
alter table public.wa_otto_confirmar enable row level security;
revoke all on public.wa_otto_confirmar from anon, authenticated;
