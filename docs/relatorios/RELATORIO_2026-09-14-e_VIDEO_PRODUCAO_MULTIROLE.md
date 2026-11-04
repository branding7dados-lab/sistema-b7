# Relatório — B7 Vídeo Parte 1.1 (produção mensal, Lista/Quadro, detalhe, Central de Vídeo, multi-função)

Build `2026-09-14-e`. Este relatório documenta a rodada que corrigiu a
tela principal do módulo de Vídeo e adicionou usuários internos com
mais de uma função. Segue o mesmo formato honesto de sempre: o que foi
testado de verdade, o que foi implementado mas precisa de validação
sua, o que está pronto mas não foi aplicado, e o que ficou de fora por
decisão consciente.

## 1. Causa raiz do problema relatado ("367 demandas no total")

A tela antiga de Vídeo (`Demandas de edição`) listava **todo o
histórico** de uma vez — as 367 demandas já importadas, incluindo as
353 já entregues — sem nenhum filtro de período ativo por padrão. Não
era um bug de contagem: a consulta trazia exatamente o que existia no
banco. O problema era de escopo da tela: faltava competência (mês/ano)
como filtro principal, do jeito que o módulo de Design já tinha.

Corrigido: a tela agora se chama **Produção de Vídeo**, com competência
como controle principal e o mês atual como padrão. Trocar de mês é só
uma projeção diferente sobre os mesmos dados — nada é arquivado,
duplicado ou apagado ao mudar de mês.

## 2. Backfill de competência e prioridade

`video_backfill_competencia()` e `video_backfill_prioridade()` leem
**somente** o dado original preservado em
`demandas_edicao_import_linhas.dados_originais` (ligado a cada demanda
pelo `demanda_id` que já existia desde a importação, nunca é limpo).
Nenhum dos dois adivinha: onde a origem confiável não existe, a
demanda entra numa lista de "competência não confiável"
(`video_demandas_competencia_nao_confiavel()`) para revisão manual em
vez de receber um mês chutado.

Prioridade tinha uma complicação real: o importador da Parte 1 nunca
salvava a prioridade da planilha como campo próprio — só usava o valor
para montar o texto de observações. `video_backfill_prioridade()`
recupera isso de duas fontes, nessa ordem: o JSON de origem (para
importações futuras, que já vão trazer o campo certo) e, quando não
existe, um recorte de texto das observações já salvas no padrão
"Prioridade (planilha): X · ...". Testado contra o banco real de
teste: recuperou 198 demandas como "alta" — conferi manualmente contra
o texto literal de uma amostra dessas observações.

**Estes dois backfills não têm botão na tela.** Você precisa rodar
manualmente no SQL Editor, uma vez, depois de aplicar a migration (ver
`CORRECOES_2026-09-09.md`, seção desta rodada, passo 3). Rodar de novo
depois não causa dano — só reaplica onde ainda divergir.

## 3. Kanban mensal e pendências de meses anteriores

O Quadro (Kanban) agora também respeita o filtro de competência. Um
aviso no topo da tela mostra quantas demandas de meses anteriores
ainda estão pendentes, em edição, em correção ou em standby (nunca
"entregue" nem "descartado") e dá acesso a essa lista sem precisar
trocar o mês manualmente — elas não ficam escondidas nem aparecem
duplicadas dentro do mês corrente.

## 4. Lista/Quadro, filtros e resumo mensal

Lista (tabela) é a visão padrão; o alternador para Quadro reaproveita o
mesmo componente (`.seg-vista`) já usado no Design. Os filtros
(competência, cliente, status, responsável, prioridade, busca) são os
mesmos objeto de estado para as duas visões — trocar de Lista para
Quadro preserva o filtro ativo. O resumo mensal (contagem por status)
funciona como atalho de filtro rápido, no mesmo padrão visual do
resumo do Design.

## 5. Quadro sem parede intransponível em "Entregue"

Cada coluna do Kanban mostra até 30 cartões; o resto fica atrás de um
botão "+N entregues…" que expande a lista — nenhuma demanda é
escondida, só paginada, então a coluna "Entregue" não trava mais a
rolagem da tela inteira.

## 6. Cartão e detalhe da demanda

Cartão do quadro ganhou badge de prioridade visível. O detalhe da
demanda foi reorganizado em duas colunas: corpo principal (materiais,
observações, histórico) e painel lateral fixo (situação, prioridade,
responsável, prazo, competência, pacote, origem, ações) — mesmo modelo
já usado no Design, para manter consistência visual entre os dois
módulos.

## 7. Central de Vídeo (fila pessoal)

Nova área separada da "Produção de Vídeo" (que é a visão da equipe
inteira): a Central de Vídeo mostra só o que é relevante para quem
está logado — minhas atrasadas, pendentes, em edição, em correção,
próximas entregas e pendências de meses anteriores. Segue o mesmo
padrão estrutural da Central do Design.

## 8. Usuários com mais de uma função — o caso do Kevin

Este era o requisito mais delicado do pedido: alguém como o Kevin
precisa ser Administrador **e** Videomaker **na mesma conta**, sem
trocar de "modo" e sem duas entradas de navegação.

**Como foi implementado**: uma tabela nova, `perfis_funcoes_extra`
(perfil + função extra), **aditiva** — não substitui o campo `papel`
principal que já existia, soma uma função extra a ele. Combinações
permitidas: Admin+Videomaker, Admin+Designer, Coordenador+Videomaker,
Coordenador+Designer, Videomaker+Designer. Cliente nunca pode ter
função extra — bloqueado no backend (função de borda), não só
escondido na tela.

`eh_videomaker_elegivel(id)` é a checagem única (papel principal =
videomaker OU tem função extra videomaker, E conta ativa) que
substituiu toda comparação direta `papel = 'videomaker'` nos lugares
que importam para o teste do Kevin: `sou_videomaker()`, criação de
demanda de vídeo, atribuição de demanda de vídeo, a view
`videomakers_elegiveis` (usada no seletor de responsável) e a
navegação (o item "#/video" do menu agora aparece/some por
elegibilidade dinâmica, não por uma lista fixa de papéis — de quebra,
isso corrigiu uma inconsistência que já existia na navegação do
Designer). A sessão do usuário (`minha_sessao`) passou a expor
`funcoes_extra` para o frontend saber quais funções extras a pessoa
logada tem.

**Como foi testado**: diretamente no Postgres, simulando RLS para três
contas sintéticas — Kevin (papel admin + função extra videomaker) e
Ana (papel coordenador + função extra videomaker), ambos corretamente
reconhecidos como elegíveis para receber demanda de vídeo pelas
funções acima; um admin comum sem função extra, corretamente
rejeitado. **Isto não foi testado clicando pelo navegador real** — só
no nível de SQL/RLS (ver seção "requer validação adicional" abaixo).

**Compatibilidade**: nenhum usuário existente muda de comportamento —
função extra é sempre um acréscimo opcional; quem tem só um papel
continua funcionando exatamente como antes.

## 9. Tela de gestão de usuários

Criar/editar usuário interno ganhou um bloco de checkboxes "Funções
extras" (escondido para Cliente; uma função não pode ser marcada como
extra dela mesma). A listagem de usuários mostra um badge combinado
("Papel · Extra"). Toda escrita em `perfis_funcoes_extra` passa pela
função de borda `b7-auth`, com validação server-side (função inválida,
duplicada, ou extra para Cliente são recusadas mesmo que a tela
mande).

## 10. Autorização — nível de dado, não só de tela

O pedido exigia que a autorização fosse reforçada no nível de dado
(RLS/função SQL), não só escondida na interface. Isso foi feito para o
lado Videomaker: a função `eh_videomaker_elegivel()` é usada dentro
das próprias funções SQL de criação/atribuição de demanda (não é uma
checagem que só a tela faz antes de mostrar o botão) — testei isso
diretamente chamando essas funções via SQL simulando cada conta, sem
passar pela interface, e o resultado bateu (Kevin/Ana aceitos, admin
comum rejeitado).

**O que não foi auditado**: se existe alguma política de RLS *fora*
das tabelas de vídeo (por exemplo em tabelas do módulo de Design ou de
Kanban) que ainda compara `papel = 'videomaker'` ou `papel =
'designer'` diretamente e deveria passar a aceitar função extra também
— não fiz uma varredura linha a linha de toda política já existente no
banco procurando esse padrão. As funções que eu efetivamente toquei
nesta rodada foram todas atualizadas.

## 11. Deduplicação de notificação por usuário+evento

Não implementada nesta rodada — o sistema de notificações do módulo de
Vídeo não foi tocado além do necessário para as mudanças de dado
acima. Se isso é importante para você agora (por exemplo, se o Kevin
começar a receber notificação em duplicidade por ter duas funções),
me avise que eu trato numa próxima rodada.

## 12. Decisão consciente de escopo — multi-função aditiva, não reescrita geral

Implementei multi-função como uma camada **aditiva** por cima do
modelo de papel único que já existia, e não como uma reescrita geral
de todo o sistema de permissões (que tocaria Design, Kanban,
Aprovações e mais telas). Essa foi uma decisão deliberada: os casos
concretos pedidos explicitamente (Kevin admin+videomaker, Coordenador+
videomaker) só precisam do lado Videomaker funcionando de ponta a
ponta — e é isso que está implementado e testado.

Deixei a função extra "designer" pronta no schema (a tabela aceita,
a tela de usuários aceita, a validação server-side aceita) para não
fechar a porta para o próximo passo, **mas ela ainda não está ligada
no módulo de Design em si**: `listarDesigners()`, a elegibilidade de
atribuição de demanda de Design e a RLS do módulo de Design continuam
comparando `papel = 'designer'` diretamente, sem reconhecer função
extra. Ou seja: hoje você já consegue marcar alguém como "Coordenador
+ Designer" na tela de usuários e isso fica salvo corretamente no
banco, mas essa pessoa ainda não vai aparecer como opção elegível para
receber demanda de Design por causa dessa função extra — só por um
papel principal `designer` de verdade. Se isso for necessário logo,
é um trabalho relativamente pequeno (replicar o mesmo padrão de
`eh_videomaker_elegivel()` para o lado Design) que posso fazer numa
próxima rodada.

## 13. Testes efetivamente executados

- `migration_video_producao.sql` aplicada duas vezes seguidas contra
  Postgres 16 local com o histórico real de 731 demandas já
  importadas — sem erro na segunda vez (idempotência confirmada).
- Backfill de competência e de prioridade testados com dado
  deliberadamente corrompido e depois restaurado, confirmando que a
  função recupera o valor certo a partir da origem preservada, e que
  rodar duas vezes não muda nada na segunda.
- Três contas sintéticas (Kevin, Ana, um admin comum) testadas
  diretamente contra RLS simulado para a elegibilidade de Videomaker.
- `node --check` limpo em todos os arquivos `.js` alterados.
- `deno lint` limpo em `b7-auth/index.ts` (a rede deste ambiente de
  teste bloqueia buscar o pacote do Supabase por HTTPS, então não deu
  para rodar `deno check` com resolução de tipo completa — só a
  análise de sintaxe/AST local, que não achou problema novo nas
  linhas que toquei).
- Parsing do importador (`linhasParaObjetos`) re-testado num sandbox
  Node contra o CSV real de 731 linhas, confirmando que `prioridade`
  passou a ser populada corretamente (727/731 linhas) sem quebrar
  nenhum outro campo.
- **Não testado**: uma passada real clicando pelo navegador (Chrome ou
  qualquer outro) nas telas de Produção de Vídeo, Central de Vídeo e
  usuários. Este ambiente não tem como abrir seu sistema de verdade;
  toda a verificação foi no nível de SQL/RLS e de sintaxe JS. Vale
  conferir na prática, principalmente: navegação de quem tem função
  extra, o checkbox novo na tela de usuários, e o comportamento visual
  do quadro/lista em telas menores.

## 14. Arquivos alterados

`migration_video_producao.sql` (novo),
`supabase/functions/b7-auth/index.ts`, `js/auth.js`,
`js/permissoes.js`, `js/database.js`, `js/usuarios.js`, `js/video.js`
(reescrito), `styles/video.css`, `sw.js`.
`VERSAO` → `2026-09-14-e`, cache → `roteiros-b7-v63`.

**Lembrete**: `supabase/functions/b7-auth/index.ts` exige um deploy
manual **separado** (`supabase functions deploy b7-auth`) — subir o
zip no GitHub Pages e rodar a migration não atualiza a função de
borda. Sem esse passo, o checkbox de função extra na tela de usuários
vai falhar ao salvar.
