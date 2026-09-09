# Brand System — Roteiros B7

Onde cada arquivo oficial da marca é usado dentro do sistema. Se um dia alguém
precisar trocar uma peça, siga esta tabela para não quebrar a consistência.

**Nenhuma logo foi redesenhada, recriada em SVG/CSS ou alterada.** Os arquivos
enviados são a fonte oficial; o que existe no projeto são apenas recortes na
área visível e redimensionamentos para web. Os originais, sem nenhuma alteração,
estão em `assets/brand/originais/`.

---

## Arquivos

```
assets/brand/
├── logo-color.png        lockup completo colorido  (símbolo + "Branding7")
├── logo-white.png        lockup completo branco
├── symbol-color.png      símbolo colorido isolado (a lâmpada)
├── symbol-white.png      símbolo branco isolado
└── originais/            os quatro arquivos exatamente como recebidos
```

## Onde cada versão é aplicada

| Lugar | Arquivo | Por quê |
|---|---|---|
| Sidebar (fundo escuro) | `logo-white.png` | fundo `#0B0A1E`; a versão colorida perderia o "Branding7", que é azul-marinho |
| Sidebar recolhida | `symbol-white.png` | espaço de 74px: só o símbolo, ainda legível |
| Hero "Central de Produção" | `symbol-color.png` | elemento gráfico sobre o painel escuro, com o gradiente da marca à mostra |
| Card institucional | `logo-white.png` | mesmo fundo escuro do hero |
| Tela de configuração | `logo-color.png` | fundo claro |
| Ficha A4 — cabeçalho | `symbol-color.png` | impresso sobre branco; o símbolo colorido reproduz bem e ocupa pouco |
| Ficha A4 — página de abertura | `logo-white.png` | a abertura é preta; lockup completo porque há espaço |
| Favicon | `assets/icons/favicon.png` | símbolo colorido com fundo transparente, lê bem em aba clara ou escura |
| PWA (192 e 512) | `assets/icons/icon-*.png` | símbolo colorido centralizado sobre `#0B0A1E` |

Nenhuma logo recebe sombra, glow, distorção ou recorte. Sobre fundo escuro entra
a versão branca; sobre fundo claro, a colorida. Sem exceções.

## Logos de clientes

Não confundir com a marca B7. As logos dos clientes ficam no Supabase Storage
(bucket `client-logos`, caminho `client_id/timestamp-nome.ext`) e aparecem no
lugar do avatar de iniciais no dashboard, na lista de clientes, nas gravações, na
busca, na paleta e na ficha A4.

Regras de aplicação: `object-fit: contain` sempre, superfície branca neutra com
borda leve e padding interno, sem corte, sem distorção, sem filtro, sem
recoloração e sem gradiente B7 por cima. Na ficha A4 a logo do cliente entra
pequena ao lado do nome — a identidade do documento continua sendo a B7, no
cabeçalho e no rodapé. Cliente sem logo cai nas iniciais, e nenhuma tela fica
com espaço vazio ou imagem quebrada.

## B7 Interface System

Quatro elementos criam a linguagem visual, todos discretos — a força vem da
repetição, não da intensidade:

| Elemento | O que é | Onde aparece |
|---|---|---|
| **B7 Glow** | sombra colorida de baixa opacidade | botão principal, foco de input, card em destaque |
| **B7 Gradient** | gradiente oficial | botão principal, avatares, trilha, capas, filete da folha |
| **B7 Symbol** | símbolo oficial como grafismo | hero, capas de gravação, capa do cliente, empty states, loader |
| **B7 Light Trail** | filete em gradiente que desliza | item ativo da sidebar (200ms) |

O **loader** usa o símbolo oficial pulsando (`.b7-load`), em vez de spinner
genérico, e só aparece em carregamento real do Supabase. O **spotlight**
(radial suave seguindo o cursor) fica só nos cards principais, some no mobile e
é desligado por `prefers-reduced-motion` — que também zera as animações.

## Capas de gravação

Cada gravação tem uma capa montada em CSS a partir dos dados reais: gradiente da
marca, malha, símbolo B7 em marca d'água, logo ou iniciais do cliente, nome do
cliente e nome da gravação. Nenhuma imagem é gerada nem armazenada.

## Tokens

Tudo sai de `styles/global.css`:

| Grupo | Tokens |
|---|---|
| Superfícies | `--fundo`, `--card`, `--suave`, `--elevado`, `--borda`, `--borda-forte`, `--sidebar` |
| Texto | `--ink`, `--ink-2`, `--ink-3`, `--ink-4` |
| Marca | `--marinho`, `--violeta`, `--roxo`, `--magenta`, `--acento`, `--acento-suave`, `--grad`, `--grad-curto` |
| Estado | `--ok`, `--ambar`, `--neutro`, `--erro` (cada um com `-bg`) |
| Raio | `--r-sm` 10 · `--r` 14 · `--r-lg` 18 · `--r-xl` 22 |
| Espaço | `--e-1` 6 · `--e-2` 10 · `--e-3` 14 · `--e-4` 20 · `--e-5` 26 |
| Sombra | `--sh-1`, `--sh-2`, `--sh-3` |
| Skeleton | `--esq-1`, `--esq-2` |
| Densidade | `--d` (1 no confortável, .78 no compacto) |

## Motion System

Quatro tempos oficiais, usados em todo o sistema:

| Token | Tempo | Onde |
|---|---|---|
| `--t-micro` | 140ms | clique, chip, checkbox, opção |
| `--t` | 180ms | hover padrão, menus, campos |
| `--t-modal` | 200ms | modais e paleta (scale + fade) |
| `--t-pagina` | 240ms | troca de tela (`.entra`), trilha da sidebar |

Comportamentos reutilizáveis: `.entra` (fade + deslocamento), `.eleva` (hover de
card), `.spot` (spotlight), `.b7-load` (loader com o símbolo). Tudo é desligado
por `prefers-reduced-motion`.

## Temas

Toda cor da interface vem de tokens em `styles/global.css`: `:root` define o modo
claro e `[data-theme="dark"]` sobrescreve os mesmos nomes. Nenhum componente tem
cor fixa, então mudar a identidade é mudar os tokens.

O modo escuro não é o claro invertido: usa superfícies próprias em grafite com
subtom violeta (`#0F0A18` fundo, `#1B1426` card, `#241A31` elevado) e as cores da
marca clareadas para manterem contraste (`#E2409C` magenta, `#9A44A8` roxo,
`#5B44C0` violeta). A sidebar é escura nos dois temas, por identidade.

Duas coisas nunca acompanham o tema: **a folha A4** (redefine os tokens dentro de
`.folha`, então o papel continua branco na tela e na impressão) e **as logos dos
clientes** (ficam sempre sobre superfície branca, sem filtro, invert ou
recoloração). A logo da B7 troca de arquivo conforme o tema — `logo-color` no
claro, `logo-white` no escuro — nunca por CSS.

## Cores

Extraídas dos próprios arquivos da marca:

| Token | Valor | Uso |
|---|---|---|
| `--marinho` | `#001559` | cor do "Branding7" e dos pontos do símbolo |
| `--violeta` | `#3A1E86` | início do gradiente |
| `--roxo` | `#7C1E85` | meio do gradiente, ícones e links |
| `--magenta` | `#C21C83` | ação principal, destaques, numeração |
| `--grad-curto` | `120deg, #3A1E86 → #7C1E85 → #C21C83` | botão principal, avatares, barras de destaque |
| `--grad` | `118deg, #001559 → #3A1E86 → #7C1E85 → #C21C83` | faixa da folha A4 e blocos de gancho |

Neutros: fundo `#F6F5FA`, cards `#FFFFFF`, bordas `#EAE7F2`, texto `#15122B`,
secundário `#3B3557`, terciário `#6F688C`.

Status: rascunho neutro/violeta, pronto âmbar, gravado verde — todos em versão
dessaturada, para não competir com a marca.

**Proporção:** a cor da marca aparece em pontos de ação (botão principal, avatar,
ícone ativo, destaques), nunca como fundo de tela inteira. O sistema é
majoritariamente neutro; o roxo/magenta é o acento.

## Tipografia

Os arquivos enviados não trazem fontes, então seguimos as do projeto:

- **Archivo** (700/800/900) — títulos, números, etiquetas, gancho e CTA da ficha
- **Inter** (400/500/600/700) — interface e corpo de texto

Ambas embutidas em `assets/fonts/`, sem depender de CDN.

## Iconografia

Ícones desenhados em SVG inline, todos lineares, `stroke-width: 1.8`, cantos
arredondados. Não há emoji na interface. Ao adicionar um ícone novo, mantenha a
mesma espessura e o mesmo estilo de traço.
