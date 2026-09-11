-- =====================================================================
-- migration_design_logo.sql
-- Rodada 3 do refino de UX do Design (redesenho da página "Design").
-- Uma única coluna nova exposta: a view já faz join com `clientes`
-- (só não selecionava `logo_url`) — recria a view com o mesmo SQL de
-- migration_editorial_versao.sql §9, só acrescentando essa coluna,
-- para o cartão de projeto poder mostrar o logo do cliente quando ele
-- existir, sem consulta nova nem tabela duplicada.
-- Rode uma vez no SQL Editor do Supabase. Idempotente.
-- =====================================================================

create or replace view public.design_resumo
with (security_invoker = true) as
select
  d.id, d.client_id, cl.nome as cliente_nome, cl.logo_url as cliente_logo_url,
  d.linha_id, le.nome as linha_nome,
  d.conteudo_id, co.titulo as conteudo_titulo, co.tipo as conteudo_tipo, co.pilar_id,
  d.tipo, d.titulo, d.designer_id, pf.nome as designer_nome, pf.avatar_url as designer_avatar,
  d.status, d.prazo, d.prioridade, d.origem, d.versao_atual, d.kanban_id,
  d.created_at, d.updated_at, d.finalizado_em,
  (select v.numero from public.design_versoes v where v.deliverable_id = d.id order by v.numero desc limit 1) as ultima_versao,
  (select v.estado from public.design_versoes v where v.deliverable_id = d.id order by v.numero desc limit 1) as ultima_versao_estado,
  (select a.caminho from public.design_arquivos a
     join public.design_versoes v on v.id = a.versao_id
    where v.deliverable_id = d.id and a.papel = 'preview'
    order by v.numero desc, a.posicao asc limit 1) as ultima_previa,
  d.briefing_desatualizado, d.linha_versao_confirmada
from public.design_deliverables d
left join public.clientes cl on cl.id = d.client_id
left join public.linhas_editoriais le on le.id = d.linha_id
left join public.conteudos co on co.id = d.conteudo_id
left join public.perfis pf on pf.id = d.designer_id
where d.deleted_at is null;

grant select on public.design_resumo to authenticated;
