# Relatório zzz65 — Videomaker marca o que gravou e conclui a gravação (07/10/2026)

**Versão:** `2026-10-07-zzz65` · **Cache:** `roteiros-b7-v270`

## O que foi pedido
"O videomaker pode marcar se ele gravou. Outra coisa, ele pode marcar como concluída também."

## Como estava
- Marcar item como gravado: a equipe, ou só o videomaker **responsável** pela gravação.
- Concluir a gravação: só a equipe (admin/coordenador).

## O que mudou

### Banco — `migration_gravacao_videomaker_marca_conclui.sql` (aplicada)
Só a trava de entrada de duas funções:
- `gravacao_item_marcar`: equipe ou **qualquer videomaker** (antes: equipe ou o responsável).
- `gravacao_concluir`: equipe ou **qualquer videomaker** (antes: só equipe).

"Videomaker" aqui é quem tem o papel ou a função extra de videomaker. O corpo das funções não mudou: o histórico continua registrando quem marcou e quem concluiu. Nenhuma política de RLS, tabela ou dado foi alterado.

Continua só da equipe: marcar/remarcar data, cancelar, editar detalhes e adicionar, editar, mover ou remover itens.

### Tela — `js/gravacao.js`
- Os quadradinhos de "gravado" ficam clicáveis para qualquer videomaker.
- O botão **Concluir gravação** aparece para o videomaker (no topo da gravação e na faixa "Todos os itens foram gravados").
- Ele continua sem ver Remarcar, Adicionar item, Editar detalhes e Cancelar.

## Testes realmente executados
**Banco** (transação desfeita ao final; nada ficou gravado):
- como videomaker (Kaique), numa gravação em que ele NÃO é o responsável: marcar item funcionou; concluir funcionou (status virou "Gravado"); cancelar foi barrado;
- como designer: marcar e concluir foram barrados.

**Tela** (app local, arquivo novo carregado, sessão de videomaker simulada, banco substituído por dados de exemplo, gravação com outro responsável):
- 1 botão "Concluir gravação"; nenhum "Remarcar"; nenhum "Adicionar item";
- os dois marcadores de item ativos; clicar no primeiro chamou a ação de marcar com o item certo;
- nenhum erro de script.

## Não testado
- Com a conta real do videomaker: marcar, desmarcar e concluir de verdade, e a confirmação "Concluir esta gravação?".
- Celular.
