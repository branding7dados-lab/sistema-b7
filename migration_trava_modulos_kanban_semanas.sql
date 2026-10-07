-- =====================================================================
-- TRAVA POR MÓDULO NO BANCO — opção B (Kevin, 07/10/2026) — aplicada.
-- Só os domínios que não aparecem em outras telas:
--   • Produção (quadro)  → módulo "kanban"
--   • Status semanal     → módulo "semanas"
--
-- Políticas RESTRITIVAS novas: somam-se às que já existem (nenhuma
-- política antiga foi alterada ou removida). Valem para leitura e
-- escrita. Quem não é da equipe interna (cliente do Portal) passa
-- direto e continua seguindo a política dele.
-- Administrador tem todos os módulos, então nada muda para ele.
--
-- Para desfazer: drop policy mod_kanban / mod_semanas nas seis tabelas.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['kanban_demandas','kanban_comentarios','kanban_historico'] loop
    execute format('drop policy if exists mod_kanban on public.%I', t);
    execute format('create policy mod_kanban on public.%I as restrictive for all to authenticated using ((select (not public.sou_equipe_interna()) or public.tem_acesso_modulo(''kanban'')))', t);
  end loop;
  foreach t in array array['status_semanais','status_itens','status_versoes'] loop
    execute format('drop policy if exists mod_semanas on public.%I', t);
    execute format('create policy mod_semanas on public.%I as restrictive for all to authenticated using ((select (not public.sou_equipe_interna()) or public.tem_acesso_modulo(''semanas'')))', t);
  end loop;
end $$;
