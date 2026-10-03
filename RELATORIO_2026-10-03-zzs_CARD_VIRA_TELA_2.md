# Relatório — "card que vira tela" refeito e topo ligado à barra de status (pacote zzs, 03/10)

Pedidos:
- vídeo do Status semanal: "conserta a animação, tá feiona… parece que todo o sistema tá com isso de carregar a página";
- print da Edição de vídeo: "queria que ele [a barra de status] acompanhasse o blur".

## O que o vídeo mostrou
- **Ao abrir:** o cartão crescia, o conteúdo dele se apagava, e sobrava uma **tela branca vazia** parada até o detalhe carregar (~0,8 s).
- **Ao voltar:** outra tela vazia encolhia até o cartão.

Os dois pareciam carregamento, não animação.

## Abrir (`js/movimento.js`, `voarAbrindo`)
- O cartão cresce com uma curva de mola (420 ms), e **o conteúdo dele continua visível no alto**, como o cabeçalho da tela que abre.
- Enquanto o detalhe carrega, um **brilho de luz varre a tela** (`.b7-voo-brilho`).
- Quando o detalhe chega:
  - o fantasma se dissolve com zoom leve e desfoque;
  - o detalhe entra **vindo de dentro dele** (de 96,5% e desfocado para nítido), como um empurrão de câmera.
- O limite de espera subiu de 1,1 para 2,2 s, para não revelar o esqueleto no meio.

## Voltar (`voarVoltando`)
- **Sem tela vazia.** A lista entra como uma câmera recuando (de 103,5% e desfocada para o normal).
- O cartão de onde se veio **pousa**: vem de cima, maior e com sombra, assenta no lugar com uma curva de mola e recebe o anel de luz de antes.

## Barra de status e vidro do topo (`styles/nav.css`)
O Android não desfoca a barra de status, porque ela é cor sólida (a `theme-color` do pacote zzr). Por isso a faixa de cima do topo agora **nasce nessa mesma cor** e se dissolve no vidro até 65% da altura. Assim a barra e o topo viram uma peça só, sem a emenda entre o branco liso e o vidro colorido.

## Testes
Chromium headless, 390×844, tema claro, lista e detalhe simulados (o banco não responde no ambiente de teste):
- **Abrir:** cartão crescendo com o título no alto, depois o detalhe entrando de dentro;
- **Voltar:** lista recuando desfocada e cartão assentando;
- sem erros.

**Não testado:** celular físico e tempos reais de carregamento.
