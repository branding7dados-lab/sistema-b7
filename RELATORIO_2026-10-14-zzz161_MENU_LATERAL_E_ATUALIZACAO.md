# Relatório — menu lateral obedecendo a escolha, tela de aparência e
# "procurar atualização" no PC (zzz161, 14/10)

## 1. "Escolho o menu lateral e ele não muda de cor"
Kevin tinha razão, e o problema não era da aparência pessoal: **o menu lateral
nunca obedeceu a essa escolha**, nem a do administrador.

O desenho atual do menu (a "peça de vidro", pacote zr) foi escrito com cores
fixas no CSS — um roxo e um magenta fixos e um fundo fixo. Então "Padrão /
Tingido / Grafite" e a cor do sistema mudavam o resto do sistema e **a prévia
dentro da janela**, mas o menu de verdade continuava igual. Dava exatamente a
impressão de que o botão não funcionava.

Agora o menu é montado a partir das escolhas:
- o fundo vem de `--sidebar` / `--sidebar-2` (é o que "Padrão / Tingido /
  Grafite" muda);
- as duas luzes (uma no alto, outra embaixo) vêm da **cor escolhida**, sempre
  nos tons escuros — o menu é escuro nos dois temas.

Com as escolhas padrão, o menu continua exatamente como era (os valores de hoje
viraram os valores padrão dos novos tokens `--sb-luz1` / `--sb-luz2`).

## 2. A tela de aparência
Na janela do programa de computador (uns 800 px) a tela ficava espremida em
duas colunas. Agora, abaixo de 980 px, a **prévia vai para cima** e os
controles ocupam a largura toda, com as cores em cartões maiores. Acima disso
continua lado a lado, como era.

## 3. "O app de PC não aparece nada pra atualizar"
O programa conferia **calado**: sem versão nova, sem erro, sem nada — clicar em
"Procurar atualização" parecia não fazer efeito (e a conferência automática só
acontece 12 s depois de abrir e de 2 em 2 horas).

Agora, quando a pessoa pede:
- avisa **"Procurando versão nova…"**;
- se não houver: **"Você já está na versão mais nova (1.0.x)"**;
- se houver: **"Versão X encontrada. Baixando…"**, com a barra de progresso no
  ícone da barra de tarefas, e a pergunta de instalar ao terminar;
- se der erro (sem internet, por exemplo): diz o que houve.

E em **Configurações → Sistema → App Windows** agora dá para pedir a
conferência direto, sem ir ao menu.

De quebra: a release do Windows guardava um instalador de 78 MB por publicação.
Agora fica só o da versão atual e o link fixo.

## Arquivos
- `styles/nav.css`, `styles/global.css` (o menu lateral obedece à escolha),
  `js/admin-extra.js` (as luzes saem da cor escolhida).
- `styles/sistema.css` (a tela de aparência em janela estreita).
- `app-desktop/main.js` (retorno ao procurar atualização),
  `js/dashboard.js` (o botão nas Configurações).
- `.github/workflows/desktop.yml` (limpa instaladores antigos).
- `js/auth.js` (`2026-10-14-zzz161`), `sw.js` (`roteiros-b7-v366`).
