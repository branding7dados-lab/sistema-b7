# Relatório — Firebase ligado no app (zzz149, 10/10)

- O Kevin criou o projeto **sistema-b7** no Firebase e mandou o `google-services.json`
  do app Android (pacote `br.com.branding7.sistemab7`).
- O arquivo foi para `app-android/android/app/google-services.json`, no repositório.
  Ele é só a identificação do app no Firebase, não uma senha. O segredo
  `GOOGLE_SERVICES_JSON`, se um dia existir, tem prioridade.
- A partir deste APK, o app pode receber notificações.
- Para elas chegarem, falta a chave privada da conta de serviço no Supabase
  (`FCM_SERVICE_ACCOUNT`). Ela fica só no Supabase, nunca no repositório.

Versão `2026-10-10-zzz149`, cache `v354`.
