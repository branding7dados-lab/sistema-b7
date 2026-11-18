/* =====================================================================
   ESCOLHA (4.81.0) — o seletor do B7, no lugar do <select> do navegador
   O <select> continua na página (é ele que guarda o valor e avisa o
   "change"); por cima entra um botão com a cara do B7 e, ao tocar, um
   painel com busca, foto/logo, teclado (↑ ↓ Enter Esc) e, no celular,
   uma folha que sobe de baixo. Quem já ouvia o "change" do select não
   precisa mudar nada.

   Uso:  B7.Escolha.melhorar(raiz)  → melhora todo select[data-escolha] dentro de raiz
   No <option>, opcional: data-img="url" (foto/logo), data-sub="linha de baixo".
   No <select>: data-escolha (liga), data-busca="Buscar cliente" (placeholder),
                data-vazio="Ligar a um cliente" (texto quando nada escolhido).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Escolha = (function () {
  const esc = s => (B7.UI && B7.UI.esc ? B7.UI.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  const semAc = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const ini = n => String(n || '?').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '?';
  const cor = n => { let h = 0; for (const ch of String(n || '')) h = (h * 31 + ch.charCodeAt(0)) % 360; return 'hsl(' + h + ' 62% 52%)'; };
  const SETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';
  const OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const LUPA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.6-3.6"/></svg>';
  let aberto = null;

  const opcoesDe = sel => [...sel.options].map(o => ({ v: o.value, rotulo: o.textContent.trim(), sub: o.dataset.sub || '', img: o.dataset.img || '', vazio: o.value === '' }));
  function selo(o, cls) {
    if (o.vazio) return '<span class="esc-av ' + (cls || '') + ' vz">–</span>';
    return '<span class="esc-av ' + (cls || '') + '" style="--c:' + cor(o.rotulo) + '">' + (o.img ? '<img src="' + esc(o.img) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '<b>' + esc(ini(o.rotulo)) + '</b></span>';
  }
  function pintarBotao(sel, bt) {
    const o = opcoesDe(sel).find(x => x.v === sel.value);
    const vazio = !o || o.vazio;
    bt.classList.toggle('vazio', vazio);
    bt.innerHTML = (vazio ? '<span class="esc-mais">+</span><span class="esc-t"><b>' + esc(sel.dataset.vazio || (o && o.rotulo) || 'Escolher') + '</b></span>'
      : selo(o) + '<span class="esc-t"><b>' + esc(o.rotulo) + '</b>' + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</span>') + '<i class="esc-seta">' + SETA + '</i>';
  }

  function melhorar(raiz) {
    (raiz || document).querySelectorAll('select[data-escolha]:not([data-escolha-ok])').forEach(sel => {
      sel.dataset.escolhaOk = '1';
      sel.classList.add('esc-nativo'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
      const bt = document.createElement('button');
      bt.type = 'button'; bt.className = 'esc-bt' + (sel.className.includes('campo') ? ' campo' : '');
      bt.setAttribute('aria-haspopup', 'listbox'); bt.setAttribute('aria-expanded', 'false');
      if (sel.getAttribute('aria-label')) bt.setAttribute('aria-label', sel.getAttribute('aria-label'));
      sel.after(bt);
      pintarBotao(sel, bt);
      bt.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); aberto && aberto.bt === bt ? fechar() : abrir(sel, bt); });
      bt.addEventListener('keydown', e => { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); abrir(sel, bt); } });
      sel.addEventListener('change', () => pintarBotao(sel, bt));
    });
  }

  function abrir(sel, bt) {
    fechar();
    const ops = opcoesDe(sel), celular = matchMedia('(max-width: 760px)').matches;
    const comBusca = ops.length > 7 || sel.dataset.busca;
    const fundo = document.createElement('div');
    fundo.className = 'esc-fundo' + (celular ? ' esc-folha' : '') + (sel.dataset.semFoto != null ? ' sem-foto' : '');
    fundo.innerHTML = '<div class="esc-painel" role="dialog" aria-label="' + esc(sel.dataset.titulo || sel.getAttribute('aria-label') || 'Escolher') + '">' +
      (celular ? '<i class="esc-alca"></i>' + (sel.dataset.titulo ? '<h4>' + esc(sel.dataset.titulo) + '</h4>' : '') : '') +
      (comBusca ? '<label class="esc-busca">' + LUPA + '<input type="search" placeholder="' + esc(sel.dataset.busca || 'Buscar') + '" autocomplete="off" spellcheck="false"></label>' : '') +
      '<div class="esc-lista" role="listbox"></div></div>';
    document.body.appendChild(fundo);
    const painel = fundo.querySelector('.esc-painel'), lista = fundo.querySelector('.esc-lista'), busca = fundo.querySelector('.esc-busca input');
    let filtro = '', foco = 0, vis = [];
    const pintar = () => {
      const f = semAc(filtro);
      vis = ops.filter(o => !f || o.vazio || semAc(o.rotulo + ' ' + o.sub).includes(f));
      if (f) vis = vis.filter(o => !o.vazio).concat(vis.filter(o => o.vazio));   /* com busca, o "nenhum" vai pro fim */
      foco = Math.min(Math.max(0, foco), Math.max(0, vis.length - 1));
      lista.innerHTML = vis.length ? vis.map((o, i) => '<button type="button" role="option" class="esc-op' + (o.v === sel.value ? ' sel' : '') + (i === foco ? ' foco' : '') + (o.vazio ? ' nenhum' : '') + '" data-i="' + i + '" aria-selected="' + (o.v === sel.value) + '">' +
        selo(o, 'p') + '<span class="esc-t"><b>' + marca(o.rotulo, filtro) + '</b>' + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</span>' + (o.v === sel.value ? '<i class="esc-ok">' + OK + '</i>' : '') + '</button>').join('')
        : '<div class="esc-nada">Nada com “' + esc(filtro) + '”</div>';
      const f2 = lista.querySelector('.foco'); if (f2) f2.scrollIntoView({ block: 'nearest' });
    };
    const escolher = o => {
      if (!o) return;
      if (o.v !== sel.value) { sel.value = o.v; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
      fechar(); bt.focus({ preventScroll: true });
    };
    foco = Math.max(0, ops.findIndex(o => o.v === sel.value));
    pintar();
    /* lugar: embaixo do botão; sem espaço, em cima. No celular, folha de baixo */
    if (!celular) {
      const r = bt.getBoundingClientRect(), w = Math.max(r.width, 280), alto = Math.min(380, innerHeight - 24);
      painel.style.width = Math.min(w, innerWidth - 24) + 'px';
      painel.style.left = Math.min(Math.max(12, r.left), innerWidth - Math.min(w, innerWidth - 24) - 12) + 'px';
      const embaixo = innerHeight - r.bottom - 12, emCima = r.top - 12;
      if (embaixo >= Math.min(alto, 260) || embaixo >= emCima) { painel.style.top = (r.bottom + 6) + 'px'; painel.style.maxHeight = Math.max(180, embaixo - 6) + 'px'; }
      else { painel.style.bottom = (innerHeight - r.top + 6) + 'px'; painel.style.maxHeight = Math.max(180, emCima - 6) + 'px'; painel.classList.add('cima'); }
    }
    requestAnimationFrame(() => fundo.classList.add('on'));
    bt.setAttribute('aria-expanded', 'true'); bt.classList.add('aberto');
    lista.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) escolher(vis[+b.dataset.i]); });
    lista.addEventListener('mousemove', e => { const b = e.target.closest('[data-i]'); if (b && +b.dataset.i !== foco) { foco = +b.dataset.i; lista.querySelectorAll('.esc-op').forEach((x, i) => x.classList.toggle('foco', i === foco)); } });
    fundo.addEventListener('mousedown', e => { if (e.target === fundo) fechar(); });
    fundo.addEventListener('touchstart', e => { if (e.target === fundo) fechar(); }, { passive: true });
    const tecla = e => {
      if (e.key === 'Escape') { e.preventDefault(); fechar(); bt.focus({ preventScroll: true }); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); foco = (foco + (e.key === 'ArrowDown' ? 1 : -1) + vis.length) % Math.max(1, vis.length); pintar(); return; }
      if (e.key === 'Enter') { e.preventDefault(); escolher(vis[foco]); return; }
      if (e.key === 'Tab') { fechar(); return; }
      if (!busca && e.key.length === 1) { const k = semAc(e.key); const i = vis.findIndex((o, j) => j > foco && semAc(o.rotulo).startsWith(k)); const i2 = i >= 0 ? i : vis.findIndex(o => semAc(o.rotulo).startsWith(k)); if (i2 >= 0) { foco = i2; pintar(); } }
    };
    fundo.addEventListener('keydown', tecla);
    if (busca) { busca.addEventListener('input', () => { filtro = busca.value; foco = 0; pintar(); }); if (!celular) busca.focus(); else painel.tabIndex = -1; }
    else { painel.tabIndex = -1; painel.focus({ preventScroll: true }); }
    const fora = () => fechar();
    addEventListener('resize', fora, { once: true });
    const rolou = e => { if (!fundo.contains(e.target)) fechar(); };
    document.addEventListener('scroll', rolou, true);
    aberto = { fundo, bt, limpar: () => { document.removeEventListener('scroll', rolou, true); removeEventListener('resize', fora); } };
  }
  function marca(t, f) {
    if (!f) return esc(t);
    const i = semAc(t).indexOf(semAc(f)); if (i < 0) return esc(t);
    return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + f.length)) + '</mark>' + esc(t.slice(i + f.length));
  }
  function fechar() {
    if (!aberto) return;
    const { fundo, bt, limpar } = aberto; aberto = null; limpar();
    bt.setAttribute('aria-expanded', 'false'); bt.classList.remove('aberto');
    fundo.classList.remove('on'); setTimeout(() => fundo.remove(), 160);
  }
  return { melhorar, fechar };
})();
