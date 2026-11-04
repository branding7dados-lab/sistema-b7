-- zzz278: LEGENDAS — consertar legenda (.srt) com IA, numa aba própria.
-- A IA só recebe o TEXTO de cada legenda; números e tempos são remontados
-- pelo sistema (nunca mudam). Aqui: o módulo, o histórico e a lista de
-- marcas e termos (geral e por cliente). Aplicada como: legendas_1.

insert into public.modulos (id, rotulo, ordem) values ('legendas', 'Legendas', 55)
on conflict (id) do update set rotulo = excluded.rotulo;
insert into public.funcao_modulos (funcao, modulo, nivel) values ('coordenador', 'legendas', 'total'), ('videomaker', 'legendas', 'total')
on conflict do nothing;

create or replace function public.pode_legendas(p_min int default 1)
returns boolean language sql stable security definer set search_path = public as $$
  select public.sou_equipe_interna() and public.nivel_modulo('legendas', auth.uid()) >= p_min
$$;
revoke execute on function public.pode_legendas(int) from public, anon;
grant execute on function public.pode_legendas(int) to authenticated;

-- ---------------------------------------------------------------- termos
create table if not exists public.legenda_termos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clientes(id) on delete cascade,
  termo text not null check (char_length(btrim(termo)) between 2 and 80),
  criado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  removido_em timestamptz
);
create unique index if not exists legenda_termos_unico on public.legenda_termos (coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(termo))) where removido_em is null;
create index if not exists legenda_termos_cliente_idx on public.legenda_termos (client_id);
create index if not exists legenda_termos_criado_por_idx on public.legenda_termos (criado_por);
alter table public.legenda_termos enable row level security;
grant select on public.legenda_termos to authenticated;
create policy legenda_termos_ler on public.legenda_termos for select to authenticated using ((select public.pode_legendas(1)) and removido_em is null);

-- geral (p_client nulo) = só quem tem Total; do cliente = Editar
create or replace function public.legenda_termo_salvar(p_client uuid, p_termos text[])
returns int language plpgsql security definer set search_path = public as $$
declare t text; n int := 0;
begin
  if not public.pode_legendas(case when p_client is null then 3 else 2 end) then
    raise exception 'Sua conta não edita % das legendas.', case when p_client is null then 'a lista geral de marcas' else 'os termos' end using errcode = '42501';
  end if;
  foreach t in array coalesce(p_termos, '{}') loop
    t := btrim(regexp_replace(t, '\s+', ' ', 'g'));
    if char_length(t) between 2 and 80 then
      insert into public.legenda_termos (client_id, termo) values (p_client, t) on conflict (coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(termo))) where removido_em is null do nothing;
      if found then n := n + 1; end if;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.legenda_termo_salvar(uuid, text[]) from public, anon;
grant execute on function public.legenda_termo_salvar(uuid, text[]) to authenticated;

create or replace function public.legenda_termo_remover(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c uuid; achou boolean;
begin
  select client_id, true into c, achou from public.legenda_termos where id = p_id and removido_em is null;
  if achou is null then return; end if;
  if not public.pode_legendas(case when c is null then 3 else 2 end) then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  update public.legenda_termos set removido_em = now() where id = p_id;
end $$;
revoke execute on function public.legenda_termo_remover(uuid) from public, anon;
grant execute on function public.legenda_termo_remover(uuid) to authenticated;

-- ---------------------------------------------------------------- histórico
create table if not exists public.legendas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clientes(id) on delete set null,
  demanda_id uuid references public.demandas_edicao(id) on delete set null,
  nome_arquivo text not null default 'legenda.srt' check (char_length(nome_arquivo) <= 200),
  original text not null check (char_length(original) <= 1000000),
  corrigido text not null check (char_length(corrigido) <= 1000000),
  total int not null default 0,
  alteradas int not null default 0,
  criado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists legendas_cliente_idx on public.legendas (client_id);
create index if not exists legendas_demanda_idx on public.legendas (demanda_id);
create index if not exists legendas_criado_por_idx on public.legendas (criado_por);
create index if not exists legendas_recentes_idx on public.legendas (created_at desc);
alter table public.legendas enable row level security;
grant select on public.legendas to authenticated;
create policy legendas_ler on public.legendas for select to authenticated using ((select public.pode_legendas(1)) and deleted_at is null);

create or replace function public.legenda_salvar(p_client uuid, p_demanda uuid, p_nome text, p_original text, p_corrigido text, p_total int, p_alteradas int)
returns uuid language plpgsql security definer set search_path = public as $$
declare novo uuid; cli uuid := p_client;
begin
  if not public.pode_legendas(2) then raise exception 'Sua conta não corrige legendas.' using errcode = '42501'; end if;
  if p_demanda is not null then
    select client_id into cli from public.demandas_edicao where id = p_demanda and deleted_at is null;
    if cli is null then raise exception 'Demanda não encontrada.'; end if;
  end if;
  insert into public.legendas (client_id, demanda_id, nome_arquivo, original, corrigido, total, alteradas)
  values (cli, p_demanda, left(coalesce(nullif(btrim(p_nome), ''), 'legenda.srt'), 200), p_original, p_corrigido, greatest(0, coalesce(p_total, 0)), greatest(0, coalesce(p_alteradas, 0)))
  returning id into novo;
  return novo;
end $$;
revoke execute on function public.legenda_salvar(uuid, uuid, text, text, text, int, int) from public, anon;
grant execute on function public.legenda_salvar(uuid, uuid, text, text, text, int, int) to authenticated;

create or replace function public.legenda_apagar(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.pode_legendas(2) then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  update public.legendas set deleted_at = now() where id = p_id and deleted_at is null;
end $$;
revoke execute on function public.legenda_apagar(uuid) from public, anon;
grant execute on function public.legenda_apagar(uuid) to authenticated;

-- lista geral inicial (a do agente que o Kevin usava)
insert into public.legenda_termos (client_id, termo, criado_por) select null, t, null from unnest(array[
  'Infinite Fio', 'Mais Sorrisos', 'ClimaPro', 'Autoescola Sudoeste', 'Sabor da Feira', 'Ninno', 'Ensino Plus', 'C6 Farma',
  'PJe-Calc', 'Calc Machine', 'WhatsApp', 'Instagram', 'iFood', 'Vitória da Conquista', 'PRP', 'DHT', 'CSV'
]) t on conflict (coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(termo))) where removido_em is null do nothing;
