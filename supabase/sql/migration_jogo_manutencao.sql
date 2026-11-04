-- 4.7.0 — ranking do jogo da manutenção ("Ação! Corta!")
create table if not exists public.jogo_pontos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  pontos integer not null check (pontos between 0 and 1000000),
  created_at timestamptz not null default now()
);
create index if not exists jogo_pontos_perfil_idx on public.jogo_pontos (perfil_id);
create index if not exists jogo_pontos_pontos_idx on public.jogo_pontos (pontos desc);
alter table public.jogo_pontos enable row level security;   -- só pelas funções abaixo

create or replace function public.jogo_registrar(p_pontos integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_pontos is null or p_pontos <= 0 then return; end if;
  /* no máximo um registro a cada 5 s por pessoa (evita enxurrada) */
  if exists (select 1 from public.jogo_pontos where perfil_id = auth.uid() and created_at > now() - interval '5 seconds') then return; end if;
  insert into public.jogo_pontos (perfil_id, pontos) values (auth.uid(), least(p_pontos, 1000000));
end $$;

create or replace function public.jogo_ranking()
returns table (nome text, pontos integer) language sql stable security definer set search_path = public as $$
  select split_part(coalesce(p.nome, p.username, 'Alguém'), ' ', 1) || coalesce(' ' || left(nullif(split_part(p.nome, ' ', 2), ''), 1) || '.', ''),
         max(j.pontos)::int
    from public.jogo_pontos j join public.perfis p on p.id = j.perfil_id
   where auth.uid() is not null and coalesce(p.papel, '') <> 'cliente'
   group by p.id, p.nome, p.username
   order by max(j.pontos) desc
   limit 5
$$;
revoke execute on function public.jogo_registrar(integer) from public, anon;
revoke execute on function public.jogo_ranking() from public, anon;
grant execute on function public.jogo_registrar(integer) to authenticated;
grant execute on function public.jogo_ranking() to authenticated;
