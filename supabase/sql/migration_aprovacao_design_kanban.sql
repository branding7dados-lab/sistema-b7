/* =====================================================================
   B7 APROVAÇÕES — CARTÃO DO KANBAN DA PEÇA DE DESIGN (pacote 2026-10-01-ac)

   O QUE ESTAVA ERRADO
   Ao processar um evento de aprovação de Design (aprovacoes.tipo =
   'design_versao'), `aprov_processar_evento` procurava o cartão do
   Kanban por tipo_vinculo = 'design_versao'. O cartão da peça é ligado
   por 'design_deliverable', então nunca era achado; e, em "enviada",
   "ajustes" e "recusada", a função tentava CRIAR um cartão com
   tipo_vinculo = 'design_versao' — valor que a regra
   kanban_vinculo_valido não aceita. O evento inteiro falhava (inclusive
   o aviso ao cliente) e ficava preso na fila. Aconteceu uma vez, em
   11/09/2026.

   A correção já estava escrita em migration_design_decisao_cliente.sql
   (item 4b), mas a função em produção estava sem ela.

   O QUE MUDA (duas linhas da função, nada mais)
     1. o cartão da peça de Design é procurado por 'design_deliverable';
     2. para Design, a função não cria cartão: a peça já tem o dela.
   Roteiro, linha editorial, conteúdo e semana: comportamento idêntico.
   A regra kanban_vinculo_valido NÃO muda.

   COMO É APLICADA
   A função é grande e foi reescrita no pacote de notificações. Para não
   arriscar uma cópia divergente, esta migration pega a definição que
   está no banco, troca os dois trechos e confere que as duas trocas
   aconteceram. Rodar de novo não faz nada (os trechos antigos já não
   existem).
   ===================================================================== */

do $$
declare
  atual text; nova text;
  achar_1 constant text := 'where tipo_vinculo = a.tipo and vinculo_id = a.alvo_id';
  trocar_1 constant text := 'where tipo_vinculo = case when a.tipo = ''design_versao'' then ''design_deliverable'' else a.tipo end and vinculo_id = a.alvo_id';
  achar_2 constant text := 'if n = 0 and ev.tipo in (''aprovacao.enviada''';
  trocar_2 constant text := 'if n = 0 and a.tipo <> ''design_versao'' and ev.tipo in (''aprovacao.enviada''';
begin
  atual := pg_get_functiondef('public.aprov_processar_evento(uuid)'::regprocedure);
  if strpos(atual, trocar_1) > 0 and strpos(atual, trocar_2) > 0 then
    raise notice 'aprov_processar_evento já está corrigida; nada a fazer.';
  else
    if strpos(atual, achar_1) = 0 or strpos(atual, achar_2) = 0 then
      raise exception 'aprov_processar_evento não está no formato esperado; a correção não foi aplicada.';
    end if;
    nova := replace(replace(atual, achar_1, trocar_1), achar_2, trocar_2);
    execute nova;
  end if;
end $$;

/* O envio preso desde 11/09/2026: a peça foi aprovada pelo cliente e
   finalizada no mesmo dia. Reprocessar agora mandaria ao cliente um
   "enviamos para sua aprovação" com três semanas de atraso. Fica
   encerrado, com o motivo registrado. */
update public.eventos_dominio
   set processado_em = now(),
       erro = 'encerrado sem reprocessar em 01/10/2026 (pacote ac): falha antiga do vínculo do Kanban; a peça foi aprovada e finalizada em 11/09/2026'
 where tipo = 'aprovacao.enviada' and alvo_tipo = 'design_versao'
   and processado_em is null and erro like '%kanban_vinculo_valido%';
