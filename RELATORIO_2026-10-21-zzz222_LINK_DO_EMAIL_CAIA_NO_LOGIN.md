# Relatório zzz222 — O botão do e-mail caía no login

## O problema (relatado pelo Kevin, celular e PC)
- Tocar em "Confirmar meu e-mail" abria a tela de login do sistema, e o e-mail não era confirmado (só pelo código).
- Causa: o service worker do B7 (sw.js) respondia **toda navegação** do site com o `index.html` guardado. A `confirmar.html` nunca chegava a abrir, então o link nem era enviado ao servidor.

## Correção
- `sw.js`: `confirmar.html` passa direto para a rede (o service worker não intercepta mais essa página).
- Versão `2026-10-21-zzz222`, cache `roteiros-b7-v424`.

## Observação
- Aparelhos que ainda estão com o service worker antigo precisam abrir o B7 uma vez (ou tocar no link duas vezes) para pegar o novo; ele se instala e assume sozinho (skipWaiting + clients.claim).

## Testes feitos
- `confirmar.html` publicada responde 200 no GitHub Pages.

## Não testado
- O clique no botão do e-mail depois desta publicação, no celular e no PC.
