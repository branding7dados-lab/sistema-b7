-- =====================================================================
-- VÍDEO — atribuir não inicia a edição (pacote 2026-10-01-y)
--
-- Antes: atribuir uma demanda a um videomaker (na criação ou depois) já
-- a colocava em "Em edição", mesmo sem a pessoa ter visto.
-- Agora: a demanda atribuída fica em "Pendente". O videomaker é avisado
-- ("Demanda de vídeo atribuída a você") e é ELE quem muda para
-- "Em edição" quando começar — a situação passa a dizer a verdade.
--
-- O que acompanha a mudança:
--   • o card no Kanban geral continua nascendo quando a edição começa de
--     verdade (video_mudar_status já fazia isso); atribuir não cria card;
--   • o histórico da demanda deixa de registrar um "mudou para Em edição"
--     que ninguém fez.
-- Demandas já existentes não são alteradas.
-- Rodar no SQL Editor do Supabase. Pode rodar de novo sem efeito colateral.
-- =====================================================================

create or replace function public.video_atribuir(p_demanda_id uuid, p_videomaker_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare d public.demandas_edicao%rowtype; ator public.perfis%rowtype; vm public.perfis%rowtype; evid uuid;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe atribui um videomaker.' using errcode = '42501';
  end if;
  select * into d from public.demandas_edicao where id = p_demanda_id and deleted_at is null;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  if p_videomaker_id is not null then
    if not public.eh_videomaker_elegivel(p_videomaker_id) then
      raise exception 'Esse usuário não é um videomaker ativo.';
    end if;
    select * into vm from public.perfis where id = p_videomaker_id;
  end if;
  select * into ator from public.perfis where id = auth.uid();

  /* só o responsável muda: a situação fica como está (uma demanda
     pendente continua pendente até o videomaker começar) */
  update public.demandas_edicao
     set videomaker_id = p_videomaker_id, updated_at = now()
   where id = p_demanda_id;

  if d.kanban_id is not null then
    update public.kanban_demandas set responsavel_id = p_videomaker_id, updated_at = now() where id = d.kanban_id;
  end if;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, ator_id, ator_nome, ator_papel, mensagem)
  values (p_demanda_id, 'atribuida', auth.uid(), ator.nome, ator.papel,
          case when p_videomaker_id is null then 'Atribuição removida' else null end);

  if p_videomaker_id is not null then
    insert into public.eventos_dominio (id, tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    values (gen_random_uuid(), 'video.atribuida', 'video.atribuida:' || p_demanda_id || ':' || now()::text,
            'demanda_edicao', p_demanda_id, d.client_id, auth.uid(), ator.nome, ator.papel,
            jsonb_build_object('videomaker_id', p_videomaker_id, 'videomaker_nome', vm.nome, 'titulo', d.titulo))
    returning id into evid;
    perform public.video_processar_evento(evid);
  end if;
end;
$$;

create or replace function public.video_criar_demanda(p_client_id uuid, p_titulo text, p_codigo text default ''::text, p_competencia_ano integer default null::integer, p_competencia_mes integer default null::integer, p_gravacao_id uuid default null::uuid, p_videomaker_id uuid default null::uuid, p_pacote text default ''::text, p_prazo date default null::date, p_observacoes text default ''::text, p_prioridade text default 'normal'::text, p_roteiro_id uuid default null::uuid, p_roteiro_ids uuid[] default null::uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare novo uuid; ator public.perfis%rowtype; vm public.perfis%rowtype; ano int; mes int; prio text;
  ids uuid[]; primeiro uuid;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe cria demandas de edição.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_titulo), '') = '' then
    raise exception 'Toda demanda de edição precisa de um título.';
  end if;
  if p_client_id is null or not exists (select 1 from public.clientes where id = p_client_id) then
    raise exception 'Cliente inválido.';
  end if;
  if p_videomaker_id is not null and not public.eh_videomaker_elegivel(p_videomaker_id) then
    raise exception 'Esse usuário não é um videomaker ativo.';
  end if;
  prio := case when p_prioridade in ('normal', 'alta', 'urgente') then p_prioridade else 'normal' end;
  select * into ator from public.perfis where id = auth.uid();
  if p_videomaker_id is not null then
    select * into vm from public.perfis where id = p_videomaker_id;
  end if;
  ano := coalesce(p_competencia_ano, extract(year from now())::int);
  mes := coalesce(p_competencia_mes, extract(month from now())::int);

  if p_roteiro_ids is not null and array_length(p_roteiro_ids, 1) > 0 then
    select coalesce(array_agg(distinct r.id), '{}') into ids
      from public.roteiros r where r.id = any(p_roteiro_ids) and r.deleted_at is null;
  elsif p_roteiro_id is not null then
    ids := array[p_roteiro_id];
  else
    ids := '{}';
  end if;

  perform public._video_checar_roteiros_disponiveis(ids, null);

  primeiro := case when array_length(ids, 1) > 0 then ids[1] else null end;

  /* nasce pendente, com ou sem videomaker: quem começa a edição é ele */
  insert into public.demandas_edicao
    (client_id, gravacao_id, videomaker_id, competencia_ano, competencia_mes, codigo, titulo,
     pacote, prazo, observacoes, origem, criado_por, roteiro_id,
     editing_status, prioridade)
  values
    (p_client_id, p_gravacao_id, p_videomaker_id, ano, mes, coalesce(p_codigo, ''), p_titulo,
     coalesce(p_pacote, ''), p_prazo, coalesce(p_observacoes, ''), 'manual', auth.uid(), primeiro,
     'pendente', prio)
  returning id into novo;

  if array_length(ids, 1) > 0 then
    insert into public.demandas_edicao_roteiros (demanda_id, roteiro_id, criado_por)
    select novo, rid, auth.uid() from unnest(ids) as rid
    on conflict (demanda_id, roteiro_id) do nothing;
  end if;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, para_status, ator_id, ator_nome, ator_papel, mensagem)
  values (novo, 'criada', 'pendente', auth.uid(), ator.nome, ator.papel, null);

  if p_videomaker_id is not null then
    insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    values ('video.atribuida', 'video.atribuida:' || novo || ':' || now()::text, 'demanda_edicao', novo, p_client_id,
            auth.uid(), ator.nome, ator.papel,
            jsonb_build_object('videomaker_id', p_videomaker_id, 'videomaker_nome', vm.nome, 'titulo', p_titulo));
    perform public.video_processar_evento((select id from public.eventos_dominio
      where chave = 'video.atribuida:' || novo || ':' || now()::text order by created_at desc limit 1));
  end if;

  return novo;
end;
$$;
