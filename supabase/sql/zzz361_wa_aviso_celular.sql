-- 4.69.0: aviso no celular quando um cliente espera resposta.
--   wa_assistente.push_espera_min : depois de quantos minutos sem resposta avisa (0 = desligado)
--   wa_assistente.push_para       : quem recebe (vazio = todos que veem o WhatsApp do B7)
--   wa_assistente.push_ultimo     : vez da checagem (sem cron: quem chega primeiro pega)
--   wa_conversas.push_avisado_em  : já avisou desta espera (não repete até o cliente esperar de novo)
alter table public.wa_assistente add column if not exists push_espera_min int not null default 15;
alter table public.wa_assistente add column if not exists push_para uuid[] not null default '{}';
alter table public.wa_assistente add column if not exists push_ultimo timestamptz;
alter table public.wa_conversas add column if not exists push_avisado_em timestamptz;

-- quem vê o WhatsApp do B7 (mesma regra de pode_ver_wa, para qualquer pessoa)
create or replace function public.wa_quem_ve_whatsapp()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id from public.perfis p
   where p.estado = 'ativa' and p.papel <> 'cliente'
     and (coalesce(p.eh_admin, false) or coalesce(public.eh_videomaker_elegivel(p.id), false))
$$;
revoke all on function public.wa_quem_ve_whatsapp() from public, anon, authenticated;
grant execute on function public.wa_quem_ve_whatsapp() to service_role;

-- grava o aviso: 1 evento por espera (a chave não deixa repetir) + 1 notificação por pessoa (o webhook manda o push)
create or replace function public.wa_avisar_espera(p_jid text, p_esperando timestamptz, p_client uuid, p_titulo text, p_mensagem text, p_link text, p_para uuid[])
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare ev uuid; n integer;
begin
  insert into public.eventos_dominio (tipo, chave, client_id, alvo_tipo, payload, processado_em)
  values ('whatsapp.esperando', 'wa.esperando:' || p_jid || ':' || to_char(p_esperando at time zone 'UTC', 'YYYYMMDDHH24MISS'), p_client, 'wa_conversa',
          jsonb_build_object('jid', p_jid, 'esperando_desde', p_esperando), now())
  on conflict (chave) do nothing
  returning id into ev;
  if ev is null then return 0; end if;
  insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link, dados)
  select ev, d, p_client, 'whatsapp.esperando', p_titulo, p_mensagem, p_link, jsonb_build_object('jid', p_jid)
    from unnest(p_para) d
   where exists (select 1 from public.perfis p where p.id = d and p.estado = 'ativa')
  on conflict (evento_id, destinatario_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.wa_avisar_espera(text, timestamptz, uuid, text, text, text, uuid[]) from public, anon, authenticated;
grant execute on function public.wa_avisar_espera(text, timestamptz, uuid, text, text, text, uuid[]) to service_role;
