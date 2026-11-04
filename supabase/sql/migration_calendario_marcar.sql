-- =========================================================================
-- B7 CALENDÁRIO — "Marcar gravação" direto do Calendário de Gravações
-- (Rodada u)
--
-- Lacuna encontrada depois da Rodada t: a única forma de uma gravação
-- ganhar uma ocorrência (e por isso aparecer com status no calendário)
-- era vincular ou criar a partir de um evento que JÁ existia no Google.
-- Mas o caminho mais comum de criar uma gravação no B7 é o botão global
-- "+ Nova gravação" (dashboard.js) — que nunca passa perto do calendário
-- nem do Google. Resultado: quase toda gravação real ficava invisível
-- no Calendário de Gravações, sem jeito nenhum de remarcar/cancelar/
-- concluir por ali. É essa lacuna que esta migration fecha: agora dá
-- pra marcar uma gravação nova direto do Calendário, e ela já nasce como
-- uma ocorrência 'marcada' (azul), com um evento criado no Google.
--
-- Depende de: sou_equipe(), public.gravacoes, public.clientes,
-- public.gravacoes_ocorrencias e public.calendario_agendas (todas de
-- migration_calendario.sql / migration_calendario_status.sql — rode
-- essas duas primeiro).
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1) Qual agenda do Google recebe os eventos das gravações marcadas
--    direto pelo B7. Só uma agenda ativa por vez pode ser a "agenda de
--    escrita" — sem isso a Edge Function não saberia em qual calendário
--    criar o evento novo.
-- ---------------------------------------------------------------------
alter table public.calendario_agendas add column if not exists escrita_padrao boolean not null default false;

create unique index if not exists calendario_agendas_escrita_unica
  on public.calendario_agendas (conexao_id) where escrita_padrao;

create or replace function public.calendario_agenda_definir_escrita_padrao(p_agenda_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare ag public.calendario_agendas%rowtype;
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador escolhem a agenda de novas gravações.' using errcode = '42501';
  end if;
  select * into ag from public.calendario_agendas where id = p_agenda_id;
  if not found then raise exception 'Agenda não encontrada.'; end if;
  if not ag.ativo then raise exception 'Só uma agenda ativa pode receber novas gravações — ative-a primeiro.'; end if;
  update public.calendario_agendas set escrita_padrao = false
    where conexao_id = ag.conexao_id and escrita_padrao and id <> p_agenda_id;
  update public.calendario_agendas set escrita_padrao = true where id = p_agenda_id;
end;
$$;
revoke all on function public.calendario_agenda_definir_escrita_padrao(uuid) from public;
grant execute on function public.calendario_agenda_definir_escrita_padrao(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2) Marcar uma gravação nova direto do calendário: cria a Gravação e já
--    semeia a ocorrência inicial ('marcada', atual, sem evento ainda —
--    o evento_id é preenchido depois pela Edge Function, se a chamada ao
--    Google der certo; se não der, a gravação e a ocorrência já existem
--    no B7 mesmo assim, igual ao padrão já usado em remarcar/cancelar).
-- ---------------------------------------------------------------------
create or replace function public.calendario_marcar_gravacao(
  p_client_id uuid, p_nome text, p_inicio timestamptz, p_fim timestamptz default null,
  p_local text default '', p_observacoes text default ''
) returns jsonb language plpgsql security definer set search_path = public as $$
declare nova_gravacao uuid; nova_ocorrencia uuid;
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador marcam uma gravação pelo calendário.' using errcode = '42501';
  end if;
  if p_client_id is null or not exists (select 1 from public.clientes where id = p_client_id) then
    raise exception 'Selecione o cliente.';
  end if;
  if coalesce(btrim(p_nome), '') = '' then raise exception 'Dê um nome para a gravação.'; end if;
  if p_inicio is null then raise exception 'Escolha a data e o horário da gravação.'; end if;

  insert into public.gravacoes (client_id, nome, data_gravacao, local, observacoes)
  values (p_client_id, p_nome, p_inicio::date, coalesce(p_local, ''), coalesce(p_observacoes, ''))
  returning id into nova_gravacao;

  insert into public.gravacoes_ocorrencias (gravacao_id, evento_id, status, inicio, fim, atual)
  values (nova_gravacao, null, 'marcada', p_inicio, coalesce(p_fim, p_inicio), true)
  returning id into nova_ocorrencia;

  return jsonb_build_object('gravacao_id', nova_gravacao, 'ocorrencia_id', nova_ocorrencia);
end;
$$;
revoke all on function public.calendario_marcar_gravacao(uuid, text, timestamptz, timestamptz, text, text) from public;
grant execute on function public.calendario_marcar_gravacao(uuid, text, timestamptz, timestamptz, text, text) to authenticated;
