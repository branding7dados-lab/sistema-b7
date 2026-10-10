/* =====================================================================
   APP ANDROID — as telas rodando dentro do app (app-android/)

   O APK leva index.html, js/, styles/ e assets/; a internet só serve para
   o login e os dados. O que o WebView não faz como o navegador passa pela
   ponte B7Nativo (que só existe dentro do app):
     • baixar arquivo (<a download>, blob:, data:) → Downloads do celular;
     • window.print → impressão do Android (salvar em PDF ou impressora);
     • link de fora (WhatsApp, Drive, Instagram) → o app certo.
   Fora do app, este arquivo não faz nada.

   Versão nova: cada publicação no main gera um APK (app-v<número> em
   Releases). O app confere e mostra "Nova versão do app B7 · Instalar".
   ===================================================================== */

window.B7 = window.B7 || {};

B7.AppNativo = (function () {
  const ponte = window.B7Nativo;
  const ativo = !!(ponte && typeof ponte.postMessage === 'function');

  let instalada = '';
  let seq = 0;
  const esperando = {};

  function pedir(acao, dados) {
    if (!ativo) return Promise.resolve({ ok: false });
    const id = String(++seq);
    return new Promise(res => {
      esperando[id] = res;
      try { ponte.postMessage(JSON.stringify(Object.assign({ id, acao }, dados || {}))); }
      catch (e) { delete esperando[id]; res({ ok: false }); }
      setTimeout(() => { if (esperando[id]) { delete esperando[id]; res({ ok: false }); } }, 30000);
    });
  }

  if (ativo) {
    ponte.onmessage = ev => {
      let r = {};
      try { r = JSON.parse(ev.data); } catch (e) { return; }
      if (r.versao) instalada = r.versao;
      if (r.codigo) codigo = r.codigo;
      const f = esperando[r.id];
      if (f) { delete esperando[r.id]; f(r); }
    };
  }

  /* -------------------------------------------------------- arquivos */
  function paraBase64(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).replace(/^data:[^,]*,/, ''));
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  function nomeDoLink(a, url) {
    const d = a.getAttribute('download');
    if (d) return d;
    try { return decodeURIComponent(new URL(url, location.href).pathname.split('/').pop()) || 'arquivo'; }
    catch (e) { return 'arquivo'; }
  }

  async function salvarLink(a) {
    const url = a.href;
    const nome = nomeDoLink(a, url);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      const r = await pedir('salvar', { base64: await paraBase64(blob), nome, tipo: blob.type || '' });
      if (!r.ok) throw new Error('não salvou');
    } catch (e) {
      /* não deu para buscar (link de outro site sem permissão): abre fora */
      if (/^https?:/i.test(url)) pedir('abrirFora', { url });
      else if (B7.UI && B7.UI.toast) B7.UI.toast('Não foi possível baixar o arquivo.', { tipo: 'erro' });
    }
  }

  const deFora = url => {
    try { return new URL(url, location.href).origin !== location.origin; } catch (e) { return false; }
  };

  function ehDownload(a) {
    if (!a || !a.href) return false;
    return a.hasAttribute('download') || /^(blob|data):/i.test(a.href);
  }

  /* --------------------------------------------------------- ligar */
  function ligar() {
    document.documentElement.classList.add('app-android');

    /* a.click() feito por código (backup, arte, PDF) */
    const clicar = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (ehDownload(this)) { salvarLink(this); return; }
      if (this.href && deFora(this.href) && /^https?:|^mailto:|^tel:|^whatsapp:/i.test(this.href)) {
        pedir('abrirFora', { url: this.href }); return;
      }
      return clicar.call(this);
    };

    /* toque de verdade num link */
    document.addEventListener('click', ev => {
      if (ev.defaultPrevented || ev.button) return;
      const a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!a) return;
      if (ehDownload(a)) { ev.preventDefault(); salvarLink(a); return; }
      if (deFora(a.href) && /^https?:|^mailto:|^tel:|^whatsapp:/i.test(a.href)) {
        ev.preventDefault(); pedir('abrirFora', { url: a.href });
      }
    });

    /* janela nova: dentro do app não existe aba */
    const abrir = window.open;
    window.open = function (url) {
      if (url && deFora(url)) { pedir('abrirFora', { url: new URL(url, location.href).href }); return null; }
      if (url) { location.href = url; return window; }
      return abrir.apply(window, arguments);
    };

    window.print = () => { pedir('imprimir', { titulo: document.title }); };

    pedir('versao');
    acompanharBarras();
  }

  /* --------------------------------------------- ícones da barra de cima
     O app desenha atrás da barra do Android (transparente). Os ícones
     (hora, bateria) precisam contrastar com o que está atrás: brancos na
     abertura e no login (sempre escuros) e, no resto, conforme a cor da
     <meta name="theme-color">, que js/app.js mantém igual à do topo. */
  function acompanharBarras() {
    const meta = document.querySelector('meta[name="theme-color"]');
    let ultima = null, marcado = false;
    const luz = hex => {
      const h = String(hex || '').trim().replace('#', '');
      const n = parseInt(h.length === 3 ? h.replace(/./g, c => c + c) : h, 16);
      if (isNaN(n)) return 0;
      return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
    };
    const conferir = () => {
      marcado = false;
      const ab = document.querySelector('.b7-abertura');
      const escuro = (ab && !ab.classList.contains('saindo')) ||
        document.body.classList.contains('sem-sessao') ||
        luz(meta && meta.content) < 0.6;
      if (escuro !== ultima) { ultima = escuro; pedir('barras', { claras: escuro }); }
    };
    const agendar = () => { if (!marcado) { marcado = true; requestAnimationFrame(conferir); } };
    if (meta) new MutationObserver(agendar).observe(meta, { attributes: true, attributeFilter: ['content'] });
    new MutationObserver(agendar).observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    conferir();
  }

  /* ------------------------------------------------- versão nova (APK) */
  /* As telas estão dentro do APK: versão nova do sistema = APK novo.
     Quem confere é o lado Android (a página não pode falar com o GitHub). */
  let codigo = 0, ultimaConferencia = 0, avisoDe = 0;

  async function conferir() {
    if (!ativo || !navigator.onLine) return 'offline';
    const r = await pedir('conferirApk');
    if (!r.ok) return 'erro';
    ultimaConferencia = Date.now();
    if (r.codigo) codigo = r.codigo;
    return r.ultimo > codigo ? 'nova' : 'atual';
  }

  function avisar() {
    if (!B7.UI || !B7.UI.toast) return;
    B7.UI.toast('Nova versão do app B7', { acao: 'Instalar', tempo: 15000, aoClicar: instalar });
  }

  function instalar() {
    pedir('instalarApk');
  }

  /* chamado por js/app.js no lugar da atualização do site: ao abrir,
     e ao voltar para o app (no máximo a cada 30 min) */
  function ligarAtualizacao() {
    const tentar = async (forcar) => {
      if (!forcar && Date.now() - ultimaConferencia < 30 * 60 * 1000) return;
      if ((await conferir()) === 'nova' && (forcar || Date.now() - avisoDe > 30 * 60 * 1000)) {
        avisoDe = Date.now();
        avisar();
      }
    };
    setTimeout(() => tentar(true), 4000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tentar(false); });
    /* Configurações → "Buscar atualização" */
    B7.buscarAtualizacao = async () => {
      const r = await conferir();
      if (r === 'nova') { avisoDe = Date.now(); avisar(); }
      return r;
    };
    /* "Atualizar todos": a versão do site publicado, não a deste APK */
    B7.versaoPublicada = async () => {
      const r = await pedir('versaoSite');
      return r.ok ? r.site : null;
    };
  }

  if (ativo) ligar();

  return {
    ativo,
    versao: () => instalada,
    ligarAtualizacao,
    instalar
  };
})();
