-- 4.87.0 — TRÊS TELAS NOVAS NA GESTÃO (para o administrador e o Financeiro, pedido do Yury)
--   • Contratado × entregue — o pacote do cliente (clientes.pacote_id → pacotes_producao.itens) contra o
--     planejado e o publicado no mês, por tipo; no mês aberto, contra o ritmo esperado;
--   • Clientes em risco — saúde baixa ou caindo, nota baixa, atraso que se repete, abaixo do contratado;
--     a saúde passa a ser GUARDADA todo dia (cliente_saude_hist, relógio do banco às 06:17 de Brasília);
--   • Prazos e retrabalho — por pessoa e por cliente, mês a mês: entregas, % no prazo, tempo para entregar,
--     versões por arte, aprovações que voltaram com ajuste, atrasados hoje.
-- Só lê o que já existe (a saúde é a mesma conta da aba Saúde, gestao_painel). Pode rodar mais de uma vez.

-- ------------------------------------------------------------ saúde (mesma conta de gestao_painel)
create or replace function public._saude_clientes()
returns table (client_id uuid, nome text, logo_url text, pontos int, motivos text[])
language sql stable security definer set search_path to 'public' as $$
  with cli as (
    select c.id, c.nome, c.logo_url from public.clientes c
     where c.deleted_at is null and coalesce(c.servico, 'ativo') = 'ativo' and not coalesce(c.teste, false)),
  datas as (select public.notif_hoje() hoje),
  ini as (select hoje, date_trunc('month', hoje)::date ini_mes, (date_trunc('month', hoje) - interval '1 month')::date ini_ant from datas),
  ent as (
    select x.client_id, count(*) filter (where d >= (select ini_mes from ini)) mes, count(*) filter (where d < (select ini_mes from ini)) ant
      from (
        select d.client_id, (d.finalizado_em at time zone 'America/Sao_Paulo')::date d from public.design_deliverables d
         where d.deleted_at is null and d.status = 'finalizado' and d.finalizado_em >= (select ini_ant from ini)
        union all
        select v.client_id, (v.entregue_em at time zone 'America/Sao_Paulo')::date from public.demandas_edicao v
         where v.deleted_at is null and v.editing_status = 'entregue' and v.entregue_em >= (select ini_ant from ini)
        union all
        select c.client_id, c.data_postagem from public.conteudos c
         where c.deleted_at is null and c.status = 'Publicado' and c.data_postagem >= (select ini_ant from ini) and c.data_postagem <= (select hoje from ini)
      ) x group by x.client_id),
  atr as (
    select x.client_id, count(*) n from (
      select d.client_id from public.design_deliverables d
       where d.deleted_at is null and d.prazo < (select hoje from ini) and d.status not in ('finalizado','aprovado_cliente')
      union all
      select v.client_id from public.demandas_edicao v
       where v.deleted_at is null and v.prazo < (select hoje from ini) and v.editing_status not in ('entregue','descartado','standby')
    ) x group by x.client_id),
  apr as (
    select a.client_id,
           count(*) filter (where a.situacao in ('pendente','parcial') and a.enviado_em < now() - interval '3 days') paradas,
           avg(extract(epoch from (a.decidido_em - a.enviado_em)) / 86400.0) filter (where a.decidido_em is not null and a.decidido_em > now() - interval '90 days') resp_dias,
           count(*) filter (where a.decidido_em > now() - interval '90 days' and a.situacao in ('aprovado','ajustes','recusado')) decididas,
           count(*) filter (where a.decidido_em > now() - interval '90 days' and a.situacao in ('ajustes','recusado')) com_ajuste
      from public.aprovacoes a where a.deleted_at is null group by a.client_id),
  sat as (
    select distinct on (s.client_id) s.client_id, s.nota from public.cliente_satisfacao s
     where s.created_at > now() - interval '120 days' order by s.client_id, s.created_at desc)
  select cli.id, cli.nome, cli.logo_url,
    greatest(0, least(100, 100
      - least(36, 12 * coalesce(atr.n, 0))
      - least(24, 8 * coalesce(apr.paradas, 0))
      - case when apr.resp_dias > 6 then 20 when apr.resp_dias > 3 then 10 else 0 end
      - case when coalesce(apr.decididas, 0) >= 3 and 100.0 * apr.com_ajuste / apr.decididas > 40 then 15
             when coalesce(apr.decididas, 0) >= 3 and 100.0 * apr.com_ajuste / apr.decididas > 25 then 8 else 0 end
      - case when sat.nota <= 6 then 25 when sat.nota <= 8 then 8 else 0 end
      - case when coalesce(ent.mes, 0) = 0 and coalesce(ent.ant, 0) = 0 then 15 else 0 end))::int,
    array_remove(array[
      case when coalesce(atr.n, 0) > 0 then atr.n || case when atr.n = 1 then ' entrega atrasada' else ' entregas atrasadas' end end,
      case when coalesce(apr.paradas, 0) > 0 then apr.paradas || ' aprovação(ões) parada(s) há 3+ dias' end,
      case when sat.nota is not null and sat.nota <= 8 then 'deu nota ' || sat.nota || ' na pesquisa' end,
      case when coalesce(ent.mes, 0) = 0 and coalesce(ent.ant, 0) = 0 then 'sem entregas há 2 meses' end], null)
  from cli left join ent on ent.client_id = cli.id left join atr on atr.client_id = cli.id
           left join apr on apr.client_id = cli.id left join sat on sat.client_id = cli.id
$$;
revoke all on function public._saude_clientes() from public, anon, authenticated;

create table if not exists public.cliente_saude_hist (
  client_id uuid not null references public.clientes (id) on delete cascade,
  dia date not null,
  pontos int not null,
  motivos text[],
  primary key (client_id, dia)
);
alter table public.cliente_saude_hist enable row level security;
drop policy if exists cliente_saude_hist_ler on public.cliente_saude_hist;
create policy cliente_saude_hist_ler on public.cliente_saude_hist for select to authenticated using (public.sou_admin());
revoke insert, update, delete on public.cliente_saude_hist from anon, authenticated;
grant select on public.cliente_saude_hist to authenticated;

-- guarda a saúde de hoje (o relógio chama todo dia; rodar de novo no mesmo dia só atualiza)
create or replace function public.cliente_saude_registrar()
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  insert into public.cliente_saude_hist (client_id, dia, pontos, motivos)
  select s.client_id, public.notif_hoje(), s.pontos, s.motivos from public._saude_clientes() s
  on conflict (client_id, dia) do update set pontos = excluded.pontos, motivos = excluded.motivos;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.cliente_saude_registrar() from public, anon, authenticated;

-- ------------------------------------------------------------ contratado × entregue
create or replace function public._contratado(p_ini date)
returns table (client_id uuid, nome text, logo_url text, pacote text, itens jsonb, contratado int, planejados int, publicados int)
language sql stable security definer set search_path to 'public' as $$
  with cli as (
    select c.id, c.nome, c.logo_url, p.nome pacote, p.itens from public.clientes c join public.pacotes_producao p on p.id = c.pacote_id
     where c.deleted_at is null and coalesce(c.servico, 'ativo') = 'ativo' and not coalesce(c.teste, false)),
  it as (select cli.id, e->>'tipo' tipo, coalesce((e->>'qtd')::int, 0) qtd from cli, jsonb_array_elements(cli.itens) e),
  ct as (
    select c.client_id, c.tipo, count(*) planejados,
           count(*) filter (where c.status = 'Publicado' and c.data_postagem <= public.notif_hoje()) publicados
      from public.conteudos c
     where c.deleted_at is null and c.archived_at is null and c.data_postagem >= p_ini and c.data_postagem < (p_ini + interval '1 month')::date
     group by 1, 2),
  por as (
    select it.id, jsonb_agg(jsonb_build_object('tipo', it.tipo, 'contratado', it.qtd, 'planejados', coalesce(ct.planejados, 0),
             'publicados', coalesce(ct.publicados, 0)) order by it.tipo) itens,
           sum(it.qtd)::int contratado, sum(coalesce(ct.planejados, 0))::int planejados, sum(least(coalesce(ct.publicados, 0), it.qtd))::int publicados
      from it left join ct on ct.client_id = it.id and ct.tipo = it.tipo group by it.id)
  select cli.id, cli.nome, cli.logo_url, cli.pacote, por.itens, por.contratado, por.planejados, por.publicados
    from cli join por on por.id = cli.id
$$;
revoke all on function public._contratado(date) from public, anon, authenticated;

create or replace function public.gestao_contratado(p_ano int, p_mes int)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare ini date; fim date; hoje date := public.notif_hoje(); fechado boolean; ritmo numeric;
begin
  if not public.sou_admin() then raise exception 'Só a administração abre a Gestão.' using errcode = '42501'; end if;
  if p_mes not between 1 and 12 or p_ano not between 2020 and 2100 then raise exception 'Mês inválido.'; end if;
  ini := make_date(p_ano, p_mes, 1); fim := (ini + interval '1 month')::date;
  fechado := fim <= hoje;
  ritmo := case when fechado then 1 when hoje < ini then 0 else round(((hoje - ini + 1)::numeric / (fim - ini)), 3) end;
  return jsonb_build_object('ano', p_ano, 'mes', p_mes, 'fechado', fechado, 'ritmo', ritmo,
    'clientes', (select coalesce(jsonb_agg(jsonb_build_object('id', x.client_id, 'nome', x.nome, 'logo', x.logo_url, 'pacote', x.pacote,
        'itens', x.itens, 'contratado', x.contratado, 'planejados', x.planejados, 'publicados', x.publicados,
        'faltam', greatest(0, x.contratado - x.publicados),
        'abaixo', fechado and x.publicados < x.contratado,
        'atras_ritmo', not fechado and x.publicados < floor(x.contratado * ritmo))
        order by (x.publicados::numeric / nullif(x.contratado, 0)), x.nome), '[]'::jsonb) from public._contratado(ini) x),
    'sem_pacote', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'logo', c.logo_url) order by c.nome), '[]'::jsonb)
        from public.clientes c where c.deleted_at is null and coalesce(c.servico, 'ativo') = 'ativo' and not coalesce(c.teste, false) and c.pacote_id is null));
end $$;
revoke all on function public.gestao_contratado(int, int) from public, anon;
grant execute on function public.gestao_contratado(int, int) to authenticated;

-- ------------------------------------------------------------ clientes em risco
create or replace function public.gestao_riscos()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare hoje date := public.notif_hoje(); ant date := (date_trunc('month', public.notif_hoje()) - interval '1 month')::date;
begin
  if not public.sou_admin() then raise exception 'Só a administração abre a Gestão.' using errcode = '42501'; end if;
  return (with
  s as (select * from public._saude_clientes()),
  antes as (   -- a saúde de ~4 semanas atrás (o registro mais recente entre 21 e 35 dias)
    select distinct on (h.client_id) h.client_id, h.pontos from public.cliente_saude_hist h
     where h.dia between hoje - 35 and hoje - 21 order by h.client_id, h.dia desc),
  nota as (
    select distinct on (x.client_id) x.client_id, x.nota from public.cliente_satisfacao x
     where x.created_at > now() - interval '45 days' order by x.client_id, x.created_at desc),
  atrasos as (   -- meses (dos 3 últimos fechados) com alguma entrega fora do prazo
    select y.client_id, count(distinct y.m) meses from (
      select d.client_id, date_trunc('month', d.finalizado_em at time zone 'America/Sao_Paulo') m from public.design_deliverables d
       where d.deleted_at is null and d.prazo is not null and (d.finalizado_em at time zone 'America/Sao_Paulo')::date > d.prazo
         and d.finalizado_em >= ((date_trunc('month', hoje) - interval '3 months')::timestamp at time zone 'America/Sao_Paulo') and d.finalizado_em < (date_trunc('month', hoje)::timestamp at time zone 'America/Sao_Paulo')
      union all
      select v.client_id, date_trunc('month', v.entregue_em at time zone 'America/Sao_Paulo') from public.demandas_edicao v
       where v.deleted_at is null and v.editing_status = 'entregue' and v.prazo is not null and (v.entregue_em at time zone 'America/Sao_Paulo')::date > v.prazo
         and v.entregue_em >= ((date_trunc('month', hoje) - interval '3 months')::timestamp at time zone 'America/Sao_Paulo') and v.entregue_em < (date_trunc('month', hoje)::timestamp at time zone 'America/Sao_Paulo')
    ) y group by y.client_id),
  contr as (select * from public._contratado(ant)),
  sem as (
    select w.client_id, jsonb_agg(jsonb_build_object('semana', w.semana, 'pontos', w.pontos) order by w.semana) semanas from (
      select h.client_id, date_trunc('week', h.dia)::date semana, (array_agg(h.pontos order by h.dia desc))[1] pontos
        from public.cliente_saude_hist h where h.dia > hoje - 84 group by 1, 2) w group by w.client_id),
  r as (
    select s.client_id, s.nome, s.logo_url, s.pontos, antes.pontos antes, coalesce(sem.semanas, '[]'::jsonb) semanas, s.motivos saude_motivos,
      array_remove(array[
        case when s.pontos < 50 then 'saúde ' || s.pontos || '/100' end,
        case when antes.pontos is not null and antes.pontos - s.pontos >= 15 then 'saúde caiu ' || (antes.pontos - s.pontos) || ' pontos em 4 semanas' end,
        case when nota.nota <= 6 then 'nota ' || nota.nota || ' na pesquisa de satisfação' end,
        case when coalesce(atrasos.meses, 0) >= 2 then 'atrasou em ' || atrasos.meses || ' dos últimos 3 meses' end,
        case when contr.client_id is not null and contr.publicados < contr.contratado then 'ficou abaixo do contratado no mês passado (' || contr.publicados || ' de ' || contr.contratado || ')' end
      ], null) motivos
      from s left join antes on antes.client_id = s.client_id left join nota on nota.client_id = s.client_id
             left join atrasos on atrasos.client_id = s.client_id left join contr on contr.client_id = s.client_id
             left join sem on sem.client_id = s.client_id)
  select jsonb_build_object('hoje', hoje, 'clientes', coalesce(jsonb_agg(jsonb_build_object('id', r.client_id, 'nome', r.nome, 'logo', r.logo_url,
      'pontos', r.pontos, 'antes', r.antes, 'motivos', to_jsonb(r.motivos), 'saude_motivos', to_jsonb(r.saude_motivos), 'semanas', r.semanas)
      order by cardinality(r.motivos) desc, r.pontos, r.nome), '[]'::jsonb))
    from r where cardinality(r.motivos) > 0);
end $$;
revoke all on function public.gestao_riscos() from public, anon;
grant execute on function public.gestao_riscos() to authenticated;

-- ------------------------------------------------------------ prazos e retrabalho
create or replace function public.gestao_prazos(p_meses int default 6)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare hoje date := public.notif_hoje(); n int := greatest(1, least(coalesce(p_meses, 6), 12)); ini date; ini_ts timestamptz;
begin
  if not public.sou_admin() then raise exception 'Só a administração abre a Gestão.' using errcode = '42501'; end if;
  ini := (date_trunc('month', hoje) - make_interval(months => n - 1))::date;
  ini_ts := ini::timestamp at time zone 'America/Sao_Paulo';   -- começo do mês no horário de Brasília
  return (with
  meses as (select to_char(m, 'YYYY-MM') mes from generate_series(ini, date_trunc('month', hoje), interval '1 month') m),
  ent as (   -- cada entrega: de quem, de qual cliente, quando foi pedida e entregue, prazo e versões
    select d.designer_id pid, d.client_id, d.created_at criado, d.finalizado_em entregue, d.prazo, greatest(coalesce(d.versao_atual, 1), 1) versoes
      from public.design_deliverables d where d.deleted_at is null and d.status = 'finalizado' and d.finalizado_em >= ini_ts
    union all
    select v.videomaker_id, v.client_id, v.created_at, v.entregue_em, v.prazo, null
      from public.demandas_edicao v where v.deleted_at is null and v.editing_status = 'entregue' and v.entregue_em >= ini_ts),
  ent2 as (select e.*, to_char(e.entregue at time zone 'America/Sao_Paulo', 'YYYY-MM') mes,
             (e.prazo is not null) com_prazo, (e.prazo is not null and (e.entregue at time zone 'America/Sao_Paulo')::date <= e.prazo) no_prazo from ent e),
  abertas as (
    select x.pid, x.client_id from (
      select d.designer_id pid, d.client_id from public.design_deliverables d
       where d.deleted_at is null and d.prazo < hoje and d.status not in ('finalizado','aprovado_cliente')
      union all
      select v.videomaker_id, v.client_id from public.demandas_edicao v
       where v.deleted_at is null and v.prazo < hoje and v.editing_status not in ('entregue','descartado','standby')) x),
  apr as (
    select a.client_id, to_char(a.enviado_em at time zone 'America/Sao_Paulo', 'YYYY-MM') mes, count(*) enviadas,
           count(*) filter (where a.situacao in ('ajustes','recusado')) ajustes
      from public.aprovacoes a where a.deleted_at is null and a.situacao not in ('substituido','cancelado') and a.enviado_em >= ini_ts group by 1, 2),
  pm as (
    select e.pid, e.mes, count(*) entregas, round(100.0 * count(*) filter (where e.no_prazo) / nullif(count(*) filter (where e.com_prazo), 0))::int no_prazo_pct,
           round(avg(extract(epoch from (e.entregue - e.criado)) / 86400.0)::numeric, 1) dias, round(avg(e.versoes)::numeric, 1) versoes
      from ent2 e where e.pid is not null group by 1, 2),
  cm as (
    select e.client_id, e.mes, count(*) entregas, round(100.0 * count(*) filter (where e.no_prazo) / nullif(count(*) filter (where e.com_prazo), 0))::int no_prazo_pct,
           round(avg(extract(epoch from (e.entregue - e.criado)) / 86400.0)::numeric, 1) dias
      from ent2 e group by 1, 2),
  pes as (
    select p.id, p.nome, p.avatar_url foto, coalesce(p.funcao, p.papel) funcao,
      (select count(*) from abertas a where a.pid = p.id) atrasados_hoje,
      (select jsonb_agg(jsonb_build_object('mes', m.mes, 'entregas', coalesce(pm.entregas, 0), 'no_prazo_pct', pm.no_prazo_pct, 'dias', pm.dias, 'versoes', pm.versoes) order by m.mes)
         from meses m left join pm on pm.pid = p.id and pm.mes = m.mes) meses
      from public.perfis p
     where p.papel <> 'cliente' and (exists (select 1 from pm where pm.pid = p.id) or exists (select 1 from abertas a where a.pid = p.id))),
  cli as (
    select c.id, c.nome, c.logo_url logo,
      (select count(*) from abertas a where a.client_id = c.id) atrasados_hoje,
      (select jsonb_agg(jsonb_build_object('mes', m.mes, 'entregas', coalesce(cm.entregas, 0), 'no_prazo_pct', cm.no_prazo_pct, 'dias', cm.dias,
          'ajustes_pct', case when coalesce(apr.enviadas, 0) > 0 then round(100.0 * apr.ajustes / apr.enviadas)::int end) order by m.mes)
         from meses m left join cm on cm.client_id = c.id and cm.mes = m.mes left join apr on apr.client_id = c.id and apr.mes = m.mes) meses
      from public.clientes c
     where c.deleted_at is null and not coalesce(c.teste, false)
       and (exists (select 1 from cm where cm.client_id = c.id) or exists (select 1 from abertas a where a.client_id = c.id) or exists (select 1 from apr where apr.client_id = c.id)))
  select jsonb_build_object('meses', (select jsonb_agg(mes order by mes) from meses),
    'pessoas', (select coalesce(jsonb_agg(to_jsonb(pes) order by pes.nome), '[]'::jsonb) from pes),
    'clientes', (select coalesce(jsonb_agg(to_jsonb(cli) order by cli.nome), '[]'::jsonb) from cli)));
end $$;
revoke all on function public.gestao_prazos(int) from public, anon;
grant execute on function public.gestao_prazos(int) to authenticated;

-- ------------------------------------------------------------ relógio: guarda a saúde todo dia (06:17 de Brasília = 09:17 UTC)
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('b7-saude-clientes', '17 9 * * *', 'select public.cliente_saude_registrar()');
  end if;
exception when others then raise notice 'zzz388: relógio da saúde não agendado (%)', sqlerrm;
end $$;
-- o histórico começa hoje
select public.cliente_saude_registrar();
