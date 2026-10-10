# Relatório — app Android: barra de cima e abertura (zzz146, 10/10)

Primeiro teste no S25 FE do Kevin (vídeo). O app funcionou, com dois defeitos:

## 1. Ícones pretos na barra de cima
A barra do Android é transparente e o app desenha atrás dela. Os ícones (hora,
bateria) seguiam o tema claro do celular e ficavam pretos sobre a abertura e
o login, que são escuros.

Agora `js/app-nativo.js` escolhe a cor dos ícones pelo que está atrás deles:
- abertura e tela de login: **brancos** (essas telas são sempre escuras);
- no resto do sistema: conforme a cor do topo (a `theme-color`, que o `js/app.js`
  já mantinha igual ao topo). Tema claro → ícones escuros; tema escuro → brancos.

Os ícones abrem brancos desde o primeiro quadro (`SystemBars.style = DARK`).
O Android aplica a cor pela ponte (`barras` em `MainActivity.java`).

## 2. Abertura "quebrando"
O Android só descobria depois de carregar a página que o B7 ocupa a tela
inteira (`viewport-fit=cover`). Até lá, a página ficava menor, com uma faixa
embaixo, e crescia no meio da animação, cortando o desenho. Agora o app já
abre sabendo disso (`initialViewportFitValueHint: cover`): a tela não muda de
tamanho durante a abertura.

## Testes
- Navegador simulando a ponte:
  - abertura → ícones brancos;
  - topo claro → escuros;
  - topo escuro → brancos;
  - login com tema claro → brancos.
- APK montado com a configuração nova.
- `testes/` ok.
- **Não testado** no celular: vai no APK que o GitHub gera ao publicar.

Versão `2026-10-10-zzz146`, cache `v351`.
