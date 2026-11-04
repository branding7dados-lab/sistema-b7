-- =====================================================================
-- PANORAMA (Kevin, 08/10/2026) — o raio-X do mês por cliente.
-- Uma função só, numa ida ao banco, devolve para cada cliente como está
-- cada etapa do mês: linha editorial, roteiros, gravações, vídeos,
-- design, aprovações pendentes e publicações.
--
-- SECURITY INVOKER: roda com as permissões de quem chama. Não abre nada
-- novo — cada pessoa só recebe o que as regras de acesso (RLS) já a
-- deixam ler em cada tabela. Nenhuma política foi criada ou alterada.
-- Só leitura.
--
-- Regras de cada coluna (as mesmas das telas de origem):
--   linha        a linha editorial do cliente naquele mês/ano
--   gravações    pelo mês de referência (competência); canceladas fora
--   roteiros     os roteiros das gravações daquele mês de referência
--   vídeos       demandas pela competência; descartadas fora
--   design       peças da linha do mês, ou sem linha com prazo no mês
--   aprovações   o que está aguardando o cliente AGORA (versão atual)
--   publicações  conteúdos com data de postagem dentro do mês
--   "atrasado"   prazo/data anterior a hoje e ainda não concluído
--
-- Para desfazer: drop function public.panorama_mes(int, int);
-- =====================================================================
create or replace function public.panorama_mes(p_ano int, p_mes int)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with ini as (
  select make_date(p_ano, p_mes, 1) as d0,
         (make_date(p_ano, p_mes, 1) + interval '1 month')::date as d1
),
c as (
  select id, nome, logo_url, is_pinned, servico::text as servico
  from clientes where deleted_at is null
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
$$;

revoke all on function public.panorama_mes(int, int) from public, anon;
grant execute on function public.panorama_mes(int, int) to authenticated;
