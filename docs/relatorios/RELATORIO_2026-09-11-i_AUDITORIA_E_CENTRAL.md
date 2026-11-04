# B7 Design — Auditoria de RLS em Produção e Refino da Central do Designer (build 2026-09-11-i)

Esta rodada respondeu a uma segunda especificação grande, cujo ponto
central era uma dúvida legítima do dono: a proteção de RLS que os
relatórios anteriores descreveram como testada — estava mesmo ativa no
banco de **produção**, ou só no ambiente de teste local desta sessão?

A resposta, confirmada com consultas reais rodadas pelo próprio dono no
Supabase de produção: **estava, sim.** O restante da especificação —
Central do Designer mais focada, vista operacional, notificações,
versionamento — já tinha sido implementado nos builds `-d`, `-f` e `-h`
anteriores desta mesma sessão. Esta rodada não reconstruiu nada disso;
auditou a segurança de verdade contra produção e acrescentou o que
realmente faltava na Central do Designer.

## 1. Implementado e testado

- **Auditoria de RLS contra o banco de produção real** (não o ambiente
  local). Três consultas de leitura, rodadas pelo dono no SQL Editor do
  projeto real, confirmaram: RLS **ligada** (`relrowsecurity = true`)
  nas 11 tabelas verificadas (`aprovacoes`, `clientes`, `conteudos`,
  `design_deliverables`, `design_versoes`, `gravacoes`,
  `kanban_demandas`, `linhas_editoriais`, `notificacoes`, `perfis`,
  `roteiros`); políticas de RLS existentes em praticamente todo o
  schema (`clientes` 2, `linhas_editoriais` 2, `conteudos` 2, `perfis`
  1, `design_deliverables` 1, e assim por diante). O `anon`/
  `authenticated` têm GRANT bruto de tabela em `clientes`/`conteudos`/
  `linhas_editoriais`/`perfis`, mas isso sozinho não expõe nada — com
  RLS ligada, a política decide linha por linha, e é ela quem realmente
  protege. **Conclusão prática: o `migration_rls.sql` já estava
  aplicado em produção antes desta rodada** — não era necessário
  aplicar nada novo relacionado a RLS.
- **"Precisa de mim"** — nova seção na Central do Designer, com as
  peças que exigem ação dele agora (não iniciada, em ajuste, ou com
  briefing atualizado sob os pés — nunca peça esperando revisão/
  aprovação de outra pessoa). Testado com Playwright: com uma peça
  "Aguardando produção" e uma "Ajustes" no mock, a seção mostrou
  exatamente essas duas, nenhuma a mais.
- **"Continuar de onde parei"** — até 3 peças em produção ativa
  (`em_criacao`) do próprio Designer, mais recente primeiro. Testado:
  com duas peças em criação com horários diferentes, a mais recente
  apareceu primeiro. Some sozinha quando não há nada — testável por
  inspeção do código (`if (continuar.length) …`).
- **Resumo de produção com contagem por formato e por status** — tanto
  nos cartões de demanda da Central ("3 Cards, 1 Carrossel, 1 Capa de
  Reel, 1 Stories") quanto no topo da vista operacional por Linha
  Editorial ("6 peças de Design · 1 finalizada · 1 em ajuste · 1 em
  revisão · 3 para fazer"). Testado com um mock de 6 peças em status
  variados: os números batem exatamente com o que o mock continha.
- **Selo de versão ("V01") e link "Ver contexto da Linha Editorial"**
  na vista operacional — o selo usa `linha_versao_confirmada` (já
  gravado nas peças desde o build `-h`); o link leva para a Linha
  Editorial completa em leitura (a rota já é bloqueada para escrita do
  Designer desde o build `-h`). Testado via Playwright: os dois
  aparecem corretamente.
- `node --check` em `js/design.js` sem erro.

## 2. Implementado, mas requer validação adicional

- **A ressalva da auditoria de RLS**: eu confirmo que a RLS está ligada
  e que as políticas existem, e testei essas políticas *localmente*
  simulando uma sessão de Designer (tentativa de `UPDATE`/`INSERT`
  direto, bloqueada). O que eu não posso garantir sem acesso direto ao
  seu banco é que o texto de cada política em produção é idêntico ao
  que está em `migration_rls.sql` neste repositório — se alguém já
  editou uma política direto no SQL Editor do Supabase sem atualizar o
  arquivo, por exemplo. Recomendo, quando for prático, rodar a mesma
  tentativa de mutação direta que fiz localmente (com
  `set role authenticated` e o UUID de um Designer real) contra o banco
  de produção, para fechar essa última lacuna.
- **Responsividade das duas seções novas** — testei só em 1280px
  (desktop) nesta rodada. Os cartões reaproveitam o mesmo componente
  (`cartao()`) já usado em todo o resto da Central, que já tinha sido
  testado em mobile em builds anteriores, mas não refiz esse teste
  específico para "Precisa de mim"/"Continuar de onde parei" agora.

## 3. Preparado, mas ainda não aplicado

- Nada nesta rodada precisou de migration nova — RLS já estava
  aplicada, e as mudanças desta rodada são só de interface
  (`js/design.js`, `styles/design.css`), sem alteração de banco.

## 4. Não implementado por decisão consciente

A especificação nova tinha 60 seções; a maior parte delas descreve
funcionalidade que já existe desde builds anteriores desta sessão e que
eu **não** retestei nem alterei nesta rodada, porque não foi tocada:

- **Vista de detalhe de cada peça** (Card com briefing/objetivo/
  headline; Carrossel com slides e CTA dinâmico; Capa de Reel com "Ver
  roteiro"; Stories com frames) — existe desde o build `-d`, não
  alterada agora. Se você quer que eu confirme de novo que continua
  fiel à especificação (itens 15-18), posso fazer isso numa rodada
  dedicada.
- **"Assumir demanda" e sua idempotência/não-roubo de peça já
  atribuída** — existe e foi testado no build `-f` (`t_design_refino.sql`);
  não retestei especificamente o cenário de dois Designers disputando a
  mesma Linha Editorial nesta rodada.
- **Distribuição individual de peça pela equipe** (um Designer faz os
  Cards, outro os Carrosséis) — arquitetura já suporta isso desde o
  build original de Design; não verifiquei de novo nesta rodada.
- **Upload opcional / revisão externa sem arquivo** — build `-f`, não
  tocado.
- **Sem limite artificial de tamanho de arquivo** — nunca foi
  implementado um limite, então não há nada a remover; não fiz uma
  auditoria de infraestrutura de Storage para confirmar limites reais
  do Supabase.
- **"Tenho uma dúvida"** — a especificação pede reaproveitar o sistema
  de comentários internos já existente com uma entrada mais visível
  para o Designer perguntar sobre o briefing sem editá-lo. O sistema de
  comentários internos existe (usado em Design desde o build original),
  mas eu não criei nem confirmei uma entrada com esse rótulo específico
  nesta rodada — fica para uma próxima.
- **Preparação de arquitetura para Videomaker** — não precisei mudar
  nada: a vista operacional (`B7.Design.abrirLinha`) já lê os dados
  canônicos (`conteudos`/`slides`/`frames`) sem duplicar nada em campos
  de Design, então o mesmo padrão pode um dia virar
  `B7.Video.abrirLinha` sem reescrever a base. Não implementei nada de
  Video agora, como pedido.

## Como aplicar

Nenhuma migration nova nesta rodada. Suba só os arquivos alterados:
`js/design.js`, `js/auth.js`, `styles/design.css`, `sw.js`.
