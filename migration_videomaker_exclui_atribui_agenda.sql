-- =====================================================================
-- VIDEOMAKER EXCLUI/ATRIBUI DEMANDA E MARCA/REMARCA GRAVAÇÃO (zzz66, 07/10/2026)
--
-- Pedido do Kevin: "videomaker também pode editar a demanda e excluir.
-- assim como remarcar gravação, marcar uma gravação".
--
-- Três funções passam a aceitar equipe OU videomaker (papel ou função
-- extra "videomaker" — public.sou_videomaker()):
--   video_excluir_demanda   excluir demanda de edição (vai para a lixeira lógica)
--   video_atribuir          trocar o responsável da demanda
--   gravacao_agendar        marcar e remarcar a data de uma gravação
--
-- Só a trava de entrada muda; o corpo das funções fica idêntico (o
-- histórico continua registrando quem fez).
-- Continua só da equipe: criar gravação, editar detalhes, cancelar,
-- itens da gravação, liberar no portal, pacotes, fechamento, gestão.
-- Nenhuma política de RLS, tabela, coluna ou dado é alterado.
--
-- Idempotente. Se a trava esperada não aparecer exatamente uma vez, a
-- migração para com erro em vez de alterar às cegas.
-- =====================================================================
do $$
declare
  par text[];
  def text;
  n int;
  pares text[][] := array[
    array['video_excluir_demanda', 'if not public.sou_equipe() then',
          'if not (public.sou_equipe() or public.sou_videomaker()) then'],
    array['video_atribuir', 'if not public.sou_equipe() then',
          'if not (public.sou_equipe() or public.sou_videomaker()) then'],
    array['gravacao_agendar', 'if not public.sou_equipe() then raise exception',
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
