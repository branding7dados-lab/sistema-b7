/* =====================================================================
   NOTIFICAÇÕES — sino no topo

   A verdade mora na tabela notificacoes (uma por evento e pessoa). O
   sino consulta o banco ao abrir, a cada 60 s e quando a aba volta a
   ficar visível; se o Realtime estiver disponível, ele só antecipa a
   consulta. Perder uma mensagem do Realtime nunca perde a notificação.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Notif = (function () {
  const esc = B7.UI.esc;
  let naoLidas = 0, timer = null, canal = null, aberto = false, ligado = false;

  function alvo() { return document.getElementById('sino-notif'); }

  function montar() {
    if (!B7.Auth || !B7.Auth.usuario()) return;
    document.querySelectorAll('.topo .area-sessao').forEach(area => {
      if (area.previousElementSibling && area.previousElementSibling.classList.contains('sino')) return;
      const bt = document.createElement('button');
      bt.className = 'ico sino'; bt.title = 'Notificações'; bt.setAttribute('aria-label', 'Notificações');
      bt.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
        '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg><span class="sino-n" hidden></span>';
      bt.onclick = e => { e.stopPropagation(); alternar(bt); };
      area.parentNode.insertBefore(bt, area);
    });
    if (!ligado) {
      ligado = true;
      document.addEventListener('click', e => { if (aberto && !e.target.closest('.sino-painel') && !e.target.closest('.sino')) fechar(); });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizar(); });
      window.addEventListener('online', atualizar);
      window.addEventListener('hashchange', fechar);
      timer = setInterval(atualizar, 60000);
      realtime();
    }
    atualizar();
  }

  async function atualizar() {
    if (!B7.Auth || !B7.Auth.usuario() || !navigator.onLine) return;
    try { naoLidas = await B7.DB.notificacoesNaoLidas(); } catch (e) { return; }
    document.querySelectorAll('.sino .sino-n').forEach(n => {
      n.textContent = naoLidas > 99 ? '99+' : String(naoLidas);
      n.hidden = !naoLidas;
    });
    document.querySelectorAll('.sino').forEach(b => b.classList.toggle('tem', naoLidas > 0));
    if (aberto) listar();
  }

  function realtime() {
    try {
      const u = B7.Auth.usuario();
      if (!B7.sb || !B7.sb.channel || !u) return;
      canal = B7.sb.channel('notif-' + u.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes',
                                  filter: 'destinatario_id=eq.' + u.id }, () => atualizar())
        .subscribe();
    } catch (e) { /* sem realtime: o polling cobre */ }
  }

  function alternar(bt) { aberto ? fechar() : abrirPainel(bt); }
  function fechar() {
    const p = document.querySelector('.sino-painel'); if (p) p.remove(); aberto = false;
  }
  async function abrirPainel(bt) {
    fechar(); aberto = true;
    const p = document.createElement('div');
    p.className = 'sino-painel';
    p.innerHTML = '<div class="sino-cab"><b>Notificações</b>' +
      '<button class="b fina" id="sino-todas">Marcar todas como lidas</button></div>' +
      '<div class="sino-lista"><div class="b7-load"><div class="simbolo"></div></div></div>' +
      '<div class="sino-pe"><button class="b fina" id="sino-mais">Carregar mais</button></div>';
    const r = bt.getBoundingClientRect();
    p.style.top = (r.bottom + 8) + 'px';
    p.style.right = Math.max(12, window.innerWidth - r.right) + 'px';
    document.body.appendChild(p);
    p.querySelector('#sino-todas').onclick = async () => {
      try { await B7.DB.marcarTodasLidas(); await atualizar(); listar(); } catch (e) {}
    };
    p.querySelector('#sino-mais').onclick = () => listar(true);
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

  return { montar, atualizar, fechar };
})();
