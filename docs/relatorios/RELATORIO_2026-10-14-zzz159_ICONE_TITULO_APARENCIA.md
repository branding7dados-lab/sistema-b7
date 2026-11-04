# Relatório — ícone novo, título da janela e aparência pessoal (zzz159, 14/10)

Três pedidos do Kevin nesta rodada (o quarto, a exportação de roteiro, está no
fim: preciso de uma informação sua).

## 1. O nome na barra de cima vivia mudando (app de Windows)
O site troca o título a cada tela ("Configurações · Branding7", "Painel ·
Branding7"…) — o que é certo numa aba de navegador, mas no programa de
computador fica piscando um nome diferente a toda hora.

Agora a janela se chama **sempre "Sistema B7"** (`app-desktop/main.js`).

## 2. Ícone novo, no estilo iOS
O ícone era a lâmpada colorida sobre fundo quase branco. Agora é o formato dos
ícones de iPhone: **quadrado de cantos bem arredondados (squircle), degradê da
marca** (azul-noite → violeta → magenta), brilho suave em cima e o **símbolo do
B7 em branco** no centro.

Trocado em todo lugar:
- programa de Windows (ícone da janela, da barra de tarefas e do instalador);
- site e B7 instalado no celular (ícones 192 e 512, e o da aba do navegador);
- app de Android: ícone quadrado, redondo e o adaptativo (o launcher recorta
  como quiser — o fundo virou o degradê, antes era um cinza claro);
- a abertura do Android ganhou o círculo escuro atrás do símbolo branco (com o
  fundo claro de antes, o símbolo sumia).

## 3. Aparência: de cada um ou de todo mundo
Antes, a cor do sistema era só do administrador e valia para a equipe inteira.
Agora são duas camadas:

- **Aparência do sistema** (aba Admin, só administrador): continua definindo o
  **padrão da equipe** — cor, menu, botões, brilho e as datas especiais da
  abertura.
- **Cor do sistema** (Configurações → Aparência, **para todo mundo**): cada
  pessoa escolhe a sua, neste aparelho. Mesmas nove cores, cor personalizada,
  menu, botões e brilho, com prévia ao vivo no claro e no escuro.

Quem tem escolha própria **não é afetado** quando a administração muda a cor da
equipe. O botão **"Usar o padrão do sistema"** apaga a escolha e volta ao do
administrador. As datas especiais da abertura continuam sendo só do sistema, e
o claro/escuro segue como sempre foi (de cada um).

A escolha é aplicada antes da primeira pintura (nada de piscar a cor errada) e
sobrevive a sair e entrar na conta, como o tema.

## 4. Exportar roteiro
Testei aqui a exportação de roteiro em PDF (abrir a central, selecionar e
baixar) e o arquivo saiu normalmente, inclusive com as bibliotecas carregando
sob demanda (mudança da zzz158). Então preciso saber onde falhou aí para achar
o problema certo.

Enquanto isso, corrigi uma causa provável **no programa de Windows**: ele não
dizia onde salvar os downloads, então cada arquivo dependia de uma caixa de
"Salvar como" (e numa exportação de várias folhas, uma caixa atrás da outra).
Agora **salva direto na pasta Downloads** e mostra um aviso com "Abrir pasta".

## Arquivos
- `app-desktop/main.js`, `app-desktop/preload.js` (título e downloads).
- `app-desktop/recursos/icone.ico`, `assets/icons/*`, `manifest.json` e os
  `mipmap-*` do Android (ícones).
- `js/admin-extra.js` (camada pessoal da aparência), `js/dashboard.js` (a linha
  nas Configurações), `index.html` (aplica antes de pintar), `js/auth.js`
  (a escolha fica no aparelho ao sair da conta).
- `js/auth.js` (`2026-10-14-zzz159`), `sw.js` (`roteiros-b7-v364`).
