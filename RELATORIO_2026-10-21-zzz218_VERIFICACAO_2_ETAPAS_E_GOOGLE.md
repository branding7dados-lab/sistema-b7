# Relatório — zzz218 · Verificação em 2 etapas e entrar com Google

**Versão:** `2026-10-21-zzz218` · **Cache:** `roteiros-b7-v421`
**Pedido:** "autenticação de 2 fatores, por e-mail… a pessoa pode vincular a conta do Google dela" ("faça tudo").

## Verificação em 2 etapas
- **Onde:** Meu perfil → aba Segurança → "Verificação em 2 etapas".
- **Dois jeitos:**
  - **Código por e-mail:** a pessoa escreve um e-mail seu e confirma com um código que chega nele (o B7 não tinha e-mail de ninguém; o login é por usuário).
  - **App autenticador:** QR Code + chave para Google Authenticator, Authy ou Microsoft Authenticator; confirma com o código do app.
- **No login:** depois da senha certa, aparece "Confirme que é você" com o campo do código, "Reenviar código" (e-mail), "Voltar" e **"Confiar neste aparelho por 30 dias"**.
- **De verdade, no servidor:** com a verificação ligada, a função de login (b7-auth) não entrega a sessão até o código conferir. O código vale 10 minutos, 5 tentativas; e-mail reenviado até 4 vezes.
- **Trocar** de e-mail para app (e vice-versa), **esquecer aparelhos de confiança** e **desligar** (pede a senha).
- **Administrador:**
  - em Meu perfil → Segurança, "Para a equipe": *Cada pessoa decide* / *Exigir de administração e coordenação* / *Exigir de toda a equipe*. Quem é exigido e não ligou recebe, ao entrar, a janela para ligar (só sai ligando ou saindo da conta) e não consegue desligar;
  - em Usuários e acessos → ⋯ → **"Desligar verificação em 2 etapas"** (para quem perdeu o celular).
- Tudo fica na auditoria (ligar, desligar, regra, desligar de outra pessoa).

## Entrar com Google
- Meu perfil → Segurança → "Entrar com Google" → **Vincular conta Google**; na tela de entrada aparece **"Entrar com Google"**.
- Só no navegador: o Google não deixa entrar por dentro do programa de Windows nem do app de Android, então lá o botão não aparece.
- **Só aparece quando o Google estiver ligado no Supabase** (hoje está desligado). Passo a passo abaixo.
- Quem entra pelo Google não passa pelo código do B7 (a conta Google tem a própria proteção).

## Perguntas frequentes novas (Suporte)
"Como ligo a verificação em 2 etapas?", "Perdi o celular ou não recebo o código. Como entro?", "Como entro com a minha conta Google?".

## Banco (aplicado; `migration_seguranca_2fa.sql`)
- `seguranca_2fa` (método, e-mail, segredo do app), `seguranca_codigos` (códigos só em hash, desafio do login), `seguranca_aparelhos` (aparelhos de confiança, só hash). Sem nenhuma política: só a função b7-auth lê e grava.
- Regra da equipe em `sistema_config` (chave `seguranca`).

## Publicação
- A **b7-auth agora é publicada sozinha** pelo workflow `funcoes` (antes era à mão). Conferido: o código do repositório era igual ao publicado.
- QR Code: biblioteca `qrcode-generator` (MIT) em `js/vendor/qrcode.js`, carregada só ao abrir o passo do app.
- Supabase com `flowType: 'pkce'` (a volta do Google chega como `?code=`, sem mexer nas rotas `#/`).

## O que você precisa fazer
1. **E-mail:** o B7 usa uma conta Brevo **própria**, no segredo `B7_BREVO_API_KEY` do Supabase (zzz219). A `BREVO_API_KEY` que já estava no projeto é de outra pessoa (função `promo1010-brevo`) e não é usada. Crie a conta Brevo da Branding7, confirme um remetente (Brevo → Senders) e coloque a chave em `B7_BREVO_API_KEY`. Para fixar o remetente, `B7_EMAIL_REMETENTE`. Enquanto não houver, "Código por e-mail" aparece desativado e o app autenticador funciona.
2. **Google (opcional):**
   - **Antes de tudo:** Supabase → Authentication → Sign In / Providers → desligue **"Allow new users to sign up"**. Hoje está ligado; com o Google ativo, qualquer conta Google criaria um usuário vazio (sem perfil, sem acesso, mas sujando a lista).
   - Google Cloud Console → APIs e serviços → Credenciais → "ID do cliente OAuth" (Aplicativo da Web). Em "URIs de redirecionamento autorizados": `https://rartcafydsaocdzshqcx.supabase.co/auth/v1/callback`.
   - Supabase → Authentication → Providers → Google: cole o Client ID e o Client Secret e ligue.
   - Supabase → Authentication → URL Configuration → Redirect URLs: adicione o endereço do sistema (ex.: `https://branding7dados-lab.github.io/sistema-b7/`).
   - Supabase → Authentication → ative **"Manual linking"** (permite vincular o Google a um usuário que já existe).

## Limites conhecidos
- O app de Android antigo não sabe pedir o código: quem ligar a verificação precisa atualizar o app (ele oferece "Instalar" ao abrir). Até lá, aparece a mensagem pedindo para atualizar.
- O Supabase em si continua aceitando login direto com o endereço técnico da conta (que não aparece para ninguém); a verificação vale para a entrada pelo B7, que é a de todo mundo.

## Testes
- Código do app autenticador conferido com o exemplo oficial da norma (RFC 6238).
- Checagem de tipos (Deno) da b7-ia; na b7-auth, o único aviso é um que já existia antes.
- `npm test` e prints: login com o passo do código, Meu perfil → Segurança (desligada, ligada, regra do administrador), passo do app com QR Code, botão do Google (simulado).

## Não testado
- Envio real do e-mail (depende do remetente da Brevo), entrada real com código, Google real (depende da configuração acima).
