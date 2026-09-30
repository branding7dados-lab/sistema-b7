# Relatório 2026-09-30-q — Roteiros separados por mês

Pacote: `atualizacao-2026-09-30-q.zip`, que inclui os pacotes n, o e p. É só front-end: nenhuma migration.

## Regra do mês

1. Se a gravação do roteiro tem **mês de referência** (o mês escolhido na gravação), o roteiro vai para **esse mês**.
2. Se a gravação ainda não tem mês, o roteiro vai para o **mês em que foi criado** (`created_at`, no fuso local).

Todo roteiro pertence a uma gravação: o banco exige isso. Hoje, 59 dos 67 roteiros ativos já têm mês pela gravação. Os outros 8 entram pelo mês de criação.

Quando alguém define ou muda o mês da gravação, os roteiros dela mudam de mês na próxima vez que a página abrir.

## Tela

- Há uma **seção por mês**, do mais novo para o mais antigo. O cabeçalho de cada seção fica fixo no topo enquanto você rola e mostra:
  - nome do mês;
  - etiqueta "ESTE MÊS", quando for o caso;
  - "N roteiros · M gravações";
  - quando houver, o aviso "N pelo mês de criação". O *tooltip* explica que a gravação ainda não tem mês.
- Dentro de cada mês continua a mesma organização:
  - na **Lista**, os roteiros ficam agrupados por gravação, com andamento;
  - nos **Cards**, a grade.
- Novo filtro **Mês** ("Mês: todos", …, "Setembro 2026 (este mês)"). Ele se soma à busca, ao cliente, ao estágio e à ordenação. "Limpar" zera tudo.
- As contagens das abas de estágio respeitam o mês escolhido.
- A página agora carrega **todos** os roteiros ativos (até 1000), não só os 60 últimos. Assim os meses aparecem completos.

## Arquivos

- `js/dashboard.js`: `mesDoRoteiro`, seções por mês e filtro Mês.
- `js/database.js`: `roteirosRecentes` passa a trazer `created_at`.
- `styles/dashboard.css`: `.rt-mes*`.
- `sw.js`: cache v115.

## Tests

Teste de interface automatizado (Playwright), 20/20, em página de teste com dados simulados:

- **Separação por mês:** 5 roteiros em Out/2026, 3 em Set e 2 em Ago.
  - Um roteiro de gravação **com** mês ficou no mês da gravação.
  - Roteiros de gravações **sem** mês ficaram no mês de criação.
- **Cabeçalho:** "Este mês" e "1 pelo mês de criação" aparecem.
- **Filtro Mês:** Ago mostra só 2 roteiros e 1 seção.
- **Regressões:** limpar filtros, caixa de frase nos títulos, estágios, busca, ordenação dentro do mês, Cards, clique que abre o roteiro, vista lembrada, 390 px sem rolagem lateral, modo escuro e sem erros de JavaScript.
