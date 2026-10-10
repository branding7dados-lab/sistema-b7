# App Android do Sistema B7 (Capacitor)

O app leva **as telas do sistema dentro dele** (`index.html`, `js/`, `styles/`,
`assets/`). A internet só serve para o **login e os dados** (Supabase), como em
qualquer app.

Como as telas estão no APK, **cada publicação no `main` gera um APK novo**. O
app confere sozinho e mostra **"Nova versão do app B7 · Instalar"**. Um toque
baixa e abre o instalador do Android, que instala por cima sem perder nada.

## Baixar e instalar

Link fixo do APK mais novo:
https://github.com/branding7dados-lab/sistema-b7/releases/latest/download/sistema-b7.apk

No celular: abrir o link → baixar → tocar no arquivo → permitir "instalar apps
desconhecidos" (só na primeira vez) → Instalar.

> Se ainda houver no celular o app de teste ou o app antigo de outubro,
> desinstale antes: todos usam o mesmo nome de pacote, com outra chave.

## Atualizar

- O app confere ao abrir e ao voltar para ele (no máximo a cada 30 min).
- Também em Configurações → Este aparelho → **Buscar atualização**.
- Na primeira atualização, o Android pede para liberar **"Permitir desta
  fonte"** para o Sistema B7. Depois é só tocar em Instalar.

## O que o app faz além das telas

Tudo em `android/app/src/main/java/br/com/branding7/sistemab7/MainActivity.java`,
com o lado das telas em `js/app-nativo.js`:

| No navegador              | No app                                              |
|---------------------------|-----------------------------------------------------|
| baixar arquivo            | salva em **Downloads** e abre                       |
| imprimir                  | impressão do Android (impressora ou "Salvar em PDF")|
| link de fora em nova aba  | abre no app certo (WhatsApp, Instagram, Chrome)     |
| botão voltar              | volta uma tela; na primeira, minimiza               |
| atualizar o site          | baixa e instala o APK novo                          |

A ponte (`B7Nativo`) só existe para as telas do próprio app: um iframe de outro
site (YouTube, Drive) não a enxerga.

## Ainda não funciona no app

- **Avisos com o B7 fechado (push).** Precisa de um projeto no Firebase (grátis)
  e da função `b7-push` enviando também pelo Firebase. É a próxima etapa.
  Por enquanto, quem quiser os avisos ativa pelo Chrome.
- **Conectar o Google Agenda** abre o Chrome; a conexão deve ser feita pelo
  navegador.

## Como o APK é gerado

`.github/workflows/apk.yml` (**App Android**) roda a cada push no `main` que
mexa nas telas (`index.html`, `js/`, `styles/`, `assets/`, `manifest.json`) ou
em `app-android/`. Também dá para rodar à mão: Actions → App Android → Run workflow.

1. Versão do app = `VERSAO` de `js/auth.js`; número = 100 + número da execução
   (sempre maior que o anterior, por isso instala por cima).
2. `npm run sync` copia as telas para `www/` (`copiar-site.mjs`) e para o projeto Android.
3. Gera o APK assinado, confere a assinatura e publica em Releases como `app-v<número>`.
4. Guarda só os 5 APKs mais novos.

## Chave de assinatura (uma vez só)

O Android só instala uma atualização por cima se ela vier assinada **com a
mesma chave**. A chave nunca entra no repositório (ele é público). Ela fica
em dois segredos do GitHub (Settings → Secrets and variables → Actions):

- `ANDROID_KEYSTORE_BASE64`: o arquivo `.jks` em base64;
- `ANDROID_KEYSTORE_SENHA`: a senha da chave.
- (opcional) `ANDROID_KEYSTORE_ALIAS`: o apelido; sem ele, usa o primeiro da chave.

Para criar uma chave (num computador com Java):

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
npm run sync                              # copia as telas e prepara o Android
cd android && ./gradlew assembleDebug     # app/build/outputs/apk/debug/app-debug.apk
```

Ou `npx cap open android` para abrir no Android Studio.
