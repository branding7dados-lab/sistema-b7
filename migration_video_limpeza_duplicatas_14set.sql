-- =========================================================================
-- LIMPEZA — demandas duplicadas pela reimportação de 14/09/2026
-- =========================================================================
-- Dois lotes confirmaram, cada um, 367 demandas a partir do MESMO
-- arquivo "PLANILHA DE GRAVAÇÕES (1).xlsx":
--   - 11da4b03-341a-48db-b3fa-8ab191592633  (14/09 15:06 — o original,
--     já com a recuperação de competência aplicada)
--   - ae5632b2-c809-49e9-9fb3-17e0f5bd2f8c  (14/09 17:15 — a
--     reimportação que duplicou tudo)
--
-- Este script marca como excluídas (soft-delete — nunca apaga de
-- verdade) só as demandas do segundo lote que são duplicata EXATA de
-- uma do primeiro, casando pela POSIÇÃO da linha no arquivo
-- (linha_numero) — não por título/código, porque vários títulos "Sem
-- título (planilha)" colidem entre linhas diferentes e um casamento por
-- texto marcaria coisas erradas. Testado localmente antes de gerar
-- este script: 5 duplicatas sintéticas criadas, rodado o mesmo script,
-- as 5 do lote "novo" ficaram marcadas e as 5 do lote "original"
-- permaneceram intocadas.
--
-- Depois de rodar, as 367 demandas do lote 11da4b03 continuam sendo as
-- válidas (e são as que já têm a competência e o responsável
-- recuperados, se você já rodou os backfills). As do lote ae5632b2
-- somem das telas (deleted_at preenchido), mas continuam no banco.
-- =========================================================================

with pares as (
  select o.demanda_id as manter, n.demanda_id as remover
    from public.demandas_edicao_import_linhas o
    join public.demandas_edicao_import_linhas n
      on n.linha_numero = o.linha_numero
     and n.lote_id = 'ae5632b2-c809-49e9-9fb3-17e0f5bd2f8c'
     and o.lote_id = '11da4b03-341a-48db-b3fa-8ab191592633'
   where o.demanda_id is not null and n.demanda_id is not null
)
update public.demandas_edicao d
   set deleted_at = now(), updated_at = now()
  from pares p
 where d.id = p.remover
   and d.deleted_at is null
returning d.id, d.titulo, p.manter as demanda_original_mantida;
