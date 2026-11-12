/* =====================================================================
   BIBLIOTECAS SOB DEMANDA (zzz158)

   html2canvas, jsPDF e XLSX somam 1,4 MB — mais de um quinto de tudo o
   que o sistema baixa — e só servem para exportar PDF/PNG e ler planilha.
   Antes vinham no arranque, em toda abertura, para todo mundo. Agora
   chegam só quando alguém exporta ou importa de verdade:

     await B7.vendor('html2canvas', 'jspdf');   // depois use window.jspdf
     await B7.vendor('xlsx');                   // depois use window.XLSX

   Carrega uma vez por sessão (as chamadas seguintes voltam na hora) e o
   service worker guarda o arquivo no primeiro uso, então da segunda vez
   não há espera nem internet. No app de Android os arquivos já estão no
   aparelho.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.vendor = (function () {
  const BIBLIOTECAS = {
    html2canvas: { src: 'js/vendor/html2canvas.min.js', pronta: () => !!window.html2canvas, nome: 'de imagem' },
    jspdf:       { src: 'js/vendor/jspdf.umd.min.js',   pronta: () => !!window.jspdf,       nome: 'de PDF' },
    xlsx:        { src: 'js/vendor/xlsx.full.min.js',   pronta: () => !!window.XLSX,        nome: 'de planilha' },
    /* zzz218: QR Code do app autenticador (verificação em 2 etapas) — MIT, Kazuhiko Arase */
    qrcode:      { src: 'js/vendor/qrcode.js',          pronta: () => !!window.qrcode,      nome: 'do QR Code' },
    /* 4.8.0: 3D do jogo da manutenção — three.js r160 (MIT). Só chega quando o jogo abre. */
    three:       { src: 'js/vendor/three.min.js',       pronta: () => !!window.THREE,       nome: 'do jogo 3D' },
    /* 4.12.2: os jogos da manutenção só chegam quando a manutenção abre */
    telaCheia:    { src: 'js/jogo-tela-cheia.js',      pronta: () => !!(window.B7 && B7.JogoTelaCheia), nome: 'do jogo' },
    jogoManut:    { src: 'js/jogo-manut.js',           pronta: () => !!(window.B7 && B7.JogoManut),     nome: 'do jogo' },
    jogo3d:       { src: 'js/jogo3d.js',               pronta: () => !!(window.B7 && B7.Jogo3D),        nome: 'do jogo' },
    corridaModelos: { src: 'js/jogo-corrida-modelos.js', pronta: () => !!(window.B7 && B7.CorridaModelos), nome: 'do jogo' },
    corrida:      { src: 'js/jogo-corrida.js',         pronta: () => !!(window.B7 && B7.JogoCorrida),   nome: 'do jogo' },
    memoria:      { src: 'js/jogo-memoria.js',         pronta: () => !!(window.B7 && B7.JogoMemoria),   nome: 'do jogo' },
    jogosExtra:   { src: 'js/jogos-extra.js',          pronta: () => !!(window.B7 && B7.JogosExtra),    nome: 'do jogo' }
  };
  const indo = {};

  function uma(id) {
    const b = BIBLIOTECAS[id];
    if (!b) return Promise.reject(new Error('biblioteca desconhecida: ' + id));
    if (b.pronta()) return Promise.resolve();
    if (indo[id]) return indo[id];
    indo[id] = new Promise((ok, erro) => {
      const falhou = () => { delete indo[id]; erro(new Error('Não foi possível carregar a biblioteca ' + b.nome + '. Confira a internet e tente de novo.')); };
      const s = document.createElement('script');
      s.src = b.src;
      s.async = false;                 /* mantém a ordem se forem duas de uma vez */
      s.onload = () => b.pronta() ? ok() : falhou();
      s.onerror = falhou;
      document.head.appendChild(s);
    });
    return indo[id];
  }

  return function vendor() {
    return Promise.all([].slice.call(arguments).map(uma));
  };
})();

/* =====================================================================
   4.30.0 — ÁREAS SOB DEMANDA
   Pedido do Kevin: "carregar cada área só quando abre". Estes módulos não
   vêm mais na abertura (saíram do index.html): o roteador (js/app.js)
   pede os da rota antes de abrir a tela, e depois que o sistema assenta
   o resto chega aos poucos em segundo plano, sem atrapalhar — assim um
   botão de outra área (ex.: "Legendas" dentro de uma demanda) nunca fica
   faltando por muito tempo. Continuam no cache do sw.js (abrem offline).
   ===================================================================== */
B7.Areas = (function () {
  const M = {
    calendario:   ['js/calendario.js',    () => B7.Calendario],
    publicacoes:  ['js/publicacoes.js',   () => B7.Publicacoes],
    trends:       ['js/trends.js',        () => B7.Trends],
    legendas:     ['js/legendas.js',      () => B7.Legendas],
    kanban:       ['js/kanban.js',        () => B7.Kanban],
    central:      ['js/central.js',       () => B7.Central],
    usuarios:     ['js/usuarios.js',      () => B7.Usuarios],
    superadmin:   ['js/superadmin.js',    () => B7.Super],
    editor:       ['js/editor.js',        () => B7.Editor],
    teleprompter: ['js/teleprompter.js',  () => B7.Teleprompter],
    slides:       ['js/slides.js',        () => B7.Slides],
    printLinha:   ['js/print-linha.js',   () => B7.FolhaLinha],
    iaLinha:      ['js/ia-linha.js',      () => B7.IALinha],
    painelCoord:  ['js/painel-coord.js',  () => B7.PainelCoord],
    painelDesign: ['js/painel-design.js', () => B7.PainelDesign],
    painelMulti:  ['js/painel-multi.js',  () => B7.PainelMulti],
    ajudaDados:   ['js/ajuda-dados.js',   () => B7.AJUDA_DADOS],
    /* 4.32.0: estilos só de uma tela também esperam a tela abrir */
    tvCss:        ['styles/tv.css',          () => !!document.querySelector('link[href="styles/tv.css"]')],
    publicacoesCss: ['styles/publicacoes.css', () => !!document.querySelector('link[href="styles/publicacoes.css"]')]
  };
  /* primeira parte do endereço → módulos que a tela precisa */
  const ROTA = {
    calendario: ['calendario'], publicacoes: ['publicacoes', 'publicacoesCss'], trends: ['trends'], legendas: ['legendas'],
    kanban: ['kanban'], config: ['usuarios', 'superadmin', 'tvCss'], tv: ['tvCss'], gravacao: ['editor', 'teleprompter', 'trends'],
    linha: ['slides', 'printLinha', 'iaLinha'], painel: ['painelCoord', 'painelDesign', 'painelMulti'],
    video: ['legendas'], ajuda: ['ajudaDados'], suporte: ['ajudaDados'],
    '': () => (B7.Panorama ? [] : ['central'])
  };
  const indo = {};
  const pronto = id => { try { return !!M[id][1](); } catch (e) { return false; } };
  function um(id) {
    if (indo[id]) return indo[id];
    if (!M[id] || pronto(id)) return Promise.resolve();
    indo[id] = new Promise(ok => {
      const css = /\.css$/.test(M[id][0]);
      const s = document.createElement(css ? 'link' : 'script');
      if (css) { s.rel = 'stylesheet'; s.href = M[id][0]; } else { s.src = M[id][0]; s.async = false; }
      /* falha de rede não trava a navegação: a tela tenta abrir mesmo assim */
      s.onload = ok; s.onerror = () => { delete indo[id]; ok(); };
      document.head.appendChild(s);
    });
    return indo[id];
  }
  const carregar = ids => Promise.all((ids || []).map(um));
  function paraRota(partes) {
    let ids = ROTA[(partes && partes[0]) || ''];
    if (typeof ids === 'function') ids = ids();
    const falta = (ids || []).filter(id => !pronto(id));
    return falta.length ? carregar(falta) : null;
  }
  /* o resto, um por vez, quando o navegador está à toa */
  function emSegundoPlano() {
    const fila = Object.keys(M).filter(id => !pronto(id) && id !== 'central');
    const proximo = () => {
      const id = fila.shift(); if (!id) return;
      const pede = window.requestIdleCallback || (f => setTimeout(f, 200));
      pede(() => um(id).then(() => setTimeout(proximo, 150)), { timeout: 4000 });
    };
    proximo();
  }
  window.addEventListener('load', () => setTimeout(emSegundoPlano, 6000));
  return { carregar, paraRota, pronto };
})();
