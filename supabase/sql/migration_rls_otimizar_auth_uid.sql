-- Rodada z12 — Parte 7 da auditoria: recomendação do advisor de performance
-- do Supabase (auth_rls_initplan). Troca auth.uid() solto por
-- (select auth.uid()) dentro das políticas de RLS: o resultado é
-- idêntico (mesma pessoa, mesmas linhas liberadas), só que o Postgres
-- passa a calcular o uid() UMA vez por consulta em vez de uma vez por
-- linha — mais rápido conforme as tabelas crescem. Não mexe em
-- sou_equipe()/sou_equipe_interna() nem em nenhuma outra regra de
-- acesso, só na forma de avaliar auth.uid(). Confirmado com o Yury
-- antes de aplicar (toca política de segurança em 13 tabelas).
-- Já aplicado direto no banco — este arquivo é só o histórico local.

ALTER POLICY "demandas_edicao select" ON public.demandas_edicao
  USING ((deleted_at IS NULL) AND (sou_equipe() OR (videomaker_id = (select auth.uid()))) AND sou_equipe_interna());

ALTER POLICY "demandas_edicao_eventos select" ON public.demandas_edicao_eventos
  USING (EXISTS ( SELECT 1
     FROM demandas_edicao d
    WHERE ((d.id = demandas_edicao_eventos.demanda_id) AND (d.deleted_at IS NULL) AND (sou_equipe() OR (d.videomaker_id = (select auth.uid()))) AND sou_equipe_interna())));

ALTER POLICY "demandas_edicao_roteiros select" ON public.demandas_edicao_roteiros
  USING (((EXISTS ( SELECT 1
     FROM demandas_edicao de
    WHERE ((de.id = demandas_edicao_roteiros.demanda_id) AND (de.deleted_at IS NULL) AND (sou_equipe() OR (de.videomaker_id = (select auth.uid())))))) AND sou_equipe_interna()));

ALTER POLICY "design_arquivo select" ON public.design_arquivos
  USING (EXISTS ( SELECT 1
     FROM (design_versoes v
       JOIN design_deliverables d ON ((d.id = v.deliverable_id)))
    WHERE ((v.id = design_arquivos.versao_id) AND (d.deleted_at IS NULL) AND (sou_equipe() OR (d.designer_id = (select auth.uid())) OR (d.designer_id IS NULL)) AND sou_equipe_interna())));

ALTER POLICY "design_deliv select" ON public.design_deliverables
  USING ((deleted_at IS NULL) AND (sou_equipe() OR (designer_id = (select auth.uid())) OR (designer_id IS NULL)) AND sou_equipe_interna());

ALTER POLICY "design_versao select" ON public.design_versoes
  USING (EXISTS ( SELECT 1
     FROM design_deliverables d
    WHERE ((d.id = design_versoes.deliverable_id) AND (d.deleted_at IS NULL) AND (sou_equipe() OR (d.designer_id = (select auth.uid())) OR (d.designer_id IS NULL)) AND sou_equipe_interna())));

ALTER POLICY "notificacoes_proprias" ON public.notificacoes
  USING (destinatario_id = (select auth.uid()));

ALTER POLICY "perfil_clientes_leitura" ON public.perfil_clientes
  USING ((perfil_id = (select auth.uid())) OR sou_equipe());

ALTER POLICY "perfis_leitura" ON public.perfis
  USING ((id = (select auth.uid())) OR sou_equipe() OR (sou_equipe_interna() AND (papel = ANY (ARRAY['admin'::text, 'coordenador'::text, 'designer'::text]))));

ALTER POLICY "perfis_funcoes_extra select" ON public.perfis_funcoes_extra
  USING ((perfil_id = (select auth.uid())) OR sou_equipe());

ALTER POLICY "push_proprias" ON public.push_subscricoes
  USING (perfil_id = (select auth.uid()))
  WITH CHECK (perfil_id = (select auth.uid()));

ALTER POLICY "video_comentarios select" ON public.video_comentarios
  USING (EXISTS ( SELECT 1
     FROM demandas_edicao d
    WHERE ((d.id = video_comentarios.demanda_id) AND (d.deleted_at IS NULL) AND (sou_equipe() OR (d.videomaker_id = (select auth.uid()))) AND sou_equipe_interna())));

ALTER POLICY "video_versoes select" ON public.video_versoes
  USING (EXISTS ( SELECT 1
     FROM demandas_edicao d
    WHERE ((d.id = video_versoes.demanda_id) AND (d.deleted_at IS NULL) AND (sou_equipe() OR (d.videomaker_id = (select auth.uid()))) AND sou_equipe_interna())));
