# Relatório — Produção de Vídeo abre no Kanban

**Versão:** `2026-10-07-zzz73` · **Cache:** `roteiros-b7-v278`
**Pedido:** "essa tela tem que abrir no kanban, e não na lista."

## O que mudou
A tela **Produção de Vídeo** (Edição de vídeo) passa a abrir na visão **Kanban**. Antes o padrão era Lista.

A troca Lista/Kanban continua funcionando igual: se a pessoa escolher Lista, a escolha vale enquanto a aba do navegador estiver aberta; ao abrir o B7 de novo, volta ao Kanban.

## Arquivos alterados
`js/video.js` (uma linha: o padrão da visão), `js/auth.js` (versão), `sw.js` (cache).

## Testes executados
Nenhum teste em tela: a mudança é o valor padrão de um campo já existente, conferido no código.

## Observação
Quem estiver com o B7 aberto e já tiver mexido nos filtros do Vídeo nesta sessão continua vendo a visão guardada (Lista) até fechar a aba ou clicar em Kanban.
