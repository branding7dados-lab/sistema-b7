/* =====================================================================
   ABERTURAS "TINTA", "GLITCH", "AURORA", "NEON" e "MOSAICO" (zzz234)
   Pedido do Kevin: "quero 5 novos modelos de abertura".

   Uma tela (canvas) atrás do logo desenha a cena de cada estilo; o logo,
   a palavra e o brilho são o CSS de sempre (styles/abertura.css).
     tinta    gotas de tinta nas cores da marca se abrem na água e giram
              até o centro; 2,3 s o logo nasce da tinta
     glitch   tela de terminal: linhas, faixas quebradas e "B7_SISTEMA"
              digitado; 1,7 s estoura e 1,9 s o logo entra seco
     aurora   céu estrelado; cortinas de aurora nas cores da marca
              ondulam e 1,6 s o logo aparece no meio delas
     neon     o letreiro liga: faíscas e brilho acompanham as piscadas
              do logo (0,6–1,2 s) e a palavra pisca depois
     mosaico  quadrados viram das bordas até o centro (0,2–2,0 s) e
              depois se abrem do centro para fora revelando o logo
   Relógio: o da animação CSS do logo (.ab-marca), como as outras cenas.
   Só na abertura completa e sem "reduzir movimento".
   ===================================================================== */
(function () {
  'use strict';
  window.B7 = window.B7 || {};
  const html = document.documentElement;
  const lim = (x, a, b) => Math.max(a, Math.min(b, x));
  const suave = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const sai = t => 1 - Math.pow(1 - lim(t, 0, 1), 3);
  /* as cores da lâmpada */
  const CORES = [[61, 47, 217], [122, 43, 201], [166, 43, 184], [194, 28, 131], [226, 64, 156], [255, 95, 168], [255, 143, 203], [255, 179, 107]];
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  const ESTILOS = ['tinta', 'glitch', 'aurora', 'neon', 'mosaico'];
  const estilo = () => html.getAttribute('data-ab-estilo');
  const ligada = () => {
    if (ESTILOS.indexOf(estilo()) < 0) return false;
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch (e) {}
    return !!document.createElement('canvas').getContext;
  };

  /* um borrão redondo pronto (desenhado uma vez, depois só drawImage) */
  const bolhas = new Map();
  function bolha(c) {
    const k = c.join(',');
    if (bolhas.has(k)) return bolhas.get(k);
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(.45, rgba(c, .55)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    bolhas.set(k, cv); return cv;
  }

  /* ---------------------------------------------------------- TINTA */
  function tinta(W, H, celular) {
    const N = celular ? 26 : 46;
    const gotas = Array.from({ length: N }, (_, i) => {
      const ang = Math.random() * Math.PI * 2, dist = .25 + Math.random() * .55;
      return { ang, dist, nasce: Math.random() * 1.1, r: (.12 + Math.random() * .22) * Math.max(W, H),
        cor: CORES[i % CORES.length], gira: (Math.random() < .5 ? -1 : 1) * (.6 + Math.random() * .9), a: .35 + Math.random() * .35 };
    });
    return (g, t, cx, cy) => {
      /* tinta mistura (source-over): somar luz estourava tudo em branco */
      g.globalCompositeOperation = 'source-over';
      const junta = suave(lim((t - 1.3) / 1.1, 0, 1));            /* 1,3–2,4 s a tinta gira para o centro */
      const apaga = 1 - suave(lim((t - 2.2) / .9, 0, 1)) * .8;     /* e se dissolve quando o logo nasce */
      for (const p of gotas) {
        const lt = t - p.nasce; if (lt < 0) continue;
        const abre = sai(lt / 1.3);
        const a = p.ang + p.gira * (lt * .35 + junta * 1.6);
        const d = p.dist * (1 - junta * .7) * Math.min(W, H) * .6;
        const r = p.r * (.15 + abre * .85) * (1 - junta * .3);
        g.globalAlpha = p.a * .45 * abre * apaga;
        g.drawImage(bolha(p.cor), cx + Math.cos(a) * d - r, cy + Math.sin(a) * d - r, r * 2, r * 2);
      }
      /* o ponto de luz de onde o logo nasce */
      const nasce = lim((t - 2.0) / .3, 0, 1) * (1 - lim((t - 2.4) / .6, 0, 1));
      if (nasce > 0) { g.globalCompositeOperation = 'lighter'; const R = Math.min(W, H) * .3; g.globalAlpha = nasce * .5; g.drawImage(bolha([255, 200, 235]), cx - R, cy - R, R * 2, R * 2); }
    };
  }

  /* --------------------------------------------------------- GLITCH */
  function glitch(W, H, celular) {
    const TXT = 'B7_SISTEMA';
    const fonte = Math.round(Math.min(W, H) * (celular ? .075 : .06));
    let semente = 7;
    const rnd = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
    return (g, t, cx, cy) => {
      g.globalCompositeOperation = 'source-over';
      const q = Math.floor(t * 24);                                /* o "ruído" muda 24 vezes por segundo */
      semente = 7 + q * 13;
      const vivo = t < 2.1 ? 1 : lim(1 - (t - 2.1) / .5, 0, 1);
      /* linhas de varredura */
      g.globalAlpha = .07 * vivo + .02; g.fillStyle = '#ff5fa8';
      for (let y = (t * 40) % 4; y < H; y += 4) g.fillRect(0, y, W, 1);
      /* texto digitado */
      if (t > .25 && t < 1.9) {
        const n = Math.min(TXT.length, Math.floor((t - .25) / .09));
        const txt = TXT.slice(0, n) + (Math.floor(t * 6) % 2 ? '_' : ' ');
        g.font = '700 ' + fonte + 'px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        const treme = t > 1.35 ? (rnd() - .5) * 14 : 0;
        g.globalAlpha = .9;
        g.fillStyle = 'rgba(40,190,255,.85)'; g.fillText(txt, cx - 3 + treme, cy);
        g.fillStyle = 'rgba(255,40,110,.85)'; g.fillText(txt, cx + 3 + treme, cy);
        g.fillStyle = '#fff'; g.fillText(txt, cx + treme, cy);
      }
      /* faixas quebradas: cada vez mais até o estouro, depois somem */
      const forca = t < 1.7 ? .15 + Math.pow(t / 1.7, 2) * .85 : vivo * .6;
      const nf = Math.round((celular ? 6 : 10) * forca);
      for (let i = 0; i < nf; i++) {
        if (rnd() > .7) continue;
        const y = rnd() * H, h = 2 + rnd() * (H * .05), x = (rnd() - .5) * W * .3;
        g.globalAlpha = (.15 + rnd() * .45) * forca;
        g.fillStyle = rnd() < .5 ? 'rgba(255,40,110,1)' : (rnd() < .5 ? 'rgba(40,190,255,1)' : 'rgba(255,255,255,1)');
        g.fillRect(x, y, W * (.2 + rnd() * .8), h);
      }
      /* o estouro */
      const est = t > 1.65 && t < 2.2 ? Math.max(0, 1 - Math.abs(t - 1.72) / (t < 1.72 ? .07 : .4)) : 0;
      if (est > 0) { g.globalAlpha = est * .85; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); }
    };
  }

  /* --------------------------------------------------------- AURORA */
  function aurora(W, H, celular) {
    const est = Array.from({ length: celular ? 90 : 180 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: .4 + Math.random() * 1.1, f: Math.random() * 6.28 }));
    const COR_C = [[61, 47, 217], [166, 43, 184], [226, 64, 156], [255, 143, 203]];
    /* um sprite vertical por cortina: cor forte embaixo e sumindo para cima */
    const sprites = COR_C.map(c => {
      const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
      const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(.55, rgba(c, .35)); gr.addColorStop(.86, rgba(c, .9)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 4, 256); return cv;
    });
    const passo = celular ? 6 : 5;
    const cortinas = COR_C.map((_, i) => ({ s: sprites[i], base: .2 + i * .045, amp: .06 + Math.random() * .05, k: 1.6 + Math.random() * 1.6, v: .4 + Math.random() * .5, f: Math.random() * 6.28, alt: .3 + Math.random() * .15 }));
    return (g, t) => {
      g.globalCompositeOperation = 'lighter';
      const acende = lim(t / .6, 0, 1);
      g.fillStyle = '#fff';
      for (const s of est) { g.globalAlpha = acende * (.35 + .35 * Math.sin(t * 2 + s.f)); g.fillRect(s.x, s.y, s.r, s.r); }
      const sobe = suave(lim((t - .2) / 1.6, 0, 1));
      const baixa = 1 - lim((t - 1.6) / 1.2, 0, 1) * .4;          /* abre espaço para o logo */
      for (const c of cortinas) {
        const altura = H * c.alt * sobe;
        if (altura < 2) continue;
        for (let x = 0; x < W; x += passo) {
          const u = x / W;
          const onda = Math.sin(u * c.k * 6.28 + t * c.v * 2 + c.f) * c.amp + Math.sin(u * 13 + t * 1.7 + c.f) * .015;
          const base = H * (c.base + onda);
          const brilho = .45 + .55 * Math.max(0, Math.sin(u * 9 - t * 1.4 + c.f));
          g.globalAlpha = sobe * brilho * .55 * baixa;
          g.drawImage(c.s, x, base - altura, passo + 2, altura);
        }
      }
    };
  }

  /* ----------------------------------------------------------- NEON */
  function neon(W, H, celular) {
    /* o mesmo roteiro das piscadas do logo (abNeMarca) */
    const PISCA = [[.6, .64], [.70, .73], [.9, 1.0], [1.2, 99]];
    const aceso = t => PISCA.some(p => t >= p[0] && t < p[1]);
    const fa = [];
    return (g, t, cx, cy) => {
      g.globalCompositeOperation = 'lighter';
      const on = aceso(t);
      /* faíscas a cada vez que acende */
      for (const p of PISCA) if (t >= p[0] && t - p[0] < .02 && !fa.some(f => f.de === p[0])) {
        for (let i = 0; i < (celular ? 14 : 26); i++) {
          const a = Math.random() * 6.28, v = 120 + Math.random() * 380;
          fa.push({ de: p[0], t0: t, x: cx + (Math.random() - .5) * 120, y: cy + (Math.random() - .5) * 40, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120 });
        }
      }
      g.fillStyle = '#ffd9ef';
      for (const f of fa) {
        const lt = t - f.t0; if (lt < 0 || lt > .9) continue;
        g.globalAlpha = 1 - lt / .9;
        g.fillRect(f.x + f.vx * lt, f.y + f.vy * lt + 420 * lt * lt, 2, 2);
      }
      /* o brilho do tubo no ambiente */
      if (on) {
        const R = Math.max(W, H) * .5, oscila = .85 + .15 * Math.sin(t * 40) * (t < 1.4 ? 1 : .2);
        g.globalAlpha = .5 * oscila * (t > 1.2 ? 1 : .7);
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
        gr.addColorStop(0, 'rgba(255,95,168,.55)'); gr.addColorStop(.4, 'rgba(166,43,184,.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(cx - R, cy - R, R * 2, R * 2);
      }
      /* parede de tijolos que o neon ilumina */
      if (t > .6) {
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = (on ? .07 : .02) * lim((t - .6) / .4, 0, 1);
        g.strokeStyle = '#ff8fcb'; g.lineWidth = 1;
        const th = 26, tw = 64;
        g.beginPath();
        for (let y = 0, l = 0; y < H; y += th, l++) {
          g.moveTo(0, y); g.lineTo(W, y);
          for (let x = (l % 2) * tw / 2; x < W; x += tw) { g.moveTo(x, y); g.lineTo(x, y + th); }
        }
        g.stroke();
      }
    };
  }

  /* -------------------------------------------------------- MOSAICO */
  function mosaico(W, H, celular) {
    const lado = celular ? 46 : 64;
    const cols = Math.ceil(W / lado) + 1, lins = Math.ceil(H / lado) + 1;
    const ox = (W - cols * lado) / 2, oy = (H - lins * lado) / 2;
    const tiles = [];
    for (let i = 0; i < cols; i++) for (let j = 0; j < lins; j++) {
      const x = ox + i * lado, y = oy + j * lado;
      const dx = (x + lado / 2 - W / 2) / (W / 2), dy = (y + lado / 2 - H / 2) / (H / 2);
      const d = Math.min(1, Math.hypot(dx, dy) / 1.2);
      tiles.push({ x, y, d, cor: CORES[Math.min(CORES.length - 1, Math.floor((1 - (dx + 1) / 2) * 3 + (dy + 1) * 2.5))] || CORES[0], r: Math.random() });
    }
    return (g, t) => {
      g.globalCompositeOperation = 'source-over';
      for (const p of tiles) {
        /* entra das bordas (0,2 s) até o centro (2,0 s) e sai do centro para fora (2,0–2,6 s) */
        const ent = (t - (.2 + (1 - p.d) * 1.4 + p.r * .2)) / .4;
        const sai_ = (t - (2.0 + p.d * .5 + p.r * .08)) / .3;
        if (ent <= 0 || sai_ >= 1) continue;
        const k = ent < 1 ? sai(ent) : 1 - suave(lim(sai_, 0, 1));
        if (k <= 0) continue;
        const esc = lado * (.9 * k);
        const vira = Math.abs(Math.cos((1 - k) * Math.PI / 2 * (p.r < .5 ? 1 : 0)));
        const w = esc * (ent < 1 ? Math.max(.08, Math.sin(k * Math.PI / 2)) : vira || 1);
        g.globalAlpha = .55 + .45 * k;
        g.fillStyle = rgba(p.cor, .18 + .5 * (1 - p.d));
        g.fillRect(p.x + (lado - w) / 2, p.y + (lado - esc) / 2, w, esc);
        g.globalAlpha = .25 * k; g.fillStyle = '#fff';
        g.fillRect(p.x + (lado - w) / 2, p.y + (lado - esc) / 2, w, 1);
      }
    };
  }

  const CENAS = { tinta, glitch, aurora, neon, mosaico };

  function iniciar(el) {
    if (!el || el.dataset.cena || !ligada()) return;
    if (!el.classList.contains('inicial') || html.classList.contains('ab-curta')) return;
    const qual = estilo();
    el.dataset.cena = qual;
    const marca = el.querySelector('.ab-marca');
    if (!marca) return;
    const inicio = performance.now();
    const relogio = () => {
      const a = marca.getAnimations ? marca.getAnimations()[0] : null;
      return (a && a.currentTime != null ? Number(a.currentTime) : performance.now() - inicio) / 1000;
    };
    const cv = document.createElement('canvas');
    cv.className = 'ab-cena'; cv.setAttribute('aria-hidden', 'true');
    const ceu = el.querySelector('.ab-ceu');
    if (ceu && ceu.nextSibling) el.insertBefore(cv, ceu.nextSibling); else el.appendChild(cv);
    const g = cv.getContext('2d');
    const celular = Math.min(innerWidth, innerHeight) < 600;
    const dpr = Math.min(window.devicePixelRatio || 1, celular ? 1 : 1.25);
    let W = 0, H = 0, cx = 0, cy = 0, desenha = null;
    const medir = () => {
      const r = el.getBoundingClientRect(); W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const p = (el.querySelector('.ab-palco') || el).getBoundingClientRect();
      cx = p.left - r.left + p.width / 2; cy = p.top - r.top + p.height / 2;
      desenha = CENAS[qual](W, H, celular);                      /* a cena se refaz para o tamanho novo */
    };
    medir(); addEventListener('resize', medir);

    let fim = false;
    const parar = () => { if (fim) return; fim = true; removeEventListener('resize', medir); cv.remove(); };
    function quadro() {
      if (fim) return;
      if (!el.isConnected) return parar();
      const t = relogio();
      if (t > 30) return parar();
      g.clearRect(0, 0, W, H);
      try { desenha(g, t, cx, cy); } catch (e) { if (window.B7_DEBUG_ABERTURA) console.error(e); return parar(); }
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
  B7.AberturaCenas = { iniciar, ligada, ESTILOS };
})();
