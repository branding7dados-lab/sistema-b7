-- =========================================================================
-- B7 VÍDEO — LOGO DO CLIENTE NA VIEW DE RESUMO (rodada r)
-- =========================================================================
-- Pedido: mostrar a logo do cliente na Lista, no Quadro e no detalhe da
-- demanda. A logo do cliente já existia (clientes.logo_url, cadastrada em
-- Clientes) — só faltava a view demandas_edicao_resumo (de onde a tela de
-- Vídeo lê tudo, equipe e videomaker) expor essa coluna. Aditivo: mesma
-- view de sempre, mesmas colunas, só uma nova no fim.
-- =========================================================================
create or replace view public.demandas_edicao_resumo
with (security_invoker = true) as
select
  de.id, de.client_id, de.gravacao_id, de.videomaker_id,
  de.competencia_ano, de.competencia_mes, de.codigo, de.titulo, de.pacote, de.prazo,
  de.link_material, de.editing_status, de.observacoes, de.origem, de.import_lote_id,
  de.criado_por, de.created_at, de.updated_at, de.entregue_em, de.deleted_at,
  cl.nome as cliente_nome,
  coalesce(cl.servico, 'ativo') as cliente_servico,
  pf.nome as videomaker_nome,
  g.situacao as gravacao_situacao,
  g.nome as gravacao_nome,
  de.kanban_id,
  de.prioridade,
  de.roteiro_id,
  de.standby_revisar_em,
  cl.logo_url as cliente_logo_url
from public.demandas_edicao de
left join public.clientes cl on cl.id = de.client_id
left join public.perfis pf on pf.id = de.videomaker_id
left join public.gravacoes g on g.id = de.gravacao_id
where de.deleted_at is null;
grant select on public.demandas_edicao_resumo to authenticated;
