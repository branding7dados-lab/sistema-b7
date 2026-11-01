# zzz303 — Arrastar entre abas e vidro líquido na barra de baixo (celular)

## Arrastar para o lado troca de aba
- `js/nav.js` (`ligarDeslizeAbas`): no `#painel-dashboard`, um arrasto horizontal vai para a aba vizinha da barra de baixo, na ordem da barra (sem o "Mais"). Reaproveita o `B7.Movimento.deslizar` do Calendário: a tela segue o dedo com resistência, troca depois de 64 px ou num peteleco rápido, e a aba nova entra do lado certo (`html[data-vindo]`).
- O gesto **não** age em:
  - telas que não estão na barra;
  - folhas e modais abertos;
  - texto selecionado;
  - campos de texto;
  - o que rola de lado (carrosséis, chips);
  - módulos com o próprio gesto (Calendário, Publicações, Kanban);
  - vídeo e canvas;
  - gesto que começa a menos de 22 px da borda da tela (o "voltar" do Android/iOS).
- `js/movimento.js`: `deslizar` ganhou as opções `ignorar(alvo)` e `semBorda`.

## Vidro líquido
- `js/vidro.js`: no Chromium (app Android, programa do Windows, Chrome), monta um filtro SVG do tamanho da barra:
  - um mapa de deslocamento, neutro no meio e inclinado nas bordas, que faz o conteúdo de trás entortar nas beiradas;
  - três passadas, uma por cor, com forças um pouco diferentes, que dão a franja colorida;
  - um desfoque leve por cima.
  O filtro é aplicado com `backdrop-filter: url(#b7-vidro-liq)` e refeito quando a barra muda de tamanho.
- Ajustado pela referência do Kevin (Liquid Glass da Apple): quase sem véu (12–18% de cor), desfoque leve (9 px; 4 px dentro do filtro), curva forte só na borda, contorno fino e brilhante e reflexo de luz no canto de cima. O mapa tem cinza neutro fora da forma arredondada, para as pontas da pílula não puxarem imagem de fora da barra.
- `styles/nav.css`: em todo celular, com brilho que corre pelo contorno (máscara), reflexo no alto e a pílula do item ativo como lente menor. iPhone/Safari e o modo leve ficam com o vidro desfocado, sem o filtro SVG.

## Conferido
- Simulação de toque: de Clientes, arrastar para a esquerda leva a Gravações, para a direita volta a Clientes, e começar na borda não troca.
- Print da barra por cima de faixas coloridas: o conteúdo entorta na borda, sem mancha de cor nas pontas.
