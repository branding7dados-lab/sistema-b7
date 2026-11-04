# v4.9.1: "Corre pro Set!" mais claro e diretor novo

O Kevin disse: "tô achando o ambiente meio escuro, os obstáculos quase não dá pra ver… melhora o modelo do diretor que ele tá feião, além de estar atravessando as coisas".

## Luz e obstáculos (`js/jogo-corrida.js`)
- Exposição foi de 1,15 para 1,5. A luz do céu ficou mais forte (1,5), entrou uma luz ambiente, o fundo e a neblina passaram para roxo médio e o chão e a pista ficaram mais claros.
- **Tripé:** barra listrada amarela e preta, mais grossa, com pés prateados.
- **Varal:** barra branca bem acesa, com brilho rosa (no PC, com luz própria).
- **Case:** corpo lilás, bordas e quinas em ciano neon e fita de aviso amarela.
- **Marca vermelha no chão** na frente de todo obstáculo, para enxergar de longe.

## Diretor novo
- Modelo articulado: quadril, ombros e joelhos com pivô, então pernas e braços balançam de verdade.
- Detalhes: jaqueta roxa com camisa branca, lenço vermelho, cabeça com nariz, bigode, cabelo, óculos escuros redondos e boina com pino, mãos, sapatos e o megafone dourado apontado para a lâmpada.
- "DIRETOR" escrito nas costas, que é o lado visto pela câmera.
- Ele corre de frente para a lâmpada, segue a faixa dela com atraso, fica um pouco ao lado e menor (85%) para não tampar a jogadora.
- **Não atravessa mais nada:** os obstáculos que já passaram da lâmpada afundam no chão e somem antes de chegar onde o diretor corre.

## Conferência
- Partida automatizada no navegador (tutorial, tropeção com o diretor e fim da corrida), sem erros de JavaScript.
- `npm test` passou.
