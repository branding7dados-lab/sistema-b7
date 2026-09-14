/* =====================================================================
   B7 VÍDEO / VIDEOMAKER — PARTE 1: FUNDAÇÃO OPERACIONAL
   Migração aditiva. Não recria nem apaga nada que já existe (Branding7
   original, autenticação, Clientes, Gravações, Linha Editorial,
   Roteiros, Design, Kanban, notificações, aprovações continuam
   exatamente como estão).

   Escopo desta Parte 1 (conforme especificação do Yury):
     - Papel "videomaker" (filma e edita).
     - Demanda de Edição (demandas_edicao): a unidade de trabalho do
       videomaker, com mês/ano de competência, prazo, responsável e
       situação de edição. Pode nascer de um card manual da equipe ou
       de uma importação de planilha (CSV, Parte 1).
     - Central do Videomaker: fila própria (mesmo padrão de
       "Central do Designer" em migration_design.sql), com leitura
       restrita ao que foi atribuído a cada videomaker.
     - Entrega do vídeo editado por LINK EXTERNO (Drive, WeTransfer…),
       não upload/streaming dentro do sistema — isso fica para uma
       fase futura, fora do escopo aqui.
     - Importação de planilha (CSV) com resolução de cliente por nome,
       e memória de apelido (clientes_import_aliases) para não pedir a
       mesma correspondência duas vezes.
     - Mesma infraestrutura de eventos/notificações já usada por
       Aprovações e Design (eventos_dominio + notificacoes +
       video_processar_evento, chamada explicitamente, não por
       trigger).

   Fora do escopo desta Parte 1 (não implementado aqui, de propósito):
     - Revisão/versionamento do vídeo editado, aprovação por parte,
       upload de arquivo de vídeo, integração com o Kanban geral
       (kanban_demandas) — a Demanda de Edição tem sua própria situação
       e sua própria lista/kanban por mês, sem sincronizar com o quadro
       geral nesta primeira etapa.
   ===================================================================== */

-- ---------------------------------------------------------------------
-- 1. PAPEL "VIDEOMAKER"
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'perfis_papel_valido') then
    alter table public.perfis drop constraint perfis_papel_valido;
  end if;
  alter table public.perfis add constraint perfis_papel_valido
    check (papel in ('admin', 'coordenador', 'designer', 'videomaker', 'cliente'));
end $$;

create or replace function public.sou_videomaker()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() = 'videomaker', false)
$$;
revoke all on function public.sou_videomaker() from public;
grant execute on function public.sou_videomaker() to authenticated;

/* Equipe interna já existia (admin+coordenador+designer, ver
   migration_design.sql) — aqui só ganha o videomaker também, para os
   mesmos usos genéricos de "é alguém da equipe, não é cliente". */
create or replace function public.sou_equipe_interna()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('admin', 'coordenador', 'designer', 'videomaker'), false)
$$;
revoke all on function public.sou_equipe_interna() from public;
grant execute on function public.sou_equipe_interna() to authenticated;

-- ---------------------------------------------------------------------
-- 2. DEMANDA DE EDIÇÃO
--    "Pacote" não é uma tabela nova — não existe hoje nenhum conceito
--    de pacote/contrato no schema (só nomes homônimos sem relação: o
--    `pacote` de js/backup.js é o pacote de backup, o `pacoteLinha` de
--    js/design.js é um agrupamento de cartões). Fica como um campo de
--    texto livre (retrato do que a planilha ou a equipe informou no
--    momento), não uma entidade própria — decisão registrada no
--    relatório final.
--    Cliente ativo/inativo reaproveita clientes.servico (ativo/pausado/
--    cancelado), que já existe desde migration_auth.sql — não cria um
--    segundo conceito de "cliente histórico".
-- ---------------------------------------------------------------------
create table if not exists public.demandas_edicao (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clientes(id) on delete restrict,
  gravacao_id      uuid references public.gravacoes(id) on delete set null,
  videomaker_id    uuid references public.perfis(id) on delete set null,
  competencia_ano  int not null,
  competencia_mes  int not null check (competencia_mes between 1 and 12),
  codigo           text not null default '',   -- identificador da planilha, preservado como veio (zeros à esquerda etc.)
  titulo           text not null,
  pacote           text not null default '',   -- retrato livre, não referencia tabela nenhuma (ver nota acima)
  prazo            date,
  link_material    text not null default '',   -- link externo (Drive/WeTransfer/...) do vídeo editado
  editing_status   text not null default 'pendente'
                     check (editing_status in ('pendente', 'em_edicao', 'correcao', 'standby', 'entregue', 'descartado')),
  observacoes      text not null default '',
  origem           text not null default 'manual' check (origem in ('manual', 'importacao')),
  import_lote_id   uuid,
  criado_por       uuid references public.perfis(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  entregue_em      timestamptz,
  deleted_at       timestamptz,
  constraint demandas_edicao_titulo_nao_vazio check (length(btrim(titulo)) > 0)
);
create index if not exists demandas_edicao_cliente on public.demandas_edicao (client_id) where deleted_at is null;
create index if not exists demandas_edicao_videomaker on public.demandas_edicao (videomaker_id) where deleted_at is null;
create index if not exists demandas_edicao_competencia on public.demandas_edicao (competencia_ano, competencia_mes) where deleted_at is null;
create index if not exists demandas_edicao_status on public.demandas_edicao (editing_status) where deleted_at is null;

/* Linha do tempo da demanda — quem mudou o quê e quando. Mesmo papel
   que os `eventos_dominio` cumprem para Aprovações/Design, mas aqui
   como um log simples só de leitura pela própria demanda (a
   eventos_dominio genérica cuida das notificações). */
create table if not exists public.demandas_edicao_eventos (
  id          uuid primary key default gen_random_uuid(),
  demanda_id  uuid not null references public.demandas_edicao(id) on delete cascade,
  tipo        text not null,
  de_status   text,
  para_status text,
  ator_id     uuid references public.perfis(id),
  ator_nome   text,
  ator_papel  text,
  mensagem    text,
  created_at  timestamptz not null default now()
);
create index if not exists demandas_edicao_eventos_demanda on public.demandas_edicao_eventos (demanda_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3. IMPORTAÇÃO DE PLANILHA (CSV nesta Parte 1)
--    Fluxo em duas fases: a equipe sobe o arquivo (o navegador lê e
--    manda as linhas já em JSON — nenhum parser roda no banco), o
--    banco tenta casar cada linha com um cliente existente (pelo nome
--    exato ou por um apelido já ensinado em clientes_import_aliases);
--    o que não casar fica pendente de resolução manual antes de virar
--    demanda de verdade. Nada aqui gera dado silenciosamente errado.
-- ---------------------------------------------------------------------
create table if not exists public.demandas_edicao_import_lotes (
  id            uuid primary key default gen_random_uuid(),
  nome_arquivo  text not null default '',
  formato       text not null default 'csv' check (formato in ('csv')),
  total_linhas  int not null default 0,
  linhas_ok     int not null default 0,
  linhas_erro   int not null default 0,
  status        text not null default 'processando' check (status in ('processando', 'concluido', 'com_erros')),
  criado_por    uuid references public.perfis(id),
  created_at    timestamptz not null default now()
);

create table if not exists public.demandas_edicao_import_linhas (
  id                  uuid primary key default gen_random_uuid(),
  lote_id             uuid not null references public.demandas_edicao_import_lotes(id) on delete cascade,
  linha_numero        int not null,
  dados_originais     jsonb not null default '{}'::jsonb,  -- a linha crua da planilha, pra nunca perder o que veio
  cliente_nome_planilha text not null default '',
  cliente_id          uuid references public.clientes(id),
  problemas           text[] not null default '{}',
  resolvida           boolean not null default false,
  confirmada          boolean not null default false,
  demanda_id          uuid references public.demandas_edicao(id),
  created_at          timestamptz not null default now()
);
create index if not exists demandas_edicao_import_linhas_lote on public.demandas_edicao_import_linhas (lote_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'demandas_edicao_import_lote_fk') then
    alter table public.demandas_edicao
      add constraint demandas_edicao_import_lote_fk
      foreign key (import_lote_id) references public.demandas_edicao_import_lotes(id) on delete set null;
  end if;
end $$;

/* Apelido de planilha → cliente. Ensinado uma vez (ao resolver uma
   linha), reaproveitado nas próximas importações sem perguntar de
   novo. Independente por conta: cada organização ensina o próprio. */
create table if not exists public.clientes_import_aliases (
  id          uuid primary key default gen_random_uuid(),
  alias       text not null,
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  criado_por  uuid references public.perfis(id),
  created_at  timestamptz not null default now()
);
create unique index if not exists clientes_import_aliases_unico on public.clientes_import_aliases (lower(btrim(alias)));

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
--    Mesmo padrão do Design: só SELECT direto é liberado; toda escrita
--    passa pelas funções security definer abaixo (auditoria e
--    validação garantidas em um lugar só).
-- ---------------------------------------------------------------------
alter table public.demandas_edicao               enable row level security;
alter table public.demandas_edicao_eventos        enable row level security;
alter table public.demandas_edicao_import_lotes    enable row level security;
alter table public.demandas_edicao_import_linhas   enable row level security;
alter table public.clientes_import_aliases         enable row level security;

revoke insert, update, delete on public.demandas_edicao               from authenticated;
revoke insert, update, delete on public.demandas_edicao_eventos        from authenticated;
revoke insert, update, delete on public.demandas_edicao_import_lotes    from authenticated;
revoke insert, update, delete on public.demandas_edicao_import_linhas   from authenticated;
revoke insert, update, delete on public.clientes_import_aliases         from authenticated;
grant select on public.demandas_edicao               to authenticated;
grant select on public.demandas_edicao_eventos        to authenticated;
grant select on public.demandas_edicao_import_lotes    to authenticated;
grant select on public.demandas_edicao_import_linhas   to authenticated;
grant select on public.clientes_import_aliases         to authenticated;

drop policy if exists "demandas_edicao select" on public.demandas_edicao;
create policy "demandas_edicao select" on public.demandas_edicao
  for select to authenticated
  using (deleted_at is null and (public.sou_equipe() or videomaker_id = auth.uid()) and public.sou_equipe_interna());

drop policy if exists "demandas_edicao_eventos select" on public.demandas_edicao_eventos;
create policy "demandas_edicao_eventos select" on public.demandas_edicao_eventos
  for select to authenticated
  using (exists (select 1 from public.demandas_edicao d
                  where d.id = demanda_id and d.deleted_at is null
                    and (public.sou_equipe() or d.videomaker_id = auth.uid())
                    and public.sou_equipe_interna()));

/* Importação é ferramenta de equipe (admin/coordenador) — o videomaker
   não importa planilha, só recebe o que foi atribuído a ele. */
drop policy if exists "demandas_edicao_import_lotes select" on public.demandas_edicao_import_lotes;
create policy "demandas_edicao_import_lotes select" on public.demandas_edicao_import_lotes
  for select to authenticated using (public.sou_equipe());

drop policy if exists "demandas_edicao_import_linhas select" on public.demandas_edicao_import_linhas;
create policy "demandas_edicao_import_linhas select" on public.demandas_edicao_import_linhas
  for select to authenticated using (public.sou_equipe());

drop policy if exists "clientes_import_aliases select" on public.clientes_import_aliases;
create policy "clientes_import_aliases select" on public.clientes_import_aliases
  for select to authenticated using (public.sou_equipe());

-- ---------------------------------------------------------------------
-- 5. LEITURA DE APOIO PARA O VIDEOMAKER (o briefing mínimo)
--    Mesmo padrão da seção 19 de migration_design.sql: uma política
--    ADICIONAL só de leitura, sobre o que já existe, para o videomaker
--    enxergar o cliente e a gravação por trás da demanda dele. Nunca
--    escreve nessas tabelas.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clientes', 'gravacoes']
  loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format($f$
        drop policy if exists %I on public.%I
      $f$, t || '_video_leitura', t);
      execute format($f$
        create policy %I on public.%I for select to authenticated
          using (public.sou_videomaker())
      $f$, t || '_video_leitura', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. VIEW DE LISTAGEM (evita repetir join em toda tela)
-- ---------------------------------------------------------------------
create or replace view public.demandas_edicao_resumo
with (security_invoker = true) as
select de.*,
  cl.nome as cliente_nome,
  coalesce(cl.servico, 'ativo') as cliente_servico,
  pf.nome as videomaker_nome,
  g.situacao as gravacao_situacao
from public.demandas_edicao de
left join public.clientes cl on cl.id = de.client_id
left join public.perfis pf on pf.id = de.videomaker_id
left join public.gravacoes g on g.id = de.gravacao_id
where de.deleted_at is null;
grant select on public.demandas_edicao_resumo to authenticated;

-- ---------------------------------------------------------------------
-- 7. CRIAÇÃO MANUAL (a equipe abre uma demanda sem passar por planilha)
-- ---------------------------------------------------------------------
create or replace function public.video_criar_demanda(
  p_client_id uuid, p_titulo text, p_codigo text default '',
  p_competencia_ano int default null, p_competencia_mes int default null,
  p_gravacao_id uuid default null, p_videomaker_id uuid default null,
  p_pacote text default '', p_prazo date default null, p_observacoes text default ''
) returns uuid language plpgsql security definer set search_path = public as $$
declare novo uuid; ator public.perfis%rowtype; vm public.perfis%rowtype; ano int; mes int;
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
  select * into ator from public.perfis where id = auth.uid();
  if p_videomaker_id is not null then
    select * into vm from public.perfis where id = p_videomaker_id;
  end if;
  ano := coalesce(p_competencia_ano, extract(year from now())::int);
  mes := coalesce(p_competencia_mes, extract(month from now())::int);

  insert into public.demandas_edicao
    (client_id, gravacao_id, videomaker_id, competencia_ano, competencia_mes, codigo, titulo,
     pacote, prazo, observacoes, origem, criado_por,
     editing_status)
  values
    (p_client_id, p_gravacao_id, p_videomaker_id, ano, mes, coalesce(p_codigo, ''), p_titulo,
     coalesce(p_pacote, ''), p_prazo, coalesce(p_observacoes, ''), 'manual', auth.uid(),
     case when p_videomaker_id is not null then 'em_edicao' else 'pendente' end)
  returning id into novo;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, para_status, ator_id, ator_nome, ator_papel, mensagem)
  values (novo, 'criada', 'pendente', auth.uid(), ator.nome, ator.papel, null);

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
revoke all on function public.video_criar_demanda(uuid, text, text, int, int, uuid, uuid, text, date, text) from public;
grant execute on function public.video_criar_demanda(uuid, text, text, int, int, uuid, uuid, text, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- 8. ATRIBUIÇÃO / REATRIBUIÇÃO
-- ---------------------------------------------------------------------
create or replace function public.video_atribuir(p_demanda_id uuid, p_videomaker_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.demandas_edicao%rowtype; ator public.perfis%rowtype; vm public.perfis%rowtype; evid uuid;
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

  update public.demandas_edicao
     set videomaker_id = p_videomaker_id, updated_at = now(),
         editing_status = case when p_videomaker_id is not null and editing_status = 'pendente' then 'em_edicao' else editing_status end
   where id = p_demanda_id;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, ator_id, ator_nome, ator_papel, mensagem)
  values (p_demanda_id, 'atribuida', auth.uid(), ator.nome, ator.papel,
          case when p_videomaker_id is null then 'Atribuição removida' else null end);

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
-- 9. MUDANÇA DE SITUAÇÃO DE EDIÇÃO
--    Equipe muda livremente; o videomaker só mexe na demanda que é
--    dele (assinatura idêntica de leitura da política de SELECT).
-- ---------------------------------------------------------------------
create or replace function public.video_mudar_status(p_demanda_id uuid, p_status text, p_mensagem text default null)
returns void language plpgsql security definer set search_path = public as $$
declare d public.demandas_edicao%rowtype; ator public.perfis%rowtype; evid uuid; de_status text;
begin
  select * into d from public.demandas_edicao where id = p_demanda_id and deleted_at is null;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  if not (public.sou_equipe() or d.videomaker_id = auth.uid()) then
    raise exception 'Sem permissão para mudar esta demanda.' using errcode = '42501';
  end if;
  if p_status not in ('pendente', 'em_edicao', 'correcao', 'standby', 'entregue', 'descartado') then
    raise exception 'Situação inválida.';
  end if;
  select * into ator from public.perfis where id = auth.uid();
  de_status := d.editing_status;

  update public.demandas_edicao
     set editing_status = p_status, updated_at = now(),
         entregue_em = case when p_status = 'entregue' then now() else entregue_em end
   where id = p_demanda_id;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, de_status, para_status, ator_id, ator_nome, ator_papel, mensagem)
  values (p_demanda_id, 'status', de_status, p_status, auth.uid(), ator.nome, ator.papel, p_mensagem);

  if p_status = 'entregue' then
    insert into public.eventos_dominio (id, tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    values (gen_random_uuid(), 'video.entregue', 'video.entregue:' || p_demanda_id || ':' || now()::text,
            'demanda_edicao', p_demanda_id, d.client_id, auth.uid(), ator.nome, ator.papel,
            jsonb_build_object('titulo', d.titulo))
    returning id into evid;
    perform public.video_processar_evento(evid);
  elsif p_status = 'correcao' and public.sou_equipe() and d.videomaker_id is not null then
    insert into public.eventos_dominio (id, tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    values (gen_random_uuid(), 'video.correcao_solicitada', 'video.correcao_solicitada:' || p_demanda_id || ':' || now()::text,
            'demanda_edicao', p_demanda_id, d.client_id, auth.uid(), ator.nome, ator.papel,
            jsonb_build_object('titulo', d.titulo, 'mensagem', p_mensagem))
    returning id into evid;
    perform public.video_processar_evento(evid);
  end if;
end;
$$;
revoke all on function public.video_mudar_status(uuid, text, text) from public;
grant execute on function public.video_mudar_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 10. LINK DO MATERIAL EDITADO (entrega por link externo)
-- ---------------------------------------------------------------------
create or replace function public.video_definir_link(p_demanda_id uuid, p_link text)
returns void language plpgsql security definer set search_path = public as $$
declare d public.demandas_edicao%rowtype; ator public.perfis%rowtype;
begin
  select * into d from public.demandas_edicao where id = p_demanda_id and deleted_at is null;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  if not (public.sou_equipe() or d.videomaker_id = auth.uid()) then
    raise exception 'Sem permissão para editar esta demanda.' using errcode = '42501';
  end if;
  select * into ator from public.perfis where id = auth.uid();

  update public.demandas_edicao set link_material = coalesce(btrim(p_link), ''), updated_at = now() where id = p_demanda_id;
  insert into public.demandas_edicao_eventos (demanda_id, tipo, ator_id, ator_nome, ator_papel, mensagem)
  values (p_demanda_id, 'link_material', auth.uid(), ator.nome, ator.papel, null);
end;
$$;
revoke all on function public.video_definir_link(uuid, text) from public;
grant execute on function public.video_definir_link(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 11. PRAZO, EDIÇÃO GERAL E EXCLUSÃO (equipe)
-- ---------------------------------------------------------------------
create or replace function public.video_editar_demanda(
  p_demanda_id uuid, p_titulo text default null, p_codigo text default null,
  p_pacote text default null, p_prazo date default null, p_tem_prazo boolean default false,
  p_observacoes text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe edita os dados da demanda.' using errcode = '42501';
  end if;
  update public.demandas_edicao set
    titulo = coalesce(p_titulo, titulo),
    codigo = coalesce(p_codigo, codigo),
    pacote = coalesce(p_pacote, pacote),
    prazo = case when p_tem_prazo then p_prazo else prazo end,
    observacoes = coalesce(p_observacoes, observacoes),
    updated_at = now()
  where id = p_demanda_id and deleted_at is null;
end;
$$;
revoke all on function public.video_editar_demanda(uuid, text, text, text, date, boolean, text) from public;
grant execute on function public.video_editar_demanda(uuid, text, text, text, date, boolean, text) to authenticated;

create or replace function public.video_excluir_demanda(p_demanda_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe exclui uma demanda de edição.' using errcode = '42501';
  end if;
  update public.demandas_edicao set deleted_at = now(), updated_at = now() where id = p_demanda_id;
end;
$$;
revoke all on function public.video_excluir_demanda(uuid) from public;
grant execute on function public.video_excluir_demanda(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 12. PROCESSAMENTO DE EVENTO → notificações (mesmo padrão do Design)
-- ---------------------------------------------------------------------
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
  end if;

  update public.eventos_dominio set processado_em = now() where id = ev.id;
end;
$$;
revoke all on function public.video_processar_evento(uuid) from public;
grant execute on function public.video_processar_evento(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 13. IMPORTAÇÃO DE PLANILHA (CSV)
--     O navegador lê o CSV e manda as linhas já em JSON
--     (array de {codigo, titulo, cliente, pacote, prazo, observacoes,
--     videomaker}); o banco não faz parsing de arquivo nenhum. Cada
--     linha tenta casar o nome do cliente: exato (case-insensitive) →
--     apelido já ensinado (clientes_import_aliases) → sem casar
--     (fica "problemas: cliente_nao_encontrado", aguardando resolução
--     manual). NADA vira demanda de edição nesta função — só depois de
--     confirmada (seção 14), pra equipe conferir antes.
-- ---------------------------------------------------------------------
create or replace function public.video_import_criar_lote(p_nome_arquivo text, p_linhas jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  lote uuid; i int := 0; linha jsonb; nome_planilha text; cid uuid; probs text[];
  total int := 0; ok int := 0; erro int := 0;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe importa planilhas.' using errcode = '42501';
  end if;
  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' then
    raise exception 'Formato de importação inválido.';
  end if;

  insert into public.demandas_edicao_import_lotes (nome_arquivo, formato, criado_por)
  values (coalesce(p_nome_arquivo, ''), 'csv', auth.uid())
  returning id into lote;

  for linha in select * from jsonb_array_elements(p_linhas)
  loop
    i := i + 1;
    total := total + 1;
    probs := '{}';
    nome_planilha := btrim(coalesce(linha->>'cliente', ''));
    cid := null;

    if nome_planilha = '' then
      probs := array_append(probs, 'sem_nome_de_cliente');
    else
      select c.id into cid from public.clientes c where lower(btrim(c.nome)) = lower(nome_planilha) limit 1;
      if cid is null then
        select a.cliente_id into cid from public.clientes_import_aliases a where lower(btrim(a.alias)) = lower(nome_planilha) limit 1;
      end if;
      if cid is null then probs := array_append(probs, 'cliente_nao_encontrado'); end if;
    end if;
    if coalesce(btrim(linha->>'titulo'), '') = '' then
      probs := array_append(probs, 'sem_titulo');
    end if;

    insert into public.demandas_edicao_import_linhas
      (lote_id, linha_numero, dados_originais, cliente_nome_planilha, cliente_id, problemas, resolvida)
    values
      (lote, i, linha, nome_planilha, cid, probs, array_length(probs, 1) is null);

    if array_length(probs, 1) is null then ok := ok + 1; else erro := erro + 1; end if;
  end loop;

  update public.demandas_edicao_import_lotes
     set total_linhas = total, linhas_ok = ok, linhas_erro = erro,
         status = case when erro = 0 then 'concluido' else 'com_erros' end
   where id = lote;

  return lote;
end;
$$;
revoke all on function public.video_import_criar_lote(text, jsonb) from public;
grant execute on function public.video_import_criar_lote(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 14. RESOLUÇÃO MANUAL DE UMA LINHA + CONFIRMAÇÃO (vira demanda)
-- ---------------------------------------------------------------------
create or replace function public.video_import_resolver_linha(p_linha_id uuid, p_cliente_id uuid, p_lembrar_apelido boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare l public.demandas_edicao_import_linhas%rowtype;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe resolve linhas de importação.' using errcode = '42501';
  end if;
  select * into l from public.demandas_edicao_import_linhas where id = p_linha_id;
  if not found then raise exception 'Linha não encontrada.'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id) then
    raise exception 'Cliente inválido.';
  end if;

  update public.demandas_edicao_import_linhas
     set cliente_id = p_cliente_id,
         problemas = array_remove(problemas, 'cliente_nao_encontrado'),
         resolvida = (array_remove(problemas, 'cliente_nao_encontrado') = '{}')
   where id = p_linha_id;

  if p_lembrar_apelido and coalesce(btrim(l.cliente_nome_planilha), '') <> '' then
    insert into public.clientes_import_aliases (alias, cliente_id, criado_por)
    values (btrim(l.cliente_nome_planilha), p_cliente_id, auth.uid())
    on conflict (lower(btrim(alias))) do update set cliente_id = excluded.cliente_id;
  end if;
end;
$$;
revoke all on function public.video_import_resolver_linha(uuid, uuid, boolean) from public;
grant execute on function public.video_import_resolver_linha(uuid, uuid, boolean) to authenticated;

/* Confirma UMA linha resolvida: cria a demanda de edição de verdade.
   Idempotente (não confirma duas vezes a mesma linha). */
create or replace function public.video_import_confirmar_linha(p_linha_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare l public.demandas_edicao_import_linhas%rowtype; lote public.demandas_edicao_import_lotes%rowtype;
  novo uuid; ano int; mes int; prazo date; ator public.perfis%rowtype;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe confirma importações.' using errcode = '42501';
  end if;
  select * into l from public.demandas_edicao_import_linhas where id = p_linha_id;
  if not found then raise exception 'Linha não encontrada.'; end if;
  if l.confirmada then return l.demanda_id; end if;
  if not l.resolvida or l.cliente_id is null then
    raise exception 'Esta linha ainda tem pendências — resolva o cliente antes de confirmar.';
  end if;
  select * into lote from public.demandas_edicao_import_lotes where id = l.lote_id;
  select * into ator from public.perfis where id = auth.uid();

  ano := coalesce(nullif(l.dados_originais->>'ano', '')::int, extract(year from now())::int);
  mes := coalesce(nullif(l.dados_originais->>'mes', '')::int, extract(month from now())::int);
  begin
    prazo := nullif(l.dados_originais->>'prazo', '')::date;
  exception when others then prazo := null; end;

  insert into public.demandas_edicao
    (client_id, competencia_ano, competencia_mes, codigo, titulo, pacote, prazo, observacoes,
     origem, import_lote_id, criado_por, editing_status)
  values
    (l.cliente_id, ano, mes, coalesce(l.dados_originais->>'codigo', ''),
     coalesce(nullif(btrim(l.dados_originais->>'titulo'), ''), 'Sem título (planilha)'),
     coalesce(l.dados_originais->>'pacote', ''), prazo, coalesce(l.dados_originais->>'observacoes', ''),
     'importacao', l.lote_id, auth.uid(), 'pendente')
  returning id into novo;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, para_status, ator_id, ator_nome, ator_papel, mensagem)
  values (novo, 'criada', 'pendente', auth.uid(), ator.nome, ator.papel, 'Importada da planilha "' || coalesce(lote.nome_arquivo, '') || '"');

  update public.demandas_edicao_import_linhas set confirmada = true, demanda_id = novo where id = p_linha_id;

  return novo;
end;
$$;
revoke all on function public.video_import_confirmar_linha(uuid) from public;
grant execute on function public.video_import_confirmar_linha(uuid) to authenticated;

/* Confirma todas as linhas já resolvidas de um lote de uma vez — o
   caminho normal depois de resolver as poucas linhas problemáticas. */
create or replace function public.video_import_confirmar_lote(p_lote_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare l record; n int := 0;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe confirma importações.' using errcode = '42501';
  end if;
  for l in select id from public.demandas_edicao_import_linhas
            where lote_id = p_lote_id and resolvida = true and confirmada = false
  loop
    perform public.video_import_confirmar_linha(l.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.video_import_confirmar_lote(uuid) from public;
grant execute on function public.video_import_confirmar_lote(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- FIM — migration_video.sql
-- ---------------------------------------------------------------------
