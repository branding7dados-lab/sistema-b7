-- Consolidação do banco antes do lançamento (zzz262).
-- Aplicada em partes: consolida_1_anon, consolida_1b_internas,
-- consolida_2_3_path_rls, consolida_4_indices.

-- 1) Funções SECURITY DEFINER deixam de responder para quem não fez login.
--    Ficam abertas só as que são públicas de propósito: o promo1010 (site)
--    e o widget do Android (usa uma chave própria, sem login).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.prorettype = 'trigger'::regtype as gatilho
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname not like 'promo1010\_%'
      and p.proname not in ('widget_hoje', 'widget_token_revogar')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.gatilho then
      -- gatilho não é chamado por ninguém pela API
      execute format('revoke execute on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated, service_role', f.sig);
    end if;
  end loop;
end $$;

-- funções internas (avisos, gatilhos, rotinas) continuam fechadas também
-- para quem está logado: só o banco e as funções do servidor chamam.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.proname = any (array['_aprov_nota_interna','_carga_funcao','_cliente_avisar_b7','_clientes_separar_interno','_conferir_permissoes_diario','_design_alertas_parados','_design_alertas_prazo','_grav_hist','_grav_notificar','_gravacoes_fixas_gerar','_notif_resumo_diario','_op_norm','_oportunidades_aviso_do_dia','_perfis_modelo','_prazos_risco_avisar','_producao_alertas_lembretes','_resumo_silencio','_video_alertas_prazo','_video_checar_roteiros_disponiveis','aprov_emitir','aprov_processar_evento','calendario_ocorrencia_marcar_erro_sync','gravacoes_historico_depois','gravacoes_ocorrencias_sincronizar','gravacoes_regras_antes','municipios_aplicar_lote','notif_destinatarios','notif_entregar','notif_verificar_agendados','oportunidade_tem_interesse','oportunidades_aplicar_lote','oportunidades_do_dia','oportunidades_proximas','prazos_em_risco','resolver_login','roteiros_itens_gravacao','silencio_de'])
  loop
    execute format('revoke execute on function %s from authenticated', f.sig);
  end loop;
end $$;

-- funções criadas daqui pra frente nascem sem acesso para anon
alter default privileges in schema public revoke execute on functions from public, anon;

-- 2) search_path fixo nas funções que estavam sem
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('_auditoria_cofre','_gravacao_fixa_proxima','_nivel_num','_op_norm',
                        '_pacote_valido','_silencio_valido','design_briefing_so_em_producao',
                        'limites_admin_padrao')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;
end $$;

-- 3) Políticas que recalculavam auth.uid() a cada linha
alter policy ia_conversas_le on public.ia_conversas
  using (perfil_id = (select auth.uid()) and (select public.sou_equipe_interna()));
alter policy ia_conversas_apaga on public.ia_conversas
  using (perfil_id = (select auth.uid()) and (select public.sou_equipe_interna()));
alter policy ia_mensagens_le on public.ia_mensagens
  using ((select public.sou_equipe_interna()) and exists (
    select 1 from public.ia_conversas c
    where c.id = ia_mensagens.conversa_id and c.perfil_id = (select auth.uid())));
alter policy chat_comunicados_le on public.chat_comunicados
  using (autor_id = (select auth.uid()));

-- 4) Índices nas chaves estrangeiras mais consultadas
create index if not exists notificacoes_client_id_idx      on public.notificacoes (client_id);
create index if not exists video_comentarios_demanda_idx   on public.video_comentarios (demanda_id);
create index if not exists ia_conversas_cliente_idx        on public.ia_conversas (cliente_id);
create index if not exists roteiros_content_idx            on public.roteiros (content_id);
create index if not exists conteudos_script_idx            on public.conteudos (script_id);
create index if not exists conteudos_produto_idx           on public.conteudos (produto_id);
create index if not exists ideias_content_idx              on public.ideias (content_id);
create index if not exists status_itens_script_idx         on public.status_itens (script_id);
create index if not exists status_itens_recording_idx      on public.status_itens (recording_id);
create index if not exists eventos_dominio_client_idx      on public.eventos_dominio (client_id);
create index if not exists whatsapp_envios_cliente_idx     on public.whatsapp_envios (cliente_id);
create index if not exists chat_mensagens_resposta_idx     on public.chat_mensagens (resposta_id);
create index if not exists kanban_demandas_aprovacao_idx   on public.kanban_demandas (aprovacao_id);
create index if not exists demandas_edicao_gravacao_idx    on public.demandas_edicao (gravacao_id);
create index if not exists atividades_recording_idx        on public.atividades (recording_id);
create index if not exists gravacoes_ocorr_evento_idx      on public.gravacoes_ocorrencias (evento_id);
create index if not exists linhas_editoriais_onboarding_idx on public.linhas_editoriais (onboarding_id);
