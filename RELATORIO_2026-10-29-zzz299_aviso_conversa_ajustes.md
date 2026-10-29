# zzz299 — Aviso de conversa: foto, botões e ícone do app (ajustes)

**Retorno do Kevin:** "não aparece a foto da pessoa, não aparecem os botões, nem o ícone do app pequeno igual ao print… só a logo da B7, o que a pessoa enviou e o nome… e algumas vezes ainda mostra aquela notificação com push bonita".

## Causas
1. O celular continuava registrado no formato antigo (`fcm`, desde 10/10): o app novo só se registrava de novo no login, e o Firebase podia demorar. Então a b7-push mandava o aviso pronto, que o Android mostra sozinho (logo do B7, sem botões).
2. "Push bonita": com mensagens em sequência, às vezes a b7-push não achava mensagem não lida (a tela já tinha marcado como lida) e caía no aviso antigo, com o cartão grande da b7-arte.
3. O ícone pequeno do app sobre a foto (como no WhatsApp) só aparece quando o Android reconhece o aviso como **conversa** — precisa de um atalho de conversa.

## O que mudou
- `js/app-nativo.js`: ao abrir o app (cada sessão), o registro passa para `fcm2`; se o Firebase demorar, usa o token já guardado.
- `b7-push`: aviso de conversa sempre como conversa (sem mensagem não lida, usa a última de quem mandou) e **nunca** com o cartão grande.
- Android (`AvisoConversa.java`): atalho de conversa de longa duração (`ShortcutInfoCompat` + `setShortcutId`/`LocusId`) com a pessoa e a foto — o Android passa a desenhar como no WhatsApp (foto grande, ícone do B7 pequeno em cima, seção "Conversas").

## Versão
- `VERSAO` 2026-10-29-zzz299 · cache `roteiros-b7-v501`. Precisa do APK novo.
