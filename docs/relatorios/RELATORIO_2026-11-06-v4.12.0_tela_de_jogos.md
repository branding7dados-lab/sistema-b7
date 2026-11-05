# v4.12.0 — Tela de jogos na manutenção

- `comJogo` (js/sistema.js) monta `.jhub`: cartões para escolher o jogo (Corre pro Set! e Ação! Corta! só com WebGL; Memória do Set e Clássico 2D sempre).
- Ao escolher, aparece uma barra com abas de todos os jogos; trocar chama `parar()` do jogo atual, limpa o palco e monta o novo.
- O link "Outros jogos" de dentro da corrida e o "voltar" da memória deixam de ser usados (a barra cuida disso).
- Desfoque do fundo também desligado com `.jhub` na tela.
