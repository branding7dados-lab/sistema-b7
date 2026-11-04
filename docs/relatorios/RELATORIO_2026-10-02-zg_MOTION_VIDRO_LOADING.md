# Relatório 2026-10-02-zg — Motion, vidro, loading e desempenho

Versão `2026-10-02-zg` (commit `4d569b8`). Só front-end. **Nenhuma migration, nenhuma regra de negócio alterada.**

## 1. Auditoria inicial

- **Tokens:** `styles/global.css` tem cores por tema (claro/escuro), sombras e raios. O "motion system" estava em **dois conjuntos paralelos**: `--t-micro/--t/--t-modal/--t-pagina` (linha ~60) e `--curva-entrada/--t-rapido/--t-medio/--t-lento` (bloco "MOVIMENTO").
- **Entrada de página (`.conteudo.entra`):** definida **duas vezes**. A segunda, que vencia, levava 0,42 s mais uma cascata nos filhos com atraso até 0,21 s e 0,46 s de duração: cerca de **0,67 s** até a tela assentar, em toda troca de tela.
- **Modal (`B7.UI.modal`):** a animação de entrada também estava definida duas vezes (0,20 s e 0,34 s). O **fechamento era instantâneo** (`remove()`).
- **Menus:** já tinham transição curta e posicionamento fixo correto. Os toasts tinham entrada e saída.
- **Navegação:**
  - celular: topo e barra inferior já de vidro;
  - desktop: barra lateral em sanfona com `grid-template-rows` (já eficiente);
  - folhas "Mais", "Criar" e "Conta" sobem de baixo.
- **Loading:**
  - esqueletos de rota (`B7.UI.skeleton`) em quase todas as telas;
  - o loader de seção `.b7-load` (roteiros no editor, lista do sino);
  - spinners soltos (impressão, teleprompter).
- **Rede (medido no site, com a sua sessão):** nas 7 telas principais, nenhuma consulta realmente duplicada. O Calendário faz duas leituras de conteúdos, vídeo e design, mas de intervalos diferentes (semana e mês), e guarda em cache. Tarefas longas: só uma de 56 ms, no Calendário.

## 2. Problemas encontrados

1. Loader interno deformado (seção 3).
2. Troca de tela lenta na percepção (~0,67 s de animação) e regras duplicadas.
3. Modal sumindo de uma vez ao fechar.
4. Esqueletos com brilho deslizante (`background-position` animado = repintura a cada quadro).
5. `will-change:transform` permanente em todos os cards: cada card numa camada de GPU, inclusive parado (centenas no Kanban e no Calendário).
6. Rolagem: a cada evento de scroll de qualquer lista, `fecharMenus` consultava o DOM duas vezes, mesmo sem menu aberto.
7. Brilho que segue o mouse (cards `.spot` da Central): a cada evento de mouse, mede o card **depois** de ter escrito a posição anterior, forçando layout várias vezes por quadro.
8. Botões de ação longa trocavam o texto ("Sincronizando…") e mudavam de largura.
9. No toque, o botão principal ficava "levantado" depois do tap (`:hover` grudado).

## 3. Causa real do loading interno deformado

`.b7-load .simbolo` tinha **54×62 px** (não quadrado) e pulsava com `transform: scale(.97↔1)`. O anel que gira era o `::after` **do próprio símbolo**, com `inset:-16px -13px`. Isso dava uma caixa de **80×94 px**, e `border-radius:50%` em caixa retangular é **elipse**. Como o anel era filho do símbolo, o `scale` do pulso também encolhia e esticava a elipse enquanto ela girava. Resultado: o "ovo orbitando a lâmpada".

**Correção:**

- `.simbolo` virou uma caixa **quadrada fixa** (56×56; 28×28 na versão em linha) com `aspect-ratio:1`, `flex:none` e `box-sizing:border-box`, sem animação própria.
- O **anel** é o `::after` com `inset:0`: círculo perfeito, só gira.
- O **símbolo** é o `::before` centralizado e só muda de **opacidade** ("respira").
- Nenhum transform passa de um para o outro.
- O loader só aparece se a espera passar de ~120 ms.

**Medido na página de teste:** caixa 56×56 e 28×28, anel com inset 0 e raio 50%, símbolo sem animação de escala.

## 4. Sistema de movimento

Um bloco só no fim de `global.css`, "SISTEMA DE MOVIMENTO, VIDRO E PROFUNDIDADE":

| Token | Tempo | Uso |
|---|---|---|
| `--m-instante` | 110 ms | Toque (ícone, barra inferior) |
| `--m-rapido` | 170 ms | Menus, saída de qualquer coisa |
| `--m-padrao` | 240 ms | Entrada de modal, página e toast |
| `--m-enfase` | 300 ms | Folha subindo no celular |

As curvas são:

- `--m-entra`: desacelera no fim;
- `--m-sai`: acelera para sumir;
- `--m-toque`: resposta ao toque.

O movimento usa só `transform` e `opacity`. As duas definições antigas de página e modal foram **removidas**, não sobrepostas.

## 5. Vidro / blur

Tokens: `--vidro-bg`, `--vidro-forte`, `--vidro-borda`, `--vidro-filtro` (saturate 170% + blur 18px), `--vidro-sombra` e `--veu`, cada um com versão clara e escura.

**Aplicado em:**

- menus suspensos;
- menu do topo;
- resultados de busca;
- prévia de roteiros;
- toasts;
- painel flutuante da barra lateral recolhida;
- folhas do celular ("Mais", "Criar", "Conta"), a 93–95% de opacidade para leitura.

**Fora do vidro:** cards, listas e áreas de conteúdo continuam sólidos.

**Sem suporte a `backdrop-filter`:** tudo cai no fundo sólido original (`@supports`).

## 6. Transições

- **Troca de tela:** 240 ms (6 px + opacidade), filhos só com opacidade e atraso até 90 ms. Total em torno de 0,33 s, contra cerca de 0,67 s antes. Os filhos não usam mais `transform`, o que antes criava contexto de posicionamento temporário.
- **Barra inferior:** o filete do item ativo entra crescendo, e o ícone afunda ao tocar.
- **Botões de ícone:** afundam levemente ao clicar.

## 7. Modais, menus e folhas

- **Abrir:** o véu escurece (com desfoque de 6 px **só no desktop com mouse**) e a janela sobe 8 px com escala 0,98.
- **Fechar:** o modal de verdade sai do documento **na hora**. Fica, por cerca de 180 ms, uma **cópia só visual** que some animando:
  - sem ids, para nenhum `getElementById` pegar o modal velho;
  - inerte, sem clique;
  - sem iframe ou vídeo, que não recarregam;
  - com o texto digitado copiado.
- **Checagens de "tem modal aberto"** (`app.js`, `slides.js`) passaram a ignorar a cópia que está saindo.
- **Fechar duas vezes** chama o fechamento (`aoFechar`) uma vez só.
- **Foco preso, Esc e devolução do foco:** mantidos.
- **Celular (≤520 px, e ≤760 px nas folhas):** a janela sobe inteira de baixo e desce inteira ao fechar. A busca global (paleta) é exceção: continua no topo.

## 8. Loading

| Situação | Padrão |
|---|---|
| Ação num botão | `B7.UI.ocupado(botao, acao)`: spinner circular no lugar do texto, **mesma largura**, clique bloqueado, duplo clique ignorado, volta sozinho com sucesso ou erro. Classes `.b.carregando` / `[aria-busy]`. Aplicado em "Sincronizar agora" (Oportunidades). |
| Conteúdo de tela | Esqueletos de rota (já existiam), agora mais leves |
| Seção | `.b7-load` corrigido |
| Tela inteira | Só a abertura do app, que não foi mexida |

## 9. Esqueletos

- **Animação:** pulso de **opacidade** (compositado) no lugar do brilho deslizante (repintura).
- **Atraso:** só aparecem depois de ~120 ms, então carga rápida não pisca esqueleto. O espaço continua reservado, sem pulo de layout.

## 10. Celular

- Barra inferior com vidro, filete de luz e resposta ao toque.
- Folhas em vidro sobem e descem inteiras.
- O véu do modal **não desfoca** a tela inteira no celular: só escurece, porque desfoque de tela cheia custa caro em Android médio.
- `:hover` grudado no toque desligado no botão principal.

## 11. Problemas de desempenho encontrados

1. `will-change:transform` permanente em todos os cards.
2. Consultas ao DOM a cada evento de rolagem.
3. Medida de layout a cada movimento do mouse nos cards da Central.
4. Brilho de esqueleto por `background-position`.
5. Animação de troca de tela longa.
6. Desfoque de tela cheia nos modais também no celular.

Rede e consultas ao Supabase: **nenhuma duplicação real encontrada**, então nada foi mudado na camada de dados.

## 12. Otimizações

- **Camadas de GPU dos cards**
  - Antes: cada `.card-cliente`, `.kb-card`, `.cp-num`… tinha `will-change:transform`, uma camada própria o tempo todo.
  - Mudança: removido; a transição de hover continua funcionando.
  - Depois: o navegador só promove o card durante a transição. Menos memória de GPU em listas longas. Confirmado no site: `will-change: auto`.
- **Rolagem**
  - Antes: `scroll` (capture, todos os elementos) → `fecharMenus` → dois `querySelectorAll` por evento, com ou sem menu aberto.
  - Mudança: só age se há menu aberto, e o ouvinte passou a `passive`.
  - Depois: rolar qualquer lista não toca no DOM.
- **Brilho do mouse (Central)**
  - Antes: `getBoundingClientRect` a cada `mousemove`, logo após escrever variáveis CSS, o que forçava layout várias vezes por quadro.
  - Mudança: a medida é feita ao entrar no card e há uma escrita por quadro (`requestAnimationFrame`).
  - Depois: no máximo uma atualização por quadro, sem layout forçado.
- **Esqueletos**
  - Antes: gradiente com `background-position` animado em cada bloco, repintado a cada quadro.
  - Mudança: opacidade.
  - Depois: animação compositada, sem repintura.
- **Troca de tela**
  - Antes: cerca de 0,67 s de animação, com `transform` em cada filho.
  - Mudança: 0,24 s no contêiner e só opacidade nos filhos, até 0,33 s no total.
  - Depois: a tela assenta na metade do tempo.
- **Desfoque do modal**
  - Antes: `blur(4px)` na tela inteira, em qualquer aparelho.
  - Mudança: desfoque só em tela larga com mouse.
  - Depois: no celular, abrir modal não desfoca a tela inteira.

Não há números de benchmark antes/depois: as melhorias acima são de mecanismo (o que deixou de ser feito), não medições de quadros por segundo.

## 13. Acessibilidade e menos movimento

- A regra global existente (`prefers-reduced-motion` → animações quase instantâneas) continua valendo.
- Com menos movimento, **não há** cópia de saída do modal: ele sai na hora.
- O anel do loader e o spinner de botão continuam girando, mais devagar, porque são a informação "está carregando".
- Os esqueletos ficam parados.
- Foco preso, Esc e `aria-modal` do modal mantidos. O botão ocupado usa `aria-busy`.
- O vidro tem opacidade de 82–95%, e o texto não perde contraste.

## 14. Modo escuro

Os tokens de vidro e véu têm versão escura: vidro mais denso, borda de 9% de branco e sombra mais funda. Conferido em captura: menu de vidro no escuro e modal com toast no claro.

## 15. Arquivos alterados

- `styles/global.css`:
  - loader corrigido;
  - spinner de ação;
  - bloco de motion e vidro;
  - remoção das definições duplicadas e do `will-change`.
- `styles/nav.css`: folha do celular com os tokens novos e animação de saída.
- `js/ui.js`:
  - saída suave do modal;
  - `B7.UI.ocupado`;
  - rolagem sem consulta ao DOM.
- `js/dashboard.js`: brilho do mouse com um quadro por vez.
- `js/app.js` e `js/slides.js`: ignoram o modal que está saindo.
- `js/oportunidades.js`: "Sincronizar agora" com botão ocupado.
- `js/auth.js` e `sw.js`: versão.

## 16. Banco de dados

Nenhuma migration.

## 17. Testes realmente executados

**Automatizados:** nenhum (o repositório não tem suíte).

**Página local com `ui.js` e os CSS reais:**

- **Loader:** 56×56 e 28×28; anel com inset 0 e raio 50%; símbolo sem escala.
- **Modal:**
  - fecha deixando uma cópia inerte, sem id duplicado e com o texto digitado;
  - a cópia some (0 restos após 400 ms);
  - fechar duas vezes chama o fechamento uma vez;
  - em tela larga: animação `b7Modal`, véu com desfoque;
  - em tela estreita: `b7Folha` / `b7FolhaSai`.
- **Botão ocupado:**
  - largura de 141 px antes, durante e depois;
  - `aria-busy`, spinner ativo e opacidade 1;
  - duplo clique ignorado.
- **Menu suspenso:** vidro aplicado (fundo translúcido + blur).
- **Capturas:** tema escuro (loader, botão, esqueleto, menu) e tema claro (modal, toast).

**Site publicado (`zg`), sessão real, só leitura:**

- 13 áreas abertas em sequência (Painel, Central, Clientes, Vídeo, Design, Calendário, Linhas, Oportunidades, Status semanal, Aprovações, Kanban, Gravações e Publicações): todas carregaram, **0 erros de JavaScript**.
- Busca global abre com a animação nova e fecha sem deixar restos.
- Cards com `will-change: auto`.
- **Celular (390×844, escuro):**
  - barra inferior com vidro;
  - folha "Mais" sobe (`b7Folha`) em vidro 95%, sem desfoque de tela cheia, e desce (`b7FolhaSai`) sem restos;
  - sem rolagem lateral.
- **Rede antes das mudanças:** consultas por tela e tarefas longas medidas (seção 1).

**Não testado:**

- Aparelho físico Android/iPhone: só emulação no navegador.
- Teleprompter, editor de roteiros e IA em uso real nesta versão. Nenhuma regra específica deles foi mexida; as regras globais novas são de modal, menu, toast, botão e esqueleto.
- Modo "menos movimento" ligado no sistema operacional: conferido só por leitura do CSS e do código (`matchMedia`).
- Medição de quadros por segundo antes/depois.

## 18. Regressão

Nas áreas abertas no site, nenhuma quebra visível e nenhum erro de console. Comportamentos de modal (foco, Esc, `aoFechar`) testados na página local.

## 19. Limitações

- **Spinner de botão:** `B7.UI.ocupado` está pronto, mas aplicado por enquanto só em "Sincronizar agora". Os outros botões continuam como estavam (desabilitam, alguns trocam o texto). Trocar um a um é trabalho de varredura, sem mudança de regra.
- **Telas com spinner próprio** (impressão, teleprompter) não foram unificadas.
- **Vidro:** depende de `backdrop-filter`. Navegadores sem suporte mostram as superfícies sólidas de antes.

## 20. Recomendações

1. Aplicar `B7.UI.ocupado` nos botões de ação mais usados (aprovar, enviar para aprovação, gerar PDF, IA).
2. Testar em um Android intermediário real a rolagem com a barra de vidro e as folhas.
3. Se algum menu ainda parecer lento, reduzir `--m-rapido` para 150 ms: um ajuste só, no token.
