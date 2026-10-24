# zzz267 — Ferramentas de IA

## Servidor (b7-ia)
- `_shared/ia/extra.ts`: tarefa `extra` com operações `pedido`, `riscos`, `legenda`, `marca`, `ajustes`, `reuniao` (validar, permitido, contexto, mensagens, esquema JSON, limpadores).
- `b7-ia/index.ts`: corpo maior só para `extra/reuniao` (áudio até ~9 MB em base64), cliente só usa `pedido` (empresa conferida com `meu_papel_cliente`; sem memória interna na resposta), `riscos` só admin, memória do cliente só em `legenda`/`marca`, `prazoMs` por operação (reunião 120 s), `[[SEM_FALA]]` também na reunião.
- `deno check` do b7-ia passou; teste local das funções de `extra.ts` (validar/permitido/limpadores).

## Telas
- `js/ia-ferramentas.js` (`B7.IAFerramentas`): reunião (gravar 24 kbps até 40 min ou enviar áudio ≤6,5 MB), legenda (imagem reduzida a 1280 px JPEG), marca, riscos, ajustes→tarefas, perguntas do pedido. Respostas ricas via `B7.IARico`.
- Criar (topo): Ata de reunião, Legenda a partir da arte, Revisar na voz da marca.
- Design: "✨ Legenda com IA" nas peças aprovadas. Kanban: "✨ Virar tarefas com IA" no feedback (notas internas `☐ …`).
- Gestão: "O que olhar primeiro?". Portal → Pedidos: "✨ Conferir com a IA". Assistente: sugestão "Datas da semana".
- `js/ia.js`: `opcoes.prazo` (espera maior para a reunião).
