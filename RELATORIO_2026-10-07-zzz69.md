# Relatório zzz69 — Celular: conta e notificações abertas ao mesmo tempo (07/10/2026)

**Versão:** `2026-10-07-zzz69` · **Cache:** `roteiros-b7-v274`

## O bug (captura do Kevin, celular)
Tocar na foto (menu da conta) e depois no sino deixava os dois abertos: as Notificações por cima e o menu da conta aparecendo por baixo ("Sair da conta" no rodapé).

## Causa
A correção da zzz58 só cobria o computador. Lá o menu da conta é um menu suspenso; no celular ele é uma **folha** (janela que sobe de baixo), aberta por outro caminho. O sino, ao abrir, mandava fechar o menu suspenso — que no celular não existe — e a folha continuava aberta. E o sino continuava tocável acima da folha.

## Correção
`js/topo.js`:
- a folha aberta (conta ou Criar) passa a ficar anotada, e o "fechar menu" que o sino chama também fecha a folha;
- abrir uma folha fecha as Notificações e qualquer outro menu do topo.

Nenhuma regra, dado ou permissão muda. Sem migração.

## Testes realmente executados
App local em 375×812, arquivos novos, sessão simulada e banco substituído por dados vazios:
- tocar na conta → 1 folha, 0 painel de notificações;
- tocar no sino → 0 folha, 1 painel de notificações;
- tocar na conta de novo → 1 folha, 0 painel;
- nenhum erro de script.

## Não testado
- Aparelho físico e conta real.
