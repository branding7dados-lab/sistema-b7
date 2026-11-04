# Pacote zzz10: tela de pesquisa (paleta) redesenhada e animada

Versão `2026-10-04-zzz10`, cache `roteiros-b7-v215`.

## O que estava errado
Cada item da pesquisa aparecia como um cartão com borda. Era o estilo das listas da Central (`.cp-item` em `styles/central.css`) vazando para a paleta, porque as duas usavam o mesmo nome de classe.

## Como ficou
- Todo o visual está escopado em `.paleta`, no bloco "PALETA (zzz10)" no fim de `styles/global.css`. O que vem da Central não passa mais.
- **Campo:**
  - é uma pílula com lupa;
  - ganha borda rosa quando está em foco;
  - tem o botão "Cancelar" só no toque;
  - o placeholder ficou mais curto: "Buscar no B7…".
- **Itens:**
  - não têm moldura e têm 58 px de altura;
  - o ícone é colorido pelo tipo: gravação rosa, roteiro violeta, design azul, vídeo laranja, pessoa verde, ação com "+" suave e logo do cliente sobre fundo branco;
  - nome e subtítulo são cortados com "…";
  - aparece uma seta › no item em foco ou sob o mouse.
- **Animação:**
  - a lâmina desce do topo, saindo do desfoque (0,48 s), e sobe ao fechar;
  - grupos e itens entram em cascata ao abrir e a cada novo resultado;
  - enquanto busca no banco, uma barra fina corre sob o campo e a lupa balança.
- O rodapé de teclado (↑↓ Enter Esc) só aparece onde há mouse e teclado.
- No modo leve não há vidro nem desfoque. Com "reduzir movimento" ligado, não há animação.

## Testes
`npm test` passou inteiro. Conferido em prints de 390 px (claro e escuro) e de 1280 px, com resultados de busca.
