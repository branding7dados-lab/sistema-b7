# Pacote zzz19: Calendário no padrão novo

Versão `2026-10-04-zzz19`, cache `roteiros-b7-v224`.

## Como ficou
- **Título** maior, e os botões Marcar e ⚙ com cantos arredondados.
- **Barra de navegação** (setas, Hoje, mês, Mês/Semana/Dia) com cantos maiores e sombra suave.
- **Tipos em pílulas soltas** com contagem (Todos, Gravações, Publicações, Vídeo, Design). A escolhida fica em tinta, como em Clientes, Roteiros e Gravações.
- **Seletores em pílula,** com rótulos curtos ("Cliente", "Responsável") e rosados quando estão ativos. Filtros e Oportunidades também em pílula.
- **Grade do mês:**
  - cantos de 22 px;
  - célula com leve brilho no hover;
  - o número de hoje num círculo em degradê;
  - os eventos sobem 1 px no hover.
- **Agenda do celular:**
  - cada evento é um cartão arredondado com sombra suave, mantendo a faixa colorida;
  - "Hoje · 4 OUT" maior;
  - a hora em destaque;
  - o cartão afunda no toque.

A lógica do calendário não mudou. O CSS está no bloco "CALENDÁRIO 2 (zzz19)" no fim de `styles/calendario.css`.

## Testes
`npm test` passou. Conferido em prints de 390 px (claro e escuro) e de 1280 px.
