# Relatório — Bordas claras na tela quando uma janela abre

**Versão:** `2026-10-07-zzz90` · **Cache:** `roteiros-b7-v295`
**Problema relatado:** ao abrir qualquer janela (ex.: "Descartar esta demanda?"), as bordas da tela ficam brancas — visível em volta da barra lateral escura.

## Causa provável
No computador, a janela desfoca o que está atrás. Na beirada da tela, o desfoque mistura a imagem com "o que existe fora dela", que é a cor de fundo da página — clara. O resultado é uma moldura esbranquiçada, que chama atenção justamente onde a tela é escura (a barra lateral).

## O que mudou
Enquanto houver uma janela aberta, o fundo da página passa a ser escuro, da cor da barra lateral. Assim a beirada mistura com escuro e some debaixo do véu, em vez de virar moldura branca. Vale só onde o desfoque existe (tela grande com mouse); no celular nada muda. Ao fechar a janela, o fundo volta ao normal.

É uma linha de estilo; nenhuma tela ou regra foi alterada.

## Arquivos alterados
`styles/global.css`, `js/auth.js` (versão), `sw.js` (cache).

## Testes executados
Conferi no app local que a regra é aceita pelo navegador e que só entra na condição certa (tela grande com mouse).

## NÃO testado — precisa da conferência do Kevin
**Não consegui reproduzir a borda clara**: o navegador de teste não tem mouse, então o desfoque nem é aplicado nele. A correção foi feita pela causa provável, sem eu ver o antes e o depois.

Depois de atualizar, abra qualquer janela e olhe as bordas da barra lateral. Se a moldura clara continuar, a causa é outra e o próximo passo é trocar o desfoque do fundo por um véu sem desfoque nas bordas.
