# zzz264 — Mensagens ricas da IA

- `js/ia-rico.js` (novo, `B7.IARico.html/texto`): "markdown da B7" seguro (tudo escapado) → títulos com barra, destaques por emoji (💡 dica, ⚠️ atenção, ✅ ok, 🚨 urgente, 📌 nota, citação), `:::numeros`, `:::cartao Título`, passos numerados, checklist, listas com ícone, tabela, divisória, `==marca-texto==`, `` `código` ``, links só para `#/rota` (botão) ou https. Entrada animada bloco a bloco (respeita reduzir movimento). `texto()` devolve texto puro para copiar/ouvir.
- CSS em `styles/ia-chat.css` (tokens, claro e escuro).
- Ligado em: Assistente (`ia-chat.js`, anima só a resposta nova), Suporte equipe/portal (`suporte.js`, inclusive em fluxo), resumo do WhatsApp (`whatsapp.js`; a resposta sugerida continua texto puro).
- Prompts: `_shared/ia/formato.ts` (`FORMATO_RICO`) usado por `chat.ts` e `suporte.ts`; resumo do WhatsApp em seções com emoji.
- Conferido com print de uma mensagem completa nos temas claro e escuro.
