-- zzz275: APAGAR DEMANDAS EM LOTE — selecionar várias (Edição de vídeo, Design,
-- Produção) e mandar para a lixeira. Nada sai do banco: vira deleted_at, e a
-- Lixeira lista e restaura. Aplicada como: apagar_em_lote_1.

insert into public.acoes (id, modulo, rotulo, descricao, ordem, padrao_funcoes, nivel_min) values
  ('design.excluir', 'design', 'Apagar demandas de Design', 'Mandar peças de design para a lixeira (dá para restaurar).', 47, '{coordenador}', 3),
  ('kanban.excluir', 'kanban', 'Apagar demandas de Produção', 'Mandar demandas do quadro de Produção para a lixeira (dá para restaurar).', 62, '{coordenador}', 3)
on conflict (id) do update set rotulo = excluded.rotulo, descricao = excluded.descricao, ordem = excluded.ordem;

-- p_tipo: video | design | kanban
create or replace function public.demandas_para_lixeira(p_tipo text, p_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return 0; end if;
  if p_tipo = 'video' then
    perform public.exigir_nivel('video', 3);
    if not public.pode_acao('video.excluir') then raise exception 'Sua conta não apaga demandas de edição. Peça à administração para liberar em Funções e permissões.' using errcode = '42501'; end if;
    update public.demandas_edicao set deleted_at = now(), updated_at = now() where id = any(p_ids) and deleted_at is null;
  elsif p_tipo = 'design' then
    perform public.exigir_nivel('design', 3);
    if not public.pode_acao('design.excluir') then raise exception 'Sua conta não apaga peças de design. Peça à administração para liberar em Funções e permissões.' using errcode = '42501'; end if;
    update public.design_deliverables set deleted_at = now(), updated_at = now() where id = any(p_ids) and deleted_at is null;
  elsif p_tipo = 'kanban' then
    perform public.exigir_nivel('kanban', 3);
    if not public.pode_acao('kanban.excluir') then raise exception 'Sua conta não apaga demandas de Produção. Peça à administração para liberar em Funções e permissões.' using errcode = '42501'; end if;
    update public.kanban_demandas set deleted_at = now(), updated_at = now() where id = any(p_ids) and deleted_at is null;
  else
    raise exception 'Tipo desconhecido.';
  end if;
  get diagnostics n = row_count;
  insert into public.atividades (action_type, entity_type, description)
  values ('lixeira', 'demandas_' || p_tipo, n || case when n = 1 then ' demanda movida' else ' demandas movidas' end || ' para a lixeira');
  return n;
end $$;
revoke execute on function public.demandas_para_lixeira(text, uuid[]) from public, anon;
grant execute on function public.demandas_para_lixeira(text, uuid[]) to authenticated;

create or replace function public.demandas_restaurar(p_tipo text, p_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return 0; end if;
  if p_tipo = 'video' then
    if not public.pode_acao('video.excluir') then raise exception 'Sem permissão para restaurar.' using errcode = '42501'; end if;
    update public.demandas_edicao set deleted_at = null, updated_at = now() where id = any(p_ids) and deleted_at is not null;
  elsif p_tipo = 'design' then
    if not public.pode_acao('design.excluir') then raise exception 'Sem permissão para restaurar.' using errcode = '42501'; end if;
    update public.design_deliverables set deleted_at = null, updated_at = now() where id = any(p_ids) and deleted_at is not null;
  elsif p_tipo = 'kanban' then
    if not public.pode_acao('kanban.excluir') then raise exception 'Sem permissão para restaurar.' using errcode = '42501'; end if;
    update public.kanban_demandas set deleted_at = null, updated_at = now() where id = any(p_ids) and deleted_at is not null;
  else
    raise exception 'Tipo desconhecido.';
  end if;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.demandas_restaurar(text, uuid[]) from public, anon;
grant execute on function public.demandas_restaurar(text, uuid[]) to authenticated;

-- o que está na lixeira (90 dias), só do que a pessoa pode restaurar
create or replace function public.demandas_lixeira()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'quando' desc), '[]'::jsonb) from (
    select jsonb_build_object('tipo', 'video', 'id', d.id, 'nome', d.titulo, 'cliente', c.nome, 'quando', d.deleted_at) x
      from public.demandas_edicao d left join public.clientes c on c.id = d.client_id
     where d.deleted_at is not null and d.deleted_at > now() - interval '90 days' and public.pode_acao('video.excluir')
    union all
    select jsonb_build_object('tipo', 'design', 'id', d.id, 'nome', d.titulo, 'cliente', c.nome, 'quando', d.deleted_at)
      from public.design_deliverables d left join public.clientes c on c.id = d.client_id
     where d.deleted_at is not null and d.deleted_at > now() - interval '90 days' and public.pode_acao('design.excluir')
    union all
    select jsonb_build_object('tipo', 'kanban', 'id', d.id, 'nome', d.titulo, 'cliente', c.nome, 'quando', d.deleted_at)
      from public.kanban_demandas d left join public.clientes c on c.id = d.client_id
     where d.deleted_at is not null and d.deleted_at > now() - interval '90 days' and public.pode_acao('kanban.excluir')
  ) t
$$;
revoke execute on function public.demandas_lixeira() from public, anon;
grant execute on function public.demandas_lixeira() to authenticated;
