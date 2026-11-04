# v3.5.0: mais de um videomaker na mesma gravação

Item 1 da lista de melhorias. É o pedido antigo do Kevin (viagem de Mucugê: "ao invés de poder só um videomaker participar de uma gravação, duas pessoas também possam").

## Banco (`migration_gravacao_mais_videomakers.sql`, aplicada)
- `gravacoes.videomakers_extra uuid[]`: quem grava junto com o responsável (`videomaker_id`). Uma regra impede repetir o responsável na lista.
- `gravacao_videomakers(g)`: responsável e extras, nessa ordem.
- `_grav_notificar_equipe`: avisa todos.
- Views `gravacoes_resumo` (com `videomakers_extra` e `videomakers_extra_nomes`) e `agenda_compromissos` (com `videomakers_extra`), com as colunas novas no fim.
- Funções que filtravam só pelo responsável passaram a incluir os extras. A troca foi feita só no trecho do filtro, e a migração pararia se algum trecho não fosse achado; todos foram achados:
  - `_notif_resumo_diario`, `widget_hoje`, `meu_dia`;
  - `agenda_verificar_lembretes`, `roteiros_notificar_status`, `_producao_alertas_lembretes`;
  - `gravacoes_ocorrencias_sincronizar` (remarcar e cancelar avisam todos).
- Gatilho `gravacoes_extra_avisar`: quem entra como extra recebe "Você vai gravar junto em …", e a mudança vai para o histórico da gravação.
- Testado com reversão: o admin marcou um videomaker extra, o nome apareceu na view e o aviso saiu.

## Telas
- **Editar gravação** (`js/gravacao.js`): campo "Quem grava junto" com os videomakers em pílulas. O responsável escolhido some da lista.
- **Detalhe da gravação:** "Quem grava: Fulano + Ciclano".
- **Lista de Gravações** (`js/dashboard.js`): "+1" ao lado do responsável (o nome aparece ao passar o mouse). O filtro por responsável acha também quem grava junto.
- **Meu dia** (`js/hoje.js`) e **Painel** (`js/painel.js`, `painelGravacoes`): a gravação aparece também para quem grava junto.

`npm test` passou.
