# Build 2026-09-14-b — B7 Vídeo / Videomaker — Parte 1: relatório

**Pedido:** especificação de 57 seções (Branding7 — B7 Vídeo /
Videomaker — Parte 1) pedindo a fundação operacional do módulo para
quem filma e edita: papel próprio, Demanda de Edição mensal,
Central do Videomaker, entrega por link externo, importação de
planilha, prazos e atribuições — explicitamente só a Parte 1 (sem
revisão/versão do vídeo, sem upload/streaming, sem mexer em nada que
já existe: Branding7, autenticação, Clientes, Gravações, Linha
Editorial, Roteiros, Design, Kanban, notificações e aprovações
seguem exatamente como estavam).

## O que foi auditado antes de escrever qualquer código

- **"Pacote"**: não existia esse conceito em lugar nenhum do schema —
  a busca por "pacote"/"package" só encontrou dois nomes homônimos
  sem relação nenhuma (`pacote` em `js/backup.js` é o pacote de
  backup exportado; `pacoteLinha` em `js/design.js` é um agrupamento
  de cartões do carrossel). Decisão: campo de texto livre na Demanda
  de Edição, retrato do que veio da planilha ou foi digitado — não
  uma tabela nova de "pacotes" com regras próprias.
- **Cliente ativo/inativo**: `clientes.servico`
  (ativo/pausado/cancelado, desde `migration_auth.sql`) já resolve
  isso — reaproveitado, sem inventar um segundo campo.
- **Notificações**: o padrão `eventos_dominio` + `notificacoes` +
  uma função `<dominio>_processar_evento()` chamada explicitamente
  (nunca por trigger) já usado por Aprovações e Design foi seguido à
  risca, com `video_processar_evento()`.
- **Kanban geral**: decisão consciente de a Demanda de Edição ter
  situação e lista/quadro próprios nesta Parte 1, sem sincronizar com
  `kanban_demandas` — para não arriscar o Kanban que já está em
  produção. Documentado abaixo como não implementado por decisão.
- **Importação de planilha**: sem biblioteca de XLSX vendorizada no
  projeto (só `html2canvas`/`jspdf` existem hoje). Parte 1 aceita CSV,
  que é o formato que Excel/Google Sheets exportam nativamente sem
  precisar de biblioteca nenhuma rodando no navegador.

## Como foi testado

Diferente de simplesmente escrever o SQL e assumir que está certo,
`migration_video.sql` foi **aplicada de ponta a ponta contra um
Postgres 16 real**, em cima de toda a cadeia de migrations existentes
do projeto (com pequenos stubs só para `auth.uid()` e `storage.*`,
que existem de verdade no Supabase mas não num Postgres solto).
Isso encontrou e corrigiu dois bugs reais antes de chegar até você:

1. Uma constraint sem proteção de idempotência (`add constraint` sem
   checar se já existia) — a migration quebrava se rodada duas vezes.
   Corrigido para o mesmo padrão `do $$ ... if not exists ... $$`
   usado no resto do projeto.
2. Uma variável chamada `nome` dentro da função de importação
   colidindo com a coluna `clientes.nome`, causando
   `column reference "nome" is ambiguous`. Corrigido renomeando a
   variável.

Depois disso, o fluxo inteiro foi exercitado com dados reais no banco
de teste: criar demanda manual com atribuição (a notificação nasce
certa), mudar a situação até "entregue" (notificação para a equipe),
salvar o link do material, importar duas linhas de CSV (uma casa
sozinha com o cliente existente, outra não casa e fica pendente),
resolver a pendência manualmente (o sistema aprende o apelido para a
próxima vez) e confirmar em lote. A segurança (RLS) foi testada como
o papel `authenticated` de verdade usa — não como super-usuário, que
ignora RLS — confirmando que: um videomaker sem nada atribuído não
vê nenhuma demanda; o videomaker certo só vê a dele; o admin vê
tudo; e uma tentativa de `update` direto na tabela (por fora das
funções) é recusada — ou seja, não existe atalho que passe por cima
da auditoria.

## Implementado e testado

- **Papel "Videomaker"**: `perfis_papel_valido` ampliada,
  `sou_videomaker()`, `sou_equipe_interna()` (o "é da equipe, não é
  cliente" genérico) passa a incluir o videomaker.
- **Demanda de Edição** (`demandas_edicao`): cliente, competência
  (mês/ano), código (preserva o formato original da planilha),
  título, pacote (texto livre), prazo, videomaker responsável, link
  do material editado, situação (Pendente → Em edição → Correção /
  Standby → Entregue, ou Descartado), observações, origem
  (manual/importação), soft delete.
- **Linha do tempo** por demanda (`demandas_edicao_eventos`): quem
  criou, atribuiu, mudou situação, salvou link.
- **Notificações automáticas** (mesma infraestrutura de
  Aprovações/Design): o videomaker é avisado quando uma demanda é
  atribuída a ele ou quando a equipe pede correção; a equipe é
  avisada quando uma entrega é marcada como pronta.
- **RLS** completa: leitura só para a equipe ou para o videomaker
  dono da demanda; toda escrita passa por função do banco (nunca
  direto na tabela) — auditada e validada num lugar só.
- **Importação de planilha (CSV)**: o navegador lê e interpreta o
  arquivo, manda as linhas prontas para o banco; cada linha tenta
  casar o nome do cliente automaticamente (exato ou por um apelido já
  ensinado antes); o que não casa fica pendente de resolução manual
  antes de virar demanda de verdade — nada entra errado
  silenciosamente.
- **Central do Videomaker** (`js/video.js`): quadro por situação
  (Pendente/Em edição/Correção/Standby/Entregue/Descartado), ficha de
  uma demanda com troca de situação, atribuição, campo de link do
  material e histórico, criação manual de demanda (equipe) e a tela
  de importação com resolução linha a linha.
- **Integração com o resto do sistema**: novo item "Edição de vídeo"
  na barra lateral, rota `#/video`, home própria do videomaker (mesma
  lógica que o Designer já tem), seletor de papel em Usuários e
  acessos, todas as permissões (rotas, navegação, configurações)
  espelhando o padrão do Designer. `node --check` limpo em todos os
  arquivos `.js` alterados.
- `supabase/functions/b7-auth/index.ts`: as duas listas de papéis
  válidos ganharam `videomaker` — precisa de um novo deploy manual da
  Edge Function (não é publicada junto com o zip da SPA; mesmo aviso
  que valeu quando o Designer foi criado).

## Implementado, mas requer validação adicional

- O parser de CSV (`js/video.js`) foi testado manualmente com
  exemplos pequenos digitados à mão (vírgula e ponto-e-vírgula como
  separador, campos entre aspas) — **não foi testado contra uma
  planilha real exportada do Excel ou Google Sheets**, porque nenhum
  arquivo real foi fornecido para este build. É bem possível que a
  primeira planilha real precise de um ajuste fino (formato de data,
  acentuação, coluna extra).
- As notificações de atribuição/entrega/correção foram confirmadas no
  banco (a linha em `notificacoes` nasce certa), mas o sino/push na
  interface para esses tipos específicos não foi verificado na tela
  real — só a gravação no banco.

## Preparado, mas ainda não aplicado

- `migration_video.sql` está pronta e testada localmente, mas
  **precisa ser rodada no Supabase de produção** — como sempre neste
  projeto, é você quem roda no SQL Editor.
- A alteração em `supabase/functions/b7-auth/index.ts` está pronta,
  mas **o deploy da Edge Function não foi feito por aqui** — é um
  processo manual separado do zip.

## Não implementado por bloqueio ou por decisão consciente

- **Revisão/versão do vídeo dentro do sistema, upload de arquivo,
  streaming**: fora do escopo desta Parte 1 por definição da própria
  especificação. O vídeo entra só como link externo por enquanto.
- **Importação de XLSX binário (Excel nativo)**: não foi vendorizada
  nenhuma biblioteca de parsing de planilha binária — só foi
  confirmado que o pacote existe no registro npm (`npm view xlsx`
  respondeu), sem instalar nem testar de fato. Parte 1 resolve com
  CSV, que os dois programas exportam nativamente.
- **Sincronização com o Kanban geral** (`kanban_demandas`): decisão
  consciente de manter a Demanda de Edição totalmente própria nesta
  etapa, para não arriscar o Kanban que já está em produção. Pode
  virar uma sincronização opcional depois, do mesmo jeito que o
  Design já faz.
- **Vincular a Demanda de Edição a uma Gravação existente**: a coluna
  (`gravacao_id`) e o parâmetro na função já existem no banco, mas a
  Central do Videomaker ainda não oferece esse seletor na interface —
  a demanda nasce solta ou pela planilha.

## Migração necessária

Rode `migration_video.sql` no SQL Editor do Supabase, depois de todas
as migrations já existentes (ela é aditiva e idempotente, como todas
as outras). Depois disso, publique a versão nova de
`supabase/functions/b7-auth/index.ts` como Edge Function.

## Arquivos no zip

`migration_video.sql` (novo), `js/video.js` (novo), `styles/video.css`
(novo), `js/database.js`, `js/permissoes.js`, `js/usuarios.js`,
`js/app.js`, `index.html`, `sw.js`, `js/auth.js`,
`supabase/functions/b7-auth/index.ts`, `CORRECOES_2026-09-09.md`.

`VERSAO` → `2026-09-14-b`, cache do service worker →
`roteiros-b7-v60`.
