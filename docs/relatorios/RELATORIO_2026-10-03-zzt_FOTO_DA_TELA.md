# Relatório — "foto da tela": voltar sem esqueleto (pacote zzt, 03/10)

Pedido: vídeo (Gravações → gravação → voltar) + "Ainda tá ficando assim…".

## O que o vídeo mostrou
A animação nova do cartão (zzs) estava no ar. O que sobrou de "cara de carregamento" era outra coisa: **toda tela busca os dados de novo ao abrir** e, enquanto isso, mostra o esqueleto cinza. Ao voltar para a lista, apareciam ~0,4 s de esqueleto, depois a lista surgia do topo e não onde você estava.

Achado extra no código: o comentário do `js/movimento.js` dizia que o ouvinte de `hashchange` rodava antes do roteador. **Não roda.** O roteador troca a tela num microtask logo depois do ouvinte dele, que foi registrado antes.

## O que mudou (`js/movimento.js`, bloco "FOTO DA TELA")
- **Ao sair de uma tela**, o app guarda uma foto dela: o HTML já desenhado e a posição da rolagem. Telas inteiras em esqueleto não entram, e são guardadas no máximo 24 telas, válidas por 15 min.
  - A foto é tirada no toque (clique em fase de captura) e no "voltar" do aparelho (`popstate`), sempre **antes** da navegação. A chave é a rota que a tela mostrava.
- **Ao voltar para uma tela já vista**, a foto aparece **na hora**, no lugar exato e na mesma rolagem.
  - A tela de verdade monta por baixo com os dados novos. Quando ela fica pronta (sem esqueleto), a foto sai num esmaecer de 140 ms, a rolagem é mantida e a tela nova não refaz a animação de entrada.
  - A foto não recebe toque e some em no máximo 2,5 s, aconteça o que acontecer.
- **Voltar do detalhe para a lista** (com foto): a lista já está lá, a câmera recua (de leve maior e desfocada para o normal) e o cartão de onde se veio pousa no lugar.
- **Abrir um detalhe já visitado:** o cartão cresce e revela a foto do detalhe logo em seguida, sem esperar o carregamento.
- Isso vale para **todas as telas do painel**, não só para as listas com cartão. Trocar de aba na barra de baixo e voltar também abre na hora.

Estilo: `.b7-foto` em `styles/global.css` (fixa, abaixo do topo e da barra, sem animações internas).

Nada de dados, regras ou banco.

## Testes
Chromium headless, 390×844, lista de 12 gravações simulada, rolada até 300 px; o roteador do teste mostra 600 ms de esqueleto antes da lista:
- **Primeira versão:** a foto não aparecia. Era o problema de ordem do roteador descrito acima, corrigido tirando a foto no toque e no `popstate`.
- **Segunda versão:** a foto da lista saía errada, com o conteúdo do detalhe. No `popstate` o endereço já mudou, então a chave passou a ser a rota que a tela mostrava.
- **Final:**
  - em 80 ms, a lista já aparece na mesma rolagem e o cartão "Gravação 6" está pousando;
  - em 250 e 450 ms, a lista continua estável enquanto a tela de verdade ainda está em esqueleto por baixo;
  - em 800 ms, a tela de verdade assume na rolagem 230;
  - sem erros.

**Não testado:** celular físico, dados reais e telas com gráfico em canvas (na foto, um canvas sai em branco até a tela real assumir).

---

# Ajuste zzu (03/10): abrir de dentro do cartão, sem repetição

Vídeo novo (Gravações → gravação → voltar → abrir de novo) + "Ainda tá meio estranho…". Com a foto no ar, sobravam dois problemas:
1. **Abrir algo já visto:** o detalhe já aparecia na hora, mas o fantasma do cartão voava **por cima** dele. Ficava um cartão flutuando no meio do detalhe.
2. **Voltar:** a lista desfocava, ficava nítida e desfocava de novo. A animação de entrada da tela de verdade rodava escondida sob a foto e reaparecia quando a foto saía.

O que mudou:
- **Tela já vista abre de dentro do cartão** (`abrirNaFoto`): a própria tela de destino se recorta a partir do retângulo do cartão e cresce até a tela inteira (`clip-path`, 420 ms, curva de mola). Por baixo, a lista que está saindo recua de leve. Nesse caso não há fantasma, e o detalhe reaberto começa do alto.
  - A primeira visita continua com o cartão que cresce e o brilho (zzs).
- **Sem repetição:** enquanto a foto está na tela, o painel fica com `b7-sem-entrada` (animações de entrada desligadas) até 400 ms depois de a foto sair.
- **Voltar sem desfoque:** só um assentar de escala (103% → 100%) e o pouso do cartão. O desfoque em tela cheia também pesava no celular.

Testes: Chromium headless, quadros congelados (`getAnimations` + `currentTime`):
- **Abrir a 40 ms:** detalhe recortado na faixa do cartão, com a lista atrás;
- **Abrir a 120–380 ms:** a tela inteira assume;
- **Voltar a 40, 160 e 320 ms:** lista assentando e cartão "Gravação 3" erguido com sombra, pousando;
- sem erros.

---

# Ajuste zzv (03/10): a troca só acontece com a tela parada

Vídeo novo (Edição de vídeo → demanda → voltar, várias vezes; depois Gravações) + "é necessário ficar recarregando assim toda hora que entro no card e saio?".

**Resposta à pergunta:** a busca dos dados é necessária, porque a equipe inteira mexe nas mesmas demandas e a lista precisa vir atualizada. Mas ela não precisa **aparecer**. O que aparecia no vídeo:
- **A tela real monta em etapas:** os contadores passam por "5 pendentes · 2 entregues" e "7 · 3" antes de "9 · 4", e os blocos chegam depois. A foto saía na primeira etapa sem esqueleto, então as etapas viravam piscadas.
- **A tela remonta uma segunda vez logo depois** (segunda busca ou tempo real). Como as entradas voltavam a valer 400 ms depois de a foto sair, a lista esmaecia de novo.

O que mudou (`js/movimento.js`):
- A foto só sai quando a tela real está pronta **e parada há 180 ms**, contando qualquer mudança no painel (`MutationObserver`). O limite subiu para 3 s.
- A troca é seca (60 ms): como a foto e a tela real são iguais e estão na mesma rolagem, um esmaecer só misturava as duas.
- As animações de entrada ficam desligadas por **1,5 s** depois de a foto sair, para cobrir a segunda remontagem.

Teste: Chromium headless, com um roteador simulado que monta a lista em três etapas (5, 7 e 9 pendentes, aos 400, 550 e 700 ms). O que ficou visível, quadro a quadro:
- em 19 ms, a foto "9 pendentes";
- em 967 ms, a tela real "9 pendentes";
- as etapas "5" e "7" nunca aparecem;
- sem erros.
