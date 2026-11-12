-- =====================================================================
-- zzz326 (4.38.0) — DASH DE OPERAÇÕES (pedido do Yury, 12/11/2026)
-- Linha = cliente, coluna = serviço do mês, célula = situação.
-- A situação vem sozinha do que a equipe já faz no sistema (linha
-- editorial, artes, gravações, edição, publicações); quem quiser ajusta
-- à mão (marca), e o administrador dá o "conferido" do mês.
-- =====================================================================

create table if not exists public.operacoes_marcas (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  ano int not null check (ano between 2020 and 2100),
  mes int not null check (mes between 1 and 12),
  coluna text not null check (coluna in ('calendario','artes','campanha','gravacao','edicao','publicacao','mes')),
  status text check (char_length(status) <= 40),   -- null = automático
  nota text check (char_length(nota) <= 300),
  atualizado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (cliente_id, ano, mes, coluna)
);
alter table public.operacoes_marcas enable row level security;
create policy operacoes_marcas_le on public.operacoes_marcas for select to authenticated using (public.sou_equipe_interna());

-- marcar / desmarcar uma célula (status null = volta para o automático)
create or replace function public.operacoes_marcar(p_cliente uuid, p_ano int, p_mes int, p_coluna text, p_status text, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe_interna() then raise exception 'Só a equipe.'; end if;
  if p_coluna = 'mes' and not public.sou_admin() then raise exception 'Só o administrador confere o mês.'; end if;
  insert into public.operacoes_marcas (cliente_id, ano, mes, coluna, status, nota)
  values (p_cliente, p_ano, p_mes, p_coluna, left(nullif(trim(p_status), ''), 40), left(nullif(trim(p_nota), ''), 300))
  on conflict (cliente_id, ano, mes, coluna) do update
    set status = excluded.status, nota = excluded.nota, atualizado_por = auth.uid(), atualizado_em = now();
end $$;
revoke all on function public.operacoes_marcar(uuid, int, int, text, text, text) from public, anon;
grant execute on function public.operacoes_marcar(uuid, int, int, text, text, text) to authenticated;

-- o mês inteiro: uma linha por cliente ativo, com o automático e as marcas
create or replace function public.operacoes_mes(p_ano int, p_mes int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.sou_equipe_interna() then raise exception 'Só a equipe.'; end if;
  with cli as (
    select c.id, c.nome, c.logo_url, c.modo from public.clientes c
    where c.deleted_at is null and not coalesce(c.teste, false)
  ),
  le as (
    select distinct on (l.client_id) l.client_id, l.id, l.status, coalesce(l.visivel_cliente, false) vis
    from public.linhas_editoriais l
    where l.deleted_at is null and l.archived_at is null and l.ano = p_ano and l.mes = p_mes
    order by l.client_id, l.updated_at desc
  ),
  art as (
    select d.client_id,
      count(*) total,
      count(*) filter (where d.status in ('finalizado','aprovado_cliente')) prontas,
      count(*) filter (where d.status in ('em_criacao','revisao_interna','aprovado_interno')) andamento
    from public.design_deliverables d join le on le.id = d.linha_id
    where d.deleted_at is null group by d.client_id
  ),
  grav as (
    select g.client_id, count(*) total,
      count(*) filter (where g.situacao = 'Gravada') feitas,
      count(*) filter (where g.situacao in ('Agendada','Pendente')) marcadas,
      min(g.data_gravacao) filter (where g.situacao in ('Agendada','Pendente')) proxima
    from public.gravacoes g
    where g.deleted_at is null and g.situacao <> 'Cancelada'
      and coalesce(g.competencia_ano, extract(year from g.data_gravacao)::int) = p_ano
      and coalesce(g.competencia_mes, extract(month from g.data_gravacao)::int) = p_mes
    group by g.client_id
  ),
  ed as (
    select e.client_id, count(*) total,
      count(*) filter (where e.editing_status = 'entregue') entregues,
      count(*) filter (where e.editing_status in ('em_edicao','aguardando_aprovacao')) andamento
    from public.demandas_edicao e
    where e.deleted_at is null and e.editing_status <> 'descartado' and e.competencia_ano = p_ano and e.competencia_mes = p_mes
    group by e.client_id
  ),
  pub as (
    select ct.client_id, count(*) total,
      count(*) filter (where ct.status = 'Publicado') publicados,
      count(*) filter (where ct.status = 'Programado') programados
    from public.conteudos ct join le on le.id = ct.linha_id
    where ct.deleted_at is null and ct.archived_at is null group by ct.client_id
  ),
  mar as (
    select m.cliente_id, jsonb_object_agg(m.coluna, jsonb_build_object('status', m.status, 'nota', m.nota,
      'por', p.nome, 'em', m.atualizado_em)) marcas
    from public.operacoes_marcas m left join public.perfis p on p.id = m.atualizado_por
    where m.ano = p_ano and m.mes = p_mes and m.status is not null group by m.cliente_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', cli.id, 'nome', cli.nome, 'logo_url', cli.logo_url, 'modo', cli.modo,
    'auto', jsonb_build_object(
      'calendario', case when le.id is null then jsonb_build_object('status', 'Pendente')
                         when le.status = 'Aprovada' and le.vis then jsonb_build_object('status', 'Entregue ao cliente', 'linha_id', le.id)
                         when le.status = 'Aprovada' then jsonb_build_object('status', 'Feito', 'linha_id', le.id)
                         else jsonb_build_object('status', 'Em execução', 'linha_id', le.id) end,
      'artes', case when coalesce(art.total, 0) = 0 then jsonb_build_object('status', case when le.id is null then 'Pendente' else 'Sem artes' end)
                    else jsonb_build_object('status', case when art.prontas = art.total then 'Entregue' when art.andamento > 0 or art.prontas > 0 then 'Em execução' else 'Pendente' end,
                                            'feitas', art.prontas, 'total', art.total) end,
      'gravacao', case when coalesce(grav.total, 0) = 0 then jsonb_build_object('status', 'Não agendada')
                       else jsonb_build_object('status', case when grav.marcadas = 0 then 'Realizada' else 'Agendada' end,
                                               'feitas', grav.feitas, 'total', grav.total, 'proxima', grav.proxima) end,
      'edicao', case when coalesce(ed.total, 0) = 0 then jsonb_build_object('status', 'Sem vídeos')
                     else jsonb_build_object('status', case when ed.entregues = ed.total then 'Entregue' when ed.andamento > 0 or ed.entregues > 0 then 'Em execução' else 'Pendente' end,
                                             'feitas', ed.entregues, 'total', ed.total) end,
      'publicacao', case when coalesce(pub.total, 0) = 0 then jsonb_build_object('status', 'Pendente')
                         else jsonb_build_object('status', case when pub.publicados + pub.programados >= pub.total then 'Feito'
                                                                 when pub.publicados + pub.programados > 0 then 'Em execução' else 'Não feito' end,
                                                 'feitas', pub.publicados + pub.programados, 'total', pub.total) end
    ),
    'marcas', coalesce(mar.marcas, '{}'::jsonb)
  ) order by cli.nome), '[]'::jsonb)
  into v
  from cli left join le on le.client_id = cli.id left join art on art.client_id = cli.id left join grav on grav.client_id = cli.id
       left join ed on ed.client_id = cli.id left join pub on pub.client_id = cli.id left join mar on mar.cliente_id = cli.id;
  return v;
end $$;
revoke all on function public.operacoes_mes(int, int) from public, anon;
grant execute on function public.operacoes_mes(int, int) to authenticated;
