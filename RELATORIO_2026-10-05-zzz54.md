# zzz54 — por que a abertura estava pior no navegador do Kevin

**Versão:** `2026-10-05-zzz54` · **Cache:** `roteiros-b7-v259`

O Kevin disse que a animação no navegador dele está "uma merda" — diferente da
que eu mostrei. Não veio vídeo desta vez e este contêiner não alcança o site
publicado, então fui atrás pelo código. Achei a causa, e a culpa é minha em
dois níveis.

## A cadeia

1. O sistema mede a fluidez sozinho (`js/desempenho.js`) e, se achar o
   aparelho lento, **grava `b7_leve_auto='1'` no aparelho** e liga o
   `html.modo-leve`.
2. O sistema **esteve genuinamente lento** — era o `fotografar()` serializando
   o painel inteiro a cada toque, corrigido só na zzz51. O Kevin reclamou
   exatamente disso: *"tá travando bastante, e meu celular é muito bom por
   sinal"*.
3. Esse sinalizador **nunca mais saía sozinho**. Não havia nada que o
   reavaliasse depois de a causa ser consertada. O aparelho dele
   provavelmente está em modo leve até hoje por causa de um problema que não
   existe mais há três versões.
4. E eu tinha escrito, na zzz53:
   `html.modo-leve .ab-faisca{display:none}`.

Ou seja: **ele não vê faísca nenhuma.** Vê a lâmpada aparecer e encolher num
fundo vazio — justamente a parte "energia" da animação, que era o ponto da
direção que ele escolheu, removida no navegador dele.

## Os dois erros meus

**1. Esconder as faíscas no modo leve foi cautela mal colocada.** O modo leve
existe para matar `backdrop-filter` e `blur`, que repintam a tela a cada
quadro. Dez `div` de 4px animando `transform` e `opacity` por meio segundo não
são isso. Elas voltaram.

**2. A decisão automática de modo leve não tinha volta.** Agora cada correção
grande de desempenho avança uma marca (`b7_leve_rev`), e o sinalizador
automático é limpo uma vez — a medição recomeça do zero com o sistema já
consertado. **A escolha manual não é tocada**: quem foi em Configurações →
Desempenho e escolheu "leve" continua em leve. Só a decisão que o sistema
tomou sozinho é reavaliada.

## Conferido

Gravei a abertura **com `html.modo-leve` ligado**, que é o estado provável do
navegador dele: as faíscas aparecem.

Custo, CPU 6× estrangulada, duas corridas: abertura 60,2 e 60,3 fps;
carregamento 59,4 e 58,8 fps. Devolver as faíscas não custou nada mensurável.

Suíte completa verde (42 verificações).

## O que isto não explica

Se o problema dele não for a falta das faíscas, esta correção não resolve, e
eu continuo sem conseguir ver a tela dele: este contêiner não alcança
`branding7dados-lab.github.io` (a política de rede bloqueia), e nenhum vídeo
veio anexado desta vez. Pedi uma gravação.

## Anotado, não corrigido

A abertura depende de `index.html` e `styles/abertura.css` **casarem**. O
service worker guarda os dois, mas quem vinha de uma versão anterior à zzz52
não tinha `abertura.css` no cache: nessa única carga, o navegador podia servir
o `index.html` velho (do cache) com o CSS novo (da rede) — e aí a abertura sai
sem estilo nenhum. Some no recarregar seguinte. A correção de raiz é embutir o
CSS da abertura no próprio `index.html`, para que marcação e estilo nunca
viajem separados. Não fiz agora para não empilhar mudança grande enquanto
persigo um sintoma que ainda não consegui observar.
