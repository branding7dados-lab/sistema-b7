# zzz271 — Correções: bolinha do status e frase do carregamento

## Relatado pelo Kevin (com prints)
1. A bolinha de status do perfil (cartão da barra lateral e topo do painel) aparecia amassada em cima da foto.
2. Na tela de carregamento, "Preparando o seu espaço…" ficava ilegível sobre as faixas da abertura.

## Causa e correção
1. O avatar (`.av-pessoa`) tem `overflow:hidden` e é flex: a bolinha, colocada dentro dele, era cortada e, com foto, espremida ao lado da imagem. Agora o avatar fica dentro de um invólucro (`.pf-av`) e a bolinha é filha do invólucro, no canto (`js/perfil-lateral.js`, `styles/nav.css`).
2. A abertura "streaming" continua com faixas claras correndo enquanto o sistema não termina de carregar, e a frase ficava por cima delas. A espera ganhou uma placa de vidro escuro do tamanho do texto, acima das faixas (`styles/abertura.css`) — vale para todos os estilos de abertura.

## Testes
- `npm test` verde; prints: cartão e painel com foto (tema claro) e a abertura streaming parada na espera (antes/depois).
