# Relatório — barras transparentes de volta e aviso com o app aberto (zzz151, 11/10)

Teste do Kevin na zzz150: o topo ficou certo, mas as barras do celular perderam
a transparência. E as notificações não apareciam.

## Barras transparentes
- **Voltou o jeito transparente:** o B7 desenha por trás da barra de cima e da
  barra de gestos (SystemBars do Capacitor no modo "css"; abre já sabendo que
  ocupa a tela inteira, então a abertura não pula).
- **O que deixava o topo por baixo da hora** eram painéis que abrem por cima e
  não se afastavam da barra. Agora se afastam (`env(safe-area-inset-*)`, que vale
  0 no navegador):
  - painel Conversas;
  - visualizador de artes do Design;
  - apresentação;
  - faixa "vendo como outra pessoa";
  - busca;
  - janelas que sobem de baixo no celular.
- **Conferido com uma varredura automática:** num Chromium com 40px de barra em
  cima e 24px embaixo, todas as telas e os painéis (conversas, assistente,
  busca, menu Mais, perfil, janela de confirmação, menu da conta) ficaram livres
  das barras.
- A cor dos ícones (brancos em tela escura, escuros em tela clara) continua
  automática.

## Notificações com o app aberto
- O servidor estava entregando ao Firebase sem erro. Mas, com o app aberto na
  tela, o Android **não mostra** a notificação: ele a entrega ao app. O teste foi
  feito com o app aberto, por isso nada aparecia.
- Agora o app mostra o aviso na barra de notificações (canal "Avisos do B7",
  ícone e cor do B7). Tocar abre a tela do aviso e tira das não lidas, mesmo que
  o app tenha sido fechado antes do toque.

## Testes
- APK montado.
- Varredura das barras ok.
- `testes/` ok.
- **Não testado** no celular: vem neste APK.

Versão `2026-10-11-zzz151`, cache `v356`.
