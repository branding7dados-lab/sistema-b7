-- =========================================================================
-- DIAGNÓSTICO + POSSÍVEL CORREÇÃO — responsável não sendo reconhecido
-- =========================================================================
-- Contexto: depois da limpeza geral e reimportação, "responsavel" está
-- sendo capturado certinho em dados_originais (ex.: "LUIS"), mas
-- video_import_confirmar_linha não conseguiu casar NENHUMA das 414
-- linhas confirmadas com um videomaker_id.
--
-- video_achar_videomaker_por_responsavel só encontra um perfil que seja
-- "elegível" como videomaker — e isso não é só ter o papel = 'videomaker':
-- também vale quem tem a função extra "videomaker" concedida em
-- perfis_funcoes_extra (mecanismo usado, por exemplo, para um
-- admin/coordenador que também edita vídeo). Se Kevin e/ou Kaique estão
-- cadastrados como admin/coordenador (não como papel='videomaker') e
-- NUNCA tiveram essa função extra concedida, video_achar_videomaker_por_
-- responsavel não encontra ninguém elegível pra nenhum nome — o que bate
-- exatamente com o "0 de 414" que você viu.
--
-- PASSO 1 — Rode só a consulta abaixo primeiro (é só leitura, não muda
-- nada) e confira os dois nomes:
-- =========================================================================

select
  p.id,
  p.nome,
  p.papel,
  p.estado,
  public.eh_videomaker_elegivel(p.id) as ja_elegivel_como_videomaker
from public.perfis p
where lower(btrim(split_part(btrim(p.nome), ' ', 1))) in ('kevin', 'kaique')
order by p.nome;

-- =========================================================================
-- PASSO 2 — Se a consulta acima mostrar "ja_elegivel_como_videomaker" =
-- false para Kevin e/ou Kaique, esse é o motivo. O bloco abaixo concede a
-- função extra "videomaker" pra qualquer perfil ativo cujo primeiro nome
-- seja "Kevin" ou "Kaique" e que AINDA NÃO esteja elegível — não mexe em
-- quem já está OK. Reversível (é só apagar a linha de
-- perfis_funcoes_extra depois, se precisar).
--
-- Descomente as linhas abaixo (tire o "--" do início) pra aplicar:
-- =========================================================================

-- insert into public.perfis_funcoes_extra (perfil_id, funcao)
-- select p.id, 'videomaker'
--   from public.perfis p
--  where p.estado = 'ativa'
--    and lower(btrim(split_part(btrim(p.nome), ' ', 1))) in ('kevin', 'kaique')
--    and not public.eh_videomaker_elegivel(p.id)
-- on conflict (perfil_id, funcao) do nothing
-- returning perfil_id, funcao;

-- =========================================================================
-- PASSO 3 — Depois de aplicar (se precisou), rode de novo o
-- video_backfill_responsavel() pra tentar casar retroativamente as 414
-- demandas que ficaram sem responsável:
-- =========================================================================

-- select public.video_backfill_responsavel();
-- select public.video_demandas_responsavel_nao_confiavel();
