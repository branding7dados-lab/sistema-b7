/* =====================================================================
   MENU DO BOTÃO DIREITO
   Clicar com o botão direito num item (pessoa, cliente, demanda, cartão,
   link do menu…) abre as ações DAQUELE item, em vez do menu do navegador.

   Não existe uma lista de ações escrita aqui: o menu é montado a partir
   do que o próprio item já oferece na tela — o que o clique faz, os
   botões dele e o menu "⋯". Cada opção aciona o controle original, então
   permissões e regras continuam sendo as da tela.

   Não é para tudo: só abre em link, ou em linha/cartão de lista que tem
   clique próprio ou o seu "⋯". No resto, e também em campos de texto,
   com texto selecionado, no toque e segurando Shift, vale o menu do
   navegador.
   ===================================================================== */
window.B7 = window.B7 || {};
B7.Ctx = (function () {
  'use strict';

  let aberto = null;
  const MAX_ACOES = 9;

  const limpo = s => String(s || '').replace(/\s+/g, ' ').trim();
  /* texto sem letra nenhuma (um contador "5", um "⋯") não é nome: vale o
     aria-label/title do controle */
  const temLetra = s => /[A-Za-zÀ-ÿ]{2}/.test(s);
  /* Texto de um elemento com espaço entre as partes: "Buscar atualização"
     e a explicação embaixo são pedaços diferentes, não uma palavra só. */
  function partes(el) {
    const out = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const s = limpo(n.textContent); if (s) out.push(s); }
    return out;
  }
  /* o nome é o trecho em destaque, quando existe; senão a primeira parte
     com letras; a explicação que vem depois fica de fora */
  function nomeDe(el) {
    const d = el.querySelector('b, strong, h1, h2, h3, h4');
    const lista = d ? partes(d) : partes(el);
    const p = lista.find(temLetra);
    return p || '';
  }
  const encurta = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  const rotulo = el => {
    const tx = nomeDe(el);
    if (tx) return encurta(tx, 34);
    return encurta(limpo(el.getAttribute('aria-label') || el.title || ''), 34);
  };

  /* ícone escolhido pelo nome da ação */
  const sv = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const ICONES = [
    [/nova aba/i, sv('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>')],
    [/copiar link/i, sv('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>')],
    [/^copiar|duplicar/i, sv('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>')],
    [/excluir|apagar|remover|descartar|lixeira|tirar/i, sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>')],
    [/desativar|cancelar|bloquear|pausar/i, sv('<circle cx="12" cy="12" r="8.5"/><path d="M6 18L18 6"/>')],
    [/reativar|ativar|restaurar|desarquivar/i, sv('<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5"/>')],
    [/editar|renomear|alterar/i, sv('<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>')],
    [/senha|acesso|permiss/i, sv('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>')],
    [/foto|imagem|logo|capa/i, sv('<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/>')],
    [/arquivar/i, sv('<rect x="3.5" y="4.5" width="17" height="4" rx="1"/><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 13h4"/>')],
    [/imprimir|pdf|exportar|baixar/i, sv('<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>')],
    [/calend|agenda|data|prazo/i, sv('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>')],
    [/voltar/i, sv('<path d="M19 12H5M11 6l-6 6 6 6"/>')],
    [/recarregar|atualizar/i, sv('<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/>')],
    [/assistente/i, sv('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z"/>')],
    [/notifica|aviso/i, sv('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16zM10 20a2 2 0 0 0 4 0"/>')],
    [/novo|nova|criar|adicionar/i, sv('<path d="M12 5v14M5 12h14"/>')],
    [/mover|enviar|passar/i, sv('<path d="M5 12h14M13 6l6 6-6 6"/>')],
    [/abrir|detalhe/i, sv('<path d="M8 5h11v11M19 5L6 18"/>')],
  ];
  const PADRAO = sv('<circle cx="12" cy="12" r="2.2"/>');
  const icone = r => { for (const [re, ic] of ICONES) if (re.test(r)) return ic; return PADRAO; };
  const ehControle = el => el.matches('a[href], button, [role="button"], [role="link"], [role="menuitem"], [role="tab"]');
  const clicavel = el => ehControle(el) || typeof el.onclick === 'function';
  const desligado = el => el.disabled || el.getAttribute('aria-disabled') === 'true' || el.hidden || el.style.display === 'none';
  const visivel = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const perigoso = el => el.classList.contains('perigo') || /^(excluir|apagar|remover|descartar|cancelar|tirar|desativar)\b/i.test(nomeDe(el));

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

  /* O menu só aparece quando o alvo é claramente UMA coisa:
       • um link (item do menu lateral, atalho);
       • uma linha/cartão de lista que abre com o clique;
       • uma linha/cartão de lista que tem o seu "⋯".
     Fora disso (blocos de configuração, botões soltos, área vazia, grupos
     inteiros) fica o menu do navegador. */
  function acharItem(alvo) {
    for (let el = alvo; el && el !== document.body && el.nodeType === 1; el = el.parentElement) {
      if (el.matches('main, nav, aside, header, footer, form, .fundo-modal, .modal')) break;
      if (el.matches('a[href]')) {
        const h = el.getAttribute('href') || '';
        return h && h !== '#' && !/^javascript:/i.test(h) && nomeDe(el) ? el : null;
      }
      if (!repetido(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 180 || r.height > window.innerHeight * .6) continue;
      const proprioMenu = el.querySelectorAll('.menu > .lista, .menu > button').length && el.querySelectorAll('.menu').length === 1;
      const abre = typeof el.onclick === 'function' || el.matches('button, [role="button"], [role="link"]');
      if ((abre || proprioMenu) && tituloDe(el)) return el;
    }
    return null;
  }

  function tituloDe(item) {
    const t = item.querySelector('h1, h2, h3, h4, b, strong');
    /* só o texto do próprio título: selos dentro dele ("VOCÊ") ficam fora */
    const proprio = t ? limpo([...t.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ')) : '';
    const tx = (temLetra(proprio) && proprio) || nomeDe(item) || limpo(item.getAttribute('aria-label') || item.title || '');
    return encurta(tx, 40);
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

    if (clicavel(item)) por({ rotulo: 'Abrir', forte: true, fazer: acionar(item) });
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
        if (f.classList.contains('rot')) { if (pediuSep) { ops.push({ sep: true }); pediuSep = false; } ops.push({ rot: partes(f).join(' ') }); return; }
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
    const img = item.querySelector('img');
    return { titulo: nome, foto: (img && (img.currentSrc || img.src)) || '', ops };
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

  function abrir(x, y, titulo, ops, foto) {
    fechar();
    if (B7.UI && B7.UI.fecharMenus) { try { B7.UI.fecharMenus(); } catch (e) {} }
    const m = document.createElement('div');
    m.className = 'lista solta ctx-menu';
    m.setAttribute('role', 'menu');
    if (titulo) {
      const c = document.createElement('div'); c.className = 'ctx-tit';
      if (foto) { const i = document.createElement('img'); i.src = foto; i.alt = ''; c.appendChild(i); }
      const s = document.createElement('span'); s.textContent = titulo; c.appendChild(s);
      m.appendChild(c);
    }
    ops.forEach(o => {
      if (o.sep) { m.appendChild(document.createElement('hr')); return; }
      if (o.rot) { const d = document.createElement('div'); d.className = 'rot'; d.textContent = o.rot; m.appendChild(d); return; }
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'menuitem');
      if (o.perigo) b.classList.add('perigo');
      if (o.forte) b.classList.add('ctx-forte');
      b.innerHTML = '<i class="ctx-ic">' + icone(o.rotulo) + '</i>';
      const s = document.createElement('span'); s.textContent = o.rotulo; b.appendChild(s);
      b.addEventListener('click', e => { e.stopPropagation(); fechar(); try { o.fazer(); } catch (err) { console.error(err); } });
      m.appendChild(b);
    });
    const pe = document.createElement('div');
    pe.className = 'ctx-pe'; pe.innerHTML = '<kbd>Shift</kbd> + clique direito abre o menu do navegador';
    m.appendChild(pe);

    (document.fullscreenElement || document.body).appendChild(m);
    const larg = m.offsetWidth, alt = m.offsetHeight, MG = 8;
    m.style.left = Math.round(Math.max(MG, Math.min(x, window.innerWidth - larg - MG))) + 'px';
    m.style.top = Math.round(Math.max(MG, Math.min(y + alt + MG > window.innerHeight ? y - alt : y, window.innerHeight - alt - MG))) + 'px';
    m.style.transformOrigin = (x > window.innerWidth - larg - MG ? 'right' : 'left') + ' ' + (y + alt + MG > window.innerHeight ? 'bottom' : 'top');
    requestAnimationFrame(() => m.classList.add('mostrando'));
    setTimeout(() => m.classList.add('mostrando'), 60);
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
    if (!item) return;
    const r = opcoesDoItem(item, t);
    if (!r.ops.some(o => o.forte || (o.rotulo && !/^Copiar /.test(o.rotulo)))) return;
    e.preventDefault();
    abrir(e.clientX, e.clientY, r.titulo, r.ops, r.foto);
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
