# zzz266 — Gestão (painel do dono, saúde dos clientes, pedidos)

- `migration_gestao.sql` (aplicada: `gestao_painel`): função única, só admin, devolve JSON com kpis, série de 6 meses (design finalizado, vídeo entregue, conteúdo publicado), clientes com nota de saúde e motivos, pedidos recentes e ranking de 90 dias.
- Nota de saúde (0–100): −12 por entrega atrasada (máx. 36), −8 por aprovação parada 3+ dias (máx. 24), −10/−20 se responde em >3/>6 dias, −8/−15 se >25%/>40% das decisões são ajuste/recusa (≥3 decisões em 90 dias), −8/−25 nota 7–8/≤6, −15 sem entregas há 2 meses. Verde ≥75, amarelo 50–74, vermelho <50.
- Conferida com dados reais (24 clientes, entregas do mês e série batendo).
- `js/gestao.js` (`#/gestao`), item "Gestão" no grupo Principal (só admin; rota sem dono = só admin em `podeRota`). CSS em `styles/dashboard.css` com prefixo `gt-` (o `gs-` já existe no Status semanal).
- Prints conferidos: visão geral (claro e escuro celular), saúde e pedidos.
