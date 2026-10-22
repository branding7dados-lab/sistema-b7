-- zzz247: agenda da equipe (ausências e aniversários) e recado fixo
-- (já aplicada no Supabase pelo MCP; guardada aqui como registro)
create table if not exists public.equipe_ausencias (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis(id),
  tipo text not null check (tipo in ('ferias','folga','atestado','viagem','outro')),
  inicio date not null,
  fim date not null,
  nota text check (nota is null or char_length(nota) <= 200),
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  cancelado_em timestamptz,
  constraint equipe_ausencias_periodo check (fim >= inicio and fim - inicio <= 366)
);
create index if not exists equipe_ausencias_fim on public.equipe_ausencias (fim) where cancelado_em is null;
alter table public.equipe_ausencias enable row level security;
create policy equipe_ausencias_le on public.equipe_ausencias for select to authenticated using (public.sou_equipe_interna());
create policy equipe_ausencias_cria on public.equipe_ausencias for insert to authenticated with check (public.sou_admin());
create policy equipe_ausencias_muda on public.equipe_ausencias for update to authenticated using (public.sou_admin()) with check (public.sou_admin());
grant select, insert, update on public.equipe_ausencias to authenticated;

create table if not exists public.equipe_aniversarios (
  perfil_id uuid primary key references public.perfis(id),
  dia smallint check (dia between 1 and 31),
  mes smallint check (mes between 1 and 12),
  atualizado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  constraint equipe_aniversarios_par check ((dia is null) = (mes is null))
);
alter table public.equipe_aniversarios enable row level security;
create policy equipe_aniversarios_le on public.equipe_aniversarios for select to authenticated using (public.sou_equipe_interna());
create policy equipe_aniversarios_cria on public.equipe_aniversarios for insert to authenticated with check (public.sou_admin());
create policy equipe_aniversarios_muda on public.equipe_aniversarios for update to authenticated using (public.sou_admin()) with check (public.sou_admin());
grant select, insert, update on public.equipe_aniversarios to authenticated;

create or replace function public.equipe_recado_definir(p_texto text, p_ate date, p_tom text default 'marca')
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.sou_admin() then
    raise exception 'Só administrador publica o recado da equipe.' using errcode = '42501';
  end if;
  if p_texto is null or btrim(p_texto) = '' then
    insert into public.sistema_config (chave, valor, atualizado_em, atualizado_por)
    values ('recado', jsonb_build_object('ativo', false), now(), auth.uid())
    on conflict (chave) do update set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
    return;
  end if;
  if char_length(p_texto) > 280 then raise exception 'O recado pode ter até 280 caracteres.'; end if;
  if p_ate is null or p_ate < current_date or p_ate > current_date + 60 then
    raise exception 'Escolha até quando o recado fica no ar (no máximo 60 dias).';
  end if;
  if coalesce(p_tom, 'marca') not in ('marca','aviso','festa') then raise exception 'Valor inválido.'; end if;
  insert into public.sistema_config (chave, valor, atualizado_em, atualizado_por)
  values ('recado', jsonb_build_object('ativo', true, 'id', gen_random_uuid(), 'texto', btrim(p_texto), 'ate', p_ate,
          'tom', coalesce(p_tom, 'marca'), 'autor', (select nome from public.perfis where id = auth.uid()), 'em', now()), now(), auth.uid())
  on conflict (chave) do update set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
end $$;
revoke all on function public.equipe_recado_definir(text, date, text) from public, anon;
grant execute on function public.equipe_recado_definir(text, date, text) to authenticated;
