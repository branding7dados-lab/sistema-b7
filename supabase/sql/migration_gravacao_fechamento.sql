-- =====================================================================
-- 4.5.0 — GRAVAÇÃO QUE SE FECHA
-- Dados de 05/11/2026: 17 gravações com data no passado ainda abertas
-- (5 "Agendada" sem nada marcado, 6 canceladas ocupando a lista).
--  1) Todos os itens gravados → a gravação se conclui sozinha.
--  2) Dia útil, 8h: gravação "Agendada" com data que já passou pergunta
--     ao videomaker (ou à coordenação, se não tiver) "Gravou?".
--  3) Cancelada há mais de 30 dias → vai para Arquivados (nada é apagado).
-- =====================================================================

-- a conclusão, sem a checagem de quem pode (quem chama já foi conferido)
create or replace function public._gravacao_concluir_interno(p_gravacao_id uuid, p_motivo text)
returns boolean language plpgsql security definer set search_path = public as $$
declare g public.gravacoes%rowtype; o public.gravacoes_ocorrencias%rowtype;
        hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into g from public.gravacoes where id = p_gravacao_id and deleted_at is null;
  if not found then return false; end if;
  select * into o from public.gravacoes_ocorrencias where gravacao_id = g.id and atual;
  if found and o.status in ('concluida', 'cancelada') then return false; end if;
  if not found then
    insert into public.gravacoes_ocorrencias (gravacao_id, status, inicio, fim, atual, criado_por, sem_horario)
    values (g.id, 'marcada', (coalesce(g.data_gravacao, hoje) + time '12:00') at time zone 'America/Sao_Paulo',
            (coalesce(g.data_gravacao, hoje) + time '12:00') at time zone 'America/Sao_Paulo', true, auth.uid(), true)
    returning * into o;
  end if;
  update public.gravacoes_ocorrencias set status = 'concluida', atualizado_em = now() where id = o.id;
  update public.gravacoes set status = 'Gravado', gravada_em = coalesce(gravada_em, now()) where id = g.id and status is distinct from 'Gravado';
  perform public._grav_hist(g.id, 'concluida_auto', jsonb_build_object('motivo', p_motivo));
  return true;
end $$;
revoke execute on function public._gravacao_concluir_interno(uuid, text) from public, anon, authenticated;

-- 1) marcar item: quando o último for marcado, conclui
create or replace function public.gravacao_item_marcar(p_item_id uuid, p_gravado boolean)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare i public.gravacao_itens%rowtype; g public.gravacoes%rowtype; tit text;
begin
  perform public.exigir_nivel('gravacoes', 2);
  select * into i from public.gravacao_itens where id = p_item_id and removido_em is null;
  if not found then raise exception 'Item não encontrado.'; end if;
  select * into g from public.gravacoes where id = i.gravacao_id;
  if not (public.sou_equipe() or public.sou_videomaker()) then
    raise exception 'Só a equipe ou o videomaker responsável marcam o que foi gravado.' using errcode = '42501';
  end if;
  if i.gravado = p_gravado then return; end if;
  update public.gravacao_itens set gravado = p_gravado,
    gravado_em = case when p_gravado then now() end, gravado_por = case when p_gravado then auth.uid() end
  where id = p_item_id;
  if i.tipo = 'roteiro' then
    perform set_config('b7.item_sync', 'on', true);
    if p_gravado then
      update public.roteiros set status = 'Gravado' where id = i.roteiro_id and status is distinct from 'Gravado';
    elsif not exists (select 1 from public.gravacao_itens where roteiro_id = i.roteiro_id and gravado and removido_em is null) then
      update public.roteiros set status = 'Pronto para gravar' where id = i.roteiro_id and status = 'Gravado';
    end if;
    perform set_config('b7.item_sync', '', true);
  end if;
  tit := coalesce(i.titulo, (select titulo from public.roteiros where id = i.roteiro_id), (select titulo from public.conteudos where id = i.conteudo_id));
  perform public._grav_hist(i.gravacao_id, case when p_gravado then 'item_gravado' else 'item_desmarcado' end,
    jsonb_build_object('item_id', i.id, 'tipo', i.tipo, 'titulo', tit));
  /* 4.5.0: era o último? a gravação se conclui sozinha */
  if p_gravado and not exists (select 1 from public.gravacao_itens
       where gravacao_id = i.gravacao_id and removido_em is null and not coalesce(gravado, false)) then
    perform public._gravacao_concluir_interno(i.gravacao_id, 'todos os itens gravados');
  end if;
end $function$;

-- 2) a pergunta do dia seguinte
create or replace function public._gravacoes_confirmar_avisar()
returns integer language plpgsql security definer set search_path = public as $$
declare hoje date := public.notif_hoje(); r record; ev uuid; n int := 0; quem uuid[];
begin
  if extract(isodow from hoje) > 5 then return 0; end if;
  for r in
    select g.id, g.nome, g.data_gravacao, g.client_id, c.nome cliente, public.gravacao_videomakers(g) vms
      from public.gravacoes g left join public.clientes c on c.id = g.client_id
     where g.deleted_at is null and g.archived_at is null and g.situacao = 'Agendada'
       and g.data_gravacao < hoje and g.data_gravacao >= hoje - 30
  loop
    begin
      insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, payload, processado_em)
      values ('gravacao.confirmar', 'gravacao.confirmar:' || r.id, 'gravacao', r.id, jsonb_build_object('data', r.data_gravacao), now())
      returning id into ev;
      quem := nullif(r.vms, '{}');
      perform public.notif_entregar(ev, 'gravacao.confirmar',
        'Gravou? ' || coalesce(r.cliente || ' · ', '') || coalesce(r.nome, 'gravação'),
        'A gravação de ' || to_char(r.data_gravacao, 'DD/MM') || ' ainda está como agendada. Abra para concluir, remarcar ou marcar como cancelada.',
        '#/gravacao/' || r.id, r.client_id, quem, 'prazos',
        case when quem is null then array['coordenador'] end, case when quem is null then 'co_escalados' end);
      n := n + 1;
    exception when unique_violation then null;
    end;
  end loop;
  return n;
end $$;

-- 3) canceladas há mais de 30 dias vão para Arquivados
create or replace function public._gravacoes_canceladas_arquivar()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.gravacoes set archived_at = now()
   where deleted_at is null and archived_at is null and situacao = 'Cancelada'
     and coalesce(data_gravacao, updated_at::date) < public.notif_hoje() - 30;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public._gravacoes_confirmar_avisar() from public, anon, authenticated;
revoke execute on function public._gravacoes_canceladas_arquivar() from public, anon, authenticated;

-- a rotina diária: às 8h, junto com os outros avisos
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
  end if;
  if h = 9 then perform public._prazos_risco_avisar(); end if;
  if h = 10 then perform public._aprov_lembrar_clientes(); perform public._projetos_lembrar_material(); end if;
end $function$;

-- arrumação de hoje: as canceladas antigas já vão para Arquivados
select public._gravacoes_canceladas_arquivar();
