# Relatório — rolagem do Painel no celular + atalhos do ícone (zzz155, 11/10)

## 1. Rolagem "travando" ao abrir o app
O que o Kevin viu (vídeo): logo ao abrir o app, a tela só rolava enquanto o
dedo estava encostado; ao soltar, parava na hora. Depois de puxar para
atualizar, rolava solta.

Diferença entre as duas situações: só na PRIMEIRA abertura o Painel liga o
"filme" de entrada, que tem duas coisas presas à rolagem:
- paralaxe do topo (`animation-timeline: scroll()` — o topo recua conforme
  rola);
- blocos que surgem conforme aparecem na tela (com giro 3D e uma linha de luz
  na borda).
O "Atualizar" remonta o Painel no modo calmo, sem essas duas coisas — por isso
depois rolava bem. No WebView do Android elas matavam o embalo do dedo.

Correção (`js/painel.js`): em tela de toque (celular/app), o Painel não liga
mais essas animações presas à rolagem; os blocos já aparecem prontos. O resto
da entrada (céu, saudação, números contando) continua igual. No computador nada
muda.

Não foi possível reproduzir o travamento no Chromium do computador (só
acontece no WebView do celular); a correção remove exatamente o que muda entre
"travado" e "solto".

## 2. Atalhos ao segurar o ícone do app
Segurando o ícone do B7 na tela inicial aparecem 4 atalhos:
- **Meu dia** — abre o "Meu dia em 30 segundos".
- **Gravações** — abre a gravação de hoje (se for só uma) ou a lista.
- **Teleprompter** — abre a próxima gravação (hoje ou amanhã) já com o
  teleprompter dos roteiros dela.
- **Nova ideia** — janelinha com cliente + ideia, guardada no banco de ideias
  do cliente (lembra o último cliente usado).

Dá também para arrastar um atalho e deixar ele como ícone próprio na tela.

Funciona com o app aberto ou fechado (com o app fechado, espera o login e a
abertura terminarem). Quem chega por um atalho não recebe o "Meu dia" abrindo
sozinho por cima.

De quebra: o toque no widget com o app totalmente fechado agora também abre a
tela certa (antes o link do widget só era lido com o app já aberto).

## Arquivos
- `js/painel.js` (rolagem).
- `js/atalhos-app.js` (novo), `js/app-nativo.js`, `js/hoje.js`.
- Android: `res/xml/shortcuts.xml`, `res/drawable/ic_atalho_*.xml`,
  `res/values/strings.xml`, `AndroidManifest.xml`, `MainActivity.java`.
- `index.html`, `sw.js` (cache `roteiros-b7-v360`), `js/auth.js`
  (`2026-10-11-zzz155`).
