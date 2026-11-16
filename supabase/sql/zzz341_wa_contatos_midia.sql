-- 4.52.5: nomes de quem escreve nos grupos (o WhatsApp manda um código @lid em vez do número)
-- e dados para baixar a mídia sem depender da busca do Evolution (que falha no MySQL).
alter table public.wa_mensagens add column if not exists midia_raw jsonb;

create table if not exists public.wa_contatos (
  jid text primary key,
  nome text,
  numero text,
  atualizado_em timestamptz not null default now()
);
alter table public.wa_contatos enable row level security;
drop policy if exists wa_contatos_ver on public.wa_contatos;
create policy wa_contatos_ver on public.wa_contatos for select to authenticated using (public.pode_ver_wa());

-- troca "124704929120486" pelo nome guardado, quando houver
create or replace function public.wa_nomes_aplicar() returns integer
language sql security definer set search_path = public as $$
  with u as (
    update public.wa_mensagens m set autor_nome = c.nome
      from public.wa_contatos c
     where m.autor_jid = c.jid and c.nome is not null and c.nome <> ''
       and (m.autor_nome is null or m.autor_nome ~ '^\+?[0-9]+$')
    returning 1)
  select count(*)::int from u;
$$;
revoke all on function public.wa_nomes_aplicar() from public, anon, authenticated;
create index if not exists wa_mensagens_autor_jid on public.wa_mensagens(autor_jid);
