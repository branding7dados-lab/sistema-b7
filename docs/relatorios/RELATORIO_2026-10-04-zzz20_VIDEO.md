# Pacote zzz20: Produção de Vídeo no padrão novo

Versão `2026-10-04-zzz20`, cache `roteiros-b7-v225`.

## Como ficou
- **Tabela do computador:**
  - **alinhada**: a célula do título estava com `display:block` e saía da grade da tabela, então o título ficava desalinhado das outras colunas;
  - dentro de um cartão arredondado com sombra e cabeçalho levemente tingido, com linhas mais espaçadas e hover rosado;
  - código, cliente, prazo, status e responsável numa linha só; o título corta com "…" se for longo.
- **Celular:**
  - "Nova demanda" virou um "+" quadrado ao lado do título, no lugar da barra larga;
  - Gestão, Pacotes e Importar ficam numa fileira que rola de lado.
- **Filtros:** seletores em pílula, rosados quando ativos; busca com foco rosa; Filtros e Lista/Kanban arredondados.
- **Cartões do celular** com cantos de 18 px.

A lógica (filtros, lista/kanban, arrastar, abrir demanda) não mudou.

## Testes
`npm test` passou, incluindo a troca rápida Vídeo → Clientes. Conferido em prints de 390 px (claro e escuro) e de 1280 px.
