-- 4.54.0: Assistente B7 nos grupos do WhatsApp (ideia do "Gabriel" do Núcleo7, do jeito do B7)
-- Responde quando é marcado num grupo de cliente, com a conversa recente e o que está em
-- produção para aquele cliente. O que não sabe, pergunta à equipe no privado, repassa a
-- resposta ao grupo e guarda como aprendizado.

create table if not exists public.wa_assistente (
  id int primary key default 1 check (id = 1),
  ativo boolean not null default false,
  nome text not null default 'Assistente B7',
  jeito text not null default '',            -- como se comportar (texto livre)
  regras text not null default '',           -- uma regra por linha (NUNCA… / SEMPRE… / NÃO RESPONDA quando…)
  equipe jsonb not null default '[]',        -- [{nome, numero, assuntos, duvidas:bool}]
  sem_marcacao boolean not null default false,
  pausa_min int not null default 30,         -- sem marcação: calado se a equipe falou há menos que isso
  espera_min_s int not null default 4,
  espera_max_s int not null default 9,
  grupos jsonb not null default '{}',        -- {jid: {desligado:bool, regras:text}}
  meu_lid text,                              -- código @lid do próprio número (descoberto sozinho)
  atualizado_em timestamptz not null default now()
);
insert into public.wa_assistente (id) values (1) on conflict do nothing;

create table if not exists public.wa_assistente_aprendizados (
  id uuid primary key default gen_random_uuid(),
  pergunta text not null,
  resposta text not null,
  grupo text,
  respondido_por text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.wa_assistente_duvidas (
  id uuid primary key default gen_random_uuid(),
  jid text not null,
  grupo_nome text,
  autor text,
  pergunta text not null,
  pergunta_equipe text,
  msg_id text,
  msg_raw jsonb,
  avisos_ids text[] not null default '{}',   -- ids das mensagens mandadas à equipe (citar qualquer uma vale)
  resposta text,
  respondida_por text,
  respondida_em timestamptz,
  criada_em timestamptz not null default now()
);
create index if not exists wa_assistente_duvidas_abertas on public.wa_assistente_duvidas (criada_em) where respondida_em is null;

-- cada mensagem é avaliada uma vez só (o Evolution pode repetir o aviso)
create table if not exists public.wa_assistente_vistos (
  msg_id text primary key,
  em timestamptz not null default now()
);

alter table public.wa_mensagens add column if not exists do_assistente boolean not null default false;

alter table public.wa_assistente enable row level security;
alter table public.wa_assistente_aprendizados enable row level security;
alter table public.wa_assistente_duvidas enable row level security;
alter table public.wa_assistente_vistos enable row level security;
revoke all on public.wa_assistente_vistos from anon, authenticated;

drop policy if exists wa_assistente_adm on public.wa_assistente;
create policy wa_assistente_adm on public.wa_assistente for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
drop policy if exists wa_assistente_ap_adm on public.wa_assistente_aprendizados;
create policy wa_assistente_ap_adm on public.wa_assistente_aprendizados for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
drop policy if exists wa_assistente_dv_ver on public.wa_assistente_duvidas;
create policy wa_assistente_dv_ver on public.wa_assistente_duvidas for select to authenticated using (public.pode_ver_wa());
grant select, insert, update, delete on public.wa_assistente, public.wa_assistente_aprendizados to authenticated;
grant select on public.wa_assistente_duvidas to authenticated;
