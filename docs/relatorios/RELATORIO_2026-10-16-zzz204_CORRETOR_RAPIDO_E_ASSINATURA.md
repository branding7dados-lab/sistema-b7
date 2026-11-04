# Relatório — Corretor mais rápido e assinatura no lugar certo

**Versão:** `2026-10-16-zzz204` · **Cache:** `roteiros-b7-v407`
**Problemas (Kevin):** (1) no WhatsApp, às vezes a assinatura ia para o FIM da mensagem; (2) a correção do chat de Conversas "não funcionava".

## Causa do 2
A função de IA estava no ar e respondendo (`ia_uso`: duas chamadas `whatsapp/corrigir` com status ok), mas levou **7,5 s e 9,4 s** (IA gratuita, tempo varia de 1 a 13 s) e o corretor desistia aos 7 s — a mensagem saía sem correção.

## Correção do 2
- A correção **começa quando a pessoa para de digitar** (1,4 s de pausa), no chat de Conversas e no WhatsApp do Windows. Ao enviar, já está pronta na maioria das vezes (guardada por texto, sem pedir de novo).
- Se ainda não estiver pronta ao enviar, espera até 15 s (antes 7 s); sem resposta, envia o original.
- Uma chamada por vez (o servidor recusa pedidos em paralelo da mesma pessoa): textos novos esperam o anterior terminar.
- Falha não fica guardada: tenta de novo na próxima.

## Correção do 1
`preload-whatsapp.js`: depois de colar a assinatura, confere se o texto começa com o nome; se o editor pôs no fim, refaz o texto inteiro já assinado (`*Nome:*` + quebra + mensagem). Pausas um pouco maiores depois da correção e da colagem, para o editor assentar o cursor. Mensagens com `@menção` mantêm o caminho antigo.

## Arquivos
`js/corretor.js`, `js/conversas.js`, `app-desktop/preload-whatsapp.js`, `app-desktop/whatsapp.js`, `js/auth.js`, `sw.js`. Banco: nenhuma mudança. O WhatsApp do Windows precisa **atualizar o programa**.

## Testes
Sintaxe (`node --check`). Causa confirmada nos registros de uso da IA. Não foi possível testar o WhatsApp real aqui.
