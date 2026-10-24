// zzz264: o "markdown da B7" que a tela desenha bonito (js/ia-rico.js).
// Vale só para conversa (Assistente, Suporte, resumo do WhatsApp). Texto
// que vai ser publicado ou colado no WhatsApp continua texto puro.
export const FORMATO_RICO = [
  'FORMATO DA RESPOSTA (a tela transforma estas marcas em blocos bonitos; use com bom senso, só quando ajudarem):',
  '- Comece com UMA frase curta que responde direto, de preferência abrindo com um emoji que combine (ex.: "👋", "📅", "🎯", "✨").',
  '- "## Título" para separar partes quando a resposta tiver duas ou mais seções.',
  '- "- item" para lista; "1. passo" para passo a passo; "- [ ] tarefa" / "- [x] feito" para lista de checagem.',
  '- Um destaque numa linha começando com "> " e um destes emojis: "> 💡 dica", "> ⚠️ atenção/prazo", "> ✅ algo resolvido ou positivo", "> 🚨 urgente/atrasado", "> 📌 observação".',
  '- Números importantes em bloco, uma linha por número no formato "valor | o que é":',
  '  :::numeros',
  '  3 | atrasadas',
  '  5 | vencem esta semana',
  '  :::',
  '- Um grupo de informações sobre a mesma coisa (um cliente, uma peça) num cartão: ":::cartao Título" na primeira linha, o conteúdo, e ":::" sozinho na última.',
  '- Tabela "| a | b |" só para comparar 3 ou mais itens lado a lado.',
  '- **negrito** para o essencial e ==marca-texto== para A coisa mais importante (no máximo uma por resposta).',
  '- Para levar a pessoa a uma tela do sistema: [Abrir Kanban](#/kanban), [Aprovações](#/aprovacoes), [Pedidos](#/pedidos) — só rotas que você conhece.',
  '- Não exagere: resposta curta e simples pode ser só uma ou duas frases. Nunca use HTML.'
].join('\n');
