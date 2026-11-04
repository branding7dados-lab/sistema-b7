# v4.2.0: abertura Estúdio + Gravações, Calendário e Configurações

Pedido do Kevin: itens "2, 8, 4, 7" da lista de telas, nesta ordem: Gravações, abertura nova, Calendário e Configurações.

## Abertura "Estúdio" (nova, opcional)
- Cena em `js/abertura-cenas.js` (função `estudio`), com duração de 4,2 s:
  - três refletores ligam um a um, aos 0,25 s, 0,55 s e 0,85 s, cada um com um estalo de luz;
  - entre 1,05 s e 1,95 s eles giram para o centro;
  - a luz da marca abre nos cantos, como no fundo do sistema;
  - aos 1,6 s o logo aparece no foco, e depois os refletores baixam.
- O logo usa o mesmo tempo da Aurora. O CSS foi copiado das regras da Aurora em `styles/abertura.css`.
- Registro do estilo:
  - `index.html`: a regex do `<head>`;
  - `js/app.js`: a lista `ESTILOS_AB` ("Estúdio") e `DURACAO_ESTILO`;
  - `js/abertura-som.js`: usa o som da Aurora.
- A abertura em uso (Streaming) não mudou. A nova é escolhida em Configurações → Abertura e sons, ou pelo administrador como padrão do sistema.

## Gravações
- Sobretítulo "Agenda de campo" e título maior.
- A lista ficou em vidro. O dia de cada gravação virou um ladrilho de vidro, e o de hoje tem o degradê com brilho.
- A barra de itens gravados agora é violeta→magenta.
- Detalhe da gravação: os blocos ficaram em vidro e os títulos das seções na fonte dos títulos.

## Calendário
- Sobretítulo "Toda a operação" e título maior.
- A grade do mês ficou em vidro. O número do dia de hoje tem o degradê, e os eventos ficaram com leve degradê no escuro.

## Configurações
- Título maior e blocos em vidro.
- No computador, o item aberto no menu tem o degradê da marca.
- Corrigido o rótulo "Você": ele também usa a classe `cfg-painel-bloco` (num `span` com texto em degradê), então a regra de vidro passou a valer só para o que não é `span`.

## Conferência
- Prints do antes e depois nos temas escuro e claro e no celular.
- Quadros da abertura nova em 0,45 s, 0,95 s, 1,6 s, 2,4 s e 3,6 s.
- `npm test` passou.
