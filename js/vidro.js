/* =====================================================================
   VIDRO LÍQUIDO (zzz303) — a barra de baixo como o Liquid Glass da Apple

   O vidro de verdade não só desfoca: ele DOBRA o que está atrás perto das
   bordas (como uma lente grossa), separa um pouco as cores no contorno e
   tem um brilho que acompanha a borda. No navegador isso é um filtro SVG
   aplicado ao fundo (backdrop-filter: url(#…)):

     • um "mapa de deslocamento" do tamanho da barra: neutro no meio e
       inclinado nas bordas → o conteúdo de trás entorta nas beiradas;
     • três passadas, uma por cor (R, G, B), com forças um pouco
       diferentes → a leve franja colorida do vidro;
     • desfoque e saturação por cima; brilho e sombra interna no CSS.

   Só o Chromium (Android, programa do Windows, Chrome) desenha filtro SVG
   no fundo. Safari/iPhone e o modo leve ficam com o vidro desfocado de
   sempre (styles/global.css) — a classe html.vidro-liquido só entra
   quando dá para desenhar de verdade.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Vidro = (function () {
  const html = document.documentElement;
  const NS = 'http://www.w3.org/2000/svg';
  const ua = navigator.userAgent || '';
  /* Chromium de verdade (Chrome, Edge, WebView do Android, Electron) — não o
     Chrome do iPhone, que é Safari por dentro */
  const chromium = /Chrome\/\d+/.test(ua) && !/iPhone|iPad|iPod|CriOS/.test(ua);
  const pode = () => chromium && !html.classList.contains('modo-leve') &&
    !(window.matchMedia && window.matchMedia('(prefers-reduced-transparency: reduce)').matches);

  let svg = null, ultimo = '';

  /* O mapa: vermelho = empurra em x, azul = empurra em y; 50% = parado.
     Dois degradês cruzados dão a inclinação das bordas e um retângulo
     cinza desfocado no meio deixa o centro limpo, sem distorção. */
  function mapa(w, h, raio, borda) {
    const s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<defs><linearGradient id="r" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#f00"/></linearGradient>' +
      '<linearGradient id="b" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#00f"/></linearGradient>' +
      '<filter id="d"><feGaussianBlur stdDeviation="' + (borda * 0.55).toFixed(1) + '"/></filter></defs>' +
      '<rect width="' + w + '" height="' + h + '" fill="#000"/>' +
      '<rect width="' + w + '" height="' + h + '" rx="' + raio + '" fill="url(#r)"/>' +
      '<rect width="' + w + '" height="' + h + '" rx="' + raio + '" fill="url(#b)" style="mix-blend-mode:screen"/>' +
      '<rect x="' + borda + '" y="' + borda + '" width="' + Math.max(1, w - 2 * borda) + '" height="' + Math.max(1, h - 2 * borda) + '" rx="' +
        Math.max(0, raio - borda) + '" fill="#808080" filter="url(#d)"/></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }

  function filtro(w, h, raio) {
    const borda = Math.max(8, Math.round(Math.min(h, w) * 0.22));
    const forca = Math.round(Math.min(h, 80) * 0.42);
    /* uma passada por canal de cor, com força um pouco diferente: a franja */
    const canal = (nome, k, m) => '<feDisplacementMap in="SourceGraphic" in2="mapa" scale="' + (-forca * k).toFixed(1) + '" xChannelSelector="R" yChannelSelector="B" result="d' + nome + '"/>' +
      '<feColorMatrix in="d' + nome + '" type="matrix" values="' + m + '" result="c' + nome + '"/>';
    return '<filter id="b7-vidro-liq" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feImage href="' + mapa(w, h, raio, borda) + '" x="0" y="0" width="' + w + '" height="' + h + '" preserveAspectRatio="none" result="mapa"/>' +
      canal('r', 1.00, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0') +
      canal('g', 1.05, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0') +
      canal('b', 1.10, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0') +
      '<feBlend in="cr" in2="cg" mode="screen" result="rg"/>' +
      '<feBlend in="rg" in2="cb" mode="screen" result="rgb"/>' +
      '<feGaussianBlur in="rgb" stdDeviation="2.2"/>' +
      '</filter>';
  }

  function aplicar(barra) {
    if (!barra) return;
    if (!pode()) { if (html.classList.contains('vidro-liquido')) html.classList.remove('vidro-liquido'); return; }
    const r = barra.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (!w || !h) return;
    const raio = parseFloat(getComputedStyle(barra).borderTopLeftRadius) || 24;
    const chave = w + 'x' + h + ':' + raio;
    if (chave !== ultimo) {
      ultimo = chave;
      if (!svg) {
        svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
        document.body.appendChild(svg);
      }
      svg.innerHTML = '<defs>' + filtro(w, h, raio) + '</defs>';
    }
    if (!html.classList.contains('vidro-liquido')) html.classList.add('vidro-liquido');
  }

  let pedido = 0;
  const refazer = () => {
    if (pedido) return;
    pedido = requestAnimationFrame(() => { pedido = 0; aplicar(document.getElementById('nav-inferior')); });
  };
  window.addEventListener('resize', refazer, { passive: true });
  /* o modo leve liga/desliga depois: acompanha */
  try { new MutationObserver(refazer).observe(html, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}

  return { aplicar, suportado: () => chromium };
})();
