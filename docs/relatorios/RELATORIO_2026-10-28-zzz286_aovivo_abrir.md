# Relatório zzz286 — Equipe ao vivo: o botão abria o Panorama

Bug: clicar em "Equipe ao vivo" levava para o Panorama em vez de abrir o painel.

Causa: o `onclick` do item (que é um item de ação, `href="#"`, não navega) tinha sido colocado dentro de `ligarDicas()` em `js/nav.js` — função que, pelo próprio comentário (zzz48), **não é chamada**. Sem handler, o link `href="#"` caía na home (Panorama).

Conserto: o handler passou para dentro de `montarLateral()`, que é a função que realmente monta a barra. Os caminhos do "Mais" (celular) e do flyout da barra recolhida já estavam certos; o que faltava era a lateral expandida.

Conferido no navegador (PC e celular): clicar mantém a rota atual e abre o painel "Equipe ao vivo". `npm test` passou.
