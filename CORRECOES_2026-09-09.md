# Correções de 09/09/2026 — rodada 1 (críticos + segurança)

Build `2026-09-09-a`. Esta rodada não muda nenhuma tela de lugar: ela faz
funcionar o que estava quebrado e fecha as brechas que precisavam estar
fechadas antes do corte do RLS.

## Como aplicar

1. Suba todos os arquivos deste zip no repositório `roteiros-b7`
   (substituindo os existentes). O `config.js` já está preenchido.
2. Apague do repositório as sobras dos módulos removidos, que o zip não
   contém: `TRENDS.md`, `js/trends.js`, `styles/trends.css`,
   `migration_trends.sql`, `supabase/functions/trends-search/`,
   `supabase/functions/google-agenda/`, `assets/logo/`.
3. No SQL Editor do Supabase, rode **`migration_fix.sql`** (uma vez;
   pode repetir sem dano). Ele exige que as migrations de
   `migration_tudo.sql` já tenham rodado — se faltar alguma, ele avisa
   qual.
4. Recarregue o sistema com `Ctrl+Shift+R`. O rodapé da tela de acesso
   deve mostrar `2026-09-09-a`.

O corte do RLS (`migration_rls.sql`) continua sendo o último passo e
continua exigindo o procedimento do `CORTE_RLS.md`.

## O que foi corrigido

### Funcionalidade que não funcionava

- **Enviar para aprovação** (`editor.js`): lia `E.roteiro`, que não
  existia — o botão não fazia nada. Agora encontra o roteiro aberto e
  monta o snapshot com os campos reais das cenas (tipo, direção, função,
  texto, sugestão de cenas), mais objetivo, observação de gravação,
  cliente, logo e data. O portal renderiza esses campos e o botão
  **Baixar PDF** do portal gera a folha A4 a partir do snapshot — o
  cliente baixa exatamente a versão que está decidindo.
- **Decisão por cena no portal** (`database.js`): faltava `parte_tipo`;
  toda decisão falhava. Corrigido no JS e a coluna ganhou default.
- **Central de Produção filtrada por cliente** (`database.js`): filtrava
  `roteiros.client_id`, coluna inexistente; mostrava 0. Agora filtra
  pelas gravações do cliente, na contagem e na lista.
- **Links de referência da linha editorial** sumiam ao recarregar: a
  view `linhas_resumo` não tinha as colunas novas. `migration_fix.sql`
  recria `linhas_resumo`, `status_resumo`, `gravacoes_resumo` e
  `minha_sessao` (agora com `avatar_url` — a foto de perfil passa a
  aparecer).
- **Coordenador não abria gravações** (`permissoes.js`): faltava a rota
  `gravacao`.
- **Autosave travado para sempre** (`autosave.js`, `conteudo.js`):
  limpar um campo de data ou número enviava `''`, o banco rejeitava e o
  erro voltava para a fila a cada tentativa. Agora campos `date` e
  `number` vazios vão como `null`, e só falha de rede entra na fila —
  erro que o banco recusou de fato (coluna inválida, regra violada) é
  descartado com aviso e o indicador fica em "Alteração não salva" até
  a pessoa clicar — nunca vira "Salvo ✓" por engano. Queda de servidor
  (5xx), token expirado e erro sem código continuam na fila.
- **Sidebar do portal morta após login** (`app.js`): o layout era
  montado duas vezes e a segunda apagava os cliques.
- **Triggers de `updated_at`** de status, perfis, aprovações e kanban
  nunca existiam (nome errado da função). Criados pelo `migration_fix`.

### Segurança

- **Cliente aprovador podia reescrever o snapshot aprovado** via API.
  Trigger `aprovacoes_protege`: quem não é da equipe só altera
  `situacao`, `decidido_por` e `decidido_em`, e só para `aprovado` ou
  `ajustes`.
- **Comentário com autor forjado**: trigger `comentarios_assina`
  preenche autor a partir da sessão.
- **Storage aberto para a chave anon**: `migration_rls.sql` agora fecha
  upload, troca e remoção de logos para a equipe logada (leitura
  continua pública, a folha precisa). O reverter devolve o estado
  anterior.
- **XSS no Kanban**: link de referência só vira `<a>` se começar com
  `http(s)://`.
- **Cliente sem `pode_aprovar` via toast de sucesso** sem nada mudar:
  o portal esconde os botões de decisão para essa conta e o banco
  passa a lançar erro se o update não afetar nenhuma linha.

### Portal do cliente passa a ter uso

Não existia nenhum lugar para liberar material ao cliente. Agora:

- Linha editorial: menu `⋯` → **Liberar no portal do cliente**.
- Conteúdo: caixa **Visível no portal do cliente** dentro do conteúdo.
- Status semanal: menu `⋯` → **Publicar no portal do cliente**
  (separado de "Enviado", que é só o registro de que o card foi mandado).

### Lixeira, backup, offline

- Excluir roteiro no editor agora manda para a lixeira em vez de apagar
  (os vínculos com conteúdo e status semanal não se perdem; Desfazer
  restaura de verdade).
- Excluir linha editorial leva os conteúdos junto, como a confirmação
  já prometia.
- Consultas que vazavam a lixeira (`resumo`, roteiros recentes, roteiros
  do cliente, busca, prévia no hover) passaram a filtrar.
- Backup exporta também atividades, vínculos de perfil, aprovações,
  partes, comentários e o kanban, e importa todos exceto vínculos de
  perfil e histórico do kanban (as permissões dessas tabelas não aceitam
  upsert pela API); a importação grava o vínculo roteiro → conteúdo
  depois dos conteúdos existirem.
- Service worker: pré-cache completo (`permissoes`, `portal`, `kanban`,
  `perfil`, vendors, css) e fallback para `index.html` só em navegação —
  antes, offline, um script ausente recebia HTML e o app parava.
- "Abrir material" no Kanban usa as rotas certas (editor da gravação e
  criativos da linha).

### Miúdos

Impressão sem a logo do cliente; "Novo pilar" fantasma na paleta;
resultados da busca fechando ao clicar no campo; toast de sessão com
tempo errado; código morto de Trends no autosave e na paleta; títulos
duplicados no `BOOTSTRAP.md` e bloco repetido no `README.md`.

## O que ficou para a próxima rodada

- Cliente lê `observacoes` e `servico_nota_interna` da própria empresa
  pela API (RLS não filtra coluna). Até separar isso, **não escreva nada
  no campo Observações do cliente que ele não possa ler**.
- Kanban ainda não cria demanda vinculada ao enviar para aprovação, então
  o quadro não reage sozinho a aprovações.
- PNG do status semanal em resolução dobrada; listeners de scroll/resize
  acumulados; data da versão exportada em UTC; duplicar linha de
  dezembro; legenda "sempre incluir"; ordem da vista Lista do Kanban;
  nome do produto no manifest.

## Como foi testado

- Cadeia completa de migrations num PostgreSQL 16 real (com shim do
  `auth`/`storage` do Supabase): `supabase_setup` → vnext → vcontent →
  semana → central → auth → portal → kanban → **fix** → re-execução de
  `migration_auth`, `migration_semana` e `fix` (idempotência) → corte
  do RLS → `fix` de novo depois do corte (não reabre o acesso anon) →
  reverter.
- Revisão independente do diff por um segundo agente, com as correções
  que ela apontou já aplicadas (classificação de erro do autosave,
  try/catch nas decisões do portal, trigger de comentário respeitando
  restauração de backup, `migration_auth.sql` re-executável).
- No banco cortado: cliente aprovador não reescreve snapshot, decide
  normalmente, decide por cena sem `parte_tipo`, comentário forjado sai
  assinado como o próprio cliente, cliente não enxerga roteiros; cliente
  sem `pode_aprovar` afeta 0 linhas; anon não alcança tabelas nem grava
  no storage; após reverter, anon volta a ler tabelas e views.
- App carregado em Chromium headless com Supabase simulado: todas as
  rotas internas abrem sem erro de JavaScript.
- `node --check` em todos os arquivos JS.
