-- =====================================================================
-- ADMIN: RESUMO DA SEMANA (IA) E SUGESTÃO DE REDISTRIBUIÇÃO (zzz141)
--
-- Duas funções de LEITURA, só para administrador. Nenhuma tabela,
-- regra de acesso (RLS) ou dado existente é alterado.
--
--   agencia_semana_dados()      os números dos últimos 7 dias, contados
--                               pelo sistema. A IA só escreve o texto em
--                               cima deles (b7-ia, tarefa "agencia").
--   redistribuicao_sugestoes()  quem está com muito mais trabalho que
--                               outra pessoa da mesma função e quais
--                               itens AINDA NÃO COMEÇADOS poderiam
--                               passar para ela. Só sugere: quem muda o
--                               responsável é o administrador, na tela,
--                               pelas funções que já existem
--                               (video_atribuir, design_atribuir), com o
--                               histórico delas.
-- =====================================================================

create or replace function public.agencia_semana_dados()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_video jsonb; v_design jsonb; v_cont jsonb; v_grav jsonb; v_carga jsonb; v_cli jsonb;
  v_abertas_video constant text[] := array['pendente', 'em_edicao', 'aguardando_aprovacao'];
begin
  if not public.sou_admin() then
    raise exception 'Só administrador vê o resumo da agência.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'entregues_7d', count(*) filter (where entregue_em >= now() - interval '7 days'),
    'abertas', count(*) filter (where editing_status = any (v_abertas_video)),
    'atrasadas', count(*) filter (where editing_status = any (v_abertas_video) and prazo < hoje),
    'paradas_5d', count(*) filter (where editing_status in ('pendente', 'em_edicao') and updated_at < now() - interval '5 days'))
    into v_video from public.demandas_edicao where deleted_at is null;

  select jsonb_build_object(
    'finalizadas_7d', count(*) filter (where finalizado_em >= now() - interval '7 days'),
    'abertas', count(*) filter (where status <> 'finalizado'),
    'atrasadas', count(*) filter (where status <> 'finalizado' and prazo < hoje),
    'paradas_5d', count(*) filter (where status in ('em_criacao', 'revisao_interna') and updated_at < now() - interval '5 days'))
    into v_design from public.design_deliverables where deleted_at is null;

  select jsonb_build_object(
    'publicados_7d', count(*) filter (where status = 'Publicado' and data_postagem between hoje - 6 and hoje),
    'programados_proximos_7d', count(*) filter (where status = 'Programado' and data_postagem between hoje and hoje + 7))
    into v_cont from public.conteudos where deleted_at is null and archived_at is null;

  select jsonb_build_object(
    'realizadas_7d', count(*) filter (where concluida_em >= now() - interval '7 days'),
    'proximas_7d', count(*) filter (where concluida_em is null and data_gravacao between hoje and hoje + 7))
    into v_grav from public.gravacoes where deleted_at is null and archived_at is null;

  select coalesce(jsonb_agg(x order by x ->> 'nome'), '[]'::jsonb) into v_carga from (
    select jsonb_build_object('nome', coalesce(nullif(btrim(p.nome), ''), p.username), 'funcao', coalesce(p.funcao, p.papel),
      'video', (select count(*) from public.demandas_edicao d where d.videomaker_id = p.id and d.deleted_at is null and d.editing_status = any (v_abertas_video)),
      'design', (select count(*) from public.design_deliverables g where g.designer_id = p.id and g.deleted_at is null and g.status <> 'finalizado'),
      'kanban', (select count(*) from public.kanban_demandas k where k.responsavel_id = p.id and k.deleted_at is null and k.arquivada_em is null and k.concluida_em is null)) x
      from public.perfis p where p.estado = 'ativa' and p.papel <> 'cliente') t
   where (x ->> 'video')::int + (x ->> 'design')::int + (x ->> 'kanban')::int > 0;

  select coalesce(jsonb_agg(jsonb_build_object('cliente', q.nome, 'video_atrasado', q.v, 'design_atrasado', q.g) order by q.v + q.g desc), '[]'::jsonb) into v_cli from (
    select t.nome, t.v, t.g from (
      select c.nome,
        (select count(*) from public.demandas_edicao d where d.client_id = c.id and d.deleted_at is null and d.editing_status = any (v_abertas_video) and d.prazo < hoje) v,
        (select count(*) from public.design_deliverables g where g.client_id = c.id and g.deleted_at is null and g.status <> 'finalizado' and g.prazo < hoje) g
        from public.clientes c where c.deleted_at is null) t
     where t.v + t.g > 0 order by t.v + t.g desc limit 5) q;

  return jsonb_build_object('hoje', hoje, 'de', hoje - 6, 'video', v_video, 'design', v_design, 'conteudo', v_cont,
    'gravacoes', v_grav, 'carga', v_carga, 'clientes_atencao', v_cli);
end
$$;
revoke all on function public.agencia_semana_dados() from public, anon;
grant execute on function public.agencia_semana_dados() to authenticated;

-- quem é da função (a principal ou uma extra) e quanto tem em aberto
create or replace function public._carga_funcao(p_area text)
returns table (id uuid, nome text, abertas integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, coalesce(nullif(btrim(p.nome), ''), p.username)::text,
    case p_area
      when 'design' then (select count(*)::int from public.design_deliverables g where g.designer_id = p.id and g.deleted_at is null and g.status <> 'finalizado')
      else (select count(*)::int from public.demandas_edicao d where d.videomaker_id = p.id and d.deleted_at is null and d.editing_status in ('pendente', 'em_edicao', 'aguardando_aprovacao')) end
    from public.perfis p
   where p.estado = 'ativa' and p.papel <> 'cliente'
     and (p.funcao = case p_area when 'design' then 'designer' else 'videomaker' end
          or exists (select 1 from public.perfis_funcoes_extra e where e.perfil_id = p.id and e.funcao = case p_area when 'design' then 'designer' else 'videomaker' end));
$$;
revoke all on function public._carga_funcao(text) from public, anon, authenticated;

create or replace function public.redistribuicao_sugestoes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_res jsonb := '[]'::jsonb;
  v_area text;
  v_pessoas jsonb;
  v_o record; v_d record;
  v_k int; v_nao int; v_itens jsonb;
begin
  if not public.sou_admin() then
    raise exception 'Só administrador vê as sugestões de redistribuição.' using errcode = '42501';
  end if;

  foreach v_area in array array['design', 'video'] loop
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'abertas', c.abertas) order by c.abertas desc), '[]'::jsonb)
      into v_pessoas from public._carga_funcao(v_area) c;
    select * into v_o from public._carga_funcao(v_area) order by abertas desc, nome limit 1;
    select * into v_d from public._carga_funcao(v_area) c where c.id is distinct from v_o.id order by c.abertas asc, c.nome limit 1;

    if v_o.id is null or v_d.id is null or v_o.abertas - v_d.abertas < 4 or v_o.abertas < 1.5 * greatest(v_d.abertas, 1) then
      v_res := v_res || jsonb_build_array(jsonb_build_object('area', v_area, 'equilibrado', true, 'pessoas', v_pessoas));
      continue;
    end if;

    -- só o que ainda NÃO COMEÇOU, os de prazo mais distante (ou sem prazo) primeiro
    if v_area = 'design' then
      select count(*) into v_nao from public.design_deliverables where designer_id = v_o.id and deleted_at is null and status = 'aguardando_producao';
    else
      select count(*) into v_nao from public.demandas_edicao where videomaker_id = v_o.id and deleted_at is null and editing_status = 'pendente';
    end if;
    v_k := least((v_o.abertas - v_d.abertas) / 2, v_nao, 10);
    if v_k < 1 then
      v_res := v_res || jsonb_build_array(jsonb_build_object('area', v_area, 'equilibrado', false, 'sem_itens', true, 'pessoas', v_pessoas,
        'origem', jsonb_build_object('id', v_o.id, 'nome', v_o.nome, 'abertas', v_o.abertas),
        'destino', jsonb_build_object('id', v_d.id, 'nome', v_d.nome, 'abertas', v_d.abertas)));
      continue;
    end if;

    if v_area = 'design' then
      select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'titulo', t.titulo, 'cliente', t.cliente, 'prazo', t.prazo)), '[]'::jsonb) into v_itens from (
        select g.id, g.titulo, c.nome cliente, g.prazo from public.design_deliverables g join public.clientes c on c.id = g.client_id
         where g.designer_id = v_o.id and g.deleted_at is null and g.status = 'aguardando_producao'
         order by g.prazo desc nulls first limit v_k) t;
    else
      select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'titulo', t.titulo, 'cliente', t.cliente, 'prazo', t.prazo)), '[]'::jsonb) into v_itens from (
        select d.id, coalesce(nullif(d.codigo, '') || ' · ', '') || coalesce(d.titulo, 'sem título') titulo, c.nome cliente, d.prazo from public.demandas_edicao d join public.clientes c on c.id = d.client_id
         where d.videomaker_id = v_o.id and d.deleted_at is null and d.editing_status = 'pendente'
         order by d.prazo desc nulls first limit v_k) t;
    end if;

    v_res := v_res || jsonb_build_array(jsonb_build_object('area', v_area, 'equilibrado', false, 'pessoas', v_pessoas,
      'origem', jsonb_build_object('id', v_o.id, 'nome', v_o.nome, 'abertas', v_o.abertas),
      'destino', jsonb_build_object('id', v_d.id, 'nome', v_d.nome, 'abertas', v_d.abertas),
      'itens', v_itens, 'nao_iniciadas', v_nao));
  end loop;
  return jsonb_build_object('areas', v_res);
end
$$;
revoke all on function public.redistribuicao_sugestoes() from public, anon;
grant execute on function public.redistribuicao_sugestoes() to authenticated;
