# zzz50 — a abertura sem os enfeites que sujavam a luz

**Versão:** `2026-10-05-zzz50` · **Cache:** `roteiros-b7-v255`

## O que o Kevin viu

Gravação de tela da abertura ("Ver abertura", Configurações → Aparência),
celular, tema escuro. Três coisas apareceram, e nenhuma delas era luz:

1. **Dois anéis de contorno** (`.ab-onda` e `.ab-onda.dois`) crescendo a partir
   da lâmpada. Círculo de borda dura de 1,5px que cresce lê como ícone de
   carregando, não como uma onda de luz.
2. **Os raios** (`.ab-raios`) ficavam **2,2s** no ar, fortes e com feixes
   estreitos demais — um carimbo de brilho de banco de imagem. Pior: eles são
   ancorados no centro da **tela**, mas aos 3,28s o símbolo recua para abrir
   espaço para a palavra "Branding7". Nos últimos 0,8s os raios continuavam
   convergindo para um ponto onde não havia mais nada.
3. **Cinco bolas de bokeh** (`.ab-bokeh`) paradas em `.55` de opacidade ao
   lado da marca pelo resto da abertura. Num fundo quase preto elas não leem
   como luz fora de foco — leem como sujeira na lente.

Investigando os quadros renderizados apareceu uma quarta, que eu não tinha
notado no vídeo: o `.ab-ceu:after`, um `conic-gradient` girando. Sobre o fundo
quase preto as faixas dele viravam **cunhas cinzas de borda dura**, e uma delas
descia em cima da marca como fumaça. Isolei camada por camada (`isolar.mjs`)
para confirmar que era essa e não a `.ab-chave` nem o `.ab-horizonte`.

## O que mudou

| Peça | Antes | Agora |
|---|---|---|
| `.ab-onda` ×2 | anéis de borda dura, scale .45 → 3.2 | **removidos** (markup + CSS) |
| `.ab-bokeh` ×5 | bolas paradas em .55 por 3,2s | **removidas** (markup + CSS) |
| `.ab-raios` | 2,2s · feixe a cada 18° · alpha .16 · máscara até 42% | 1,1s · feixe a cada 34° · alpha .07 · máscara oca no meio, até 30% |
| `.ab-ceu:after` | `conic-gradient` girando 360° em 22s | dois halos radiais nos cantos, deriva suave de 3% |

Os raios agora **morrem em 1,1s**, ou seja aos 3,0s — antes de a palavra entrar
aos 3,28s. O desalinhamento do final sumiu por construção, não por remendo.

## O que foi mantido de propósito

`.ab-bloom` (o halo macio), `.ab-flare` (a linha anamórfica de lente),
`.ab-clarao` (o estouro da ignição), `.ab-chave` (o feixe diagonal que cruza),
`.ab-grao`, `.ab-horizonte` e `.ab-vinheta`. Esses são luz de verdade e são o
que sobra de cinematográfico na abertura.

## Como foi conferido

- `cena.mjs` — congela cada animação em instantes exatos
  (`getAnimations()` → `pause()` + `currentTime`) e fotografa. Comparação
  antes/depois em 1950, 2400, 2800, 3400, 4100 e 4600 ms.
- `isolar.mjs` — esconde uma camada por vez no mesmo instante, para achar a
  responsável pela cunha cinza em vez de chutar.
- `curta.mjs` — a variante curta (`html.ab-curta`), que também usava
  `.ab-onda`, renderizada sem erro de página.
- `testes/` — suíte completa verde.

Nenhuma regra órfã ficou para trás: `grep` por `ab-onda`, `ab-bokeh`, `abOnda`
e `abBokeh` em `.css`, `.js` e `.html` não retorna nada.

## Acessibilidade

Sem mudança de comportamento: `prefers-reduced-motion` e `html.modo-leve`
seguem desligando a abertura inteira. A regra de `reduced-motion` que existia
só para esconder o bokeh foi removida junto com ele.
