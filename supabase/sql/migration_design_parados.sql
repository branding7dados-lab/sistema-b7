-- =====================================================================
-- Avisos de peça de Design PARADA (pacote 2026-10-02-n)
--
-- "Vence amanhã" e "atrasou" já existem (_design_alertas_prazo). O que
-- ninguém avisava era a peça que não tem prazo estourado mas está parada
-- esperando alguém: na revisão interna ou na mão do cliente.
--
-- Um aviso AGREGADO por dia útil, às 8h, só quando há algo:
--   • design.revisao_parada — peças em revisão interna há 3 dias ou mais
--     → coordenação (pref. "Aguardando revisão") e administradores que
--       ligaram "Revisões pendentes da agência".
--   • design.cliente_parado — peças aguardando o cliente há 3 dias ou mais
--     → coordenação (pref. "Decisões dos clientes").
-- Nunca um aviso por peça. Usa o resolvedor único notif_entregar.
-- Sem tabela, coluna ou policy nova.
-- =====================================================================

create or replace function public._design_alertas_parados()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  hoje date := public.notif_hoje();
  n_rev integer; dias_rev integer; n_cli integer; dias_cli integer; nomes_cli text;
  evid uuid; criados integer := 0;
begin
  if extract(isodow from hoje) > 5 then return 0; end if;   -- só dia útil

  select count(*), max(hoje - (coalesce(v.enviada_em, d.updated_at) at time zone 'America/Sao_Paulo')::date)
    into n_rev, dias_rev
    from public.design_deliverables d
    left join public.design_versoes v on v.deliverable_id = d.id and v.numero = d.versao_atual
   where d.deleted_at is null and d.status = 'revisao_interna'
     and (coalesce(v.enviada_em, d.updated_at) at time zone 'America/Sao_Paulo')::date <= hoje - 3;

  if n_rev > 0 then
    evid := null;
    insert into public.eventos_dominio (tipo, chave, alvo_tipo, payload, processado_em)
    values ('design.revisao_parada', 'design.revisao_parada:' || hoje::text, 'sistema',
            jsonb_build_object('pecas', n_rev, 'dias', dias_rev), now())
    on conflict (chave) do nothing
    returning id into evid;
    if evid is not null then
      criados := criados + public.notif_entregar(evid, 'design.revisao_parada', 'Design parado na revisão',
        n_rev || case when n_rev = 1 then ' peça aguardando' else ' peças aguardando' end ||
          ' revisão há 3 dias ou mais · a mais antiga, ' || public.notif_ha_dias(dias_rev) || '.',
        '#/design?aba=revisao&limpar=1', null, null, null,
        array['coordenador'], 'co_revisoes', 'adm_revisoes');
    end if;
  end if;

  with paradas as (
    select d.id, c.nome as cliente,
           hoje - (coalesce(
             (select max(a.enviado_em) from public.aprovacoes a
               where a.tipo = 'design_versao' and a.alvo_id = d.id and a.deleted_at is null and a.situacao = 'pendente'),
             d.updated_at) at time zone 'America/Sao_Paulo')::date as dias
      from public.design_deliverables d
      left join public.clientes c on c.id = d.client_id
     where d.deleted_at is null and d.status = 'aguardando_cliente'
  )
  select count(*), max(dias), string_agg(distinct cliente, ', ')
    into n_cli, dias_cli, nomes_cli
    from paradas where dias >= 3;

  if n_cli > 0 then
    evid := null;
    insert into public.eventos_dominio (tipo, chave, alvo_tipo, payload, processado_em)
    values ('design.cliente_parado', 'design.cliente_parado:' || hoje::text, 'sistema',
            jsonb_build_object('pecas', n_cli, 'dias', dias_cli), now())
    on conflict (chave) do nothing
    returning id into evid;
    if evid is not null then
      criados := criados + public.notif_entregar(evid, 'design.cliente_parado', 'Cliente sem resposta',
        n_cli || case when n_cli = 1 then ' peça aguardando' else ' peças aguardando' end ||
          ' o cliente há 3 dias ou mais' || coalesce(' · ' || public.notif_corta(nomes_cli, 90), '') || '.',
        '#/design?aba=aprovadas&limpar=1', null, null, null,
        array['coordenador'], 'co_aprovacoes', null);
    end if;
  end if;

  return criados;
end;
$function$;

revoke all on function public._design_alertas_parados() from public, anon, authenticated;

-- entra na rodada das 8h, junto do resumo diário
create or replace function public.notif_verificar_agendados()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare h integer := extract(hour from now() at time zone 'America/Sao_Paulo')::int;
begin
  if h < 8 or h > 19 then return; end if;
  perform public._video_alertas_prazo(null);
  perform public._design_alertas_prazo();
  if h = 8 then
    perform public._notif_resumo_diario();
    perform public._design_alertas_parados();
  end if;
end;
$function$;

-- categoria dos tipos novos (a mesma de quem já recebe revisão e decisão de cliente)
create or replace function public.notif_categoria(p_tipo text)
returns text
language sql
immutable
as $function$
  select case
    when p_tipo in ('video.atribuida', 'design.atribuida', 'gravacao.atribuida') then 'atribuicoes'
    when p_tipo = 'linha.concluida' then 'design_disponivel'
    when p_tipo in ('video.prazo_amanha', 'video.prazo_hoje', 'design.prazo_amanha', 'design.prazo_hoje') then 'prazos'
    when p_tipo in ('video.atrasado', 'design.atrasado') then 'atrasos'
    when p_tipo in ('video.correcao_solicitada', 'design.ajuste_solicitado', 'design.cliente_ajustes',
                    'design.cliente_recusado', 'linha.briefing_atualizado') then 'correcoes'
    when p_tipo in ('video.aprovado_cliente', 'design.aprovado_interno', 'design.finalizado',
                    'design.cliente_aprovado', 'design.cliente_pendente', 'design.cliente_parcial') then 'aprovacoes_meu'
    when p_tipo in ('gravacao.amanha', 'gravacao.hoje') then 'gravacoes_lembretes'
    when p_tipo in ('gravacao.remarcada', 'gravacao.cancelada') then 'gravacoes_mudancas'
    when p_tipo = 'roteiro.pronto' then 'roteiros_prontos'
    when p_tipo in ('video.aguardando_aprovacao', 'design.versao_enviada', 'design.revisao_parada') then 'revisao'
    when p_tipo like 'aprovacao.%' or p_tipo like 'parte.%' or p_tipo = 'design.cliente_parado' then 'aprovacoes_cliente'
    when p_tipo like 'publicacao.%' then 'publicacoes'
    when p_tipo in ('video.atrasado_escalado', 'design.atrasado_escalado') then 'escalados'
    when p_tipo in ('design.criada', 'design.demanda_assumida', 'video.entregue') then 'movimentacao'
    when p_tipo like 'agenda.%' then 'agenda'
    when p_tipo = 'resumo.diario' then 'resumo_diario'
    when p_tipo like 'teste.%' then 'sistema'
    else 'outros' end
$function$;
