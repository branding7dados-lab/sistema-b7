-- 4.80.1: veredito da IA sobre quem deve a próxima resposta (lendo a conversa)
alter table public.wa_conversas
  add column if not exists vez text,
  add column if not exists vez_motivo text,
  add column if not exists vez_avaliada_em timestamptz;

-- "Não precisa responder" na Central também vale como veredito: ninguém deve resposta
create or replace function public.wa_conversa_marcar(p_jid text, p_campo text, p_valor text default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.pode_ver_wa() then raise exception 'Sem acesso às conversas.' using errcode = '42501'; end if;
  if p_campo = 'lida' then update public.wa_conversas set nao_lidas = 0 where jid = p_jid;
  elsif p_campo = 'arquivada' then update public.wa_conversas set arquivada = coalesce(p_valor, 'true')::boolean where jid = p_jid;
  elsif p_campo = 'fixada' then update public.wa_conversas set fixada = coalesce(p_valor, 'true')::boolean where jid = p_jid;
  elsif p_campo = 'cliente' then update public.wa_conversas set cliente_id = nullif(p_valor, '')::uuid where jid = p_jid;
  elsif p_campo = 'responsavel' then update public.wa_conversas set responsavel_id = nullif(p_valor, '')::uuid where jid = p_jid;
  elsif p_campo = 'sem_espera' then update public.wa_conversas set esperando_desde = null, aguardando_cliente_desde = null,
      vez = 'ninguem', vez_motivo = 'Marcado pela equipe como respondido', vez_avaliada_em = now() where jid = p_jid;
  else raise exception 'Campo inválido.';
  end if;
end $function$;
