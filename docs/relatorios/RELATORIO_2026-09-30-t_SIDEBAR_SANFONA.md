# Relatório 2026-09-30-t — Barra lateral em sanfona

Pacote: `atualizacao-2026-09-30-t.zip`. Inclui os pacotes n, o, p, q e s. É só front-end.

## Sidebar

Os grupos continuam os mesmos, nos mesmos lugares e com os mesmos itens. A diferença é que viraram uma **sanfona com um grupo aberto por vez**:

- Os grupos fechados mostram só o título e a seta ›.
- O grupo aberto mostra os itens.

Com isso a barra deixa de exibir os cerca de 20 destinos ao mesmo tempo. A construção continua passando pelo mesmo resolvedor (`B7.Nav.resolver`): permissão decide o que existe, função operacional decide a ordem.

## Grupos

- **Principal:** Painel e Central B7, conforme a elegibilidade de cada um.
- **Meu trabalho:** personalizado pela função operacional (`MEU_TRABALHO`, intercalado para quem tem mais de uma função). Admin sem função operacional não tem esse grupo.
- **Operação:** os destinos autorizados que não estão nos grupos anteriores. Continua se chamando "Produção" quando a pessoa não tem "Meu trabalho".
- **Mais ferramentas:** Arquivados, Lixeira, Usuários e acessos e Configurações, conforme a permissão.

**Só um grupo fica aberto por vez.** Abrir um fecha o anterior. Clicar no grupo que está aberto fecha esse grupo. Grupo sem item autorizado não aparece. Se algum item for retirado depois da montagem (por `B7.Perm.aplicarNavegacao`) e o grupo ficar vazio, ele também some, tanto na sanfona quanto no ícone da barra recolhida.

## Rota ativa

- **Grupo aberto:** o grupo que contém a tela atual abre sozinho. Isso vale ao carregar a página, ao navegar pela busca, por links ou pelo histórico. A troca de grupo por mudança de rota usa a mesma animação da troca manual.
- **Ordem de prioridade** para decidir qual grupo abre:
  1. a rota atual;
  2. o último grupo aberto à mão, guardado em `localStorage` como `b7-nav-grupo` (só vale quando a rota não resolve);
  3. "Meu trabalho", para quem tem função operacional;
  4. "Principal".
- **Grupo da tela atual fechado à mão:** ele ganha um **ponto magenta de 6 px** ao lado da seta. Leitores de tela ouvem "(tela atual está aqui)". Ao reabrir, o item continua ativo.
- **Item ativo:** fundo levemente mais claro, texto branco em semibold, ícone mais forte, **acento em gradiente B7 de 3 px à esquerda** e `aria-current="page"`. O acento fica dentro do próprio item, sem trilha deslizante, para nunca piscar durante a animação.
- **Rolagem:** se o item ativo ficar fora da área visível da barra depois de navegar, a barra rola só o necessário. A página não rola.

## Animações

- **Abrir e fechar grupo:** 170 ms, animando `grid-template-rows` (0fr → 1fr, altura real, sem truque de `max-height`) e `opacity`. A curva é `cubic-bezier(.2,0,0,1)`, sem mola nem ressalto.
- **Grupo fechado:** fica com `visibility: hidden` depois da transição. Não ocupa espaço e não recebe foco pelo Tab.
- **Seta:** gira de › para ⌄ (90°) em 170 ms.
- **Troca de grupo:** o grupo antigo fecha **ao mesmo tempo** que o novo abre, então a barra não pula. O teste pegou os dois painéis no meio do caminho aos 80 ms.
- **Transições:** nenhum `transition: all` na barra (verificado por teste). Só animam `grid-template-rows`, `opacity`, `transform`, `width` e `background-color`.
- **Movimento reduzido:** com `prefers-reduced-motion`, as trocas são imediatas e o recolher não tem a etapa de esmaecer.

## Sidebar recolhida

- **Ícones:** em vez de uma coluna com todos os módulos, aparece **um ícone por grupo** (Principal, Meu trabalho, Operação e Ferramentas). O grupo que contém a tela atual fica com fundo e acento de 3 px.
- **Painel flutuante:** clicar no ícone, ou apertar Enter/Espaço, abre um painel ao lado da barra com os itens autorizados do grupo e o item ativo marcado. Entra e sai com opacidade e 6 px de deslocamento, em 140 ms.
  - Fecha ao navegar, ao clicar fora, com Esc (o foco volta ao ícone) e ao abrir outro grupo.
  - Setas ↑/↓ percorrem os itens.
  - Não depende de passar o mouse.
- **Dicas:** o nome do grupo aparece numa dica ao passar o mouse ou focar, a mesma `B7.UI.dica` de antes, com posição fixa.
- **Recolher:** primeiro os rótulos, o logo e o texto do rodapé esmaecem (90 ms). Depois a largura encolhe (180 ms) e o símbolo B7 entra.
- **Expandir:** a largura cresce e só então a sanfona, o logo e o texto entram, com 90 ms de atraso. Nada aparece espremido.
- **Larguras:** vêm de uma fonte só (`--lateral-larga: 248px` e `--lateral-estreita: 74px`).

## Atalhos

"Atalhos" saiu da barra permanente. O recurso continua acessível pela **tecla "?"** e pelo **menu da conta** (avatar → Atalhos).

## Permissões

Nenhuma permissão foi alterada. A barra continua só apresentando o que `B7.Perm.podeRota` e as funções operacionais já decidiam. Guardas de rota, banco e RLS não foram tocados.

## Responsividade

- **Desktop (> 1080 px):** sanfona. Com a barra recolhida, ícones de grupo e painel flutuante.
- **Tablet (761–1080 px):** a barra já era um trilho fixo de ícones. Agora mostra os ícones de grupo com painel flutuante.
- **Celular (≤ 760 px):** nada mudou. A barra lateral fica escondida e continuam a barra inferior, o topo e a folha "Mais".

## Acessibilidade

- Cada cabeçalho de grupo é um `<button>` com `aria-expanded` e `aria-controls`, e o painel é uma região com `aria-labelledby`.
- Enter e Espaço abrem e fecham. Tab percorre os cabeçalhos e só os itens visíveis.
- Os ícones da barra recolhida têm `aria-label`, `aria-haspopup` e `aria-expanded`, e ↑/↓ passa de um ícone para outro.
- O painel flutuante tem `role="group"` com nome. Esc fecha e devolve o foco ao ícone.
- O item ativo tem `aria-current="page"`, e o ponto do grupo fechado também é anunciado em texto.

## Overflow

Não houve rolagem lateral em nenhum caso testado:

- barra expandida em 1440, 1280 e 1100 px;
- barra recolhida com o painel flutuante aberto;
- tablet com painel aberto;
- dica aberta.

O painel e a dica são filhos do `<body>` com `position: fixed`, então não entram na caixa de rolagem da barra. Os rótulos de grupo e os itens têm `min-width: 0` com reticências, e os ícones de grupo têm tamanho fixo de 44 px, que cabe nos 74 px. Não foi preciso nenhum `overflow-x: hidden` novo.

## Banco / migrations

Nenhuma migration de banco foi necessária para esta melhoria da sidebar.

## Arquivos alterados

- `js/nav.js`: sanfona, sincronização com a rota, ponto do grupo ativo, ícones de grupo e painel flutuante. "Atalhos" saiu de `FERRAMENTAS`.
- `js/dashboard.js`: `marcarNav` avisa a sanfona.
- `js/app.js`: recolher e expandir em duas etapas, com `aria-label` e `aria-expanded` no botão.
- `styles/nav.css`: estilos da sanfona, do trilho, do painel e do rodapé.
- `styles/global.css`: tokens `--lateral-larga` e `--lateral-estreita`.
- `js/auth.js`: versão 2026-09-30-t.
- `sw.js`: cache v118.

## Tests

Todos rodaram em Playwright/Chromium, numa página de teste que usa os arquivos reais `js/nav.js`, `js/permissoes.js`, `js/ui.js` e o CSS real. O trecho do botão Recolher foi copiado de `js/app.js`. **61/61 passaram.**

- **Admin + videomaker em Edição de vídeo:**
  - abrem os 4 grupos, com "Meu trabalho" aberto e Edição de vídeo ativa (`aria-current`);
  - "Atalhos" não aparece e nenhum item se repete;
  - cabeçalho com 34 px e item com 38 px;
  - painel fechado com altura 0 e oculto.
- **Troca de grupos:**
  - abrir Operação à mão fecha "Meu trabalho", que fica com o ponto visível e o texto para leitor de tela;
  - ao reabrir, o item ativo continua ativo;
  - navegar pela rota abre o grupo certo: Clientes → Operação, Config → Mais ferramentas, Painel → Principal;
  - oito cliques rápidos terminam em um estado coerente (1 grupo aberto e `aria` batendo);
  - Enter abre, Espaço fecha, Tab entra no primeiro item visível.
- **Recolher e expandir:**
  - ao recolher, a sanfona esmaece antes, a barra fica com 74 px e 4 ícones de grupo, sem itens soltos, com o grupo da rota marcado;
  - ao expandir, os rótulos só aparecem depois e o grupo da rota volta aberto;
  - o `aria-label` do botão muda.
- **Painel flutuante (barra recolhida):**
  - fica no body, ao lado da barra, com os itens do grupo e sem rolagem lateral;
  - ao abrir outro grupo, o painel troca;
  - fecha com clique fora;
  - Enter abre e foca um item; Esc fecha e devolve o foco;
  - navegar por ele fecha o painel e atualiza o ícone ativo.
- **Papéis:**
  - admin puro: sem "Meu trabalho", abre em Principal e o grupo se chama "Produção";
  - coordenador: Linhas editoriais fica em "Meu trabalho" e não aparecem Usuários nem Config;
  - designer: Design fica ativo e nenhum grupo aparece vazio;
  - coordenador + designer: "Meu trabalho" mistura as duas funções;
  - grupo esvaziado depois da montagem some.
- **Telas:**
  - tablet (1000 px): trilho de grupos e painel sem overflow;
  - sem overflow em 1280, 1100 e 1440 px;
  - dica no hover sem overflow;
  - celular: barra lateral escondida.
- **Movimento reduzido:** troca de grupo e recolher imediatos.
- **Animação e erros:**
  - a troca de grupo é sobreposta (os dois painéis no meio do caminho aos 80 ms);
  - nenhum `transition: all`;
  - nenhum erro de JavaScript.
- **Capturas de tela** em escuro conferidas. A barra é escura nos dois temas: `--sidebar` é escuro também no tema claro.
- **Regressão:** Roteiros (20/20), Calendário (11/11) e Oportunidades (43/43) continuam passando.

## Pendências

- Não testei dentro do app completo com login real, só na página de teste com os módulos reais de navegação. Vale conferir no ar a montagem inicial e a troca Portal ↔ equipe (o Portal tem sua própria navegação e os estilos novos só valem para a barra da equipe).
- O painel flutuante não abre ao passar o mouse, só por clique ou teclado. Foi de propósito, para ser confiável.
