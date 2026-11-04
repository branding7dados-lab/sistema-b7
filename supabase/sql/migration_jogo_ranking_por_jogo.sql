-- 4.9.0: ranking separado por jogo (ver relatório v4.9.0)
alter table public.jogo_pontos add column if not exists jogo text not null default 'corta';
-- funções jogo_registrar_v2 / jogo_ranking_v2: aplicadas pelo painel de migrações (mesmo texto do relatório)
