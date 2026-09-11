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

## Rodada 3 — Design Piece Workspace (estrutura + Card + Capa de Reel)
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

## Rodada 4 — Carrossel interativo + Stories
Seções 18-19, 21 da especificação.
- Navegador de slide (01, 02, 03… com o slide atual em destaque)
- Navegação por clique/setas, "Ver todos" para a sequência completa
- Mantém as regras já corretas (Slide 1 = abertura, último = CTA
  dinâmico, sem campo duplicado)
- Sequência de frames de Stories com o mesmo padrão de navegador

## Rodada 5 — Thumbnails + Linha Editorial Operacional separada
Seções 12, 25-28, 42 da especificação.
- Pipeline de miniatura otimizada a partir do arquivo enviado (sem
  baixar o arquivo original só pra desenhar um card pequeno)
- Placeholder limpo por formato quando não há preview
- Linha Editorial do Designer como componente próprio (não mais
  `js/linha.js` com `if` de papel) — abre caminho para um futuro
  Videomaker sem reescrever a base
- Navegação operacional reduzida (Peças de Design / Contexto /
  Pilares / Referências, em vez das 5 abas do Coordenador)

## Rodada 6 — Notificações, polimento e auditoria final
Seções 24 (parte), 40-41, 45-46 da especificação, mais os retoques
pequenos que foram anotados na auditoria da rodada `-m`.
- Deep-links de notificação apontando para as novas telas operacionais
- Distinção visual "Feedback interno B7" vs. "Feedback do cliente" (se
  já existir feedback de cliente na arquitetura)
- Auditoria de performance (sem N+1, sem uma subscription realtime por
  card)
- Auditoria completa de responsividade mobile de tudo que foi
  construído nas rodadas 1-5
- Ctrl+K: tirar "Nova gravação"/"Novo cliente" da paleta de comandos
  para o Designer (achado na auditoria da rodada `-m`, ainda não
  corrigido)

---

Cada rodada termina com teste real (Playwright comparando Designer ×
Coordenador, quando aplicável) e o relatório de sempre em quatro
categorias. Se alguma rodada acabar maior do que cabe num build só, ela
mesma pode ser quebrada em partes menores na hora — a lista acima é o
ponto de partida, não uma promessa rígida de tamanho igual para todas.
