-- =====================================================================
-- CONFIGURAÇÕES DO SISTEMA (zzz71)
-- Um lugar para o que vale para TODOS (não para um aparelho só).
-- Hoje guarda só "ia": se o assistente aparece em Roteiros e em Linhas.
--
-- Aditivo: tabela nova + uma função. Nenhuma política existente muda.
-- Leitura: equipe interna. Escrita: só pela função abaixo, que confere
-- se quem chamou é administrador (não há política de escrita na tabela).
-- =====================================================================

create table if not exists public.sistema_config (
  chave          text primary key,
  valor          jsonb not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis(id) on delete set null
);

alter table public.sistema_config enable row level security;

revoke all on table public.sistema_config from anon, public;
grant select on table public.sistema_config to authenticated;

drop policy if exists sistema_config_le on public.sistema_config;
create policy sistema_config_le on public.sistema_config
  for select to authenticated using (public.sou_equipe_interna());

create or replace function public.sistema_config_definir(p_chave text, p_valor jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sou_admin() then
    raise exception 'Só administrador altera as configurações do sistema.' using errcode = '42501';
  end if;
  if p_chave is distinct from 'ia' then
    raise exception 'Configuração desconhecida.';
  end if;
  if jsonb_typeof(p_valor) is distinct from 'object'
     or jsonb_typeof(p_valor -> 'roteiros') is distinct from 'boolean'
     or jsonb_typeof(p_valor -> 'linhas') is distinct from 'boolean' then
    raise exception 'Valor inválido.';
  end if;
  insert into public.sistema_config (chave, valor, atualizado_em, atualizado_por)
  values (p_chave, jsonb_build_object('roteiros', p_valor -> 'roteiros', 'linhas', p_valor -> 'linhas'), now(), auth.uid())
  on conflict (chave) do update
    set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
end
$$;

revoke all on function public.sistema_config_definir(text, jsonb) from public, anon;
grant execute on function public.sistema_config_definir(text, jsonb) to authenticated;

insert into public.sistema_config (chave, valor)
values ('ia', '{"roteiros": true, "linhas": true}'::jsonb)
on conflict (chave) do nothing;
