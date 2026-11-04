# Pacote zzz9: morph "foco de câmera", telas sem caminhos e Usuários mais calmo

Versão `2026-10-04-zzz9`, cache do service worker `roteiros-b7-v214`.

## 1. Morph entre telas, refeito
A íris saindo do toque e o anel de luz pareciam estranhos, principalmente no modo "site para computador", onde a página nova às vezes surgia como um círculo branco.

O efeito novo imita uma câmera trocando de plano:
- a tela que sai perde o foco (blur de 6 px), recua para 97,5% e apaga em 0,26 s;
- a tela nova chega 16 px de baixo, levemente mais perto, e sai do desfoque para o nítido em 0,52 s, com uma curva suave no fim;
- topo e barra de baixo ficam parados;
- no modo leve não há desfoque (é o que pesa): só deslize e esmaecer.

O código do toque e do anel saiu de `js/app.js`, e o CSS está em `styles/global.css` (bloco MORPH zzz9).

## 2. Sem caminhos no topo das telas
O trecho "Central B7 / Clientes / …" saiu de todas as telas, no celular e no computador:
- **Telas de primeiro nível** (Configurações, Lixeira, Arquivados, Aprovações etc.) ficaram sem nada.
- **Telas internas** (uma demanda, uma linha editorial, Usuários etc.) ganharam um único botão discreto "‹ nível de cima", para não perder o caminho de volta.

A regra é feita só em CSS (bloco "SEM CAMINHOS" no fim de `styles/global.css`), sem mexer nas telas.

## 3. Usuários e acessos, mais calmo
- O cabeçalho segue o padrão das outras telas: título, linha com "N contas · X online agora" e o botão Novo usuário, que no celular vira um "+" quadrado.
- Os quatro blocos grandes de números viraram uma fileira de pílulas com contagem (Todas, Online, Equipe, Clientes, Desativadas). Elas filtram como antes.
- Os cartões viraram uma lista agrupada (Equipe, Clientes): uma linha por conta com foto redonda, ponto verde de online, nome, papel com ponto colorido, @usuário e último acesso, e o menu ⋯ à direita.
- As linhas entram em cascata curta. As ações continuam as mesmas: tocar na linha abre "Editar acesso".

## Testes
`npm test`: sintaxe, memória e as 19 telas mais a troca rápida, tudo verde. Conferido também em prints de 390 px (claro e escuro) e de 1280 px.
