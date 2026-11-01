# App B7 nativo (prévia)

O app do Sistema B7 feito em **React Native + Expo** (SDK 58): telas, abas e gestos nativos do Android e do iPhone. Usa o mesmo banco (Supabase), a mesma conta e as mesmas regras de acesso do site. Ele **não** carrega o site dentro dele.

## O que já tem
- **Login:** usuário e senha da B7, com verificação em 2 etapas pela função `b7-auth`.
- **Barra de abas nativa** (`expo-router/native-tabs`): Material no Android e a barra do próprio iOS no iPhone.
- **Painel:** saudação, números do dia (`meu_dia`), o que está na mão da pessoa (vídeo e design) e as próximas gravações.
- **Vídeo e Design:** filas por etapa, "Minha fila" ou "Todos".
- **Gravações:** próximas e recentes, por dia.
- **Mais:** conta, atalhos e sair.
- Puxar para atualizar nativo em todas as telas e vibração leve no toque.
- O que ainda não é nativo (detalhe de vídeo, peça, gravação etc.) abre no sistema completo, numa aba do navegador por cima do app.

## Rodar e conferir
```sh
cd app-nativo
npm ci
npx tsc --noEmit && npx expo-doctor
npx expo start            # com um app de desenvolvimento no celular
```

## APK
O GitHub monta sozinho (`.github/workflows/app-nativo.yml`): `expo prebuild` → `gradlew assembleRelease` → assina com a chave do app atual → publica a **prévia** `app-nativo-v<n>` em Releases. O pacote `br.com.branding7.b7app` é diferente do app atual (`br.com.branding7.sistemab7`), então os dois convivem no mesmo celular.

As pastas `android/` e `ios/` são geradas no build. Não crie nem edite essas pastas à mão: a configuração fica em `app.json`.
