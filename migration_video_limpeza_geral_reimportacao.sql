-- =========================================================================
-- LIMPEZA GERAL — demandas de vídeo importadas, para reimportar do zero
-- =========================================================================
-- Por pedido seu: marca como excluída (soft-delete — o sistema nunca
-- apaga de verdade, mesmo mecanismo usado em toda parte) TODA demanda
-- de vídeo com origem = 'importacao', de qualquer lote. Demandas
-- criadas manualmente pela tela (origem = 'manual') NÃO são tocadas.
--
-- Depois de rodar este script, a "Produção de Vídeo" fica sem nenhuma
-- demanda importada (as manuais continuam aparecendo normalmente).
-- Você pode então reimportar a planilha do zero, já com o pipeline
-- corrigido (build 2026-09-14-h): competência, prioridade e
-- responsável extraídos corretamente linha a linha, e a trava contra
-- duplicata não vai barrar nada aqui porque as demandas antigas já
-- estarão marcadas como excluídas (a checagem de duplicata só olha
-- demandas ATIVAS).
--
-- Reversível: nada foi apagado de verdade. Se precisar desfazer,
-- é só rodar um UPDATE limpando deleted_at das mesmas linhas (me avise
-- se precisar — eu preparo).
-- =========================================================================

with excluidas as (
  update public.demandas_edicao
     set deleted_at = now(), updated_at = now()
   where origem = 'importacao'
     and deleted_at is null
  returning id, titulo, client_id
)
select e.id, e.titulo, cl.nome as cliente
  from excluidas e
  left join public.clientes cl on cl.id = e.client_id
 order by cl.nome, e.titulo;
