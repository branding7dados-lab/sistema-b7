-- 23/11/2026 — REGISTRO DAS MIGRAÇÕES
-- A partir daqui, as migrações novas (supabase/sql/zzzNNN_*.sql) são aplicadas SOZINHAS no merge para a main
-- (.github/workflows/sql.yml → .github/publicar/aplicar-sql.sh). Esta tabela guarda o que já rodou, para nunca
-- aplicar a mesma migração duas vezes. Só o GitHub (pela API de gestão do Supabase) lê e escreve aqui.
create table if not exists public.b7_migracoes (
  arquivo text primary key,                  -- ex.: zzz383_wa_varios_numeros.sql
  aplicada_em timestamptz not null default now(),
  versao text                                -- commit do GitHub que aplicou
);
alter table public.b7_migracoes enable row level security;
revoke all on public.b7_migracoes from anon, authenticated;
-- a zzz383 foi aplicada à mão em 23/11/2026, antes da automação
insert into public.b7_migracoes (arquivo, versao) values ('zzz383_wa_varios_numeros.sql', 'manual') on conflict (arquivo) do nothing;
