/* =====================================================================
   MENU DO BOTÃO DIREITO
   Clicar com o botão direito num item (pessoa, cliente, demanda, cartão,
   link do menu…) abre as ações DAQUELE item, em vez do menu do navegador.

   Não existe uma lista de ações escrita aqui: o menu é montado a partir
   do que o próprio item já oferece na tela — o que o clique faz, os
   botões dele e o menu "⋯". Cada opção aciona o controle original, então
   permissões e regras continuam sendo as da tela.

   O menu do navegador continua disponível: em campos de texto, com texto
   selecionado, no toque e segurando Shift.
   ===================================================================== */
window.B7 = window.B7 || {};
B7.Ctx = (function () {
  'use strict';

  let aberto = null;
  const MAX_ACOES = 9;

  const limpo = s => String(s || '').replace(/\s+/g, ' ').trim();
  const rotulo = el => {
    const tx = limpo(el.textContent);
    if (tx && tx.length <= 42) return tx;
    return limpo(el.getAttribute('aria-label') || el.title || '') || (tx ? tx.slice(0, 40) + '…' : '');
  };
  const ehControle = el => el.matches('a[href], button, [role="button"], [role="link"], [role="menuitem"], [role="tab"]');
  const clicavel = el => ehControle(el) || typeof el.onclick === 'function';
  const desligado = el => el.disabled || el.getAttribute('aria-disabled') === 'true' || el.hidden || el.style.display === 'none';
  const visivel = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const perigoso = el => el.classList.contains('perigo') || /^(excluir|apagar|remover|descartar|cancelar|tirar|desativar)\b/i.test(limpo(el.textContent));

  /* irmãos com a mesma "cara" = o elemento é um item de lista */
  function repetido(el) {
    const p = el.parentElement;
    if (!p) return false;
    const c = el.classList[0];
    if (!c && !/^(TR|LI)$/.test(el.tagName)) return false;
    for (const i of p.children) {
      if (i !== el && i.tagName === el.tagName && (!c || i.classList.contains(c))) return true;
    }
    return false;
  }

  const SEL_ACOES = 'button, a[href], [role="button"]';

  function acharItem(alvo) {
    let reserva = null;
    for (let el = alvo; el && el !== document.body && el.nodeType === 1; el = el.parentElement) {
      if (el.matches('main, nav, aside, header, footer, .fundo-modal, .modal')) break;
      const r = el.getBoundingClientRect();
      if (!reserva && clicavel(el) && (ehControle(el) || r.height < window.innerHeight * .5)) reserva = el;
      if (r.width < 140 || !repetido(el)) continue;
      if (clicavel(el)) return el;
      const n = el.querySelectorAll(SEL_ACOES).length;
      if (n && n <= 14) return el;
    }
    return reserva;
  }

  function tituloDe(item) {
    const t = item.querySelector('h1, h2, h3, h4, b, strong');
    const tx = limpo((t || item).textContent);
    if (!tx) return limpo(item.getAttribute('aria-label') || item.title || '');
    return tx.length > 46 ? tx.slice(0, 44) + '…' : tx;
  }

  /* ---------------------------------------------------------- montagem */
  function opcoesDoItem(item, alvo) {
    const ops = [], vistos = new Set();
    const por = (o) => {
      if (!o.sep && !o.rot) {
        const k = o.rotulo.toLowerCase();
        if (!o.rotulo || vistos.has(k)) return;
        vistos.add(k);
      }
      ops.push(o);
    };
    const acionar = el => () => { el.click(); };

    const link = item.matches('a[href]') ? item : (alvo && alvo.closest && alvo.closest('a[href]'));
    const href = link && item.contains(link) ? link.href : '';

    if (clicavel(item)) por({ rotulo: ehControle(item) && !item.matches('a[href]') ? (rotulo(item) || 'Abrir') : 'Abrir', forte: true, fazer: acionar(item) });
    if (href) por({ rotulo: 'Abrir em nova aba', fazer: () => window.open(href, '_blank', 'noopener') });

    /* botões e links à vista dentro do item */
    let soltos = 0;
    item.querySelectorAll(SEL_ACOES).forEach(el => {
      if (el === item || el.closest('.menu') || desligado(el) || !visivel(el) || soltos >= MAX_ACOES) return;
      const r = rotulo(el);
      if (!r) return;
      const antes = ops.length;
      por({ rotulo: r, perigo: perigoso(el), fazer: acionar(el) });
      if (ops.length > antes) soltos++;
    });

    /* o que está guardado no "⋯" do item */
    item.querySelectorAll('.menu').forEach(menu => {
      const lista = menu.querySelector('.lista');
      if (!lista) return;
      let pediuSep = ops.length > 0;
      [...lista.children].forEach(f => {
        if (f.tagName === 'HR') { pediuSep = ops.length > 0; return; }
        if (f.classList.contains('rot')) { if (pediuSep) { ops.push({ sep: true }); pediuSep = false; } ops.push({ rot: limpo(f.textContent) }); return; }
        if (!f.matches('button, a[href]') || desligado(f)) return;
        const r = rotulo(f);
        if (!r || vistos.has(r.toLowerCase())) return;
        if (pediuSep) { ops.push({ sep: true }); pediuSep = false; }
        por({ rotulo: r, perigo: perigoso(f), fazer: acionar(f) });
      });
    });

    const nome = tituloDe(item);
    const extras = [];
    if (nome) extras.push({ rotulo: 'Copiar nome', fazer: () => copiar(nome, 'Nome copiado.') });
    if (href) extras.push({ rotulo: 'Copiar link', fazer: () => copiar(href, 'Link copiado.') });
    if (extras.length) { if (ops.length) ops.push({ sep: true }); extras.forEach(por); }
    return { titulo: nome, ops };
  }

  function opcoesDaTela() {
    const ops = [];
    if (history.length > 1) ops.push({ rotulo: 'Voltar', fazer: () => history.back() });
    ops.push({ rotulo: 'Recarregar esta tela', fazer: () => location.reload() });
    ops.push({ rotulo: 'Copiar link desta tela', fazer: () => copiar(location.href, 'Link copiado.') });
    const fab = document.getElementById('b7-chat-fab');
    if (fab) { ops.push({ sep: true }); ops.push({ rotulo: 'Perguntar ao assistente', fazer: () => { if (!document.body.classList.contains('chat-aberto')) fab.click(); } }); }
    const h = document.querySelector('main h1, .topo h1, h1');
    return { titulo: h ? limpo(h.textContent).slice(0, 46) : '', ops };
  }

  function copiar(texto, msg) {
    const ok = () => { if (B7.UI && B7.UI.toast) B7.UI.toast(msg); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(texto).then(ok, () => {});
    } catch (e) {}
    try {
      const t = document.createElement('textarea');
      t.value = texto; t.style.cssText = 'position:fixed;opacity:0;left:-999px';
      document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); ok();
    } catch (e) {}
  }

  /* ------------------------------------------------------------ desenho */
  function fechar() {
    if (!aberto) return;
    const m = aberto; aberto = null;
    if (m.isConnected) m.remove();
  }

  function abrir(x, y, titulo, ops) {
    fechar();
    if (B7.UI && B7.UI.fecharMenus) { try { B7.UI.fecharMenus(); } catch (e) {} }
    const m = document.createElement('div');
    m.className = 'lista solta ctx-menu';
    m.setAttribute('role', 'menu');
    if (titulo) { const c = document.createElement('div'); c.className = 'ctx-tit'; c.textContent = titulo; m.appendChild(c); }
    ops.forEach(o => {
      if (o.sep) { m.appendChild(document.createElement('hr')); return; }
      if (o.rot) { const d = document.createElement('div'); d.className = 'rot'; d.textContent = o.rot; m.appendChild(d); return; }
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'menuitem');
      if (o.perigo) b.classList.add('perigo');
      if (o.forte) b.classList.add('ctx-forte');
      b.textContent = o.rotulo;
      b.addEventListener('click', e => { e.stopPropagation(); fechar(); try { o.fazer(); } catch (err) { console.error(err); } });
      m.appendChild(b);
    });
    const pe = document.createElement('div');
    pe.className = 'ctx-pe'; pe.textContent = 'Shift + botão direito: menu do navegador';
    m.appendChild(pe);

    (document.fullscreenElement || document.body).appendChild(m);
    const larg = m.offsetWidth, alt = m.offsetHeight, MG = 8;
    m.style.left = Math.round(Math.max(MG, Math.min(x, window.innerWidth - larg - MG))) + 'px';
    m.style.top = Math.round(Math.max(MG, Math.min(y + alt + MG > window.innerHeight ? y - alt : y, window.innerHeight - alt - MG))) + 'px';
    m.classList.add('mostrando');
    aberto = m;
    const p = m.querySelector('button'); if (p) p.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------ eventos */
  document.addEventListener('contextmenu', e => {
    const t = e.target;
    if (!t || t.nodeType !== 1) return;
    if (aberto && aberto.contains(t)) { e.preventDefault(); return; }
    fechar();
    if (e.shiftKey) return;
    if (!(B7.Auth && B7.Auth.usuario && B7.Auth.usuario())) return;
    if (document.body.classList.contains('tele-aberto')) return;
    if (window.matchMedia('(hover: none)').matches) return;
    if (t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], .lista')) return;
    const sel = window.getSelection && String(window.getSelection());
    if (sel && sel.trim()) return;

    const item = acharItem(t);
    const r = item ? opcoesDoItem(item, t) : opcoesDaTela();
    if (!r.ops.length) return;
    e.preventDefault();
    abrir(e.clientX, e.clientY, r.titulo, r.ops);
  });

  document.addEventListener('pointerdown', e => { if (aberto && !aberto.contains(e.target)) fechar(); }, true);
  document.addEventListener('keydown', e => {
    if (!aberto) return;
    if (e.key === 'Escape') { e.stopPropagation(); fechar(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const bs = [...aberto.querySelectorAll('button')];
      const i = bs.indexOf(document.activeElement);
      bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus();
    }
  }, true);
  window.addEventListener('hashchange', fechar);
  window.addEventListener('resize', fechar);
  window.addEventListener('blur', fechar);
  window.addEventListener('scroll', e => { if (aberto && !aberto.contains(e.target)) fechar(); }, { capture: true, passive: true });

  return { fechar };
})();
