-- 4.33.0 — ERROS DAS TELAS: quando algo quebra na tela de alguém, fica
-- registrado aqui (mensagem, tela, versão, plataforma). Sem dado de cliente:
-- só o texto do erro. Quem está logado grava os próprios; só administrador lê.
-- Erros iguais no mesmo dia e mesma pessoa somam em "vezes" (sem inundar).
create table if not exists public.erros_app (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid default auth.uid(),
  dia date not null default (now() at time zone 'America/Sao_Paulo')::date,
  mensagem text not null check (char_length(mensagem) <= 300),
  origem text check (char_length(origem) <= 200),
  tela text check (char_length(tela) <= 120),
  versao text check (char_length(versao) <= 20),
  plataforma text check (char_length(plataforma) <= 40),
  vezes int not null default 1,
  primeiro_em timestamptz not null default now(),
  ultimo_em timestamptz not null default now()
);
create unique index if not exists erros_app_unico on public.erros_app (perfil_id, dia, mensagem, coalesce(tela, ''));
create index if not exists erros_app_ultimo on public.erros_app (ultimo_em desc);
alter table public.erros_app enable row level security;
create policy erros_app_admin_le on public.erros_app for select to authenticated using (public.sou_admin());

create or replace function public.erro_app_registrar(p_mensagem text, p_origem text, p_tela text, p_versao text, p_plataforma text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(trim(p_mensagem), '') = '' then return; end if;
  insert into public.erros_app (perfil_id, mensagem, origem, tela, versao, plataforma)
  values (auth.uid(), left(p_mensagem, 300), left(p_origem, 200), left(p_tela, 120), left(p_versao, 20), left(p_plataforma, 40))
  on conflict (perfil_id, dia, mensagem, coalesce(tela, '')) do update
    set vezes = least(public.erros_app.vezes + 1, 100000), ultimo_em = now(), versao = excluded.versao;
end $$;
revoke execute on function public.erro_app_registrar(text, text, text, text, text) from public, anon;
grant execute on function public.erro_app_registrar(text, text, text, text, text) to authenticated;
