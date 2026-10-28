# zzz276 — Cliente avulso sem "Como trabalhamos"

**Versão:** `2026-10-28-zzz276` · cache `roteiros-b7-v478`

Kevin perguntou o que pôr em "Como trabalhamos com este cliente" para um cliente avulso. Resposta: nada. Esse campo diz o que a B7 faz **todo mês** (linha editorial, pauta semanal, roteiros), e o cliente avulso não tem mês; o trabalho dele está no projeto.

- Em Novo cliente e Editar cliente, marcar **Avulso** esconde o campo. Voltar para **Mensal** mostra de novo.
- O valor guardado não muda: se o cliente virar mensal mais tarde, as marcações antigas continuam lá.

Arquivos: `js/dashboard.js` (`ligarContrato`, `data-campo-modo`), `styles/dashboard.css`, `js/novidades.js`, `js/auth.js`, `sw.js`.
