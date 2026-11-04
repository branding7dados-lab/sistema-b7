# Relatório 2026-10-01-ad — Linha editorial no celular: cartões estourando a largura

> **Situação (01/10/2026).** Corrigido e publicado, versão `2026-10-01-ad`. Só CSS. Testado numa página local em largura de celular; **não testei no seu aparelho**.

## O problema

Na Visão geral da linha editorial, no celular, os cartões ficavam mais largos que a tela: títulos e texto do objetivo cortados à direita, barras saindo do cartão.

## A causa

No celular, a grade da tela passa a ter uma coluna só, declarada como `1fr`. Em CSS, `1fr` nunca fica menor que o conteúdo mais largo que não quebra. Os títulos em "Criativos do mês" e "Próximos conteúdos" são de uma linha só, com reticências; o mais comprido deles ditava a largura da coluna inteira, e todos os cartões cresciam junto.

No computador a mesma grade já usava `minmax(0, 1fr)`, que permite encolher. Faltava nas regras de tela pequena.

## A correção

`styles/dashboard.css`, três regras: `.colunas` e `.apoio` (em tablet e em celular) passam a usar `minmax(0, 1fr)`.

Essas duas classes são da grade comum do sistema, então a correção vale para qualquer tela que as use (Central, cliente, linha editorial), não só para a que você mandou.

## Arquivos

- `styles/dashboard.css`
- `js/auth.js` (versão `2026-10-01-ad`), `sw.js` (cache `v127`)

## Testes executados

Página local com o HTML da Visão geral e os CSS reais do sistema, com um título longo e o texto de objetivo:

- **375 px, regra antiga:** cartão mais largo com 653 px, estourando a tela (o problema reproduzido);
- **375 px, corrigido:** cartão mais largo com 347 px, nada passa da borda, títulos com reticências, o texto do objetivo quebra dentro do cartão;
- **820 px (tablet):** nada estoura;
- **1366 px (computador):** grade igual à de antes (coluna principal + 328 px).

**Não testado:** a tela real com os dados da AutoEscola Sudoeste, nem o seu Android. As abas Estratégia, Criativos e Postagens não foram conferidas neste pacote.

## Observação

Com uma métrica só, o cartão "12 conteúdos" ocupa meia largura, porque a grade de métricas no celular tem duas colunas. Não mexi; se preferir que ele ocupe a largura toda quando estiver sozinho, é um ajuste pequeno.
