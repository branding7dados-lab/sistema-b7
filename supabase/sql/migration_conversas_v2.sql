-- =====================================================================
-- CONVERSAS v2 (zzz169) — responder a uma mensagem, reações com emoji e
-- editar a própria mensagem de texto.
--
-- Só ACRESCENTA: três colunas novas (anuláveis) em chat_mensagens e três
-- funções novas. Nada é apagado; as regras de leitura continuam as
-- mesmas ("só quem participa"). Toda escrita passa por função que
-- confere quem chama, como no resto do chat.
-- =====================================================================

alter table public.chat_mensagens add column if not exists resposta_id uuid
  references public.chat_mensagens(id) on delete set null;
alter table public.chat_mensagens add column if not exists editada_em timestamptz;
-- { "👍": ["perfil-id", ...], ... }
alter table public.chat_mensagens add column if not exists reacoes jsonb;

-- Marcar a PRÓPRIA mensagem recém-enviada como resposta a outra da mesma conversa
create or replace function public.chat_definir_resposta(p_mensagem uuid, p_resposta uuid)
returns public.chat_mensagens
language plpgsql
security definer
set search_path = public
as $$
declare v_msg public.chat_mensagens;
begin
  if auth.uid() is null then raise exception 'Sessão necessária.' using errcode = '42501'; end if;
  update public.chat_mensagens m set resposta_id = p_resposta
   where m.id = p_mensagem and m.autor_id = auth.uid() and m.apagada_em is null
     and m.created_at > now() - interval '10 minutes'
     and exists (select 1 from public.chat_mensagens r where r.id = p_resposta and r.conversa_id = m.conversa_id)
  returning * into v_msg;
  if v_msg.id is null then raise exception 'Não foi possível marcar a resposta.' using errcode = '42501'; end if;
  return v_msg;
end
$$;
revoke all on function public.chat_definir_resposta(uuid, uuid) from public, anon;
grant execute on function public.chat_definir_resposta(uuid, uuid) to authenticated;

-- Editar a PRÓPRIA mensagem de texto (até 24 h depois de enviada)
create or replace function public.chat_editar(p_mensagem uuid, p_texto text)
returns public.chat_mensagens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_msg public.chat_mensagens;
begin
  if auth.uid() is null then raise exception 'Sessão necessária.' using errcode = '42501'; end if;
  if v_texto is null then raise exception 'Mensagem vazia.'; end if;
  if char_length(v_texto) > 4000 then raise exception 'Mensagem longa demais.'; end if;
  update public.chat_mensagens set texto = v_texto, editada_em = now()
   where id = p_mensagem and autor_id = auth.uid() and tipo = 'texto' and apagada_em is null
     and comunicado_id is null and created_at > now() - interval '24 hours'
  returning * into v_msg;
  if v_msg.id is null then raise exception 'Só dá para editar a própria mensagem de texto (até 24 h).' using errcode = '42501'; end if;
  return v_msg;
end
$$;
revoke all on function public.chat_editar(uuid, text) from public, anon;
grant execute on function public.chat_editar(uuid, text) to authenticated;

-- Reagir (liga/desliga) com um emoji em mensagem de conversa de que participo
create or replace function public.chat_reagir(p_mensagem uuid, p_emoji text)
returns public.chat_mensagens
language plpgsql
security definer
set search_path = public
as $$
declare
  eu text := auth.uid()::text;
  v_msg public.chat_mensagens;
  v_r jsonb;
  v_lista jsonb;
begin
  if eu is null then raise exception 'Sessão necessária.' using errcode = '42501'; end if;
  if p_emoji is null or char_length(p_emoji) not between 1 and 16 then raise exception 'Reação inválida.'; end if;
  select * into v_msg from public.chat_mensagens where id = p_mensagem and apagada_em is null for update;
  if v_msg.id is null or not public.chat_participo(v_msg.conversa_id) then
    raise exception 'Você não participa desta conversa.' using errcode = '42501';
  end if;
  v_r := coalesce(v_msg.reacoes, '{}'::jsonb);
  v_lista := coalesce(v_r -> p_emoji, '[]'::jsonb);
  if v_lista ? eu then
    v_lista := (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements_text(v_lista) x where x <> eu);
  else
    -- uma reação por pessoa: tira das outras antes
    v_r := (select coalesce(jsonb_object_agg(k, (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements_text(v) x where x <> eu)), '{}'::jsonb)
              from jsonb_each(v_r) e(k, v));
    v_lista := coalesce(v_r -> p_emoji, '[]'::jsonb) || to_jsonb(eu);
  end if;
  v_r := jsonb_set(v_r, array[p_emoji], v_lista, true);
  v_r := (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(v_r) e(k, v) where jsonb_array_length(v) > 0);
  update public.chat_mensagens set reacoes = nullif(v_r, '{}'::jsonb) where id = p_mensagem returning * into v_msg;
  return v_msg;
end
$$;
revoke all on function public.chat_reagir(uuid, text) from public, anon;
grant execute on function public.chat_reagir(uuid, text) to authenticated;
