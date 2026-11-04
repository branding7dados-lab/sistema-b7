# v4.1.0: Estúdio tela a tela (login, abertura, Painel, Produção de Vídeo)

Pedido do Kevin: "login, abertura, painel e produção de vídeo". Tudo foi feito em `styles/v4.css`, na seção "4.1", com duas mudanças pequenas de HTML.

## Login (`js/auth.js`)
- Em telas de 980 px ou mais, uma vitrine aparece à esquerda do formulário (`.login-vitrine`, `aria-hidden`). Ela traz:
  - o sobretítulo "Branding7 · Estúdio";
  - o título "Da ideia à entrega, num lugar só.";
  - as quatro etapas (Roteiro, Gravação, Edição, Aprovação) em cartões de vidro.
- No celular a tela continua só com o formulário. O formulário, o login com Google, as 2 etapas e o "Esqueci minha senha" não mudaram.
- O céu do login ficou igual ao do desenho A: ameixa com luz magenta no alto.

## Abertura
- A animação não mudou. Ela é a que o Kevin escolheu, e o estilo em uso, "streaming", ficou intocado.
- Só o céu do estilo clássico ganhou as luzes do Estúdio nos cantos.

## Painel
- Título maior e sobretítulo na cor da marca.
- Números dos cartões maiores. O cartão "Atrasadas" ganhou um brilho vermelho.
- "Precisa da sua atenção": as linhas eram inteiras tingidas e, no tema claro, tudo ficava rosa. Agora são vidro neutro com uma faixa de cor à esquerda (vermelha para atrasado, âmbar para correção).
- Vão entre "Minha semana" e "Minha fila" corrigido entre 1101 e 1499 px de largura. O grid usava linhas `auto`, e a altura da lista de atenção se dividia entre as duas linhas. Agora são `min-content 1fr`.

## Produção de Vídeo (`js/video.js`)
- Sobretítulo "Fila de edição" acima do título, e título maior.
- Colunas do Kanban em vidro com borda. Cartões com degradê translúcido no tema escuro e borda magenta no hover.

## Conferência
- Prints do antes e depois das quatro telas: escuro e claro no computador, escuro no celular.
- `npm test` passou.
