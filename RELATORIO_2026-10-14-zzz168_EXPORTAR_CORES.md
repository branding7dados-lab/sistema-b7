# Relatório — exportar PDF/PNG voltou a funcionar (zzz168, 14/10)

Com o motivo aparecendo na caixa (zzz166), o erro ficou claro:
**"Attempting to parse an unsupported color function "color""**.

Causa: desde o zzz163 as cores do sistema seguem a paleta escolhida usando
`color-mix(...)`, que o navegador entrega como `color(srgb …)`. A biblioteca
que fotografa a folha para virar PDF/PNG (html2canvas 1.4) é antiga e não
entende esse formato — então toda exportação falhava (no PC, no navegador e
no celular), não só no programa do PC.

Correção: troquei pela **html2canvas-pro 1.5.8** (mesma biblioteca, mantida,
com suporte a `color()`, `oklch` etc.; mesmo nome e mesmo uso). Testado: a
antiga dá exatamente o erro do print; a nova desenha a folha certa.
Vale para roteiros (PDF/PNG), status semanal e resumo do mês.
