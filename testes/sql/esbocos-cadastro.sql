-- Esboço mínimo do que a zzz389 usa (mesmas colunas do B7), para testar num Postgres local
create extension if not exists pgcrypto;
create schema if not exists auth;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
grant usage on schema public, auth to authenticated;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
grant execute on function auth.uid() to authenticated;
create table public.perfis (id uuid primary key, nome text, papel text, funcao text, estado text default 'ativa', avatar_url text, nivel_clientes int default 0);
create or replace function public.sou_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select papel = 'admin' from perfis where id = auth.uid()), false) $$;
create or replace function public.sou_equipe_interna() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select papel in ('admin', 'coordenador') and estado = 'ativa' from perfis where id = auth.uid()), false) $$;
create or replace function public.sou_designer() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select papel = 'designer' and estado = 'ativa' from perfis where id = auth.uid()), false) $$;
create or replace function public.sou_videomaker() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select papel = 'videomaker' and estado = 'ativa' from perfis where id = auth.uid()), false) $$;
create or replace function public.pode_nivel(p_modulo text, p_nivel int) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select papel = 'admin' or (papel <> 'cliente' and (p_modulo <> 'clientes' or nivel_clientes >= p_nivel)) from perfis where id = auth.uid()), false) $$;
-- como no B7: administrador sempre; os outros precisam da ação liberada E do nível 2 no módulo
create table public.acoes_negadas (perfil_id uuid, acao text);
create or replace function public.pode_nivel_acao(p_acao text) returns boolean language sql stable security definer set search_path = public as
$$ select case when auth.uid() is null then false when public.sou_admin() then true
     else not exists (select 1 from acoes_negadas n where n.perfil_id = auth.uid() and n.acao = p_acao) and public.pode_nivel('clientes', 2) end $$;
create or replace function public.tenho_funcao_extra(p_funcao text, p_id uuid default auth.uid()) returns boolean language sql stable as $$ select false $$;
create or replace function public.notif_hoje() returns date language sql stable as $$ select current_date $$;
create table public.pacotes_producao (id uuid primary key default gen_random_uuid(), nome text, descricao text default '', itens jsonb not null default '[]',
  dias_semana int[] not null default '{1,2,3,4,5}', arquivado_em timestamptz);
create table public.clientes (id uuid primary key default gen_random_uuid(), nome text, logo_url text, logo_path text, contrato text, modo text, deleted_at timestamptz,
  servico text default 'ativo', teste boolean default false, pacote_id uuid references public.pacotes_producao(id) on delete set null);
create table public.clientes_interno (client_id uuid primary key references public.clientes(id) on delete cascade, observacoes text, servico_nota_interna text,
  whatsapp_grupo text, updated_at timestamptz not null default now());
create table public.cliente_inteligencia (client_id uuid primary key references public.clientes(id) on delete cascade, nicho text not null default '',
  site text not null default '', instagram text not null default '');
create table public.linhas_editoriais (id uuid primary key default gen_random_uuid(), client_id uuid, ano int, mes int, deleted_at timestamptz);
create table public.conteudos (id uuid primary key default gen_random_uuid(), client_id uuid, linha_id uuid, tipo text, position int, titulo text, status text,
  data_postagem date, producao_video text, deleted_at timestamptz, archived_at timestamptz);
grant select, insert, update on all tables in schema public to authenticated;
