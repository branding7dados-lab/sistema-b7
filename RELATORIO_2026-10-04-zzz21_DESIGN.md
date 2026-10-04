# Pacote zzz21: Produção de Design no padrão novo

Versão `2026-10-04-zzz21`, cache `roteiros-b7-v226`.

## Como ficou
- **Cabeçalho:** título maior. No celular, "Nova demanda de Design" virou um "+" quadrado ao lado do título, no lugar da barra larga.
- **Abas** (Todas, Revisão interna, Ajustes, Aprovadas, Finalizadas, Equipe) em **pílulas soltas** com contagem. A escolhida fica em tinta, como nas outras telas; antes eram abas sublinhadas.
- **Filtros:** busca com foco rosa; Cliente, Designer e Prazo em pílula, rosados quando ativos; "Mais filtros" e "Revisar em sequência" também em pílula. No celular, este último não ocupa mais a largura toda.
- **Quadro:** colunas com cantos de 20 px e fundo suave.
- **Cartões:**
  - cantos de 16 px, sombra suave;
  - sobem no hover com brilho rosado e afundam no toque;
  - título maior.
- **Rodapé do cartão:** "Sem responsável" e o prazo ("Atrasado há 2 dias") encavalavam. Agora quebram de linha.

A lógica não mudou.

## Testes
`npm test` passou. Conferido em prints de 390 px (claro e escuro) e de 1280 px.
