-- 4.80.3: renomear contato/grupo pela Central. O nome dado pela equipe fica fixo (o WhatsApp não troca de volta).
alter table public.wa_conversas add column if not exists nome_fixo boolean not null default false;
alter table public.wa_contatos add column if not exists nome_fixo boolean not null default false;

create or replace function public.wa_conversa_marcar(p_jid text, p_campo text, p_valor text default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v text;
begin
  if not public.pode_ver_wa() then raise exception 'Sem acesso às conversas.' using errcode = '42501'; end if;
  if p_campo = 'lida' then update public.wa_conversas set nao_lidas = 0 where jid = p_jid;
  elsif p_campo = 'arquivada' then update public.wa_conversas set arquivada = coalesce(p_valor, 'true')::boolean where jid = p_jid;
  elsif p_campo = 'fixada' then update public.wa_conversas set fixada = coalesce(p_valor, 'true')::boolean where jid = p_jid;
  elsif p_campo = 'cliente' then update public.wa_conversas set cliente_id = nullif(p_valor, '')::uuid where jid = p_jid;
  elsif p_campo = 'responsavel' then update public.wa_conversas set responsavel_id = nullif(p_valor, '')::uuid where jid = p_jid;
  elsif p_campo = 'sem_espera' then update public.wa_conversas set esperando_desde = null, aguardando_cliente_desde = null,
      vez = 'ninguem', vez_motivo = 'Marcado pela equipe como respondido', vez_avaliada_em = now() where jid = p_jid;
  elsif p_campo = 'nome' then
    v := left(btrim(coalesce(p_valor, '')), 80);
    if v = '' then
      -- volta ao nome do WhatsApp na próxima mensagem; por ora mostra o número
      update public.wa_conversas set nome_fixo = false, nome = split_part(jid, '@', 1) where jid = p_jid and tipo <> 'grupo';
      update public.wa_contatos set nome_fixo = false where jid = p_jid;
      update public.wa_conversas set nome_fixo = false where jid = p_jid and tipo = 'grupo';
    else
      update public.wa_conversas set nome = v, nome_fixo = true where jid = p_jid;
      -- contato: o nome também vale para as mensagens dele nos grupos
      if p_jid not like '%@g.us' then
        insert into public.wa_contatos(jid, nome, nome_fixo, atualizado_em) values (p_jid, v, true, now())
        on conflict (jid) do update set nome = excluded.nome, nome_fixo = true, atualizado_em = now();
        update public.wa_mensagens set autor_nome = v where autor_jid = p_jid and not de_mim;
      end if;
    end if;
  else raise exception 'Campo inválido.';
  end if;
end $function$;
