# v4.21.1 — Celular deitado

- No app Android com o celular deitado, o B7 usa o layout de tela larga, que não tinha margem para a barra de status nem para o recorte da câmera (hora/bateria por cima do topo). `#app` ganha padding com `env(safe-area-inset-*)` quando é tela de toque, deitada e baixa (≤600 px de altura).
