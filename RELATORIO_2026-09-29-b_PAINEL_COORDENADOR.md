# Relatório 29/09 (b) — Painel do Coordenador de Mídias (fase 2)

## Painel do Coordenador
- **O que é:** a casa operacional de quem coordena. Responde "o que depende de mim agora?".
- **Rota:** a mesma `#/painel`. O conteúdo sai das funções reais da pessoa (`B7.Perm.painelVisoes()`). Não existe rota `#/painel-coordenador`.
- **Casa padrão:** abrir o sistema sem rota leva ao Painel.
  - Vale para o Coordenador, para o Admin com a função extra "Coordenador de mídias" e para quem já tinha o Painel do Videomaker.
  - `#/` explícito continua abrindo a Central, e links diretos passam intactos.
  - Não há laço de redirecionamento (testado).
- **Central B7:** continua intacta, com o mesmo nome e no menu. O Painel mostra o que pede ação. A Central continua sendo a visão ampla da agência.

## UI/UX
- **Mesma família do Painel do Videomaker:** mesmo cabeçalho, cards de número, linhas de atenção, célula de dia, blocos, esqueletos, vazio e erro.
- **Desktop:**
  - cabeçalho com uma ação principal ("+ Nova linha editorial");
  - 4 números;
  - "Precisa da sua atenção" à esquerda, "Minha semana" e "Próximas publicações" à direita;
  - "Fluxo de conteúdos" em largura total.
- **Celular:**
  - números em 2×2;
  - ordem das seções: atenção → semana (lista de dias com palavras) → fluxo → próximas publicações.
- **Dias da semana:** cada dia é um link para Publicações do Dia daquele dia.
- **Conferido em:** 1920, 1440, 1280, 1024, 390 e 360 px, claro, escuro, compacto, vazio, 1 item, cheio, erro e carregando. Nenhum caso com rolagem horizontal ou erro de JS.
- **Correção que vale para os dois Painéis:** as iniciais do cliente (quando não há logo) ganhavam um "·" antes do nome. Agora o logo cola no nome.

## Indicadores

### 1. Linhas editoriais em andamento
- **Regra:** status ≠ "Finalizada", não excluída. É a mesma regra "em elaboração" da Central.
- **Onde vive a regra:** `B7.Conteudo.REGRAS_LINHA.andamento`.
- **Clique:** abre `#/linhas?status=andamento`, com filtro novo na tela Linhas e um aviso "Mostrando: Em andamento · N linhas · Ver todas".
- **Hoje:** 17 → 17.

### 2. Precisam de atenção
- **Regra:** soma dos itens de risco, sem notificações:
  - publicações atrasadas;
  - linhas com planejamento atrasado;
  - ajustes pedidos pelo cliente;
  - publicações de hoje ou amanhã ainda antes de "Aprovado";
  - gravações de hoje ou amanhã com roteiro ainda em criação.
- **Clique:** não existe uma tela canônica que junte tudo isso. O card leva à lista "Precisa da sua atenção", logo abaixo, com rolagem e foco.

### 3. Próximas publicações
- **Regra:** conteúdos com data de postagem de hoje até +6 dias e status ≠ "Publicado". Mesma regra de data de Publicações do Dia.
- **Subtítulo:** quantas já estão prontas (Aprovado ou Programado).
- **Clique:** abre Publicações do Dia.

### 4. Revisões pendentes
- **Regra:** revisão interna que espera a coordenação:
  - artes do Design em "Revisão interna";
  - conteúdos "Em revisão";
  - roteiros "Em revisão";
  - linhas "Em revisão".
- **Aprovação do cliente fica de fora:** ela espera o cliente, não a coordenação.
- **Clique:** só vira link quando existe um destino com exatamente esse número:
  - Design → `#/design?aba=revisao&limpar=1`, que zera filtros guardados de visitas anteriores;
  - Linhas → `#/linhas?status=revisao`;
  - item único → o próprio item.
- **Hoje:** 41 (39 artes + 2 conteúdos). Como mistura dois tipos, o card fica sem link e o subtítulo mostra a divisão.

## Precisa da sua atenção
- **Formato da linha:**
  - quando um tipo tem 1 item, a linha é o próprio item;
  - quando tem vários, vira uma linha-resumo que abre a tela canônica já filtrada.

| Ordem | Item | Destino |
|---|---|---|
| 1 | Publicações atrasadas (data passou e não está "Publicado", últimos 60 dias) | Publicações do Dia → "Pendentes de dias anteriores" (mesma consulta: `publicacoesPendentes(hoje, hoje−60, 50)`) |
| 2 | Linha ainda "Em criação" com período já começado ou começando em até 7 dias | `#/linhas?status=planejamento` ou a linha |
| 3 | Ajustes pedidos pelo cliente (aprovação na versão atual) | `#/aprovacoes?situacao=ajustes` ou a aprovação |
| 4 | Publicações de hoje antes de "Aprovado" | `#/publicacoes/<hoje>` ou o criativo |
| 5 | Gravação de hoje com roteiro em criação/revisão (ou sem roteiro) | a gravação |
| 6 | Publicações de amanhã antes de "Aprovado" | `#/publicacoes/<amanhã>` |
| 7 | Gravação de amanhã idem | a gravação |
| 8+ | Revisões: linhas, roteiros, conteúdos e artes | lista filtrada ou o item mais antigo/próximo |

- **Limite:** no máximo 5 linhas. O que sobra aparece como "E mais: …". Não há ranking nem nota de desempenho.
- **"Não pronto":** Ideia, Em criação e Em revisão, antes de "Aprovado" no vocabulário canônico. Não criei nenhuma exigência nova no fluxo.

## Minha semana
- **Período:** segunda a domingo da semana atual. Sábado e domingo só aparecem se tiverem algo.
- **Por dia:**
  - publicações do dia;
  - nos dias que já passaram, quantas ficaram atrasadas;
  - gravações da agenda;
  - início de período de linha editorial.
- **Clique:** abre Publicações do Dia daquele dia.

## Fluxo de conteúdos
- **Formato:** barras horizontais, uma por status, na ordem do fluxo.
  - A cor de cada etapa vem do chip de status que o sistema já usa; as barras são neutras.
  - Há tooltip no foco e no hover.
- **Status:** Ideia, Em criação, Em revisão, Aprovado, Programado e Publicado (`STATUS_CONTEUDO`). Se aparecer algum fora da lista, ele vai para "Outro".
- **Período:** mês corrente, pela data de postagem.
- **Resumo:** total, % publicados e quantos estão com a data vencida.
- **Clique:** não existe uma tela que liste o mês filtrado por status, então as barras não são clicáveis. O link "Publicações do dia" fica no cabeçalho.

## Próximas publicações
- **Consulta:** conteúdos com data de hoje até +13 dias, status ≠ "Publicado".
- **Ordem:** data → cliente (A–Z) → posição. É a mesma ordem estável de Publicações do Dia.
- **Limite:** 5 itens, mais o link "+N nos próximos 14 dias".
- **Destino:** cada linha abre o criativo na Linha Editorial (`#/linha/<id>?conteudo=<id>`). "Ver calendário" abre Publicações do Dia.

## Escopo do Coordenador
- **Não existe modelo de "coordenador responsável":**
  - `clientes` não tem dono;
  - `perfis` não tem carteira;
  - `perfil_clientes` é só para cliente.
- **Não inventei vínculo.** O Painel mostra a operação que a conta alcança pelo RLS (equipe = todos os clientes), recortada por data e status.
- **Conferido no banco com o RLS do Mateus:** 17 linhas, 37 pendentes, 27 próximas, 39 artes em revisão, 2 conteúdos em revisão. É igual ao Painel.

## Multi-role
- **Administrador + Coordenador:**
  - isso não existia no modelo, porque funções extras só aceitavam videomaker e designer;
  - adicionei a função extra "coordenador", só para Administrador (a tela Usuários só oferece para esse papel);
  - ela liga o Painel de coordenação e a casa padrão;
  - o admin continua admin em tudo (testado: Usuários, Central e todas as rotas);
  - não precisou mudar o RLS, porque o admin já tem todas as permissões de coordenação.
- **Coordenador + Videomaker:**
  - não existe troca de perfil nem de identidade;
  - o cabeçalho ganha "Coordenação | Edição de vídeo", que troca só a visão (`#/painel?visao=video`);
  - a escolha fica lembrada no navegador;
  - pedir uma visão que a pessoa não tem é ignorado.

## Central B7
Continua disponível no menu para o Coordenador, com o mesmo nome, e abre normalmente pelo `#/`. Não mexi nela.

## Design System
- **Tokens:** `--card`, `--suave`, `--borda(-forte)`, `--ink…ink-4`, `--acento(-suave)`, `--erro/-bg`, `--ambar/-bg`, `--ok/-bg`, `--sh-1/2`, `--r-sm/lg`, `--t-micro` e densidade `--d`.
- **Componentes:**
  - `.cp-num` (card de número) e `.cp-ag-item` (linha de data);
  - chips `.status-conteudo` (`B7.Linha.chipConteudo`);
  - `.esqueleto-tela .esq` e botões `.b`;
  - padrão segmentado de `.seg-vista`.
- **Primitivos do Painel exportados** em `B7.Painel.ui` e reaproveitados pelo Coordenador: `kpi`, `linhaAtencao`, `diaSemana` (agora genérico), `cabecalho`, blocos de vazio, erro e carregando, e datas.

## Performance
- **Consultas:** 6 fontes em paralelo, todas recortadas:
  - linhas: até 60;
  - conteúdos: do início do mês ou da semana até +13 dias, sem colunas de texto longo;
  - pendentes: 60 dias, até 50;
  - design: só "revisão interna";
  - aprovações: só "ajustes" na versão atual;
  - agenda: 3 semanas, mais uma consulta para os roteiros de todas as gravações de hoje e amanhã (sem N+1).
- **Isolamento:** cada fonte carrega e falha sozinha. Erro aparece como "—" com "Tentar de novo", nunca como 0. Há tempo limite de 15 s.
- **Abrir o Painel não recarrega o shell.**

## Banco / migrations
- **Aplicada em produção:** `migration_funcao_extra_coordenador.sql`, que acrescenta 'coordenador' ao check de `perfis_funcoes_extra.funcao`. É a única mudança de schema.
- **Edge Function `b7-auth` publicada** (versão `2026-09-29-b`), já aceitando a função extra "coordenador" só para Administrador. Conferido depois do deploy: ping responde a versão nova, rota protegida sem sessão devolve 401 e login com usuário inexistente devolve "Usuário ou senha inválidos".

## Testes executados
- **Papéis (9 combinações):** coordenador; admin+coord; admin+coord+vm; coord+vm; admin; admin+vm; vm; designer; designer+coord (inválido → sem Painel).
- **Rotas (14 casos):** casa padrão, `#/` explícito, refresh, `?visao=`, designer negado, destinos dos KPIs, sem laço.
- **KPI ↔ lista, com as telas reais:**
  - Linhas andamento 17 → 17;
  - planejamento 4 → 4;
  - revisão 0 → 0;
  - Design "revisão interna" com filtros velhos guardados (cliente e busca) → 39 peças, igual ao Painel.
- **Contagens com o RLS do Mateus (SQL):** 17, 37, 27, 39, 2, 0 e 0, iguais ao Painel com dados reais.
- **Interações:**
  - clique no KPI de atenção rola e foca;
  - "Nova linha editorial" abre o modal;
  - links de dias, itens e publicações apontam para as telas canônicas.
- **Visual:** matriz de telas e estados conferida por captura (a lista está em UI/UX).
- **Regressão:** Painel do Videomaker (captura desktop e celular, 7 papéis) sem erro.

## Arquivos
- **Novos:**
  - `js/painel-coord.js`
  - `migration_funcao_extra_coordenador.sql`
  - este relatório
- **Alterados:**
  - `js/painel.js`: despacho por visão, cabeçalho comum, `diaSemana` genérico, `B7.Painel.ui`;
  - `js/permissoes.js`: `painelVisoes`, `souCoordenadorElegivel`;
  - `js/app.js`: params para painel, linhas e design;
  - `js/conteudo.js`: `REGRAS_LINHA`, filtro `?status=`, `novaLinha`;
  - `js/design.js`: `?limpar=1`;
  - `js/database.js`: 4 leituras do Coordenador;
  - `js/usuarios.js`: função extra coordenador só para admin;
  - `styles/painel.css` e `styles/conteudo.css`;
  - `index.html` e `sw.js` (cache v100);
  - `supabase/functions/b7-auth/index.ts`.

## Pendências
- **Validar com o login real do Mateus**, no celular e no desktop.
- **Dados de status:** 37 publicações aparecem atrasadas e boa parte ainda está em "Ideia". Isso reflete status não atualizados na Linha Editorial. O Painel mostra o que o banco diz.
- **"Próximas publicações" não tem destino exato:** o KPI abre Publicações do Dia, que mostra dia a dia, não uma lista única dos 7 dias.
- **Conteúdos e roteiros "em revisão" em grupo:** não existe lista filtrada por status para eles, então a linha-resumo abre o item mais urgente e diz isso.
- **Seção "Clientes que pedem atenção" ficou de fora:** não há dono de cliente nem critério de risco definido, e a spec pedia para pular nesse caso.
