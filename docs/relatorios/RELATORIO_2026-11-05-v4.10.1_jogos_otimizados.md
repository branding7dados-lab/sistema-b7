# v4.10.1 — Jogos da manutenção otimizados

- Corre pro Set!: geometrias fundidas por material, moeda em 1 malha, vidro sem transmission, cenário lateral reduzido (9 grupos, metade no celular), 2 luzes pontuais no PC e 0 no celular, sombras em tempo real trocadas por sombra de contato, sem listras de velocidade e sem marca no chão.
- Ação! Corta!: luzes pontuais só nos 2 primeiros softboxes (e não no celular), shadow map 512, ideias sem sombra.
- Ambos: pixel ratio limitado (1.25 celular / 1.5 PC) e qualidade adaptativa (baixa a resolução se o quadro passa de 24 ms, sobe se fica abaixo de 15 ms).
- Medição (renderizador por software, sem GPU): Corrida 2,1 → 4,7 fps e 282 → 241 draw calls. Em GPU real o ganho é proporcionalmente maior.
