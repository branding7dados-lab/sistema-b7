# zzz273 — Entrar com Google no programa do Windows

## Pedido
"No programa de Windows não funciona" (Entrar com Google / vincular conta).

## Por quê não funcionava
O Google bloqueia login dentro de programas (janelas embutidas); por isso o sistema escondia o Google no programa.

## Como ficou
- `app-desktop/main.js`: canal `b7:oauth` — recebe o endereço de login do Supabase, abre no **navegador do computador** e espera a volta num endereço local fixo `http://127.0.0.1:47821/callback`. Mostra uma página "Pronto! Pode voltar ao Sistema B7", traz a janela do programa para frente e devolve o código (ou o erro). Espera até 5 min; só aceita endereço `*.supabase.co`.
- `app-desktop/preload.js`: `B7Desktop.oauth(url)`.
- `js/seguranca.js`: no programa novo, login e vinculação pedem o endereço com `skipBrowserRedirect` e `redirectTo` local, chamam o programa e, com o código, recarregam com `?code=` — o mesmo caminho da volta no navegador (`retornoOAuth`, PKCE: o código só vale com o segredo guardado no próprio sistema). Programa antigo: o cartão pede para atualizar. Android continua pelo navegador.

## Configuração necessária (Kevin)
- Supabase → Authentication → URL Configuration → **Redirect URLs**: adicionar `http://127.0.0.1:47821/callback`.
- O programa novo sai pelo `desktop.yml` ao juntar (atualização automática).

## Testes
- `npm test` verde; `node --check` no main/preload. O fluxo completo só dá para conferir no Windows com o programa novo.
