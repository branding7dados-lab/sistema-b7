# v4.13.3 — Tela da demanda de vídeo

- Observações viraram "Sobre o vídeo" e subiram para o topo (antes do Legenda); destaque com borda na cor de acento.
- Títulos dos blocos padronizados (antes um grande e os outros minúsculos em caixa alta); Roteiros sem a borda rosa avulsa.
- Enviar ao cliente: texto à esquerda, botão à direita; Versões vazias mais baixas; Conclusão com barra junto do título.
- Conferido em tela de PC e de celular, claro e escuro, com dados simulados.

## 4.13.4
- Celular/tablet (≤900 px): o grupo Fluxo do painel lateral sobe para logo abaixo do título (2 colunas no tablet, 1 no celular); Contexto vai para o fim. Feito só com CSS (`display:contents` no aside + `order`).
