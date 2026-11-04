# Relatório zzz287 — Equipe ao vivo: dois consertos

## 1. Acompanhar brigava com o WhatsApp (e travava o tempo real)
Enquanto o super acompanhava alguém, cada atualização da pessoa seguida forçava o `location.hash` do super (para manter a mesma tela). Se o super tentava abrir o WhatsApp (ou qualquer outra tela), o próximo `av-tela` puxava a tela de volta — uma briga que travava a navegação e dava a impressão de "o tempo real parou".

Conserto (`js/aovivo.js`): se o super troca de tela **por conta própria** enquanto acompanha, ele **deixa de acompanhar** (a barra some e a tela não é mais puxada). As trocas de tela causadas pelo próprio acompanhamento são marcadas (`seguindo.auto`) para não encerrarem por engano. Quem não está acompanhando não é afetado — o tempo real normal (conversas, avisos, filas) continua igual.

## 2. Barra de "Acompanhando" colada na hora/bateria no celular
A barra do topo ficava embaixo da barra de status do celular (hora, wifi, bateria). Agora respeita a área segura (`env(safe-area-inset-top/left/right)`), e o conteúdo abaixo também. `styles/aovivo.css`.

## Testes
- Conferido no navegador: começar a acompanhar não encerra sozinho; a pessoa seguida move o super; o super abrir o WhatsApp encerra o acompanhamento e a pessoa não puxa mais de volta.
- `npm test` passou.
