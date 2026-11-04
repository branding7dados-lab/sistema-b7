-- v3.3.0 — Aviso de TRABALHO PARADO na mão de quem faz
--
-- Já existiam: "vence amanhã/atrasou" e as peças paradas na revisão interna
-- ou no cliente (_design_alertas_parados). Faltava o caso mais comum no
-- levantamento da Gestão → Equipe (20 peças de design paradas há 11 dias):
-- o trabalho que está com a pessoa e ninguém mexe há dias.
--
-- Todo dia útil às 8h, só quando há algo:
--   • trabalho.parado — para CADA pessoa: "N trabalhos parados há X dias"
--     (vídeo pendente/em edição/correção e design aguardando produção/em
--     criação/ajustes), com até 3 títulos. Um aviso por pessoa por dia.
--   • trabalho.parado_resumo — para a coordenação (e administradores que
--     ligaram atrasos): total e quem está com mais coisa parada.
-- "Parado" = sem nenhuma mudança (updated_at) há 5 dias ou mais.
-- Sem tabela nova. Usa o resolvedor de sempre (notif_entregar).

create or replace function public.trabalho_parado(p_dias int default 5)
returns table (pid uuid, nome text, tipo text, id uuid, titulo text, cliente text, dias int, link text)
language sql stable security definer set search_path to 'public' as $$
  with hoje as (select public.notif_hoje() dia)
  select d.videomaker_id, p.nome, 'video', d.id, coalesce(nullif(d.titulo, ''), d.codigo, 'Vídeo'), c.nome,
         ((select dia from hoje) - (d.updated_at at time zone 'America/Sao_Paulo')::date)::int, '#/video/' || d.id
    from public.demandas_edicao d
    join public.perfis p on p.id = d.videomaker_id and p.estado = 'ativa'
    left join public.clientes c on c.id = d.client_id
   where d.deleted_at is null and d.editing_status in ('pendente', 'em_edicao', 'correcao')
     and coalesce(c.teste, false) = false
     and (d.updated_at at time zone 'America/Sao_Paulo')::date <= (select dia from hoje) - p_dias
  union all
  select g.designer_id, p.nome, 'design', g.id, coalesce(nullif(g.titulo, ''), 'Peça'), c.nome,
         ((select dia from hoje) - (g.updated_at at time zone 'America/Sao_Paulo')::date)::int, '#/design/' || g.id
    from public.design_deliverables g
    join public.perfis p on p.id = g.designer_id and p.estado = 'ativa'
    left join public.clientes c on c.id = g.client_id
   where g.deleted_at is null and g.status in ('aguardando_producao', 'em_criacao', 'ajustes', 'ajustes_cliente')
     and coalesce(c.teste, false) = false
     and (g.updated_at at time zone 'America/Sao_Paulo')::date <= (select dia from hoje) - p_dias
$$;
revoke all on function public.trabalho_parado(int) from public, anon, authenticated;

create or replace function public._trabalho_parado_avisar()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  hoje date := public.notif_hoje(); r record; ev uuid; n int := 0; tot int; lista text; pessoas int;
begin
  if extract(isodow from hoje) > 5 then return 0; end if;   -- só dia útil

  for r in
    select pid, max(nome) nome, count(*)::int qtd, max(dias) maior,
           string_agg('"' || left(titulo, 50) || '"' || coalesce(' (' || cliente || ')', ''), ' · ' order by dias desc) filter (where rn <= 3) titulos
      from (select t.*, row_number() over (partition by t.pid order by t.dias desc) rn from public.trabalho_parado(5) t) x
     group by pid
  loop
    begin
      insert into public.eventos_dominio (tipo, chave, alvo_tipo, payload, processado_em)
      values ('trabalho.parado', 'trabalho.parado:' || r.pid || ':' || hoje, 'pessoa', jsonb_build_object('qtd', r.qtd), now())
      returning id into ev;
      perform public.notif_entregar(ev, 'trabalho.parado',
        case when r.qtd = 1 then '1 trabalho parado há ' || r.maior || ' dias' else r.qtd || ' trabalhos parados (até ' || r.maior || ' dias)' end,
        left(r.titulos || case when r.qtd > 3 then ' e mais ' || (r.qtd - 3) else '' end || '. Se travou em algo, avise a coordenação.', 300),
        '#/painel', null, array[r.pid], 'prazos');
      n := n + 1;
    exception when unique_violation then null;
    end;
  end loop;

  select count(*), count(distinct pid) into tot, pessoas from public.trabalho_parado(5);
  if tot > 0 then
    select string_agg(x.nome || ' ' || x.qtd, ' · ' order by x.qtd desc) into lista
      from (select max(nome) nome, count(*) qtd from public.trabalho_parado(5) group by pid order by count(*) desc limit 4) x;
    begin
      insert into public.eventos_dominio (tipo, chave, alvo_tipo, payload, processado_em)
      values ('trabalho.parado_resumo', 'trabalho.parado_resumo:' || hoje, 'resumo', jsonb_build_object('total', tot), now())
      returning id into ev;
      perform public.notif_entregar(ev, 'trabalho.parado_resumo',
        case when tot = 1 then '1 trabalho parado há 5+ dias' else tot || ' trabalhos parados há 5+ dias' end,
        left('Com ' || pessoas || case when pessoas = 1 then ' pessoa: ' else ' pessoas: ' end || lista || '. Veja em Gestão → Equipe.', 300),
        '#/gestao?aba=equipe', null, null, null, array['coordenador'], 'co_escalados', 'adm_atrasos', null, jsonb_build_object('total', tot));
      n := n + 1;
    exception when unique_violation then null;
    end;
  end if;
  return n;
end $$;
revoke all on function public._trabalho_parado_avisar() from public, anon, authenticated;

-- entra no relógio das 8h
create or replace function public.notif_verificar_agendados()
returns void language plpgsql security definer set search_path to 'public' as $function$
declare h integer := extract(hour from now() at time zone 'America/Sao_Paulo')::int;
begin
  if h < 8 or h > 19 then return; end if;
  perform public._video_alertas_prazo(null);
  perform public._design_alertas_prazo();
  if h = 8 then
    perform public._notif_resumo_diario();
    perform public._design_alertas_parados();
    perform public._producao_alertas_lembretes();
    perform public._oportunidades_aviso_do_dia();
    perform public._trabalho_parado_avisar();
  end if;
  if h = 9 then perform public._prazos_risco_avisar(); end if;
  if h = 10 then perform public._aprov_lembrar_clientes(); perform public._projetos_lembrar_material(); end if;
end $function$;

-- categoria (para "Notificações" nas Configurações e o horário de silêncio)
create or replace function public.notif_categoria(p_tipo text)
returns text language sql immutable set search_path to 'public' as $function$
  select case
    when p_tipo in ('video.atribuida', 'design.atribuida', 'gravacao.atribuida') then 'atribuicoes'
    when p_tipo = 'linha.concluida' then 'design_disponivel'
    when p_tipo in ('video.prazo_amanha', 'video.prazo_hoje', 'design.prazo_amanha', 'design.prazo_hoje', 'trabalho.parado', 'video.prioridade') then 'prazos'
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
    when p_tipo in ('video.atrasado_escalado', 'design.atrasado_escalado', 'gravacao.sem_conclusao', 'trabalho.parado_resumo') then 'escalados'
    when p_tipo in ('design.criada', 'design.demanda_assumida', 'video.entregue') then 'movimentacao'
    when p_tipo like 'agenda.%' then 'agenda'
    when p_tipo = 'resumo.diario' then 'resumo_diario'
    when p_tipo like 'teste.%' then 'sistema'
    else 'outros' end
$function$;
