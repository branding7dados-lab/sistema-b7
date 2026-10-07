# Relatório zzz60 — Kanban do Vídeo: soltar o cartão em qualquer ponto da coluna (07/10/2026)

**Versão:** `2026-10-07-zzz60` · **Cache:** `roteiros-b7-v265`

## O bug (vídeo de 07/10, 10:17)
Kevin arrasta "Faceta não desgasta os dentes" de Pendente para Em edição e para Aguardando aprovação; ao soltar, o cartão volta para Pendente e os contadores não mudam. O cursor aparece como "proibido" sobre as colunas.

## Causa
A área que aceitava o cartão era só a LISTA da coluna, que tem a altura do conteúdo. Numa coluna vazia isso era apenas a faixa "Nenhuma demanda" (cerca de 50 px no topo). O resto da coluna — visualmente parte dela — não aceitava o cartão, então soltar ali não fazia nada. Não era lentidão do banco: a ação de mover nem chegava a ser chamada.

## Correção
- `js/video.js`: a coluna inteira (cabeçalho e espaço vazio) aceita o cartão no arrastar do mouse; no toque, a coluna sob o dedo também vale inteira.
- `styles/video.css`: a lista passa a ocupar a altura toda da coluna, então o realce ao arrastar cobre a coluna toda.

Nenhuma regra de status, confirmação, permissão ou banco mudou. Sem migração. Continua valendo o zzz59 (o cartão muda na hora e volta se a gravação falhar).

## Testes realmente executados
- Quadros do vídeo de Kevin extraídos e analisados (2 por segundo).
- Modelo estático local com duas colunas (uma com 400 px de conteúdo, outra vazia): a área de soltar da coluna vazia passou a medir 400 px de uma coluna de 454 px (o restante é o cabeçalho).
- O app local carregou com o `video.js` alterado e o módulo de Vídeo foi criado.

## Não testado
- Arrastar de verdade com conta logada, no mouse e no toque — o teste local não tem sessão.
