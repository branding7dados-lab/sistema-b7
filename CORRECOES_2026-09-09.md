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
