-- =====================================================================
-- B7 STATUS SEMANAL — status por formato + segunda data (Reel) + texto
-- de status para o cliente
--
-- Aditiva e idempotente. Não altera nem apaga nada do que já existe:
-- `status_itens.situacao` continua sendo texto livre (nunca teve CHECK
-- constraint), então os novos rótulos de status específicos por formato
-- não exigem nenhuma migração de dados — o front-end passa a oferecer um
-- vocabulário mais específico por formato, mas registros antigos com os
-- rótulos genéricos de antes (Previsto, Em andamento, Concluído...)
-- continuam funcionando exatamente como antes.
--
-- Rode no SQL Editor do Supabase, depois de migration_semana.sql.
-- =====================================================================

-- Reel pode ter data de gravação (campo `data`, já existente — é o que
-- posiciona a demanda no dia da grade) e data de postagem separada,
-- quando as duas existem de verdade. Nunca obrigatório.
alter table public.status_itens add column if not exists data_postagem date;

-- Texto opcional de como o status aparece PARA O CLIENTE, quando a
-- equipe quer simplificar o rótulo interno sem mudar o status real
-- (ex.: internamente "Ajustes solicitados após revisão interna",
-- cliente vê só "Corrigindo arte"). Nunca substitui `situacao` — é só
-- apresentação; o filtro de itens concluídos e a legenda continuam
-- usando `situacao`, o estado real.
alter table public.status_itens add column if not exists situacao_cliente text;
