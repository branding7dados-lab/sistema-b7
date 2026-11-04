# Relatório — Build 2026-09-11-n · Rodada 1: Central de Design

Primeira das seis rodadas de `PLANO_UX_DESIGN_RESTANTE.md`. Cobre as
seções 2-7 da especificação "B7 Design UX / Operational Editorial
Refinement": a home do Designer como tela própria, diferente da fila.

## 1. Implementado e testado com confiança

- **Central de Design (`#/`) como tela própria.** Antes, a rota `#/`
  do Designer chamava a mesma função da rota `#/design` com um
  parâmetro que só mudava o item da navegação — era uma tela só com
  dois nomes (a causa real da queixa "a aba Design aparece a mesma
  coisa que a Central"). Agora `#/` monta `abrirCentral()`, em
  `js/design.js`, e `#/design` continua sendo o navegador da fila.
- **Cabeçalho pessoal** ("Bom dia, Mateus." por horário) com frase de
  estado derivada da fila real: quantas peças precisam de atenção, ou
  "continue de onde parou", ou "há demandas para assumir", ou "tudo
  em dia", ou fila vazia.
- **Quatro números reais** (precisam de mim · em criação · esperando
  revisão · disponíveis para assumir), clicáveis, que rolam até a
  seção correspondente. Zero fica desabilitado e visível — não some.
- **"Precisa de mim"** como fila de linhas com o motivo antes do
  título ("Ajuste solicitado", "Ajuste do cliente", "Briefing
  atualizado", "Para começar"), formato · cliente · linha · versão, e
  prazo real com destaque para atrasado / vence hoje. Ordenada por
  urgência. Uma peça nunca aparece em duas seções.
- **"Minhas linhas em produção"** como pacote por Linha Editorial:
  cliente, nome + selo de versão confirmada, porcentagem real
  (finalizadas ÷ total), barra, quebra por estado, contagem por
  formato, próximo prazo real, "Abrir produção →". Linha 100%
  finalizada vai para o fim, esmaecida, marcada "Concluída".
- **"Demandas disponíveis"** como linhas densas com "Assumir", sem os
  cartões com espaço vazio de antes.
- **Estado vazio honesto** quando não há peça nenhuma.
- **`#/design` do Designer** deixou de repetir "Precisa de mim" /
  "Continuar de onde parei" — é o navegador (busca, filtros, tudo por
  linha) e aponta para a Central no subtítulo.
- **Consistência após ação:** realtime e ações da gaveta (assumir,
  enviar para revisão, salvar prazo, aprovar…) redesenham a tela que
  estiver montada — Central ou navegador (`redesenharTela()`). Antes,
  fora do navegador, essas chamadas eram no-op.
- **Correção de passagem:** abrir uma peça a partir da Central (ou da
  vista por linha) não troca mais a tela de trás pela página Design —
  a gaveta abre por cima da tela atual.
- Testado com Playwright (Supabase simulado) em desktop 1280px,
  celular 390px e tema escuro, com 12 peças em 3 linhas cobrindo todos
  os estados; peça de outro designer nunca aparece; números batem com
  os dados; navegação para a gaveta e para a linha conferidas;
  Coordenador sem regressão em `#/` e `#/design`. Zero erros de
  console. Screenshots conferidos um a um.

## 2. Implementado, mas com ressalvas

- **Miniaturas.** A Central usa as prévias que já existem
  (`ultima_previa`, carregadas sob demanda por IntersectionObserver,
  como antes). Não há pipeline de thumbnail otimizada — isso é a
  Rodada 5. Quando a peça não tem prévia, aparece o ícone do formato.
- **"Esperando revisão"** soma revisão interna + aprovado interno +
  aguardando cliente + aprovado pelo cliente (tudo que já saiu da mão
  do Designer e ainda não finalizou). É um agrupamento editorial meu,
  não uma coluna do banco — se a coordenação preferir separar
  "revisão interna" de "no cliente", é uma linha de código.
- **Saudação por horário** usa o relógio do navegador do Designer, não
  do servidor. Para o uso real (Brasil, um fuso) não muda nada.
- **Teste com Supabase simulado**, não com o banco de produção. A view
  `design_resumo` já expõe todos os campos usados
  (`briefing_desatualizado`, `linha_versao_confirmada`,
  `ultima_previa`, `ultima_versao`) desde a migration
  `migration_editorial_versao.sql`, já aplicada. Nenhuma migration
  nova nesta rodada.

## 3. Não implementado por limitação técnica

- Nada desta rodada esbarrou em limitação técnica.

## 4. Não implementado por decisão consciente

- **Redesenho da página Design/navegador (§9-13, 43)** — Rodada 2. O
  que mudou nela agora foi só tirar as seções que passaram a morar na
  Central e ajustar o subtítulo.
- **Design Piece Workspace (§14-24)** — Rodadas 3 e 4. A gaveta de
  peça continua a mesma (somente leitura para o Designer desde o build
  `-l`).
- **Thumbnails otimizadas e Linha Editorial Operacional como
  componente separado (§12, 25-28, 42)** — Rodada 5.
- **Notificações, performance e auditoria mobile completa (§40-41,
  45-46) e o ajuste do Ctrl+K para Designer** — Rodada 6. A
  responsividade DESTA tela foi testada a 390px; a auditoria geral
  fica para o fim, quando todas as telas novas existirem.

## Sobre o RLS de produção

Nada muda nesta rodada: a Central só lê `design_resumo` e usa as
mesmas funções de escrita (`assumir_demanda_linha`, via gaveta) que já
existiam. O estado do RLS em produção continua o que foi confirmado
antes — esta rodada não o ativa nem depende dele.

## Próxima

Rodada 2 — Design (navegador) + página de demanda: seções 9-13 e 43.
