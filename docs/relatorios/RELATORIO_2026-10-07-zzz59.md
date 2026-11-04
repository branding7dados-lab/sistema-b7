# Relatório zzz59 — Kanban do Vídeo: o cartão muda de coluna na hora (07/10/2026)

**Versão:** `2026-10-07-zzz59` · **Cache:** `roteiros-b7-v264`

## O que foi pedido
"O kanban está lento, eu quero só de eu mover pro outro lado já conte."

## Causa
Ao soltar o cartão, a tela esperava o banco responder para só então redesenhar o quadro e os contadores. Até lá o cartão voltava para a coluna antiga.

## O que mudou
Somente `js/video.js`. A gravação continua passando pelas MESMAS ações de sempre (`mudarStatusVideo`, `enviarParaAprovacaoVideo`, `registrarEntregaVideo`); mudou apenas a ordem na tela.

- **Pendente, Em edição, Standby:** o cartão troca de coluna e os contadores mudam no instante em que é solto; a gravação segue por baixo.
- **Correção:** continua perguntando o que corrigir; ao confirmar, move na hora.
- **Aguardando aprovação:** move na hora. Se houver versão registrada, a confirmação "Enviar para aprovação?" continua aparecendo; cancelar devolve o cartão.
- **Entregue:** sem mudança — continua conferindo antes se a versão foi aprovada pelo cliente e pedindo confirmação.
- **Se a gravação falhar:** o cartão volta para a coluna de origem e aparece o aviso do erro.
- O aviso "Situação atualizada." deixou de aparecer ao mover: o próprio cartão na coluna nova é a confirmação.
- Vale também para o "Mover para…" do celular (mesma função).

Nenhuma regra de status, permissão, confirmação ou banco foi alterada. Sem migração.

## Testes realmente executados
- O app local carregou com o `video.js` alterado e o módulo de Vídeo foi criado (sem erro de sintaxe).

## Não testado
- Arrastar de verdade com conta logada, a falha de gravação (cartão voltando) e o cancelamento da confirmação — o teste local não tem sessão. Vale conferir no PC.
