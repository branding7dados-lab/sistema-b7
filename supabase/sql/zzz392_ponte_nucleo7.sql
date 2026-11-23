-- 4.90.0 — ENTRAR NO B7 PELO NÚCLEO 7 (bilhete de entrada)
--   • perfis_email: o e-mail de cada pessoa da equipe (é por ele que o bilhete acha a conta). Fica FORA de
--     `perfis`, que todo mundo lê (nomes e fotos) — inclusive o cliente do portal.
--   • ponte_usados: cada bilhete vale uma vez só.
-- Escrita só pelas funções abaixo (e pela b7-auth, como servidor). Pode rodar mais de uma vez.

create table if not exists public.perfis_email (
  perfil_id uuid primary key references public.perfis(id) on delete cascade,
  email text not null check (char_length(email) <= 160 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and email = lower(email)),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists perfis_email_unico on public.perfis_email (email);
alter table public.perfis_email enable row level security;
revoke all on public.perfis_email from anon, authenticated;
grant select on public.perfis_email to authenticated;
drop policy if exists perfis_email_leitura on public.perfis_email;
create policy perfis_email_leitura on public.perfis_email for select to authenticated
  using (perfil_id = auth.uid() or public.sou_admin_pleno());

create table if not exists public.ponte_usados (
  jti uuid primary key,
  perfil_id uuid,
  usado_em timestamptz not null default now()
);
alter table public.ponte_usados enable row level security;
revoke all on public.ponte_usados from anon, authenticated;

-- marca o bilhete como usado; devolve false se já tinha sido usado. Só o servidor (service_role) chama.
create or replace function public.ponte_usar(p_jti uuid, p_perfil uuid)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  delete from public.ponte_usados where usado_em < now() - interval '1 day';
  insert into public.ponte_usados (jti, perfil_id) values (p_jti, p_perfil) on conflict (jti) do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke all on function public.ponte_usar(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ponte_usar(uuid, uuid) to service_role;

-- Pessoas e acessos: ler e definir o e-mail da equipe (só o administrador pleno; o Financeiro não)
create or replace function public.perfis_emails()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.sou_admin_pleno() then raise exception 'Só o administrador vê os e-mails da equipe.' using errcode = '42501'; end if;
  return (select coalesce(jsonb_object_agg(e.perfil_id, e.email), '{}'::jsonb) from public.perfis_email e);
end $$;
revoke all on function public.perfis_emails() from public, anon;
grant execute on function public.perfis_emails() to authenticated;

create or replace function public.perfil_email_definir(p_perfil uuid, p_email text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v text := lower(trim(coalesce(p_email, ''))); p public.perfis; outro text;
begin
  if not public.sou_admin_pleno() then raise exception 'Só o administrador muda o e-mail da equipe.' using errcode = '42501'; end if;
  select * into p from public.perfis where id = p_perfil;
  if p.id is null then raise exception 'Conta não encontrada.'; end if;
  if p.papel = 'cliente' then raise exception 'Conta de cliente não usa a entrada pelo Núcleo 7.'; end if;
  if v = '' then delete from public.perfis_email where perfil_id = p_perfil; return null; end if;
  if char_length(v) > 160 or v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'O e-mail não parece certo.'; end if;
  select pf.nome into outro from public.perfis_email e join public.perfis pf on pf.id = e.perfil_id where e.email = v and e.perfil_id <> p_perfil;
  if outro is not null then raise exception 'Esse e-mail já é de %.', outro; end if;
  insert into public.perfis_email (perfil_id, email) values (p_perfil, v)
  on conflict (perfil_id) do update set email = excluded.email, atualizado_em = now();
  return v;
end $$;
revoke all on function public.perfil_email_definir(uuid, text) from public, anon;
grant execute on function public.perfil_email_definir(uuid, text) to authenticated;
