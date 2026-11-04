# v4.7.0: jogo "Ação! Corta!" na tela de manutenção

Pedido do Kevin: um joguinho na tela de manutenção, "tipo batatinha frita 1, 2, 3".

## O jogo (`js/jogo-manut.js`, novo)
- É a batatinha frita num set de gravação.
  - **AÇÃO!**: a pessoa segura o dedo, o mouse, o espaço ou a seta →, e a lâmpada da B7 anda até a câmera.
  - **CORTA!**: a luz da câmera fica vermelha e é preciso soltar. Há uma pequena tolerância de reação. Se a pessoa continua se mexendo, perde uma vida e volta um quarto do caminho. São 3 vidas.
- Cada chegada na câmera conta uma cena. A cada cena, o diretor fica mais rápido (as fases encurtam), e a partir da 2ª cena às vezes engana ("Aç…" curtinho e já corta).
- **Pontos** = cenas × 1000 + a distância andada.
- **Recorde** pessoal fica no aparelho (`localStorage`).
- **Ranking da equipe**: top 5, com o melhor resultado de cada pessoa.
- Desenhado em canvas, com a lâmpada real da marca, sem baixar nada. Funciona nos temas claro e escuro, com toque, mouse e teclado. Com "reduzir movimento" ligado, a tela não treme.
- Para sozinho quando a tela de manutenção sai.

## Integração (`js/sistema.js`)
- O jogo entra na trava da manutenção e na **prévia** do administrador, que já existia em Configurações → Manutenção. Assim dá para testar sem ligar a manutenção.
- **"O sistema voltou!"**: se a manutenção acaba com uma partida em andamento, a trava não some. O jogo pausa e aparece o aviso com o botão "Entrar no B7". Quem não estava jogando é liberado como antes.

## Banco (`supabase/sql/migration_jogo_manutencao.sql`, aplicada)
- Tabela `jogo_pontos` com RLS ligada e sem políticas: só as funções acessam.
- `jogo_registrar(p_pontos)`: só para quem está logado, com no máximo um registro a cada 5 s por pessoa e teto de 1.000.000.
- `jogo_ranking()`: top 5 por pessoa, com o nome no formato "Primeiro S.". Clientes ficam de fora.

## Conferência
- Prints da partida no computador (tema escuro) e no celular (tema claro), sem erros de JavaScript.
- `npm test` passou.
