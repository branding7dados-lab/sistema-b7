-- =====================================================================
-- PUSH (Web Push) E REALTIME — build 2026-09-09-j
--
--  1. push_subscricoes: uma linha por navegador inscrito. Cada pessoa só
--     enxerga e mexe nas suas (RLS). A Edge Function b7-push lê com a
--     service role, por isso não precisa de política própria.
--  2. push_registrar(): grava a inscrição do navegador para auth.uid().
--     Se o mesmo endpoint já pertencia a outra conta (mesmo navegador,
--     outra pessoa entrou), a inscrição antiga é apagada — o aparelho
--     recebe as mensagens de quem está logado agora, nunca das duas.
--  3. Publicação Realtime: notificacoes, aprovacoes, aprovacao_partes e
--     comentarios entram em supabase_realtime (se ela existir), para o
--     sino e as listas de aprovação se atualizarem sem recarregar.
--
-- A chave privada VAPID NUNCA entra no banco nem no frontend: mora só
-- nas variáveis de ambiente da Edge Function (ver PUSH.md).
-- Aditiva e idempotente. Depende de migration_auth.sql e
-- migration_aprovacoes_v2.sql.
-- =====================================================================

create table if not exists public.push_subscricoes (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscricoes_perfil on public.push_subscricoes (perfil_id);

alter table public.push_subscricoes enable row level security;

do $$
begin
  drop policy if exists push_proprias on public.push_subscricoes;
  create policy push_proprias on public.push_subscricoes for all to authenticated
    using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
end $$;

revoke all on public.push_subscricoes from anon;
grant select, insert, update, delete on public.push_subscricoes to authenticated;

-- ---------------------------------------------------------------------
create or replace function public.push_registrar(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária.';
  end if;
  if coalesce(p_endpoint, '') = '' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Inscrição incompleta.';
  end if;
  /* o endpoint identifica o navegador; se ele trocou de dono, troca aqui */
  delete from public.push_subscricoes where endpoint = p_endpoint and perfil_id <> auth.uid();
  insert into public.push_subscricoes (perfil_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.push_registrar(text, text, text, text) from public;
grant execute on function public.push_registrar(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- REALTIME — só onde a publicação existe (no Supabase ela existe; num
-- PostgreSQL local de teste, não, e este bloco apenas avisa).
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publicação supabase_realtime não existe aqui: nada a fazer (normal fora do Supabase).';
    return;
  end if;
  foreach t in array array['notificacoes', 'aprovacoes', 'aprovacao_partes', 'comentarios']
  loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t)
       and not exists (select 1 from pg_publication_tables
                        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

select 'migration_push aplicada' as resultado;
