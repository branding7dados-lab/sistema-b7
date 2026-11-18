-- 4.79.1 (QA): a leitura do Design era a mais pesada com várias pessoas usando ao mesmo tempo (timeouts).
-- A regra de acesso chamava sou_equipe() e sou_equipe_interna() LINHA POR LINHA. Com (select …) o Postgres
-- calcula uma vez por consulta. Mesma regra, mesmo resultado.
drop policy if exists "design_deliv select" on public.design_deliverables;
create policy "design_deliv select" on public.design_deliverables for select to authenticated using (
  deleted_at is null
  and ((select public.sou_equipe()) or (select public.pode_acao('design.ver_todas')) or designer_id = (select auth.uid()) or designer_id is null)
  and (select public.sou_equipe_interna())
);
