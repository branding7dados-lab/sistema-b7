-- =========================================================================
-- B7 VÍDEO — GESTÃO, MÉTRICAS, FECHAMENTO MENSAL E AUTOMAÇÃO (PARTE 3)
-- =========================================================================
-- Estende Parte 1 (fundação operacional) e Parte 2 (versões, aprovação,
-- entrega, drag&drop) — aditivo, não recria nada. Nenhuma tabela/função
-- já existente é apagada; funções que precisam de um novo parâmetro são
-- recriadas com "create or replace", sempre com default, então nenhuma
-- chamada já existente no frontend quebra.
--
-- O que entra:
--   1) Duas colunas novas em demandas_edicao (roteiro_id, para a
--      automação Gravação→Edição; standby_revisar_em, pro lembrete de
--      standby) — nenhuma delas obrigatória, nenhuma reescreve dado.
--   2) Coluna nova em video_pacotes (quantidade_contratada) — só pra
--      quem quiser que o pacote tenha uma cota estruturada; sem ela, o
--      pacote continua sendo só uma sugestão de nome (nenhuma "cota
--      inventada").
--   3) video_competencias_fechadas — fechamento/reabertura de mês, com
--      um retrato (snapshot) das métricas no momento do fechamento.
--   4) Funções de métricas — sempre calculadas com SQL agregado no
--      banco (não é a tela que soma linha por linha no navegador).
--   5) video_criar_demanda ganha p_roteiro_id (opcional) e uma função
--      nova, video_gerar_demandas_de_gravacao, pra virar a automação
--      "Gerar demandas de edição" a partir dos roteiros de uma
--      gravação — com trava real contra duplicidade (unique index).
--   6) Alertas de prazo (entrega amanhã / atrasada / atrasada há mais
--      tempo) — reaproveita o mesmo padrão de eventos_dominio +
--      notificações já usado em todo o sistema, com a chave única
--      garantindo que o mesmo aviso nunca é criado duas vezes.
--
-- LIMITAÇÃO REAL, registrada aqui porque é importante: este projeto
-- não tem nenhum job agendado (pg_cron, Edge Function em cron) — os
-- alertas de prazo só são gerados quando alguém da equipe abre uma
-- tela do Vídeo (a função é chamada pelo frontend nesse momento, não
-- por um relógio rodando sozinho no servidor). Isso significa que um
-- aviso pode demorar até alguém abrir o sistema pra aparecer — não é
-- uma notificação em tempo real de verdade. A garantia de "não repete
-- o mesmo aviso" continua valendo (chave única), só a garantia de
-- "aparece exatamente à meia-noite" que não existe.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. COLUNAS NOVAS
-- ---------------------------------------------------------------------
alter table public.demandas_edicao add column if not exists roteiro_id uuid references public.roteiros(id) on delete set null;
alter table public.demandas_edicao add column if not exists standby_revisar_em date;

-- Trava real contra duplicidade: no máximo UMA demanda ativa por
-- roteiro (uma demanda "descartada" ou excluída libera o roteiro de
-- novo — não trava pra sempre). Isso é o que impede duplo-clique em
-- "Gerar demandas de edição" de criar duas demandas pro mesmo roteiro.
create unique index if not exists demandas_edicao_roteiro_unico
  on public.demandas_edicao (roteiro_id)
  where roteiro_id is not null and deleted_at is null and editing_status <> 'descartado';

-- Índices pra sustentar as consultas novas (carga da equipe, atrasos,
-- fechamento mensal) sem varrer a tabela inteira.
create index if not exists demandas_edicao_status_prazo
  on public.demandas_edicao (editing_status, prazo) where deleted_at is null;
create index if not exists demandas_edicao_videomaker_status
  on public.demandas_edicao (videomaker_id, editing_status) where deleted_at is null;

alter table public.video_pacotes add column if not exists quantidade_contratada int check (quantidade_contratada is null or quantidade_contratada > 0);

-- demandas_edicao_resumo (migration_video_producao.sql) ainda não
-- expunha roteiro_id nem standby_revisar_em — sem isso o frontend não
-- teria como saber, por exemplo, quais roteiros de uma gravação já
-- viraram demanda (automação abaixo) ou ler a data de acompanhamento
-- de standby. Recriada aditivamente, mesmas colunas de sempre + as
-- duas novas no fim.
create or replace view public.demandas_edicao_resumo
with (security_invoker = true) as
select
  de.id, de.client_id, de.gravacao_id, de.videomaker_id,
  de.competencia_ano, de.competencia_mes, de.codigo, de.titulo, de.pacote, de.prazo,
  de.link_material, de.editing_status, de.observacoes, de.origem, de.import_lote_id,
  de.criado_por, de.created_at, de.updated_at, de.entregue_em, de.deleted_at,
  cl.nome as cliente_nome,
  coalesce(cl.servico, 'ativo') as cliente_servico,
  pf.nome as videomaker_nome,
  g.situacao as gravacao_situacao,
  g.nome as gravacao_nome,
  de.kanban_id,
  de.prioridade,
  de.roteiro_id,
  de.standby_revisar_em
from public.demandas_edicao de
left join public.clientes cl on cl.id = de.client_id
left join public.perfis pf on pf.id = de.videomaker_id
left join public.gravacoes g on g.id = de.gravacao_id
where de.deleted_at is null;
grant select on public.demandas_edicao_resumo to authenticated;

-- ---------------------------------------------------------------------
-- 2. FECHAMENTO MENSAL
-- ---------------------------------------------------------------------
create table if not exists public.video_competencias_fechadas (
  id                uuid primary key default gen_random_uuid(),
  competencia_ano   int not null,
  competencia_mes   int not null check (competencia_mes between 1 and 12),
  fechado_por       uuid references public.perfis(id),
  fechado_em        timestamptz not null default now(),
  reaberto_por      uuid references public.perfis(id),
  reaberto_em       timestamptz,
  snapshot          jsonb not null default '{}'::jsonb,   -- retrato das métricas no momento do fechamento
  constraint video_competencias_fechadas_unica unique (competencia_ano, competencia_mes)
);

alter table public.video_competencias_fechadas enable row level security;
revoke insert, update, delete on public.video_competencias_fechadas from authenticated;
grant select on public.video_competencias_fechadas to authenticated;

drop policy if exists "video_competencias_fechadas select" on public.video_competencias_fechadas;
create policy "video_competencias_fechadas select" on public.video_competencias_fechadas
  for select to authenticated
  using (public.sou_equipe_interna());

-- Devolve true se a competência está fechada agora (reaberta = não
-- conta mais como fechada, mas o histórico de quando foi
-- fechada/reaberta continua na tabela).
create or replace function public.video_mes_fechado(p_ano int, p_mes int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.video_competencias_fechadas
    where competencia_ano = p_ano and competencia_mes = p_mes and reaberto_em is null
  );
$$;
revoke all on function public.video_mes_fechado(int, int) from public;
grant execute on function public.video_mes_fechado(int, int) to authenticated;

create or replace function public.video_fechar_mes(p_ano int, p_mes int, p_snapshot jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador podem fechar o mês.' using errcode = '42501';
  end if;
  insert into public.video_competencias_fechadas (competencia_ano, competencia_mes, fechado_por, snapshot)
  values (p_ano, p_mes, auth.uid(), coalesce(p_snapshot, '{}'::jsonb))
  on conflict (competencia_ano, competencia_mes) do update
    set fechado_por = excluded.fechado_por, fechado_em = now(), snapshot = excluded.snapshot,
        reaberto_por = null, reaberto_em = null;
end;
$$;
revoke all on function public.video_fechar_mes(int, int, jsonb) from public;
grant execute on function public.video_fechar_mes(int, int, jsonb) to authenticated;

create or replace function public.video_reabrir_mes(p_ano int, p_mes int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador podem reabrir o mês.' using errcode = '42501';
  end if;
  update public.video_competencias_fechadas
     set reaberto_por = auth.uid(), reaberto_em = now()
   where competencia_ano = p_ano and competencia_mes = p_mes and reaberto_em is null;
  if not found then
    raise exception 'Esse mês não está fechado.';
  end if;
end;
$$;
revoke all on function public.video_reabrir_mes(int, int) from public;
grant execute on function public.video_reabrir_mes(int, int) to authenticated;

-- ---------------------------------------------------------------------
-- 3. MÉTRICAS DO MÊS — tudo calculado com agregação no banco.
--
--    "Tempo de produção" e "ciclos de correção" só usam demandas com
--    trilha de eventos real (demandas_edicao_eventos, tipo='status').
--    Demanda antiga vinda de planilha, sem esses eventos, não entra
--    nessas duas médias — fica de fora, não vira um zero disfarçado.
--
--    "Correção do cliente" vs "correção interna": migration_video_
--    workspace.sql grava a mensagem da correção pedida pelo cliente
--    sempre começando com "Cliente (via ...)" (ver
--    video_registrar_decisao_cliente). Uso esse prefixo pra separar
--    as duas origens — é uma inferência sobre um padrão de texto já
--    existente, não uma coluna dedicada. Registro isso no relatório.
-- ---------------------------------------------------------------------
create or replace function public.video_gestao_resumo(p_ano int, p_mes int)
returns jsonb language sql stable security definer set search_path = public as $$
  with base as (
    select d.*
      from public.demandas_edicao d
     where d.competencia_ano = p_ano and d.competencia_mes = p_mes and d.deleted_at is null
  ),
  eventos as (
    select demanda_id,
           min(created_at) filter (where tipo = 'status' and para_status = 'em_edicao')            as inicio_edicao,
           min(created_at) filter (where tipo = 'status' and para_status = 'aguardando_aprovacao')  as primeira_aprovacao,
           count(*)        filter (where tipo = 'status' and para_status = 'correcao')              as ciclos_correcao,
           count(*)        filter (where tipo = 'status' and para_status = 'correcao'
                                     and mensagem like 'Cliente (via %')                             as ciclos_correcao_cliente
      from public.demandas_edicao_eventos
     where demanda_id in (select id from base)
     group by demanda_id
  ),
  cruzado as (
    select b.*, e.inicio_edicao, e.primeira_aprovacao, e.ciclos_correcao, e.ciclos_correcao_cliente
      from base b left join eventos e on e.demanda_id = b.id
  )
  select jsonb_build_object(
    'competencia_ano', p_ano, 'competencia_mes', p_mes,
    'total', (select count(*) from cruzado),
    'por_status', (select coalesce(jsonb_object_agg(editing_status, qtd), '{}'::jsonb)
                     from (select editing_status, count(*) qtd from cruzado group by editing_status) s),
    'atrasadas', (select count(*) from cruzado
                   where editing_status not in ('entregue', 'descartado') and prazo is not null and prazo < current_date),
    'vence_hoje', (select count(*) from cruzado
                    where editing_status not in ('entregue', 'descartado') and prazo = current_date),
    'entregues_no_prazo', (select count(*) from cruzado
                             where editing_status = 'entregue' and prazo is not null and entregue_em is not null
                               and entregue_em::date <= prazo),
    'entregues_com_atraso', (select count(*) from cruzado
                               where editing_status = 'entregue' and prazo is not null and entregue_em is not null
                                 and entregue_em::date > prazo),
    'entregues_sem_prazo_definido', (select count(*) from cruzado where editing_status = 'entregue' and prazo is null),
    'ciclos_correcao_total', (select coalesce(sum(ciclos_correcao), 0) from cruzado),
    'ciclos_correcao_cliente', (select coalesce(sum(ciclos_correcao_cliente), 0) from cruzado),
    'ciclos_correcao_interna', (select coalesce(sum(ciclos_correcao - ciclos_correcao_cliente), 0) from cruzado where ciclos_correcao is not null),
    'tempo_medio_producao_dias', (select round(avg(extract(epoch from (primeira_aprovacao - inicio_edicao)) / 86400.0)::numeric, 1)
                                     from cruzado
                                    where inicio_edicao is not null and primeira_aprovacao is not null
                                      and primeira_aprovacao >= inicio_edicao),
    'demandas_com_tempo_medido', (select count(*) from cruzado
                                    where inicio_edicao is not null and primeira_aprovacao is not null and primeira_aprovacao >= inicio_edicao)
  );
$$;
revoke all on function public.video_gestao_resumo(int, int) from public;
grant execute on function public.video_gestao_resumo(int, int) to authenticated;

-- Carga da equipe — trabalho ATIVO (nunca conta Entregue/Descartado).
-- Sem filtro de competência: é sempre "agora", porque carga de
-- trabalho é uma foto do presente, não do mês passado.
create or replace function public.video_carga_equipe()
returns table (
  videomaker_id uuid, videomaker_nome text,
  para_iniciar int, em_edicao int, correcao int, aguardando_aprovacao int, standby int,
  atrasadas int, vence_hoje int, total_ativo int
) language sql stable security definer set search_path = public as $$
  select p.id, p.nome,
    count(*) filter (where d.editing_status = 'pendente')::int,
    count(*) filter (where d.editing_status = 'em_edicao')::int,
    count(*) filter (where d.editing_status = 'correcao')::int,
    count(*) filter (where d.editing_status = 'aguardando_aprovacao')::int,
    count(*) filter (where d.editing_status = 'standby')::int,
    count(*) filter (where d.editing_status not in ('entregue', 'descartado') and d.prazo is not null and d.prazo < current_date)::int,
    count(*) filter (where d.editing_status not in ('entregue', 'descartado') and d.prazo = current_date)::int,
    count(*)::int
  from public.perfis p
  join public.demandas_edicao d on d.videomaker_id = p.id
  where p.papel = 'videomaker' and p.estado = 'ativa'
    and d.deleted_at is null and d.editing_status not in ('entregue', 'descartado')
  group by p.id, p.nome
  order by p.nome;
$$;
revoke all on function public.video_carga_equipe() from public;
grant execute on function public.video_carga_equipe() to authenticated;

-- Produção por cliente no mês — cota de pacote só aparece quando o
-- texto do campo "Pacote" bate (sem diferenciar maiúsc./espaços) com
-- um pacote do catálogo QUE TEM quantidade_contratada definida. Sem
-- isso, quantidade_contratada vem null e o frontend não inventa nada.
create or replace function public.video_producao_por_cliente(p_ano int, p_mes int)
returns table (
  client_id uuid, client_nome text, pacote text, quantidade_contratada int,
  total int, entregues int, em_producao int, aguardando_aprovacao int, correcao int
) language sql stable security definer set search_path = public as $$
  select c.id, c.nome, coalesce(nullif(btrim(d.pacote), ''), '—'),
    max(vp.quantidade_contratada),
    count(*)::int,
    count(*) filter (where d.editing_status = 'entregue')::int,
    count(*) filter (where d.editing_status in ('pendente', 'em_edicao'))::int,
    count(*) filter (where d.editing_status = 'aguardando_aprovacao')::int,
    count(*) filter (where d.editing_status = 'correcao')::int
  from public.demandas_edicao d
  join public.clientes c on c.id = d.client_id
  left join public.video_pacotes vp on lower(btrim(vp.nome)) = lower(btrim(d.pacote))
  where d.competencia_ano = p_ano and d.competencia_mes = p_mes and d.deleted_at is null
    and d.editing_status <> 'descartado'
  group by c.id, c.nome, coalesce(nullif(btrim(d.pacote), ''), '—')
  order by c.nome;
$$;
revoke all on function public.video_producao_por_cliente(int, int) from public;
grant execute on function public.video_producao_por_cliente(int, int) to authenticated;

-- Relatório por videomaker no mês.
create or replace function public.video_relatorio_por_videomaker(p_ano int, p_mes int)
returns table (
  videomaker_id uuid, videomaker_nome text,
  entregues int, em_edicao int, aguardando_aprovacao int, correcao int,
  entregues_com_atraso int, tempo_medio_producao_dias numeric
) language sql stable security definer set search_path = public as $$
  with base as (
    select d.* from public.demandas_edicao d
    where d.competencia_ano = p_ano and d.competencia_mes = p_mes and d.deleted_at is null and d.videomaker_id is not null
  ),
  eventos as (
    select demanda_id,
      min(created_at) filter (where tipo = 'status' and para_status = 'em_edicao')           as inicio_edicao,
      min(created_at) filter (where tipo = 'status' and para_status = 'aguardando_aprovacao') as primeira_aprovacao
    from public.demandas_edicao_eventos where demanda_id in (select id from base) group by demanda_id
  )
  select p.id, p.nome,
    count(*) filter (where b.editing_status = 'entregue')::int,
    count(*) filter (where b.editing_status = 'em_edicao')::int,
    count(*) filter (where b.editing_status = 'aguardando_aprovacao')::int,
    count(*) filter (where b.editing_status = 'correcao')::int,
    count(*) filter (where b.editing_status = 'entregue' and b.prazo is not null and b.entregue_em is not null and b.entregue_em::date > b.prazo)::int,
    round(avg(extract(epoch from (ev.primeira_aprovacao - ev.inicio_edicao)) / 86400.0)
          filter (where ev.inicio_edicao is not null and ev.primeira_aprovacao is not null and ev.primeira_aprovacao >= ev.inicio_edicao)::numeric, 1)
  from base b
  join public.perfis p on p.id = b.videomaker_id
  left join eventos ev on ev.demanda_id = b.id
  group by p.id, p.nome
  order by p.nome;
$$;
revoke all on function public.video_relatorio_por_videomaker(int, int) from public;
grant execute on function public.video_relatorio_por_videomaker(int, int) to authenticated;

-- ---------------------------------------------------------------------
-- 4. AUTOMAÇÃO GRAVAÇÃO → DEMANDAS DE EDIÇÃO
-- ---------------------------------------------------------------------
-- IMPORTANTE: adicionar um parâmetro novo no fim muda a assinatura da
-- função (o conjunto de tipos dos parâmetros) — "create or replace"
-- NÃO substitui a versão antiga nesse caso, cria uma segunda função
-- sobrecarregada (mesmo nome, assinatura diferente), e as duas
-- passam a coexistir. A versão realmente em produção hoje (criada em
-- migration_video_producao.sql) já tem 11 parâmetros, terminando em
-- p_prioridade — não os 10 da versão original da Parte 1. O drop
-- abaixo tem que mirar essa assinatura real de 11 parâmetros; um drop
-- contra a assinatura antiga de 10 deixaria as duas coexistindo, e
-- qualquer chamada com 11 argumentos continuaria caindo na versão sem
-- a correção do evento de 'em_edicao' feita abaixo — silenciosamente.
drop function if exists public.video_criar_demanda(uuid, text, text, int, int, uuid, uuid, text, date, text, text);

create or replace function public.video_criar_demanda(
  p_client_id uuid, p_titulo text, p_codigo text default '',
  p_competencia_ano int default null, p_competencia_mes int default null,
  p_gravacao_id uuid default null, p_videomaker_id uuid default null,
  p_pacote text default '', p_prazo date default null, p_observacoes text default '',
  p_prioridade text default 'normal', p_roteiro_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare novo uuid; ator public.perfis%rowtype; vm public.perfis%rowtype; ano int; mes int; prio text;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe cria demandas de edição.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_titulo), '') = '' then
    raise exception 'Toda demanda de edição precisa de um título.';
  end if;
  if p_client_id is null or not exists (select 1 from public.clientes where id = p_client_id) then
    raise exception 'Cliente inválido.';
  end if;
  if p_videomaker_id is not null and not public.eh_videomaker_elegivel(p_videomaker_id) then
    raise exception 'Esse usuário não é um videomaker ativo.';
  end if;
  prio := case when p_prioridade in ('normal', 'alta', 'urgente') then p_prioridade else 'normal' end;
  select * into ator from public.perfis where id = auth.uid();
  if p_videomaker_id is not null then
    select * into vm from public.perfis where id = p_videomaker_id;
  end if;
  ano := coalesce(p_competencia_ano, extract(year from now())::int);
  mes := coalesce(p_competencia_mes, extract(month from now())::int);

  insert into public.demandas_edicao
    (client_id, gravacao_id, videomaker_id, competencia_ano, competencia_mes, codigo, titulo,
     pacote, prazo, observacoes, origem, criado_por, roteiro_id,
     editing_status, prioridade)
  values
    (p_client_id, p_gravacao_id, p_videomaker_id, ano, mes, coalesce(p_codigo, ''), p_titulo,
     coalesce(p_pacote, ''), p_prazo, coalesce(p_observacoes, ''), 'manual', auth.uid(), p_roteiro_id,
     case when p_videomaker_id is not null then 'em_edicao' else 'pendente' end, prio)
  returning id into novo;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, para_status, ator_id, ator_nome, ator_papel, mensagem)
  values (novo, 'criada', 'pendente', auth.uid(), ator.nome, ator.papel, null);

  /* Correção de uma lacuna real, achada testando a métrica de "tempo
     médio de produção" desta Parte 3: quando a demanda já nasce com
     videomaker atribuído, editing_status vai direto pra 'em_edicao'
     no insert acima, mas nenhum evento de status registrava essa
     transição — só o evento genérico 'criada' (sempre com
     para_status='pendente', mesmo quando o status real já era outro).
     Sem esse evento, video_gestao_resumo/video_relatorio_por_videomaker
     não tinham como saber quando a edição começou pra essa demanda, e
     excluíam da média TODA demanda criada com responsável já definido
     — não só as importadas de planilha, que era a exclusão esperada.
     Corrigido aqui: se a demanda já nasce em 'em_edicao', registra
     esse evento também. Não muda nenhum comportamento visível — só
     preenche a trilha que as métricas novas passaram a depender. */
  if p_videomaker_id is not null then
    insert into public.demandas_edicao_eventos (demanda_id, tipo, de_status, para_status, ator_id, ator_nome, ator_papel, mensagem)
    values (novo, 'status', 'pendente', 'em_edicao', auth.uid(), ator.nome, ator.papel, null);
  end if;

  if p_videomaker_id is not null then
    insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    values ('video.atribuida', 'video.atribuida:' || novo || ':' || now()::text, 'demanda_edicao', novo, p_client_id,
            auth.uid(), ator.nome, ator.papel,
            jsonb_build_object('videomaker_id', p_videomaker_id, 'videomaker_nome', vm.nome, 'titulo', p_titulo));
    perform public.video_processar_evento((select id from public.eventos_dominio
      where chave = 'video.atribuida:' || novo || ':' || now()::text order by created_at desc limit 1));
  end if;

  return novo;
end;
$$;
revoke all on function public.video_criar_demanda(uuid, text, text, int, int, uuid, uuid, text, date, text, text, uuid) from public;
grant execute on function public.video_criar_demanda(uuid, text, text, int, int, uuid, uuid, text, date, text, text, uuid) to authenticated;

-- Gera uma demanda de edição por roteiro selecionado. Cada roteiro só
-- gera UMA demanda ativa (o unique index acima garante isso mesmo sob
-- duplo clique/retry) — se o roteiro já tiver uma demanda ativa,
-- devolve a existente em vez de criar outra.
create or replace function public.video_gerar_demandas_de_gravacao(
  p_gravacao_id uuid, p_roteiro_ids uuid[], p_videomaker_id uuid default null, p_prazo date default null
) returns table (roteiro_id uuid, demanda_id uuid, ja_existia boolean)
language plpgsql security definer set search_path = public as $$
declare g public.gravacoes%rowtype; r public.roteiros%rowtype; rid uuid; existente uuid; nova uuid;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe gera demandas de edição.' using errcode = '42501';
  end if;
  select * into g from public.gravacoes where id = p_gravacao_id and deleted_at is null;
  if not found then raise exception 'Gravação não encontrada.'; end if;

  foreach rid in array coalesce(p_roteiro_ids, '{}') loop
    select * into r from public.roteiros where id = rid and recording_session_id = p_gravacao_id and deleted_at is null;
    if not found then continue; end if;

    select de.id into existente from public.demandas_edicao de
      where de.roteiro_id = rid and de.deleted_at is null and de.editing_status <> 'descartado'
      limit 1;

    if existente is not null then
      roteiro_id := rid; demanda_id := existente; ja_existia := true;
      return next;
      continue;
    end if;

    nova := public.video_criar_demanda(
      g.client_id, coalesce(nullif(btrim(r.titulo), ''), g.nome), '',
      extract(year from coalesce(p_prazo, g.data_gravacao, now()))::int,
      extract(month from coalesce(p_prazo, g.data_gravacao, now()))::int,
      p_gravacao_id, p_videomaker_id, '', p_prazo, coalesce(r.objetivo, ''),
      p_roteiro_id => rid
    );
    roteiro_id := rid; demanda_id := nova; ja_existia := false;
    return next;
  end loop;
end;
$$;
revoke all on function public.video_gerar_demandas_de_gravacao(uuid, uuid[], uuid, date) from public;
grant execute on function public.video_gerar_demandas_de_gravacao(uuid, uuid[], uuid, date) to authenticated;

-- video_atribuir recriada com a mesma correção: atribuir um videomaker
-- a uma demanda "pendente" também vira 'em_edicao' por baixo dos panos
-- (mesmo comportamento de sempre, migration_video_kanban.sql), mas
-- não registrava esse evento de status — mesma lacuna encontrada em
-- video_criar_demanda acima, mesma correção.
create or replace function public.video_atribuir(p_demanda_id uuid, p_videomaker_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.demandas_edicao%rowtype; ator public.perfis%rowtype; vm public.perfis%rowtype; evid uuid;
  vira_em_edicao boolean; k uuid;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe atribui um videomaker.' using errcode = '42501';
  end if;
  select * into d from public.demandas_edicao where id = p_demanda_id and deleted_at is null;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  if p_videomaker_id is not null then
    select * into vm from public.perfis where id = p_videomaker_id and papel = 'videomaker' and estado = 'ativa';
    if not found then raise exception 'Esse usuário não é um videomaker ativo.'; end if;
  end if;
  select * into ator from public.perfis where id = auth.uid();
  vira_em_edicao := p_videomaker_id is not null and d.editing_status = 'pendente';

  update public.demandas_edicao
     set videomaker_id = p_videomaker_id, updated_at = now(),
         editing_status = case when vira_em_edicao then 'em_edicao' else editing_status end
   where id = p_demanda_id;

  if vira_em_edicao and d.kanban_id is null then
    insert into public.kanban_demandas (titulo, coluna, client_id, tipo_vinculo, vinculo_id, tipo, responsavel_id, prazo, criado_por, origem_evento)
    values (d.titulo, 'producao', d.client_id, 'demanda_edicao', d.id, 'video', p_videomaker_id, d.prazo, auth.uid(), 'video.atribuida')
    returning id into k;
    update public.demandas_edicao set kanban_id = k where id = p_demanda_id;
  elsif d.kanban_id is not null then
    update public.kanban_demandas set responsavel_id = p_videomaker_id, updated_at = now() where id = d.kanban_id;
  end if;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, ator_id, ator_nome, ator_papel, mensagem)
  values (p_demanda_id, 'atribuida', auth.uid(), ator.nome, ator.papel,
          case when p_videomaker_id is null then 'Atribuição removida' else null end);

  if vira_em_edicao then
    insert into public.demandas_edicao_eventos (demanda_id, tipo, de_status, para_status, ator_id, ator_nome, ator_papel, mensagem)
    values (p_demanda_id, 'status', 'pendente', 'em_edicao', auth.uid(), ator.nome, ator.papel, null);
  end if;

  if p_videomaker_id is not null then
    insert into public.eventos_dominio (id, tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    values (gen_random_uuid(), 'video.atribuida', 'video.atribuida:' || p_demanda_id || ':' || now()::text,
            'demanda_edicao', p_demanda_id, d.client_id, auth.uid(), ator.nome, ator.papel,
            jsonb_build_object('videomaker_id', p_videomaker_id, 'videomaker_nome', vm.nome, 'titulo', d.titulo))
    returning id into evid;
    perform public.video_processar_evento(evid);
  end if;
end;
$$;
revoke all on function public.video_atribuir(uuid, uuid) from public;
grant execute on function public.video_atribuir(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. ALERTAS DE PRAZO (ver nota de limitação real no topo do arquivo)
-- ---------------------------------------------------------------------
create or replace function public.video_verificar_alertas_prazo()
returns void language plpgsql security definer set search_path = public as $$
declare r record; evid uuid;
begin
  if not public.sou_equipe_interna() then return; end if;

  for r in
    select d.* from public.demandas_edicao d
    where d.deleted_at is null
      and d.editing_status not in ('entregue', 'descartado')
      and d.prazo is not null
      and (public.sou_equipe() or d.videomaker_id = auth.uid())
  loop
    if r.prazo = current_date + 1 and r.videomaker_id is not null then
      begin
        insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload)
        values ('video.prazo_amanha', 'video.prazo_amanha:' || r.id || ':' || r.prazo::text,
                'demanda_edicao', r.id, r.client_id, jsonb_build_object('titulo', r.titulo))
        returning id into evid;
        perform public.video_processar_evento(evid);
      exception when unique_violation then null;
      end;
    end if;

    if r.prazo < current_date and r.videomaker_id is not null then
      begin
        insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload)
        values ('video.atrasado', 'video.atrasado:' || r.id || ':' || r.prazo::text,
                'demanda_edicao', r.id, r.client_id, jsonb_build_object('titulo', r.titulo))
        returning id into evid;
        perform public.video_processar_evento(evid);
      exception when unique_violation then null;
      end;
    end if;

    if r.prazo <= current_date - 2 then
      begin
        insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload)
        values ('video.atrasado_escalado', 'video.atrasado_escalado:' || r.id || ':' || r.prazo::text,
                'demanda_edicao', r.id, r.client_id, jsonb_build_object('titulo', r.titulo))
        returning id into evid;
        perform public.video_processar_evento(evid);
      exception when unique_violation then null;
      end;
    end if;
  end loop;
end;
$$;
revoke all on function public.video_verificar_alertas_prazo() from public;
grant execute on function public.video_verificar_alertas_prazo() to authenticated;

-- video_processar_evento recriada por inteiro (mesma base da Parte 2,
-- ver migration_video_workspace.sql) só com 3 ramos novos no fim.
create or replace function public.video_processar_evento(p_evento_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  ev public.eventos_dominio%rowtype;
  d  public.demandas_edicao%rowtype;
  tit text; msg text; link text;
begin
  select * into ev from public.eventos_dominio where id = p_evento_id for update;
  if not found or ev.processado_em is not null then return; end if;
  if ev.alvo_tipo <> 'demanda_edicao' then
    update public.eventos_dominio set processado_em = now() where id = ev.id;
    return;
  end if;

  select * into d from public.demandas_edicao where id = ev.alvo_id;
  if not found then
    update public.eventos_dominio set processado_em = now(), erro = 'demanda de edição não encontrada' where id = ev.id;
    return;
  end if;

  link := '#/video/' || d.id;

  if ev.tipo = 'video.atribuida' and ev.payload->>'videomaker_id' is not null then
    tit := coalesce(ev.ator_nome, 'A equipe') || ' atribuiu "' || coalesce(ev.payload->>'titulo', d.titulo) || '" a ' ||
           coalesce(ev.payload->>'videomaker_nome', 'um videomaker');
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    values (ev.id, (ev.payload->>'videomaker_id')::uuid, d.client_id, ev.tipo, tit, null, link)
    on conflict (evento_id, destinatario_id) do nothing;

  elsif ev.tipo = 'video.aguardando_aprovacao' then
    tit := coalesce(ev.ator_nome, 'A equipe') || ' enviou "' || coalesce(ev.payload->>'titulo', d.titulo) || '" para aprovação';
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select ev.id, p.id, d.client_id, ev.tipo, tit, null, link
      from public.perfis p where p.estado = 'ativa' and p.papel in ('admin', 'coordenador') and p.id is distinct from ev.ator_id
    on conflict (evento_id, destinatario_id) do nothing;

  elsif ev.tipo = 'video.aprovado_cliente' then
    tit := 'Cliente aprovou "' || coalesce(ev.payload->>'titulo', d.titulo) || '" (V' || lpad(coalesce(ev.payload->>'versao', '?'), 2, '0') || ')';
    if d.videomaker_id is not null then
      insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
      values (ev.id, d.videomaker_id, d.client_id, ev.tipo, tit, null, link)
      on conflict (evento_id, destinatario_id) do nothing;
    end if;

  elsif ev.tipo = 'video.entregue' then
    tit := coalesce(ev.ator_nome, 'O videomaker') || ' marcou "' || coalesce(ev.payload->>'titulo', d.titulo) || '" como entregue';
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select ev.id, p.id, d.client_id, ev.tipo, tit, null, link
      from public.perfis p where p.estado = 'ativa' and p.papel in ('admin', 'coordenador') and p.id is distinct from ev.ator_id
    on conflict (evento_id, destinatario_id) do nothing;

  elsif ev.tipo = 'video.correcao_solicitada' then
    tit := coalesce(ev.ator_nome, 'A equipe') || ' pediu correção em "' || coalesce(ev.payload->>'titulo', d.titulo) || '"';
    msg := ev.payload->>'mensagem';
    if d.videomaker_id is not null then
      insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
      values (ev.id, d.videomaker_id, d.client_id, ev.tipo, tit, msg, link)
      on conflict (evento_id, destinatario_id) do nothing;
    end if;

  elsif ev.tipo = 'video.prazo_amanha' then
    tit := 'Entrega de "' || coalesce(ev.payload->>'titulo', d.titulo) || '" é amanhã';
    if d.videomaker_id is not null then
      insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
      values (ev.id, d.videomaker_id, d.client_id, ev.tipo, tit, null, link)
      on conflict (evento_id, destinatario_id) do nothing;
    end if;

  elsif ev.tipo = 'video.atrasado' then
    tit := '"' || coalesce(ev.payload->>'titulo', d.titulo) || '" está atrasada';
    if d.videomaker_id is not null then
      insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
      values (ev.id, d.videomaker_id, d.client_id, ev.tipo, tit, null, link)
      on conflict (evento_id, destinatario_id) do nothing;
    end if;

  elsif ev.tipo = 'video.atrasado_escalado' then
    tit := '"' || coalesce(ev.payload->>'titulo', d.titulo) || '" está atrasada há mais de 1 dia';
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select ev.id, p.id, d.client_id, ev.tipo, tit, null, link
      from public.perfis p where p.estado = 'ativa' and p.papel in ('admin', 'coordenador')
    on conflict (evento_id, destinatario_id) do nothing;
  end if;

  update public.eventos_dominio set processado_em = now() where id = ev.id;
end;
$$;
revoke all on function public.video_processar_evento(uuid) from public;
grant execute on function public.video_processar_evento(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. COTA DE PACOTE (definir/limpar quantidade_contratada) e
--    DATA DE ACOMPANHAMENTO DE STANDBY
-- ---------------------------------------------------------------------
-- video_criar_pacote/video_excluir_pacote (migration_video_pacotes.sql)
-- não tinham como editar quantidade_contratada — só existia a coluna,
-- sem função de escrita, porque na Parte 3 anterior a cota não existia
-- ainda. p_quantidade null limpa a cota (volta a ser "só sugestão de
-- nome", sem número nenhum, que é o padrão de segurança contra "cota
-- inventada").
create or replace function public.video_definir_quota_pacote(p_id uuid, p_quantidade int default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe define a cota de um pacote.' using errcode = '42501';
  end if;
  if p_quantidade is not null and p_quantidade <= 0 then
    raise exception 'A quantidade contratada precisa ser maior que zero.';
  end if;
  update public.video_pacotes set quantidade_contratada = p_quantidade where id = p_id;
  if not found then raise exception 'Pacote não encontrado.'; end if;
end;
$$;
revoke all on function public.video_definir_quota_pacote(uuid, int) from public;
grant execute on function public.video_definir_quota_pacote(uuid, int) to authenticated;

-- Data de acompanhamento de standby: "revisar essa demanda em X" —
-- só um lembrete visual (não dispara evento/notificação sozinho, é
-- consultado quando a equipe abre a tela), evitando duplicar o
-- mecanismo de alerta de prazo já existente acima.
create or replace function public.video_definir_standby(p_demanda_id uuid, p_revisar_em date default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe define o acompanhamento de standby.' using errcode = '42501';
  end if;
  update public.demandas_edicao set standby_revisar_em = p_revisar_em
   where id = p_demanda_id and deleted_at is null;
  if not found then raise exception 'Demanda não encontrada.'; end if;
end;
$$;
revoke all on function public.video_definir_standby(uuid, date) from public;
grant execute on function public.video_definir_standby(uuid, date) to authenticated;
