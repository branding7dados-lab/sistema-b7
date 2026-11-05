# v4.11.0 — Corre pro Set!: física, trens, prancha, música + Memória do Set

## Corre pro Set!
- **Física de plataformas:** cases, trens e rampas são sólidos. O "chão" é o topo mais alto debaixo da lâmpada; dá para pousar em cima (superpulo 16 alcança 3,7 m), subir rampa (0 → 2,6 m em 6 m) e cair quando o trem acaba. Bater de frente = fim; bater de lado num trem mais alto = quica de volta (tropeço).
- **Trens** (`MD.trem`, 1–3 vagões de 9 m, topo 2,6 m): parados com rampa (60%) e moedas no teto, ou em movimento vindo na direção da pessoa (após 400 m). Sempre sobra uma faixa livre.
- **Prancha:** toque 2× / tecla E / Shift / botão 🛹. 30 s; segura uma batida (1,6 s invencível piscando). 3 grátis; loja vende por 🪙 300 (`b7_corrida_pranchas`).
- **Ímã:** puxa todas as moedas das 3 faixas num raio de ~14 m à frente.
- **Música:** sequenciador WebAudio (baixo, arpejo, bumbo, chimbal em lá menor), BPM sobe com a velocidade; respeita o mudo.
- **Pausa** agora retoma com toque/tecla.
- **Otimização:** HUD só escreve no DOM quando muda; poderes reaproveitam geometria/material; sem `filter`/`includes` por quadro; cor do arco-íris reaproveitada; geração mais perto (dentro da neblina).
- `b7_corrida_teste` no localStorage força trens (só para teste automatizado).

## Memória do Set (js/jogo-memoria.js)
- 3 fases (12/16/20 cartas) contra o relógio, espiada inicial, combo, bônus de tempo, ranking `jogo_registrar_v2(p_jogo='memoria')` (migration `supabase/sql/migration_jogo_memoria.sql`, aplicada).

## Menu "Outros jogos"
- sistema.js passa `jogos` para a corrida: Ação! Corta!, Memória do Set (com volta para a corrida) e Clássico 2D.
