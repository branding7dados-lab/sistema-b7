/* 4.12.3: tela cheia dos jogos — Fullscreen do navegador (ou, no app
   Android, esconde as barras do sistema) + botão "Sair da tela cheia" */
window.B7 = window.B7 || {};
B7.JogoTelaCheia = function (raiz, medir) {
  const bt = raiz.querySelector('.j3-cheia'), palco = raiz.querySelector('.j3-palco');
  const sair = document.createElement('button'); sair.type = 'button'; sair.className = 'j3-sair-cheia'; sair.textContent = '✕ Sair da tela cheia';
  palco.appendChild(sair);
  const nativo = () => B7.AppNativo && B7.AppNativo.ativo;
  const doc = document, fsEl = () => doc.fullscreenElement || doc.webkitFullscreenElement;
  function ligar(on) {
    raiz.classList.toggle('j3-cheio', on);
    bt.textContent = on ? '✕' : '⛶'; bt.title = on ? 'Sair da tela cheia' : 'Tela cheia';
    if (nativo()) { try { B7.AppNativo.pedir('telaCheia', { ligar: on }); } catch (e) {} }
    else if (on && !fsEl()) { const f = palco.requestFullscreen || palco.webkitRequestFullscreen; if (f) { try { const r = f.call(palco, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } catch (e) {} } }
    else if (!on && fsEl()) { const x = doc.exitFullscreen || doc.webkitExitFullscreen; if (x) { try { const r = x.call(doc); if (r && r.catch) r.catch(() => {}); } catch (e) {} } }
    setTimeout(medir, 60); setTimeout(medir, 400);
  }
  bt.onclick = e => { e.stopPropagation(); ligar(!raiz.classList.contains('j3-cheio')); };
  sair.onclick = e => { e.stopPropagation(); ligar(false); };
  const aoMudar = () => { if (!fsEl() && raiz.classList.contains('j3-cheio') && !nativo()) ligar(false); };
  doc.addEventListener('fullscreenchange', aoMudar); doc.addEventListener('webkitfullscreenchange', aoMudar);
  return () => { doc.removeEventListener('fullscreenchange', aoMudar); doc.removeEventListener('webkitfullscreenchange', aoMudar); if (raiz.classList.contains('j3-cheio')) ligar(false); };
};
