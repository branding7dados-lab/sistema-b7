# zzz239: Configurações de cara nova (computador e celular)

Pedido do Kevin: "melhora a tela de configurações no pc e no celular… no pc tá com a mesma cara de celular".

## Computador (a partir de 1024px)
- A tela usa a largura toda (até 1240px), em duas colunas.
- **Esquerda**, fixa ao rolar:
  - cartão da conta, mais compacto;
  - busca;
  - seções em menu vertical, cada uma com a descrição do que tem dentro.
- **Direita**:
  - cabeçalho da seção aberta (ícone, título e descrição);
  - grupos lado a lado em duas colunas, como um mural, quando a coluna tem 780px ou mais. Isso é medido pela própria coluna (container query), não pela janela. Por isso um notebook com o menu aberto fica com uma coluna, e com o menu recolhido ou numa tela grande fica com duas.
- Com menos de 3 grupos na seção, a seção continua numa coluna só. Assim um grupo grande sozinho não deixa a outra coluna vazia.
- A pílula das seções desce na vertical (`moverPilula` agora entende coluna) e se reposiciona ao redimensionar a janela.
- Os seletores largos ficam limitados a 460px, para não esticarem de ponta a ponta.

## Celular
- Título e subtítulo menores; cartão da conta mais baixo, com os atalhos em linha (ícone + texto).
- As seções viraram pílulas que rolam de lado, com a escolhida colorida.

## Conferido
- Capturas no computador (tema escuro e claro, menu aberto e recolhido, abas Geral e Aparência) e no celular.
- `npm test` passou.
