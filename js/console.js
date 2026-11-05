/* =====================================================================
   CONSOLE B7 — aba "Jogos" do modo entretenimento (zzz297)
   Pedido do Kevin: "uma aba de jogos, mas só no modo entretenimento, tipo
   console (PS5), e mais jogos".
   • Modo entretenimento: liga/desliga no painel do perfil (vale neste
     aparelho, localStorage b7_entretenimento). Ligado, aparece "Jogos"
     na barra lateral / "Mais".
   • #/jogos abre o console por cima do sistema: fundo que muda com o jogo
     escolhido, fileira de capas, setas/Enter, controle (Gamepad) e toque.
     Esc / B volta; no menu, Esc fecha o console.
   • Jogos: os da manutenção (Corre pro Set!, Ação! Corta!, Memória,
     Clássico 2D) + os novos de js/jogos-extra.js.
   ===================================================================== */
window.B7 = window.B7 || {};
B7.Console = (function () {
  const CHAVE = 'b7_entretenimento';
  const ligado = () => { try { return localStorage.getItem(CHAVE) === '1'; } catch (e) { return false; } };
  function ligar(v) {
    try { v ? localStorage.setItem(CHAVE, '1') : localStorage.removeItem(CHAVE); } catch (e) {}
    try { B7.Nav && B7.Nav.sincronizar && B7.Nav.sincronizar(); } catch (e) {}
    if (B7.UI && B7.UI.toast) B7.UI.toast(v ? '🎮 Modo entretenimento ligado: a aba Jogos apareceu no menu.' : 'Modo entretenimento desligado.');
  }
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const temGL = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };

  function lista() {
    const gl = temGL();
    return [
      { id: 'corrida', ic: '🏃', nome: 'Corre pro Set!', txt: 'Corra pela cidade, suba nos trens, pegue moedas e fuja do diretor.', gen: 'Corrida 3D', cor: ['#3D2FD9', '#E2409C'], so3d: true, abrir: c => B7.JogoCorrida.montar(c) },
      { id: 'drone', ic: '🚁', nome: 'Drone B7', txt: 'Toque ou espaço para subir. Passe entre as torres sem bater.', gen: 'Arcade', cor: ['#0E7C86', '#4C6FFF'], abrir: c => B7.JogosExtra.drone(c) },
      { id: 'cobra', ic: '🐍', nome: 'Cabo Solto', txt: 'O cabo da câmera cresce a cada cartão de memória. Não se enrosque!', gen: 'Clássico', cor: ['#1F8A4C', '#7B4DFF'], abrir: c => B7.JogosExtra.cobra(c) },
      { id: 'fusao', ic: '🔢', nome: 'Fusão 2048', txt: 'Junte os números iguais até chegar no 2048. Setas ou deslize.', gen: 'Quebra-cabeça', cor: ['#B5248F', '#FF9F43'], abrir: c => B7.JogosExtra.fusao(c) },
      { id: 'claquete', ic: '🎬', nome: 'Quebra-Claquete', txt: 'Rebata a bola e quebre todos os blocos do estúdio.', gen: 'Arcade', cor: ['#C2187A', '#3D2FD9'], abrir: c => B7.JogosExtra.claquete(c) },
      { id: 'corta', ic: '🎥', nome: 'Ação! Corta!', txt: 'Ande no AÇÃO, congele no CORTA. Chegue ao fim do set.', gen: 'Reflexo 3D', cor: ['#7A2BC9', '#FF5F5F'], so3d: true, abrir: c => B7.Jogo3D.montar(c) },
      { id: 'memoria', ic: '🃏', nome: 'Memória do Set', txt: 'Ache os pares contra o relógio. Acertos seguidos valem mais.', gen: 'Memória', cor: ['#5E5CE6', '#30B0C7'], abrir: c => B7.JogoMemoria.montar(c) },
      { id: 'classico', ic: '🕹', nome: 'Clássico 2D', txt: 'A versão leve do corredor. Roda em qualquer aparelho.', gen: 'Clássico', cor: ['#444', '#B5248F'], abrir: c => B7.JogoManut.montar(c) }
    ].filter(j => !j.so3d || gl);
  }

  let raiz = null, sel = 0, jogando = null, gpTimer = 0, gpAntes = {};
  function carregar() {
    return B7.vendor('telaCheia', 'jogoManut', 'jogo3d', 'corridaModelos', 'corrida', 'memoria', 'jogosExtra').catch(() => {});
  }

  function abrir() {
    if (raiz) return;
    raiz = document.createElement('div');
    raiz.className = 'cs';
    raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-label', 'Console de jogos');
    raiz.innerHTML = '<div class="cs-fundo"></div><div class="cs-carregando">Carregando jogos…</div>';
    document.body.appendChild(raiz);
    document.documentElement.classList.add('cs-aberto');
    addEventListener('keydown', tecla, true);
    carregar().then(() => { if (raiz) menu(); });
    gpTimer = setInterval(controle, 90);
  }
  function fechar(semVoltar) {
    if (!raiz) return;
    pararJogo();
    removeEventListener('keydown', tecla, true);
    clearInterval(gpTimer);
    raiz.classList.add('saindo');
    const r = raiz; raiz = null;
    setTimeout(() => r.remove(), 300);
    document.documentElement.classList.remove('cs-aberto');
    if (!semVoltar && /^#\/jogos/.test(location.hash)) { if (history.length > 1) history.back(); else location.hash = '#/'; }
  }

  function menu() {
    const J = lista();
    let ultimo = null; try { ultimo = localStorage.getItem('b7_console_ultimo'); } catch (e) {}
    const i0 = J.findIndex(j => j.id === ultimo); sel = i0 >= 0 ? i0 : 0;
    const u = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
    const nome = String((u && (u.nome || u.username)) || '').split(/\s+/)[0];
    raiz.innerHTML =
      '<div class="cs-fundo"></div><div class="cs-luz"></div>' +
      '<header class="cs-topo"><span class="cs-marca">B7 <b>Console</b></span>' +
        '<span class="cs-dir"><span class="cs-user">' + esc(nome) + '</span><time class="cs-hora"></time>' +
        '<button type="button" class="cs-x" aria-label="Fechar o console">✕</button></span></header>' +
      '<section class="cs-hero"><small class="cs-gen"></small><h1 class="cs-tit"></h1><p class="cs-txt"></p>' +
        '<div class="cs-acoes"><button type="button" class="cs-jogar">▶ Jogar</button><span class="cs-rec"></span></div></section>' +
      '<nav class="cs-fila" aria-label="Jogos">' + J.map((j, i) =>
        '<button type="button" class="cs-capa" data-i="' + i + '" style="--c1:' + j.cor[0] + ';--c2:' + j.cor[1] + '" aria-label="' + esc(j.nome) + '"><i>' + j.ic + '</i><b>' + esc(j.nome) + '</b></button>').join('') + '</nav>' +
      '<footer class="cs-dicas"><span><kbd>←</kbd><kbd>→</kbd> escolher</span><span><kbd>Enter</kbd>/<kbd>A</kbd> jogar</span><span><kbd>Esc</kbd>/<kbd>B</kbd> sair</span></footer>';
    raiz.querySelector('.cs-x').onclick = fechar;
    raiz.querySelector('.cs-jogar').onclick = () => jogar(sel);
    raiz.querySelectorAll('.cs-capa').forEach(b => b.onclick = () => { if (+b.dataset.i === sel) jogar(sel); else escolher(+b.dataset.i); });
    const hora = () => { const h = raiz && raiz.querySelector('.cs-hora'); if (h) h.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
    hora(); clearInterval(raiz._h); raiz._h = setInterval(hora, 15000);
    escolher(sel, true);
  }
  function escolher(i, primeiro) {
    const J = lista(); if (!raiz || !J.length) return;
    sel = (i + J.length) % J.length;
    const j = J[sel];
    raiz.style.setProperty('--c1', j.cor[0]); raiz.style.setProperty('--c2', j.cor[1]);
    raiz.querySelectorAll('.cs-capa').forEach((b, k) => { b.classList.toggle('on', k === sel); b.setAttribute('aria-current', k === sel ? 'true' : 'false'); });
    const hero = raiz.querySelector('.cs-hero');
    hero.classList.remove('troca'); void hero.offsetWidth; if (!primeiro) hero.classList.add('troca');
    raiz.querySelector('.cs-gen').textContent = j.gen;
    raiz.querySelector('.cs-tit').textContent = j.ic + ' ' + j.nome;
    raiz.querySelector('.cs-txt').textContent = j.txt;
    let rec = 0; try { rec = +localStorage.getItem('b7_jx_rec_' + j.id) || 0; } catch (e) {}
    raiz.querySelector('.cs-rec').textContent = rec ? '🏆 Seu recorde: ' + rec : '';
    const capa = raiz.querySelectorAll('.cs-capa')[sel];
    if (capa && capa.scrollIntoView) capa.scrollIntoView({ block: 'nearest', inline: 'center', behavior: primeiro ? 'auto' : 'smooth' });
  }
  function jogar(i) {
    const j = lista()[i]; if (!j || !raiz) return;
    try { localStorage.setItem('b7_console_ultimo', j.id); } catch (e) {}
    pararJogo();
    const tela = document.createElement('div');
    tela.className = 'cs-jogo';
    tela.innerHTML = '<div class="cs-jogo-topo"><button type="button" class="cs-voltar">← Voltar</button><b>' + j.ic + ' ' + esc(j.nome) + '</b><span></span></div><div class="cs-palco"></div>';
    raiz.appendChild(tela);
    raiz.classList.add('jogando');
    tela.querySelector('.cs-voltar').onclick = sairDoJogo;
    let inst = null;
    try { inst = j.abrir(tela.querySelector('.cs-palco')) || null; } catch (e) { tela.querySelector('.cs-palco').innerHTML = '<p class="cs-erro">Esse jogo não abriu neste aparelho.</p>'; }
    jogando = { tela, inst };
  }
  function pararJogo() {
    if (!jogando) return;
    try { jogando.inst && jogando.inst.parar && jogando.inst.parar(); } catch (e) {}
    jogando.tela.remove(); jogando = null;
    if (raiz) raiz.classList.remove('jogando');
  }
  function sairDoJogo() { pararJogo(); if (raiz) escolher(sel, true); }

  function tecla(e) {
    if (!raiz) return;
    if (jogando) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); sairDoJogo(); } return; }
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); escolher(sel + 1); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); escolher(sel - 1); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); jogar(sel); }
    else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); }
  }
  /* controle de videogame: direcional/analógico, A = jogar, B = voltar */
  function controle() {
    if (!raiz || !navigator.getGamepads) return;
    const gp = [...navigator.getGamepads()].find(Boolean); if (!gp) return;
    const ax = gp.axes[0] || 0;
    const agora = { dir: gp.buttons[15] && gp.buttons[15].pressed || ax > .6, esq: gp.buttons[14] && gp.buttons[14].pressed || ax < -.6,
      a: gp.buttons[0] && gp.buttons[0].pressed, b: gp.buttons[1] && gp.buttons[1].pressed };
    const novo = k => agora[k] && !gpAntes[k];
    if (jogando) { if (novo('b')) sairDoJogo(); }
    else { if (novo('dir')) escolher(sel + 1); if (novo('esq')) escolher(sel - 1); if (novo('a')) jogar(sel); if (novo('b')) fechar(); }
    gpAntes = agora;
  }

  addEventListener('hashchange', () => { if (raiz && !/^#\/jogos/.test(location.hash)) fechar(true); });
  return { abrir, fechar, ligado, ligar, aberto: () => !!raiz };
})();
