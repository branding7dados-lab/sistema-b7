-- =====================================================================
-- PAINEL DO COORDENADOR — função extra "coordenador"  (29/09/2026)
--
-- Única mudança de schema da fase 2 do Painel. Sem ela, "Administrador
-- + Coordenador de mídias" não existe no modelo: funções extras só
-- aceitavam 'videomaker'/'designer'. Nada de RLS muda: a função extra de
-- coordenação só é aceita para Administrador (validado no b7-auth), que
-- já tem no banco todas as permissões de coordenação. Ela só liga o
-- Painel do Coordenador no frontend (B7.Perm.painelVisoes).
--
-- Idempotente.
-- =====================================================================
alter table public.perfis_funcoes_extra
  drop constraint if exists perfis_funcoes_extra_funcao_check;
alter table public.perfis_funcoes_extra
  add constraint perfis_funcoes_extra_funcao_check
  check (funcao = any (array['videomaker'::text, 'designer'::text, 'coordenador'::text]));
