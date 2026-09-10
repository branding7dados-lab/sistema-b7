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
