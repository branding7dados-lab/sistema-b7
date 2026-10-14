-- =====================================================================
-- WHATSAPP: GRUPOS RECONHECIDOS (zzz176)
--
-- O programa de Windows lê a lista de conversas do WhatsApp (só leitura,
-- na tela da própria pessoa) e manda para cá o estado de cada uma: última
-- mensagem, se foi nossa, não lidas. O sistema casa o nome do grupo com
-- o cliente ("Suporte B7-3X - Infinite Fio" → Infinite Fio) e a equipe
-- confere uma vez. Um cliente pode ter vários grupos (Suporte, Artes…).
--   whatsapp_grupos_sincronizar(itens) — estado (vários computadores
--     podem mandar; vale o mais recente);
--   whatsapp_grupo_vincular(nome, cliente, tipo, ignorar) — a conferência.
-- Só a equipe interna lê e escreve. Só acrescenta; nada é apagado.
-- =====================================================================
create table if not exists public.whatsapp_grupos (
  nome            text primary key,
  cliente_id      uuid references public.clientes(id) on delete set null,
  tipo            text not null default '',
  confirmado      boolean not null default false,
  ignorar         boolean not null default false,
  previa          text not null default '',
  autor           text not null default '',
  minha           boolean not null default false,
  nao_lidas       int not null default 0,
  ultima_em       timestamptz,
  visto_em        timestamptz not null default now(),
  atualizado_por  uuid references public.perfis(id) default auth.uid(),
  created_at      timestamptz not null default now()
);
create index if not exists whatsapp_grupos_cliente on public.whatsapp_grupos (cliente_id);
alter table public.whatsapp_grupos enable row level security;
create policy whatsapp_grupos_ler on public.whatsapp_grupos for select to authenticated using (public.sou_equipe_interna());

create or replace function public.whatsapp_grupos_sincronizar(p_itens jsonb)
returns int
language plpgsql security definer set search_path = public
as $$
declare v_item jsonb; n int := 0; v_em timestamptz;
begin
  if not public.sou_equipe_interna() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if jsonb_typeof(p_itens) is distinct from 'array' then return 0; end if;
  for v_item in select * from jsonb_array_elements(p_itens) limit 400 loop
    if coalesce(btrim(v_item ->> 'nome'), '') = '' then continue; end if;
    v_em := nullif(v_item ->> 'ultima_em', '')::timestamptz;
    insert into whatsapp_grupos (nome, previa, autor, minha, nao_lidas, ultima_em, visto_em, atualizado_por)
    values (left(btrim(v_item ->> 'nome'), 160), left(coalesce(v_item ->> 'previa', ''), 300), left(coalesce(v_item ->> 'autor', ''), 80),
            coalesce((v_item ->> 'minha')::boolean, false), greatest(0, least(9999, coalesce((v_item ->> 'nao_lidas')::int, 0))), v_em, now(), auth.uid())
    on conflict (nome) do update set
      previa = excluded.previa, autor = excluded.autor, minha = excluded.minha, nao_lidas = excluded.nao_lidas,
      ultima_em = coalesce(excluded.ultima_em, whatsapp_grupos.ultima_em), visto_em = now(), atualizado_por = auth.uid()
    where excluded.ultima_em is null or whatsapp_grupos.ultima_em is null or excluded.ultima_em >= whatsapp_grupos.ultima_em - interval '1 minute';
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.whatsapp_grupo_vincular(p_nome text, p_cliente_id uuid, p_tipo text default '', p_ignorar boolean default false)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.sou_equipe_interna() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  insert into whatsapp_grupos (nome, cliente_id, tipo, confirmado, ignorar)
  values (left(btrim(p_nome), 160), p_cliente_id, left(coalesce(p_tipo, ''), 40), true, coalesce(p_ignorar, false))
  on conflict (nome) do update set cliente_id = excluded.cliente_id, tipo = excluded.tipo, confirmado = true, ignorar = excluded.ignorar;
end $$;

revoke all on function public.whatsapp_grupos_sincronizar(jsonb) from public, anon;
revoke all on function public.whatsapp_grupo_vincular(text, uuid, text, boolean) from public, anon;
grant execute on function public.whatsapp_grupos_sincronizar(jsonb) to authenticated;
grant execute on function public.whatsapp_grupo_vincular(text, uuid, text, boolean) to authenticated;

-- tempo real: a lista de "esperando resposta" se atualiza nos outros computadores
do $$ begin
  alter publication supabase_realtime add table public.whatsapp_grupos;
exception when others then null; end $$;
