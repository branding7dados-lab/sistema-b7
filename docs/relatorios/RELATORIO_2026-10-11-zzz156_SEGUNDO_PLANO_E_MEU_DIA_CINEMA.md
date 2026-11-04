# Relatório — app em segundo plano + "Meu dia" cinematográfico (zzz156, 11/10)

## 1. Som da abertura continuava depois de sair do app
O som da abertura é gerado pelo próprio sistema (Web Audio). O WebView do
Android não para esse áudio sozinho quando o app vai para segundo plano.

Agora (`js/abertura-som.js`): ao sair do app (ou trocar de aba), o som cala na
hora — o contexto de áudio é fechado, então o que estava programado não volta a
tocar ao reabrir. O app Android também avisa a página ao ir para segundo plano
(`MainActivity.onPause` → `B7Pausou()`), para garantir.

## 2. "Toda vez que abro, parece que abre do zero"
Quando o Android precisa de memória, ele fecha os apps em segundo plano; ao
voltar, o B7 carregava do começo, com a abertura completa (6 s) e na tela
inicial.

Agora (`index.html`): o app anota a hora e a tela em que a pessoa estava (ao
sair do app, a cada troca de tela e a cada minuto). Se ela volta em menos de 30
minutos:
- a abertura é a **curta** (menos de 1 s), não a completa;
- o app volta **na mesma tela** em que ela estava.
Depois de 30 minutos parado, abre normal (abertura completa e tela inicial).
Sair da conta apaga essas anotações.

Observação: o Android decide sozinho quando fechar um app em segundo plano; isso
não dá para impedir por dentro do app. O que muda é que, quando ele fecha, a
volta fica igual a "continuar de onde parou".

## 3. "Meu dia" mais cinematográfico
- **Vinheta de abertura** (~2 s, um toque pula): faixas pretas de cinema, um
  fio de luz que se abre, "Kevin, este é **o seu dia**" surgindo palavra por
  palavra, e a data.
- **Fundo vivo**: três luzes grandes que derivam devagar, com a cor de cada
  cena trocando em degradê suave; granulação de filme e vinheta nas bordas.
- **Troca de cena com foco**: a cena que sai desfoca e recua; a nova entra do
  lado certo, ganhando foco.
- **Títulos** sobem palavra por palavra; o rótulo de cima "abre" as letras.
- **Números contam** de 0 até o valor, e um brilho passa pelos cartões.
- **Listas** entram em cascata, com os logos dos clientes "pulando" no lugar.
- **Ao fechar**, as faixas de cinema se fecham sobre a tela.
- No modo leve (aparelho simples) ou com animações desligadas, fica a versão
  simples, sem desfoques nem movimento.

## Arquivos
- `js/abertura-som.js`, `index.html`, `MainActivity.java` (segundo plano).
- `js/hoje.js`, `styles/hoje.css` (cinema).
- `js/auth.js` (`2026-10-11-zzz156`), `sw.js` (`roteiros-b7-v361`).
