-- =========================================================================
-- NOTIFICAÇÃO DE TESTE
-- Fecha o ciclo de "liguei o push, será que funciona?" sem precisar criar
-- demanda de mentira. Passa pelo caminho normal (eventos_dominio →
-- notificacoes → Database Webhook → Edge Function b7-push), então testa a
-- corrente inteira, não só um pedaço.
-- =========================================================================
create or replace function public.notificar_teste()
returns void language plpgsql security definer set search_path = public as $$
declare eu uuid := auth.uid(); evid uuid; p public.perfis%rowtype;
begin
  if eu is null then raise exception 'Sem sessão.' using errcode = '42501'; end if;
  select * into p from public.perfis where id = eu and estado = 'ativa';
  if not found then raise exception 'Perfil inativo.' using errcode = '42501'; end if;

  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, ator_id, ator_nome, ator_papel, payload)
  values ('teste.notificacao', 'teste.notificacao:' || eu || ':' || extract(epoch from clock_timestamp())::bigint,
          'perfil', eu, eu, p.nome, p.papel, '{}'::jsonb)
  returning id into evid;

  insert into public.notificacoes (evento_id, destinatario_id, tipo, titulo, mensagem, link)
  values (evid, eu, 'teste.notificacao',
          'Notificação de teste — está funcionando',
          'Se este aviso chegou no seu celular, o push está ligado neste aparelho.',
          '#/');

  update public.eventos_dominio set processado_em = now() where id = evid;
end;
$$;
revoke all on function public.notificar_teste() from public;
grant execute on function public.notificar_teste() to authenticated;
