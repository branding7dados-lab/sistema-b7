# Relatório 2026-10-01-u — Calendário: visual e animações

Pacote: `atualizacao-2026-10-01-u.zip`. Inclui os pacotes n, o, p, q, s e t. É só front-end, sem migration.

## Visual

- **Cor por cliente.** Cada cliente recebe uma cor fixa: a barra lateral e o fundo do chip ficam na cor do cliente. O ícone continua indicando o tipo (gravação, publicação, vídeo, design). Antes quase tudo saía roxo, porque a cor vinha do tipo e 90% dos itens são publicações. Agora dá para bater o olho no mês e achar o cliente.
  - A cor sai de uma lista de 12 cores bem distintas, sorteada pelo id do cliente com o hash FNV-1a, então o mesmo cliente tem sempre a mesma cor.
  - Há versões próprias para o modo claro e para o escuro.
- **Barra do mês em cartão:** setas, Hoje, o nome do mês e um **resumo** ao lado ("3 gravações · 121 publicações · 23 prazos"), com Mês, Semana e Dia à direita.
- **Grade mais limpa:**
  - cantos arredondados e sombra leve;
  - cabeçalho dos dias com fundo suave;
  - células mais altas, com fundo que muda ao passar o mouse;
  - número do dia em círculo de 28 px;
  - **hoje** com o gradiente B7, brilho e uma linha de acento no topo.
- **Chips:**
  - cliente em negrito, na cor dele, e título em cinza;
  - sobem 1 px com sombra na cor do cliente ao passar o mouse e encolhem levemente ao clicar;
  - "+N mais" virou uma linha clicável discreta.
- **"+" no dia (admin e coordenação):** ao passar o mouse num dia de hoje em diante, aparece um "+" no canto que abre "Marcar gravação" já naquele dia. Não aparece em telas de toque nem para quem não é gestor.

## Animações

- **Trocar de mês:** a grade desliza no sentido da navegação, vindo da direita no próximo mês e da esquerda no anterior, em 280 ms. Semana e Dia fazem o mesmo.
- **Ao abrir, ao clicar em "Hoje" e ao trocar de vista:** o conteúdo surge com leve subida. Os chips entram em onda, célula por célula, com atraso máximo de 320 ms.
- **Dia de hoje:** o círculo pulsa uma vez ao entrar.
- **Filtros:** os chips aparecem rápido (180 ms), sem onda.
- **Listas da vista Dia, da agenda do celular e da Semana:** entram em cascata curta.
- **Botões:** setas e "Hoje" afundam levemente ao clicar.
- **Quando animam:** só quando chegam dados novos. A atualização em tempo real não reanima a tela.
- **Movimento reduzido:** com `prefers-reduced-motion`, todas as animações são desligadas e os efeitos de hover não se movem.

## Arquivos

- `js/calendario.js`: cor por cliente, botão "+", resumo do mês e estado de animação (próximo, anterior, entrada, Hoje, vista, filtro).
- `styles/calendario.css`: bloco "REFINO VISUAL v2".
- `js/auth.js`: versão 2026-10-01-u.
- `sw.js`: cache v119.

## Tests

Todos rodaram em Playwright, numa página de teste com dados simulados. O calendário em si é o código real.

- **Refino novo, 15/15:**
  - chips de clientes diferentes com cores diferentes;
  - resumo do mês;
  - "+" só em dias de hoje em diante, aparece no hover e abre "Marcar gravação" no dia certo;
  - designer não vê o "+";
  - próximo mês desliza da direita e o anterior da esquerda;
  - filtro com animação rápida;
  - sem rolagem lateral no desktop nem no celular de 390 px;
  - movimento reduzido desliga as animações dos chips;
  - nenhum erro de JavaScript.
- **Regressão:** suítes antigas do Calendário (`cal_int`, `cal_rt`, `cal_t`, agrupamento 11/11) e Oportunidades (43/43) continuam passando.
