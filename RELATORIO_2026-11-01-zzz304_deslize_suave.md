# zzz304 — Arrastar entre abas sem "voltar e sumir" nem desfoque

## O que o vídeo do Kevin mostrou
1. A tela saía para o lado e **voltava ao lugar** antes da aba nova aparecer.
2. Logo depois vinha uma **tela desfocada**: o morph da troca de módulo (View Transition em `js/app.js`) fotografava a tela antiga, que já tinha voltado ao lugar, e a desfocava.
3. O Vídeo parecia **demorar**: os números do topo contavam desde o zero.

## Causas e correções
- `js/movimento.js` (`deslizar`): depois do gesto, a tela antiga era devolvida ao lugar na hora, porque a troca de rota só redesenha um instante depois.
  - Agora `aoIr` devolve `true` quando a troca vai acontecer, e a tela fica fora até ser substituída. Uma segurança de 1,5 s devolve a tela se nada trocar.
  - Opção `livre`: na troca de aba, a tela segue o dedo quase 1:1 (antes, uma resistência travava em ~90 px) e sai 45% da largura.
- `js/app.js`: troca vinda do gesto (`html[data-vindo]`) não usa o morph com desfoque.
- `js/movimento.js` (foto da tela): a foto da tela que sai é tirada parada, sem o deslocamento do gesto. A foto da aba de destino, quando já vista, entra deslizando do lado do gesto.
- `js/video.js`: chegando pelo gesto, os números do topo aparecem prontos, sem a contagem.
- `styles/nav.css`: a aba nova entra de 38% da largura, em 0,3 s.

## Conferido
- Sequência de prints (0 a 700 ms) do gesto Clientes → Gravações: a tela sai, não volta, e a nova entra sem desfoque.
- `npm test`.
