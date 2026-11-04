# v4.3.0: Estúdio em Clientes, cliente, Design, Aprovações, Portal e Prioridade

Pedido do Kevin ("faça!"): as telas que ainda faltavam da lista (1, 3, 5 e 6). Tudo foi feito em `styles/v4.css`, na seção "4.3". O HTML mudou só para receber os sobretítulos.

## Sobretítulos
- Clientes: "Carteira".
- Produção de Design: "Fila de criação" (nos dois cabeçalhos de `js/design.js`).
- Aprovações: "Com o cliente".

## Clientes e página do cliente
- Cartões de vidro com leve subida e borda magenta no hover. Busca em pílula.
- Página do cliente:
  - avatar maior, com brilho;
  - as seções viraram uma barra de cápsulas, e a aberta tem o degradê violeta→magenta. O sublinhado antigo e o indicador deslizante (`.cli-ind`) foram escondidos;
  - no celular, a barra continua rolando de lado.

## Design
- Colunas do quadro em vidro com borda, e cartões com borda magenta no hover.

## Aprovações e Portal do cliente
- Números maiores, itens em vidro.
- No Portal, itens, números e blocos em vidro, com os números na fonte dos títulos. Não há prints do Portal: ele exige uma sessão de cliente, que o simulador de prints não monta. As regras só mexem em sombra, fundo e cantos, e as telas internas que usam as mesmas peças foram conferidas.

## Prioridade (desenho A)
- Faixas com fundo na cor da faixa (vidro no escuro). A faixa Urgente tem brilho vermelho.
- O ponto do cabeçalho e o título ficaram na fonte dos títulos.
- A posição na fila (1º, 2º…) virou um ladrilho na cor da faixa, violeta na Normal.
- A barra de sugestões ficou em vidro âmbar.

## Conferência
- Prints do antes e depois nos temas escuro e claro e no celular.
- `npm test` passou.
