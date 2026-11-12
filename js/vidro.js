/* =====================================================================
   VIDRO LÍQUIDO (zzz303) — a barra de baixo como o Liquid Glass da Apple

   O vidro de verdade não só desfoca: ele DOBRA o que está atrás perto das
   bordas (como uma lente grossa), separa um pouco as cores no contorno e
   tem um brilho que acompanha a borda. No navegador isso é um filtro SVG
   aplicado ao fundo (backdrop-filter: url(#…)):

     • um "mapa de deslocamento" do tamanho da barra: neutro no meio e
       inclinado nas bordas → o conteúdo de trás entorta nas beiradas;
     • uma passada de deslocamento (até a v3.1.0 eram três, uma por cor,
       para uma franja colorida que quase não se via e pesava no celular);
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
  /* 4.28.0: o filtro SVG no fundo era o efeito mais caro do celular (recalcula a cada
     quadro de rolagem). Fica desligado; liga só com localStorage b7_vidro_liquido=1. */
  const querVidro = () => { try { return localStorage.getItem('b7_vidro_liquido') === '1'; } catch (e) { return false; } };
  const pode = () => querVidro() && chromium && !html.classList.contains('modo-leve') &&
    !(window.matchMedia && window.matchMedia('(prefers-reduced-transparency: reduce)').matches);

  let svg = null, ultimo = '';
  const raioCache = { t: '', v: 24, k: ':24' };

  /* O mapa: vermelho = empurra em x, azul = empurra em y; 50% = parado.
     Dois degradês cruzados dão a inclinação das bordas e um retângulo
     cinza desfocado no meio deixa o centro limpo, sem distorção. */
  function mapa(w, h, raio, borda) {
    const s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<defs><linearGradient id="r" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#f00"/></linearGradient>' +
      '<linearGradient id="b" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#00f"/></linearGradient>' +
      '<filter id="d"><feGaussianBlur stdDeviation="' + (borda * 0.55).toFixed(1) + '"/></filter></defs>' +
      /* fora da forma arredondada: cinza neutro = sem deslocamento (senão as
         pontas da pílula puxariam a imagem de fora da barra e manchariam) */
      '<rect width="' + w + '" height="' + h + '" fill="#808080"/>' +
      '<rect width="' + w + '" height="' + h + '" rx="' + raio + '" fill="#000"/>' +
      '<rect width="' + w + '" height="' + h + '" rx="' + raio + '" fill="url(#r)"/>' +
      '<rect width="' + w + '" height="' + h + '" rx="' + raio + '" fill="url(#b)" style="mix-blend-mode:screen"/>' +
      '<rect x="' + borda + '" y="' + borda + '" width="' + Math.max(1, w - 2 * borda) + '" height="' + Math.max(1, h - 2 * borda) + '" rx="' +
        Math.max(0, raio - borda) + '" fill="#808080" filter="url(#d)"/></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }

  function filtro(w, h, raio) {
    const borda = Math.max(7, Math.round(Math.min(h, w) * 0.2));
    const forca = Math.round(Math.min(h, 80) * 0.9);
    return '<filter id="b7-vidro-liq" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feImage href="' + mapa(w, h, raio, borda) + '" x="0" y="0" width="' + w + '" height="' + h + '" preserveAspectRatio="none" result="mapa"/>' +
      /* v3.1.1: uma passada só (antes eram três, uma por cor, para a franja
         colorida). O filtro roda a cada quadro em que algo passa atrás da
         barra; a franja quase não se via e custava 3× mais no celular. */
      '<feDisplacementMap in="SourceGraphic" in2="mapa" scale="' + (-forca * 1.05).toFixed(1) + '" xChannelSelector="R" yChannelSelector="B" result="d"/>' +
      '<feGaussianBlur in="d" stdDeviation="4"/>' +
      '</filter>';
  }

  /* v3.1.1: o tamanho da barra vem de um ResizeObserver (o navegador avisa
     quando muda). Antes cada mudança de classe no <html> — e elas
     acontecem a toda hora: troca de tela, tempo real, animações — media a
     barra com getBoundingClientRect e obrigava a página inteira a se
     recalcular, até no computador, onde a barra nem aparece. */
  let tam = null, olhando = null;
  const ro = window.ResizeObserver ? new ResizeObserver(es => {
    const e = es[es.length - 1], b = e.borderBoxSize && e.borderBoxSize[0];
    tam = b ? { w: Math.round(b.inlineSize), h: Math.round(b.blockSize) } : { w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) };
    refazer();
  }) : null;
  function aplicar(barra) {
    if (!barra) return;
    if (!pode()) { if (html.classList.contains('vidro-liquido')) html.classList.remove('vidro-liquido'); return; }
    if (ro && olhando !== barra) { if (olhando) ro.unobserve(olhando); olhando = barra; ro.observe(barra); return; }
    if (!ro) { const r = barra.getBoundingClientRect(); tam = { w: Math.round(r.width), h: Math.round(r.height) }; }
    const w = tam ? tam.w : 0, h = tam ? tam.h : 0;
    if (!w || !h) return;   /* barra escondida (computador): nada a desenhar */
    const chaveTam = w + 'x' + h;
    if (chaveTam + raioCache.k === ultimo && html.classList.contains('vidro-liquido')) return;
    if (raioCache.t !== chaveTam) { raioCache.t = chaveTam; raioCache.v = parseFloat(getComputedStyle(barra).borderTopLeftRadius) || 24; raioCache.k = ':' + raioCache.v; }
    const raio = raioCache.v;
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
  if (!ro) window.addEventListener('resize', refazer, { passive: true });
  /* o modo leve liga/desliga depois: acompanha — só quando ELE muda, não a
     cada classe que entra e sai do <html> */
  let leveAntes = html.classList.contains('modo-leve');
  try { new MutationObserver(() => { const l = html.classList.contains('modo-leve'); if (l !== leveAntes) { leveAntes = l; refazer(); } })
    .observe(html, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}

  return { aplicar, suportado: () => chromium };
})();
