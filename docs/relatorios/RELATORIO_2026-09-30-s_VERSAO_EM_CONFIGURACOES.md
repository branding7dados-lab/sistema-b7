# Relatório 2026-09-30-s — Versão só em Configurações

Pacote: `atualizacao-2026-09-30-s.zip`. Inclui os pacotes n, o, p e q e **substitui o r**. Só front-end.

## O que mudou

- A versão **saiu do rodapé da barra lateral** e **da tela de login**.
- Agora ela aparece apenas em **Configurações → Sistema → Versão**, e só para o **administrador**. Coordenador e outros papéis não veem a linha.
- A linha fixa "Versão · Branding7 · v2.1", que não significava nada, deu lugar à versão real do código carregado (`v2026-09-30-s`). Ao lado vai a dica de recarregar com Ctrl+Shift+R se ela não mudar depois de publicar.
- `VERSAO` em `js/auth.js` estava parada em `2026-09-17-z6` e foi atualizada para `2026-09-30-s`.

## Arquivos

- `index.html`: removido o `#versao-app` da barra lateral.
- `js/auth.js`: `VERSAO` atualizada e referências à versão removidas do rodapé e do login.
- `js/dashboard.js`: linha "Versão" em Configurações → Sistema, só para admin.
- `styles/global.css`: `.cfg-versao`.
- `js/nav.js` e `styles/nav.css` voltam ao estado do pacote q, sem as mudanças do r.
- `sw.js`: cache v117.

## Tests

Tela de Configurações testada numa página de teste com dados simulados (Playwright):

- **admin:** a seção Sistema mostra `v2026-09-30-s`;
- **coordenador:** a linha Versão não aparece.

No mesmo teste apareceu o erro "verificarBanco is not a function". Ele vem da página de teste, que não simula essa função, e não do pacote.
