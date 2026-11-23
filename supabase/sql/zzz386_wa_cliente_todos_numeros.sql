-- 4.85.3 — O GRUPO É DO CLIENTE EM QUALQUER NÚMERO
-- Com vários números (4.84), o mesmo grupo de cliente aparece uma vez por número da B7 que está nele.
-- Ligar o grupo a um cliente valia só para a cópia daquele número — a outra continuava "sem cliente"
-- (Configurações → Grupos e clientes mostrava o grupo duas vezes, uma ligada e outra não).
-- Agora "cliente" vale para todas as cópias do grupo (o mesmo jid em qualquer número); o resto (lida, arquivada,
-- fixada, responsável, nome) continua por número. E acerta os grupos que já estão ligados numa cópia só.
-- Pode rodar mais de uma vez.
create or replace function public.wa_conversa_marcar(p_jid text, p_campo text, p_valor text default null, p_numero uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v text; nid uuid := coalesce(p_numero, public.wa_numero_padrao());
begin
  if not public.wa_pode_ver_numero(nid) then raise exception 'Sem acesso a este número.' using errcode = '42501'; end if;
  if p_campo = 'lida' then update public.wa_conversas set nao_lidas = 0 where numero_id = nid and jid = p_jid;
  elsif p_campo = 'arquivada' then update public.wa_conversas set arquivada = coalesce(p_valor, 'true')::boolean where numero_id = nid and jid = p_jid;
  elsif p_campo = 'fixada' then update public.wa_conversas set fixada = coalesce(p_valor, 'true')::boolean where numero_id = nid and jid = p_jid;
  elsif p_campo = 'cliente' then update public.wa_conversas set cliente_id = nullif(p_valor, '')::uuid where jid = p_jid;   -- 4.85.3: todas as cópias
  elsif p_campo = 'responsavel' then update public.wa_conversas set responsavel_id = nullif(p_valor, '')::uuid where numero_id = nid and jid = p_jid;
  elsif p_campo = 'sem_espera' then update public.wa_conversas set esperando_desde = null, aguardando_cliente_desde = null,
      vez = 'ninguem', vez_motivo = 'Marcado pela equipe como respondido', vez_avaliada_em = now() where numero_id = nid and jid = p_jid;
  elsif p_campo = 'nome' then
    v := left(btrim(coalesce(p_valor, '')), 80);
    if v = '' then
      update public.wa_conversas set nome_fixo = false, nome = split_part(jid, '@', 1) where numero_id = nid and jid = p_jid and tipo <> 'grupo';
      update public.wa_contatos set nome_fixo = false where jid = p_jid;
      update public.wa_conversas set nome_fixo = false where numero_id = nid and jid = p_jid and tipo = 'grupo';
    else
      update public.wa_conversas set nome = v, nome_fixo = true where numero_id = nid and jid = p_jid;
      -- contato: o nome vale para a pessoa (em qualquer número) e para as mensagens dela nos grupos
      if p_jid not like '%@g.us' then
        insert into public.wa_contatos(jid, nome, nome_fixo, atualizado_em) values (p_jid, v, true, now())
        on conflict (jid) do update set nome = excluded.nome, nome_fixo = true, atualizado_em = now();
        update public.wa_mensagens set autor_nome = v where autor_jid = p_jid and not de_mim;
      end if;
    end if;
  else raise exception 'Campo inválido.';
  end if;
end $function$;
grant execute on function public.wa_conversa_marcar(text, text, text, uuid) to authenticated;

-- grupos ligados num número só: a cópia sem cliente recebe o cliente da outra
update public.wa_conversas v set cliente_id = o.cliente_id
  from (select distinct on (jid) jid, cliente_id from public.wa_conversas where cliente_id is not null order by jid, ultima_em desc nulls last) o
 where v.jid = o.jid and v.cliente_id is null;
