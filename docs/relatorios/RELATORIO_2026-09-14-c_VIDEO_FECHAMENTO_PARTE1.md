# Build 2026-09-14-c — B7 Vídeo: fechando as três lacunas da Parte 1

**Pedido:** depois do relatório do build anterior, você pediu para
fazer "tudo que ficou de fora". Como isso misturava duas coisas bem
diferentes — lacunas técnicas da própria Parte 1 e a Parte 2 inteira
(revisão/versão do vídeo, nunca especificada) — perguntei antes de
sair implementando, e a resposta foi: só fechar as lacunas técnicas
da Parte 1. É isso que este build entrega.

## Implementado e testado

**Importação de XLSX.** A biblioteca SheetJS foi vendorizada
(`js/vendor/xlsx.full.min.js`, mesmo padrão do `html2canvas`/`jspdf`
já usados no projeto). A tela de importação agora aceita `.csv` e
`.xlsx`/`.xls` — para XLSX, só a primeira aba do arquivo é lida, o
cabeçalho é normalizado do mesmo jeito que o CSV e as datas viram
`AAAA-MM-DD` automaticamente. Isso foi testado de ponta a ponta:
gerei um `.xlsx` sintético (com acentos, uma data e uma linha em
branco no fim, para simular o que uma planilha real teria) e mandei
o resultado da leitura, de verdade, para a função de importação no
banco de teste — o cliente existente casou sozinho, o desconhecido
ficou pendente de resolução, e a demanda criada a partir da linha
resolvida ficou com a data certa. A linha vazia foi descartada como
esperado.

**Vínculo com Gravação.** A Central do Videomaker agora tem o
seletor "Vincular a uma gravação deste cliente" — tanto ao criar uma
demanda manual quanto na ficha de uma já existente. A lista de
gravações carrega automaticamente conforme o cliente selecionado.
Testado no banco: vincular e trocar a gravação de uma demanda
persiste corretamente.

**Integração opcional com o Kanban geral.** Cada Demanda de Edição
agora pode ganhar uma "sombra" no Kanban geral — mas só quando o
trabalho de verdade começa (a situação vira "Em edição"), não desde
que a demanda nasce, para não encher o quadro geral com toda demanda
ainda pendente de planilha. Depois de nascido, o card acompanha:
correção → coluna Ajustes, entregue → coluna Pronto, descartado →
arquivado. Testei a sequência inteira no banco (criar → atribuir →
correção → entregue → descartado) e cada transição bateu certo no
Kanban.

Nesse teste apareceu um bug de verdade, que já corrigi: atribuir um
videomaker a uma demanda pendente também move a situação para "Em
edição" (regra que já existia), mas essa transição específica não
disparava a criação do card — só mudar a situação manualmente
disparava. Corrigido para os dois caminhos criarem o card do mesmo
jeito.

`migration_video_kanban.sql` foi aplicada e reaplicada contra o
mesmo Postgres de teste da Parte 1 para confirmar que rodar duas
vezes não quebra nada (idempotência) — nesse processo também corrigi
um detalhe técnico na visualização das demandas (a `view` precisou
listar as colunas explicitamente, porque o Postgres não deixa uma
coluna nova entrar no meio da lista quando você recria uma view).

## Implementado, mas requer validação adicional

O parser de XLSX continua sem ser testado contra uma planilha real
sua — só contra o arquivo sintético que criei para o teste. Formato
de data fora do padrão, fórmulas, células mescladas ou uma segunda
aba com dados (só a primeira é lida) podem pedir um ajuste na
primeira importação de verdade.

## Preparado, mas ainda não aplicado

`migration_video_kanban.sql` está pronta e testada localmente, mas
precisa ser rodada no Supabase de produção — depois de
`migration_video.sql`, mesmo processo manual de sempre.

## Não implementado por decisão consciente

A Parte 2 (revisão/versão do vídeo dentro do sistema) continua de
fora — foi você mesmo quem decidiu isso nesta conversa, já que ela
nunca foi especificada. Fica pronta para quando você mandar a
especificação dela.

## Migração necessária

Rode `migration_video_kanban.sql` no SQL Editor do Supabase, depois
de `migration_video.sql` (que ainda precisa ser aplicada, se ainda
não foi).

## Arquivos no zip

`migration_video_kanban.sql` (novo), `js/vendor/xlsx.full.min.js`
(novo), `js/video.js`, `js/database.js`, `index.html`, `sw.js`,
`js/auth.js`, `CORRECOES_2026-09-09.md`.

`VERSAO` → `2026-09-14-c`, cache do service worker →
`roteiros-b7-v61`.
