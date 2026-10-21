# Relatório zzz220 — E-mail do código com o visual do B7

## O que mudou
- O e-mail da verificação em 2 etapas (entrar e cadastrar e-mail) passou a usar o modelo do B7: topo escuro com degradê e logo, "Olá, nome", código grande em `000 000`, validade, "Pedido feito" (data/hora de Brasília) e o quadro "Não foi você?".
- Código em `supabase/functions/b7-auth/email_modelo.ts`; prévia estática em `emails/codigo-acesso.html`.
- `b7-auth` publicada; o ping responde `email_2fa: ok` (chave `B7_BREVO_API_KEY`, conta Branding7, remetente branding7dados@gmail.com).

## Testes feitos
- Um e-mail de teste do modelo foi enviado pela Brevo para o e-mail do Kevin (aceito pela Brevo, status 201).
- `b7-auth` publicada e respondendo.

## Não testado
- O fluxo real (Enviar código → e-mail novo) depois desta publicação; Outlook; modo escuro no celular.

## Fora do B7 (não mexido)
- A função `promo1010-brevo` e as tabelas `promo1010_*` não são do Kevin (foram colocadas por engano). A função está sem chave e responde `not_configured`. Nada foi apagado; aguardando decisão.
