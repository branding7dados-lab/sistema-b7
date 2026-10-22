# Relatório zzz232 — Aberturas sem engasgo

Pedido do Kevin: "da uma olhada no codigo das animações, pq as vezes elas dão umas bugadas..."

## Como foi investigado
Cada estilo rodou num celular simulado (390×844, tela 2x), com o processador **4 vezes mais lento**, medindo o tempo de cada quadro e em que momento da abertura ele aconteceu. Também foram testados: sistema demorando 7 s para carregar, aba em segundo plano no meio e celular girado no meio.

## O que estava travando
| Estilo | Onde | Por quê |
|---|---|---|
| Streaming | 2,5–3,5 s (as faixas): **até 160 ms por quadro**, uns 6 quadros por segundo | as faixas eram desenhadas em resolução dupla (4x mais pixels) **e** o brilho do logo (`filter`) continuava animando com o logo ampliado 16x: o navegador redesenhava uma imagem enorme a cada quadro |
| Big bang | 0–1,5 s e a explosão | nebulosa com nuvens maiores que a tela, rastro em resolução dupla e os feixes de luz em canvas por cima dos raios do CSS |
| Hiperespaço | perto do salto | túnel e clarão pintando a tela inteira em resolução dupla |

## O que mudou
- As camadas em canvas (faixas, partículas e estrelas) desenham em **1x no celular** (1,25x no computador). São luzes borradas, então não se vê diferença.
- Streaming:
  - o brilho do logo (`abStCor`) termina em 1,4 s, antes do mergulho;
  - a entrada do logo não usa mais desfoque, só tamanho e transparência, que a placa de vídeo anima sozinha;
  - depois de sumir, o logo fica `visibility:hidden` e deixa de ser desenhado.
- Hiperespaço: o brilho (`abHiCor`) anima só até o logo assentar (2,5 s), não até o fim.
- Big bang:
  - nuvens da nebulosa com tamanho máximo;
  - menos partículas (celular 320, computador 760);
  - os feixes em canvas só no computador (no celular ficam os raios do CSS).
- Faixas: menos faixas (celular 48, computador 96). O clarão pinta só a área onde existe, e o centro é medido de novo quando o celular gira (antes as faixas ficavam fora do centro).

## Resultado (mesmo teste, processador 4x mais lento)
| Estilo | Quadro médio antes | depois | Quadros acima de 50 ms antes | depois |
|---|---|---|---|---|
| Streaming | 38,9 ms | 21,3 ms | 27 | 6 |
| Hiperespaço | 25,2 ms | 22,3 ms | 17 | 7 |
| Big bang | 37,3 ms | 27,9 ms | 45 | 16 |
| Clássica | 19,8 ms | 20,3 ms | 6 | 4 |

As faixas do Streaming passaram de 160 ms para 17 ms por quadro (60 quadros por segundo). Os quadros lentos que restam ficam no primeiro meio segundo, em todos os estilos, inclusive na Clássica: é o próprio sistema carregando.

## Cenários conferidos (os 4 estilos)
- Sistema lento: a abertura espera e mostra "Preparando…".
- Aba em segundo plano: sai assim que volta.
- Celular girado no meio: as camadas se ajustam.
- Sem sobras na tela e sem erros.
- `npm test` passa.

## Não testado
- Celular real (a simulação de processador lento é uma aproximação).
