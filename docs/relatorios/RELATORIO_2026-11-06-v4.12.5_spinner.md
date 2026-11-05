# v4.12.5 — Spinner de barras

- Pedido: o "Bars Spinner" do Spell UI (componente React/shadcn). O sistema não usa React, então foi refeito em CSS puro com a mesma geometria (12 barras, 1,2 s, opacidade 1 → 0,15): `.b7-spin` em styles/global.css e `B7.UI.spin(px)` em js/ui.js.
- Aplicado nos 14 textos "Carregando…" fora de <option> (admin, central, conversas, design, IA, oportunidades, prévia, TV).
