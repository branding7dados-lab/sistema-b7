# Relatório zzz281 — conserto da Retrospectiva

O Kevin abriu a Retrospectiva no programa do Windows e ela apareceu "bugada": o fundo escuro só cobria um retângulo no meio, o menu lateral e a direita ficavam visíveis, e as barrinhas de progresso saíram com a cor errada.

**Causa:** as classes da Retrospectiva começavam com `rt` (`.rt`, `.rt-n`, `.rt-sel`…), e a tela de Roteiros (`styles/dashboard.css`) já usa esses mesmos nomes. O estilo dos roteiros (largura máxima, margens, cores) passava por cima.

**Conserto:** todas as classes, animações e a classe do `<html>` da Retrospectiva passaram para o prefixo `rtv-` (`js/retrospectiva.js`, `styles/retro.css`). Conferido no navegador: a camada cobre a janela inteira (1600×900 de 1600×900) e as barrinhas aparecem separadas.

Testes: `npm test` passou, incluindo `retrospectiva.test.mjs`.
