/* =====================================================================
   ABERTURA "HIPERESPAÇO" — as estrelas e o salto (zzz231)
   Pedido do Kevin: "adiciona mais outro tipo de abertura".

   Um campo de estrelas em 3D, visto de dentro:
     0,0–0,5 s  paradas, acendendo no escuro
     0,5–1,7 s  a nave acelera: cada estrela vira um risco de luz que
                sai do centro, cada vez mais longo; a tela treme
     1,72 s     clarão: o salto
     1,75–2,3 s a saída do salto: os riscos encolhem de volta a pontos
     2,3 s →    as estrelas ficam passando devagar atrás do logo
   Relógio: o da animação CSS do logo (.ab-marca, abHiMarca).
   Só no estilo "hiper", na abertura completa e sem "reduzir movimento".
   ===================================================================== */
(function () {
  'use strict';
  window.B7 = window.B7 || {};
  const html = document.documentElement;
  const ligada = () => {
    if (html.getAttribute('data-ab-estilo') !== 'hiper') return false;
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch (e) {}
    return !!document.createElement('canvas').getContext;
  };
  const lim = (x, a, b) => Math.max(a, Math.min(b, x));
  /* velocidade da nave (profundidades por segundo) em cada instante */
  function vel(t) {
    if (t < .5) return .04;
    if (t < 1.72) { const k = (t - .5) / 1.22; return .04 + Math.pow(k, 3.2) * 9; }
    if (t < 2.3) { const k = (t - 1.72) / .58; return 9 * Math.pow(1 - k, 3) + .05; }
    return .05;
  }
  /* quanto já andou: integral da velocidade, tabelada uma vez (passo de 5 ms) */
  const PASSO = .005, TAB = [0];
  for (let i = 1; i <= 12 / PASSO; i++) TAB.push(TAB[i - 1] + vel((i - .5) * PASSO) * PASSO);
  const andou = t => { const i = Math.min(TAB.length - 1, Math.max(0, Math.floor(t / PASSO))); return TAB[i]; };
  const CORES = ['255,255,255', '255,190,230', '200,170,255', '255,140,200'];

  function iniciar(el) {
    if (!el || el.dataset.hiper || !ligada()) return;
    if (!el.classList.contains('inicial') || html.classList.contains('ab-curta')) return;
    el.dataset.hiper = '1';
    const marca = el.querySelector('.ab-marca');
    if (!marca) return;
    const inicio = performance.now();
    const relogio = () => {
      const a = marca.getAnimations ? marca.getAnimations()[0] : null;
      return (a && a.currentTime != null ? Number(a.currentTime) : performance.now() - inicio) / 1000;
    };
    const cv = document.createElement('canvas');
    cv.className = 'ab-hiper'; cv.setAttribute('aria-hidden', 'true');
    const ceu = el.querySelector('.ab-ceu');
    if (ceu && ceu.nextSibling) el.insertBefore(cv, ceu.nextSibling); else el.appendChild(cv);
    const g = cv.getContext('2d');
    const celular = Math.min(innerWidth, innerHeight) < 600;
    /* zzz232: os riscos são finos, mas 1x no celular basta (2x custava 4x mais) */
    const dpr = Math.min(window.devicePixelRatio || 1, celular ? 1.25 : 1.25);
    let W = 0, H = 0, cx = 0, cy = 0;
    const medir = () => {
      const r = el.getBoundingClientRect(); W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const p = (el.querySelector('.ab-palco') || el).getBoundingClientRect();
      cx = p.left - r.left + p.width / 2; cy = p.top - r.top + p.height / 2;
    };
    medir(); addEventListener('resize', medir);

    const N = celular ? 260 : 460;
    const est = Array.from({ length: N }, (_, i) => ({
      x: (Math.random() * 2 - 1), y: (Math.random() * 2 - 1) * .75, z0: Math.random(),
      cor: CORES[i % 7 === 0 ? 1 + (i % 3) : 0], tam: .6 + Math.random() * 1.2
    }));

    let fim = false;
    const parar = () => { if (fim) return; fim = true; removeEventListener('resize', medir); cv.remove(); };
    function quadro() {
      if (fim) return;
      if (!el.isConnected) return parar();
      const t = relogio();
      if (t > 30) return parar();
      g.clearRect(0, 0, W, H);
      const F = Math.max(W, H) * .5;
      const v = vel(t), d = andou(t);
      /* tremor na aceleração */
      const treme = t > 1.25 && t < 1.85 ? (1 - Math.abs(t - 1.72) / .5) * (celular ? 3 : 5) : 0;
      const ox = treme ? (Math.random() - .5) * treme : 0, oy = treme ? (Math.random() - .5) * treme : 0;
      const acende = lim(t / .5, 0, 1);
      /* brilho do túnel no centro enquanto acelera */
      const tunel = lim((t - .9) / .8, 0, 1) * (t < 1.75 ? 1 : lim(1 - (t - 1.75) / .5, 0, 1));
      g.globalCompositeOperation = 'lighter';
      if (tunel > 0) {
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * .55);
        gr.addColorStop(0, 'rgba(255,160,220,' + (.35 * tunel) + ')'); gr.addColorStop(.35, 'rgba(124,60,210,' + (.18 * tunel) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        const R = Math.max(W, H) * .55;
        g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(cx - R, cy - R, R * 2, R * 2);   /* só onde o brilho existe */
      }
      const rastro = Math.min(.9, v * .07);                     /* comprimento do risco em profundidade */
      g.lineCap = 'round';
      for (const s of est) {
        let z = 1 - ((s.z0 + d) % 1);                         /* 1 = longe, 0 = na câmera */
        z = Math.max(.012, z);
        const z2 = Math.min(1, z + rastro);
        const x1 = cx + ox + s.x / z * F * .55, y1 = cy + oy + s.y / z * F * .55;
        const x2 = cx + ox + s.x / z2 * F * .55, y2 = cy + oy + s.y / z2 * F * .55;
        if ((x1 < -40 || x1 > W + 40 || y1 < -40 || y1 > H + 40) && (x2 < -40 || x2 > W + 40 || y2 < -40 || y2 > H + 40)) continue;
        const perto = 1 - z;
        const a = acende * Math.min(1, .25 + perto * 1.1) * (t > 2.3 ? .7 : 1);
        g.globalAlpha = a;
        g.strokeStyle = 'rgba(' + s.cor + ',1)';
        g.lineWidth = Math.max(.6, s.tam * (.4 + perto * 2.2)) * (v > 1 ? 1.1 : 1);
        g.beginPath(); g.moveTo(x2, y2); g.lineTo(x1 + .01, y1 + .01); g.stroke();
      }
      /* o clarão do salto */
      const clarao = t > 1.6 && t < 2.2 ? Math.max(0, 1 - Math.abs(t - 1.72) / (t < 1.72 ? .12 : .45)) : 0;
      if (clarao > 0) {
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = clarao * .92;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * .8);
        gr.addColorStop(0, '#fff'); gr.addColorStop(.35, 'rgba(255,220,240,.9)'); gr.addColorStop(1, 'rgba(226,64,156,.25)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);
  }

  const inicial = document.getElementById('abertura');
  if (inicial) iniciar(inicial);
  const olhar = () => {
    try {
      new MutationObserver(lista => {
        for (const m of lista) for (const n of m.addedNodes) {
          if (n.nodeType === 1 && n.classList.contains('b7-abertura')) requestAnimationFrame(() => iniciar(n));
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  };
  if (document.body) olhar(); else document.addEventListener('DOMContentLoaded', olhar);
  B7.AberturaHiper = { iniciar, ligada };
})();
