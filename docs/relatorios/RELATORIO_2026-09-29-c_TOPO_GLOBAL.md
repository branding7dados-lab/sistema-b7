# Relatório 29/09 (c) — Topo global

## Topbar
Agora existe um topo só (`js/topo.js` + `styles/topo.css`), igual para todos os papéis. O papel muda apenas as ações de Criar, os destinos e as funções que aparecem no menu da conta.

- **Desktop, em ordem:** `[Buscar no B7…  Ctrl K]` · · · `[estado de salvamento, só quando importa]` `[sino]` `[avatar]` `[+ Criar ▾]`.
- **Saíram do topo:**
  - o botão fixo "Nova gravação" (virou uma opção dentro de Criar);
  - o ícone de tema (foi para o menu da conta);
  - o "Salvo ✓" permanente;
  - o menu ⋮.
- **Para onde foi o que estava no ⋮:**
  - "Novo cliente" → Criar;
  - "Ações rápidas" → a própria busca, que é a paleta do Ctrl K;
  - "Exportar/Importar backup" → já existiam em Configurações → Dados (só admin).

  Nenhuma ação sumiu do produto.
- **Topo do editor de roteiros:** continua com as ações do documento (Foco, Baixar, Imprimir e o ⋮ do documento, que é contexto e não lixo). Ganhou o mesmo avatar e perdeu o ícone de tema.

## Busca
- **Uma busca só:** o campo do topo é um gatilho para a mesma paleta do Ctrl K (⌘K no Mac). Não criei um segundo mecanismo de busca.
- **Atalhos:** digitar com o gatilho focado já começa a buscar com a letra digitada, e "/" também abre a busca.
- **Permissão:** o banco já filtra por RLS. Além disso, a busca só mostra resultados cujo destino a pessoa pode abrir (`B7.Perm.podeRota`). Por exemplo, o videomaker não vê linhas editoriais nem status semanal; o designer não vê status semanal.
- **Ações da paleta:** vêm do mesmo resolvedor do Criar.
- **Celular:** a busca vira um ícone de 40 px e abre a paleta, que no celular já sobe como folha (bottom sheet).

## Estado de salvamento
- **Salvando…:** aparece enquanto existe gravação de verdade em andamento.
- **Salvo ✓:**
  - só aparece depois que o banco confirmou;
  - no topo global some sozinho em cerca de 2,5 s;
  - no editor de roteiros fica visível, porque ali o documento é o contexto.
- **Erro ao salvar / Alteração não salva / Sem conexão:**
  - ficam à vista até resolver ou tentar de novo;
  - clicar tenta de novo;
  - ao trocar de tela, só sai o erro de uma ação pontual que já foi avisada por toast;
  - dado pendente ou perdido continua visível em qualquer tela.
- **Telas de leitura** (Painel, Central, listas, calendários): nada aparece.
- **Celular:**
  - salvando ou salvo aparece só como um ponto;
  - erro ou falta de conexão aparecem com texto e tomam o lugar do título da tela.

## Notificações
- **Mesmo sino, mesma lógica:** Realtime e polling não mudaram, e a área de toque é de 40 px.
- **Badge:**
  - compacto, com "99+" quando passa de 99;
  - corrigi um bug antigo em que aparecia um "0" quando não havia nada não lido.
- **Acessibilidade:** o nome acessível diz "Notificações: N não lidas", `aria-expanded` acompanha o painel, e Esc fecha o painel devolvendo o foco ao sino.
- **Celular:** o painel já ocupava a largura inteira da tela.

## Conta
- **Clique no avatar abre um menu com:**
  - nome;
  - todas as funções reais da conta, por exemplo "Administrador · Videomaker";
  - @usuário;
  - Meu perfil;
  - Preferências e configurações;
  - Usuários e acessos (só admin);
  - Atalhos de teclado (só em telas com mouse);
  - Aparência;
  - Sair.
- **Sem troca de perfil:** não existe "entrar como".
- **Prévia:** no "Visualizar como…", o menu mostra a conta real do admin.
- **Painel e Central não entraram no menu:** já estão na barra lateral e na logo.
- **Desktop:** menu suspenso acessível (setas, Home/End, Esc devolve o foco).
- **Celular:** folha que sobe de baixo.

## Aparência
- **Onde fica:** no menu da conta, em Sistema / Claro / Escuro.
- **Implementação:** `B7.definirTema` é a mesma função usada por Configurações → Aparência. Não criei um tema novo.
- **Atalho rápido:** "Alternar tema" continua disponível na paleta.

## Criar
- **Resolvedor único:** `B7.Topo.ACOES` lista cada ação uma vez. Para cada uma:
  - `pode()` usa a permissão real: a rota do módulo dono do fluxo (`B7.Perm.podeRota`, que já soma papel e função extra) e, quando a própria tela restringe o botão, a mesma regra da tela (Design só para a equipe; Linha não para o Designer);
  - `fazer()` chama o fluxo que já existe, sem fluxo novo. Para vídeo, Design e Produção, abre a tela e aciona o próprio botão dela, para o modal nascer com os dados que a tela carrega.
- **Ações:** Nova gravação, Nova demanda de vídeo, Nova linha editorial, Nova demanda de Design, Nova demanda de produção, Novo status semanal e Novo cliente.
- **"Novo roteiro" ficou de fora:** um roteiro só nasce dentro de uma gravação, e não existe um fluxo avulso para ele.
- **Sem duplicatas:** como a lista é de ações e não de papéis, a união de funções nunca repete item.
- **Contexto:**
  - a ação do módulo aberto vem primeiro, marcada "nesta tela";
  - nas telas que já têm o próprio botão magenta de criar (Gravações, Edição de vídeo, Linhas, Design, Clientes, Status semanal, Produção), o Criar do topo fica em contorno, para não ter dois botões primários iguais na mesma tela.
- **Quantidade de ações:**
  - zero: não aparece botão;
  - uma: o botão já é a própria ação (por exemplo "+ Nova demanda de vídeo");
  - várias: "+ Criar ▾".
- **Desktop:** menu suspenso.
- **Celular:** folha com itens de 52 px.
- **Atalhos N (gravação) e C (cliente):** passam pelo mesmo resolvedor.

## Multi-role (testado)
| Conta | Criar | Funções no menu |
|---|---|---|
| Admin + Videomaker | 7 ações, sem duplicar | Administrador · Videomaker |
| Admin | as mesmas 7 | Administrador |
| Admin + Coordenador + Videomaker | 7 | as três |
| Coordenador | 7 (o coordenador tem essas rotas) | Coordenador de mídias |
| Coordenador + Videomaker | 7 | Coordenador de mídias · Videomaker |
| Videomaker | só "Nova demanda de vídeo" (botão direto) | Videomaker |
| Designer | nenhuma (sem botão) | Designer |
| Designer + Videomaker | "Nova demanda de vídeo" | Designer · Videomaker |
| Cliente | nenhuma | Cliente |

Painel e Central continuam exatamente como antes. A regressão dos 9 perfis do Painel passou.

## Responsividade
- **Desktop:** uma linha de 66 px.
- **Tablet (≤1080):** a barra lateral vira gaveta e a busca fica mais curta. "Criar" continua com texto até 601 px.
- **Celular (≤600):** `[☰][🔍]  título da tela  [🔔][avatar][+]`.
  - Criar e conta abrem em folha.
  - No editor de roteiros, o avatar sai no celular para o título do documento caber.
- **Conferido em:** 1920, 1440, 1280, 1024, 820, 768, 390 e 360 px, claro e escuro. Nenhum caso com rolagem horizontal ou item fora da tela.
- **Nome longo** ("Maria Eduarda Albuquerque de Vasconcelos"): quebra dentro do menu e nunca empurra o topo.

## Permissões
Permissões atuais → `B7.Perm.podeRota` (união das funções) + regra da tela dona → lista de ações (uma entrada por ação) → ordem pelo contexto da rota → zero, um ou vários.

Sem sessão, sem `B7.Perm` ou para cliente, a lista é vazia (falha segura). Nada é desenhado antes de a sessão existir, então não há ação indevida piscando na tela. Esconder um item não é segurança: a guarda de rota e o banco continuam valendo.

## Arquivos alterados
- **Novos:** `js/topo.js`, `styles/topo.css`.
- **Alterados:**
  - `index.html`: templates do topo; saíram o tema e o ⋮ global.
  - `js/app.js`: montagem do topo, `B7.definirTema`, atalhos, conta via Topo.
  - `js/autosave.js`: indicador contextual.
  - `js/ui.js`: a paleta passa a ser a busca global, filtrada por permissão.
  - `js/notificacoes.js`: acessibilidade do sino.
  - `js/dashboard.js`: `marcarNav` avisa o topo; Configurações usa `definirTema`.
  - `sw.js`: cache v101.

## Banco
Nenhuma migration.

## Testes (executados)
- **Matriz de Criar:** 9 contas, sem duplicatas, com botão direto quando há 1 ação e sem botão quando há 0.
- **Contexto do Criar:** 7 rotas, conferindo ordem, estilo e título.
- **Busca filtrada por permissão:** 4 perfis.
- **Teclado:** Enter abre o Criar, setas navegam, Esc fecha e devolve o foco, Enter executa o item; digitar no gatilho abre a busca.
- **Salvamento:** leitura sem atividade → salvando → salvo → some em 2,8 s; erro persiste; trocar de tela limpa só o erro pontual.
- **Visual:** desktop, tablet e celular, claro e escuro, badges 0/1/2/99+, nome longo, título longo e erro no celular.
- **`index.html` real carregado sem sessão:** sem erro de JS e com Criar oculto.
- **Regressão:** perfis do Painel.

## Pendências
- **Validar com login real:** Kevin (admin+vm), Mateus (coordenador) e um designer, no desktop e no Android.
- **Atalhos de teclado de criar:** o atalho N continua sendo só "Nova gravação" (quando permitido), e não existe atalho para as outras ações.
- **Designer Painel:** não existe no código atual; a casa do designer continua sendo a Central de Design.
