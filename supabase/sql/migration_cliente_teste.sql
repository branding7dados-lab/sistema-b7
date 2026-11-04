-- =====================================================================
-- CLIENTE DE TESTE PERMANENTE (zzz143)
--
-- Um cliente fictício, "Cliente Teste B7", para testar a criação de
-- registros (demandas, peças, gravações, conteúdos) sem tocar em dado de
-- cliente de verdade. Ele aparece nas listas e nas telas como qualquer
-- cliente (com a etiqueta TESTE) e fica FORA dos números do Panorama, do
-- Painel de TV e do resumo do Dashboard.
--
-- O que muda:
--   · clientes.teste (coluna nova, padrão falso: nenhum cliente existente
--     muda);
--   · clientes_resumo ganha a coluna teste no fim;
--   · panorama_mes e dashboard_resumo_contagens passam a ignorar o
--     cliente de teste (e o que é dele);
--   · um registro novo em clientes, o de teste.
-- Nenhuma regra de acesso (RLS) foi alterada, nada foi apagado.
-- =====================================================================
alter table public.clientes add column if not exists teste boolean not null default false;

create or replace view public.clientes_resumo with (security_invoker = on) as
 SELECT id,
    nome,
    observacoes,
    logo_url,
    logo_path,
    is_pinned,
    deleted_at,
    created_at,
    updated_at,
    ( SELECT count(*) AS count
           FROM gravacoes g
          WHERE g.client_id = c.id AND g.deleted_at IS NULL AND g.archived_at IS NULL) AS total_gravacoes,
    ( SELECT count(*) AS count
           FROM roteiros r
             JOIN gravacoes g2 ON g2.id = r.recording_session_id
          WHERE g2.client_id = c.id AND r.deleted_at IS NULL AND g2.deleted_at IS NULL) AS total_roteiros,
    GREATEST(updated_at, COALESCE(( SELECT max(g3.updated_at) AS max
           FROM gravacoes g3
          WHERE g3.client_id = c.id), updated_at)) AS ultima_atividade,
    teste
   FROM clientes c;

insert into public.clientes (nome, observacoes, teste)
select 'Cliente Teste B7',
       'Cliente fictício, só para testar a criação de registros. Fica fora dos números do Panorama e do Painel de TV. Não apague e não use com dado de verdade.',
       true
 where not exists (select 1 from public.clientes where teste);

-- Panorama: o cliente de teste não entra
create or replace function public.panorama_mes(p_ano integer, p_mes integer)
 returns jsonb
 language sql
 stable
 set search_path to 'public'
as $function$
with ini as (
  select make_date(p_ano, p_mes, 1) as d0,
         (make_date(p_ano, p_mes, 1) + interval '1 month')::date as d1
),
c as (
  select id, nome, logo_url, is_pinned, servico::text as servico
  from clientes where deleted_at is null and not teste
),
l as (
  select distinct on (client_id) client_id, id, status::text as status,
         total_conteudos, total_estruturados, meta_conteudos
  from linhas_resumo
  where deleted_at is null and archived_at is null and ano = p_ano and mes = p_mes
  order by client_id, updated_at desc
),
g as (
  select client_id,
    count(*) filter (where situacao::text <> 'Cancelada') as total,
    count(*) filter (where situacao::text = 'Gravada') as gravadas,
    count(*) filter (where situacao::text in ('Agendada', 'Remarcada')) as marcadas,
    count(*) filter (where situacao::text = 'Pendente') as pendentes,
    min(data_gravacao) filter (where situacao::text in ('Agendada', 'Remarcada')) as proxima,
    count(*) filter (where situacao::text in ('Agendada', 'Remarcada') and data_gravacao < current_date) as atrasadas
  from gravacoes
  where deleted_at is null and archived_at is null
    and competencia_ano = p_ano and competencia_mes = p_mes
  group by client_id
),
r as (
  select gr.client_id,
    count(*) as total,
    count(*) filter (where ro.status::text = 'Em criação') as criacao,
    count(*) filter (where ro.status::text = 'Pronto para gravar') as prontos,
    count(*) filter (where ro.status::text = 'Gravado') as gravados
  from roteiros ro
  join gravacoes gr on gr.id = ro.recording_session_id
  where ro.deleted_at is null and ro.archived_at is null
    and gr.deleted_at is null and gr.archived_at is null and gr.situacao::text <> 'Cancelada'
    and gr.competencia_ano = p_ano and gr.competencia_mes = p_mes
  group by gr.client_id
),
v as (
  select client_id,
    count(*) as total,
    count(*) filter (where editing_status::text = 'entregue') as entregues,
    count(*) filter (where editing_status::text = 'aguardando_aprovacao') as aprovacao,
    count(*) filter (where editing_status::text = 'correcao') as correcao,
    count(*) filter (where editing_status::text <> 'entregue' and prazo is not null and prazo < current_date) as atrasados
  from demandas_edicao_resumo
  where deleted_at is null and editing_status::text <> 'descartado'
    and competencia_ano = p_ano and competencia_mes = p_mes
  group by client_id
),
d as (
  select ds.client_id,
    count(*) as total,
    count(*) filter (where ds.status::text = 'finalizado') as finalizados,
    count(*) filter (where ds.status::text = 'revisao_interna') as revisao,
    count(*) filter (where ds.status::text <> 'finalizado' and ds.prazo is not null and ds.prazo < current_date) as atrasados
  from design_resumo ds
  cross join ini
  left join l on l.id = ds.linha_id
  where l.id is not null
     or (ds.linha_id is null and ds.prazo >= ini.d0 and ds.prazo < ini.d1)
  group by ds.client_id
),
a as (
  select client_id, count(*) as pendentes
  from aprovacoes_painel
  where versao_atual and situacao::text in ('pendente', 'parcial')
  group by client_id
),
p as (
  select co.client_id,
    count(*) as total,
    count(*) filter (where co.status::text = 'Publicado') as publicados,
    count(*) filter (where co.status::text = 'Programado') as programados,
    count(*) filter (where co.status::text <> 'Publicado' and co.data_postagem < current_date) as atrasados
  from conteudos co
  cross join ini
  where co.deleted_at is null and co.archived_at is null
    and co.data_postagem >= ini.d0 and co.data_postagem < ini.d1
  group by co.client_id
)
select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'nome', c.nome, 'logo_url', c.logo_url, 'fixado', c.is_pinned, 'servico', c.servico,
    'linha', to_jsonb(l) - 'client_id',
    'gravacoes', to_jsonb(g) - 'client_id',
    'roteiros', to_jsonb(r) - 'client_id',
    'video', to_jsonb(v) - 'client_id',
    'design', to_jsonb(d) - 'client_id',
    'aprovacoes', coalesce(a.pendentes, 0),
    'publicacoes', to_jsonb(p) - 'client_id'
  ) order by c.nome), '[]'::jsonb)
from c
left join l on l.client_id = c.id
left join g on g.client_id = c.id
left join r on r.client_id = c.id
left join v on v.client_id = c.id
left join d on d.client_id = c.id
left join a on a.client_id = c.id
left join p on p.client_id = c.id;
$function$;

-- Resumo do Dashboard: o cliente de teste e o que é dele não entram
create or replace function public.dashboard_resumo_contagens()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r jsonb; inicio_mes timestamptz;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe interna vê o resumo do Dashboard.' using errcode = '42501';
  end if;
  inicio_mes := date_trunc('month', now());

  select jsonb_build_object('clientes', count(*)) into r
  from public.clientes where deleted_at is null and not teste;

  r := r || (
    select jsonb_build_object(
      'gravacoes', count(*),
      'rascunho',  count(*) filter (where status = 'Rascunho'),
      'pronto',    count(*) filter (where status = 'Pronto para gravar'),
      'gravado',   count(*) filter (where status = 'Gravado')
    )
    from public.gravacoes g where g.deleted_at is null and g.archived_at is null
      and not exists (select 1 from public.clientes c where c.id = g.client_id and c.teste)
  );

  r := r || (
    select jsonb_build_object(
      'roteiros', count(*),
      'mes',      count(*) filter (where ro.created_at >= inicio_mes)
    )
    from public.roteiros ro where ro.deleted_at is null and ro.archived_at is null
      and not exists (select 1 from public.gravacoes g join public.clientes c on c.id = g.client_id
                       where g.id = ro.recording_session_id and c.teste)
  );

  return r;
end;
$function$;
