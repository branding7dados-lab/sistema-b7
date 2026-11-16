-- 4.53.0: arquivos do WhatsApp no Google Drive da agência (em vez do Storage do Supabase)
-- A conexão com o Drive é separada da Agenda (pode ser outra conta do Google).
alter table public.calendario_oauth_estados add column if not exists proposito text not null default 'agenda';

create table if not exists public.drive_conexoes (
  id uuid primary key default gen_random_uuid(),
  conta_email text,
  refresh_token text not null,
  access_token text,
  token_expira_em timestamptz,
  status text not null default 'ativa',
  ultimo_erro text,
  pasta_raiz_id text,
  conectado_por uuid references public.perfis(id) on delete set null,
  conectado_em timestamptz not null default now()
);
-- tokens: só a service role (Edge Functions) lê
alter table public.drive_conexoes enable row level security;
revoke all on public.drive_conexoes from anon, authenticated;

create table if not exists public.wa_drive_pastas (
  chave text primary key,
  drive_id text not null,
  criada_em timestamptz not null default now()
);
alter table public.wa_drive_pastas enable row level security;
revoke all on public.wa_drive_pastas from anon, authenticated;

alter table public.wa_mensagens add column if not exists drive_id text;

-- o que a tela pode saber da conexão (sem token)
create or replace function public.wa_drive_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.pode_ver_wa() then null else
    coalesce((select jsonb_build_object('conectado', true, 'conta', conta_email, 'status', status, 'erro', ultimo_erro,
                      'arquivos', (select count(*) from wa_mensagens where drive_id is not null))
                from drive_conexoes order by conectado_em desc limit 1),
             jsonb_build_object('conectado', false)) end;
$$;
revoke all on function public.wa_drive_status() from public, anon;
grant execute on function public.wa_drive_status() to authenticated;
