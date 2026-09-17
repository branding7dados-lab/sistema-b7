-- =====================================================================
-- PARTE 2 DA AUDITORIA (17/09/2026): uma demanda de edição pode
-- referenciar VÁRIOS roteiros (não só um). demandas_edicao.roteiro_id
-- continua existindo (nada é removido, nenhum dado histórico é tocado
-- além do backfill abaixo, que na aplicação em produção não moveu
-- nenhuma linha real — 0 de 425 demandas tinham roteiro_id preenchido
-- antes desta migration) — ele passa a ser só "o primeiro roteiro
-- vinculado", mantido em sincronia pelas funções novas, para não
-- quebrar nada que já lia essa coluna direto. A fonte de verdade passa
-- a ser a tabela de junção demandas_edicao_roteiros.
--
-- Já aplicado em produção nesta rodada (Supabase MCP). Este arquivo
-- fica só para o histórico de migrations do repositório.
--
-- Regra de negócio preservada: já existia um índice único parcial
-- (demandas_edicao_roteiro_unico) garantindo que um roteiro só podia
-- estar em UMA demanda ativa por vez. Isso bate com o item 7 da
-- auditoria ("cada demanda pode ter vários roteiros, e uma gravação
-- pode gerar várias demandas, cada uma com um SUBCONJUNTO DIFERENTE de
-- roteiros") — só a demanda passou a poder ter mais de um roteiro, um
-- roteiro continua exclusivo de uma única demanda ativa por vez. A
-- função _video_checar_roteiros_disponiveis aplica essa mesma regra
-- pra tabela nova, com mensagem clara em vez de deixar o banco recusar
-- com um erro de índice pouco claro.
-- =====================================================================

create table if not exists public.demandas_edicao_roteiros (
  demanda_id uuid not null references public.demandas_edicao(id) on delete cascade,
  roteiro_id uuid not null references public.roteiros(id) on delete cascade,
  created_at timestamptz not null default now(),
  criado_por uuid references public.perfis(id),
  primary key (demanda_id, roteiro_id)
);

create index if not exists demandas_edicao_roteiros_roteiro_idx
  on public.demandas_edicao_roteiros (roteiro_id);

insert into public.demandas_edicao_roteiros (demanda_id, roteiro_id)
select de.id, de.roteiro_id
from public.demandas_edicao de
where de.roteiro_id is not null
on conflict (demanda_id, roteiro_id) do nothing;

alter table public.demandas_edicao_roteiros enable row level security;

create policy "demandas_edicao_roteiros select" on public.demandas_edicao_roteiros
  for select using (
    exists (
      select 1 from public.demandas_edicao de
      where de.id = demanda_id and de.deleted_at is null
        and (public.sou_equipe() or de.videomaker_id = auth.uid())
    ) and public.sou_equipe_interna()
  );

create or replace view public.demandas_edicao_resumo as
select
  de.id, de.client_id, de.gravacao_id, de.videomaker_id, de.competencia_ano, de.competencia_mes,
  de.codigo, de.titulo, de.pacote, de.prazo, de.link_material, de.editing_status, de.observacoes,
  de.origem, de.import_lote_id, de.criado_por, de.created_at, de.updated_at, de.entregue_em, de.deleted_at,
  cl.nome as cliente_nome, coalesce(cl.servico, 'ativo'::text) as cliente_servico,
  pf.nome as videomaker_nome, g.situacao as gravacao_situacao, g.nome as gravacao_nome,
  de.kanban_id, de.prioridade, de.roteiro_id, de.standby_revisar_em, cl.logo_url as cliente_logo_url,
  coalesce(rot.roteiros_vinculados, '[]'::jsonb) as roteiros_vinculados
from demandas_edicao de
left join clientes cl on cl.id = de.client_id
left join perfis pf on pf.id = de.videomaker_id
left join gravacoes g on g.id = de.gravacao_id
left join lateral (
  select jsonb_agg(jsonb_build_object('id', r.id, 'titulo', r.titulo) order by r.position, r.created_at) as roteiros_vinculados
  from public.demandas_edicao_roteiros der
  join public.roteiros r on r.id = der.roteiro_id and r.deleted_at is null
  where der.demanda_id = de.id
) rot on true
where de.deleted_at is null;

create or replace function public._video_checar_roteiros_disponiveis(p_ids uuid[], p_excluir_demanda uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare conflito record;
begin
  if p_ids is null or array_length(p_ids, 1) is null then return; end if;
  select r.titulo as roteiro_titulo, de.titulo as demanda_titulo into conflito
    from public.demandas_edicao_roteiros der
    join public.demandas_edicao de on de.id = der.demanda_id
    join public.roteiros r on r.id = der.roteiro_id
    where der.roteiro_id = any(p_ids)
      and (p_excluir_demanda is null or der.demanda_id <> p_excluir_demanda)
      and de.deleted_at is null and de.editing_status <> 'descartado'
    limit 1;
  if found then
    raise exception 'O roteiro "%" já está vinculado à demanda "%". Um roteiro só pode estar em uma demanda ativa por vez.',
      conflito.roteiro_titulo, conflito.demanda_titulo;
  end if;
end;
$$;
revoke all on function public._video_checar_roteiros_disponiveis(uuid[], uuid) from public;

create or replace function public.video_definir_roteiros(p_demanda_id uuid, p_roteiro_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare d public.demandas_edicao%rowtype; ids uuid[]; primeiro uuid;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe altera os roteiros vinculados.' using errcode = '42501';
  end if;
  select * into d from public.demandas_edicao where id = p_demanda_id and deleted_at is null;
  if not found then raise exception 'Demanda não encontrada.'; end if;

  select coalesce(array_agg(distinct r.id), '{}') into ids
  from public.roteiros r where r.id = any(coalesce(p_roteiro_ids, '{}')) and r.deleted_at is null;

  perform public._video_checar_roteiros_disponiveis(ids, p_demanda_id);

  delete from public.demandas_edicao_roteiros where demanda_id = p_demanda_id and roteiro_id <> all(ids);
  insert into public.demandas_edicao_roteiros (demanda_id, roteiro_id, criado_por)
  select p_demanda_id, rid, auth.uid() from unnest(ids) as rid
  on conflict (demanda_id, roteiro_id) do nothing;

  select (array_agg(r.id order by r.position))[1] into primeiro
    from public.roteiros r where r.id = any(ids);
  update public.demandas_edicao set roteiro_id = primeiro, updated_at = now() where id = p_demanda_id;
end;
$$;
revoke all on function public.video_definir_roteiros(uuid, uuid[]) from public;
grant execute on function public.video_definir_roteiros(uuid, uuid[]) to authenticated;

create or replace function public.video_criar_demanda(
  p_client_id uuid, p_titulo text, p_codigo text default '',
  p_competencia_ano integer default null, p_competencia_mes integer default null,
  p_gravacao_id uuid default null, p_videomaker_id uuid default null,
  p_pacote text default '', p_prazo date default null, p_observacoes text default '',
  p_prioridade text default 'normal', p_roteiro_id uuid default null,
  p_roteiro_ids uuid[] default null
)
returns uuid language plpgsql security definer set search_path = public as $$
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

  insert into public.demandas_edicao
    (client_id, gravacao_id, videomaker_id, competencia_ano, competencia_mes, codigo, titulo,
     pacote, prazo, observacoes, origem, criado_por, roteiro_id,
     editing_status, prioridade)
  values
    (p_client_id, p_gravacao_id, p_videomaker_id, ano, mes, coalesce(p_codigo, ''), p_titulo,
     coalesce(p_pacote, ''), p_prazo, coalesce(p_observacoes, ''), 'manual', auth.uid(), primeiro,
     case when p_videomaker_id is not null then 'em_edicao' else 'pendente' end, prio)
  returning id into novo;

  if array_length(ids, 1) > 0 then
    insert into public.demandas_edicao_roteiros (demanda_id, roteiro_id, criado_por)
    select novo, rid, auth.uid() from unnest(ids) as rid
    on conflict (demanda_id, roteiro_id) do nothing;
  end if;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, para_status, ator_id, ator_nome, ator_papel, mensagem)
  values (novo, 'criada', 'pendente', auth.uid(), ator.nome, ator.papel, null);

  if p_videomaker_id is not null then
    insert into public.demandas_edicao_eventos (demanda_id, tipo, de_status, para_status, ator_id, ator_nome, ator_papel, mensagem)
    values (novo, 'status', 'pendente', 'em_edicao', auth.uid(), ator.nome, ator.papel, null);
  end if;

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
revoke all on function public.video_criar_demanda(uuid, text, text, integer, integer, uuid, uuid, text, date, text, text, uuid, uuid[]) from public;
grant execute on function public.video_criar_demanda(uuid, text, text, integer, integer, uuid, uuid, text, date, text, text, uuid, uuid[]) to authenticated;

-- =====================================================================
-- video_gerar_demanda_agrupada: como o gerador em lote já existente
-- (video_gerar_demandas_de_gravacao, que continua criando 1 demanda
-- por roteiro marcado — caso já usado e válido), mas para o caso novo
-- do item 7 da auditoria: juntar VÁRIOS roteiros marcados numa ÚNICA
-- demanda. Fica como função separada em vez de mudar o comportamento
-- da existente, pra não quebrar quem já depende do "1 por roteiro".
-- =====================================================================
create or replace function public.video_gerar_demanda_agrupada(
  p_gravacao_id uuid, p_roteiro_ids uuid[], p_titulo text default null,
  p_videomaker_id uuid default null, p_prazo date default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare g public.gravacoes%rowtype; ids uuid[]; titulo_final text; nova uuid;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe gera demandas de edição.' using errcode = '42501';
  end if;
  select * into g from public.gravacoes where id = p_gravacao_id and deleted_at is null;
  if not found then raise exception 'Gravação não encontrada.'; end if;

  select coalesce(array_agg(distinct r.id), '{}') into ids
    from public.roteiros r
    where r.id = any(coalesce(p_roteiro_ids, '{}')) and r.recording_session_id = p_gravacao_id and r.deleted_at is null;
  if array_length(ids, 1) is null or array_length(ids, 1) = 0 then
    raise exception 'Selecione ao menos um roteiro desta gravação.';
  end if;

  titulo_final := coalesce(nullif(btrim(p_titulo), ''), g.nome);

  nova := public.video_criar_demanda(
    g.client_id, titulo_final, '',
    extract(year from coalesce(p_prazo, g.data_gravacao, now()))::int,
    extract(month from coalesce(p_prazo, g.data_gravacao, now()))::int,
    p_gravacao_id, p_videomaker_id, '', p_prazo, '',
    p_roteiro_id => null, p_roteiro_ids => ids
  );
  return nova;
end;
$$;
revoke all on function public.video_gerar_demanda_agrupada(uuid, uuid[], text, uuid, date) from public;
grant execute on function public.video_gerar_demanda_agrupada(uuid, uuid[], text, uuid, date) to authenticated;
