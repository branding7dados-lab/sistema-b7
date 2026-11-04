-- =========================================================================
-- B7 VÍDEO — ETAPA DE APROVAÇÃO (parte 1: status interno)
-- =========================================================================
-- Novo status "aguardando_aprovacao" na fila de edição, entre "em edição"
-- e "correção": depois que o vídeo fica pronto, em vez de já marcar como
-- entregue, a equipe manda pra aprovação; se o cliente pedir alteração,
-- volta pra correção (mesmo fluxo/mensagem que já existia pra correção).
--
-- Isso é só a PARTE 1 — o status e a movimentação interna (Lista, Kanban
-- interno, quadro geral). A parte do CLIENTE decidir (portal, aprovar/
-- pedir alteração pelo lado dele) fica pra um próximo prompt, por pedido
-- do Yury.
-- =========================================================================

alter table public.demandas_edicao drop constraint demandas_edicao_editing_status_check;
alter table public.demandas_edicao add constraint demandas_edicao_editing_status_check
  check (editing_status in ('pendente', 'em_edicao', 'aguardando_aprovacao', 'correcao', 'standby', 'entregue', 'descartado'));

create or replace function public.video_mudar_status(p_demanda_id uuid, p_status text, p_mensagem text default null)
returns void language plpgsql security definer set search_path = public as $$
declare d public.demandas_edicao%rowtype; ator public.perfis%rowtype; evid uuid; de_status text; k uuid;
begin
  select * into d from public.demandas_edicao where id = p_demanda_id and deleted_at is null;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  if not (public.sou_equipe() or d.videomaker_id = auth.uid()) then
    raise exception 'Sem permissão para mudar esta demanda.' using errcode = '42501';
  end if;
  if p_status not in ('pendente', 'em_edicao', 'aguardando_aprovacao', 'correcao', 'standby', 'entregue', 'descartado') then
    raise exception 'Situação inválida.';
  end if;
  select * into ator from public.perfis where id = auth.uid();
  de_status := d.editing_status;

  update public.demandas_edicao
     set editing_status = p_status, updated_at = now(),
         entregue_em = case when p_status = 'entregue' then now() else entregue_em end
   where id = p_demanda_id;

  /* sombra no Kanban geral: nasce só quando o trabalho de verdade
     começa (evita poluir o quadro com toda demanda ainda pendente de
     planilha); depois disso só acompanha as transições que têm coluna
     correspondente. */
  if p_status = 'em_edicao' and d.kanban_id is null then
    insert into public.kanban_demandas (titulo, coluna, client_id, tipo_vinculo, vinculo_id, tipo, responsavel_id, prazo, criado_por, origem_evento)
    values (d.titulo, 'producao', d.client_id, 'demanda_edicao', d.id, 'video', d.videomaker_id, d.prazo, auth.uid(), 'video.em_edicao')
    returning id into k;
    update public.demandas_edicao set kanban_id = k where id = p_demanda_id;
  elsif d.kanban_id is not null then
    if p_status = 'em_edicao' then
      update public.kanban_demandas set coluna = 'producao', origem_evento = 'video.em_edicao', updated_at = now() where id = d.kanban_id;
    elsif p_status = 'aguardando_aprovacao' then
      update public.kanban_demandas set coluna = 'aguardando_cliente', origem_evento = 'video.aguardando_aprovacao', updated_at = now() where id = d.kanban_id;
    elsif p_status = 'correcao' then
      update public.kanban_demandas set coluna = 'ajustes', origem_evento = 'video.correcao_solicitada', updated_at = now() where id = d.kanban_id;
    elsif p_status = 'entregue' then
      update public.kanban_demandas set coluna = 'pronto', origem_evento = 'video.entregue', updated_at = now() where id = d.kanban_id;
    elsif p_status = 'descartado' then
      update public.kanban_demandas set arquivada_em = now(), updated_at = now() where id = d.kanban_id;
    end if;
    -- 'pendente' e 'standby' não têm coluna correspondente: o card não se move.
  end if;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, de_status, para_status, ator_id, ator_nome, ator_papel, mensagem)
  values (p_demanda_id, 'status', de_status, p_status, auth.uid(), ator.nome, ator.papel, p_mensagem);

  if p_status = 'entregue' then
    insert into public.eventos_dominio (id, tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    values (gen_random_uuid(), 'video.entregue', 'video.entregue:' || p_demanda_id || ':' || now()::text,
            'demanda_edicao', p_demanda_id, d.client_id, auth.uid(), ator.nome, ator.papel,
            jsonb_build_object('titulo', d.titulo))
    returning id into evid;
    perform public.video_processar_evento(evid);
  elsif p_status = 'aguardando_aprovacao' then
    insert into public.eventos_dominio (id, tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    values (gen_random_uuid(), 'video.aguardando_aprovacao', 'video.aguardando_aprovacao:' || p_demanda_id || ':' || now()::text,
            'demanda_edicao', p_demanda_id, d.client_id, auth.uid(), ator.nome, ator.papel,
            jsonb_build_object('titulo', d.titulo))
    returning id into evid;
    perform public.video_processar_evento(evid);
  elsif p_status = 'correcao' and public.sou_equipe() and d.videomaker_id is not null then
    insert into public.eventos_dominio (id, tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    values (gen_random_uuid(), 'video.correcao_solicitada', 'video.correcao_solicitada:' || p_demanda_id || ':' || now()::text,
            'demanda_edicao', p_demanda_id, d.client_id, auth.uid(), ator.nome, ator.papel,
            jsonb_build_object('titulo', d.titulo, 'mensagem', p_mensagem))
    returning id into evid;
    perform public.video_processar_evento(evid);
  end if;
end;
$$;
revoke all on function public.video_mudar_status(uuid, text, text) from public;
grant execute on function public.video_mudar_status(uuid, text, text) to authenticated;

create or replace function public.video_processar_evento(p_evento_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  ev public.eventos_dominio%rowtype;
  d  public.demandas_edicao%rowtype;
  tit text; msg text; link text;
begin
  select * into ev from public.eventos_dominio where id = p_evento_id for update;
  if not found or ev.processado_em is not null then return; end if;
  if ev.alvo_tipo <> 'demanda_edicao' then
    update public.eventos_dominio set processado_em = now() where id = ev.id;
    return;
  end if;

  select * into d from public.demandas_edicao where id = ev.alvo_id;
  if not found then
    update public.eventos_dominio set processado_em = now(), erro = 'demanda de edição não encontrada' where id = ev.id;
    return;
  end if;

  link := '#/video/' || d.id;

  if ev.tipo = 'video.atribuida' and ev.payload->>'videomaker_id' is not null then
    tit := coalesce(ev.ator_nome, 'A equipe') || ' atribuiu "' || coalesce(ev.payload->>'titulo', d.titulo) || '" a ' ||
           coalesce(ev.payload->>'videomaker_nome', 'um videomaker');
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    values (ev.id, (ev.payload->>'videomaker_id')::uuid, d.client_id, ev.tipo, tit, null, link)
    on conflict (evento_id, destinatario_id) do nothing;

  elsif ev.tipo = 'video.aguardando_aprovacao' then
    /* time (admin/coordenador) sabe que essa demanda saiu de "em
       edição" e está esperando decisão — mesmo público que já era
       avisado quando algo virava "entregue". */
    tit := coalesce(ev.ator_nome, 'A equipe') || ' enviou "' || coalesce(ev.payload->>'titulo', d.titulo) || '" para aprovação';
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select ev.id, p.id, d.client_id, ev.tipo, tit, null, link
      from public.perfis p where p.estado = 'ativa' and p.papel in ('admin', 'coordenador') and p.id is distinct from ev.ator_id
    on conflict (evento_id, destinatario_id) do nothing;

  elsif ev.tipo = 'video.entregue' then
    tit := coalesce(ev.ator_nome, 'O videomaker') || ' marcou "' || coalesce(ev.payload->>'titulo', d.titulo) || '" como entregue';
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select ev.id, p.id, d.client_id, ev.tipo, tit, null, link
      from public.perfis p where p.estado = 'ativa' and p.papel in ('admin', 'coordenador') and p.id is distinct from ev.ator_id
    on conflict (evento_id, destinatario_id) do nothing;

  elsif ev.tipo = 'video.correcao_solicitada' then
    tit := coalesce(ev.ator_nome, 'A equipe') || ' pediu correção em "' || coalesce(ev.payload->>'titulo', d.titulo) || '"';
    msg := ev.payload->>'mensagem';
    if d.videomaker_id is not null then
      insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
      values (ev.id, d.videomaker_id, d.client_id, ev.tipo, tit, msg, link)
      on conflict (evento_id, destinatario_id) do nothing;
    end if;
  end if;

  update public.eventos_dominio set processado_em = now() where id = ev.id;
end;
$$;
revoke all on function public.video_processar_evento(uuid) from public;
grant execute on function public.video_processar_evento(uuid) to authenticated;
