-- zzz274: PROJETOS AVULSOS — cliente que compra um trabalho pontual (não mensal).
-- Três tipos:
--   completo      → a B7 faz roteiro, gravação e edição;
--   cliente_grava → a B7 faz roteiro e edição; o cliente grava e manda o material;
--   so_edicao     → o cliente manda o material; a B7 edita.
-- Tudo acontece no sistema da equipe (cliente avulso não usa o portal). O material
-- chega por link do Drive. Criar o projeto já monta as tarefas nos lugares de sempre:
-- roteiros dentro de uma gravação (é onde roteiro mora), a gravação na agenda (só no
-- completo) e as demandas de edição — travadas (standby) até a hora delas.
-- Aplicada como: projetos_avulsos_1.

-- ------------------------------------------------------------ contrato do cliente
alter table public.clientes add column if not exists contrato text not null default 'mensal';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_contrato_ok') then
    alter table public.clientes add constraint clientes_contrato_ok check (contrato in ('mensal', 'avulso'));
  end if;
end $$;

create or replace view public.clientes_resumo with (security_invoker = on) as
 SELECT c.id, c.nome, COALESCE(ci.observacoes, c.observacoes) AS observacoes, c.logo_url, c.logo_path, c.is_pinned,
    c.deleted_at, c.created_at, c.updated_at,
    ( SELECT count(*) AS count FROM gravacoes g
       WHERE g.client_id = c.id AND g.deleted_at IS NULL AND g.archived_at IS NULL) AS total_gravacoes,
    ( SELECT count(*) AS count FROM roteiros r JOIN gravacoes g2 ON g2.id = r.recording_session_id
       WHERE g2.client_id = c.id AND r.deleted_at IS NULL AND g2.deleted_at IS NULL) AS total_roteiros,
    GREATEST(c.updated_at, COALESCE(( SELECT max(g3.updated_at) AS max FROM gravacoes g3
       WHERE g3.client_id = c.id), c.updated_at)) AS ultima_atividade,
    c.teste, c.modo, COALESCE(ci.whatsapp_grupo, c.whatsapp_grupo) AS whatsapp_grupo, c.contrato
   FROM clientes c LEFT JOIN clientes_interno ci ON ci.client_id = c.id;

-- ------------------------------------------------------------ projetos
create table if not exists public.projetos_avulsos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null check (tipo in ('completo', 'cliente_grava', 'so_edicao')),
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  qtd_videos int not null default 1 check (qtd_videos between 1 and 30),
  prazo date,
  drive_link text not null default '' check (drive_link = '' or drive_link ~* '^https?://'),
  observacoes text not null default '' check (char_length(observacoes) <= 2000),
  etapa text not null check (etapa in ('roteiro', 'gravacao', 'material', 'edicao', 'aprovacao', 'entregue', 'cancelado')),
  gravacao_id uuid references public.gravacoes(id) on delete set null,
  videomaker_id uuid references public.perfis(id) on delete set null,
  roteiro_aprovado_em timestamptz,
  material_recebido_em timestamptz,
  entregue_em timestamptz,
  cancelado_em timestamptz,
  ultimo_lembrete_em timestamptz,
  criado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists projetos_avulsos_client_idx on public.projetos_avulsos (client_id);
create index if not exists projetos_avulsos_gravacao_idx on public.projetos_avulsos (gravacao_id);
create index if not exists projetos_avulsos_videomaker_idx on public.projetos_avulsos (videomaker_id);
create index if not exists projetos_avulsos_criado_por_idx on public.projetos_avulsos (criado_por);
alter table public.projetos_avulsos enable row level security;
grant select on public.projetos_avulsos to authenticated;
create policy projetos_avulsos_ler on public.projetos_avulsos for select to authenticated
  using ((select public.sou_equipe_interna()));

alter table public.gravacoes add column if not exists projeto_id uuid references public.projetos_avulsos(id) on delete set null;
alter table public.gravacoes add column if not exists pelo_cliente boolean not null default false;
create index if not exists gravacoes_projeto_idx on public.gravacoes (projeto_id);
alter table public.demandas_edicao add column if not exists projeto_id uuid references public.projetos_avulsos(id) on delete set null;
create index if not exists demandas_edicao_projeto_idx on public.demandas_edicao (projeto_id);
-- origem fica 'manual'; o vínculo com o projeto é o projeto_id (sem mexer na regra de origem)

-- ações (Configurações → O que cada um pode fazer)
insert into public.acoes (id, modulo, rotulo, descricao, ordem, padrao_funcoes, nivel_min) values
  ('projeto.gerir', 'clientes', 'Criar e acompanhar projetos avulsos', 'Abrir projeto avulso, marcar roteiro aprovado, material recebido e entrega.', 82, '{coordenador}', 2)
on conflict (id) do update set rotulo = excluded.rotulo, descricao = excluded.descricao, ordem = excluded.ordem;

-- ------------------------------------------------------------ criar
create or replace function public.projeto_avulso_criar(p_client uuid, p_tipo text, p_nome text, p_qtd int, p_prazo date,
  p_drive text, p_obs text, p_videomaker uuid, p_data_gravacao date)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; gid uuid; rid uuid; k int; nome text := btrim(coalesce(p_nome, '')); qtd int := greatest(1, least(30, coalesce(p_qtd, 1)));
  drive text := btrim(coalesce(p_drive, '')); comp date := coalesce(p_prazo, public.notif_hoje()); etapa text;
begin
  if not public.pode_acao('projeto.gerir') then raise exception 'Sua conta não cria projetos avulsos. Peça à administração para liberar em Funções e permissões.' using errcode = '42501'; end if;
  if p_tipo not in ('completo', 'cliente_grava', 'so_edicao') then raise exception 'Escolha o tipo do projeto.'; end if;
  if char_length(nome) < 2 then raise exception 'Dê um nome ao projeto.'; end if;
  if drive <> '' and drive !~* '^https?://' then raise exception 'O link do Drive precisa começar com https://'; end if;
  if not exists (select 1 from public.clientes where id = p_client and deleted_at is null) then raise exception 'Cliente não encontrado.'; end if;
  etapa := case p_tipo when 'so_edicao' then 'material' else 'roteiro' end;

  insert into public.projetos_avulsos (client_id, tipo, nome, qtd_videos, prazo, drive_link, observacoes, etapa, videomaker_id)
  values (p_client, p_tipo, nome, qtd, p_prazo, drive, left(btrim(coalesce(p_obs, '')), 2000), etapa, p_videomaker)
  returning id into pid;

  -- roteiros moram numa gravação: no "cliente grava" ela não vai para a agenda da equipe (pelo_cliente)
  if p_tipo in ('completo', 'cliente_grava') then
    insert into public.gravacoes (client_id, nome, competencia_ano, competencia_mes, data_gravacao, videomaker_id, observacoes, projeto_id, pelo_cliente)
    values (p_client, nome, extract(year from comp)::int, extract(month from comp)::int,
            case when p_tipo = 'completo' then p_data_gravacao end,
            case when p_tipo = 'completo' then p_videomaker end,
            case when p_tipo = 'cliente_grava' then 'Projeto avulso: o cliente grava e manda o material.' else 'Projeto avulso.' end,
            pid, p_tipo = 'cliente_grava')
    returning id into gid;
    update public.projetos_avulsos set gravacao_id = gid where id = pid;
  end if;

  for k in 1..qtd loop
    rid := null;
    if gid is not null then
      insert into public.roteiros (recording_session_id, position, titulo)
      values (gid, k - 1, case when qtd = 1 then nome else nome || ' — vídeo ' || k end)
      returning id into rid;
    end if;
    insert into public.demandas_edicao (client_id, gravacao_id, roteiro_id, videomaker_id, competencia_ano, competencia_mes,
      titulo, prazo, link_material, editing_status, observacoes, origem, criado_por, projeto_id)
    values (p_client, gid, rid, p_videomaker, extract(year from comp)::int, extract(month from comp)::int,
      case when qtd = 1 then nome else nome || ' — vídeo ' || k end, p_prazo, drive, 'standby',
      case p_tipo when 'completo' then 'Projeto avulso: libera quando a gravação acontecer.'
                  else 'Projeto avulso: libera quando o material do cliente chegar (link do Drive).' end,
      'manual', auth.uid(), pid);
  end loop;
  return pid;
end $$;
revoke execute on function public.projeto_avulso_criar(uuid, text, text, int, date, text, text, uuid, date) from public, anon;
grant execute on function public.projeto_avulso_criar(uuid, text, text, int, date, text, text, uuid, date) to authenticated;

-- libera as demandas travadas do projeto (vão para "Pendente", com o link do Drive) e avisa quem edita
create or replace function public._projeto_liberar_edicao(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pr public.projetos_avulsos; n int; evid uuid; cli text;
begin
  select * into pr from public.projetos_avulsos where id = p_id;
  update public.demandas_edicao set editing_status = 'pendente', link_material = case when pr.drive_link <> '' then pr.drive_link else link_material end,
         standby_revisar_em = null, updated_at = now()
   where projeto_id = p_id and deleted_at is null and editing_status = 'standby';
  get diagnostics n = row_count;
  update public.projetos_avulsos set etapa = 'edicao', updated_at = now() where id = p_id;
  if n > 0 then
    select nome into cli from public.clientes where id = pr.client_id;
    insert into public.eventos_dominio (tipo, chave, client_id, alvo_tipo, alvo_id, ator_id, payload, processado_em)
    values ('projeto.edicao', 'projeto.edicao:' || p_id || ':' || extract(epoch from now())::bigint, pr.client_id, 'projeto', p_id, auth.uid(),
            jsonb_build_object('demandas', n), now())
    returning id into evid;
    perform public.notif_entregar(evid, 'projeto.edicao', 'Projeto avulso liberado para edição',
      coalesce(cli, 'Cliente') || ' · ' || pr.nome || ': ' || n || (case when n = 1 then ' vídeo pronto' else ' vídeos prontos' end) || ' para editar.',
      '#/projetos/' || p_id, pr.client_id, case when pr.videomaker_id is not null then array[pr.videomaker_id] end, null,
      array['coordenador', 'videomaker'], null, null, auth.uid());
  end if;
end $$;
revoke execute on function public._projeto_liberar_edicao(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------ avançar
-- p_acao: roteiro_aprovado | gravado | material_recebido | entregue | cancelar | reabrir | drive
create or replace function public.projeto_avulso_avancar(p_id uuid, p_acao text, p_drive text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pr public.projetos_avulsos; drive text := nullif(btrim(coalesce(p_drive, '')), '');
begin
  if not public.pode_acao('projeto.gerir') then raise exception 'Sua conta não mexe em projetos avulsos. Peça à administração para liberar em Funções e permissões.' using errcode = '42501'; end if;
  select * into pr from public.projetos_avulsos where id = p_id and deleted_at is null for update;
  if pr.id is null then raise exception 'Projeto não encontrado.'; end if;
  if drive is not null and drive !~* '^https?://' then raise exception 'O link do Drive precisa começar com https://'; end if;
  if drive is not null then
    update public.projetos_avulsos set drive_link = drive, updated_at = now() where id = p_id;
    update public.demandas_edicao set link_material = drive, updated_at = now()
     where projeto_id = p_id and deleted_at is null and coalesce(link_material, '') = '';
    pr.drive_link := drive;
  end if;

  if p_acao = 'drive' then null;
  elsif p_acao = 'roteiro_aprovado' then
    if pr.etapa <> 'roteiro' then raise exception 'O roteiro já passou dessa etapa.'; end if;
    update public.roteiros set status = 'Pronto para gravar', updated_at = now()
     where recording_session_id = pr.gravacao_id and deleted_at is null and status = 'Em criação';
    update public.projetos_avulsos set roteiro_aprovado_em = now(), updated_at = now(),
      etapa = case pr.tipo when 'completo' then 'gravacao' else 'material' end where id = p_id;
  elsif p_acao = 'gravado' then
    if pr.tipo <> 'completo' or pr.etapa not in ('roteiro', 'gravacao') then raise exception 'Esse projeto não está esperando a gravação.'; end if;
    update public.projetos_avulsos set roteiro_aprovado_em = coalesce(roteiro_aprovado_em, now()) where id = p_id;
    perform public._projeto_liberar_edicao(p_id);
  elsif p_acao = 'material_recebido' then
    if pr.tipo = 'completo' or pr.etapa not in ('roteiro', 'material') then raise exception 'Esse projeto não está esperando material do cliente.'; end if;
    if coalesce(pr.drive_link, '') = '' then raise exception 'Cole o link do Drive com o material antes de marcar como recebido.'; end if;
    update public.projetos_avulsos set material_recebido_em = now(), roteiro_aprovado_em = case when pr.tipo = 'cliente_grava' then coalesce(roteiro_aprovado_em, now()) end where id = p_id;
    perform public._projeto_liberar_edicao(p_id);
  elsif p_acao = 'entregue' then
    update public.demandas_edicao set editing_status = 'entregue', entregue_em = coalesce(entregue_em, now()), updated_at = now()
     where projeto_id = p_id and deleted_at is null and editing_status not in ('entregue', 'descartado');
    update public.projetos_avulsos set etapa = 'entregue', entregue_em = now(), updated_at = now() where id = p_id;
  elsif p_acao = 'cancelar' then
    update public.demandas_edicao set editing_status = 'descartado', updated_at = now()
     where projeto_id = p_id and deleted_at is null and editing_status in ('standby', 'pendente');
    update public.projetos_avulsos set etapa = 'cancelado', cancelado_em = now(), updated_at = now() where id = p_id;
  elsif p_acao = 'reabrir' then
    if pr.etapa not in ('entregue', 'cancelado') then raise exception 'O projeto já está aberto.'; end if;
    update public.projetos_avulsos set etapa = 'edicao', entregue_em = null, cancelado_em = null, updated_at = now() where id = p_id;
  else
    raise exception 'Ação desconhecida.';
  end if;
  return (select to_jsonb(p) from public.projetos_avulsos p where p.id = p_id);
end $$;
revoke execute on function public.projeto_avulso_avancar(uuid, text, text) from public, anon;
grant execute on function public.projeto_avulso_avancar(uuid, text, text) to authenticated;

-- a etapa de edição/aprovação acompanha as demandas sozinha
create or replace function public._projeto_sync_demanda() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.projeto_id, old.projeto_id); et text; total int; entregues int; aprov int; abertas int;
begin
  if pid is null then return null; end if;
  select etapa into et from public.projetos_avulsos where id = pid;
  if et not in ('edicao', 'aprovacao', 'entregue') then return null; end if;
  select count(*) filter (where editing_status <> 'descartado'),
         count(*) filter (where editing_status = 'entregue'),
         count(*) filter (where editing_status = 'aguardando_aprovacao'),
         count(*) filter (where editing_status in ('pendente', 'em_edicao', 'correcao', 'standby'))
    into total, entregues, aprov, abertas
    from public.demandas_edicao where projeto_id = pid and deleted_at is null;
  update public.projetos_avulsos set updated_at = now(),
    etapa = case when total > 0 and entregues = total then 'entregue' when abertas = 0 and aprov > 0 then 'aprovacao' else 'edicao' end,
    entregue_em = case when total > 0 and entregues = total then coalesce(entregue_em, now()) else null end
   where id = pid and etapa is distinct from (case when total > 0 and entregues = total then 'entregue' when abertas = 0 and aprov > 0 then 'aprovacao' else 'edicao' end);
  return null;
end $$;
create or replace trigger zz_projeto_sync_demanda after update of editing_status on public.demandas_edicao
  for each row when (new.projeto_id is not null and new.editing_status is distinct from old.editing_status)
  execute function public._projeto_sync_demanda();

-- gravação do projeto concluída (pelo fluxo de sempre) → libera a edição
create or replace function public._projeto_sync_gravacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.projeto_id is not null and new.concluida_em is not null and old.concluida_em is null then
    if exists (select 1 from public.projetos_avulsos where id = new.projeto_id and tipo = 'completo' and etapa in ('roteiro', 'gravacao')) then
      perform public._projeto_liberar_edicao(new.projeto_id);
    end if;
  end if;
  return null;
end $$;
create or replace trigger zz_projeto_sync_gravacao after update of concluida_em on public.gravacoes
  for each row when (new.projeto_id is not null) execute function public._projeto_sync_gravacao();

-- ------------------------------------------------------------ lista
create or replace function public.projetos_avulsos_listar(p_client uuid default null, p_abertos boolean default false)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.sou_equipe_interna() then '[]'::jsonb else coalesce(jsonb_agg(x order by x->>'ordem', x->>'created_at' desc), '[]'::jsonb) end
  from (
    select jsonb_build_object('id', p.id, 'client_id', p.client_id, 'cliente', c.nome, 'cliente_logo', c.logo_url, 'tipo', p.tipo, 'nome', p.nome,
      'qtd_videos', p.qtd_videos, 'prazo', p.prazo, 'drive_link', p.drive_link, 'observacoes', p.observacoes, 'etapa', p.etapa,
      'gravacao_id', p.gravacao_id, 'videomaker_id', p.videomaker_id, 'videomaker', vm.nome,
      'roteiro_aprovado_em', p.roteiro_aprovado_em, 'material_recebido_em', p.material_recebido_em, 'entregue_em', p.entregue_em,
      'cancelado_em', p.cancelado_em, 'created_at', p.created_at, 'updated_at', p.updated_at,
      'data_gravacao', g.data_gravacao, 'gravacao_concluida', g.concluida_em is not null,
      'ordem', case when p.etapa in ('entregue', 'cancelado') then '1' else '0' end,
      'demandas', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'titulo', d.titulo, 'status', d.editing_status, 'videomaker', vd.nome) order by d.titulo), '[]')
                     from public.demandas_edicao d left join public.perfis vd on vd.id = d.videomaker_id
                    where d.projeto_id = p.id and d.deleted_at is null),
      'roteiros', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'titulo', r.titulo, 'status', r.status) order by r.position), '[]')
                     from public.roteiros r where p.gravacao_id is not null and r.recording_session_id = p.gravacao_id and r.deleted_at is null)) x
      from public.projetos_avulsos p join public.clientes c on c.id = p.client_id
      left join public.perfis vm on vm.id = p.videomaker_id
      left join public.gravacoes g on g.id = p.gravacao_id
     where p.deleted_at is null and (p_client is null or p.client_id = p_client)
       and (not coalesce(p_abertos, false) or p.etapa not in ('entregue', 'cancelado'))
  ) t(x)
$$;
revoke execute on function public.projetos_avulsos_listar(uuid, boolean) from public, anon;
grant execute on function public.projetos_avulsos_listar(uuid, boolean) to authenticated;

-- ------------------------------------------------------------ lembrete: cobrar material
create or replace function public._projetos_lembrar_material()
returns void language plpgsql security definer set search_path = public as $$
declare r record; evid uuid;
begin
  for r in
    select p.id, p.nome, p.client_id, c.nome cliente, greatest(p.roteiro_aprovado_em, p.created_at) desde
      from public.projetos_avulsos p join public.clientes c on c.id = p.client_id
     where p.deleted_at is null and p.etapa = 'material'
       and greatest(p.roteiro_aprovado_em, p.created_at) < now() - interval '3 days'
       and (p.ultimo_lembrete_em is null or p.ultimo_lembrete_em < now() - interval '3 days')
  loop
    insert into public.eventos_dominio (tipo, chave, client_id, alvo_tipo, alvo_id, payload, processado_em)
    values ('projeto.material', 'projeto.material:' || r.id || ':' || public.notif_hoje(), r.client_id, 'projeto', r.id, '{}'::jsonb, now())
    on conflict (chave) do nothing returning id into evid;
    if evid is null then continue; end if;
    perform public.notif_entregar(evid, 'projeto.material', 'Cobrar o material do cliente',
      r.cliente || ' · ' || r.nome || ': o material ainda não chegou (' || public.notif_ha_dias((now()::date - r.desde::date)) || ').',
      '#/projetos/' || r.id, r.client_id, null, null, array['coordenador'], null, null, null);
    update public.projetos_avulsos set ultimo_lembrete_em = now() where id = r.id;
  end loop;
end $$;
revoke execute on function public._projetos_lembrar_material() from public, anon, authenticated;

do $$
declare d text;
begin
  select pg_get_functiondef('public.notif_verificar_agendados()'::regprocedure) into d;
  if position('_projetos_lembrar_material' in d) = 0 then
    d := replace(d, 'if h = 10 then perform public._aprov_lembrar_clientes(); end if;',
                    'if h = 10 then perform public._aprov_lembrar_clientes(); perform public._projetos_lembrar_material(); end if;');
    if position('_projetos_lembrar_material' in d) = 0 then raise exception 'notif_verificar_agendados: trecho não encontrado'; end if;
    execute d;
  end if;
end $$;

-- ------------------------------------------------------------ painéis: avulso não conta como mês atrasado
do $$
declare d text;
begin
  select pg_get_functiondef('public.panorama_mes(integer, integer)'::regprocedure) into d;
  if position('contrato' in d) = 0 then
    d := replace(d, 'from clientes where deleted_at is null and not teste', 'from clientes where deleted_at is null and not teste and coalesce(contrato, ''mensal'') = ''mensal''');
    if position('contrato' in d) = 0 then raise exception 'panorama_mes: trecho não encontrado'; end if;
    execute d;
  end if;
  select pg_get_functiondef('public.gestao_painel()'::regprocedure) into d;
  if position('contrato' in d) = 0 then
    d := replace(d, 'where c.deleted_at is null and coalesce(c.servico, ''ativo'') = ''ativo'' and not coalesce(c.teste, false)',
                    'where c.deleted_at is null and coalesce(c.servico, ''ativo'') = ''ativo'' and not coalesce(c.teste, false) and coalesce(c.contrato, ''mensal'') = ''mensal''');
    if position('contrato' in d) = 0 then raise exception 'gestao_painel: trecho não encontrado'; end if;
    execute d;
  end if;
end $$;

-- ------------------------------------------------------------ demandas: etiqueta "Avulso" (projetos_avulsos_3_resumo)
create or replace view public.demandas_edicao_resumo with (security_invoker = true) as
 SELECT de.id, de.client_id, de.gravacao_id, de.videomaker_id, de.competencia_ano, de.competencia_mes, de.codigo, de.titulo, de.pacote,
    de.prazo, de.link_material, de.editing_status, de.observacoes, de.origem, de.import_lote_id, de.criado_por, de.created_at, de.updated_at,
    de.entregue_em, de.deleted_at, cl.nome AS cliente_nome, COALESCE(cl.servico, 'ativo'::text) AS cliente_servico, pf.nome AS videomaker_nome,
    g.situacao AS gravacao_situacao, g.nome AS gravacao_nome, de.kanban_id, de.prioridade, de.roteiro_id, de.standby_revisar_em,
    cl.logo_url AS cliente_logo_url, COALESCE(rot.roteiros_vinculados, '[]'::jsonb) AS roteiros_vinculados, de.enviado_grupo_em,
    de.upado_drive_em, de.conteudo_id, de.formato_video, de.referencia_link,
    de.projeto_id, pa.nome AS projeto_nome, pa.tipo AS projeto_tipo, pa.etapa AS projeto_etapa
   FROM demandas_edicao de
     LEFT JOIN clientes cl ON cl.id = de.client_id
     LEFT JOIN perfis pf ON pf.id = de.videomaker_id
     LEFT JOIN gravacoes g ON g.id = de.gravacao_id
     LEFT JOIN projetos_avulsos pa ON pa.id = de.projeto_id
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', r.id, 'titulo', r.titulo) ORDER BY r."position", r.created_at) AS roteiros_vinculados
           FROM demandas_edicao_roteiros der JOIN roteiros r ON r.id = der.roteiro_id AND r.deleted_at IS NULL
          WHERE der.demanda_id = de.id) rot ON true
  WHERE de.deleted_at IS NULL;
