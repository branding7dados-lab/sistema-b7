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
   destinatário). Quem recebe é decidido no banco, num lugar só:
   `notif_entregar()` (ver `migration_notificacoes_inteligentes.sql`).
   Um **Database Webhook** em `INSERT` dessa tabela chama a Edge Function
   `b7-push`. O push é só um canal de entrega: nunca escolhe destinatário.
3. `b7-push` lê as inscrições do destinatário com a service role, respeita
   `perfis.preferencias.push` e `dados.silenciosa` (a pessoa desligou
   aquele tipo de aviso) e envia o push assinado com a chave **privada**,
   que existe só nos secrets da função. Inscrições mortas (404/410) são
   apagadas. O resultado fica na própria notificação (`push_status`,
   `push_em`, `push_info`).
4. `sw.js` recebe o push e mostra o aviso: título = o que aconteceu,
   corpo = cliente · item · contexto, ícone = logo do cliente (ou o do B7),
   badge = símbolo B7, e — quando o aparelho suporta — botões que só
   navegam e a prévia real da peça de Design. `tag` = id da notificação,
   o mesmo que o sino usa no aviso do navegador: nunca dois avisos para o
   mesmo evento. No clique (corpo ou botão), foca a aba do sistema e abre
   o `link`; sem aba aberta, abre uma já no destino.

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
2. Clique em **Enviar notificação de teste**. O B7 chama a `b7-push` com
   `{ teste: true, endpoint }` e o JWT da sessão; a função manda um push
   de verdade só para aquele aparelho e **não grava notificação** (o
   teste não vira pendência, não conta como não lida, não escala).
   "Enviado" significa que o serviço de push aceitou a mensagem — o
   navegador não confirma a exibição, então a tela nunca diz "entregue".
3. Sem aviso: o bloco "Neste aparelho" mostra permissão, push, som e o
   último teste. No servidor, veja `notificacoes.push_status` da
   notificação em questão (`enviado`, `silenciada`, `push_desligado`,
   `sem_inscricao`, `falha`) e *Edge Functions → b7-push → Logs*.

## Preferências

`perfis.preferencias` (jsonb), por pessoa, gravadas por
`perfil_preferencias_gravar()` — só chaves conhecidas, só booleanos, só
na própria linha.

Canais:

- **som**: toque curto gerado por WebAudio ao chegar notificação (aba aberta).
- **navegador**: `Notification` do navegador quando a aba não está em foco
  (exige permissão; pedida ao ligar).
- **push**: liga/desliga a inscrição deste aparelho. `b7-push` também
  respeita a chave: `push: false` = nada enviado, mesmo com inscrição.

O que avisa (`preferencias.notif`), em *Meu perfil → Notificações → O que
te avisa* — cada pessoa só vê os grupos da função que tem:

| Grupo | Chaves | Padrão |
|---|---|---|
| Meu trabalho | `atribuicoes`, `prazos`, `atrasos`, `correcoes`, `aprovacoes` | ligado |
| Gravações (videomaker) | `grav_lembretes`, `grav_mudancas`, `roteiros_prontos` | ligado |
| Design (designer) | `design_disponivel` | ligado |
| Coordenação | `co_revisoes`, `co_aprovacoes`, `co_producao`, `co_escalados` | ligado |
| Agenda e resumo | `agenda` · `resumo_diario` | ligado · desligado |
| Acompanhar a operação (admin) | `adm_atrasos` · `adm_revisoes`, `adm_tudo` | ligado · desligado |

Desligar um aviso do próprio trabalho tira push, som e aviso do navegador;
o registro continua no sino (a notificação nasce com `dados.silenciosa`).
As opções `adm_*` e `resumo_diario` são diferentes: desligadas, a
notificação nem é criada.

## Limites conhecidos

- iOS: só como app adicionado à tela de início (iOS 16.4+).
- Uma inscrição pertence a um aparelho/navegador; a mesma pessoa em dois
  aparelhos liga em cada um. Se outra conta entra no mesmo navegador e liga
  o push, a inscrição passa a ser dela (`push_registrar` troca o dono).
- O webhook chama a função uma vez por linha inserida; a função responde
  rápido e o envio real fica a cargo do serviço de push do navegador.
