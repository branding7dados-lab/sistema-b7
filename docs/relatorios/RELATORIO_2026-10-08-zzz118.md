# Relatório — Transição da barra lateral refeita a partir do vídeo

**Versão:** `2026-10-08-zzz118` · **Cache:** `roteiros-b7-v323`
**Pedido:** vídeo da barra recolhendo e expandindo — "melhora essa animação, quero ela cinematográfica e mais fluida".

## O que o vídeo mostrava
Analisei o vídeo quadro a quadro:
1. **Duas etapas.** Ao recolher, os nomes apagavam primeiro e só depois a largura começava a mudar — um "soluço" no início.
2. **Nomes cortados ao expandir.** A largura crescia com os nomes já acesos, e eles apareciam cortados na borda ("Configur", "Visualizar c").
3. **Tudo de uma vez.** Os nomes surgiam todos juntos, sem ordem.

## O que mudou
- **Um movimento só.** A largura e os nomes andam juntos; saiu a espera de 90 ms antes de a barra começar a se mexer.
- **Mais longo e com freada suave:** 0,62 s (era 0,46 s), desacelerando no fim.
- **Ao expandir, os nomes entram em cascata**, de cima para baixo, deslizando da esquerda — e só depois que a barra já tem largura para eles. Os títulos das categorias entram na mesma cascata; o logo e o rodapé, por último.
- **Ao recolher, os nomes saem rápido**, também em cascata, e a largura começa devagar e acelera: quando a borda chega, eles já apagaram.
- **Nada é cortado seco:** durante o movimento a borda direita da lista se dissolve.
- **Um reflexo de luz atravessa o vidro** durante a transição (no sentido contrário ao recolher).
- **A cápsula do item ativo pulsa** — acende um pouco mais enquanto se adapta e volta ao brilho normal.
- Recolhida, o símbolo da marca entra crescendo e os fios que substituem os títulos aparecem por último.

**Sobre fluidez:** os nomes, o reflexo e a cápsula usam só transparência e posição. A largura da barra continua sendo a única coisa que obriga o conteúdo ao lado a se reorganizar a cada quadro — isso é inevitável enquanto a barra empurrar o conteúdo, e é o que pode pesar em telas com muito conteúdo.

## Arquivos alterados
`styles/nav.css`, `js/app.js` (o recolher virou um passo só), `js/nav.js` (ordem de cada item para a cascata), `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local, em 1440×1000, com o arquivo de estilos novo sem cache. Como o navegador de teste não roda animação, **parei a transição em instantes fixos e medi cada um**:
- **Recolher** — largura em 60 / 120 / 180 / 240 / 320 / 450 / 620 ms: 255 → 249 → 237 → 206 → 121 → 80 → 70 px. Aos 180 ms nenhum nome está mais visível, com a barra ainda em 237 px: **nenhum nome é cortado**. (Na primeira versão desta correção eles ainda eram cortados aos 160 ms; ajustei os tempos e medi de novo.)
- **Expandir** — a cascata aparece nas medidas: aos 260 ms o primeiro nome está em 68% de opacidade e os do meio e do fim em 0; aos 400 ms, 95% / 64% / 0; aos 620 ms, 100% / 98% / 85%.
- Captura da barra expandida no fim da transição, conferida.

## Não testado
- **O movimento de verdade.** Medi instantes parados; a sensação de fluidez e o "cinematográfico" só dá para julgar vendo. Se ainda engasgar, o próximo passo é fazer a barra passar por cima do conteúdo durante o movimento, em vez de empurrá-lo — é mais trabalho, mas tira o peso.
- O reflexo e o pulso da cápsula em tela (verifiquei que disparam, não como ficam).
- Tema escuro, modo leve e tablet.
