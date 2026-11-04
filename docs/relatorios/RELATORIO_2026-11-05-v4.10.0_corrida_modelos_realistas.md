# v4.10.0: "Corre pro Set!" com modelos realistas

O Kevin pediu: "melhora os modelos, deixa mais realista! obstáculos mais bem feitos, quero tudo bem feito no joguinho".

## Modelos (`js/jogo-corrida-modelos.js`, novo)
Tudo é montado peça por peça na hora, sem arquivos de modelo para baixar. Cada molde é feito uma vez e clonado.
- **Texturas desenhadas na hora:**
  - piso de estúdio (concreto com placas e marcas de fita);
  - pista de borracha com as faixas pintadas;
  - tolex do case;
  - lateral do case com estêncil "B7 · ▲ FRÁGIL ▲";
  - fita zebrada, lona da cadeira "DIRETOR" e face da moeda com B7;
  - halos de luz e sombras de contato.
- **Reflexo de estúdio:** mapa de ambiente gerado a partir de painéis de luz (PMREM). Metais e vidro refletem.
- **Lâmpada:**
  - vidro de lâmpada A60 torneado, com transmissão física no PC e vidro translúcido no celular;
  - filamento em zigue-zague aceso, hastes, núcleo e aura de luz;
  - rosca de metal com sulcos, isolante e contato.
  - As skins mudam a cor do brilho, o tom do vidro e o da rosca.
- **Obstáculos:**
  - **pular:** treliça triangular de alumínio (tubos e diagonais) sobre dois sacos de areia, com fita zebrada;
  - **rastejar:** pórtico de duas torres de treliça, com treliça aérea, dois refletores PAR pendurados com a lente acesa e placa zebrada;
  - **desviar:** case de transporte com cantoneiras de alumínio nas 12 arestas, faixa da tampa, 8 cantos de bola cromados, travas, alças e rodízios. Em 35% das vezes aparecem dois cases empilhados.
- **Moeda:** borda dourada metálica com o B7 nas duas faces.
- **Cenário:**
  - refletor fresnel com abas, lente acesa e halo, em tripé com saco de areia;
  - cadeira de diretor de madeira com lona;
  - cabos e rolo de cabo no chão.
- **Diretor:**
  - tronco torneado, camisa, botões dourados, cinto com fivela, bolsos e lenço com ponta;
  - rosto com queixo, orelhas, nariz, bigode e cabelo, óculos escuros com hastes e boina com aro e pino;
  - braços com cotovelo, punho e mão, pernas com joelho, sapato com sola;
  - megafone branco e vermelho;
  - sombra no chão.

## No jogo (`js/jogo-corrida.js`)
- Chão e pista com textura, rolando com a velocidade. As listras de velocidade ficaram mais discretas.
- Obstáculos, moedas e cenário clonados dos moldes. Os limites de colisão continuam os mesmos.
- O diretor nasce mais perto da lâmpada (antes aparecia colado na câmera) e ganhou animação de cotovelo.

## Conferência
- Partida automatizada no navegador (menu, as 3 etapas do tutorial, tropeção com o diretor e fim da corrida), sem erros.
- `npm test` passou.
