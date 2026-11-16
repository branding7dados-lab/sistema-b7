-- zzz339 — Gerar demandas de edição também a partir das TRENDS da gravação
-- (gravacao_itens tipo 'referencia', e os itens 'avulso'/'conteudo').
-- Antes só os roteiros apareciam no modal "Nova demanda de edição".
-- Cada item vira 1 demanda: título do item, link da trend em referencia_link,
-- observação do item em observacoes. A demanda guarda o item de origem
-- (gravacao_item_id) para não gerar duas vezes.
alter table public.demandas_edicao
  add column if not exists gravacao_item_id uuid references public.gravacao_itens(id) on delete set null;
create index if not exists demandas_edicao_gravacao_item_idx
  on public.demandas_edicao (gravacao_item_id) where gravacao_item_id is not null and deleted_at is null;

create or replace function public.video_gerar_demandas_de_itens(
  p_gravacao_id uuid, p_item_ids uuid[], p_videomaker_id uuid default null, p_prazo date default null)
returns table(item_id uuid, demanda_id uuid, codigo text, ja_existia boolean)
language plpgsql security definer set search_path to 'public'
as $function$
declare
  g public.gravacoes%rowtype; it public.gravacao_itens%rowtype; iid uuid;
  existente public.demandas_edicao%rowtype; nova uuid; codigo_novo text; tit text;
begin
  perform public.exigir_nivel('video', 2);
  if not public.pode_acao('video.criar') then
    raise exception 'Só a equipe gera demandas de edição.' using errcode = '42501';
  end if;
  select * into g from public.gravacoes where id = p_gravacao_id and deleted_at is null;
  if not found then raise exception 'Gravação não encontrada.'; end if;
  if coalesce(array_length(p_item_ids, 1), 0) > 40 then raise exception 'Muitos itens de uma vez.'; end if;

  foreach iid in array coalesce(p_item_ids, '{}') loop
    select * into it from public.gravacao_itens
     where id = iid and gravacao_id = p_gravacao_id and removido_em is null and tipo <> 'roteiro';
    if not found then continue; end if;

    existente := null;
    select de.* into existente from public.demandas_edicao de
     where de.gravacao_item_id = iid and de.deleted_at is null and de.editing_status <> 'descartado' limit 1;
    if existente.id is not null then
      item_id := iid; demanda_id := existente.id; codigo := nullif(existente.codigo, ''); ja_existia := true;
      return next; continue;
    end if;

    tit := left(coalesce(nullif(btrim(it.titulo), ''),
                         (select nullif(btrim(c.titulo), '') from public.conteudos c where c.id = it.conteudo_id),
                         case it.tipo when 'referencia' then 'Trend' when 'conteudo' then 'Conteúdo' else 'Vídeo avulso' end), 120);
    codigo_novo := public._video_proximo_codigo_gravacao(p_gravacao_id);
    nova := public.video_criar_demanda(
      g.client_id, tit, codigo_novo,
      extract(year from coalesce(p_prazo, g.data_gravacao, now()))::int,
      extract(month from coalesce(p_prazo, g.data_gravacao, now()))::int,
      p_gravacao_id, p_videomaker_id, '', p_prazo, coalesce(it.observacao, ''));
    update public.demandas_edicao
       set gravacao_item_id = iid,
           referencia_link = coalesce(nullif(btrim(it.url), ''), referencia_link),
           conteudo_id = coalesce(it.conteudo_id, conteudo_id)
     where id = nova;
    item_id := iid; demanda_id := nova; codigo := codigo_novo; ja_existia := false;
    return next;
  end loop;
end $function$;

revoke all on function public.video_gerar_demandas_de_itens(uuid, uuid[], uuid, date) from public, anon;
grant execute on function public.video_gerar_demandas_de_itens(uuid, uuid[], uuid, date) to authenticated;
