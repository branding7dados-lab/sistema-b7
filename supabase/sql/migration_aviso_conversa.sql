-- zzz297: aviso de conversa igual ao do WhatsApp (Responder, Marcar como
-- lida e Silenciar direto na notificação, sem abrir o B7).
--
-- A notificação não tem sessão: quem fala com o banco é a função b7-push,
-- depois de conferir a assinatura (HMAC) que foi junto no aviso — ela vale
-- só para aquela pessoa e aquela conversa, por 7 dias. Por isso estas
-- funções só podem ser chamadas pelo servidor (service_role).

alter table public.chat_participantes add column if not exists silenciada_ate timestamptz;

-- responder: a mesma chat_enviar de sempre (participação, freio, avisos),
-- como se a própria pessoa tivesse enviado
create or replace function public.chat_enviar_como(p_autor uuid, p_conversa uuid, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v public.chat_mensagens;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_autor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_autor::text, true);
  v := public.chat_enviar(p_conversa, 'texto', p_texto, null);
  return v.id;
end
$$;
revoke all on function public.chat_enviar_como(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.chat_enviar_como(uuid, uuid, text) to service_role;

-- marcar como lida (também tira os avisos dela das não lidas)
create or replace function public.chat_marcar_lida_como(p_perfil uuid, p_conversa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_perfil, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_perfil::text, true);
  perform public.chat_marcar_lida(p_conversa);
end
$$;
revoke all on function public.chat_marcar_lida_como(uuid, uuid) from public, anon, authenticated;
grant execute on function public.chat_marcar_lida_como(uuid, uuid) to service_role;

-- silenciar: os avisos desta conversa param de tocar por um tempo (ficam no sino)
create or replace function public.chat_silenciar_como(p_perfil uuid, p_conversa uuid, p_horas integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.chat_participantes
     set silenciada_ate = case when coalesce(p_horas, 0) <= 0 then null
                               else now() + make_interval(hours => least(p_horas, 24 * 365)) end
   where conversa_id = p_conversa and perfil_id = p_perfil;
$$;
revoke all on function public.chat_silenciar_como(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.chat_silenciar_como(uuid, uuid, integer) to service_role;
