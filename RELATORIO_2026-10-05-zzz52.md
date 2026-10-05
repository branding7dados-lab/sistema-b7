# zzz52 — abertura nova e telas de carregamento novas

**Versão:** `2026-10-05-zzz52` · **Cache:** `roteiros-b7-v257`

Pedido do Kevin: *"muda total, deixa todas cinematográficas e lindas. Mas sem
deixar pesado, quero muito bem animado e revise para que não tenha bugs."*

A parte "linda" se julga com o olho. A parte **"sem deixar pesado" tem regra
objetiva**, e foi medida antes e depois.

---

## Medição, não opinião

Chromium com a CPU estrangulada **6×** (celular mediano), amostrando cada
quadro:

| | antes | depois |
|---|---|---|
| Abertura — fps | 57,0 | **60,2** |
| Abertura — pior quadro | 50,1 ms | **16,8 ms** |
| Abertura — quadros travados (>50 ms) | 1 | **0** |
| Carregamento — fps | 59,6 | **60,3** |
| Carregamento — pior quadro | 33,4 ms | **16,8 ms** |
| Carregamento — quadros travados | 0 | **0** |

Sob estresse de **10×** a abertura seguiu em 60,1 fps e o carregamento em
58,5 fps, ambos sem travada.

A abertura passou de **18 elementos animados para 7**.

---

## 1. A abertura: "acende"

Reescrita inteira. O conceito agora lê numa frase: **a luz acende, e a marca
nasce dela.**

| | o quê |
|---|---|
| 0,10–0,60 s | um risco de luz abre do centro, como lente anamórfica |
| 0,50–1,25 s | o risco vira uma poça de luz e revela a lâmpada **fria** |
| 1,25–1,95 s | ignição: a lâmpada fria vira colorida, o halo pulsa |
| 1,95–2,70 s | o símbolo desliza para o lugar e a palavra sai de trás dele |
| 2,70–4,30 s | deriva lenta de câmera, o halo respirando |
| saída | tudo sobe, a luz atravessa, o sistema assenta por baixo |

O "acender" é um **cross-fade entre dois PNGs que já existiam**
(`symbol-white` → `symbol-color`): opacidade pura, zero filtro. Era o jeito
mais bonito **e** o mais barato ao mesmo tempo.

### Onde estava o peso

- **o rack-focus da saída** animava `filter: blur(14px)` sobre o painel
  inteiro, a cada quadro. Virou posição e opacidade;
- **camadas de tela cheia com `mix-blend-mode`** (o "vazamento de luz"),
  que obrigam o compositor a ler de volta o que já desenhou. Saíram;
- **dezoito peças animadas**, muitas sobrepostas e invisíveis umas sob as
  outras. São sete.

### Onde estava a bagunça

A abertura morava em **três pedaços espalhados pelo `global.css`** — a
abertura, a "onda de luz" da saída e um bloco "cinema 2" no fim do arquivo —
cada um corrigindo o anterior sem apagá-lo. Agora é um arquivo só:
`styles/abertura.css`. O `global.css` encolheu de 2.403 para 1.999 linhas.

Também saíram os **números mágicos**: peças soltas posicionadas com
`top:calc(50% - 6vh + var(--ab-h)/2 + 42px)`, que só batiam por sorte. O palco
e a espera são uma coluna de flexbox, e o risco mora **dentro** do palco — fica
na linha do meio da marca em qualquer tela. A luz da saída também passou a
**medir** o palco em vez de repetir a conta do CSS à mão (as duas contas já
tinham saído do lugar uma da outra).

---

## 2. As telas de carregamento: a tela se materializa

Havia **três implementações empilhadas**, escritas em épocas diferentes, no
mesmo arquivo:

1. um brilho de `background-position` — repintava o fundo de cada bloco a
   cada quadro;
2. um pulso de opacidade, que substituiu o primeiro sem apagá-lo;
3. uma onda em pseudo-elemento, que substituiu os dois com `animation:none`.

Quem lesse o arquivo não tinha como saber qual estava valendo. **Agora é uma.**

Cada peça **sobe uma vez** ao aparecer, e uma **faixa de luz atravessa a
página na diagonal**, peça por peça — lê como uma luz só cruzando a tela, em
vez de vinte blocos piscando cada um por si.

O atraso de cada peça vem de `--esq-d`, um índice que `js/ui.js` escreve na
ordem em que desenha. Antes eram degraus de `:nth-child` que davam o mesmo
atraso para blocos distantes. Os esqueletos dos Painéis, que montam o HTML por
conta própria, também passaram a escalonar.

---

## Bugs encontrados e corrigidos no caminho

**1. `--d` é o token de densidade do sistema.** Eu tinha escolhido `--d` como
índice do escalonamento. Só que `:root{--d:1}` e
`[data-densidade="compacta"]{--d:.78}` — é a escala de densidade do design
system, e variáveis CSS são **herdadas**. Escrever `style="--d:7"` num bloco
mudaria a densidade dele e de tudo dentro dele. Renomeado para `--esq-d`.
(`js/painel.js` já usava `--d` para outras duas coisas, uma delas com unidade
de tempo — a colisão não era hipotética.)

**2. Em "menos movimento", o risco de luz virava um traço permanente**
cortando o logo ao meio: parado, ele não faz sentido nenhum. Agora some.

**3. A versão curta estourava o tempo.** O risco durava 1 s, mas a curta tem
piso de 950 ms (`MINIMO_ABERTURA_MS`): era cortado no meio do movimento.

**4. `class="esq"` também significa "lado esquerdo"** nos arquivos de
impressão (`print.js`, `slides.js`, `doc-semana.js`, `resumo-mes.js`). Conferi
que as regras novas são escopadas em `.esqueleto-tela` e que o detector de
esqueleto do `movimento.js` (`i.esq`) não pega um `<div class="esq">` de
impressão. Nada de impressão foi afetado.

---

## Teste novo: `testes/abertura.test.mjs`

Treze verificações. As que importam:

- **nenhum `@keyframes` da abertura ou do esqueleto mexe em propriedade
  cara** — só `transform` e `opacity`. É a garantia do "sem deixar pesado",
  virada em regra que o CI cobra;
- **no fim da abertura o símbolo e a marca estão em transform identidade** —
  o voo do logo desliga a animação e parte daí, então um quadro final
  deslocado vira um salto na tela;
- **com "menos movimento", a abertura não anima nada** (0 animações);
- **`--esq-d`, e não `--d`**, escalona o esqueleto;
- **depois do arranque não sobra camada nem classe presa**, e nenhuma
  animação da abertura segue rodando.

**A suíte foi provada**: sabotei três coisas de propósito — animar `filter`,
deixar o símbolo terminar deslocado, e voltar a usar `--d` — e o teste
reprovou nas três, voltando a passar depois de desfazer.

Uma coisa que o teste me ensinou e eu teria errado sozinho: a primeira versão
cobrava "nenhuma animação rodando depois do arranque" e reprovava. Fui ver: as
três que rodavam eram `loginFlutua` e `loginRastro`, **decorações da tela de
login**, infinitas de propósito e sem relação com a abertura. A asserção é que
estava errada, não o sistema.

---

## Fora de escopo, mas anotado

O verificador de propriedades caras, rodado sobre o `global.css` inteiro,
acusa três animações antigas que não são da abertura nem do carregamento:
`b7MarcaRespira` (anima `filter`, **infinitamente**, na marca d'água da tela
vazia), `kbAbre` (anima `height`) e `b7Assenta` (anima `box-shadow`). Não
mexi: não é o que foi pedido. Mas a primeira é a que eu olharia primeiro.
