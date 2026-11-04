# Plano — o que sobrou da especificação "B7 Design UX/Operational Refinement"

Depois da rodada `2026-09-11-m` (auditoria do pilar + autorização do
Designer + barra do topo + cartão de pilar somente leitura — já
entregue), sobrou a parte visual/estrutural grande da especificação de
56 seções. Dividida em **6 rodadas**, cada uma pequena o bastante para
ser testada de ponta a ponta antes de seguir para a próxima — na ordem
que faz mais sentido tecnicamente (cada rodada usa o que a anterior
construiu).

## Rodada 1 — Central de Design (home do Designer) — ✅ entregue no build `2026-09-11-n`
Seções 2-7 da especificação.
- Header pessoal ("Olá, Mateus. Veja o que precisa da sua atenção.")
- Tratamento visual novo para "Precisa de mim" / "Continuar de onde
  parei" (já existem desde o build `-i`, mas com o visual genérico
  atual)
- "Minhas linhas em produção" como pacote visual (cliente, versão,
  contagem por formato, progresso real — dado real, sem inventar %)
- "Demandas disponíveis" mais denso, sem cartões com espaço em branco

## Rodada 2 — Design (navegador) + página de demanda — ✅ entregue no build `2026-09-11-o`
Seções 9-13, 43 da especificação.
- Layout mais denso da página "Design" (a fila ampla, com filtros)
- Cabeçalho da página de demanda (Setembro 2026) como projeto de
  verdade — cliente, versão, progresso
- Filtros/abas dentro da demanda (Todas / Para fazer / Em criação /
  Ajustes / Revisão / Finalizadas)
- Cartões de peça mais visuais (formato, status, responsável, prazo,
  indicador de ajuste — sem quadrado vazio sem explicação)
- Progresso por formato (Cards X/Y, Carrosséis X/Y…)

## Rodada 3 — Design Piece Workspace (estrutura + Card + Capa de Reel) — ✅ entregue no build `2026-09-11-x`
Seções 14-17, 20, 22-24 da especificação.
- Sai do drawer estreito: rota dedicada ou diálogo quase tela cheia
- Estrutura geral (conteúdo principal + painel operacional lateral)
- Ação primária única por estado ("Assumir esta peça", "Enviar para
  revisão"…)
- Workspace específico para Card estático (hierarquia de texto, sem
  campo vazio)
- Workspace específico para Capa de Reel (com "Ver roteiro" read-only)
- Upload/revisão e histórico de versão dentro do novo layout
- Bloco de feedback de ajuste em destaque

Escolhido começar pelos formatos mais simples (Card e Capa de Reel)
antes do Carrossel, que é o mais trabalhoso.

## Rodada 4 — Carrossel interativo + Stories — ✅ entregue no build `2026-09-11-ad`
Seções 18-19, 21 da especificação.
- Navegador de slide (01, 02, 03… com o slide atual em destaque)
- Navegação por clique/setas, "Ver todos" para a sequência completa
- Mantém as regras já corretas (Slide 1 = abertura, último = CTA
  dinâmico, sem campo duplicado)
- Sequência de frames de Stories com o mesmo padrão de navegador

## Rodada 5 — Thumbnails + Linha Editorial Operacional separada
Seções 12, 25-28, 42 da especificação. Grande demais pra um build só —
quebrada em duas partes, seguindo a mesma regra que já valeu pra
Rodada 3 (Card+Capa de Reel antes do Carrossel).

### Rodada 5a — Miniatura otimizada + placeholder por formato — ✅ entregue no build `2026-09-11-ae`
- Pipeline de miniatura otimizada a partir do arquivo enviado (gerada
  localmente no navegador no momento do upload — sem baixar o arquivo
  original só pra desenhar um card pequeno, e sem depender de nenhum
  recurso pago do Storage)
- Placeholder limpo por formato quando não há preview — e também
  quando o último preview é vídeo/PDF/outro formato que não dá pra
  desenhar como imagem (bug antigo corrigido de quebra)

### Rodada 5b — Linha Editorial do Designer como componente próprio — ✅ entregue no build `2026-09-11-af`
- Navegação operacional reduzida: a página de demanda do Design
  (`#/design/linha/:id`, que já existia desde a Rodada 2) ganhou 4
  abas de topo — Peças de Design / Contexto / Pilares / Referências —
  em vez do botão "Ver contexto" que levava pra fora do Design, pro
  editor completo de 5 abas do Coordenador.
- As 3 abas novas (Contexto, Pilares, Referências) são um componente
  próprio dentro de `js/design.js`, sempre somente leitura — não tocam
  em `js/linha.js`. Abre caminho pra um futuro Videomaker sem
  reescrever a base.
- Escopo consciente: não busca a lista de criativos da linha só pra
  essas 3 abas (evita uma consulta a mais); por isso Pilares mostra o
  planejado (percentual/funil/objetivo) mas não a distribuição real×
  planejado, que continua só no editor completo do Coordenador.
- `js/linha.js` continua existindo, intacto, como o editor completo do
  Coordenador (`#/linha/:id`) — inclusive as checagens de
  `souDesignerSomenteLeitura()` que já existiam nele continuam como
  rede de segurança para quem chegar lá por outro caminho (busca,
  "próximo conteúdo" no dashboard). A limpeza completa dessas
  checagens (removê-las de dentro de `js/linha.js` de vez) ficou fora
  do escopo — não é user-facing e tem risco de regressão maior do que
  o ganho, já que o Coordenador continua usando esse arquivo do jeito
  que sempre usou.

## Rodada 6 — Notificações, polimento e auditoria final — ✅ entregue no build `2026-09-11-ag`
Seções 24 (parte), 40-41, 45-46 da especificação, mais os retoques
pequenos que foram anotados na auditoria da rodada `-m`.
- Ctrl+K corrigido para o Designer: além de "Nova gravação"/"Novo
  cliente" (achado na rodada `-m`), a auditoria completa achou mais 4
  ações vazando (2 navegações pra rota bloqueada, 2 ações de escrita
  pulando o controle de acesso da própria página) — todas filtradas.
- Deep-link de notificação corrigido: "linha concluída" apontava para
  `#/design?linha=` (rota que nunca existiu); agora aponta para
  `#/design/linha/:id`, a rota real desde a Rodada 2.
  `migration_notificacoes_deeplink.sql` — não reescreve notificações
  já enviadas, só as novas.
- Distinção visual "Ajuste solicitado" (B7) × "Ajuste do cliente" nos
  3 lugares que mostravam os dois com a mesma cor (chip de status,
  rótulo da Central de Design, aviso no topo do workspace) — cliente
  agora em roxo, B7 continua em vermelho.
- Auditoria de performance: sem N+1, sem subscription por card (já
  era um canal só e uma view só) — nada a corrigir.
- Auditoria de responsividade mobile das rodadas 1-5 (Central,
  navegador, página de demanda com as 4 abas, workspace): sem
  overflow horizontal em nenhuma tela testada em 375px. Achado um
  padrão de abas roláveis sem affordance visual, já existente desde a
  Rodada 2 — documentado, não alterado (risco de última hora sem
  ganho comprovado).
- Escopo consciente: não existe "feedback do cliente" fora do que já
  foi tratado (peças de Design e o fluxo de aprovação de roteiros em
  `js/aprovacoes.js`) — nenhum conceito novo foi criado.

---

Cada rodada termina com teste real (Playwright comparando Designer ×
Coordenador, quando aplicável) e o relatório de sempre em quatro
categorias. Se alguma rodada acabar maior do que cabe num build só, ela
mesma pode ser quebrada em partes menores na hora — a lista acima é o
ponto de partida, não uma promessa rígida de tamanho igual para todas.
