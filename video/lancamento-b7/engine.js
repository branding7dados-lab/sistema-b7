/* Motor do vídeo: tudo é função do tempo t (segundos). Nenhuma animação CSS —
   cada quadro é desenhado por renderAt(t), o que torna a renderização
   determinística quadro a quadro. */
'use strict';
const W = 1080, H = 1920, FPS = 30, DURATION = 62;
const BRAND = '../../assets/brand/';

const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  lin: x => x,
  inC: x => x * x * x,
  inQ: x => x * x * x * x,
  outC: x => 1 - Math.pow(1 - x, 3),
  outQ: x => 1 - Math.pow(1 - x, 5),
  outX: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
  ioC: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  ioQ: x => x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2,
  ioX: x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  outB: x => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  outB2: x => { const c1 = 2.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};
const ep = (t, a, b, e = E.outC) => e(P(t, a, b));
/* sobe e desce: 0 → 1 (entre a e b) → 1 → 0 (entre c e d) */
const env = (t, a, b, c, d, ei = E.outC, eo = E.inC) => Math.min(ep(t, a, b, ei), 1 - ep(t, c, d, eo));

function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* transforma um nó: posição relativa, escala, rotações, opacidade, desfoque */
function T(n, o = {}) {
  if (!n) return;
  const { x = 0, y = 0, s = 1, sx, sy, r = 0, rx = 0, ry = 0, z = 0 } = o;
  n.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotate(${r.toFixed(3)}deg) scale(${(sx ?? s).toFixed(4)},${(sy ?? s).toFixed(4)})`;
  if (o.o !== undefined) { n.style.opacity = clamp(o.o).toFixed(3); n.style.visibility = o.o <= 0.001 ? 'hidden' : 'visible'; }
  if (o.b !== undefined) n.style.filter = o.b > 0.15 ? `blur(${o.b.toFixed(1)}px)` : 'none';
}
const O = (n, o) => { if (!n) return; n.style.opacity = clamp(o).toFixed(3); n.style.visibility = o <= 0.001 ? 'hidden' : 'visible'; };

function mk(parent, html) {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  const n = d.firstElementChild;
  parent.appendChild(n);
  return n;
}
const $ = (root, k) => root.querySelector(`[data-k="${k}"]`);
const $$ = (root, sel) => [...root.querySelectorAll(sel)];

/* ---------------------------------------------------------------- ícones */
const IC = {
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  doc: '<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  video: '<rect x="2.5" y="6" width="14" height="12" rx="2.5"/><path d="m16.5 10.5 5-3v9l-5-3"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  spark: '<path d="M12 2.5l2 5.6 5.5 2-5.5 2-2 5.6-2-5.6-5.5-2 5.5-2z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
  user: '<circle cx="12" cy="8" r="4.5"/><path d="M3.5 21a8.5 8.5 0 0 1 17 0"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  msg: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>',
  chart: '<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  type: '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
  cursor: '<path d="M5 3l6.5 17 2.6-7.2L21 10.2z"/>',
  shape: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><circle cx="17" cy="17" r="4"/><path d="M17 3l4 7h-8z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.3"/><circle cx="12" cy="7.5" r="1.3"/><circle cx="16" cy="10" r="1.3"/><path d="M12 21c-1.5 0-2-1-2-2s1-2 2-2h2a3 3 0 0 0 3-3"/>',
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
  sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
};
const ic = (k, size = 32, color = 'currentColor', sw = 2) =>
  `<span class="ico" style="width:${size}px;height:${size}px;color:${color}"><svg viewBox="0 0 24 24" style="stroke-width:${sw}">${IC[k]}</svg></span>`;

/* ---------------------------------------------------------------- miniaturas
   Miniaturas de conteúdo: gradiente da marca + silhueta com luz de recorte. */
const THEMES = [
  ['#1B1F3B', '#7A2BFF', '#FF2D9B'], ['#0A0B1A', '#3D5BFF', '#7A2BFF'],
  ['#140A26', '#B23BFF', '#FF2D9B'], ['#0A0B1A', '#2A3CC0', '#B23BFF'],
  ['#1B1030', '#FF2D9B', '#7A2BFF'],
];
function thumb({ x = 0, y = 0, w, h, v = 0, play = false, r = 18, k = '', extra = '', sil = true, cx = 50 }) {
  const [a, b, c] = THEMES[v % THEMES.length];
  const id = 'rg' + Math.random().toString(36).slice(2, 8);
  const silhouette = sil ? `<svg class="sil" viewBox="0 0 100 100" preserveAspectRatio="xMidYMax slice">
      <defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="${c}" stop-opacity=".95"/><stop offset=".5" stop-color="${b}" stop-opacity=".0"/><stop offset="1" stop-color="${b}" stop-opacity=".9"/></linearGradient></defs>
      <circle cx="${cx}" cy="44" r="15" fill="#07060F"/><path d="M${cx - 33} 101 C${cx - 31} 74 ${cx - 16} 64 ${cx} 64 C${cx + 16} 64 ${cx + 31} 74 ${cx + 33} 101Z" fill="#07060F"/>
      <circle cx="${cx}" cy="44" r="15" fill="none" stroke="url(#${id})" stroke-width="1.6"/><path d="M${cx - 33} 101 C${cx - 31} 74 ${cx - 16} 64 ${cx} 64 C${cx + 16} 64 ${cx + 31} 74 ${cx + 33} 101" fill="none" stroke="url(#${id})" stroke-width="1.6"/>
    </svg>` : '';
  return `<div class="th" ${k ? `data-k="${k}"` : ''} style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${r}px;
    background:radial-gradient(70% 80% at 20% 15%,${b}cc,transparent 60%),radial-gradient(70% 70% at 90% 90%,${c}aa,transparent 60%),linear-gradient(160deg,${a},#05040C)">
    ${silhouette}${play ? `<div class="play"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg></div>` : ''}${extra}</div>`;
}

/* ---------------------------------------------------------------- títulos
   [texto] vira gradiente da marca. */
function fmt(s) { return s.replace(/\[(.+?)\]/g, '<em class="g gl">$1</em>'); }
function headline(parent, { x = 90, y, lines, size = 100, center = false, k = '', maxW = 900 }) {
  const n = mk(parent, `<div class="hl ${center ? 'c' : ''}" ${k ? `data-k="${k}"` : ''} style="left:${center ? 0 : x}px;top:${y}px;${center ? 'width:1080px;' : ''}font-size:${size}px">
    ${lines.map(l => `<span class="ln"><span>${fmt(l)}</span></span>`).join('')}</div>`);
  n._maxW = maxW;
  HEADLINES.push(n);
  return n;
}
const HEADLINES = [];
function fitHeadlines() {
  for (const n of HEADLINES) {
    let size = parseFloat(n.style.fontSize);
    const spans = $$(n, '.ln>span');
    const widest = () => Math.max(...spans.map(s => s.getBoundingClientRect().width));
    while (widest() > n._maxW && size > 40) { size -= 2; n.style.fontSize = size + 'px'; }
  }
}
/* revela linha a linha (máscara), e opcionalmente sai */
function revealHL(n, t, start, { stagger = .13, dur = .8, out = null, outDur = .45, dy = 0 } = {}) {
  const spans = $$(n, '.ln>span');
  spans.forEach((s, i) => {
    const p = ep(t, start + i * stagger, start + i * stagger + dur, E.outX);
    let y = (1 - p) * 115, o = Math.min(1, p * 1.6), b = 0;
    if (out !== null) {
      const q = ep(t, out + i * .05, out + i * .05 + outDur, E.inC);
      y -= q * 60; o *= 1 - q; b = q * 10;
    }
    s.style.transform = `translateY(${y}%)`;
    s.style.opacity = o.toFixed(3);
    s.style.filter = b > .2 ? `blur(${b}px)` : 'none';
  });
  n.style.transform = `translateY(${dy}px)`;
}
function fadeText(n, t, start, { dur = .6, out = null, outDur = .4, dy = 30 } = {}) {
  const p = ep(t, start, start + dur, E.outC);
  let o = p, y = (1 - p) * dy;
  if (out !== null) { const q = ep(t, out, out + outDur, E.inC); o *= 1 - q; y -= q * 20; }
  T(n, { y, o });
}

/* ---------------------------------------------------------------- marca
   Somente arquivos oficiais de assets/brand/. A "lockup" do vídeo é a variação
   do brand board (símbolo colorido + "Branding7" branco): o símbolo oficial
   colorido ocupa exatamente a caixa do símbolo dentro do logo oficial branco,
   e o restante do logo branco aparece sem nenhuma alteração. */
const IMG = {};
function loadImg(k, src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = rej; i.src = src; });
}
function alphaInfo(img) {
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  return { data: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
}
function bbox(info, x0 = 0, x1 = info.w) {
  let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
  for (let y = 0; y < info.h; y++) for (let x = x0; x < x1; x++) {
    if (info.data[(y * info.w + x) * 4 + 3] > 24) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  }
  return { x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1 };
}
const LOCK = {};
function analyseBrand() {
  const lw = alphaInfo(IMG.logoWhite);
  const cols = [];
  for (let x = 0; x < lw.w; x++) { let any = false; for (let y = 0; y < lw.h; y++) if (lw.data[(y * lw.w + x) * 4 + 3] > 24) { any = true; break; } cols.push(any); }
  // primeiro trecho vazio largo depois do símbolo separa símbolo e palavra
  let first = cols.indexOf(true), gapStart = -1, run = 0;
  for (let x = first; x < lw.w; x++) {
    if (!cols[x]) { run++; if (run >= 12 && gapStart < 0) { gapStart = x - run + 1; } } else { if (gapStart >= 0) { LOCK.wordX = x; break; } run = 0; }
  }
  LOCK.symInWhite = bbox(lw, 0, gapStart);
  LOCK.full = bbox(lw);
  LOCK.lw = { w: lw.w, h: lw.h };
  const sc = alphaInfo(IMG.symbolColor);
  LOCK.symColor = bbox(sc);
  LOCK.sc = { w: sc.w, h: sc.h };
  LOCK.scInfo = sc;
}
/* cria uma lockup com largura w (px na tela); devolve {el, sym, word, rectSym(x,y)} */
function lockup(parent, { w, k = '' }) {
  const s = w / LOCK.full.w; // escala relativa ao recorte do logo branco
  const full = LOCK.full, sw = LOCK.symInWhite, sc = LOCK.symColor;
  const h = full.h * s;
  const el = mk(parent, `<div class="lockup" ${k ? `data-k="${k}"` : ''} style="width:${w}px;height:${h}px;left:0;top:0"></div>`);
  // palavra: logo branco, cortado para mostrar apenas o que vem depois do símbolo
  const word = mk(el, `<div class="a" style="left:0;top:0;width:${w}px;height:${h}px;overflow:hidden"></div>`);
  const wordImg = mk(word, `<img src="${IMG.logoWhite.src}" style="width:${LOCK.lw.w * s}px;height:${LOCK.lw.h * s}px;left:${-full.x * s}px;top:${-full.y * s}px;clip-path:inset(0 0 0 ${LOCK.wordX}px)">`);
  wordImg.style.clipPath = `inset(0 0 0 ${LOCK.wordX * s}px)`;
  // símbolo colorido oficial ajustado à caixa do símbolo no logo
  const k2 = sw.h * s / sc.h;
  const symBox = { x: (sw.x - full.x) * s + (sw.w * s - sc.w * k2) / 2, y: (sw.y - full.y) * s, w: sc.w * k2, h: sc.h * k2 };
  const sym = mk(el, `<img src="${IMG.symbolColor.src}" style="left:${symBox.x - sc.x * k2}px;top:${symBox.y - sc.y * k2}px;width:${LOCK.sc.w * k2}px;height:${LOCK.sc.h * k2}px">`);
  return { el, word, sym, w, h, symBox, wordX: (LOCK.wordX - full.x) * s };
}
/* símbolo colorido sozinho, com a caixa visível (bbox) de largura bw */
function symbol(parent, { bw, k = '' }) {
  const sc = LOCK.symColor, k2 = bw / sc.w;
  const el = mk(parent, `<div class="a" ${k ? `data-k="${k}"` : ''} style="left:0;top:0;width:${sc.w * k2}px;height:${sc.h * k2}px">
    <img src="${IMG.symbolColor.src}" style="position:absolute;left:${-sc.x * k2}px;top:${-sc.y * k2}px;width:${LOCK.sc.w * k2}px;height:${LOCK.sc.h * k2}px"></div>`);
  return { el, w: sc.w * k2, h: sc.h * k2 };
}

/* ---------------------------------------------------------------- partículas do símbolo
   Amostra o símbolo oficial para que as partículas formem exatamente a lâmpada. */
function symbolPoints(rect, step, seed) {
  const r = rng(seed), info = LOCK.scInfo, sc = LOCK.symColor;
  const pts = [];
  const k = rect.w / sc.w;
  const stepSrc = step / k;
  for (let sy = sc.y; sy < sc.y + sc.h; sy += stepSrc) for (let sx = sc.x; sx < sc.x + sc.w; sx += stepSrc) {
    const jx = sx + (r() - .5) * stepSrc * .8, jy = sy + (r() - .5) * stepSrc * .8;
    const ix = Math.round(jx), iy = Math.round(jy);
    if (ix < 0 || iy < 0 || ix >= info.w || iy >= info.h) continue;
    const i = (iy * info.w + ix) * 4;
    if (info.data[i + 3] < 140) continue;
    pts.push({
      tx: rect.x + (jx - sc.x) * k, ty: rect.y + (jy - sc.y) * k,
      c: `rgb(${info.data[i]},${info.data[i + 1]},${info.data[i + 2]})`,
      cr: info.data[i], cg: info.data[i + 1], cb: info.data[i + 2],
      a: r() * Math.PI * 2, d: 140 + Math.pow(r(), .7) * 620, del: r(), sz: 1.6 + r() * 2.4, sp: r(),
    });
  }
  return pts;
}
let DOT = null;
function dotSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
}
const TINTS = {};
function tinted(color) {
  if (TINTS[color]) return TINTS[color];
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.drawImage(DOT, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, 64, 64);
  return TINTS[color] = c;
}
/* desenha partículas do símbolo.
   center: origem; tBurst: início da explosão; tForm: fim da formação; fade: opacidade final */
function drawSymbolParticles(g, pts, t, { cx, cy, t0, t1, t2, alpha = 1 }) {
  g.globalCompositeOperation = 'lighter';
  for (const p of pts) {
    // fase 1: expandem a partir do ponto central para uma nuvem
    const b = ep(t, t0 + p.del * .25, t0 + .55 + p.del * .25, E.outC);
    const swirl = p.a + b * .9;
    const nx = cx + Math.cos(swirl) * p.d * b, ny = cy + Math.sin(swirl) * p.d * b * 1.15;
    // fase 2: convergem para o ponto exato do símbolo
    const f = ep(t, t1 + p.del * .45, t2 - .05 + p.del * .1, E.ioC);
    const x = lerp(nx, p.tx, f), y = lerp(ny, p.ty, f);
    const tw = .65 + .35 * Math.sin(t * 9 + p.sp * 20);
    const size = p.sz * (1 + (1 - f) * 1.2) * 4.2;
    g.globalAlpha = clamp(alpha * Math.min(1, b * 3) * tw);
    const col = f > .5 ? p.c : (p.sp > .5 ? '#7A2BFF' : (p.sp > .2 ? '#3D5BFF' : '#FF2D9B'));
    g.drawImage(tinted(col), x - size / 2, y - size / 2, size, size);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

/* ---------------------------------------------------------------- ambiente */
const AMB = [];
function initAmbient() {
  const r = rng(7), cols = ['#7A2BFF', '#3D5BFF', '#FF2D9B', '#B23BFF', '#9FB1FF'];
  for (let i = 0; i < 120; i++) AMB.push({ x: r() * W, y: r() * H, s: .5 + Math.pow(r(), 2) * 3.2, v: 10 + r() * 34, ph: r() * 6.28, c: cols[i % 5], a: .25 + r() * .6 });
}
function ambientLevel(t) {
  if (t < 4) return .25;
  if (t < 8) return lerp(.25, 0, P(t, 6.8, 7.9));
  if (t < 9) return ep(t, 8.6, 9.6);
  if (t > 56.8 && t < 59.2) return .5;
  return 1;
}
function drawAmbient(g, t) {
  g.clearRect(0, 0, W, H);
  const L = ambientLevel(t);
  if (L <= 0) return;
  g.globalCompositeOperation = 'lighter';
  for (const p of AMB) {
    const y = ((p.y - p.v * t) % (H + 80) + H + 80) % (H + 80) - 40;
    const x = p.x + Math.sin(t * .35 + p.ph) * 24;
    const tw = .55 + .45 * Math.sin(t * 1.7 + p.ph * 3);
    const size = p.s * 9;
    g.globalAlpha = clamp(p.a * tw * L * .8);
    g.drawImage(tinted(p.c), x - size / 2, y - size / 2, size, size);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
/* intensidade das luzes de fundo ao longo do filme */
function bgMood(t) {
  const g1 = document.querySelector('.g1'), g2 = document.querySelector('.g2'), g3 = document.querySelector('.g3');
  let L;
  if (t < 4) L = .22; else if (t < 8.3) L = lerp(.22, 0, P(t, 6.9, 7.9)); else L = ep(t, 8.6, 10.2);
  if (t > 56.8 && t < 59.3) L *= .7;
  const drift = t * .25;
  T(g1, { x: Math.sin(drift) * 80, y: Math.cos(drift * .8) * 60, o: L * .9 });
  T(g2, { x: Math.cos(drift * .9) * 90, y: Math.sin(drift * .7) * 70, o: L * .85 });
  T(g3, { x: Math.sin(drift * 1.3) * 60, y: Math.sin(drift) * 120, o: L * .55 * (t > 43.8 && t < 50.3 ? 1.6 : 1) });
  const grid = document.getElementById('grid');
  O(grid, env(t, 44, 45, 49.6, 50.4) * .9);
  T(grid, { y: (t * 22) % 72, o: env(t, 44, 45, 49.6, 50.4) * .9 });
}
function sweep(t, a, b, alpha = 1) {
  const s = document.querySelector('#sweep div');
  const p = P(t, a, b);
  if (p <= 0 || p >= 1) return false;
  T(s, { x: lerp(-900, 1500, E.ioC(p)), r: 18, o: Math.sin(p * Math.PI) * alpha });
  return true;
}
function flash(t, at, dur = .5, amt = .7) {
  const p = P(t, at, at + dur);
  return p > 0 && p < 1 ? amt * Math.pow(1 - p, 2) * Math.min(1, p * 12) : 0;
}

/* ---------------------------------------------------------------- cenas */
const SCENES = [];
function scene(a, b, build, render) {
  const root = mk(document.getElementById('scenes'), '<div class="L scene"></div>');
  root.style.display = 'none';
  const ctx = { root };
  SCENES.push({ a, b, root, build, render, ctx });
}
/* retângulo de um elemento em coordenadas do palco */
function rectOf(n) { const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
function lerpRect(a, b, p) { return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) }; }
function place(n, r) { n.style.left = r.x + 'px'; n.style.top = r.y + 'px'; n.style.width = r.w + 'px'; n.style.height = r.h + 'px'; }

let FX, AMBG, FLASH, SWEEP_ACTIVE;
function renderAt(t) {
  bgMood(t);
  drawAmbient(AMBG, t);
  FX.clearRect(0, 0, W, H);
  FLASH = 0;
  const sw = document.querySelector('#sweep div'); O(sw, 0);
  for (const s of SCENES) {
    const vis = t >= s.a && t < s.b;
    s.root.style.display = vis ? 'block' : 'none';
    if (vis) s.render(t, s.ctx);
  }
  O(document.getElementById('flash'), FLASH);
  const gr = document.getElementById('grain');
  const f = Math.floor(t * FPS);
  gr.style.backgroundPosition = `${(f * 137) % 512}px ${(f * 251) % 512}px`;
}

async function boot() {
  await Promise.all([
    loadImg('logoWhite', BRAND + 'originais/logo-white.png'),
    loadImg('symbolColor', BRAND + 'originais/symbol-color.png'),
    loadImg('logoColor', BRAND + 'logo-color.png'),
    document.fonts.load('700 100px Poppins'), document.fonts.load('800 100px Poppins'),
    document.fonts.load('600 30px Poppins'), document.fonts.load('500 30px Poppins'), document.fonts.load('400 30px Poppins'),
  ]);
  await document.fonts.ready;
  analyseBrand();
  DOT = dotSprite();
  FX = document.getElementById('fx').getContext('2d');
  AMBG = document.getElementById('amb').getContext('2d');
  initAmbient();
  // grão
  const n = document.createElement('canvas'); n.width = n.height = 512; const g = n.getContext('2d');
  const id = g.createImageData(512, 512); const r = rng(3);
  for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  g.putImageData(id, 0, 0);
  document.getElementById('grain').style.backgroundImage = `url(${n.toDataURL()})`;
  for (const s of SCENES) { s.root.style.display = 'block'; s.build(s.ctx); }
  fitHeadlines();
  for (const s of SCENES) s.root.style.display = 'none';
  // decodifica todas as imagens antes de capturar
  await Promise.all([...document.images].map(i => i.decode().catch(() => { })));
  const q = new URLSearchParams(location.search);
  renderAt(q.has('t') ? parseFloat(q.get('t')) : 0);
  window.READY = true;
}
window.renderAt = renderAt;
window.addEventListener('load', () => boot().catch(e => { window.BOOT_ERROR = String(e && e.stack || e); console.error(e); }));
