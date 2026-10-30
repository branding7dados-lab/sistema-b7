# zzz300 — IA mais rápida: Groq na frente, Gemini de reserva

## Por quê
O registro de uso (ia_uso, 14 dias) mostrou o Gemini gratuito lento: chat com mediana de 3 s e 1 em 10 acima de 13 s; WhatsApp levava 9,5 s para um pedido de ~350 tokens que devolve 19. É fila da camada gratuita, não tamanho do pedido.

## O que mudou
- **`_shared/ia/groq.ts`** (novo): provedor Groq (API no formato da OpenAI), com fluxo (SSE). Modelo padrão `openai/gpt-oss-120b` (de produção no Groq), com `reasoning_effort: low` e sem o raciocínio na resposta. Segredos: `GROQ_API_KEY` (obrigatório) e `GROQ_MODEL` (opcional).
- **`_shared/ia/duplo.ts`** (novo): com as duas chaves, o Groq atende o texto e o Gemini fica de reserva.
  - Vão direto para o Gemini: áudio, imagem e tarefas "finas" (`srt`, `legenda`, `marca`).
  - Se o Groq falhar (limite, fora do ar, modelo retirado, resposta vazia ou fora do formato que a tarefa aceita), o mesmo pedido vai uma vez para o Gemini. No fluxo do chat, só se nada tiver aparecido na tela.
  - Registro: `ia_uso.provedor` = `b7:groq` ou `b7:gemini`; `houve_fallback` quando trocou.
- **`servico.ts`**: `provedorAtual` = OmniRoute (se configurado) → Groq+Gemini → só um deles. Passa `fino` e `valida` (o limpador da tarefa) ao provedor.
- **`gemini.ts`**: pede `thinkingConfig.thinkingLevel = 'minimal'` (os 3.x pensam antes de responder; para reescrever trecho é só espera). Se o modelo recusar com 400 falando de thinking, repete sem o ajuste e não tenta mais naquela instância. `GEMINI_THINKING=padrao` desliga.
- **`b7-ia/index.ts`**: marca `fino` para `srt`, `legenda` e `marca`.

## Conferido
- `deno check` de `b7-ia/index.ts` sem erros.
- Teste com respostas simuladas: texto vai para o Groq; 429 do Groq cai no Gemini; legenda e imagem vão direto ao Gemini; fluxo do Groq em pedaços com tokens; Groq fora do formato vai para o Gemini; Gemini pede pensar pouco e, se recusar, repete sem e não tenta mais.

## Para acompanhar
`select provedor, recurso, count(*), percentile_cont(0.5) within group (order by duracao_ms) from ia_uso where created_at > now()-interval '1 day' group by 1,2;`
