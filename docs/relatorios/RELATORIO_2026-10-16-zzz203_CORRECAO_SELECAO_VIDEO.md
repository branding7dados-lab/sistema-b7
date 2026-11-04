# Relatório — Correção: seleção em lote no Kanban de vídeo

**Versão:** `2026-10-16-zzz203` · **Cache:** `roteiros-b7-v406`
**Problema (Kevin):** ao selecionar várias demandas e clicar com o botão direito, só a demanda clicada era marcada como entregue.

## Causa
No Kanban, o Ctrl+clique já era tratado pelo arrastar fluido (`js/arrastar.js`, que marca os cartões com `.arr-sel`). A seleção do zzz201 (`SEL`) não enxergava essas marcas, então o botão direito achava que o cartão clicado "não estava selecionado" e zerava tudo, ficando só com ele.

## Correção
`js/video.js`: o que vale como selecionado é a soma das duas seleções (`idsSel()`): `.arr-sel` do Kanban + `SEL` da Lista/"Selecionar todas". Botão direito, barra de seleção, "Selecionar todas", Limpar e Esc usam essa soma. Um observador atualiza a barra quando as marcas do Kanban mudam. A barra do arrastar ("N marcados") fica escondida enquanto a barra com "Marcar como entregue" aparece. Marcado no Kanban, o botão direito entrega todos os marcados; clicar com o direito num cartão fora da seleção continua selecionando só ele.

## Arquivos
`js/video.js`, `styles/video.css`, `js/auth.js`, `sw.js`. Banco: nenhuma mudança.

## Testes
Sintaxe (`node --check`). Não foi possível testar logado aqui: conferir Ctrl+clique em 3 cartões → botão direito em um deles → "Marcar 3 como entregues".
