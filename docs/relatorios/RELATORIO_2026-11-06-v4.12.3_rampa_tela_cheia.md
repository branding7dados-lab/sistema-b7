# v4.12.3 — Rampa certa e tela cheia de verdade

- Rampa: o modelo estava inclinado ao contrário da física (rotação -ang deixava a ponta alta virada para a pessoa). Voltou para +ang; ganhou setas amarelas acesas e corrimãos rosa. Trem: nariz inclinado, faixa acesa, faróis com brilho, para-choque zebrado e equipamentos no teto.
- Tela cheia: `js/jogo-tela-cheia.js` (B7.JogoTelaCheia) usa a Fullscreen API no navegador; no app Android pede `telaCheia` à ponte nativa, que esconde barra de status e de navegação (MainActivity.telaCheia, deslizar da borda mostra por um instante). Botão "✕ Sair da tela cheia" embaixo, ⛶ vira ✕, HUD respeita a área segura. Sai sozinho ao fechar/trocar de jogo.
- O app Android precisa da versão nova do APK para esconder as barras; no APK antigo continua como antes.

## 4.12.4 — Céu
- Esfera de céu (degradê de entardecer), 160/320 estrelas, lua com brilho e anel de cidade com janelas acesas, presos à câmera e fora da neblina; o painel roxo de fundo saiu. Neblina na cor do horizonte.
