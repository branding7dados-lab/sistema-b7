# Relatório — Resumo diário ligado por padrão

**Versão:** `2026-10-07-zzz86` · **Cache:** `roteiros-b7-v291`
**Pedido:** "pode decidir por mim aí" — sobre as duas decisões que ficaram abertas na zzz85.

## Decisão 1 — Aviso das 8h: liguei por padrão
O "Resumo diário" já existia, mas vinha desligado e quase ninguém recebia. Agora ele vale para toda a equipe que **nunca mexeu** nessa opção.

- **O que é:** um aviso às 8h com as demandas e peças da pessoa que vencem hoje e as gravações de amanhã. Para administrador e coordenador, também as publicações previstas para hoje e os vídeos em atraso na operação.
- **Só sai quando há algo:** dia sem nada, sem aviso.
- **Só equipe:** cliente do Portal não recebe.
- **Quem já escolheu continua como escolheu:** uma pessoa já tinha marcado essa opção; a escolha dela não muda.
- **Para desligar:** Perfil → Avisos → Resumo diário.

Por que liguei: é um aviso por dia, no máximo, e resolve o "resumo do dia" que você pediu sem criar nada novo.

## Decisão 2 — "Resumo do mês": não mexi
O documento já cobre planejado, publicado, artes, vídeos e gravações. Sem um pedido concreto do que falta, mexer seria chute. Fica como está.

## Banco de dados
`migration_resumo_diario_padrao.sql` (aplicada): a função `notif_pref_ativa` deixou de tratar `resumo_diario` como desligado quando a pessoa não escolheu. Mais nada.

## Arquivos alterados
`js/notificacoes.js` (a tela de Avisos passa a mostrar a chave ligada para quem não escolheu), `migration_resumo_diario_padrao.sql` (novo), `js/auth.js`, `sw.js`.

## Testes executados
Banco: a função foi lida antes e depois da mudança; confirmei quem recebe (equipe ativa, não cliente) e que só gera aviso quando há algo.

## Não testado
O aviso em si: ele roda às 8h. O primeiro envio com o padrão novo é amanhã de manhã; vale conferir se chegou.
