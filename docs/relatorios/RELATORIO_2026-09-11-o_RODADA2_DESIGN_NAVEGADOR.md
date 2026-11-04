# Relatório — Build 2026-09-11-o · Rodada 2: Design (navegador) + página de demanda

Segunda das seis rodadas de `PLANO_UX_DESIGN_RESTANTE.md`. Cobre as
seções 9-13 e 43 da especificação "B7 Design UX / Operational
Editorial Refinement".

## 1. Implementado e testado com confiança

- **Navegador do Designer (`#/design`) mais denso e consistente.**
  "Demandas a fazer" e "Minhas demandas" agora usam os mesmos
  componentes visuais ricos da Central de Design (Rodada 1):
  progresso real por linha, quebra por estado, formatos e prazo — em
  vez do cartão simples de contagem que existia antes. É a mesma
  linguagem visual em toda a experiência do Designer.
- **Página de demanda (`#/design/linha/:id`) como projeto de
  verdade.** Cabeçalho com cliente, nome da linha, selo de versão
  confirmada e porcentagem de conclusão em destaque, com barra de
  progresso. Chips de formato viraram fração real ("2/5 Cards, 1/2
  Capas de Reel…"), marcados quando o formato está completo.
- **Abas por estado** (Todas / Para fazer / Em criação / Ajustes /
  Revisão / Finalizadas) com contagem real, filtrando no cliente sem
  nova consulta.
- **Realtime e ações consistentes**: a página de demanda mantém cache
  próprio (`itensLinha`) atualizado peça a peça pelo mesmo mecanismo
  de releitura das outras telas — nenhuma ação perde a aba selecionada
  nem refaz uma consulta completa desnecessária.
- **Bug de responsividade encontrado e corrigido**: o botão "Ver
  contexto da Linha Editorial…" estourava a largura da tela em
  celular. Corrigido nesta mesma rodada.
- Testado com Playwright (Supabase simulado), 10 peças cobrindo todos
  os estados numa linha (incluindo uma peça de outro designer) mais
  uma linha de outro cliente sem responsável: números do cabeçalho,
  chips de formato e abas todos conferidos contra os dados; navegação
  entre navegador → demanda → gaveta → voltar testada; desktop e
  celular (390px); coordenador sem regressão. Zero erros de console.

## 2. Implementado, mas com ressalvas

- **A página de demanda mostra a linha inteira, não só as peças do
  Designer logado.** Isso é comportamento herdado de antes desta
  rodada (não mudou agora) e foi mantido de propósito: a página
  responde à pergunta "o que está acontecendo nesta linha", não "o
  que é meu" — essa segunda pergunta já é respondida pelo navegador e
  pela Central. Vale confirmar com a coordenação se esse é o
  comportamento desejado a longo prazo, porque significa que um
  Designer pode ver o título e o status de peças atribuídas a colegas
  na mesma linha (nunca o inverso — a Central e "Minhas demandas"
  continuam estritamente pessoais).
- Barra de filtros do navegador do Designer continua enxuta (busca +
  tipo + prazo) — o filtro por status agora vive nas abas da página
  de demanda, deliberadamente sem duplicar.

## 3. Não implementado por limitação técnica

- Nada desta rodada esbarrou em limitação técnica.

## 4. Não implementado por decisão consciente

- **Quadro/lista/equipe da coordenação (visão ampla da equipe)** —
  fora do escopo desta rodada e da especificação original, que trata
  desse redesenho como trabalho do lado do Designer.
- **Design Piece Workspace, Carrossel interativo, Thumbnails, Linha
  Editorial Operacional separada** — Rodadas 3, 4 e 5.
- **Notificações, performance e auditoria mobile completa** — Rodada
  6.

## Sobre o RLS de produção

Nada muda nesta rodada: mesmas funções de leitura/escrita de antes
(`listarDesign`, `assumirDemandaLinha`). O estado do RLS em produção
continua o que foi confirmado nas rodadas anteriores.

## Próxima

Rodada 3 — Design Piece Workspace (estrutura + Card + Capa de Reel):
seções 14-17, 20 e 22-24.
