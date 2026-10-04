# Relatório zzz28 — Cartão-resumo de volta, só no Vídeo, refeito

Pedido: "O dashboard tava legal, mas só na parte de vídeo… e o UI/UX dele tinha que ser extremamente perfeito".

## O que mudou (celular; computador igual)
- Volta o cartão-resumo **só na Produção de Vídeo** (Design segue sem).
- O "bugado" de antes era o cartão renascer (com animação de entrada) a cada filtro e a cada letra digitada na busca. Agora a entrada acontece **uma vez por visita**; depois, anel, barra e números **deslizam do valor anterior para o novo**.
- Layout novo: "ENTREGUES · OUTUBRO", número grande "4 de 13", **anel de progresso** com a % no meio (verde, com brilho leve), barra segmentada pelas cores das etapas, legenda numa fileira rolável e o aviso de meses anteriores no rodapé com "Ver".
- Tocar num **segmento da barra** ou num item da legenda filtra a etapa (tocar de novo desfaz); o item ativo fica branco.
- Fundo sem faixa dura (brilho radial suave só no canto), contorno de 1px de luz, sombra mais macia; versões clara e escura.
- Respeita "reduzir movimento" do sistema.

Testado: filtro pela legenda, filtro pelo segmento e busca — o cartão continua lá ("ja-visto"), só os valores mudam.

Versão `2026-10-04-zzz28`, cache `roteiros-b7-v233`.
