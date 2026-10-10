/* =====================================================================
   APP ANDROID — o site rodando dentro da casca Capacitor (app-android/)

   O app abre este mesmo site; cada publicação chega a ele sozinha. Só o
   que o WebView não faz como o navegador passa pela ponte B7Nativo (que
   só existe dentro do app e só para este endereço):
     • baixar arquivo (<a download>, blob:, data:) → Downloads do celular;
     • window.print → impressão do Android (salvar em PDF ou impressora);
     • link de fora (WhatsApp, Drive, Instagram) → o app certo.
   Fora do app, este arquivo não faz nada.

   Casca nova: app-android/versao.json traz a versão publicada; se for
   maior que a instalada, aparece um aviso com o link do APK.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.AppNativo = (function () {
  const ponte = window.B7Nativo;
  const ativo = !!(ponte && typeof ponte.postMessage === 'function');
  const APK = 'https://github.com/branding7dados-lab/sistema-b7/releases/latest/download/sistema-b7.apk';

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

    pedir('versao').then(() => conferirCasca(false));
  }

  /* ------------------------------------------------ casca nova (APK) */
  const num = v => String(v || '').split('.').map(n => parseInt(n, 10) || 0);
  function maior(a, b) {
    const x = num(a), y = num(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
    }
    return false;
  }

  /* devolve a versão publicada se for mais nova que a instalada */
  async function conferirCasca(perguntou) {
    if (!ativo) return null;
    let pub = null;
    try {
      const r = await fetch('app-android/versao.json?t=' + Date.now(), { cache: 'no-store' });
      if (r.ok) pub = (await r.json()).versao;
    } catch (e) {}
    const nova = pub && instalada && maior(pub, instalada) ? pub : null;
    if (nova && B7.UI && B7.UI.toast) {
      let hoje = '';
      try { hoje = localStorage.getItem('b7-apk-avisado'); } catch (e) {}
      if (perguntou || hoje !== nova + new Date().toDateString()) {
        try { localStorage.setItem('b7-apk-avisado', nova + new Date().toDateString()); } catch (e) {}
        B7.UI.toast('Nova versão do app Android (' + nova + ')', { acao: 'Baixar', aoClicar: baixarCasca });
      }
    } else if (perguntou && B7.UI && B7.UI.toast) {
      B7.UI.toast(pub ? 'O app já está na versão mais nova.' : 'Não foi possível conferir agora.');
    }
    return nova;
  }

  function baixarCasca() { pedir('abrirFora', { url: APK }); }

  if (ativo) ligar();

  return {
    ativo,
    versao: () => instalada,
    conferirCasca,
    baixarCasca,
    APK
  };
})();
