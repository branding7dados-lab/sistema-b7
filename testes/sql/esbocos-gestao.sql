-- Esboço mínimo das tabelas que a Gestão lê (mesmas colunas usadas no B7), para testar a zzz388 num Postgres local
create extension if not exists pgcrypto;
create schema if not exists auth;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
grant usage on schema public, auth to authenticated;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
grant execute on function auth.uid() to authenticated;
create table public.perfis (id uuid primary key, nome text, papel text, estado text default 'ativa', avatar_url text, funcao text, ultimo_acesso timestamptz);
create or replace function public.sou_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select papel = 'admin' from perfis where id = auth.uid()), false) $$;
create or replace function public.notif_hoje() returns date language sql stable as $$ select current_date $$;
create table public.pacotes_producao (id uuid primary key default gen_random_uuid(), nome text, itens jsonb not null default '[]');
create table public.clientes (id uuid primary key default gen_random_uuid(), nome text, logo_url text, deleted_at timestamptz, servico text default 'ativo', teste boolean default false,
  pacote_id uuid references public.pacotes_producao(id));
create table public.conteudos (id uuid primary key default gen_random_uuid(), client_id uuid, tipo text, status text, data_postagem date, deleted_at timestamptz, archived_at timestamptz);
create table public.design_deliverables (id uuid primary key default gen_random_uuid(), client_id uuid, designer_id uuid, status text, prazo date, versao_atual int default 1,
  created_at timestamptz default now(), finalizado_em timestamptz, deleted_at timestamptz);
create table public.demandas_edicao (id uuid primary key default gen_random_uuid(), client_id uuid, videomaker_id uuid, editing_status text, prazo date,
  created_at timestamptz default now(), entregue_em timestamptz, deleted_at timestamptz);
create table public.aprovacoes (id uuid primary key default gen_random_uuid(), client_id uuid, situacao text, enviado_em timestamptz, decidido_em timestamptz, origem_decisao text, deleted_at timestamptz);
create table public.cliente_satisfacao (id uuid primary key default gen_random_uuid(), client_id uuid, nota int, comentario text, mes date, created_at timestamptz default now());
create table public.cliente_pedidos (id uuid primary key default gen_random_uuid(), client_id uuid, situacao text, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.perfil_clientes (perfil_id uuid, client_id uuid);
