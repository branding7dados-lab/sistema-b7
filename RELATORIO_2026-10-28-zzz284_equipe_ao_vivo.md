# Relatório zzz284 — Equipe ao vivo (parte 1)

Pedido do Kevin: ver, em tempo real, quem está no Sistema e o que a pessoa está fazendo, só para super admin / admin supremo. Estilo presença do Canva. Sem aviso na tela de quem é acompanhado (coberto pelos Termos).

## Esta parte (1 de 3)
- **Quem está online + em que tela**, ao vivo. `js/aovivo.js` + `styles/aovivo.css`.
- Usa o mesmo tempo real das conversas (Supabase Realtime, presença). Cada pessoa da equipe interna "anuncia" só a tela atual (nome, foto, rota, há quanto tempo); nada é enviado com a aba escondida (igual ao "online" das conversas). Troca de tela rápida é agrupada (um sinal a cada ~2,5 s).
- Botão **"Equipe ao vivo"** em Mais ferramentas, só para super/supremo (`B7.Auth.superadmin()`); para os outros o botão nem aparece. O painel também confere `pode()` ao abrir.
- No painel: lista ao vivo com foto, nome, a tela ("Edição de vídeo"), o "há X min" e **"Ir para a tela"** (leva o super à mesma tela que a pessoa está vendo). O "há X" anda sozinho.
- Prévia/entrar-como e cliente não anunciam.

## Termos
- `termos.html`, seção 2: nova linha deixando claro que o uso do Sistema pode ser acompanhado pela administração, inclusive em tempo real, limitado ao Sistema e à relação de trabalho. É o que ampara o acompanhamento sem popup na tela.

## Próximas partes (quando o Kevin pedir)
- Parte 2: cursores ao vivo com o nome, na mesma tela (estilo Canva/Figma).
- Parte 3: "seguir ao vivo" — a tela do super espelha a rolagem e o que a pessoa abre.

## Testes
- `testes/aovivo.test.mjs` (trava de permissão) entrou no `npm test`.
- Painel conferido em PC e celular.
