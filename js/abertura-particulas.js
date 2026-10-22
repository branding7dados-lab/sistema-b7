/* =====================================================================
   ABERTURA — "BIG BANG DE IDEIAS" (zzz227, câmera 3D na zzz228)
   Pedido do Kevin: "quero uma animação de abertura mais foda que essa" e
   depois "mais cinematográfico ainda": as partículas ganharam
   profundidade (perspectiva, foco, bokeh de lente e nebulosa ao fundo) e
   a explosão manda faíscas na direção da câmera.

   Por cima da abertura de cinema que já existia (styles/abertura.css),
   uma camada de partículas desenhada em <canvas>:
     0,0–1,6 s  centenas de pontos de luz giram como uma galáxia
     1,6–3,1 s  a galáxia se fecha em espiral e as partículas MONTAM a
                lâmpada do B7, ponto por ponto, nas cores do próprio logo
     2,9–3,3 s  a carga de luz sobe por dentro dos pontos
     3,4 s      ignição: a lâmpada de verdade acende por cima e as
                partículas explodem em faíscas
     4,4–5,2 s  outras partículas saem da lâmpada e ESCREVEM o
                "Branding7", da esquerda para a direita
   O relógio é o da própria animação CSS (o travelling .ab-marca): se a
   aba fica em segundo plano, as duas param juntas e continuam juntas.

   As partículas seguem a peça real na tela (getBoundingClientRect a cada
   quadro): quando a lâmpada cresce, treme na ignição ou recua para o
   logo, os pontos vão junto.

   Não roda (fica a abertura de antes, sem mudança nenhuma):
     · na versão curta (recarregar), com "reduzir movimento" ou em modo leve;
     · se Configurações → Aparência → "Partículas na abertura" estiver desligado;
     · se a imagem do logo não puder ser lida (ex.: arquivo local).
   Só liga a classe .ab-part (que esconde a lâmpada até a ignição) depois
   que os pontos estão prontos: se algo falhar, nada some da tela.
   ===================================================================== */
(function () {
  'use strict';
  window.B7 = window.B7 || {};
  const html = document.documentElement;
  const T = { galaxia: 1.6, monta: 3.1, carga: 2.9, ign: 3.4, explode: 1.5, palavra: 4.35, escreve: 4.62 };

  const ligada = () => {
    try { const v = localStorage.getItem('b7_pref_abertura_particulas'); if (v !== null && JSON.parse(v) === false) return false; } catch (e) {}
    if (html.classList.contains('modo-leve')) return false;
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch (e) {}
    return !!document.createElement('canvas').getContext;
  };

  /* -------------------------------------------------- pontos do logo
     A lâmpada (symbol-color.png) e a palavra (parte direita do
     logo-white.png) viram listas de pontos (u, v de 0 a 1) com a cor do
     pixel. Lidas uma vez e guardadas. */
  let pontos = null, carregando = null;
  function imagem(src) {
    return new Promise((ok, erro) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = erro; i.src = src; });
  }
  function amostrar(img, recorte, alturaAmostra, passo, comCor) {
    const [x0, y0, w0, h0] = recorte;
    const h = alturaAmostra, w = Math.max(1, Math.round(h * w0 / h0));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, x0, y0, w0, h0, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;      /* lança se a imagem "sujar" o canvas */
    const out = [];
    for (let y = 0; y < h; y += passo) for (let x = 0; x < w; x += passo) {
      const jx = x + (Math.random() - .5) * passo * .8, jy = y + (Math.random() - .5) * passo * .8;
      const px = Math.min(w - 1, Math.max(0, Math.round(jx))), py = Math.min(h - 1, Math.max(0, Math.round(jy)));
      const k = (py * w + px) * 4;
      if (d[k + 3] < 140) continue;
      out.push({ u: px / w, v: py / h, cor: comCor ? [d[k], d[k + 1], d[k + 2]] : null });
    }
    return out;
  }
  function prepararPontos() {
    if (pontos) return Promise.resolve(pontos);
    if (carregando) return carregando;
    carregando = Promise.all([imagem('assets/brand/symbol-color.png'), imagem('assets/brand/logo-white.png')]).then(([sim, logo]) => {
      const lampada = amostrar(sim, [0, 0, sim.naturalWidth, sim.naturalHeight], 150, 3, true);
      /* palavra: a partir de 36% da largura do logo (o mesmo corte do CSS) */
      const x0 = Math.round(logo.naturalWidth * .36);
      const palavra = amostrar(logo, [x0, 0, logo.naturalWidth - x0, logo.naturalHeight], 70, 2, false);
      pontos = { lampada, palavra };
      return pontos;
    });
    carregando.catch(() => { carregando = null; });
    return carregando;
  }

  /* ---------------------------------------------------- brilho pronto
     Um sprite de brilho por cor, desenhado uma vez: cada partícula é um
     drawImage (barato) em modo "lighter" (as luzes somam). */
  const sprites = new Map();
  function sprite(r, g, b) {
    const q = 24, chave = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4);
    if (sprites.has(chave)) return sprites.get(chave);
    const c = document.createElement('canvas'); c.width = c.height = q * 2;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(q, q, 0, q, q, q);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(.18, 'rgba(' + r + ',' + g + ',' + b + ',.95)');
    gr.addColorStop(.45, 'rgba(' + r + ',' + g + ',' + b + ',.28)');
    gr.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    x.fillStyle = gr; x.fillRect(0, 0, q * 2, q * 2);
    sprites.set(chave, c);
    return c;
  }
  /* bokeh de lente: disco quase chapado com a borda um pouco mais clara */
  function disco(r, g, b) {
    const q = 48, chave = 'd' + r + ',' + g + ',' + b;
    if (sprites.has(chave)) return sprites.get(chave);
    const c = document.createElement('canvas'); c.width = c.height = q * 2;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(q, q, 0, q, q, q);
    const cor = a => 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    gr.addColorStop(0, cor(.55)); gr.addColorStop(.72, cor(.5)); gr.addColorStop(.86, cor(.85)); gr.addColorStop(.94, cor(.25)); gr.addColorStop(1, cor(0));
    x.fillStyle = gr; x.fillRect(0, 0, q * 2, q * 2);
    sprites.set(chave, c);
    return c;
  }
  /* nuvem da nebulosa: grande e bem macia */
  function nuvem(r, g, b) {
    const q = 128, chave = 'n' + r + ',' + g + ',' + b;
    if (sprites.has(chave)) return sprites.get(chave);
    const c = document.createElement('canvas'); c.width = c.height = q * 2;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(q, q, 0, q, q, q);
    const cor = a => 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    gr.addColorStop(0, cor(1)); gr.addColorStop(.35, cor(.55)); gr.addColorStop(.7, cor(.15)); gr.addColorStop(1, cor(0));
    x.fillStyle = gr; x.fillRect(0, 0, q * 2, q * 2);
    sprites.set(chave, c);
    return c;
  }
  const PALETA = [[255, 143, 203], [226, 64, 156], [169, 139, 255], [124, 80, 220], [255, 214, 240]];

  /* ----------------------------------------------------------- curvas */
  const lim = (x, a, b) => Math.max(a, Math.min(b, x));
  const suave = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const sai = t => 1 - Math.pow(1 - t, 3);
  const misturar = (a, b, t) => a + (b - a) * t;

  /* ------------------------------------------------------- uma abertura */
  function iniciar(el) {
    if (!el || el.dataset.particulas || !ligada()) return;
    if (!el.classList.contains('inicial') || html.classList.contains('ab-curta')) return;
    el.dataset.particulas = '1';
    const inicioParede = performance.now();
    prepararPontos().then(p => {
      if (!el.isConnected || el.classList.contains('saindo')) return;
      /* tarde demais (imagem demorou): a sequência já passou do começo,
         a lâmpada já está aparecendo — fica a abertura de antes */
      const marca = el.querySelector('.ab-marca');
      const relogio = () => {
        const a = marca && marca.getAnimations ? marca.getAnimations()[0] : null;
        const t = a && a.currentTime != null ? Number(a.currentTime) : performance.now() - inicioParede;
        return t / 1000;
      };
      if (relogio() > 1.3) return;
      rodar(el, p, relogio);
    }).catch(() => { /* sem leitura do logo: fica a abertura de antes */ });
  }

  function rodar(el, P, relogio) {
    const cv = document.createElement('canvas');
    cv.className = 'ab-particulas';
    cv.setAttribute('aria-hidden', 'true');
    const palco = el.querySelector('.ab-palco');
    el.insertBefore(cv, palco);
    const g = cv.getContext('2d');
    const simbolo = el.querySelector('.ab-simbolo'), marca = el.querySelector('.ab-marca');
    const celular = Math.min(innerWidth, innerHeight) < 600;
    const dpr = Math.min(window.devicePixelRatio || 1, celular ? 2 : 1.75);
    let W = 0, H = 0;
    const medir = () => {
      const r = el.getBoundingClientRect();
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    medir();
    addEventListener('resize', medir);

    /* zzz228 — câmera em 3D. Cada partícula tem posição no espaço
       relativa à câmera (X, Y, Z); a tela é a projeção x = cx + X·F/Z.
       Z = F é o plano de foco (escala 1, nítido); mais longe fica pequeno
       e desfocado, mais perto fica grande e desfocado (bokeh). */
    const N = celular ? 420 : 900;
    const fonte = P.lampada.slice().sort(() => Math.random() - .5).slice(0, N);
    const F = Math.max(W, H) * .9;
    const ps = fonte.map((pt, i) => {
      const cor = pt.cor || PALETA[i % PALETA.length];
      /* clareia um pouco: no escuro a cor do logo some */
      const c = cor.map(x => Math.min(255, Math.round(x * .75 + 70)));
      return {
        u: pt.u, v: pt.v, sp: sprite(c[0], c[1], c[2]),
        r0: F * (.12 + Math.pow(Math.random(), .8) * 1.05),
        a0: Math.random() * Math.PI * 2,
        w: (.3 + Math.random() * .45),
        z0: F * (1.5 + Math.random() * 4),
        d: Math.random() * .55,
        tam: .7 + Math.random() * 1.1,
        fase: Math.random() * 6.28,
        /* explosão: velocidade no plano e em profundidade (a maioria vem para a lente) */
        vel: (300 + Math.random() * 900) * (celular ? .7 : 1),
        vz: -F * (Math.random() < .35 ? .9 + Math.random() * 1.6 : Math.random() * .5),
        desvio: (Math.random() - .5) * .9
      };
    });
    /* bokeh: luzes grandes e fora de foco que passam perto da câmera */
    const bokeh = Array.from({ length: celular ? 12 : 22 }, (_, i) => {
      const c = PALETA[i % PALETA.length];
      return { sp: disco(c[0], c[1], c[2]), x: (Math.random() - .5) * 2.4 * F, y: (Math.random() - .5) * 1.6 * F,
        z0: F * (.3 + Math.random() * 3), tam: .6 + Math.random() * .9, a: .1 + Math.random() * .12 };
    });
    /* nebulosa: nuvens de cor ao fundo, para o espaço ter volume */
    const NEB = [[124, 60, 210], [194, 28, 131], [58, 30, 134], [226, 64, 156], [80, 70, 220], [160, 40, 170], [90, 40, 160]];
    const nevoa = NEB.map((c, i) => ({ sp: nuvem(c[0], c[1], c[2]), x: (Math.random() - .5) * 1.8 * F, y: (Math.random() - .5) * 1.1 * F,
      z0: F * (2.4 + i * .8 + Math.random()), tam: .7 + Math.random() * .6 }));
    /* quanto a câmera andou: rápido no começo, freando até parar na lâmpada */
    const voo = t => F * 1.4 * (1 - Math.pow(1 - lim(t / T.monta, 0, 1), 2));
    /* partículas da palavra */
    const NW = celular ? 260 : 420;
    const fw = P.palavra.slice().sort(() => Math.random() - .5).slice(0, NW);
    const pw = fw.map((pt, i) => {
      const c = PALETA[(i * 7) % PALETA.length];
      return { u: pt.u, v: pt.v, sp: sprite(c[0], c[1], c[2]), d: Math.random() * .12, tam: .55 + Math.random() * .7, arco: (Math.random() - .5) * 60 };
    });
    el.classList.add('ab-part');
    /* a lâmpada de verdade fica apagada até a ignição: quem a desenha
       antes são os pontos (opacidade não é animada pelo CSS dela) */
    const cor = el.querySelector('.ab-cor');

    let fim = false, ultimo = 0, lentos = 0, leve = false;
    const parar = () => {
      if (fim) return; fim = true;
      removeEventListener('resize', medir);
      if (cor) cor.style.opacity = '';
      cv.remove();
    };
    const vigia = new MutationObserver(() => {
      if (!el.isConnected) { vigia.disconnect(); parar(); }
    });
    try { vigia.observe(el.parentNode || document.body, { childList: true }); } catch (e) {}

    function quadro(agora) {
      if (fim) return;
      if (!el.isConnected) return parar();
      /* desempenho: se o aparelho não acompanha, desenha só o miolo */
      if (ultimo) { const dt = agora - ultimo; if (dt > 34) lentos++; else lentos = Math.max(0, lentos - 1); if (lentos > 12) leve = true; }
      ultimo = agora;
      const t = relogio();
      if (el.classList.contains('saindo') || t > 7.5) return parar();
      /* rastro: o quadro anterior não some de uma vez (só enquanto as
         partículas giram e explodem; parado, o rastro viraria borrão) */
      const rastro = !leve && (t < T.monta - .1 || (t > T.ign && t < T.ign + .9));
      if (rastro) {
        g.globalCompositeOperation = 'destination-out';
        g.fillStyle = 'rgba(0,0,0,.32)'; g.globalAlpha = 1;
        g.fillRect(0, 0, W, H);
      } else g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';

      if (cor) cor.style.opacity = t < T.ign - .25 ? '0' : t < T.ign ? String(((t - T.ign + .25) / .25).toFixed(3)) : '';
      const rs = simbolo.getBoundingClientRect(), re = el.getBoundingClientRect();
      const sx = rs.left - re.left, sy = rs.top - re.top, sw = rs.width, sh = rs.height;
      /* o centro da galáxia é o centro da lâmpada */
      const cx = sx + sw / 2, cy = sy + sh / 2;
      /* a imagem do símbolo é "contain" dentro da caixa: largura útil */
      const lado = Math.min(sw, sh * (297 / 354)), ox = sx + (sw - lado) / 2, alt = lado * (354 / 297), oy = sy + (sh - alt) / 2;
      /* o brilho de cada ponto acompanha o tamanho da lâmpada na tela */
      const escala = lim(lado / 40, 3.2, 8.5);

      /* plano de fundo: nebulosa e bokeh (no rastro, o quadro anterior soma: compensa) */
      const fundo = rastro ? .34 : 1;
      const percorrido = voo(t);
      const fundoVisivel = lim(t / .9, 0, 1) * (t > T.ign + .6 ? lim(1 - (t - T.ign - .6) / 1.4, 0, 1) : 1);
      if (fundoVisivel > 0) {
        for (const n of nevoa) {
          const Z = n.z0 - percorrido * .9; if (Z < F * .4) continue;
          const f = F / Z, q = F * .55 * n.tam * f;
          g.globalAlpha = .17 * fundo * fundoVisivel * lim((Z - F * .4) / F, 0, 1);
          g.drawImage(n.sp, cx + n.x * f - q, cy + n.y * f - q, q * 2, q * 2);
        }
        for (const b of bokeh) {
          /* volta para o fundo quando passa pela câmera */
          const Z = F * .25 + ((b.z0 - percorrido * 2.6) % (F * 3.2) + F * 3.2) % (F * 3.2);
          const f = F / Z, q = Math.min(F * .14, F * .02 * b.tam * f);
          g.globalAlpha = b.a * fundo * fundoVisivel * lim((Z - F * .25) / (F * .35), 0, 1) * lim((F * 3.4 - Z) / F, 0, 1);
          g.drawImage(b.sp, cx + b.x * f - q, cy + b.y * f - q, q * 2, q * 2);
        }
      }

      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (leve && (i & 1)) continue;
        const tx = ox + p.u * lado, ty = oy + p.v * alt;
        let X, Y, Z, a, s = p.tam;
        if (t < T.ign) {
          /* voo: a câmera atravessa um redemoinho de luz em profundidade */
          const giro = p.a0 + p.w * t + (t > T.galaxia ? (t - T.galaxia) * p.w * 1.6 : 0);
          const gX = Math.cos(giro) * p.r0, gY = Math.sin(giro) * p.r0 * .55, gZ = p.z0 - percorrido;
          const k = suave(lim((t - T.galaxia - p.d) / (T.monta - T.galaxia - .55), 0, 1));
          X = misturar(gX, tx - cx, k); Y = misturar(gY, ty - cy, k); Z = misturar(gZ, F, k);
          a = lim((t - .05) / .8, 0, 1) * (.7 + .3 * k);
          if (k >= 1) { X += Math.sin(t * 9 + p.fase) * .6; Y += Math.cos(t * 7 + p.fase) * .6; }   /* montada: respira */
          /* carga: uma faixa de luz sobe por dentro dos pontos */
          if (t > T.carga) {
            const nivel = 1 - (t - T.carga) / (T.ign - T.carga);
            const perto = 1 - Math.abs(p.v - nivel) / .16;
            if (perto > 0) { s *= 1 + perto * 1.4; a = Math.min(1, a + perto * .6); }
          }
          /* a lâmpada de verdade entra por cima: os pontos cedem o lugar */
          if (t > T.ign - .2) a *= .55;
        } else {
          /* explosão em 3D: parte das faíscas vem na direção da lente */
          const dt = t - T.ign;
          if (dt > T.explode) continue;
          const ang = Math.atan2(ty - cy, tx - cx) + p.desvio;
          const amort = (1 - Math.exp(-dt * 2.4)) / 2.4;
          X = tx - cx + Math.cos(ang) * p.vel * amort; Y = ty - cy + Math.sin(ang) * p.vel * amort + dt * dt * 40;
          Z = F + p.vz * amort;
          a = Math.pow(1 - dt / T.explode, 1.5);
          s *= 1 + (1 - dt / T.explode) * .8;
        }
        if (Z < F * .12) continue;
        const f = F / Z;
        /* profundidade de campo: fora do plano de foco, maior e mais apagado */
        const dof = Math.min(2.6, Math.abs(Math.log(f)) * .9);
        /* neblina: bem ao fundo, quase some */
        a *= lim(1.8 - Z / (F * 5), .25, 1) / (1 + dof * .55);
        if (a <= .01) continue;
        const q = Math.min(F * (celular ? .045 : .07), s * escala * f * (1 + dof));
        g.globalAlpha = a;
        g.drawImage(p.sp, cx + X * f - q, cy + Y * f - q, q * 2, q * 2);
      }

      /* a palavra: sai da lâmpada e se escreve da esquerda para a direita */
      if (t > T.palavra && t < T.escreve + 1.2) {
        const rm = marca.getBoundingClientRect();
        const mx = rm.left - re.left, my = rm.top - re.top;
        const wx0 = mx + rm.width * .36, ww = rm.width * .64, wh = rm.height;
        const ex = sx + sw * .7, ey = cy;                /* bico da lâmpada */
        for (let i = 0; i < pw.length; i++) {
          if (leve && (i & 1)) continue;
          const p = pw[i];
          const chega = T.escreve + p.u * .45 + p.d;        /* esquerda primeiro */
          const parte = chega - .38;
          if (t < parte) continue;
          const k = sai(lim((t - parte) / (chega - parte), 0, 1));
          const tx = wx0 + p.u * ww, ty = my + p.v * wh;
          const x = misturar(ex, tx, k), y = misturar(ey, ty, k) - Math.sin(k * Math.PI) * p.arco;
          const depois = t - chega;
          const a = depois < 0 ? .25 + .75 * k : Math.max(0, 1 - depois / .45);
          if (a <= .01) continue;
          const q = p.tam * lim(wh / 20, 3, 7) * (depois < 0 ? 1 : 1 + depois);
          g.globalAlpha = a;
          g.drawImage(p.sp, x - q, y - q, q * 2, q * 2);
        }
      }
      g.globalAlpha = 1;
      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);
  }

  /* a abertura da página (já está no HTML, logo acima deste script) */
  const inicial = document.getElementById('abertura');
  if (inicial) iniciar(inicial);
  /* aberturas montadas depois: "Testar abertura" e o Painel de TV */
  const olhar = () => {
    try {
      new MutationObserver(lista => {
        for (const m of lista) for (const n of m.addedNodes) {
          if (n.nodeType === 1 && n.classList.contains('b7-abertura')) {
            /* espera o próximo quadro: quem criou ainda pode mexer nas classes */
            requestAnimationFrame(() => iniciar(n));
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  };
  if (document.body) olhar(); else document.addEventListener('DOMContentLoaded', olhar);
  B7.AberturaParticulas = { iniciar, ligada };
})();
