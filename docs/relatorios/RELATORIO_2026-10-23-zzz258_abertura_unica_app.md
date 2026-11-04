# zzz258 — App Android: uma abertura só, a mesma do site

Pedido do Kevin: a abertura do app tem que ser a mesma do site (todas as opções selecionáveis igual
ao site) e, como o Android já tem a abertura dele, não faz sentido ter duas.
Escolha: "ponte perfeita".

- Abertura do Android (SplashScreen) virou só o **céu da abertura do sistema** (#05030A), sem ícone
  (`b7_abertura_vazio`). Saiu a abertura própria do app da zzz256 (símbolo animado + marca).
- `index.html`: logo depois do bloco da abertura, avisa o app (`B7Nativo` → `aberturaVisivel`) no
  primeiro quadro em que ela está na tela. `MainActivity` tira a abertura do Android **na hora, sem
  animação** (mesma cor por baixo: sem emenda). Rede de segurança: página carregada + 0,4 s, ou 3 s.
- WebView, janela e barras com a mesma cor do céu: nada de faixa azul ou flash.
- Som da abertura toca sem precisar de toque antes (`setMediaPlaybackRequiresUserGesture(false)`).
- A escolha continua em Configurações → Abertura e sons (9 aberturas + 6 carregamentos), igual ao site.
  Regras do site valem no app: abertura completa ao abrir do zero; se usou há menos de 30 min, o carregamento curto.
- Ícone temático (zzz256) e marca em alta continuam.
