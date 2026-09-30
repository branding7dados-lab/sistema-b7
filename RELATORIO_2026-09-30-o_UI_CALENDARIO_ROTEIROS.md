# Relatório 2026-09-30-o — UI/UX: Calendário (mês) e Roteiros

Pacote: `atualizacao-2026-09-30-o.zip`. Inclui tudo do pacote **n** (Oportunidades). Esta rodada é só front-end: sem banco, sem migration.

## Calendário — vista Mês (e Semana)

**Problema.** Um cliente com vários prazos no mesmo dia enchia a célula de chips iguais, e o nome dele se repetia em todos. Resultado: "+12 eventos" e títulos cortados.

**Agrupamento por cliente.** Vários prazos de vídeo, peças de design ou publicações do **mesmo cliente no mesmo dia** viram **um chip só**, com o total. Exemplo: "AutoEscola Modelo  14".
- O *tooltip* e o leitor de tela dão o resumo por status, por exemplo "14 vídeos (11 pendente, 2 em edição, 1 entregue)".
- Clicar no chip abre a folha do dia **já filtrada** naquele cliente e tipo:
  - título "AutoEscola Modelo · 14 vídeos";
  - subtítulo com a data e o resumo por status;
  - linhas compactas: título, status e responsável na mesma linha, em ordem natural (1, 2, 3… 10).
- Gravações (têm hora) e oportunidades continuam individuais.

**Chips individuais**
- Nome do cliente em **negrito** e título do item em cinza, para dar para ler os dois.
- Ponto colorido quando o status pede atenção (em edição, aguardando, correção…).

**Grade**
- Sábado e domingo ficam mais estreitos (telas ≥ 900 px), e os dias úteis ganham largura.
- A largura máxima passou de 1320 para 1480 px.
- **Hoje:** fundo levemente destacado e linha de acento no topo.
- **Dias passados:** número e chips um pouco mais apagados.
- "+N eventos" virou "+N mais" e conta os itens reais, não os chips.

**Vista Dia, agenda do celular e "+N mais"**
- Dentro de cada grupo (por exemplo, "Prazos de vídeo"), o cliente com 2 ou mais itens ganha um subtítulo com a contagem.
- As linhas desse cliente não repetem o nome.

## Roteiros

**Topo**
- Título grande e frase de contagem ("60 roteiros mexidos por último…"). Isso substitui o número solto que ficava desalinhado.
- Alternância **Lista | Cards**, lembrada no navegador.
- Botão "Nova gravação".

**Estágios**
- Abas com **ponto de cor e contagem** por estágio.
- A contagem respeita a busca e o cliente escolhidos.

**Barra de filtros**
- Busca (título, cliente, gravação, objetivo).
- Cliente.
- **Ordenação:** mexidos por último, próximas gravações ou cliente A–Z.
- "Limpar", que aparece só quando há filtro.

**Lista (padrão), agrupada por gravação**
- **Cabeçalho do grupo:**
  - logo, cliente e gravação;
  - **quando grava:** "Grava 01/10 · amanhã", "Gravada em 15/09", "Era para 17/09" (em âmbar) ou "Ref. Outubro 2026 · sem data";
  - **barra de andamento** colorida por estágio, com "2/2 prontos · 6 na gravação".
- Clicar no cabeçalho abre a gravação.
- **Linhas:**
  - título e objetivo numa linha cada;
  - estágio;
  - "há 47 min";
  - seta.
- Clicar numa linha abre o roteiro, pelo mesmo caminho de antes: `#/gravacao/<id>?roteiro=<id>`.

**Cards:** mais compactos. O rodapé mostra estágio, quando foi mexido e quando grava.

**Títulos em MAIÚSCULAS:** títulos e nomes de gravação digitados todo em maiúsculas aparecem em caixa de frase. Exemplo: "CONSCIENTIZAÇÃO DO TRÂNSITO" aparece como "Conscientização do trânsito". Isso é **só na tela**; nada muda no banco.

**Celular:** as linhas empilham (título e objetivo; estágio e horário embaixo), sem rolagem horizontal.

## Arquivos alterados

- `js/calendario.js`: agrupamento, chips, folha filtrada, subtítulos por cliente.
- `styles/calendario.css`: grade, hoje e passado, chips, folha compacta.
- `js/dashboard.js`: página Roteiros.
- `styles/dashboard.css`: `.rt-*`.
- `sw.js`: cache **v113**.

## Tests

Só o que foi executado:
- **Calendário (Playwright), 11/11:**
  - chip agrupado com 14 e resumo de status no aria;
  - dia 05 sem estouro;
  - folha filtrada com título e 14 linhas;
  - subtítulo por cliente na vista Dia e no celular;
  - agrupamento na Semana;
  - 390 px sem rolagem horizontal;
  - modo escuro;
  - sem erros JS.
- **Regressão:**
  - suítes da fase 6 (`cal_int`, `cal_rt`, `cal_t`) sem regressão. Um teste de `cal_int` foi ajustado porque agora reconhece o chip agrupado; ele confirma que o grupo pertence ao responsável filtrado;
  - Oportunidades (`op_ui`): 43/43.
- **Roteiros (Playwright), 16/16:**
  - 5 grupos e 10 linhas; caixa de frase; contagens por estágio;
  - "Grava 01/10 · amanhã" e "Ref. Outubro 2026 · sem data";
  - filtro por estágio; "Limpar" some sem filtro e aparece com filtro;
  - busca;
  - ordenação "Próximas gravações";
  - Cards;
  - clique abre `#/gravacao/g3?roteiro=r4`;
  - vista lembrada após recarregar;
  - 390 px sem rolagem horizontal; modo escuro; sem erros JS.

## Pendências

- O agrupamento vale para mês e semana. Na vista Dia, os itens continuam um por linha, com subtítulo por cliente.
- A página Roteiros continua carregando os 60 mais recentes, como antes. Paginação ou "carregar mais" fica para uma próxima rodada, se precisar.
