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
