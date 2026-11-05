# v4.13.0 — Teleprompter: caixa ajustável, áudio limpo, vídeo em mais qualidade

- **Caixa do texto (estilo CapCut):** com a câmera ligada, `.tele-palco` vira uma caixa posicionada por `P.caixa {x,y,w,h}` em % da tela (padrão logo abaixo da lente). Botão "Caixa" no topo entra no modo ajuste: arrastar move, alça amarela no canto redimensiona, "Pronto" salva. Pausa a leitura ao ajustar.
- **Áudio:** a causa do áudio "pipocado" era `echoCancellation`/`noiseSuppression` ligados (o Android usa o modo de chamada de voz). Agora `false` + `autoGainControl:false`, 48 kHz, 16 bits, mono; reaplicado com `applyConstraints` depois de abrir. Gravação a 256 kb/s.
- **Vídeo:** pede até 3840×2160 a 30 qps (`resizeMode:'none'`, `contentHint:'detail'`), com volta para 1080p se o aparelho recusar; bitrate pela resolução real (10/16/40 Mb/s).
- Testado com câmera falsa no Chromium: filtros de áudio confirmados desligados, caixa movida e texto rolando dentro dela, gravação iniciando.
- Limite: dentro do app (WebView) não há acesso a estabilização, HDR nem lente/modo da câmera nativa; isso exigiria gravar pela câmera nativa (CameraX) — projeto à parte.
