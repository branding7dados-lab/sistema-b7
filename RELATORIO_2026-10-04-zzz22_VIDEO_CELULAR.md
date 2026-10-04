# Pacote zzz22: Produção de Vídeo no celular, reorganizada

Versão `2026-10-04-zzz22`, cache `roteiros-b7-v227`.

## O que estava ruim (print do Kevin, 04/10 00:13)
- Uma fileira de botões grandes (Gestão, Pacotes, Importar, Descartados) cortava na borda e empurrava a fila para baixo.
- O aviso de meses anteriores era uma caixa grande.
- Busca, Filtros, Minha fila e Lista/Kanban ocupavam três linhas.
- Os cartões tinham logo minúscula e muito espaço vazio.

## Como ficou (celular)
- **Topo:** título, botão "+" (nova demanda) e um **⋯** com Gestão, Pacotes, Importar planilha e Descartados. No computador as ferramentas continuam visíveis como antes.
- **Aviso** numa faixa fina: "1 demanda de meses anteriores em aberto · Ver".
- **Busca e Filtros na mesma linha.** Filtros é só o ícone, com a contagem de filtros ativos num selo rosa. Minha fila e Lista/Kanban ficam numa linha compacta embaixo.
- **Cartão novo:**
  - **logo do cliente grande (46 px) à esquerda**, com um anel fino na cor da etapa (roxo em edição, rosa em aprovação, laranja em correção, verde entregue, vermelho atrasada);
  - à direita: cliente e código com o status, título forte, prazo e responsável.

A lógica não mudou. Os botões do ⋯ acionam os mesmos de antes.

## Testes
`npm test` passou, incluindo a troca rápida Vídeo → Clientes. Conferido em prints de 390 px (claro e escuro, com o menu ⋯ aberto) e de 1280 px.
