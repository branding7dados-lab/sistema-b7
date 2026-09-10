/* =====================================================================
   NOTIFICAÇÕES — sino no topo

   A verdade mora na tabela notificacoes (uma por evento e pessoa). O
   sino consulta o banco ao abrir, a cada 60 s e quando a aba volta a
   ficar visível; se o Realtime estiver disponível, ele só antecipa a
   consulta. Perder uma mensagem do Realtime nunca perde a notificação.

   Estados do badge:
     carregando → antes da primeira resposta do banco (nada de "0" falso)
     número     → não lidas
     escondido  → zero

   Um único canal Realtime por sessão: montar() pode ser chamado várias
   vezes (cada pintarSessao), e só a primeira assina.

   Ao chegar notificação nova: som curto (WebAudio, gerado na hora) e,
   se a aba não estiver em foco, notificação do navegador. As duas
   respeitam as preferências da pessoa (perfis.preferencias).
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Notif = (function () {
  const esc = B7.UI.esc;
  const PADRAO = { som: true, navegador: true, push: false };
  let naoLidas = null, timer = null, canal = null, canalDe = null, aberto = false, ligado = false;
  let ultimoAnuncio = 0, ultimoIdAnunciado = null;

  /* ------------------------------------------------------ preferências */
  function prefs() {
    const u = B7.Auth && B7.Auth.usuario();
    const p = (u && u.preferencias && typeof u.preferencias === 'object') ? u.preferencias : {};
    return Object.assign({}, PADRAO, p);
  }
  async function gravarPrefs(patch) {
    const novas = await B7.DB.gravarPreferencias(patch);
    const u = B7.Auth && B7.Auth.usuario();
    if (u) u.preferencias = Object.assign({}, u.preferencias || {}, novas || patch);
    return prefs();
  }

  /* -------------------------------------------------------------- sino */
  function montar() {
    if (!B7.Auth || !B7.Auth.usuario()) return;
    document.querySelectorAll('.topo .area-sessao').forEach(area => {
      if (area.previousElementSibling && area.previousElementSibling.classList.contains('sino')) return;
      const bt = document.createElement('button');
      bt.className = 'ico sino'; bt.title = 'Notificações'; bt.setAttribute('aria-label', 'Notificações');
      bt.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
        '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg><span class="sino-n"></span>';
      bt.onclick = e => { e.stopPropagation(); alternar(bt); };
      area.parentNode.insertBefore(bt, area);
    });
    pintarBadge();
    if (!ligado) {
      ligado = true;
      document.addEventListener('click', e => { if (aberto && !e.target.closest('.sino-painel') && !e.target.closest('.sino')) fechar(); });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizar(); });
      window.addEventListener('online', atualizar);
      window.addEventListener('hashchange', fechar);
      timer = setInterval(atualizar, 60000);
      avisarLoteAoEntrar();
    }
    realtime();
    atualizar();
  }

  /* ----------------------------------------- som de "voltei, tem coisa nova"
     Toca no máximo UMA vez por lote genuinamente novo acumulado enquanto a
     pessoa estava fora (offline, outra aba, sessão anterior) — nunca de
     novo para notificações que o reload já contabilizou. A marca d'água
     (perfis.preferencias.ultimo_som_em) é persistida no banco para
     sobreviver a reload e valer em qualquer dispositivo/login; nada aqui
     marca a notificação como lida. */
  async function avisarLoteAoEntrar() {
    try {
      const u = await B7.DB.ultimaNaoLida();
      if (!u) return;
      const p = prefs();
      const marca = p.ultimo_som_em ? Date.parse(p.ultimo_som_em) : 0;
      const criada = Date.parse(u.created_at);
      if (!(criada > marca)) return;      /* já contabilizada em login/reload anterior */
      if (p.som) tocarSom();
      try { await gravarPrefs({ ultimo_som_em: u.created_at }); } catch (e) {}
    } catch (e) {}
  }

  function pintarBadge() {
    const carregando = naoLidas === null;
    document.querySelectorAll('.sino').forEach(b => {
      b.classList.toggle('carregando', carregando);
      b.classList.toggle('tem', !carregando && naoLidas > 0);
      b.title = carregando ? 'Notificações (carregando…)' : naoLidas ? naoLidas + ' não lida(s)' : 'Notificações';
      const n = b.querySelector('.sino-n');
      if (!n) return;
      if (carregando) { n.textContent = ''; n.hidden = false; n.setAttribute('aria-label', 'carregando'); return; }
      n.removeAttribute('aria-label');
      n.textContent = naoLidas > 99 ? '99+' : String(naoLidas);
      n.hidden = !naoLidas;
    });
  }

  async function atualizar() {
    if (!B7.Auth || !B7.Auth.usuario() || !navigator.onLine) return;
    let n;
    try { n = await B7.DB.notificacoesNaoLidas(); } catch (e) { return; }
    const antes = naoLidas;
    naoLidas = n;
    pintarBadge();
    /* subiu sem passar pelo Realtime (polling ou aba voltando): anuncia a
       mais recente, uma vez só */
    if (antes !== null && n > antes && Date.now() - ultimoAnuncio > 3000) {
      try {
        const [ultima] = await B7.DB.notificacoes({ limite: 1 });
        if (ultima && !ultima.lida_em) anunciar(ultima);
      } catch (e) {}
    }
    if (aberto) listar();
  }

  /* --------------------------------------------------------- realtime */
  function realtime() {
    try {
      const u = B7.Auth.usuario();
      if (!B7.sb || !B7.sb.channel || !u) return;
      if (canal && canalDe === u.id) return;          /* já assinado nesta sessão */
      if (canal) { B7.DB.fecharCanal(canal); canal = null; }
      canalDe = u.id;
      canal = B7.DB.canal('notif-' + u.id, [
        { event: 'INSERT', table: 'notificacoes', filter: 'destinatario_id=eq.' + u.id }
      ], p => {
        const nova = p && p.new;
        if (nova && nova.id) anunciar(nova);
        atualizar();
      });
    } catch (e) { canal = null; /* sem realtime: o polling cobre */ }
  }

  /* --------------------------------------------- som + aviso do navegador */
  function anunciar(n) {
    if (!n || n.id === ultimoIdAnunciado) return;
    ultimoIdAnunciado = n.id; ultimoAnuncio = Date.now();
    const p = prefs();
    if (p.som) tocarSom();
    if (p.navegador && document.hidden) avisarNavegador(n);
  }

  let ctx = null;
  function tocarSom() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = ctx || new AC();
      if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); }
      if (ctx.state !== 'running') return;   /* sem gesto do usuário o navegador não deixa tocar */
      const t0 = ctx.currentTime;
      /* duas notas curtas, suaves: aviso, não alarme */
      [[880, 0], [1174.7, 0.11]].forEach(([f, dt]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + dt);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + dt + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.22);
        o.connect(g); g.connect(ctx.destination);
        o.start(t0 + dt); o.stop(t0 + dt + 0.25);
      });
    } catch (e) {}
  }

  function avisarNavegador(n) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      /* mesma tag que o service worker usa no push: o navegador substitui em
         vez de mostrar duas vezes o mesmo aviso */
      const nt = new Notification(n.titulo || 'Sistema B7', {
        body: n.mensagem || '', tag: 'b7-notif-' + n.id, icon: 'assets/icons/icon-192.png', badge: 'assets/icons/icon-192.png'
      });
      nt.onclick = () => { try { window.focus(); } catch (e) {} if (n.link) location.hash = n.link; nt.close(); };
    } catch (e) {}
  }

  /* pede a permissão do navegador (só depois de um clique da pessoa) */
  async function pedirPermissao() {
    if (!('Notification' in window)) throw new Error('Este navegador não suporta notificações.');
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') throw new Error('As notificações foram bloqueadas para este site. Libere nas configurações do navegador.');
    const r = await Notification.requestPermission();
    return r === 'granted';
  }

  /* ------------------------------------------------------------ painel */
  function alternar(bt) { aberto ? fechar() : abrirPainel(bt); }
  function fechar() {
    const p = document.querySelector('.sino-painel'); if (p) p.remove(); aberto = false;
  }
  async function abrirPainel(bt) {
    fechar(); aberto = true;
    /* o primeiro clique no sino também "desbloqueia" o áudio */
    try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { ctx = ctx || new AC(); ctx.resume().catch(() => {}); } } catch (e) {}
    const p = document.createElement('div');
    p.className = 'sino-painel';
    p.innerHTML = '<div class="sino-cab"><b>Notificações</b>' +
      '<button class="b fina" id="sino-todas">Marcar todas como lidas</button></div>' +
      '<div class="sino-lista"><div class="b7-load"><div class="simbolo"></div></div></div>' +
      '<div class="sino-pe"><button class="b fina" id="sino-mais">Carregar mais</button>' +
      '<button class="b fina" id="sino-prefs" title="Som, navegador e push">Preferências</button></div>';
    const r = bt.getBoundingClientRect();
    p.style.top = (r.bottom + 8) + 'px';
    p.style.right = Math.max(12, window.innerWidth - r.right) + 'px';
    document.body.appendChild(p);
    p.querySelector('#sino-todas').onclick = async () => {
      try { await B7.DB.marcarTodasLidas(); await atualizar(); listar(); } catch (e) {}
    };
    p.querySelector('#sino-mais').onclick = () => listar(true);
    p.querySelector('#sino-prefs').onclick = () => { fechar(); if (B7.Perfil) B7.Perfil.abrir('notificacoes'); };
    listar();
  }

  let ultimas = [];
  async function listar(mais) {
    const p = document.querySelector('.sino-painel'); if (!p) return;
    const lista = p.querySelector('.sino-lista');
    try {
      const novas = await B7.DB.notificacoes({ limite: 20, antesDe: mais && ultimas.length ? ultimas[ultimas.length - 1].created_at : null });
      ultimas = mais ? ultimas.concat(novas) : novas;
      p.querySelector('#sino-mais').hidden = novas.length < 20;
    } catch (e) {
      lista.innerHTML = '<div class="sino-vazio">Não foi possível carregar. <small>' + esc(e.message || '') + '</small></div>';
      return;
    }
    if (!ultimas.length) {
      lista.innerHTML = '<div class="sino-vazio"><b>Nada por aqui.</b><small>Decisões dos clientes e novas versões enviadas aparecem nesta lista.</small></div>';
      return;
    }
    lista.innerHTML = ultimas.map(n =>
      '<a class="sino-item' + (n.lida_em ? '' : ' nova') + '" data-id="' + esc(n.id) + '" href="' + esc(n.link || '#/') + '">' +
        '<span class="sino-ponto"></span>' +
        '<span class="sino-tx"><b>' + esc(n.titulo) + '</b>' + (n.mensagem ? '<p>' + esc(n.mensagem) + '</p>' : '') +
        '<small>' + esc(B7.UI.quando(n.created_at)) + '</small></span></a>').join('');
    lista.querySelectorAll('.sino-item').forEach(a => a.onclick = async () => {
      if (a.classList.contains('nova')) {
        a.classList.remove('nova');
        try { await B7.DB.marcarLida(a.dataset.id); } catch (e) {}
        atualizar();
      }
      fechar();
    });
  }

  return { montar, atualizar, fechar, prefs, gravarPrefs, pedirPermissao, tocarSom, anunciar, PADRAO };
})();
