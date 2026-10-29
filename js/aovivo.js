/* =====================================================================
   EQUIPE AO VIVO — só super admin e admin supremo.

   Parte 1 (zzz284): ver quem da equipe está no Sistema agora e em que
   tela está, ao vivo (Supabase Realtime, presença).

   Parte 2 (zzz285 → zzz296): ACOMPANHAR ao vivo. O super escolhe uma
   pessoa e vê a TELA DELA como ela vê: subtelas, abas, janelas abertas,
   o que ela digita nos campos, a rolagem, o cursor e os cliques. É um
   espelho: a tela da pessoa é copiada (sem nenhum script) e desenhada
   numa moldura do tamanho da tela dela — no celular, aparece o celular.
   Nada é "clicado" do lado do super: só se olha.

   O que NUNCA sai da tela da pessoa: senha, código de verificação e
   qualquer campo marcado com data-av-privado.

   Em troca, enquanto alguém está acompanhando, a tela da pessoa mostra
   o selo "Tela compartilhada" — ela tem como saber. Esse selo aparece
   para QUALQUER acompanhamento (não dá para acompanhar sem ele).
   O acompanhamento do uso do Sistema está nos Termos (seção 2).

   Segurança (zzz296): os canais são PRIVADOS (Realtime Authorization,
   migration_aovivo_privado.sql). "b7-aovivo" (quem está online) só a
   equipe interna; "b7-aovivo:<id>" (a tela da pessoa) só ela mesma e os
   super admins. Sem sessão da equipe, nada entra nem sai.

   Só se envia algo pela rede enquanto há de fato alguém acompanhando;
   sem ninguém olhando, nada é transmitido (não pesa no Realtime).

   B7.AoVivo.iniciar()  → no login, para a equipe interna
   B7.AoVivo.abrir()    → super/supremo: painel de quem está online
   B7.AoVivo.pode()     → super/supremo?
   ===================================================================== */
window.B7 = window.B7 || {};

B7.AoVivo = (function () {
  const esc = s => (B7.UI && B7.UI.esc ? B7.UI.esc(s) : String(s == null ? '' : s));
  const eu = () => (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) || null;
  const pode = () => !!(B7.Auth && B7.Auth.superadmin && B7.Auth.superadmin());
  const TOPICO = 'b7-aovivo', topicoDe = id => TOPICO + ':' + id;

  function telaAtual() {
    let base = '';
    try { base = (location.hash || '#/').replace(/^#\/?/, '').split('/')[0].split('?')[0]; } catch (e) {}
    let rotulo = 'Início';
    try {
      const id = B7.Nav && B7.Nav.itemDaRota && B7.Nav.itemDaRota(base);
      if (id && B7.Nav.rotuloDe) rotulo = B7.Nav.rotuloDe(id);
      else if (base) rotulo = base.charAt(0).toUpperCase() + base.slice(1);
    } catch (e) {}
    return { hash: location.hash || '#/', rotulo };
  }

  /* ----------------------------------------------------- eu me anuncio */
  let canal = null, meuCanal = null, meuId = null, ultimoEnvio = 0, timerEnvio = null;

  function dados() {
    const u = eu() || {}, t = telaAtual();
    return { id: meuId, nome: u.nome || u.username || 'Alguém', foto: u.avatar_url || '',
             funcao: (u.funcao || u.papel || ''), hash: t.hash, rotulo: t.rotulo, em: Date.now(),
             pc: !!(window.B7Desktop && window.B7Desktop.tela) };
  }
  function anunciar(forcar) {
    if (!canal) return;
    const agora = Date.now();
    if (!forcar && agora - ultimoEnvio < 2500) {
      clearTimeout(timerEnvio);
      timerEnvio = setTimeout(() => anunciar(true), 2600 - (agora - ultimoEnvio));
      return;
    }
    ultimoEnvio = agora;
    try { if (document.hidden) canal.untrack(); else canal.track(dados()); } catch (e) {}
  }

  function iniciar() {
    const u = eu();
    if (!u || !B7.sb || !B7.sb.channel) return;
    if (B7.Auth.ehCliente && B7.Auth.ehCliente()) return;
    if (B7.Auth.naContaDeOutro && B7.Auth.naContaDeOutro()) return;
    if (canal && meuId === u.id) return;
    desligar();
    meuId = u.id;
    try {
      canal = B7.sb.channel(TOPICO, { config: { private: true, presence: { key: meuId } } });
      canal
        .on('presence', { event: 'sync' }, () => { if (painel) pintar(); })
        .subscribe(st => { if (st === 'SUBSCRIBED') anunciar(true); });
      /* o meu canal: é por aqui que um super pede para acompanhar */
      meuCanal = B7.sb.channel(topicoDe(meuId), { config: { private: true, broadcast: { self: false } } });
      meuCanal
        .on('broadcast', { event: 'av-olhar' }, ({ payload }) => aoPedirOlhar(payload))
        .on('broadcast', { event: 'av-parar' }, ({ payload }) => { aoPararOlhar(payload); if (payload && payload.para === meuId) pararPc(); })
        .on('broadcast', { event: 'av-pc-pedir' }, ({ payload }) => aoPedirPc(payload))
        .subscribe();
    } catch (e) { canal = null; meuCanal = null; return; }
    window.addEventListener('hashchange', aoTrocarTela);
    document.addEventListener('visibilitychange', aoVisibilidade);
  }
  function aoTrocarTela() { anunciar(false); if (painel) pintar(); if (compartilhando()) sujo = true; }
  function aoVisibilidade() { anunciar(true); if (document.hidden && compartilhando()) pararDeCompartilhar(); }
  function enviarEm(c, event, payload) { try { c && c.send({ type: 'broadcast', event, payload }); } catch (e) {} }
  function tirarCanal(c) { try { if (c) (B7.sb.removeChannel ? B7.sb.removeChannel(c) : c.unsubscribe()); } catch (e) {} }

  function desligar() {
    pararLive(true); pararDeCompartilhar(); pararPc();
    tirarCanal(canal); tirarCanal(meuCanal);
    canal = null; meuCanal = null; clearTimeout(timerEnvio);
    window.removeEventListener('hashchange', aoTrocarTela);
    document.removeEventListener('visibilitychange', aoVisibilidade);
  }

  function online() {
    if (!canal) return [];
    let st = {};
    try { st = canal.presenceState() || {}; } catch (e) { return []; }
    const lista = [];
    Object.keys(st).forEach(k => { const m = (st[k] && st[k][0]) || null; if (m && m.id && m.id !== meuId) lista.push(m); });
    return lista.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  }
  function presencaDe(id) { return online().find(m => m.id === id) || null; }
  /* zzz289: o "Visualizar como" usa isto para marcar quem está online e em que tela */
  function estaOnline(id) {
    if (!pode()) return null;
    const m = presencaDe(id);
    return m ? { hash: m.hash || '#/', rotulo: m.rotulo || '', em: m.em } : null;
  }

  /* ============================================ compressão (gzip + base64) */
  const temGzip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  async function comprimir(txt) {
    if (!temGzip) return { z: false, d: txt };
    const buf = new Uint8Array(await new Response(new Blob([txt]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { z: true, d: btoa(bin) };
  }
  async function descomprimir(z, d) {
    if (!z) return d;
    const bin = atob(d), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  const PEDACO = 90000;   /* cada mensagem do Realtime fica bem abaixo do limite */

  /* ============================================ LADO DE QUEM É OLHADO
     Enquanto houver ao menos um super acompanhando, a tela mostra o selo
     "Tela compartilhada" e passa a emitir o espelho da tela. */
  const olhadores = new Map();   /* adminId -> { nome, visto } */
  let capturando = false, selo = null, limpezaOlhadores = null, observador = null, laco = null;
  let sujo = false, ocupado = false, ultimoHtml = '', seq = 0, ultPos = 0, ultimoXY = { xr: 0.5, yr: 0.4 };
  const compartilhando = () => olhadores.size > 0;

  function aoPedirOlhar(p) {
    if (!p || p.para !== meuId || !p.de) return;
    const novo = !olhadores.has(p.de);
    olhadores.set(p.de, { nome: p.deNome || 'Administração', visto: Date.now() });
    if (pcLaco) pcAte = Date.now() + 26000;            /* o super segue olhando a tela do PC */
    if (!capturando) comecarCompartilhar();
    if (novo) { marcarRolados(); ultimoHtml = ''; sujo = true; }   /* quem chegou agora recebe a tela inteira */
  }
  function aoPararOlhar(p) {
    if (!p || p.para !== meuId || !p.de) return;
    olhadores.delete(p.de);
    if (!compartilhando()) pararDeCompartilhar();
  }
  function comecarCompartilhar() {
    capturando = true; sujo = true; ultimoHtml = '';
    mostrarSelo();
    document.addEventListener('mousemove', aoMover, true);
    document.addEventListener('scroll', aoRolar, true);
    document.addEventListener('input', aoDigitar, true);
    document.addEventListener('change', aoDigitar, true);
    document.addEventListener('focusin', aoDigitar, true);
    document.addEventListener('pointerdown', aoClicar, true);
    try {
      observador = new MutationObserver(() => { sujo = true; });
      observador.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    } catch (e) { observador = null; }
    laco = setInterval(() => { if (sujo && !ocupado) emitirEspelho(); }, 450);
    limpezaOlhadores = setInterval(() => {
      const lim = Date.now() - 26000;                   /* super sumiu sem avisar: cai sozinho */
      olhadores.forEach((v, k) => { if (v.visto < lim) olhadores.delete(k); });
      if (!compartilhando()) pararDeCompartilhar();
    }, 8000);
  }
  function pararDeCompartilhar() {
    capturando = false; olhadores.clear();
    document.removeEventListener('mousemove', aoMover, true);
    document.removeEventListener('scroll', aoRolar, true);
    document.removeEventListener('input', aoDigitar, true);
    document.removeEventListener('change', aoDigitar, true);
    document.removeEventListener('focusin', aoDigitar, true);
    document.removeEventListener('pointerdown', aoClicar, true);
    if (observador) { observador.disconnect(); observador = null; }
    clearInterval(laco); laco = null;
    clearInterval(limpezaOlhadores); limpezaOlhadores = null;
    ultimoHtml = '';
    esconderSelo();
  }
  function rel(e) { return { xr: e.clientX / Math.max(1, innerWidth), yr: e.clientY / Math.max(1, innerHeight) }; }
  function aoMover(e) { ultimoXY = rel(e); emitirPos(false); }
  function aoRolar(e) {
    const el = e && e.target && e.target.nodeType === 1 ? e.target : null;
    if (el && el !== document.documentElement && !el.hasAttribute('data-av-r')) el.setAttribute('data-av-r', String(++numR));
    emitirPos(false);
  }
  /* uma varredura só, quando alguém começa a olhar: marca o que já estava rolado */
  function marcarRolados() {
    try { document.querySelectorAll('body *').forEach(el => {
      if ((el.scrollTop || el.scrollLeft) && !el.hasAttribute('data-av-r')) el.setAttribute('data-av-r', String(++numR));
    }); } catch (e) {}
  }
  function aoDigitar() { sujo = true; }
  function aoClicar(e) { ultimoXY = rel(e); enviarEm(meuCanal, 'av-clique', { de: meuId, xr: ultimoXY.xr, yr: ultimoXY.yr }); }
  function emitirPos(forcar) {
    const agora = Date.now(); if (!forcar && agora - ultPos < 70) return; ultPos = agora;
    enviarEm(meuCanal, 'av-pos', { de: meuId, xr: ultimoXY.xr, yr: ultimoXY.yr, rol: rolagens() });
  }

  /* campos que nunca saem daqui: senha, código de verificação, marcados à mão */
  function ehPrivado(el) {
    if (!el || !el.getAttribute) return false;
    const tipo = String(el.getAttribute('type') || '').toLowerCase();
    const ac = String(el.getAttribute('autocomplete') || '').toLowerCase();
    return tipo === 'password' || ac === 'one-time-code' || ac === 'current-password' || ac === 'new-password' ||
      !!(el.closest && el.closest('[data-av-privado]'));
  }
  /* rolagem de cada área que rola (a tela principal e as janelas abertas) */
  function rolagens() {
    const r = {};
    try {
      const sc = document.scrollingElement; if (sc && sc.scrollTop) r['@doc'] = sc.scrollTop;
      document.querySelectorAll('[data-av-r]').forEach(el => { if (el.scrollTop || el.scrollLeft) r[el.getAttribute('data-av-r')] = [el.scrollTop, el.scrollLeft]; });
    } catch (e) {}
    return r;
  }
  let numR = 0;
  /* a cópia da tela: o corpo da página, sem script, com o valor de cada campo */
  function retrato() {
    const campos = Array.from(document.body.querySelectorAll('input, textarea, select'));
    const foco = document.activeElement;
    const copia = document.body.cloneNode(true);
    const camposC = Array.from(copia.querySelectorAll('input, textarea, select'));
    camposC.forEach((c, i) => {
      const o = campos[i]; if (!o) return;
      if (ehPrivado(o)) { c.setAttribute('value', o.value ? '••••••' : ''); if (c.tagName === 'TEXTAREA') c.textContent = ''; return; }
      if (c.tagName === 'TEXTAREA') c.textContent = o.value;
      else if (c.tagName === 'SELECT') Array.from(c.options).forEach((op, k) => { if (o.options[k] && o.options[k].selected) op.setAttribute('selected', ''); else op.removeAttribute('selected'); });
      else if (/^(checkbox|radio)$/i.test(o.type)) { if (o.checked) c.setAttribute('checked', ''); else c.removeAttribute('checked'); }
      else c.setAttribute('value', o.value);
      if (o === foco) c.setAttribute('data-av-foco', '');
    });
    copia.querySelectorAll('[data-av-privado]').forEach(el => { el.innerHTML = '<div class="av-esp-privado">🔒 Área privada</div>'; });
    copia.querySelectorAll('script, noscript, template').forEach(el => el.remove());
    copia.querySelectorAll('iframe, video, canvas, object, embed').forEach(el => {
      const d = document.createElement('div'); d.className = 'av-esp-midia'; d.style.cssText = el.getAttribute('style') || '';
      d.textContent = el.tagName === 'VIDEO' ? '▶ vídeo' : '▦ conteúdo';
      el.replaceWith(d);
    });
    if (foco && foco.isContentEditable && foco !== document.body) {
      const tudo = Array.from(document.body.querySelectorAll('*')), k = tudo.indexOf(foco);
      const alvo = k >= 0 ? copia.querySelectorAll('*')[k] : null; if (alvo) alvo.setAttribute('data-av-foco', '');
    }
    const attrs = el => Array.from(el.attributes).map(a => [a.name, a.value]);
    return JSON.stringify({ html: attrs(document.documentElement), body: attrs(document.body), corpo: copia.innerHTML,
      w: innerWidth, h: innerHeight, hash: location.hash || '#/', rotulo: telaAtual().rotulo });
  }
  async function emitirEspelho() {
    if (!compartilhando() || !meuCanal) return;
    ocupado = true; sujo = false;
    try {
      const txt = retrato();
      if (txt !== ultimoHtml) {
        ultimoHtml = txt;
        const c = await comprimir(txt), n = Math.max(1, Math.ceil(c.d.length / PEDACO)), id = ++seq;
        for (let i = 0; i < n; i++)
          enviarEm(meuCanal, 'av-dom', { de: meuId, seq: id, i, n, z: c.z, d: c.d.slice(i * PEDACO, (i + 1) * PEDACO) });
        emitirPos(true);
      }
    } catch (e) { /* uma cópia que falha não derruba nada: vem outra */ }
    ocupado = false;
  }

  /* ------------------------------------------ Tela do PC (zzz298)
     Só no programa do Windows (window.B7Desktop.tela): uma foto da tela
     inteira por segundo, em pedaços, pelo canal privado da pessoa. Continua
     com o B7 minimizado. O programa mostra a pílula "Tela compartilhada"
     fixa no canto da tela enquanto durar. */
  let pcLaco = null, pcAte = 0, pcOcupado = false, pcSeq = 0;
  function aoPedirPc(p) {
    if (!p || p.para !== meuId || !p.de) return;
    const T = window.B7Desktop && window.B7Desktop.tela;
    if (!T) return;
    if (!p.ligado) return pararPc();
    pcAte = Date.now() + 26000;
    if (pcLaco) return;
    try { T.aviso(true); } catch (e) {}
    const foto = async () => {
      if (Date.now() > pcAte) return pararPc();
      if (pcOcupado || !meuCanal) return;
      pcOcupado = true;
      try {
        const q = await T.quadro(1280);
        if (q && q.jpg) {
          const id = ++pcSeq, n = Math.max(1, Math.ceil(q.jpg.length / PEDACO));
          for (let i = 0; i < n; i++) enviarEm(meuCanal, 'av-pc', { de: meuId, seq: id, i, n, w: q.w, h: q.h, d: q.jpg.slice(i * PEDACO, (i + 1) * PEDACO) });
        }
      } catch (e) { /* uma foto que falha não derruba: vem a próxima */ }
      pcOcupado = false;
    };
    foto();
    pcLaco = setInterval(foto, 1000);
  }
  function pararPc() {
    if (!pcLaco) return;
    clearInterval(pcLaco); pcLaco = null; pcAte = 0;
    try { window.B7Desktop.tela.aviso(false); } catch (e) {}
  }

  function mostrarSelo() {
    if (selo) return;
    selo = document.createElement('div');
    selo.className = 'av-selo-compart';
    selo.setAttribute('role', 'status');
    selo.innerHTML = '<span class="av-selo-ponto" aria-hidden="true"></span><span>Tela compartilhada</span>';
    document.body.appendChild(selo);
  }
  function esconderSelo() { if (selo) { selo.remove(); selo = null; } }

  /* ================================================= LADO DE QUEM OLHA
     O super acompanha uma pessoa: entra como ela (Visualizar como) e, por
     cima, vê o espelho da tela dela numa moldura do tamanho da tela dela. */
  let seguindo = null;   /* { id, nome, canal, ping, el, frame, cursor, pedacos, aplicado, hash, w, h } */

  function acompanhar(id) {
    if (!pode() || !id || id === meuId) return;
    if (!canal) iniciar();
    const m = presencaDe(id);
    const nome = (m && m.nome) || 'a pessoa';
    if (seguindo && seguindo.id === id) return;
    if (seguindo) pararLive(true);
    /* zzz290: vira a pessoa (Visualizar como), já na tela dela — ao parar
       o ao vivo, o super continua na conta dela, onde ela estava */
    if (B7.PreviaUsuario && B7.PreviaUsuario.verComoId) { try { B7.PreviaUsuario.verComoId(id, m && m.hash); } catch (e) {} }
    const s = seguindo = { id, nome, pedacos: new Map(), aplicado: 0, hash: (m && m.hash) || '#/', w: 0, h: 0,
      pc: !!(m && m.pc), vendoPc: false, pcPedacos: new Map(), pcAplicado: 0 };
    montarMoldura(s);
    const pedir = () => enviarEm(s.canal, 'av-olhar', { de: meuId, deNome: (eu() || {}).nome || 'Administração', para: id });
    try {
      s.canal = B7.sb.channel(topicoDe(id), { config: { private: true, broadcast: { self: false } } });
      s.canal
        .on('broadcast', { event: 'av-dom' }, ({ payload }) => aoReceberDom(s, payload))
        .on('broadcast', { event: 'av-pos' }, ({ payload }) => aoReceberPos(s, payload))
        .on('broadcast', { event: 'av-clique' }, ({ payload }) => aoReceberClique(s, payload))
        .on('broadcast', { event: 'av-pc' }, ({ payload }) => aoReceberPc(s, payload))
        .subscribe(st => {
          if (st === 'SUBSCRIBED') pedir();
          else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') estadoMoldura(s, 'Não deu para conectar à tela de ' + nome.split(' ')[0] + '. Tente de novo.');
        });
    } catch (e) { estadoMoldura(s, 'Não deu para conectar.'); }
    s.ping = setInterval(() => { if (seguindo === s) pedir(); }, 9000);
  }

  function montarMoldura(s) {
    const el = document.createElement('div');
    el.className = 'av-esp';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Acompanhando ' + s.nome + ' ao vivo');
    el.innerHTML =
      '<div class="av-esp-barra"><span class="av-bs-ponto" aria-hidden="true"></span>' +
        '<span class="av-esp-tx">Acompanhando <b>' + esc(s.nome) + '</b> ao vivo <span class="av-esp-tela" data-av-tela></span></span>' +
        (s.pc ? '<button type="button" class="av-bs-parar av-esp-pc" data-av-pc>🖥 Tela do PC</button>' : '') +
        '<button type="button" class="av-bs-parar" data-av-parar>Parar de acompanhar</button></div>' +
      '<div class="av-esp-palco" data-av-palco>' +
        '<div class="av-esp-espera" data-av-espera><span class="iaf-orbe" aria-hidden="true"></span>Conectando à tela de ' + esc(s.nome.split(' ')[0]) + '…</div>' +
        '<div class="av-esp-moldura" data-av-moldura hidden>' +
          '<iframe class="av-esp-frame" sandbox="allow-same-origin" title="Tela de ' + esc(s.nome) + '"></iframe>' +
          '<img class="av-esp-tela-pc" data-av-img alt="Tela do computador de ' + esc(s.nome) + '" hidden>' +
          '<div class="av-cursor-remoto" data-av-cursor><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l6 16 2.2-6.2L19 11z"/></svg><b>' + esc(s.nome.split(' ')[0]) + '</b></div>' +
        '</div></div>';
    document.body.appendChild(el);
    document.documentElement.classList.add('av-espelhando');
    s.el = el; s.frame = el.querySelector('iframe'); s.cursor = el.querySelector('[data-av-cursor]');
    el.querySelector('[data-av-parar]').onclick = () => pararLive(false);
    const bpc = el.querySelector('[data-av-pc]');
    if (bpc) bpc.onclick = () => trocarPc(s, !s.vendoPc);
    s.aoRedimensionar = () => encaixar(s);
    window.addEventListener('resize', s.aoRedimensionar);
    /* o documento do espelho: os mesmos estilos do Sistema, nenhum script */
    const estilos = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map(n => n.outerHTML).join('');
    s.frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><base href="' + esc(location.href.split('#')[0]) + '">' + estilos +
      '<style>[data-av-foco]{outline:2px solid #7c4dff!important;outline-offset:2px;box-shadow:0 0 0 6px #7c4dff33!important}' +
      '.av-esp-privado,.av-esp-midia{display:grid;place-items:center;min-height:60px;border-radius:12px;background:#0002;color:#888;font:600 13px Inter,sans-serif}' +
      '*{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}</style></head><body></body></html>';
  }
  function estadoMoldura(s, txt) { const e = s.el && s.el.querySelector('[data-av-espera]'); if (e) e.innerHTML = esc(txt); }
  /* a moldura tem o tamanho da tela da pessoa, encolhida para caber */
  function encaixar(s) {
    const w = s.vendoPc ? s.pcW : s.w, h = s.vendoPc ? s.pcH : s.h;
    if (!s.el || !w || !h) return;
    const palco = s.el.querySelector('[data-av-palco]'), mol = s.el.querySelector('[data-av-moldura]');
    const esc2 = Math.min(1, (palco.clientWidth - 24) / w, (palco.clientHeight - 24) / h);
    mol.style.width = w + 'px'; mol.style.height = h + 'px';
    mol.style.transform = 'translate(-50%,-50%) scale(' + esc2.toFixed(4) + ')';
  }

  /* zzz298: alterna entre o B7 da pessoa e a tela inteira do PC dela */
  function trocarPc(s, ligar) {
    if (seguindo !== s) return;
    s.vendoPc = ligar;
    enviarEm(s.canal, 'av-pc-pedir', { de: meuId, para: s.id, ligado: ligar });
    const b = s.el.querySelector('[data-av-pc]'); if (b) b.textContent = ligar ? '↩ Voltar ao B7' : '🖥 Tela do PC';
    const img = s.el.querySelector('[data-av-img]'), fr = s.frame;
    if (img) img.hidden = !ligar || !s.pcAplicado;
    if (fr) fr.style.visibility = ligar ? 'hidden' : '';
    if (s.cursor) s.cursor.style.display = ligar ? 'none' : '';
    if (ligar && !s.pcAplicado) { const e = s.el.querySelector('[data-av-espera]'), mol = s.el.querySelector('[data-av-moldura]');
      if (e) { e.hidden = false; e.innerHTML = '<span class="iaf-orbe" aria-hidden="true"></span>Abrindo a tela do computador de ' + esc(s.nome.split(' ')[0]) + '…'; }
      if (mol) mol.hidden = true; }
    if (!ligar) { const mol = s.el.querySelector('[data-av-moldura]'), e = s.el.querySelector('[data-av-espera]');
      if (s.aplicado) { if (mol) mol.hidden = false; if (e) e.hidden = true; } encaixar(s); }
  }
  function aoReceberPc(s, p) {
    if (seguindo !== s || !s.vendoPc || !p || p.de !== s.id || !p.seq || p.seq <= s.pcAplicado) return;
    let pc = s.pcPedacos.get(p.seq);
    if (!pc) { pc = new Array(p.n); s.pcPedacos.set(p.seq, pc); }
    pc[p.i] = p.d;
    for (let i = 0; i < pc.length; i++) if (pc[i] === undefined) return;
    s.pcPedacos.forEach((_, k) => { if (k <= p.seq) s.pcPedacos.delete(k); });
    s.pcAplicado = p.seq;
    const img = s.el.querySelector('[data-av-img]'), mol = s.el.querySelector('[data-av-moldura]'), e = s.el.querySelector('[data-av-espera]');
    img.src = 'data:image/jpeg;base64,' + pc.join('');
    img.hidden = false; if (mol) mol.hidden = false; if (e) e.hidden = true;
    if (p.w !== s.pcW || p.h !== s.pcH) { s.pcW = p.w; s.pcH = p.h; }
    encaixar(s);
  }

  async function aoReceberDom(s, p) {
    if (seguindo !== s || !p || p.de !== s.id || !p.seq || p.seq <= s.aplicado) return;
    let pc = s.pedacos.get(p.seq);
    if (!pc) { pc = new Array(p.n); s.pedacos.set(p.seq, pc); }
    pc[p.i] = p.d;
    for (let i = 0; i < pc.length; i++) if (pc[i] === undefined) return;
    s.pedacos.forEach((_, k) => { if (k <= p.seq) s.pedacos.delete(k); });
    let t;
    try { t = JSON.parse(await descomprimir(p.z, pc.join(''))); } catch (e) { return; }
    if (seguindo !== s || p.seq <= s.aplicado) return;
    s.aplicado = p.seq;
    aplicar(s, t);
  }
  function aplicar(s, t) {
    const doc = s.frame && s.frame.contentDocument; if (!doc || !doc.body) return;
    const por = (el, lista) => {
      Array.from(el.attributes).forEach(a => { if (!lista.some(x => x[0] === a.name)) el.removeAttribute(a.name); });
      lista.forEach(([k, v]) => { if (!/^on/i.test(k)) { try { el.setAttribute(k, v); } catch (e) {} } });
    };
    por(doc.documentElement, t.html || []);
    por(doc.body, t.body || []);
    doc.body.innerHTML = t.corpo || '';
    s.hash = t.hash || s.hash;
    const tl = s.el.querySelector('[data-av-tela]'); if (tl) tl.textContent = t.rotulo ? '· ' + t.rotulo : '';
    if (t.w !== s.w || t.h !== s.h) { s.w = t.w; s.h = t.h; }
    const esp = s.el.querySelector('[data-av-espera]'), mol = s.el.querySelector('[data-av-moldura]');
    if (!s.vendoPc) { if (esp) esp.hidden = true; if (mol) mol.hidden = false; encaixar(s); }
    if (s.ultRol) rolar(s, s.ultRol);
  }
  function rolar(s, rol) {
    const doc = s.frame && s.frame.contentDocument; if (!doc) return;
    Object.keys(rol || {}).forEach(k => {
      try {
        if (k === '@doc') { if (doc.scrollingElement) doc.scrollingElement.scrollTop = rol[k]; return; }
        const el = doc.querySelector('[data-av-r="' + k.replace(/[^\d]/g, '') + '"]');
        if (el) { el.scrollTop = rol[k][0]; el.scrollLeft = rol[k][1]; }
      } catch (e) {}
    });
  }
  function aoReceberPos(s, p) {
    if (seguindo !== s || !p || p.de !== s.id) return;
    s.ultRol = p.rol; rolar(s, p.rol);
    if (s.cursor && s.w) {
      s.cursor.style.left = Math.round((p.xr || 0) * s.w) + 'px';
      s.cursor.style.top = Math.round((p.yr || 0) * s.h) + 'px';
      s.cursor.classList.add('on');
    }
  }
  function aoReceberClique(s, p) {
    if (seguindo !== s || !p || p.de !== s.id || !s.w) return;
    const mol = s.el.querySelector('[data-av-moldura]'); if (!mol) return;
    const o = document.createElement('i'); o.className = 'av-esp-clique';
    o.style.left = Math.round((p.xr || 0) * s.w) + 'px'; o.style.top = Math.round((p.yr || 0) * s.h) + 'px';
    mol.appendChild(o); setTimeout(() => o.remove(), 700);
  }

  /* para só a parte ao vivo. sairPreview=true também sai do "Visualizar
     como"; senão o super continua como a pessoa, na tela em que ela está */
  function pararLive(sairPreview) {
    if (!seguindo) return;
    const s = seguindo; seguindo = null;
    if (s.vendoPc) enviarEm(s.canal, 'av-pc-pedir', { de: meuId, para: s.id, ligado: false });
    enviarEm(s.canal, 'av-parar', { de: meuId, para: s.id });
    clearInterval(s.ping);
    window.removeEventListener('resize', s.aoRedimensionar);
    setTimeout(() => tirarCanal(s.canal), 300);
    if (s.el) s.el.remove();
    document.documentElement.classList.remove('av-espelhando');
    if (sairPreview) {
      if (B7.PreviaUsuario && B7.PreviaUsuario.ativa && B7.PreviaUsuario.ativa()) { try { B7.PreviaUsuario.sair(); } catch (e) {} }
    } else if (s.hash && s.hash !== (location.hash || '#/')) { try { location.hash = s.hash; } catch (e) {} }
  }
  /* chamado pelo "Voltar ao Admin" do Visualizar como: encerra o ao vivo
     sem tentar sair de novo (já está saindo) */
  function pararDeSeguir(daPreview) { pararLive(!daPreview); }

  /* --------------------------------------------------------- o painel */
  let painel = null;
  const iniciais = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  function haQuanto(em) {
    const s = Math.max(0, Math.round((Date.now() - (em || Date.now())) / 1000));
    if (s < 60) return 'agora mesmo';
    const m = Math.round(s / 60);
    if (m < 60) return 'há ' + m + ' min';
    return 'há ' + Math.round(m / 60) + ' h';
  }

  function pintar() {
    if (!painel) return;
    const lista = online();
    const corpo = painel.querySelector('[data-av-corpo]');
    const cont = painel.querySelector('[data-av-n]');
    if (cont) cont.textContent = lista.length ? lista.length + (lista.length === 1 ? ' pessoa online' : ' pessoas online') : 'ninguém online';
    if (!corpo) return;
    if (!lista.length) { corpo.innerHTML = '<p class="av-vazio">Ninguém da equipe está com o Sistema aberto agora.</p>'; return; }
    corpo.innerHTML = lista.map(m =>
      '<div class="av-card">' +
        '<span class="av-foto">' + (m.foto ? '<img src="' + esc(m.foto) + '" alt="">' : '<i>' + esc(iniciais(m.nome)) + '</i>') + '<b class="av-ponto" aria-hidden="true"></b></span>' +
        '<div class="av-txt"><b>' + esc(m.nome) + '</b>' +
          '<span class="av-tela">' + esc(m.rotulo || 'No Sistema') + '</span>' +
          '<small>' + esc(haQuanto(m.em)) + '</small></div>' +
        '<div class="av-acoes">' +
          '<button type="button" class="av-seguir" data-vercomo="' + esc(m.id) + '" data-hash="' + esc(m.hash || '#/') + '">Ver como</button>' +
          '<button type="button" class="av-ir" data-seguir="' + esc(m.id) + '">Acompanhar</button>' +
        '</div>' +
      '</div>').join('');
  }

  function abrir() {
    if (!pode()) return;
    if (painel) { pintar(); return; }
    if (!canal) iniciar();
    const el = document.createElement('div');
    el.className = 'av-modal';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Equipe ao vivo');
    el.innerHTML =
      '<div class="av-janela">' +
        '<div class="av-topo"><div><h3>Equipe ao vivo</h3><span data-av-n class="sub">—</span></div>' +
          '<button type="button" class="av-x" data-av-fechar aria-label="Fechar">✕</button></div>' +
        '<div class="av-corpo" data-av-corpo></div>' +
        '<p class="av-rodape">Quem está com o Sistema aberto e em que tela. <b>Ver como</b>: você entra como a pessoa, na tela em que ela está (nada é salvo). <b>Acompanhar</b>: você vê a tela dela ao vivo — e a tela dela mostra "Tela compartilhada". Só super admin e admin supremo.</p>' +
      '</div>';
    document.body.appendChild(el);
    painel = el;
    const fechar = () => { if (!painel) return; painel.remove(); painel = null; document.removeEventListener('keydown', aoTeclar, true); };
    function aoTeclar(e) { if (e.key === 'Escape') { e.preventDefault(); fechar(); } }
    document.addEventListener('keydown', aoTeclar, true);
    el.addEventListener('click', e => {
      if (e.target.closest('[data-av-fechar]') || e.target === el) return fechar();
      const vc = e.target.closest('[data-vercomo]');
      if (vc) { const id = vc.dataset.vercomo, hash = vc.dataset.hash; fechar();
        if (B7.PreviaUsuario && B7.PreviaUsuario.verComoId) B7.PreviaUsuario.verComoId(id, hash);
        return; }
      const seg = e.target.closest('[data-seguir]');
      if (seg) { const id = seg.dataset.seguir; fechar(); acompanhar(id); }
    });
    pintar();
    const t = setInterval(() => { if (!painel) return clearInterval(t); pintar(); }, 20000);
  }

  return { iniciar, abrir, pode, acompanhar, pararDeSeguir, estaOnline, online, desligar, _ehPrivado: ehPrivado };
})();
