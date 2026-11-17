-- 4.58.6: a mesma pessoa aparecia em duas conversas: uma pelo número
-- (@s.whatsapp.net) e outra pelo código interno do WhatsApp (@lid).
-- wa_unir_lids() junta tudo na conversa do número.
--  • o par vem de wa_contatos (lid → numero) ou, sem isso, de um nome
--    igual e único entre as conversas individuais;
--  • as mensagens passam para a conversa do número e a do @lid sai;
--  • se ainda não existe conversa do número, ela é criada com os dados da do @lid.
--  As mensagens sempre mudam de conversa ANTES de a do @lid sair (o FK apaga em cascata).
create or replace function public.wa_unir_lids()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare r record; n int := 0; pn text;
begin
  -- aprende o número pelo nome único (ex.: "Kevin" com uma só conversa por número)
  update wa_contatos l set numero = split_part(p.jid, '@', 1)
    from wa_conversas v
    join lateral (select jid from wa_conversas p2
                   where p2.tipo <> 'grupo' and p2.jid like '%@s.whatsapp.net' and p2.nome = v.nome) p on true
   where l.jid = v.jid and v.jid like '%@lid' and l.numero is null
     and coalesce(v.nome,'') <> '' and v.nome !~ '^\+?[0-9]+$'
     and (select count(*) from wa_conversas p3 where p3.tipo <> 'grupo' and p3.jid like '%@s.whatsapp.net' and p3.nome = v.nome) = 1;
  insert into wa_contatos(jid, numero, nome)
  select v.jid, split_part(p.jid, '@', 1), v.nome
    from wa_conversas v join wa_conversas p on p.nome = v.nome and p.tipo <> 'grupo' and p.jid like '%@s.whatsapp.net'
   where v.jid like '%@lid' and coalesce(v.nome,'') <> '' and v.nome !~ '^\+?[0-9]+$'
     and not exists (select 1 from wa_contatos c where c.jid = v.jid)
     and (select count(*) from wa_conversas p3 where p3.tipo <> 'grupo' and p3.jid like '%@s.whatsapp.net' and p3.nome = v.nome) = 1
  on conflict (jid) do nothing;

  for r in select v.*, c.numero from wa_conversas v join wa_contatos c on c.jid = v.jid
            where v.jid like '%@lid' and v.tipo <> 'grupo' and c.numero ~ '^[0-9]{8,}$' loop
    pn := r.numero || '@s.whatsapp.net';
    if exists (select 1 from wa_conversas where jid = pn) then
      update wa_mensagens set jid = pn where jid = r.jid;
      update wa_conversas p set
        foto_url = coalesce(p.foto_url, r.foto_url),
        cliente_id = coalesce(p.cliente_id, r.cliente_id),
        responsavel_id = coalesce(p.responsavel_id, r.responsavel_id),
        fixada = p.fixada or coalesce(r.fixada, false),
        nao_lidas = coalesce(p.nao_lidas, 0) + coalesce(r.nao_lidas, 0),
        nome = case when p.nome ~ '^\+?[0-9]+$' and r.nome !~ '^\+?[0-9]+$' then r.nome else p.nome end,
        ultima_em = greatest(p.ultima_em, r.ultima_em),
        previa = case when r.ultima_em > coalesce(p.ultima_em, '-infinity') then r.previa else p.previa end,
        previa_autor = case when r.ultima_em > coalesce(p.ultima_em, '-infinity') then r.previa_autor else p.previa_autor end,
        previa_de_mim = case when r.ultima_em > coalesce(p.ultima_em, '-infinity') then r.previa_de_mim else p.previa_de_mim end,
        esperando_desde = case when r.ultima_em > coalesce(p.ultima_em, '-infinity') then r.esperando_desde else p.esperando_desde end,
        atualizado_em = now()
       where p.jid = pn;
      delete from wa_conversas where jid = r.jid;
    else
      -- a chave estrangeira não acompanha troca de jid: cria a do número, move, tira a do @lid
      insert into wa_conversas (jid, tipo, nome, foto_url, cliente_id, ultima_em, previa, previa_autor, previa_de_mim,
                                nao_lidas, esperando_desde, arquivada, fixada, responsavel_id, atualizado_em)
      values (pn, r.tipo, r.nome, r.foto_url, r.cliente_id, r.ultima_em, r.previa, r.previa_autor, r.previa_de_mim,
              r.nao_lidas, r.esperando_desde, r.arquivada, r.fixada, r.responsavel_id, now());
      update wa_mensagens set jid = pn where jid = r.jid;
      delete from wa_conversas where jid = r.jid;
    end if;
    n := n + 1;
  end loop;

  -- foto guardada no contato @lid vale para a conversa do número
  update wa_conversas v set foto_url = c.foto_url
    from wa_contatos c
   where c.jid like '%@lid' and c.numero is not null and v.jid = c.numero || '@s.whatsapp.net'
     and c.foto_url is not null and v.foto_url is null;
  return n;
end $$;
revoke all on function public.wa_unir_lids() from public, anon, authenticated;
