# Relatório — Build 2026-09-11-p · Redesenho da página "Design" (navegador de produção)

Trabalho pedido explicitamente **antes** da Rodada 3 do plano original
(`PLANO_UX_DESIGN_RESTANTE.md`), a partir de uma especificação própria
de 43 seções motivada por dois screenshots reais da tela `#/design` em
produção: uma faixa fina de largura total sobre um espaço vazio muito
grande, sem hierarquia de cliente e sem prévia visual das peças. Este
relatório descreve o que foi de fato implementado e testado nesta
rodada — não é um plano.

## 1. Implementado e testado com confiança

- **Distinção Central vs. Design reforçada visualmente.** O título
  dentro da página agora é "Produção de Design" (o item "Design" na
  barra lateral continua igual), com o subtítulo "Acompanhe as linhas
  editoriais e peças em produção." A Central de Design (`#/`, home
  pessoal da Rodada 1) não foi tocada — as duas telas não são mais
  fáceis de confundir.
- **Faixa fina de 100% de largura removida.** No lugar: uma grade
  responsiva de cartões de projeto (3 colunas em desktop, 2 em
  tablet, 1 em celular — confirmado por screenshot e por
  `gridTemplateColumns` computado em 1440px/1024px/820px/390px), com
  `max-width` por cartão para que um projeto sozinho nunca estique a
  tela inteira.
- **Cartão de projeto com hierarquia cliente-primeiro.** Logo real do
  cliente quando `clientes.logo_url` existe, iniciais como aviso
  quando não existe (nunca o avatar do usuário logado fazendo as
  vezes de marca do cliente); linha editorial e versão confirmada
  como metadado secundário abaixo — invertendo a hierarquia mês/
  versão-primeiro que o screenshot mostrava.
- **Prévias reais em miniatura** (até 3 por cartão, mesmo mecanismo
  de thumbnail assinado com lazy-load que os cartões de peça já
  usavam) e **quebra por formato com ícone** (reaproveitando os SVGs
  já existentes no sistema — nenhum emoji novo).
- **Progresso real de Design** (finalizadas ÷ total da linha, igual à
  Central — nunca o status editorial do conteúdo de origem), com
  estados em destaque (ajustes com selo de alerta) e no máximo duas
  ações por cartão ("Ver peças" + "Assumir demanda" ou "Continuar
  produção", conforme o contexto).
- **Barra de resumo rápida** no topo ("N disponíveis · N comigo · N
  em ajustes · N em revisão"), cada item funcionando como filtro de
  um clique, testado e confirmado: clicar em "Ajustes" estreitou
  corretamente para o único projeto com peça em ajuste e ligou o
  estado visual do botão; clicar de novo desligou; "Disponível" e
  "Comigo" isolaram cada seção como esperado. Itens com contagem zero
  em ajustes/revisão não aparecem — só "disponíveis" e "comigo"
  aparecem sempre.
- **Alternância "Linhas editoriais" / "Peças"**, mesmo componente
  visual de segmento que a equipe já usa em Quadro/Lista. "Linhas
  editoriais" é o padrão. "Peças" lista cada peça individualmente
  reaproveitando o cartão de peça já existente — testado: mostra as
  11 peças visíveis ao Designer (nunca a de outro designer), busca
  por texto estreita corretamente, e clicar numa peça abre a gaveta
  (Design Piece Workspace), não um editor diferente. A preferência de
  modo persiste em `sessionStorage`, mesmo padrão das outras telas.
- **Filtros ampliados no navegador do Designer**: Cliente (só aparece
  quando há mais de um cliente nas peças visíveis) e Status (antes
  só existia para a equipe). "Limpar filtros" agora zera também o
  filtro rápido.
- **"Minhas demandas" vazio compacto**: uma linha de texto no lugar
  do retângulo tracejado grande que existia antes.
- **Ordem das seções sem forçar vazio em cima**: quando o Designer
  ainda não tem nada assumido, "Demandas disponíveis" aparece antes
  de "Minhas demandas" vazio.
- **Nova coluna `cliente_logo_url` na view `design_resumo`**
  (`migration_design_logo.sql`) — a view já fazia join com
  `clientes`, só faltava selecionar a coluna. Nenhuma consulta nova
  nem tabela duplicada: o cartão de projeto usa exatamente a mesma
  leitura de `design_resumo` que já alimentava a Central e o
  navegador.
- **Nenhuma regra de negócio alterada**: assumir demanda, atribuição,
  status, Kanban, uploads, revisão interna, aprovação do cliente e
  notificações continuam exatamente como estavam. Confirmado por
  código (nenhuma das funções que implementam essas regras foi
  tocada) e pelo teste automatizado de "Assumir demanda" continuando
  a funcionar sobre o novo cartão.
- **Regressão da Central de Design (`#/`) e da página de demanda
  (`#/design/linha/:id`)**: reconferidas depois das mudanças no
  navegador, já que ambas compartilham funções não alteradas
  (`pacoteLinha`, `linhaDisponivel`, `resumoLinha`). Cabeçalho,
  contagem de linhas em produção, demandas disponíveis e ausência de
  vazamento entre designers continuam corretos. "Voltar ao Design",
  a partir da página de demanda, retorna para o navegador redesenhado
  sem erro.
- Todos os testes acima rodaram via Playwright com Supabase simulado
  (REST interceptado), fixture com 12 peças cobrindo dois clientes
  (um com logo, outro sem), duas linhas editoriais, uma peça sem
  responsável e uma peça de outro designer (canário de vazamento) —
  em nenhum teste, em nenhum modo, a peça do outro designer apareceu.
  Zero erros de console (JS ou CSS quebrado) em todos os cenários,
  incluindo tema escuro.

## 2. Implementado, mas requer validação adicional

- **`migration_design_logo.sql` ainda não foi rodada em nenhum banco
  real** (nem de teste, nem de produção). A renderização do logo do
  cliente foi validada apenas com uma URL simulada interceptada pelo
  Playwright — não com o Storage do Supabase nem com uma foto de
  cliente de verdade. É preciso rodar a migration e conferir com pelo
  menos um cliente que já tenha `logo_url` preenchido.
- **Contraste e legibilidade do tema escuro** não foram inspecionados
  visualmente pixel a pixel — só foi confirmada a ausência de erro de
  JS/CSS quebrado ao carregar a página com `color-scheme: dark`.
- **Navegação por teclado (Tab/Enter) nos novos cartões de projeto**
  não foi testada de forma automatizada nesta rodada. O cartão tem
  `tabindex="0" role="button"` e reaproveita os mesmos manipuladores
  de teclado da Central (`ligarCentral`, inalterados desde a Rodada
  1, que já tratam Enter/Espaço), mas não houve um teste de foco
  dedicado ao novo layout específico do cartão de projeto.
- **Nenhum teste em dispositivo físico foi realizado.** Toda a
  validação responsiva (1440px, laptop, tablet, celular) foi feita
  por emulação de viewport no Chromium via Playwright — não é o
  mesmo que testar num celular ou tablet real.
- **Sidebar recolhida**: o comportamento da barra lateral colapsada
  não foi reconferido explicitamente nesta rodada (não houve
  regressão relatada nem esperada, já que a mudança foi só dentro da
  área de conteúdo, mas não foi um teste específico executado).

## 3. Não implementado por bloqueio

- Nada nesta rodada esbarrou em limitação técnica.

## 4. Não implementado por decisão consciente

- **Design Piece Workspace, carrossel interativo dedicado e Linha
  Editorial Operacional separada** continuam fora do escopo — são a
  Rodada 3 do plano original.
- **Quadro/lista/equipe da coordenação** não foi tocado — sempre foi
  tratado, desde a Rodada 2, como fora do escopo deste conjunto de
  redesenhos do lado do Designer.
- **B7 Design, Design Deliverables, atribuições, Linhas Editoriais,
  Kanban, uploads, Design Versions, notificações, revisão interna e
  autenticação/papéis** não foram recriados nem alterados — a
  especificação pediu explicitamente que nada disso fosse refeito, e
  nada disso foi.

## Sobre migrations e RLS de produção

Uma única migration nova nesta rodada: `migration_design_logo.sql`
(recria a view `design_resumo` acrescentando `cliente_logo_url`, sem
tocar em nenhuma outra coluna, tabela ou permissão). Ainda não foi
aplicada em nenhum banco. O estado do RLS de produção não muda nesta
rodada — nenhuma função de escrita foi alterada.

## Próxima

Depois de rodar `migration_design_logo.sql` em produção e conferir o
logo com um cliente real, o próximo passo combinado é a Rodada 3 do
plano original — Design Piece Workspace (estrutura + Card + Capa de
Reel): seções 14-17, 20 e 22-24 de `PLANO_UX_DESIGN_RESTANTE.md`.
