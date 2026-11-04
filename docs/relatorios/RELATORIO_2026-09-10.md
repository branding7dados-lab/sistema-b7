# Relatório — Build 2026-09-10-a
## Kanban 2.0 · Portal do cliente · "Excluir aprovação" · sincronização em tempo real

### 1. Auditoria (o que já existia e foi reaproveitado)

- Um único fluxo de aprovação (`migration_aprovacoes_v2`): funções `aprov_enviar`, `aprov_decidir_parte`, `aprov_decidir`, eventos duráveis em `eventos_dominio` (chave única, retry via `aprov_reprocessar`), notificações em `notificacoes`, projeção no Kanban dentro de `aprov_processar_evento`. **Nada disso foi duplicado.**
- Um único Kanban (`kanban_demandas`, `kanban_comentarios`, `kanban_historico`), já com vínculo opcional ao material canônico (`tipo_vinculo` + `vinculo_id`), posição fracionária, `automacao_travada` e `aprovacao_situacao`.
- Portal do cliente existia com home, aprovações, linha, produção, status e histórico, mas o shell interno era montado antes de saber o papel, a gravação não tinha conceito de "liberada ao cliente" e a prévia do admin não existia.
- Falha real encontrada na projeção: pedido de ajuste **por cena** não movia o card para "Ajustes" (só a decisão do todo movia). Corrigido (item 2).

### 2. Kanban interno (`js/kanban.js`, `styles/kanban.css`, `migration_kanban_v2.sql`)

- **Barra de rolagem da screenshot**: o quadro tem viewport horizontal próprio (`.kb-rolagem`) com a barra nativa escondida **só ali**; grid `minmax(218px, 1fr)` faz as seis colunas caberem em 1669 px com a sidebar aberta; abaixo disso aparecem fades nas bordas e setas ‹ › só enquanto há overflow; rolagem por trackpad, Shift+roda, roda vertical quando a coluna não rola, toque e teclado; auto-scroll ao arrastar perto da borda; `min-width: 0` em toda a cadeia; títulos longos com clamp. Nenhuma rota gera rolagem lateral no documento.
- **Colunas**: A fazer · Em produção · Revisão interna · Aguardando cliente · Ajustes · Pronto, e "Concluídas (n)" como 7ª coluna opcional. Pronto = produção criativa terminou, ainda falta gravar/editar/publicar; Concluída = nada mais a fazer. Aprovação nunca conclui.
- **Automação**: a projeção continua no banco. Novo: trigger `kanban_evento_parte` — `parte.ajustes` leva a **mesma** demanda para Ajustes (cria se não houver); se o cliente retira o último pedido, volta para Aguardando cliente somente se foi a automação que trouxe o card. Índice único parcial `kanban_vinculo_ativo_unico`: um material tem no máximo **uma** demanda ativa (fase diagnóstica antes: se houver duplicatas, a migration lista e não apaga nada).
- **Agregação de feedback**: a view `kanban_resumo` calcula `ajustes_pendentes` (cenas em ajustes + comentários do cliente não resolvidos da versão ativa). O card mostra "N ajustes pendentes · solicitado pelo cliente" e abre a gaveta na aba Feedback, com a versão exata, cada cena com o comentário, comentários gerais e "Marcar resolvido"; resolvidos ficam em histórico.
- **Card**: cliente (logo/iniciais), título, tipo/vínculo, chip de aprovação com versão, faixa de origem do cliente, responsável, prazo, notas internas, trava. Prioridade só aparece quando é alta.
- **Gaveta**: abas Detalhes / Feedback do cliente / Notas internas / Histórico; responsável, prazo, prioridade e coluna gravam na hora, com "Salvando…/Salvo" só após resposta do banco; "Abrir material" leva ao registro canônico; notas internas nunca vão ao portal (RLS: `kanban_*` é só equipe).
- **Demanda manual**: só o título é obrigatório; cliente, responsável, prazo, tipo, prioridade, descrição e vínculo são opcionais (lista materiais do cliente para vincular).
- **Arrastar e soltar**: coluna + ordem persistidas por `kanban_mover` (transação: coluna, posição, `concluida_em`, histórico); fila de movimentos evita corrida; otimista com rollback e toast em erro; posições fracionárias, renormalização só quando a precisão acaba. "Mover para…" no menu ⋮ e atalho `m` para teclado e celular.
- **Celular** (≤760 px): uma coluna por vez com seletor no topo; mover pelo menu.
- **Filtros**: toolbar compacta numa linha (busca, cliente, responsável, tipo, prazo), "Limpar filtros" só quando há filtro, estado persistido na sessão; Quadro/Lista sobre os mesmos dados, lista ordenável.
- **Realtime**: um canal por tela (`kanban_demandas` + `aprovacoes` + `comentarios`), relê só os ids afetados, fechado ao sair da rota. Cards carregam resumo; detalhe só ao abrir.

### 3. Portal do cliente (`js/portal.js`, `js/app.js`, `js/permissoes.js`, `migration_portal_v2.sql`)

- **Sem shell interno nem por um frame**: a navegação e os controles do topo da equipe saíram do HTML estático para `<template>` e só são clonados depois que o papel é resolvido e não é cliente. Cliente em rota interna (`#/kanban`, `#/usuarios`, `#/clientes`, …) é redirecionado para `#/` com aviso.
- **Rotas do cliente**: `#/` (Início) · `#/aprovacoes` (Todos · Pendentes · Ajustes solicitados · Recusados · Aprovados · Histórico) · `#/revisar/<id>` · `#/minha-linha` · `#/minha-producao` · `#/minhas-gravacoes` · `#/meus-status` · `#/historico` · `#/perfil`. `?empresa=<id>` só é aceito se estiver em `sessao.empresas`.
- **Home**: "Olá, <nome>." / "Acompanhe a produção da <empresa>."; "Precisa da sua atenção" com pendências reais (ou "Tudo certo por aqui." / "Não há materiais aguardando sua aprovação."); resumo com status amigáveis (Em produção, Em revisão, Aguardando você, Aprovado, Programado, Publicado); aprovado/alterado recentemente; linha atual; próxima gravação só se tiver data; último status publicado.
- **Produção** (view `portal_producao`): materiais liberados por período e tipo, sem responsáveis, prazos internos ou histórico do Kanban.
- **Gravações** (view `portal_gravacoes`, `security_barrier`): só gravações que a equipe liberou (**menu ⋯ do editor → "Liberar no portal do cliente"**, função `gravacao_liberar_portal`), com nome, data ou "Sem data definida", situação amigável e roteiros por título. O cliente não aprova o fato da gravação.
- **Status semanal**: só publicados; anteriores listados; PDF/PNG pelo mesmo gerador, sem criar versão.
- **Serviço pausado/cancelado**: a tela de bloqueio aparece **sem consultar** material; no banco, `minha_sessao` passou a listar a empresa pausada (antes, com RLS, ela sumia e o portal não sabia o motivo).
- **"Visualizar como cliente"** (ficha do cliente, só admin): abre `#/previa/<id>/…` com banner "Prévia do cliente: <empresa>" + "Voltar ao Admin"; botões de decisão renderizados desabilitados, nenhum comando ligado; consultas com o `client_id` da empresa. O que a prévia **não** simula (o admin é equipe no banco): corte por RLS de serviço pausado, vínculo perfil↔empresa, "Meu perfil" mostra o admin.

### 4. "Excluir aprovação" (`migration_aprovacoes_v3.sql`, `js/aprovacoes.js`)

- Botão só para **admin** (equipe: `#/aprovacoes/<id>`), no todo e por cena. Modal: cliente, material, versão, tipo, data da aprovação, consequência, **motivo obrigatório**, "Mostrar motivo ao cliente", Cancelar / Excluir aprovação.
- `aprov_anular(p_aprovacao_id, p_escopo 'total'|'parte', p_parte_id, p_motivo, p_visivel_cliente)`: `security definer`, exige `perfis.papel = 'admin'` ativo (coordenador e cliente → `42501`), motivo vazio → `P0005`, anular duas vezes → `P0003`. Nada é apagado: grava `anulada_em/anulada_por/anulada_por_nome/anulacao_motivo/situacao_anterior`, preserva `decidido_por/decidido_em`, e **recalcula**: `parcial` se há cena decidida válida, `pendente` se não, `substituido` se já existe versão mais nova. Anular o todo não apaga decisões por cena; anular uma cena afeta só ela e recalcula o todo.
- Evento `aprovacao.anulada` / `parte.anulada` (chave única) processado como os demais: notificação aos clientes da empresa com "A aprovação anterior foi anulada pela Branding7." (motivo só se marcado visível), e aos admins/coordenadores com o motivo, exceto o ator. Kanban: volta para Aguardando cliente só se a coluna atual foi causada por **essa** decisão (Pronto por `aprovacao.aprovada`), não travada, não concluída; caso contrário grava `kanban_demandas.aviso` ("A aprovação foi anulada, mas este material já possui etapas posteriores concluídas. Revise o status da produção.") — aparece no card e na gaveta com "Já revisei".
- Linha do tempo interna: "Aprovação anulada pelo Administrador em dd/mm/aaaa" + motivo. Portal: faixa neutra e o cliente pode decidir de novo pela mesma `aprov_decidir` (a chave do evento passou a incluir `anulada_em`, senão a nova decisão colidia com a antiga e não gerava evento).

### 5. Sincronização

Tudo parte de registros duráveis; Realtime só antecipa a releitura. Assinaturas: sino (`notificacoes` por destinatário), Aprovações equipe (`aprovacoes` + `aprovacao_partes`), portal (`aprovacoes` por `client_id`), Kanban (canal único acima). Nenhum `window.location.reload`; nenhuma refetch global — cada tela relê só o seu domínio. `B7.Rota.aoSair` fecha canais ao trocar de rota.

### 6. RLS e migrations (ordem em `migration_tudo.sql`)

Novas, aditivas e idempotentes (rodadas duas vezes): **13** `migration_aprovacoes_v3.sql` → **14** `migration_kanban_v2.sql` → **15** `migration_portal_v2.sql` → 16 `migration_rls.sql` (corte, por último). Cliente continua sem acesso a `kanban_*`, `gravacoes`, `roteiros`, `eventos_dominio`; as views novas do portal filtram por vínculo perfil↔empresa e serviço ativo; `anon` sem acesso. Nenhum dado histórico é apagado.

### 7. Arquivos alterados

`index.html`, `sw.js` (cache v16), `js/app.js`, `js/auth.js` (versão), `js/aprovacoes.js`, `js/kanban.js`, `js/portal.js`, `js/permissoes.js`, `js/dashboard.js`, `js/editor.js`, `js/database.js`, `styles/kanban.css`, `styles/portal.css`, `styles/aprovacoes.css`, `migration_aprovacoes_v3.sql`, `migration_kanban_v2.sql`, `migration_portal_v2.sql`, `migration_tudo.sql`, `APROVACOES.md`, `CORRECOES_2026-09-09.md`, este relatório.

### 8. Testes realmente executados

- `node --check` em todos os JS e no service worker.
- PostgreSQL 16 real, banco novo: cadeia completa (setup → … → push → v3 → kanban_v2 → portal_v2, as três novas **duas vezes**) → admin semeado → corte do RLS → suítes: aprovações v2 (9 erros esperados, nenhum a mais), Kanban (enviar → 1 demanda em Aguardando cliente → cliente pede ajustes em 2 cenas + 1 comentário → **a mesma** demanda em Ajustes com 3 pendentes → retira 1 → 2 → reenvio v2 → Aguardando cliente com 0 pendentes → aprovação → Pronto sem `concluida_em`; `kanban_mover` como cliente → 42501; segunda demanda ativa para o mesmo roteiro → 23505), anulação (total, por cena, notificações neutra/com motivo, Pronto → Aguardando cliente com histórico, demanda concluída → aviso sem mover, versão antiga → substituído, coordenador/cliente → 42501, sem motivo → P0005, duas vezes → P0003, cliente decide de novo e gera evento/Kanban), portal (cliente A não lê nada da B nem `kanban_*`; `client_id` forjado → 0 linhas; pausado → 0 linhas e sessão informa "pausado"; anon negado). 0 eventos com erro ao final.
- Chromium headless com REST/RPC simulados: todas as rotas internas e do portal sem erro de JS; Kanban em 1669×844 (viewport da screenshot), 1280, 1024, 768 e 390 sem overflow no documento, barra nativa ausente no quadro, 6 colunas visíveis em 1669, setas/fades só com overflow, arrastar persiste e faz rollback em erro, "Mover para…", modo celular, gaveta com abas, lista; portal: observador de DOM desde o boot confirma que a navegação interna **nunca** entra no DOM do cliente, redirecionamento das rotas internas, `?empresa` inválido recusado, bloqueio de serviço, prévia do admin com botões desabilitados e retorno ao admin; anulação: modal, chamada `aprov_anular` com os parâmetros certos, coordenador sem botão, faixa neutra no portal.

### 9. O que ainda exige verificação em produção

- O ciclo ponta a ponta do item "EXACT AUTOMATION TEST" com **sessões reais** (Realtime do Supabase não conecta a partir deste ambiente; os handlers foram testados por injeção). Roteiro sugerido: enviar roteiro de teste → como cliente pedir ajuste numa cena → conferir sino, Aprovações e Kanban sem recarregar → reenviar → aprovar → como admin "Excluir aprovação".
- Publicação `supabase_realtime` contendo `kanban_demandas`, `kanban_comentarios`, `aprovacoes`, `aprovacao_partes`, `comentarios`, `notificacoes` (as migrations adicionam se a publicação existir; conferir em Database → Publications).
- Arrastar com toque/trackpad reais, safe-area no iPhone, teclado virtual.
- Migration `kanban_v2` em banco com duplicatas de demanda ativa: ela avisa e não cria o índice até você arquivar/concluir a duplicata e rodar de novo.

### 10. Para aplicar

1. Subir o zip `sistema-b7-2026-09-10-a` (substituindo tudo).
2. SQL Editor, nesta ordem, se ainda não rodou: `migration_aprovacoes_v2`, `migration_pilares`, `migration_presenca`, `migration_push`, depois as novas `migration_aprovacoes_v3`, `migration_kanban_v2`, `migration_portal_v2`.
3. `b7-auth` republicado (arquivo já enviado). `b7-push` continua opcional.
4. `Ctrl+Shift+R` — rodapé do login deve mostrar `2026-09-10-a`.
