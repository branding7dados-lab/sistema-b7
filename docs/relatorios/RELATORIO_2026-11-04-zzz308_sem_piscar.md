# zzz308 — Telas sem piscar e IA sem travar

O Kevin mandou um vídeo: ao mudar uma demanda de edição de lugar, e em qualquer modificação, a tela "ficava atualizando", sem disfarçar. Ele também relatou lentidão e instabilidade na IA.

## Por que piscava
1. **Mover um cartão** (`moverNaTela` em `js/video.js`) redesenhava a tela inteira com a animação de entrada (`entra`) e a cascata dos cartões (`vd-troca`).
2. Logo depois, o **tempo real** (`js/tempo-real.js`) recebia a própria mudança do banco e chamava `B7.Rota.ir()`. Isso recarregava a tela do zero: esqueleto de carregamento, busca de tudo de novo e desenho outra vez. A marca `B7.recargaSilenciosa`, que a tela de vídeo já sabia respeitar, só era ligada no puxar-para-atualizar, nunca no tempo real.

## O que mudou
- `js/video.js`: o novo `redesenharQuieto()` redesenha sem entrada nem cascata e mantém a rolagem das colunas. Mover, e desfazer quando dá erro, usa ele.
- `js/tempo-real.js`, a atualização silenciosa agora:
  - liga `B7.recargaSilenciosa` enquanto a tela recarrega;
  - **blinda o painel**: enquanto atualiza, o `innerHTML` do painel recusa o esqueleto (`class="esq …"`). A tela antiga fica inteira até a nova estar pronta e então troca de uma vez. Vale para todas as telas, sem mexer em cada uma;
  - para as **partes que carregam sozinhas** (ex.: Oportunidades e Projetos dentro do cliente), uma parte com `id` que vira esqueleto recebe de volta o conteúdo anterior até a busca dela terminar;
  - guarda e devolve também as **rolagens internas** (colunas do quadro, listas), não só a da página;
  - não começa outra atualização enquanto uma ainda está rodando.
- `js/dashboard.js`: na tela do cliente, a atualização silenciosa não troca a seção pelo esqueleto.

## IA
No registro `ia_uso` de 03/11, às 14h, o chat deu **6 "tempo esgotado" seguidos** de 30 s cada. Era o Gemini (o chat manda ~6–11 mil tokens de contexto e por isso vai direto para ele), que aceitava o pedido e não mandava nada. Normalmente o primeiro pedaço chega em 1–2 s.
- `supabase/functions/_shared/ia/gemini.ts`: no fluxo do chat, se nada chegar em `GEMINI_PRIMEIRO_MS` (padrão 8 s), a ligação é largada e o mesmo pedido vai de novo, uma vez, com o tempo que sobrar. O pior caso cai de 30 s parado para uns 8 s e uma nova tentativa, que costuma responder em 1–2 s.
- Teste novo: `testes/gemini-fluxo.test.mjs` (trava na 1ª e responde na 2ª; trava nas duas e dá "tempo" com só 2 pedidos; caso normal com 1 pedido).

## Testes
- `testes/fumaca.mjs` ganhou "tempo real sem piscar" (Vídeo, Clientes, Cliente). Ele confere, quadro a quadro, que não aparece esqueleto nem tela vazia durante a atualização. Sem a correção, o caso do Vídeo falha.
- `npm test` passou inteiro.
