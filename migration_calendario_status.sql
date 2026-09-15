-- =========================================================================
-- CALENDÁRIO DE GRAVAÇÕES — STATUS DE OCORRÊNCIA COM HISTÓRICO
-- (Marcada / Remarcada / Concluída / Cancelada) + escrita de volta no
-- Google Calendar (branding7dados)
-- =========================================================================
-- Depende de migration_calendario.sql já ter rodado (usa
-- public.calendario_eventos, calendario_vinculos, gravacoes, sou_equipe(),
-- sou_equipe_interna()).
--
-- Por que uma tabela nova (gravacoes_ocorrencias) e não só mudar a data
-- da gravação: o pedido explícito foi manter o HISTÓRICO visual do
-- calendário — quando uma gravação é remarcada, a data antiga não pode
-- sumir, ela continua aparecendo lá como "Remarcada" (amarelo), e a data
-- nova aparece como "Marcada" (azul), as duas apontando pra mesma
-- gravação. Um único campo de data na tabela gravacoes não guarda duas
-- datas ao mesmo tempo — por isso a ocorrência vira uma linha própria, e
-- remarcar cria uma ocorrência nova em vez de sobrescrever a antiga.
--
-- Cores (aplicadas só no frontend, aqui é só o texto do status):
--   marcada   = azul     remarcada = amarelo
--   concluida = verde    cancelada = vermelho
--
-- Cada gravação tem no máximo UMA ocorrência "atual" por vez (índice
-- único abaixo) — é ela que aparece como card ativo e que dirige o que
-- pode ser feito a seguir (remarcar, cancelar, concluir). As ocorrências
-- antigas (remarcada/cancelada) continuam na tabela pra sempre, só de
-- leitura, pro histórico do calendário.
-- =========================================================================

create table if not exists public.gravacoes_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  gravacao_id uuid not null references public.gravacoes(id) on delete cascade,
  evento_id uuid references public.calendario_eventos(id) on delete set null,
  status text not null default 'marcada' check (status in ('marcada', 'remarcada', 'concluida', 'cancelada')),
  inicio timestamptz not null,
  fim timestamptz,
  atual boolean not null default true,
  ocorrencia_anterior_id uuid references public.gravacoes_ocorrencias(id) on delete set null,
  motivo_cancelamento text,
  erro_sincronizacao text,
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists gravacoes_ocorrencias_janela on public.gravacoes_ocorrencias (inicio, fim);
create index if not exists gravacoes_ocorrencias_gravacao on public.gravacoes_ocorrencias (gravacao_id);
-- só uma ocorrência "atual" por gravação — é o que impede duas correntes
-- de remarcação vivas ao mesmo tempo pra uma mesma gravação
create unique index if not exists gravacoes_ocorrencias_atual_unica
  on public.gravacoes_ocorrencias (gravacao_id) where atual;

alter table public.gravacoes_ocorrencias enable row level security;
grant select on public.gravacoes_ocorrencias to authenticated;
drop policy if exists "gravacoes_ocorrencias select" on public.gravacoes_ocorrencias;
create policy "gravacoes_ocorrencias select" on public.gravacoes_ocorrencias
  for select to authenticated using (public.sou_equipe_interna());
-- escrita só pelas funções abaixo (security definer) — nunca direto
revoke insert, update, delete on public.gravacoes_ocorrencias from authenticated;

-- ---------------------------------------------------------------------
-- Backfill: gravações que já estavam vinculadas a um evento antes desta
-- rodada ganham uma ocorrência inicial "marcada", na data do evento —
-- sem isso elas não apareceriam no novo calendário em grade.
-- ---------------------------------------------------------------------
insert into public.gravacoes_ocorrencias (gravacao_id, evento_id, status, inicio, fim, atual)
select vi.gravacao_id, vi.evento_id, 'marcada', ev.inicio, ev.fim, true
from public.calendario_vinculos vi
join public.calendario_eventos ev on ev.id = vi.evento_id
where not exists (
  select 1 from public.gravacoes_ocorrencias o where o.gravacao_id = vi.gravacao_id
);

-- ---------------------------------------------------------------------
-- VIEW de leitura — ocorrência + gravação + cliente + evento/agenda
-- `drop` antes do `create` porque o Postgres não deixa reordenar/inserir
-- colunas no meio de uma view com `create or replace` (só deixa adicionar
-- no final) — como esta migration já rodou antes sem a coluna
-- `agenda_id`, um `create or replace` direto quebraria ao reaplicar.
-- ---------------------------------------------------------------------
drop view if exists public.calendario_ocorrencias_resumo;
create view public.calendario_ocorrencias_resumo
with (security_invoker = true) as
select
  o.id, o.gravacao_id, o.evento_id, o.status, o.inicio, o.fim, o.atual,
  o.ocorrencia_anterior_id, o.motivo_cancelamento, o.erro_sincronizacao,
  o.criado_em, o.atualizado_em,
  g.nome as gravacao_nome, g.status as gravacao_status, g.local as gravacao_local,
  g.client_id as gravacao_client_id, cl.nome as gravacao_cliente_nome,
  cl.logo_url as gravacao_cliente_logo_url,
  ev.titulo as evento_titulo, ev.external_event_id, ev.status_provider as evento_status_provider,
  ev.agenda_id, ag.nome as agenda_nome, ag.cor as agenda_cor
from public.gravacoes_ocorrencias o
join public.gravacoes g on g.id = o.gravacao_id
left join public.clientes cl on cl.id = g.client_id
left join public.calendario_eventos ev on ev.id = o.evento_id
left join public.calendario_agendas ag on ag.id = ev.agenda_id;
grant select on public.calendario_ocorrencias_resumo to authenticated;

-- ---------------------------------------------------------------------
-- FUNÇÕES
-- ---------------------------------------------------------------------

-- Concluída: a gravação realmente aconteceu. Não mexe em data nenhuma.
-- Também empurra gravacoes.status pra 'Gravado' (se ainda não estiver) —
-- é o campo que a tela "Gerar demandas de edição a partir de uma
-- gravação" (Edição de Vídeo → Gestão) já usa pra filtrar quais
-- gravações podem virar demanda. Assim, marcar Concluída aqui já destrava
-- esse fluxo existente, sem duplicar lógica.
create or replace function public.calendario_ocorrencia_concluir(p_ocorrencia_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.gravacoes_ocorrencias%rowtype;
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador marcam uma gravação como concluída.' using errcode = '42501';
  end if;
  select * into o from public.gravacoes_ocorrencias where id = p_ocorrencia_id;
  if not found then raise exception 'Ocorrência não encontrada.'; end if;
  if not o.atual then raise exception 'Só a ocorrência atual da gravação pode ser marcada como concluída.'; end if;
  if o.status = 'cancelada' then raise exception 'Esta gravação está cancelada — reative remarcando antes de concluir.'; end if;

  update public.gravacoes_ocorrencias set status = 'concluida', atualizado_em = now() where id = p_ocorrencia_id;
  update public.gravacoes set status = 'Gravado', gravada_em = coalesce(gravada_em, now())
    where id = o.gravacao_id and status is distinct from 'Gravado';
end;
$$;
revoke all on function public.calendario_ocorrencia_concluir(uuid) from public;
grant execute on function public.calendario_ocorrencia_concluir(uuid) to authenticated;

-- Remarcar: congela a ocorrência atual como 'remarcada' (guarda a data
-- antiga, não mexe nela) e cria uma ocorrência NOVA 'marcada' já na nova
-- data, encadeada pela anterior (ocorrencia_anterior_id). As duas
-- apontam pro mesmo evento_id — é o que permite ao chamador (frontend)
-- pedir pra Edge Function mover a data do MESMO evento no Google, em vez
-- de criar um evento duplicado. Devolve o id da ocorrência nova e o
-- evento_id, pra quem chamou decidir se há algo a sincronizar.
create or replace function public.calendario_ocorrencia_remarcar(
  p_ocorrencia_id uuid, p_novo_inicio timestamptz, p_novo_fim timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.gravacoes_ocorrencias%rowtype; nova_id uuid;
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador remarcam uma gravação.' using errcode = '42501';
  end if;
  if p_novo_inicio is null then raise exception 'Escolha a nova data/horário da gravação.'; end if;

  select * into o from public.gravacoes_ocorrencias where id = p_ocorrencia_id;
  if not found then raise exception 'Ocorrência não encontrada.'; end if;
  if not o.atual then raise exception 'Só a ocorrência atual da gravação pode ser remarcada.'; end if;
  if o.status = 'concluida' then raise exception 'Esta gravação já foi concluída — não dá pra remarcar.'; end if;

  update public.gravacoes_ocorrencias
    set status = 'remarcada', atual = false, atualizado_em = now()
    where id = p_ocorrencia_id;

  insert into public.gravacoes_ocorrencias
    (gravacao_id, evento_id, status, inicio, fim, atual, ocorrencia_anterior_id, criado_por)
  values
    (o.gravacao_id, o.evento_id, 'marcada', p_novo_inicio, p_novo_fim, true, o.id, auth.uid())
  returning id into nova_id;

  update public.gravacoes set data_gravacao = p_novo_inicio::date where id = o.gravacao_id;

  return jsonb_build_object('nova_ocorrencia_id', nova_id, 'evento_id', o.evento_id);
end;
$$;
revoke all on function public.calendario_ocorrencia_remarcar(uuid, timestamptz, timestamptz) from public;
grant execute on function public.calendario_ocorrencia_remarcar(uuid, timestamptz, timestamptz) to authenticated;

-- Cancelar: fica visível pra sempre na data em que estava marcada, só
-- que em vermelho — a linha NUNCA é apagada. motivo é opcional.
create or replace function public.calendario_ocorrencia_cancelar(p_ocorrencia_id uuid, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.gravacoes_ocorrencias%rowtype;
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador cancelam uma gravação.' using errcode = '42501';
  end if;
  select * into o from public.gravacoes_ocorrencias where id = p_ocorrencia_id;
  if not found then raise exception 'Ocorrência não encontrada.'; end if;
  if not o.atual then raise exception 'Só a ocorrência atual da gravação pode ser cancelada.'; end if;
  if o.status = 'concluida' then raise exception 'Esta gravação já foi concluída — não dá pra cancelar.'; end if;

  update public.gravacoes_ocorrencias
    set status = 'cancelada', motivo_cancelamento = nullif(btrim(coalesce(p_motivo, '')), ''), atualizado_em = now()
    where id = p_ocorrencia_id;

  return jsonb_build_object('evento_id', o.evento_id);
end;
$$;
revoke all on function public.calendario_ocorrencia_cancelar(uuid, text) from public;
grant execute on function public.calendario_ocorrencia_cancelar(uuid, text) to authenticated;

-- Chamada só pela Edge Function (service role — sem grant pra
-- authenticated de propósito) quando a chamada ao Google falha DEPOIS
-- que o B7 já salvou a mudança: registra o aviso sem desfazer nada do
-- que já foi salvo. O dado do B7 nunca fica refém do Google responder.
create or replace function public.calendario_ocorrencia_marcar_erro_sync(p_ocorrencia_id uuid, p_erro text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.gravacoes_ocorrencias set erro_sincronizacao = p_erro where id = p_ocorrencia_id;
end;
$$;
revoke all on function public.calendario_ocorrencia_marcar_erro_sync(uuid, text) from public, authenticated, anon;

-- ---------------------------------------------------------------------
-- Redefine as duas funções de vínculo de migration_calendario.sql pra
-- também semear a primeira ocorrência ('marcada', na data do evento) —
-- sem isso, uma gravação recém-vinculada ou recém-criada a partir de um
-- evento não apareceria no calendário em grade (que lê de
-- gravacoes_ocorrencias, não mais direto de calendario_vinculos).
-- CREATE OR REPLACE é seguro de rodar de novo — mesma assinatura.
-- ---------------------------------------------------------------------
create or replace function public.calendario_vincular_gravacao(p_event_id uuid, p_gravacao_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare ev public.calendario_eventos%rowtype;
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador vinculam um evento a uma gravação.' using errcode = '42501';
  end if;
  select * into ev from public.calendario_eventos where id = p_event_id;
  if not found then raise exception 'Evento não encontrado.'; end if;
  if not exists (select 1 from public.gravacoes where id = p_gravacao_id and deleted_at is null) then
    raise exception 'Gravação não encontrada.';
  end if;
  insert into public.calendario_vinculos (evento_id, gravacao_id, vinculado_por)
  values (p_event_id, p_gravacao_id, auth.uid())
  on conflict (evento_id) do update set gravacao_id = excluded.gravacao_id,
    vinculado_por = excluded.vinculado_por, vinculado_em = now();

  -- semeia a ocorrência inicial, se a gravação ainda não tiver nenhuma
  if not exists (select 1 from public.gravacoes_ocorrencias where gravacao_id = p_gravacao_id) then
    insert into public.gravacoes_ocorrencias (gravacao_id, evento_id, status, inicio, fim, atual)
    values (p_gravacao_id, p_event_id, 'marcada', ev.inicio, ev.fim, true);
  end if;
end;
$$;
revoke all on function public.calendario_vincular_gravacao(uuid, uuid) from public;
grant execute on function public.calendario_vincular_gravacao(uuid, uuid) to authenticated;

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

  insert into public.gravacoes_ocorrencias (gravacao_id, evento_id, status, inicio, fim, atual)
  values (nova, p_event_id, 'marcada', ev.inicio, ev.fim, true);

  return nova;
end;
$$;
revoke all on function public.calendario_criar_gravacao_de_evento(uuid, uuid, text, date, text, text) from public;
grant execute on function public.calendario_criar_gravacao_de_evento(uuid, uuid, text, date, text, text) to authenticated;
