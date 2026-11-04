# v4.10.2 — Jogos sem travar

- Causa principal: `.mn-trava` (tela de manutenção) usa `backdrop-filter: blur(14px)` em tela cheia, e o botão de som do jogo tinha `blur(8px)` em cima do canvas WebGL. Com o jogo animando, o navegador refazia o desfoque todo quadro. Agora, com jogo na tela (`.mn-trava:has(.j3,.jc,.jm)`), sem desfoque e fundo sólido.
- Ambos os jogos: sem antialias, pixel ratio máximo 1,25 (PC) / 1 (celular), sem sombras reais, sem PointLights de cenário; qualidade adaptativa reage em ~0,5 s (>20 ms baixa 0,25, mínimo 0,5).
- Corrida: neblina e alcance da câmera menores (80/85), desenha menos coisas lá no fundo.
