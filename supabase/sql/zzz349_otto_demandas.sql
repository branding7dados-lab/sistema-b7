-- 4.59.0: o Otto mexe nas demandas de edição pelo WhatsApp.
-- otto_acao() roda UMA ação em nome de quem pediu (p_perfil): define o
-- usuário da transação (auth.uid() = p_perfil) e chama as MESMAS funções
-- que a tela usa (video_criar_demanda, video_editar_demanda, ...). Assim
-- valem as permissões, o histórico e os avisos de sempre — o Otto só faz
-- o que essa pessoa já poderia fazer no B7.
-- Só a service role (a função do WhatsApp) chama.
create or replace function public.otto_acao(p_perfil uuid, p_acao text, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  pf public.perfis%rowtype; d jsonb := coalesce(p_dados, '{}'::jsonb);
  novo uuid; cod text; dem public.demandas_edicao%rowtype; res jsonb := '[]'::jsonb; x record;
  g uuid; vm uuid; prz date; rids uuid[]; iids uuid[];
begin
  select * into pf from public.perfis where id = p_perfil;
  if not found or pf.estado <> 'ativa' or pf.papel = 'cliente' then
    return jsonb_build_object('erro', 'Pessoa sem acesso ao sistema.');
  end if;
  perform set_config('request.jwt.claim.sub', p_perfil::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_perfil, 'role', 'authenticated')::text, true);

  vm := nullif(d->>'videomaker_id', '')::uuid;
  prz := nullif(d->>'prazo', '')::date;
  g := nullif(d->>'gravacao_id', '')::uuid;

  if p_acao = 'criar' then
    cod := case when g is not null then public._video_proximo_codigo_gravacao(g) else '' end;
    select coalesce(array_agg(v::uuid), '{}') into rids from jsonb_array_elements_text(coalesce(d->'roteiro_ids', '[]'::jsonb)) v;
    novo := public.video_criar_demanda(
      (d->>'client_id')::uuid, left(btrim(coalesce(d->>'titulo', '')), 120), cod,
      nullif(d->>'competencia_ano', '')::int, nullif(d->>'competencia_mes', '')::int,
      g, vm, '', prz, left(coalesce(d->>'observacoes', ''), 4000), coalesce(nullif(d->>'prioridade', ''), 'normal'),
      p_roteiro_ids => case when array_length(rids, 1) > 0 then rids else null end);
    if coalesce(d->>'referencia_link', '') ~* '^https?://' then
      update public.demandas_edicao set referencia_link = d->>'referencia_link' where id = novo;
    end if;
    if coalesce(d->>'link_material', '') ~* '^https?://' then
      perform public.video_definir_link(novo, d->>'link_material');
    end if;
    return jsonb_build_object('ok', true, 'id', novo, 'codigo', nullif(cod, ''));

  elsif p_acao = 'editar' then
    select * into dem from public.demandas_edicao where id = (d->>'id')::uuid and deleted_at is null;
    if not found then return jsonb_build_object('erro', 'Demanda não encontrada.'); end if;
    if d ? 'titulo' or d ? 'prazo' or d ? 'observacoes' or d ? 'prioridade' then
      perform public.video_editar_demanda(dem.id,
        p_titulo => nullif(left(btrim(coalesce(d->>'titulo', '')), 120), ''),
        p_prazo => prz, p_tem_prazo => d ? 'prazo',
        p_observacoes => case when d ? 'observacoes' then left(coalesce(d->>'observacoes', ''), 4000) else null end,
        p_prioridade => nullif(d->>'prioridade', ''));
    end if;
    if d ? 'videomaker_id' then perform public.video_atribuir(dem.id, vm); end if;
    if coalesce(d->>'status', '') <> '' then perform public.video_mudar_status(dem.id, d->>'status', nullif(d->>'mensagem', '')); end if;
    if coalesce(d->>'referencia_link', '') ~* '^https?://' then
      update public.demandas_edicao set referencia_link = d->>'referencia_link', updated_at = now() where id = dem.id;
    end if;
    if coalesce(d->>'link_material', '') ~* '^https?://' then perform public.video_definir_link(dem.id, d->>'link_material'); end if;
    return jsonb_build_object('ok', true, 'id', dem.id, 'codigo', nullif(dem.codigo, ''));

  elsif p_acao = 'excluir' then
    select * into dem from public.demandas_edicao where id = (d->>'id')::uuid and deleted_at is null;
    if not found then return jsonb_build_object('erro', 'Demanda não encontrada.'); end if;
    perform public.video_excluir_demanda(dem.id);
    return jsonb_build_object('ok', true, 'id', dem.id, 'codigo', nullif(dem.codigo, ''), 'titulo', dem.titulo);

  elsif p_acao = 'gerar_gravacao' then
    -- roteiros (com título e resumo já escritos) + trends/referências/links da gravação
    if jsonb_typeof(d->'roteiros') = 'array' and jsonb_array_length(d->'roteiros') > 0 then
      for x in select * from public.video_criar_demandas_ia(g, d->'roteiros', vm, prz) loop
        res := res || jsonb_build_object('tipo', 'roteiro', 'ref', x.roteiro_id, 'id', x.demanda_id, 'codigo', x.codigo, 'ja_existia', x.ja_existia);
      end loop;
    end if;
    select coalesce(array_agg(v::uuid), '{}') into iids from jsonb_array_elements_text(coalesce(d->'item_ids', '[]'::jsonb)) v;
    if array_length(iids, 1) > 0 then
      for x in select * from public.video_gerar_demandas_de_itens(g, iids, vm, prz) loop
        res := res || jsonb_build_object('tipo', 'item', 'ref', x.item_id, 'id', x.demanda_id, 'codigo', x.codigo, 'ja_existia', x.ja_existia);
      end loop;
    end if;
    return jsonb_build_object('ok', true, 'itens', res);
  end if;
  return jsonb_build_object('erro', 'Ação desconhecida.');
exception when others then
  return jsonb_build_object('erro', sqlerrm);
end $$;
revoke all on function public.otto_acao(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.otto_acao(uuid, text, jsonb) to service_role;

-- quem é "Você" (o celular conectado do B7) quando o Otto mexe nas demandas
alter table public.wa_assistente add column if not exists dono_perfil_id uuid references public.perfis(id) on delete set null;
