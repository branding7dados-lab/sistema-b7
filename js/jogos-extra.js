/* =====================================================================
   JOGOS EXTRAS DO CONSOLE B7 (zzz297) — carregados só quando o console abre
     drone     tipo "flappy": toque/espaço/clique sobe; passe entre as torres
     cobra     "Cabo Solto": a cobrinha clássica (setas/WASD ou deslize)
     fusao     2048 (setas/WASD ou deslize)
     claquete  quebra-blocos (mouse/dedo ou setas)
   Cada um: montar(caixa) → { parar }. Recorde em localStorage b7_jx_rec_<id>.
   ===================================================================== */
window.B7 = window.B7 || {};
B7.JogosExtra = (function () {
  const COR = { fundo: '#0B0618', roxo: '#7B4DFF', mag: '#E2409C', azul: '#4C6FFF', rosa: '#FF8FCB', ouro: '#FFB36B', txt: '#EDE7FF' };
  const lerRec = id => { try { return +localStorage.getItem('b7_jx_rec_' + id) || 0; } catch (e) { return 0; } };
  const salvarRec = (id, v) => { if (v > lerRec(id)) { try { localStorage.setItem('b7_jx_rec_' + id, String(v)); } catch (e) {} return true; } return false; };

  /* moldura comum: palco com canvas que se ajusta, placar e tela de início/fim */
  function moldura(caixa, id, titulo, dica, proporcao) {
    const el = document.createElement('div');
    el.className = 'jx';
    el.innerHTML = '<div class="jx-hud"><span>Pontos <b class="jx-pts">0</b></span><span>🏆 <b class="jx-rec">' + lerRec(id) + '</b></span></div>' +
      '<div class="jx-area"><canvas></canvas><div class="jx-tela"><b>' + titulo + '</b><p>' + dica + '</p><button type="button" class="jx-bt">▶ Jogar</button></div></div>';
    caixa.appendChild(el);
    const cv = el.querySelector('canvas'), g = cv.getContext('2d'), area = el.querySelector('.jx-area'), tela = el.querySelector('.jx-tela');
    const m = { el, cv, g, W: 0, H: 0, aoMedir: null };
    m.medir = () => {
      const r = area.getBoundingClientRect();
      let w = r.width, h = r.height;
      if (proporcao) { if (w / h > proporcao) w = h * proporcao; else h = w / proporcao; }
      const dpr = Math.min(devicePixelRatio || 1, 2);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0); m.W = w; m.H = h;
      if (m.aoMedir) m.aoMedir();
    };
    m.pts = v => { el.querySelector('.jx-pts').textContent = v; };
    m.mostrar = (tit, txt, bt) => { tela.querySelector('b').textContent = tit; tela.querySelector('p').textContent = txt; tela.querySelector('.jx-bt').textContent = bt || '▶ Jogar de novo'; tela.hidden = false; };
    m.esconder = () => { tela.hidden = true; };
    m.fim = (pts, tit) => {
      const novo = salvarRec(id, pts);
      el.querySelector('.jx-rec').textContent = lerRec(id);
      m.mostrar(tit || 'Fim de jogo', pts + ' pontos' + (novo && pts ? ' · novo recorde! 🎉' : ''));
    };
    m.aoJogar = fn => { tela.querySelector('.jx-bt').onclick = e => { e.stopPropagation(); m.esconder(); fn(); }; };
    const ro = window.ResizeObserver ? new ResizeObserver(() => m.medir()) : null;
    if (ro) ro.observe(area); else addEventListener('resize', m.medir);
    requestAnimationFrame(m.medir);
    const ouvintes = [];
    m.ouvir = (alvo, ev, fn, op) => { alvo.addEventListener(ev, fn, op); ouvintes.push([alvo, ev, fn, op]); };
    m.desmontar = () => { if (ro) ro.disconnect(); else removeEventListener('resize', m.medir); ouvintes.forEach(([a, e, f, o]) => a.removeEventListener(e, f, o)); el.remove(); };
    return m;
  }
  /* direção por deslize no celular */
  function deslize(m, fn) {
    let x0 = 0, y0 = 0;
    m.ouvir(m.cv, 'touchstart', e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
    m.ouvir(m.cv, 'touchend', e => {
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'd' : 'e') : (dy > 0 ? 'b' : 'c'));
    }, { passive: true });
  }
  const dirTecla = k => ({ ArrowUp: 'c', KeyW: 'c', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'e', KeyA: 'e', ArrowRight: 'd', KeyD: 'd' })[k];
  function rr(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }

  /* =========================================================== DRONE */
  function drone(caixa) {
    const m = moldura(caixa, 'drone', '🚁 Drone B7', 'Toque, clique ou espaço para subir. Passe entre as torres!', 9 / 14);
    let raf = 0, vivo = false, y, vy, canos, pts, t0, ult;
    const reset = () => { y = m.H * .45; vy = 0; canos = []; pts = 0; t0 = 0; m.pts(0); };
    const pular = () => { if (vivo) vy = -m.H * .62; };
    function quadro(t) {
      const dt = Math.min(.033, ult ? (t - ult) / 1000 : 0); ult = t;
      const { g, W, H } = m;
      if (vivo) {
        vy += H * 1.9 * dt; y += vy * dt;
        t0 -= dt;
        if (t0 <= 0) { t0 = 1.45; const vao = H * .3, topo = H * .12 + Math.random() * (H * .76 - vao); canos.push({ x: W + 30, topo, vao, ok: false }); }
        const vel = W * .42 + pts * 3;
        canos.forEach(c => { c.x -= vel * dt; if (!c.ok && c.x + 30 < W * .28) { c.ok = true; pts++; m.pts(pts); } });
        canos = canos.filter(c => c.x > -70);
        const r = H * .03, dx = W * .28;
        if (y < r || y > H - r) morrer();
        canos.forEach(c => { if (dx + r > c.x && dx - r < c.x + 56 && (y - r < c.topo || y + r > c.topo + c.vao)) morrer(); });
      }
      /* desenho */
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#120a2e'); gr.addColorStop(1, '#3a1048');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,.5)';
      for (let i = 0; i < 30; i++) { const sx = (i * 97 + (t * .01 * (1 + i % 3))) % W; g.fillRect(W - sx, (i * 53) % (H * .7), 1.5, 1.5); }
      canos.forEach(c => {
        const gc = g.createLinearGradient(c.x, 0, c.x + 56, 0); gc.addColorStop(0, COR.roxo); gc.addColorStop(1, COR.mag);
        g.fillStyle = gc; rr(g, c.x, -10, 56, c.topo + 10, 8); g.fill(); rr(g, c.x, c.topo + c.vao, 56, H - c.topo - c.vao + 10, 8); g.fill();
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(c.x + 8, 0, 6, c.topo - 8); g.fillRect(c.x + 8, c.topo + c.vao + 8, 6, H);
      });
      const r = H * .03, dx = W * .28;
      g.save(); g.translate(dx, y); g.rotate(Math.max(-.4, Math.min(.6, vy / (H * 1.5))));
      g.fillStyle = '#fff'; rr(g, -r * 1.3, -r * .6, r * 2.6, r * 1.2, r * .5); g.fill();
      g.fillStyle = COR.mag; g.beginPath(); g.arc(r * .7, 0, r * .35, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; const hel = Math.sin(t * .08) * r * 1.4;
      g.beginPath(); g.moveTo(-r * 1.6 - hel * .3, -r * .9); g.lineTo(-r * .2 + hel * .3, -r * .9); g.moveTo(r * .2 - hel * .3, -r * .9); g.lineTo(r * 1.6 + hel * .3, -r * .9); g.stroke();
      g.restore();
      raf = requestAnimationFrame(quadro);
    }
    function morrer() { if (!vivo) return; vivo = false; m.fim(pts, '💥 Bateu!'); }
    m.aoJogar(() => { reset(); vivo = true; pular(); });
    m.ouvir(m.cv, 'pointerdown', e => { e.preventDefault(); pular(); });
    m.ouvir(window, 'keydown', e => { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); pular(); } });
    m.aoMedir = () => { if (!vivo) reset(); };
    raf = requestAnimationFrame(quadro);
    return { parar() { cancelAnimationFrame(raf); m.desmontar(); } };
  }

  /* =========================================================== COBRA */
  function cobra(caixa) {
    const m = moldura(caixa, 'cobra', '🐍 Cabo Solto', 'Pegue os cartões de memória e não se enrosque no próprio cabo. Setas ou deslize.', 1);
    const N = 18;
    let corpo, dir, prox, comida, pts, vivo = false, tick = 0, raf = 0, acc = 0, ult = 0;
    const lugar = () => { let p; do { p = { x: (Math.random() * N) | 0, y: (Math.random() * N) | 0 }; } while (corpo.some(c => c.x === p.x && c.y === p.y)); return p; };
    const reset = () => { corpo = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }]; dir = prox = 'd'; pts = 0; m.pts(0); comida = lugar(); };
    const OP = { c: 'b', b: 'c', e: 'd', d: 'e' };
    const virar = d => { if (d && OP[d] !== dir) prox = d; };
    function passo() {
      dir = prox;
      const h = corpo[0], n = { x: h.x + (dir === 'd') - (dir === 'e'), y: h.y + (dir === 'b') - (dir === 'c') };
      if (n.x < 0 || n.y < 0 || n.x >= N || n.y >= N || corpo.some(c => c.x === n.x && c.y === n.y)) { vivo = false; m.fim(pts, '🔌 Enroscou!'); return; }
      corpo.unshift(n);
      if (n.x === comida.x && n.y === comida.y) { pts += 10; m.pts(pts); comida = lugar(); } else corpo.pop();
    }
    function quadro(t) {
      const dt = ult ? t - ult : 0; ult = t; acc += dt;
      const vel = Math.max(65, 140 - pts * .6);
      while (vivo && acc > vel) { acc -= vel; passo(); }
      if (!vivo) acc = 0;
      const { g, W } = m, s = W / N;
      g.fillStyle = COR.fundo; g.fillRect(0, 0, W, W);
      g.fillStyle = 'rgba(255,255,255,.03)';
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2) g.fillRect(i * s, j * s, s, s);
      if (corpo) {
        g.fillStyle = COR.ouro; rr(g, comida.x * s + s * .2, comida.y * s + s * .15, s * .6, s * .7, 3); g.fill();
        g.fillStyle = '#5a3a00'; g.fillRect(comida.x * s + s * .3, comida.y * s + s * .2, s * .4, s * .15);
        corpo.forEach((c, i) => {
          const k = i / Math.max(1, corpo.length - 1);
          g.fillStyle = 'rgb(' + Math.round(123 + (226 - 123) * k) + ',' + Math.round(77 - 13 * k) + ',' + Math.round(255 - 99 * k) + ')';
          rr(g, c.x * s + 1.5, c.y * s + 1.5, s - 3, s - 3, i ? s * .3 : s * .4); g.fill();
        });
        const h = corpo[0]; g.fillStyle = '#fff'; g.beginPath(); g.arc(h.x * s + s / 2, h.y * s + s / 2, s * .14, 0, 7); g.fill();
      }
      raf = requestAnimationFrame(quadro);
    }
    m.aoJogar(() => { reset(); vivo = true; });
    m.ouvir(window, 'keydown', e => { const d = dirTecla(e.code); if (d) { e.preventDefault(); virar(d); } });
    deslize(m, virar);
    reset();
    raf = requestAnimationFrame(quadro);
    return { parar() { cancelAnimationFrame(raf); m.desmontar(); } };
  }

  /* =========================================================== 2048 */
  function fusao(caixa) {
    const m = moldura(caixa, 'fusao', '🔢 Fusão 2048', 'Deslize (ou use as setas): números iguais se juntam. Chegue no 2048!', 1);
    const CORES = { 2: '#3a2a6b', 4: '#4b2f8f', 8: '#6a2fb3', 16: '#7B4DFF', 32: '#9a3fd6', 64: '#B5248F', 128: '#C2187A', 256: '#E2409C', 512: '#FF5FA8', 1024: '#FF8FCB', 2048: '#FFB36B' };
    let grade, pts, vivo = false, raf = 0, anim = 0;
    const vazio = () => { const v = []; grade.forEach((l, y) => l.forEach((n, x) => { if (!n) v.push([x, y]); })); return v; };
    const novo = () => { const v = vazio(); if (!v.length) return; const [x, y] = v[(Math.random() * v.length) | 0]; grade[y][x] = Math.random() < .9 ? 2 : 4; };
    const reset = () => { grade = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; pts = 0; m.pts(0); novo(); novo(); };
    function linha(l) {
      const n = l.filter(Boolean), r = [];
      for (let i = 0; i < n.length; i++) { if (n[i] === n[i + 1]) { r.push(n[i] * 2); pts += n[i] * 2; i++; } else r.push(n[i]); }
      while (r.length < 4) r.push(0); return r;
    }
    function mover(d) {
      if (!vivo) return;
      const antes = JSON.stringify(grade);
      for (let i = 0; i < 4; i++) {
        let l = d === 'e' || d === 'd' ? grade[i].slice() : grade.map(r => r[i]);
        if (d === 'd' || d === 'b') l.reverse();
        l = linha(l);
        if (d === 'd' || d === 'b') l.reverse();
        if (d === 'e' || d === 'd') grade[i] = l; else l.forEach((v, y) => { grade[y][i] = v; });
      }
      if (JSON.stringify(grade) === antes) return;
      novo(); m.pts(pts); anim = performance.now();
      if (grade.some(l => l.includes(2048))) { vivo = false; m.fim(pts, '🎉 2048!'); return; }
      const travado = !vazio().length && !grade.some((l, y) => l.some((n, x) => n === l[x + 1] || (grade[y + 1] && n === grade[y + 1][x])));
      if (travado) { vivo = false; m.fim(pts, 'Sem jogadas'); }
    }
    function quadro(t) {
      const { g, W } = m, gap = W * .025, s = (W - gap * 5) / 4;
      g.fillStyle = COR.fundo; g.fillRect(0, 0, W, W);
      const pulso = Math.max(0, 1 - (t - anim) / 160);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const n = grade ? grade[y][x] : 0, px = gap + x * (s + gap), py = gap + y * (s + gap);
        g.fillStyle = n ? (CORES[n] || '#FFB36B') : 'rgba(255,255,255,.05)';
        const z = n ? pulso * 3 : 0;
        rr(g, px - z, py - z, s + 2 * z, s + 2 * z, s * .14); g.fill();
        if (n) {
          g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.font = '800 ' + Math.round(s * (n < 100 ? .42 : n < 1000 ? .34 : .27)) + 'px system-ui,sans-serif';
          g.fillText(n, px + s / 2, py + s / 2 + 1);
        }
      }
      raf = requestAnimationFrame(quadro);
    }
    m.aoJogar(() => { reset(); vivo = true; });
    m.ouvir(window, 'keydown', e => { const d = dirTecla(e.code); if (d) { e.preventDefault(); mover(d); } });
    deslize(m, mover);
    reset();
    raf = requestAnimationFrame(quadro);
    return { parar() { cancelAnimationFrame(raf); m.desmontar(); } };
  }

  /* =========================================================== CLAQUETE */
  function claquete(caixa) {
    const m = moldura(caixa, 'claquete', '🎬 Quebra-Claquete', 'Mova com o mouse, o dedo ou as setas. Não deixe a bola cair!', 4 / 5);
    let raf = 0, vivo = false, bx, by, vx, vy, px, blocos, pts, vidas, fase, ult = 0, teclas = {};
    const CL = 8, LN = 6;
    function montarBlocos() {
      blocos = [];
      for (let l = 0; l < LN; l++) for (let c = 0; c < CL; c++) blocos.push({ c, l, vivo: true, duro: fase > 1 && l < 2 ? 2 : 1 });
    }
    const bola = () => { bx = m.W / 2; by = m.H * .7; const v = m.H * (.55 + fase * .06); vx = v * .5 * (Math.random() < .5 ? -1 : 1); vy = -v * .85; };
    const reset = () => { pts = 0; vidas = 3; fase = 1; m.pts(0); px = m.W / 2; montarBlocos(); bola(); };
    function quadro(t) {
      const dt = Math.min(.025, ult ? (t - ult) / 1000 : 0); ult = t;
      const { g, W, H } = m, pw = W * .2, ph = H * .022, py = H * .92, r = W * .016;
      const bw = (W - 20) / CL, bh = H * .045, top = H * .1;
      if (vivo) {
        if (teclas.e) px -= W * 1.3 * dt; if (teclas.d) px += W * 1.3 * dt;
        px = Math.max(pw / 2, Math.min(W - pw / 2, px));
        bx += vx * dt; by += vy * dt;
        if (bx < r) { bx = r; vx = Math.abs(vx); } if (bx > W - r) { bx = W - r; vx = -Math.abs(vx); } if (by < r) { by = r; vy = Math.abs(vy); }
        if (vy > 0 && by + r > py && by - r < py + ph && bx > px - pw / 2 - r && bx < px + pw / 2 + r) {
          const k = (bx - px) / (pw / 2), v = Math.hypot(vx, vy) * 1.01;
          vx = v * k * .8; vy = -Math.sqrt(Math.max(v * v - vx * vx, v * v * .3)); by = py - r;
        }
        for (const b of blocos) {
          if (!b.vivo) continue;
          const x = 10 + b.c * bw, y = top + b.l * bh;
          if (bx + r > x && bx - r < x + bw && by + r > y && by - r < y + bh) {
            const sobre = Math.min(bx + r - x, x + bw - bx + r) < Math.min(by + r - y, y + bh - by + r);
            if (sobre) vx = -vx; else vy = -vy;
            if (--b.duro <= 0) { b.vivo = false; pts += 10 * fase; m.pts(pts); }
            break;
          }
        }
        if (!blocos.some(b => b.vivo)) { fase++; montarBlocos(); bola(); }
        if (by > H + r) { vidas--; if (vidas <= 0) { vivo = false; m.fim(pts, '🎬 Corta!'); } else bola(); }
      }
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#120a2e'); gr.addColorStop(1, '#0b0618');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      if (blocos) blocos.forEach(b => {
        if (!b.vivo) return;
        const x = 10 + b.c * bw, y = top + b.l * bh, k = b.l / (LN - 1);
        g.fillStyle = b.duro > 1 ? '#fff' : 'rgb(' + Math.round(76 + 150 * k) + ',' + Math.round(111 - 47 * k) + ',' + Math.round(255 - 99 * k) + ')';
        rr(g, x + 2, y + 2, bw - 4, bh - 4, 4); g.fill();
        if (b.duro > 1) { g.fillStyle = '#111'; for (let i = 0; i < 4; i++) g.fillRect(x + 6 + i * (bw - 12) / 4, y + 4, (bw - 12) / 8, bh - 8); }
      });
      g.fillStyle = COR.txt; g.font = '600 12px system-ui,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText('Fase ' + (fase || 1) + '   ' + '❤'.repeat(Math.max(0, vidas || 0)), 10, 10);
      const gp = g.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0); gp.addColorStop(0, COR.roxo); gp.addColorStop(1, COR.mag);
      g.fillStyle = gp; rr(g, px - pw / 2, py, pw, ph, ph / 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, r, 0, 7); g.fill();
      raf = requestAnimationFrame(quadro);
    }
    const seguir = e => { const r = m.cv.getBoundingClientRect(); px = (e.clientX - r.left) * (m.W / r.width); };
    m.ouvir(m.cv, 'pointermove', seguir); m.ouvir(m.cv, 'pointerdown', seguir);
    m.ouvir(window, 'keydown', e => { const d = dirTecla(e.code); if (d === 'e' || d === 'd') { e.preventDefault(); teclas[d] = true; } });
    m.ouvir(window, 'keyup', e => { const d = dirTecla(e.code); if (d) teclas[d] = false; });
    m.aoJogar(() => { reset(); vivo = true; });
    m.aoMedir = () => { if (!vivo) reset(); };
    raf = requestAnimationFrame(quadro);
    return { parar() { cancelAnimationFrame(raf); m.desmontar(); } };
  }

  return { drone, cobra, fusao, claquete };
})();
