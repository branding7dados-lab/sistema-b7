/* =====================================================================
   ARRASTAR (zzz165) — arrastar cartões entre colunas, fluido e em lote.

   Feito com Pointer Events (não o arrastar nativo do navegador): o
   cartão "fantasma" segue o dedo/mouse a 60 qps pela placa de vídeo
   (transform), inclina de leve, e as colunas acendem quando ele passa.
   Ao soltar, os cartões deslizam até o lugar novo (FLIP).

   Vários de uma vez: Ctrl/⌘ ou Shift + clique marca cartões; arrastar
   um marcado leva todos. No celular, segurar um cartão (0,35 s) e soltar
   sem mexer marca/desmarca; segurar e arrastar leva. Esc limpa.

   Uso:
     B7.Arrastar.ligar(raiz, {
       cartao: '.ds-card[data-peca]', coluna: '.ds-col[data-status]', lista: '.ds-lista',
       id: el => el.dataset.peca, destino: col => col.dataset.status,
       aoSoltar: async (ids, destino) => {...}   // lança erro para desfazer
     });
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Arrastar = (function () {
  const LIMIAR = 6, SEGURAR = 350;

  function ligar(raiz, op) {
    if (!raiz || raiz._arrastarLigado) return;
    raiz._arrastarLigado = true;
    let ini = null, fantasma = null, arrastando = false, alvo = null, origemCol = null, levados = [], raf = 0, px = 0, py = 0, timerSegurar = 0, segurou = false, cancelaClique = false, rolarRaf = 0;

    const selecionados = () => [...raiz.querySelectorAll(op.cartao + '.arr-sel')];
    const limparSel = () => { selecionados().forEach(c => c.classList.remove('arr-sel')); atualizarBarra(); };
    const alternar = c => { c.classList.toggle('arr-sel'); atualizarBarra(); };

    /* faixa que aparece com o número de marcados */
    let barra = null;
    function atualizarBarra() {
      const n = selecionados().length;
      if (!n) { if (barra) { barra.classList.remove('on'); } return; }
      if (!barra) {
        barra = document.createElement('div'); barra.className = 'arr-barra';
        barra.innerHTML = '<b></b><span>Arraste um deles para mover todos</span><button type="button">Limpar</button>';
        barra.querySelector('button').onclick = limparSel;
        document.body.appendChild(barra);
      }
      barra.querySelector('b').textContent = n + (n === 1 ? ' marcado' : ' marcados');
      requestAnimationFrame(() => barra.classList.add('on'));
    }
    const sair = () => {
      if (barra) barra.remove(); barra = null; document.removeEventListener('keydown', tecla);
      removeEventListener('pointermove', mover); removeEventListener('pointerup', soltar); removeEventListener('pointercancel', cancelar);
      if (fantasma) fantasma.remove();
    };
    const tecla = e => { if (e.key === 'Escape') limparSel(); };
    document.addEventListener('keydown', tecla);
    if (B7.Rota && B7.Rota.aoSair) B7.Rota.aoSair(sair);

    raiz.addEventListener('click', e => {
      const c = e.target.closest(op.cartao); if (!c) return;
      if (cancelaClique) { e.stopPropagation(); e.preventDefault(); cancelaClique = false; return; }
      if (e.ctrlKey || e.metaKey || e.shiftKey) { e.stopPropagation(); e.preventDefault(); alternar(c); }
      else if (selecionados().length && !c.classList.contains('arr-sel') && segurou) { e.stopPropagation(); e.preventDefault(); }
    }, true);

    raiz.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (op.soMouse && e.pointerType !== 'mouse') return;   /* a tela já tem o próprio arrastar de toque */
      const c = e.target.closest(op.cartao);
      if (!c || e.target.closest('button, a, input, select, textarea, summary')) return;
      ini = { x: e.clientX, y: e.clientY, cartao: c, toque: e.pointerType !== 'mouse', id: e.pointerId };
      segurou = false;
      if (ini.toque) timerSegurar = setTimeout(() => { segurou = true; if (navigator.vibrate) navigator.vibrate(12); c.classList.add('arr-pronto'); }, SEGURAR);
    });

    const mover = e => {
      if (!ini || e.pointerId !== ini.id) return;
      px = e.clientX; py = e.clientY;
      const dx = px - ini.x, dy = py - ini.y;
      if (!arrastando) {
        if (Math.hypot(dx, dy) < LIMIAR) return;
        if (ini.toque && !segurou) { clearTimeout(timerSegurar); ini = null; return; }   /* no toque, mexer sem segurar é rolar a tela */
        comecar();
      }
      e.preventDefault();
      if (!raf) raf = requestAnimationFrame(quadro);
    };
    const soltar = e => { if (ini && e.pointerId === ini.id) terminar(false); };
    const cancelar = e => { if (ini && e.pointerId === ini.id) terminar(true); };
    addEventListener('pointermove', mover, { passive: false });
    addEventListener('pointerup', soltar);
    addEventListener('pointercancel', cancelar);

    function comecar() {
      clearTimeout(timerSegurar);
      arrastando = true;
      ini.cartao.classList.remove('arr-pronto');
      if (!ini.cartao.classList.contains('arr-sel')) { limparSel(); }
      levados = ini.cartao.classList.contains('arr-sel') ? selecionados() : [ini.cartao];
      origemCol = ini.cartao.closest(op.coluna);
      const r = ini.cartao.getBoundingClientRect();
      ini.ox = ini.x - r.left; ini.oy = ini.y - r.top;
      fantasma = ini.cartao.cloneNode(true);
      fantasma.classList.add('arr-fantasma'); fantasma.classList.remove('arr-sel');
      fantasma.style.width = r.width + 'px';
      if (levados.length > 1) {
        fantasma.classList.add('arr-pilha');
        const n = document.createElement('i'); n.className = 'arr-n'; n.textContent = levados.length; fantasma.appendChild(n);
      }
      document.body.appendChild(fantasma);
      levados.forEach(c => c.classList.add('arr-origem'));
      document.documentElement.classList.add('arr-ativo');
      if (B7.TempoReal && B7.TempoReal.arrastando) B7.TempoReal.arrastando(true);
      quadro();
    }

    function quadro() {
      raf = 0;
      if (!fantasma) return;
      const x = px - ini.ox, y = py - ini.oy, inclina = Math.max(-6, Math.min(6, (px - (ini.ultX || px)) * .6));
      ini.ultX = px;
      fantasma.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) rotate(' + inclina + 'deg) scale(1.03)';
      /* coluna debaixo do ponteiro */
      fantasma.style.visibility = 'hidden';
      const el = document.elementFromPoint(px, py);
      fantasma.style.visibility = '';
      const col = el && el.closest(op.coluna);
      const novo = col && raiz.contains(col) && col !== origemCol ? col : null;
      if (novo !== alvo) { if (alvo) alvo.classList.remove('arr-alvo'); alvo = novo; if (alvo) alvo.classList.add('arr-alvo'); }
      rolarBorda();
    }

    /* perto da borda do quadro, ele rola sozinho */
    function rolarBorda() {
      cancelAnimationFrame(rolarRaf);
      const rolo = op.rolo ? raiz.querySelector(op.rolo) || raiz : raiz;
      const r = rolo.getBoundingClientRect(), m = 70;
      const v = px < r.left + m ? -(r.left + m - px) / 4 : px > r.right - m ? (px - (r.right - m)) / 4 : 0;
      if (!v || !arrastando) return;
      rolo.scrollLeft += v;
      rolarRaf = requestAnimationFrame(rolarBorda);
    }

    async function terminar(cancelou) {
      clearTimeout(timerSegurar); cancelAnimationFrame(rolarRaf);
      const c = ini && ini.cartao;
      if (c) c.classList.remove('arr-pronto');
      if (!arrastando) {
        /* toque segurado e solto sem mexer: marca/desmarca */
        if (ini && ini.toque && segurou && c) { alternar(c); cancelaClique = true; setTimeout(() => { cancelaClique = false; }, 400); }
        ini = null; return;
      }
      arrastando = false; cancelaClique = true; setTimeout(() => { cancelaClique = false; }, 300);
      if (B7.TempoReal && B7.TempoReal.arrastando) B7.TempoReal.arrastando(false);
      document.documentElement.classList.remove('arr-ativo');
      const destino = !cancelou && alvo ? alvo : null;
      if (alvo) alvo.classList.remove('arr-alvo');
      alvo = null;
      /* moverDom:false — quem move os cartões é a própria tela (aoSoltar) */
      const lista = destino && op.moverDom !== false ? (destino.querySelector(op.lista) || destino) : null;
      /* FLIP: guarda onde estavam, move no DOM, anima até o lugar novo */
      const antes = new Map(levados.map(el => [el, el.getBoundingClientRect()]));
      const fr = fantasma.getBoundingClientRect();
      if (lista) {
        const vazio = lista.querySelector('.ds-col-nada'); if (vazio) vazio.remove();
        levados.forEach(el => lista.prepend(el));
      }
      levados.forEach(el => {
        el.classList.remove('arr-origem', 'arr-sel');
        const a = lista ? fr : antes.get(el), d = el.getBoundingClientRect();
        el.animate([{ transform: 'translate(' + (a.left - d.left) + 'px,' + (a.top - d.top) + 'px) scale(1.03)', opacity: .9 },
          { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1.15)' });
      });
      fantasma.remove(); fantasma = null;
      atualizarBarra();
      const ids = levados.map(op.id), movidos = levados; levados = []; ini = null;
      if (!destino) return;
      if (op.moverDom === false) { try { await op.aoSoltar(ids, op.destino(destino)); } catch (e) {} return; }
      try {
        await op.aoSoltar(ids, op.destino(destino));
        if (op.contar) op.contar(raiz);
      } catch (e) {
        /* deu errado: volta tudo para onde estava */
        const casa = origemCol && (origemCol.querySelector(op.lista) || origemCol);
        if (casa) movidos.forEach(el => casa.prepend(el));
        B7.UI.toast((e && e.message) || 'Não foi possível mover.', { tipo: 'erro' });
      }
    }
  }
  return { ligar };
})();
