-- Esboço mínimo do que a zzz393 usa, para testar num Postgres local
create schema if not exists auth;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
grant usage on schema public, auth to authenticated;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
grant execute on function auth.uid() to authenticated;
create table public.perfis (id uuid primary key, nome text, papel text, estado text default 'ativa', financeiro boolean default false);
create or replace function public.sou_admin_pleno() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select papel = 'admin' and not financeiro from perfis where id = auth.uid()), false) $$;
grant execute on function public.sou_admin_pleno() to authenticated;
create table public.sistema_config (chave text primary key, valor jsonb not null, atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.perfis(id) on delete set null);
grant select on public.sistema_config to authenticated;
