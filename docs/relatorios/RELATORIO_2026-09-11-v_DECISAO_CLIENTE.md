# Relatório — Build 2026-09-11-aj — Decisão do cliente registrada pela equipe B7

(Mesmo conteúdo da seção correspondente em CORRECOES_2026-09-09.md.)

## Build 2026-09-11-aj — B7 Design: decisão do cliente registrada pela equipe (WhatsApp e outros canais)

Migração `migration_design_decisao_cliente.sql` (roda depois de
`migration_design_arquivos_v2.sql`; exige `migration_aprovacoes_v3.sql`).

### O que a auditoria mostrou antes de mexer

- A decisão do cliente sobre Design já tinha um lugar: `design_enviar_cliente`
  cria uma linha em `aprovacoes` (tipo `design_versao`), o mesmo motor
  do Portal (`aprov_decidir`, `aprov_anular`, `aprov_emitir`,
  `aprov_processar_evento`). Mas o laço nunca fechava: quando o cliente
  decidia pelo Portal, `aprovacoes.situacao` mudava e a PEÇA continuava
  "Aguardando cliente" (nada propagava pra `design_versoes`/
  `design_deliverables`), e o Kanban da peça não era achado (o motor
  procurava `tipo_vinculo = 'design_versao'`, o card é
  `'design_deliverable'`) — e ainda criava um segundo card em
  "ajustes". Nenhuma forma de registrar decisão vinda de fora, nenhuma
  procedência.

### Implementado e testado

- **Um motor só, procedência diferente.** Toda decisão do cliente sobre
  Design continua sendo uma linha em `aprovacoes`. Colunas novas:
  `origem_decisao` ('portal' | 'externa'; nulo nas antigas = portal),
  `canal_decisao` (whatsapp | ligacao | reuniao | presencial | outro),
  `registrado_por`, `registrado_por_nome`, `observacao_decisao`. Na
  decisão externa, `decidido_por` é quem REGISTROU (pessoa da B7):
  nenhum usuário de cliente é usado como ator, nenhuma sessão é criada,
  nenhum evento diz que o cliente clicou.
- **`design_registrar_decisao_cliente(peça, decisão, canal, observação,
  partes)`** — só Administrador/Coordenador (checado no banco, não no
  botão; designer e cliente do Portal são recusados). Uma ação de
  negócio: garante a linha em `aprovacoes` para a versão de Design
  atual (cria se a peça estava só "aprovada internamente", com
  "Enviado ao cliente via WhatsApp" e SEM notificar o Portal), grava a
  decisão com procedência, o feedback por slide, o comentário, e emite
  o evento pelo `aprov_emitir` de sempre (notificações da equipe +
  Kanban). Decisões: `enviado` (só marca "Aguardando cliente"),
  `aprovado`, `ajustes`, `recusado` (exige motivo). Idempotente: a
  mesma decisão de novo devolve `inalterado` sem gravar nem notificar;
  decisão diferente por cima de decisão já feita exige anulação do
  Admin (mensagem diz isso).
- **Trigger `design_sync_decisao_cliente`** em `aprovacoes` (tipo
  design_versao): qualquer mudança de situação — Portal, registro pela
  B7 ou anulação — propaga pra peça (`aprovada_cliente`/`aprovado_cliente`,
  `ajuste_cliente`/`ajustes_cliente`, anulação → `enviada_cliente`/
  `aguardando_cliente` e limpa o feedback por slide dessa decisão) e
  avisa o designer UMA vez ("Cliente aprovou a peça — … via WhatsApp
  (registrado por Ana Coord)"; "Cliente solicitou ajustes — 2 slides
  precisam de alterações. Slide 03: … Slide 05: …"). Só a versão de
  aprovação mais nova manda na peça. É isto que faz Portal e registro
  externo convergirem no mesmo resultado operacional.
- **`aprov_processar_evento` recriada** (cópia fiel da v3) com duas
  correções cirúrgicas: texto honesto quando a origem é externa
  ("Cliente (Chácaras) aprovou a peça de Design X — via WhatsApp,
  registrado por Ana Coord", nunca "Ana, da Chácaras, aprovou"), e o
  card do Kanban da peça de Design achado pelo vínculo certo (sem
  segundo card). Kanban: aprovado → pronto, ajustes/recusado → ajustes,
  anulação → volta a aguardando_cliente com histórico.
- **Feedback do cliente por slide/frame** (§11/§13/§37): colunas
  `cliente_ajuste`, `cliente_ajuste_em`, `cliente_ajuste_canal` em
  `design_arquivos`, no arquivo efetivo do slide — separadas do ajuste
  interno (`revisao`). Também vai pra `aprovacao_partes` (motor de
  aprovação, com rótulo "Slide 03"). Na revisão, cada slide tem
  "Registrar ajuste do cliente neste slide"; as marcações ficam na tela
  (pill tracejada roxa, "2 marcados pra enviar") até "Enviar ajustes do
  cliente ao Designer" — UMA ação, UMA notificação agrupada, UM card.
  O designer vê no slide: "AJUSTE SOLICITADO PELO CLIENTE NESTE SLIDE ·
  VIA WHATSAPP" (roxo) com a mensagem e "Enviar nova versão do slide
  03"; o ajuste interno continua vermelho, "Ajuste interno B7". Slides
  sem feedback não mudam.
- **Aprovação presa à versão exata** (§14): o snapshot da linha de
  aprovação guarda `arquivos_efetivos` (arquivo, slide, versão de cada
  um). Depois de V02 só nos slides 03/05, a nova aprovação do cliente é
  OUTRA linha (versão 2 da aprovação), com composição V01,V01,V02,V01,V02
  — a linha de "ajustes" fica preservada. A aprovação anterior não
  passa pra arte corrigida. `design_aprovar_interno` ganhou a trava:
  não aprova por dentro enquanto o cliente tem ajuste pendente num
  slide cuja arte ainda é a mesma. Aprovar o todo com slide marcado
  contradiz e é recusado.
- **Interface do Design** (§36): a lateral separa "Aprovar internamente"
  (revisão B7) de um bloco próprio **Decisão do cliente**: status
  ("Aguardando cliente", "Aprovado pelo cliente", "Cliente solicitou
  ajustes", "Recusado pelo cliente") e o histórico de cada decisão com
  procedência — "Aprovado pelo cliente · Envio 2 · arte V02 · Via
  WhatsApp · registrado por Ana Coord · hoje às 17:42 · “Pode aprovar o
  carrossel inteiro.”", ou "Via Portal do Cliente · <nome do cliente>";
  anulação por cima ("Anulada por Yury · motivo · voltou a aguardar o
  cliente"), sem apagar a decisão original. Ação primária depois da
  aprovação interna: **Registrar decisão do cliente** (modal: Aprovado
  / Cliente solicitou ajustes / Recusado / Só marcar como enviado;
  canal com WhatsApp por padrão; observação — obrigatória na recusa;
  aviso de que é registro em nome do cliente). "Enviar pelo Portal do
  Cliente" e "Finalizar mesmo assim" viram secundários. Cliente sem
  conta no Portal não é bloqueio em lugar nenhum.
- **Aprovações (§35):** lista e detalhe mostram a procedência ("Via
  WhatsApp · reg. Ana Coord", "Aprovado por cliente via WhatsApp ·
  registrado por Ana Coord", com a frase "Decisão recebida fora do
  sistema e registrada pela Branding7 em nome do cliente — o cliente
  não entrou no Portal para isto"). `aprovacoes_painel` ganhou as 5
  colunas de procedência (no fim, `create or replace`). Anulação: o
  mesmo "Excluir aprovação" do Admin (`aprov_anular`) funciona sobre a
  decisão registrada por fora; nada é apagado.
- **Linha do tempo:** "Slide 03 — ajuste solicitado pelo cliente (via
  WhatsApp)" com a mensagem; notificação do designer "Cliente aprovou a
  peça" com origem.
- **Testes executados.**
  - SQL no Postgres 16 local (`teste_decisao_cliente.sql`): §44 card
    aprovado via WhatsApp (estado, versão, procedência, 1 notificação
    pro designer, notificação da equipe com texto honesto, 1 card
    Kanban em "pronto", 0 eventos com ator cliente, retry = inalterado);
    §49 anulação pelo Admin (volta a aguardando_cliente / enviada_cliente
    / Kanban aguardando_cliente, histórico com motivo, nova decisão
    depois via ligação); §45 card 2 com ajustes via WhatsApp → V02 →
    aprovação interna → aprovado pelo cliente (aprovação 2 presa à V02,
    a 1 preservada); §46/§47 carrossel: "só enviado", ajustes em 03 e 05
    (por slide + partes + notificação agrupada única + 1 card), V02 só
    03/05, aprovação interna, aprovação total presa a V01,V01,V02,V01,V02;
    §50 designer negado na função; cliente do Portal (role
    authenticated) negado; §51 cliente sem nenhum usuário de Portal
    (`perfil_clientes` vazio) — fluxo inteiro passa.
  - Playwright ponta a ponta (cenário novo em `test_arquivos_v2_e2e.py`,
    35 verificações; suíte inteira 143, 0 erro JS): botão só aparece
    após aprovação interna; modal com WhatsApp padrão e aviso; card
    aprovado com histórico correto; marcação por slide sem gravar nada
    até enviar; modal pré-seleciona ajustes com "03, 05"; designer não
    vê os botões E é negado chamando a função direto; designer vê o
    bloco roxo "via WhatsApp" e o botão de nova versão; reenvio 03/05;
    aprovação interna de novo (não herda a do cliente); aprovação
    total presa à composição mista; histórico com as duas decisões.
  - Regressão das rodadas anteriores (Arquivos 2.0, 5b, 4) sem quebra.

### Implementado, mas requer validação adicional

- **Migração precisa rodar no Supabase.** Ela recria
  `aprov_processar_evento` (cópia fiel da v3 + 2 patches) — se alguma
  migração posterior à v3 tiver mudado essa função no seu projeto, a
  cópia daqui prevalece. No repositório, só v2 e v3 a definem.
- **Portal (§48):** a compatibilidade está no trigger (qualquer
  `aprov_decidir` do cliente sobre `design_versao` agora propaga pra
  peça e avisa o designer com "Via Portal do Cliente"), mas NÃO foi
  feita uma aprovação real pelo Portal — não existe conta de cliente de
  teste segura aqui. Testado só o caminho SQL do trigger.
- **Ajuste por slide vindo do Portal** (`aprov_decidir_parte`) não
  alimenta `cliente_ajuste` no slot do designer (só a decisão do todo
  propaga); o feedback continua visível em Aprovações. Fica pra quando
  o Portal de Design começar a ser usado.
- **"Recusado pelo cliente"** usa o mesmo estado operacional da peça
  que "ajustes" (`ajustes_cliente`) — não existe estado de recusa em
  `design_versoes`/`design_deliverables` e criar um mexeria em
  constraints e telas fora do escopo. A distinção fica em `aprovacoes`
  (`recusado`), no bloco "Decisão do cliente", na notificação e no
  Kanban (prioridade alta).

### Não implementado por bloqueio

- Teste real pelo Portal do Cliente (sem conta segura de cliente).

Arquivos alterados: `migration_design_decisao_cliente.sql` (nova),
`migration_tudo.sql`, `js/design.js`, `js/database.js`, `js/aprovacoes.js`,
`styles/design.css`, `js/auth.js`, `sw.js`. `VERSAO` → `2026-09-11-aj`,
cache → `roteiros-b7-v53`.
