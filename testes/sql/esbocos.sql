-- Esboço mínimo do banco do B7 para testar as migrações do WhatsApp num Postgres local.
-- Só o que as migrações wa_* usam; nada disso vai para o Supabase.
create extension if not exists pgcrypto;
create schema if not exists auth;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
create table if not exists storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
create or replace function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n, '/') $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
grant usage on schema public, auth, storage to authenticated, anon, service_role;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
grant execute on function auth.uid() to authenticated, anon, service_role;

create table if not exists public.perfis (id uuid primary key, nome text, username text, papel text, estado text default 'ativa',
  eh_admin boolean default false, funcoes_adicionais text[] default '{}', last_seen_at timestamptz);
create table if not exists public.clientes (id uuid primary key default gen_random_uuid(), nome text);
grant select on public.perfis, public.clientes to authenticated;
create or replace function public.sou_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select eh_admin or papel = 'admin' from perfis where id = auth.uid()), false) $$;
create or replace function public.tenho_funcao_extra(f text, p uuid) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select f = any(funcoes_adicionais) from perfis where id = p), false) $$;
create or replace function public.eh_videomaker_elegivel(p_id uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from perfis p where p.id = p_id and p.estado = 'ativa' and (p.papel = 'videomaker' or public.tenho_funcao_extra('videomaker', p_id))) $$;
grant execute on all functions in schema public to authenticated;
create table if not exists public.wa_assistente (id int primary key, equipe jsonb default '[]');
create table if not exists public.eventos_dominio (id uuid primary key default gen_random_uuid(), tipo text, chave text unique, client_id uuid, alvo_tipo text, payload jsonb, processado_em timestamptz);
create table if not exists public.notificacoes (evento_id uuid, destinatario_id uuid, client_id uuid, tipo text, titulo text, mensagem text, link text, dados jsonb, unique (evento_id, destinatario_id));
create table if not exists public.wa_contatos (jid text primary key, nome text, numero text, foto_url text, atualizado_em timestamptz not null default now());
