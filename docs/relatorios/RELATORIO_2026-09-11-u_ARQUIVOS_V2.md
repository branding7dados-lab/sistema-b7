# Relatório — Builds 2026-09-11-ah / -ai — B7 Design File Review 2.0

(Mesmo conteúdo das seções correspondentes em CORRECOES_2026-09-09.md.)

## Build 2026-09-11-ah — B7 Design File Review 2.0: prévia, arte por slide, revisão por parte, download e ZIP

Refino do fluxo de ARQUIVO do B7 Design (upload → revisão → download),
sem recriar nada: mesmas peças, mesmas versões, mesmo Kanban, mesmas
notificações, mesma via externa "revisada por fora". Migração aditiva
`migration_design_arquivos_v2.sql` (roda depois de
`migration_design_thumb.sql`).

### Causa raiz da prévia em "tira"

A prévia grande do workspace era um `<div class="ds-ws-preview ds-thumb">`
com `background-image`. A classe `.ds-thumb` é a do card de 52px da
fila: traz `height:52px` e `background-size:cover`. Somada a
`.ds-ws-preview{width:100%}`, a "prévia grande" virava uma faixa de
100% × 52px com a arte cortada no meio — a tira da captura. E mesmo
sem essa colisão, o container tinha `aspect-ratio:4/5` +
`max-height:440px` numa coluna de ~800px: viraria uma caixa 800×440
com `cover` cortando qualquer arte 4:5/9:16/1:1. Não era URL assinada,
nem metadado, nem arquivo errado — era CSS. A correção não esconde a
prévia: a arte agora é um `<img>` de verdade com `object-fit:contain`,
dentro de uma moldura que reserva a proporção REAL do arquivo
(largura/altura medidas no navegador na hora do upload e gravadas em
`design_arquivos`). Nada estica, nada corta; sobra fundo neutro ao
redor quando a proporção não bate com a coluna.

### Implementado e testado

- **Modelo de dados (aditivo).** `design_arquivos` ganhou:
  `parte_tipo` ('slide'|'frame'), `parte_id` (id ESTÁVEL de
  `slides`/`frames` — nunca índice de array), `parte_posicao` (índice
  canônico no upload), `largura`/`altura`, e a decisão de revisão por
  arquivo: `revisao` ('aprovado'|'ajuste'|null), `revisao_mensagem`,
  `revisado_por`, `revisado_em`. `design_arquivo_registrar` recusa
  `parte_id` que não pertença ao conteúdo canônico da peça. Peça de
  arte única (Card, Capa de Reel, Story de 1 frame, manual) continua com
  um slot só, `parte_id` nulo — sem "Slide 01" artificial.
- **Arquivo efetivo atual** (`design_arquivos_efetivos(peça)`): o preview
  mais recente de cada parte numa versão JÁ ENVIADA — rascunho nunca
  conta, upload que falhou nunca chega a ser registrado. A mesma regra
  está espelhada no cliente. É o que a revisão, o histórico e o ZIP
  usam: Slide 01 pode continuar na V01 enquanto o 03 já está na V02.
- **Upload por slide/frame.** No workspace do Carrossel (e Story com
  mais de um frame) cada parte tem seu slot: "Enviar arquivo",
  "Substituir arquivo", "Remover" (só rascunho), arrastar-e-soltar
  dentro do slot, barra de progresso própria. A falha de um slide não
  apaga o outro (tentar de novo é por slide). "Substituir" remove o
  registro antigo do rascunho só DEPOIS de o novo subir. Arquivo de
  apoio (PSD/AI/PDF) continua entrando pela lateral, como `anexo`/
  `producao` — separado da arte dos slides.
- **Envio validando completude** (`design_versao_enviar`): quando a
  versão tem arquivo por parte, exige que TODA parte canônica tenha
  arte — desta versão ou herdada de versão já enviada. A mensagem diz
  quais faltam ("Faltam arquivos nos Slides: 04, 05."). O botão da
  lateral já mostra "Nesta versão: slides 03, 05 · Mantidos da versão
  anterior: 01, 02, 04 · Faltam: …" e só habilita quando dá pra enviar.
  Via externa continua sem exigir arquivo nenhum.
- **Revisão por parte** (`design_parte_revisar`): "Aprovar slide" /
  "Solicitar ajuste neste slide" (com mensagem própria) / "Desfazer",
  só sobre o arquivo efetivo, só com a peça em revisão interna, só
  pela equipe, nunca por quem produziu. Idempotente. Comentário solto
  NÃO vira ajuste — só a ação formal muda `revisao`.
- **Fechamento agrupado** (`design_revisao_fechar`): a lateral mostra
  "3 aprovados · 2 em ajuste · 0 sem decisão"; "Aprovar carrossel" só
  habilita com tudo aprovado; "Enviar ajustes ao Designer" só com
  algum ajuste marcado. Algum ajuste → versão `ajuste_solicitado`, peça
  `ajustes`, Kanban `ajustes`, UMA notificação pro designer ("2 slides
  precisam de alterações: 03 e 05." + a mensagem de cada slide). Tudo
  aprovado → aprovação interna normal. `design_aprovar_interno` ganhou
  a trava: não aprova com ajuste pendente em qualquer parte efetiva
  (§46), e ao aprovar marca como aprovadas as partes ainda sem decisão.
- **Experiência do Designer nos ajustes:** pills com bolinha de estado
  (verde aprovado, vermelho ajuste, âmbar aguardando, rosa novo), o
  slide em ajuste abre com "AJUSTE SOLICITADO NESTE SLIDE" + a mensagem
  + botão "Enviar nova versão do slide 03" em destaque; os aprovados
  mostram "Aprovado" e só um "Substituir arquivo" secundário. Reenvia
  só o que mudou.
- **Prévia grande, tela cheia, download.** Moldura na proporção real
  (1:1, 4:5, 9:16 testados), `object-fit:contain`. "Ver em tela cheia":
  ajustar, zoom +/−/reset, ‹ › entre slides, Esc fecha SÓ a tela cheia
  (o workspace continua; listener em captura), setas do teclado.
  "Baixar arquivo"/"Baixar slide" baixa o ORIGINAL (bytes intactos,
  nunca a miniatura de 320px) via URL assinada curta, com nome limpo:
  `promocao-semana-do-cliente-v01.png`, `capa-projeto-verao-v01.png`,
  `03-ftw-beta-alanina-v02.png`. Nada de uuid, nada do "IMG_9382".
  Extensão original preservada; slug sem acento/barra/caracteres
  inválidos, cortado em 60.
- **"Baixar carrossel"/"Baixar Stories":** UM ZIP
  (`especial-semana-do-cliente-v02.zip`) com o arquivo EFETIVO de cada
  parte, em ordem canônica, prefixo zero-padded
  (`01-mansao-maromba.png` … `05-combo-whey-cta.png`). Montado no
  navegador (ZIP "store", escrito à mão, sem biblioteca) a partir das
  mesmas URLs assinadas — nenhuma credencial de serviço no cliente.
  Feedback real: "Preparando download… 2/5"; falha → "Não foi possível
  preparar o download." e o botão volta.
- **Carrossel incompleto (§18/§61):** resumo "1 slide ainda sem
  arquivo (04)", slide 04 mostra "Sem arquivo", NÃO existe "Baixar
  carrossel" — existe "Baixar arquivos disponíveis (4/5)", que gera
  `…-parcial.zip` sem o 04. "Aprovar carrossel" fica desabilitado.
- **Histórico por parte:** V01/V02 de cada slide (e da arte única)
  como botões pequenos abaixo da arte; clicar mostra a versão antiga
  ("Versão anterior") e o botão vira "Baixar V01". A atual continua
  sendo a prévia principal por padrão. Nada é sobrescrito.
- **Visão geral ("Ver todos"):** grade de miniaturas em ordem canônica
  com estado; clicar abre o slide em grande.
- **Hierarquia do revisor (§43):** pra Admin/Coordenador que não é o
  designer responsável, "Enviar versão em nome do designer — exceção"
  fica recolhido (`<details>`), abaixo das ações de revisão. Histórico
  de versões e Linha do tempo também viraram seções recolhíveis (o
  histórico abre por padrão só em arte única).
- **Formato sem prévia (§55/§56):** PDF/PSD/vídeo viram card de arquivo
  (ícone, nome, tipo, tamanho, "Baixar arquivo"), nunca imagem
  quebrada; se o `<img>` falhar em runtime, cai no mesmo card e o
  download continua funcionando.
- **Legado (§53/§54):** arquivos de versão enviada sem `parte_id` numa
  peça multiparte aparecem em "ARQUIVOS ANTERIORES — enviados antes da
  estrutura por slide, sem vínculo", com Ver/Baixar. Nunca são
  encaixados num slide por ordem de chegada.
- **Autorização (§37/§38/§67):** bucket continua privado; nenhuma
  política mudou. `design_arquivos_efetivos` é `security invoker`, então
  a RLS de `design_arquivos` vale dentro dela. Testado no Postgres
  local: outra designer sem a peça vê 0 arquivos (direto na tabela e
  pela function), `design_pode_acessar` = false pra ela (é o que a
  política de select do Storage usa → não consegue assinar URL) e
  `design_parte_revisar` recusa. Não é só botão escondido.
- **Testes executados.**
  - SQL real no Postgres 16 local com o schema do sistema
    (`teste_arquivos_v2.sql`): V01 com 5 slides, envio incompleto
    recusado com a lista certa, decisões, fechar sem decisão recusado,
    aprovar com ajuste pendente recusado, fechar → ajustes com UMA
    notificação e mensagem agrupada, Kanban continua 1 card, V02 só
    com 03 e 05, efetivo misto (V01,V01,V02,V01,V02), aprovação final,
    7 arquivos preservados. Mais `teste_single.sql` (card via externa →
    ajuste → V02 upload → aprovado) e `teste_rls_arquivos.sql`.
  - Playwright ponta a ponta na interface com mock STATEFUL do Supabase
    (`test_arquivos_v2_e2e.py`, 4 cenários, 90 verificações, 0 erro
    JS): §60 completo — upload por slot (5 PNGs 1080×1350 reais),
    substituir antes de enviar, prévia 4:5 contida (574×718 na coluna,
    `contain`), tela cheia mantendo 4:5 + setas + zoom + Esc, download
    do slide com nome limpo e bytes iguais ao fixture, decisões,
    visão geral, fechamento com 1 notificação agrupada, V02 só 03/05,
    histórico V01 do slide 03 baixável, aprovação final e ZIP aberto e
    inspecionado (5 nomes em ordem, bytes = efetivo misto, `testzip`
    ok, sem cópia dupla do 03). §61 incompleto + legado. §62 card 1:1
    (`promocao-semana-do-cliente-v01.png`, bytes iguais), ajuste →
    V02 → download atual v02 e V01 pelo histórico. §63 capa de reel
    9:16 (`capa-projeto-verao-v01.png`). §55 PDF vira card e baixa
    (`card-com-pdf-v01.pdf`). §70 mobile 390px: sem overflow, arte
    primeiro, pills ≥ 32px, download alcançável.
  - Regressão: suítes das Rodadas 4, 5a, 5b e a auditoria mobile da
    Rodada 6 — sem quebra (o teste da 5a foi atualizado porque o
    seletor `.ds-ws-preview` deixou de existir de propósito).

### Implementado, mas requer validação adicional

- **A migração precisa ser rodada no Supabase**
  (`migration_design_arquivos_v2.sql`, depois de
  `migration_design_thumb.sql`). Ela troca a assinatura de
  `design_arquivo_registrar` (12 parâmetros, todos os novos com
  default): o frontend novo já chama com os novos; o frontend antigo
  chamando com 7 continua funcionando pelo default.
- **Limite real do ZIP:** montado em memória no navegador. Carrossel
  típico (5–10 PNG de 1–5 MB) é tranquilo; centenas de MB somados
  podem estourar a memória da aba — nesse caso os downloads
  individuais continuam funcionando. Não foi testado com arquivos
  grandes de verdade (fixtures de ~28 KB). Upload continua sem limite
  artificial: vale o do Storage (bucket sem `file_size_limit`) e o do
  plano do Supabase.
- **Story com vários frames:** implementado pelo mesmo caminho do
  Carrossel (`parte_tipo='frame'`, rótulo "story", "Baixar Stories"),
  mas o teste ponta a ponta rodou com Carrossel; o mock não tinha
  Story multi-frame. Story de 1 frame testado como arte única (Reel/
  Card) no caminho de arte única.
- **Miniatura na visão geral** usa `caminho_thumb` quando existe (só
  uploads novos têm); pra arquivo antigo cai no original — funciona, só
  pesa mais.

### Preparado, mas ainda não aplicado

- **Nada pendente de aplicação além da migração acima.** Não há
  remapeamento automático de uploads antigos para slides: por decisão,
  ficam como "arquivos anteriores" (mapear por ordem de upload seria
  chutar — §53).

### Não implementado por bloqueio / decisão

- **Linha do tempo por slide (§50)** — a timeline continua vindo das
  notificações, como antes. A mensagem agrupada de ajuste já traz
  "Slide 03: …/Slide 05: …", e o histórico por slide mostra V01/V02
  com estado; mas eventos individuais "Slide 03 — V02 enviada" não
  entram na timeline. Faria a `design_processar_evento` (recriada há
  um build) crescer de novo; deixei fora deste build.
- **Upload em lote com mapeamento (§31)** — não implementado; o upload
  por slot é o caminho único e sem ambiguidade. O drop de vários
  arquivos na lateral continua existindo só pra arquivo de apoio.
- **Manifesto no ZIP (§59)** — de propósito, não.
- **Screenshot da tela quebrada** não veio anexada à mensagem; a
  causa raiz foi determinada pelo código e reproduzida (o
  `.ds-ws-preview.ds-thumb` de 52px) — bate com a descrição "tira
  horizontal".

Arquivos alterados: `migration_design_arquivos_v2.sql` (nova),
`migration_tudo.sql` (ordem 19–21), `js/database.js`, `js/design.js`,
`js/ui.js` (`perguntar` aceita `valor` pré-preenchido), `styles/design.css`,
`js/auth.js`, `sw.js`. `VERSAO` → `2026-09-11-ah`, cache do service
worker → `roteiros-b7-v51`.

## Build 2026-09-11-ai — File Review 2.0, complemento: o que tinha ficado de fora

Fecha os itens listados como "não implementado" e "requer validação
adicional" no build `-ah`. Sem migração nova — só frontend.

### Implementado e testado

- **Linha do tempo por slide (§50).** A timeline do workspace agora
  junta as notificações (como sempre) com eventos por slide derivados
  dos registros reais de `design_arquivos`/`design_versoes`: "Slide 03
  — V02 enviada" (data de envio da versão que trouxe o arquivo), "Slide
  03 — ajuste solicitado por Yury" (com a mensagem) e "Slide 05 —
  aprovado por Yury" (`revisado_em`/`revisado_por`). Nenhum evento
  inventado a partir de render: cada linha tem um registro e um
  timestamp por trás. O nome de quem decidiu vem de `perfis`
  (`B7.DB.nomesPerfis`, só os ids que faltam; se a RLS negar, a linha
  sai sem o nome). Só em peça multiparte — arte única já era coberta
  pelas notificações. Sem tocar em `design_processar_evento`.
- **Envio em lote com mapeamento (§31).** Botão "Enviar vários slides"/
  "Enviar vários stories" no topo do navegador: escolhe vários arquivos,
  abre um modal com um `select` por arquivo dizendo a que slide ele
  vai. A sugestão vem do número no nome do arquivo ("03-…", "slide 3");
  sem número, a próxima parte livre na ordem. Dois arquivos no mesmo
  slide são barrados antes de subir; "— não enviar —" pula o arquivo.
  Confirmado, sobe um de cada vez, na ordem canônica, pelo mesmo
  `uploadParte` (falha de um não derruba os outros; "Substituir" só
  troca o rascunho depois do novo subir). Relação final continua
  `arquivo → parte_id`, nunca posição de array.
- **Story com vários frames testado de ponta a ponta** (§64): 3 frames
  9:16, upload por slot com rótulo "STORY 01" (nunca "SLIDE"), envio,
  "Baixar Stories" → `bastidores-da-semana-v01.zip` com
  `01-abertura-bastidores.png`, `02-making-of.png`,
  `03-chama-no-direct.png`; download do frame 02
  (`02-making-of-v01.png`, bytes iguais); decisão por frame.
- **ZIP com arquivos grandes:** 5 PNG de ruído de ~4,4 MB cada (21,9
  MB somados) → ZIP montado em 3,1 s no Chromium do teste, bytes
  intactos, `testzip` ok, sem travar a aba. Continua valendo o limite
  de memória do navegador pra somas de centenas de MB.
- Suíte ponta a ponta (`test_arquivos_v2_e2e.py`) agora com 6
  cenários e 111 verificações, 0 erro JS; regressão das rodadas
  anteriores sem quebra.

### Não implementado por decisão

- **Manifesto no ZIP (§59):** a especificação diz pra incluir só se
  ajudar de verdade e "não adicionar arquivo técnico por padrão". Os
  nomes já carregam ordem, slide e versão; um `manifesto.json` seria
  ruído pra quem abre o ZIP pra postar. Fica de fora.

Arquivos alterados: `js/design.js`, `js/database.js`, `styles/design.css`,
`js/auth.js`, `sw.js`. `VERSAO` → `2026-09-11-ai`, cache → `roteiros-b7-v52`.
