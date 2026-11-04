# B7 Design — Refino Operacional (build 2026-09-10-f)

Refino sobre o que já está no ar (build `-d`/`-e`), não uma
reconstrução. Duas mudanças pedidas, as duas implementadas e testadas:

1. A Central do Designer passa a mostrar direto o que fazer, agrupado
   por Linha Editorial — sem precisar entrar em "Linhas editoriais"
   para descobrir trabalho.
2. Upload deixou de ser obrigatório: uma peça revisada e aprovada fora
   do sistema (WhatsApp, e-mail, reunião) agora pode ser registrada
   como enviada para revisão sem nenhum arquivo, e segue o mesmo
   caminho de ajuste/aprovação/finalização de sempre.

## O que muda para quem usa

**Designer** — ao abrir "Design", a tela agora tem duas seções fixas:

- **Demandas a fazer**: peças sem responsável, agrupadas por Linha
  Editorial, com o prazo mais próximo do grupo e um botão **"Assumir
  demanda"** que pega todas de uma vez (nunca tira uma peça que já é
  de outro designer).
- **Minhas demandas**: o que já é seu, também por linha, com progresso
  real (ex.: "2 de 5 finalizadas") e um alerta de quantas estão em
  ajuste.

Clicar no nome da linha abre uma tela de leitura só com a produção de
Design daquela linha — não é mais preciso abrir o editor completo da
Linha Editorial para ver o que está em jogo.

Dentro de cada peça, "Enviar nova versão" agora tem duas abas: **Enviar
arquivo** (como sempre foi) e **Revisada por fora (sem arquivo)** —
essa segunda pede só um canal opcional (WhatsApp, e-mail…) e uma
observação, e manda para revisão interna sem exigir nada anexado. O
histórico da peça mostra um selo "Revisada por fora — WhatsApp" nesses
casos, nunca finge que um arquivo foi enviado quando não foi.

**Admin/Coordenador** — nada muda na fila da equipe (Quadro/Lista,
filtros, abas). A única diferença visível é o selo de via externa no
histórico de versão, quando for o caso.

## O que foi feito (banco)

Arquivo novo `migration_design_refino.sql`, aditivo, roda depois de
`migration_design.sql`:

- `design_versoes.via` (`'upload'` por padrão, ou `'externa'`) e
  `design_versoes.canal_externo`.
- `design_versao_enviar` só exige arquivo quando `via='upload'`. A
  versão anterior da função (2 parâmetros) foi removida de propósito —
  deixá-la ao lado da nova (4 parâmetros com default) deixava uma
  chamada de 2 argumentos ambígua para o Postgres, e isso quebraria
  toda chamada existente em produção. Pego e corrigido antes de
  qualquer teste de aceitação.
- `design_assumir_demanda_linha(linha_id)`: nova função, só para quem
  é Designer, que reivindica em lote as peças sem responsável e não
  finalizadas daquela linha.
- `design_processar_evento` atualizado para nomear a via externa na
  notificação, honestamente.
- Nada mudou em `design_solicitar_ajuste`, `design_aprovar_interno`,
  `design_finalizar` ou `design_enviar_cliente` — elas nunca
  dependeram de arquivo existir, só do estado da versão.

## O que foi testado de verdade

- Toda a cadeia de migrations (`migration_rls.sql` →
  `migration_design.sql` → `migration_design_refino.sql`) rodada do
  zero num Postgres 16 local, sem erro.
- Testes de aceitação via SQL, com sessão real de cada papel
  (`set role authenticated` + `request.jwt.claim.sub`, não mock):
  - Designer assume 3 peças de uma linha de uma vez (`assumidas: 3`).
  - Rodar de novo não assume nada (`assumidas: 0` — idempotente).
  - Outro designer não rouba as peças já assumidas.
  - Admin/Coordenador recebem erro de permissão ao tentar (a função é
    exclusiva de Designer).
  - Enviar sem arquivo e sem via falha com a mensagem certa.
  - A mesma versão, agora com `via='externa'` e canal "WhatsApp",
    passa sem nenhum arquivo — e segue até aprovação interna e
    finalização normalmente.
  - A notificação gerada nomeia a via corretamente.
  - Uma segunda peça, com arquivo real e via padrão, continua
    funcionando exatamente como antes.
- `node --check` em todos os arquivos JavaScript tocados.
- Playwright com mock completo do Supabase: a Central mostra os dois
  grupos certos; "Assumir demanda" move a peça de "Demandas a fazer"
  para "Minhas demandas" na tela via chamada real ao RPC; a vista de
  leitura por linha abre; a aba "Revisada por fora" libera o envio sem
  arquivo e o histórico mostra o selo certo; testado também em 390px
  (celular) sem quebra de layout. Zero erros de console em todos os
  cenários.

## O que não foi testado

- Nenhum teste contra o Supabase real de produção — só Postgres local,
  a mesma limitação de todos os builds anteriores desta sessão.
- Não foi refeito o teste de duas sessões simultâneas em tempo real
  (dois designers vendo a Central atualizar ao vivo um para o outro).
  O canal Realtime usado (`design_deliverables`/`design_versoes`) não
  foi alterado neste refino, então o comportamento deve se manter
  igual ao que já foi validado no build anterior — mas isso não foi
  reconfirmado agora.

## Como aplicar

1. **Banco**: rode `migration_design_refino.sql` no SQL Editor do
   Supabase — só esse arquivo é novo; os outros já rodaram em builds
   anteriores. Precisa ter rodado `migration_design.sql` antes.
2. **Site**: suba os arquivos abaixo para o repositório (GitHub Pages
   não precisa de passo extra além do upload):
   - `js/design.js`
   - `js/database.js`
   - `js/app.js`
   - `js/auth.js`
   - `sw.js`
   - `styles/design.css`
   - `migration_design_refino.sql` (fica no repositório como
     documentação/histórico, mesmo já tendo rodado no Supabase)
   - `migration_tudo.sql`
   - `CORRECOES_2026-09-09.md`
3. Nenhuma Edge Function foi alterada neste build — não precisa
   reimplantar nada no Supabase além de rodar a migration.
