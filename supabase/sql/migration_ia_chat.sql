-- =====================================================================
-- CHAT COM O ASSISTENTE (zzz78)
-- Conversas guardadas no banco, POR PESSOA (decisão do Kevin, 07/10/2026).
--
-- Aditivo: duas tabelas novas e a função de configuração ganha a chave
-- "chat". Nenhuma política existente muda.
--
-- Quem lê: só o dono da conversa (nem administrador lê a de outra
-- pessoa pela API). Quem grava: só o servidor (função b7-ia), depois de
-- conferir a sessão — não há política de inserção/alteração. O dono pode
-- apagar a própria conversa (as mensagens vão junto).
-- =====================================================================

create table if not exists public.ia_conversas (
  id          uuid primary key default gen_random_uuid(),
  perfil_id   uuid not null references public.perfis(id) on delete cascade,
  cliente_id  uuid references public.clientes(id) on delete set null,
  titulo      text not null default 'Nova conversa',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ia_conversas_dono_idx on public.ia_conversas (perfil_id, updated_at desc);

create table if not exists public.ia_mensagens (
  id           uuid primary key default gen_random_uuid(),
  conversa_id  uuid not null references public.ia_conversas(id) on delete cascade,
  papel        text not null check (papel in ('user', 'assistant')),
  texto        text not null,
  created_at   timestamptz not null default now()
);
create index if not exists ia_mensagens_conversa_idx on public.ia_mensagens (conversa_id, created_at);

alter table public.ia_conversas enable row level security;
alter table public.ia_mensagens enable row level security;

revoke all on table public.ia_conversas from anon, public;
revoke all on table public.ia_mensagens from anon, public;
revoke all on table public.ia_conversas from authenticated;
revoke all on table public.ia_mensagens from authenticated;
grant select, delete on table public.ia_conversas to authenticated;
grant select on table public.ia_mensagens to authenticated;

drop policy if exists ia_conversas_le on public.ia_conversas;
create policy ia_conversas_le on public.ia_conversas
  for select to authenticated
  using (perfil_id = auth.uid() and public.sou_equipe_interna());

drop policy if exists ia_conversas_apaga on public.ia_conversas;
create policy ia_conversas_apaga on public.ia_conversas
  for delete to authenticated
  using (perfil_id = auth.uid() and public.sou_equipe_interna());

drop policy if exists ia_mensagens_le on public.ia_mensagens;
create policy ia_mensagens_le on public.ia_mensagens
  for select to authenticated
  using (public.sou_equipe_interna() and exists (
    select 1 from public.ia_conversas c where c.id = ia_mensagens.conversa_id and c.perfil_id = auth.uid()));

-- liga/desliga do chat junto dos outros dois (Configurações → Admin).
-- "chat" é opcional no pedido: ausente = ligado.
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
     or jsonb_typeof(p_valor -> 'linhas') is distinct from 'boolean'
     or (p_valor ? 'chat' and jsonb_typeof(p_valor -> 'chat') is distinct from 'boolean') then
    raise exception 'Valor inválido.';
  end if;
  insert into public.sistema_config (chave, valor, atualizado_em, atualizado_por)
  values (p_chave, jsonb_build_object('roteiros', p_valor -> 'roteiros', 'linhas', p_valor -> 'linhas',
                                      'chat', coalesce(p_valor -> 'chat', 'true'::jsonb)), now(), auth.uid())
  on conflict (chave) do update
    set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
end
$$;

revoke all on function public.sistema_config_definir(text, jsonb) from public, anon;
grant execute on function public.sistema_config_definir(text, jsonb) to authenticated;
