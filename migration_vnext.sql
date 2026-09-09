-- =====================================================================
--  MIGRATION vNext — Roteiros B7
--
--  Acrescenta os campos e a tabela dos novos sistemas. Roda por cima do
--  banco existente: nada é recriado, nada é apagado. Pode ser executada
--  mais de uma vez sem erro.
--
--  Como rodar: Supabase → SQL Editor → New query → cole tudo → Run.
--  (O supabase_setup.sql continua sendo o arquivo de instalação do zero;
--   este aqui é só para quem já tem o banco no ar.)
-- =====================================================================

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
