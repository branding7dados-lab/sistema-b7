/* =====================================================================
   EQUIPE AO VIVO — só super admin e admin supremo.

   Parte 1 (zzz284): ver quem da equipe está no Sistema agora e em que
   tela está, ao vivo (Supabase Realtime, presença).

   Parte 2 (zzz285): ACOMPANHAR ao vivo. O super escolhe uma pessoa e
   passa a ver a tela dela (a mesma rota, a rolagem e o cursor dela com
   o nome). O cursor do super NÃO aparece para a pessoa.
   Em troca, enquanto alguém está acompanhando, a tela da pessoa mostra
   o selo "Tela compartilhada" — ela tem como saber. Esse selo aparece
   para QUALQUER acompanhamento (não dá para acompanhar sem ele).
   O acompanhamento do uso do Sistema está nos Termos (seção 2).

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
  let canal = null, meuId = null, ultimoEnvio = 0, timerEnvio = null;

  function dados() {
    const u = eu() || {}, t = telaAtual();
    return { id: meuId, nome: u.nome || u.username || 'Alguém', foto: u.avatar_url || '',
             funcao: (u.funcao || u.papel || ''), hash: t.hash, rotulo: t.rotulo, em: Date.now() };
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
      canal = B7.sb.channel('b7-aovivo', { config: { presence: { key: meuId }, broadcast: { self: false } } });
      canal
        .on('presence', { event: 'sync' }, () => { if (painel) pintar(); seguirSync(); })
        .on('broadcast', { event: 'av-olhar' }, ({ payload }) => aoPedirOlhar(payload))
        .on('broadcast', { event: 'av-parar' }, ({ payload }) => aoPararOlhar(payload))
        .on('broadcast', { event: 'av-tela' }, ({ payload }) => aoReceberTela(payload))
        .subscribe(st => { if (st === 'SUBSCRIBED') anunciar(true); });
    } catch (e) { canal = null; return; }
    window.addEventListener('hashchange', aoTrocarTela);
    document.addEventListener('visibilitychange', aoVisibilidade);
  }
  function aoTrocarTela() {
    anunciar(false); if (painel) pintar(); if (compartilhando()) emitirTela(true);
    /* zzz287: se o super (acompanhando) troca de tela por conta própria — ex.: abre
       o WhatsApp — ele deixa de acompanhar, em vez de a tela ficar brigando com o
       av-tela da pessoa (que puxava de volta e travava tudo). */
    /* navegou para fora da tela seguida (dentro do Visualizar como): encerra só o ao vivo */
    if (seguindo && (location.hash || '#/') !== (seguindo.hashAlvo || '#/')) pararLive(false);
  }
  function aoVisibilidade() { anunciar(true); if (document.hidden && compartilhando()) pararDeCompartilhar(); }
  function enviar(event, payload) { try { canal && canal.send({ type: 'broadcast', event, payload }); } catch (e) {} }

  function desligar() {
    pararLive(true); pararDeCompartilhar();
    try { if (canal) (B7.sb.removeChannel ? B7.sb.removeChannel(canal) : canal.unsubscribe()); } catch (e) {}
    canal = null; clearTimeout(timerEnvio);
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

  /* ============================================ LADO DE QUEM É OLHADO
     Enquanto houver ao menos um super acompanhando, a tela mostra o selo
     "Tela compartilhada" e passa a emitir rota + rolagem + cursor. */
  const olhadores = new Map();   /* adminId -> { nome, visto } */
  let capturando = false, ultCursor = 0, ultRolagem = 0, selo = null, limpezaOlhadores = null;
  const compartilhando = () => olhadores.size > 0;

  function aoPedirOlhar(p) {
    if (!p || p.para !== meuId || !p.de) return;
    olhadores.set(p.de, { nome: p.deNome || 'Administração', visto: Date.now() });
    if (!capturando) comecarCompartilhar();
    emitirTela(true);                                   /* manda o estado atual na hora */
  }
  function aoPararOlhar(p) {
    if (!p || p.para !== meuId || !p.de) return;
    olhadores.delete(p.de);
    if (!compartilhando()) pararDeCompartilhar();
    else atualizarSelo();
  }
  function comecarCompartilhar() {
    capturando = true;
    document.addEventListener('mousemove', aoMover, true);
    window.addEventListener('scroll', aoRolar, true);
    mostrarSelo();
    limpezaOlhadores = setInterval(() => {
      const lim = Date.now() - 26000;                   /* super sumiu sem avisar: cai sozinho */
      let mudou = false;
      olhadores.forEach((v, k) => { if (v.visto < lim) { olhadores.delete(k); mudou = true; } });
      if (!compartilhando()) pararDeCompartilhar();
      else if (mudou) atualizarSelo();
    }, 8000);
  }
  function pararDeCompartilhar() {
    capturando = false; olhadores.clear();
    document.removeEventListener('mousemove', aoMover, true);
    window.removeEventListener('scroll', aoRolar, true);
    clearInterval(limpezaOlhadores); limpezaOlhadores = null;
    esconderSelo();
  }
  function aoMover(e) {
    const agora = Date.now(); if (agora - ultCursor < 80) return; ultCursor = agora;
    ultimoXY = { xr: e.clientX / Math.max(1, innerWidth), yr: e.clientY / Math.max(1, innerHeight) };
    emitirTela(false);
  }
  function aoRolar() { const agora = Date.now(); if (agora - ultRolagem < 140) return; ultRolagem = agora; emitirTela(false); }
  let ultimoXY = { xr: 0.5, yr: 0.4 };
  function emitirTela(forcar) {
    if (!compartilhando()) return;
    const doc = document.documentElement;
    enviar('av-tela', { de: meuId, hash: location.hash || '#/',
      sy: window.scrollY || 0, docH: doc.scrollHeight || 0, visH: innerHeight || 0,
      xr: ultimoXY.xr, yr: ultimoXY.yr, em: Date.now() });
    if (forcar) { /* nada extra; o send acima já é imediato */ }
  }
  function mostrarSelo() {
    if (selo) return atualizarSelo();
    selo = document.createElement('div');
    selo.className = 'av-selo-compart';
    selo.setAttribute('role', 'status');
    document.body.appendChild(selo);
    atualizarSelo();
  }
  function atualizarSelo() {
    if (!selo) return;
    selo.innerHTML = '<span class="av-selo-ponto" aria-hidden="true"></span>' +
      '<span>Tela compartilhada</span>';
  }
  function esconderSelo() { if (selo) { selo.remove(); selo = null; } }

  /* ================================================= LADO DE QUEM OLHA
     O super acompanha uma pessoa: a própria tela vai para a rota dela,
     rola junto e mostra o cursor dela (com o nome). */
  let seguindo = null;   /* { id, nome, hashAlvo, ultimo, ping, cursor } */

  function acompanhar(id) {
    if (!pode() || !id || id === meuId) return;
    if (!canal) iniciar();
    const m = presencaDe(id);
    const nome = (m && m.nome) || 'a pessoa';
    if (seguindo && seguindo.id === id) return;
    if (seguindo) pararLive(true);
    /* zzz290: vira a pessoa (Visualizar como), já na tela dela — assim o
       super vê a CONTA dela, e por cima segue o cursor/rolagem ao vivo.
       O indicador no topo é o banner "Visualizando como" (Voltar ao Admin
       encerra tudo). A tela da pessoa mostra "Tela compartilhada". */
    if (B7.PreviaUsuario && B7.PreviaUsuario.verComoId) { try { B7.PreviaUsuario.verComoId(id, m && m.hash); } catch (e) {} }
    seguindo = { id, nome, hashAlvo: (m && m.hash) || location.hash || '#/', ultimo: 0 };
    enviar('av-olhar', { de: meuId, deNome: (eu() || {}).nome || 'Administração', para: id });
    seguindo.ping = setInterval(() => {
      if (!seguindo) return;
      enviar('av-olhar', { de: meuId, deNome: (eu() || {}).nome || 'Administração', para: seguindo.id });
    }, 9000);
    const cursor = document.createElement('div');
    cursor.className = 'av-cursor-remoto';
    cursor.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l6 16 2.2-6.2L19 11z"/></svg><b>' + esc(nome.split(' ')[0]) + '</b>';
    document.body.appendChild(cursor);
    seguindo.cursor = cursor;
  }
  /* para só a parte ao vivo (cursor + sincronismo). sairPreview=true também
     sai do "Visualizar como". */
  function pararLive(sairPreview) {
    if (!seguindo) return;
    const s = seguindo; seguindo = null;
    enviar('av-parar', { de: meuId, para: s.id });
    clearInterval(s.ping);
    if (s.cursor) s.cursor.remove();
    if (sairPreview && B7.PreviaUsuario && B7.PreviaUsuario.ativa && B7.PreviaUsuario.ativa())
      { try { B7.PreviaUsuario.sair(); } catch (e) {} }
  }
  /* chamado pelo "Voltar ao Admin" do Visualizar como: encerra o ao vivo
     sem tentar sair de novo (já está saindo) */
  function pararDeSeguir(daPreview) { pararLive(!daPreview); }

  function aoReceberTela(p) {
    if (!seguindo || !p || p.de !== seguindo.id) return;
    seguindo.ultimo = Date.now();
    /* mesma rota que a pessoa — marca o alvo para a navegação dela não
       ser confundida com o super saindo da tela */
    if (p.hash) { seguindo.hashAlvo = p.hash; if (p.hash !== (location.hash || '#/')) { try { location.hash = p.hash; } catch (e) {} } }
    try {
      const doc = document.documentElement;
      const alvoMax = Math.max(1, (p.docH || 0) - (p.visH || 0));
      const meuMax = Math.max(0, doc.scrollHeight - innerHeight);
      const frac = Math.min(1, Math.max(0, (p.sy || 0) / alvoMax));
      window.scrollTo({ top: Math.round(frac * meuMax), behavior: 'auto' });
    } catch (e) {}
    if (seguindo.cursor) {
      seguindo.cursor.style.left = Math.round((p.xr || 0.5) * innerWidth) + 'px';
      seguindo.cursor.style.top = Math.round((p.yr || 0.4) * innerHeight) + 'px';
      seguindo.cursor.classList.add('on');
    }
  }
  function seguirSync() { /* presença mudou; nada a repintar (o banner é do Visualizar como) */ }

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

  return { iniciar, abrir, pode, acompanhar, pararDeSeguir, estaOnline, online, desligar };
})();
