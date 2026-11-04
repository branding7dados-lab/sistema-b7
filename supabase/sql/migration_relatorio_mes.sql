-- zzz254: relatório do mês por cliente e por pessoa (só a equipe de gestão).
-- Lê o que já existe; nada é gravado.
--   pessoas: artes e vídeos entregues no mês, quantos no prazo, abertos atrasados hoje,
--            versões por arte (quanto ajuste precisou);
--   clientes: posts planejados/publicados no mês, artes e vídeos entregues, entregas
--             atrasadas, aprovações enviadas/aprovadas/com ajuste e o tempo médio de resposta.
create or replace function public.relatorio_mes(p_ano int, p_mes int)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare ini date; fim date; hoje date := public.notif_hoje(); pessoas jsonb; clientes jsonb;
begin
  if not public.sou_equipe() then raise exception 'Só a coordenação e a administração veem o relatório.' using errcode = '42501'; end if;
  if p_mes not between 1 and 12 or p_ano not between 2020 and 2100 then raise exception 'Mês inválido.'; end if;
  ini := make_date(p_ano, p_mes, 1); fim := (ini + interval '1 month')::date;

  with de as (
    select d.designer_id pid, count(*) entregues,
           count(*) filter (where d.prazo is not null and (d.finalizado_em at time zone 'America/Sao_Paulo')::date <= d.prazo) no_prazo,
           count(*) filter (where d.prazo is not null) com_prazo,
           round(avg(greatest(coalesce(d.versao_atual, 1), 1))::numeric, 1) versoes
      from public.design_deliverables d
     where d.deleted_at is null and d.designer_id is not null
       and d.finalizado_em >= ini and d.finalizado_em < fim
     group by 1),
  da as (select designer_id pid, count(*) n from public.design_deliverables
          where deleted_at is null and designer_id is not null and prazo < hoje
            and status not in ('finalizado', 'aprovado_cliente') group by 1),
  ve as (
    select v.videomaker_id pid, count(*) entregues,
           count(*) filter (where v.prazo is not null and (v.entregue_em at time zone 'America/Sao_Paulo')::date <= v.prazo) no_prazo,
           count(*) filter (where v.prazo is not null) com_prazo
      from public.demandas_edicao v
     where v.deleted_at is null and v.videomaker_id is not null and v.editing_status = 'entregue'
       and v.entregue_em >= ini and v.entregue_em < fim
     group by 1),
  va as (select videomaker_id pid, count(*) n from public.demandas_edicao
          where deleted_at is null and videomaker_id is not null and prazo < hoje
            and editing_status not in ('entregue', 'descartado') group by 1)
  select coalesce(jsonb_agg(x order by (x->>'entregues')::int desc, x->>'nome'), '[]'::jsonb) into pessoas from (
    select jsonb_build_object('id', p.id, 'nome', p.nome, 'funcao', coalesce(p.funcao, p.papel), 'foto', p.avatar_url,
      'artes', coalesce(de.entregues, 0), 'artes_no_prazo', coalesce(de.no_prazo, 0), 'artes_com_prazo', coalesce(de.com_prazo, 0),
      'versoes_por_arte', de.versoes, 'artes_atrasadas_abertas', coalesce(da.n, 0),
      'videos', coalesce(ve.entregues, 0), 'videos_no_prazo', coalesce(ve.no_prazo, 0), 'videos_com_prazo', coalesce(ve.com_prazo, 0),
      'videos_atrasados_abertos', coalesce(va.n, 0),
      'entregues', coalesce(de.entregues, 0) + coalesce(ve.entregues, 0)) x
      from public.perfis p
      left join de on de.pid = p.id left join da on da.pid = p.id
      left join ve on ve.pid = p.id left join va on va.pid = p.id
     where p.papel <> 'cliente'
       and (de.pid is not null or da.pid is not null or ve.pid is not null or va.pid is not null)) s;

  with ct as (
    select client_id cid, count(*) planejados, count(*) filter (where status = 'Publicado') publicados
      from public.conteudos where deleted_at is null and archived_at is null
       and data_postagem >= ini and data_postagem < fim group by 1),
  ar as (
    select client_id cid, count(*) entregues,
           count(*) filter (where prazo is not null and (finalizado_em at time zone 'America/Sao_Paulo')::date > prazo) atrasadas
      from public.design_deliverables where deleted_at is null and finalizado_em >= ini and finalizado_em < fim group by 1),
  vi as (
    select client_id cid, count(*) entregues,
           count(*) filter (where prazo is not null and (entregue_em at time zone 'America/Sao_Paulo')::date > prazo) atrasados
      from public.demandas_edicao where deleted_at is null and editing_status = 'entregue'
       and entregue_em >= ini and entregue_em < fim group by 1),
  ap as (
    select client_id cid, count(*) enviadas,
           count(*) filter (where situacao = 'aprovado') aprovadas,
           count(*) filter (where situacao in ('ajustes', 'recusado')) ajustes,
           round(avg(extract(epoch from decidido_em - enviado_em) / 3600) filter (where decidido_em is not null and origem_decisao is distinct from 'externa' and decidido_em > enviado_em)::numeric, 1) horas
      from public.aprovacoes where deleted_at is null and situacao not in ('substituido', 'cancelado')
       and enviado_em >= ini and enviado_em < fim group by 1)
  select coalesce(jsonb_agg(x order by x->>'nome'), '[]'::jsonb) into clientes from (
    select jsonb_build_object('id', c.id, 'nome', c.nome, 'logo', c.logo_url,
      'planejados', coalesce(ct.planejados, 0), 'publicados', coalesce(ct.publicados, 0),
      'artes', coalesce(ar.entregues, 0), 'artes_atrasadas', coalesce(ar.atrasadas, 0),
      'videos', coalesce(vi.entregues, 0), 'videos_atrasados', coalesce(vi.atrasados, 0),
      'aprov_enviadas', coalesce(ap.enviadas, 0), 'aprov_aprovadas', coalesce(ap.aprovadas, 0),
      'aprov_ajustes', coalesce(ap.ajustes, 0), 'resposta_horas', ap.horas) x
      from public.clientes c
      left join ct on ct.cid = c.id left join ar on ar.cid = c.id
      left join vi on vi.cid = c.id left join ap on ap.cid = c.id
     where c.deleted_at is null and coalesce(c.teste, false) = false
       and (ct.cid is not null or ar.cid is not null or vi.cid is not null or ap.cid is not null)) s;

  return jsonb_build_object('ano', p_ano, 'mes', p_mes, 'pessoas', pessoas, 'clientes', clientes);
end $$;
revoke all on function public.relatorio_mes(int, int) from public, anon;
grant execute on function public.relatorio_mes(int, int) to authenticated;
