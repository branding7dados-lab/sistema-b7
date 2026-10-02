-- =====================================================================
-- "Enviar um exemplo de cada aviso" (pacote 2026-10-02-q)
--
-- Para conferir como cada notificação do B7 chega (sino, push, som, ícone,
-- imagem, link) sem precisar provocar o evento de verdade.
--
--   • Só entrega para QUEM CHAMOU. Ninguém mais recebe nada.
--   • Não cria, altera nem move nenhuma demanda, peça, gravação ou cartão:
--     o evento gravado é do tipo teste (o mesmo de notificar_teste()), e a
--     notificação leva o tipo REAL só para o aviso sair com a aparência,
--     o filtro e o link de verdade.
--   • Os textos seguem os formatos das funções que geram cada aviso
--     (design_processar_evento, video_processar_evento, _grav_notificar,
--     aprov_processar_evento, agenda_verificar_lembretes…), aplicados a
--     itens reais recentes para o link abrir algo que existe.
--   • Todo título começa com "Teste · " e dados.teste = true.
--   • Nasce LIDO (lida_em preenchido) e o sino não lista avisos de teste:
--     o exemplo só chega como push no aparelho, sem virar pendência.
--
-- p_grupo: null (todos) | 'design' | 'video' | 'gravacoes' | 'cliente' | 'geral'
-- Devolve quantos avisos foram criados.
-- =====================================================================

create or replace function public.notificar_teste_todos(p_grupo text default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  eu uuid := auth.uid(); p public.perfis%rowtype; hoje date := public.notif_hoje();
  d public.design_deliverables%rowtype; v public.demandas_edicao%rowtype;
  g public.gravacoes%rowtype; l public.linhas_editoriais%rowtype; r public.roteiros%rowtype;
  ap_id uuid; img jsonb := '{}'::jsonb; cli_nome text;
  item_d text; formato text; link_d text; item_v text; link_v text;
  g_nome text; link_g text; quando text; antes text; linha_nome text; link_ld text; link_l text;
  item_r text; link_r text; link_a text; eu_nome text;
  s record; evid uuid; n integer := 0;
begin
  if eu is null then raise exception 'Sem sessão.' using errcode = '42501'; end if;
  select * into p from public.perfis where id = eu and estado = 'ativa';
  if not found or p.papel = 'cliente' then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_grupo is not null and p_grupo not in ('design', 'video', 'gravacoes', 'cliente', 'geral') then
    raise exception 'Grupo inválido.' using errcode = '22023';
  end if;
  eu_nome := coalesce(nullif(btrim(p.nome), ''), 'Alguém da equipe');

  /* itens reais recentes, só para o texto e o link fazerem sentido */
  select dd.* into d from public.design_deliverables dd
   where dd.deleted_at is null and dd.client_id is not null
   order by exists (select 1 from public.design_versoes vv join public.design_arquivos aa on aa.versao_id = vv.id
                     where vv.deliverable_id = dd.id and aa.papel = 'preview' and aa.caminho_thumb is not null) desc,
            dd.updated_at desc
   limit 1;
  if d.id is not null then
    select jsonb_build_object('imagem', jsonb_build_object('bucket', 'design-files', 'caminho', coalesce(a.caminho_thumb, a.caminho)))
      into img
      from public.design_arquivos a join public.design_versoes vv on vv.id = a.versao_id
     where vv.deliverable_id = d.id and a.papel = 'preview' and (a.caminho_thumb is not null or a.mime like 'image/%')
     order by vv.numero desc, a.parte_posicao nulls first, a.posicao
     limit 1;
    img := coalesce(img, '{}'::jsonb);
  end if;
  select * into v from public.demandas_edicao where deleted_at is null and client_id is not null order by updated_at desc limit 1;
  select * into g from public.gravacoes where deleted_at is null and client_id is not null order by updated_at desc limit 1;
  select * into l from public.linhas_editoriais where deleted_at is null order by updated_at desc limit 1;
  select * into r from public.roteiros where deleted_at is null and recording_session_id is not null order by updated_at desc limit 1;
  select id into ap_id from public.aprovacoes where deleted_at is null order by created_at desc limit 1;
  select nome into cli_nome from public.clientes where id = coalesce(d.client_id, v.client_id, g.client_id);
  cli_nome := coalesce(cli_nome, 'Cliente');

  item_d := '"' || coalesce(nullif(btrim(d.titulo), ''), 'Peça de Design') || '"';
  formato := case d.tipo when 'carrossel' then 'Carrossel' when 'stories' then 'Stories' when 'card' then 'Card'
                         else initcap(replace(coalesce(d.tipo, 'card'), '_', ' ')) end;
  link_d := coalesce('#/design/' || d.id, '#/design');
  item_v := '"' || coalesce(nullif(btrim(v.titulo), ''), 'Demanda de vídeo') || '"';
  link_v := coalesce('#/video/' || v.id, '#/video');
  g_nome := coalesce(nullif(btrim(g.nome), ''), 'Gravação');
  link_g := coalesce('#/gravacao/' || g.id, '#/gravacoes');
  quando := public.notif_dia_hora(date_trunc('day', now()) + interval '1 day 17 hours 30 minutes', false);
  antes  := public.notif_dia_hora(date_trunc('day', now()) + interval '13 hours', false);
  linha_nome := coalesce(nullif(btrim(l.nome), ''), 'Linha Editorial');
  link_ld := coalesce('#/design/linha/' || l.id, '#/design');
  link_l := coalesce('#/linha/' || l.id, '#/linhas');
  item_r := '"' || coalesce(nullif(btrim(r.titulo), ''), 'Roteiro sem título') || '"';
  link_r := coalesce('#/gravacao/' || r.recording_session_id || '?roteiro=' || r.id, '#/roteiros');
  link_a := coalesce('#/aprovacoes/' || ap_id, '#/aprovacoes');

  for s in
    select * from (values
      -- ------------------------------------------------------------ DESIGN
      (1, 'design', 'design.atribuida', 'Design atribuído a você',
        item_d || ' · ' || formato || ' · Prazo: ' || public.notif_dia(hoje + 3), link_d, d.client_id, '{}'::jsonb),
      (2, 'design', 'linha.concluida', 'Nova demanda de Design disponível', linha_nome || ' · 4 peças disponíveis.', link_ld, l.client_id, '{}'::jsonb),
      (3, 'design', 'linha.briefing_atualizado', 'Briefing atualizado',
        linha_nome || ' · A linha foi concluída de novo e o briefing das suas peças mudou.', link_ld, l.client_id, '{}'::jsonb),
      (4, 'design', 'design.versao_enviada', 'Design aguardando revisão', item_d || ' · V01 enviada por ' || eu_nome || '.', link_d, d.client_id, img),
      (5, 'design', 'design.ajuste_solicitado', 'Ajuste solicitado no Design', item_d || ' · V01 precisa de alteração.', link_d, d.client_id,
        img || jsonb_build_object('detalhe', 'Aumentar o logo e trocar a foto de fundo.')),
      (6, 'design', 'design.aprovado_interno', 'Design aprovado na revisão interna', item_d || ' · V01 aprovada.', link_d, d.client_id, img),
      (7, 'design', 'design.finalizado', 'Peça finalizada', item_d || ' · ' || formato, link_d, d.client_id, '{}'::jsonb),
      (8, 'design', 'design.demanda_assumida', 'Designer assumiu a peça', eu_nome || ' assumiu ' || item_d || '.', link_d, d.client_id, '{}'::jsonb),
      (9, 'design', 'design.prazo_amanha', 'Prazo amanhã — Design',
        item_d || ' · ' || formato || ' · Entrega amanhã, ' || public.notif_dia(hoje + 1) || '.', link_d, d.client_id, '{}'::jsonb),
      (10, 'design', 'design.atrasado', 'Demanda atrasada ' || public.notif_ha_dias(1),
        item_d || ' · ' || formato || ' · O prazo venceu em ' || public.notif_dia(hoje - 1) || '.', link_d, d.client_id, '{}'::jsonb),
      (11, 'design', 'design.atrasado_escalado', 'Demanda atrasada ' || public.notif_ha_dias(2),
        concat_ws(' · ', item_d, 'Responsável: ' || eu_nome, 'Prazo: ' || public.notif_dia(hoje - 2)), link_d, d.client_id, '{}'::jsonb),
      (12, 'design', 'design.atrasado_critico', 'Atraso crítico — Design ' || public.notif_ha_dias(5),
        concat_ws(' · ', item_d, 'Responsável: ' || eu_nome, 'Prazo: ' || public.notif_dia(hoje - 5)), link_d, d.client_id, '{}'::jsonb),
      (13, 'design', 'design.revisao_parada', 'Design parado na revisão',
        '12 peças aguardando revisão há 3 dias ou mais · a mais antiga, ' || public.notif_ha_dias(9) || '.', '#/design?aba=revisao&limpar=1', null::uuid, '{}'::jsonb),
      (14, 'design', 'design.cliente_parado', 'Cliente sem resposta',
        '3 peças aguardando o cliente há 3 dias ou mais · ' || cli_nome || '.', '#/design?aba=aprovadas&limpar=1', null::uuid, '{}'::jsonb),
      (15, 'design', 'design.cliente_aprovado', 'Cliente aprovou a peça',
        item_d || ' · Aprovada via WhatsApp. Nenhum ajuste foi solicitado.', link_d, d.client_id, img),
      (16, 'design', 'design.cliente_ajustes', 'Cliente solicitou ajustes', item_d || ' · O cliente pediu alterações na peça.', link_d, d.client_id, img),
      (17, 'design', 'design.cliente_recusado', 'Cliente recusou a peça', item_d || ' · Confira o motivo no B7.', link_d, d.client_id, img),
      -- ------------------------------------------------------------- VÍDEO
      (20, 'video', 'video.atribuida', 'Demanda de vídeo atribuída a você', item_v || ' · Prazo: ' || public.notif_dia(hoje + 3), link_v, v.client_id, '{}'::jsonb),
      (21, 'video', 'video.aguardando_aprovacao', 'Vídeo enviado para aprovação', item_v || ' · Enviado por ' || eu_nome || '.', link_v, v.client_id, '{}'::jsonb),
      (22, 'video', 'video.correcao_solicitada', 'Correção solicitada no vídeo', item_v || ' · A equipe solicitou uma alteração.', link_v, v.client_id, '{}'::jsonb),
      (23, 'video', 'video.aprovado_cliente', 'Cliente aprovou o vídeo', item_v || ' · V01 aprovada. Já pode registrar a entrega.', link_v, v.client_id, '{}'::jsonb),
      (24, 'video', 'video.entregue', 'Vídeo entregue', item_v || ' · Entregue por ' || eu_nome || '.', link_v, v.client_id, '{}'::jsonb),
      (25, 'video', 'video.prazo_amanha', 'Prazo amanhã — Vídeo', item_v || ' · Entrega amanhã, ' || public.notif_dia(hoje + 1) || '.', link_v, v.client_id, '{}'::jsonb),
      (26, 'video', 'video.atrasado', 'Demanda atrasada ' || public.notif_ha_dias(1),
        item_v || ' · O prazo venceu em ' || public.notif_dia(hoje - 1) || '.', link_v, v.client_id, '{}'::jsonb),
      (27, 'video', 'video.atrasado_escalado', 'Demanda atrasada ' || public.notif_ha_dias(2),
        concat_ws(' · ', item_v, 'Responsável: ' || eu_nome, 'Prazo: ' || public.notif_dia(hoje - 2)), link_v, v.client_id, '{}'::jsonb),
      (28, 'video', 'video.atrasado_critico', 'Atraso crítico — vídeo ' || public.notif_ha_dias(5),
        concat_ws(' · ', item_v, 'Responsável: ' || eu_nome, 'Prazo: ' || public.notif_dia(hoje - 5)), link_v, v.client_id, '{}'::jsonb),
      -- ------------------------------------- GRAVAÇÕES, ROTEIROS E AGENDA
      (30, 'gravacoes', 'gravacao.atribuida', 'Gravação atribuída a você', concat_ws(' · ', g_nome, quando, '6 itens planejados'), link_g, g.client_id, '{}'::jsonb),
      (31, 'gravacoes', 'gravacao.remarcada', 'Gravação remarcada', concat_ws(' · ', g_nome, 'Nova data: ' || quando, 'Antes: ' || antes), link_g, g.client_id, '{}'::jsonb),
      (32, 'gravacoes', 'gravacao.cancelada', 'Gravação cancelada', g_nome || ' · A gravação de ' || quando || ' foi cancelada.', link_g, g.client_id, '{}'::jsonb),
      (33, 'gravacoes', 'roteiro.pronto', 'Roteiro pronto para gravação', concat_ws(' · ', item_r, g_nome), link_r, g.client_id, '{}'::jsonb),
      (34, 'gravacoes', 'agenda.gravacao_24h', 'Gravação amanhã às 14:30', g_nome, link_g, g.client_id, '{}'::jsonb),
      (35, 'gravacoes', 'agenda.gravacao_1h', 'Gravação hoje às 14:30', g_nome, link_g, g.client_id, '{}'::jsonb),
      (36, 'gravacoes', 'agenda.reuniao_24h', 'Reunião amanhã às 10:00', 'Alinhamento mensal · Local: Escritório', '#/calendario', null::uuid, '{}'::jsonb),
      (37, 'gravacoes', 'agenda.apresentacao_1h', 'Apresentação hoje às 16:00', 'Apresentação da linha editorial', '#/calendario', null::uuid, '{}'::jsonb),
      -- -------------------------------------------- DECISÕES DO CLIENTE
      (40, 'cliente', 'aprovacao.aprovada', 'Cliente aprovou a peça de Design', item_d || ' · Versão 1 aprovada por Maria (' || cli_nome || ').', link_a, d.client_id, '{}'::jsonb),
      (41, 'cliente', 'aprovacao.ajustes', 'Cliente solicitou ajustes', item_d || ' · A peça de Design voltou para correção.', link_a, d.client_id, '{}'::jsonb),
      (42, 'cliente', 'aprovacao.recusada', 'Cliente recusou a peça de Design', item_d || ' · Confira o motivo no B7.', link_a, d.client_id, '{}'::jsonb),
      (43, 'cliente', 'parte.aprovada', 'Cliente aprovou uma parte', item_d || ' · Slide 02 aprovada por Maria.', link_a, d.client_id, '{}'::jsonb),
      (44, 'cliente', 'parte.ajustes', 'Cliente solicitou ajustes', item_d || ' · Slide 02 precisa de alteração.', link_a, d.client_id, '{}'::jsonb),
      (45, 'cliente', 'aprovacao.anulada', 'Decisão do cliente anulada', eu_nome || ' anulou a aprovação da peça de Design ' || item_d || ' (v1).', link_a, d.client_id, '{}'::jsonb),
      -- ------------------------------------------------- REVISÃO E RESUMO
      (50, 'geral', 'roteiro.revisao', 'Roteiro aguardando revisão', item_r || ' · Pronto para revisão interna.', link_r, g.client_id, '{}'::jsonb),
      (51, 'geral', 'linha.revisao', 'Linha Editorial aguardando revisão',
        concat_ws(' · ', linha_nome, case when l.mes between 1 and 12 and l.ano is not null then public.notif_mes(l.mes, l.ano) end, 'Pronta para revisão.'),
        link_l, l.client_id, '{}'::jsonb),
      (52, 'geral', 'resumo.diario', 'Resumo do dia — B7',
        '2 demandas com prazo hoje · 1 gravação amanhã · 4 publicações previstas para hoje.', '#/painel', null::uuid, '{}'::jsonb)
    ) as t(ordem, grupo, tipo, titulo, mensagem, link, client_id, dados)
    where p_grupo is null or t.grupo = p_grupo
    order by t.ordem
  loop
    insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload, processado_em)
    values ('teste.notificacao', 'teste.todos:' || eu || ':' || s.tipo || ':' || s.ordem || ':' || clock_timestamp()::text,
            'perfil', eu, s.client_id, eu, p.nome, p.papel, jsonb_build_object('amostra_de', s.tipo), now())
    returning id into evid;

    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link, dados, created_at, lida_em)
    values (evid, eu, s.client_id, s.tipo, 'Teste · ' || s.titulo, s.mensagem, s.link,
            coalesce(s.dados, '{}'::jsonb) || '{"teste": true}'::jsonb, clock_timestamp(), clock_timestamp());
    n := n + 1;
  end loop;

  return n;
end;
$function$;

revoke all on function public.notificar_teste_todos(text) from public, anon;
grant execute on function public.notificar_teste_todos(text) to authenticated;
