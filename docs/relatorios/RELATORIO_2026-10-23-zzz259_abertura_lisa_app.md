# zzz259 — Abertura lisa no app Android

Kevin mandou uma gravação: "tá meio travada a abertura".

## O que o vídeo mostrou (análise quadro a quadro)
- ~1,2 s de tela escura (abertura do Android) e a abertura do sistema já aparece **no meio**: o começo
  rodou escondido enquanto o WebView carregava.
- Congelamentos de 0,41 s e 0,13 s logo no começo: o celular estava lendo e executando os ~3,9 MB de
  scripts da página ao mesmo tempo que a animação.

## Correção
1. **A abertura espera o código** (só no app): no `<head>`, se existe a ponte `B7Nativo`, a página ganha
   `ab-espera-app`, e `styles/abertura.css` deixa todas as animações da abertura **paradas no quadro 0**
   (as camadas em canvas leem o relógio dessas animações, então param junto). Dois quadros depois do
   `DOMContentLoaded` (todos os scripts já rodaram) a classe sai, a abertura começa do zero, o som é
   disparado (`abertura-som.js` espera o evento `b7:abertura-solta`) e o app tira a abertura do Android
   (`aberturaVisivel`). Rede de segurança: 4 s. `app.js` conta o tempo mínimo só depois que ela começa.
2. **Código compactado no APK**: `copiar-site.mjs` minifica cada `.js` e `.css` do `www/` com esbuild
   (arquivo por arquivo, mesmos nomes globais). Scripts carregados na abertura: 3,85 MB → 2,41 MB;
   CSS: 1,48 → 1,23 MB. O site continua com o original legível.
- `testes/fumaca.mjs` aceita `B7_RAIZ` para rodar a mesma fumaça na pasta do app: todas as telas
  abriram sem erro com o código compactado.
- Teste no Chromium simulando o app: abertura parada até 1,37 s (DOMContentLoaded 1,05 s) e depois
  rodando do 0; no site (sem a ponte) nada muda.
