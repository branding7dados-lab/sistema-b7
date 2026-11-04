# Corte do RLS — fechar o banco para o mundo

Até aqui, quem tivesse a chave pública do site alcançava qualquer dado
pela API, mesmo sem login. As telas escondem, o banco não escondia.

Esta é a etapa que fecha isso. É a única irreversível pela aplicação, e
por isso tem procedimento próprio.

## Antes de rodar

Três coisas precisam estar verdadeiras:

1. Você entra como Admin e o sistema funciona.
2. Existe pelo menos um usuário cliente criado, vinculado a uma empresa.
3. O `migration_rls_reverter.sql` está aberto numa aba do SQL Editor.

O terceiro item não é excesso de zelo: se algo der errado, você vai
querer o reverter a um clique de distância, não procurando o arquivo.

## O que o corte faz

- **Apaga todas as políticas antigas** de cada tabela, seja qual for o
  nome delas, e escreve as novas. Isso importa: políticas RLS se somam,
  então uma única política antiga liberando tudo anularia as novas.
- **A chave pública deixa de alcançar qualquer tabela.** Sem sessão, sem
  dados.
- **Cliente vê só a própria empresa**, e dentro dela só o que a equipe
  liberou (`visivel_cliente`) ou publicou (`publicado_em`).
- **Cliente não vê** gravações, roteiros, cenas, kanban, ideias nem
  qualquer material interno. O roteiro chega a ele pelo snapshot da
  versão enviada, não pela tabela.
- **Cliente não escreve** em material nenhum. Ele decide aprovações e
  comenta; o texto continua sendo da equipe.
- **Serviço pausado ou cancelado corta o acesso no banco**, não só na
  tela.

## A trava de segurança

O corte se recusa a rodar se não houver nenhum administrador ativo. Sem
essa checagem, rodar antes do bootstrap trancaria todo mundo do lado de
fora sem caminho de volta.

## Como validar depois

1. Entre como Admin: tudo deve aparecer normalmente.
2. Entre como cliente (outro navegador ou aba anônima): só a empresa
   dele, só o material liberado.
3. Como cliente, tente abrir `#/clientes` e `#/kanban`: devem ser
   recusados.
4. Publique uma linha editorial para o cliente e confirme que ela
   aparece; despublique e confirme que some.

## Se algo der errado

Rode `migration_rls_reverter.sql` no SQL Editor. Ele devolve as
políticas abertas — estado inseguro, mas com o sistema funcionando
enquanto o problema é investigado.

O SQL Editor do Supabase não depende da aplicação, então funciona mesmo
com todo mundo trancado do lado de fora.

## O que foi testado

O arquivo `teste_rls.sh` roda a cadeia completa de migrations num banco
limpo, cria duas empresas com um cliente cada, aplica o corte e verifica
doze afirmações: isolamento entre empresas, rascunho não liberado
invisível, gravações e kanban fora do alcance do cliente, admin com
visão total, serviço pausado cortando o acesso, reativação devolvendo,
cliente sem escrita, cliente sem se promover a admin, e chave anônima
sem alcançar nada.

Todas passam. O teste roda contra PostgreSQL de verdade, não contra
simulação.

**O que não foi testado:** o comportamento no Supabase real, com o
schema `auth` deles e tokens verdadeiros. A lógica é a mesma, mas a
confirmação final é a validação do passo anterior, feita por você.
