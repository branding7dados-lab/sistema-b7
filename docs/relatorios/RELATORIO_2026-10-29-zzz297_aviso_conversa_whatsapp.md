# zzz297 — Aviso de conversa igual ao do WhatsApp

**Pedido:** "quando alguém me mandou uma mensagem… é pra aparecer como se estivesse mandando uma mensagem no WhatsApp… o negocinho pra responder… marcar como lida" (print do aviso do WhatsApp com Responder / Marcar como lida / Silenciar).

## Como ficou
- **App Android** (nativo): o aviso de conversa é montado pelo próprio app, no estilo de conversa do Android (`MessagingStyle`): foto redonda e nome de quem mandou, as mensagens ainda não lidas empilhadas (até 6), hora, e os botões:
  - **Responder** — campo de texto na própria notificação; envia sem abrir o B7;
  - **Marcar como lida**;
  - **Silenciar** — a conversa para de tocar por 8 horas (os avisos continuam no sino);
  - tocar no aviso abre a conversa.
  - Se a conversa já está aberta na tela, o aviso não toca. Canal novo "Conversas do B7".
- **Navegador** (`sw.js`): o mesmo aviso — quem mandou, as mensagens, a foto — com Marcar como lida / Silenciar funcionando sem abrir o B7 e Responder (escreve na notificação onde o navegador permite; senão abre a conversa).

## Como funciona
- `b7-push`: para `chat.mensagem` monta a conversa (mensagens não lidas, nome e foto de quem mandou) e uma **assinatura HMAC** que vale só para aquela pessoa e aquela conversa, por 7 dias. App novo (registro `fcm2`) recebe só os dados pelo Firebase; app antigo continua recebendo o aviso de antes.
- Botões chamam a `b7-push` (`conversa_acao`) com a assinatura → `chat_enviar_como` / `chat_marcar_lida_como` / `chat_silenciar_como` (só o servidor pode chamar; reaproveitam as regras de sempre: participação na conversa, freio de mensagens, avisos para os outros).
- Conversa silenciada: a `b7-push` não toca até `silenciada_ate`.
- **Banco** (`migration_aviso_conversa.sql`, aplicada): `chat_participantes.silenciada_ate` + as 3 funções. Testado numa transação desfeita.
- **Android**: `MensagensB7` (recebe do Firebase no lugar do serviço do plugin), `AvisoConversa` (desenha), `AcaoConversa` (botões); `MainActivity` sabe a conversa aberta (`js/conversas.js` → `B7.AppNativo.conversaAberta`).
- **Publicação**: a `b7-push` passa a sair pelo workflow `funcoes` (era publicada à mão; o código publicado era igual ao do repositório).

## Observações
- Precisa do **APK novo** (sai sozinho ao entrar no main). Quem estiver no app antigo continua recebendo o aviso como antes até atualizar.
- Programa do Windows: não recebe push (abre o site); fica para uma próxima.

## Versão
- `VERSAO` 2026-10-29-zzz297 · cache `roteiros-b7-v499`.
