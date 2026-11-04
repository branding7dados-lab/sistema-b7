# v3.2.0: Entrar com Google no app Android

Pedido do Kevin: "faz o login com Google no app Android também".

## Por que não existia
Dentro do app as telas moram em `https://localhost` (Capacitor), e o Google não aceita esse endereço como volta. Por isso o botão ficava escondido no app (`semGoogleAqui`).

## Como ficou (sem plugin novo e sem mexer no Supabase)
1. **App** (`js/seguranca.js` `peloNavegadorDoCelular`):
   - pede o endereço do Google com `skipBrowserRedirect` e a volta no **site público**, `https://branding7dados-lab.github.io/sistema-b7/`. É o mesmo endereço que o login do navegador já usa, então já está liberado no Supabase;
   - guarda a chave do PKCE no próprio app;
   - abre o Google no navegador do celular (`window.open`, que o `js/app-nativo.js` manda para fora).
2. A pessoa escolhe a conta e o Google volta para o **site** com `?code=`.
3. **Site** (`devolverAoApp`): num Android, fora do app, se o login não começou naquele navegador (sem a marca `b7_oauth` e sem a chave do PKCE), mostra "Voltando para o app do B7…" e abre `intent://google?code=…#Intent;scheme=sistemab7;package=br.com.branding7.sistemab7;end`, com o botão "Abrir o app" de reserva. Se o login começou no navegador, segue o caminho normal.
4. **App Android:**
   - `AndroidManifest.xml` ganhou um `intent-filter` para `sistemab7://google`;
   - `MainActivity.voltaDoGoogle` recarrega as telas com `?code=`;
   - o `retornoOAuth` de sempre troca o código pela sessão com a chave guardada no passo 1.
- **Vincular** a conta Google (Meu perfil → Segurança) pelo app usa o mesmo caminho.

## Junto
- Os links `github.io/sistema/` davam **404**: o endereço do Portal no convite da equipe do cliente (`js/portal-equipe.js`) e o link de revisão das aprovações (`js/aprovacoes.js`). Agora apontam para `github.io/sistema-b7/`.

## Testes
- No navegador (Chromium com cara de Android):
  - volta com `?code=` sem login começado ali → tela "Voltando para o app" e link `intent://…` certo, sem tentar trocar o código no navegador;
  - com o login começado ali (`b7_oauth`) → caminho normal.
- `npm test` passou.
- O APK é compilado pelo GitHub (`apk.yml`), porque aqui não há SDK do Android. **Precisa instalar o APK novo** para o app ter o caminho de volta.
