# Cliente na notificação: nome no título, logo como ícone
**Data:** 2026-09-28 · **Pacote:** `atualizacao-2026-09-28-h.zip`
**Arquivos:** `sw.js` (v98), `js/notificacoes.js`, `js/database.js`, `styles/aprovacoes.css`, `supabase/functions/b7-push/index.ts`, `migration_notificacao_cliente.sql`
**Já aplicados na produção:** a migration (view `notificacoes_resumo` + `notificar_teste` com cliente) e o deploy da Edge Function `b7-push` (versão `2026-09-28-a`).

## Como ficou
Push de algo ligado a cliente agora sai assim:

> **Nova demanda de vídeo · BLW**
> Kevin França atribuiu "Reel de lançamento" a Kaique Viana

O nome do cliente entra no **título** (a parte em negrito do aviso no Android), não no corpo — é o que se lê primeiro, e responde "de quem é isso?" sem abrir. A **logo do cliente vira o ícone grande** do aviso; o símbolo da B7 continua no badge, o ícone pequeno monocromático. No sino, cada item ganhou a logo à esquerda e o nome do cliente em roxo acima da frase.

## Decisão de arquitetura
Nada foi desnormalizado. Todas as funções que criam notificação — vídeo, design, aprovações, agenda — **já gravavam `client_id`** (943 das 956 notificações existentes têm), então nome e logo vêm por JOIN na leitura, pela view `notificacoes_resumo`. Nenhuma função de notificação precisou ser reescrita, e notificações antigas também ganharam cliente retroativamente.

A logo funciona como ícone de push porque o bucket `client-logos` é público (21 dos 23 clientes têm logo). A Edge Function busca nome e logo pelo `client_id` do record e manda no payload; falha nessa busca nunca derruba o push.

## Detalhes que precisaram de cuidado
**Realtime entrega a linha crua.** O canal do Supabase manda o registro de `notificacoes`, que só tem `client_id` — sem nome nem logo. Por isso o aviso do navegador enriquece sob demanda, com cache em memória por cliente, para não consultar o mesmo cliente a cada aviso. Quem chega pelo polling já vem da view, completo, e passa direto.

**Imagem que falha.** Logo apagada do bucket ou rede ruim deixava ícone quebrado no sino. Agora a `<img>` cai para as iniciais do cliente. Verificado em harness: com a imagem bloqueada, aparece `IF` no lugar da logo da Infinite Fio, sem buraco no layout.

**Aviso sem cliente** (agenda, teste antigo) continua com o ícone do sistema e título sem sufixo — nada de " · " solto.

## Teste
O botão **"Enviar uma notificação de teste"** (Meu perfil → Notificações) agora sai com um cliente de verdade, preferindo um que tenha logo. Serve para conferir nome e logo de uma vez, no aparelho. Validado em transação com rollback: mensagem sai citando o cliente escolhido (Branding7) e a view devolve a logo.

**Importante:** como sempre, quem desenha o aviso é o service worker instalado no aparelho. Depois de publicar, abra o sistema no celular uma vez e confira em Meu perfil se aparece `roteiros-b7-v98`.
