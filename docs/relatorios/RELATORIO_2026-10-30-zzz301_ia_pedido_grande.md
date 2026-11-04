# zzz301 — IA: pedido grande vai direto ao Gemini

## Medido (ia_uso + logs, 30/10, depois da zzz300)
- As 3 mensagens do chat caíram no Gemini: o Groq devolveu **413** ("pedido grande demais") nas três. O chat manda ~9.300 tokens de contexto e o limite da camada gratuita do Groq para o gpt-oss-120b é ~8 mil tokens por minuto.
- Mesmo assim, o Gemini respondeu em **1,2–1,6 s** com o ajuste de "pensar pouco" da zzz300. Antes: mediana de 2,9 s e 1 em 10 acima de 13 s.

## O que mudou
- `duplo.ts`: estima os tokens do pedido (caracteres ÷ 3,5 + resposta pedida). Acima de `GROQ_LIMITE_TOKENS` (padrão 6000), o pedido vai direto ao Gemini, sem a tentativa perdida no Groq. Pedidos pequenos (WhatsApp, riscos, resumos curtos) seguem no Groq.

## Conferido
- `deno check` sem erros; teste simulado: pedido grande vai só ao Gemini, e os demais casos da zzz300 continuam passando.
