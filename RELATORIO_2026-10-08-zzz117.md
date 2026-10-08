# Relatório — Barra lateral menos transparente

**Versão:** `2026-10-08-zzz117` · **Cache:** `roteiros-b7-v322`
**Relato:** "só achei que a sidebar ficou muito transparente" (no print, sobre o fundo claro, ela ficava cinza-arroxeada e lavada, em vez de escura).

## O que mudou
- O vidro da barra passou de cerca de **80% para 95% de opacidade**. Sobre o fundo claro do sistema ela volta a ser escura de verdade, e os nomes dos destinos ganham contraste.
- Os reflexos roxo (no alto) e magenta (embaixo) ficaram um pouco **mais contidos**, para não clarearem o conjunto.
- O desfoque, os cantos, a borda, a cápsula do item ativo e a transição não mudaram.

## Arquivos alterados
`styles/nav.css`, `js/auth.js` (versão), `sw.js` (cache).

## Testes executados
Conferi no arquivo que os valores novos entraram.

## Não testado
Não vi em tela: é um ajuste de dois números de opacidade. Se ainda estiver transparente, ou se agora ficou escura demais e perdeu a cara de vidro, é só dizer para que lado ir.
