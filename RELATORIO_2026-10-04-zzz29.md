# Relatório zzz29 — Arrastar no Kanban do vídeo: cartão preso na tela

Problema (print do Kevin): ao segurar um cartão do Kanban para mover, ele "descolava" e ficava parado na tela, por cima de tudo.

## Causa
No celular o cartão ainda tinha o arrastar nativo do navegador (`draggable`). No Chrome do Android, segurar o cartão fazia o navegador tomar o gesto para o arrastar nativo dele; o fim do toque nunca chegava ao código do B7 e o "fantasma" do cartão ficava preso.

## Correção
- No toque, o arrastar nativo é desligado; só o arrastar do B7 funciona.
- Travas: qualquer cancelamento do gesto (touchcancel, pointercancel, troca de app/aba, navegação) encerra o arrasto e some com o fantasma; cada redesenho da tela também limpa fantasmas órfãos. Os ouvintes do documento entram no início do toque e saem no fim (antes ficavam acumulando).
- **Mover sempre funciona**: segurar e soltar sem arrastar (ou o navegador interromper o arrasto) abre a folha **"Mover para…"** com as etapas coloridas — a atual aparece como "agora". Escolher uma passa pela mesma ação do arrastar (com as mesmas confirmações).

## Testado (toque simulado no Chromium)
- Arrastar Pendente → Em edição: moveu.
- Segurar e soltar: abriu a folha; escolher Standby: moveu.
- Cancelar o toque no meio do arrasto: nenhum fantasma na tela.

Versão `2026-10-04-zzz29`, cache `roteiros-b7-v234`.
