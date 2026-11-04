# Relatório zzz283 — topo do Panorama no celular

No app Android, o topo do Panorama quebrou: o nome do mês ficou uma letra por linha e os botões ficaram espremidos dentro de uma pílula enorme.

**Causa:** o botão "✨ Retrospectiva" (zzz280) entrou dentro do seletor de mês, junto com "Este mês" e "Relatório do mês". No celular o seletor ocupa a largura toda e o nome do mês encolhe (`flex:1; min-width:0`), então três botões tiraram todo o espaço dele.

**Conserto** (`js/panorama.js`, `styles/panorama.css`): "Relatório do mês" e "Retrospectiva" foram para um grupo próprio (`.pan-acoes`). No celular esse grupo fica numa linha logo abaixo do seletor, com os dois botões dividindo a largura. Os botões não quebram mais o texto (`white-space:nowrap`).

Conferido em 412 px (celular) e 1366 px (PC). `npm test` passou.
