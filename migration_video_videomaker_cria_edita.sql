-- =====================================================================
-- VIDEOMAKER CRIA E EDITA DEMANDAS DE EDIÇÃO (zzz64, 07/10/2026)
--
-- Pedido do Kevin: o videomaker precisa criar demanda de vídeo e editar
-- os dados de uma demanda. Até aqui as funções abaixo só aceitavam a
-- equipe (admin/coordenador) e recusavam o videomaker com erro 42501.
--
-- O que muda: a trava de entrada de SEIS funções passa de
--     if not public.sou_equipe()
-- para
--     if not (public.sou_equipe() or public.sou_videomaker())
-- e mais nada. O corpo de cada função fica idêntico.
--
--   video_criar_demanda                criar demanda manual
--   video_gerar_demandas_de_gravacao   criar a partir dos roteiros de uma gravação
--   video_gerar_demanda_agrupada       idem, vários roteiros numa demanda só
--   video_editar_demanda               nome, código, pacote, prazo, prioridade, observações, gravação
--   video_definir_roteiros             roteiros vinculados à demanda
--   video_definir_standby              data de revisão do standby
--
-- O que NÃO muda (continua só da equipe): video_atribuir (trocar o
-- responsável), video_excluir_demanda, descartar, decisão do cliente,
-- entrega, pacotes, fechamento de mês, importação e gestão.
--
-- Nenhuma política de RLS é alterada: o videomaker já lia gravações,
-- roteiros, cenas e clientes (sou_equipe_interna()). Nenhuma tabela,
-- coluna ou dado é tocado.
--
-- Idempotente: rodar de novo não faz nada (a trava antiga já não existe).
-- Se alguma função não tiver exatamente UMA trava no formato esperado, a
-- migração para com erro em vez de alterar às cegas.
-- =====================================================================
do $$
declare
  f text;
  def text;
  n int;
begin
  foreach f in array array[
    'video_criar_demanda', 'video_gerar_demandas_de_gravacao', 'video_gerar_demanda_agrupada',
    'video_editar_demanda', 'video_definir_roteiros', 'video_definir_standby'
  ] loop
    select pg_get_functiondef(p.oid) into def
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = f;
    if def is null then
      raise exception 'Função % não encontrada.', f;
    end if;
    if position('if not (public.sou_equipe() or public.sou_videomaker()) then' in def) > 0 then
      continue;   -- já migrada
    end if;
    n := (length(def) - length(replace(def, 'if not public.sou_equipe() then', ''))) / length('if not public.sou_equipe() then');
    if n <> 1 then
      raise exception 'Função %: esperava 1 trava "if not public.sou_equipe() then", achei %.', f, n;
    end if;
    execute replace(def, 'if not public.sou_equipe() then',
                         'if not (public.sou_equipe() or public.sou_videomaker()) then');
  end loop;
end $$;

-- As mensagens de erro antigas ("Só a equipe…") continuam no corpo das
-- funções; elas só aparecem para quem não é equipe nem videomaker
-- (designer, cliente), para quem seguem verdadeiras o bastante.
