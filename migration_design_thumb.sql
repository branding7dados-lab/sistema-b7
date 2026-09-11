/* =====================================================================
   RODADA 5 (parte 1) — MINIATURA OTIMIZADA DOS ARQUIVOS DE DESIGN
   Migração aditiva.

   Problema: todo lugar que mostra uma prévia pequena de uma peça (o
   card de 52px na fila, a bolinha do navegador central) baixava o
   ARQUIVO ORIGINAL inteiro — a mesma imagem de produção em alta
   resolução, só pra desenhar um quadrado de 52px. Em fila com muitas
   peças, isso é banda desperdiçada de verdade (um JPG de 8MB pra
   mostrar um quadradinho).

   Solução: o navegador do Designer gera uma miniatura pequena (JPEG,
   lado maior 320px) via <canvas> NO MOMENTO DO UPLOAD, e ela sobe pro
   Storage ao lado do arquivo original, no mesmo caminho + "-thumb.jpg".
   Esta migração só ensina o banco a guardar e expor esse caminho
   extra — a geração em si é 100% front-end (js/database.js), sem
   depender de nenhum recurso pago do Supabase (Storage image transform
   é plano pago; isto aqui funciona em qualquer plano).

   Também expõe o MIME do último preview em `design_resumo`, pra o
   front-end nunca tentar desenhar como imagem um preview que na
   verdade é vídeo/PDF/etc (bug antigo, silencioso: virava um quadrado
   vazio ou distorcido) — nesses casos mostra o ícone de placeholder
   por formato, igual a quando não tem preview nenhum.

   Compatível com peças antigas: `caminho_thumb` fica nulo pra qualquer
   arquivo enviado antes desta migração; o front-end cai de volta pro
   arquivo original nesse caso (só deixa de usar o original quando o
   MIME não é imagem).
   ===================================================================== */

-- ---------------------------------------------------------------------
-- 1. COLUNA NOVA — caminho da miniatura, no mesmo bucket design-files
-- ---------------------------------------------------------------------
alter table public.design_arquivos add column if not exists caminho_thumb text;

-- ---------------------------------------------------------------------
-- 2. design_arquivo_registrar — aceita o caminho da miniatura (opcional,
--    default null: quem não manda thumb — arquivo não-imagem, upload
--    antigo — continua funcionando exatamente como antes)
-- ---------------------------------------------------------------------
drop function if exists public.design_arquivo_registrar(uuid, text, text, text, text, bigint);

create or replace function public.design_arquivo_registrar(
  p_versao_id uuid, p_papel text, p_nome text, p_caminho text, p_mime text, p_tamanho bigint,
  p_caminho_thumb text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v public.design_versoes%rowtype; d public.design_deliverables%rowtype; novo uuid; pos int;
begin
  select * into v from public.design_versoes where id = p_versao_id for update;
  if not found then raise exception 'Versão não encontrada.' using errcode = 'P0002'; end if;
  select * into d from public.design_deliverables where id = v.deliverable_id;
  if not (public.sou_equipe() or d.designer_id = auth.uid()) then
    raise exception 'Sem permissão para enviar arquivos nesta peça.' using errcode = '42501';
  end if;
  if v.estado not in ('rascunho') then
    raise exception 'Esta versão já foi enviada; crie uma nova versão para novos arquivos.';
  end if;
  if p_papel not in ('preview', 'producao', 'anexo', 'final') then
    raise exception 'Papel de arquivo inválido.';
  end if;

  select coalesce(max(posicao), -1) + 1 into pos from public.design_arquivos where versao_id = v.id and papel = p_papel;

  insert into public.design_arquivos (versao_id, papel, posicao, nome_original, caminho, mime, tamanho_bytes, enviado_por, caminho_thumb)
  values (v.id, p_papel, pos, p_nome, p_caminho, p_mime, p_tamanho, auth.uid(), p_caminho_thumb)
  returning id into novo;

  return novo;
end;
$$;
revoke all on function public.design_arquivo_registrar(uuid, text, text, text, text, bigint, text) from public;
grant execute on function public.design_arquivo_registrar(uuid, text, text, text, text, bigint, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. design_resumo — expõe ultima_previa_thumb + ultima_previa_mime
--    (mesmo SQL base de migration_editorial_versao.sql §9, só com as
--    duas colunas novas na subquery de prévia)
-- ---------------------------------------------------------------------
create or replace view public.design_resumo
with (security_invoker = true) as
select
  d.id, d.client_id, cl.nome as cliente_nome, d.linha_id, le.nome as linha_nome,
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
  (select a.caminho_thumb from public.design_arquivos a
     join public.design_versoes v on v.id = a.versao_id
    where v.deliverable_id = d.id and a.papel = 'preview'
    order by v.numero desc, a.posicao asc limit 1) as ultima_previa_thumb,
  (select a.mime from public.design_arquivos a
     join public.design_versoes v on v.id = a.versao_id
    where v.deliverable_id = d.id and a.papel = 'preview'
    order by v.numero desc, a.posicao asc limit 1) as ultima_previa_mime,
  d.briefing_desatualizado, d.linha_versao_confirmada
from public.design_deliverables d
left join public.clientes cl on cl.id = d.client_id
left join public.linhas_editoriais le on le.id = d.linha_id
left join public.conteudos co on co.id = d.conteudo_id
left join public.perfis pf on pf.id = d.designer_id
where d.deleted_at is null;

grant select on public.design_resumo to authenticated;
