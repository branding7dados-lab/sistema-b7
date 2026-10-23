-- zzz253: prazos em risco — avisar ANTES de atrasar.
-- (Atraso já avisava a pessoa, escalava para a coordenação com 2 dias e virava
--  crítico com 5 — _design_alertas_prazo / _video_alertas_prazo.)
-- Agora, todo dia às 9h:
--   • peça de design ou vídeo que vence hoje/amanhã e NÃO COMEÇOU
--       (design: aguardando produção, ou em criação sem nenhuma versão enviada;
--        vídeo: pendente) → aviso para quem é responsável;
--   • a mesma coisa sem responsável → entra no resumo da coordenação ("ninguém pegou");
--   • post com data de amanhã ainda em Ideia/Em criação/Em revisão → resumo da coordenação.
-- A coordenação recebe UM aviso por dia com o total e os primeiros itens.

create or replace function public.prazos_em_risco()
returns table(tipo text, id uuid, titulo text, client_id uuid, cliente text, prazo date, responsavel uuid, responsavel_nome text, motivo text, link text)
language sql stable security definer set search_path to 'public' as $$
  with h as (select public.notif_hoje() as hoje)
  select 'design', d.id, d.titulo, d.client_id, c.nome, d.prazo, d.designer_id, p.nome,
         case when d.designer_id is null then 'ninguém pegou' else 'ainda não começou' end, '#/design/' || d.id
    from public.design_deliverables d cross join h
    left join public.clientes c on c.id = d.client_id
    left join public.perfis p on p.id = d.designer_id
   where d.deleted_at is null and d.prazo between h.hoje and h.hoje + 1
     and (d.status = 'aguardando_producao'
          or (d.status = 'em_criacao' and not exists (select 1 from public.design_versoes v where v.deliverable_id = d.id)))
  union all
  select 'video', d.id, d.titulo, d.client_id, c.nome, d.prazo, d.videomaker_id, p.nome,
         case when d.videomaker_id is null then 'ninguém pegou' else 'ainda não começou' end, '#/video'
    from public.demandas_edicao d cross join h
    left join public.clientes c on c.id = d.client_id
    left join public.perfis p on p.id = d.videomaker_id
   where d.deleted_at is null and d.prazo between h.hoje and h.hoje + 1 and d.editing_status = 'pendente'
  union all
  select 'post', ct.id, coalesce(nullif(ct.titulo, ''), 'Post sem título'), ct.client_id, c.nome, ct.data_postagem, null::uuid, null::text,
         'sai amanhã e está em ' || ct.status, '#/linha/' || ct.linha_id
    from public.conteudos ct cross join h
    left join public.clientes c on c.id = ct.client_id
   where ct.deleted_at is null and ct.archived_at is null and ct.data_postagem = h.hoje + 1
     and ct.status in ('Ideia', 'Em criação', 'Em revisão')
$$;
-- quem vê: só a equipe de gestão (a tela do Painel da coordenação)
create or replace function public.prazos_em_risco_lista()
returns table(tipo text, id uuid, titulo text, client_id uuid, cliente text, prazo date, responsavel uuid, responsavel_nome text, motivo text, link text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.sou_equipe() then return; end if;
  return query select * from public.prazos_em_risco() x order by x.prazo, x.titulo;
end $$;
revoke all on function public.prazos_em_risco() from public, anon, authenticated;
revoke all on function public.prazos_em_risco_lista() from public, anon;
grant execute on function public.prazos_em_risco_lista() to authenticated;

create or replace function public._prazos_risco_avisar() returns integer
language plpgsql security definer set search_path to 'public' as $$
declare r record; ev uuid; hoje date := public.notif_hoje(); n int := 0; tot int; lista text; quando text;
begin
  -- para cada responsável: um aviso por item
  for r in select * from public.prazos_em_risco() where responsavel is not null loop
    quando := case when r.prazo = hoje then 'Vence hoje' else 'Vence amanhã' end;
    begin
      insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload, processado_em)
      values ('prazo.nao_comecou', 'prazo.nao_comecou:' || r.id || ':' || hoje, r.tipo, r.id, r.client_id,
              jsonb_build_object('titulo', r.titulo), now())
      returning id into ev;
      perform public.notif_entregar(ev, 'prazo.nao_comecou', quando || ' e ainda não começou',
        '"' || r.titulo || '"' || coalesce(' · ' || r.cliente, '') || '. Se não der tempo, avise a coordenação.',
        r.link, r.client_id, array[r.responsavel], 'prazos');
      n := n + 1;
    exception when unique_violation then null;
    end;
  end loop;

  -- coordenação: um resumo por dia
  select count(*), string_agg(titulo || ' (' || motivo || ')', ' · ' order by prazo, titulo) filter (where rn <= 3)
    into tot, lista
    from (select *, row_number() over (order by prazo, titulo) rn from public.prazos_em_risco()) x;
  if tot > 0 then
    begin
      insert into public.eventos_dominio (tipo, chave, alvo_tipo, payload, processado_em)
      values ('prazo.risco_resumo', 'prazo.risco_resumo:' || hoje, 'resumo', jsonb_build_object('total', tot), now())
      returning id into ev;
      perform public.notif_entregar(ev, 'prazo.risco_resumo',
        case when tot = 1 then '1 entrega em risco' else tot || ' entregas em risco' end,
        left(lista || case when tot > 3 then ' e mais ' || (tot - 3) else '' end, 300),
        '#/painel', null, null, null, array['coordenador'], 'co_escalados', 'adm_atrasos', null, jsonb_build_object('total', tot));
      n := n + 1;
    exception when unique_violation then null;
    end;
  end if;
  return n;
end $$;
revoke all on function public._prazos_risco_avisar() from public, anon, authenticated;

create or replace function public.notif_verificar_agendados()
returns void language plpgsql security definer set search_path to 'public' as $$
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
  end if;
  if h = 9 then perform public._prazos_risco_avisar(); end if;
end $$;
