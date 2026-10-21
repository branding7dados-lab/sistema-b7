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
    qrcode:      { src: 'js/vendor/qrcode.js',          pronta: () => !!window.qrcode,      nome: 'do QR Code' }
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
