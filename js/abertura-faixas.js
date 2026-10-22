/* =====================================================================
   ABERTURA "STREAMING" — as faixas de luz (zzz230)
   Pedido do Kevin: "queria estilo aquela intro da Netflix".

   Quando a câmera mergulha na lâmpada (CSS abStMarca, 1,75–2,4 s), o
   interior dela vira dezenas de faixas verticais de luz nas cores do
   logo — do azul-violeta ao magenta, ao rosa e a um toque quente:
     1,95–2,6 s  nascem como uma fresta de luz no centro e se abrem
     2,6–3,5 s   enchem a tela e deslizam, cada uma na sua profundidade,
                 com um brilho que atravessa
     3,5–4,0 s   aceleram para fora (a câmera atravessa) e se apagam
   Relógio: o da animação CSS do logo (.ab-marca), como as partículas.
   Só no estilo "streaming", na abertura completa e sem "reduzir movimento".
   ===================================================================== */
(function () {
  'use strict';
  window.B7 = window.B7 || {};
  const html = document.documentElement;
  /* zzz231: depois de cheias, as faixas ficam deslizando até o sistema estar
     pronto; na saída da abertura (.saindo) aceleram para fora por cima dele */
  const T = { nasce: 2.15, cheio: 2.7, saida: .6 };
  const ligada = () => {
    if (html.getAttribute('data-ab-estilo') !== 'streaming') return false;
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch (e) {}
    return !!document.createElement('canvas').getContext;
  };
  /* as cores da lâmpada, da esquerda para a direita */
  const CORES = [[61, 47, 217], [91, 43, 209], [122, 43, 201], [166, 43, 184], [194, 28, 131], [226, 64, 156], [255, 95, 168], [255, 143, 203], [255, 179, 107]];
  const lim = (x, a, b) => Math.max(a, Math.min(b, x));
  const suave = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* uma faixa pronta: tira vertical com o meio claro e as pontas sumindo */
  const tiras = new Map();
  function tira(c, claro) {
    const chave = c.join(',') + (claro ? 'c' : '');
    if (tiras.has(chave)) return tiras.get(chave);
    const cv = document.createElement('canvas'); cv.width = 8; cv.height = 256;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    const cor = a => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
    gr.addColorStop(0, cor(0)); gr.addColorStop(.18, cor(.55)); gr.addColorStop(.5, claro ? 'rgba(255,240,250,1)' : cor(1));
    gr.addColorStop(.82, cor(.55)); gr.addColorStop(1, cor(0));
    g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
    /* bordas laterais mais macias */
    const lado = g.createLinearGradient(0, 0, 8, 0);
    lado.addColorStop(0, 'rgba(0,0,0,.55)'); lado.addColorStop(.3, 'rgba(0,0,0,0)'); lado.addColorStop(.7, 'rgba(0,0,0,0)'); lado.addColorStop(1, 'rgba(0,0,0,.55)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = lado; g.fillRect(0, 0, 8, 256);
    tiras.set(chave, cv);
    return cv;
  }

  function iniciar(el) {
    if (!el || el.dataset.faixas || !ligada()) return;
    if (!el.classList.contains('inicial') || html.classList.contains('ab-curta')) return;
    el.dataset.faixas = '1';
    const marca = el.querySelector('.ab-marca'), simbolo = el.querySelector('.ab-simbolo');
    if (!marca || !simbolo) return;
    const inicio = performance.now();
    const relogio = () => {
      const a = marca.getAnimations ? marca.getAnimations()[0] : null;
      return (a && a.currentTime != null ? Number(a.currentTime) : performance.now() - inicio) / 1000;
    };
    const cv = document.createElement('canvas');
    cv.className = 'ab-faixas'; cv.setAttribute('aria-hidden', 'true');
    el.appendChild(cv);
    const g = cv.getContext('2d');
    const celular = Math.min(innerWidth, innerHeight) < 600;
    /* zzz232: luz borrada não precisa de resolução dupla; no celular desenhar em 2x
       custava 4x mais e travava as faixas (medido: 160 ms por quadro) */
    const dpr = Math.min(window.devicePixelRatio || 1, celular ? 1 : 1.25);
    let W = 0, H = 0;
    let cx = 0, cy = 0;
    /* zzz232: o centro também é medido de novo ao girar o celular (antes as faixas ficavam fora do centro) */
    const medir = () => {
      const r = el.getBoundingClientRect(); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rp = (el.querySelector('.ab-palco') || marca).getBoundingClientRect();
      cx = rp.left - r.left + rp.width / 2; cy = rp.top - r.top + rp.height / 2;
    };
    medir(); addEventListener('resize', medir);
    const N = celular ? 48 : 96;
    const fx = Array.from({ length: N }, (_, i) => {
      const u = Math.random();                                  /* posição na lâmpada: esquerda azul, direita rosa */
      const k = Math.min(CORES.length - 1, Math.floor(u * CORES.length + (Math.random() - .5) * 1.4));
      const c = CORES[Math.max(0, k)];
      const z = .35 + Math.random() * .65;                      /* profundidade: perto = larga e rápida */
      return {
        u: u * 2 - 1, z, sp: tira(c, Math.random() < .08),
        w: (2 + Math.pow(Math.random(), 2.2) * 34) * (celular ? .7 : 1) / z * .55,
        alt: .75 + Math.random() * .7, dy: (Math.random() - .5) * .25,
        vx: (Math.random() - .5) * 140 / z, a: .35 + Math.random() * .55,
        d: Math.random() * .35, fase: Math.random() * 6.28
      };
    });

    let fim = false, saiuEm = 0;
    const parar = () => { if (fim) return; fim = true; removeEventListener('resize', medir); cv.remove(); };
    function quadro() {
      if (fim) return;
      if (!el.isConnected) return parar();
      const agora = performance.now();
      if (el.classList.contains('saindo') && !saiuEm) saiuEm = agora;
      const t = relogio();
      if (saiuEm && agora - saiuEm > T.saida * 1000 + 80) return parar();
      if (!saiuEm && t > 30) return parar();
      g.clearRect(0, 0, W, H);
      if (t < T.nasce) { requestAnimationFrame(quadro); return; }
      g.globalCompositeOperation = 'lighter';
      /* abertura da fresta: a largura útil vai da lâmpada à tela inteira (e além, na saída) */
      const abre = suave(lim((t - T.nasce) / (T.cheio - T.nasce), 0, 1));
      const sai = saiuEm ? lim((agora - saiuEm) / (T.saida * 1000), 0, 1) : 0;
      const meia = (W * .04) + abre * W * .62 + Math.pow(sai, 2) * W * 2.4;
      const brilhoGeral = lim((t - T.nasce) / .25, 0, 1) * (1 - Math.pow(sai, 1.4));
      /* brilho que atravessa da esquerda para a direita */
      const varre = -1.3 + lim((t - 2.7) / .9, 0, 1) * 2.6;
      for (const f of fx) {
        const lt = t - T.nasce - f.d * (1 - abre);
        if (lt < 0) continue;
        /* deslize: enquanto espera, cada faixa dá a volta na tela em vez de sumir pelo lado */
        let deriva = f.vx * Math.max(0, t - T.cheio);
        { const faixa = W * 1.3; deriva = ((deriva + faixa / 2) % faixa + faixa) % faixa - faixa / 2; }
        const x = cx + f.u * meia / Math.pow(f.z, .35) + deriva * (1 + sai * 3);
        const largura = f.w * (.35 + abre * .9 + sai * 2.2);
        const altura = H * f.alt * (.55 + abre * .6 + sai * .4);
        const y = cy - altura / 2 + f.dy * H;
        let a = f.a * brilhoGeral * (.85 + .15 * Math.sin(t * 6 + f.fase));
        const perto = 1 - Math.abs(f.u - varre) / .35;
        if (perto > 0) a = Math.min(1, a + perto * .5);
        if (a <= .01 || x + largura < -50 || x - largura > W + 50) continue;
        g.globalAlpha = a;
        g.drawImage(f.sp, x - largura / 2, y, largura, altura);
      }
      /* clarão no centro enquanto a fresta abre */
      const clarao = (1 - abre) * lim((t - T.nasce) / .15, 0, 1);
      if (clarao > .01) {
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, W * .3);
        gr.addColorStop(0, 'rgba(255,220,240,.55)'); gr.addColorStop(.4, 'rgba(226,64,156,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = clarao; g.fillStyle = gr; g.fillRect(cx - W * .3, cy - W * .3, W * .6, W * .6);   /* só onde o brilho existe */
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
  B7.AberturaFaixas = { iniciar, ligada };
})();
