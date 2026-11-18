-- 4.80.5: remarcar uma gravação já concluída (regravar ou "concluída" por engano).
-- A ocorrência concluída fica no histórico como estava (status 'concluida', atual = false); nasce uma nova marcada.
create or replace function public.gravacao_agendar(p_gravacao_id uuid, p_data date, p_hora_inicio time without time zone default null, p_hora_fim time without time zone default null, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare g public.gravacoes%rowtype; o public.gravacoes_ocorrencias%rowtype; ini timestamptz; fim timestamptz; nova uuid; sem boolean;
begin
  perform public.exigir_nivel('gravacoes', 2);
  if not public.pode_acao('gravacao.agendar') then raise exception 'Só admin/coordenador marcam ou remarcam gravações.' using errcode = '42501'; end if;
  if p_data is null then raise exception 'Escolha a data da gravação.'; end if;
  select * into g from public.gravacoes where id = p_gravacao_id and deleted_at is null;
  if not found then raise exception 'Gravação não encontrada.'; end if;
  sem := p_hora_inicio is null;
  ini := (p_data + coalesce(p_hora_inicio, time '12:00')) at time zone 'America/Sao_Paulo';
  fim := case when p_hora_fim is null or sem then ini else (p_data + p_hora_fim) at time zone 'America/Sao_Paulo' end;
  if fim < ini then raise exception 'O horário de fim não pode ser antes do início.'; end if;

  select * into o from public.gravacoes_ocorrencias where gravacao_id = g.id and atual;
  if not found then
    insert into public.gravacoes_ocorrencias (gravacao_id, status, inicio, fim, atual, criado_por, sem_horario)
    values (g.id, 'marcada', ini, fim, true, auth.uid(), sem) returning id into nova;
    return jsonb_build_object('ocorrencia_id', nova, 'evento_id', null, 'remarcacao', false);
  end if;
  if o.inicio = ini and o.fim is not distinct from fim and o.sem_horario = sem and o.status = 'marcada' then
    return jsonb_build_object('ocorrencia_id', o.id, 'evento_id', o.evento_id, 'remarcacao', false, 'sem_mudanca', true);
  end if;
  update public.gravacoes_ocorrencias
     set status = case when status in ('cancelada', 'concluida') then status else 'remarcada' end, atual = false, atualizado_em = now()
   where id = o.id;
  if o.status = 'concluida' then
    update public.gravacoes set concluida_em = null, concluida_por = null where id = g.id;
  end if;
  insert into public.gravacoes_ocorrencias (gravacao_id, evento_id, status, inicio, fim, atual, ocorrencia_anterior_id, criado_por, sem_horario)
  values (g.id, o.evento_id, 'marcada', ini, fim, true, o.id, auth.uid(), sem) returning id into nova;
  if coalesce(btrim(p_motivo), '') <> '' then
    update public.gravacao_historico set dados = dados || jsonb_build_object('motivo', btrim(p_motivo))
     where id = (select id from public.gravacao_historico where gravacao_id = g.id and tipo = 'remarcada' order by criado_em desc limit 1);
  end if;
  return jsonb_build_object('ocorrencia_id', nova, 'evento_id', o.evento_id, 'remarcacao', true, 'reaberta', o.status = 'concluida');
end;
$function$;
