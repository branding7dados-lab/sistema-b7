# Relatório zzz229 — Abertura épica e trilha sonora nova

Pedido do Kevin: "acho que ainda dá pra melhorar a trilha sonora tb, e deixar mt mais cinematografico ainda, muito mais. (so n adiciona tarja preta)". Nenhuma tarja preta foi adicionada.

## Trilha (js/abertura-som.js), ainda 100% sintetizada, sem arquivo
| Tempo | Som |
|---|---|
| 0,0 s | boom distante, pedal grave e um **coral** sintetizado (vozes "aah") que cresce do escuro |
| 0,4 / 0,95 s | as duas notas de sino (a pergunta) |
| 0,7 / 1,3 / 1,95 s | **luzes passando rente à câmera**, atravessando o estéreo de um lado para o outro (com efeito Doppler) |
| 1,6–3,3 s | **brilhos** da escala de dó, cada vez mais juntos, espalhados no estéreo: a lâmpada se montando |
| 1,8–3,33 s | **prato ao contrário** subindo e cortando seco |
| 3,30 s | **fôlego**: um instante quase mudo antes do golpe |
| 3,4 s | **impacto de trailer**: sub-grave, batida, ar, braam maior, golpe metálico, boom longo e o coral em acorde cheio |
| 3,5–5,2 s | **brasas** estalando |
| 4,62 s | **uma nota para cada letra** do "Branding7", andando da esquerda para a direita |
| 5,5 s | assinatura (sol → dó) com o coral embaixo |

A reverberação agora é de "sala de cinema": pré-atraso, primeiras reflexões, cauda de 4,6 s que escurece com o tempo e lados diferentes (largura estéreo). Pico medido: 0,91, sem estourar; o compressor do mestre continua. A versão curta (recarregar) não mudou.

## Imagem (js/abertura-particulas.js)
- **Feixes de luz volumétricos** nascem na ignição atrás da lâmpada, giram devagar e se apagam quando o logo assenta.
- **Brasas** saem de onde estavam os pontos e sobem tremulando por 2 a 4 s.
- Erros na montagem das partículas agora aparecem no console com `window.B7_DEBUG_ABERTURA = 1` (antes eram engolidos em silêncio).

## Testes feitos
- Trilha renderizada fora do tempo real (`B7.SomAbertura.ensaio`). Conferidos o pico, a curva de volume e o espectro (cada camada no seu tempo).
- Vídeo com som da sequência inteira.
- Quadros no computador e no celular.
- Sem erros no console.
- `npm test`.

## Não testado
- Som em alto-falante de celular real (o compressor segura o volume, mas o grave depende do aparelho).
- Android real e programa de Windows.
