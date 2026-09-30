# Relatório 2026-09-30-j: nova lista de Gravações (UI/UX)

Pacote: `atualizacao-2026-09-30-j.zip`. Inclui tudo do i, h e g. Esta rodada muda só o front-end; o banco não foi alterado.

## O que mudou
- **Uma linha por gravação, no lugar das capas roxas repetidas.** Em cada linha:
  - **Dia em destaque:** dia da semana, dia e mês. Hoje aparece em magenta; sem data, o quadro fica tracejado.
  - **Cliente em primeiro plano:** logo e nome, com o nome da gravação embaixo.
  - **Quando:** "Hoje · 14:00", "Amanhã", "Em 3 dias" ou a data.
  - **Progresso:** barra de itens gravados ("2/6 gravados"), verde quando completa.
  - **Responsável:** avatar e primeiro nome.
  - **Status e menu ⋯:** o ícone do menu antes aparecia como "—".
- **Aviso "Data passou · concluir ou remarcar"** nas gravações marcadas ou remarcadas cuja data já passou.
- **Cabeçalho de cada mês:** resumo ("2 marcadas · 1 concluída"), itens gravados no mês, quantas estão com data passada e a etiqueta "mês atual".
- **Filtros:**
  - busca por cliente ou gravação;
  - selects com rótulos claros ("Todos os clientes", "Todos os meses"), sem texto cortado;
  - abas de status com contagem, que acompanham os outros filtros;
  - botão "Limpar filtros".
- **Gravações antigas sem mês:** o botão "Definir mês" direto na linha (e no menu ⋯) sugere o mês pela data. Ao salvar, a gravação vai para o mês certo sem recarregar a página.
- **Acessibilidade:** a linha abre com clique ou Enter, tem foco visível e o progresso é anunciado como barra de progresso.
- **Mobile:** a linha vira um cartão compacto (dia, cliente, progresso, status), as abas de status rolam na horizontal e não há rolagem lateral da página em 360px.
- A prévia de roteiros no hover continua funcionando nas linhas.

## Arquivos
- `js/dashboard.js`: linhaGravacao, resumoGrupo, modalDefinirMes e o novo abrirGravacoes. O cardGravacao continua igual no Início e no workspace do cliente.
- `styles/gravacao.css`: bloco novo da lista de gravações.
- `sw.js`: cache em `roteiros-b7-v108`.

## Tests
Todos executados em um harness Playwright com dados simulados, no fuso de São Paulo.
- **Telas:** 1440, 1024, 390 e 360 (modo escuro), sem rolagem horizontal.
- **Interações:**
  - busca;
  - limpar filtros;
  - aba de status;
  - contagens que acompanham o filtro de cliente;
  - Definir mês: sugere o mês pela data, salva a competência e tira a gravação do grupo antigo;
  - abrir pela linha e pelo Enter;
  - sem erros de JS.
- `node --check` em todos os JS.

**Não testado:** com login real no app publicado.
