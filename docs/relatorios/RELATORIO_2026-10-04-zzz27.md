# Relatório zzz27 — Kanban do vídeo de volta, arrastar no toque, menu ⋯ e sem o "dashboard"

Pedido (vídeo): "você destruiu o Kanban da edição de vídeo… tento selecionar pra mover e não move", animação do ⋯ "grotesca" (entrada e saída), e o cartão-resumo ("dashboard") estranho no Vídeo e no Design.

## Kanban do vídeo
- Voltou o quadro de verdade no celular (colunas com os cartões, como antes do zzz26).
- **Arrastar no toque**: segure o cartão ~0,35s → ele descola (vibra), segue o dedo, a coluna embaixo acende, a tela rola sozinha perto das bordas e, ao soltar, passa pela mesma ação do arrastar do computador (com as mesmas confirmações: correção pede o motivo, aprovação/entrega confirmam). Mexer o dedo antes do tempo é só rolagem. O "puxar para atualizar" não dispara durante o arrasto, e soltar não abre a demanda sem querer.
- Testado no navegador simulando toque: Pendente → Em edição chamou `mudarStatusVideo` e redesenhou.

## Menu ⋯ (todos os menus do sistema)
- Sólido (o vidro deixava o conteúdo de trás vazar e piscava no Android ao animar o desfoque).
- Entrada: nasce do botão com mola curta (escala + fade) e os itens entram em cascata leve.
- Saída: agora some suave (antes desaparecia de uma vez).

## "Dashboard"
- O cartão-resumo saiu do Vídeo e do Design. Voltaram as pílulas de contagem + aviso fino (Vídeo) e o "Revisar em sequência" + atalhos numa fileira (Design). A lista do Design agrupada por cliente continua.

Versão `2026-10-04-zzz27`, cache `roteiros-b7-v232`.
