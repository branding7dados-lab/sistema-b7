-- zzz280: Retrospectiva do mês — o "resumo do ano" do Spotify, mas do mês da B7.
-- Só lê; nada é gravado.
--   toda a equipe interna: os números da agência no mês, o dia mais cheio,
--     a comparação com o mês anterior e o "você" (o que a pessoa entregou);
--   coordenação e administração: também o cliente do mês e o pódio da equipe.
create or replace function public.retrospectiva_mes(p_ano int, p_mes int)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  ini date; fim date; ini_ant date; eu uuid := auth.uid(); gestao boolean := public.sou_equipe();
  tot jsonb; pico jsonb; ant int; atual int; cli jsonb := null; podio jsonb := null; voce jsonb; semana jsonb;
begin
  if not public.sou_equipe_interna() then raise exception 'A retrospectiva é da equipe B7.' using errcode = '42501'; end if;
  if p_mes not between 1 and 12 or p_ano not between 2020 and 2100 then raise exception 'Mês inválido.'; end if;
  ini := make_date(p_ano, p_mes, 1); fim := (ini + interval '1 month')::date; ini_ant := (ini - interval '1 month')::date;

  select jsonb_build_object(
    'videos', (select count(*) from demandas_edicao where deleted_at is null and editing_status = 'entregue' and entregue_em >= ini and entregue_em < fim),
    'artes', (select count(*) from design_deliverables where deleted_at is null and finalizado_em >= ini and finalizado_em < fim),
    'posts', (select count(*) from conteudos where deleted_at is null and archived_at is null and status = 'Publicado' and data_postagem >= ini and data_postagem < fim),
    'gravacoes', (select count(*) from gravacoes where deleted_at is null and data_gravacao >= ini and data_gravacao < fim),
    'roteiros', (select count(*) from roteiros where deleted_at is null and created_at >= ini and created_at < fim),
    'aprovadas', (select count(*) from aprovacoes where deleted_at is null and situacao = 'aprovado' and enviado_em >= ini and enviado_em < fim),
    'resposta_horas', (select round(avg(extract(epoch from decidido_em - enviado_em) / 3600)::numeric, 1) from aprovacoes
                        where deleted_at is null and decidido_em > enviado_em and origem_decisao is distinct from 'externa'
                          and situacao not in ('substituido', 'cancelado') and enviado_em >= ini and enviado_em < fim),
    'legendas', (select coalesce(sum(alteradas), 0) from legendas where deleted_at is null and created_at >= ini and created_at < fim),
    'clientes', (select count(distinct cid) from (
                   select client_id cid from demandas_edicao where deleted_at is null and editing_status = 'entregue' and entregue_em >= ini and entregue_em < fim
                   union select client_id from design_deliverables where deleted_at is null and finalizado_em >= ini and finalizado_em < fim
                   union select client_id from conteudos where deleted_at is null and status = 'Publicado' and data_postagem >= ini and data_postagem < fim) u
                 join clientes c on c.id = u.cid and c.deleted_at is null and coalesce(c.teste, false) = false)
  ) into tot;

  with e as (
    select (entregue_em at time zone 'America/Sao_Paulo')::date d from demandas_edicao
     where deleted_at is null and editing_status = 'entregue' and entregue_em >= ini and entregue_em < fim
    union all
    select (finalizado_em at time zone 'America/Sao_Paulo')::date from design_deliverables
     where deleted_at is null and finalizado_em >= ini and finalizado_em < fim)
  select jsonb_build_object('dia', d, 'entregas', n) into pico from (select d, count(*) n from e group by d order by n desc, d limit 1) x;

  with e as (
    select (entregue_em at time zone 'America/Sao_Paulo') t from demandas_edicao
     where deleted_at is null and editing_status = 'entregue' and entregue_em >= ini and entregue_em < fim
    union all
    select (finalizado_em at time zone 'America/Sao_Paulo') from design_deliverables
     where deleted_at is null and finalizado_em >= ini and finalizado_em < fim)
  select coalesce(jsonb_agg(n order by dow), '[]'::jsonb) into semana
    from (select g dow, (select count(*) from e where extract(isodow from t) = g) n from generate_series(1, 7) g) s;

  atual := (tot->>'videos')::int + (tot->>'artes')::int;
  select (select count(*) from demandas_edicao where deleted_at is null and editing_status = 'entregue' and entregue_em >= ini_ant and entregue_em < ini)
       + (select count(*) from design_deliverables where deleted_at is null and finalizado_em >= ini_ant and finalizado_em < ini) into ant;

  select jsonb_build_object(
    'artes', (select count(*) from design_deliverables where deleted_at is null and designer_id = eu and finalizado_em >= ini and finalizado_em < fim),
    'videos', (select count(*) from demandas_edicao where deleted_at is null and videomaker_id = eu and editing_status = 'entregue' and entregue_em >= ini and entregue_em < fim),
    'no_prazo', (select count(*) from (
        select 1 from design_deliverables where deleted_at is null and designer_id = eu and finalizado_em >= ini and finalizado_em < fim
           and prazo is not null and (finalizado_em at time zone 'America/Sao_Paulo')::date <= prazo
        union all
        select 1 from demandas_edicao where deleted_at is null and videomaker_id = eu and editing_status = 'entregue' and entregue_em >= ini and entregue_em < fim
           and prazo is not null and (entregue_em at time zone 'America/Sao_Paulo')::date <= prazo) a),
    'com_prazo', (select count(*) from (
        select 1 from design_deliverables where deleted_at is null and designer_id = eu and finalizado_em >= ini and finalizado_em < fim and prazo is not null
        union all
        select 1 from demandas_edicao where deleted_at is null and videomaker_id = eu and editing_status = 'entregue' and entregue_em >= ini and entregue_em < fim and prazo is not null) b),
    'gravacoes', (select count(*) from gravacoes where deleted_at is null and videomaker_id = eu and data_gravacao >= ini and data_gravacao < fim),
    'legendas', (select count(*) from legendas where deleted_at is null and criado_por = eu and created_at >= ini and created_at < fim),
    'nome', (select split_part(coalesce(nome, ''), ' ', 1) from perfis where id = eu)
  ) into voce;

  if gestao then
    with e as (
      select client_id cid, 1 v, 0 a, 0 p from demandas_edicao where deleted_at is null and editing_status = 'entregue' and entregue_em >= ini and entregue_em < fim
      union all select client_id, 0, 1, 0 from design_deliverables where deleted_at is null and finalizado_em >= ini and finalizado_em < fim
      union all select client_id, 0, 0, 1 from conteudos where deleted_at is null and status = 'Publicado' and data_postagem >= ini and data_postagem < fim)
    select jsonb_build_object('nome', c.nome, 'logo', c.logo_url, 'videos', x.v, 'artes', x.a, 'posts', x.p, 'total', x.v + x.a + x.p) into cli
      from (select cid, sum(v) v, sum(a) a, sum(p) p from e group by cid) x
      join clientes c on c.id = x.cid and c.deleted_at is null and coalesce(c.teste, false) = false
     order by x.v + x.a + x.p desc, c.nome limit 1;

    with e as (
      select designer_id pid, prazo, (finalizado_em at time zone 'America/Sao_Paulo')::date d from design_deliverables
       where deleted_at is null and designer_id is not null and finalizado_em >= ini and finalizado_em < fim
      union all
      select videomaker_id, prazo, (entregue_em at time zone 'America/Sao_Paulo')::date from demandas_edicao
       where deleted_at is null and videomaker_id is not null and editing_status = 'entregue' and entregue_em >= ini and entregue_em < fim)
    select coalesce(jsonb_agg(jsonb_build_object('nome', p.nome, 'foto', p.avatar_url, 'funcao', coalesce(p.funcao, p.papel),
             'entregas', x.n, 'no_prazo', case when x.cp > 0 then round(x.np * 100.0 / x.cp) end) order by x.n desc, p.nome), '[]'::jsonb) into podio
      from (select pid, count(*) n, count(*) filter (where prazo is not null and d <= prazo) np, count(*) filter (where prazo is not null) cp
              from e group by pid order by count(*) desc limit 3) x
      join perfis p on p.id = x.pid;
  end if;

  return jsonb_build_object('ano', p_ano, 'mes', p_mes, 'parcial', public.notif_hoje() < fim,
    'totais', tot, 'pico', pico, 'semana', semana, 'entregas', atual, 'entregas_mes_anterior', ant,
    'voce', voce, 'cliente_do_mes', cli, 'podio', podio);
end $$;
revoke all on function public.retrospectiva_mes(int, int) from public, anon;
grant execute on function public.retrospectiva_mes(int, int) to authenticated;
