# v3.1.2: tela de login (espaçamento)

O Kevin apontou duas coisas: faltava o "Entrar com Google" e o "Esqueci minha senha" estava colado no campo da senha.

## Espaçamento (corrigido)
- `.login-esqueci` passou de `margin:-4px 0 4px` (encostava no campo) para `margin:12px 0 6px`.
- `.login-erro:empty` não ocupa mais espaço. A linha de erro vazia somava 32 px e deixava um vão entre "Esqueci minha senha" e Entrar.

## "Entrar com Google" (não era defeito)
- O print que o Kevin mandou foi tirado no meu ambiente de teste, que roda sem internet. Por isso o sistema não conseguiu perguntar ao Supabase se o Google estava ligado, e o botão não apareceu.
- Conferido agora: `auth/v1/settings` responde `google: true`. No navegador e no programa do Windows (versão nova), o botão aparece abaixo do Entrar, separado por "ou". Teste com o Google ligado: o botão aparece.
- No **app Android** o botão fica escondido de propósito (`semGoogleAqui` em `js/seguranca.js`). O login do Google abre o navegador e precisa voltar para o app por um link próprio (deep link), o que ainda não foi feito.
