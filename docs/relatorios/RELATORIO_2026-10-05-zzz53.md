# zzz53 — a abertura de novo, curta e com energia

**Versão:** `2026-10-05-zzz53` · **Cache:** `roteiros-b7-v258`

O Kevin viu a zzz52 no celular dele e odiou. Estava certo.

## O que estava errado (e por que eu não vi)

No vídeo dele, em tamanho real:

- o halo virou uma **mancha cinza-arroxeada** — o mesmo defeito que eu tinha
  criticado na versão anterior, reproduzido de outra forma;
- o risco de luz virou uma **barra magenta dura** atravessando a tela de ponta
  a ponta, com cara de defeito de renderização;
- a lâmpada "fria" (cinza, opacidade .26) parecia **imagem que não carregou**;
- a metade de baixo da tela era um **vazio preto** o tempo todo;
- e eram **4,3 segundos** disso, toda vez que o sistema abria.

**O erro foi de método.** Julguei por prints estáticos, ampliados, numa tela
grande — e ali aquilo parecia suave e cinematográfico. No celular, pequeno e
em movimento, virou mancha e barra. Eu tinha o vídeo da versão anterior e não
fiz o equivalente antes de publicar.

A correção de processo está no `scratchpad`: a conferência agora é **gravar a
abertura rodando num viewport de celular (412×915, sem ampliar) e olhar a
tira de quadros em escala real**. Foi o que mostrou, de imediato, que o brilho
estava desalinhado da lâmpada — coisa que nenhum print congelado tinha
revelado.

## A direção

Perguntei ao Kevin em vez de adivinhar pela terceira vez. Ele escolheu
**curta e com energia**.

| | o quê |
|---|---|
| 0,00–0,52 s | as faíscas voam de fora para dentro e somem na lâmpada |
| 0,06–0,28 s | a lâmpada aparece **já grande** (escala 2,05) e colorida |
| 0,40–0,74 s | o estouro: um clarão radial branco |
| 0,63–1,02 s | a lâmpada encolhe para o tamanho dela e desliza para o lugar |
| 0,80–1,14 s | a palavra sai de trás do símbolo |
| saída | o símbolo voa para o topo |

**1,25 s** no total, contra 4,3 s. A marca ocupa **86vw** contra 72vw.

O que mudou de conceito: a lâmpada **nasce grande e encolhe**, em vez de
nascer pequena e crescer. É isso que dá a sensação de energia — e resolve de
quebra o vazio preto, porque por meio segundo a marca domina a tela.

## O que saiu de vez

- **o risco horizontal** — era a barra que ele odiou. Não existe mais, nem na
  abertura nem na luz da saída;
- **a lâmpada fria** — a lâmpada já nasce colorida;
- **o halo elíptico gigante** — virou um brilho preso ao tamanho da marca, com
  núcleo quente.

## Bugs encontrados na gravação (que os prints escondiam)

**1. O brilho e o estouro ficavam ao lado da lâmpada.** Estavam ancorados em
`calc(50% + var(--ab-dx))`, a posição *inicial* do símbolo. Quando o símbolo
deslizava para a esquerda, a luz ficava para trás, em cima da palavra.

Primeira tentativa de conserto: pôr as luzes *dentro* do símbolo, para
herdarem o movimento dele. Mas aí herdavam também a **escala** — e com a
lâmpada nascendo em escala 2, a luz cobria a tela inteira. A solução é
`.ab-luzes`, um invólucro que faz só o deslocamento (mesma curva do símbolo),
com cada luz cuidando da própria escala.

**2. A palavra entrava enquanto a lâmpada ainda estava grande** e as duas se
atropelavam. Passou de 0,62 s para 0,80 s, depois do deslize.

**3. O primeiro quadro da tela era branco.** Nenhuma cor de fundo era pintada
antes de `global.css` carregar. Agora há um `<style>` de quatro linhas no
`<head>`, logo depois do script que aplica o tema.

**4. `.ab-branca` quase virou regressão.** Eu tinha removido o PNG branco do
símbolo junto com a "lâmpada fria" — mas ele não era só isso: `voarLogo` o usa
para a lâmpada colorida virar branca **em voo**, quando o destino é a logo
branca do topo (tema escuro). Sem ele, a lâmpada pousava colorida sobre um
destino branco. Voltou ao markup, invisível, só para o voo.

## Custo

Com a CPU estrangulada 6×, três corridas:

| | fps | travadas |
|---|---|---|
| Abertura | 59,7 · 60,0 · 60,2 | 1 · 0 · 0 |
| Carregamento | 59,1 · 59,8 · 59,8 | 0 · 0 · 0 |

Uma observação honesta sobre a medição: o número de **"pior quadro" é
ruidoso** — variou de 16,8 ms a 66,7 ms entre corridas do *mesmo* código. Não
dá para tirar conclusão dele isoladamente; o fps, que é estável, é o número
que vale. Na zzz52 eu citei o pior quadro como se fosse estável, e não era.

O teste `testes/abertura.test.mjs` continua cobrando que nenhum keyframe mexa
em propriedade cara, que "menos movimento" não anime nada, e que o símbolo
termine em transform identidade. Treze verificações, todas passando.
