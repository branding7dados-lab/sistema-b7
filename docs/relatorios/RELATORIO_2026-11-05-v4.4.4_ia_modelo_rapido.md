# v4.4.4: IA mais rápida (modelo rápido na frente, padrão de reserva)

O Kevin pediu: "vê se tem alguma coisa para melhorar na inteligência artificial".

## O que os dados mostraram (`ia_uso`, últimos 14 dias)
| recurso | pedidos | falhas | metade em até | 90% em até |
|---|---|---|---|---|
| chat | 55 | 7 (todas antes das correções de 04/11) | 1,6 s | 30 s |
| legendas (srt) | 12 | 2 | **14 s** | **45 s** |
| WhatsApp | 11 | 0 | **13 s** | 19 s |
| linha, voz, demandas, riscos, suporte, legenda | 19 | 0 | ~1–2 s | até 25 s |

O chat ficou estável depois das correções de ontem. O ponto fraco era o **Gemini**: legendas, WhatsApp e tudo o que vai direto para ele demoravam dezenas de segundos.

## Medição (05/11, mesma revisão de legenda: 395 tokens de entrada, ~330 de saída)
| modelo | tempo |
|---|---|
| gemini-3.5-flash-lite (o de antes) | 13 a 33 s |
| **gemini-3.5-flash** | **2,4 a 4,4 s** (às vezes "sobrecarregado") |
| gemini-flash-lite-latest | 14 s |
| gemini-3.1-flash-lite | sobrecarregado |
| gemini-3.8-flash | não aceita "pensar pouco" |
| 2.5-flash / 2.5-flash-lite | indisponíveis para chaves novas |

## O que mudou (`supabase/functions/_shared/ia/gemini.ts`)
- Cada pedido tenta primeiro o **modelo rápido** (`gemini-3.5-flash`). Se ele responder sobrecarregado, limite, cota ou modelo indisponível, ou travar sem mandar nada, o mesmo pedido vai para o **padrão** (`gemini-3.5-flash-lite`), com o tempo que sobrou.
- Pedido inválido e recusa por conteúdo não trocam de modelo.
- No modo fluxo, a troca só acontece enquanto nenhum texto saiu para a tela.
- O ajuste "pensar pouco" agora é lembrado por modelo: se um modelo recusar, o outro continua com ele.
- Segredo opcional `GEMINI_MODELO_RAPIDO` para escolher outro modelo rápido. Com `nenhum`, volta ao comportamento antigo.
- O roteamento Groq → Gemini (`duplo.ts`) não mudou.

## Custo
É a mesma chave. Na camada gratuita, o Flash tem limites diários menores que o Flash-Lite. Quando o limite do Flash acaba, o pedido cai sozinho no Flash-Lite. Se o faturamento do Google estiver ligado, o Flash custa um pouco mais por token, mas no volume do B7 (dezenas de pedidos por dia) a diferença é de centavos.

## Conferência
- 10 testes em `testes/gemini-fluxo.test.mjs`, 5 deles novos: o rápido vai primeiro; sobrecarregado ou limite cai no padrão; pedido inválido não troca; `nenhum` desliga.
- `testes/duplo.test.mjs` passou.
- `npm test` passou.
- A função de diagnóstico temporária (`b7-diag-imagem`) foi desligada (responde 410).
