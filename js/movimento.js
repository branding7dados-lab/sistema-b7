/* =====================================================================
   MOVIMENTO — três assinaturas do B7 (pacote zzi, 03/10)
   Pedido do Kevin: "Faz o 1, 2 e 3".
   1. CARD QUE VIRA TELA. Tocar num item de lista (gravação, demanda de
      vídeo, status, cliente, linha do Painel…) faz o próprio cartão
      crescer até ocupar a área da tela enquanto o detalhe carrega por
      baixo; ao voltar para a lista, uma "tela" encolhe de volta para o
      cartão de onde veio, que pisca de leve ao receber o pouso.
      Não depende de API nova: é um fantasma posicionado (fixed) que
      anima posição/tamanho/cantos com Web Animations. A navegação em si
      continua sendo a de sempre (o clique segue para o handler normal).
   2. COMEMORAÇÃO. Concluir gravação, entregar vídeo, finalizar peça de
      design e o cliente aprovar soltam uma chuva curta de confete (rosa,
      violeta, branco, verde) e um selo carimbado ("Entregue!"). Gatilho
      central: as funções do banco que fazem essas ações são embrulhadas
      aqui — a festa só sai quando a ação deu certo (promessa resolvida).
   3. PUXAR PARA ATUALIZAR COM A LÂMPADA. No celular, puxar a tela para
      baixo no topo enche a lâmpada do B7 de luz conforme o dedo desce;
      soltando com ela cheia, ela "estoura" (onda de luz + vibração) e a
      tela recarrega os dados (sem recarregar a página). Se há versão
      nova esperando, aí sim recarrega a página. O puxar nativo do
      navegador fica desligado (CSS), para não brigar com este.
      zzk: anel de progresso em volta da lâmpada, legenda ("Puxe…",
      "Solte…", "Atualizando…", "Atualizado"), conteúdo descendo junto de
      verdade (`translate`) e travas para o disco nunca ficar preso na
      tela (segundo dedo, troca de tela, app em segundo plano, tela lenta).
   Tudo respeita "reduzir movimento" (1 e 2 somem; 3 funciona sem
   firula). Nada de dado ou regra muda.
   ===================================================================== */
window.B7 = window.B7 || {};

(function () {
  const reduz = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const painel = () => document.getElementById('painel-dashboard');
  const vibrar = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };

  /* ===================================================================
     1. CARD QUE VIRA TELA
     =================================================================== */
  const SEL_VOO = '.gl-item, .card-gravacao, .vg-ultima, .vd-m-card, .item-status, .cs-item, .pn-att, .pn-comp, ' +
                  '.vg-tile, [data-cliente]';
  const ATRIBUTOS = ['data-gravacao', 'data-demanda', 'data-abrir-status', 'data-cliente', 'data-abrir-linha', 'data-abrir-semana'];
  let pendente = null;          /* clique que ainda vai virar navegação */
  let ultimoVoo = null;         /* para o caminho de volta */

  function chaveDe(el) {
    for (const a of ATRIBUTOS) if (el.hasAttribute(a)) return '[' + a + '="' + CSS.escape(el.getAttribute(a)) + '"]';
    if (el.tagName === 'A' && el.getAttribute('href')) return 'a[href="' + CSS.escape(el.getAttribute('href')) + '"]';
    return null;
  }
  /* área onde o detalhe vai aparecer: o painel, abaixo do topo de vidro */
  function areaAlvo() {
    const p = painel();
    const r = p && p.offsetParent !== null ? p.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    const topo = document.querySelector('#tela-dashboard .topo.topo-global');
    const tb = topo ? topo.getBoundingClientRect().bottom : r.top;
    const top = Math.max(r.top, Math.min(tb, r.top + 80));
    return { left: r.left, top, width: r.width, height: Math.max(120, (r.top + r.height) - top) };
  }
  const px = r => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });

  document.addEventListener('click', e => {
    if (reduz() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const p = painel(); if (!p) return;
    const el = e.target.closest && e.target.closest(SEL_VOO);
    if (!el || !p.contains(el)) return;
    /* tocou num botão/menu DENTRO do cartão (⋯, prévia, chips): não é abrir o cartão */
    const interno = e.target.closest('button, .menu, input, select, textarea, label, a');
    if (interno && interno !== el && el.contains(interno)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 24) return;
    /* a cópia é feita AGORA: quando a navegação chega, o roteador já pode
       ter trocado a tela e o cartão original não existe mais */
    const copia = el.cloneNode(true);
    copia.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    copia.removeAttribute('id');
    const raio = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 14;
    const tela = el.closest('.conteudo'), grupo = el.parentElement && el.parentElement.closest('.grupo-semana, .lista-status, .gl-lista, .vg-lista, .grade');
    const ctx = [tela ? tela.className : '', grupo ? grupo.className : ''].join(' ').replace(/\bentra\b/g, '');
    pendente = { el, r, copia, raio, ctx, chave: chaveDe(el), de: location.hash || '#/', t: performance.now() };
  }, true);

  function voarAbrindo(info) {
    const raio = info.raio;
    const g = document.createElement('div');
    g.className = 'b7-voo';
    g.setAttribute('aria-hidden', 'true');
    Object.assign(g.style, px(info.r), { borderRadius: raio + 'px' });
    /* a cópia vai dentro de um invólucro com as classes da tela de origem
       (estilos escopados, ex.: .ss-tela) e do grupo dela, para ficar igual */
    const miolo = document.createElement('div');
    miolo.className = info.ctx;
    miolo.appendChild(info.copia);
    info.copia.style.margin = '0';
    miolo.classList.add('b7-voo-miolo');
    miolo.style.padding = '0'; miolo.style.maxWidth = 'none'; miolo.style.background = 'none'; miolo.style.border = '0';
    Object.assign(miolo.style, { width: info.r.width + 'px', height: info.r.height + 'px', margin: '0', animation: 'none', transform: 'none', opacity: '1' });
    g.appendChild(miolo);
    document.body.appendChild(g);
    info.el.classList.add('b7-voo-origem');
    /* garantia: nunca fica preso na tela (aba em segundo plano congela animação) */
    setTimeout(() => { g.remove(); if (info.el.isConnected) info.el.classList.remove('b7-voo-origem'); }, 2600);
    const alvo = areaAlvo();
    const DUR = 440, curva = 'cubic-bezier(.2,.8,.2,1)';
    g.animate([Object.assign(px(info.r), { borderRadius: raio + 'px' }), Object.assign(px(alvo), { borderRadius: '22px' })],
      { duration: DUR, easing: curva, fill: 'forwards' });
    miolo.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0,-6px,0) scale(.98)' }],
      { duration: 220, easing: 'ease-out', fill: 'forwards' });
    /* segura até a tela nova ter conteúdo de verdade (não só esqueleto),
       no máximo ~1,1 s; então dissolve revelando o detalhe */
    const t0 = performance.now();
    const pronto = () => {
      const pn = painel();
      const c = pn && pn.querySelector(':scope > .conteudo');
      return c && !c.querySelector(':scope > .esqueleto-tela') && performance.now() - t0 > DUR - 40;
    };
    const sair = () => {
      const a = g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
      a.onfinish = () => g.remove();
      if (info.el.isConnected) info.el.classList.remove('b7-voo-origem');
    };
    const espera = () => {
      if (pronto() || performance.now() - t0 > 1100 || document.getElementById('tela-editor')?.classList.contains('ativa') && performance.now() - t0 > DUR) sair();
      else setTimeout(espera, 50);
    };
    setTimeout(espera, DUR - 40);
    ultimoVoo = { de: info.de, chave: info.chave, quando: Date.now() };
  }

  function voarVoltando(voo) {
    const alvoTela = areaAlvo();
    const g = document.createElement('div');
    g.className = 'b7-voo b7-voo-volta';
    g.setAttribute('aria-hidden', 'true');
    Object.assign(g.style, px(alvoTela), { borderRadius: '22px' });
    document.body.appendChild(g);
    setTimeout(() => g.remove(), 2600);   /* garantia */
    const t0 = performance.now();
    const procura = () => {
      const p = painel();
      const el = p && voo.chave ? p.querySelector(voo.chave) : null;
      const ok = el && el.getBoundingClientRect().height > 10 && !(p.querySelector(':scope > .conteudo > .esqueleto-tela'));
      if (ok) {
        /* rola até o cartão se ele estiver fora da tela */
        const r0 = el.getBoundingClientRect();
        if (r0.top < alvoTela.top || r0.bottom > innerHeight - 70) {
          p.scrollTop += r0.top - alvoTela.top - 80;
        }
        const r = el.getBoundingClientRect();
        const raio = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 14;
        const a = g.animate([Object.assign(px(alvoTela), { borderRadius: '22px', opacity: 1 }),
                             Object.assign(px(r), { borderRadius: raio + 'px', opacity: .9, offset: .85 }),
                             Object.assign(px(r), { borderRadius: raio + 'px', opacity: 0 })],
          { duration: 460, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' });
        a.onfinish = () => { g.remove(); el.classList.add('b7-voo-pouso'); setTimeout(() => el.classList.remove('b7-voo-pouso'), 700); };
      } else if (performance.now() - t0 > 1500) {
        const a = g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
        a.onfinish = () => g.remove();
      } else setTimeout(procura, 40);
    };
    setTimeout(procura, 60);
  }

  /* registrado ANTES do roteador agir: o roteador espera o salvamento
     (B7.Save.agora) antes de trocar a tela, então isto roda primeiro */
  window.addEventListener('hashchange', () => {
    if (reduz()) { pendente = null; return; }
    const agora = location.hash || '#/';
    if (pendente && performance.now() - pendente.t < 450) {
      const info = pendente; pendente = null;
      voarAbrindo(info);
      return;
    }
    pendente = null;
    if (ultimoVoo && ultimoVoo.de === agora && Date.now() - ultimoVoo.quando < 30 * 60 * 1000) {
      const voo = ultimoVoo; ultimoVoo = null;
      voarVoltando(voo);
    }
  });

  /* ===================================================================
     2. COMEMORAÇÃO
     =================================================================== */
  const CORES = ['#FF4FA0', '#B03BE6', '#7C5CFF', '#FFD3EC', '#FFFFFF', '#3FD08A', '#FF8FCB'];
  function soltar(texto) {
    if (reduz()) return;
    vibrar([14, 40, 22]);
    /* confete em canvas: um quadro por frame, some sozinho */
    const cv = document.createElement('canvas');
    cv.className = 'b7-festa';
    cv.setAttribute('aria-hidden', 'true');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const cx = innerWidth / 2, cy = innerHeight * .42;
    const N = Math.round(Math.min(150, 70 + innerWidth / 8));
    const ps = Array.from({ length: N }, (_, i) => {
      const ang = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.25;
      const vel = 7 + Math.random() * 9;
      return { x: cx + (Math.random() - .5) * 40, y: cy + (Math.random() - .5) * 20,
        vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 2, g: .28 + Math.random() * .12,
        r: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - .5) * .35,
        cor: CORES[i % CORES.length], forma: i % 3, vida: 1 };
    });
    const t0 = performance.now(), DUR = 2000;
    const quadro = agora => {
      const t = agora - t0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach(p => {
        p.vx *= .985; p.vy = p.vy * .985 + p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        const a = Math.max(0, 1 - Math.max(0, t - DUR * .55) / (DUR * .45));
        ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.cor;
        if (p.forma === 0) ctx.fillRect(-p.r, -p.r * .45, p.r * 2, p.r * .9);
        else if (p.forma === 1) { ctx.beginPath(); ctx.arc(0, 0, p.r * .7, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(p.r * .35, 0); ctx.lineTo(0, p.r); ctx.lineTo(-p.r * .35, 0); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      });
      if (t < DUR) requestAnimationFrame(quadro); else cv.remove();
    };
    requestAnimationFrame(quadro);
    setTimeout(() => cv.isConnected && cv.remove(), DUR + 600);   /* garantia */
    /* selo carimbado */
    if (texto) {
      const s = document.createElement('div');
      s.className = 'b7-carimbo';
      s.setAttribute('role', 'status');
      s.innerHTML = '<span class="b7-carimbo-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><b></b>';
      s.querySelector('b').textContent = texto;
      document.body.appendChild(s);
      setTimeout(() => { s.classList.add('sai'); setTimeout(() => s.remove(), 400); }, 1500);
    }
  }
  B7.Festa = { soltar };

  /* gatilhos: as funções do banco que concluem algo. Só comemora quando
     a promessa resolve (deu certo). Embrulhadas uma vez, na carga. */
  function embrulhar(nome, quando, texto) {
    const DB = B7.DB; if (!DB || typeof DB[nome] !== 'function' || DB[nome].__festa) return;
    const original = DB[nome];
    const novo = function () {
      const args = arguments;
      const r = original.apply(this, args);
      if (r && typeof r.then === 'function' && quando(args)) {
        r.then(res => {
          if (res && res.resultado === 'inalterado') return;    /* já estava assim: nada a comemorar */
          setTimeout(() => soltar(typeof texto === 'function' ? texto(args) : texto), 280);
        }).catch(() => {});
      }
      return r;
    };
    novo.__festa = true;
    DB[nome] = novo;
  }
  function ligarFesta() {
    embrulhar('gravacaoConcluir', () => true, 'Gravação concluída!');
    embrulhar('registrarEntregaVideo', () => true, 'Vídeo entregue!');
    embrulhar('mudarStatusVideo', a => a[1] === 'entregue', 'Vídeo entregue!');
    embrulhar('finalizarDesign', () => true, 'Peça finalizada!');
    embrulhar('decidirAprovacao', a => a[1] === 'aprovado', 'Aprovado!');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligarFesta); else ligarFesta();

  /* ===================================================================
     3. PUXAR PARA ATUALIZAR COM A LÂMPADA
     =================================================================== */
  const LIMIAR = 72;            /* px de deslocamento visível para "encher" */
  const ROTULO = { puxa: 'Puxe para atualizar', solta: 'Solte para atualizar', vai: 'Atualizando…', ok: 'Atualizado', nova: 'Abrindo a versão nova…' };
  const ARCO = 2 * Math.PI * 20; /* circunferência do anel (r = 20) */
  let ind = null;
  function indicador() {
    if (ind && ind.isConnected) return ind;
    ind = document.createElement('div');
    ind.className = 'b7-puxa';
    ind.setAttribute('aria-hidden', 'true');
    ind.innerHTML =
      '<span class="bp-disco">' +
        '<svg class="bp-anel" viewBox="0 0 48 48"><circle class="bp-trilho" cx="24" cy="24" r="20"/>' +
          '<circle class="bp-progresso" cx="24" cy="24" r="20" stroke-dasharray="' + ARCO.toFixed(2) + '" stroke-dashoffset="' + ARCO.toFixed(2) + '"/></svg>' +
        '<i class="bp-apagada"></i><i class="bp-acesa"></i>' +
      '</span><i class="bp-onda"></i><span class="bp-rotulo"></span>';
    document.body.appendChild(ind);
    return ind;
  }
  let y0 = 0, x0 = 0, ativo = false, puxando = false, desloc = 0, ocupado = false, alvoConteudo = null, cheiaAntes = false, fimTimer = 0;
  const podePuxar = () => {
    const p = painel();
    if (!p || p.offsetParent === null || ocupado) return false;
    if (!document.getElementById('tela-dashboard')?.classList.contains('ativa')) return false;
    if (document.querySelector('.fundo-modal:not(.saindo), .folha-mais.aberta, .b7-abertura, .tele, .apresentacao')) return false;
    return p.scrollTop <= 0;
  };
  function rotulo(chave) {
    const r = indicador().querySelector('.bp-rotulo');
    if (r.dataset.k === chave) return;
    r.dataset.k = chave; r.textContent = ROTULO[chave];
    r.classList.remove('troca'); void r.offsetWidth; r.classList.add('troca');
  }
  function posicionar(d, p) {
    const el = indicador();
    const topo = document.querySelector('#tela-dashboard .topo.topo-global');
    const base = topo ? topo.getBoundingClientRect().bottom : 0;
    el.style.setProperty('--bp-y', (base - 56 + d * .62).toFixed(1) + 'px');
    el.style.setProperty('--bp-p', p.toFixed(3));
    el.querySelector('.bp-progresso').setAttribute('stroke-dashoffset', (ARCO * (1 - p)).toFixed(2));
    const cheia = p >= 1;
    el.classList.toggle('cheia', cheia);
    if (puxando && cheia !== cheiaAntes) { rotulo(cheia ? 'solta' : 'puxa'); if (cheia) vibrar(8); }
    cheiaAntes = cheia;
    /* `translate` (e não `transform`): a animação de entrada da página usa
       transform com fill e não pode prender o conteúdo no lugar */
    if (alvoConteudo) alvoConteudo.style.translate = d ? '0 ' + d.toFixed(1) + 'px' : '';
  }
  /* devolve tudo ao lugar. Sempre termina limpo, mesmo se algo falhar no meio */
  function recolher() {
    const el = indicador();
    clearTimeout(fimTimer);
    el.classList.add('volta');
    if (alvoConteudo) alvoConteudo.style.transition = 'translate .42s cubic-bezier(.2,.9,.25,1.15)';
    posicionar(0, 0);
    const alvo = alvoConteudo;
    fimTimer = setTimeout(() => {
      el.classList.remove('volta', 'estoura', 'girando', 'cheia', 'mostra', 'pronto');
      el.querySelector('.bp-rotulo').dataset.k = '';
      if (alvo) { alvo.style.transition = ''; alvo.style.translate = ''; }
      if (alvoConteudo === alvo) alvoConteudo = null;
      puxando = false; ativo = false; ocupado = false;
    }, 440);
  }
  async function estourar() {
    ocupado = true;
    const el = indicador();
    el.classList.add('estoura');
    vibrar(18);
    posicionar(56, 1);
    /* versão nova esperando? então recarrega a página de verdade */
    const aviso = [...document.querySelectorAll('#toasts .toast')].some(t => /Nova versão/.test(t.textContent));
    rotulo(aviso ? 'nova' : 'vai');
    setTimeout(() => el.classList.add('girando'), 380);
    if (aviso) { setTimeout(() => location.reload(), 420); return; }
    const t0 = Date.now();
    /* nunca fica preso: se a tela demorar mais de 6 s, o indicador sai assim mesmo */
    try {
      if (B7.Rota && B7.Rota.ir) await Promise.race([Promise.resolve(B7.Rota.ir()), new Promise(r => setTimeout(r, 6000))]);
    } catch (e) {}
    await new Promise(r => setTimeout(r, Math.max(0, 820 - (Date.now() - t0))));
    el.classList.remove('girando');
    el.classList.add('pronto');
    rotulo('ok');
    setTimeout(recolher, 520);
  }
  /* tudo o que pode interromper um puxão no meio: volta ao lugar */
  function abortar() {
    if (ocupado) return;
    if (puxando || (ind && ind.classList.contains('mostra'))) recolher();
    ativo = false; puxando = false;
  }
  document.addEventListener('touchstart', e => {
    /* segundo dedo no meio do puxão: cancela (sem atualizar) em vez de deixar o disco preso */
    if (puxando) { ativo = false; puxando = false; recolher(); return; }
    const p = painel();
    if (e.touches.length !== 1 || !p || !p.contains(e.target) || !podePuxar()) { ativo = false; return; }
    /* começou dentro de algo que rola de lado (abas, chips, carrossel)? ok,
       o gesto vertical decide; mas dentro de campo de texto, não */
    if (e.target.closest('input, textarea, select, [contenteditable="true"]')) { ativo = false; return; }
    ativo = true; puxando = false; desloc = 0;
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!ativo || ocupado) return;
    const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
    if (!puxando) {
      if (dy > 10 && dy > Math.abs(dx) * 1.4 && podePuxar()) {
        puxando = true; cheiaAntes = false;
        clearTimeout(fimTimer);
        alvoConteudo = painel().querySelector(':scope > .conteudo');
        if (alvoConteudo) alvoConteudo.style.transition = 'none';
        const el = indicador();
        el.classList.remove('volta', 'estoura', 'girando', 'pronto');
        el.classList.add('mostra');
        rotulo('puxa');
      } else if (dy < -4 || Math.abs(dx) > 14) { ativo = false; return; }
      else return;
    }
    /* resistência: quanto mais puxa, menos anda */
    desloc = 124 * (1 - Math.exp(-Math.max(0, dy - 10) / 140));
    posicionar(desloc, Math.min(1, desloc / LIMIAR));
  }, { passive: true });
  function fim() {
    if (!ativo && !puxando) return;
    ativo = false;
    if (!puxando) return;
    puxando = false;
    if (desloc >= LIMIAR) estourar(); else recolher();
  }
  document.addEventListener('touchend', fim, { passive: true });
  document.addEventListener('touchcancel', fim, { passive: true });
  window.addEventListener('hashchange', abortar);
  document.addEventListener('visibilitychange', () => { if (document.hidden) abortar(); });

  /* ===================================================================
     4. KANBAN COM FÍSICA (zzj)
     No lugar da "foto" padrão do navegador ao arrastar, um cartão de
     verdade segue o cursor e INCLINA conforme a velocidade de lado (como
     segurar um papel), voltando a ficar reto quando a mão para. Ao soltar,
     o cartão no lugar novo "assenta" com mola. Só apresentação: o arrastar
     e o mover continuam sendo os de kanban.js / video.js.
     =================================================================== */
  const IMG_VAZIA = new Image();
  IMG_VAZIA.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  function arrastoFisico(card, e) {
    if (reduz() || !e || !e.dataTransfer || !e.dataTransfer.setDragImage) return null;
    const r = card.getBoundingClientRect();
    const f = card.cloneNode(true);
    f.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    f.removeAttribute('id');
    f.classList.add('b7-arrasto');
    f.classList.remove('arrastando');
    Object.assign(f.style, { width: r.width + 'px', height: r.height + 'px' });
    try { e.dataTransfer.setDragImage(IMG_VAZIA, 0, 0); } catch (er) { return null; }
    const offX = e.clientX - r.left, offY = e.clientY - r.top;
    let ultX = e.clientX, rot = 0, x = r.left, y = r.top;
    const pinta = () => { f.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) rotate(' + rot.toFixed(2) + 'deg) scale(1.04)'; };
    pinta();
    document.body.appendChild(f);
    const segue = ev => {
      if (!ev.clientX && !ev.clientY) return;             /* evento sem coordenada (fim do arrasto) */
      const vx = ev.clientX - ultX; ultX = ev.clientX;
      rot += (Math.max(-14, Math.min(14, vx * 1.5)) - rot) * .3;
      x = ev.clientX - offX; y = ev.clientY - offY;
      pinta();
    };
    document.addEventListener('dragover', segue, true);
    return {
      fim() {
        document.removeEventListener('dragover', segue, true);
        const a = f.animate([{ opacity: 1 }, { opacity: 0, transform: f.style.transform.replace(/scale\([^)]*\)/, 'scale(.92)') }],
          { duration: 180, easing: 'ease-out', fill: 'forwards' });
        a.onfinish = () => f.remove();
        setTimeout(() => f.remove(), 500);
      }
    };
  }
  function assentar(el) {
    if (!el || reduz()) return;
    el.classList.remove('b7-assenta'); void el.offsetWidth; el.classList.add('b7-assenta');
    setTimeout(() => el.classList.remove('b7-assenta'), 750);
  }

  /* ===================================================================
     5. ARRASTAR DE LADO (zzk/zzl) — usado pelo Calendário e pelas
     Publicações do Dia. O elemento devolvido por `alvo()` segue o dedo
     (com resistência); passou de 56 px, chama aoIr(+1 | -1). Gesto
     vertical não é tocado (rolagem e "puxar para atualizar" seguem).
     =================================================================== */
  /* Algo entre o dedo e `limite` rola de lado (carrossel, abas, faixa
     de chips)? Então o gesto é desse elemento, não de "trocar de dia". */
  function rolaDeLado(alvo, limite) {
    for (let n = alvo; n && n !== limite && n.nodeType === 1; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 2) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
    }
    return false;
  }
  /* opcoes.area: seletor — o gesto só vale se começar dentro dele */
  function deslizar(el, alvo, aoIr, opcoes) {
    if (!el || el._deslize) return; el._deslize = true;
    const area = opcoes && opcoes.area;
    let x0 = null, y0 = 0, dx = 0, modo = null, t0 = 0;
    el.addEventListener('touchstart', e => {
      x0 = null; modo = null; dx = 0;
      if (e.touches.length !== 1) { modo = 'nao'; return; }
      const t = e.target;
      if (area && !(t.closest && t.closest(area))) { modo = 'nao'; return; }
      if (t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) { modo = 'nao'; return; }
      if (rolaDeLado(t, el)) { modo = 'nao'; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (modo === 'nao' || x0 === null) return;
      const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
      if (!modo) {
        if (Math.abs(mx) > 14 && Math.abs(mx) > Math.abs(my) * 1.6) modo = 'x';
        else { if (Math.abs(my) > 10) modo = 'nao'; return; }
      }
      dx = mx;
      const a = alvo(); if (!a) return;
      /* resistência suave: anda menos quanto mais longe vai */
      const d = Math.sign(dx) * 90 * (1 - Math.exp(-Math.abs(dx) / 160));
      a.style.transition = 'none';
      a.style.translate = d.toFixed(1) + 'px 0';
      a.style.opacity = String(1 - Math.min(.35, Math.abs(d) / 260));
    }, { passive: true });
    const fim = () => {
      const eraX = modo === 'x';
      /* passou de 64 px, ou foi um "peteleco" rápido de 36 px */
      const rapido = Date.now() - t0 < 260 && Math.abs(dx) > 36;
      const ok = eraX && (Math.abs(dx) > 64 || rapido);
      const a = alvo();
      modo = null; x0 = null;
      if (!a || !eraX) return;
      if (!ok) {
        a.style.transition = 'translate .34s cubic-bezier(.2,.9,.25,1.2), opacity .3s ease';
        a.style.translate = ''; a.style.opacity = '';
        setTimeout(() => { a.style.transition = ''; }, 360);
        return;
      }
      const dir = dx < 0 ? 1 : -1;
      vibrar(6);
      /* o conteúdo atual sai para o lado do gesto; o novo entra do outro */
      let foi = false;
      const ir = () => {
        if (foi) return; foi = true;
        aoIr(dir);
        /* se a troca não redesenhou (ex.: nada a trocar), devolve ao lugar */
        if (a.isConnected) { a.getAnimations().forEach(x => x.cancel()); a.style.translate = ''; a.style.opacity = ''; a.style.transition = ''; }
      };
      if (reduz() || !a.animate) { ir(); return; }
      const ani = a.animate([{ translate: a.style.translate || '0 0', opacity: a.style.opacity || 1 },
                             { translate: (dir > 0 ? -70 : 70) + 'px 0', opacity: 0 }],
        { duration: 140, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
      ani.onfinish = ir;
      setTimeout(ir, 220);
    };
    el.addEventListener('touchend', fim, { passive: true });
    el.addEventListener('touchcancel', fim, { passive: true });
  }
  B7.Movimento = { soltar, voarAbrindo: info => voarAbrindo(info), arrastoFisico, assentar, deslizar };
})();
