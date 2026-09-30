# Relatório 2026-09-30-k — Página da gravação e modais (UI/UX)

Pacote: `atualizacao-2026-09-30-k.zip` (inclui j, i, h e g). Só front-end; banco intocado.

## Página da gravação
- **Botões ⋯ estavam vazios** (o CSS global apagava o traço do ícone) — agora ícone sólido, no topo e em cada item.
- **Status ao lado do título**, não mais solto no canto.
- **Fatos clicáveis**: clicar em Mês de referência / Responsável abre "Editar"; clicar na Data abre "Remarcar" (lápis aparece no hover; sempre visível no toque).
- **Data com contexto**: "Hoje", "Amanhã", "em N dias" ou "a data passou" (borda âmbar); "sem horário" virou "horário a definir", discreto.
- **Ação principal muda com o momento**: sem data → "Marcar data"; data chegou/passou ou tudo gravado → "Concluir gravação" em destaque; senão "Remarcar".
- **Checklist mais leve**: cartões brancos com borda; checkbox com contorno visível e prévia do ✓ no hover; "Não gravado" removido (o checkbox já diz); "Gravado por X" com ✓ verde; "Abrir roteiro" virou link (sem caixa); barra de progresso maior no cabeçalho.
- **Detalhes sem repetição**: saíram Status/Mês/Data/Responsável (já estão no topo); ficaram Local (com "Adicionar local"), Roteiros (preparação), Criada e Concluída.
- **Histórico limpo**: marcar e desmarcar o mesmo item em até 30 min se anulam na leitura; mostra os 6 últimos + "Ver histórico completo (N)" com tudo. Pontos coloridos por tipo (gravado verde, remarcada âmbar, cancelada/removido vermelho).
- **Menu ⋯** com ícones; "Abrir roteiros" saiu do menu (já é botão).

## Modais
- Mesmo padrão da "Nova gravação": descrição abaixo do título, rótulos em caixa-alta com espaço, blocos com respiro.
- **Remarcar**: data em linha inteira (sem a célula vazia), horário "início até fim", explica o que acontece sem horário; mostra cliente e data atual.
- **Editar**: responsável e local lado a lado; ajuda do mês legível.
- **Mês de referência** (Nova gravação, Editar, Definir mês): atalhos "Este mês · Setembro" e "Próximo mês · Outubro".
- Cancelar, Trend e Avulso no mesmo padrão.

## Tests (executados — harness Playwright, dados simulados)
- Telas 1440 claro/escuro e 390; modais Remarcar, Editar, menu e Nova gravação — sem rolagem lateral.
- Atalho de mês preenche e conta como escolha manual; clicar na data abre Remarcar; no responsável abre Editar; data passada → Concluir é a ação principal; sem erros de JS.
- Regressões: lista de gravações (13 checagens), Google, fluxos de item/remarcar/nova gravação; `node --check` em todos os JS.

Não testado: login real no app publicado.
