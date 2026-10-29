# zzz294 — Legendas: carregamento novo, com frases

**Pedido:** "melhora essa parte do carregamento da legenda, adiciona umas frases… tipo lendo as legendas, corrigindo…"

## O que mudou (`js/legendas.js`, `styles/video.css`)
- Frases que trocam a cada ~2,4 s com animação: "Lendo as legendas…", "Ouvindo o jeito de falar…", "Conferindo acentos…", "Arrumando maiúsculas…", "Colocando vírgulas e pontos…", "Procurando nomes de marcas…", "Transformando “cem por cento” em 100%…", "Conferindo palavra por palavra…", "Deixando o “pra” e o “tá” do jeitinho…", "Revisando com carinho…" e, perto do fim, "Quase lá…".
- Subtítulo com a quantidade de legendas (e "parte X de Y" quando é mais de uma parte).
- Porcentagem e barra que andam de verdade: antes, com uma parte só, a barra ficava parada em 0%. Agora ela avança suave até perto do fim de cada parte, nunca passa dela, e fecha em 100% quando termina.
- Brilho correndo na barra; entrada animada; respeita "reduzir movimento".

## Versão
- `VERSAO` 2026-10-29-zzz294 · cache `roteiros-b7-v496`.
