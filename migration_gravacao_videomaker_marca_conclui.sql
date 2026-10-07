-- =====================================================================
-- VIDEOMAKER MARCA O QUE FOI GRAVADO E CONCLUI A GRAVAÇÃO (zzz65, 07/10/2026)
--
-- Pedido do Kevin: "o videomaker pode marcar se ele gravou" e "ele pode
-- marcar como concluída também".
--
-- Antes:
--   gravacao_item_marcar  → equipe, ou o videomaker RESPONSÁVEL pela gravação
--   gravacao_concluir     → só equipe (admin/coordenador)
-- Agora, nas duas: equipe ou QUALQUER videomaker (papel ou função extra
-- "videomaker" — public.sou_videomaker()).
--
-- Só a trava de entrada muda; o corpo das funções fica idêntico (o
-- histórico continua registrando quem marcou e quem concluiu).
-- Continua só da equipe: agendar/remarcar, cancelar, editar detalhes,
-- adicionar/editar/remover/mover itens.
-- Nenhuma política de RLS, tabela, coluna ou dado é alterado.
--
-- Idempotente. Se a trava esperada não for encontrada exatamente uma
-- vez, a migração para com erro em vez de alterar às cegas.
-- =====================================================================
do $$
declare
  par text[];
  def text;
  n int;
  pares text[][] := array[
    array['gravacao_item_marcar',
          'if not (public.sou_equipe() or coalesce(g.videomaker_id = auth.uid(), false)) then',
          'if not (public.sou_equipe() or public.sou_videomaker()) then'],
    array['gravacao_concluir',
          'if not public.sou_equipe() then raise exception',
          'if not (public.sou_equipe() or public.sou_videomaker()) then raise exception']
  ];
begin
  foreach par slice 1 in array pares loop
    select pg_get_functiondef(p.oid) into def
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = par[1];
    if def is null then raise exception 'Função % não encontrada.', par[1]; end if;
    if position(par[3] in def) > 0 then continue; end if;   -- já migrada
    n := (length(def) - length(replace(def, par[2], ''))) / length(par[2]);
    if n <> 1 then raise exception 'Função %: esperava 1 trava, achei %.', par[1], n; end if;
    execute replace(def, par[2], par[3]);
  end loop;
end $$;
