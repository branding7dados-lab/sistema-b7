# B7 Design (Central de Design) — relatório de entrega
Build `2026-09-10-d`

## Como aplicar

1. Suba os arquivos deste zip no repositório `sistema-b7` (substitui os existentes).
2. No SQL Editor do Supabase, rode **`migration_design.sql`** — mas só depois de
   `migration_rls.sql` já ter rodado (a ordem mudou: ver o cabeçalho de
   `migration_tudo.sql`). `migration_design.sql` é aditiva e idempotente.
3. Recarregue com `Ctrl+Shift+R`. O rodapé deve mostrar `2026-09-10-d`.
4. Crie ao menos um usuário com papel `designer` (tela Usuários e acessos,
   como já se cria coordenador) para testar a fila real.

## Arquitetura escolhida

Um único fio, sem sistema paralelo:

```
Conteúdo canônico (conteudos)
  → design_deliverables   (a peça de produção visual)
       → design_versoes    (V01, V02, V03… histórico real)
            → design_arquivos  (prévia / produção / anexo / final)
       → kanban_demandas    (o MESMO Kanban 2.0 já existente — tipo_vinculo='design_deliverable')
       → eventos_dominio + notificacoes  (a MESMA infraestrutura de eventos/sino já existente)
```

Aprovação futura do cliente reaproveita `aprovacoes` (`tipo='design_versao'`) —
não existe um segundo motor de aprovação, nem um segundo Kanban, nem um
segundo sistema de notificação. Isso era um requisito explícito do
pedido e foi seguido à risca.

## Relação com a Linha Editorial

A Linha Editorial é o brief. O Designer não digita nada de novo: o
sistema lê headline, sub-headline, objetivo, observação de Design e
referências que já existem no conteúdo. Não existe campo obrigatório
novo de "direção criativa" — só um controle opcional "Necessita capa?"
no Reel (`conteudos.precisa_capa`), que decide se aquele Reel gera uma
peça de Capa.

"Enviar para Design" (linha inteira ou por criativo) é idempotente de
verdade: um índice único no banco (`conteudo_id + tipo`, para
`deleted_at is null`) impede duplicar, mesmo em clique duplo ou clique
repetido depois de dias. O toast mostra os números reais devolvidos
pelo banco — nunca inventados.

A regra do carrossel (Slide 1 = abertura, última slide = CTA dinâmico)
é herdada exatamente como está na Linha Editorial — o Designer vê a
mesma estrutura, sem campo de headline ou CTA duplicado.

## Relação com o Kanban

Cada peça de Design que chega à revisão interna ganha (ou já tem) uma
linha correspondente em `kanban_demandas`, com `tipo_vinculo =
'design_deliverable'`. As colunas do Kanban geral (`a_fazer`,
`producao`, `revisao`, `ajustes`, `pronto`, `aguardando_cliente`,
`concluida`) são atualizadas automaticamente pelas mesmas funções que
processam o workflow de Design — o usuário nunca precisa mover a peça
duas vezes. Não existe um segundo quadro.

## Papel Designer e permissões

- Novo valor `designer` no `perfis.papel` (constraint recriada,
  aditiva).
- `sou_designer()` e `sou_equipe_interna()` (admin+coordenador+designer)
  são funções novas — `sou_equipe()` (admin+coordenador), usada em
  praticamente todo o resto do sistema, **não foi alterada**. Isso
  significa que nada que já dependia de `sou_equipe()` mudou de
  comportamento.
- Designer:
  - **lê** Linha Editorial, conteúdos, slides, frames, pilares, roteiros
    (política de leitura nova, adicionada por cima das políticas já
    existentes — nunca substitui a escrita, que continua só da equipe).
  - **não** cria/edita/apaga conteúdo canônico, nem demanda manual de
    Design, nem aprova a própria peça internamente — tudo isso é
    barrado no banco (testado com Postgres real, não só escondido na
    UI).
  - só pode se atribuir uma peça sem responsável a si mesmo
    ("Assumir demanda"); atribuir/reatribuir para outra pessoa é só
    Admin/Coordenador.
- Navegação (`js/permissoes.js`): Designer vê Central B7, Design, Linhas
  editoriais e Configurações (aparência/conta); não vê Kanban geral,
  Aprovações de cliente, Clientes, Usuários, Gravações/Roteiros como
  telas administrativas, Importar/Exportar, Atalhos, Lixeira.

## Migrations adicionadas

- `migration_design.sql` (nova, ~640 linhas): papel designer, coluna
  `conteudos.precisa_capa`, tabelas `design_deliverables` /
  `design_versoes` / `design_arquivos`, bucket privado `design-files` +
  políticas de Storage, RLS completa das 3 tabelas novas, política de
  leitura adicional do Designer sobre a Linha Editorial, 14 funções
  `security definer` (geração, atribuição, prazo/prioridade, rascunho,
  registro de arquivo, envio para revisão, ajuste, aprovação interna,
  finalização, envio futuro ao cliente, processamento de evento/
  notificação), 2 views (`design_resumo`, `design_producao_linha`).
- `migration_tudo.sql` atualizado: a ordem mudou — `migration_design.sql`
  agora roda **depois** de `migration_rls.sql` (não antes), porque a
  política de leitura do Designer sobre a Linha Editorial precisa
  sobreviver à recriação de políticas que `migration_rls.sql` faz.

## Workflow de Design

`aguardando_producao → em_criacao → revisao_interna → ajustes →
aprovado_interno → (futuro: aguardando_cliente → ajustes_cliente →
aprovado_cliente) → finalizado`.

`Aprovado internamente` é um estado terminal válido por si só — o
processo inteiro (gerar peça → atribuir → enviar V01 → pedir ajuste →
enviar V02 → aprovar → finalizar) funciona sem qualquer login de
cliente, como pedido explicitamente.

## Upload e arquivos

Upload real para o bucket privado `design-files` via `XMLHttpRequest`
direto ao Storage (não passa por Edge Function — evita o gargalo de
proxy para arquivo grande), com progresso real por arquivo
(`xhr.upload.onprogress`). Sem limite artificial de tamanho no
frontend — só o que a infraestrutura real do Storage limitar. Metadata
só é gravada no banco depois que o upload confirma sucesso (uma versão
nunca aparece "enviada" com um arquivo que na verdade falhou). Se o
upload falhar no meio, o rascunho e a observação digitada continuam lá
— a pessoa tenta de novo sem perder nada. Suporta múltiplos arquivos
por versão, com papel (prévia / produção / anexo / final).

Visualização usa `createSignedUrl` (10 minutos) — o bucket é privado,
nunca público.

## Versionamento e revisão interna

Cada envio gera uma linha real em `design_versoes` (V01, V02…), com
numeração sequencial travada por linha (`for update` na função) —
sem risco de duas V03 na mesma peça. V01 permanece no histórico com o
estado que teve na hora (ex.: `ajuste_solicitado`) mesmo depois de V02
existir — nada do passado é reescrito.

O Designer nunca aprova a própria peça — barrado na função do banco,
não só escondido na tela. Só Admin/Coordenador aprovam ou pedem
ajuste (com mensagem obrigatória).

## Notificações

Reaproveita `eventos_dominio` + `notificacoes` (a mesma tabela e o
mesmo sino do resto do sistema) — não existe central de notificação
paralela. Uma função nova, `design_processar_evento`, espelha o padrão
já usado por Aprovações (`aprov_processar_evento`) para os eventos
específicos de Design: peça criada, atribuída, versão enviada, ajuste
solicitado, aprovada internamente, finalizada.

## Responsividade

Testado (Playwright) a 1280px e 390px, claro e escuro implícito pelos
tokens existentes, para Admin, Coordenador e Designer: sem scroll
horizontal de página em nenhum caso, navegação do Designer sem nenhum
item administrativo vazando, zero erro de JavaScript.

## Arquivos/módulos alterados ou criados

- `migration_design.sql` (novo)
- `migration_tudo.sql` (ordem atualizada)
- `js/database.js` (nova seção Design: ~30 funções de acesso)
- `js/permissoes.js` (papel designer: rotas, navegação, configurações)
- `js/app.js` (rotas `#/design` e `#/design/<id>`)
- `index.html` (item de navegação, `<script>`/`<link>` novos)
- `js/design.js` (novo, módulo `B7.Design` completo: fila, quadro/lista,
  Equipe de Design, drawer de detalhe, upload, versões, revisão)
- `styles/design.css` (novo)
- `js/linha.js` / `styles/linha.css` ("Enviar para Design", selo de
  status por criativo, controle "Necessita capa?", aba "Produção de
  Design")
- `js/auth.js` (`VERSAO` → `2026-09-10-d`)
- `sw.js` (cache → `roteiros-b7-v19`, novos arquivos no precache)

## Testes efetivamente executados

**Banco (Postgres 16 real, não simulado, via rig local com shim de
`auth`/`storage`):**
- Cadeia completa de 17 migrations, na ordem final, sem erro.
- Fluxo de aceitação interno do enunciado (seção 87), passo a passo,
  com dados reais: gerar da linha (3 criadas, 1 sem requisito — Reel
  sem capa não gera peça), gerar de novo (0 duplicadas), atribuir,
  fila do Designer, tentativa de reatribuir peça de outro Designer
  (barrada), autoatribuição de peça livre (permitida), rascunho +
  arquivo + envio de V01, tentativa do Designer aprovar a própria peça
  (barrada), Coordenador vendo a peça em revisão sem refresh manual
  (mesma consulta), pedido de ajuste com mensagem, Designer recebendo
  a notificação com o texto exato, envio de V02, aprovação de V02,
  V01 preservada no histórico com seu estado original, finalização —
  **todos os 15 passos passaram**.
- Segurança de papel (seção 89): Designer não cria demanda manual
  (barrado), Designer não vê peça atribuída a outro Designer via RLS
  direta na tabela (confirmado por contagem — 0 linhas), Cliente não
  vê nenhuma linha em nenhuma das 3 tabelas novas nem na view de
  resumo, `anon` recebe "permission denied", Designer lê `conteudos`/
  `linhas_editoriais` mas um `UPDATE` direto nessas tabelas afeta 0
  linhas (só leitura, escrita continua barrada).

**Interface (Playwright/Chromium, com Supabase simulado):**
- `#/design` e `#/design/<id>` como Admin, Coordenador e Designer, a
  1280px e 390px: zero erro de JavaScript em todas as combinações,
  `scrollWidth === innerWidth` (sem overflow horizontal) em todas.
- Navegação do Designer sem nenhum item administrativo (`#/kanban`,
  `#/usuarios`, `#/clientes`, `#/gravacoes`, `#/roteiros`,
  `#/aprovacoes`) — confirmado por `MutationObserver` no DOM.
- Conteúdo real do drawer de detalhe conferido: briefing format-aware
  (Card mostrando objetivo/headline/observação de design, sem campos
  vazios), briefing de Carrossel com o cabeçalho "SLIDES — o último é
  sempre o CTA", histórico de versão, ações de revisão interna visíveis
  só para quem pode.
- `node --check` limpo em todos os arquivos JS tocados; chaves de CSS
  balanceadas em `styles/design.css`.

## Status final

**Implementado e testado:**
papel Designer e RLS (banco real); geração idempotente a partir da
Linha Editorial; preservação da regra do carrossel; fila do Designer;
upload real com progresso e sem limite artificial; versionamento
V01/V02/…; revisão interna completa (enviar → ajustar → reenviar →
aprovar) sem login de cliente; sincronização com o Kanban existente;
notificações reaproveitando a infraestrutura existente; leitura
read-only da Linha Editorial pelo Designer; bloqueio de autoaprovação;
navegação e responsividade do módulo (1280/390, 3 papéis, zero erro de
JS, zero overflow horizontal).

**Implementado, mas requer validação adicional em ambiente real:**
upload de arquivo grande de verdade (o teste usou arquivos pequenos
simulados — não subi um arquivo de produção de dezenas/centenas de MB
contra o Storage real do projeto, então o comportamento em arquivo
grande de verdade, incluindo o limite real do plano do Supabase, ainda
não foi verificado); assinatura de e-mail/push para os eventos de
Design (o sino/notificação em tela foi verificado, push/e-mail dependem
da configuração já existente de VAPID, que não foi tocada aqui); o
fluxo futuro "Enviar para aprovação do cliente" (a função existe e foi
lida com cuidado contra a RPC de aprovações existente, mas não rodei
o ciclo completo com uma sessão de cliente de teste); realtime de
verdade contra um Supabase real (testei o padrão de assinatura/
desligamento de canal por leitura de código — reaproveita exatamente o
que `kanban.js`/`notificacoes.js` já fazem — mas não há um Supabase ao
vivo neste ambiente para confirmar o evento chegando na tela sem
recarregar).

**Não implementado por bloqueio:** nenhum. Todos os pontos do
enunciado foram endereçados; os itens acima são de validação em
produção, não de funcionalidade ausente.
