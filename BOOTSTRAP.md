# Primeiro acesso — criar a conta de Administrador

Nenhuma senha vive no repositório e não existe rota pública para criar
admin. Tudo abaixo é feito **pelo painel do Supabase, no navegador** —
não é preciso instalar terminal, CLI nem Docker. Leva alguns minutos e
é feito uma única vez.

## 1. Rodar as migrations

No SQL Editor do Supabase, nesta ordem:

```
migration_vnext.sql
migration_vcontent.sql
migration_semana.sql
migration_central.sql
migration_auth.sql
```

Todas são aditivas e idempotentes. Nenhuma delas ainda tranca o sistema:
o acesso continua como está até a migration de corte do RLS, que só deve
rodar depois de você conseguir entrar como Admin.

## 2. Publicar a função — pelo navegador, sem instalar nada

Não é preciso terminal, CLI nem Docker. O painel do Supabase publica a
função direto do navegador.

1. Abra o painel do seu projeto no Supabase.
2. Na barra lateral, clique em **Edge Functions**.
3. Clique em **Deploy a new function** e escolha **Via Editor**.
4. No nome da função, escreva exatamente: `b7-auth`
   (o nome precisa bater; é por ele que o sistema chama a função).
5. Apague o código de exemplo que vier e cole **todo** o conteúdo do
   arquivo `supabase/functions/b7-auth/index.ts` que está no zip.
6. Clique em **Deploy**.

Deve aparecer como publicada em poucos segundos. `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente pela
plataforma — você não configura nem vê esses valores, e eles nunca vão
para o site.

## 3. Definir o token de bootstrap

Ainda em **Edge Functions**, procure **Secrets** (em alguns painéis fica
em Project Settings → Edge Functions → Secrets).

Adicione um segredo:

- Nome: `B7_BOOTSTRAP_TOKEN`
- Valor: uma sequência longa e aleatória que você inventar

Guarde esse valor: ele é usado uma única vez, no passo seguinte, e depois
pode ser apagado.

## 4. Criar a sua conta de administrador

Também pelo painel, sem terminal:

1. Em **Edge Functions**, abra a função `b7-auth`.
2. Vá na aba de teste (**Test** / **Invoke**).
3. No corpo da requisição, cole o JSON abaixo, trocando o token e a
   senha pelos seus:

```json
{
  "acao": "bootstrap",
  "token": "o-token-que-voce-definiu-no-passo-3",
  "username": "b7admin",
  "nome": "Yury Nóbrega",
  "senha": "escolha-uma-senha-forte-aqui"
}
```

4. Envie.

Resposta esperada:

```json
{"ok":true,"username":"b7admin","papel":"admin"}
```

A senha precisa ter no mínimo 10 caracteres, com letras e números. Ela
não fica gravada em lugar nenhum além do Supabase, e não poderá ser
consultada depois — só redefinida.

Se preferir o terminal e já tiver a CLI instalada, o equivalente é:

```bash
supabase functions deploy b7-auth
supabase secrets set B7_BOOTSTRAP_TOKEN="$(openssl rand -hex 32)"
```

## 5. Fechar a porta

O bootstrap se desliga sozinho: ele recusa qualquer nova chamada enquanto
existir um administrador ativo. Ainda assim, apague o segredo
`B7_BOOTSTRAP_TOKEN` na mesma tela de Secrets onde você o criou.

## 6. Entrar

Abra o sistema e clique em **Entrar**, no canto superior direito. Use o
username e a senha que você acabou de definir.

Se o botão não aparecer ou o login falhar, abra
**Configurações → Acesso**: ele mostra qual das etapas acima ainda está
faltando.

## Sobre a senha

A função exige no mínimo 10 caracteres, com letras e números. Escolha a
senha na hora de rodar o comando acima — ela vai do seu terminal direto
para o Supabase, sem passar por lugar nenhum antes.

Uma senha que já tenha circulado por chat, e-mail ou mensagem deve ser
considerada comprometida e não deve ser usada.

## Se o login não aparecer

Abra **Configurações → Acesso**. Ele diz em qual etapa a instalação está:

- **Migrations de identidade** — se falhar, rode `migration_auth.sql`.
- **Função de acesso publicada** — se falhar, rode
  `supabase functions deploy b7-auth`.
- **Sessão ativa** — se as duas acima estiverem certas e esta não, o
  bootstrap ainda não foi feito, ou você ainda não entrou.

Para entrar, use o botão **Entrar** no canto superior direito. Enquanto o
corte do RLS não roda, o sistema continua abrindo sem login — isso é
proposital, para ninguém ficar trancado do lado de fora durante a
transição.

## Recomeçar do zero

Se a conta criada precisar ser apagada — senha perdida, username errado,
teste que virou definitivo — use a aba de teste da função:

```json
{
  "acao": "remover_admin",
  "token": "o-valor-do-B7_BOOTSTRAP_TOKEN",
  "username": "b7admin",
  "confirmar": "REMOVER"
}
```

A confirmação literal é obrigatória: sem ela, a função recusa. Isso apaga
o perfil e a identidade de acesso daquela conta, e nada mais — clientes,
gravações, roteiros, linhas editoriais e status semanais continuam
intactos.

A resposta informa quantos administradores restaram e se o bootstrap
voltou a ficar liberado. Com zero administradores, você pode rodar a
ação `bootstrap` de novo, com o username e a senha que quiser.

Enquanto não houver administrador, o sistema continua abrindo sem login:
a tela de acesso só é exigida quando existe alguém para entrar.

## "Já existe um administrador"

Se o bootstrap responder isso, a conta já foi criada — é só entrar com
ela. Se a senha se perdeu, use a recuperação abaixo.

## Recuperação de acesso administrativo

Não existe recuperação por e-mail, e isso é proposital: não há caixa de
e-mail envolvida em lugar nenhum deste sistema.

O caminho é a mesma aba de teste da função `b7-auth`, com o
`B7_BOOTSTRAP_TOKEN` configurado nos Secrets. Quem tem acesso aos
secrets do projeto já controla a infraestrutura — por isso é seguro que
seja essa a chave, e não uma senha mestra guardada em algum lugar.

**Descobrir quais administradores existem:**

```json
{
  "acao": "recuperar_admin",
  "token": "o-valor-do-B7_BOOTSTRAP_TOKEN"
}
```

Responde com a lista de administradores ativos e quando cada um acessou
pela última vez. Nada é alterado.

**Definir uma nova senha:**

```json
{
  "acao": "recuperar_admin",
  "token": "o-valor-do-B7_BOOTSTRAP_TOKEN",
  "username": "b7admin",
  "senha": "a-nova-senha-com-10-ou-mais-caracteres"
}
```

Isso redefine a senha e encerra as sessões abertas daquela conta. A ação
fica registrada na auditoria — sem a senha, que nunca é gravada.

Se o secret tiver sido apagado, basta criá-lo de novo em
Edge Functions → Secrets, com o mesmo nome.

Existe ainda o caminho pelo painel: em **Authentication → Users**, o
usuário aparece com um identificador técnico terminado em `@b7.local`.
Ele é gerado pelo sistema e não é um endereço real — não tente enviar
nada para ele.

## Como redefinir a senha de outra pessoa

Pela interface, em Configurações → Usuários e acessos. A operação passa pela função, exige sessão de Admin,
derruba as sessões abertas daquela conta e fica registrada na auditoria —
sem a senha, que nunca é gravada em lugar nenhum.
