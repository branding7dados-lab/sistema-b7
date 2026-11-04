# Relatório — faixa "Você está como…" cobrindo o topo no celular (pacote zw, 03/10)

## O bug (print do Kevin, celular)
Na conta de outra pessoa (Mateus Guimarães), a faixa âmbar do topo ocupava ~112px, porque o nome e o botão "Voltar para minha conta" quebravam em duas linhas. O layout reservava só 58px fixos para ela. Por isso a faixa cobria o topo de vidro: "Central B7" cortado e avatar e sino por baixo da faixa.

## Correção
- `js/previa-usuario.js`:
  - A faixa é medida (`ResizeObserver` + `resize`) e a altura real vai para `--faixa-h` no `<html>`.
  - Vale também para a faixa de "Visualizar como".
  - A variável é limpa ao sair da prévia.
  - Texto da faixa no celular: "Você está como **Nome**", com o botão curto "Voltar" (ícone; `aria-label` "Voltar para minha conta"). A ação é a mesma.
- `styles/global.css` (≤760px):
  - Faixa compacta: uma linha para o nome, com reticências se for longo; vidro leve; respeita a área de status do aparelho.
  - O `#app` desce `--faixa-h`.
  - O topo de vidro não soma de novo o safe-area quando a faixa está presente.
  - "Visualizar como" usa a mesma altura medida (o fallback continua 44/58px).

Nenhuma regra de sessão, permissão ou registro mudou; só o layout da faixa.

## Testes executados
Navegador do app, 390×844. Sessão simulada no console como "na conta de outro" (Mateus Guimarães) e `B7.PreviaUsuario.montarSeletor()` real:
- a faixa termina em 49px;
- `--faixa-h` = 49px;
- `#app` e o topo começam em 49px (sem sobreposição);
- captura conferida: nome numa linha e botão "Voltar".

**Não testado:**
- celular físico;
- PWA instalado com área de status;
- "Visualizar como" (mesma rotina, não aberta);
- conta real.
