-- =====================================================================
-- CORREÇÃO DE BUG: "Nova demanda de edição" parou de funcionar depois
-- da Parte 2 da auditoria (17/09/2026) — reportado por você com print,
-- ainda no mesmo dia.
--
-- Causa raiz: ao adicionar o parâmetro p_roteiro_ids em
-- video_criar_demanda na migration anterior
-- (migration_video_multiplos_roteiros.sql), o `create or replace
-- function` com uma lista de parâmetros DIFERENTE (13 parâmetros em
-- vez de 12) não substituiu a função antiga — o Postgres identifica
-- uma função pelo nome + assinatura de parâmetros, então isso criou
-- uma SEGUNDA função com o mesmo nome, deixando as duas versões (12 e
-- 13 parâmetros) coexistindo no banco. Quando o app chama
-- video_criar_demanda sem informar p_roteiro_ids (o caso comum: criar
-- uma demanda manual, com ou sem roteiro — js/database.js nunca manda
-- essa chave, só p_roteiro_id), o PostgREST não conseguia decidir qual
-- das duas funções chamar, e devolvia "Could not choose the best
-- candidate function", quebrando TODA criação manual de demanda.
--
-- Já aplicado em produção nesta rodada (Supabase MCP), testado com uma
-- chamada idêntica à que o app faz de verdade antes de confirmar.
-- Este arquivo fica só para o histórico de migrations do repositório.
-- =====================================================================
drop function if exists public.video_criar_demanda(
  uuid, text, text, integer, integer, uuid, uuid, text, date, text, text, uuid
);
