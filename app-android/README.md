# App Android do Sistema B7 (Capacitor)

O app é uma **casca**: ele abre o site publicado
(`https://branding7dados-lab.github.io/sistema-b7/`) em tela cheia, com ícone,
abertura e botão voltar do Android. **O conteúdo se atualiza sozinho:** cada
publicação no `main` chega ao app do mesmo jeito que chega ao navegador.

O APK só precisa ser gerado de novo quando a casca muda (ícone, permissões,
parte nativa). Isso é raro.

## Baixar e instalar

Link fixo do APK mais novo:
https://github.com/branding7dados-lab/sistema-b7/releases/latest/download/sistema-b7.apk

No celular: abrir o link → baixar → tocar no arquivo → permitir "instalar apps
desconhecidos" para o navegador (só na primeira vez) → Instalar.

> Se o app Android antigo (o de outubro, pacote zzy) ainda estiver no
> celular, desinstale antes: os dois usam o mesmo nome de pacote.

## O que a casca faz além do site

Tudo em `android/app/src/main/java/br/com/branding7/sistemab7/MainActivity.java`,
com o lado do site em `js/app-nativo.js`:

| No navegador              | No app                                              |
|---------------------------|-----------------------------------------------------|
| baixar arquivo            | salva em **Downloads** e abre                       |
| imprimir                  | impressão do Android (impressora ou "Salvar em PDF")|
| link de fora em nova aba  | abre no app certo (WhatsApp, Instagram, Chrome)     |
| botão voltar              | volta uma tela; na primeira, minimiza               |
| sem internet              | tela "Sem conexão" com "Tentar de novo"             |

A ponte (`B7Nativo`) só existe para o endereço do sistema: um iframe de outro
site (YouTube, Drive) não a enxerga.

## Ainda não funciona no app

- **Avisos com o B7 fechado (push).** O WebView do Android não tem push da web.
  Por enquanto, quem quiser os avisos ativa pelo Chrome. Para ter push no app
  é preciso um projeto no Firebase (grátis) e mudar a função `b7-push` para
  enviar também pelo Firebase. É a próxima etapa.
- **Conectar o Google Agenda** abre o Chrome; a conexão deve ser feita pelo
  navegador.

## Gerar uma versão nova da casca

1. Subir `versionCode` e `versionName` em `android/app/build.gradle` **e** os
   mesmos valores em `versao.json`.
2. Mandar para o `main`. O GitHub Actions (**App Android**) gera o APK
   assinado e publica em Releases como `apk-v<versionCode>`.
3. Quem está com o app aberto vê "Nova versão do app Android" com o botão
   **Baixar**. A versão nova instala por cima, sem perder nada.

Também dá para rodar à mão: Actions → App Android → Run workflow.

## Chave de assinatura (uma vez só)

O Android só instala uma atualização por cima se ela vier assinada **com a
mesma chave**. A chave nunca entra no repositório (ele é público). Ela fica
em dois segredos do GitHub (Settings → Secrets and variables → Actions):

- `ANDROID_KEYSTORE_BASE64`: o arquivo `.jks` em base64;
- `ANDROID_KEYSTORE_SENHA`: a senha da chave.
- (opcional) `ANDROID_KEYSTORE_ALIAS`: o apelido; sem ele, usa o primeiro da chave.

Se os segredos do app antigo ainda estão lá, servem. Para criar uma chave nova
(num computador com Java):

```sh
keytool -genkeypair -keystore b7.jks -alias b7 -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 b7.jks   # cole o resultado em ANDROID_KEYSTORE_BASE64
```

Guarde o `.jks` e a senha fora do repositório. **Nunca troque a chave:** com
outra, o celular não aceita a atualização e o app precisa ser desinstalado.

## Montar no computador (opcional)

Precisa de Node 22, Java 21 e o Android SDK (ou Android Studio).

```sh
cd app-android
npm ci
npx cap sync android
cd android && ./gradlew assembleDebug   # app/build/outputs/apk/debug/app-debug.apk
```

Ou `npx cap open android` para abrir no Android Studio.
