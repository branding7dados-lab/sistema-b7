-- Esboço mínimo do que a zzz392 usa, para testar num Postgres local
create extension if not exists pgcrypto;
create schema if not exists auth;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
grant usage on schema public, auth to authenticated, service_role;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
grant execute on function auth.uid() to authenticated, service_role;
create table public.perfis (id uuid primary key, nome text, username text, papel text, estado text default 'ativa', financeiro boolean default false, superadmin text);
create table public.auditoria (id bigserial primary key, autor_id uuid, autor_username text, acao text, alvo_tipo text, alvo_id uuid, alvo_descricao text, detalhe jsonb, criado_em timestamptz default now());
create or replace function public.sou_admin_pleno() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select papel = 'admin' and not financeiro from perfis where id = auth.uid()), false) $$;
grant execute on function public.sou_admin_pleno() to authenticated;
grant select on public.perfis to authenticated;
