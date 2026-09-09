# Push no Sistema B7 — como ligar

Aviso no aparelho mesmo com o sistema fechado. Funciona em Chrome, Edge,
Firefox e Safari (no iPhone/iPad só com o site adicionado à tela de início).

## Como funciona

1. A pessoa liga **Push neste aparelho** em *Meu perfil → Notificações*.
   O navegador pede permissão, o service worker (`sw.js`) assina no
   `PushManager` com a chave **pública** VAPID de `js/config.js`, e a
   inscrição (endpoint + chaves do navegador) é gravada em
   `push_subscricoes` pela função `push_registrar()` — cada pessoa só
   enxerga as suas (RLS).
2. Toda notificação nasce como linha em `notificacoes` (uma por evento e
   destinatário — ver APROVACOES.md). Um **Database Webhook** em `INSERT`
   dessa tabela chama a Edge Function `b7-push`.
3. `b7-push` lê as inscrições do destinatário com a service role, respeita
   `perfis.preferencias.push` e envia o push assinado com a chave
   **privada**, que existe só nos secrets da função. Inscrições mortas
   (404/410) são apagadas.
4. `sw.js` recebe o push, mostra o aviso (`tag` = id da notificação, o mesmo
   que o sino usa no aviso do navegador — nunca dois avisos para o mesmo
   evento) e, no clique, foca a aba do sistema e abre o `link`.

A chave privada **nunca** entra no frontend, no banco ou no git.

## Setup (uma vez)

### 1. Gerar o par VAPID

```bash
npx web-push generate-vapid-keys
```

Guarde as duas chaves. A pública vai para o frontend; a privada só para os
secrets.

### 2. Banco

Rode, nesta ordem, no SQL Editor: `migration_presenca.sql` e
`migration_push.sql` (ambos aditivos e idempotentes; a ordem completa está
em `migration_tudo.sql`). O segundo também adiciona `notificacoes`,
`aprovacoes`, `aprovacao_partes` e `comentarios` à publicação
`supabase_realtime` (sino e listas em tempo real).

### 3. Frontend

Em `js/config.js`:

```js
VAPID_PUBLIC_KEY: 'BExemplo...'   // a chave pública, base64url
```

Vazia, o interruptor de push fica desligado e o Meu perfil explica o motivo.

### 4. Edge Function

```bash
supabase secrets set VAPID_PUBLIC_KEY=BExemplo... \
                     VAPID_PRIVATE_KEY=<privada> \
                     VAPID_SUBJECT=mailto:contato@branding7.com.br \
                     B7_WEBHOOK_SECRET=<string longa e aleatória>
supabase functions deploy b7-push --no-verify-jwt
```

`--no-verify-jwt` porque o webhook não carrega JWT de usuário. A proteção é
o header `x-b7-webhook-secret`, conferido com `B7_WEBHOOK_SECRET`.

### 5. Database Webhook

Supabase → Database → Webhooks → *Create a new hook*:

- Name: `b7-push`
- Table: `public.notificacoes`
- Events: **Insert** (só)
- Type: *Supabase Edge Functions* → `b7-push`
- HTTP Headers: `x-b7-webhook-secret` = o mesmo valor de `B7_WEBHOOK_SECRET`
- Timeout: 5000 ms

### 6. Testar

1. Entre no sistema, abra *Meu perfil → Notificações*, ligue **Push neste
   aparelho** e aceite a permissão. Deve aparecer "Push ativado neste
   aparelho" — e uma linha em `push_subscricoes`.
2. Feche a aba. Em outra conta, envie um material para aprovação (ou decida
   um) que gere notificação para você. O aviso deve chegar em segundos.
3. Sem aviso: veja *Edge Functions → b7-push → Logs* (a resposta traz
   `enviados`, `removidos`, `falhas` e `motivo`) e *Database → Webhooks →
   Logs*.

## Preferências

`perfis.preferencias` (jsonb) guarda `som`, `navegador` e `push`, por
pessoa, gravadas por `perfil_preferencias_gravar()` — só as três chaves,
só booleanos, só na própria linha. A view `minha_sessao` devolve a coluna.

- **som**: toque curto gerado por WebAudio ao chegar notificação (aba aberta).
- **navegador**: `Notification` do navegador quando a aba não está em foco
  (exige permissão; pedida ao ligar).
- **push**: liga/desliga a inscrição deste aparelho. `b7-push` também
  respeita a chave: `push: false` = nada enviado, mesmo com inscrição.

## Limites conhecidos

- iOS: só como app adicionado à tela de início (iOS 16.4+).
- Uma inscrição pertence a um aparelho/navegador; a mesma pessoa em dois
  aparelhos liga em cada um. Se outra conta entra no mesmo navegador e liga
  o push, a inscrição passa a ser dela (`push_registrar` troca o dono).
- O webhook chama a função uma vez por linha inserida; a função responde
  rápido e o envio real fica a cargo do serviço de push do navegador.
