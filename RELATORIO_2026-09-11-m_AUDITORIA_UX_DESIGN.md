# B7 Design — Auditoria e primeira rodada da especificação "UX/Operational Refinement" (build 2026-09-11-m)

Esta rodada respondeu a uma especificação de 56 seções pedindo um
redesenho grande da experiência de Design: nova Central de Design,
navegador de peças mais visual, um "Design Piece Workspace" em tela
cheia, carrossel interativo, thumbnails, uma Linha Editorial
Operacional como layout/componente totalmente separado do editor
normal, além de uma auditoria real do "bug de pilar" e da autorização
do Designer.

**Sendo direto sobre o tamanho:** essa especificação descreve
essencialmente um segundo produto — um workspace de produção visual
completo, com rota dedicada, navegador de slides, geração de
thumbnails, redesenho de toda a Central e do navegador de Design. Isso
não é uma correção nem um refino pontual como as rodadas anteriores
desta sessão; é várias semanas de trabalho de produto. Fazer isso
"de verdade" numa única rodada, sem cortar caminho, seria impossível
sem ou (a) fingir que está pronto quando não está, ou (b) produzir
código superficial que quebra na primeira tela real. Nenhuma das duas
opções serve.

Por isso esta rodada priorizou a parte que a própria especificação
chamou de mais arriscada de adiar: a auditoria de dados do pilar e a
autorização real do Designer (seções 30-35, 53-54) — porque um bug de
segurança ou de integridade de dados não pode esperar um redesenho
visual. Some a isso os itens da especificação que já estavam
totalmente resolvidos e só precisavam de confirmação, ou eram baratos
de fechar sem o redesenho maior (barra do topo, cartão de pilar).

## 1. Implementado e testado

- **Auditoria do "bug de pilar" (§31-35, §54) — causa real
  investigada, não só o sintoma.** Conferido no código-fonte real
  (`js/linha.js`), não por suposição:
  - A relação criativo → pilar é `conteudos.pilar_id`, uma chave
    estrangeira UUID apontando para `pilares.id` — nunca um índice de
    array, posição visual ou nome. `reaisDoPilar = p =>
    L.conteudos.filter(c => c.pilar_id === p.id).length` prova isso
    linha por linha.
  - **Não existe reordenação de pilares na interface.** A função de
    arrastar-e-soltar (`ligarArrasto`) só existe para slides de
    Carrossel e frames de Stories — pilares não têm arrastar. Ou seja,
    o cenário que a especificação temia ("pilar reordenado perde a
    relação") não pode acontecer hoje porque a ação de reordenar
    pilar simplesmente não existe no produto.
  - Duplicar uma Linha Editorial mapeia corretamente o pilar antigo
    para o novo (`mapaPilar[pl.id] = novoP.id`) antes de recriar os
    conteúdos, preservando a relação certa mesmo com IDs novos.
  - Criar e excluir pilar atualizam `L.pilares` (o estado em memória
    real) diretamente a partir da resposta do banco — sem cache
    desatualizado, sem race condition visível no código.
  - **Conclusão: não há bug de relação de dados.** O que os prints do
    dono mostravam nos builds anteriores (`-j`/`-k`/`-l`) era 100%
    visual/textual: contraste de cor ruim na barra "Planejado" (build
    `-k`) e o texto confuso "de 0 planejados" quando um pilar não tem
    percentual definido (build `-l`). Os dois já estavam corrigidos
    antes desta rodada. Estou documentando isso explicitamente porque
    a especificação pediu, com razão, para não esconder um sintoma
    sem achar — ou descartar — uma causa real.
- **Cartão de pilar do Designer é agora um componente de leitura de
  verdade, não o formulário disfarçado (§17, §29).** Antes, o Designer
  via o mesmo `cardPilar` do Coordenador com `disabled`/`readOnly` nos
  campos — visualmente ainda parecia um formulário. Criei
  `cardPilarLeitura`: nome, percentual e funil aparecem como texto e
  selo (não input/select); "Objetivo do pilar" e "Observações" só
  aparecem quando têm conteúdo — nunca uma seção vazia. **"+
  Adicionar Pilar" e "✕ remover pilar" não existem no HTML para o
  Designer** — antes existiam e ficavam clicáveis mesmo sabendo que o
  banco recusaria a escrita, exatamente o tipo de furo que a
  especificação classificou como inaceitável ("não é só esconder com
  tooltip, é criar um componente diferente"). Admin/coordenador
  continuam com o cartão editável de sempre, sem nenhuma mudança.
- **Barra do topo do Designer limpa (§8).** "Nova gravação" não
  aparece mais; a busca global mostra "Buscar cliente, linha editorial
  ou peça…" em vez de "…gravação ou roteiro…". Implementado em
  `montarShellInterno` (`js/app.js`), não em `aplicarNavegacao`
  (`js/permissoes.js`) — a barra do topo é clonada do zero a cada
  montagem do shell interno (ao contrário da navegação lateral, que só
  monta uma vez por sessão), então o ajuste precisa estar no lugar que
  roda toda vez, ou voltaria ao texto genérico numa remontagem (por
  exemplo, ao sair da prévia de cliente). Admin/coordenador não mudam.
- `node --check` em `js/linha.js` e `js/app.js` sem erro.
- Playwright, duas sessões (Designer e Coordenador) sobre o mesmo mock
  de dados: Designer sem "Nova gravação", placeholder trocado, sem "+
  Adicionar Pilar"/"✕ remover pilar", zero `<input>` dentro do cartão
  de pilar, pilar sem objetivo/observações não mostra seção vazia.
  Coordenador: tudo exatamente como antes ("Nova gravação" presente,
  placeholder original, "+ Adicionar Pilar" presente, inputs
  editáveis). Zero erros de console nos dois casos. Screenshots
  conferidos visualmente.

## 2. Implementado, mas requer validação adicional

- Nada nesta rodada ficou nessa categoria — o que foi implementado é
  pequeno o bastante para ter sido testado de ponta a ponta com
  confiança (ver seção 1). A auditoria do pilar em si tem uma ressalva
  coberta na seção 4 (RLS de produção).

## 3. Preparado, mas ainda não aplicado

- Nada — nenhuma migration nova, nenhuma mudança de banco nesta
  rodada. Tudo que foi feito é só JavaScript/CSS.

## 4. Não implementado por decisão consciente (a maior parte da especificação)

Esta especificação tinha 56 seções. As que ficaram de fora, com o
motivo de cada uma:

- **Redesenho visual completo da Central de Design (§2-7)** — as
  seções "Precisa de mim" e "Continuar de onde parei" já existem desde
  o build `-i`; "Minhas linhas em produção" e "Demandas disponíveis"
  também já existem (era a estrutura "Demandas a fazer"/"Minhas
  demandas" dos builds `-f`/`-i`). O que NÃO foi feito é o tratamento
  visual "premium" pedido agora (header personalizado "Olá, Mateus",
  thumbnails, cartões mais ricos com barra de progresso por Linha).
  Isso é trabalho de design de interface real, não uma correção — fica
  para uma rodada dedicada.
- **Redesenho da página "Design" como navegador maior (§9)** — não
  alterada nesta rodada. A distinção conceitual Central (home pessoal)
  vs. Design (navegador amplo) já existe desde os builds `-i`/`-l`
  (inclusive a aba renomeada de "Design" para "Produção" dentro da
  Linha Editorial, no build `-l`, para não colidir com o nome da
  Central) — mas o layout visual da página Design em si não mudou.
- **"Design Piece Workspace" em tela cheia/rota dedicada (§14-24)** —
  não implementado. O modal de peça continua sendo o mesmo painel
  usado desde o build original de Design; o que mudou nos builds
  anteriores (`-l`) foi torná-lo somente leitura para o Designer, não
  redesenhá-lo como workspace maior. Criar uma rota/diálogo quase
  tela-cheia com navegador de carrossel interativo é o item mais caro
  de toda a especificação — não é seguro fingir que foi feito.
- **Carrossel com navegador de slide interativo (§18)** — os slides do
  Carrossel continuam aparecendo empilhados verticalmente no modal
  (agora só leitura), não como um navegador clicável com slide
  selecionado em destaque. As regras de negócio (Slide 1 = abertura,
  último slide = CTA dinâmico, sem campo de Headline/CTA duplicado)
  continuam corretas e testadas desde builds anteriores — só a
  apresentação não mudou.
- **Workspace específico por formato — Card/Capa de Reel/Stories
  (§17, §20, §21)** — não implementado como layout novo. O conteúdo já
  é lido normalmente (campos existentes, sem inventar "Direção
  criativa" obrigatória), mas não há uma composição visual dedicada
  por formato como a especificação descreve.
- **Thumbnails otimizadas de preview (§12, §42)** — não implementado.
  Hoje não existe nenhum pipeline de gerar/otimizar miniatura a partir
  do arquivo enviado; construir isso com segurança (sem baixar o
  arquivo original só para desenhar um card pequeno, como a
  especificação exige) é trabalho de backend/Storage que não cabe
  numa rodada de UI.
- **Linha Editorial Operacional como componente/rota separados (§25-28)**
  — a experiência do Designer numa Linha Editorial continua sendo o
  mesmo `js/linha.js` usado pelo Coordenador, com ramos condicionais
  (`souDesignerSomenteLeitura()`) escondendo/trocando pedaços — não um
  componente `js/linha-operacional.js` novo e fisicamente separado
  como a especificação pede para abrir caminho a um futuro
  `js/video-operacional.js`. Funcionalmente o resultado de hoje já
  cumpre "Designer não edita, vê uma apresentação diferente" (o cartão
  de pilar desta rodada é prova disso), mas arquiteturalmente ainda é
  o mesmo arquivo com `if`s — uma separação de componente de verdade é
  um passo à parte.
- **Navegação operacional reduzida (Peças de Design / Contexto /
  Pilares / Referências) (§27)** — a Linha Editorial do Designer ainda
  usa as mesmas 5 abas do Coordenador (Visão geral, Estratégia,
  Criativos, Postagens, Produção), não a estrutura enxuta de 3-4 itens
  pedida.
- **Filtros na página de demanda editorial (§11), progresso por
  formato dedicado (§43), cartões de peça mais visuais com indicador
  de prazo/feedback (§12-13)** — não alterados nesta rodada; o que já
  existe (resumo de produção, chips de formato) é dos builds `-h`/`-i`.
- **Feedback de ajuste em destaque (§24), versão/histórico mais
  legível (§23)** — não alterados.
- **Notificações apontando para as novas views operacionais (§40-41)**
  — não alterado; os deep-links de notificação continuam apontando
  para as rotas atuais (`#/design/...`, `#/linha/...`), que ainda são
  as corretas porque as novas rotas/telas da especificação não existem
  ainda.
- **Auditoria de performance/N+1/realtime por card (§46)** e
  **auditoria completa de responsividade mobile do redesenho (§45)**
  — não realizadas nesta rodada, porque dependem do redesenho visual
  que não foi feito.
- **Paleta de comandos (Ctrl+K) ainda lista "Nova gravação"/"Novo
  cliente" para o Designer** — reparei nisso auditando o código
  (`js/ui.js`), mas não filtrei: são ações que a tecla de atalho lista
  independente da navegação lateral (que já esconde os itens
  equivalentes). Vale uma correção pequena numa próxima rodada.

## Sobre o RLS de produção (para não repetir um erro antigo)

Nada nesta rodada mexeu em RLS nem em nenhuma política do banco. O
estado continua o mesmo confirmado no build `-i`, com consultas reais
rodadas pelo próprio dono no SQL Editor de produção: **RLS está
ligada** (`relrowsecurity = true`) nas tabelas verificadas, incluindo
`linhas_editoriais`, `conteudos` e `pilares`, com políticas
`sou_equipe()` bloqueando escrita de quem não é admin/coordenador.
Testes locais anteriores (build `-h`) confirmaram que uma tentativa
direta de `UPDATE`/`INSERT` como Designer é recusada pelo Postgres.
Não afirmo isso "porque a interface esconde os botões" — a proteção é
do banco, testada com uma sessão simulada de verdade, independente da
interface.

## Como aplicar

Nenhuma migration nova. Suba os arquivos alterados: `js/linha.js`,
`js/app.js`, `styles/linha.css`, `js/auth.js`, `sw.js`.

## Recomendação sincera

Dado o tamanho real da especificação completa, sugiro tratar o que
sobrou (seções 2-28, 40-46) como um projeto à parte, dividido em
rodadas menores e verificáveis — por exemplo: (1) redesenho visual da
Central de Design com os dados que já existem; (2) Design Piece
Workspace maior, começando só por Card e Capa de Reel; (3) navegador
de slide do Carrossel; (4) thumbnails. Isso permite testar e validar
cada pedaço de verdade, em vez de uma entrega gigante que eu não
consigo testar com o mesmo rigor que apliquei nesta rodada.
