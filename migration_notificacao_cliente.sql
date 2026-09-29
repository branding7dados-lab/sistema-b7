-- =========================================================================
-- CLIENTE NA NOTIFICAÇÃO — nome no título e logo como ícone
--
-- Ideia central: nada de desnormalizar. Todas as funções que criam
-- notificação (vídeo, design, aprovações, agenda) já gravam `client_id`
-- (943 das 956 notificações existentes têm), então nome e logo vêm por
-- JOIN na LEITURA. Nenhuma função de notificação precisou ser reescrita.
--
-- Quem consome:
--   • o sino (js/notificacoes.js) lê desta view e desenha a logo;
--   • a Edge Function b7-push busca o cliente pelo client_id do record e
--     manda `cliente` e `logo` no payload do push;
--   • sw.js usa a logo como `icon` e põe o cliente no título do aviso.
-- =========================================================================

create or replace view public.notificacoes_resumo
with (security_invoker = true) as
select
  n.id, n.evento_id, n.destinatario_id, n.client_id, n.tipo,
  n.titulo, n.mensagem, n.link, n.lida_em, n.created_at,
  c.nome     as cliente_nome,
  c.logo_url as cliente_logo_url
from public.notificacoes n
left join public.clientes c on c.id = n.client_id;

grant select on public.notificacoes_resumo to authenticated;

-- A notificação de teste passa a sair com um cliente de verdade (preferindo
-- um que tenha logo), pra conferir de uma vez o nome no título e a logo
-- como ícone.
create or replace function public.notificar_teste()
returns void language plpgsql security definer set search_path = public as $$
declare eu uuid := auth.uid(); evid uuid; p public.perfis%rowtype; cli public.clientes%rowtype;
begin
  if eu is null then raise exception 'Sem sessão.' using errcode = '42501'; end if;
  select * into p from public.perfis where id = eu and estado = 'ativa';
  if not found then raise exception 'Perfil inativo.' using errcode = '42501'; end if;

  select * into cli from public.clientes
   where deleted_at is null and logo_url is not null
   order by (nome ilike 'branding7%') desc, nome
   limit 1;

  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
  values ('teste.notificacao', 'teste.notificacao:' || eu || ':' || extract(epoch from clock_timestamp())::bigint,
          'perfil', eu, cli.id, eu, p.nome, p.papel, '{}'::jsonb)
  returning id into evid;

  insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
  values (evid, eu, cli.id, 'teste.notificacao',
          'Notificação de teste — está funcionando',
          case when cli.id is null
               then 'Se este aviso chegou no seu celular, o push está ligado neste aparelho.'
               else 'Se este aviso chegou no seu celular, o push está ligado. O nome e a logo acima são de ' ||
                    cli.nome || ', só para mostrar como fica um aviso de cliente.' end,
          '#/');

  update public.eventos_dominio set processado_em = now() where id = evid;
end;
$$;
revoke all on function public.notificar_teste() from public;
grant execute on function public.notificar_teste() to authenticated;
