-- =========================================================================
-- DIAGNÓSTICO 2 — responsável ainda não casando (a suspeita da elegibilidade
-- caiu: Kevin e Kaique já aparecem como ja_elegivel_como_videomaker = true)
-- =========================================================================
-- Roda os quatro blocos abaixo, um de cada vez, e me manda os resultados.
-- Todos são só leitura — nenhum muda nada no banco.

-- 1) A função de casamento por nome existe mesmo no seu banco?
select proname, pg_get_functiondef(oid) as definicao
  from pg_proc
 where proname = 'video_achar_videomaker_por_responsavel';

-- 2) video_import_confirmar_linha (a função que roda quando você confirma
--    uma linha da planilha) está na versão nova, com a lógica de
--    responsável? Se o texto devolvido NÃO tiver a palavra
--    "responsavel_planilha", é sinal de que a migration_video_responsavel.sql
--    (rodada g) nunca chegou a ser aplicada nesse banco.
select pg_get_functiondef('public.video_import_confirmar_linha'::regproc) as definicao;

-- 3) Quais valores de "responsavel" vieram na planilha, e quantas linhas
--    cada um tem, olhando só o lote mais recente confirmado:
with ultimo_lote as (
  select lote_id
    from public.demandas_edicao_import_linhas
   where confirmada
   group by lote_id
   order by max(created_at) desc
   limit 1
)
select
  coalesce(nullif(btrim(l.dados_originais->>'responsavel'), ''), '(vazio)') as responsavel_planilha,
  count(*) as qtd
from public.demandas_edicao_import_linhas l
join ultimo_lote u on u.lote_id = l.lote_id
where l.confirmada
group by 1
order by 2 desc;

-- 4) Testa a função de casamento direto contra cada valor distinto que
--    apareceu na planilha (mostra se acha alguém ou não, pra cada nome):
with ultimo_lote as (
  select lote_id
    from public.demandas_edicao_import_linhas
   where confirmada
   group by lote_id
   order by max(created_at) desc
   limit 1
),
nomes as (
  select distinct nullif(btrim(l.dados_originais->>'responsavel'), '') as responsavel_planilha
    from public.demandas_edicao_import_linhas l
    join ultimo_lote u on u.lote_id = l.lote_id
   where l.confirmada
)
select
  responsavel_planilha,
  public.video_achar_videomaker_por_responsavel(responsavel_planilha) as videomaker_encontrado
from nomes
order by 1;
