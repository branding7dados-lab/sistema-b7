# Relatório zzz230 — Abertura estilo streaming

Pedido do Kevin: "agr qnd fosse abrir eu queria estilo aquela intro da netflix sabe?!"

A ideia é a gramática da intro (logo no preto, duas batidas, mergulho no logo que vira faixas de luz). Não usa a marca nem o som da Netflix: é o logo da B7, nas cores da B7, com som sintetizado próprio.

## A sequência (4,9 s, padrão a partir desta versão)
| Tempo | Imagem | Som |
|---|---|---|
| 0,25–0,75 s | o logo surge no preto | 0,42 "tu": batida grave curta |
| 0,86 s | a lâmpada brilha | "DUM": a batida grande, com sala, e um acorde de sinos |
| 0,75–1,75 s | a câmera se aproxima devagar | coral e riser começam a subir |
| 1,75–2,40 s | **mergulho**: a palavra sai e a câmera entra na lâmpada | ar entrando |
| 2,15–4,0 s | dentro dela, **faixas verticais de luz** nas cores do logo se abrem, deslizam e passam pela câmera | impacto suave, cama, faixas passando pelos lados (estéreo), brilhos |
| 3,5–4,0 s | as faixas aceleram para fora e somem | sopro |
| 3,9–4,45 s | o logo volta nítido; a palavra se escreve | assinatura e uma nota por letra |
| depois | o voo do logo para o lugar dele no sistema (como antes) | saída |

## Escolher o estilo
Configurações → Aparência → **"Estilo da abertura"**: Streaming (padrão), Big bang (partículas, zzz227–229) ou Clássica. Vale neste aparelho e continua depois de sair da conta. A escolha é aplicada no `<head>` do index.html, antes da primeira pintura. Quem tinha desligado "Partículas na abertura" fica com a Clássica.

## Arquivos
- `styles/abertura.css`: sequência `abStMarca`/`abStCor`/`abStPalavra`, só com `data-ab-estilo="streaming"`, na completa e sem "reduzir movimento".
- `js/abertura-faixas.js` (novo): as faixas, em canvas, no relógio da animação do logo.
- `js/abertura-som.js`: `ROTEIRO_STREAMING`, com as batidas `tumba()`.
- `js/app.js`: `B7.duracaoAbertura()` (4,9 s no streaming, 6,4 s nos outros). Usado na saída, no "Testar abertura" e no Painel de TV.
- `js/app.js`: a cópia da abertura agora sai sem os `<canvas>` das camadas. Antes, a cópia levava junto o canvas que já estava na tela.

## Testes feitos
- Quadros no computador e no celular; vídeo com som.
- A abertura sai sem sobras.
- "Testar abertura" roda as faixas.
- Trocar para Big bang roda as partículas.
- A curta (recarregar) não mudou.
- Quem desligou as partículas cai na Clássica.
- Trilha renderizada: pico 0,79; espectro conferido.
- Sem erros no console; `npm test`.

## Não testado
- Android real e programa de Windows.
