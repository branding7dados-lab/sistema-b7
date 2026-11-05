# v4.14.0 — Teleprompter com a câmera nativa (app Android)

- `CameraNativa.java` (CameraX 1.4.2): PreviewView ATRÁS do WebView (WebView fica transparente), Recorder com qualidade 4K → Full HD → HD, estabilização de vídeo e de prévia quando `VideoCapabilities.isStabilizationSupported()`, HDR (HLG 10 bits) quando suportado; se o aparelho recusar a combinação, liga o básico. Áudio pela própria câmera (sem o modo "chamada de voz"). Grava direto na galeria (Movies/B7) e avisa com um Toast ao salvar.
- Ponte: `camAbrir {frente}`, `camGravar {nome}`, `camParar`, `camTrocar`, `camFechar`; respostas trazem `camNativa:true`. Permissão de câmera/microfone pedida pelo app quando faltar.
- Teleprompter (js/teleprompter.js): usa a nativa quando `B7.AppNativo.recursos.camNativa`; senão continua com getUserMedia + MediaRecorder (site, PC e APK antigo). `html.b7-cam-nativa` deixa a página vazada e esconde o resto do sistema atrás.
- Testado: caminho do navegador (câmera falsa) e caminho nativo simulado (classe e pedidos certos, sem erros). Compilação do APK pelo GitHub Actions. Precisa testar num celular de verdade.
