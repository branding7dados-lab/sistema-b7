# Relatório zzz58 — Sino e menu da conta abertos ao mesmo tempo (07/10/2026)

**Versão:** `2026-10-07-zzz58` · **Cache:** `roteiros-b7-v263`

## O bug
No PC, com as Notificações abertas, clicar na foto abria o menu da conta por cima sem fechar as Notificações (e o contrário também): os dois painéis ficavam sobrepostos.

## Causa
O sino se fecha ouvindo cliques no documento. Os botões do topo (foto, Criar e o próprio sino) interrompem a propagação do clique, então esse aviso nunca chegava — cada painel só sabia fechar a si mesmo.

## Correção
- `js/topo.js`: ao abrir qualquer menu do topo (conta ou Criar), as Notificações são fechadas; `fecharMenu` passou a ser exposto em `B7.Topo`.
- `js/notificacoes.js`: ao abrir as Notificações, o menu do topo e os menus "⋯" abertos são fechados.

Nenhuma regra, dado ou permissão muda. Sem migração.

## Testes realmente executados
- O app local carregou com os dois arquivos alterados; `B7.Topo.fecharMenu` e `B7.Notif.fechar` existem e rodam sem erro com nada aberto.

## Não testado
- O clique de verdade com conta logada (abrir o sino e depois a foto, e o inverso) — o teste local não tem sessão. Vale conferir no PC.
