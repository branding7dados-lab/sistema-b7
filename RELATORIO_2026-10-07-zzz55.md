# zzz55 — a abertura da zzp de volta

**Versão:** `2026-10-07-zzz55` · **Cache:** `roteiros-b7-v260`

Pedido do Kevin, literal: *"volta a animação que tava antes, sem ser nessa
atualização... a animação que eu quero é da versão zzp, mas é só a abertura
mesmo."*

## O que voltou

A abertura exatamente como estava no commit **`019f673`** — *"Abertura: retira
as tarjas de cinema (zzp)"*, de 03/10, que é o último estado da zzp. Copiada
como estava, sem retoque meu: a centelha nascendo no escuro, a lâmpada saindo
do desfoque GRANDE, a "carga" subindo por dentro do desenho, o filamento
piscando duas vezes, a ignição com clarão, flare anamórfico, dois anéis e os
raios girando, e então a marca assentando.

Três arquivos, só na parte da abertura:

| arquivo | o quê |
|---|---|
| `index.html` | a marcação da abertura, igual à da zzp |
| `styles/abertura.css` | os dois blocos de CSS da zzp (a abertura e a onda de luz da saída) |
| `js/app.js` | `ondaDeLuz` com o anel e os contornos, e o piso de 4,3 s / 0,95 s |

## O que NÃO voltou (de propósito)

Ele foi explícito: **"é só a abertura mesmo"**. Então continua tudo o que veio
depois e não é abertura:

- as telas de carregamento (a faixa de luz atravessando a página, zzz52);
- o morph entre módulos com View Transitions;
- a foto da tela ao voltar;
- as correções de desempenho (zzz51) e de segurança (zzz51);
- a barra de status pintada na cor do topo;
- a reavaliação do modo leve automático (zzz54) — que inclusive importa mais
  agora, para ninguém ficar preso em modo leve por uma lentidão já resolvida.

## O bug que eu cometi no meio do caminho

A primeira extração começou **uma linha depois** do `/*` que abre o comentário
da zzp. Resultado: o corpo do comentário virou texto solto no meio do CSS, o
`*/` perdido fechou o comentário errado, e a primeira regra depois dele —
`.b7-abertura{position:fixed;...}` — foi engolida pelo parser.

O efeito: a abertura ficava com **altura zero**, e tudo dentro dela colapsava.
Renderizei, vi o céu sem a marca, e fui atrás em vez de supor: uma sondagem do
estilo computado mostrou `.b7-abertura` com caixa `390x0` e `display:block`
onde deveria ser `flex`. Daí o diagnóstico foi imediato.

A extração agora **sobe até a linha que abre o comentário** e confere, antes de
gravar, que comentários e chaves estão balanceados nos dois blocos.

## O custo, dito na cara

A abertura da zzp anima `filter` e `clip-path` — as duas coisas que obrigam o
navegador a repintar a cada quadro. É exatamente o peso que eu tinha tirado na
zzz52. Medido com a CPU 6× estrangulada, duas corridas:

| | zzp (agora) | a minha (zzz53) |
|---|---|---|
| Abertura | **52,5 / 53,3 fps** | 60,2 / 60,3 fps |
| Carregamento | 59,2 / 57,9 fps | 60,3 fps |

São uns 7 fps a menos na abertura. **É a escolha dele, feita com o número na
mesa** — não um descuido.

Por isso eu **não apaguei** a verificação de propriedades caras do
`testes/abertura.test.mjs`: ela passou a valer só para o carregamento (que é
desenho meu) e, para a abertura, agora **relata** o custo no log do CI
(`10 propriedades caras em keyframes`), para que uma piora futura apareça em
vez de passar batido.

Suíte completa verde.
