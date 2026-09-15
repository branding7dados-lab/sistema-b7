-- =========================================================================
-- B7 VÍDEO — CALENDÁRIO DE GRAVAÇÕES (Parte 3, integração real com Google
-- Calendar da conta branding7dados)
-- =========================================================================
-- CONTEXTO IMPORTANTE, pra quem for ler isto depois: este sistema já teve
-- uma integração com o Google Agenda (Edge Function "google-agenda",
-- OAuth do Google) — ela foi removida de propósito numa rodada anterior,
-- com a decisão registrada em CENTRAL.md: "a agenda de gravações
-- integrada ao Google foi removida: essa função passa a viver no sistema
-- da N7". Nesta rodada, a pedido explícito de quem usa o sistema, ela
-- está sendo reconstruída — a decisão de reverter foi tomada por vocês,
-- não por mim sozinho.
--
-- Arquitetura (ver RELATORIO desta rodada pro detalhe completo):
--   1) calendario_conexoes / calendario_oauth_estados — nunca acessíveis
--      pelo frontend (sem grant nenhum pra "authenticated"): só a Edge
--      Function "google-agenda", usando a service role key, lê e escreve
--      aqui. O refresh_token do Google NUNCA chega ao navegador.
--   2) calendario_agendas — as agendas (calendários) do Google que a
--      conexão enxerga; admin/coordenador escolhe quais ficam ativas.
--   3) calendario_eventos — cópia local (cache) dos eventos das agendas
--      ativas, identificados de forma estável por
--      (agenda, external_event_id) — nunca por título+data. É essa
--      identidade estável que evita duplicar evento quando ele é
--      resinicronizado, movido de horário ou editado na origem.
--   4) calendario_vinculos — liga um evento externo a uma Gravação real
--      do B7 (public.gravacoes) — 1 evento pra no máximo 1 gravação, sem
--      duplicar dado de gravação dentro do evento.
--
-- Sem infraestrutura de agendamento neste projeto (mesma limitação já
-- registrada em migration_video_gestao.sql): a sincronização acontece
-- quando alguém da equipe abre a tela do Calendário, não num relógio
-- rodando sozinho no servidor.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. CONEXÃO COM O GOOGLE — nunca exposta ao frontend
-- ---------------------------------------------------------------------
create table if not exists public.calendario_conexoes (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'google',
  conta_email text not null default '',
  refresh_token text not null,
  access_token text,
  token_expira_em timestamptz,
  escopo text not null default '',
  status text not null default 'ativa' check (status in ('ativa', 'erro', 'desconectada')),
  ultimo_erro text,
  ultima_sincronizacao timestamptz,
  conectado_por uuid references public.perfis(id) on delete set null,
  conectado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.calendario_conexoes enable row level security;
/* De propósito: NENHUM grant pra authenticated/anon, NENHUMA policy.
   Só a service role (Edge Function) enxerga esta tabela — é assim que o
   refresh_token nunca passa pelo PostgREST público. */
revoke all on public.calendario_conexoes from authenticated, anon, public;

create table if not exists public.calendario_oauth_estados (
  estado text primary key,
  admin_id uuid not null references public.perfis(id) on delete cascade,
  criado_em timestamptz not null default now(),
  usado boolean not null default false
);
alter table public.calendario_oauth_estados enable row level security;
revoke all on public.calendario_oauth_estados from authenticated, anon, public;

-- ---------------------------------------------------------------------
-- 2. AGENDAS (CALENDÁRIOS) DA CONEXÃO
-- ---------------------------------------------------------------------
create table if not exists public.calendario_agendas (
  id uuid primary key default gen_random_uuid(),
  conexao_id uuid not null references public.calendario_conexoes(id) on delete cascade,
  provider text not null default 'google',
  external_calendar_id text not null,
  nome text not null default '',
  cor text,
  ativo boolean not null default false,
  sync_token text,
  ultima_sincronizacao timestamptz,
  created_at timestamptz not null default now(),
  constraint calendario_agendas_unica unique (conexao_id, external_calendar_id)
);
alter table public.calendario_agendas enable row level security;
/* Leitura: qualquer um da equipe interna (admin/coordenador/designer/
   videomaker) — mesmo critério já usado pro resto do B7 Vídeo. Escrita
   só pela Edge Function (service role) e pela função de alternar abaixo. */
revoke insert, update, delete on public.calendario_agendas from authenticated;
grant select on public.calendario_agendas to authenticated;
drop policy if exists "calendario_agendas select" on public.calendario_agendas;
create policy "calendario_agendas select" on public.calendario_agendas
  for select to authenticated using (public.sou_equipe_interna());

-- ---------------------------------------------------------------------
-- 3. EVENTOS (cache local dos eventos do Google)
-- ---------------------------------------------------------------------
create table if not exists public.calendario_eventos (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references public.calendario_agendas(id) on delete cascade,
  external_event_id text not null,
  titulo text not null default '(sem título)',
  descricao text,
  local text,
  responsavel_texto text,
  inicio timestamptz not null,
  fim timestamptz,
  dia_inteiro boolean not null default false,
  status_provider text not null default 'confirmed' check (status_provider in ('confirmed', 'tentative', 'cancelled')),
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendario_eventos_unico unique (agenda_id, external_event_id)
);
create index if not exists calendario_eventos_janela on public.calendario_eventos (inicio, fim);
alter table public.calendario_eventos enable row level security;
revoke insert, update, delete on public.calendario_eventos from authenticated;
grant select on public.calendario_eventos to authenticated;
drop policy if exists "calendario_eventos select" on public.calendario_eventos;
create policy "calendario_eventos select" on public.calendario_eventos
  for select to authenticated using (public.sou_equipe_interna());

-- ---------------------------------------------------------------------
-- 4. VÍNCULO EVENTO ↔ GRAVAÇÃO
-- ---------------------------------------------------------------------
create table if not exists public.calendario_vinculos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null unique references public.calendario_eventos(id) on delete cascade,
  gravacao_id uuid not null references public.gravacoes(id) on delete cascade,
  vinculado_por uuid references public.perfis(id) on delete set null,
  vinculado_em timestamptz not null default now()
);
alter table public.calendario_vinculos enable row level security;
grant select on public.calendario_vinculos to authenticated;
drop policy if exists "calendario_vinculos select" on public.calendario_vinculos;
create policy "calendario_vinculos select" on public.calendario_vinculos
  for select to authenticated using (public.sou_equipe_interna());
revoke insert, update, delete on public.calendario_vinculos from authenticated;

-- view de leitura confortável (evento + vínculo, quando existir)
create or replace view public.calendario_eventos_resumo
with (security_invoker = true) as
select
  ev.id, ev.agenda_id, ev.external_event_id, ev.titulo, ev.descricao, ev.local,
  ev.responsavel_texto, ev.inicio, ev.fim, ev.dia_inteiro, ev.status_provider,
  ag.nome as agenda_nome, ag.cor as agenda_cor,
  vi.gravacao_id, vi.vinculado_em,
  g.nome as gravacao_nome, g.status as gravacao_status, g.client_id as gravacao_client_id,
  cl.nome as gravacao_cliente_nome
from public.calendario_eventos ev
join public.calendario_agendas ag on ag.id = ev.agenda_id and ag.ativo
left join public.calendario_vinculos vi on vi.evento_id = ev.id
left join public.gravacoes g on g.id = vi.gravacao_id
left join public.clientes cl on cl.id = g.client_id;
grant select on public.calendario_eventos_resumo to authenticated;

-- ---------------------------------------------------------------------
-- 5. FUNÇÕES — mutação sempre por aqui (mesmo padrão do resto do B7)
-- ---------------------------------------------------------------------
create or replace function public.calendario_alternar_agenda(p_id uuid, p_ativo boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador escolhem quais agendas ficam visíveis.' using errcode = '42501';
  end if;
  update public.calendario_agendas set ativo = p_ativo where id = p_id;
  if not found then raise exception 'Agenda não encontrada.'; end if;
end;
$$;
revoke all on function public.calendario_alternar_agenda(uuid, boolean) from public;
grant execute on function public.calendario_alternar_agenda(uuid, boolean) to authenticated;

create or replace function public.calendario_vincular_gravacao(p_event_id uuid, p_gravacao_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador vinculam um evento a uma gravação.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.calendario_eventos where id = p_event_id) then
    raise exception 'Evento não encontrado.';
  end if;
  if not exists (select 1 from public.gravacoes where id = p_gravacao_id and deleted_at is null) then
    raise exception 'Gravação não encontrada.';
  end if;
  insert into public.calendario_vinculos (evento_id, gravacao_id, vinculado_por)
  values (p_event_id, p_gravacao_id, auth.uid())
  on conflict (evento_id) do update set gravacao_id = excluded.gravacao_id,
    vinculado_por = excluded.vinculado_por, vinculado_em = now();
end;
$$;
revoke all on function public.calendario_vincular_gravacao(uuid, uuid) from public;
grant execute on function public.calendario_vincular_gravacao(uuid, uuid) to authenticated;

create or replace function public.calendario_desvincular(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador desvinculam um evento.' using errcode = '42501';
  end if;
  delete from public.calendario_vinculos where evento_id = p_event_id;
end;
$$;
revoke all on function public.calendario_desvincular(uuid) from public;
grant execute on function public.calendario_desvincular(uuid) to authenticated;

-- Cria uma Gravação nova a partir de um evento e já vincula — numa
-- transação só, pra nunca ficar num estado pela metade (gravação criada
-- sem vínculo, ou vínculo sem gravação). Só campos confiáveis do evento
-- entram pré-preenchidos; confirmação acontece na tela, antes de chamar
-- esta função (ela não decide sozinha, só executa o que já foi
-- confirmado).
create or replace function public.calendario_criar_gravacao_de_evento(
  p_event_id uuid, p_client_id uuid, p_nome text, p_data_gravacao date,
  p_local text default '', p_observacoes text default ''
) returns uuid language plpgsql security definer set search_path = public as $$
declare ev public.calendario_eventos%rowtype; nova uuid;
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador criam gravação a partir de um evento.' using errcode = '42501';
  end if;
  select * into ev from public.calendario_eventos where id = p_event_id;
  if not found then raise exception 'Evento não encontrado.'; end if;
  if exists (select 1 from public.calendario_vinculos where evento_id = p_event_id) then
    raise exception 'Este evento já está vinculado a uma gravação.';
  end if;
  if p_client_id is null or not exists (select 1 from public.clientes where id = p_client_id) then
    raise exception 'Selecione o cliente.';
  end if;
  if coalesce(btrim(p_nome), '') = '' then raise exception 'Dê um nome para a gravação.'; end if;

  insert into public.gravacoes (client_id, nome, data_gravacao, local, observacoes)
  values (p_client_id, p_nome, p_data_gravacao, coalesce(p_local, ''), coalesce(p_observacoes, ''))
  returning id into nova;

  insert into public.calendario_vinculos (evento_id, gravacao_id, vinculado_por)
  values (p_event_id, nova, auth.uid());

  return nova;
end;
$$;
revoke all on function public.calendario_criar_gravacao_de_evento(uuid, uuid, text, date, text, text) from public;
grant execute on function public.calendario_criar_gravacao_de_evento(uuid, uuid, text, date, text, text) to authenticated;

-- Status da conexão pro frontend mostrar — sem NUNCA devolver token
-- nenhum (nem no formato de função de banco: o refresh_token continua
-- só acessível pela Edge Function via service role, isto aqui só lê os
-- metadados operacionais).
create or replace function public.calendario_status_conexao()
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.calendario_conexoes%rowtype;
begin
  if not public.sou_equipe_interna() then
    raise exception 'Sem acesso.' using errcode = '42501';
  end if;
  select * into c from public.calendario_conexoes order by conectado_em desc limit 1;
  if not found then
    return jsonb_build_object('conectado', false);
  end if;
  return jsonb_build_object(
    'conectado', c.status = 'ativa',
    'conta_email', c.conta_email,
    'status', c.status,
    'ultimo_erro', c.ultimo_erro,
    'ultima_sincronizacao', c.ultima_sincronizacao,
    'conectado_em', c.conectado_em
  );
end;
$$;
revoke all on function public.calendario_status_conexao() from public;
grant execute on function public.calendario_status_conexao() to authenticated;
