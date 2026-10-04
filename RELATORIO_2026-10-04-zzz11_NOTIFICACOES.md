# Pacote zzz11: painel de notificações redesenhado e animado

Versão `2026-10-04-zzz11`, cache `roteiros-b7-v216`.

## Como ficou
- **Cabeçalho:**
  - título maior, com a contagem "N novas";
  - "Marcar lidas" com ícone de dois tiques (só o ícone no celular);
  - Preferências virou uma engrenagem que gira no hover, ao lado; antes ficava no rodapé.
- **Filtros:** pílulas no mesmo estilo de Usuários, com a selecionada em tinta escura.
- **Lista agrupada por dia** (Hoje, Ontem, Esta semana, Este mês, Mais antigas), com os títulos dos grupos fixos ao rolar.
- **Cada aviso:**
  - logo do cliente de 42 px: a imagem sobre fundo branco, ou iniciais num degradê escuro, ou o símbolo da B7 quando é do sistema;
  - um **selo colorido do tipo** no canto da logo: atribuição (roxo), prazo (laranja), correção (rosa), aprovação (verde);
  - linha de cima com o cliente e a hora curta (12 min, 14:32, ontem, 3 d, 12/09);
  - título e mensagem limitada a 2 linhas;
  - quando não lida, fundo levemente rosado e ponto à direita.
- **Animação:**
  - o painel nasce do sino saindo do desfoque e volta para ele ao fechar (antes sumia seco);
  - os itens entram em cascata;
  - enquanto carrega, aparece um esqueleto com brilho;
  - "Marcar lidas" apaga os pontos em onda, um a um;
  - o **sino balança** quando chega um aviso novo;
  - na lista vazia, o sino do estado vazio balança uma vez.
- Modo leve: sem vidro nem desfoque. "Reduzir movimento" desliga as animações.

A lógica não mudou: busca, filtros, Realtime, som, push e marcar lida continuam iguais (`js/notificacoes.js`). O CSS novo está no bloco "PAINEL DE NOTIFICAÇÕES (zzz11)" no fim de `styles/aprovacoes.css`, no lugar das regras antigas.

## Testes
`npm test` passou inteiro. Conferido em prints de 390 px (claro e escuro) e de 1280 px.
