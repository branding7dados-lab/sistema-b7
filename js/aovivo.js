/* =====================================================================
   EQUIPE AO VIVO (zzz284) — só super admin e admin supremo.

   Parte 1: ver quem da equipe está no Sistema agora e em que tela está,
   ao vivo. Usa o mesmo tempo real das conversas (Supabase Realtime,
   presença). Cada pessoa da equipe interna "anuncia" no canal só a
   sua tela atual (nome, foto, rota, há quanto tempo); o cartão só é
   enviado enquanto a pessoa está com o B7 na frente. A aba escondida
   sai da presença, igual ao "online" das conversas.

   Quem ABRE o painel é só quem é super/supremo (o botão nem aparece
   para os outros). Daqui a pessoa pode pular para a mesma tela que o
   outro está vendo. O "seguir ao vivo" (cursor e rolagem) vem depois.

   O acompanhamento do trabalho pelo Sistema está nos Termos (seção 2).

   B7.AoVivo.iniciar()  → no login, para a equipe interna: entra no canal
   B7.AoVivo.abrir()    → super/supremo: abre o painel
   B7.AoVivo.pode()     → super/supremo?
   ===================================================================== */
window.B7 = window.B7 || {};

B7.AoVivo = (function () {
  const esc = s => (B7.UI && B7.UI.esc ? B7.UI.esc(s) : String(s == null ? '' : s));
  const eu = () => (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) || null;
  const pode = () => !!(B7.Auth && B7.Auth.superadmin && B7.Auth.superadmin());

  /* a tela atual, com o nome que a equipe lê (ex.: "Edição de vídeo") */
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
    if (!forcar && agora - ultimoEnvio < 2500) {            /* troca rápida de tela: só o último sinal */
      clearTimeout(timerEnvio);
      timerEnvio = setTimeout(() => anunciar(true), 2600 - (agora - ultimoEnvio));
      return;
    }
    ultimoEnvio = agora;
    try { if (document.hidden) canal.untrack(); else canal.track(dados()); } catch (e) {}
  }

  function iniciar() {
    /* só a equipe interna anuncia; cliente, prévia/entrar-como e quem não
       tem sessão ficam de fora (a prévia não é a pessoa de verdade) */
    const u = eu();
    if (!u || !B7.sb || !B7.sb.channel) return;
    if (B7.Auth.ehCliente && B7.Auth.ehCliente()) return;
    if (B7.Auth.naContaDeOutro && B7.Auth.naContaDeOutro()) return;
    if (canal && meuId === u.id) return;
    desligar();
    meuId = u.id;
    try {
      canal = B7.sb.channel('b7-aovivo', { config: { presence: { key: meuId } } });
      canal.on('presence', { event: 'sync' }, () => { if (painel) pintar(); })
           .subscribe(st => { if (st === 'SUBSCRIBED') anunciar(true); });
    } catch (e) { canal = null; return; }
    window.addEventListener('hashchange', aoTrocarTela);
    document.addEventListener('visibilitychange', aoVisibilidade);
  }
  function aoTrocarTela() { anunciar(false); if (painel) pintar(); }
  function aoVisibilidade() { anunciar(true); }
  function desligar() {
    try { if (canal) B7.sb.removeChannel ? B7.sb.removeChannel(canal) : canal.unsubscribe(); } catch (e) {}
    canal = null; clearTimeout(timerEnvio);
    window.removeEventListener('hashchange', aoTrocarTela);
    document.removeEventListener('visibilitychange', aoVisibilidade);
  }

  function online() {
    if (!canal) return [];
    let st = {};
    try { st = canal.presenceState() || {}; } catch (e) { return []; }
    const lista = [];
    Object.keys(st).forEach(k => {
      const m = (st[k] && st[k][0]) || null;
      if (m && m.id && m.id !== meuId) lista.push(m);
    });
    return lista.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  }

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
    if (!lista.length) {
      corpo.innerHTML = '<p class="av-vazio">Ninguém da equipe está com o Sistema aberto agora.</p>';
      return;
    }
    corpo.innerHTML = lista.map(m =>
      '<div class="av-card">' +
        '<span class="av-foto">' + (m.foto ? '<img src="' + esc(m.foto) + '" alt="">' : '<i>' + esc(iniciais(m.nome)) + '</i>') + '<b class="av-ponto" aria-hidden="true"></b></span>' +
        '<div class="av-txt"><b>' + esc(m.nome) + '</b>' +
          '<span class="av-tela">' + esc(m.rotulo || 'No Sistema') + '</span>' +
          '<small>' + esc(haQuanto(m.em)) + '</small></div>' +
        '<button type="button" class="av-ir" data-hash="' + esc(m.hash || '#/') + '">Ir para a tela</button>' +
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
        '<p class="av-rodape">Mostra quem está com o Sistema aberto agora e em que tela. Só super admin e admin supremo veem isto.</p>' +
      '</div>';
    document.body.appendChild(el);
    painel = el;
    const fechar = () => { if (!painel) return; painel.remove(); painel = null; document.removeEventListener('keydown', aoTeclar, true); };
    function aoTeclar(e) { if (e.key === 'Escape') { e.preventDefault(); fechar(); } }
    document.addEventListener('keydown', aoTeclar, true);
    el.addEventListener('click', e => {
      if (e.target.closest('[data-av-fechar]') || e.target === el) return fechar();
      const ir = e.target.closest('[data-av-ir]') || e.target.closest('.av-ir');
      if (ir && ir.dataset.hash) { location.hash = ir.dataset.hash; fechar(); }
    });
    pintar();
    /* o "há X min" anda sozinho enquanto o painel está aberto */
    const t = setInterval(() => { if (!painel) return clearInterval(t); pintar(); }, 20000);
  }

  return { iniciar, abrir, pode, desligar };
})();
