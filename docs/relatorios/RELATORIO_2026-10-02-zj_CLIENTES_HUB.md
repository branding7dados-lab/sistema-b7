# Relatório — pacote zj/zk · Clientes: hub do cliente + remoção do Onboarding

Data: 02/10/2026 · Versões publicadas: `2026-10-02-zj` (commit 5159f40) e `2026-10-02-zk` (ajuste) · cache `roteiros-b7-v164`

## 1. Resumo

O cliente virou um **hub com contexto fixo**: cabeçalho compacto (logo, nome, última atividade, ações) e uma barra de seções — **Visão geral, Editorial, Gravações, Roteiros, Vídeos, Design, Ideias, Inteligência, Arquivados**. Cada seção tem endereço próprio (`#/cliente/<id>/<seção>`), então voltar, recarregar e link direto funcionam. As seções são recortes dos módulos globais (mesmos registros, mesmas telas de detalhe); nada foi duplicado. O **Onboarding saiu do produto**: interface, rota e código ativo removidos; os dados históricos continuam no banco e no backup.

## 2. Auditoria (antes de mudar)

- `#/cliente/<id>` abria uma capa grande (hero "WORKSPACE · BRANDING7") + abas. **Gravações, Roteiros e Arquivados trocavam de aba sem mudar o endereço** — recarregar ou voltar perdia a aba.
- Editorial, Ideias e Inteligência eram telas separadas, com trilha própria e outro cabeçalho (a sensação de "sair do cliente").
- Vídeos e Design do cliente **não existiam** no cliente — só nos módulos globais.
- Linha editorial sempre mostrava a trilha "Central B7 / Clientes / … / Linhas editoriais", mesmo vindo da lista global (e mostrava "Clientes" para o designer, que não tem essa tela).
- Gravação voltava sempre para `#/gravacoes`; demanda de vídeo sempre para Produção de Vídeo; peça de design fechava para a tela geral de Design.
- Linha duplicada no código (`if (aba === 'ideias')` duas vezes).
- Onboarding: aba no cliente, rota `/onboarding`, ação na paleta de comandos, 4 funções no banco local (listar/criar/atualizar/duplicar) e caso no autosave. No banco: **1 registro** em `onboardings`, 1 atividade com esse tipo, coluna `linhas_editoriais.onboarding_id` (0 linhas usando).
- Lista de clientes: auditada; cards já levam a `#/cliente/<id>` e continuam funcionando — **não mudou**.

## 3. Nova experiência do cliente

- **Cabeçalho compacto** igual em todas as seções (inclusive Editorial, Ideias e Inteligência): "‹ Clientes", logo, nome (até 2 linhas, sem estourar), "atualizado …", **Nova gravação** e **Resumo do mês** à vista no computador; no celular tudo vai para o "⋯" (Editar cliente, Visualizar como cliente — admin —, Excluir).
- **Barra de seções** com sublinhado na ativa; no celular rola de lado e a ativa fica centralizada.
- **Vídeos** (novo): "Em produção" / "Entregues" com contagem; cada linha mostra título, código, videomaker, prazo (atrasado em destaque, mesma regra da Produção de Vídeo) e a situação. Atalho para a Produção de Vídeo.
- **Design** (novo): "Em andamento" / "Finalizadas"; tipo, linha, prazo e status. Atalho para Design.
- Se não há nada em andamento mas há entregues/finalizadas, a seção já abre no grupo com conteúdo (zk).
- **Editorial**: primeiro a lista de linhas do cliente (mês a mês); só ao escolher uma linha abre o espaço completo da linha.
- **Inteligência**: o resumo de progresso não repete mais logo e nome (já estão no cabeçalho).
- Cada seção carrega **só o que mostra** (abrir "Vídeos" não busca gravações, linhas e status).
- Estados: carregando (esqueleto), vazio com explicação e caminho, erro com "Tentar novamente"; cliente inexistente/sem acesso mostra "Cliente não encontrado" com volta para Clientes.

## 4. Navegação contextual

| Entrada | Trilha / Voltar |
|---|---|
| Cliente → Editorial → linha | Clientes / cliente / Editorial / mês |
| Linhas editoriais (global) → linha (`?de=linhas`) | Linhas editoriais / cliente / mês |
| Designer (sem tela de Clientes) → linha | Linhas editoriais / cliente / mês |
| Cliente → Gravações → gravação (`?de=cliente`) | "‹ nome do cliente" → Gravações do cliente |
| Gravações (global) → gravação | "‹ Gravações" (como antes) |
| Cliente → Vídeos → demanda (`?de=cliente`) | cliente / Vídeos / título |
| Produção de Vídeo → demanda | Produção de Vídeo / título (como antes) |
| Cliente → Design → peça (`?de=cliente`) | fechar (✕, ←, Esc, fundo) volta ao Design do cliente |
| Design (global) → peça | fecha sobre a tela de Design (como antes) |

Seção que não existe ou que o papel não pode ver (ex.: designer em `/video`) mostra a Visão geral e corrige o endereço.

## 5. Onboarding removido

- Fora da interface: aba, rota, ação da paleta, funções `listarOnboardings/criarOnboarding/atualizarOnboarding/duplicarOnboarding`, caso no autosave e todo o bloco de telas em `js/conteudo.js`.
- Link antigo `#/cliente/<id>/onboarding` → redireciona para o cliente (sem tela quebrada).
- Histórico de atividades com tipo onboarding continua aparecendo com o rótulo "ONBOARDING" e leva ao cliente.
- **Preservado**: tabela `onboardings` (1 registro), atividade, coluna `linhas_editoriais.onboarding_id`, exportação/importação do backup (continua incluindo `onboardings`).

## 6. Arquivos alterados

`js/dashboard.js` (hub, seções, Vídeos/Design, erros), `js/app.js` (rotas), `js/conteudo.js` (Editorial/Ideias/Inteligência no hub; Onboarding removido; `?de=linhas`), `js/linha.js` (trilha pela origem), `js/gravacao.js`, `js/video.js`, `js/design.js` (voltar pela origem), `js/database.js` (`videoDoCliente`; Onboarding removido), `js/autosave.js`, `js/ui.js` (paleta), `js/permissoes.js` (comentário), `styles/dashboard.css`, `styles/conteudo.css`, `sw.js`, `js/auth.js` (versão).

## 7. Banco de dados

**Nenhuma migration.** Nenhuma tabela, coluna, registro ou arquivo apagado. Leituras novas usam views existentes (`demandas_edicao_resumo`, `design_resumo`) filtradas por cliente.

## 8. Permissões / RLS

- **RLS não foi alterado.** As listas do cliente passam pelas mesmas políticas dos módulos globais.
- Seções aparecem só se o papel pode abrir a tela canônica (`B7.Perm.podeRota`): designer vê Editorial/Gravações/Roteiros/Design…, sem Vídeos; videomaker vê Vídeos, sem Editorial/Design. Arquivados só para equipe interna.
- **Ponto para você decidir (não mudei):** no banco, `clientes` e `gravacoes` liberam escrita para toda a equipe interna — **admin, coordenador, designer e videomaker** (`sou_equipe_interna`). Por isso o cabeçalho continua mostrando Editar/Excluir cliente e Nova gravação para designer e videomaker, como a capa antiga já fazia. Se a ideia é que só admin/coordenador editem ou excluam cliente, isso é mudança de permissão no banco — me avise e faço como pacote separado.

## 9. Responsividade

Celular (emulação 375 e 390 px): cabeçalho em 3 linhas compactas, nome com até 2 linhas, ações no "⋯", seções roláveis, listas sem estourar a largura (largura da página = largura da tela), títulos das listas em até 2 linhas (zk). Computador (1280 px): denso, ações à vista.

## 10. Testes executados

**Local (servidor estático + dados simulados no navegador):** as 9 seções + seção inválida + cliente inexistente; visibilidade por papel (admin, designer, videomaker); trilha da linha com e sem `?de=linhas` e para designer; voltar da gravação com e sem `?de=cliente`; trilha da demanda de vídeo com e sem `?de=cliente`; peça de design fechando para o cliente (com origem) e ficando no Design (sem origem); clique em gravação dentro do hub gerando `?de=cliente`; largura em 375 px; console sem erros além dos simulados.

**Produção (sessão do admin, só navegação/leitura, nada gravado):** AutoEscola Modelo em todas as seções, incluindo `/onboarding` → redirecionou para a Visão geral; Vídeos com 11 entregues reais; abrir demanda → trilha "AutoEscola Modelo / Vídeos / …"; gravação → voltar para o cliente; Sabor da Feira → Design com 15 em andamento / 3 finalizadas; abrir peça e fechar → voltou para o Design do cliente; Editorial → linha → trilha pelo cliente → Voltar do navegador voltou ao Editorial; lista global de Linhas → linha com trilha global; cliente inexistente → "Cliente não encontrado".

**Não testado:** aparelho físico; sessão real de designer/videomaker (só simulada); tema claro em produção (só checagem rápida local).

## 11. Regressões verificadas

Lista de clientes, Linhas editoriais global, Produção de Vídeo, Design, Gravações e o editor de roteiros (`?roteiro=`) continuam com os mesmos caminhos. Links de busca e notificações que apontam para `#/linha/…`, `#/gravacao/…`, `#/video/…` e `#/design/…` seguem abrindo como antes (sem `?de`, comportamento antigo).

## 12. Bugs corrigidos no caminho

Abas sem endereço (Gravações/Roteiros/Arquivados); trilha "Clientes" para o designer na linha; linha duplicada do roteamento de Ideias.

## 13. Limitações

- Peça de design aberta do cliente ainda monta a tela geral de Design por trás da gaveta (fechar volta ao cliente).
- No estado vazio de Ideias, o botão "Anotar primeira ideia" continua aparecendo para o designer (o banco já bloqueia; o botão do topo foi escondido).
- A Visão geral mantém os blocos atuais (métricas, linha editorial, status semanal, gravações, ações rápidas); não ganhou resumo de Vídeos/Design para não pesar o carregamento.

## 14. Próxima etapa

**Marca / Identidade do cliente (Brand)** — não implementada, como pedido. O hub já está pronto para receber a seção: é uma linha a mais em `SECOES_CLIENTE` (js/dashboard.js) + a tela.
