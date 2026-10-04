# Pacote zzz18: atualização que não mistura versões

Versão `2026-10-04-zzz18`, cache `roteiros-b7-v223`.

## O problema (print do Kevin, 04/10 23:02)
A tela de Gravações abriu com as pílulas novas (CSS novo) e o cabeçalho antigo (JS antigo).

O app tinha se atualizado segundos depois da publicação. Nesse intervalo, o CDN do GitHub Pages ainda entregava parte dos arquivos antigos. O service worker guardou essa mistura, e como a versão "já era a nova", ninguém mandava baixar de novo. A mistura ficava presa até a publicação seguinte.

## A correção (`sw.js`)
- Na instalação e no "Atualizar", cada arquivo da casca é baixado com a versão no endereço (`?b7=roteiros-b7-v223`).
  - Esse endereço é inédito, então o CDN não tem cópia e busca na origem: sempre a versão publicada.
  - O arquivo fica guardado sob o endereço normal, e as páginas continuam pedindo `js/dashboard.js` como sempre.
- A conferência de versão nova (`js/app.js`) também lê `js/auth.js?t=<agora>`, então o CDN não esconde uma publicação recente.

## Testes
- `npm test` passou.
- Teste real do service worker (sem simulação de rede):
  - os 96 arquivos da casca foram baixados com `?b7=…`;
  - o cache `v223` guardou o `dashboard.js` novo;
  - recarregar abre o app pelo cache.

Quem está com a mistura vai receber esta versão e baixar tudo de novo, já do jeito certo.
