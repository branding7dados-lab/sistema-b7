-- =========================================================================
-- CONTAGENS EM UMA SÓ IDA AO BANCO (Rodada z3 — causa raiz da lentidão)
--
-- O que achei nos LOGS DE VERDADE do Supabase (Logs → PostgREST): toda
-- vez que a Central de Produção ou o Dashboard abrem, o frontend disparava
-- de 10 a 18 consultas de CONTAGEM em paralelo (uma pra cada número dos
-- cartõezinhos). O projeto está no plano Free, cujo PostgREST sobe com
-- uma pool de só 10 conexões ("Connection Pool initialized with a
-- maximum size of 10 connections" — está no log). Com mais pedidos
-- chegando do que conexões disponíveis, o PostgREST enfileira, estoura o
-- tempo interno dele e mata a thread: "Warp server error: Thread killed
-- by timeout manager" — é exatamente aí que o pedido volta pro navegador
-- como 503. Isso bateu, nos logs, em vários horários diferentes, sempre
-- do mesmo jeito.
--
-- A correção de verdade não é só capturar o erro no frontend (isso eu já
-- fiz na Rodada z2, pra tela não quebrar) — é PARAR DE ABRIR 10+ conexões
-- de uma vez só pra pedir números. Esta migration junta cada grupo de
-- contagens numa ÚNICA consulta (um FILTER por número, tudo numa
-- passada só pela tabela), então cada tela passa a fazer 1 ida ao banco
-- em vez de 10 ou 7.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1) Central de Produção — antes 10 consultas (6 em gravacoes + 4 em
--    roteiros), agora 2 (uma por tabela, com todos os filtros de uma vez).
-- ---------------------------------------------------------------------
create or replace function public.painel_producao_contagens(
  p_de date default null, p_ate date default null, p_cliente_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe interna vê a Central de Produção.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'gravTotal',       count(*) filter (where situacao <> 'Cancelada'),
    'gravFeitas',      count(*) filter (where situacao = 'Gravada'),
    'gravFaltam',      count(*) filter (where situacao in ('Pendente', 'Agendada')),
    'gravAgendadas',   count(*) filter (where situacao = 'Agendada'),
    'gravSemData',     count(*) filter (where situacao = 'Pendente' and data_gravacao is null),
    'gravCanceladas',  count(*) filter (where situacao = 'Cancelada')
  ) into r
  from public.gravacoes
  where deleted_at is null and archived_at is null
    and (p_cliente_id is null or client_id = p_cliente_id)
    and (p_de is null or (data_gravacao >= p_de and data_gravacao <= p_ate));

  r := r || (
    select jsonb_build_object(
      'rotTotal',      count(*),
      'rotAndamento',  count(*) filter (where status in ('Em criação', 'Em revisão', 'Aprovado internamente')),
      'rotProntos',    count(*) filter (where status = 'Pronto para gravar'),
      'rotGravados',   count(*) filter (where status = 'Gravado')
    )
    from public.roteiros ro
    where ro.deleted_at is null and ro.archived_at is null
      and (p_cliente_id is null or exists (
            select 1 from public.gravacoes g2
            where g2.id = ro.recording_session_id and g2.client_id = p_cliente_id))
      and (p_de is null or (ro.created_at >= p_de and ro.created_at <= (p_ate::timestamptz + interval '1 day')))
  );

  return r;
end;
$$;
revoke all on function public.painel_producao_contagens(date, date, uuid) from public;
grant execute on function public.painel_producao_contagens(date, date, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2) Resumo do Dashboard — antes 7 consultas (clientes, gravacoes x4,
--    roteiros x2), agora 3 (uma por tabela envolvida).
-- ---------------------------------------------------------------------
create or replace function public.dashboard_resumo_contagens()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; inicio_mes timestamptz;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe interna vê o resumo do Dashboard.' using errcode = '42501';
  end if;
  inicio_mes := date_trunc('month', now());

  select jsonb_build_object('clientes', count(*)) into r
  from public.clientes where deleted_at is null;

  r := r || (
    select jsonb_build_object(
      'gravacoes', count(*),
      'rascunho',  count(*) filter (where status = 'Rascunho'),
      'pronto',    count(*) filter (where status = 'Pronto para gravar'),
      'gravado',   count(*) filter (where status = 'Gravado')
    )
    from public.gravacoes where deleted_at is null and archived_at is null
  );

  r := r || (
    select jsonb_build_object(
      'roteiros', count(*),
      'mes',      count(*) filter (where created_at >= inicio_mes)
    )
    from public.roteiros where deleted_at is null and archived_at is null
  );

  return r;
end;
$$;
revoke all on function public.dashboard_resumo_contagens() from public;
grant execute on function public.dashboard_resumo_contagens() to authenticated;
