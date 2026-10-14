-- zzz166 (aplicado pelo Claude no Supabase em 14/10)
-- 1) cargos sem limite: perfis.funcoes_adicionais + tenho_funcao_extra/sou_designer/sou_equipe/modulos_efetivos/minha_sessao
--    consideram os cargos adicionais; perfil_definir_cargos(p_id, p_cargos) só para administrador;
--    design_atribuir aceita quem tem Designer como cargo adicional.
-- 2) clientes.modo vira lista ("linha,semana,roteiros").
alter table public.perfis add column if not exists funcoes_adicionais text[] not null default '{}';
alter table public.perfis add constraint perfis_funcoes_adicionais_validas check (funcoes_adicionais <@ array['coordenador','designer','videomaker']::text[]);
alter table public.clientes drop constraint clientes_modo_chk, add constraint clientes_modo_chk check (modo ~ '^(linha|semana|roteiros)(,(linha|semana|roteiros))*$');
-- (definições completas das funções: ver o relatório zzz166)
