-- zzz266: tela "Gestão" do administrador — painel do dono, saúde dos
-- clientes e pedidos. Uma função só lê e devolve tudo em JSON.
-- Aplicada como: gestao_painel.

create or replace function public.gestao_painel()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  hoje date := public.notif_hoje();
  ini_mes date := date_trunc('month', hoje)::date;
  ini_ant date := (date_trunc('month', hoje) - interval '1 month')::date;
  r jsonb;
begin
  if not public.sou_admin() then raise exception 'Só o administrador abre a Gestão.'; end if;

  with
  cli as (
    select c.id, c.nome, c.logo_url from public.clientes c
     where c.deleted_at is null and coalesce(c.servico, 'ativo') = 'ativo' and not coalesce(c.teste, false)
  ),
  -- entregas por cliente (mês atual e anterior)
  ent as (
    select client_id,
           count(*) filter (where d >= ini_mes) mes,
           count(*) filter (where d >= ini_ant and d < ini_mes) ant
      from (
        select client_id, (finalizado_em at time zone 'America/Sao_Paulo')::date d from public.design_deliverables
         where deleted_at is null and status = 'finalizado' and finalizado_em >= ini_ant
        union all
        select client_id, (entregue_em at time zone 'America/Sao_Paulo')::date from public.demandas_edicao
         where deleted_at is null and editing_status = 'entregue' and entregue_em >= ini_ant
        union all
        select client_id, data_postagem from public.conteudos
         where deleted_at is null and status = 'Publicado' and data_postagem >= ini_ant and data_postagem <= hoje
      ) x group by client_id
  ),
  atr as (
    select client_id, count(*) n from (
      select client_id from public.design_deliverables
       where deleted_at is null and prazo < hoje and status not in ('finalizado','aprovado_cliente')
      union all
      select client_id from public.demandas_edicao
       where deleted_at is null and prazo < hoje and editing_status not in ('entregue','descartado','standby')
    ) x group by client_id
  ),
  apr as (
    select client_id,
           count(*) filter (where situacao in ('pendente','parcial') and enviado_em < now() - interval '3 days') paradas,
           count(*) filter (where situacao in ('pendente','parcial')) pendentes,
           avg(extract(epoch from (decidido_em - enviado_em)) / 86400.0)
             filter (where decidido_em is not null and decidido_em > now() - interval '90 days') resp_dias,
           count(*) filter (where decidido_em > now() - interval '90 days' and situacao in ('aprovado','ajustes','recusado')) decididas,
           count(*) filter (where decidido_em > now() - interval '90 days' and situacao in ('ajustes','recusado')) com_ajuste
      from public.aprovacoes where deleted_at is null group by client_id
  ),
  sat as (
    select distinct on (client_id) client_id, nota, comentario, created_at
      from public.cliente_satisfacao where created_at > now() - interval '120 days'
     order by client_id, created_at desc
  ),
  ped as (
    select client_id, count(*) filter (where situacao in ('recebido','em_producao')) abertos
      from public.cliente_pedidos group by client_id
  ),
  acesso as (
    select pc.client_id, max(p.ultimo_acesso) ultimo
      from public.perfil_clientes pc join public.perfis p on p.id = pc.perfil_id
     where p.papel = 'cliente' and p.estado = 'ativa' group by pc.client_id
  ),
  saude as (
    select cli.*, coalesce(ent.mes, 0) ent_mes, coalesce(ent.ant, 0) ent_ant, coalesce(atr.n, 0) atrasos,
           coalesce(apr.paradas, 0) paradas, coalesce(apr.pendentes, 0) pendentes, apr.resp_dias,
           case when coalesce(apr.decididas, 0) >= 3 then round(100.0 * apr.com_ajuste / apr.decididas) end ajustes_pct,
           sat.nota, sat.comentario, coalesce(ped.abertos, 0) pedidos_abertos, acesso.ultimo,
           array_remove(array[
             case when coalesce(atr.n, 0) > 0 then atr.n || case when atr.n = 1 then ' entrega atrasada' else ' entregas atrasadas' end end,
             case when coalesce(apr.paradas, 0) > 0 then apr.paradas || case when apr.paradas = 1 then ' aprovação parada há 3+ dias' else ' aprovações paradas há 3+ dias' end end,
             case when apr.resp_dias > 3 then 'demora ' || round(apr.resp_dias::numeric, 1) || ' dias para responder' end,
             case when coalesce(apr.decididas, 0) >= 3 and 100.0 * apr.com_ajuste / apr.decididas > 25 then round(100.0 * apr.com_ajuste / apr.decididas) || '% das peças voltam com ajuste' end,
             case when sat.nota is not null and sat.nota <= 8 then 'deu nota ' || sat.nota || ' na pesquisa' end,
             case when coalesce(ent.mes, 0) = 0 and coalesce(ent.ant, 0) = 0 then 'sem entregas há 2 meses' end
           ], null) motivos,
           greatest(0, least(100, 100
             - least(36, 12 * coalesce(atr.n, 0))
             - least(24, 8 * coalesce(apr.paradas, 0))
             - case when apr.resp_dias > 6 then 20 when apr.resp_dias > 3 then 10 else 0 end
             - case when coalesce(apr.decididas, 0) >= 3 and 100.0 * apr.com_ajuste / apr.decididas > 40 then 15
                    when coalesce(apr.decididas, 0) >= 3 and 100.0 * apr.com_ajuste / apr.decididas > 25 then 8 else 0 end
             - case when sat.nota <= 6 then 25 when sat.nota <= 8 then 8 else 0 end
             - case when coalesce(ent.mes, 0) = 0 and coalesce(ent.ant, 0) = 0 then 15 else 0 end
           ))::int pontos
      from cli left join ent on ent.client_id = cli.id left join atr on atr.client_id = cli.id
      left join apr on apr.client_id = cli.id left join sat on sat.client_id = cli.id
      left join ped on ped.client_id = cli.id left join acesso on acesso.client_id = cli.id
  ),
  serie as (
    select to_char(m, 'YYYY-MM') mes,
      (select count(*) from public.design_deliverables where deleted_at is null and status = 'finalizado'
          and finalizado_em >= m and finalizado_em < m + interval '1 month') design,
      (select count(*) from public.demandas_edicao where deleted_at is null and editing_status = 'entregue'
          and entregue_em >= m and entregue_em < m + interval '1 month') video,
      (select count(*) from public.conteudos where deleted_at is null and status = 'Publicado'
          and data_postagem >= m::date and data_postagem < (m + interval '1 month')::date and data_postagem <= hoje) publicados
    from generate_series(date_trunc('month', hoje) - interval '5 months', date_trunc('month', hoje), interval '1 month') m
  ),
  pedl as (
    select p.id, p.titulo, p.tipo, p.situacao, p.para_quando, p.created_at, p.updated_at, c.nome cliente, p.kanban_id,
           case when p.situacao = 'concluido' then round((extract(epoch from (p.updated_at - p.created_at)) / 86400.0)::numeric, 1) end dias
      from public.cliente_pedidos p join public.clientes c on c.id = p.client_id
     order by (p.situacao in ('recebido','em_producao')) desc, p.created_at desc limit 40
  ),
  satm as (
    select count(*) n, round(avg(nota)::numeric, 1) media,
           round(100.0 * (count(*) filter (where nota >= 9) - count(*) filter (where nota <= 6)) / nullif(count(*), 0)) nps
      from public.cliente_satisfacao where mes = ini_mes
  )
  select jsonb_build_object(
    'hoje', hoje,
    'kpis', jsonb_build_object(
      'clientes', (select count(*) from cli),
      'entregas_mes', (select coalesce(sum(ent_mes), 0) from saude),
      'entregas_ant', (select coalesce(sum(ent_ant), 0) from saude),
      'atrasos', (select coalesce(sum(atrasos), 0) from saude),
      'aprov_pendentes', (select coalesce(sum(pendentes), 0) from saude),
      'aprov_paradas', (select coalesce(sum(paradas), 0) from saude),
      'pedidos_mes', (select count(*) from public.cliente_pedidos where created_at >= ini_mes),
      'pedidos_abertos', (select count(*) from public.cliente_pedidos where situacao in ('recebido','em_producao')),
      'pedidos_tempo_medio', (select round(avg(extract(epoch from (updated_at - created_at)) / 86400.0)::numeric, 1)
                                from public.cliente_pedidos where situacao = 'concluido' and updated_at > now() - interval '90 days'),
      'satisfacao_media', (select media from satm), 'nps', (select nps from satm), 'respostas', (select n from satm),
      'saude_vermelho', (select count(*) from saude where pontos < 50),
      'saude_amarelo', (select count(*) from saude where pontos between 50 and 74)
    ),
    'serie', (select coalesce(jsonb_agg(to_jsonb(serie) order by mes), '[]'::jsonb) from serie),
    'clientes', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'nome', nome, 'logo', logo_url, 'pontos', pontos,
        'cor', case when pontos >= 75 then 'verde' when pontos >= 50 then 'amarelo' else 'vermelho' end,
        'motivos', to_jsonb(motivos), 'entregas_mes', ent_mes, 'entregas_ant', ent_ant, 'atrasos', atrasos,
        'pendentes', pendentes, 'resp_dias', round(resp_dias::numeric, 1), 'ajustes_pct', ajustes_pct,
        'nota', nota, 'comentario', comentario, 'pedidos_abertos', pedidos_abertos, 'ultimo_acesso', ultimo
      ) order by pontos, nome), '[]'::jsonb) from saude),
    'pedidos', (select coalesce(jsonb_agg(to_jsonb(pedl)), '[]'::jsonb) from pedl),
    'pedidos_por_cliente', (select coalesce(jsonb_agg(jsonb_build_object('cliente', c.nome, 'total', x.total, 'abertos', x.abertos) order by x.total desc), '[]'::jsonb)
        from (select client_id, count(*) total, count(*) filter (where situacao in ('recebido','em_producao')) abertos
                from public.cliente_pedidos where created_at > now() - interval '90 days' group by client_id) x
        join public.clientes c on c.id = x.client_id)
  ) into r;
  return r;
end $$;
revoke execute on function public.gestao_painel() from public, anon;
grant execute on function public.gestao_painel() to authenticated;
