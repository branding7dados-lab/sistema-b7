# Relatório — zzz219 · Código por e-mail só pela Brevo do B7

**Versão:** `2026-10-21-zzz219` · **Cache:** `roteiros-b7-v422`

## O que aconteceu
- A zzz218 mandava os códigos da verificação em 2 etapas usando o segredo `BREVO_API_KEY` que já existia no projeto do Supabase.
- Essa chave **não é do Kevin**: veio junto com a função `promo1010-brevo` (listas da campanha "Promo 10 do 10"), publicada direto no Supabase e fora do repositório.
- Saiu **um** e-mail por ela: o código de confirmação do cadastro de e-mail do `b7admin`, em 21/10 às 02h59 (horário de Brasília). Ninguém chegou a ligar a verificação por e-mail.

## Correção
- A b7-auth agora usa **só** o segredo `B7_BREVO_API_KEY`, próprio do B7. Remetente: `B7_EMAIL_REMETENTE` ou o primeiro remetente ativo dessa conta.
- Sem esse segredo, o ping responde `email_2fa: sem_chave` e a opção "Código por e-mail" aparece desativada. O app autenticador continua funcionando.

## Pendente (Kevin)
- Criar a conta Brevo da Branding7, confirmar um remetente e colocar a chave em `B7_BREVO_API_KEY` no Supabase (Edge Functions → Secrets).
- Decidir o que fazer com a função `promo1010-brevo` e o segredo `BREVO_API_KEY`, que estão no projeto do B7 sem serem dele. Nada foi apagado.
