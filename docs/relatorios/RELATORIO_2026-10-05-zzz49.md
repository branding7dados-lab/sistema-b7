# Relatório 2026-10-05-zzz49 — Kanban no padrão novo

A revisão listou cinco telas "no desenho antigo no celular": Aprovações, Kanban,
Publicações do dia, Roteiros e Ficha do cliente. Abri as cinco uma a uma, no
tamanho de celular, antes de mexer em qualquer coisa.

**Só o Kanban destoava de verdade.** O "+ Nova demanda" era uma pílula rosa
grande, a peça mais pesada da tela — enquanto Vídeo, Design e Status semanal já
usam o "+" quadrado com gradiente no canto. Agora o Kanban usa o mesmo botão
(44x44, cantos de 14px), e a frase de apoio some no celular, como nas outras.

As outras quatro já estavam no padrão: blocos com ícone em gradiente, pílulas de
situação, anéis de progresso e listas em cartão único. Não mexi nelas — mudar
por mudar só geraria risco sem ganho.

## Dois sustos que não eram bugs

Durante a conferência apareceram "vundefined (substituída)" em Aprovações e
"NaN% / undefined de 12 conteúdos" na Ficha do cliente. Os dois vinham de campos
que faltavam no simulador de banco dos prints (`versao` e `total_estruturados`),
não do sistema: as duas colunas são calculadas na view e nunca chegam nulas.
Simulador corrigido para não enganar de novo.

VERSAO zzz49 · cache v254.
