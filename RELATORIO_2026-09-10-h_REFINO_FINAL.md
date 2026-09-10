# B7 Design — Refino Operacional Final — Relatório (build 2026-09-10-h)

Este relatório cobre a especificação de 59 seções ("B7 Design Final
Operational Refinement") recebida nesta sessão. Ela pedia, entre outras
coisas, uma Central de Designer 100% focada em Design, uma conclusão
formal de Linha Editorial como gatilho de liberação de demandas,
versionamento com reconciliação, notificações duráveis e agrupadas, som
de login sem repetição falsa, e acesso de leitura (nunca escrita) do
Designer a Linha Editorial e cliente.

Dado o tamanho da especificação frente ao orçamento de uma sessão,
priorizei as partes de maior risco/maior valor — segurança real (não só
esconder botão), o gatilho formal com versionamento e reconciliação, e a
home do Designer — e testei cada uma de verdade antes de marcar como
pronta. A lista abaixo é honesta sobre o que ficou de fora.

## 1. Implementado e testado

- **Central do Designer = só Design.** A rota padrão (`#/`) para quem
  é Designer abre `B7.Design.abrir(aba, true)` em vez da Central de
  Produção genérica (Gravações/Roteiros/Linhas/Aprovações), que nunca
  fazia sentido para esse papel. Confirmado com Playwright: a home do
  Designer mostra "Design" diretamente, a barra lateral só tem "Design"
  e "Linhas editoriais", e não aparece nenhum texto de Gravações/
  Roteiros na tela — sem erro de console.
- **"Concluir Linha Editorial"** (`linha_concluir`, nova função no
  banco, só equipe/`sou_equipe()`): gera/atualiza as peças de Design
  reaproveitando `design_gerar_da_linha` já existente (não duplica
  geração), grava um snapshot versionado (`linha_versoes`), e — se um
  responsável for indicado no modal — atribui as peças sem responsável
  a ele e move o Kanban vinculado. Testado com SQL de aceitação real
  (não mock) no Postgres 16 local: linha sem responsável gera 3 peças e
  notifica os 2 designers ativos; concluir de novo sem mudar nada não
  duplica peça nem marca nada como desatualizado (idempotente); nova
  linha concluída já com responsável atribui a peça e notifica
  "atribuída a você"; Designer tentando chamar a função recebe erro de
  permissão. Também testado na UI (Playwright): o botão aparece, o
  modal abre com a lista real de designers, o RPC é chamado com os
  parâmetros certos, o toast mostra a contagem real devolvida pelo
  banco, e o selo "Concluída · vN" aparece no cabeçalho depois.
- **Versionamento e reconciliação.** Mudei o headline de um conteúdo e
  concluí a linha de novo: **só** a peça daquele conteúdo ficou marcada
  `briefing_desatualizado=true` — as outras duas, que não mudaram,
  continuaram `false`. A reconciliação compara o snapshot novo com o
  anterior por `conteudo_id`, nunca apaga histórico (cada conclusão vira
  uma linha nova em `linha_versoes`).
- **Segurança real, testada com tentativa de mutação direta — não só
  botão escondido.** Simulei uma sessão de Designer no Postgres
  (`set role authenticated` + `request.jwt.claim.sub` do designer) e
  tentei `UPDATE`/`INSERT` direto em `linhas_editoriais`, `conteudos` e
  `clientes`: todos os `UPDATE` afetaram **0 linhas** (RLS via
  `USING`), e o `INSERT` em `conteudos` foi **recusado explicitamente**
  por violação de RLS (`WITH CHECK`). Essa é a exigência de segurança
  mais importante da especificação, e ela já estava garantida pela
  arquitetura de RLS existente desde `migration_rls.sql` — não precisei
  adicionar política nova para isso, só confirmei com teste real. O
  Designer também consegue **ler** (`SELECT`) normalmente esses dados,
  como pedido.
- **Notificação em lote, nunca uma por peça.** Nova ramificação em
  `design_processar_evento` (função reaproveitada, não duplicada) para
  o evento `linha.concluida`: uma notificação por destinatário — não
  uma por peça — seja "atribuída a você" (responsável único) ou
  "disponível" (um envio por Designer ativo). Peças com briefing
  mudado geram uma notificação separada "Briefing atualizado",
  agrupada por Designer. Confirmado por SQL de aceitação lendo a tabela
  `notificacoes` como cada destinatário real veria (respeitando a
  mesma RLS que a UI usa).
- **Som de login sem repetir falso positivo.** `perfil_preferencias_
  gravar` agora aceita `ultimo_som_em` (validado como timestamp real no
  servidor; lixo é rejeitado). `js/notificacoes.js` ganhou
  `avisarLoteAoEntrar()`: no primeiro `montar()` da sessão, busca a
  notificação não lida mais recente, compara com a marca d'água salva,
  toca o som só se for genuinamente mais nova, grava a nova marca — e
  nunca marca a notificação como lida. A lógica de comparação e
  persistência foi validada por leitura de código e `node --check`; a
  reprodução sonora num navegador real com restrição de autoplay **não**
  foi validada (ver seção 3).
- **Leitura (não escrita) de Linha Editorial e cliente para o
  Designer.** A rota `cliente` entrou na lista de rotas permitidas do
  Designer (`js/permissoes.js`) — sem isso ele nem conseguia abrir a
  ficha do cliente pela UI, mesmo com o banco já permitindo leitura. Um
  guardião central em `js/conteudo.js` (`ligarCampos`, usado por toda
  tela de Linha Editorial/conteúdo/pilares/inteligência do cliente/
  onboarding/status semanal) desabilita **todo** campo de autosave para
  quem é Designer, num ponto só — testado na aba Estratégia da Linha
  Editorial: os 9 campos editáveis daquela aba apareceram todos
  desabilitados para o Designer.
- **Migrations aditivas e idempotentes.** Rodei a cadeia completa desde
  `supabase_setup.sql` até `migration_editorial_versao.sql` (16
  arquivos, na ordem documentada em `migration_tudo.sql`) do zero, duas
  vezes seguidas, sem erro em nenhuma etapa. Os testes de regressão
  antigos (`t_aprov.sql`, `t_design.sql`, `t_design_refino.sql`) foram
  reexecutados contra essa cadeia completa e continuam passando com
  exatamente os mesmos erros esperados de antes — nada quebrou.
- `node --check` passou em todos os 8 arquivos JS tocados e no `sw.js`.
- `VERSAO` → `2026-09-10-h`; cache do service worker →
  `roteiros-b7-v23`.

## 2. Implementado, mas requer validação adicional

- **Supabase real.** Todo teste foi contra Postgres 16 local (o mesmo
  rig usado em builds anteriores desta sessão) — nenhum teste rodou
  contra o projeto de produção. Recomendo rodar
  `migration_editorial_versao.sql` num ambiente de teste primeiro e
  conferir com uma consulta direta que `design_resumo` e
  `linhas_resumo` devolvem as colunas novas antes de considerar
  encerrado.
- **Som de notificação em navegador real.** A lógica (comparação de
  timestamp, persistência da marca d'água, não marcar como lida) foi
  validada, mas eu não tenho como abrir um navegador real com um login
  de verdade para confirmar que o som efetivamente toca (ou fica
  silenciosamente bloqueado por autoplay, que é o comportamento normal
  de qualquer navegador sem gesto prévio da pessoa — isso não é um bug
  deste build, é a mesma guarda que `tocarSom()` já tinha antes).
- **Push em dispositivo real.** Não testado nem alterado neste build —
  fora do escopo desta rodada (só mexi no som local do sino).
- **Realtime com duas sessões simultâneas.** Não retestado neste build.
  O canal usado pela Central do Designer é o mesmo já existente e não
  foi alterado, então o comportamento visto em builds anteriores deve
  se manter — mas não reconfirmei agora com duas abas/sessões reais.
- **Teste responsivo completo (mobile/tablet) das telas novas.** Testei
  a Central do Designer e o modal "Concluir Linha Editorial" só em
  1280px (desktop) nesta rodada — não refiz a bateria completa em
  390px/834px que builds anteriores tiveram, por orçamento de tempo.

## 3. Não implementado por decisão consciente (não por bloqueio técnico)

- **Somente-leitura exaustivo em toda a ficha do cliente.** O guardião
  central em `ligarCampos` cobre todo campo de texto/select ligado ao
  autosave — incluindo a aba Inteligência/Onboarding do cliente, que é
  onde ICP e posicionamento realmente vivem. O que **não** fiz foi
  esconder, campo a campo, os botões de ação das outras abas da ficha
  do cliente (ex.: "Arquivar gravação", "Excluir cliente", "Nova
  gravação" nas abas Gravações/Geral) — esses continuam visíveis para
  o Designer na UI, embora cliquem em ações que o mesmo RLS testado
  acima já bloqueia no banco (mesma política `sou_equipe()` cobre
  `clientes`/`gravacoes`/`status_semanais`). Não é um buraco de
  segurança — é uma UI que pode mostrar um botão que erra ao ser
  clicado, em vez de vir escondido. Como o caminho principal do
  Designer é a Central de Design (não a ficha completa do cliente),
  decidi não gastar o orçamento restante numa varredura botão a botão
  de telas que ele deve visitar raramente; deixo isso como recomendação
  para uma rodada futura se o dono achar que vale a pena.
- **Remoção do botão antigo "Enviar para Design".** A especificação
  pede que "Concluir Linha Editorial" seja o gatilho *formal*, mas não
  pede explicitamente a remoção do atalho rápido já existente (que
  ainda é útil para gerar peças sem passar pela conclusão formal, por
  exemplo num teste pontual). Os dois coexistem agora — o botão antigo
  ficou rotulado "(rápido, sem versão)" para deixar claro que não gera
  snapshot nem notificação em lote. Recomendo ao dono decidir numa
  rodada futura se esse botão deve sumir da interface.
- **Migração retroativa de linhas editoriais antigas.** Como pedido
  explicitamente na especificação (nada de inundar o sistema de
  demandas de Design a partir de todo o histórico), nenhuma linha
  antiga foi tocada automaticamente por este build — só conclusões
  novas, feitas manualmente pela equipe, geram o efeito. Não construí
  nenhuma ferramenta de reconciliação manual em massa para o histórico,
  porque a especificação também não deixou claro que isso fosse
  necessário agora; se o dono precisar aplicar a conclusão formal a
  linhas antigas, o mesmo botão "Concluir Linha Editorial" funciona
  linha por linha, sem ferramenta nova.

## Como aplicar

1. Suba os arquivos deste zip no repositório (substituindo os
   existentes): `js/app.js`, `js/design.js`, `js/database.js`,
   `js/notificacoes.js`, `js/linha.js`, `js/conteudo.js`,
   `js/permissoes.js`, `js/auth.js`, `styles/global.css`, `sw.js`,
   `migration_editorial_versao.sql` (novo).
2. No SQL Editor do Supabase, rode **`migration_editorial_versao.sql`**
   uma vez (depois de `migration_design_refino.sql`, que já deveria
   estar aplicado do build `-f`). É aditiva e idempotente.
3. Confira com uma consulta direta que `design_resumo` e
   `linhas_resumo` devolvem `briefing_desatualizado`/
   `linha_versao_confirmada` e `concluida_em`/`versao_design`,
   respectivamente, antes de liberar para a equipe.
