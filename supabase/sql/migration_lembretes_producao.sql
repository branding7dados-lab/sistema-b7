-- =====================================================================
-- LEMBRETES DA PRODUÇÃO (zzz3)
-- Completa o que já existia: lembrete da agenda (24h/1h), prazos de vídeo
-- e design, resumo diário e peça de design parada. Os três buracos que
-- sobravam, todos às 8h, agregados e sem duplicar no mesmo dia:
--
--  1. gravacao.roteiros_pendentes — gravação AMANHÃ com roteiro ainda não
--     pronto (ou sem roteiro). Um aviso por gravação. Vai para o
--     videomaker da gravação ("Lembretes de gravação"), a coordenação
--     ("Andamento da produção") e o admin que acompanha atrasos.
--  2. gravacao.sem_conclusao — gravação cuja data já passou e continua
--     Agendada/Pendente (ninguém marcou como gravada nem cancelou). Um
--     aviso por dia útil com a contagem. Coordenação + admin (atrasos).
--  3. conteudo.revisao_parada — conteúdo de linha editorial "Em revisão"
--     há 3 dias ou mais. Um aviso por dia útil. Coordenação ("Aguardando
--     revisão") + admin que ligou "Revisões pendentes".
--
-- Nenhuma tabela, coluna, policy ou agendamento novo: roda dentro de
-- notif_verificar_agendados() (cron notif-agendados), na rodada das 8h.
-- =====================================================================

create or replace function public._producao_alertas_lembretes()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  hoje date := public.notif_hoje();
  r record; evid uuid; criados integer := 0;
  n integer; dias integer;
begin
  /* 1. gravação amanhã com roteiro em aberto — todo dia (gravação de
        sábado também precisa do aviso na sexta) */
  for r in
    with g as (
      select g.id, g.nome, g.client_id, g.videomaker_id,
             coalesce((select (o.inicio at time zone 'America/Sao_Paulo')::date
                         from public.gravacoes_ocorrencias o
                        where o.gravacao_id = g.id and o.atual and o.status = 'marcada'
                        limit 1), g.data_gravacao) as dia
        from public.gravacoes g
       where g.deleted_at is null and g.archived_at is null
         and coalesce(g.situacao, '') not in ('Gravada', 'Cancelada')
    )
    select g.*, c.nome as cliente,
           (select count(*) from public.roteiros t where t.recording_session_id = g.id and t.deleted_at is null) as total,
           (select count(*) from public.roteiros t where t.recording_session_id = g.id and t.deleted_at is null
               and coalesce(t.status, '') not in ('Pronto para gravar', 'Gravado')) as abertos
      from g left join public.clientes c on c.id = g.client_id
     where g.dia = hoje + 1
  loop
    continue when r.total > 0 and r.abertos = 0;
    evid := null;
    insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, payload, processado_em)
    values ('gravacao.roteiros_pendentes', 'gravacao.roteiros_pendentes:' || r.id || ':' || r.dia, 'gravacao', r.id,
            jsonb_build_object('total', r.total, 'abertos', r.abertos), now())
    on conflict (chave) do nothing
    returning id into evid;
    if evid is not null then
      criados := criados + public.notif_entregar(evid, 'gravacao.roteiros_pendentes',
        'Gravação amanhã com roteiro em aberto',
        public.notif_corta(coalesce(nullif(r.nome, ''), 'Gravação'), 60) || ' · ' ||
          case when r.total = 0 then 'nenhum roteiro cadastrado'
               when r.abertos = 1 then '1 de ' || r.total || ' roteiros ainda não está pronto'
               else r.abertos || ' de ' || r.total || ' roteiros ainda não estão prontos' end || '.',
        '#/gravacao/' || r.id, r.client_id,
        case when r.videomaker_id is null then null else array[r.videomaker_id] end, 'grav_lembretes',
        array['coordenador'], 'co_producao', 'adm_atrasos');
    end if;
  end loop;

  if extract(isodow from hoje) > 5 then return criados; end if;   -- o resto, só dia útil

  /* 2. gravação que já passou e não foi concluída nem cancelada */
  with g as (
    select coalesce((select (o.inicio at time zone 'America/Sao_Paulo')::date
                       from public.gravacoes_ocorrencias o
                      where o.gravacao_id = g.id and o.atual and o.status = 'marcada'
                      limit 1), g.data_gravacao) as dia
      from public.gravacoes g
     where g.deleted_at is null and g.archived_at is null
       and coalesce(g.situacao, '') in ('Agendada', 'Pendente')
  )
  select count(*), max(hoje - dia) into n, dias from g where dia < hoje;

  if n > 0 then
    evid := null;
    insert into public.eventos_dominio (tipo, chave, alvo_tipo, payload, processado_em)
    values ('gravacao.sem_conclusao', 'gravacao.sem_conclusao:' || hoje::text, 'sistema',
            jsonb_build_object('gravacoes', n, 'dias', dias), now())
    on conflict (chave) do nothing
    returning id into evid;
    if evid is not null then
      criados := criados + public.notif_entregar(evid, 'gravacao.sem_conclusao', 'Gravação sem conclusão',
        n || case when n = 1 then ' gravação já passou e não foi marcada' else ' gravações já passaram e não foram marcadas' end ||
          ' como gravada ou cancelada · a mais antiga, ' || public.notif_ha_dias(dias) || '.',
        '#/gravacoes', null, null, null,
        array['coordenador'], 'co_producao', 'adm_atrasos');
    end if;
  end if;

  /* 3. conteúdo parado em revisão */
  select count(*), max(hoje - (c.updated_at at time zone 'America/Sao_Paulo')::date) into n, dias
    from public.conteudos c
   where c.deleted_at is null and c.archived_at is null and c.status = 'Em revisão'
     and (c.updated_at at time zone 'America/Sao_Paulo')::date <= hoje - 3;

  if n > 0 then
    evid := null;
    insert into public.eventos_dominio (tipo, chave, alvo_tipo, payload, processado_em)
    values ('conteudo.revisao_parada', 'conteudo.revisao_parada:' || hoje::text, 'sistema',
            jsonb_build_object('conteudos', n, 'dias', dias), now())
    on conflict (chave) do nothing
    returning id into evid;
    if evid is not null then
      criados := criados + public.notif_entregar(evid, 'conteudo.revisao_parada', 'Conteúdo parado na revisão',
        n || case when n = 1 then ' conteúdo aguardando' else ' conteúdos aguardando' end ||
          ' revisão há 3 dias ou mais · o mais antigo, ' || public.notif_ha_dias(dias) || '.',
        '#/linhas', null, null, null,
        array['coordenador'], 'co_revisoes', 'adm_revisoes');
    end if;
  end if;

  return criados;
end;
$function$;

revoke all on function public._producao_alertas_lembretes() from public, anon, authenticated;

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
    perform public._producao_alertas_lembretes();
  end if;
end;
$function$;

create or replace function public.notif_categoria(p_tipo text)
 returns text
 language sql
 immutable
 set search_path to 'public'
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
    when p_tipo in ('gravacao.amanha', 'gravacao.hoje', 'gravacao.roteiros_pendentes') then 'gravacoes_lembretes'
    when p_tipo in ('gravacao.remarcada', 'gravacao.cancelada') then 'gravacoes_mudancas'
    when p_tipo = 'roteiro.pronto' then 'roteiros_prontos'
    when p_tipo in ('video.aguardando_aprovacao', 'design.versao_enviada', 'design.revisao_parada',
                    'conteudo.revisao_parada') then 'revisao'
    when p_tipo like 'aprovacao.%' or p_tipo like 'parte.%' or p_tipo = 'design.cliente_parado' then 'aprovacoes_cliente'
    when p_tipo like 'publicacao.%' then 'publicacoes'
    when p_tipo in ('video.atrasado_escalado', 'design.atrasado_escalado', 'gravacao.sem_conclusao') then 'escalados'
    when p_tipo in ('design.criada', 'design.demanda_assumida', 'video.entregue') then 'movimentacao'
    when p_tipo like 'agenda.%' then 'agenda'
    when p_tipo = 'resumo.diario' then 'resumo_diario'
    when p_tipo like 'teste.%' then 'sistema'
    else 'outros' end
$function$;
