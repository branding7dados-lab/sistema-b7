-- 4.61.0: memória do Otto, avisos por iniciativa própria, resposta em áudio e resumo do dia.

-- o que o Otto deve lembrar ("o Kevin prefere print no grupo da equipe", "a C6 não gosta de música alta")
create table if not exists public.wa_otto_memoria (
  id uuid primary key default gen_random_uuid(),
  texto text not null check (length(btrim(texto)) between 3 and 500),
  sobre text,                         -- pessoa/cliente/assunto (livre)
  criado_por text,
  criada_em timestamptz not null default now(),
  ativo boolean not null default true
);
alter table public.wa_otto_memoria enable row level security;
drop policy if exists wa_otto_memoria_admin on public.wa_otto_memoria;
create policy wa_otto_memoria_admin on public.wa_otto_memoria for all to authenticated using (public.sou_admin()) with check (public.sou_admin());

-- avisos já dados (um por chave: não repete o mesmo aviso)
create table if not exists public.wa_otto_avisos (
  chave text primary key,
  em timestamptz not null default now()
);
alter table public.wa_otto_avisos enable row level security;

-- opções e controle (uma vez por período, sem cron: quem chega primeiro "pega a vez")
alter table public.wa_assistente add column if not exists alertas_ligados boolean not null default true;
alter table public.wa_assistente add column if not exists alertas_ultimo timestamptz;
alter table public.wa_assistente add column if not exists resumo_dia_ligado boolean not null default true;
alter table public.wa_assistente add column if not exists resumo_dia_hora text not null default '18:00';
alter table public.wa_assistente add column if not exists resumo_dia_ultimo date;
alter table public.wa_assistente add column if not exists responder_audio boolean not null default true;
alter table public.wa_assistente add column if not exists voz text not null default 'Orus';
