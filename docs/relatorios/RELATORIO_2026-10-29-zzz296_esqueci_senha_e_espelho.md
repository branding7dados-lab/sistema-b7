# zzz296 — "Esqueci minha senha" + Acompanhar ao vivo vê tudo (espelho da tela)

## 1. Esqueci minha senha
**Pedido:** "agora que temos o sistema de email, podemos adicionar o esqueceu sua senha".

- **Login** (`js/auth.js`, `js/seguranca.js` → `esqueciSenha`): link "Esqueci minha senha" abaixo da senha. Três passos na própria caixa: usuário → código de 6 números + senha nova (2x) → "Senha trocada!" (volta ao login com o usuário preenchido).
- **E-mail de recuperação** (Meu perfil → Segurança): novo bloco para cadastrar/trocar um e-mail confirmado com código. Não liga a verificação em 2 etapas. Sem ele, vale o e-mail já confirmado da verificação em 2 etapas.
- **Servidor** (`b7-auth`): ações `senha_esqueci` e `senha_trocar` (sem sessão), `seg_rec_enviar`/`seg_rec_confirmar` (com sessão).
  - Resposta sempre igual, exista a conta ou não (não revela usuários).
  - Código: 10 minutos, uma vez só, 5 tentativas; no máximo 4 e-mails por hora por conta; freio por usuário e por IP.
  - Ao trocar: senha nova (mesma regra: 10+ caracteres, letras e números), todas as sessões encerradas, auditoria `senha_esqueci`, e-mail "Sua senha do B7 foi trocada".
- **E-mails** (`email_modelo.ts`): modelos "Crie uma senha nova", "Confirme seu e-mail de recuperação" e "Senha trocada".
- **Banco** (`migration_esqueci_senha.sql`, aplicada): `seguranca_2fa.email_recuperacao`; tipos de código `senha` e `cadastro_rec`.
- Hoje só 1 das 8 contas ativas tem e-mail confirmado: a novidade avisa a equipe para cadastrar.

## 2. Acompanhar ao vivo: subtelas, janelas e o que a pessoa digita
**Pedido:** "quando ele clicar nas subtelas, também aparece pra mim, quando ele estiver digitando também… tudo que a pessoa esteja fazendo no sistema em tempo real".

- **Espelho da tela** (`js/aovivo.js`): enquanto alguém acompanha, a tela da pessoa é copiada (sem nenhum script) quando muda — abas, subtelas, janelas, menus, o texto dos campos — comprimida (gzip) e enviada em pedaços. O super vê numa moldura do tamanho da tela da pessoa (no celular, aparece o celular), com cursor, cliques (onda) e o campo em foco destacado. Nada é clicado do lado do super: só se olha.
- **Nunca sai da tela da pessoa:** campos de senha, códigos de verificação e qualquer área com `data-av-privado`.
- **Segurança (mudança importante):** o canal ao vivo era **público** — qualquer um com a chave pública do site podia entrar. Agora os canais são **privados** (Realtime Authorization, `migration_aovivo_privado.sql`, aplicada):
  - `b7-aovivo` (quem está online) → só a equipe interna;
  - `b7-aovivo:<id>` (a tela da pessoa) → só ela mesma e os super admins. Conferido no banco: coordenador/designer/admin comum/cliente não abrem a tela de outra pessoa; super abre.
- Continua: selo "Tela compartilhada" na tela de quem é acompanhado, e só transmite enquanto alguém olha.
- **Termos** (seção 2) atualizados: o acompanhamento inclui o que aparece na tela, os cliques e o que é digitado nos campos do Sistema; senhas e códigos nunca.
- "Parar de acompanhar": o super continua como a pessoa (Visualizar como), na tela em que ela estava.

## Testes
- `testes/aovivo.test.mjs`: +8 conferências (senha/código/área privada nunca vão; canais privados; espelho sem script).
- Teste com duas abas (pessoa no celular + super no PC): o super viu a tela de Legendas da pessoa, o texto sendo digitado, o campo em foco, o cursor e o selo.

## Versão
- `VERSAO` 2026-10-29-zzz296 · cache `roteiros-b7-v498`. b7-auth é publicado pelo workflow ao entrar no main.
