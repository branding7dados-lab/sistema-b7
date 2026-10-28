-- zzz277: DEMANDAS DE EDIÇÃO PELA IA — a IA lê os roteiros da gravação e propõe
-- título e resumo de cada vídeo; a pessoa revisa na tela e confirma. Esta função
-- cria o que foi confirmado (mesma regra de video_gerar_demandas_de_gravacao:
-- um roteiro com demanda ativa nunca ganha outra). Aplicada como: demandas_ia_1.
create or replace function public.video_criar_demandas_ia(p_gravacao_id uuid, p_itens jsonb, p_videomaker_id uuid default null, p_prazo date default null)
returns table(roteiro_id uuid, demanda_id uuid, codigo text, ja_existia boolean)
language plpgsql security definer set search_path = public as $$
declare
  g public.gravacoes%rowtype; r public.roteiros%rowtype; it jsonb; rid uuid; tit text; obs text; prz date;
  existente public.demandas_edicao%rowtype; nova uuid; codigo_novo text;
begin
  perform public.exigir_nivel('video', 2);
  if not public.pode_acao('video.criar') then
    raise exception 'Sua conta não cria demandas de edição.' using errcode = '42501';
  end if;
  select * into g from public.gravacoes where id = p_gravacao_id and deleted_at is null;
  if not found then raise exception 'Gravação não encontrada.'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then return; end if;
  if jsonb_array_length(p_itens) > 40 then raise exception 'Muitos itens de uma vez.'; end if;

  for it in select * from jsonb_array_elements(p_itens) loop
    begin rid := (it->>'roteiro_id')::uuid; exception when others then continue; end;
    select * into r from public.roteiros where id = rid and recording_session_id = p_gravacao_id and deleted_at is null;
    if not found then continue; end if;
    tit := left(btrim(coalesce(it->>'titulo', '')), 120);
    if tit = '' then tit := coalesce(nullif(btrim(r.titulo), ''), g.nome); end if;
    obs := left(btrim(coalesce(it->>'resumo', '')), 2000);
    prz := coalesce(nullif(it->>'prazo', '')::date, p_prazo);

    existente := null;
    select de.* into existente from public.demandas_edicao de
     where de.roteiro_id = rid and de.deleted_at is null and de.editing_status <> 'descartado' limit 1;
    if existente.id is not null then
      roteiro_id := rid; demanda_id := existente.id; codigo := nullif(existente.codigo, ''); ja_existia := true;
      return next; continue;
    end if;

    begin
      codigo_novo := public._video_proximo_codigo_gravacao(p_gravacao_id);
      nova := public.video_criar_demanda(
        g.client_id, tit, codigo_novo,
        extract(year from coalesce(prz, g.data_gravacao, now()))::int,
        extract(month from coalesce(prz, g.data_gravacao, now()))::int,
        p_gravacao_id, coalesce(p_videomaker_id, g.videomaker_id), '', prz, obs,
        p_roteiro_id => rid
      );
      roteiro_id := rid; demanda_id := nova; codigo := codigo_novo; ja_existia := false;
      return next;
    exception when unique_violation then
      select de.* into existente from public.demandas_edicao de
       where de.roteiro_id = rid and de.deleted_at is null and de.editing_status <> 'descartado' limit 1;
      roteiro_id := rid; demanda_id := existente.id; codigo := nullif(existente.codigo, ''); ja_existia := true;
      return next;
    end;
  end loop;
end $$;
revoke execute on function public.video_criar_demandas_ia(uuid, jsonb, uuid, date) from public, anon;
grant execute on function public.video_criar_demandas_ia(uuid, jsonb, uuid, date) to authenticated;
