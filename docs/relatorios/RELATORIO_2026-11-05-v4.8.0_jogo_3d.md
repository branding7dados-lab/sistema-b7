# v4.8.0: "Ação! Corta!" em 3D

Pedido do Kevin: "quero o jogo 3D, bem mais elaborado e bonito, quero mais coisas, pra o jogo dopaminar a pessoa". No meio do trabalho ele pediu também: "no AÇÃO o diretor vira pra olhar pro jogador, e no CORTA vira de costas".

## O jogo (`js/jogo3d.js`, novo)
- **Cena 3D** (three.js r160, MIT, em `js/vendor/three.min.js`):
  - estúdio escuro com chão brilhante e passarela com bordas de neon que pulsam;
  - faixas de luz no chão, ciclorama roxo no fundo e 6 refletores com tripé;
  - poeira de luz subindo, neblina e sombras (só no PC).
- **A jogadora é a lâmpada da B7:** bulbo rosa com brilho, anéis da base e os pontinhos do logo orbitando. Ela balança e estica ao correr e deixa um rastro de luz.
- **O diretor** é uma câmera de cinema num tripé, com lente, dois rolos e a luz REC. Tem luz própria e uma aura que pulsa verde no AÇÃO e vermelha no CORTA.
  - **AÇÃO:** vira para o jogador e filma (luz verde, rolos girando). Pode correr.
  - **CORTA:** vira de costas (luz vermelha). Tem que soltar. A janela de reação é o tempo do giro, que encolhe a cada cena.
- **Regras e recompensas:**
  - continuar se mexendo depois da janela custa uma vida ("MEXEU NO CORTA!"), um tranco da câmera, vinheta vermelha e vibração, e a lâmpada volta 22% do caminho;
  - soltar dentro da janela vale **NO LIMITE!**: +150 × combo, e o combo sobe até ×5;
  - **ideias douradas** dão +50 × combo, **café** dá turbo de 3 s e a **claquete de ouro** dá +1 vida (rara, a partir da cena 2);
  - a **cena gravada** dá confete, estrelas de 1 a 3 (por não perder vida e pela rapidez), fanfarra e câmera lenta. Depois o diretor fica mais rápido e engana mais ("Aç…").
- **Interface:**
  - placar contando, barra de progresso, combo, vidas e gritos animados;
  - **som** sintetizado na hora (Web Audio), com botão de mudo, e **tela cheia**;
  - menu com recorde e **8 conquistas** (Primeira cena, Nervos de aço, Colecionador, Diretor favorito, Take perfeito, Pegando fogo, Lenda do set, Blockbuster), com aviso quando desbloqueia;
  - fim de partida com pontos, novo recorde e resumo.
- **Controles:** segurar o dedo/mouse ou espaço/↑/→. Para desviar e pegar ideias: A/← e D, ou arrastar o dedo para o lado enquanto segura.
- **Leveza:**
  - o three.js (167 KB compactado) só baixa quando a tela de manutenção aparece (`B7.vendor('three')`) e não entra no arranque;
  - no celular, a resolução é menor, sem sombras e com menos partículas;
  - o jogo pausa quando a aba fica escondida;
  - **sem WebGL**, cai no jogo 2D da 4.7.0.
- Ranking: as mesmas funções `jogo_registrar` e `jogo_ranking` da 4.7.0.

## Integração
- `js/sistema.js`: a tela de manutenção e a prévia do administrador usam `B7.Jogo3D.montarMelhor`. O "O sistema voltou!" também vale para a partida em 3D.
- `js/vendor-carregar.js`: a biblioteca `three` foi adicionada. Ao vendorizar o arquivo, foi retirado o aviso "deprecated" que ele imprimia no console.

## Conferência
- Navegador com WebGL por software (PC e celular): menu, partida, AÇÃO (diretor de frente) e CORTA (de costas), sem erros de JavaScript.
- `npm test` passou.
