# Relatório 29/09 (e) — Painel do Designer (fase 3)

## Painel do Designer
- **Mesma rota:** `#/painel`. A visão é escolhida pelas funções reais da pessoa (`B7.Perm.painelVisoes()` agora inclui `design`). Não existe `#/painel-designer`.
- **Quem vê:** o Designer pelo papel principal ou pela função extra "designer" (`B7.Perm.souDesignerElegivel`).
- **Casa padrão:** o Designer (e o Admin + Designer) abre no Painel. A regra é a mesma do vídeo e da coordenação: `aplicarCasaPadrao`, logos e primeiro item da barra inferior.
- **Central de Design:** continua existindo em `#/`, intacta, com o nome "Central de Design". No celular ela fica no "Mais".
- **Arquivos:** `js/painel-design.js` (`B7.PainelDesign`). Ele usa os primitivos que o Painel já tinha (`B7.Painel.ui`): cabeçalho, KPI, linha de atenção, dia da semana, blocos de carregando, erro e vazio. Não criei um motor genérico.
- **Cabeçalho:** data, saudação e funções reais. A ação é **"Produção de Design"** (um link). Não pus botão de criar, porque o Designer não cria demanda de Design: só a equipe cria (`B7.Topo`, Design só para equipe).

## UI/UX
- **Mesma família dos outros Painéis:** grade "atenção à esquerda; semana e próximos prazos à direita; produção do mês em largura total". Mesmos tokens, cartões e ícones.
- **Urgência nunca só por cor:** cada item tem ícone e texto na etiqueta.
- **Responsivo:**
  - KPIs em 2×2 abaixo de 900 px;
  - no celular a semana vira lista de linhas;
  - no celular a ordem é Atenção → Semana → Próximos prazos → Produção.
- **Conferido em:** 1440, 1024, 390 e 360 px, claro e escuro. Nenhum caso com rolagem horizontal.

## Indicadores
Os 4 números saem da mesma leitura (`design_resumo`, peças minhas, sem as finalizadas). Cada KPI abre a Produção de Design com o **mesmo recorte**.

| KPI | Regra | Destino (Designer) | Destino (Admin + Designer) |
|---|---|---|---|
| Ajustes pendentes | status `ajustes` ou `ajustes_cliente` | `#/design?limpar=1&rapido=ajustes` (filtro "em ajustes") | aba Ajustes + designer = eu |
| Vencem hoje | prazo = hoje e não finalizada | `…rapido=comigo&prazo=hoje` | aba Todas + designer = eu + "Para hoje" |
| Em criação | status `em_criacao` | `…rapido=comigo&status=em_criacao` | designer = eu + status |
| Aguardando revisão | status `revisao_interna` (revisão interna da B7) | `…rapido=comigo&status=revisao_interna` | designer = eu + status |

- **Subtítulos:**
  - Ajustes: "N do cliente · M da revisão";
  - Vencem hoje: "N com você · M já enviadas";
  - Em criação: "+ N para começar";
  - Aguardando revisão: "· N com o cliente" (aprovado internamente ou aguardando cliente). O que está com o cliente **não** entra no número de revisão.
- **Links:** o KPI só vira link quando o número é maior que zero. Com zero, fica estático.
- **Mudança na Produção de Design:**
  - `design.abrir` passou a aceitar `rapido`, `designer`, `status` e `prazo`, e só junto com `limpar=1`, que já existia para os links do Painel e descarta os filtros guardados da última visita;
  - o filtro de prazo "Para hoje" deixou de contar peça **finalizada**, a mesma lógica que "Atrasadas" já usava. Isso vale também para a equipe.

## Precisa da sua atenção
- **Prioridade fixa, uma linha por peça, até 5:**
  1. atrasada (nas mãos do designer; até 2 na frente, e as demais entram se sobrar vaga);
  2. ajuste do cliente;
  3. revisão pediu ajuste;
  4. vence hoje;
  5. briefing atualizado (o bloqueio que o sistema registra, `briefing_desatualizado`);
  6. vence amanhã ou depois de amanhã;
  7. para começar (aguardando produção, já atribuída).
- **"Nas mãos do designer":** aguardando produção, em criação, ajustes e ajustes do cliente. O que está em revisão ou com o cliente não "atrasa" para ele.
- **Excedente:** "+N peças na sua fila" leva à fila dele.
- **Vazio:** "Nada pedindo sua ação agora."

## Minha semana
- **Dias:** segunda a sexta. Sábado e domingo aparecem só quando têm prazo.
- **Por dia:** atrasadas (dias passados), ajustes e entregas. O "hoje" com prazo leva à lista "Para hoje".
- **Sem prazo, fora da semana:** peça sem prazo não é encaixada em nenhum dia. Uma nota diz quantas estão sem prazo. Com os dados reais: **69 peças do Alissan estão sem prazo**, então a semana dele aparece livre.

## Minha produção
- **Um gráfico só:** barras por semana (começando na segunda e cortadas nos limites do mês) do **mês atual**.
- **O que conta como produção:** **versão enviada por mim** (`design_versoes.enviada_em`, `designer_id` = eu, nunca rascunho). Um reenvio depois de ajuste também conta, porque é trabalho entregue. Aprovação e finalização não contam, porque dependem de outra pessoa.
- **Resumo:** versões enviadas no mês, peças diferentes e envios desta semana.
- **Dados reais (setembro, Alissan):** 76 versões e 68 peças diferentes. Por semana: 0 · 6 · 28 · 41 · 1.
- **Limitação:** o RLS só mostra versões de peças que ainda estão com ele (ou sem responsável). Uma peça que foi reatribuída a outra pessoa deixa de contar para o gráfico dele.

## Próximos prazos
- **O que entra:** de 3 a 5 peças com prazo de hoje em diante, que não estejam já em "Precisa da sua atenção". Cada uma com data, cliente e status, e o link "Ver produção".
- **Sem prazos:** o bloco diz que não há prazo definido e quantas peças em produção estão sem prazo.

## Demandas com várias partes
- **Qual slide voltou:** para as peças em ajuste, o Painel lê o **arquivo efetivo de cada parte**, com a mesma regra de `design_arquivos_efetivos` (preview mais recente de versão já enviada), e mostra qual slide ou story voltou: "Slide 04", "Slides 02, 04 +1", "Story 03".
- **Contagem:** a peça continua sendo **uma** linha e **um** item nos KPIs. A parte só qualifica o item, não multiplica a contagem.
- **Se falhar:** se essa leitura falhar, a peça aparece do mesmo jeito, com uma nota para abrir a peça e conferir.

## Revisões
- **Duas revisões separadas:** revisão interna (`revisao_interna`, KPI "Aguardando revisão") e cliente (aprovado internamente ou aguardando cliente, só no subtítulo).
- **Ajustes, pela origem:** "Revisão pediu ajuste" (interno) ou "Ajuste do cliente".

## Arquivos
- O histórico de versões e de arquivos não foi alterado.
- O Painel só **lê** `design_versoes` e `design_arquivos` (preview) e nunca grava nada.

## Multi-role
- **Sem troca de perfil:** quem tem mais de uma função alterna a **visão** no cabeçalho (Coordenação · Edição de vídeo · Design). A ordem é a mesma de `funcoesOperacionais`.
- **Testado:**
  - Designer + Videomaker: abre em Vídeo, com a alternância para Design;
  - Admin + Designer: Painel do Designer, com os destinos na visão da equipe filtrada por ele;
  - Admin + Designer + Videomaker.
- **Visualizar como…:** o Painel mostra as peças da pessoa em prévia.

## Permissões
- **Escopo:** sempre `designer_id` = a pessoa, mesmo quando o RLS da equipe deixaria ver tudo.
- **Rota:** `podeRota('painel')` continua sendo `painelElegivel()`.
- **Sem Painel:** admin puro, cliente e coordenador sem função de design não recebem o Painel do Designer.
- **Navegação (9 perfis + Admin + Designer + Videomaker):** sem duplicatas e sem item sem permissão.
  - Designer: Painel · Design · Linhas · Agenda · Mais.

## Performance
- **Três leituras pequenas, cada uma com limite de 15 s:**
  - peças ativas: até 500, colunas enxutas;
  - envios do mês;
  - partes, só das peças em ajuste.
- **Falhas independentes:** cada bloco carrega e falha sozinho, com "Tentar de novo". Erro nunca vira "0".
- **Resposta velha:** uma resposta de uma abertura anterior é descartada (proteção por geração).

## Banco / migrations
Nenhuma migration de banco foi necessária para este Painel.

## Arquivos alterados
- **Novo:** `js/painel-design.js`.
- **Alterados:**
  - `js/painel.js`: visão `design` no despacho, rótulo "Design", `meuId`/`emPrevia` expostos em `ui`;
  - `js/permissoes.js`: `souDesignerElegivel` e visão `design`;
  - `js/database.js`: `painelDesignMinhas`, `painelDesignEnvios`, `painelDesignPartes`;
  - `js/design.js`: parâmetros de recorte com `limpar=1`; "Para hoje" sem finalizadas;
  - `js/app.js`: só o comentário sobre a casa do Designer;
  - `styles/painel.css`: grade `.pnd` e estilo da semana futura;
  - `index.html`: include;
  - `sw.js`: cache v103.

## Tests (executados)
- **KPI ↔ destino, 4 cenários:** dados reais do Alissan como Designer e como Admin + Designer; dados sintéticos cheios como Designer e como Admin + Designer. Em todos os casos, o número do KPI é igual ao número de peças listadas na Produção de Design. Por exemplo, reais: Em criação 30 = 30 e Aguardando revisão 39 = 39. O teste começou com filtros "sujos" guardados.
- **Atenção:** a ordem de prioridade foi conferida, inclusive com a indicação "Slides 02, 04 +1".
- **Escopo:** peças de outro designer e peças sem responsável não entram.
- **Estados:** carregando, erro total, erro só das partes, vazio e dados reais.
- **Visual:** 1440, 1024, 390 e 360 px, claro e escuro. Sem rolagem horizontal.
- **Navegação e casa:** 10 perfis.
- **Regressão:** Painel do Videomaker, Painel do Coordenador, Coordenador + Videomaker, admin puro e cliente (sem Painel); `index.html` real sem sessão, sem erro de JS.

## Pendências
- **Validar com login real** do Alissan, no desktop e no celular.
- **Admin + Designer ainda não é atribuível pela tela Usuários nem pelo `b7-auth`.** O Painel já funciona para essa combinação (testado por simulação). Ligar a opção exige três coisas:
  - a opção em `usuarios.js`;
  - aceitar `designer` no `b7-auth` e republicar a função;
  - fazer `listarDesigners` incluir quem tem a função extra, para que peças possam ser atribuídas à pessoa.
- **Prazos:** nenhuma peça de Design tem prazo hoje, então "Vencem hoje", "Minha semana" e "Próximos prazos" vão aparecer vazios até a equipe preencher os prazos.
- **Visualizar como Designer:** a Produção de Design aberta a partir do Painel ainda usa o id do admin no filtro "comigo". Isso é uma limitação da prévia que já existia.
