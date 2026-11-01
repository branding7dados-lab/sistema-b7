-- Parceiros B7 = freelancers e parceiros de fora (marcados na conta)
alter table public.perfis add column if not exists parceiro boolean not null default false;

create or replace function public.perfil_parceiro_definir(p_perfil uuid, p_parceiro boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.sou_admin() then raise exception 'Só o administrador muda isso.' using errcode = '42501'; end if;
  update public.perfis set parceiro = coalesce(p_parceiro, false)
   where id = p_perfil and papel <> 'cliente';
  if not found then raise exception 'Conta da equipe não encontrada.'; end if;
end;
$$;
revoke all on function public.perfil_parceiro_definir(uuid, boolean) from public, anon;
grant execute on function public.perfil_parceiro_definir(uuid, boolean) to authenticated;

-- zzz302 — Gestão → Equipe: o que cada pessoa entregou, o que está em falta e o que precisa.
-- Só leitura, só administrador. Conta vídeo (demandas_edicao), design (design_deliverables),
-- gravações e itens gravados. Datas no fuso de São Paulo.
create or replace function public.gestao_colaboradores(p_de date default null, p_ate date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  de date; ate date; semana0 date;
  res jsonb;
begin
  if not public.sou_admin() then raise exception 'Só o administrador abre a gestão da equipe.' using errcode = '42501'; end if;
  ate := coalesce(p_ate, hoje);
  de := coalesce(p_de, date_trunc('month', hoje)::date);
  if de > ate then de := ate; end if;
  semana0 := (date_trunc('week', hoje)::date) - 49;   -- 8 semanas, a atual por último

  with pessoas as (
    select p.id, p.nome, p.avatar_url, p.papel, p.funcao, coalesce(p.funcoes_adicionais, '{}') funcoes_adicionais,
           p.superadmin, coalesce(p.last_seen_at, p.last_login_at, p.ultimo_acesso) visto,
           case when p.parceiro then 'parceiro' else 'colaborador' end grupo
      from perfis p where p.papel <> 'cliente' and p.estado = 'ativa'
  ),
  vid as (
    select d.id, d.videomaker_id pid, d.titulo, d.codigo, d.prazo, d.editing_status st, d.updated_at, d.standby_revisar_em,
           (d.entregue_em at time zone 'America/Sao_Paulo')::date entregue, c.nome cliente
      from demandas_edicao d left join clientes c on c.id = d.client_id
     where d.deleted_at is null and d.editing_status <> 'descartado' and coalesce(c.teste, false) = false
  ),
  des as (
    select d.id, d.designer_id pid, d.titulo, d.tipo, d.prazo, d.status st, d.updated_at, d.created_at,
           (d.finalizado_em at time zone 'America/Sao_Paulo')::date finalizado, c.nome cliente
      from design_deliverables d left join clientes c on c.id = d.client_id
     where d.deleted_at is null and coalesce(c.teste, false) = false
  ),
  grav as (
    select g.id, g.videomaker_id pid, g.nome, g.data_gravacao, g.status,
           (coalesce(g.concluida_em, g.gravada_em) at time zone 'America/Sao_Paulo')::date feita, c.nome cliente
      from gravacoes g left join clientes c on c.id = g.client_id
     where g.deleted_at is null and coalesce(c.teste, false) = false
  ),
  pend as (
    -- o que está na mão de cada um, com o motivo de chamar atenção
    select pid, jsonb_agg(x order by ord, prazo nulls last) itens from (
      select v.pid, 'video' tipo, v.id, coalesce(nullif(v.titulo, ''), v.codigo, 'Vídeo') titulo, v.cliente, v.prazo, v.st status,
             '#/video/' || v.id link,
             case when v.st = 'standby' then 'standby'
                  when v.prazo < hoje then 'atrasado'
                  when v.prazo <= hoje + 2 then 'vence'
                  when v.st = 'em_edicao' and v.updated_at < now() - interval '7 days' then 'parado'
                  when v.prazo is null then 'sem_prazo' else 'ok' end motivo,
             case when v.prazo < hoje then 0 when v.prazo <= hoje + 2 then 1 when v.st = 'standby' then 3 else 2 end ord,
             (hoje - v.prazo) dias_atraso,
             (extract(epoch from now() - v.updated_at) / 86400)::int dias_parado
        from vid v where v.pid is not null and v.st in ('pendente', 'em_edicao', 'correcao', 'standby')
      union all
      select d.pid, 'design', d.id, coalesce(nullif(d.titulo, ''), 'Peça'), d.cliente, d.prazo, d.st, '#/design/' || d.id,
             case when d.prazo < hoje then 'atrasado'
                  when d.prazo <= hoje + 2 then 'vence'
                  when d.updated_at < now() - interval '7 days' then 'parado'
                  else 'ok' end,
             case when d.prazo < hoje then 0 when d.prazo <= hoje + 2 then 1 else 2 end,
             (hoje - d.prazo), (extract(epoch from now() - d.updated_at) / 86400)::int
        from des d where d.pid is not null and d.st in ('aguardando_producao', 'em_criacao', 'ajustes', 'ajustes_cliente')
    ) x group by pid
  ),
  por_pessoa as (
    select p.*,
      jsonb_build_object(
        'entregues', (select count(*) from vid where pid = p.id and st = 'entregue' and entregue between de and ate),
        'no_prazo', (select count(*) from vid where pid = p.id and st = 'entregue' and entregue between de and ate and (prazo is null or entregue <= prazo)),
        'na_mao', (select count(*) from vid where pid = p.id and st in ('pendente', 'em_edicao', 'correcao')),
        'atrasados', (select count(*) from vid where pid = p.id and st in ('pendente', 'em_edicao', 'correcao') and prazo < hoje),
        'vencem7', (select count(*) from vid where pid = p.id and st in ('pendente', 'em_edicao', 'correcao') and prazo between hoje and hoje + 7),
        'com_cliente', (select count(*) from vid where pid = p.id and st = 'aguardando_aprovacao'),
        'standby', (select count(*) from vid where pid = p.id and st = 'standby'),
        'ajustes', (select count(*) from demandas_edicao_eventos e join demandas_edicao d on d.id = e.demanda_id
                     where d.videomaker_id = p.id and e.para_status = 'correcao'
                       and (e.created_at at time zone 'America/Sao_Paulo')::date between de and ate)
      ) video,
      jsonb_build_object(
        'entregues', (select count(*) from des where pid = p.id and st in ('finalizado', 'aprovado_cliente') and finalizado between de and ate),
        'na_mao', (select count(*) from des where pid = p.id and st in ('aguardando_producao', 'em_criacao', 'ajustes', 'ajustes_cliente')),
        'atrasados', (select count(*) from des where pid = p.id and st in ('aguardando_producao', 'em_criacao', 'ajustes', 'ajustes_cliente') and prazo < hoje),
        'parados', (select count(*) from des where pid = p.id and st in ('aguardando_producao', 'em_criacao', 'ajustes', 'ajustes_cliente') and updated_at < now() - interval '7 days'),
        'com_cliente', (select count(*) from des where pid = p.id and st in ('aguardando_cliente', 'aprovado_interno', 'revisao_interna')),
        'ajustes', (select count(*) from design_versoes v where v.designer_id = p.id and v.estado = 'ajuste_solicitado'
                     and (v.updated_at at time zone 'America/Sao_Paulo')::date between de and ate)
      ) design,
      jsonb_build_object(
        'feitas', (select count(*) from grav where pid = p.id and feita between de and ate),
        'itens', (select count(*) from gravacao_itens i where i.gravado_por = p.id and i.removido_em is null and i.gravado
                   and (i.gravado_em at time zone 'America/Sao_Paulo')::date between de and ate),
        'proximas', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'nome', g.nome, 'cliente', g.cliente, 'data', g.data_gravacao) order by g.data_gravacao), '[]')
                       from grav g where g.pid = p.id and g.data_gravacao between hoje and hoje + 7 and coalesce(g.status, '') <> 'Cancelada' and g.feita is null)
      ) gravacoes,
      (select jsonb_agg(n order by s) from (
         select s, (select count(*) from vid where pid = p.id and st = 'entregue' and entregue >= s and entregue < s + 7)
                 + (select count(*) from des where pid = p.id and st in ('finalizado', 'aprovado_cliente') and finalizado >= s and finalizado < s + 7) n
           from generate_series(0, 7) k, lateral (select semana0 + k * 7 s) z) w) serie,
      (select jsonb_build_object('tipo', a.tipo, 'fim', a.fim) from equipe_ausencias a
        where a.perfil_id = p.id and a.cancelado_em is null and hoje between a.inicio and a.fim limit 1) ausencia,
      coalesce((select itens from pend where pend.pid = p.id), '[]') pendencias
    from pessoas p
  )
  select jsonb_build_object(
    'hoje', hoje, 'de', de, 'ate', ate, 'semana0', semana0,
    'sem_dono', jsonb_build_object(
      'video', (select count(*) from vid where pid is null and st in ('pendente', 'em_edicao', 'correcao')),
      'design', (select count(*) from des where pid is null and st in ('aguardando_producao', 'em_criacao', 'ajustes', 'ajustes_cliente'))),
    'pessoas', coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'nome', nome, 'avatar_url', avatar_url, 'papel', papel, 'funcao', funcao, 'funcoes_adicionais', funcoes_adicionais,
      'superadmin', superadmin, 'visto', visto, 'grupo', grupo, 'video', video, 'design', design, 'gravacoes', gravacoes,
      'serie', serie, 'ausencia', ausencia, 'pendencias', pendencias) order by grupo desc, nome), '[]'))
  into res from por_pessoa;
  return res;
end;
$$;
revoke all on function public.gestao_colaboradores(date, date) from public, anon;
grant execute on function public.gestao_colaboradores(date, date) to authenticated;
