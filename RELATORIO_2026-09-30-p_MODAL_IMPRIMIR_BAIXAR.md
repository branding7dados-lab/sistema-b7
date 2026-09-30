# Relatório 2026-09-30-p — Imprimir / Baixar roteiros no celular

Pacote: `atualizacao-2026-09-30-p.zip`. Inclui o **n** e o **o**. Só CSS, sem banco.

## Problema

Os modais "Imprimir roteiros" e "Baixar roteiros / Exportar" quebravam no celular:

- o conteúdo passava da largura da tela e era cortado à direita;
- a coluna de contexto (título, formatos, dica) aparecia em cima, repetindo informação e empurrando a seleção para baixo;
- a lista de roteiros ficava com cerca de 1,5 item visível;
- o rodapé ficava parcialmente fora da folha.

**Causa:** abaixo de 860 px, o grid virava `1fr` sem `minmax(0, …)`, e os títulos com `nowrap` alargavam a coluna além da tela.

## Correção

Em telas de até 860 px (`styles/global.css`):

- **Uma coluna só.** A coluna de contexto fica escondida no celular. No desktop ela continua igual.
- **Nada passa da largura da tela** (`min-width: 0` em toda a cadeia).
- **Folha na altura da tela** (`90dvh`):
  - topo visível;
  - lista rolando no meio, até 42% da altura;
  - **rodapé fixo** (contador, Cancelar e ação principal), com botões de 44 px e respeito à área segura do iPhone.
- **Títulos longos** quebram em até 2 linhas, em vez de cortar em uma.
- O ícone de documento foi removido de cada linha para ganhar espaço.

## Arquivos

- `styles/global.css`: bloco `@media (max-width:860px)` do modal de impressão.
- `sw.js`: cache **v114**.

## Tests

Playwright, 21/21, nos dois modais (Imprimir e Baixar):

- 369×800 (escuro), 369×600 (tela baixa, claro) e desktop 1280×800;
- em todos:
  - nenhum elemento passa da borda direita;
  - topo e rodapé visíveis;
  - lista com pelo menos 110 px;
  - sem erros JS.
- No desktop o layout de duas colunas continua igual.
