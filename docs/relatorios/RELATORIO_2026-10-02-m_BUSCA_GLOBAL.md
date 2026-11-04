# Relatório 2026-10-02-m — Busca global encontra peça de design, demanda de vídeo e fala de roteiro

Só front-end (`js/ui.js`, `js/database.js`, `js/design.js`). Sem migration; nenhuma permissão mudou.

## O que já existia

"Buscar no B7" (e Ctrl K) já encontrava cliente, gravação, roteiro pelo título, item de gravação, linha editorial, conteúdo, ideia e status semanal.

## O que entrou

- **Peças de Design**, pelo título da peça ou do conteúdo. Mostra cliente, formato, etapa e designer; abre a peça.
- **Demandas de vídeo**, pelo título ou pelo código. Mostra código, cliente, situação e videomaker; abre a demanda.
- **Texto dos roteiros.** O banco já procurava dentro das falas, mas a busca não mostrava o resultado. Agora aparece o roteiro com o trecho encontrado.
- Uma resposta atrasada de uma busca anterior não pinta mais por cima da busca atual.

## Permissão

- Peça de design só é procurada para quem pode abrir a tela de Design; demanda de vídeo, só para quem pode abrir a de Vídeo. É a mesma guarda de rota das outras telas.
- O que cada pessoa encontra continua limitado pelo banco (RLS): o designer só acha as peças que já enxerga.

## Arquivos

- `js/database.js`: `buscar(termo, opções)`.
- `js/ui.js`: grupos novos na paleta.
- `js/design.js`: expõe os rótulos de etapa e formato.
- `js/auth.js` versão `2026-10-02-m`; `sw.js` cache `v140`.

## Testes realizados

- **Sintaxe das consultas novas contra o banco real, sem sessão:** o servidor aceitou o filtro (inclusive com vírgula, parênteses e aspas no termo) e recusou só por falta de login, como esperado. Isso prova a sintaxe, não o resultado.
- **Tela, com resultados simulados**, como administrador, designer e videomaker: grupos certos para cada um (designer não vê vídeo, videomaker não vê design), trecho da fala, e o clique abre `#/design/<id>` e `#/video/<id>`.

## O que NÃO foi testado

- A busca logada, com dados reais.
- Celular.
