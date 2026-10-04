/* Roteiro do vídeo — 14 cenas. Cada cena: scene(início, fim, montar, desenhar). */
'use strict';

/* ================================================================ 01 · O CAOS (0–4s) */
const CH = {
  browser: w => `<div class="ch" style="width:${w}px">
    <div class="bbar"><i></i><i></i><i></i><span class="tab on">Pasta do cliente</span><span class="tab">Planilha</span><span class="tab">+14 abas</span></div>
    <div style="padding:20px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
      ${['final_v3.mp4', 'final_FINAL.mp4', 'arte (2).png', 'briefing.pdf', 'roteiro_v7.docx', 'logo_novo.ai'].map((f, i) =>
        `<div style="background:#1f1d2c;border-radius:12px;padding:14px 12px;font-size:15px;color:#b9b5cc;white-space:nowrap;overflow:hidden">${ic(i % 3 === 0 ? 'video' : i % 3 === 1 ? 'doc' : 'image', 30, '#8f8aa8')}<div style="margin-top:8px">${f}</div></div>`).join('')}
    </div></div>`,
  sheet: w => `<div class="ch" style="width:${w}px">
    <div class="bbar">${ic('sheet', 22, '#9a96ad')}<span style="font-size:17px;color:#cfcbe0">Planilha_Conteudo_v7.xlsx</span></div>
    <div style="padding:14px;display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr;gap:4px;font-size:15px">
      ${['Post', 'Data', 'Status', 'Resp.', 'Reels', '12/10', 'atrasado', '??', 'Carrossel', '13/10', 'ver c/ cliente', 'Ana', 'Stories', '??', 'refazer', '—', 'Vídeo', '15/10', 'aguardando', 'Lu', 'Reels 2', '16/10', 'cadê arquivo?', '??', 'Post', '—', 'atrasado', 'Ana']
        .map((v, i) => `<div style="padding:8px 8px;background:${/atras|refazer|cadê|\?\?/.test(v) ? 'rgba(255,45,155,.18)' : '#1d1b29'};color:${i < 4 ? '#fff' : '#a9a5bd'};border-radius:4px;white-space:nowrap;overflow:hidden">${v}</div>`).join('')}
    </div></div>`,
  chat: w => `<div class="ch" style="width:${w}px">
    <div class="bbar" style="height:64px">${ic('msg', 28, '#9a96ad')}<div><div style="font-size:18px;font-weight:600">Grupo Cliente + Equipe</div><div style="font-size:14px;color:#8f8aa8">86 mensagens não lidas</div></div></div>
    <div style="padding:16px;display:flex;flex-direction:column;gap:10px;font-size:18px">
      <div style="align-self:flex-start;background:#2a2838;padding:12px 16px;border-radius:16px 16px 16px 4px">Cadê o vídeo de ontem?</div>
      <div style="align-self:flex-end;background:#3a2f5c;padding:12px 16px;border-radius:16px 16px 4px 16px">Qual é a versão final?</div>
      <div style="align-self:flex-start;background:#2a2838;padding:12px 16px;border-radius:16px 16px 16px 4px">Mudei de ideia sobre a arte…</div>
    </div></div>`,
  cal: w => `<div class="ch" style="width:${w}px;padding:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:20px;font-weight:600;margin-bottom:12px">Outubro<span style="font-size:14px;color:#ff7ab8;background:rgba(255,45,155,.16);padding:4px 10px;border-radius:8px">3 conflitos</span></div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px">${Array.from({ length: 35 }, (_, i) =>
      `<div style="height:34px;border-radius:6px;background:#1f1d2c;position:relative">${[4, 9, 10, 17, 23, 24, 30].includes(i) ? `<i style="position:absolute;left:6px;bottom:6px;width:9px;height:9px;border-radius:50%;background:${i % 2 ? '#ff4fa8' : '#8f6bff'}"></i>` : ''}</div>`).join('')}</div></div>`,
  video: w => `<div class="ch" style="width:${w}px;padding:14px">
    ${thumb({ w: w - 28, h: (w - 28) * .56, v: 1, play: true }).replace('class="th"', 'class="th" style="position:relative"').replace('style="left:0px;top:0px;', 'style="position:relative;')}
    <div style="height:6px;background:#2a2838;border-radius:3px;margin:14px 0 10px"><div style="width:38%;height:100%;background:#8f6bff;border-radius:3px"></div></div>
    <div style="font-size:17px;color:#cfcbe0">video_bruto_FINAL2.mp4</div></div>`,
  post: w => `<div class="ch" style="width:${w}px;padding:14px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><i style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#7A2BFF,#FF2D9B);display:block"></i><span style="font-size:17px;font-weight:600">@cliente.oficial</span></div>
    ${thumb({ w: w - 28, h: w - 28, v: 2 }).replace('style="left:0px;top:0px;', 'style="position:relative;')}
    <div style="font-size:16px;color:#a9a5bd;margin-top:10px">♥ 1.204 · 86 comentários</div></div>`,
  approval: w => `<div class="ch" style="width:${w}px;padding:20px;display:flex;gap:16px;align-items:center">
    <div style="width:60px;height:60px;border-radius:16px;background:rgba(255,45,155,.16);display:flex;align-items:center;justify-content:center;flex:none">${ic('clock', 32, '#ff7ab8')}</div>
    <div><div style="font-size:21px;font-weight:600">Aprovação pendente</div><div style="font-size:16px;color:#a9a5bd">Arte do carrossel · há 4 dias</div></div></div>`,
  files: w => `<div class="ch" style="width:${w}px;padding:12px">${['briefing (1).pdf', 'briefing_novo (2).pdf', 'briefing_FINAL.pdf', 'briefing_FINAL_ok.pdf'].map(f =>
    `<div style="display:flex;gap:12px;align-items:center;padding:10px;border-radius:10px;font-size:17px;color:#cfcbe0">${ic('doc', 26, '#8f8aa8')}${f}</div>`).join('')}</div>`,
};
const TOASTS = [
  ['msg', '#8f6bff', 'Nova mensagem', 'Cliente: "e aquele vídeo?"'],
  ['alert', '#ff4fa8', 'Prazo vence hoje', 'Carrossel · Studio Aurora'],
  ['folder', '#8f8aa8', 'Arquivo não encontrado', 'arte_final_v2.png'],
  ['bell', '#ffb35c', '12 notificações', 'em 4 aplicativos'],
  ['clock', '#ff4fa8', 'Reunião em 5 min', 'Alinhamento de pauta'],
  ['msg', '#8f6bff', '3 mensagens', 'Grupo Cliente + Equipe'],
  ['alert', '#ff4fa8', 'Tarefa atrasada', 'Roteiro do Reels'],
  ['doc', '#8f8aa8', 'Nova versão enviada', 'roteiro_v8_FINAL.docx'],
  ['bell', '#ffb35c', 'Aprovação?', 'Cliente ainda não respondeu'],
  ['msg', '#8f6bff', 'Mensagem de voz', '2:47 · Cliente'],
];
function toastHTML([i, col, a, b]) {
  return `<div class="toast" style="left:0;top:0"><div class="tic" style="background:${col}22;color:${col}">${ic(i, 30, col)}</div><div><b>${a}</b><span>${b}</span></div></div>`;
}

function buildChaos(parent, seed, density = 1) {
  const r = rng(seed), items = [];
  const kinds = ['browser', 'chat', 'sheet', 'video', 'cal', 'post', 'approval', 'files'];
  const widths = { browser: 540, chat: 430, sheet: 480, video: 440, cal: 380, post: 340, approval: 430, files: 380 };
  let n = 0;
  for (let row = 0; row < 8; row++) for (let col = 0; col < 3; col++) {
    if (r() > density) continue;
    const k = kinds[(row * 3 + col + Math.floor(r() * 3)) % kinds.length];
    const w = widths[k] * (.9 + r() * .2);
    const node = mk(parent, `<div class="a" style="left:0;top:0">${CH[k](Math.round(w))}</div>`);
    const cx = 180 + col * 360 + (r() - .5) * 200, cy = 110 + row * 245 + (r() - .5) * 140;
    items.push({ node, cx, cy, w, z: r(), r0: (r() - .5) * 14, ph: r() * 6.28, kind: k, order: r() });
    n++;
  }
  [...TOASTS, ...TOASTS.slice(0, 6)].forEach((d, i, all) => {
    const node = mk(parent, `<div class="a" style="left:0;top:0">${toastHTML(d)}</div>`);
    items.push({ node, cx: 160 + r() * 760, cy: 160 + r() * 1600, w: 440, z: .65 + r() * .35, r0: (r() - .5) * 8, ph: r() * 6.28, kind: 'toast', order: .4 + i / all.length * .6 });
  });
  items.sort((a, b) => a.order - b.order);
  items.forEach((it, i) => { it.ts = .2 + 3.3 * Math.pow(i / items.length, .62); it.node.style.zIndex = Math.round(it.z * 100) + (it.kind === 'toast' ? 100 : 0); });
  return items;
}
function drawChaos(items, t, { boost = 0, explode = 0, freezeAt = 99, alpha = 1, sat = 1 } = {}) {
  const tf = Math.min(t, freezeAt);
  for (const it of items) {
    const p = ep(tf, it.ts, it.ts + .38, E.outB2);
    if (tf < it.ts) { O(it.node, 0); continue; }
    const depthS = .72 + it.z * .52;
    const shake = (ep(tf, 2.3, 4.1, E.inC) + boost) * 12;
    let x = it.cx + Math.sin(tf * .9 + it.ph) * 16 * (1 + tf * .5) + Math.sin(tf * 43 + it.ph * 9) * shake;
    let y = it.cy + Math.cos(tf * .7 + it.ph) * 14 - tf * 10 * it.z + Math.cos(tf * 37 + it.ph * 5) * shake;
    let b = (1 - it.z) * 3.2;
    let o = (.42 + it.z * .58) * Math.min(1, p * 2.2) * alpha;
    if (explode > 0) {
      const dx = x - 540, dy = y - 960, d = Math.hypot(dx, dy) || 1;
      x += dx / d * explode * 1100; y += dy / d * explode * 1100;
      b += explode * 24; o *= 1 - explode;
    }
    const w = it.w;
    T(it.node, { x: x - w / 2, y: y - 110, s: lerp(.6, 1, p) * depthS, r: it.r0 + Math.sin(tf * 1.1 + it.ph) * 2.5 * (tf / 4), o, b });
    if (sat < 1) it.node.style.filter = `${b > .15 ? `blur(${b.toFixed(1)}px) ` : ''}saturate(${sat})`;
  }
}

scene(0, 4.75, c => {
  const R = c.root;
  c.cam = mk(R, '<div class="L cam"></div>');
  c.items = buildChaos(c.cam, 11, 1);
  c.scrim = mk(R, '<div class="a" style="left:0;top:1060px;width:1080px;height:860px;background:linear-gradient(180deg,rgba(4,3,10,0),rgba(4,3,10,.82) 24%,rgba(4,3,10,.94) 60%)"></div>');
  c.hl = headline(R, { y: 1190, lines: ['Produzir conteúdo', 'não deveria ser', 'um [caos.]'], size: 92 });
  c.em = c.hl.querySelector('em');
}, (t, c) => {
  const push = E.inC(P(t, 0, 4.4));
  const explode = ep(t, 4.0, 4.6, E.inC);
  T(c.cam, { s: 1 + push * .24 + explode * .2, y: lerp(70, -90, P(t, 0, 4.4)), o: ep(t, 0, .9, E.outC) });
  drawChaos(c.items, t, { explode });
  O(c.scrim, ep(t, .7, 1.4) * (1 - ep(t, 4.0, 4.5)));
  revealHL(c.hl, t, 1.0, { stagger: .2, dur: .8, out: 3.95 });
  const pulse = ep(t, 1.6, 2.4) * (.7 + .3 * Math.sin(t * 7)) + ep(t, 2.8, 3.8) * .6;
  c.em.style.filter = `drop-shadow(0 0 ${(14 + pulse * 26).toFixed(1)}px rgba(200,70,255,${(.35 + pulse * .35).toFixed(2)}))`;
});

/* ================================================================ 02 · O PROBLEMA (4–8s) */
scene(3.9, 8.25, c => {
  const R = c.root;
  c.cam = mk(R, '<div class="L cam persp"></div>');
  const data = [['doc', 'Briefing em um lugar.'], ['cal', 'Calendário em outro.'], ['folder', 'Arquivos espalhados.'], ['check', 'Aprovações perdidas.']];
  c.cards = data.map(([i, txt], k) => mk(c.cam, `<div class="glass" style="left:100px;top:${600 + k * 230 - 85}px;width:880px;height:170px;border-radius:32px;display:flex;align-items:center;padding:0 40px;gap:34px;${k === 3 ? 'border-color:rgba(255,45,155,.45)' : ''}">
      <div style="width:100px;height:100px;border-radius:26px;flex:none;background:rgba(122,43,255,.16);border:1.5px solid rgba(122,43,255,.4);display:flex;align-items:center;justify-content:center">${ic(i, 50, '#C4A4FF')}</div>
      <div style="font-size:50px;font-weight:600;letter-spacing:-.02em;white-space:nowrap">${txt}</div>
      <div style="position:absolute;right:38px;top:50%;margin-top:-24px;width:48px;height:48px;border-radius:50%;background:rgba(255,45,155,.16);border:1.5px solid rgba(255,45,155,.5);color:#FF6FB5;font-weight:700;font-size:28px;display:flex;align-items:center;justify-content:center">!</div>
    </div>`));
  c.warn = mk(c.cam, `<div class="toast" style="left:560px;top:1460px;border-color:rgba(255,45,155,.5)"><div class="tic" style="background:rgba(255,45,155,.16);color:#FF6FB5">${ic('alert', 30, '#FF6FB5')}</div><div><b>Tarefas atrasadas.</b><span>4 conteúdos sem dono</span></div></div>`);
  c.lbl = mk(R, `<div class="a lbl" style="left:100px;top:420px">O problema</div>`);
}, (t, c) => {
  const tf = Math.min(t, 7.0);
  const spread = ep(t, 6.2, 7.0, E.ioC);
  const tension = P(t, 7.0, 7.85);
  const out = ep(t, 7.8, 8.2, E.inC);
  T(c.cam, { s: 1 + tension * .03 - out * .05, o: 1 - out });
  c.cards.forEach((n, i) => {
    const p = ep(t, 4.2 + i * .17, 4.95 + i * .17, E.outQ);
    const cy = 600 + i * 230;
    const bob = Math.sin(tf * 1.7 + i * 1.3) * 9;
    const dx = [-70, 80, -60, 70][i] * spread, dy = (cy - 945) * .3 * spread;
    T(n, { x: dx + (1 - p) * (540 - 540), y: bob + dy + (1 - p) * (960 - cy) * .9, s: lerp(.45, 1, p), rx: (1 - p) * 50, r: [-3, 2.5, -2, 3][i] * spread + Math.sin(tf * 1.3 + i) * .5, o: Math.min(1, p * 1.8), b: (1 - p) * 16 });
  });
  const w = ep(t, 5.9, 6.4, E.outB);
  T(c.warn, { y: (1 - w) * 40 + spread * 90 + Math.sin(tf * 2) * 6, x: spread * 40, s: lerp(.8, 1, w), o: w });
  fadeText(c.lbl, t, 4.4, { out: 7.7 });
  // momento de silêncio: o quadro congela e escurece
  O(c.cam, (1 - out) * (1 - tension * .25));
});

/* ================================================================ 03 · SURGE O B7 (8–12s) */
scene(8.0, 12.75, c => {
  const R = c.root;
  c.big = symbol(R, { bw: 440 });
  c.bigRect = { x: 540 - c.big.w / 2, y: 800 - c.big.h / 2, w: c.big.w, h: c.big.h };
  c.big.el.style.left = c.bigRect.x + 'px'; c.big.el.style.top = c.bigRect.y + 'px';
  c.big.el.style.transformOrigin = '0 0';
  c.lock = lockup(R, { w: 840 });
  c.lockPos = { x: 540 - c.lock.w / 2, y: 830 - c.lock.h / 2 };
  c.lock.el.style.left = c.lockPos.x + 'px'; c.lock.el.style.top = c.lockPos.y + 'px';
  O(c.lock.sym, 0);
  c.halo = mk(R, `<div class="a" style="left:140px;top:400px;width:800px;height:800px;border-radius:50%;background:radial-gradient(circle,rgba(122,43,255,.45),rgba(61,91,255,.15) 45%,rgba(0,0,0,0) 70%)"></div>`);
  R.insertBefore(c.halo, R.firstChild);
  c.hl = headline(R, { y: 1090, lines: ['Uma nova forma de', '[operar conteúdo.]'], size: 72, center: true });
  c.pts = symbolPoints(c.bigRect, 7, 21);
}, (t, c) => {
  const cx = 540, cy = 800;
  // o ponto de luz
  if (t < 9.3) {
    const a = ep(t, 8.25, 8.6) * (1 - ep(t, 8.95, 9.2));
    const s = (6 + ep(t, 8.25, 8.9, E.outC) * 40 + Math.sin(t * 18) * 4) * (1 + ep(t, 8.85, 9.0) * 2);
    FX.globalCompositeOperation = 'lighter';
    FX.globalAlpha = a; FX.drawImage(tinted('#B23BFF'), cx - s * 3, cy - s * 3, s * 6, s * 6);
    FX.globalAlpha = a; FX.drawImage(tinted('#ffffff'), cx - s / 2, cy - s / 2, s, s);
    FX.globalAlpha = 1; FX.globalCompositeOperation = 'source-over';
  }
  const pa = 1 - ep(t, 10.2, 10.6);
  if (t > 8.85 && pa > 0) drawSymbolParticles(FX, c.pts, t, { cx, cy, t0: 8.9, t1: 9.3, t2: 10.3, alpha: pa });
  FLASH = Math.max(FLASH, flash(t, 10.22, .7, .55));
  // símbolo oficial
  const img = ep(t, 10.12, 10.45);
  const m = ep(t, 10.75, 11.35, E.ioQ);
  const L = c.lockPos, sb = c.lock.symBox, br = c.bigRect;
  const k = lerp(1, sb.w / br.w, m);
  const x = lerp(br.x, L.x + sb.x, m) - br.x, y = lerp(br.y, L.y + sb.y, m) - br.y;
  const out = ep(t, 12.05, 12.7, E.inC);
  T(c.big.el, { x, y, s: k * (1 + (1 - ep(t, 10.1, 10.8)) * .03), o: img });
  T(c.halo, { s: .6 + ep(t, 9.6, 10.6) * .5 + Math.sin(t * 2) * .03, o: ep(t, 9.6, 10.5) * .9 * (1 - ep(t, 10.8, 11.6)) + ep(t, 10.8, 11.6) * .35, x: lerp(0, (L.x + sb.x + sb.w / 2) - 540, m) * .6 });
  // palavra "Branding7" revelada por máscara
  const wp = ep(t, 10.95, 11.6, E.ioC);
  const ww = c.lock.w;
  c.lock.word.style.clipPath = `inset(-10px ${((ww - c.lock.wordX) * (1 - wp)).toFixed(1)}px -10px 0)`;
  T(c.lock.word, { x: (1 - wp) * -30, o: Math.min(1, wp * 2) });
  revealHL(c.hl, t, 11.25, { stagger: .14, dur: .8, out: 11.95, outDur: .3 });
  if (t > 11.3 && t < 12.2) sweep(t, 11.3, 12.2, .8);
  // mergulho para dentro do sistema
  const ox = L.x + sb.x + sb.w * .55, oy = L.y + sb.y + sb.h * .42;
  c.root.style.transformOrigin = `${ox}px ${oy}px`;
  T(c.root, { s: 1 + out * 5, o: 1 - ep(t, 12.3, 12.7), b: out * 10 });
});

/* ================================================================ 04 · CENTRAL DE OPERAÇÃO (12–16s) */
function sparkline(col, seed) {
  const r = rng(seed); let d = 'M0 40'; let y = 40;
  for (let i = 1; i <= 8; i++) { y = clamp(y - 3 - r() * 8 + r() * 6, 6, 52); d += ` L${i * 18} ${y.toFixed(1)}`; }
  return `<svg width="150" height="60" viewBox="0 0 150 60" style="position:absolute;right:26px;top:30px"><path d="${d}" fill="none" stroke="${col}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
scene(12.0, 16.6, c => {
  const R = c.root;
  c.cam = mk(R, '<div class="L cam persp"></div>');
  c.app = mk(c.cam, `<div class="glass" style="left:70px;top:600px;width:940px;height:1400px;border-radius:44px;overflow:hidden"></div>`);
  const A = c.app;
  mk(A, `<div class="a" style="left:0;top:0;width:940px;height:110px;border-bottom:1.5px solid rgba(255,255,255,.06)"></div>`);
  const lw = 230, lh = lw * LOCK.full.h / LOCK.full.w;
  mk(A, `<div class="a" style="left:40px;top:${55 - lh / 2}px;width:${lw}px;height:${lh}px;overflow:hidden"><img style="position:absolute;width:${LOCK.lw.w * lw / LOCK.full.w}px;left:${-LOCK.full.x * lw / LOCK.full.w}px;top:${-LOCK.full.y * lw / LOCK.full.w}px" src="${IMG.logoWhite.src}"></div>`);
  mk(A, `<div class="a" style="left:610px;top:30px;width:50px;height:50px;color:#cfc7ff">${ic('search', 34)}</div>`);
  mk(A, `<div class="a" style="left:690px;top:30px;width:50px;height:50px;color:#cfc7ff">${ic('bell', 34)}<i style="position:absolute;right:6px;top:4px;width:12px;height:12px;border-radius:50%;background:#FF2D9B"></i></div>`);
  mk(A, `<div class="a" style="left:780px;top:22px;width:66px;height:66px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:24px">B7</div>`);
  mk(A, `<div class="a" style="left:40px;top:150px;font-size:58px;font-weight:700;letter-spacing:-.02em">Olá, equipe.</div>`);
  mk(A, `<div class="a t-sub" style="left:40px;top:232px;font-size:27px">Aqui está o resumo da sua operação.</div>`);
  const M = [['12', 'Projetos ativos', 'folder', '#7A2BFF'], ['48', 'Conteúdos no mês', 'grid', '#3D5BFF'], ['7', 'Em aprovação', 'check', '#FF2D9B'], ['3', 'Clientes ativos', 'users', '#B23BFF']];
  c.metrics = M.map(([v, l, i, col], k) => {
    const x = 40 + (k % 2) * 440, y = 300 + Math.floor(k / 2) * 236;
    const n = mk(A, `<div class="card" style="left:${x}px;top:${y}px;width:420px;height:212px">
      <div class="chip-ico" style="left:26px;top:26px;width:62px;height:62px;background:${col}26;color:${col}">${ic(i, 32, col)}</div>
      ${sparkline(col, k + 3)}
      <div class="a" data-k="v" style="left:26px;top:100px;font-size:72px;font-weight:700;letter-spacing:-.02em;line-height:1">${v}</div>
      <div class="a t-sub" style="left:26px;top:172px;font-size:22px">${l}</div></div>`);
    n._v = +v; return n;
  });
  mk(A, `<div class="a" style="left:40px;top:806px;font-size:32px;font-weight:600">Próximos conteúdos</div><div class="a" style="left:720px;top:812px;font-size:24px;color:#B98CFF;font-weight:600">Ver todos</div>`);
  mk(A, `<div class="a" style="left:720px;top:812px;font-size:24px;color:#B98CFF;font-weight:600">Ver todos →</div>`);
  const ROWS = [['Reels Instagram', 'Hoje · 10:00', 'Em produção', 'p-roxo', 0], ['Post Carrossel', 'Hoje · 14:00', 'Em aprovação', 'p-mag', 2], ['Vídeo YouTube', 'Amanhã · 09:00', 'Agendado', 'p-azul', 1], ['Stories Bastidores', 'Qui · 18:00', 'Roteiro', 'p-roxo', 4]];
  c.rows = ROWS.map(([a, b, p, cl, v], k) => mk(A, `<div class="card" style="left:40px;top:${870 + k * 124}px;width:860px;height:108px">
      ${thumb({ x: 16, y: 14, w: 80, h: 80, v, r: 16 })}
      <div class="a t-title" style="left:118px;top:16px;font-size:29px">${a}</div>
      <div class="a t-sub" style="left:118px;top:58px">${b}</div>
      <div class="a" style="right:22px;top:30px"><span class="pill ${cl}" data-k="pill">${p}</span></div></div>`));
  c.pill0 = $(c.rows[0], 'pill');
  c.scrim = mk(R, '<div class="scrim-top" style="height:640px"></div>');
  c.hl = headline(R, { y: 270, lines: ['Tudo conectado', '[em um só lugar.]'], size: 96 });
}, (t, c) => {
  const inn = ep(t, 12.15, 13.2, E.outQ);
  const zoom = ep(t, 13.9, 14.9, E.ioC), pan = ep(t, 14.9, 15.9, E.ioC), out = ep(t, 15.95, 16.55, E.inC);
  T(c.cam, {
    s: lerp(.55, .86, inn) + zoom * .26 - pan * .08,
    y: lerp(320, 60, inn) - zoom * 30 - pan * 470 - out * 1500,
    rx: (1 - inn) * 32, o: Math.min(1, inn * 1.6), b: (1 - inn) * 14 + out * 18,
  });
  c.metrics.forEach((n, k) => {
    const p = ep(t, 12.7 + k * .1, 13.5 + k * .1, E.outQ);
    T(n, { y: (1 - p) * 50, o: p });
    const cnt = ep(t, 12.9 + k * .1, 14.0 + k * .1, E.outC);
    let v = Math.round(n._v * cnt);
    if (k === 1 && t > 15.3) v = 49;
    $(n, 'v').textContent = v;
    $(n, 'v').style.color = k === 1 && t > 15.3 ? (t < 15.8 ? '#FF8CC6' : '#fff') : '#fff';
  });
  c.rows.forEach((n, k) => { const p = ep(t, 13.2 + k * .12, 13.9 + k * .12, E.outQ); T(n, { x: (1 - p) * 80, o: p }); });
  const sw = t > 15.25;
  c.pill0.textContent = sw ? 'Em edição' : 'Em produção';
  c.pill0.className = 'pill ' + (sw ? 'p-azul' : 'p-roxo');
  T(c.pill0, { s: 1 + flash(t, 15.25, .4, .15) });
  O(c.scrim, 1 - out);
  revealHL(c.hl, t, 12.9, { out: 15.85 });
});

/* ================================================================ 05 · PLANEJAMENTO (16–20s) */
const TYPES = { REELS: '#8E4BFF', CARROSSEL: '#FF2D9B', STORIES: '#C04BFF', 'VÍDEO': '#4D6BFF' };
function chipHTML(type, time, title, v) {
  const col = TYPES[type];
  return `<div class="a" style="left:0;top:0;width:350px;height:124px;border-radius:22px;background:linear-gradient(110deg,${col}38,${col}12);border:1.5px solid ${col}88;box-shadow:0 16px 40px rgba(0,0,0,.4);overflow:hidden">
    <div class="a" style="left:0;top:0;width:8px;height:124px;background:${col}"></div>
    <div class="a" style="left:28px;top:18px;font-size:22px;font-weight:700;letter-spacing:.12em;color:${col === '#4D6BFF' ? '#A5B5FF' : '#fff'}">${type}</div>
    <div class="a" style="left:28px;top:52px;font-size:22px;color:rgba(255,255,255,.85);font-weight:500">${title}</div>
    <div class="a" style="left:28px;top:84px;font-size:20px;color:rgba(255,255,255,.55)">${time}</div>
    ${thumb({ x: 252, y: 14, w: 84, h: 96, v, r: 14 })}</div>`;
}
scene(15.9, 20.95, c => {
  const R = c.root;
  c.cam = mk(R, '<div class="L cam persp"></div>');
  c.panel = mk(c.cam, `<div class="glass" style="left:70px;top:700px;width:940px;height:1140px;border-radius:40px"></div>`);
  const Pn = c.panel;
  mk(Pn, `<div class="chip-ico" style="left:36px;top:34px;width:64px;height:64px;background:rgba(122,43,255,.22);color:#C4A4FF">${ic('cal', 34)}</div>`);
  mk(Pn, `<div class="a" style="left:120px;top:30px;font-size:38px;font-weight:700">Calendário</div><div class="a t-sub" style="left:120px;top:78px">Outubro 2026</div>`);
  mk(Pn, `<div class="a t-sub" style="left:120px;top:78px">Outubro 2026</div>`);
  mk(Pn, `<div class="a" style="left:560px;top:38px;width:350px;height:60px;border-radius:30px;background:rgba(255,255,255,.06);display:flex;align-items:center;padding:5px;font-size:22px;font-weight:600">
     <div style="flex:1;height:50px;border-radius:25px;background:var(--grad);display:flex;align-items:center;justify-content:center">Semana</div>
     <div style="flex:1;text-align:center;color:var(--muted)">Mês</div><div style="flex:1;text-align:center;color:var(--muted)">Lista</div></div>`);
  const days = [['SEG', '12'], ['TER', '13'], ['QUA', '14'], ['QUI', '15'], ['SEX', '16']];
  days.forEach(([d, n], i) => {
    const y = 140 + i * 196;
    mk(Pn, `<div class="a" style="left:36px;top:${y}px;width:868px;height:180px;border-top:1.5px solid rgba(255,255,255,.06)"></div>`);
    mk(Pn, `<div class="a" style="left:40px;top:${y + 34}px;width:100px;text-align:center"><div class="lbl" style="font-size:20px">${d}</div><div style="font-size:50px;font-weight:700;line-height:1.1">${n}</div></div>`);
  });
  mk(Pn, `<div class="a" style="left:40px;top:${140 + 2 * 196 + 30}px;width:100px;height:110px;border-radius:20px;border:2px solid rgba(178,59,255,.6);box-shadow:0 0 30px rgba(178,59,255,.35)"></div>`);
  const CHIPS = [[0, 0, 'REELS', '10:00', 'Lançamento', 0], [1, 1, 'CARROSSEL', '18:00', 'Estratégia', 2], [2, 0, 'STORIES', '15:00', 'Bastidores', 4], [2, 1, 'VÍDEO', '18:00', 'Entrevista', 1], [3, 0, 'REELS', '12:00', 'Dica rápida', 3], [4, 1, 'CARROSSEL', '10:00', '5 erros', 0], [1, 0, 'STORIES', '09:00', 'Enquete', 2]];
  c.chips = CHIPS.map(([d, s, ty, tm, ti, v], i) => {
    const n = mk(Pn, chipHTML(ty, tm, ti, v));
    n._to = { x: 170 + s * 370, y: 140 + d * 196 + 28 };
    n._from = { x: 300 + (i % 3) * 120 - 120, y: 1300 + i * 40 };
    n._t = 17.05 + i * .24;
    n.style.left = n._to.x + 'px'; n.style.top = n._to.y + 'px';
    return n;
  });
  c.first = c.chips[0];
  c.hl = headline(R, { y: 230, lines: ['Planeje.', '[Organize.]', '[Execute.]'], size: 112 });
  c.sub = mk(R, `<div class="sub" style="left:92px;top:600px;font-size:36px">Linha editorial, calendário e conteúdo.</div>`);
}, (t, c) => {
  const inn = ep(t, 15.95, 16.8, E.outQ);
  const out = ep(t, 20.0, 20.6, E.ioC);
  T(c.cam, { y: (1 - inn) * 1300 - P(t, 16.5, 20.5) * 40, rx: (1 - inn) * -10 + 4 * (1 - P(t, 16, 20)), o: 1, b: (1 - inn) * 14 });
  T(c.panel, { s: 1 - out * .05, o: 1 - out * .85, b: out * 6 });
  c.chips.forEach((n, i) => {
    const p = ep(t, n._t, n._t + .65, E.outQ);
    const land = flash(t, n._t + .5, .5, 1);
    const x = lerp(n._from.x - n._to.x, 0, p), y = lerp(n._from.y - n._to.y, 0, p);
    T(n, { x, y, s: lerp(.8, 1, p) + land * .04, r: (1 - p) * (i % 2 ? 8 : -8), o: Math.min(1, p * 3) * (n === c.first ? 1 : 1 - out) });
    n.style.boxShadow = `0 16px 40px rgba(0,0,0,.4), 0 0 ${(land * 40).toFixed(0)}px rgba(178,59,255,${(land * .8).toFixed(2)})`;
  });
  // o primeiro card fica visível até virar a tela de produção
  O(c.first, t > 20.25 ? 0 : 1);
  revealHL(c.hl, t, 16.35, { stagger: .45, dur: .8, out: 19.95 });
  fadeText(c.sub, t, 18.3, { out: 19.95 });
});

/* ================================================================ 06 · PRODUÇÃO (20–26s) */
scene(19.95, 26.55, c => {
  const R = c.root;
  c.cam = mk(R, '<div class="L cam persp"></div>');
  c.morph = mk(c.cam, `<div class="a" style="border-radius:22px;background:linear-gradient(110deg,rgba(142,75,255,.25),rgba(34,27,66,.92));border:1.5px solid rgba(142,75,255,.6);box-shadow:0 40px 90px rgba(0,0,0,.6)"></div>`);
  c.script = mk(c.cam, `<div class="glass" style="left:70px;top:690px;width:940px;height:880px;border-radius:40px"></div>`);
  const S = c.script;
  mk(S, `<div class="a" style="left:36px;top:34px"><span class="pill p-roxo">REELS · 45s</span></div>`);
  mk(S, `<div class="a" style="left:36px;top:96px;font-size:40px;font-weight:700;letter-spacing:-.01em">Roteiro — Lançamento</div>`);
  mk(S, `<div class="a t-sub" style="left:640px;top:42px">Studio Aurora</div>`);
  const B = [['Introdução', '0–5s', 'Você perde horas procurando arquivos?'], ['Problema', '5–15s', 'Briefing, roteiro e aprovação espalhados.'], ['Solução', '15–30s', 'Com o B7, tudo acontece em um só fluxo.'], ['CTA', '30–45s', 'Comente “B7” e conheça o sistema.']];
  c.blocks = B.map(([a, b, txt], i) => {
    const n = mk(S, `<div class="card" style="left:36px;top:${180 + i * 170}px;width:868px;height:150px">
      <div class="a" data-k="ck" style="left:26px;top:28px;width:44px;height:44px;border-radius:50%;border:2.5px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center"></div>
      <div class="a" style="left:92px;top:26px;font-size:31px;font-weight:600">${a}</div>
      <div class="a" style="right:26px;top:28px"><span class="pill p-azul" style="font-size:20px;padding:6px 16px">${b}</span></div>
      <div class="a" data-k="tx" style="left:92px;top:82px;font-size:26px;color:rgba(255,255,255,.72);white-space:nowrap"></div></div>`);
    n._txt = txt; return n;
  });
  // celular com teleprompter
  c.phone = mk(c.cam, `<div class="a" style="left:270px;top:640px;width:540px;height:1100px;border-radius:78px;background:#0b0915;border:3px solid rgba(190,160,255,.25);box-shadow:0 60px 120px rgba(0,0,0,.75),0 0 80px rgba(122,43,255,.25),inset 0 0 0 12px #07060d;overflow:hidden">
     ${thumb({ x: 12, y: 12, w: 516, h: 1076, v: 0, r: 66, cx: 50 })}
     <div class="a" style="left:12px;top:12px;width:516px;height:560px;border-radius:66px 66px 0 0;background:linear-gradient(180deg,rgba(5,4,12,.92) 0%,rgba(5,4,12,.82) 70%,rgba(5,4,12,0))"></div>
     <div class="a" style="left:220px;top:28px;width:100px;height:30px;border-radius:15px;background:#000"></div>
     <div class="a lbl" style="left:50px;top:84px;font-size:18px;color:rgba(255,255,255,.55)">Teleprompter</div>
     <div class="a" data-k="rec" style="left:330px;top:76px"><span class="pill" style="background:rgba(0,0,0,.5);font-size:20px;padding:6px 14px"><i data-k="dot" style="width:12px;height:12px;border-radius:50%;background:#ff3b6b;display:block"></i><span data-k="tm">00:00</span></span></div>
     <div class="a" style="left:40px;top:140px;width:460px;height:400px;overflow:hidden"><div data-k="tp" style="position:absolute;left:0;top:0;width:460px;font-size:40px;font-weight:600;line-height:1.32">
        ${['Fale de forma natural', 'e objetiva sobre', 'a solução.', 'Mostre o problema.', 'Apresente o resultado.', 'Convide para agir.'].map(l => `<div data-k="tl">${l}</div>`).join('')}</div></div>
     <div class="a" data-k="wave" style="left:60px;top:880px;width:420px;height:50px;display:flex;gap:6px;align-items:center">${Array.from({ length: 30 }, () => '<i style="flex:1;background:rgba(255,255,255,.75);border-radius:3px;height:10px;display:block"></i>').join('')}</div>
     <div class="a" style="left:210px;top:950px;width:120px;height:120px;border-radius:50%;border:6px solid #fff;display:flex;align-items:center;justify-content:center"><div data-k="btn" style="width:90px;height:90px;border-radius:45px;background:#ff3b6b"></div></div>
     <div class="a" style="left:70px;top:985px;width:56px;height:56px;color:#fff">${ic('mic', 40)}</div>
     <div class="a" style="left:416px;top:985px;width:56px;height:56px;color:#fff">${ic('image', 40)}</div>
   </div>`);
  c.tp = $(c.phone, 'tp'); c.tls = $$(c.phone, '[data-k="tl"]'); c.tm = $(c.phone, 'tm'); c.dot = $(c.phone, 'dot'); c.btn = $(c.phone, 'btn'); c.bars = $$(c.phone, '[data-k="wave"] i');
  c.toast = mk(c.cam, `<div class="toast" style="left:150px;top:1470px;width:780px;border-color:rgba(122,43,255,.5)"><div class="tic" style="background:rgba(122,43,255,.2);color:#C4A4FF">${ic('folder', 30, '#C4A4FF')}</div><div><b>Gravação salva em Produção</b><span>Reels — Lançamento · Studio Aurora</span></div>
    <div style="margin-left:auto;width:46px;height:46px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center">${ic('check', 26, '#fff', 3)}</div></div>`);
  c.scrim = mk(R, '<div class="scrim-top" style="height:660px"></div>');
  c.hl = headline(R, { y: 250, lines: ['Da ideia', '[à gravação.]'], size: 110 });
  c.steps = mk(R, `<div class="a" style="left:92px;top:520px;display:flex;gap:14px;font-size:30px;font-weight:600;white-space:nowrap">${['Roteiro.', 'Teleprompter.', 'Gravação.', 'Organização.'].map(s => `<span data-k="st">${s}</span>`).join('')}</div>`);
  c.st = $$(c.steps, '[data-k="st"]');
  c.target = { x: 70, y: 690, w: 940, h: 880 };
}, (t, c) => {
  const S5 = SCENES[4].ctx;
  // card do calendário → tela de roteiro
  const m = ep(t, 20.0, 20.75, E.ioQ);
  if (t < 20.9) {
    const from = rectOf(S5.first);
    place(c.morph, lerpRect(from, c.target, m));
    c.morph.style.borderRadius = lerp(22, 40, m) + 'px';
    O(c.morph, 1 - ep(t, 20.65, 20.9));
  } else O(c.morph, 0);
  const sIn = ep(t, 20.55, 20.9);
  const back = ep(t, 22.9, 23.6, E.ioC);
  const outAll = ep(t, 25.85, 26.5, E.inC);
  T(c.script, { o: sIn * (1 - back * .7), s: 1 - back * .12, y: -back * 150, b: back * 5 });
  c.blocks.forEach((n, i) => {
    const t0 = 20.95 + i * .5;
    const p = ep(t, t0 - .2, t0 + .2);
    T(n, { y: (1 - p) * 30, o: p });
    const typ = P(t, t0, t0 + .45);
    $(n, 'tx').textContent = n._txt.slice(0, Math.round(n._txt.length * typ));
    const ck = $(n, 'ck'), done = t > t0 + .5;
    ck.style.background = done ? 'linear-gradient(135deg,#7A2BFF,#FF2D9B)' : 'transparent';
    ck.style.borderColor = done ? 'transparent' : 'rgba(255,255,255,.25)';
    ck.innerHTML = done ? ic('check', 26, '#fff', 3) : '';
    T(ck, { s: 1 + flash(t, t0 + .5, .35, .3) });
  });
  // celular
  const ph = ep(t, 22.95, 23.75, E.outQ);
  const toCard = ep(t, 25.85, 26.5, E.ioQ);
  T(c.phone, { y: (1 - ph) * 1250, rx: (1 - ph) * 25, s: lerp(.9, 1, ph), o: ph > 0 ? 1 : 0 });
  const scroll = E.ioC(P(t, 23.6, 25.8)) * 3.4;
  c.tp.style.transform = `translateY(${(-scroll * 52.8).toFixed(1)}px)`;
  c.tls.forEach((l, i) => { l.style.opacity = (Math.abs(i - (scroll + .5)) < .9 ? 1 : .3).toFixed(2); });
  const recording = t > 24.25;
  const sec = recording ? Math.floor((t - 24.25) * 4.2) : 0;
  c.tm.textContent = '00:' + String(sec).padStart(2, '0');
  c.dot.style.opacity = recording ? (Math.sin(t * 10) > 0 ? 1 : .25) : .4;
  const press = ep(t, 24.15, 24.4);
  c.btn.style.width = c.btn.style.height = lerp(90, 54, press) + 'px';
  c.btn.style.borderRadius = lerp(45, 14, press) + 'px';
  T(c.btn, { s: 1 - flash(t, 24.15, .3, .25) });
  c.bars.forEach((b, i) => { const a = recording ? .25 + Math.abs(Math.sin(t * 9 + i * .9) * Math.sin(t * 3.1 + i * .37)) : .15; b.style.height = (8 + a * 42).toFixed(1) + 'px'; });
  const tt = ep(t, 25.3, 25.75, E.outB);
  T(c.toast, { y: (1 - tt) * 60, s: lerp(.9, 1, tt), o: tt * (1 - outAll) });
  // passa para o fluxo de vídeo: o celular vira um card
  if (toCard > 0) T(c.phone, { x: -315 * toCard, y: -380 * toCard, o: 1 - ep(t, 26.2, 26.45), s: 1 - toCard * .76 });
  O(c.scrim, 1 - outAll);
  revealHL(c.hl, t, 20.45, { out: 25.85 });
  const active = t < 22.95 ? 0 : t < 24.15 ? 1 : t < 25.3 ? 2 : 3;
  c.st.forEach((s, i) => {
    const p = ep(t, 20.9 + i * .12, 21.3 + i * .12);
    s.className = i === active ? 'g' : '';
    s.style.color = i === active ? '' : 'rgba(255,255,255,.38)';
    s.style.opacity = (p * (1 - outAll)).toFixed(3);
    s.style.display = 'inline-block';
    s.style.transform = `translateY(${((1 - p) * 20).toFixed(1)}px)`;
  });
});

/* ================================================================ 07 · VÍDEO (26–32s) */
const LANES = [['IDEIA', '#9FB1FF'], ['PRODUÇÃO', '#C4A4FF'], ['EDIÇÃO', '#D98BFF'], ['REVISÃO', '#FF8CC6'], ['PUBLICADO', '#fff']];
const LANE_Y = i => 640 + i * 270;
scene(25.8, 32.55, c => {
  const R = c.root;
  c.cam = mk(R, '<div class="L cam"></div>');
  c.lanes = LANES.map(([name, col], i) => {
    const n = mk(c.cam, `<div class="glass" style="left:70px;top:${LANE_Y(i)}px;width:940px;height:244px;border-radius:30px;overflow:hidden">
      <i class="a" style="left:32px;top:30px;width:14px;height:14px;border-radius:50%;background:${col};box-shadow:0 0 14px ${col}"></i>
      <div class="a" style="left:60px;top:18px;font-size:26px;font-weight:700;letter-spacing:.14em">${name}</div>
      <div class="a" data-k="cnt" style="left:${60 + name.length * 23 + 20}px;top:18px;font-size:22px;font-weight:600;padding:2px 14px;border-radius:12px;background:rgba(255,255,255,.08);color:var(--muted)">0</div>
      <div class="a" data-k="row" style="left:0;top:66px;width:2000px;height:170px"></div></div>`);
    n._row = $(n, 'row'); n._cnt = $(n, 'cnt'); n._base = [3, 4, 3, 2, 5][i];
    const titles = [['Bastidores', 'Dica rápida', 'Tendência'], ['Entrevista', 'Tutorial', 'Depoimento', 'Review'], ['Case cliente', 'Antes e depois', 'Making of'], ['Lançamento 2', 'Teaser'], ['Reels #12', 'Reels #11', 'Shorts', 'Vlog', 'Live']][i];
    n._cards = titles.map((ti, j) => mk(n._row, `<div class="a" style="left:0;top:0;width:250px;height:150px">${thumb({ w: 250, h: 150, v: i + j, r: 18, play: true, extra: `<div class="a" style="left:0;bottom:0;width:250px;height:64px;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.75))"></div><div class="a" style="left:16px;bottom:12px;font-size:21px;font-weight:600">${ti}</div>` })}</div>`));
    return n;
  });
  c.hero = mk(c.cam, `<div class="a" style="left:0;top:0;width:250px;height:150px;border-radius:20px;border:3px solid transparent;background:linear-gradient(#0000,#0000) padding-box,var(--grad) border-box;box-shadow:0 20px 60px rgba(178,59,255,.55)">
      ${thumb({ x: 0, y: 0, w: 244, h: 144, v: 0, r: 17, play: true, extra: `<div class="a" style="left:0;bottom:0;width:244px;height:60px;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.8))"></div><div class="a" style="left:14px;bottom:10px;font-size:21px;font-weight:700">Reels — Lançamento</div>` })}
      <div class="a" style="left:12px;top:12px"><span class="pill p-grad" data-k="st" style="font-size:17px;padding:4px 12px">IDEIA</span></div></div>`);
  c.heroSt = $(c.hero, 'st');
  c.scrim = mk(R, '<div class="scrim-top" style="height:640px"></div>');
  c.hl = headline(R, { y: 250, lines: ['Cada conteúdo', '[tem seu lugar.]'], size: 104 });
  c.moves = [27.3, 28.35, 29.4, 30.45];
}, (t, c) => {
  const inn = ep(t, 25.9, 26.7, E.outQ);
  const out = ep(t, 31.9, 32.5, E.ioC);
  // em qual coluna o card está (contínuo)
  let lane = 0, lift = 0;
  c.moves.forEach(m => { const p = ep(t, m, m + .62, E.outB); lane += p; lift = Math.max(lift, Math.sin(P(t, m, m + .62) * Math.PI)); });
  const camY = Math.max(0, lerp(0, 270, lane) - (lane > .5 ? 0 : 0));
  const follow = clamp((lane - 2) * 257, 0, 514);
  T(c.cam, { y: (1 - inn) * 900 - follow, o: 1, b: (1 - inn) * 10 });
  const cur = Math.round(lane);
  c.lanes.forEach((n, i) => {
    const pi = ep(t, 25.95 + i * .08, 26.7 + i * .08, E.outQ);
    T(n, { y: (1 - pi) * 120, o: pi * (1 - out) });
    const here = clamp(1 - Math.abs(lane - i));
    n.style.borderColor = `rgba(178,59,255,${(.16 + here * .6).toFixed(2)})`;
    n.style.boxShadow = `0 40px 90px rgba(0,0,0,.6), 0 0 ${(here * 50).toFixed(0)}px rgba(178,59,255,${(here * .35).toFixed(2)})`;
    n._cards.forEach((cd, j) => T(cd, { x: 30 + (j + here) * 272 - P(t, 26, 32) * 40 * (i % 2 ? 1 : -1) }));
    n._cnt.textContent = n._base + (cur === i ? 1 : 0);
  });
  const hx = 70 + 30, hy = LANE_Y(0) + 66 + lane * 270;
  const pub = t > c.moves[3] + .55;
  c.heroSt.textContent = LANES[clamp(cur, 0, 4)][0] + (pub ? ' ✓' : '');
    // continuidade: no começo o card nasce do celular da cena anterior
  const pop = ep(t, 26.25, 26.75, E.outB);
  T(c.hero, { x: hx, y: hy, s: lerp(.6, 1, pop) * (1 + lift * .1), o: Math.min(1, pop * 2) * (1 - out), r: lift * -3 });
  if (pub) {
    const pp = P(t, c.moves[3] + .55, c.moves[3] + 1.4);
    if (pp > 0 && pp < 1) {
      const r2 = rng(5); FX.globalCompositeOperation = 'lighter';
      const cx = hx + 125, cy = hy - follow + 75;
      for (let i = 0; i < 46; i++) { const a = r2() * 6.28, d = E.outC(pp) * (80 + r2() * 220), s = (4 + r2() * 8) * 4 * (1 - pp); FX.globalAlpha = 1 - pp; FX.drawImage(tinted(i % 3 ? '#B23BFF' : '#FF2D9B'), cx + Math.cos(a) * d - s / 2, cy + Math.sin(a) * d - s / 2, s, s); }
      FX.globalAlpha = 1; FX.globalCompositeOperation = 'source-over';
    }
  }
  c.moves.forEach(m => { FLASH = Math.max(FLASH, flash(t, m + .5, .4, .12)); });
  O(c.scrim, 1 - out);
  revealHL(c.hl, t, 26.45, { out: 31.85 });
  c.heroRect = { x: hx, y: hy - follow, w: 250, h: 150 };
});

/* ================================================================ 08 · DESIGN (32–38s) */
const SLIDES = [['ESTRATÉGIA', 'QUE GERA', 'RESULTADOS'], ['PLANEJE', 'COM', 'DADOS'], ['EXECUTE', 'COM', 'CONSTÂNCIA']];
function artboardHTML(w, h, si, k = '') {
  const [a, b, cc] = SLIDES[si];
  const s = w / 680;
  return `<div class="a" ${k ? `data-k="${k}"` : ''} style="left:0;top:0;width:${w}px;height:${h}px;overflow:hidden;border-radius:${18 * s}px;background:radial-gradient(80% 60% at 85% 30%,rgba(122,43,255,.6),transparent 60%),radial-gradient(60% 50% at 10% 100%,rgba(255,45,155,.35),transparent 60%),linear-gradient(170deg,#141638,#07071A)">
    ${thumb({ x: w * .42, y: h * .18, w: w * .62, h: h * .82, v: 0, r: 0, cx: 52 }).replace('background:', 'background:transparent;--x:')}
    <div class="a" style="left:${48 * s}px;top:${50 * s}px;font-size:${18 * s}px;letter-spacing:.3em;font-weight:600;color:rgba(255,255,255,.6)">STUDIO AURORA</div>
    <div class="a" data-k="txt" style="left:${44 * s}px;top:${110 * s}px;font-size:${70 * s}px;line-height:1.02;font-weight:800;letter-spacing:-.02em;white-space:nowrap">
      <div>${a}</div><div>${b}</div><div data-k="l3" style="position:relative">${cc}<span data-k="l3g" class="g" style="position:absolute;left:0;top:0;opacity:0">${cc}</span></div></div>
    <div class="a" style="left:${48 * s}px;top:${h - 290 * s}px;display:flex;align-items:flex-end;gap:${12 * s}px;height:${170 * s}px">${[.35, .5, .45, .7, 1].map((v, i) => `<i data-k="bar" style="display:block;width:${34 * s}px;height:${170 * v * s}px;border-radius:${6 * s}px;background:${i === 4 ? 'linear-gradient(180deg,#FF2D9B,#7A2BFF)' : 'rgba(255,255,255,.22)'}"></i>`).join('')}</div>
    <div class="a" style="left:${48 * s}px;top:${h - 90 * s}px;width:${w - 96 * s}px;height:${54 * s}px;border-radius:${27 * s}px;background:rgba(255,255,255,.92);color:#15122B;display:flex;align-items:center;padding:0 ${22 * s}px;font-size:${20 * s}px;font-weight:700">Deslize para ver →</div>
  </div>`;
}
scene(31.8, 38.55, c => {
  const R = c.root;
  c.cam = mk(R, '<div class="L cam persp"></div>');
  c.tool = mk(c.cam, `<div class="glass" style="left:56px;top:660px;width:104px;height:660px;border-radius:30px">${['cursor', 'type', 'shape', 'image', 'palette', 'layers'].map((k, i) =>
    `<div class="a" style="left:18px;top:${24 + i * 104}px;width:68px;height:68px;border-radius:20px;${i === 1 ? 'background:var(--grad);' : ''}display:flex;align-items:center;justify-content:center;color:${i === 1 ? '#fff' : 'rgba(255,255,255,.6)'}">${ic(k, 34)}</div>`).join('')}</div>`);
  c.board = mk(c.cam, `<div class="a" style="left:190px;top:640px;width:680px;height:850px;overflow:hidden;border-radius:18px;box-shadow:0 50px 120px rgba(0,0,0,.7),0 0 0 1.5px rgba(255,255,255,.08)"></div>`);
  c.slides = SLIDES.map((_, i) => mk(c.board, `<div class="a" style="left:0;top:0;width:680px;height:850px">${artboardHTML(680, 850, i)}</div>`));
  c.bars = $$(c.slides[0], '[data-k="bar"]');
  c.l3g = $(c.slides[0], 'l3g');
  c.sel = mk(c.board, `<div class="a" style="left:30px;top:96px;width:560px;height:240px;border:2.5px solid #B23BFF;border-radius:6px">
      ${[[-9, -9], [551, -9], [-9, 231], [551, 231]].map(([x, y]) => `<i style="position:absolute;left:${x - 2}px;top:${y - 2}px;width:16px;height:16px;background:#fff;border:2.5px solid #B23BFF;border-radius:4px;display:block"></i>`).join('')}
      <span class="pill p-grad" style="position:absolute;left:-2px;top:-52px;font-size:18px;padding:4px 14px">Título · Poppins Bold</span></div>`);
  c.pal = mk(c.cam, `<div class="glass" style="left:900px;top:700px;width:124px;height:470px;border-radius:30px">${['#7A2BFF', '#FF2D9B', '#3D5BFF', '#1B1F3B', '#FFFFFF'].map((col, i) =>
    `<i data-k="sw" style="position:absolute;left:27px;top:${30 + i * 86}px;width:70px;height:70px;border-radius:50%;background:${col};border:2px solid rgba(255,255,255,.2);display:block"></i>`).join('')}</div>`);
  c.sws = $$(c.pal, '[data-k="sw"]');
  c.strip = mk(c.cam, `<div class="glass" style="left:70px;top:1530px;width:940px;height:250px;border-radius:32px;overflow:hidden">
      <div class="a" style="left:32px;top:22px;font-size:24px;font-weight:600">Carrossel · Estratégia <span style="color:var(--muted);font-weight:500">— 5 artes</span></div>
      <div class="a" data-k="row" style="left:32px;top:72px;width:2000px;height:160px">${[0, 1, 2, 0, 1, 2].map((s, i) =>
    `<div class="a" data-k="tn" style="left:${i * 150}px;top:0;width:128px;height:160px;border-radius:12px;overflow:hidden;border:2.5px solid transparent">${artboardHTML(128, 160, s)}</div>`).join('')}</div></div>`);
  c.tns = $$(c.strip, '[data-k="tn"]');
  c.scrim = mk(R, '<div class="scrim-top" style="height:650px"></div>');
  c.hl = headline(R, { y: 230, lines: ['Criação também', 'faz parte', '[da operação.]'], size: 96 });
}, (t, c) => {
  const S7 = SCENES[6].ctx;
  const inn = ep(t, 31.95, 32.75, E.ioQ);
  const zoom = ep(t, 33.4, 34.6, E.ioC), pan = ep(t, 34.8, 35.8, E.ioC), back = ep(t, 36.6, 37.4, E.ioC);
  const out = ep(t, 37.7, 38.4, E.ioQ);
  // card publicado → prancheta (vira e cresce)
  const from = S7.heroRect || { x: 100, y: 1000, w: 250, h: 150 };
  const to = { x: 190, y: 640, w: 680, h: 850 };
  const cs = lerp(1, 1.24, zoom) - pan * .14 - back * .1;
  const cy = -zoom * 10 - pan * 560 + back * 570;
  T(c.cam, { s: cs, y: cy, x: -zoom * 40 + back * 40 + pan * 40, o: 1 - ep(t, 38.1, 38.5) });
  const bs = lerp(from.w / to.w, 1, inn);
  T(c.board, { x: (from.x + from.w / 2 - 530) * (1 - inn), y: (from.y + from.h / 2 - 1065) * (1 - inn), s: bs, ry: (1 - inn) * -70, o: Math.min(1, inn * 4) });
  [c.tool, c.pal, c.strip].forEach((n, i) => { const p = ep(t, 32.6 + i * .15, 33.3 + i * .15, E.outQ); T(n, { x: (i === 0 ? -1 : i === 1 ? 1 : 0) * (1 - p) * 140, y: i === 2 ? (1 - p) * 200 : 0, o: p * (1 - out) }); });
  c.sws.forEach((s, i) => T(s, { s: ep(t, 33.0 + i * .08, 33.4 + i * .08, E.outB) }));
  c.bars.forEach((b, i) => { b.style.transformOrigin = 'bottom'; T(b, { sy: ep(t, 32.8 + i * .09, 33.4 + i * .09, E.outB) }); });
  const sel = ep(t, 33.5, 33.8, E.outB) * (1 - ep(t, 35.0, 35.2));
  T(c.sel, { s: lerp(1.06, 1, sel), o: sel });
  O(c.l3g, ep(t, 34.05, 34.45));
  // troca de slides do carrossel
  const sp = ep(t, 35.35, 35.85, E.ioC) + ep(t, 36.05, 36.55, E.ioC);
  c.slides.forEach((s, i) => T(s, { x: (i - sp) * 680 }));
  const act = Math.round(sp);
  c.tns.forEach((n, i) => { n.style.borderColor = i === act ? '#B23BFF' : 'transparent'; T(n, { x: -P(t, 33, 38) * 60, s: i === act ? 1.05 : 1 }); });
  O(c.scrim, 1 - out);
  revealHL(c.hl, t, 32.45, { out: 37.65 });
  c.boardRect = rectOf(c.board);
});

/* ================================================================ 09 · APROVAÇÃO (38–44s) */
scene(37.6, 44.55, c => {
  const R = c.root;
  c.cam = mk(R, '<div class="L cam persp"></div>');
  c.card = mk(c.cam, `<div class="glass" style="left:70px;top:630px;width:940px;height:960px;border-radius:40px"></div>`);
  const C = c.card;
  mk(C, `<div class="a" style="left:36px;top:32px;font-size:34px;font-weight:700">Carrossel · Estratégia</div>`);
  c.ver = mk(C, `<div class="a" style="right:36px;top:30px"><span class="pill p-roxo" data-k="v">Versão 1.0</span></div>`);
  c.prev = mk(C, `<div class="a" style="left:36px;top:104px;width:868px;height:390px;border-radius:24px;background:rgba(0,0,0,.25);overflow:hidden"></div>`);
  c.pslides = [0, 1, 2].map(i => mk(c.prev, `<div class="a" style="left:${46 + i * 270}px;top:28px;width:254px;height:318px;border-radius:14px;box-shadow:0 20px 40px rgba(0,0,0,.5)">${artboardHTML(254, 318, i)}</div>`));
  c.pin = mk(c.prev, `<div class="a" style="left:236px;top:58px;width:46px;height:46px;border-radius:50%;background:#FF2D9B;border:3px solid #fff;font-weight:700;font-size:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 8px rgba(255,45,155,.25)">1</div>`);
  const steps = ['Conteúdo pronto', 'Revisão do cliente', 'Aprovado'];
  mk(C, `<div class="a" style="left:80px;top:546px;width:780px;height:4px;border-radius:2px;background:rgba(255,255,255,.1)"></div>`);
  c.stepLine = mk(C, `<div class="a" style="left:80px;top:546px;width:780px;height:4px;border-radius:2px;background:var(--grad);transform-origin:0 0"></div>`);
  c.steps = steps.map((s, i) => mk(C, `<div class="a" style="left:${80 + i * 390 - 20}px;top:528px;width:40px;height:40px">
      <div data-k="d" style="width:40px;height:40px;border-radius:50%;background:#2a2340;border:3px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center"></div>
      <div data-k="l" style="position:absolute;left:${i === 0 ? 0 : i === 2 ? -220 : -110}px;width:260px;top:52px;font-size:22px;font-weight:600;color:var(--muted);text-align:${i === 0 ? 'left' : i === 2 ? 'right' : 'center'};${i === 2 ? 'left:-220px;' : ''}">${s}</div></div>`));
  c.b1 = mk(C, `<div class="a" style="left:36px;top:646px;width:720px;display:flex;gap:16px;align-items:flex-start">
      <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#FF2D9B,#7A2BFF);flex:none;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:26px">M</div>
      <div style="background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.08);border-radius:8px 26px 26px 26px;padding:14px 22px">
        <div style="font-size:19px;color:var(--muted);font-weight:600">Marina · Cliente <span style="font-weight:500">· agora</span></div>
        <div data-k="tx" style="font-size:28px;font-weight:500;white-space:nowrap">Ficou ótimo! Só ajustar este texto.</div></div></div>`);
  c.typing = mk(C, `<div class="a" style="left:112px;top:672px;display:flex;gap:8px;padding:18px 24px;border-radius:24px;background:rgba(255,255,255,.07)">${'<i style="width:12px;height:12px;border-radius:50%;background:#fff;display:block"></i>'.repeat(3)}</div>`);
  c.dots = $$(c.typing, 'i');
  c.b2 = mk(C, `<div class="a" style="right:36px;top:760px;display:flex;gap:16px;align-items:flex-start;flex-direction:row-reverse">
      <div style="width:60px;height:60px;border-radius:50%;background:var(--grad);flex:none;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:22px">B7</div>
      <div style="background:linear-gradient(110deg,rgba(122,43,255,.5),rgba(255,45,155,.35));border-radius:26px 8px 26px 26px;padding:14px 22px">
        <div style="font-size:19px;color:rgba(255,255,255,.7);font-weight:600">Você · agora</div>
        <div style="font-size:28px;font-weight:500;white-space:nowrap">Ajustado! Pode aprovar?</div></div></div>`);
  c.btn = mk(C, `<div class="btn" style="left:36px;top:868px;width:868px;height:0px"></div>`);
  c.btn.remove();
  c.btn = mk(c.cam, `<div class="btn" style="left:106px;top:1500px;width:868px;height:116px"><span data-k="a">Aprovar</span></div>`);
  c.ok = mk(c.cam, `<div class="btn" style="left:106px;top:1500px;width:868px;height:116px;background:linear-gradient(100deg,#1FAE6A,#2BD27F);box-shadow:0 18px 60px rgba(43,210,127,.45)">
      <svg width="56" height="56" viewBox="0 0 24 24" style="fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"><circle cx="12" cy="12" r="10" stroke-opacity=".5"/><path data-k="ck" d="M7 12.5l3.2 3.2L17 9" stroke-dasharray="16" stroke-dashoffset="16"/></svg>
      <span>Conteúdo aprovado!</span></div>`);
  c.ck = $(c.ok, 'ck');
  c.ring = mk(c.cam, `<div class="a" style="left:106px;top:1500px;width:868px;height:116px;border-radius:24px;border:3px solid #2BD27F"></div>`);
  c.tap = mk(c.cam, `<div class="a" style="left:0;top:0;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.28);border:3px solid rgba(255,255,255,.85)"></div>`);
  c.scrim = mk(R, '<div class="scrim-top" style="height:640px"></div>');
  c.hl = headline(R, { y: 230, lines: ['Aprovações', '[sem perder]', '[o controle.]'], size: 98 });
  c.dsts = c.steps.map(s => $(s, 'd'));
  c.lbls = c.steps.map(s => $(s, 'l'));
}, (t, c) => {
  const S8 = SCENES[7].ctx;
  const inn = ep(t, 37.75, 38.55, E.ioQ);
  const out = ep(t, 43.85, 44.5, E.inC);
  T(c.cam, { y: -out * 1400, b: out * 16, o: 1 });
  T(c.card, { y: (1 - inn) * 80, s: lerp(.94, 1, inn), o: inn });
  // a prancheta encolhe até a primeira arte do preview
  c.pslides.forEach((s, i) => { const p = ep(t, 38.2 + i * .12, 38.75 + i * .12, E.outQ); T(s, { y: (1 - p) * 40, o: p }); });
  const st = t < 39.0 ? -1 : t < 39.6 ? 0 : t < 42.55 ? 1 : 2;
  c.dsts.forEach((d, i) => {
    const done = i <= st, green = st === 2 && i === 2;
    d.style.background = green ? '#2BD27F' : done ? 'linear-gradient(135deg,#7A2BFF,#FF2D9B)' : '#2a2340';
    d.style.borderColor = done ? 'transparent' : 'rgba(255,255,255,.2)';
    d.innerHTML = done ? ic('check', 22, '#fff', 3.2) : '';
    c.lbls[i].style.color = green ? '#6BEAA9' : done ? '#fff' : 'rgba(232,226,255,.45)';
    T(d, { s: 1 + flash(t, [39.0, 39.6, 42.55][i], .4, .35) });
  });
  c.stepLine.style.transform = `scaleX(${(ep(t, 39.0, 39.6, E.ioC) * .5 + ep(t, 42.4, 42.7, E.ioC) * .5).toFixed(3)})`;
  c.stepLine.style.background = st === 2 ? 'linear-gradient(90deg,#7A2BFF,#FF2D9B 70%,#2BD27F)' : 'var(--grad)';
  // cliente comenta
  const ty = env(t, 39.85, 40.05, 40.45, 40.6, E.outC, E.inC);
  O(c.typing, ty); c.dots.forEach((d, i) => T(d, { y: Math.sin(t * 12 - i * .9) * 5 }));
  const b1 = ep(t, 40.5, 40.95, E.outB);
  T(c.b1, { y: (1 - b1) * 30, s: lerp(.92, 1, b1), o: b1 });
  const pin = ep(t, 40.75, 41.05, E.outB2);
  T(c.pin, { s: pin * (1 + Math.sin(t * 6) * .05), o: pin * (1 - ep(t, 41.9, 42.2)) });
  const b2 = ep(t, 41.4, 41.85, E.outB);
  T(c.b2, { y: (1 - b2) * 30, s: lerp(.92, 1, b2), o: b2 });
  const v = $(c.ver, 'v');
  v.textContent = t > 41.45 ? 'Versão 1.1' : 'Versão 1.0';
  T(c.ver, { s: 1 + flash(t, 41.45, .4, .2) });
  // clique em Aprovar
  const bIn = ep(t, 41.9, 42.3, E.outB);
  const tapIn = ep(t, 42.05, 42.3, E.outC), press = flash(t, 42.35, .35, 1);
  const ok = ep(t, 42.5, 42.85, E.outB);
  T(c.btn, { y: (1 - bIn) * 60, s: (1 - press * .05), o: bIn * (1 - ok) });
  T(c.ok, { s: lerp(.9, 1, ok), o: ok });
  c.ck.setAttribute('stroke-dashoffset', (16 * (1 - ep(t, 42.75, 43.15))).toFixed(2));
  const rg = P(t, 42.6, 43.4);
  T(c.ring, { s: 1 + E.outC(rg) * .12, o: rg > 0 && rg < 1 ? (1 - rg) : 0 });
  T(c.tap, { x: 700 + (1 - tapIn) * 120, y: 1515 + (1 - tapIn) * 140, s: 1 - press * .25, o: tapIn * (1 - ep(t, 42.55, 42.8)) });
  revealHL(c.hl, t, 38.3, { out: 43.8 });
  O(c.scrim, 1 - out);
  // a prancheta da cena anterior encolhe para dentro do preview
  if (t < 38.6 && S8.boardRect) { /* continuidade visual pela sobreposição */ }
});

/* ================================================================ 10 · INTELIGÊNCIA (44–50s) */
scene(43.8, 50.55, c => {
  const R = c.root;
  c.cam = mk(R, '<div class="L cam persp"></div>');
  c.border = mk(c.cam, `<div class="a" style="left:66px;top:626px;width:948px;height:1008px;border-radius:44px;overflow:hidden">
      <div data-k="cg" style="position:absolute;left:-300px;top:-300px;width:1548px;height:1608px;background:conic-gradient(from 0deg,#3D5BFF,#7A2BFF,#FF2D9B,rgba(255,45,155,0) 40%,rgba(61,91,255,0) 70%,#3D5BFF)"></div></div>`);
  c.cg = $(c.border, 'cg');
  c.panel = mk(c.cam, `<div class="glass" style="left:70px;top:630px;width:940px;height:1000px;border-radius:40px;background:linear-gradient(180deg,#1A1534,#0E0B22)"></div>`);
  const Pn = c.panel;
  mk(Pn, `<div class="chip-ico" style="left:36px;top:32px;width:70px;height:70px;background:var(--grad);color:#fff">${ic('spark', 38, '#fff')}</div>`);
  mk(Pn, `<div class="a" style="left:128px;top:40px;font-size:38px;font-weight:700">Assistente B7</div>`);
  mk(Pn, `<div class="a" style="right:36px;top:40px"><span class="pill p-grad" style="font-size:24px;padding:8px 22px">IA</span></div>`);
  c.input = mk(Pn, `<div class="a" style="left:36px;top:128px;width:868px;height:96px;border-radius:26px;background:rgba(255,255,255,.06);border:1.5px solid rgba(178,59,255,.4)">
      <div class="a" data-k="q" style="left:28px;top:28px;font-size:28px;font-weight:500;white-space:nowrap"></div>
      <div class="a" data-k="send" style="right:14px;top:14px;width:68px;height:68px;border-radius:20px;background:var(--grad);display:flex;align-items:center;justify-content:center">${ic('send', 32, '#fff')}</div></div>`);
  c.q = $(c.input, 'q'); c.send = $(c.input, 'send');
  const CARDS = [
    ['spark', 'Novas ideias', `<div style="display:flex;gap:10px">${['Bastidores', 'Antes e depois', '3 erros comuns'].map(s => `<span class="pill p-roxo" style="font-size:21px">${s}</span>`).join('')}</div>`],
    ['doc', 'Roteiro', `<div style="display:flex;gap:10px;align-items:center;font-size:22px;font-weight:600">${['Gancho', 'Problema', 'Solução', 'CTA'].map((s, i) => `<span class="pill ${i % 2 ? 'p-mag' : 'p-azul'}" style="font-size:21px">${s}</span>`).join('<span style="color:var(--faint)">→</span>')}</div>`],
    ['chart', 'Análise', `<div style="display:flex;gap:16px;align-items:center"><div style="display:flex;gap:6px;align-items:flex-end;height:44px">${[.4, .55, .5, .75, 1].map(v => `<i data-k="ab" style="display:block;width:16px;height:${44 * v}px;border-radius:4px;background:linear-gradient(180deg,#FF2D9B,#7A2BFF)"></i>`).join('')}</div><span style="font-size:26px;font-weight:700">+38% de alcance</span><span style="font-size:22px;color:var(--muted)">em Reels</span></div>`],
    ['cal', 'Linha editorial', `<div style="display:flex;gap:10px">${['Seg · Educativo', 'Qua · Bastidores', 'Sex · Prova social'].map(s => `<span class="pill p-azul" style="font-size:21px">${s}</span>`).join('')}</div>`],
    ['layers', 'Adaptação de conteúdo', `<div style="display:flex;gap:10px">${['Reels', 'Carrossel', 'Stories', 'Shorts'].map(s => `<span class="pill p-mag" data-k="ad" style="font-size:21px">${s}</span>`).join('')}</div>`],
  ];
  c.cards = CARDS.map(([i, ti, body], k) => {
    const n = mk(Pn, `<div class="card" style="left:36px;top:${252 + k * 148}px;width:868px;height:132px;overflow:hidden">
      <div class="chip-ico" style="left:22px;top:22px;width:56px;height:56px;background:rgba(178,59,255,.18);color:#D9B8FF">${ic(i, 30)}</div>
      <div class="a" style="left:96px;top:16px;font-size:27px;font-weight:600">${ti}</div>
      <div class="a" data-k="sk" style="left:96px;top:66px;width:700px"><div class="sk" style="width:80%;margin-bottom:12px"></div><div class="sk" style="width:55%"></div></div>
      <div class="a" data-k="bd" style="left:96px;top:62px">${body}</div>
      <div class="a" data-k="sh" style="left:0;top:0;width:260px;height:132px;background:linear-gradient(90deg,rgba(178,59,255,0),rgba(178,59,255,.35),rgba(255,45,155,0))"></div></div>`);
    n._t = 45.85 + k * .62; return n;
  });
  c.scrim = mk(R, '<div class="scrim-top" style="height:640px"></div>');
  c.hl = headline(R, { y: 230, lines: ['Inteligência', '[para acelerar]', '[a operação.]'], size: 100 });
  c.prompt = 'Planeje novembro para o Studio Aurora';
}, (t, c) => {
  const inn = ep(t, 43.85, 44.75, E.outQ);
  const out = ep(t, 49.85, 50.5, E.ioC);
  T(c.cam, { y: (1 - inn) * 1400 - out * 60, s: 1 - out * .15, o: 1 - out, b: (1 - inn) * 16 + out * 10 });
  c.cg.style.transform = `rotate(${(t * 90).toFixed(1)}deg)`;
  O(c.border, ep(t, 44.6, 45.2) * .9);
  const typ = P(t, 44.85, 45.55);
  c.q.innerHTML = c.prompt.slice(0, Math.round(c.prompt.length * typ)) + (t < 45.7 && Math.sin(t * 16) > 0 ? '<span style="color:#B23BFF">|</span>' : '');
  T(c.send, { s: 1 - flash(t, 45.6, .3, .25) });
  c.cards.forEach((n, k) => {
    const a = ep(t, n._t, n._t + .35, E.outQ);
    T(n, { y: (1 - a) * 30, o: a });
    const sh = P(t, n._t, n._t + .5);
    T($(n, 'sh'), { x: lerp(-260, 900, sh), o: sh > 0 && sh < 1 ? 1 : 0 });
    const g = ep(t, n._t + .35, n._t + .6);
    O($(n, 'sk'), 1 - g);
    T($(n, 'bd'), { x: (1 - g) * 20, o: g });
    n.style.borderColor = `rgba(178,59,255,${(.07 + flash(t, n._t + .35, .6, .6)).toFixed(2)})`;
  });
  $$(c.cards[2], '[data-k="ab"]').forEach((b, i) => { b.style.transformOrigin = 'bottom'; T(b, { sy: ep(t, c.cards[2]._t + .4 + i * .06, c.cards[2]._t + .8 + i * .06, E.outB) }); });
  $$(c.cards[4], '[data-k="ad"]').forEach((b, i) => { const f = flash(t, c.cards[4]._t + .5 + i * .14, .5, 1); b.style.boxShadow = `0 0 ${(f * 30).toFixed(0)}px rgba(255,45,155,${(f * .8).toFixed(2)})`; });
  // fluxo de partículas ao redor do painel
  const al = ep(t, 44.6, 45.4) * (1 - out);
  if (al > 0) {
    const r2 = rng(9); FX.globalCompositeOperation = 'lighter';
    const per = (u) => { // perímetro do painel (retângulo)
      const w = 940, h = 1000, L = 2 * (w + h); let d = ((u % 1) + 1) % 1 * L;
      if (d < w) return [70 + d, 630]; d -= w; if (d < h) return [1010, 630 + d]; d -= h; if (d < w) return [1010 - d, 1630]; d -= w; return [70, 1630 - d];
    };
    for (let i = 0; i < 90; i++) {
      const u = r2() + t * (.05 + r2() * .06), off = (r2() - .5) * 26;
      const [x, y] = per(u); const s = (2 + r2() * 4) * 6;
      FX.globalAlpha = al * (.4 + .6 * Math.abs(Math.sin(t * 3 + i)));
      FX.drawImage(tinted(i % 3 === 0 ? '#FF2D9B' : i % 3 === 1 ? '#7A2BFF' : '#3D5BFF'), x + off - s / 2, y + off - s / 2, s, s);
    }
    // faíscas saindo dos cards gerados
    c.cards.forEach((n) => {
      const p = P(t, n._t + .3, n._t + 1.2); if (p <= 0 || p >= 1) return;
      const r3 = rng(Math.round(n._t * 100)); const top = 630 + parseFloat(n.style.top) + 66;
      for (let i = 0; i < 20; i++) { const x = 140 + r3() * 820, y = top - E.outC(p) * (40 + r3() * 160); const s = (2 + r3() * 4) * 5 * (1 - p); FX.globalAlpha = (1 - p) * al; FX.drawImage(tinted('#B23BFF'), x - s / 2, y - s / 2, s, s); }
    });
    FX.globalAlpha = 1; FX.globalCompositeOperation = 'source-over';
  }
  O(c.scrim, 1 - out);
  revealHL(c.hl, t, 44.4, { out: 49.8 });
});

/* ================================================================ 11 · PORTAL DO CLIENTE (50–54s) */
scene(49.85, 54.55, c => {
  const R = c.root;
  c.cam = mk(R, '<div class="L cam persp"></div>');
  c.phone = mk(c.cam, `<div class="a" style="left:240px;top:610px;width:600px;height:1180px;border-radius:84px;background:#0b0915;border:3px solid rgba(190,160,255,.3);box-shadow:0 60px 140px rgba(0,0,0,.8),0 0 100px rgba(122,43,255,.3);overflow:hidden">
      <div class="a" style="left:14px;top:14px;width:566px;height:1146px;border-radius:70px;background:#F6F5FA;overflow:hidden"><div data-k="sc" class="a" style="left:0;top:0;width:566px;height:1500px"></div></div>
      <div class="a" style="left:240px;top:30px;width:120px;height:34px;border-radius:17px;background:#000"></div></div>`);
  const S = $(c.phone, 'sc'); c.sc = S;
  const lw = 190, lh = lw * 354 / 900;
  mk(S, `<img class="a" src="${BRAND}logo-color.png" style="left:30px;top:74px;width:${lw}px;height:${lh}px">`);
  mk(S, `<div class="a" style="left:470px;top:84px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#FFB8DD,#C4A4FF);display:flex;align-items:center;justify-content:center;color:#3A1E86;font-weight:700;font-size:22px">SA</div>`);
  mk(S, `<div class="a" style="left:34px;top:170px;font-size:40px;font-weight:700;color:#15122B;letter-spacing:-.02em">Portal do Cliente</div>`);
  mk(S, `<div class="a" style="left:34px;top:224px;font-size:24px;color:#6F688C;font-weight:500">Studio Aurora · Outubro</div>`);
  c.prog = mk(S, `<div class="a" style="left:30px;top:280px;width:506px;height:190px;border-radius:30px;background:linear-gradient(120deg,#1B1F3B,#3A1E86 60%,#7C1E85);color:#fff;overflow:hidden">
      <svg class="a" style="left:28px;top:30px" width="130" height="130" viewBox="0 0 130 130"><circle cx="65" cy="65" r="54" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="14"/><circle data-k="ring" cx="65" cy="65" r="54" fill="none" stroke="url(#pg)" stroke-width="14" stroke-linecap="round" stroke-dasharray="339.3" stroke-dashoffset="339.3" transform="rotate(-90 65 65)"/><defs><linearGradient id="pg"><stop offset="0" stop-color="#FF2D9B"/><stop offset="1" stop-color="#B98CFF"/></linearGradient></defs></svg>
      <div class="a" data-k="pc" style="left:28px;top:72px;width:130px;text-align:center;font-size:36px;font-weight:700">0%</div>
      <div class="a" style="left:186px;top:46px;font-size:26px;font-weight:700">Progresso do mês</div>
      <div class="a" data-k="pt" style="left:186px;top:88px;font-size:22px;color:rgba(255,255,255,.75);width:300px;white-space:normal;line-height:1.35">18 de 22 conteúdos entregues</div></div>`);
  c.ring = $(c.prog, 'ring'); c.pc = $(c.prog, 'pc');
  mk(S, `<div class="a" style="left:30px;top:500px;width:506px;height:64px;border-radius:32px;background:#ECE9F5;display:flex;padding:6px;font-size:21px;font-weight:600;color:#6F688C">
      <div style="flex:1;border-radius:26px;background:#fff;color:#15122B;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(21,18,43,.08)">Conteúdos</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center">Aprovações</div><div style="flex:1;display:flex;align-items:center;justify-content:center">Feedbacks</div></div>`);
  const ROWS = [['Reels — Lançamento', 'Publicado · 12 out', 'Publicado', '#7A2BFF', 0], ['Carrossel Estratégia', 'Aprovado · 14 out', 'Aprovado', '#12805A', 2], ['Reels — Bastidores', 'Enviado hoje', 'Em revisão', '#B23BFF', 4], ['Vídeo Entrevista', 'Em edição', 'Em produção', '#3D5BFF', 1]];
  c.rows = ROWS.map(([a, b, p, col, v], i) => mk(S, `<div class="a" style="left:30px;top:${594 + i * 134}px;width:506px;height:118px;border-radius:24px;background:#fff;box-shadow:0 2px 10px rgba(21,18,43,.06),0 12px 30px -16px rgba(21,18,43,.2)">
      ${thumb({ x: 14, y: 14, w: 90, h: 90, v, r: 16 })}
      <div class="a" style="left:122px;top:20px;font-size:24px;font-weight:600;color:#15122B;white-space:nowrap">${a}</div>
      <div class="a" style="left:122px;top:56px;font-size:19px;color:#6F688C">${b}</div>
      <div class="a" style="left:122px;top:80px"><span class="pill" data-k="p" style="font-size:16px;padding:2px 12px;background:${col}1a;color:${col};border:1.5px solid ${col}55">${p}</span></div></div>`));
  c.pill = $(c.rows[2], 'p');
  // indicadores flutuando ao redor do celular
  const F = [['folder', 'Projetos', '4', 40, 760, -1], ['check', 'Aprovações', '1', 790, 900, 1], ['msg', 'Feedbacks', '6', 30, 1240, -1], ['clock', 'Status', 'Em dia', 770, 1380, 1]];
  c.floats = F.map(([i, a, b, x, y, side]) => { const n = mk(c.cam, `<div class="glass" style="left:${x}px;top:${y}px;height:96px;border-radius:26px;display:flex;align-items:center;gap:14px;padding:0 24px 0 16px">
      <div style="width:60px;height:60px;border-radius:18px;background:rgba(178,59,255,.2);display:flex;align-items:center;justify-content:center;color:#D9B8FF">${ic(i, 30)}</div>
      <div><div style="font-size:18px;color:var(--muted);font-weight:600">${a}</div><div style="font-size:28px;font-weight:700;line-height:1.1">${b}</div></div></div>`); n._side = side; return n; });
  c.scrim = mk(R, '<div class="scrim-top" style="height:620px"></div>');
  c.hl = headline(R, { y: 250, lines: ['E o cliente', '[acompanha tudo.]'], size: 104 });
}, (t, c) => {
  const inn = ep(t, 49.9, 50.8, E.outQ);
  const out = ep(t, 53.85, 54.5, E.ioC);
  T(c.cam, { y: (1 - inn) * 300, s: lerp(1.15, 1, inn) - out * .35, o: inn * (1 - out), b: (1 - inn) * 18 + out * 12 });
  T(c.phone, { y: (1 - inn) * 900, rx: (1 - inn) * 20 });
  const rp = ep(t, 50.9, 52.0, E.outC);
  c.ring.setAttribute('stroke-dashoffset', (339.3 * (1 - .82 * rp)).toFixed(1));
  c.pc.textContent = Math.round(82 * rp) + '%';
  c.rows.forEach((n, i) => { const p = ep(t, 51.1 + i * .14, 51.6 + i * .14, E.outQ); T(n, { y: (1 - p) * 40, o: p }); });
  const ap = t > 52.8;
  c.pill.textContent = ap ? 'Aprovado' : 'Em revisão';
  const col = ap ? '#12805A' : '#B23BFF';
  c.pill.style.background = col + '1a'; c.pill.style.color = col; c.pill.style.borderColor = col + '55';
  T(c.pill, { s: 1 + flash(t, 52.8, .4, .25) });
  T(c.sc, { y: -ep(t, 52.1, 53.4, E.ioC) * 150 });
  c.floats.forEach((n, i) => { const p = ep(t, 50.7 + i * .16, 51.3 + i * .16, E.outB); T(n, { x: (1 - p) * 120 * n._side, y: Math.sin(t * 1.4 + i) * 10, s: lerp(.8, 1, p), o: p }); });
  O(c.scrim, 1 - out);
  revealHL(c.hl, t, 50.35, { out: 53.8 });
});

/* ================================================================ 12 · TUDO CONECTADO (54–57s) */
scene(53.85, 57.15, c => {
  const R = c.root;
  c.cam = mk(R, '<div class="L cam"></div>');
  c.halo = mk(c.cam, `<div class="a" style="left:240px;top:660px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(178,59,255,.55),rgba(61,91,255,.18) 45%,rgba(0,0,0,0) 70%)"></div>`);
  c.rings = [0, 1, 2].map(() => mk(c.cam, `<div class="a" style="left:390px;top:810px;width:300px;height:300px;border-radius:50%;border:2px solid rgba(178,59,255,.6)"></div>`));
  const M = [['cal', 'PLANEJAMENTO', 0, 690], ['pen', 'PRODUÇÃO', 0, 960], ['image', 'DESIGN', 0, 1230], ['video', 'VÍDEO', 1, 690], ['check', 'APROVAÇÃO', 1, 960], ['send', 'PUBLICAÇÃO', 1, 1230]];
  const svg = mk(c.cam, `<svg class="a" style="left:0;top:0" width="1080" height="1920" viewBox="0 0 1080 1920"><defs>
      <linearGradient id="ln0" x1="0" x2="1"><stop offset="0" stop-color="#3D5BFF"/><stop offset="1" stop-color="#B23BFF"/></linearGradient>
      <linearGradient id="ln1" x1="1" x2="0"><stop offset="0" stop-color="#FF2D9B"/><stop offset="1" stop-color="#B23BFF"/></linearGradient></defs></svg>`);
  c.paths = []; c.nodes = [];
  M.forEach(([i, name, side, y], k) => {
    const nx = side ? 712 : 368, cx = side ? 628 : 452, cy = 960 + (y - 960) * .3;
    const d = `M${nx} ${y} C ${side ? 650 : 430} ${y}, ${side ? 650 : 430} ${cy}, ${cx} ${cy}`;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', `url(#ln${side})`); p.setAttribute('stroke-width', '3.5'); p.setAttribute('stroke-linecap', 'round');
    svg.appendChild(p); p._len = p.getTotalLength(); p.style.strokeDasharray = p._len; c.paths.push(p);
    const n = mk(c.cam, `<div class="glass" style="left:${side ? 712 : 48}px;top:${y - 50}px;width:320px;height:100px;border-radius:30px;display:flex;align-items:center;gap:16px;padding:0 18px;${side ? 'flex-direction:row-reverse;' : ''}">
        <div style="width:64px;height:64px;border-radius:20px;flex:none;background:rgba(178,59,255,.2);border:1.5px solid rgba(178,59,255,.5);display:flex;align-items:center;justify-content:center;color:#E2C8FF">${ic(i, 32)}</div>
        <div style="font-size:${name.length > 10 ? 24 : 27}px;font-weight:700;letter-spacing:.06em;white-space:nowrap">${name}</div></div>`);
    n._side = side; c.nodes.push(n);
  });
  c.sym = symbol(c.cam, { bw: 210 });
  c.sym.el.style.left = (540 - c.sym.w / 2) + 'px'; c.sym.el.style.top = (960 - c.sym.h / 2) + 'px';
  c.hl = headline(R, { y: 300, lines: ['Todos os módulos', 'conectados.'], size: 92, center: true, maxW: 960 });
  c.hl2 = headline(R, { y: 1440, lines: ['[Uma operação completa.]'], size: 76, center: true, maxW: 960 });
}, (t, c) => {
  const pull = ep(t, 53.9, 56.9, E.outC);
  const out = ep(t, 56.75, 57.15, E.inC);
  T(c.cam, { s: lerp(1.35, 1, pull), o: ep(t, 53.9, 54.4) * (1 - out) });
  const hit = flash(t, 55.55, .8, 1);
  T(c.sym.el, { s: ep(t, 54.0, 54.5, E.outB) * (1 + hit * .08), o: ep(t, 54.0, 54.3) });
  T(c.halo, { s: .8 + ep(t, 54, 55) * .3 + hit * .25, o: .5 + hit * .5 });
  c.rings.forEach((r, i) => { const p = ((t - 54.2 + i * .6) % 1.8) / 1.8; T(r, { s: .7 + p * 1.6, o: (1 - p) * .6 * ep(t, 54.2, 54.6) }); });
  c.nodes.forEach((n, i) => {
    const p = ep(t, 54.15 + i * .1, 54.75 + i * .1, E.outQ);
    T(n, { x: (1 - p) * (n._side ? 160 : -160), o: p, b: (1 - p) * 10, s: 1 + hit * .04 });
    n.style.boxShadow = `0 30px 70px rgba(0,0,0,.6), 0 0 ${(20 + hit * 50).toFixed(0)}px rgba(178,59,255,${(.15 + hit * .5).toFixed(2)})`;
  });
  c.paths.forEach((p, i) => { const d = ep(t, 54.5 + i * .08, 55.3 + i * .08, E.ioC); p.style.strokeDashoffset = (p._len * (1 - d)).toFixed(1); p.style.opacity = .8 + hit * .2; });
  // luzes viajando pelas conexões
  if (t > 55.2) {
    FX.globalCompositeOperation = 'lighter';
    c.paths.forEach((p, i) => {
      for (let j = 0; j < 2; j++) {
        const u = ((t - 55.2) * .9 + i * .17 + j * .5) % 1;
        const pt = p.getPointAtLength(p._len * u);
        const sc = parseFloat(c.cam.style.transform.match(/scale\(([\d.]+)/)[1]);
        const x = 540 + (pt.x - 540) * sc, y = 960 + (pt.y - 960) * sc, s = 34;
        FX.globalAlpha = Math.sin(u * Math.PI) * (1 - out);
        FX.drawImage(tinted('#ffffff'), x - s / 4, y - s / 4, s / 2, s / 2);
        FX.drawImage(tinted(i < 3 ? '#7A2BFF' : '#FF2D9B'), x - s, y - s, s * 2, s * 2);
      }
    });
    FX.globalAlpha = 1; FX.globalCompositeOperation = 'source-over';
  }
  FLASH = Math.max(FLASH, hit * .35);
  revealHL(c.hl, t, 54.25, { out: 56.7 });
  revealHL(c.hl2, t, 55.45, { out: 56.75 });
});

/* ================================================================ 13 · A TRANSFORMAÇÃO (57–59s) */
scene(56.75, 59.5, c => {
  const R = c.root;
  // B7: grade organizada, ocupa a tela inteira e é revelada de baixo para cima
  c.b7 = mk(R, '<div class="L" style="overflow:hidden"></div>');
  const g = mk(c.b7, '<div class="L"></div>');
  c.b7g = g;
  const types = [['REELS', 'Lançamento', 'p-ok', 'Aprovado'], ['CARROSSEL', 'Estratégia', 'p-roxo', 'Agendado'], ['VÍDEO', 'Entrevista', 'p-azul', 'Em edição'], ['STORIES', 'Bastidores', 'p-mag', 'Em revisão']];
  for (let row = 0; row < 9; row++) for (let col = 0; col < 2; col++) {
    const [ty, ti, pc, pl] = types[(row * 2 + col + row) % 4];
    mk(g, `<div class="glass" style="left:${70 + col * 480}px;top:${60 + row * 212}px;width:460px;height:190px;border-radius:28px">
      ${thumb({ x: 20, y: 20, w: 110, h: 150, v: row + col, r: 16 })}
      <div class="a" style="left:150px;top:24px;font-size:19px;font-weight:700;letter-spacing:.12em;color:#C4A4FF">${ty}</div>
      <div class="a t-title" style="left:150px;top:54px;font-size:27px">${ti}</div>
      <div class="a" style="left:150px;top:104px"><span class="pill ${pc}" style="font-size:18px;padding:4px 14px">${pl}</span></div>
      <div class="a" style="left:150px;top:152px;width:280px;height:8px;border-radius:4px;background:rgba(255,255,255,.08)"><div style="width:${40 + ((row * 37 + col * 23) % 60)}%;height:100%;border-radius:4px;background:var(--grad)"></div></div></div>`);
  }
  c.chaos = mk(R, '<div class="L" style="overflow:hidden"></div>');
  c.chaosCam = mk(c.chaos, '<div class="L cam"></div>');
  c.items = buildChaos(c.chaosCam, 31, .9);
  c.items.forEach(it => { it.ts = 2.7 + it.order * .45; });
  c.line = mk(R, `<div class="a" style="left:0;top:0;width:1080px;height:6px;background:linear-gradient(90deg,#3D5BFF,#B23BFF,#FF2D9B);box-shadow:0 0 30px #B23BFF,0 0 60px rgba(255,45,155,.6)"></div>`);
  c.antes = mk(R, `<div class="a" style="left:70px;top:250px"><span class="pill" style="font-size:26px;padding:10px 24px;background:rgba(0,0,0,.6);border:1.5px solid rgba(255,255,255,.25);letter-spacing:.14em">ANTES</span></div>`);
  c.depois = mk(R, `<div class="a" style="left:70px;top:0"><span class="pill p-grad" style="font-size:26px;padding:10px 24px;letter-spacing:.14em">DEPOIS</span></div>`);
  c.scrim = mk(R, '<div class="a" style="left:0;top:1000px;width:1080px;height:920px;background:linear-gradient(180deg,rgba(4,3,10,0),rgba(4,3,10,.9) 30%,rgba(4,3,10,.96))"></div>');
  c.hl = headline(R, { y: 1180, lines: ['Menos caos.', 'Mais operação.', '[Mais controle.]'], size: 100 });
}, (t, c) => {
  const inn = ep(t, 56.8, 57.25, E.outQ);
  const take = ep(t, 57.75, 58.55, E.ioQ);
  const out = ep(t, 59.05, 59.5, E.inC);
  const split = lerp(960, 0, take);
  // caos em cima (clip), B7 embaixo
  c.chaos.style.clipPath = `inset(0 0 ${1920 - split}px 0)`;
  c.b7.style.clipPath = `inset(${split}px 0 0 0)`;
  T(c.b7, { o: inn * (1 - out) });
  T(c.b7g, { y: -P(t, 56.8, 59.5) * 120 });
  T(c.chaosCam, { s: .78, y: -200 + take * -300, o: inn * (1 - take) });
  c.chaosCam.style.transformOrigin = '540px 480px';
  drawChaos(c.items, t - 56.75 + 3.2, { boost: .6, sat: .35 });
  T(c.line, { y: split - 3, o: inn * (1 - take) });
  T(c.antes, { o: inn * (1 - take) });
  T(c.depois, { y: split + 40, o: inn * (1 - out) * (1 - ep(t, 58.3, 58.6)) });
  O(c.scrim, ep(t, 56.9, 57.3) * (1 - out));
  revealHL(c.hl, t, 57.1, { stagger: .55, dur: .6, out: 59.0 });
  const em = c.hl.querySelector('em');
  const f = ep(t, 58.2, 58.6);
  em.style.filter = `drop-shadow(0 0 ${(18 + f * 30).toFixed(0)}px rgba(200,70,255,${(.4 + f * .4).toFixed(2)}))`;
  const lns = $$(c.hl, '.ln');
  lns[2].style.fontSize = '1.12em';
});

/* ================================================================ 14 · ENCERRAMENTO (59–62s) */
scene(59.0, 62.01, c => {
  const R = c.root;
  c.halo = mk(R, `<div class="a" style="left:40px;top:340px;width:1000px;height:1000px;border-radius:50%;background:radial-gradient(circle,rgba(122,43,255,.38),rgba(61,91,255,.12) 45%,rgba(0,0,0,0) 70%)"></div>`);
  c.lock = lockup(R, { w: 860 });
  c.pos = { x: 540 - c.lock.w / 2, y: 860 - c.lock.h / 2 };
  c.lock.el.style.left = c.pos.x + 'px'; c.lock.el.style.top = c.pos.y + 'px';
  const sb = c.lock.symBox;
  c.pts = symbolPoints({ x: c.pos.x + sb.x, y: c.pos.y + sb.y, w: sb.w, h: sb.h }, 5, 77);
  c.sc = { x: c.pos.x + sb.x + sb.w / 2, y: c.pos.y + sb.y + sb.h / 2 };
  c.hl = headline(R, { y: 1110, lines: ['O sistema operacional', 'da sua [operação de conteúdo.]'], size: 54, center: true, maxW: 960 });
  c.bar = mk(R, `<div class="a" style="left:470px;top:1290px;width:140px;height:6px;border-radius:3px;background:var(--grad);box-shadow:0 0 20px rgba(178,59,255,.7)"></div>`);
}, (t, c) => {
  const pa = 1 - ep(t, 60.15, 60.45);
  if (pa > 0) drawSymbolParticles(FX, c.pts, t, { cx: c.sc.x, cy: c.sc.y, t0: 59.1, t1: 59.4, t2: 60.2, alpha: pa });
  O(c.lock.sym, ep(t, 60.0, 60.3));
  FLASH = Math.max(FLASH, flash(t, 60.1, .7, .45));
  const wp = ep(t, 60.2, 60.8, E.ioC);
  c.lock.word.style.clipPath = `inset(-10px ${((c.lock.w - c.lock.wordX) * (1 - wp)).toFixed(1)}px -10px 0)`;
  T(c.lock.word, { x: (1 - wp) * -30, o: Math.min(1, wp * 2) });
  T(c.lock.el, { s: 1 + P(t, 60, 62) * .025 });
  T(c.halo, { s: .7 + ep(t, 59.6, 60.6) * .35 + Math.sin(t * 2) * .02, o: ep(t, 59.5, 60.4) * .9 });
  revealHL(c.hl, t, 60.55, { stagger: .15, dur: .8 });
  T(c.bar, { sx: ep(t, 61.0, 61.5, E.outQ), o: ep(t, 61.0, 61.2) });
  if (t > 60.9 && t < 61.8) sweep(t, 60.9, 61.8, .9);
});
