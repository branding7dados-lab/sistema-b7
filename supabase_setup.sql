-- =====================================================================
--  SISTEMA DE ROTEIROS B7 — criação e atualização do banco
--
--  Rode este arquivo inteiro no SQL Editor do Supabase.
--  Serve para os dois casos:
--    • banco novo   → cria tudo do zero;
--    • banco antigo → renomeia "diarias" para "gravacoes" preservando
--                     todos os ids e registros. Nada é apagado.
--  Pode ser executado mais de uma vez sem quebrar nada. Validado contra
--  PostgreSQL 16: banco novo, banco antigo com dados e execução repetida.
--
--  Estrutura: CLIENTES → GRAVAÇÕES → ROTEIROS → CENAS
--  Uma gravação é um grupo de roteiros de um cliente. Vários clientes
--  podem ter gravações na mesma data, sem conflito.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 0. MIGRAÇÃO diarias → gravacoes (só roda se a tabela antiga existir)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'diarias')
     and not exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'gravacoes')
  then
    drop view if exists public.diarias_resumo;
    drop view if exists public.gravacoes_resumo;
    drop view if exists public.clientes_resumo;

    alter table public.diarias rename to gravacoes;
    alter index if exists diarias_client_id_idx  rename to gravacoes_client_id_idx;
    alter index if exists diarias_updated_at_idx rename to gravacoes_updated_at_idx;
    alter index if exists diarias_data_idx       rename to gravacoes_data_idx;

    -- gatilhos e funções do nome antigo saem de cena; são recriados abaixo
    drop trigger if exists diarias_updated_at   on public.gravacoes;
    drop trigger if exists roteiros_tocam_diaria on public.roteiros;
    drop trigger if exists cenas_tocam_diaria    on public.cenas;
    drop policy  if exists acesso_interno_diarias on public.gravacoes;

    raise notice 'tabela diarias renomeada para gravacoes — nenhum dado foi perdido';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. CLIENTES
-- ---------------------------------------------------------------------
create table if not exists public.clientes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  observacoes text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint clientes_nome_nao_vazio check (length(btrim(nome)) > 0)
);

create unique index if not exists clientes_nome_unico
  on public.clientes (lower(btrim(nome)));

-- logo do cliente: opcional. Guardamos só a referência do arquivo, nunca a
-- imagem. Clientes antigos ficam com NULL e continuam usando as iniciais.
alter table public.clientes add column if not exists logo_url  text;
alter table public.clientes add column if not exists logo_path text;

-- cliente fixado no topo da lista (preferência da equipe, não do navegador)
alter table public.clientes add column if not exists is_pinned boolean not null default false;

-- ---------------------------------------------------------------------
-- 2. GRAVAÇÕES
--    data_gravacao é opcional de propósito: a gravação pode ainda não
--    ter data marcada. O que identifica é o nome, não o dia.
-- ---------------------------------------------------------------------
create table if not exists public.gravacoes (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clientes(id) on delete cascade,
  nome          text not null,
  data_gravacao date,
  local         text not null default '',
  responsavel   text not null default '',
  videomaker    text not null default '',
  observacoes   text not null default '',
  status        text not null default 'Rascunho',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint gravacoes_status_valido
    check (status in ('Rascunho', 'Pronto para gravar', 'Gravado'))
);

create index if not exists gravacoes_client_id_idx  on public.gravacoes (client_id);
create index if not exists gravacoes_updated_at_idx on public.gravacoes (updated_at desc);
create index if not exists gravacoes_data_idx       on public.gravacoes (data_gravacao desc);

-- ---------------------------------------------------------------------
-- 3. ROTEIROS
--    recording_session_id: nome técnico neutro, mantido de propósito
--    para não quebrar dados existentes. Aponta para gravacoes.id.
-- ---------------------------------------------------------------------
create table if not exists public.roteiros (
  id                    uuid primary key default gen_random_uuid(),
  recording_session_id  uuid not null references public.gravacoes(id) on delete cascade,
  position              integer not null default 0,
  titulo                text not null default '',
  objetivo              text not null default '',
  observacao_gravacao   text not null default '',
  escala                numeric(4,2) not null default 1.00,
  escala_automatica     boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint roteiros_escala_valida check (escala >= 0.50 and escala <= 1.50)
);

create index if not exists roteiros_sessao_idx on public.roteiros (recording_session_id, position);

-- ---------------------------------------------------------------------
-- 4. CENAS
-- ---------------------------------------------------------------------
create table if not exists public.cenas (
  id             uuid primary key default gen_random_uuid(),
  script_id      uuid not null references public.roteiros(id) on delete cascade,
  position       integer not null default 0,
  tipo           text not null default 'Narrativa',
  direcao        text not null default '',
  funcao         text not null default '',
  texto          text not null default '',
  sugestao_cenas text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint cenas_tipo_valido
    check (tipo in ('Gancho', 'Narrativa', 'Narração', 'CTA'))
);

create index if not exists cenas_roteiro_idx on public.cenas (script_id, position);

-- ---------------------------------------------------------------------
-- 5. updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists clientes_updated_at on public.clientes;
create trigger clientes_updated_at before update on public.clientes
  for each row execute function public.tocar_updated_at();

drop trigger if exists gravacoes_updated_at on public.gravacoes;
create trigger gravacoes_updated_at before update on public.gravacoes
  for each row execute function public.tocar_updated_at();

drop trigger if exists roteiros_updated_at on public.roteiros;
create trigger roteiros_updated_at before update on public.roteiros
  for each row execute function public.tocar_updated_at();

drop trigger if exists cenas_updated_at on public.cenas;
create trigger cenas_updated_at before update on public.cenas
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------
-- 6. Mexeu no roteiro ou na cena, a gravação conta como alterada
--    (é o que alimenta o "Gravações recentes")
-- ---------------------------------------------------------------------
create or replace function public.tocar_gravacao_do_roteiro()
returns trigger language plpgsql as $$
declare alvo uuid;
begin
  alvo := coalesce(new.recording_session_id, old.recording_session_id);
  update public.gravacoes set updated_at = now() where id = alvo;
  return coalesce(new, old);
end $$;

drop trigger if exists roteiros_tocam_gravacao on public.roteiros;
create trigger roteiros_tocam_gravacao after insert or update or delete on public.roteiros
  for each row execute function public.tocar_gravacao_do_roteiro();

create or replace function public.tocar_gravacao_da_cena()
returns trigger language plpgsql as $$
declare alvo uuid;
begin
  select recording_session_id into alvo from public.roteiros
   where id = coalesce(new.script_id, old.script_id);
  if alvo is not null then
    update public.gravacoes set updated_at = now() where id = alvo;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists cenas_tocam_gravacao on public.cenas;
create trigger cenas_tocam_gravacao after insert or update or delete on public.cenas
  for each row execute function public.tocar_gravacao_da_cena();

-- (a limpeza das funções de nome antigo fica no fim do arquivo, depois que
--  os gatilhos já apontam para as funções novas)

-- ---------------------------------------------------------------------
-- 7. Visões de apoio
-- ---------------------------------------------------------------------
drop view if exists public.gravacoes_resumo;
drop view if exists public.gravacoes_resumo;
create view public.gravacoes_resumo
with (security_invoker = on) as
select
  g.id, g.client_id, g.nome, g.data_gravacao, g.status,
  g.local, g.responsavel, g.videomaker, g.observacoes,
  g.created_at, g.updated_at,
  c.nome as cliente_nome,
  c.logo_url as cliente_logo_url,
  (select count(*) from public.roteiros r where r.recording_session_id = g.id) as total_roteiros
from public.gravacoes g
join public.clientes c on c.id = g.client_id;

drop view if exists public.clientes_resumo;
create view public.clientes_resumo
with (security_invoker = on) as
select
  c.id, c.nome, c.observacoes, c.logo_url, c.logo_path, c.is_pinned, c.created_at, c.updated_at,
  (select count(*) from public.gravacoes g where g.client_id = c.id) as total_gravacoes,
  (select count(*) from public.roteiros r
     join public.gravacoes g2 on g2.id = r.recording_session_id
    where g2.client_id = c.id) as total_roteiros,
  greatest(c.updated_at,
           coalesce((select max(g3.updated_at) from public.gravacoes g3 where g3.client_id = c.id),
                    c.updated_at)) as ultima_atividade
from public.clientes c;

-- ---------------------------------------------------------------------
-- 8. ACESSO
--
--    O sistema roda SEM login, por decisão do projeto. O frontend usa a
--    chave pública (anon / publishable), então o papel "anon" precisa
--    ler e escrever nestas tabelas.
--
--    Dito com todas as letras: quem tiver o endereço do site e a chave
--    pública consegue ler e alterar estes dados. Não há isolamento por
--    usuário. É aceitável para uma ferramenta interna de roteiros; não
--    guarde aqui nada sigiloso.
--
--    Para fechar no futuro: ative o Auth do Supabase e troque o
--    "using (true)" por uma regra com auth.uid(). As tabelas não mudam.
-- ---------------------------------------------------------------------
alter table public.clientes  enable row level security;
alter table public.gravacoes enable row level security;
alter table public.roteiros  enable row level security;
alter table public.cenas     enable row level security;

drop policy if exists acesso_interno_clientes on public.clientes;
create policy acesso_interno_clientes on public.clientes
  for all to anon, authenticated using (true) with check (true);

drop policy if exists acesso_interno_gravacoes on public.gravacoes;
drop policy if exists acesso_interno_gravacoes on public.gravacoes;
create policy acesso_interno_gravacoes on public.gravacoes
  for all to anon, authenticated using (true) with check (true);

drop policy if exists acesso_interno_roteiros on public.roteiros;
create policy acesso_interno_roteiros on public.roteiros
  for all to anon, authenticated using (true) with check (true);

drop policy if exists acesso_interno_cenas on public.cenas;
create policy acesso_interno_cenas on public.cenas
  for all to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.clientes, public.gravacoes, public.roteiros, public.cenas
  to anon, authenticated;
grant select on public.gravacoes_resumo, public.clientes_resumo to anon, authenticated;

-- ---------------------------------------------------------------------
-- 8B. STORAGE DAS LOGOS DE CLIENTE
--
--     Bucket público: as logos aparecem na interface e na folha impressa,
--     e o sistema não tem login. Mesma lógica já adotada nas tabelas.
--     A chave usada continua sendo a publishable/anon — service_role
--     nunca entra no frontend.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-logos', 'client-logos', true, 2097152,
        array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml'];

drop policy if exists logos_leitura  on storage.objects;
drop policy if exists logos_escrita  on storage.objects;
drop policy if exists logos_troca    on storage.objects;
drop policy if exists logos_remocao  on storage.objects;

create policy logos_leitura on storage.objects
  for select to anon, authenticated using (bucket_id = 'client-logos');
create policy logos_escrita on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'client-logos');
create policy logos_troca on storage.objects
  for update to anon, authenticated using (bucket_id = 'client-logos') with check (bucket_id = 'client-logos');
create policy logos_remocao on storage.objects
  for delete to anon, authenticated using (bucket_id = 'client-logos');

-- ---------------------------------------------------------------------
-- 9. Limpeza do vocabulário antigo (não faz nada em banco novo)
-- ---------------------------------------------------------------------
drop function if exists public.tocar_diaria_do_roteiro() cascade;
drop function if exists public.tocar_diaria_da_cena() cascade;

-- ---------------------------------------------------------------------
-- 10. SISTEMAS vNEXT (fixados, arquivo, lixeira, revisão, notas,
--     estilo de capa e atividade). Mesmo conteúdo de migration_vnext.sql.
-- ---------------------------------------------------------------------
-- ---------------------------------------------------------------------
-- 1. FIXADOS  (clientes já tinha; agora gravações e roteiros também)
-- ---------------------------------------------------------------------
alter table public.clientes  add column if not exists is_pinned boolean not null default false;
alter table public.gravacoes add column if not exists is_pinned boolean not null default false;
alter table public.roteiros  add column if not exists is_pinned boolean not null default false;

-- ---------------------------------------------------------------------
-- 2. ARQUIVAMENTO E LIXEIRA (soft delete — o dado continua no banco)
-- ---------------------------------------------------------------------
alter table public.gravacoes add column if not exists archived_at timestamptz;
alter table public.gravacoes add column if not exists deleted_at  timestamptz;
alter table public.roteiros  add column if not exists archived_at timestamptz;
alter table public.roteiros  add column if not exists deleted_at  timestamptz;
alter table public.clientes  add column if not exists deleted_at  timestamptz;

-- ---------------------------------------------------------------------
-- 3. REVISÃO DO ROTEIRO + ESTILO DA CAPA + NOTA INTERNA
-- ---------------------------------------------------------------------
alter table public.roteiros add column if not exists status text not null default 'Em criação';
alter table public.roteiros add column if not exists nota_interna text not null default '';
alter table public.gravacoes add column if not exists cover_style text not null default 'gradient';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'roteiros_status_valido') then
    alter table public.roteiros add constraint roteiros_status_valido
      check (status in ('Em criação','Em revisão','Aprovado internamente','Pronto para gravar','Gravado'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gravacoes_capa_valida') then
    alter table public.gravacoes add constraint gravacoes_capa_valida
      check (cover_style in ('minimal','editorial','gradient'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. ATIVIDADE
--    Só eventos relevantes: criar, excluir, duplicar, mudar status,
--    arquivar, restaurar, baixar. Nada de digitação do autosave.
-- ---------------------------------------------------------------------
create table if not exists public.atividades (
  id           uuid primary key default gen_random_uuid(),
  action_type  text not null,
  entity_type  text not null,
  entity_id    uuid,
  client_id    uuid references public.clientes(id) on delete cascade,
  recording_id uuid references public.gravacoes(id) on delete cascade,
  description  text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists atividades_data_idx    on public.atividades (created_at desc);
create index if not exists atividades_cliente_idx on public.atividades (client_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5. ÍNDICES DOS NOVOS FILTROS
-- ---------------------------------------------------------------------
create index if not exists gravacoes_arquivadas_idx on public.gravacoes (archived_at);
create index if not exists gravacoes_lixeira_idx    on public.gravacoes (deleted_at);
create index if not exists roteiros_status_idx      on public.roteiros (status);
create index if not exists roteiros_lixeira_idx     on public.roteiros (deleted_at);

-- ---------------------------------------------------------------------
-- 6. VISÕES ATUALIZADAS
--    As visões passam a expor os campos novos e a contar apenas roteiros
--    que não estão na lixeira.
-- ---------------------------------------------------------------------
drop view if exists public.gravacoes_resumo;
create view public.gravacoes_resumo
with (security_invoker = on) as
select
  g.id, g.client_id, g.nome, g.data_gravacao, g.status,
  g.local, g.responsavel, g.videomaker, g.observacoes,
  g.is_pinned, g.archived_at, g.deleted_at, g.cover_style,
  g.created_at, g.updated_at,
  c.nome as cliente_nome,
  c.logo_url as cliente_logo_url,
  (select count(*) from public.roteiros r
     where r.recording_session_id = g.id and r.deleted_at is null) as total_roteiros
from public.gravacoes g
join public.clientes c on c.id = g.client_id;

drop view if exists public.clientes_resumo;
create view public.clientes_resumo
with (security_invoker = on) as
select
  c.id, c.nome, c.observacoes, c.logo_url, c.logo_path, c.is_pinned,
  c.deleted_at, c.created_at, c.updated_at,
  (select count(*) from public.gravacoes g
     where g.client_id = c.id and g.deleted_at is null and g.archived_at is null) as total_gravacoes,
  (select count(*) from public.roteiros r
     join public.gravacoes g2 on g2.id = r.recording_session_id
    where g2.client_id = c.id and r.deleted_at is null and g2.deleted_at is null) as total_roteiros,
  greatest(c.updated_at,
           coalesce((select max(g3.updated_at) from public.gravacoes g3 where g3.client_id = c.id),
                    c.updated_at)) as ultima_atividade
from public.clientes c;

-- ---------------------------------------------------------------------
-- 7. ACESSO (mesma política das demais tabelas)
-- ---------------------------------------------------------------------
alter table public.atividades enable row level security;
drop policy if exists acesso_interno_atividades on public.atividades;
create policy acesso_interno_atividades on public.atividades
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.atividades to anon, authenticated;
grant select on public.gravacoes_resumo, public.clientes_resumo to anon, authenticated;

-- =====================================================================
--  Fim. Se rodou sem erro, os novos sistemas têm onde guardar os dados.
-- =====================================================================


-- =====================================================================
--  Fim. Se rodou sem erro, o banco está pronto.
--  Conferência rápida: em Table Editor devem aparecer clientes,
--  gravacoes, roteiros e cenas.
-- =====================================================================
