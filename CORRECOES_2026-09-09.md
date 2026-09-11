# Correções de 09/09/2026 — rodada 1 (críticos + segurança)

Build `2026-09-09-b`. Esta rodada não muda nenhuma tela de lugar: ela faz
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
   deve mostrar `2026-09-09-b`.

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

## Build 2026-09-09-b (mesmo dia, à tarde)

- **Usuários e acessos** aparecia sem estilo: as classes da lista
  (`lista-usuarios`, `lu-*`) e do formulário (`nu-*`) nunca tiveram CSS.
  Estilizadas em `styles/auth.css`, com versão para celular e tema escuro.
- **Tela de abertura** presente desde o primeiro pixel: vem no
  `index.html` antes de qualquer script e some quando o sistema ou a tela
  de acesso estão prontos (com rede de segurança de 12 s). Visual novo:
  anel em gradiente girando ao redor do símbolo, halo respirando, três
  luzes de fundo e partículas subindo; respeita `prefers-reduced-motion`.

## Build 2026-09-09-c

- **Foto de perfil por upload**, não mais por link. Vale para o admin
  (Usuários e acessos → Foto de perfil) e para cada pessoa no próprio
  perfil. O navegador recorta ao quadrado e reduz para 512×512 JPEG; o
  `b7-auth` grava no bucket `avatars` (criado sozinho na primeira foto,
  público para leitura) e apaga a foto anterior. Como o upload passa pela
  função, funciona antes e depois do corte do RLS.
- Modal **Meu perfil** também estava sem CSS; estilizado.
- **Precisa republicar a Edge Function `b7-auth`** (mesmo caminho: Deploy
  → Via Editor → colar o `index.ts` novo). Nenhum SQL novo.

## Build 2026-09-09-f

- `config.js` nunca mais vem de cache: o service worker busca com
  `no-store` (o GitHub Pages manda max-age de 10 minutos, e foi isso que
  segurou o banco antigo no navegador depois da troca de projeto).
- Sessão guardada de outro projeto Supabase é descartada sozinha quando
  o `config.js` aponta para um projeto diferente.
- Portal do cliente: a trilha luminosa da sidebar acompanha a tela
  aberta (ficava parada no Início); textos da home deixam claro que
  quem produz é a Branding7 e o cliente acompanha e aprova.
- Mensagem de erro do login informa o código HTTP e o motivo provável.
- (g) Foto de perfil no topo estourava a tela: o botão da sessão não
  tinha tamanho definido e crescia até o tamanho da imagem. Agora é uma
  caixa fixa de 36 px, e todas as fotos (topo, menu, lista, perfil)
  recortam por `object-fit: cover`.
- (h) Avatar sem foto refeito: iniciais de nome + sobrenome (Yury Nóbrega
  → YN, não "YU"), gradiente da paleta B7 escolhido pelo nome (a mesma
  pessoa tem sempre a mesma cor), brilho interno e contorno sutil. Vale
  para o topo, o menu da sessão, a lista de usuários, o perfil e o modal
  de foto (`B7.UI.avatarPessoa`).

## Build 2026-09-09-i — Aprovações v2 (ver APROVACOES.md)

Precisa rodar `migration_aprovacoes_v2.sql` no SQL Editor (depois do
`migration_fix.sql`; antes ou depois do corte do RLS, tanto faz).

- Decisões do cliente (cena, roteiro completo, ajustes, recusa) passam
  por funções do banco: idempotentes, com trava de versão, permissão
  conferida no servidor, evento + notificações + Kanban na mesma
  transação.
- Cliente: cena aprovada fica travada como "Aprovada"; botão "Aprovar
  roteiro completo"; "Solicitar ajustes" e "Recusar" (motivo obrigatório)
  separados; aviso de versão substituída; abas Aguardando / Ajustes /
  Recusados / Aprovados / Histórico; aprovação da linha editorial.
- Equipe: tela Aprovações (`#/aprovacoes`) com contagens, filtros e
  detalhe cena a cena; bloco de status no editor de roteiro e na linha
  editorial; resumo na Central B7; "Enviar para aprovação" da linha.
- Sino de notificações no topo (banco + polling + realtime).
- Kanban: card mostra a situação da aprovação, link para o feedback e
  trava de automação; movimentos automáticos registrados no histórico.

## Build 2026-09-09-j — A: linha editorial, pilares, calendário, apresentação

Precisa rodar `migration_pilares.sql` (depois do `migration_aprovacoes_v2.sql`,
antes do `migration_rls.sql`). Aditiva e idempotente.

- **Estratégia sumia ao trocar de aba** (raiz: `ligarCampos` gravava só
  pelo autosave e `render()` redesenhava a partir do objeto antigo).
  `B7.Conteudo.ligarCampos(raiz, aoMudar)` agora avisa quem renderiza;
  `js/linha.js` espelha cada patch em `L.linha` / `L.conteudos` /
  `L.pilares`, descarrega o autosave pendente (`B7.Save.agora()`) e troca
  só o corpo da aba (`trocarAba` → `renderCorpo`), sem refazer a página
  nem reler o banco. Fechar o editor de conteúdo também não recarrega
  mais (`atualizar()` redesenha de memória mantendo a rolagem).
  Bônus: `data-ir-aba` (botões "Adicionar informações"/"Ver os N")
  não tinha handler — agora troca de aba.
- **Pilares de conteúdo** de volta na aba Estratégia, seção
  "ESTRATÉGIA BASEADA NOS PILARES DE CONTEÚDO" no lugar de "O que a
  estratégia pretende gerar" (o campo antigo só aparece se já tinha
  texto, como "Complemento do objetivo"). CRUD com autosave (nome,
  percentual, funil, objetivo, observações), barra de proporção, soma com
  aviso (não bloqueia), distribuição real × planejada (base = meta de
  conteúdos ou total da linha), seletor de pilar no editor do conteúdo
  (`conteudos.pilar_id`, vazio grava `null` via `data-nulo`), chip do
  pilar nos cards e na lista de postagens, bloco na Visão geral,
  cópia dos pilares ao duplicar a linha (mapeando `pilar_id`).
  Snapshot de aprovação da linha leva `pilares[]` e `pilar` em cada
  conteúdo. `linhas_resumo` ganha `percentual_pilares`.
- **Documento A4** (`print-linha.js`): seção "Pilares de conteúdo"
  (barra + legenda + um bloco indivisível por pilar, paginação medida),
  pilar no cabeçalho do criativo e coluna PILAR na tabela quando há
  pilares. **Apresentação 16:9** (`slides.js`): slide de pilares com
  até 4 por slide ("PARTE n DE m"), pilar no cabeçalho do criativo e na
  tabela de postagens (já paginada de 8 em 8).
- **Calendário de postagens** refeito: grade real de 7 colunas
  DOM..SÁB em CSS grid, semanas completas com dias vizinhos esmaecidos,
  hoje destacado, até 3 itens por dia com "+N" que expande, navegação
  mês anterior/próximo e "Mês da linha", vista agenda (lista por dia)
  no celular, sem overflow horizontal em 390 px. Datas tratadas como
  texto `YYYY-MM-DD` de ponta a ponta — nunca `new Date('YYYY-MM-DD')`.
  Estilos novos em `styles/linha.css` (classes `cal-*` e `pil-*`).
- `B7.DB`: `excluirPilar` desvincula os conteúdos antes de apagar,
  `reordenarPilares`, `definirPilarDoConteudo`.
- `ligarCampos`: `select` grava no `change`; `data-vazio="0"` para
  colunas numéricas `not null` (percentual).

## Build 2026-09-09-j — Notificações, push, aprovações em tempo real, presença

Migrations novas: `migration_presenca.sql` e `migration_push.sql` (depois de
`migration_aprovacoes_v2.sql` e `migration_pilares.sql`, antes de
`migration_rls.sql`). Setup do push em PUSH.md.

- **Sino** (`js/notificacoes.js`): badge com estado "carregando" (ponto
  pulsando) até a primeira resposta do banco — nunca um "0" falso; um único
  canal Realtime por sessão (montar() pode ser chamado várias vezes); som
  curto gerado por WebAudio ao chegar notificação; aviso do navegador
  (Notification API) quando a aba não está em foco. Tudo respeita as
  preferências da pessoa.
- **Preferências** (`perfis.preferencias` jsonb; `perfil_preferencias_gravar()`;
  `minha_sessao` recriada com `preferencias`, `last_login_at`, `last_seen_at`):
  UI em Meu perfil → Notificações (som, navegador, push), com interruptores
  que gravam na hora e só dizem "salvo" depois de o banco responder.
- **Push** (`js/push.js`, `sw.js`, `supabase/functions/b7-push/index.ts`,
  `push_subscricoes` com RLS): chave pública em `js/config.js`
  (`VAPID_PUBLIC_KEY`, opcional — vazia desliga com aviso na UI); envio pela
  Edge Function acionada por Database Webhook em INSERT de `notificacoes`,
  chave privada só em secret; inscrições 404/410 apagadas; clique no aviso
  foca a aba aberta e troca de rota sem recarregar.
- **Aprovações**: aba "Histórico" virou **"Todos"** (equipe e portal); lista,
  contagens e detalhe da equipe acompanham o banco em tempo real
  (postgres_changes em `aprovacoes` / `aprovacao_partes` / `comentarios`),
  o portal filtra por `client_id`; canal fechado ao sair da rota
  (`B7.Rota.aoSair`, novo em `js/app.js`).
- **Presença** (`js/presenca.js`): `perfil_heartbeat()` security definer grava
  `last_seen_at` só para `auth.uid()`; o frontend chama no máximo 1x a cada
  5 min (entrada, troca de rota, foco de volta). `b7-auth` grava
  `last_login_at` no login (trigger mantém `ultimo_acesso` igual; cai para o
  campo antigo se a migration ainda não rodou). Usuários e acessos mostra
  "Online agora" / "Último acesso: …" / "Nunca acessou". Nada de
  `auth.users` no frontend.

## Build 2026-09-09-j — C: responsividade, skeletons, roteiros, prévia

### Abertura só no arranque
- A tela de abertura (`.b7-abertura`) aparece no boot e no instante entre o
  login e a montagem do sistema, e nunca mais: `abrirCortina` vira no-op
  depois que `fecharCortina` roda com o sistema montado (`js/app.js`).
- Trocas de rota usam **skeletons** em vez de spinner de tela cheia:
  `B7.UI.skeleton(tipo, { n, cols, titulo })` em `js/ui.js`, com os tipos
  `linhas`, `cards`, `lista`, `tabela`, `central`, `detalhe`. CSS em
  `global.css` (seção "SKELETONS DE ROTA"). Usado em dashboard, clientes,
  gravações, roteiros, workspace do cliente, lixeira, arquivados, linhas,
  inteligência, onboarding, ideias, kanban, status semanal, usuários,
  aprovações, linha editorial e no portal do cliente.

### Auditoria responsiva
- `html, body, #app` em `100dvh` com reserva `100vh`; `env(safe-area-inset-*)`
  na sidebar, no topo e nas margens do conteúdo.
- Grades no celular usam `minmax(0,1fr)` (com `1fr` um título sem quebra
  empurrava o card para fora da tela); cards com `min-width:0`.
- Sidebar no celular/tablet (≤1080px) é gaveta: hambúrguer com
  `aria-expanded`, overlay (`body.gaveta:before`), botão × dentro da gaveta,
  fecha ao tocar fora, no ESC, ao navegar (`B7.Rota.ir` chama
  `B7.fecharGaveta`) e ao voltar a uma largura de desktop. `body.recolhida`
  não vale na gaveta (sempre aberta com rótulos).
- Sidebar recolhida sem barra de rolagem: `.nav{overflow-x:hidden}`, rótulo
  de grupo com `nowrap`, e `title` nos links quando só o ícone aparece.
- Abas (`.abas-cliente`, `.abas-linha`, `.filtro`, `.opcoes`) rolam na
  horizontal em qualquer largura que não as comporte; alvos de toque ≥ 40px
  em ≤820px e em `pointer:coarse`.
- Topo no celular: tema some (fica em Configurações), indicador de
  salvamento vira só o ponto, botão primário só com o ícone. No editor, o
  contexto (cliente · gravação) não quebra letra a letra e "Baixar" passa
  a existir também no menu ⋯ (o botão do topo some em ≤520px).
- Kanban: a margem negativa do quadro acompanha a margem real do conteúdo
  (`--gutter`), o que tirava 2–3px de rolagem lateral em ≤520px.
- Configurações: linha do estado do banco quebra em vez de empurrar o botão.

### Tela de Roteiros
- `abrirRoteiros` (`js/dashboard.js`) refeita: cards com cliente (avatar),
  gravação, título, objetivo, estágio (`chipRevisao`), "atualizado há…" e
  data de gravação; busca por título/cliente/gravação (sem acento), filtro
  por estágio e por cliente, tudo em memória; estados vazios com identidade
  (`estadoB7`) para "nenhum roteiro" e "nada com esses filtros" (com
  "Limpar filtros"). `roteirosRecentes` traz `status` e `objetivo`.
- Cards focáveis por teclado (Enter abre).

### Prévia no hover refeita
- Um único elemento `.previa-roteiros` para o sistema inteiro, reutilizado;
  eventos delegados no painel e ligados uma vez por sessão (antes cada
  render somava um listener de scroll por card e o cartão ficava preso).
- Fecha em mouseleave, scroll (painel e janela), resize, ESC, `hashchange`
  e `B7.Rota.aoSair`. Fica fora do retângulo do card (acima, abaixo ou ao
  lado), então nunca cobre o cursor. Marca o roteiro do card atual.

### Portal do cliente
- Mesma gaveta e `100dvh`. Os controles do sistema interno no topo (busca,
  Nova gravação, menu de backup, indicador de salvamento) somem em
  `body.modo-portal`.

### Como foi testado
- `node --check` em todos os JS.
- Playwright headless com REST simulado e sessão semeada em `localStorage`
  (`b7-sessao`): 16 rotas da equipe + 7 do portal (papel cliente via
  `minha_sessao` mockada) em 1280×800, 1024×768, 390×844 e 360×740, medindo
  `scrollWidth <= innerWidth` e rolagem lateral do painel — todas OK, sem
  erros de JS. Sidebar recolhida sem scroll; gaveta abre/fecha por toque,
  ESC, navegação e overlay; prévia abre no hover e fecha em mouseleave,
  scroll, ESC e troca de rota; skeleton visível logo após cada troca.
- Só no aparelho real: `env(safe-area-inset-*)` em iPhone com notch,
  comportamento de `100dvh` com a barra do Safari/Chrome recolhendo, e a
  ausência de hover no toque (a prévia já não é ligada em `pointer:coarse`).

## Build 2026-09-10 — R: "Excluir aprovação" (anulação auditada pelo Admin)

Ver a seção "Anulação" em APROVACOES.md. Resumo:

- `migration_aprovacoes_v3.sql` (nova; roda depois de `migration_push.sql`
  e antes do RLS): colunas de auditoria em `aprovacoes` e
  `aprovacao_partes` (`anulada_em`, `anulada_por`, `anulada_por_nome`,
  `anulacao_motivo`, `anulacao_visivel_cliente`, `situacao_anterior`),
  `kanban_demandas.aviso`, função `aprov_anular` (só admin ativo; motivo
  obrigatório), `aprov_processar_evento` recriada com os eventos
  `aprovacao.anulada` / `parte.anulada`, `aprov_decidir` recriada só para
  a chave do evento incluir `anulada_em` (sem isso a nova decisão do
  cliente depois de uma anulação não gerava evento), `aprovacoes_painel`
  recriada (drop/create) com as colunas de anulação e `decisao_anulada`,
  `kanban_resumo` recriada (usa `d.*` e precisava enxergar `aviso`).
- Não existe `situacao = 'anulado'`: a anulação devolve a versão a
  `pendente`/`parcial` (ou `substituido` se já há versão mais nova) e o
  cliente decide de novo. Motivo documentado na migration e em APROVACOES.md.
- `js/database.js`: `anularAprovacao({id, escopo, parteId, motivo, visivelCliente})`.
- `js/aprovacoes.js`: botão "Excluir aprovação" no cabeçalho do detalhe e
  "Excluir" por cena (só admin — o banco confere também); modal "Excluir
  aprovação?" com cliente, material, versão, tipo, data da decisão,
  consequência, motivo obrigatório e "Mostrar motivo ao cliente"; bloco
  "Aprovação anulada pelo Administrador em dd/mm/aaaa" + motivo; aviso da
  demanda (Kanban) quando a anulação não pôde mover; linha do tempo e lista
  reconhecem `decisao_anulada`; `blocoStatus` (editor e linha editorial)
  mostra a anulação. Contadores acompanham pelo realtime já existente.
- `js/portal.js` (mínimo): faixa neutra "A aprovação anterior foi anulada
  pela Branding7." em `abrirRevisao` (motivo só se o admin marcou),
  `textoEncerrado` e marca na cena anulada; a decisão volta a estar
  disponível porque a versão volta a `pendente`/`parcial`.
- `js/kanban.js` (mínimo): card mostra "⚠ Revisar: aprovação anulada" e o
  detalhe mostra o texto do `aviso` com "Já revisei" (limpa o campo).
- CSS: `styles/aprovacoes.css`, `styles/portal.css`, `styles/kanban.css`.

### Como foi testado
- `node --check js/*.js sw.js`.
- PostgreSQL 16 local, banco `wt_r`: cadeia completa de migrations, v3
  duas vezes, RLS, `t_aprov.sql` (9 ERROR esperados, nada além) e
  `/tmp/pgtest/t_anular.sql`: anulação total (situação, `decidido_*`
  preservados, evento processado, notificações — cliente com texto neutro,
  coordenador com motivo, admin ator sem notificação —, Kanban
  `pronto → aguardando_cliente` com histórico "Aprovação anulada por …",
  painel com `decisao_anulada`), coordenador e cliente → 42501, sem motivo
  → P0005, anular duas vezes → P0003 com data e autor, cliente decide de
  novo → aceito e gera evento/Kanban `pronto` de novo, demanda concluída →
  `aviso` e sem movimento, motivo visível ao cliente quando marcado,
  anulação por cena (parte volta a `pendente`, todo recalculado, evento
  `parte.anulada`), versão antiga anulada → `substituido` sem mexer no
  Kanban, UPDATE direto do cliente continua bloqueado, 0 eventos com erro.
- Playwright headless (porta 8783, REST/RPC simulados): admin vê o botão
  e o "Excluir" por cena, modal com todos os campos, envio sem motivo é
  barrado na tela sem chamar o banco, envio chama `aprov_anular` com
  `p_escopo`, `p_motivo` e `p_visivel_cliente`, detalhe redesenha com o
  bloco de anulação e a linha do tempo; coordenador não vê o botão;
  cliente vê a faixa neutra e os botões de decisão de volta.
- Só em produção: Realtime de verdade (o canal já existente redesenha a
  lista/detalhe/portal quando `aprovacoes` muda), push das notificações
  de anulação, e o Kanban redesenhado por outro agente exibindo `aviso`.

## Build 2026-09-10-b — Editor de Carrossel sem Headline/CTA redundantes

Sem SQL novo (as colunas `conteudos.headline` e `conteudos.cta` já
existiam e continuam existindo — só deixaram de ser usadas por
Carrossel; Reel e Card continuam com os dois campos normalmente).

- O editor de carrossel não pede mais "Capa/Headline" antes do Slide 1
  nem "CTA do último slide" depois da lista. O **Slide 1 é a abertura**
  (gancho/título/primeira mensagem) e o **último slide é sempre o CTA**
  — de forma estrutural e dinâmica, nunca um número fixo gravado no
  banco: adicionar, remover ou arrastar um slide reflete a etiqueta
  "CAPA"/"CTA" na hora, sem recarregar a tela.
- Nenhum texto de CTA é escrito automaticamente — o rótulo só identifica
  qual slide é o CTA; o conteúdo continua 100% editável pela pessoa.
- Snapshot de aprovação, folha A4 e apresentação 16:9 atualizados para a
  mesma lógica (slide 1 = capa, último = CTA), sem bloco duplicado de
  Headline/CTA para Carrossel.
- Compatibilidade: carrosséis antigos que já tinham `headline`/`cta`
  preenchidos continuam aparecendo nas exportações — como conteúdo do
  slide 1/último quando esse slide específico está vazio — sem apagar
  nada e sem duplicar slide algum. Ao editar um carrossel existente, os
  dois campos antigos simplesmente deixam de ser usados a partir daí.
- Testado: `node --check`, lógica de rotulagem (CAPA/CTA) isolada com 8
  casos — 1º de N, meio, último de N, slide único (CAPA e CTA juntos),
  o que era CTA deixa de ser após adicionar um slide, o novo último vira
  CTA, o novo último vira CTA após excluir, e após reordenar — todos
  corretos; smoke completo do app sem erro de JavaScript.

## Build 2026-09-10-c — Calendário: Postagem × Gravação bem diferentes

Sem SQL novo: a Gravação já existia como tabela própria (`gravacoes`),
só passou a aparecer no calendário editorial ao lado da Postagem.

- O calendário da Linha Editorial (aba Postagens → Calendário) agora
  mostra **Postagem** e **Gravação** juntas, cada uma com identidade
  visual própria: cor de fundo/borda diferente (tokens novos
  `--cal-post`/`--cal-grav`, claro e escuro), e **ícone diferente**
  (câmera para Gravação, o ícone do formato — Reel/Card/Carrossel/
  Story — para Postagem) — dá pra saber o que é o quê mesmo em
  escala de cinza, sem depender só da cor.
- **Tipo de evento não é status.** Postagem/Gravação é o que o item É;
  o status (Em revisão, Aprovado, Gravado…) vira só um pontinho discreto
  no canto do item — a cor principal do card nunca muda quando o status
  muda.
- Legenda compacta (● Postagem ● Gravação) sempre visível perto dos
  controles do calendário, com os mesmos ícones/cores reais.
- Um dia com Postagem e Gravação mostra as duas, separadas, sem juntar
  numa coisa só. Com muitos itens no dia, o "+N" continua funcionando e
  ao expandir aparecem todos com sua cor/ícone certos.
- Gravação só aparece no calendário quando já tem data marcada de
  verdade — nunca é inventada. Data tratada só como string (sem fuso).
- Clicar numa Postagem abre o conteúdo; clicar numa Gravação abre a
  ficha da gravação (`#/gravacao/<id>`) — nenhum registro é duplicado
  só pra desenhar o calendário.
- No celular, sem espaço para ícone/texto, o ponto de cada dia também
  muda de **forma** (Postagem = círculo, Gravação = quadrado
  arredondado), não só de cor.
- Testado: `node --check`; Playwright com um mês simulado cobrindo — dia
  só com Postagem, dia só com Gravação, dia com as duas, várias
  Postagens no mesmo dia (com overflow "+1"), várias Gravações no mesmo
  dia, Postagem + Gravação + overflow no mesmo dia, claro, escuro,
  desktop (1280), tablet (834), celular (390), foco de teclado, ícones
  SVG diferentes por tipo, cores de fundo diferentes em claro e escuro,
  clique na Gravação navegando para a ficha certa — 17 verificações,
  todas passaram, sem erro de JavaScript. Smoke geral do app sem
  regressão.

## Build 2026-09-10-d — B7 Design (Central de Design)

Módulo novo de produção visual interna, sem exigir login de cliente.
Arquitetura: `design_deliverables` (a peça) → `design_versoes` (V01,
V02…) → `design_arquivos` (prévia/produção/anexo/final); cada peça se
liga ao `kanban_demandas` já existente (não é um segundo quadro) e usa
`eventos_dominio`/`notificacoes` (não é um segundo sistema de
notificação). Aprovação futura do cliente reaproveita `aprovacoes`
(`tipo='design_versao'`) — não é um segundo motor de aprovação.

- **Papel Designer** (`migration_design.sql`): `sou_designer()` e
  `sou_equipe_interna()` (admin+coordenador+designer) novas, sem alterar
  o que `sou_equipe()` já protegia. Designer só lê a Linha Editorial
  (política de leitura adicionada por cima da já existente, nunca
  escreve strategy/roteiro/pilares).
- **"Enviar para Design"** — na Linha Editorial inteira e por criativo
  (`js/linha.js`). Idempotente de verdade (índice único
  `conteudo_id+tipo`): clicar de novo não duplica, e o toast mostra os
  números reais devolvidos pelo banco ("N peças enviadas… M já
  existiam."). Reel só vira peça de Capa quando `precisa_capa=true`
  (novo controle Sim/Não no editor do Reel — opcional, sem bloquear
  nada).
- **Briefing sem duplicar nada**: o Designer lê headline, sub-headline,
  objetivo, observação de Design e referências que já estão no
  conteúdo — nenhum campo novo obrigatório de "direção criativa". A
  regra do carrossel (Slide 1 = abertura, última slide = CTA dinâmico)
  é a mesma da Linha Editorial, mostrada com o mesmo critério.
- **Fila do Designer** (`#/design`) prioriza o que a pessoa precisa
  fazer agora (Ajustes solicitados, Em criação, Revisão interna…),
  com prazo real (Vence hoje/amanhã/Atrasado há N dias — só quando
  existe prazo). "Equipe de Design" (Admin/Coordenador) mostra carga
  real por pessoa, sem ranking nem "produtividade".
- **Upload real** para o bucket privado `design-files`: progresso real
  por arquivo (XHR), sem limite artificial de tamanho no app, múltiplos
  arquivos por versão, papel por arquivo (prévia/produção/anexo/final).
  Falha no envio preserva rascunho e observação já digitados.
- **Revisão interna**: Designer nunca aprova a própria peça (barrado no
  banco, testado). Admin/Coordenador aprovam ou pedem ajuste com
  mensagem obrigatória; a versão anterior fica intacta no histórico com
  seu estado original.
- **Produção de Design** dentro da Linha Editorial: contagem real por
  status e lista das peças, cada uma levando direto para o detalhe.
- Testado com Postgres real (não simulado): cadeia completa do fluxo de
  aceitação interno (gerar → atribuir → enviar V01 → pedir ajuste →
  enviar V02 → aprovar → finalizar, tudo sem login de cliente) e RLS
  como Admin/Coordenador/Designer(dois)/Cliente/anônimo — cada regra de
  segurança do enunciado foi exercitada e confirmada. UI testada com
  Playwright (admin/coordenador/designer, desktop 1280 e celular 390):
  zero erro de JavaScript, zero scroll horizontal, navegação do
  Designer sem nenhum item administrativo vazando.
- `VERSAO` → `2026-09-10-d`, cache do service worker → `roteiros-b7-v19`.

## Build 2026-09-10-e — Designer em Usuários e acessos

A migração e o RPC já aceitavam o papel `designer` desde o build
anterior, mas faltava o caminho de criação: a tela **Usuários e
acessos** só oferecia Administrador/Coordenador/Cliente no seletor, e a
Edge Function `b7-auth` (que é quem de fato cria e altera contas)
recusava `papel='designer'` com "Perfil inválido." mesmo se alguém
tentasse por fora da tela. Sem isso, não havia como criar um usuário
Designer de verdade.

- `js/usuarios.js`: "Designer — produz as artes a partir da Linha
  Editorial" adicionado à lista de papéis, nos modais de criar e editar
  usuário.
- `supabase/functions/b7-auth/index.ts`: `designer` incluído nas duas
  listas de papéis aceitos (`criar_usuario` e `alterar_conta`) — sem
  isso a validação do backend barrava a criação mesmo com a tela
  corrigida.
- `styles/auth.css`: selo "DESIGNER" na lista de usuários com cor
  própria (azul, a mesma introduzida para Gravação no calendário),
  clara e escura.
- **Requer nova publicação da Edge Function**: depois de subir os
  arquivos, é preciso reimplantar `b7-auth` no Supabase (Edge Functions
  → `b7-auth` → colar `supabase/functions/b7-auth/index.ts` atualizado)
  — só subir o HTML/JS no GitHub Pages não atualiza a função.
- Testado: `node --check`; Playwright confirmou as 4 opções de papel no
  modal ("admin", "coordenador", "designer", "cliente") sem erro de JS.
- `VERSAO` → `2026-09-10-e`, cache do service worker → `roteiros-b7-v20`.

## Build 2026-09-10-f — B7 Design: refino operacional

Refino sobre o build `-d` (não uma reconstrução): a Central do Designer
passou a abrir já mostrando o que fazer, agrupado por Linha Editorial —
sem precisar visitar "Linhas editoriais" só para descobrir trabalho — e
o envio de uma peça para revisão deixou de exigir arquivo: quem revisou
e aprovou a arte fora do sistema (ex.: WhatsApp) agora registra isso
honestamente em vez de ser obrigado a simular um upload.

**Banco (`migration_design_refino.sql`, aditiva, roda depois de
`migration_design.sql`):**
- `design_versoes` ganhou `via` (`upload` | `externa`) e
  `canal_externo` (texto livre curto, ex. "WhatsApp"). `via` é
  `'upload'` por padrão — nada muda para quem sempre usou arquivo.
- `design_versao_enviar` ganhou dois parâmetros (`p_via`, `p_canal`,
  ambos com default, então nenhuma chamada existente quebra) e só exige
  `count(*) > 0` de `design_arquivos` quando `via = 'upload'`. Via
  `externa` passa sem nenhum arquivo. **A função de 2 parâmetros
  anterior foi removida (`drop function`)** — mantê-la ao lado da nova
  deixava uma chamada com 2 argumentos ambígua para o Postgres (dois
  candidatos possíveis) e toda chamada existente passava a falhar; isso
  foi pego pelo teste automatizado antes de qualquer coisa ir para
  produção.
- `design_processar_evento`: a notificação de "peça enviada para
  revisão" agora menciona a via quando é externa — "(revisada por fora
  — WhatsApp)" — nunca finge que um arquivo foi enviado.
- `design_assumir_demanda_linha(linha_id)`: nova função, só para
  Designer, que reivindica em lote **apenas** as peças daquela linha
  que estão sem responsável e não finalizadas — idempotente (rodar de
  novo sem peça nova reivindica 0), nunca tira uma peça de outro
  designer, e convive com a atribuição manual existente (não assume
  nada que já tenha dono, mesmo que o dono seja outra pessoa).
- Nenhuma mudança em `design_solicitar_ajuste`, `design_aprovar_interno`,
  `design_finalizar` ou `design_enviar_cliente` — elas já operavam
  sobre o estado da versão, nunca dependeram de arquivo existir.

**Frontend (`js/design.js`, `js/database.js`, `styles/design.css`,
`js/app.js`):**
- Central do Designer (`#/design`) reorganizada em duas seções sempre
  visíveis, agrupadas por Linha Editorial: **"Demandas a fazer"**
  (sem responsável, com o prazo mais próximo do grupo e um botão
  **"Assumir demanda"** que reivindica todas de uma vez) e **"Minhas
  demandas"** (já assumidas, com progresso real — X de Y finalizadas —
  e alerta de quantas estão em ajuste). Autoatribuição individual
  continua disponível dentro do detalhe de cada peça, como antes.
- Nova tela `#/design/linha/<id>` (`B7.Design.abrirLinha`): leitura da
  produção de Design de uma Linha Editorial específica, para o Designer
  não precisar abrir o editor completo da Linha só para ver o que está
  em jogo ali. Acessível pelos cartões de grupo na Central.
- Gaveta de detalhe: "Enviar nova versão" agora tem duas abas —
  **"Enviar arquivo"** (fluxo de sempre) e **"Revisada por fora (sem
  arquivo)"** (observação + canal opcionais, botão "Marcar como enviada
  para revisão" sem exigir nada anexado). O histórico de versões mostra
  um selo "Revisada por fora — <canal>" quando é o caso — nunca omite
  isso nem simula um arquivo que não existe.
- `B7.DB.enviarVersaoDesign` ganhou os parâmetros `via`/`canal`;
  `B7.DB.assumirDemandaLinha(linhaId)` é a chamada nova.
- Barra de filtros: o alternador Quadro/Lista some para o Designer (só
  fazia sentido para a fila da equipe; a Central do Designer não usa
  mais essa vista).

**Testado:**
- `migration_design_refino.sql` rodada do zero contra Postgres 16 local
  (cadeia completa: `migration_rls.sql` → `migration_design.sql` →
  `migration_design_refino.sql`), com fixtures reais de admin,
  coordenador, 2 designers e cliente.
- Aceitação via SQL com `set role authenticated` + `request.jwt.claim.sub`
  real (não mock): Mateus assume as 3 peças de uma linha (`assumidas: 3`),
  rodar de novo não assume nada (`assumidas: 0`, idempotente), Bia (outra
  designer) não rouba as peças já assumidas por Mateus, e
  admin/coordenador recebem erro de permissão ao tentar chamar a função
  (é exclusiva de Designer). Envio sem arquivo e sem via falha com a
  mensagem certa; o mesmo envio com `via='externa'` e canal "WhatsApp"
  passa sem nenhum arquivo, segue até aprovação interna e finalização
  normalmente, e a notificação gerada nomeia a via honestamente. Uma
  segunda peça com arquivo real, via padrão, continua funcionando como
  antes.
- `node --check` em todos os arquivos JS tocados.
- Playwright (mock completo do Supabase): Central do Designer mostra os
  dois grupos corretos; clicar em "Assumir demanda" move a peça de
  "Demandas a fazer" para "Minhas demandas" na tela (chamada real ao
  RPC, sem mock de sucesso hardcoded); abrir um grupo mostra a vista de
  leitura por linha; a aba "Revisada por fora" habilita o envio sem
  nenhum arquivo e o histórico exibe "Revisada por fora — WhatsApp";
  testado também em 390px (mobile) sem quebra de layout. Sem erros de
  console em nenhum cenário.
- `VERSAO` → `2026-09-10-f`, cache do service worker → `roteiros-b7-v21`.

**Honestidade sobre o que não foi testado:** não houve teste em
Supabase real (o ambiente de teste é Postgres local — a mesma limitação
de todos os builds anteriores desta sessão). O teste de duas sessões
simultâneas em tempo real (dois designers vendo a Central atualizar ao
vivo) não foi refeito neste build — o canal Realtime já existente
(`design_deliverables`/`design_versoes`) não foi alterado, então o
comportamento observado no build `-d` deve se manter, mas isso não foi
reconfirmado agora.

## Build 2026-09-10-g — Design: foto gigante na aba "Equipe"

Bug reportado pelo usuário com print de tela: na aba "Equipe" (visão da
equipe em Design), o avatar do designer aparecia enorme — a foto no
tamanho natural do arquivo, "vazando" do cartão — e o nome ficava
cortado ao lado ("A..").

Causa: `viewEquipe()` (`js/design.js`) sempre chamou
`B7.UI.avatarPessoa(pessoa, 'sm')`, mas o modificador de tamanho `sm`
nunca tinha sido definido em nenhum CSS do sistema — só existiam
`.lu-avatar`, `.perfil-avatar`, `.foto-previa` etc. (cada tela com sua
própria classe) e `.av-pessoa.xs` (em `kanban.css`, reaproveitado pelos
cartões normais de Design). Sem largura/altura definidas, o navegador
não tinha como encolher a `<img>` (que é `width:100%;height:100%`
relativa ao próprio container) — o container ficava do tamanho da foto.
Bug pré-existente do build `-d`, só notado agora que havia um designer
com foto de perfil cadastrada nos dados de teste do usuário.

- `styles/design.css`: `.av-pessoa.sm{width:36px;height:36px;
  border-radius:10px;font-size:36px}` — mesmo tamanho já usado por
  `.ds-sem-resp.lg` ali do lado, para o "sem responsável" e o avatar
  real ficarem visualmente do mesmo tamanho na grade da Equipe.
- Testado com Playwright, avatar com foto real (URL de imagem): cartão
  correto, foto pequena e redonda, nome e contagem legíveis.
- `VERSAO` → `2026-09-10-g`, cache do service worker →
  `roteiros-b7-v22`.

## Build 2026-09-10-h — B7 Design: conclusão formal, versionamento e Central do Designer como home

Refinamento operacional grande, pedido pelo dono como continuação do
build `-f`: a Central do Designer devia ser *só* sobre Design (nunca
Gravações/Roteiros), e a liberação de demandas de Design devia ter um
gatilho formal — "Concluir Linha Editorial" — em vez de nascer de
qualquer edição de rascunho. Relatório completo por seção em
`RELATORIO_2026-09-10-h_REFINO_FINAL.md`; aqui vai o resumo técnico.

**Banco (`migration_editorial_versao.sql`, nova — roda depois de
`migration_design_refino.sql`):**
- `linhas_editoriais` ganha `concluida_em`, `concluida_por`,
  `versao_design` — controle da conclusão formal, sem mexer no campo
  `status` (texto livre, cosmético) que já existia.
- `linha_versoes`: uma linha por conclusão, com snapshot jsonb completo
  dos conteúdos (inclusive slides/frames) daquele momento. RLS: só quem
  já pode ver a Linha Editorial (equipe, designer, ou cliente com
  `visivel_cliente`) lê; ninguém escreve direto (só a função).
- `design_deliverables` ganha `briefing_desatualizado` e
  `linha_versao_confirmada` — usados na reconciliação.
- `linha_montar_snapshot(linha_id)`: monta o jsonb.
- `linha_concluir(linha_id, responsavel_design_id)`: função central.
  Só equipe (`sou_equipe()`) chama. Grava o snapshot, gera/atualiza as
  peças de Design (reaproveita `design_gerar_da_linha`, já existente —
  não duplica geração), compara o snapshot novo com o anterior por
  `conteudo_id` e marca `briefing_desatualizado=true` só nas peças cujo
  conteúdo realmente mudou (headline, CTA, slides, frames etc.) — as
  que não mudaram, ou são novas, não ficam com aviso falso. Se um
  responsável é informado, atribui as peças sem responsável dessa linha
  a ele e move o Kanban vinculado junto. Idempotente: concluir de novo
  sem mudar nada não duplica peça nem marca nada como desatualizado.
- `design_processar_evento` ganha um ramo novo para
  `alvo_tipo='linha_editorial'`/`tipo='linha.concluida'` (função
  reaproveitada, não duplicada): notificação **em lote**, nunca uma por
  peça — "atribuída a você" (um destinatário) quando há responsável, ou
  "disponível" (um envio por Designer ativo, mesmo evento) quando não
  há; e uma notificação separada de "Briefing atualizado" para quem já
  tinha peça e teve o conteúdo mudado sob os pés, agrupada por
  designer.
- `perfil_preferencias_gravar` ganha a chave `ultimo_som_em` (timestamp
  validado no servidor — string que não vira `timestamptz` é
  rejeitada), sem tirar a validação já existente de `som`/`navegador`/
  `push`; qualquer chave desconhecida continua sendo ignorada. Base
  para o som de login tocar só uma vez por lote de fato novo.
- `design_resumo` e `linhas_resumo` recriadas (Postgres não deixa
  `create or replace view` inserir coluna no meio — as duas já eram
  `select l.*`/tinham lista explícita) para expor as colunas novas.

**Segurança — testado de verdade, não só assumido:** com o rig de
Postgres 16 local, simulando sessão de Designer
(`set role authenticated; select set_config('request.jwt.claim.sub',
'<uuid-do-designer>', false)`), tentativas diretas de `UPDATE` em
`linhas_editoriais`, `conteudos` e `clientes` afetam **0 linhas** (RLS
via `USING`) e a tentativa de `INSERT` em `conteudos` é **recusada**
pelo Postgres com violação de RLS (via `WITH CHECK`) — não são bugs,
são o comportamento correto e esperado das políticas que já existiam
desde `migration_rls.sql` (builds anteriores desta sessão). Ou seja: a
principal exigência de segurança deste refino ("Designer só lê, nunca
escreve, e isso precisa valer mesmo pulando a UI") **já estava
garantida pela arquitetura existente** — este build não precisou
adicionar nenhuma política nova de escrita para isso, só confirmar com
teste real que elas seguram.

**`js/app.js`:** a rota padrão (`#/`) agora manda o Designer direto
para `B7.Design.abrir(aba, true)` em vez da Central de Produção
genérica (Gravações/Roteiros/Linhas/Aprovações) — a Central genérica
nunca fazia sentido para quem não grava nem escreve roteiro, e dois dos
quatro atalhos nem abriam (rota já bloqueada). Admin/coordenador
continuam caindo na Central de sempre — `js/central.js` não foi
alterado.

**`js/design.js`:** `abrir(aba, comoInicio)` — quando é a Home do
Designer (`comoInicio=true`), marca o item de navegação certo ("Central
B7") e não duplica o título da aba; o conteúdo renderizado é
exatamente o mesmo de `#/design`.

**`js/permissoes.js`:** rota `cliente` entra na lista do Designer — sem
isso ele não conseguia nem abrir a ficha de um cliente para entender o
ICP/posicionamento (só existia acesso de leitura no *banco*, mas a UI
bloqueava a navegação). O item de nav `#/clientes` (lista geral)
continua escondido — o Designer chega ao cliente pelo contexto de uma
peça, não navegando a lista inteira.

**`js/conteudo.js`:** `ligarCampos` (autosave usado por toda tabela de
conteúdo — Linha Editorial, conteúdos, pilares, inteligência do
cliente, onboarding, status semanal) ganhou um guardião central:
quando quem está logado é Designer, todo campo com `data-campo`/
`data-tab` vira `disabled`/`readOnly` em vez de ligar o autosave — um
ponto só, cobrindo todas as telas que usam esse mecanismo de uma vez,
em vez de alterar campo por campo em cada arquivo. Nenhum campo do B7
Design em si passa por `ligarCampos` (tem sua própria tela), então
nada do fluxo de trabalho do Designer foi afetado.

**`js/linha.js`:** botão novo "Concluir Linha Editorial" (visível só
para quem pode enviar para Design — mesma regra de sempre) com modal
de seletor opcional "Responsável pelo Design" (Sem responsável ou um
Designer ativo da lista real). Chama `linha_concluir` e mostra o
resultado real devolvido pelo banco (peças totais, novas, atualizadas,
atribuídas — nunca um texto genérico). O botão antigo "Enviar para
Design" continua existindo, agora rotulado "(rápido, sem versão)" —
ele não gera snapshot nem notificação em lote; ver nota de honestidade
abaixo. Selo "Concluída · vN" aparece no cabeçalho da linha quando
`concluida_em` está preenchido.

**`js/database.js`:** `concluirLinha(linhaId, responsavelId)`,
`versoesDaLinha(linhaId)`, `ultimaNaoLida()` (não lida mais recente,
consulta leve — não traz a lista inteira).

**`js/notificacoes.js`:** `avisarLoteAoEntrar()`, chamada uma vez no
primeiro `montar()` da sessão (login/reload). Busca a não lida mais
recente, compara `created_at` contra `preferencias.ultimo_som_em`; toca
o som (respeitando a preferência "Som das notificações") só se for mais
nova, e grava a nova marca d'água no banco — nunca marca a notificação
como lida. Em reloads seguintes, sem notificação mais nova que a marca,
não toca de novo. O Realtime (evento chegando com a sessão já aberta)
continua tocando pelo caminho de sempre (`anunciar`), sem mudança.

**Testado:**
- `migration_editorial_versao.sql` rodada do zero contra Postgres 16
  local, cadeia completa desde `supabase_setup.sql` até
  `migration_editorial_versao.sql` (16 arquivos, nesta ordem), duas
  vezes seguidas sem erro (idempotência das migrations).
- SQL de aceitação dedicado (equivalente a `t_versao.sql`), com
  `set role authenticated` real (não mock), cobrindo: linha sem peça
  liberada antes da conclusão; conclusão sem responsável gera 3 peças e
  notifica os 2 designers ativos (uma notificação cada, não uma por
  peça); concluir de novo sem mudar nada não duplica peça nem marca
  nada como desatualizado; mudar o headline de um conteúdo e concluir
  de novo marca **só** aquela peça como `briefing_desatualizado`, as
  outras duas continuam `false`; nova linha concluída já atribuindo a
  um designer específico atribui a peça, move status e notifica
  "atribuída a você"; designer tentando concluir recebe erro de
  permissão; tentativas diretas de `UPDATE`/`INSERT` de Designer contra
  `linhas_editoriais`/`conteudos`/`clientes` são bloqueadas pelo RLS
  (0 linhas afetadas / violação explícita); Designer consegue `SELECT`
  normalmente (leitura permitida); `perfil_preferencias_gravar` aceita
  `ultimo_som_em` válido, ignora chave desconhecida e não quebra com
  boolean malformado.
- `node --check` em todos os arquivos JS tocados
  (`app.js`, `design.js`, `database.js`, `notificacoes.js`, `linha.js`,
  `conteudo.js`, `central.js`, `permissoes.js`, `sw.js`).
- Playwright (mock completo do Supabase, sem tocar rede real):
  Designer abrindo `#/` cai direto na Central de Design (nav mostra só
  "Design" e "Linhas editoriais", nenhum rótulo de Gravações/Roteiros
  na tela, sem erro de console); Admin abrindo uma Linha Editorial, uma
  Linha Editorial vê o botão "Concluir Linha Editorial", o modal abre,
  o RPC `linha_concluir` é chamado com os parâmetros certos
  (`p_linha_id`, `p_responsavel_design_id`), o toast mostra a contagem
  real devolvida pelo mock e o selo "Concluída · v1" aparece no
  cabeçalho depois; Designer abrindo a mesma Linha Editorial na aba
  Estratégia tem os 9 campos editáveis daquela aba todos desabilitados
  (nenhum ficou editável por engano).
- `VERSAO` → `2026-09-10-h`, cache do service worker →
  `roteiros-b7-v23`.

**Honestidade sobre o que não foi testado ou não foi feito:**
- **Supabase real**: nenhum teste rodou contra o projeto de produção —
  só o rig local de Postgres 16, mesma limitação de todos os builds
  anteriores desta sessão. Recomendo rodar
  `migration_editorial_versao.sql` primeiro num ambiente de teste antes
  de produção, e conferir com uma consulta direta que `design_resumo`/
  `linhas_resumo` devolvem as colunas novas.
- **Som de notificação em dispositivo real / restrição de autoplay**: a
  lógica de "tocar uma vez por lote novo" foi validada na lógica
  (comparação de timestamp, gravação da marca d'água) e via
  `node --check`, mas **não** foi validada num navegador real com
  autoplay bloqueado — o `tocarSom()` existente já tem a guarda
  `ctx.state !== 'running'` (não toca sem gesto prévio da pessoa), e
  isso não muda neste build, mas não posso afirmar que o som realmente
  soa no primeiro login em todo navegador.
- **Push em dispositivo real**: não testado — este build não mexeu no
  fluxo de push (`migration_push.sql`), só no som local do sino.
- **Realtime com duas sessões simultâneas**: não retestado neste build.
  O canal usado pela Central do Designer é o mesmo já existente
  (`design_deliverables`/`design_versoes`), que não foi alterado —
  comportamento observado nos builds anteriores deve se manter, mas
  isso não foi reconfirmado agora.
- **Cobertura exaustiva de somente-leitura fora dos campos de
  autosave**: `ligarCampos` cobre todo campo de texto/select ligado ao
  autosave (Linha Editorial completa, incluindo a ficha do cliente via
  Inteligência/Onboarding). Não fiz uma varredura campo a campo dos
  botões de ação da ficha do cliente fora da aba Inteligência (por
  exemplo "Arquivar gravação", "Excluir cliente", "Nova gravação", que
  ficam nas abas Gravações/Geral da ficha do cliente, hoje acessível ao
  Designer só pelo contexto de uma peça) — esses continuam visíveis na
  UI para o Designer, embora a escrita real no banco já esteja barrada
  pelo mesmo RLS testado acima (mesmo padrão `sou_equipe()` cobre
  `clientes`/`gravacoes`/`status_semanais`). Ou seja: nenhum buraco de
  segurança, mas a experiência nessas telas específicas pode mostrar um
  botão que erra ao ser clicado por um Designer, em vez de já vir
  escondido. Recomendo uma rodada futura dedicada a isso se o dono
  achar que vale a pena, dado que não é o caminho principal do
  Designer.
- **`design_assumir_demanda_linha`, `design_criar_manual` e o restante
  do fluxo já existente do build `-f`**: não foram alterados — os
  testes antigos (`t_design.sql`, `t_design_refino.sql`) foram
  reexecutados contra a cadeia de migrations completa (incluindo a
  nova) e continuam passando exatamente com os mesmos erros esperados
  de antes, confirmando que nada regrediu.
- **Botão antigo "Enviar para Design"**: fica coexistindo com "Concluir
  Linha Editorial" porque removê-lo não foi pedido explicitamente e
  algumas equipes podem preferir o fluxo rápido para um teste pontual.
  Ele gera peças (idempotente, reaproveitando a mesma função de
  geração) mas **não** cria snapshot de versão nem dispara a
  notificação em lote da conclusão formal — só a notificação de peça
  criada, já existente. Recomendo ao dono decidir, numa rodada futura,
  se esse botão deve sumir da interface para não haver dois caminhos
  para a mesma coisa.

## Build 2026-09-11-i — auditoria de RLS em produção + Central do Designer: "Precisa de mim", "Continuar de onde parei" e resumo de produção

O dono mandou uma segunda especificação grande, com uma preocupação
central nova: confirmar que o `migration_rls.sql` (que builds anteriores
desta sessão sempre assumiram como já aplicado, mas só testaram contra
Postgres local) estava mesmo ativo no Supabase de **produção**. Relatório
completo em `RELATORIO_2026-09-11-i_AUDITORIA_E_CENTRAL.md`.

**Auditoria de segurança em produção (não em ambiente local, pela
primeira vez nesta sessão):** o dono rodou três consultas de leitura que
eu preparei, direto no SQL Editor do projeto real. Resultado:
- RLS está **ligada** (`relrowsecurity = true`) nas 11 tabelas
  verificadas: `aprovacoes`, `clientes`, `conteudos`, `design_deliverables`,
  `design_versoes`, `gravacoes`, `kanban_demandas`, `linhas_editoriais`,
  `notificacoes`, `perfis`, `roteiros`.
- Políticas de RLS **existem** em praticamente todas as tabelas do
  schema (`clientes` tem 2, `linhas_editoriais` tem 2, `conteudos` tem 2,
  `perfis` tem 1, `design_deliverables` tem 1, e assim por diante).
- `anon`/`authenticated` têm GRANT bruto de INSERT/UPDATE/DELETE em
  `clientes`, `conteudos`, `linhas_editoriais` e `perfis` — isso por si
  só pareceria grave, mas GRANT de tabela é só o primeiro portão; com
  RLS ligada e política escrevendo `using (sou_equipe())`/
  `with check (sou_equipe())`, a política é quem decide linha por linha,
  e o GRANT aberto sozinho não expõe nada.
- Conclusão: **o `migration_rls.sql` já estava aplicado em produção**
  antes mesmo desta rodada. Os testes de segurança dos builds `-h` e
  anteriores (Designer tentando `UPDATE`/`INSERT` direto, bloqueado) —
  embora feitos só em Postgres local — refletem o comportamento real do
  banco de produção, porque a política testada localmente é a mesma
  política que está de fato ativa lá.
- **Ressalva honesta:** eu confirmei que RLS está ligada e que políticas
  existem, e testei essas políticas (localmente) simulando sessão de
  Designer — mas não tenho como garantir que o *texto* de cada política
  em produção é byte a byte idêntico ao que está em `migration_rls.sql`
  neste repositório (por exemplo, se alguém editou uma política direto
  no Supabase sem atualizar o arquivo). Recomendo, numa próxima
  oportunidade, rodar a tentativa de mutação direta (a mesma dos meus
  testes locais) contra o banco de produção mesmo, não só localmente.

**`js/design.js` — Central do Designer, duas seções novas:**
- **"Precisa de mim"**: peças atribuídas ao Designer que exigem ação
  dele agora — `aguardando_producao` (não começou), `ajustes`/
  `ajustes_cliente` (voltou pra correção), ou `briefing_desatualizado`
  (o briefing mudou sob os pés da peça, do build `-h`). Nunca inclui
  peça que já está esperando revisão/aprovação de outra pessoa. Some
  sozinha quando vazia.
- **"Continuar de onde parei"**: até 3 peças em `em_criacao` do próprio
  Designer, mais recente primeiro (por `updated_at`). Some sozinha
  quando não há nada em produção ativa.
- Nenhuma das duas cria consulta nova ao banco — as duas derivam da
  mesma lista (`design_resumo`) que a Central já carregava.

**Resumo de produção — cards de demanda e vista operacional da Linha:**
- `resumoProducao(itens)`: total de peças, contagem por formato
  ("3 Cards", "1 Carrossel", "1 Capa de Reel", "1 Stories" — plural
  correto por tipo, não é só acrescentar "s") e por status
  (finalizadas / em ajuste / em revisão / para fazer). Aparece no topo
  de `B7.Design.abrirLinha` (a vista de leitura por Linha Editorial, já
  existente desde o build `-f`).
- Os cartões de "Demandas a fazer" e "Minhas demandas" na Central
  também ganharam a contagem por formato (chips compactos), para bater
  com o "pacote de produção" que a especificação pediu.
- `abrirLinha` ganhou o selo de versão ("V01", "V02…", a partir de
  `linha_versao_confirmada`, já gravado nas peças desde o build `-h`) e
  um link **"Ver contexto da Linha Editorial"**, que leva o Designer
  para `#/linha/<id>` — a mesma Linha Editorial completa (estratégia,
  pilares, outros criativos), em leitura, porque a rota `cliente`/`linha`
  já ficam travadas em somente-leitura para o papel Designer desde o
  build `-h` (`ligarCampos`). Isso não substitui a vista operacional
  como destino principal — é um link secundário, como a especificação
  pediu explicitamente ("Ver contexto" é secundário; o primário
  continua sendo `abrirLinha`).

**O que da especificação nova eu NÃO reconstruí nem retestei nesta
rodada, porque já existia de builds anteriores e não foi tocado:** a
vista de detalhe de cada peça (Card/Carrossel/Capa de Reel/Stories,
`abrirDetalhe`), "Assumir demanda" e sua idempotência, distribuição
individual por peça, upload opcional, revisão externa sem arquivo,
Kanban, e a arquitetura de eventos/notificações. Ver os relatórios dos
builds `-d`, `-f` e `-h` para o que foi testado neles.

- `node --check` em `js/design.js`.
- Playwright (mock completo do Supabase): Central do Designer com dados
  variados (peça aguardando produção, peça em ajuste, duas em criação,
  uma finalizada, uma em revisão) mostra "Precisa de mim" com as 2
  peças certas e "Continuar de onde parei" com as 2 peças certas, na
  ordem certa; a vista operacional da linha mostra "6 peças de Design",
  os chips de formato corretos, "1 finalizada · 1 em ajuste · 1 em
  revisão · 3 para fazer" (contagem batendo com os dados do mock), selo
  "V01" e o link de contexto. Sem erro de console nos dois cenários.
- `VERSAO` → `2026-09-11-i`, cache do service worker →
  `roteiros-b7-v24`.

## Build 2026-09-11-j — Barra lateral: rótulo "Central de Design" para o Designer

**O que estava errado:** o item de topo da barra lateral (rota `#/`)
sempre mostrou o texto fixo "Central B7", vindo direto do
`index.html` (`<span>Central B7</span>`) — o mesmo rótulo genérico
para admin, coordenador e designer. O *conteúdo* por trás da rota `#/`
já era só a Central do Designer para esse papel (roteamento em
`js/app.js`, desde builds anteriores), mas o *rótulo* nunca tinha sido
adaptado — só a navegação (quais itens aparecem) é que já era
role-aware, não o texto. Resultado relatado pelo dono, numa conta de
Designer real, depois de forçar reload (Ctrl+Shift+R) várias vezes: a
Central certa aparecia, mas o menu continuava dizendo "Central B7",
parecendo que nada tinha mudado.

**Correção — `js/permissoes.js`, dentro de `aplicarNavegacao()`:**
- Depois de esconder os itens de navegação que o papel não alcança
  (comportamento já existente), quando `papel() === 'designer'` o
  `<span>` do item `[data-ir="#/"]` na barra lateral tem seu
  `textContent` trocado para **"Central de Design"**. A rota e o
  destino continuam sendo `#/` — não existe (nem foi criada) uma rota
  `#/design` separada; é só o rótulo que muda.
- `aplicarNavegacao()` já era chamada uma única vez por sessão, a
  partir de `montarShellInterno()` (`js/app.js`), antes de qualquer
  rota específica ser renderizada — local seguro para essa troca de
  texto: confirmei lendo `B7.Dashboard.marcarNav(rota)`
  (`js/dashboard.js`), chamada a cada troca de rota, que só alterna a
  classe CSS `.on` e nunca toca em `textContent` — então nada
  sobrescreve o rótulo depois.
- `node --check` em `js/permissoes.js` sem erro.
- Playwright: login mockado como Designer, navegação até `#/`,
  leitura do `textContent` do `span` do item de nav → **"Central de
  Design"**, zero erros de console. Screenshot confirma visualmente o
  item ativo da barra lateral com o novo rótulo, com "Design" e
  "Linhas editoriais" listados abaixo em "PRODUÇÃO".
- `VERSAO` → `2026-09-11-j`, cache do service worker →
  `roteiros-b7-v25`.
- Nenhuma migration nova. Arquivos alterados: `js/permissoes.js`,
  `js/auth.js`, `sw.js`.

## Build 2026-09-11-k — Linha Editorial no contexto do Designer, e gráfico de pilares com a barra "Planejado" invisível

Dois bugs reportados pelo dono com print de tela, os dois na mesma
página: um Designer abrindo "Ver contexto da Linha Editorial" (link
criado no build `-i`, dentro de `B7.Design.abrirLinha`) caía numa tela
idêntica à de um Coordenador — inclusive os botões de gestão — e o
gráfico "Pilares de conteúdo" parecia com números que não batiam com a
barra visual.

**1) A Linha Editorial, vista pelo Designer, tinha os mesmos botões de
gestão que a equipe usa.** `ligarCampos` (`js/conteudo.js`) já travava
os *campos* de texto/número/select para Designer desde o build `-h` —
mas os *botões de ação* da página (`js/linha.js`) nunca passam por
`ligarCampos`, então continuavam ativos: "+ Novo conteúdo" (em 5
lugares: capa, visão geral vazia, criativos vazio/cheio, postagens
vazio), e o menu "⋯" inteiro da capa (Duplicar para outro mês, Criar
status semanal, Concluir Linha Editorial, Enviar para Design, mudar
Status da linha, Enviar para aprovação do cliente, Liberar no portal,
Arquivar, Excluir linha editorial) — nenhuma dessas ações é do
Designer, e a maioria já era bloqueada pelo RLS do banco se clicada
(só não pelo RLS de leitura da UI). Corrigido: `js/conteudo.js` passou
a exportar `souDesignerSomenteLeitura()` (já existia internamente,
usada por `ligarCampos`); `js/linha.js` usa a mesma função para não
renderizar nenhum desses botões quando quem está vendo é o Designer —
sobra só "Baixar PDF" (leitura, sem efeito colateral). O quadro
"Enviar para aprovação" no topo da Visão geral também deixou de
mostrar o botão de envio para o Designer (`blocoStatus` recebe
`botaoEnviar: false`). A trilha de navegação (breadcrumb) no topo da
página e o rótulo "Editar pilares" também passaram a ler "Central de
Design"/"Ver pilares" para esse papel, consistente com o resto da
experiência desde o build `-j`.
- Nada mudou para quem já podia usar esses botões (admin/coordenador):
  a condição é sempre "esconder se for Designer", nunca "mostrar se
  for equipe" — outros papéis continuam exatamente como estavam.

**2) Gráfico "Pilares de conteúdo" — a barra "Planejado" estava
praticamente invisível.** Causa: `--borda-forte` (usada como cor da
barra "Planejado" em `styles/linha.css`) é `#DED9EC` no tema claro —
quase idêntica à cor do próprio trilho da barra (`--suave`, `#F4F2F9`),
então a barra cinza clara ficava indistinguível do fundo. O número
("50%", por exemplo) é o percentual planejado bruto do pilar — correto
— mas sem a barra "Planejado" visível, sobrava só a barra "Real"
(magenta) na tela, sem nenhuma referência visual do que fora
planejado, dando a impressão de gráfico quebrado/números que não
batem com a barra. **Os números em si estavam certos** (conferido:
"4 de 11 planejados" = 21 [meta de conteúdos] × 50% arredondado = 11,
batendo exatamente com o print do dono) — o problema era só de
contraste de cor. Corrigido trocando a cor da barra e da legenda
"Planejado" de `--borda-forte` para `--ink-4` (mais escura, com
contraste real contra `--suave` nos temas claro e escuro, sem
competir com o magenta da barra "Real").
- O terceiro pilar do print do dono ("Conversão — 0% — 11 de 0
  planejados") não é bug: é um pilar sem percentual definido
  (`percentual = 0`) que já tem 11 conteúdos apontando para ele — a
  barra "Planejado" fica corretamente vazia (0% de largura) e a "Real"
  cheia; o sistema já destaca isso em vermelho (`.pil-dist-l.acima`).
  Vale o dono revisar o percentual desse pilar ou realocar os
  conteúdos, mas a tela está mostrando a situação real.
- A "Distribuição por formato" (Reel/Card/Carrossel/Stories, mais
  acima na mesma tela) foi conferida e está correta — usa uma cor com
  contraste adequado (`--grad-curto`, o gradiente magenta) e a largura
  de cada barra já era proporcional ao maior valor do grupo; não
  precisou de correção.

**Testado:**
- `node --check` em `js/linha.js` e `js/conteudo.js`.
- Playwright (mock completo do Supabase), sessão de Designer abrindo
  `#/linha/l1` diretamente (o mesmo caminho de "Ver contexto da Linha
  Editorial"): trilha mostra "Central de Design" (não "Central B7"),
  nenhum "+ Novo conteúdo" na tela, nenhum menu "⋯" na capa, "Baixar
  PDF" continua presente, o item da barra lateral mostra "Central de
  Design", os campos da aba Estratégia continuam desabilitados (sem
  regressão do build `-h`). Confirmado por computação de estilo real
  do navegador: a barra "Planejado" renderiza com
  `rgb(158, 151, 181)` (`--ink-4`) contra um trilho
  `rgb(244, 242, 249)` (`--suave`) — contraste visível — com a largura
  calculada batendo exatamente com os números do print do dono (pilar
  1: barra Planejado 100%, Real 36,36% = 4 de 11; reproduzido com os
  mesmos totais do print). Zero erros de console. Screenshot conferido
  visualmente.
- `VERSAO` → `2026-09-11-k`, cache do service worker →
  `roteiros-b7-v26`.
- Nenhuma migration nova. Arquivos alterados: `js/linha.js`,
  `js/conteudo.js`, `styles/linha.css`, `js/auth.js`, `sw.js`.

## Build 2026-09-11-l — modal de conteúdo, aba "Design" e texto do pilar sem %

O dono testou o build `-k` de verdade (numa conta Designer) e mandou 4
prints com o que ainda faltava. Confirmando um por um:

**1) "a aba de design aparece a mesma coisa que a central do design"**
— a aba dentro da Linha Editorial chamava-se "Design", igual à Central
de Design (a home do Designer, builds `-j`/`-k`) — nome repetido para
duas telas diferentes (uma é a fila de trabalho pessoal do Designer;
a outra é o status das peças de uma Linha específica). Renomeada para
**"Produção"** (só o texto do botão da aba — a chave interna
`design`, usada em roteamento/dataset, não mudou, então nada mais
quebra). Vale para todos os papéis, não só Designer — o nome fazia
tão pouco sentido pra equipe quanto pra ele.

**2) "o negocio de pilar continua bugado"** — o contraste da barra
"Planejado" (corrigido no build `-k`) está correto e testado de novo
agora (print em anexo do próprio dono confirma as duas barras
visíveis). O que sobrou, e que eu não tinha notado antes: quando um
pilar não tem percentual definido (0%), o texto ficava **"11 de 0
planejados"** — lê como conta quebrada (divisão por zero), mesmo o
número estando tecnicamente certo. Trocado para **"11 conteúdos · sem
% definido"** nesse caso específico — só muda o texto quando o pilar
realmente não tem meta (`percentual = 0`); pilares com percentual
continuam mostrando "X de Y planejados" normalmente.

**3) "a aba de criativos, quando eu clico em algum criativo aparece a
mesma tela de edição quando eu edito na conta de coordenador/admin" +
"essa parte de status e visível no portal do cliente, eu ainda
consigo clicar"** — bug real, o mais importante dos quatro.
`ligarCampos` só trava os campos com `data-campo`/`data-tab`
(Título, Canal, Data, Pilar, Objetivo…), mas o modal de edição de
conteúdo (`abrirConteudo`, aberto pela aba Criativos) tem vários
controles ligados por fora desse mecanismo — o dono estava certo,
continuavam 100% funcionais para o Designer: os botões de **Status**
(Ideia/Em criação/.../Publicado), o checkbox **"Visível no portal do
cliente"**, os botões **Sim/Não** de "Necessita capa?" (Reel),
**"Excluir conteúdo"**, **"+ Adicionar slide/story"** e o "✕" de
remover cada slide/story, e **"Vincular roteiro"/"Desvincular"**.
Todos agora viram versão somente leitura para o Designer: Status
mostra um selo fixo com o valor atual (sem botões clicáveis);
"Visível no portal" vira uma linha de texto ("Não visível no portal
do cliente" / "✓ Visível no portal do cliente"), sem checkbox;
"Necessita capa?" mostra só o valor atual; "Excluir conteúdo",
"+ Adicionar slide/story", os "✕" de remover e
"Vincular"/"Desvincular roteiro" somem da tela. **"Abrir roteiro"**
continua visível (é só navegação de leitura, não grava nada).
- Mesma lógica de sempre: a condição é "esconder/travar se for
  Designer", nunca "mostrar se for equipe" — admin e coordenador
  continuam exatamente como estavam, editando normalmente.
- Essa era a lacuna mais séria das quatro: mesmo com o RLS do banco
  barrando a escrita de verdade (testado desde o build `-h`), a UI
  deixava a pessoa preencher um formulário inteiro achando que
  editou, pra só descobrir depois — ou nunca — que nada foi salvo.
  Agora ela nem vê os controles que não pode usar.

**Testado:**
- `node --check` em `js/linha.js`.
- Playwright (mock completo do Supabase), sessão de Designer: aba
  renomeada confirmada (`['Visão geral', 'Estratégia', 'Criativos',
  'Postagens', 'Produção']`); abrindo um Carrossel pela aba
  Criativos — nenhum "Excluir conteúdo", nenhum "+ Adicionar slide",
  nenhum "✕" de remover slide, nenhum checkbox de portal, nenhum
  botão de Status clicável; Status mostra o selo "Ideia" (texto
  correto, sem classe de link/clique); o campo do portal mostra "Não
  visível no portal do cliente" como texto simples. Na aba
  Estratégia, o pilar sem percentual mostra "1 conteúdo · sem %
  definido" e o pilar com 50% continua mostrando "1 de 11
  planejados" normalmente. Zero erros de console. Screenshot do
  modal conferido visualmente.
- `VERSAO` → `2026-09-11-l`, cache do service worker →
  `roteiros-b7-v27`.
- Nenhuma migration nova. Arquivo alterado: `js/linha.js` (e
  `js/auth.js`/`sw.js` para a versão).

## Build 2026-09-11-m — primeira rodada da especificação "B7 Design UX/Operational Refinement"

O dono mandou uma especificação de 56 seções pedindo um redesenho
grande da experiência de Design (nova Central, navegador de peças,
workspace de peça em tela cheia, carrossel interativo, thumbnails,
Linha Editorial Operacional como componente separado, etc.) mais uma
auditoria real do "bug de pilar" e da autorização do Designer.

**Esta rodada não fez o redesenho visual completo — isso é grande
demais para uma passada só.** Fiz a auditoria pedida nas seções 1, 10,
25, 29-35 e 53-54 (a parte de dados/segurança, que é a mais arriscada
de deixar para depois) e implementei o que já estava totalmente
resolvido pela auditoria, sem depender do redesenho visual maior. Ver
`RELATORIO_2026-09-11-m_AUDITORIA_UX_DESIGN.md` para o relatório
completo nas quatro categorias pedidas.

- **Auditoria do "bug de pilar" (§31-35, §54):** relação
  `conteudos.pilar_id → pilares.id` é por UUID estável, não por índice
  de array nem por nome. Não existe reordenação de pilares na
  interface (só slides/stories têm arrastar-e-soltar); duplicar linha
  mapeia `pilar_id` antigo → novo corretamente
  (`mapaPilar[pl.id] = novoP.id`); criar/excluir pilar usa
  `L.pilares.push`/`filter` sobre o estado real, sem cache
  desatualizado. **Não encontrei bug de relação de dados** — o que os
  prints mostravam nos builds `-k`/`-l` era só contraste de cor e texto
  confuso ("de 0 planejados"), ambos já corrigidos. Reportando isso
  honestamente porque a especificação pediu explicitamente para não
  esconder o sintoma sem achar a causa real — e a causa real é que não
  havia causa: os dados sempre estiveram certos.
- **Cartão de pilar do Designer virou um componente de leitura de
  verdade (§29), não mais o mesmo formulário com campos
  desabilitados:** `cardPilarLeitura` — nome, percentual e funil como
  texto/selo, objetivo e observações só aparecem quando preenchidos
  (nada de seção vazia), sem `<input>`/`<select>` nenhum no HTML. **"+
  ADICIONAR PILAR" e "✕ remover pilar" não existem mais no DOM** para
  o Designer (antes apareciam sempre, mesmo que o clique fosse barrado
  pelo banco — exatamente o tipo de furo que a especificação pediu
  para fechar). Admin/coordenador continuam com o cartão editável de
  sempre.
- **Barra do topo do Designer (§8):** "Nova gravação" não aparece mais
  para esse papel, e a busca global mostra "Buscar cliente, linha
  editorial ou peça…" em vez de "…gravação ou roteiro…". Implementado
  em `montarShellInterno` (`js/app.js`) — não em `aplicarNavegacao`
  (`js/permissoes.js`), porque a barra do topo é reconstruída do zero
  a cada montagem do shell (a nav lateral, não: só monta uma vez), e
  colocar ali garante que o ajuste nunca "volta" numa remontagem.
  Admin/coordenador não mudam.
- **Autorização de verdade (§30/§53):** re-confirmo o que já estava
  testado desde o build `-h` — tentativa direta de `UPDATE`/`INSERT`
  como Designer contra `linhas_editoriais`/`conteudos`/`pilares` é
  bloqueada pelo RLS que já está ativo em produção (auditado no build
  `-i` com consultas reais do dono no SQL Editor). Não toquei em
  nenhuma política nesta rodada — nada mudou no banco.

**O que NÃO foi feito nesta rodada** (a maior parte da especificação —
ver o relatório para a lista completa com justificativa): a Central de
Design não foi redesenhada visualmente (as seções "Precisa de mim" /
"Continuar de onde parei" já existem desde o build `-i`, mas não
ganharam o tratamento visual "premium" pedido agora); a página Design
(navegador) não foi redesenhada; não existe ainda um "Design Piece
Workspace" em tela cheia/rota dedicada — o modal de peça continua
sendo o mesmo, só que somente-leitura pra Designer; carrossel/stories
não ganharam navegador de slide interativo; não há geração de
thumbnails; a Linha Editorial Operacional continua sendo o mesmo
componente `js/linha.js` com ramos condicionais por papel, não um
componente `js/linha-operacional.js` separado como a especificação
pede na arquitetura; não houve auditoria de notificações, performance
nem responsividade nesta rodada.

**Testado:**
- `node --check` em `js/linha.js`, `js/app.js`.
- Playwright: Designer sem "Nova gravação" no topo, placeholder de
  busca trocado, sem "+ Adicionar Pilar"/"✕ remover pilar", sem
  `<input>` nenhum dentro do cartão de pilar, pilar sem objetivo/
  observações não mostra seção vazia. Coordenador (mesmo teste, outra
  sessão): "Nova gravação" presente, placeholder original, "+
  Adicionar Pilar" presente, inputs editáveis presentes — nada
  regrediu para quem já podia editar. Zero erros de console nos dois
  casos. Screenshot conferido visualmente.
- `VERSAO` → `2026-09-11-m`, cache do service worker →
  `roteiros-b7-v28`.
- Nenhuma migration nova. Arquivos alterados: `js/linha.js`,
  `js/app.js`, `styles/linha.css`, `js/auth.js`, `sw.js`.

## Build 2026-09-11-n — Rodada 1 do refino de UX do Design: Central de Design

Primeira das seis rodadas planejadas em `PLANO_UX_DESIGN_RESTANTE.md`
(seções 2-7 da especificação "B7 Design UX / Operational Editorial
Refinement").

**Causa real do problema relatado ("a aba Design aparece a mesma coisa
que a Central de Design"):** a rota `#/` do Designer chamava
`B7.Design.abrir(aba, true)` — a mesma função da rota `#/design`, com
um único parâmetro que só trocava o item marcado na navegação e o
título da aba. As duas telas eram, literalmente, o mesmo HTML. Não era
um bug de estilo: era uma tela só com dois nomes.

**O que mudou:**
- `js/design.js` ganhou `abrirCentral()` / `desenharCentral()` — uma
  tela própria para a rota `#/` do Designer, montada a partir da mesma
  consulta única `design_resumo` que o navegador já usava (nenhuma
  consulta nova, nenhum número inventado):
  - Cabeçalho pessoal com saudação por horário ("Bom dia, Mateus.") e
    uma frase de estado que muda conforme a fila: "4 peças precisam da
    sua atenção." / "Nada pendente de ajuste. Continue de onde parou."
    / "Há demandas disponíveis para assumir." / "Tudo em dia." / fila
    vazia.
  - Quatro números reais (precisam de mim · em criação · esperando
    revisão · disponíveis para assumir) que rolam até a seção
    correspondente; número zero fica desabilitado, não some.
  - **"Precisa de mim"** virou uma fila de linhas com o MOTIVO antes do
    título — "Ajuste solicitado", "Ajuste do cliente", "Briefing
    atualizado", "Para começar" — mais formato · cliente · linha ·
    versão e o prazo real (atrasado/vence hoje em destaque). Ordenada
    por urgência. O Designer sabe o tipo de ação sem abrir a peça.
  - **"Continuar de onde parei"**: até 3 peças em criação, mais recente
    primeiro — e uma peça nunca aparece duas vezes (se já está em
    "Precisa de mim", não repete aqui).
  - **"Minhas linhas em produção"** como pacote por Linha Editorial:
    cliente em caixa alta, nome da linha com selo de versão confirmada
    (V01, V02…), porcentagem = finalizadas ÷ total (dado real), barra
    de progresso, quebra por estado ("1 para fazer · 2 em criação · 2
    em ajuste · 1 em revisão"), contagem por formato, próximo prazo
    real e "Abrir produção →" para a vista operacional da linha
    (`#/design/linha/<id>`). Linha 100% finalizada aparece por último,
    esmaecida e marcada "Concluída".
  - **"Demandas disponíveis"** como linhas densas (linha · cliente · N
    peças · prazo mais próximo · formatos · botão "Assumir"), sem os
    cartões com espaço em branco de antes.
  - Estado vazio honesto quando não há peça nenhuma na fila.
- A rota `#/design` do Designer passou a ser só o NAVEGADOR da fila
  (busca, filtros, "Demandas a fazer" e "Minhas demandas" por linha) —
  as seções "Precisa de mim"/"Continuar de onde parei" saíram dela,
  porque agora moram na Central. O subtítulo aponta para a Central. O
  redesenho visual maior dessa página é a Rodada 2.
- `js/app.js`: rota `#/` do Designer → `B7.Design.abrirCentral()`.
- Realtime e ações da gaveta (assumir, enviar para revisão, salvar
  prazo etc.) agora redesenham a tela que estiver montada — Central
  ou navegador — via `redesenharTela()`. Antes, `desenharArea()` era
  no-op fora do navegador.
- Correção de passagem: `abrirDetalhe()` só remontava a fila por trás
  da gaveta quando não achava `#ds-area` — o que trocava a Central (e
  a vista por linha) pela página Design ao abrir uma peça. Agora
  verifica `.design-tela` (qualquer tela de Design) e a gaveta abre
  por cima da tela atual.
- `styles/design.css`: bloco `.dsc-*` novo (cabeçalho, números, fila
  "Precisa de mim", pacote de linha, linhas de demanda disponível),
  com regras para ≤900px e ≤760px. Só tokens já existentes do sistema.

**Não feito nesta rodada (de propósito):** miniaturas otimizadas
(Rodada 5 — a Central usa as prévias que já existem, carregadas sob
demanda como antes); redesenho da página Design/navegador (Rodada 2);
workspace de peça (Rodadas 3-4).

**Testado:**
- Playwright com Supabase simulado, sessão Designer, 12 peças em 3
  linhas/3 clientes (ajuste interno, ajuste do cliente, para começar,
  briefing atualizado, em criação, finalizada, em revisão, 2
  disponíveis sem responsável, 1 peça de OUTRO designer): a peça de
  outro designer não aparece em lugar nenhum; os quatro números batem
  com os dados (4 · 2 · 1 · 2); motivos e prazos corretos ("Atrasado
  há 1 dia", "Vence hoje"); linha 1 de 7 = 14%, linha 2 de 2 = 100% e
  "Concluída"; clicar numa peça abre a gaveta e a Central continua
  atrás; clicar num pacote de linha leva a `#/design/linha/l1`; fila
  vazia mostra o estado vazio sem erro. Desktop 1280px, celular 390px
  e tema escuro conferidos por screenshot. `#/design` do Designer não
  repete mais as seções da Central. Coordenador em `#/design` e `#/`
  sem regressão. Zero erros de console em todos os casos.
- `VERSAO` → `2026-09-11-n`, cache do service worker → `roteiros-b7-v29`.
- Nenhuma migration nova. Arquivos alterados: `js/design.js`,
  `js/app.js`, `styles/design.css`, `js/auth.js`, `sw.js`.

## Build 2026-09-11-o — Rodada 2 do refino de UX do Design: navegador + página de demanda

Segunda das seis rodadas de `PLANO_UX_DESIGN_RESTANTE.md` (seções
9-13 e 43 da especificação).

**O que mudou:**
- **Navegador do Designer (`#/design`) mais denso.** "Demandas a
  fazer" e "Minhas demandas" passaram a usar os mesmos componentes
  ricos da Central (`linhaDisponivel`/`pacoteLinha`, de `js/design.js`)
  em vez do cartão antigo (`ds-grupo-card`), que só mostrava contagem
  simples. Agora cada linha mostra progresso real (%), quebra por
  estado, formatos e prazo — a mesma linguagem visual em toda a
  experiência do Designer, não duas versões parecidas. Os cartões de
  peça individuais que apareciam soltos dentro de cada grupo saíram
  daqui: o detalhe peça a peça agora é sempre a página de demanda.
- **Página de demanda (`#/design/linha/:id`) como projeto de
  verdade.** Cabeçalho reformulado: cliente, nome da linha, selo de
  versão confirmada e a porcentagem real de conclusão em destaque
  (`finalizadas ÷ total`) com barra de progresso logo abaixo — não é
  mais um texto corrido "produção de Design desta linha (leitura)".
  Progresso por formato deixou de ser só contagem ("4 Cards") e virou
  fração real ("2/5 Cards, 1/2 Capas de Reel…"), com o chip marcado
  quando o formato está 100% pronto.
- **Abas por estado dentro da demanda**: Todas / Para fazer / Em
  criação / Ajustes / Revisão / Finalizadas, cada uma com a contagem
  real. Filtragem no cliente, sem nova consulta — a página busca as
  peças da linha uma vez e as abas só recortam o que já está em
  memória.
- Realtime e ações (assumir, gaveta) agora atualizam a página de
  demanda no lugar, sem perder a aba selecionada nem esperar uma nova
  consulta completa: `agendarReleitura` mantém um cache próprio da
  linha aberta (`itensLinha`), sincronizado peça a peça.
- Correção de responsividade encontrada no teste: o botão "Ver
  contexto da Linha Editorial…" estourava a largura da tela em
  celular (herdava `white-space:nowrap` do botão padrão do sistema).
  Corrigido para quebrar linha e ocupar a largura total abaixo de
  760px.

**Não mudou nesta rodada:** a barra de filtros do navegador do
Designer continua só busca + tipo + prazo (o status agora vive nas
abas da página de demanda, então não duplicamos o filtro); o quadro/
lista da equipe (coordenação) não foi tocado — a especificação, e a
auditoria da rodada `-m`, sempre trataram esse redesenho como algo do
lado do Designer.

**Testado:**
- Playwright com Supabase simulado: 10 peças numa linha (todos os
  estados representados, incluindo uma peça de OUTRO designer) mais
  uma linha de outro cliente sem responsável. Navegador do Designer:
  "Minhas demandas" mostra só as peças do próprio designer (8 de 9 —
  a peça do outro designer fica de fora, como sempre); clicar na linha
  leva à página de demanda. Página de demanda: cabeçalho com 33% e "3
  de 9 finalizadas" batendo com os dados; chips "2/5 Cards, 1/2 Capas
  de Reel, 0/1 Carrosséis, 0/1 Stories" corretos; abas com contagem
  certa (Ajustes 3, Finalizadas 3…) e filtragem correta ao clicar;
  abrir peça a partir da demanda abre a gaveta por cima da página
  (não troca de tela); "Voltar ao Design" retorna ao navegador. Nota:
  a página de demanda mostra a produção da linha INTEIRA (qualquer
  designer), não só a do usuário — comportamento herdado de antes
  desta rodada, mantido de propósito (é a vista de "o que está
  acontecendo nesta linha", não a fila pessoal). Desktop 1280px e
  celular 390px conferidos por screenshot; bug de responsividade
  encontrado e corrigido (botão de contexto). Coordenador em `#/design`
  (quadro, lista, equipe) sem regressão. Zero erros de console em
  todos os casos.
- `VERSAO` → `2026-09-11-o`, cache do service worker →
  `roteiros-b7-v30`.
- Nenhuma migration nova. Arquivos alterados: `js/design.js`,
  `styles/design.css`, `js/auth.js`, `sw.js`.

## Build 2026-09-11-p — Redesenho da página "Design" (navegador de produção): cartões de projeto, hierarquia cliente-primeiro, filtro rápido e modo "Peças"

Trabalho intermediário pedido antes da Rodada 3, a partir de uma
especificação própria de 43 seções ("Redesign da página Design —
visual production browser") motivada por screenshots reais da tela
em produção: uma faixa fina de 100% de largura sobre um espaço vazio
enorme, sem hierarquia de cliente, sem prévia visual. Esta rodada é
puramente de UX/IA/visual/responsivo — nenhuma regra de negócio foi
tocada (assumir demanda, atribuição, status, Kanban, notificações,
upload, revisão e aprovação continuam exatamente como estavam).

**O que mudou:**
- **Distinção Central vs. Design reforçada.** O título dentro da
  página passou a ser "Produção de Design" (o item "Design" na
  barra lateral não muda), com subtítulo "Acompanhe as linhas
  editoriais e peças em produção." — deixando claro que esta é a
  vista ampla de produção, não a home pessoal (Central de Design,
  intacta desde a Rodada 1).
- **Faixa fina de 100% de largura removida.** No lugar, uma grade
  responsiva de cartões de projeto (`.cp-grade`, `auto-fill,
  minmax(300px,1fr)`, `max-width:400px` por cartão) — nunca mais um
  único projeto esticado ocupando a tela inteira.
- **Cartão de projeto com hierarquia invertida**: identidade do
  cliente (logo real quando `clientes.logo_url` existe, iniciais
  como aviso quando não existe — nunca o avatar do usuário fazendo
  as vezes de marca) vem primeiro; linha editorial e versão
  confirmada viram metadado secundário logo abaixo. Antes, o mês da
  linha tinha mais peso visual que o cliente — invertido conforme a
  especificação.
- **Prévias reais em miniatura** (até 3 por cartão, reaproveitando o
  mesmo mecanismo de thumbnail assinado e lazy-load que já existia
  nos cartões de peça — `ligarThumbs`/`IntersectionObserver`) e
  **quebra por formato com ícone** (reaproveita `iconeTipo`, os
  mesmos SVGs já usados no sistema — nenhum emoji novo).
- **Progresso real de Design** (finalizadas ÷ total, igual à Central,
  nunca o status editorial) com estado por etapa (para fazer, em
  criação, ajustes em destaque, revisão) e ação primária por
  contexto: "Assumir demanda" nas disponíveis, "Continuar produção"
  nas próprias — nunca mais de duas ações por cartão.
- **Barra de resumo rápida no topo** ("N disponíveis · N comigo · N
  em ajustes · N em revisão"), cada item também funciona como filtro
  de um clique (liga/desliga) sem tocar na barra de filtros
  completa. Itens com contagem zero em "ajustes"/"revisão" somem —
  só "disponíveis" e "comigo" aparecem sempre, porque moldam a
  leitura da tela.
- **Modo "Linhas editoriais" / "Peças"** (o mesmo componente visual
  de segmento que a equipe já usa em Quadro/Lista): "Linhas
  editoriais" é o padrão e mostra os cartões de projeto; "Peças"
  lista cada peça individualmente reaproveitando o cartão de peça já
  existente no quadro/lista da equipe — útil para achar uma peça
  específica sem abrir a linha. Preferência de modo persiste em
  `sessionStorage` (`b7.design.filtros`), igual às demais telas.
  Nenhuma consulta nova: os dois modos usam a mesma leitura de
  `design_resumo`.
- **Filtro por Cliente** adicionado à barra do Designer (some quando
  só há um cliente nas peças visíveis — não vale a pena mostrar um
  filtro de uma opção só) e o **filtro por Status**, que antes só
  existia para a equipe, passou a existir também para o Designer.
  "Limpar filtros" agora zera o filtro rápido junto.
- **"Minhas demandas" vazio ficou compacto**: uma linha de texto
  ("Você ainda não tem demandas atribuídas.") em vez do antigo
  retângulo tracejado grande.
- **Ordem das seções**: se o Designer não tem nada assumido ainda, a
  seção "Demandas disponíveis" aparece primeiro — não força uma
  seção pessoal vazia acima de conteúdo útil.
- **Nova coluna `cliente_logo_url`** em `design_resumo`
  (`migration_design_logo.sql`) — a view já fazia join com
  `clientes`, só faltava selecionar a coluna; nenhuma consulta nova,
  nenhuma tabela duplicada.

**Não mudou nesta rodada:** nenhuma regra de negócio; a página de
demanda (`#/design/linha/:id`, Rodada 2) e a Central (`#/`, Rodada 1)
continuam como estavam — só o botão "Voltar ao Design" delas agora
retorna para o navegador redesenhado. O quadro/lista/equipe da
coordenação não foi tocado (fora do escopo, igual à Rodada 2).

**Testado com confiança (Playwright, Supabase simulado):**
- Fixture com 12 peças cobrindo duas linhas de dois clientes
  diferentes (um com `cliente_logo_url` preenchido, outro sem), uma
  peça sem responsável e uma peça de outro designer (canário de
  vazamento). Sessões de Designer e Coordenador.
- Navegador do Designer: cartões de projeto renderizam com dados
  corretos (cliente, linha, versão, progresso, quebra por formato,
  quebra por estado, prazo atrasado destacado); peça de outro
  designer nunca aparece em nenhum modo.
- Barra de resumo rápido: contagem "1 disponível · 10 comigo · 2 em
  ajustes · 1 em revisão" batendo com os dados; clicar em "Ajustes"
  estreita para 1 cartão de projeto (a única linha com peça em
  ajuste) e liga o estado visual do botão; clicar de novo desliga
  corretamente; "Disponível" e "Comigo" isolam cada seção como
  esperado.
- Avatar de cliente: cliente com `cliente_logo_url` mostra `<img>`
  real; cliente sem logo mostra iniciais.
- Modo "Peças": lista as 11 peças visíveis ao Designer (10 próprias +
  1 disponível), nunca a do outro designer; busca por "Studio"
  estreita para as 2 peças certas; clicar numa peça abre a gaveta
  (Design Piece Workspace), nunca um editor diferente; alternar de
  volta para "Linhas editoriais" funciona.
- Responsivo: telas de 1440px, 1024px (laptop), 820px (tablet) e
  390px (celular) — sem overflow horizontal em nenhuma largura; grade
  reflui de 3 colunas (desktop) para 2 (tablet) para 1 (celular),
  conferido tanto por screenshot quanto por `gridTemplateColumns`
  computado.
- Tema escuro: página renderiza sem erros de console (verificação de
  ausência de erro; não houve inspeção visual pixel a pixel de
  contraste).
- Central de Design (`#/`, Rodada 1) e página de demanda (`#/design/
  linha/:id`, Rodada 2): regressão conferida após as mudanças no
  navegador — cabeçalho, linhas em produção, disponíveis e ausência
  de vazamento entre designers continuam corretos. Zero erros de
  console em todos os cenários.
- `VERSAO` → `2026-09-11-p`, cache do service worker →
  `roteiros-b7-v31`.

**Requer validação adicional (não testado nesta rodada):**
- `migration_design_logo.sql` não foi rodada contra nenhum banco real
  — a renderização do `<img>` do logo foi validada só com uma URL
  simulada (Playwright interceptando a resposta), não com o Storage
  do Supabase de verdade nem com uma foto de cliente real.
- Contraste e legibilidade do tema escuro não foram inspecionados
  visualmente (só confirmada a ausência de erro de JS/CSS quebrado).
- Navegação por teclado (Tab/Enter) nos cartões de projeto não foi
  testada com Playwright nesta rodada — o cartão tem
  `tabindex="0" role="button"` e os manipuladores de teclado do
  `ligarCentral` (reaproveitados sem alteração desde a Rodada 1), mas
  não houve teste automatizado de foco especificamente para o novo
  layout.
- Teste em dispositivo físico não foi realizado — toda a validação
  responsiva foi feita por emulação de viewport no Chromium.

**Não implementado por decisão consciente:**
- Design Piece Workspace, carrossel interativo dedicado e Linha
  Editorial Operacional separada continuam fora do escopo — são a
  Rodada 3 do plano original (`PLANO_UX_DESIGN_RESTANTE.md`).

Arquivos alterados: `js/design.js`, `styles/design.css`,
`js/auth.js`, `sw.js`, `migration_design_logo.sql` (novo, não
aplicada em nenhum banco ainda).

## Build 2026-09-11-q — Responsável visível no card da peça, e "compartilhar" uma peça disponível com um colega da mesma linha

Pedido direto do Yury: quando alguém assume uma peça (mesmo só uma
peça, não a linha inteira), isso precisa aparecer pros outros
designers — e o designer que já está numa linha precisa poder passar
uma peça ainda sem dono pra um colega específico, sem depender da
coordenação.

**O que mudou:**
- **Nome do responsável, como texto, no card da peça** (`cartao()`,
  usado no modo "Peças" do navegador, na página de demanda e na
  Central). Antes só existia o avatar com iniciais (o nome só
  aparecia no `title` do HTML, ou seja, invisível até passar o mouse).
  Agora o primeiro nome aparece escrito ao lado do avatar; quando não
  há responsável, o card mostra o texto "Sem responsável" em vez de um
  quadradinho tracejado sem explicação.
- **"Compartilhar" uma peça disponível com um colega.** Na gaveta de
  uma peça sem responsável, se o Designer logado já produz outra peça
  da MESMA linha editorial, aparece — junto do já existente "Assumir
  esta peça" — uma opção "Ou atribuir a um colega desta linha": um
  seletor com os outros designers e um botão "Compartilhar". Ao
  confirmar, a peça é atribuída direto ao colega escolhido (mesmo
  fluxo de `design_atribuir`, sem passar pela coordenação). Só
  aparece quando faz sentido: peça sem dono, linha em que eu já tenho
  peça, e existe pelo menos outro designer pra quem compartilhar.
- **Migration nova (`migration_design_compartilhar.sql`)**: amplia a
  permissão de `design_atribuir` pra aceitar esse terceiro caso
  (designer atribuindo a um colega dentro da própria linha), mantendo
  intactas as duas permissões que já existiam (equipe atribui livre;
  designer só auto-atribui peça sem dono).
- **Correção de RLS encontrada durante a investigação (não é uma
  regressão desta rodada — é uma lacuna que já existia)**: a política
  de leitura de `public.perfis` só deixava cada um ler o próprio
  perfil (equipe lia todos). Como `design_resumo` faz join com
  `perfis` e é `security_invoker=true`, esse join respeita a RLS de
  quem chama — ou seja, em produção, um Designer olhando uma peça de
  OUTRO designer provavelmente recebia `designer_nome` nulo (mascarado
  sem querer como "Sem responsável", justamente o problema que o Yury
  reportou). A política foi ampliada para qualquer funcionário interno
  (admin/coordenador/designer) poder ler o perfil básico de outro
  funcionário interno — nunca o de um cliente, que continua visível só
  pra equipe ou pro próprio cliente. **Essa é a correção mais
  importante desta rodada**: sem ela, o nome do responsável continuaria
  sumindo pra outros designers mesmo com o texto novo no card.

**Não mudou:** uma peça continua tendo só UM responsável por vez —
"compartilhar" é uma forma mais rápida de ATRIBUIR (transferir a
responsabilidade), não duas pessoas responsáveis pela mesma peça ao
mesmo tempo. Isso foi confirmado com o Yury antes de implementar,
porque a alternativa (co-responsabilidade) exigiria uma tabela nova.

**Testado com confiança (Playwright, Supabase simulado):**
- Card da peça mostra o primeiro nome do responsável como texto
  (ex.: "Mateus") quando há responsável, e "Sem responsável" por
  extenso quando não há.
- Gaveta de uma peça sem dono, numa linha onde o Designer logado já
  tem outra peça seguindo: mostra "Assumir esta peça" E "Compartilhar"
  com a lista de colegas (excluindo o próprio usuário).
- Escolher um colega e clicar "Compartilhar" chama `design_atribuir`
  com o id da peça e do colega certos; a gaveta atualiza mostrando o
  colega como novo responsável.
- Gaveta de uma peça sem dono numa linha onde o Designer logado NÃO
  tem nenhuma peça: mostra "Assumir esta peça" mas NÃO mostra
  "Compartilhar" — confirmando que a opção só aparece quando faz
  sentido.
- Reconferida toda a suíte de regressão das rodadas anteriores (navegador,
  filtro rápido, modo Peças, responsivo em 4 larguras, tema escuro,
  Central de Design) depois de tornar `listarDesigners()` uma consulta
  sempre feita (antes só rodava pra equipe) — sem regressão, zero
  erros de console em todos os cenários.
- `VERSAO` → `2026-09-11-q`, cache do service worker →
  `roteiros-b7-v32`.

**Requer validação adicional:**
- `migration_design_compartilhar.sql` (incluindo a mudança de RLS de
  `perfis`) ainda não foi rodada em nenhum banco real — os testes
  usaram Supabase simulado, então a correção da política de RLS não
  foi validada contra o Postgres de verdade, só o comportamento do
  front-end perante a resposta esperada.

Arquivos alterados: `js/design.js`, `styles/design.css`, `js/auth.js`,
`sw.js`, `migration_design_compartilhar.sql` (novo, não aplicada em
nenhum banco ainda).

### Correção — `migration_design_logo.sql` (build -p) não rodava

Ao tentar aplicar, o Supabase recusava com `42P16: cannot change name
of view column "linha_id" to "cliente_logo_url"`. A coluna nova
(`cliente_logo_url`) tinha sido inserida no MEIO da lista do
`select`, logo depois de `cliente_nome` — isso empurra a posição de
todas as colunas seguintes, e o Postgres não permite que
`CREATE OR REPLACE VIEW` mude o nome ou a posição de uma coluna já
existente (só permite acrescentar coluna nova no fim). Corrigido
movendo `cliente_logo_url` para o final da lista — não afeta nada no
front-end, que já lê a coluna pelo nome, nunca pela posição. Rode a
versão corrigida de `migration_design_logo.sql` (deste mesmo build)
no lugar da anterior.

## Build 2026-09-11-r — "Linhas editoriais" (listagem geral) vira tela operacional pro Design

Pedido do Yury: a tela "Linhas editoriais" (menu lateral, fora do
"Design") estava idêntica pra Admin, Coordenação e Design — qualquer
um podia criar linha nova e via "Clientes sem planejamento" pra
começar o planejamento de qualquer cliente. Isso é trabalho de
estratégia/conteúdo, não de produção visual — o Design só precisa
navegar pra ver o contexto de uma linha (já faz isso pelo botão "Ver
contexto" dentro da página de demanda), nunca criar planejamento novo.

**O que mudou:**
- **"Linhas editoriais" (visão global, `#/linhas`)**: pro Design, some
  o botão "+ Nova linha editorial" e some inteira a seção "Clientes
  sem planejamento" (que é só pra criar linha pra quem ainda não tem).
  A lista das linhas já existentes continua aparecendo — o Design
  ainda pode abrir qualquer uma pra ver o contexto — só não cria.
  Quando não há nenhuma linha ainda, o texto do estado vazio muda de
  "Escolha um cliente e comece o planejamento" (convite a criar) pra
  "Nenhum planejamento foi criado ainda" (neutro, sem convite a ação
  que ele não pode fazer).
- **"Linhas editoriais" de um cliente específico (`#/cliente/:id/
  linhas`)**: mesma lógica — "+ Nova linha editorial" some pro Design,
  texto do estado vazio fica neutro.
- Reaproveitado o mesmo guard `souDesignerSomenteLeitura()` que já
  existia desde uma rodada anterior e já deixava a EDIÇÃO de uma linha
  específica (`#/linha/:id`) somente leitura pro Design — esta rodada
  só estendia esse mesmo padrão pras duas telas de LISTAGEM, que
  tinham ficado de fora.
- Nenhuma migration, nenhuma mudança de RLS: é puramente front-end
  (esconder botão/seção conforme o papel) — a mesma proteção de
  sempre (RLS + funções do banco) já impedia qualquer criação real
  vinda de fora da tela.

**Testado com confiança (Playwright, Supabase simulado):**
- Sessão de Designer em `#/linhas`: sem "+ Nova linha editorial", sem
  seção "Clientes sem planejamento", lista de linhas existentes
  continua visível e clicável. Sessão de Coordenador na mesma tela:
  tudo igual a antes (botão e seção presentes) — sem regressão.
  Zero erros de console nos dois casos.

**Requer validação adicional:**
- Não testei a variante por cliente (`#/cliente/:id/linhas`) com
  Playwright nesta rodada — a mudança é estruturalmente idêntica à da
  visão global e usa o mesmo guard já testado em outras telas, mas não
  houve teste automatizado específico pra essa rota.

Arquivos alterados: `js/conteudo.js`, `js/auth.js`, `sw.js`.
`VERSAO` → `2026-09-11-r`, cache do service worker →
`roteiros-b7-v33`.

## Build 2026-09-11-s — STATUS SEMANAL 2.0: renderizador de uma página só, densidade adaptativa, dois sistemas de cor

Redesenho grande do Status Semanal voltado ao cliente (não é o mesmo
módulo do Design das rodadas anteriores) — pedido do Yury antes da
Rodada 3 do plano de Design, a partir de uma especificação de 42 seções
em inglês. Regra inegociável do pedido: o relatório cabe SEMPRE numa
página só (nunca gera página 2, nunca mostra "01/02"), nunca resolve
isso encolhendo o texto até ficar ilegível, mostra só o que vai
acontecer na semana (trabalho concluído/publicado/cancelado nunca
aparece pro cliente, mas nunca é apagado do banco), e tipo de atividade
e status da tarefa usam dois sistemas de cor semânticos bem distintos.

**`js/doc-semana.js` (reescrito):**
- `TIPOS` (8 tokens de cor pra tipo de atividade — rótulo de texto
  pequeno, nunca em pílula) e `SITUACOES` (10 tokens — cor + fundo +
  texto de legenda — pra status da tarefa, sempre em pílula forte com
  ponto colorido). Título + pílula de status são os dois elementos mais
  fortes de cada linha; tipo/canal ficam abaixo, discretos.
- `EXCLUIR_DO_PLANEJAMENTO = ['Concluído', 'Publicado', 'Cancelado']`
  filtrado logo no início de `montar()` — só na peça pro cliente. O
  editor (`js/semana.js`) não usa esse filtro em lugar nenhum: continua
  mostrando tudo, sempre (confirmado lendo o código, não só assumido).
- Cabeçalho e faixa do cliente sempre compactos, fora da escada de
  densidade — a faixa do cliente ganhou o rótulo "LINHA EDITORIAL"
  acima do nome da linha (antes o nome aparecia sozinho, em caixa alta
  pequena, sem dizer o que era).
- **Algoritmo de densidade adaptativa, substituindo inteiramente a
  paginação múltipla antiga**: mede de verdade a altura do corpo num
  elemento escondido fora da tela, tentando 4 níveis (confortável →
  compacta → densa → muito densa, como classes CSS numa escada de
  custom properties) numa coluna só; se nada couber, tenta um fallback
  de duas colunas (um dia nunca é dividido entre as duas), testando
  vários pontos de corte — não só o "melhor" por peso estimado, mas
  medindo de verdade cada candidato — nos 4 níveis de novo; se mesmo
  assim nada couber (semana excepcionalmente cheia), usa a combinação
  medida como a que MENOS estourou, nunca a primeira que apareceu.
  Nunca produz uma segunda página, sob nenhuma circunstância.
- **Bug real encontrado e corrigido durante o teste** (não é só um
  ajuste — mudou o resultado): a classe `duas-colunas` estava sendo
  aplicada no elemento errado (`.pag45` em vez de `.ps-corpo`, que é
  onde o CSS realmente espera), então o fallback de duas colunas nunca
  virava duas colunas de verdade — as colunas ficavam empilhadas uma
  embaixo da outra sem limite de altura, e a medição (que dependia
  desse limite) sempre "passava" por engano. Corrigido.
- **Segundo bug real, mais sutil**: a medição roda de forma síncrona,
  mas as fontes do sistema (`Inter`/`Archivo`) usam
  `font-display:swap` — se a medição rodar antes da fonte trocar do
  fallback pra fonte real, o texto pode crescer depois, estourando uma
  página que "coube" na hora de medir. `B7.BaixarSemana.preparar()`
  (usado por PNG e PDF) e `desenharPreview()` (usado pelo editor)
  agora esperam `document.fonts.ready` antes de montar/medir — sem
  isso, o resultado visto na tela podia ser diferente do medido,
  dependendo de quão rápido a fonte carregasse.
- `B7.BaixarSemana.gerarPNG`/`gerarPDF` simplificados pra sempre um
  canvas/uma página (removida a função `montarZip`, morta desde que
  não existe mais PNG multi-página como ZIP).

**`styles/semana.css`:** bloco `.pag45` reescrito com escada de
densidade via custom properties (`--corpo-pad`, `--dia-*`, `--item-*`,
`--pill-*`, `--tipo-*`, `--leg-*`…), três classes de override
(`.nv-compacta`/`.nv-densa`/`.nv-muito-densa`). Novo `.ps-item-topo`
(título + pílula), `.ps-meta` (tipo + canal), `.ps-obs` (observação
com `-webkit-line-clamp:2`), legenda em duas linhas horizontais
compactas (TIPOS/STATUS, só os valores realmente usados na semana).
**Correção crítica de medição**: `.ps-corpo{display:flex;
flex-direction:column}` sem `flex-shrink:0` nos filhos deixa o
flexbox encolher o conteúdo pra caber em vez de estourar — o que
quebra qualquer técnica de medição por `scrollHeight > clientHeight`
(nunca fica maior). Adicionado `.ps-corpo > *{flex-shrink:0}` e
`.ps-col > *{flex-shrink:0}`, com comentário explicando o porquê.

**`js/semana.js`:** removida a navegação de páginas do preview
("‹ 01/01 ›") — não existe mais conceito de página no preview, porque
`montar()` nunca devolve mais de uma. `desenharPreview()` também passou
a esperar `document.fonts.ready` antes de montar, pelo mesmo motivo do
`preparar()`. Mensagens de progresso/sucesso da exportação simplificadas
(sem contagem de página).

**Sem migration nova** — o modelo de dados (`status_itens.etapa`/
`situacao`) já tinha quase 1:1 as 8 categorias de tipo e as 8+2 de
status pedidas pela especificação; nenhuma coluna nova foi necessária.

### Implementado e testado

- Filtro de itens concluído/publicado/cancelado: confirmado por
  Playwright que nenhum desses três aparece no HTML renderizado
  (busca por texto "NÃO DEVE APARECER" marcado nesses itens) em quatro
  cenários (semana normal com 3 itens excluídos, semana cheia, dia
  muito cheio, semana extrema), com contagem renderizada = contagem
  enviada (pós-filtro) em todos os casos — sem perda silenciosa de
  dado além do filtro pretendido.
- Nunca gera segunda página: confirmado (`document.querySelectorAll
  ('.pag45').length === 1`) em todos os cenários testados, incluindo
  uma semana propositalmente extrema de 36 itens.
- Escada de densidade real, medida de verdade (depois de corrigido o
  bug do flex-shrink e o de fontes): semana normal (9 itens, 3
  excluídos) → confortável; semana cheia (15 itens) → densa; um dia
  com 8 tarefas → compacta; semana muito cheia mas realista (22 itens
  úteis) → compacta em duas colunas, layout equilibrado e legível
  (conferido visualmente por screenshot, com legenda e rodapé
  visíveis, nada cortado).
- **As duas exportações reais foram exercitadas de ponta a ponta**
  (não só o HTML/CSS isolado): `B7.BaixarSemana.gerarPNG()` rodou com
  o `html2canvas` de verdade (vendorizado localmente, sem depender de
  rede) e produziu um PNG de 2160×2700px (escala 2×) com o filtro de
  itens concluídos confirmado no próprio PNG gerado. `B7.BaixarSemana.
  gerarPDF()` rodou com o `jsPDF` de verdade e produziu um PDF de
  exatamente 1 página, 216×270mm — a proporção 4:5 pedida, não A4.
  Nenhum dos dois lançou erro de console/página.
- Editor (`js/semana.js`) continua sem o filtro de exclusão em
  qualquer lugar do código — confirmado por leitura direta, não só
  inferido: a pessoa que edita continua vendo e editando itens
  concluídos/publicados/cancelados normalmente.
- `node --check` (via `vm.Script`) em `js/doc-semana.js` e
  `js/semana.js` depois de cada edição.

### Implementado, mas requer validação adicional

- **Semanas verdadeiramente extremas (30+ itens com títulos longos)
  ainda podem estourar visualmente**, mesmo no nível mais denso em
  duas colunas — testado com uma fixture deliberadamente patológica de
  36 itens (5-6 por dia, título longo em todos): o algoritmo escolhe a
  combinação que menos estoura (comportamento de último recurso
  pedido pela própria especificação: "força a combinação mais extrema
  como último recurso, mas nunca uma segunda página"), mas nesse caso
  extremo ~180px do fim da segunda coluna ficam cortados
  (`overflow:hidden`, sem indicação visual de conteúdo oculto). Não
  encontrei uma forma de garantir 100% de legibilidade sem paginação
  para esse volume — a especificação também não pediu paginação, então
  mantive a peça sempre em uma página, com a ressalva honesta de que
  um volume assim de demandas numa única semana para um único cliente
  é incomum e não foi possível confirmar quão frequente isso seria na
  prática. Se o Yury notar isso em uso real, a saída mais simples é um
  aviso discreto ("+N itens não exibidos") quando o pior caso for
  detectado — não implementado ainda, porque exigiria decidir com ele
  qual item priorizar mostrar.
- Snapshot/versionamento (`status_versoes`, Rascunho/Pronto/Enviado) —
  o caminho de exportação continua chamando `B7.DB.criarVersao(...)`
  sem alteração, mas não reexecutei esse fluxo especificamente nesta
  rodada (não mexi nele).
- Acessibilidade em escala de cinza (seção 33 da especificação): o
  texto do status sempre acompanha a cor (nunca só a cor sozinha),
  mas não fiz uma captura específica em escala de cinza pra confirmar
  visualmente.
- Preview do editor dentro do app completo (roteamento real, não o
  harness isolado): testei a lógica de `desenharPreview()`/
  `escalarPreview()` por leitura e `node --check`, mas não naveguei o
  app inteiro (login → editor → preview) com Playwright nesta rodada.

### Não implementado por bloqueio

Nenhum item desta especificação ficou bloqueado — todos os requisitos
centrais (uma página sempre, densidade adaptativa real, dois sistemas
de cor, exclusão de itens concluídos, header/faixa de cliente
compactos, legenda compacta, PNG/PDF/preview consistentes) foram
implementados e testados de ponta a ponta, incluindo os dois caminhos
de exportação reais.

Arquivos alterados: `js/doc-semana.js`, `styles/semana.css`,
`js/semana.js`, `js/auth.js`, `sw.js`.
`VERSAO` → `2026-09-11-s`, cache do service worker →
`roteiros-b7-v34`.

## Build 2026-09-11-t — Correção urgente: "Status semanal" travava carregando pra sempre

Bug reportado pelo Yury com print de tela logo depois do build `-s`:
abrir o status semanal de um cliente ficava com o skeleton de
carregamento pra sempre, sem nunca mostrar o editor.

**Causa:** no build anterior eu reescrevi `js/doc-semana.js` e troquei o
sistema antigo de indicador de status (`classeSituacao(situacao)`, que
devolvia o nome de uma classe CSS tipo `ps-ponto-azul`) pelo novo
sistema de tokens `SITUACOES`/pílula colorida — mas essa função não
fazia parte só da peça exportada pro cliente: **a lista de itens do
próprio editor** (`cardItem()` em `js/semana.js`, a coluna da esquerda
onde a pessoa vê e edita as demandas) também chamava
`D().classeSituacao(...)` pra colorir um pontinho ao lado do status —
e o mesmo acontecia na prévia rápida (`quickView()`, o modal que abre
ao clicar num card na lista de status semanais). Como a função não
existe mais no `B7.DocSemana` reescrito, a chamada lançava
`TypeError: D(...).classeSituacao is not a function` bem no meio da
montagem do HTML do editor (`render()`) — antes do
`painel().innerHTML = ...` substituir o skeleton inicial. O erro ficava
sem tratamento (não tem try/catch ali), a Promise de `abrir(id)`
rejeitava silenciosamente, e o skeleton nunca saía da tela.

Encontrado testando de verdade o caminho que faltava na rodada
anterior: eu tinha testado o renderizador da peça do cliente
(`montar`/`gerarPNG`/`gerarPDF`) de ponta a ponta, mas não tinha aberto
o editor em si (`B7.Semana.abrir()`) — exatamente o tipo de lacuna que
a rodada anterior já tinha me ensinado a desconfiar (o bug do
flex-shrink e o das fontes). Peço desculpa pelo retrabalho — devia ter
testado o editor completo antes de entregar o build `-s`.

**Correção:**
- `js/doc-semana.js`: `corSituacao(situacao)` — nova função exportada,
  devolve só a cor (mesmo token de `SITUACOES` usado na pílula), sem
  montar pílula nenhuma. Serve pra quem só precisa colorir um pontinho.
- `js/semana.js`: as duas chamadas (`cardItem()` e `quickView()`)
  trocadas de `D().classeSituacao(it.situacao)` (classe CSS) pra
  `D().corSituacao(it.situacao)` usado como `style="background:…"`
  inline — mesmo padrão já usado em outras partes do sistema.
- `styles/semana.css`: adicionada de volta a regra de tamanho/formato
  do `.ps-ponto` (círculo de 8px) — ela só existia, sem querer,
  dentro do escopo `.ps-atencao .ps-ponto` da peça exportada; agora
  existe também fora desse escopo, pro pontinho do editor e da prévia
  rápida.

**Testado com confiança desta vez, incluindo o caminho que faltou:**
- Harness dedicado carregando `js/semana.js` de verdade (não só
  `js/doc-semana.js` isolado) com `B7.DB` simulado (status + 4 itens,
  incluindo um "Publicado" — pra conferir as duas coisas ao mesmo
  tempo) e chamando `B7.Semana.abrir('r1')` do jeito que a rota real
  chama.
- Confirmado: a Promise resolve sem erro, o skeleton de carregamento
  sai completamente da tela, o HTML do editor é montado (12.5KB),
  nenhum erro de console/página.
- Os 4 pontinhos de status renderizam com cor real (`rgb(...)`, não
  `transparent` nem erro) — a correção realmente resolve, não só
  silencia o erro.
- Conferido visualmente por screenshot: a lista de itens do editor
  mostra TODOS os 4 itens, incluindo o "Publicado" (correto — o editor
  nunca filtra); a prévia ao vivo no mesmo screenshot mostra só 3
  (o "Publicado" corretamente ausente) — confirma que a correção não
  quebrou o filtro do build anterior.
- `grep` confirmando que não sobrou nenhuma outra referência a
  `classeSituacao` em nenhum arquivo do sistema.
- `node --check` em `js/doc-semana.js` e `js/semana.js`.

**Não retestado nesta rodada** (não foi tocado, sem motivo pra suspeitar
de regressão, mas registro por honestidade): os caminhos de exportação
PNG/PDF e o restante do fluxo do editor (adicionar/mover/excluir
demanda, duplicar, versões, publicar no portal) — a mudança desta
rodada foi cirúrgica (duas linhas trocadas + uma função nova + uma
regra CSS) e não encosta em nenhum desses fluxos.

Arquivos alterados: `js/doc-semana.js`, `js/semana.js`,
`styles/semana.css`, `js/auth.js`, `sw.js`.
`VERSAO` → `2026-09-11-t`, cache do service worker →
`roteiros-b7-v35`.

## Build 2026-09-11-u — Demandas pequenas demais no Status Semanal, e correção de fundo na medição de fontes

O Yury mandou print de um caso real (cliente "Atacadão dos Suplementos",
9 demandas na semana): o texto saía pequeno e sobrava bastante espaço
em branco na parte de baixo da página — o arquivo é sempre visto como
miniatura no WhatsApp, então legibilidade em tamanho grande importa
mais que caber "com folga".

**Causa raiz — por que o nível confortável sempre "vencia" mesmo
sobrando espaço:** a escada de densidade só tinha níveis pra ENCOLHER
(confortável era o teto). Uma semana leve cabia fácil no nível
confortável e o algoritmo nunca tentava nada maior — não porque um
texto maior não coubesse, mas porque nunca havia um nível maior pra
testar.

**Investigando o quanto dava pra aumentar, encontrei um segundo bug —
mais sério, uma reincidência do problema de fontes do build `-s`:**
`document.fonts.ready` só espera fontes que JÁ foram pedidas pelo
navegador. Nos meus testes iniciais com os níveis novos, a medição de
"cabe/não cabe" rodava e dizia que cabia — mas o resultado final,
tanto no PNG de verdade quanto no HTML puro, saía com a legenda
cortada bem em cima do rodapé. Motivo: nada na tela tinha usado ainda
o peso 800 da fonte Archivo (usado no nome do cliente e na data do
dia) antes da primeira montagem — então `document.fonts.ready`
resolvia na hora, sem esperar nada, e só quando o HTML da peça foi
inserido é que o navegador pediu esse arquivo de fonte pela primeira
vez. Com `font-display:swap`, o texto aparece primeiro numa fonte de
reserva (mais estreita) e troca pra real depois — e a medição de
densidade tinha rodado usando a fonte de reserva, then a fonte real
(mais larga/alta) chegou depois e estourou silenciosamente o que
"tinha cabido". Corrigido de forma definitiva: em vez de só esperar
passivamente, o sistema agora **força o carregamento** de cada peso de
fonte usado no documento (`document.fonts.load(...)` pra cada
combinação Inter/Archivo × peso) antes de montar e medir qualquer
coisa — `B7.DocSemana.carregarFontes()`, nova função pública, chamada
tanto no editor (`desenharPreview`) quanto na exportação (`preparar`,
usado por PNG e PDF). Isso fecha a lacuna que o `document.fonts.ready`
sozinho (build `-s`) não cobria.

**O que mudou de fato:**
- `styles/semana.css`: dois níveis novos ACIMA do confortável —
  `nv-grande` e `nv-enorme` — com tipografia, pílulas e espaçamento
  visivelmente maiores. `js/doc-semana.js`: a escada de níveis agora
  testa do MAIOR pro menor (`nv-enorme → nv-grande → confortável →
  nv-compacta → nv-densa → nv-muito-densa`) e usa o primeiro que
  couber de verdade — uma semana leve preenche a página com letra
  grande; só uma semana cheia desce a escada, exatamente como antes.
- `js/doc-semana.js`: nova função `carregarFontes()` (exportada) e
  `corSituacao()` continuam do build anterior; `preparar()` (PNG/PDF)
  passou a chamar `carregarFontes()` em vez de só esperar
  `document.fonts.ready`.
- `js/semana.js`: `desenharPreview()` (preview do editor) idem.

**Testado com confiança, incluindo o caso que quebrou antes:**
- Reproduzi o caso exato do print do Yury (9 itens, mesma distribuição
  pelos dias) num teste isolado. Antes da correção do bug de fontes,
  esse caso escolhia `nv-grande` mas saía com a legenda de status
  literalmente cortada (confirmado pixel a pixel, comparando a
  posição real do texto renderizado contra a medição — uma diferença
  de ~20px entre o que foi medido e o que foi de fato desenhado).
  Depois de forçar o carregamento das fontes antes de medir, o mesmo
  caso mede exatamente igual ao que é desenhado (`scrollHeight ===
  clientHeight`, sem margem de erro), e ajustei o espaçamento do nível
  `nv-grande` pra ele realmente caber com a fonte de verdade (não a de
  fallback) — confirmado visualmente, sem nenhum corte.
- Suíte de regressão com 6 cenários (1 item · 9 itens leve real · 9
  itens com exclusões · 15 itens · 1 dia com 8 tarefas · 36 itens
  extremos): semana de 1 item → `nv-enorme`; a semana real do Yury e a
  semana normal de 9 itens → `nv-grande`; 15 itens → `nv-densa`; dia
  muito cheio → `nv-compacta`; 36 itens extremos → `nv-muito-densa` em
  duas colunas (mesmo comportamento de último recurso já documentado
  no build `-s`, não piorou). Todos sem página 2, sem vazamento de
  item concluído, sem erro de console.
- **A exportação PNG real** (`B7.BaixarSemana.gerarPNG()`, com
  `html2canvas` de verdade) rodada com o caso exato do Yury: o
  arquivo final bate exatamente com o HTML medido — texto grande,
  nada cortado, legenda com espaço limpo antes do rodapé.
- `node --check` em `js/doc-semana.js` e `js/semana.js`.

- **A exportação PDF real** (`gerarPDF()`, com `jsPDF` de verdade)
  também foi regerada com o mesmo caso: 1 página, 216×270mm, sem erro.

**Não retestado nesta rodada** (não foi tocado): o restante do fluxo
do editor (adicionar/mover/excluir demanda, duplicar, versões) — a
mudança desta rodada é só na escada de densidade e no carregamento de
fontes, não encosta nesses fluxos.

Arquivos alterados: `js/doc-semana.js`, `js/semana.js`,
`styles/semana.css`, `js/auth.js`, `sw.js`.
`VERSAO` → `2026-09-11-u`, cache do service worker →
`roteiros-b7-v36`.

## Build 2026-09-11-v — Status Semanal agora mostra o FORMATO de cada demanda

**Pedido do Yury:** "no status semanal também tem que dizer se é
carrossel, reels, estático, story... enfim." O campo `formato` já
existia nos dados e já escolhia o ícone de cada linha
(`iconeDe()`), mas nunca aparecia como texto — só quem soubesse ler o
ícone sabia se era Reel, Card, Carrossel ou Story. Etapa (`ps-tipo`) e
canal (`ps-canal`) apareciam como texto; formato, não.

**Implementado e testado:**
- `js/doc-semana.js`, `linhaItem()`: novo selo `.ps-formato` na linha
  de metadados de cada demanda, mostrado ANTES do tipo/etapa — é o que
  o cliente mais pergunta ("isso é reels ou card?"). Mostra o ícone
  (o mesmo que já era escolhido por formato) + o nome do formato por
  extenso (REEL, CARD, CARROSSEL, STORY etc.), em maiúsculas, cor
  neutra — não é um dos dois sistemas de cor semânticos (tipo/situação),
  então não usa nem a cor de tipo nem a pílula de status. Quando o
  item não tem formato preenchido, o selo simplesmente não aparece
  (regra de sempre: campo vazio não aparece).
- Pra não duplicar o ícone quando os dois selos aparecem juntos: o
  ícone só vai no selo de formato quando ele existe; a etapa (`ps-tipo`)
  só carrega o próprio ícone quando não há formato (fallback, igual já
  era o comportamento de `iconeDe()`).
- `styles/semana.css`: novo bloco `.ps-formato`/`.ps-formato-ic`,
  reaproveitando os tamanhos da escada de densidade que já regem
  `.ps-tipo`/`.ps-tipo-ic` (`--tipo-fs`, `--tipo-ic`) — não precisou de
  nenhuma variável nova nem mexeu na medição de altura por nível.
- Suíte de regressão com os 6 cenários de sempre (1 item · 9 itens
  leve real · 9 itens com exclusões · 15 itens · 1 dia com 8 tarefas ·
  36 itens extremos), desta vez com `formato` preenchido em
  praticamente todos os itens (pior caso de largura na linha de
  metadados, pra garantir que o selo novo não empurra nada pra fora):
  todos os níveis de densidade escolhidos continuam os mesmos de
  antes (`nv-enorme` → `nv-grande` → `nv-densa` → `nv-compacta` →
  `nv-muito-densa` em duas colunas no extremo), sem página 2, sem
  vazamento de item concluído, sem erro de console. O caso extremo
  de 36 itens em duas colunas continua com a mesma sobra conhecida e
  já documentada do build `-s` (não piorou com o selo novo).
- Conferência visual: capturei screenshot da página renderizada nos
  cenários leve-real e extremo — o selo de formato aparece legível ao
  lado do tipo e do canal em todas as densidades, inclusive na mais
  compacta.
- **Exportação PNG real** (`B7.BaixarSemana.gerarPNG()`, com
  `html2canvas` de verdade) e **PDF real** (`gerarPDF()`, com `jsPDF`
  de verdade), ambas com itens levando formato: os dois arquivos
  saíram sem erro, com o selo de formato visível e no lugar certo, e
  o item "Publicado" (fora do planejamento) continuou de fora, como
  sempre.
- `node --check` em `js/doc-semana.js` e `js/semana.js`.

**Não implementado por bloqueio:** nenhum.

**Não retestado nesta rodada** (não foi tocado): o restante do fluxo
do editor (adicionar/mover/excluir demanda, duplicar, versões) — o
cartão de demanda do editor (`cardItem()` em `js/semana.js`) já usava
o ícone de formato antes desta mudança e continua igual; não recebeu
o texto do formato porque não foi pedido — o pedido foi especificamente
sobre o arquivo que vai pro cliente.

Arquivos alterados: `js/doc-semana.js`, `styles/semana.css`,
`js/auth.js`, `sw.js`.
`VERSAO` → `2026-09-11-v`, cache do service worker →
`roteiros-b7-v37`.

## Build 2026-09-11-w — Gráfico "Pilares de conteúdo": uma barra só, com marca de meta

**Relato do Yury, com print:** "os pilares de conteúdo continuam com o
gráfico bugado" — mesmo depois do contraste ter sido corrigido no
build `-k` e da auditoria de dados do build `-m` não ter achado
nenhum bug de relação (`RELATORIO_2026-09-11-m_AUDITORIA_UX_DESIGN.md`).

**Causa real, desta vez achada por inspeção visual de perto (recorte
ampliado do print, não só o print inteiro):** os números e a lógica
sempre estiveram certos — o problema é o **desenho** do gráfico em si.
Cada pilar mostrava DUAS barrinhas finas, paralelas, uma logo abaixo
da outra ("Planejado" em cinza, "Real" em magenta) — um padrão que,
mesmo com contraste correto, lê como elemento quebrado/duplicado à
primeira vista, principalmente numa barra lateral estreita, e obriga a
raciocinar sobre a legenda pra saber qual é qual. Isso explica por que
o dono continuou reportando "bugado" mesmo depois do contraste da
barra "Planejado" ter sido corrigido de verdade (confirmado por
computação de estilo real no build `-k`) — o número em si nunca foi o
problema, mas duas barras próximas do mesmo comprimento pareciam um
glitch de qualquer forma.

**O que mudou — `js/linha.js` (`distribuicaoPilares()`) e
`styles/linha.css`:** as duas barras viraram uma barra só por pilar,
no padrão comum de "progresso com meta": o preenchimento colorido
(gradiente magenta, o mesmo tom de antes) mostra o REAL; uma marca —
um tracinho vertical — sobre a barra mostra onde fica a META
(planejado). Quando o pilar não tem percentual definido (0%), a marca
simplesmente não aparece (não existe meta pra marcar), e o
preenchimento mostra o real cheio, exatamente como o pilar "Conversão"
do print do dono. A escala continua a mesma de antes (o maior valor
entre todos os planejados/reais de todos os pilares), então as barras
continuam comparáveis entre si.
- Legenda atualizada: "Real" (chip colorido) e "Meta (planejado)"
  (tracinho, do mesmo jeito que aparece na barra) — texto mais claro
  que só "Planejado", que não dizia se era uma barra ou uma meta.
- Nada mudou na lógica de cálculo (`pct`, `planejadosDoPilar`,
  `reaisDoPilar`, `basePlanejada`, `estado` ok/abaixo/acima) — só a
  representação visual. Os números ao lado ("4 de 11 planejados",
  "sem % definido" etc.) continuam exatamente os mesmos de antes.
- Essa barra é usada em dois lugares (o card "Pilares de conteúdo" na
  Visão geral, e dentro da aba Estratégia/"Editar pilares") — os dois
  usam a mesma função `distribuicaoPilares()`, então os dois foram
  corrigidos de uma vez só, sem duplicar código.
- A OUTRA barra de pilares que existe no sistema (`barraPilares()`, a
  faixa segmentada colorida que mostra só a proporção planejada de
  cada pilar, usada no topo da seção Estratégia) é um componente
  diferente e não foi tocada — não fazia parte do relato.

**Testado:**
- Reproduzi os números exatos do print do dono (pilar 1: 50%, 4 de 11;
  pilar 2: 35%, 4 de 7; pilar 3: 0%, 11 conteúdos sem % definido; 3
  conteúdos soltos) num harness isolado com o CSS real do sistema.
  Conferido visualmente por screenshot: cada pilar agora mostra uma
  barra só, com o preenchimento na proporção certa (pilar 1: 36%;
  pilar 2: 36%; pilar 3: 100%) e a marca de meta na posição certa
  (pilar 1: bem no fim da barra, coerente com ser o maior planejado do
  grupo; pilar 2: a ~64%; pilar 3: sem marca, como esperado).
- Testado nos dois temas (claro e escuro): a marca de meta (`--ink-4`)
  mantém contraste real contra o preenchimento e contra o trilho nos
  dois, incluindo o card com fundo escuro de verdade (`--card` do tema
  escuro), não só a página inteira escura.
- `node --check` em `js/linha.js`.

**Não implementado por bloqueio:** nenhum.

**Não retestado nesta rodada** (não foi tocado): o restante da página
da Linha Editorial (abas Estratégia/Criativos/Postagens/Produção,
CRUD de pilar, autosave) — a mudança desta rodada é só a representação
visual da barra de distribuição, isolada nessas duas funções.

Arquivos alterados: `js/linha.js`, `styles/linha.css`, `js/auth.js`,
`sw.js`.
`VERSAO` → `2026-09-11-w`, cache do service worker →
`roteiros-b7-v38`.

## Build 2026-09-11-x — Rodada 3 do refino de UX do Design: Design Piece Workspace (Card e Capa de Reel)

Terceira das seis rodadas de `PLANO_UX_DESIGN_RESTANTE.md` (seções
14-17, 20, 22-24 da especificação). Escolhido começar pelos formatos
mais simples (Card e Capa de Reel) antes do Carrossel, que é o mais
trabalhoso — fica para a Rodada 4, junto com Stories.

**O que mudou:**
- **A gaveta estreita (560px) saiu.** No lugar, um workspace quase
  tela cheia (`.ds-ws`, até 1320×920px, com fallback total em
  celular): cabeçalho com voltar/fechar, corpo em duas colunas —
  conteúdo principal à esquerda (prévia grande, feedback de ajuste em
  destaque quando existe, campos do briefing) e painel operacional à
  direita (ação primária, compartilhar, responsável/prazo/prioridade,
  envio de versão, histórico, linha do tempo).
- **Ação primária única por estado** (`acaoPrimaria()`): um botão de
  destaque só, nunca dois competindo — corrige um bug real
  pré-existente em que \"Finalizar\" e \"Enviar para aprovação do
  cliente\" podiam aparecer juntos, com o mesmo peso visual, para a
  mesma peça vinculada a cliente. A precedência agora é explícita:
  assumir → aprovar internamente (com \"Solicitar ajuste\" como ação
  secundária) → enviar para aprovação do cliente (com \"Finalizar
  mesmo assim\" como secundária, só quando já houve aprovação) →
  finalizar. Fora desses estados, não existe ação primária — o próximo
  passo natural já é o bloco de envio de versão, sempre visível.
- **Workspace específico para Card estático**: campo principal
  (\"HEADLINE\") em destaque tipográfico (Archivo 800, 22px), seguido
  dos campos secundários do briefing (sub-headline, CTA, legenda,
  objetivo, direção, observação de Design, referências) — nunca um
  campo vazio ocupando espaço.
- **Workspace específico para Capa de Reel**: campo principal
  (\"IDENTIFICAÇÃO DO REEL\") em destaque, mais um bloco \"Ver
  roteiro\" quando a Capa está vinculada a um roteiro com script_id.
- **\"Ver roteiro\" genuinamente somente leitura**: antes, esse botão
  fechava o workspace e navegava para o editor completo da
  Gravação/roteiro (editável). Agora abre um modal (`verRoteiro()`)
  reaproveitando o mesmo renderizador da folha A4 impressa
  (`B7.Folha.folhaHTML`), escalado para caber, com um único botão
  \"Fechar\" — nenhum controle de edição.
- **Prévia grande** (`.ds-ws-preview`) no topo do conteúdo principal,
  reaproveitando o mesmo mecanismo de miniatura assinada e lazy-load
  já usado nos cards (`ligarThumbs`) — não existia antes na gaveta.
- **Bloco de feedback de ajuste em destaque** (`feedbackAjuste()`):
  quando a peça está em `ajustes`/`ajustes_cliente`, a mensagem mais
  recente do histórico de notificações aparece como um alerta no topo
  do conteúdo principal — não é preciso rolar até a linha do tempo
  para saber o que precisa mudar.
- Upload/revisão de versão e histórico continuam dentro do novo
  layout (painel lateral), sem nenhuma mudança de lógica.

**O que NÃO mudou (risco minimizado de propósito):** toda a lógica de
negócio existente foi preservada literalmente — mesmo objeto de estado
`drawer`, mesma função `ligarDrawer()` (só dois ajustes pontuais, ver
abaixo), mesmos IDs de campo (`dv-designer`, `dv-prazo`,
`dv-prioridade`, `dv-assumir`, `dv-compartilhar`, `dv-drop`,
`dv-aprovar`, `dv-ajuste`, `dv-finalizar`, `dv-enviar-cliente` etc.).
Só a moldura HTML/CSS ao redor foi reescrita. Upload, autosave de
responsável/prazo/prioridade, aprovação/ajuste interno, finalizar,
enviar para o cliente, compartilhar com colega — nenhum desses fluxos
foi tocado.

**Dois ajustes pontuais em `ligarDrawer()`, necessários pela nova
moldura:**
- O cabeçalho novo tem dois botões de fechar (← voltar e ✕); o código
  antigo só ligava o primeiro que encontrasse — corrigido para ligar
  os dois.
- O handler de \"Ver roteiro\" foi trocado da navegação antiga
  (`location.hash = '#/gravacao/...'`) para abrir `verRoteiro()`.

**Limpeza:** removidas do `styles/design.css` as regras da gaveta
antiga que a nova marcação não emite mais (`.ds-dr-cab`,
`.ds-dr-linha1`, `.ds-dr-cab h3`, `.ds-dr-meta`, `.ds-dr-corpo`,
`.ds-dr-pe` e o bloco mobile correspondente, incluindo a animação
`dsSobeDrawer`) — código morto de verdade, confirmado por busca no
JS antes de apagar. O que continua ativo (`.ds-dr-grade` e os campos
dentro dela) ficou.

**Não implementado nesta rodada (Rodada 4, seguinte):** workspace
dedicado para Carrossel e Stories — esses dois formatos continuam
usando o `blocoBriefing()` genérico de sempre dentro do novo
workspace (a moldura mudou, o conteúdo do briefing desses dois
formatos, não).

### Implementado e testado

- Harness dedicado (Playwright, Supabase simulado) com 4 cenários:
  Card em `ajustes` com feedback do cliente e versão anterior
  `ajuste_solicitado` (confirma que nenhuma ação primária aparece
  nesse estado — o próximo passo é o envio de nova versão); Capa de
  Reel em `em_criacao` com roteiro/cenas/gravação vinculados (\"Ver
  roteiro\" abre o modal correto, com o nome do cliente, da gravação e
  as 3 cenas, escalado sem overflow, só o botão Fechar); Card
  `aprovado_interno` vinculado a cliente com versão `aprovada_interna`
  (confirma a precedência: só \"Enviar para aprovação do cliente\"
  aparece como primária, com \"Finalizar mesmo assim\" como
  secundária — nunca os dois como primários); Card `aguardando_producao`
  sem responsável, sessão Designer (\"Assumir esta peça\" aparece como
  única ação).
- Responsivo: 390×844 (celular) testado do topo ao fim da rolagem —
  painel lateral empilha corretamente abaixo do conteúdo principal,
  sem overflow horizontal, upload/histórico/linha do tempo legíveis e
  utilizáveis.
- `document.querySelectorAll('[data-fechar]')` com dois elementos
  confirmados, os dois fechando o workspace corretamente.
- `node --check` em `js/design.js`.
- Reconferido por leitura: nenhuma referência a `ds-drawer`/
  `ds-dr-cab`/`ds-dr-linha1`/`ds-dr-meta`/`ds-dr-corpo`/`ds-dr-pe`
  sobra em `js/design.js` nem em `styles/design.css` depois da
  limpeza — nem código morto emitindo classes sem CSS, nem CSS morto
  esperando classes que não existem mais.

### Requer validação adicional (não testado nesta rodada)

- O caminho de notificação (`#/design/<id>` pelo sino ou por um push)
  continua chamando `abrirDetalhe(id)` exatamente como antes — não foi
  alterado — mas não foi reexecutado explicitamente com Playwright
  nesta rodada.
- Teste em dispositivo físico não foi realizado — toda a validação
  responsiva foi feita por emulação de viewport no Chromium.
- Realtime com duas sessões simultâneas não foi retestado nesta rodada
  (o canal usado não foi alterado).

### Não implementado por decisão consciente

- Workspace dedicado para Carrossel (o mais trabalhoso, com navegador
  de slides interativo) e Stories — ficam para a Rodada 4, conforme o
  plano.
- Miniaturas otimizadas/geração de thumbnail — Rodada 5.

Arquivos alterados: `js/design.js`, `styles/design.css`, `js/auth.js`,
`sw.js`.
`VERSAO` → `2026-09-11-x`, cache do service worker →
`roteiros-b7-v39`.

## Build 2026-09-11-y — Status Semanal: status de produção específico por formato

**Pedido do Yury (especificação completa de 48 seções):** o Status
Semanal usava o mesmo vocabulário de situação para tudo — um Card podia
aparecer como "Gravando", um Carrossel como "Editando vídeo". O pedido
foi refinar o módulo existente (não reconstruir, não trocar o
renderizador de uma página, não mexer no algoritmo de densidade do
build `-s`, na correção de cor do `-t`, na correção de medição de fonte
do `-u`, nem no selo de formato do `-v`) para que FORMATO e SITUAÇÃO
continuem campos separados, mas a lista de situações disponíveis passe
a depender do formato/contexto da demanda.

### Implementado e testado

- **Vocabulário de situação por contexto** (`js/doc-semana.js`,
  `ESTAGIOS` + `contextoDe()`/`estagiosDe()`): cada formato tem sua
  própria lista ordenada de situações — Card e Story (`A produzir` →
  `Criando arte` → `Corrigindo arte` → `Revisão interna` →
  `Aguardando aprovação` → `Aprovado` → `Programado para postagem` →
  `Postado`; Story nunca presume sequência de múltiplos quadros — pode
  ser um quadro só), Carrossel (com `Corrigindo carrossel` em vez do
  termo genérico de arte, e `A estruturar` consolidado — sem separar
  "estruturando conteúdo" como um passo à parte), Reel (única lista
  com vocabulário de vídeo: `A gravar` → `Gravação marcada` →
  `Gravando` → `Editando vídeo` → `Corrigindo vídeo` → ... →
  `Postado`), Capa de Reel (lista própria, sem duplicar registro —
  reaproveita o mesmo item de dados do Reel quando já vier junto) e
  Gravação (vocabulário específico de agenda de gravação: `A
  confirmar`, `Gravação marcada`, `Gravando`, `Material captado`,
  `Remarcada`, `Cancelada` — usa a data de gravação, nunca a de
  postagem). Item sem formato reconhecido cai no contexto `Genérico`
  (lista curta, neutra). `contextoDe(it)` decide o contexto: formato
  reconhecido → o próprio formato; senão, etapa `Gravação` → contexto
  `Gravação`; senão → `Genérico`.
- **Nenhuma migração de dados foi necessária para o vocabulário**:
  `status_itens.situacao`, `.etapa` e `.formato` nunca tiveram
  `CHECK CONSTRAINT` — são texto livre. Registros antigos com rótulos
  genéricos (`Previsto`, `Em andamento`, `Concluído`...) continuam
  funcionando exatamente como antes; o editor só passou a oferecer um
  dropdown mais específico dependendo do formato escolhido.
- **Segunda data para Reel** (`data_postagem`, coluna nova — ver
  `migration_status_formato.sql`): Reel pode ter data de gravação (o
  campo `data` de sempre, que continua posicionando a demanda no dia
  da grade) e data de postagem separada, quando as duas existem de
  verdade. Aparece no documento do cliente como uma linha extra
  ("Postagem: DD/MM/AAAA") só quando preenchida — nunca um placeholder
  tipo "Data de postagem: —" para datas que não existem. Ao trocar o
  formato de um item de Reel para outro formato, `data_postagem` é
  limpa automaticamente (não faz sentido fora do Reel).
- **Revalidação de situação sem conversão silenciosa**
  (`revalidarSituacao()` em `js/semana.js`): ao trocar o formato ou a
  etapa de uma demanda, se a situação atual não existir no vocabulário
  do novo contexto, o sistema reseta para a primeira opção válida do
  novo contexto E mostra um toast explicando a mudança (ex.: `Situação
  ajustada para "A produzir" (novo formato/etapa: Card)`). Nunca fica
  com um valor inválido parado, e nunca troca sem avisar.
- **Semeadura de situação inicial ciente do contexto**: todo caminho
  que cria um item novo (adicionar manualmente, duplicar item,
  duplicar semana inteira, importação automática da linha editorial)
  agora começa com a primeira situação do vocabulário do contexto
  certo, em vez do antigo `'Previsto'` fixo para tudo.
- **"Mostrar itens concluídos" (Sim/Não)** — novo controle no editor
  (`blocoInfo()`), guardado em `status_semanais.preferencias`
  (coluna `jsonb` que já existia e não era usada — não precisou de
  migração nova). Só filtra a APRESENTAÇÃO: nunca apaga dado nem muda
  a situação canônica do item. Itens concluídos (situação terminal por
  contexto: `Postado`, `Finalizada`/`Finalizado`, `Material captado`,
  mais os rótulos legados `Concluído`/`Concluida`) ficam ocultos por
  padrão; com o controle em "Sim", aparecem.
- **Cancelado é diferente de concluído**: itens com situação
  `Cancelada`/`Cancelado` ficam SEMPRE ocultos do documento do
  cliente, mesmo com "Mostrar itens concluídos" em Sim — nunca são
  contados nem mostrados como se fossem `Postado`.
- **"Mostrar atividades: Toda a semana / A partir de hoje"** — segundo
  controle novo, também salvo em `preferencias`. Com "A partir de
  hoje", dias e itens com data anterior a hoje somem da grade; hoje e
  o futuro continuam aparecendo; itens sem data nunca são cortados por
  esse filtro (regra de sempre: não inventa nem filtra o que não tem
  informação).
- **Duas paletas de cor semânticas continuam separadas**: cor de
  FORMATO (`corFormato()` — Post estático/Card em magenta, Carrossel
  em violeta, Reel em ciano, Story em âmbar, Capa de Reel no tom de
  Design já usado no resto do sistema, Gravação em turquesa) e cor de
  SITUAÇÃO (pílula, por família de cor conforme o significado do
  status: cinza para "a fazer", azul para "em produção", amarelo/laranja
  para "aguardando", verde para "aprovado/concluído", vermelho para
  "correção pedida"). O selo de formato (ícone + texto, do build `-v`)
  continua visível e não muda de cor conforme a situação.
- **Legenda específica da semana, adaptável por densidade**
  (`legenda()` reescrita): mostra só os formatos e situações que
  realmente aparecem naquela semana — não a lista genérica de tudo que
  existe no sistema. Ganhou duas seções ("FORMATOS" e "ETAPAS DA
  PRODUÇÃO"). Cada seção existe em duas versões no HTML — detalhada
  (com descrição curta por situação) e compacta (só os rótulos,
  separados por " · ") — e o CSS (`styles/semana.css`) alterna qual
  aparece conforme o nível de densidade (`nv-compacta`, `nv-densa`,
  `nv-muito-densa` mostram a compacta; níveis mais folgados mostram a
  detalhada). Isso preserva sem nenhuma alteração o loop de medição por
  nível que já existia em `montar()` — elemento oculto não conta pro
  `scrollHeight`, então a medição continua correta em cada nível.
- **Override de status para o cliente** (`situacao_cliente`, coluna
  nova, opcional): campo de texto no editor ("Como aparece para o
  cliente") que só troca o TEXTO da pílula mostrado no documento —
  nunca a cor (que continua vindo da `situacao` real) nem a lógica de
  filtro/legenda, que sempre usa a situação canônica. Documentado como
  decisão deliberada de escopo — não é um segundo sistema de status,
  é só um rótulo de apresentação.
- **Editor**: dropdown de FORMATO por demanda; dropdown de SITUAÇÃO
  passa a listar só as opções do contexto atual (com o rótulo do
  contexto ativo visível); campo de segunda data (postagem) só aparece
  quando o formato é Reel; os dois novos controles de exibição do
  relatório (concluídos / período) ficam junto das outras opções do
  relatório em `blocoInfo()`.
- Suíte de 11 testes automatizados via Playwright (harness isolado,
  sem tocar produção): filtragem padrão dos concluídos, toggle de
  mostrar concluídos, segunda data do Reel, sempre uma página,
  cores de formato distintas, legenda com as duas seções, filtro "a
  partir de hoje" (com data simulada), dropdown de situação do Card
  sem termos de vídeo, dropdown do Reel com vocabulário de vídeo,
  revalidação ao trocar formato (sem conversão silenciosa, zera a
  segunda data), e presença do campo de override pro cliente — todos
  passaram, sem erro de console.
- **Teste de estresse de densidade** (35 itens, 5 por dia × 7 dias,
  alternando Card/Reel/Carrossel/Story): continua exatamente uma
  página (`nv-muito-densa`, duas colunas), e medição direta confirmou
  `scrollHeight === clientHeight` (1149 = 1149) com `overflow:hidden`
  — a página cabe exatamente, sem sobra invisível e sem corte de
  conteúdo.
- Conferência visual: screenshots do documento padrão (selos de
  formato coloridos, pílulas de situação coloridas, linha extra de
  postagem do Reel, legenda de duas seções com descrição) e do editor
  (novos campos + toast de revalidação em tempo real, com o texto
  exato `Situação ajustada para "A produzir" (novo formato/etapa:
  Card)`) — revisadas, corretas.
- `node --check` em `js/doc-semana.js` e `js/semana.js`.

### Implementado, mas requer validação adicional

- Tema escuro dos campos novos do editor (select de FORMATO, campo de
  segunda data, campo de override pro cliente, os dois novos toggles
  de exibição): não foi capturado screenshot específico em tema
  escuro nesta rodada. Reaproveitam classes já existentes e
  sensíveis a tema (`.campo`, `.rot`, `.op-mini`) usadas pelo resto do
  editor, então o risco é baixo, mas não foi verificado visualmente.
- O restante do fluxo do Status Semanal fora do que foi mudado
  (adicionar/mover/excluir demanda em outros pontos, versões
  exportadas — Rascunho/Pronto/Enviado —, cópia de preferências ao
  duplicar semana em cenários fora dos testados, publicação no
  portal): código não tocado nesta rodada, mas não foi reexecutado
  explicitamente com Playwright.
- Deep-link de notificação para o Status Semanal: caminho não alterado
  nesta rodada, não foi reexecutado.

### Não implementado por bloqueio ou por decisão consciente

- **Derivação automática de situação a partir dos módulos canônicos**
  (Peça de Design, produção de vídeo, Gravação, ocorrência de
  postagem) — o pedido pedia isso "onde for seguro", mas o sistema
  hoje não expõe um mapeamento pronto e confiável entre o estado
  desses módulos e o vocabulário de situação do Status Semanal sem
  arriscar inventar uma automação que não existe de verdade. Fica para
  uma rodada dedicada — **não foi implementado nesta rodada**, e a
  situação continua sendo definida manualmente no editor do Status
  Semanal, como sempre foi.
  Consequência direta: ainda é preciso atualizar manualmente a
  situação em mais de um lugar quando o mesmo evento existe em Design/
  Kanban/Status Semanal com uma relação canônica — não foi resolvido
  nesta rodada, fica fora do escopo conforme combinado.
- **Contagem/exibição de "N quadros" no Story**: não implementado —
  era opcional na especificação. O Story continua sendo tratado como
  podendo ser um quadro só ou vários, sem exigir nem mostrar uma
  contagem.
- **Exposição de detalhe por slide do Carrossel**: não implementado —
  não há hoje um fluxo de dados que armazene conteúdo por slide
  individual ligado ao Status Semanal; não há o que expor.
- **Não duplicação da data principal na linha do item** para formatos
  de data única (Card, Carrossel, Story, Gravação, Genérico): a
  especificação mostrava a data também dentro da linha do item nesses
  casos; optei por não duplicar, porque o cabeçalho do dia já mostra
  essa mesma data — repetir violaria o princípio já estabelecido neste
  módulo de não mostrar informação redundante. Só o Reel, que tem
  duas datas de verdade, ganhou a linha extra. Decisão consciente,
  reportada para validação do Yury.

### Migração de banco

- `migration_status_formato.sql` (nova, aditiva e idempotente): duas
  colunas novas em `status_itens` — `data_postagem` (date) e
  `situacao_cliente` (text). Nenhuma outra migração foi necessária,
  porque `situacao`/`etapa`/`formato` nunca tiveram `CHECK
  CONSTRAINT`.

Arquivos alterados: `js/doc-semana.js`, `js/semana.js`,
`styles/semana.css`, `migration_status_formato.sql`, `js/auth.js`,
`sw.js`.
`VERSAO` → `2026-09-11-y`, cache do service worker →
`roteiros-b7-v40`.

## Build 2026-09-11-z — Status Semanal: etapa de roteiro, para não confundir "produção do roteiro" com "edição"

**Pedido do Yury:** depois de ver o build `-y`, apontou que faltava
especificar melhor o que está em andamento — se é a produção do
roteiro (a escrita do texto do vídeo) ou já a edição, e deixar claro
quando algo está só previsto pra postagem. Investigando, confirmei o
problema: o vocabulário de situação do Reel e da Gravação pulava
direto de "a fazer" pra "gravação" — nunca existia uma situação que
representasse a fase de escrever o roteiro, que é um trabalho real e
anterior à gravação (o sistema já tem um módulo próprio de roteiro,
`js/editor.js`, com seu próprio campo de estágio — "Em criação", "Em
revisão", "Aprovado internamente", "Pronto para gravar", "Gravado" —
mas ele é uma entidade separada da situação do Status Semanal, e
essa rodada não liga os dois automaticamente, como já ficou
documentado no build `-y`).

**Implementado e testado:**
- Nova situação `Escrevendo roteiro`, adicionada como primeira opção
  do vocabulário de **Reel** (antes de `A gravar`) e de **Gravação**
  (antes de `A confirmar`) em `js/doc-semana.js` (`ESTAGIOS`,
  `SITUACOES`, `LEGENDA_TEXTO`). Não mexe em Card/Story/Carrossel —
  esses formatos não têm etapa de roteiro.
- Cor própria (`#5B5FC7`, tom índigo) pra não confundir com "Criando
  arte" (violeta) nem "Editando vídeo" (azul) — mantém os dois
  sistemas de cor (formato/situação) do jeito que já eram.
- Texto de legenda: "O roteiro do vídeo está sendo escrito." — e o
  texto de `A gravar` foi ajustado pra deixar explícito que o roteiro
  já está pronto nesse ponto ("O roteiro está pronto; a gravação ainda
  não foi realizada.").
- Nenhuma migração de banco: `situacao` continua texto livre, sem
  `CHECK CONSTRAINT` — é só um rótulo novo no vocabulário oferecido.
- O editor (`js/semana.js`) não precisou de nenhuma mudança de código
  — o dropdown de situação já lê o vocabulário de
  `D().estagiosDe(contexto)` dinamicamente, então a nova etapa
  apareceu automaticamente pra Reel e Gravação assim que entrou no
  `ESTAGIOS`. Só um comentário desatualizado foi corrigido.
- Testado com Playwright: confirmei que a pílula do item mostra
  "Escrevendo roteiro" corretamente, que a legenda lista a nova etapa
  na seção "ETAPAS DA PRODUÇÃO", que o dropdown do Reel no editor
  começa com "Escrevendo roteiro" seguido do restante do vocabulário
  de vídeo intacto, e que o dropdown de uma demanda de Gravação (sem
  formato) também oferece a nova etapa — sem erro de console.
- Rerrodei a suíte completa de regressão do build `-y` (os 11 testes
  anteriores — filtragem de concluídos/cancelados, segunda data do
  Reel, sempre uma página, cores de formato, legenda de duas seções,
  filtro "a partir de hoje", dropdowns por contexto, revalidação ao
  trocar formato, campo de override pro cliente): todos continuam
  passando, sem regressão.
- `node --check` em `js/doc-semana.js` e `js/semana.js`.

**Não implementado por decisão consciente:** ligar automaticamente o
estágio do roteiro (`roteiros.status`, no editor de roteiro) com a
situação do Status Semanal continua fora do escopo, pelo mesmo motivo
já registrado no build `-y` — o sistema não tem hoje um mapeamento
confiável entre os dois, e cada demanda de vídeo no Status Semanal
pode não ter um roteiro vinculado (`script_id` é opcional). A equipe
continua escolhendo manualmente quando o item está em "Escrevendo
roteiro" — não é atualizado sozinho quando o estágio do roteiro muda
no editor.

Arquivos alterados: `js/doc-semana.js`, `js/semana.js`, `js/auth.js`,
`sw.js`.
`VERSAO` → `2026-09-11-z`, cache do service worker →
`roteiros-b7-v41`.

## Build 2026-09-11-z2 — Status Semanal: painel "situações a revisar" pra tirar os itens antigos do genérico

**Pedido do Yury:** depois dos builds `-y`/`-z`, apontou o problema de
verdade: no relatório que o cliente recebe, quase tudo continuava
mostrando só "Previsto" e "Em andamento" — o cliente não sabia se era
roteiro, gravação, edição ou aprovação. A causa raiz: o vocabulário
específico por formato passou a valer só pra situação escolhida DAQUI
PRA FRENTE; os itens que já existiam na semana continuavam com o texto
antigo salvo no banco, porque nada troca a situação de um item sozinho
(decisão consciente, documentada desde o `-y`, pra nunca inventar o
estado real de uma demanda). Ou seja: o vocabulário certo já existia,
mas ninguém tinha ido, item por item, escolher a situação real — e não
tinha um jeito rápido de fazer isso.

**Implementado e testado:**
- Novo bloco no topo do editor do Status Semanal (`js/semana.js`,
  `blocoRevisao()`): aparece automaticamente sempre que a semana tem
  pelo menos um item cuja situação salva não está mais no vocabulário
  do formato/etapa dele — ou seja, ainda está com um rótulo genérico de
  antes desta rodada (`Previsto`, `Confirmado`, `Programado`, `Em
  andamento`, `Em revisão`, `Aguardando cliente`, `Atenção`, ou
  qualquer valor fora de contexto). Lista cada item com o título, o
  contexto (Card/Reel/Carrossel/...) e a situação atual entre aspas, e
  um seletor ao lado já com só as opções válidas daquele contexto.
- Escolher uma opção salva a situação na hora (mesmo padrão de
  autosave do resto do sistema) e o item some da lista de pendências
  imediatamente — sem precisar abrir o card nem recarregar a página.
  Um toast confirma: `"<título>" agora está como "<nova situação>"`.
- **Nunca escolhe sozinho.** Continua a mesma regra de honestidade do
  `-y`: o sistema não sabe se um Reel "Em andamento" está no roteiro,
  na gravação ou na edição — só mostra as opções certas e pede pra
  alguém da equipe decidir. O texto do bloco explica isso: "o cliente
  vê exatamente esse texto... escolha a etapa real de cada um".
- **Item concluído ou cancelado não entra na lista de pendências**
  (`precisaRevisao()` ignora `ehConcluido`/`ehCancelado`) — "Postado"
  e "Cancelada" já são claros por si, mesmo com rótulo fora do
  vocabulário "a fazer"; forçar revisão neles seria ruído.
- CSS novo (`.sem-revisao`, `.sr-cab`, `.sr-item`, `.sr-tit`) em
  `styles/semana.css`, com um destaque âmbar sutil (mesma família de
  cor de "Aguardando aprovação") pra chamar atenção sem parecer erro.
- Testado com Playwright: confirmei que o bloco lista só os itens com
  situação genérica de verdade (não lista item já específico, nem
  concluído, nem cancelado), que o seletor de cada item já vem
  filtrado pro contexto certo (ex.: Card não mostra "Gravando"), que
  escolher uma opção salva o valor real no item e some da lista na
  hora, e que a semana sem nenhum item pendente simplesmente não
  mostra o bloco. Rerrodei a suíte completa de regressão dos builds
  `-y`/`-z` (11 + 3 testes anteriores): tudo continua passando, sem
  erro de console.
- `node --check` em `js/doc-semana.js` e `js/semana.js`.

**Como isso resolve o incômodo relatado:** o relatório do cliente em
si não muda de comportamento — ele sempre mostrou a situação real do
item (`it.situacao`), sem inventar nada. O que estava faltando era um
jeito rápido de a equipe atualizar os itens antigos pro vocabulário
novo; agora, ao abrir qualquer Status Semanal com itens desatualizados,
o próprio editor avisa e deixa resolver em segundos, item por item —
sem precisar caçar um por um nem lembrar quais formatos têm quais
opções.

**Não implementado por decisão consciente:** nenhuma automação escolhe
a situação por conta própria — nem aqui, nem em lugar nenhum do
sistema. Continua sendo a equipe quem sabe, de verdade, se aquele Reel
está no roteiro ou na gravação.

Arquivos alterados: `js/semana.js`, `styles/semana.css`, `js/auth.js`,
`sw.js`.
`VERSAO` → `2026-09-11-z2`, cache do service worker →
`roteiros-b7-v42`.

## Build 2026-09-11-z3 — Status Semanal: situações equipe × cliente, novos tipos de demanda sem etapa, e a Linha Editorial como demanda

**Pedido do Yury:** três coisas na mesma mensagem —
1. Situações mais específicas, com exemplos: "aguardando aprovação do
   cliente", "aprovado pelo cliente", "em desenvolvimento" — deixando
   claro, em cada situação, o que depende da equipe e o que depende do
   cliente.
2. Tirar o campo ETAPA do Status Semanal — "já tem o que fala sobre a
   situação", então etapa virou redundante.
3. A produção da Linha Editorial do cliente aparecer também na parte
   das demandas: "quando concluirmos uma linha editorial, ou em
   edição, vai aparecer na parte das demandas."

**Implementado e testado:**

- **Toda situação agora diz de quem depende.** Convenção nova, em
  qualquer contexto: um rótulo terminado em "... do cliente"/"... pelo
  cliente" é sempre uma decisão do cliente; todo o resto é trabalho da
  equipe B7. Renomeado em `js/doc-semana.js` (`ESTAGIOS`, `SITUACOES`,
  `LEGENDA_TEXTO`): "Aguardando aprovação" → "Aguardando aprovação do
  cliente"; "Aprovado"/"Aprovada" → "Aprovado pelo cliente"/"Aprovada
  pelo cliente"; "Em produção" → "Em desenvolvimento" (Genérico/
  Ajustes). Cor por família de significado, não por formato: QUALQUER
  situação "Aguardando ... do cliente", em qualquer contexto, usa a
  mesma cor âmbar; toda decisão do cliente a favor ("Aprovado/
  Confirmada/Validado pelo cliente") usa o mesmo verde; a única decisão
  negativa ("Reprovado pelo cliente") ganha cor vermelha própria, nova
  nesta rodada. Isso deixa visualmente óbvio, em qualquer relatório, o
  que trava com a B7 e o que trava com o cliente — sem precisar ler o
  texto pra saber.
- **ETAPA saiu do editor.** O campo `formato` (renomeado na tela pra
  "TIPO DE DEMANDA") agora cobre sozinho o que antes precisava dos dois
  campos: além de Card/Carrossel/Reel/Story/Capa de Reel, passou a
  aceitar também Gravação, Reunião, Aprovação, Ajustes, Entrega e Outro
  — cada um com vocabulário de situação próprio (novo em
  `ESTAGIOS`), igual os formatos de peça sempre tiveram:
  - **Reunião**: A agendar → Aguardando confirmação do cliente →
    Confirmada pelo cliente → Realizada (ou Remarcada/Cancelada).
  - **Aprovação**: Em preparação → Aguardando aprovação do cliente →
    Aprovado pelo cliente (ou Reprovado pelo cliente).
  - **Ajustes**: Em desenvolvimento → Aguardando validação do cliente
    → Validado pelo cliente → Concluído.
  - **Entrega**: Em preparação → Aguardando confirmação do cliente →
    Entregue.
  - Nenhuma migração de banco: a coluna `etapa` continua existindo
    (texto livre, nunca teve constraint) e continua sendo lida pra
    demanda antiga que só tinha etapa preenchida (`contextoDe` em
    `js/doc-semana.js` agora casa qualquer etapa que bata com um
    contexto conhecido, não só "Gravação" como antes) — só o campo
    deixou de aparecer separado no editor. Escolher um tipo novo grava
    em `formato` e zera `etapa`, migrando o item naturalmente.
- **Linha Editorial como demanda.** Nova função
  `itemLinhaEditorial(ctx)`: sempre que o relatório está vinculado a
  uma linha editorial (`status_semanais.linha_id`), uma demanda
  sintética — nunca uma linha do banco, sempre derivada na hora de
  montar o relatório — entra junto das outras, no grupo "sem data"
  (a linha não é um evento de um dia só). O título é o nome da linha; a
  situação é **exatamente** o status real dela (`linhas.status`: "Em
  criação", "Em revisão", "Aprovada", "Finalizada" — o mesmo campo que
  a equipe já muda na tela da própria Linha Editorial). Como nunca é
  escolhida manualmente, nunca fica dessincronizada: muda sozinha
  quando a equipe avança o estágio da linha ou quando o cliente aprova.
  Aparece tanto no documento do cliente (com selo de formato "Linha
  editorial", cor verde-petróleo própria) quanto no editor (card
  informativo, só leitura, com link "Abrir" pra ir na Linha Editorial —
  pra mudar a situação, é lá que se muda, não aqui).
- Editor: card "TIPO DE DEMANDA" removeu o texto "— opcional" (agora é
  o único jeito de dizer o que é a demanda, não mais opcional de fato);
  aviso "Atenção nesta semana" e o painel de "situações a revisar"
  (build anterior) atualizados pros novos rótulos.
- Testado com Playwright: confirmei que o campo ETAPA não existe mais
  no editor; que os dropdowns de Reunião e Aprovação mostram exatamente
  o vocabulário novo; que o seletor de TIPO DE DEMANDA lista os tipos
  novos e NUNCA lista "Linha editorial" (não é escolhível à mão); que o
  card da linha editorial aparece no editor com o nome e status reais;
  que o documento do cliente lista a linha editorial junto das outras
  demandas; e que toda situação "Aguardando ... do cliente" renderiza
  com a mesma cor âmbar em qualquer contexto. Rerrodei toda a suíte de
  regressão anterior (11 + 3 + 2 testes dos builds `-y`/`-z`/`-z2`),
  ajustando só os rótulos esperados nos dois testes que checavam o
  vocabulário antigo do Card — sem nenhuma outra quebra.
- `node --check` em `js/doc-semana.js`, `js/semana.js` e `js/portal.js`
  (corrigido ali um fallback que só lia `etapa`; agora lê `formato`
  primeiro, senão fica em branco pra demanda nova sem etapa).

**Não implementado por decisão consciente:** a Linha Editorial ainda
não pode ser criada nem ter a situação trocada a partir do Status
Semanal — é só espelhada. Pra mudar o estágio dela, o caminho continua
sendo a tela da própria Linha Editorial (o link "Abrir" leva direto
pra lá). Isso evita duas fontes de verdade pro mesmo dado.

Arquivos alterados: `js/doc-semana.js`, `js/semana.js`,
`styles/semana.css`, `js/portal.js`, `js/auth.js`, `sw.js`.
`VERSAO` → `2026-09-11-z3`, cache do service worker →
`roteiros-b7-v43`.

## Build 2026-09-11-aa — Cores do status do Criativo, Copiar legenda, Detalhe de leitura da Postagem

Três refinamentos pedidos juntos para a Linha Editorial — especificamente
para as abas **Criativos** e **Postagens** (não mexi em Status Semanal,
Calendário, aprovações, autosave, Carrossel, Pilares, exportações ou
papéis — tudo isso continua exatamente como estava). Antes de mexer,
auditei a implementação atual em vez de assumir que os nomes de status
do prompt batiam com os nomes reais do sistema — e não batiam: hoje o
Criativo tem 6 status (`Ideia`, `Em criação`, `Em revisão`, `Aprovado`,
`Programado`, `Publicado`), não 8. "Ajustes" e "Aguardando cliente" não
existem como status reais de Criativo — não criei token de cor pra eles.

### Implementado e testado

- **Cores do status do Criativo, num sistema próprio.** O status do
  Criativo usava o mesmo componente CSS (`.chip-revisao`) que a Peça de
  Design e a Linha Editorial também usam — mexer ali vazaria cor pros
  outros dois. Criei um sistema dedicado (`.status-conteudo` +
  `styles/global.css`, tokens `--laranja`/`--violeta-bg` novos, resto
  reaproveita `--erro`/`--ambar`/`--neutro`/`--ok` que já existiam):
  Ideia = vermelho, Em criação = laranja, Em revisão = âmbar, Aprovado =
  roxo forte, Programado = cinza neutro, Publicado = verde — sempre com
  o texto do status do lado (nunca só a cor). Testei que as 6 cores são
  todas distintas entre si, no claro e no escuro, e que nenhum card de
  Criativo usa mais `.chip-revisao` (Peça de Design e Linha Editorial
  seguem com as cores de sempre, confirmado sem mudança). O grupo de
  botões de status dentro do editor do Criativo também ganhou a mesma
  cor no botão selecionado. O sistema de cor do calendário
  (`--cal-post`/`--cal-grav`, cor por TIPO de evento) não foi tocado.
- **"Copiar legenda", uma implementação só, usada nos dois lugares.**
  Criei `B7.UI.copiarTexto()` (Clipboard API com fallback de
  `execCommand`, toast "Legenda copiada."/"Não foi possível copiar a
  legenda.") e reaproveitei em Criativos e Postagens — nunca duas
  versões que podem divergir. Em **Criativos** (Card e Carrossel, os
  únicos formatos com legenda), o botão lê o valor **ao vivo do
  campo na hora do clique** — testei digitando um texto novo e clicando
  em "Copiar legenda" antes dos 650ms do debounce do autosave: copiou
  o texto digitado, não o valor antigo salvo no banco. Em **Postagens**,
  a ficha de leitura copia o valor canônico já persistido. Nos dois
  lugares, o texto copiado é exatamente o que está na tela — sem
  "Legenda:", sem aspas, com quebras de linha/emoji/hashtag/acentos
  preservados (testei com um texto com tudo isso junto). Quando não há
  legenda, a seção inteira some (nunca um botão fingindo que vai
  funcionar) — testado com um Criativo de legenda vazia.
- **Detalhe de leitura da Postagem.** Clicar numa Postagem (lista ou
  calendário) não abre mais o editor do Criativo: abre uma ficha
  estritamente de leitura, reaproveitando o painel do QuickView que já
  existia (não criei um segundo componente de "espiada"). Testei que
  essa ficha nunca tem input/textarea/select. Ela mostra só os campos
  que o formato realmente tem — corrigi de passagem uma lacuna que a
  auditoria achou: o Carrossel tinha campo de legenda no editor mas a
  visualização rápida não mostrava; agora mostra, com "Copiar legenda"
  junto. O botão "Abrir nos Criativos" só aparece pra quem realmente
  pode editar Criativo (mesma regra que já existia pra quem manda pra
  Design — não é só esconder o botão: mesmo que alguém sem permissão
  chegasse lá, o editor de Criativo já trava sozinho pra Designer).
  Testei os dois papéis: coordenador vê o botão, designer não vê.
- **Teclado e foco.** A linha da Postagem na lista virou
  `role="button" tabindex="0"` com Enter/Espaço funcionando (o evento
  do calendário já era um `<button>` de verdade). Escape fecha a ficha
  e o foco volta pro elemento que abriu — testei os dois. Label
  acessível no botão de copiar e no `role="dialog"`.
- Testado em 390px de largura com a ficha aberta: sem estouro
  horizontal. Testado no modo escuro: as 6 cores do status continuam
  distintas.
- Rerrodei toda a suíte de regressão do Status Semanal (11 + 7 testes
  dos builds anteriores) sem nenhuma quebra — este build não encostou
  em `js/doc-semana.js` nem `js/semana.js`.
- `node --check` em `js/ui.js`, `js/linha.js`, `js/extras.js`; chaves
  de `styles/global.css` e `styles/conteudo.css` conferidas.

### Implementado, mas requer validação adicional

- A navegação circular por Tab dentro da ficha (Tab no último elemento
  volta pro primeiro, Shift+Tab no primeiro vai pro último) foi
  implementada, mas só testei automatizado a devolução de foco via
  Escape — não simulei a sequência de Tab em si. Vale um teste manual
  rápido antes de considerar 100% coberto.
- O tamanho de toque do botão "Copiar legenda" dentro da ficha ficou em
  ~38px de altura (perto do mínimo recomendado de 40-44px) — os outros
  botões do sistema (`.b`) só garantem 40px dentro do breakpoint mobile
  específico; deixei esse um pouco maior sempre, mas não medi em
  dispositivo real.
- Não simulei o caminho de falha do clipboard (permissão negada) — o
  toast de erro existe no código ("Não foi possível copiar a legenda."),
  mas não reproduzi esse cenário num teste automatizado.

### Não implementado por bloqueio

- Nenhum item ficou de fora por bloqueio técnico. "Ajustes" e
  "Aguardando cliente" não ganharam token de cor de propósito — não são
  status reais de Criativo hoje (`STATUS_CONTEUDO` só tem os 6 listados
  acima); criar cor pra um status que não existe seria inventar estado,
  o que este sistema evita desde a primeira rodada.

Arquivos alterados: `js/ui.js`, `js/linha.js`, `js/extras.js`,
`styles/global.css`, `styles/conteudo.css`, `js/auth.js`, `sw.js`.
`VERSAO` → `2026-09-11-aa`, cache do service worker →
`roteiros-b7-v44`.

## Build 2026-09-11-ab — Bug: arrastar sequestrando a seleção de texto (roteiro e slides do Carrossel)

**O problema relatado:** ao escrever o texto de uma cena no roteiro e
tentar selecionar um trecho arrastando o mouse, em vez de selecionar o
texto, o sistema arrasta o card inteiro (a mesma coisa que já
acontecia com o campo de texto dos slides do Carrossel).

**Causa real:** o card da cena (`.cena`, em `js/editor.js`) e o item de
slide/story (`.item-slide`, em `js/linha.js`) têm `draggable="true"` no
elemento inteiro, para dar suporte a "arrastar para reordenar". O
problema é que isso vale pra QUALQUER clique-e-arraste dentro do card
— inclusive dentro do `<textarea>`/`<input>` de texto. O navegador
interpreta "clicou e arrastou" ali como o início de um drag nativo do
elemento, não como seleção de texto, e sequestra o gesto.

### Implementado e testado

- **Correção em `js/editor.js` (cena do roteiro) e `js/linha.js`
  (slides do Carrossel e frames de Story)**: o card continua com
  `draggable="true"` por padrão, mas agora um `mousedown` no card
  decide, na hora, se o drag deve ficar ligado ou desligado — se o
  clique começou dentro de um campo de texto (`input`, `textarea`,
  `select` ou `contenteditable`), `draggable` vira `false` e o gesto
  vira seleção de texto normal; se começou em qualquer outro lugar do
  card (a alça "⠿ Arraste para reordenar", o cabeçalho, etc.),
  `draggable` continua `true` e arrastar para reordenar funciona
  exatamente como antes.
- Testei com Playwright, simulando o clique real (mousedown na posição
  exata do campo, não só disparando o evento): dentro do texto da cena
  e dentro do texto do slide, `draggable` desliga; segurando pela alça
  ou por fora dos campos, `draggable` continua ligado; e confirmei que
  a seleção de texto de verdade funciona (`textarea.selectionStart/End`
  reflete o trecho selecionado).
- `node --check` em `js/editor.js` e `js/linha.js`. Rerrodei toda a
  suíte de regressão anterior (Status Semanal + Criativos/Postagens,
  29 testes) sem nenhuma quebra — nenhuma tela além de reordenar cena/
  slide foi tocada.

### Não implementado por bloqueio

- Nenhum. O card do Kanban (`js/kanban.js`) também é `draggable="true"`,
  mas não tem nenhum campo de texto editável dentro — conferido no
  código, não precisa da mesma correção.

Arquivos alterados: `js/editor.js`, `js/linha.js`, `js/auth.js`,
`sw.js`. `VERSAO` → `2026-09-11-ab`, cache do service worker →
`roteiros-b7-v45`.

## Build 2026-09-11-ac — Pilares: "Nome do pilar" virou "Tipo de pilar" (lista fechada)

O campo de texto livre "NOME DO PILAR" (na aba Estratégia, seção de
Pilares de Conteúdo) virou um seletor "TIPO DE PILAR" com 5 opções
fixas: Entretenimento, Educativo, Inspirador, Conversão, Institucional.

### Implementado e testado

- `js/conteudo.js`: nova constante `TIPO_PILAR` (as 5 opções, exportada
  pelo módulo `B7.Conteudo`, mesmo padrão de `FUNIL`/`STATUS_CONTEUDO`).
- `js/linha.js` (`cardPilar`): o campo virou `<select>` no lugar do
  `<input>` de texto livre, continua gravando na mesma coluna (`nome`)
  — não precisou de migration nem mudou o formato do dado no banco,
  só a forma como a equipe escolhe o valor.
- **Pilares antigos com nome livre são preservados, nunca trocados ou
  apagados sozinhos.** Se o pilar já tinha um nome que não é nenhuma
  das 5 opções (ex: "Autoridade", de antes desta mudança), o select
  mostra esse valor como uma opção extra "(personalizado)", selecionada
  — a pessoa só muda se quiser. Pilar sem nome nenhum mostra
  "Selecione" (vazio), sem forçar um valor.
- Testado: o campo é mesmo um `<select>` (não sobrou nenhum `<input>`
  de texto livre); as 5 opções estão todas lá; um pilar já com
  "Educativo" aparece selecionado; um pilar com nome livre antigo
  ("Autoridade") continua com esse valor, com a opção extra
  "(personalizado)"; um pilar sem nome mostra vazio; trocar o valor no
  select funciona e grava.
- Troquei também os textos que mencionavam "Nome do pilar"/"Pilar sem
  nome" pelos equivalentes de "tipo" nos outros lugares que mostram o
  pilar (visão de leitura do Designer, distribuição por pilar, dica de
  "comece com dois ou três" na lista vazia) — sem mexer em nenhuma
  outra regra (percentual, funil, objetivo, observações, exclusão,
  distribuição real × planejado, congelamento na aprovação do cliente
  continuam exatamente como estavam).
- `node --check` em `js/linha.js` e `js/conteudo.js`. Rerrodei toda a
  suíte de regressão anterior (35 testes: Status Semanal, Criativos/
  Postagens, seleção de texto no roteiro/slides) sem nenhuma quebra.

### Não implementado por bloqueio

- Nenhum.

Arquivos alterados: `js/conteudo.js`, `js/linha.js`, `js/auth.js`,
`sw.js`. `VERSAO` → `2026-09-11-ac`, cache do service worker →
`roteiros-b7-v46`.

## Build 2026-09-11-ad — Rodada 4 do redesign do Designer: navegador de Carrossel e Stories

Rodada 4 do plano de UX do Designer (`PLANO_UX_DESIGN_RESTANTE.md`):
dentro do Design Piece Workspace (a tela quase cheia entregue na
Rodada 3), o briefing de Carrossel e de Stories deixou de ser uma
lista empilhada de todos os slides/frames de uma vez e virou um
navegador — um slide/frame em destaque por vez, com numeração
clicável e setas, igual a um carrossel de verdade.

### Implementado e testado

- `js/design.js`: nova seção de navegador, reaproveitando a mesma
  arquitetura da Rodada 3 (`conteudoPrincipal()` despacha por tipo de
  conteúdo, `drawer` guarda o estado da peça aberta, `desenharDrawer()`
  redesenha tudo):
  - `navegadorSlides(itens, tipoItem)` monta o navegador: pills
    numeradas (01, 02, 03…) com a atual em destaque, setas ‹ › para
    andar um de cada vez, e um botão "Ver todos (N)" que troca pra
    lista clássica empilhada (com "Ver em navegador" pra voltar) —
    pensado pra quem prefere rolar tudo de uma vez em vez de navegar.
  - Navegação por clique na pill, clique nas setas, e teclado: com o
    foco dentro do navegador, seta ← / → do teclado andam pro
    slide/frame anterior/próximo (sem interferir em nenhum outro atalho
    de teclado do resto da tela — testado que Escape continua fechando
    o workspace normalmente).
  - As setas desabilitam nas pontas (não tem "anterior" no slide 1,
    nem "próximo" no último) e o foco do teclado volta pra pill/seta
    certa depois de cada navegação, pra quem usa teclado não perder o
    lugar.
  - Com 1 slide/frame só, não aparecem pills nem setas (não faz sentido
    navegar entre um item único) — só o card do conteúdo.
  - Sem nenhum slide/frame cadastrado, mostra a mensagem "Nenhum slide/
    story cadastrado", igual ao resto do app (nunca finge que tem
    conteúdo).
  - **As regras de CAPA e CTA do Carrossel continuam exatamente as
    mesmas de antes** (slide 1 = CAPA, último = CTA, calculado pela
    posição no array — nunca guardado no banco): reusei a mesma lógica
    de rótulo que já existia (a mesma do editor de Criativos, em
    `js/linha.js`). Stories não tem CAPA/CTA por frame — só "STORY 01",
    "STORY 02"… — porque essa regra nunca existiu pra Stories.
  - Continua 100% somente leitura: nenhum input, textarea ou campo
    editável dentro do conteúdo principal do workspace, só no painel
    lateral (responsável/prazo/prioridade/upload), do mesmo jeito que
    já era pro Card e pra Capa de Reel na Rodada 3.
- Limpei um pedaço de código morto: a função que antes desenhava o
  briefing tinha os ramos de Card, Reel, Carrossel e Story todos
  juntos, mas os de Card/Reel já não eram mais chamados dali desde a
  Rodada 3 (tinham virado telas próprias) — sobrava só como código
  inalcançável. Ficou só o caso de peça manual (sem conteúdo vinculado
  dos Criativos) e um aviso de segurança pra formato não reconhecido.
- `node --check` em `js/design.js`.
- Testei com Playwright (peças fictícias de Carrossel com 5 slides, 1
  slide só, e 0 slides; Story com 3 frames): pills corretas e a atual
  destacada; setas ‹ › navegam e desabilitam nas pontas certas; ArrowLeft/
  ArrowRight do teclado navegam quando o foco está no navegador; "Ver
  todos"/"Ver em navegador" alternam a visualização; CAPA aparece no
  slide 1 e CTA no último do Carrossel (e nos dois ao mesmo tempo
  quando só tem 1 slide); Stories não mostra CAPA nem CTA por frame,
  só o campo geral "CTA" do conteúdo; mensagem de vazio aparece sem
  slides cadastrados; nenhum input/textarea dentro do conteúdo
  principal; nenhum erro de JavaScript em nenhum cenário. Testei
  também em mobile (390px) e tema escuro — sem estouro horizontal, sem
  erro. Rerrodei a suíte de regressão da Rodada 3 (Card, Reel, Central
  de Design) e a suíte de Status Semanal/Criativos/Postagens/seleção
  de texto — sem nenhuma quebra.

### Não implementado por bloqueio

- Nenhum.

### Observação

- Ao rodar a suíte antiga de regressão mais ampla, um teste específico
  da Rodada 2 (`t_design_r2.py`, visão de coordenador na página
  "Design") apontou um resultado que merece checagem — não é algo que
  toquei nesta rodada (Rodada 4 mexeu só no conteúdo principal do
  workspace de Carrossel/Story), mas fica registrado pra auditoria
  futura em vez de ignorado.

Arquivos alterados: `js/design.js`, `styles/design.css`, `js/auth.js`,
`sw.js`. `VERSAO` → `2026-09-11-ad`, cache do service worker →
`roteiros-b7-v47`.

## Build 2026-09-11-ae — Rodada 5a: miniatura otimizada + placeholder por formato

Rodada 5 do plano de UX do Designer acabou grande demais pra um build
só (a mesma situação da Rodada 3), então ficou dividida: esta é a
parte 1 (miniatura + placeholder). A parte 2 (Linha Editorial do
Designer como componente próprio, navegação reduzida) ainda não foi
iniciada — ver observação no fim.

**O problema**: todo lugar que mostra uma prévia pequena de uma peça
(o card de 52px na fila, a bolinha do navegador do Carrossel/Story da
Rodada 4) baixava o ARQUIVO ORIGINAL inteiro — a mesma imagem de
produção em alta resolução — só pra desenhar um quadradinho. Numa fila
com muitas peças, isso é banda de verdade desperdiçada. Além disso, se
o último arquivo enviado como "prévia" era um vídeo ou PDF (em vez de
imagem), o card tentava montar ele como imagem de fundo e ficava
quebrado/vazio, sem avisar nada — bug antigo, silencioso.

### Implementado e testado

- **Miniatura gerada no navegador, no momento do upload** (não no
  servidor): `js/database.js` (`_gerarMiniaturaImagem`) usa
  `<canvas>` pra reduzir a imagem enviada pro lado maior de 320px,
  exporta como JPEG (qualidade 0.72), e sobe ela pro mesmo bucket
  `design-files`, no mesmo caminho do arquivo original + `-thumb.jpg`.
  Escolhi fazer isso no navegador (em vez de usar a transformação de
  imagem do Storage do Supabase) porque aquele recurso é de plano
  pago — assim funciona em qualquer plano, sem depender de nada extra
  configurado no projeto.
  - Só tenta gerar miniatura pra formatos raster comuns (jpeg, png,
    webp, gif). Qualquer outro tipo de arquivo (vídeo, PDF, arquivo de
    design nativo tipo .psd/.ai) não gera miniatura — nunca tenta, nem
    falha tentando.
  - Se a geração falhar por qualquer motivo (imagem corrompida,
    navegador sem suporte), o upload do arquivo original **continua
    normal** — a miniatura é só uma otimização, nunca bloqueia nada.
  - Migração `migration_design_thumb.sql`: coluna nova
    `design_arquivos.caminho_thumb`; a função `design_arquivo_registrar`
    aceita esse caminho (parâmetro novo, opcional — chamada antiga
    continua funcionando); a view `design_resumo` passou a expor
    `ultima_previa_thumb` e `ultima_previa_mime`.
- **Cards e navegador usam a miniatura quando ela existe** — `js/
  design.js` (`fontePrevia`): prefere `ultima_previa_thumb`; se não
  existir (peça enviada antes desta rodada), cai pro arquivo original
  **só se ele for mesmo uma imagem**; se o último preview for
  vídeo/PDF/etc., não usa nenhum dos dois — mostra o ícone de
  placeholder por formato (o mesmo que já existia pra "sem prévia
  nenhuma"), corrigindo o card quebrado de antes.
- **A prévia grande do workspace (Rodada 3) continua usando o arquivo
  original**, nunca a miniatura de 320px — é a peça inteira, a pessoa
  abriu de propósito pra ver a arte de verdade; só ganhou a mesma
  proteção de placeholder quando o preview não é imagem.
- Compatível com peças antigas: nenhuma precisa ser reenviada — só as
  que já eram imagem continuam mostrando o arquivo original até
  alguém subir uma versão nova (aí já ganha a miniatura automática).
- Testado com Playwright, incluindo um upload de verdade (arquivo
  `.jpg` real passado pelo seletor de arquivo, não simulado): subir
  uma imagem gera duas requisições de upload (original + miniatura) e
  a chamada que registra o arquivo no banco leva o caminho da
  miniatura; subir um PDF gera só uma requisição (sem miniatura) e o
  caminho da miniatura vai `null`. Testado também: peça com prévia em
  vídeo mostra o ícone, nunca tenta montar imagem quebrada (no card e
  no workspace); peça com miniatura usa a miniatura no card mas o
  original no workspace; peça antiga (imagem sem miniatura) cai pro
  original; peça sem prévia nenhuma mostra o ícone. `node --check` em
  `js/database.js` e `js/design.js`. Rerrodei a suíte de regressão das
  Rodadas 3 e 4 (Card, Reel, Carrossel, Stories, Central de Design) e a
  suíte de Status Semanal/Criativos/Postagens/tipo de pilar — sem
  nenhuma quebra.

### Implementado mas requer validação adicional

- A migração SQL (`migration_design_thumb.sql`) precisa ser rodada no
  Supabase antes deste build ir pro ar — sem ela, o front-end tenta
  mandar `p_caminho_thumb` pra uma função que ainda não aceita esse
  parâmetro e o upload de arquivo passa a falhar. **Rodar a migração
  primeiro, testar um upload de imagem depois.**
- **Correção 1 (mesmo build, arquivo atualizado):** a primeira versão
  da migração inseria as duas colunas novas (`ultima_previa_thumb`,
  `ultima_previa_mime`) no MEIO da lista de colunas da view
  `design_resumo`, o que o Postgres não aceita num `create or replace
  view` (só permite acrescentar coluna no fim — senão dá erro `42P16:
  cannot change name of view column`).
- **Correção 2 (mesmo build, arquivo atualizado de novo):** a correção
  1 ainda deu o mesmo erro `42P16`, mas apontando pra outra coluna
  (`cliente_logo_url`) — porque eu tinha reconstruído a view a partir
  do SQL de uma migração mais antiga (`migration_editorial_versao.sql`),
  sem notar que `migration_design_logo.sql` (Rodada 3) já tinha
  recriado essa mesma view DEPOIS, acrescentando `cliente_logo_url`
  como última coluna — a versão que está de verdade no banco hoje.
  Corrigido reconstruindo a view a partir da versão certa (a mais
  recente, de `migration_design_logo.sql`), com as duas colunas novas
  só no final, depois de `cliente_logo_url`. Quem tentou rodar
  qualquer uma das duas versões anteriores e recebeu erro pode rodar
  o arquivo corrigido normalmente — nada ficou criado pela metade,
  as partes 1 e 2 da migração (coluna nova, função) já eram seguras
  de repetir.

### Não implementado por bloqueio

- Nenhum.

### Observação

- Esta é só a parte 1 da Rodada 5 (ver `PLANO_UX_DESIGN_RESTANTE.md`).
  A parte 2 — Linha Editorial do Designer virar um componente próprio,
  com navegação reduzida a 4 abas (Peças de Design / Contexto /
  Pilares / Referências) em vez das 5 do Coordenador — é um refactor
  bem maior (mexe num `js/linha.js` de quase 1700 linhas, hoje
  compartilhado pelos dois papéis) e ainda não foi iniciada.

Arquivos alterados: `js/database.js`, `js/design.js`,
`migration_design_thumb.sql`, `js/auth.js`, `sw.js`. `VERSAO` →
`2026-09-11-ae`, cache do service worker → `roteiros-b7-v48`.

## Build 2026-09-11-af — Rodada 5b: Linha Editorial do Designer como componente próprio

Parte 2 da Rodada 5 (a parte 1, miniatura otimizada, foi o build
`-ae`). A página de demanda do Design (`#/design/linha/:id`, que já
existia desde a Rodada 2) tinha um botão "Ver contexto da Linha
Editorial" que levava o Designer PRA FORA do Design inteiro — pro
editor completo da Linha Editorial (`#/linha/:id`), pensado pro
Coordenador editar, com os 5 abas dele e todos os campos abertos, só
desabilitados pra quem é designer. Pra ver 3 informações de leitura
(objetivo do mês, pilares, referências), o Designer saía da tela onde
estava trabalhando e caía num editor que não é dele.

### Implementado e testado

- A página de demanda ganhou 4 abas de topo — **Peças de Design /
  Contexto / Pilares / Referências** — substituindo o botão "Ver
  contexto". As 4 vivem na mesma tela, sem navegação de página:
  - **Peças de Design**: exatamente o que já existia ali (resumo por
    status, subabas Todas/Para fazer/Em criação/Ajustes/Revisão/
    Finalizadas, grade de peças) — só reorganizado como a primeira
    aba, sem nenhuma mudança de comportamento.
  - **Contexto**: objetivo do período, informações gerais (período,
    canais, meta de conteúdos) e posicionamento (marca, tom de voz,
    proposta única de valor, percepção desejada) — tudo texto puro,
    nada de input desabilitado fingindo ser editável.
  - **Pilares**: os pilares de conteúdo do mês (nome, percentual,
    funil, objetivo, observações), com o aviso de soma (100%/faltam/
    passa) — mesma linguagem visual do cartão de pilar só-leitura que
    já existia dentro da Estratégia.
  - **Referências**: os links de referência do mês, um por linha,
    como lista clicável de verdade (antes era um campo de texto
    desabilitado, ficava tudo junto sem quebra visual nem link
    clicável).
  - As 3 abas novas buscam a linha e os pilares só na primeira vez que
    a pessoa clica numa delas (nunca de cara) — fica em cache pelo
    resto da visita a essa linha, sem refazer a consulta ao trocar de
    aba e voltar.
  - Todas as 4 abas são construídas DENTRO de `js/design.js` — não
    tocam em `js/linha.js` nem reaproveitam nenhum código pensado pra
    edição do Coordenador. `js/linha.js` continua existindo do jeito
    que sempre foi, intacto, como o editor completo do Coordenador.
  - Testado com Playwright: as 4 abas aparecem e trocam de conteúdo
    corretamente; nenhuma das 3 abas novas tem input/textarea/select
    (somente leitura de verdade, não input desabilitado); Pilares não
    tem botão de remover; Referências separa link de texto solto (só
    vira `<a>` clicável o que começa com `http://`/`https://`);
    estado vazio limpo quando a linha não tem contexto/pilares/
    referências cadastrados, em vez de seção em branco; a mesma tela
    testada como Coordenador mostra as mesmas 4 abas, também somente
    leitura (não é feature exclusiva do Designer — é sempre um resumo
    de apoio, nunca o editor). `node --check` em `js/design.js` e
    `js/linha.js`. Rerrodei a suíte de regressão das Rodadas 2, 3, 4 e
    5a (página de demanda do Coordenador, Card, Reel, Carrossel,
    Stories, miniaturas) e a suíte de tipo de pilar — sem nenhuma
    quebra.

### Não implementado por decisão consciente

- **Distribuição real × planejado dos pilares** não aparece na aba
  Pilares — esse número precisa da lista de criativos da linha
  inteira, e decidi não buscar ela só pra essas 3 abas de contexto
  (mais uma consulta, pra um dado que já está disponível no editor
  completo do Coordenador). A aba Pilares mostra o planejado
  (percentual/funil/objetivo/observações), não o real.
- **As checagens de `souDesignerSomenteLeitura()` dentro de
  `js/linha.js` não foram removidas.** O objetivo funcional da Rodada
  5b (o Designer não depender mais de `js/linha.js` no caminho normal)
  foi alcançado — ele não passa mais por lá. Mas `js/linha.js`
  continua alcançável por outros links (busca global, "próximo
  conteúdo" no dashboard), então essas checagens continuam servindo de
  rede de segurança pra esses casos, e removê-las traria risco de
  regressão no editor do Coordenador sem nenhum ganho visível pra
  ninguém — decidi não mexer.

### Não implementado por bloqueio

- Nenhum.

Arquivos alterados: `js/design.js`, `js/linha.js` (só um comentário,
sem mudança de comportamento), `styles/design.css`, `js/auth.js`,
`sw.js`. `VERSAO` → `2026-09-11-af`, cache do service worker →
`roteiros-b7-v49`.

## Build 2026-09-11-ag — Rodada 6: notificações, polimento e auditoria final

Última rodada do plano `PLANO_UX_DESIGN_RESTANTE.md` — fecha os
retoques pequenos que sobraram desde a auditoria da rodada `-m` e
audita o que as rodadas 1-5 construíram (performance e mobile), sem
nenhuma tela nova.

### Implementado e testado

- **Ctrl+K vazando ação fora do alcance do Designer.** A paleta de
  comandos (`paleta()` em `js/ui.js`) montava a lista de ações sem
  nenhum filtro de papel, mesmo as ações/rotas equivalentes já
  estando escondidas em todo o resto da interface (barra lateral via
  `B7.Perm.NAV`, botões da própria página via
  `souDesignerSomenteLeitura()`). Achado dois tipos de vazamento, os
  dois corrigidos:
  - Ações que só navegam para uma rota já bloqueada pra Designer por
    `B7.Perm.podeRota()` ("Ir para clientes", "Ver gravações", "Abrir
    status semanal") — clicar caía numa tela de "sem permissão", um
    atalho que não levava a lugar nenhum.
  - Ações que chamam direto uma função de modal de escrita, pulando
    por cima do controle de acesso que a própria página de destino já
    tem ("Nova gravação", "Novo cliente", "Novo status semanal",
    "Novo conteúdo" e "Duplicar mês" quando dentro de uma linha
    editorial) — esse é o achado mais sério, porque o botão
    equivalente foi deliberadamente tirado da tela pro Designer, e o
    atalho contornava isso.
  - Corrigido calculando `souDesigner` uma vez (mesma checagem de
    papel já usada em outros lugares do app) e filtrando as duas
    listas que compõem a paleta: as ações contextuais de dentro de
    uma linha editorial, e a lista geral de ações, separada agora em
    "comuns" (sempre visíveis: Configurações, Alternar tema) e "de
    equipe" (escondidas para o Designer).
  - Testado com `node --check js/ui.js`; sem mudança de comportamento
    pra Admin/Coordenador (a lista de equipe continua completa).

- **Link de notificação quebrado: "linha concluída" apontava pra uma
  rota que nunca existiu.** Ao auditar todo `link :=` gerado dentro de
  `design_processar_evento` (a função que monta as notificações de
  Design), achei que a notificação de "Nova demanda de Design
  atribuída a você"/"disponível" (disparada quando uma Linha Editorial
  é concluída) linkava para `#/design?linha=<id>` — `js/app.js` nunca
  leu esse parâmetro `?linha=` na rota `#/design` (só lê `?aba=`),
  então clicar na notificação sempre abria a fila geral de Design, sem
  nenhum recorte pra a linha que gerou o aviso. As outras 6
  notificações de Design (peça criada, atribuída, versão enviada,
  ajuste solicitado, aprovada, finalizada, demanda assumida) já
  usavam `link := '#/design/' || d.id`, essa rota sempre existiu e
  está correta — não precisaram de mudança.
  - Corrigido em `migration_notificacoes_deeplink.sql`: recria
    `design_processar_evento` com a única linha do link trocada para
    `'#/design/linha/' || ev.alvo_id` — a rota certa, que já existe
    desde a Rodada 2 e ganhou as 4 abas (Peças de Design/Contexto/
    Pilares/Referências) na Rodada 5b.
  - Notificações **já enviadas** com o link antigo não são reescritas
    automaticamente (mexer em histórico está fora do escopo desta
    correção); só as notificações criadas a partir de agora saem com
    o link novo. A migração deixa, em comentário, um `UPDATE` opcional
    pra quem quiser corrigir o link das notificações antigas ainda não
    lidas — não roda sozinho.

- **Distinção visual entre "Ajuste solicitado" (interno da B7) e
  "Ajuste do cliente".** A arquitetura já distingue as duas origens
  desde a Rodada 2/3 (`status = 'ajustes'` × `'ajustes_cliente'`,
  cada uma com seu próprio texto), mas visualmente as duas caíam no
  mesmo vermelho em três lugares — o chip de status nos cards/lista/
  tabela (`.ds-chip`), o rótulo "precisa de mim" na Central de Design
  (`.dsc-motivo`) e o aviso em destaque no topo do workspace da peça
  (`.ds-ws-feedback`) — só o texto avisava quem tinha pedido o ajuste,
  fácil de passar batido numa varredura rápida pela fila.
  - "Ajuste do cliente" agora usa roxo (a mesma cor já usada em
    kanban/calendário pra sinalizar origem "cliente"), mantendo o
    vermelho só para o ajuste interno da B7 — nos três lugares acima.
  - Verificado com screenshot em 375px: chip roxo no card da lista,
    aviso roxo no topo do workspace, nenhuma quebra de layout.

### Auditoria (sem mudança de código)

- **Performance — sem N+1, sem subscription por card.** Toda a fila
  de Design (Central, navegador, página de demanda) vem de uma
  consulta só à view `design_resumo` (já com cliente, linha,
  designer e prévia resolvidos via `select` aninhado na própria
  view); a realtime também é um canal só por sessão
  (`B7.DB.canal('design-...')`, assinando `design_deliverables` e
  `design_versoes` juntos), não um canal por card. Não achei nenhum
  loop com `await`/consulta por item dentro de `js/database.js` ou
  `js/design.js` pras telas de Design. Nada a corrigir.
- **Responsividade mobile das rodadas 1-5.** Testado com Playwright
  em 375px (Central de Design, navegador em "Linhas"/"Peças", as 4
  abas da página de demanda, o workspace de peça) checando overflow
  horizontal da página inteira: nenhuma tela vaza a largura da
  janela. Achado um padrão já existente desde a Rodada 2 e mantido
  como está: as abas de status/filtro (`.ds-abas`, incluindo o
  `.dl-abas-topo` novo da Rodada 5b) rolam na horizontal sem
  indicação visual de que há mais conteúdo pro lado — funciona
  (`overflow-x:auto`, testado por toque), mas sem affordance. Como é
  um padrão consistente já usado em 4 rodadas anteriores sem queixa
  registrada, decidi documentar em vez de mexer, pra não introduzir
  risco visual de última hora numa rodada de fechamento.
  Rerrodada a suíte de regressão das Rodadas 4 e 5b (navegador de
  Carrossel/Stories, miniaturas, as 4 abas da Linha Editorial do
  Designer) — sem quebra.

### Não implementado por decisão consciente

- **Distinção "Feedback interno B7" vs. "Feedback do cliente" além do
  que já foi descrito acima.** Não existe, na arquitetura atual, um
  conceito separado de "feedback do cliente" fora do fluxo de
  aprovação que já existe em `js/aprovacoes.js` (roteiros) e do status
  `ajustes_cliente`/`aprovado_cliente` do Design (peças). A rodada
  tratou a distinção onde ela já existe (peças de Design); não criou
  nenhum conceito novo de feedback.
- **Affordance de rolagem nas abas horizontais** (`.ds-abas`) — ver
  auditoria de mobile acima.

### Não implementado por bloqueio

- Nenhum.

Arquivos alterados: `js/ui.js`, `styles/design.css`, `js/design.js`,
`js/auth.js`, `sw.js`, `migration_notificacoes_deeplink.sql` (nova).
`VERSAO` → `2026-09-11-ag`, cache do service worker →
`roteiros-b7-v50`.
