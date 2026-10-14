-- zzz164: como a B7 trabalha com cada cliente + mural de trends da equipe
alter table public.clientes add column if not exists modo text not null default 'linha';
do $$ begin
  alter table public.clientes add constraint clientes_modo_chk check (modo in ('linha','semana','roteiros'));
exception when duplicate_object then null; end $$;

create table if not exists public.trends (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default '' check (char_length(titulo) <= 140),
  link text not null default '' check (char_length(link) <= 600),
  nota text not null default '' check (char_length(nota) <= 1200),
  criado_por uuid default auth.uid(),
  criado_por_nome text not null default '',
  usos jsonb not null default '[]'::jsonb,
  arquivada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trends_created_idx on public.trends (created_at desc);
alter table public.trends enable row level security;
drop policy if exists trends_equipe on public.trends;
create policy trends_equipe on public.trends for all
  using (public.sou_equipe_interna()) with check (public.sou_equipe_interna());
grant select, insert, update, delete on public.trends to authenticated;

-- a lista de clientes passa a trazer o modo (coluna nova no fim da view)
create or replace view public.clientes_resumo with (security_invoker = on) as
 SELECT id, nome, observacoes, logo_url, logo_path, is_pinned, deleted_at, created_at, updated_at,
    ( SELECT count(*) FROM gravacoes g WHERE g.client_id = c.id AND g.deleted_at IS NULL AND g.archived_at IS NULL) AS total_gravacoes,
    ( SELECT count(*) FROM roteiros r JOIN gravacoes g2 ON g2.id = r.recording_session_id
       WHERE g2.client_id = c.id AND r.deleted_at IS NULL AND g2.deleted_at IS NULL) AS total_roteiros,
    GREATEST(updated_at, COALESCE(( SELECT max(g3.updated_at) FROM gravacoes g3 WHERE g3.client_id = c.id), updated_at)) AS ultima_atividade,
    teste,
    modo
   FROM clientes c;
