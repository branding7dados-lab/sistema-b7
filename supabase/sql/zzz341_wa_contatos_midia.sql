-- 4.52.5/4.52.6: nomes de quem escreve (o WhatsApp manda um código @lid em vez do número)
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
create index if not exists wa_mensagens_autor_jid on public.wa_mensagens(autor_jid);

-- troca "124704929120486" pelo nome guardado, nas mensagens e nas conversas individuais
create or replace function public.wa_nomes_aplicar() returns integer
language plpgsql security definer set search_path = public as $$
declare n int := 0; k int;
begin
  -- nome aprendido nos grupos (a mesma pessoa escrevendo lá) vira contato
  insert into wa_contatos(jid, nome)
  select distinct on (autor_jid) autor_jid, autor_nome from wa_mensagens
   where autor_jid is not null and coalesce(autor_nome,'') <> '' and autor_nome !~ '^\+?[0-9]+$'
   order by autor_jid, criada_em desc
  on conflict (jid) do update set nome = excluded.nome, atualizado_em = now()
   where wa_contatos.nome is null or wa_contatos.nome ~ '^\+?[0-9]+$';
  -- código @lid ↔ número: quando há um só contato com número e o mesmo nome
  update wa_contatos l set numero = p.numero
    from (select nome, min(numero) numero from wa_contatos where numero is not null and nome is not null group by nome having count(*) = 1) p
   where l.jid like '%@lid' and l.numero is null and l.nome = p.nome;
  update wa_mensagens m set autor_nome = c.nome
    from wa_contatos c
   where m.autor_jid = c.jid and coalesce(c.nome,'') <> '' and c.nome !~ '^\+?[0-9]+$'
     and (m.autor_nome is null or m.autor_nome ~ '^\+?[0-9]+$');
  get diagnostics k = row_count; n := n + k;
  update wa_conversas v set nome = c.nome
    from wa_contatos c
   where v.jid = c.jid and v.tipo <> 'grupo' and coalesce(c.nome,'') <> '' and c.nome !~ '^\+?[0-9]+$' and v.nome ~ '^\+?[0-9]+$';
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;
revoke all on function public.wa_nomes_aplicar() from public, anon, authenticated;
