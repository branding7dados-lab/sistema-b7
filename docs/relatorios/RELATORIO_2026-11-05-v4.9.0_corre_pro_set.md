# v4.9.0: "Corre pro Set!", corrida infinita na manutenção

Pedido do Kevin: um jogo "no mesmo estilo do Subway Surfers", com obstáculos para pular, ir para a direita ou para a esquerda e rastejar por baixo, tutorial, "quando eu bato no obstáculo, vem o diretor do estúdio atrás de mim" e "sistema de coletar moedas pra mudar skin".
- É o mesmo gênero de jogo: corrida infinita em 3 faixas.
- Personagem, cenário, obstáculos e nome são da B7. Nada foi copiado do jogo citado.

## O jogo (`js/jogo-corrida.js`, novo)
- **Cenário 3D (three.js):**
  - pista de 3 faixas com bordas de neon e listras passando, que dão a sensação de velocidade;
  - refletores e cases nas laterais, fundo roxo e neblina.
- **Lâmpada da B7:** inclina ao trocar de faixa, gira no pulo, achata ao rastejar e deixa um rastro de luz.
- **Comandos:**
  - deslizar ←/→ ou setas/A-D: trocar de faixa (bater na lateral da pista conta tropeção);
  - ↑/W/espaço: pular;
  - ↓/S: rastejar (no ar, desce rápido).
- **Obstáculos:** o gerador sempre deixa uma faixa livre por fileira.
  - **Tripé deitado** com faixa de aviso: tem que pular.
  - **Varal de luz suspenso:** tem que rastejar.
  - **Case de equipamento:** tem que desviar. Bater de frente encerra a corrida.
- **O diretor:** um personagem de boina, óculos escuros e megafone dourado.
  - No primeiro tropeção (tripé, varal ou lateral), ele aparece correndo atrás por 7 s, com o aviso "O diretor está atrás de você!".
  - Um segundo tropeção nesse tempo, ou bater num case, termina em "O diretor te pegou!".
- **Moedas B7:** ficam numa carteira no aparelho, com fileiras na faixa livre e arcos sobre os tripés.
  - **Loja com 8 skins:** Clássica (grátis), Neon azul 150, Menta 250, Fantasma 400, Dourada 600, Lava 800, Arco-íris 1.200 (a cor vai mudando) e Diretora 2.000 (com boina).
  - **Continuar** a corrida uma vez, por 100 + distância/10 moedas. A volta tem escudo e remove os obstáculos próximos.
- **Poderes:** ímã (puxa moedas), ×2 pontos, superpulo e claquete-escudo (absorve uma batida). Começam a aparecer depois de 300 m.
- **Ritmo:** a velocidade sobe aos poucos até um teto, e a cada 500 m aparece um marco com apito.
- **Tutorial guiado:** roda na primeira vez e pelo botão "Como jogar".
  - Perto de cada obstáculo, o jogo quase para e mostra a dica (desviar, pular, rastejar) até a pessoa acertar.
  - No tutorial, ninguém perde.
- Fim de corrida com pontos, distância, moedas ganhas e novo recorde. Também tem som, vibração, tela cheia, pausa quando a aba some e "O sistema voltou!".

## Ranking
- `supabase/sql/migration_jogo_ranking_por_jogo.sql`, aplicada: coluna `jogo` em `jogo_pontos` e as funções `jogo_registrar_v2(p_pontos, p_jogo)` e `jogo_ranking_v2(p_jogo)`.
- Cada jogo tem o próprio ranking. As funções antigas continuam valendo para o "Ação! Corta!".

## Integração
- A tela de manutenção abre **"Corre pro Set!"** quando o aparelho tem WebGL. No menu, o link "ou jogue Ação! Corta!" troca de jogo. Sem WebGL, continua o "Ação! Corta!" em 2D.

## Conferência
- Partida automatizada no navegador:
  - menu e loja (compra da Dourada com 700 moedas, sobrando 100);
  - as 3 etapas do tutorial;
  - pulo, rastejo, tropeção com o diretor aparecendo e "O diretor te pegou!".
  - Nenhum erro de JavaScript.
- Antes disso, um erro na montagem da lâmpada quebrava o cenário. Ele foi corrigido, e agora uma falha na montagem não deixa o laço desenhar um mundo pela metade.
- `npm test` passou.
