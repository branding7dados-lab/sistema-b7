# Relatório zzz228 — Abertura com câmera 3D

O que o Kevin pediu, depois da zzz227: "Eu quero mais cinematográfico ainda!"

## O que mudou (js/abertura-particulas.js)
As partículas agora vivem num espaço 3D e a tela é a vista de uma câmera:
- **Voo pela nebulosa (0–1,6 s):** a câmera avança por um redemoinho de luz em profundidade. Os pontos de longe são pequenos; os que passam perto crescem e saem pelas bordas da tela.
- **Foco de lente:** fora do plano de foco, o ponto fica maior e mais apagado (desfocado). Atrás de tudo, **bokeh** (discos grandes e fora de foco) passa perto da câmera e **nuvens de cor** formam uma nebulosa ao fundo.
- **Montagem (1,6–3,1 s):** os pontos vêm do fundo, com perspectiva, e montam a lâmpada no plano de foco, nítidos.
- **Ignição (3,4 s):** a explosão também é 3D: parte das faíscas voa **na direção da lente**, cresce e passa pela câmera.
- A escrita do "Branding7", o som, o voo do logo e a chave "Partículas na abertura" continuam como na zzz227.
- No celular, as faíscas que chegam perto da lente têm tamanho máximo menor, para não cobrir a tela.

## Testes feitos
- Quadros de 0,5 s a 5,6 s no computador e no celular; vídeo da sequência inteira (30 quadros por segundo).
- Sem erros no console; `npm test` local.

## Não testado
- Android real e programa de Windows.
