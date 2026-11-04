-- =====================================================================
-- MIGRATION — PILARES DE CONTEÚDO (build 2026-09-09-j)
--
-- A tabela public.pilares já existe desde migration_vcontent.sql. O que
-- esta migration faz é garantir o vínculo conteúdo → pilar em bancos que
-- passaram por versões intermediárias, e deixar a view linhas_resumo
-- com o resumo de percentual planejado.
--
-- Aditiva e idempotente: pode rodar quantas vezes for preciso.
-- Ordem: depois de migration_aprovacoes_v2.sql, antes de migration_rls.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. conteudos.pilar_id (FK on delete set null: apagar o pilar não
--    apaga o conteúdo, só o desvincula)
-- ---------------------------------------------------------------------
alter table public.conteudos
  add column if not exists pilar_id uuid references public.pilares(id) on delete set null;
create index if not exists conteudos_pilar_idx on public.conteudos (pilar_id);

-- roteiros.pilar continua texto (legado); nada muda ali.

-- ---------------------------------------------------------------------
-- 2. pilares: garantias para bancos antigos (colunas e checks)
-- ---------------------------------------------------------------------
alter table public.pilares add column if not exists position    integer not null default 0;
alter table public.pilares add column if not exists nome        text not null default '';
alter table public.pilares add column if not exists percentual  numeric(5,2) not null default 0;
alter table public.pilares add column if not exists funil       text not null default 'Topo';
alter table public.pilares add column if not exists objetivo    text not null default '';
alter table public.pilares add column if not exists observacoes text not null default '';
alter table public.pilares add column if not exists updated_at  timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pilares_funil_valido') then
    alter table public.pilares
      add constraint pilares_funil_valido check (funil in ('Topo','Meio','Fundo'));
  end if;
end $$;
-- Sem check de 0..100 no percentual: a soma é aviso na tela, não bloqueio.

-- updated_at: o trigger pilares_updated_at já vem de migration_vcontent.sql.

-- ---------------------------------------------------------------------
-- 3. linhas_resumo: mesma view de migration_fix.sql + percentual
--    planejado (soma dos pilares). Recriada inteira porque `create or
--    replace` não aceita coluna nova no meio.
-- ---------------------------------------------------------------------
drop view if exists public.linhas_resumo;
create view public.linhas_resumo
with (security_invoker = on) as
select
  l.*,
  c.nome as cliente_nome,
  c.logo_url as cliente_logo_url,
  (select count(*) from public.conteudos ct
     where ct.linha_id = l.id and ct.deleted_at is null) as total_conteudos,
  (select count(*) from public.conteudos ct
     where ct.linha_id = l.id and ct.deleted_at is null
       and ct.status in ('Em criação','Em revisão','Aprovado','Programado','Publicado')) as total_estruturados,
  (select count(*) from public.pilares p where p.linha_id = l.id) as total_pilares,
  (select coalesce(sum(p.percentual), 0) from public.pilares p where p.linha_id = l.id) as percentual_pilares
from public.linhas_editoriais l
join public.clientes c on c.id = l.client_id;
grant select on public.linhas_resumo to authenticated;
do $$
begin
  if exists (select 1 from pg_proc where proname = 'b7_grant_anon_se_aberto') then
    perform public.b7_grant_anon_se_aberto('linhas_resumo');
  end if;
end $$;

-- Permissões e RLS de pilares/conteudos ficam em migration_rls.sql
-- (pilares: só equipe; conteudos: equipe + cliente do próprio client_id).
select 'migration_pilares.sql aplicada' as resultado;
