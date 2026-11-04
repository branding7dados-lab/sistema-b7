-- =====================================================================
-- 4.6.0 — NINGUÉM FICA SEM SABER
--  1) Vídeo sem responsável há mais de 1 dia: um aviso por dia útil (8h)
--     para a coordenação, com a sugestão de quem tem a menor fila.
--  2) Gravação sem data há mais de 3 dias: um aviso (uma vez por
--     gravação) para quem grava, ou para a coordenação.
-- =====================================================================
create or replace function public._video_sem_dono_avisar()
returns integer language plpgsql security definer set search_path = public as $$
declare hoje date := public.notif_hoje(); ev uuid; qtd int; titulos text; sug record;
begin
  if extract(isodow from hoje) > 5 then return 0; end if;
  select count(*)::int,
         string_agg('"' || left(d.titulo, 45) || '"' || coalesce(' (' || c.nome || ')', ''), ' · ' order by d.created_at) filter (where d.rn <= 3)
    into qtd, titulos
    from (select d.*, row_number() over (order by d.created_at) rn from public.demandas_edicao d
           where d.deleted_at is null and d.videomaker_id is null
             and d.editing_status not in ('entregue', 'descartado') and d.created_at < now() - interval '1 day') d
    left join public.clientes c on c.id = d.client_id;
  if coalesce(qtd, 0) = 0 then return 0; end if;
  /* sugestão: quem está ativo e tem a menor fila aberta */
  select v.nome, count(d.id)::int fila into sug
    from public.videomakers_elegiveis v
    left join public.demandas_edicao d on d.videomaker_id = v.id and d.deleted_at is null and d.editing_status not in ('entregue', 'descartado')
   where coalesce(v.estado, 'ativa') = 'ativa'
   group by v.id, v.nome order by count(d.id), v.nome limit 1;
  begin
    insert into public.eventos_dominio (tipo, chave, alvo_tipo, payload, processado_em)
    values ('video.sem_dono', 'video.sem_dono:' || hoje, 'resumo', jsonb_build_object('qtd', qtd), now())
    returning id into ev;
    perform public.notif_entregar(ev, 'video.sem_dono',
      case when qtd = 1 then '1 vídeo sem responsável' else qtd || ' vídeos sem responsável' end,
      left(titulos || case when qtd > 3 then ' e mais ' || (qtd - 3) else '' end || '.'
        || case when sug.nome is not null then ' Quem tem a menor fila agora: ' || sug.nome || ' (' || sug.fila || ').' else '' end, 300),
      '#/video', null, null, null, array['coordenador'], 'co_escalados', 'adm_atrasos', null, jsonb_build_object('qtd', qtd));
    return 1;
  exception when unique_violation then return 0;
  end;
end $$;

create or replace function public._gravacoes_sem_data_avisar()
returns integer language plpgsql security definer set search_path = public as $$
declare hoje date := public.notif_hoje(); r record; ev uuid; n int := 0; quem uuid[];
begin
  if extract(isodow from hoje) > 5 then return 0; end if;
  for r in
    select g.id, g.nome, g.client_id, c.nome cliente, public.gravacao_videomakers(g) vms, (hoje - g.created_at::date) dias
      from public.gravacoes g left join public.clientes c on c.id = g.client_id
     where g.deleted_at is null and g.archived_at is null and g.data_gravacao is null
       and coalesce(g.situacao, '') <> 'Cancelada' and g.created_at < now() - interval '3 days'
  loop
    begin
      insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, payload, processado_em)
      values ('gravacao.sem_data', 'gravacao.sem_data:' || r.id, 'gravacao', r.id, jsonb_build_object('dias', r.dias), now())
      returning id into ev;
      quem := nullif(r.vms, '{}');
      perform public.notif_entregar(ev, 'gravacao.sem_data',
        'Falta marcar a data: ' || coalesce(r.cliente || ' · ', '') || coalesce(r.nome, 'gravação'),
        'Esta gravação foi criada há ' || r.dias || ' dias e ainda não tem data, então não aparece no calendário. Abra e marque a data.',
        '#/gravacao/' || r.id, r.client_id, quem, 'prazos',
        case when quem is null then array['coordenador'] end, case when quem is null then 'co_escalados' end);
      n := n + 1;
    exception when unique_violation then null;
    end;
  end loop;
  return n;
end $$;
revoke execute on function public._video_sem_dono_avisar() from public, anon, authenticated;
revoke execute on function public._gravacoes_sem_data_avisar() from public, anon, authenticated;

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
    perform public._gravacoes_confirmar_avisar();
    perform public._gravacoes_canceladas_arquivar();
    perform public._video_sem_dono_avisar();
    perform public._gravacoes_sem_data_avisar();
  end if;
  if h = 9 then perform public._prazos_risco_avisar(); end if;
  if h = 10 then perform public._aprov_lembrar_clientes(); perform public._projetos_lembrar_material(); end if;
end $function$;
