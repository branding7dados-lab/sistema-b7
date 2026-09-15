# Build 2026-09-11-am — relatório

Dois pedidos do Yury, tratados juntos porque o segundo (upload de
Design) é pequeno e independente, e o primeiro (Status Semanal ↔ Linha
Editorial) é o grosso do build.

## 1) Status Semanal ligado à Linha Editorial

**Pedido:** "as informações (situação do status semanal do cliente)
não estão sendo vinculadas com a linha editorial. o status semanal tem
que vir com a situação que está na linha editorial, e ai se caso
precisar a gente muda a situação nos próprios cards. outra coisa,
quando na linha editorial estiver com uma data prevista para postagem,
e esse conteúdo ter sido postado, ele vai atualizar automático. a
mesma coisa para os status semanal."

### Implementado e testado

- Situação nasce vinda do status real do conteúdo (Ideia/Em criação/Em
  revisão/Aprovado/Programado/Publicado), traduzida pro vocabulário do
  formato da demanda (Card, Story, Carrossel, Reel) — nunca mais um
  estado neutro desconectado.
- Continua seguindo sozinha depois: gatilho no banco propaga qualquer
  mudança de status do conteúdo pros cards vinculados do Status
  Semanal, automaticamente.
- Escolher a situação à mão no card (aberto, ou pelo atalho "situações
  a revisar") desliga o automático só naquele card — exatamente "se
  caso precisar a gente muda a situação nos próprios cards".
- Cards antigos (criados antes desta build) são corrigidos sozinhos ao
  abrir o Status Semanal — não precisa recriar nada.
- Conteúdo "Programado" com data de postagem já passada vira
  "Publicado" sozinho — testado tanto abrindo a Linha Editorial quanto
  abrindo direto o Status Semanal (os dois caminhos detectam e
  corrigem, sem depender um do outro).
- Testado no Postgres local: tradução conferida para os 4 formatos ×
  6 status (sempre uma situação válida do vocabulário certo — bate
  exatamente com a função equivalente no JavaScript); avanço de status
  propaga automaticamente; card marcado manual NÃO é sobrescrito;
  religando o automático, volta a seguir.

### Preparado, mas ainda não aplicado

- Não existe botão na interface pra religar o automático de volta num
  card marcado manual — hoje só editando direto no banco. Simples de
  adicionar depois se fizer falta.

## 2) Upload de Design em nome do designer, desde "Em criação"

**Pedido:** "no sistema de design (adm e coord), a gente também
consegue upar arquivo, mesmo que esteja em criação, o designer as
vezes não tem tempo, então podemos upar por ele."

**O que a auditoria encontrou:** essa capacidade já existia desde a
File Review 2.0 (§43) — Admin/Coordenador já podiam enviar arquivo em
qualquer status (exceto "Finalizado"), mesmo sem ser o designer
responsável. O problema era só de visibilidade: o bloco de envio
ficava sempre recolhido como "exceção" quando a peça já tinha um
responsável — mesmo se ele ainda não tivesse enviado nada.

**Corrigido:** enquanto o designer não enviou nenhuma versão ainda, o
bloco fica ABERTO por padrão, com o título "Enviar arquivo pelo
designer" e um aviso explicando o motivo. Assim que existir uma versão
enviada por ele, volta a ficar recolhido como exceção. Nenhuma regra
de permissão mudou — só a visibilidade.

## Migração necessária

Rode **`migration_status_linha_sync.sql`** no SQL Editor do Supabase
(depois de `migration_semana.sql`, que já deve estar aplicada). É
aditiva e idempotente.

## Arquivos no zip

`js/doc-semana.js`, `js/semana.js`, `js/linha.js`, `js/database.js`,
`js/design.js`, `js/auth.js`, `sw.js`, `migration_status_linha_sync.sql`,
`migration_tudo.sql`, `CORRECOES_2026-09-09.md`.

`VERSAO` → `2026-09-11-am`, cache do service worker → `roteiros-b7-v56`.
