# Relatório zzz280 — Retrospectiva do mês

Surpresa pedida pelo Kevin ("me surpreenda"): o mês da B7 contado em "stories", como a retrospectiva do Spotify.

## Banco
- `retrospectiva_mes(ano, mes)` (migration `retrospectiva_mes`, já aplicada; arquivo `migration_retrospectiva.sql`). Só lê.
  - Equipe interna (`sou_equipe_interna`): totais do mês (vídeos, artes, posts, gravações, roteiros, aprovações, tempo médio de resposta, legendas consertadas, clientes atendidos), o dia com mais entregas, entregas por dia da semana, comparação com o mês anterior e o "você".
  - Coordenação/administração (`sou_equipe`): também o cliente do mês e o pódio (top 3 em entregas).
  - Cliente não acessa (erro 42501).
- Conferido com os dados reais de outubro (185 entregas, 123 posts, 14 gravações, pico em 14/10 com 89 entregas).

## Telas
- `js/retrospectiva.js` + `styles/retro.css`: tela cheia, até 10 histórias com cores próprias, números que sobem, barras da semana, pódio, anel de "no prazo" e confete no fim. Toque/clique avança ou volta, segurar pausa, ← → espaço e Esc no teclado; pausa sozinha se a janela sai de foco. Respeita "reduzir movimento".
- Histórias sem número são puladas; a comparação com o mês anterior só aparece quando cresceu; o pódio não mostra % no prazo (é celebração).
- Onde abrir: botão "✨ Meu mês" no perfil, "✨ Retrospectiva" no Panorama (mês da tela), item "✨ Retrospectiva do mês" no menu do Alt do programa do Windows, e um aviso automático nos 5 primeiros dias do mês (uma vez por pessoa, guardado em `retro_vistas`).

## Testes
- `testes/retrospectiva.test.mjs` (13 conferências) entrou no `npm test`.
- Capturas de todas as histórias no PC e no celular conferidas.
