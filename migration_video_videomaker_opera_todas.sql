/* =====================================================================
   B7 VÍDEO — VIDEOMAKER VÊ E OPERA TODAS AS DEMANDAS (pacote 2026-10-01-ac)

   REGRA DE NEGÓCIO (decidida pelo Kevin em 01/10/2026)
   Quem é videomaker (papel principal ou função extra) vê TODAS as
   demandas de vídeo e pode operar qualquer uma — não só as atribuídas a
   ele. Um cobre o outro: quem editou nem sempre é quem atualiza a
   demanda.

   ANTES   equipe (admin/coordenador) OU o videomaker atribuído.
   AGORA   equipe OU qualquer videomaker elegível (sou_videomaker()).

   O QUE O VIDEOMAKER PASSA A PODER, EM QUALQUER DEMANDA
     ver a demanda, as versões, os comentários, o histórico e os
     roteiros vinculados; mudar a situação; registrar versão; definir o
     link dos materiais; marcar as etapas de conclusão; comentar.

   O QUE NÃO MUDA (continua só admin/coordenador)
     criar, editar, excluir e atribuir demanda; vincular roteiros;
     importar planilha; pacotes; data de standby; registrar a decisão do
     cliente; fechar/reabrir mês; gestão e relatórios. Designer sem
     função de vídeo, cliente do Portal e visitante continuam sem acesso
     nenhum. Escrita direta nas tabelas continua bloqueada: tudo passa
     pelas funções.

   TAMBÉM ENTRA
     perfis_leitura: a equipe interna passa a enxergar o perfil de quem
     tem papel 'videomaker' (antes só admin, coordenador e designer).
     Sem isso, um videomaker veria a demanda de outro videomaker sem o
     nome do responsável.

   COMO É APLICADA
     policies: ALTER POLICY (só a condição muda; os papéis ficam).
     funções:  a definição que está no banco tem UMA linha de permissão
               trocada, e a migration confere que a troca aconteceu.
     Rodar de novo não faz nada.
   ===================================================================== */

alter policy "demandas_edicao select" on public.demandas_edicao
  using (deleted_at is null and (public.sou_equipe() or public.sou_videomaker()) and public.sou_equipe_interna());

alter policy "video_versoes select" on public.video_versoes
  using (exists (select 1 from public.demandas_edicao d
                  where d.id = video_versoes.demanda_id and d.deleted_at is null
                    and (public.sou_equipe() or public.sou_videomaker()) and public.sou_equipe_interna()));

alter policy "video_comentarios select" on public.video_comentarios
  using (exists (select 1 from public.demandas_edicao d
                  where d.id = video_comentarios.demanda_id and d.deleted_at is null
                    and (public.sou_equipe() or public.sou_videomaker()) and public.sou_equipe_interna()));

alter policy "demandas_edicao_eventos select" on public.demandas_edicao_eventos
  using (exists (select 1 from public.demandas_edicao d
                  where d.id = demandas_edicao_eventos.demanda_id and d.deleted_at is null
                    and (public.sou_equipe() or public.sou_videomaker()) and public.sou_equipe_interna()));

alter policy "demandas_edicao_roteiros select" on public.demandas_edicao_roteiros
  using (exists (select 1 from public.demandas_edicao de
                  where de.id = demandas_edicao_roteiros.demanda_id and de.deleted_at is null
                    and (public.sou_equipe() or public.sou_videomaker()))
         and public.sou_equipe_interna());

alter policy "perfis_leitura" on public.perfis
  using (id = (select auth.uid()) or public.sou_equipe()
         or (public.sou_equipe_interna() and papel = any (array['admin', 'coordenador', 'designer', 'videomaker'])));

do $$
declare
  f text; atual text;
  antes  constant text := 'if not (public.sou_equipe() or d.videomaker_id = auth.uid()) then';
  depois constant text := 'if not (public.sou_equipe() or public.sou_videomaker()) then';
begin
  foreach f in array array[
    'video_mudar_status(uuid,text,text)',
    'video_criar_versao(uuid,text,text,text)',
    'video_definir_link(uuid,text)',
    'video_marcar_conclusao(uuid,text,boolean)',
    'video_criar_comentario(uuid,integer,text)'
  ] loop
    atual := pg_get_functiondef(('public.' || f)::regprocedure);
    if strpos(atual, depois) > 0 then continue; end if;
    if strpos(atual, antes) = 0 then
      raise exception 'A função % não está no formato esperado; nada foi aplicado.', f;
    end if;
    execute replace(atual, antes, depois);
  end loop;
end $$;
