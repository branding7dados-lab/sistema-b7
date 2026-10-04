# Pacote zzz17: tela de Gravações no padrão novo

Versão `2026-10-04-zzz17`, cache `roteiros-b7-v222`.

## Como ficou
- **Título de página (h1):** "Gravações" grande, com a linha "N gravações · por mês de referência" (a contagem continua atualizando com os filtros). No celular, o nome do topo some enquanto o título está à vista, sem repetir, e Calendário e "+" viram botões quadrados ao lado do título.
- **Busca em pílula,** com foco rosa. Os seletores (cliente, mês, responsável) viraram pílulas e ficam rosados quando estão ativos.
- **Status em pílulas soltas** com contagem (Todas, Marcadas, Remarcadas, Sem data, Concluídas). A escolhida fica em tinta, como em Clientes e Roteiros.
- **Mês** com título forte (20 px) e o selo "Mês atual" arredondado.
- **Cartões:**
  - cantos maiores;
  - dia em bloco que cresce no hover (o de hoje fica no degradê);
  - logo do cliente de 40 px preenchendo o quadro;
  - barra de itens gravados em degradê (verde quando completa).

A lógica (filtros, botão Filtros do celular, definir mês, menu ⋯, abrir gravação) não mudou.

## Testes
`npm test` passou. Conferido em prints de 390 px (claro e escuro) e de 1280 px.
