# zzz256 — App Android: visual mais caprichado

Pedido do Kevin: "queria ele mais pesado… porém otimizado" → escolheu "visual mais caprichado".

- **Abertura animada (Android 12+)**: o símbolo da B7 foi contornado em vetor a partir do original
  (`assets/brand/originais/symbol-color.png`) e virou `res/drawable/b7_abertura_animada.xml`
  (AnimatedVectorDrawable, 1 s): bulbo acende e cresce, a base sobe em três degraus, as seis bolhas
  saem uma a uma com um leve "pulo". Degradê da marca (azul → violeta → magenta). Marca "Branding7"
  em vetor no rodapé (`b7_abertura_marca.xml`). Android 11 e anteriores: o símbolo parado.
- **Transição**: `MainActivity` usa `SplashScreen.installSplashScreen`; a abertura fica até a página
  do sistema carregar (no máximo 3 s) e sai com zoom + esmaecer — sem o fundo vazio piscando.
- **Ícone temático (Android 13+)**: camada `monochrome` em todos os ícones (padrão e as 6 cores).
- **Marca em alta no app**: `copiar-site.mjs` põe em `www/assets/brand` as versões 3× de
  `app-android/hd/brand` (mesma proporção do site). O site continua com as leves.
- Ferramentas para refazer os desenhos se a marca mudar: `app-android/ferramentas/` (tracar.py, gerar.py).
- O APK fica ~0,5 MB maior.
