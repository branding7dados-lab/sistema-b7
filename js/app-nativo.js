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
  /* o que este APK sabe fazer (vem na resposta da ponte) */
  const recursos = { firebase: null, binario: false };
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
      if ('firebase' in r) recursos.firebase = !!r.firebase;
      if ('binario' in r) recursos.binario = !!r.binario;
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

  /* ------------------------------------------------ barras do Android
     As telas ficam entre a barra de cima (hora, bateria) e a de baixo,
     como no Chrome. O Android pinta a faixa atrás de cada barra com a cor
     que vem daqui, e os ícones ficam brancos ou escuros conforme ela:
       • cima: a <meta name="theme-color">, que js/app.js mantém igual ao
         topo da tela (abertura, janela aberta, teleprompter, assistente);
       • baixo: o fundo da página;
       • login: as cores do céu do login (ele é sempre escuro). */
  function acompanharBarras() {
    const meta = document.querySelector('meta[name="theme-color"]');
    let ultima = '', marcado = false;
    const hex = v => {
      v = String(v || '').trim();
      const m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (m) return '#' + (m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1]);
      const r = v.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
      return r ? '#' + [r[1], r[2], r[3]].map(n => (+n).toString(16).padStart(2, '0')).join('') : null;
    };
    const luz = h => {
      const n = parseInt((h || '#000000').slice(1), 16);
      return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
    };
    const conferir = () => {
      marcado = false;
      const corpo = document.body;
      const ab = document.querySelector('.b7-abertura');
      let topo, fundo;
      if (ab && !ab.classList.contains('saindo')) { topo = fundo = '#05030A'; }
      else if (corpo.classList.contains('sem-sessao')) { topo = '#140A28'; fundo = '#06030C'; }
      else if (corpo.classList.contains('tele-aberto')) { topo = fundo = '#000000'; }
      else {
        topo = hex(meta && meta.content) || '#0B0A1E';
        fundo = hex(getComputedStyle(document.documentElement).getPropertyValue('--fundo')) ||
          hex(getComputedStyle(corpo).backgroundColor) || topo;
      }
      const claras = luz(topo) < 0.6;
      const chave = topo + fundo + claras;
      if (chave !== ultima) { ultima = chave; pedir('barras', { claras, topo, fundo }); }
    };
    const agendar = () => { if (!marcado) { marcado = true; requestAnimationFrame(conferir); } };
    if (meta) new MutationObserver(agendar).observe(meta, { attributes: true, attributeFilter: ['content'] });
    new MutationObserver(agendar).observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    new MutationObserver(agendar).observe(document.documentElement, { attributes: true });
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

  /* ---------------------------------------------- notificações (Firebase)
     O mesmo aviso que vai para o Chrome (função b7-push) chega ao app pelo
     Firebase. O aparelho entra em push_subscricoes com endpoint
     "fcm:<token>"; a b7-push reconhece o prefixo e envia pelo Firebase.
     Conversa com o plugin @capacitor/push-notifications pela ponte do
     próprio Capacitor (window.Capacitor.nativePromise). js/push.js usa
     estas funções no lugar das do navegador quando está dentro do app. */
  const CAP = () => window.Capacitor && typeof window.Capacitor.nativePromise === 'function' ? window.Capacitor : null;
  const plugin = (metodo, opcoes) => CAP() ? CAP().nativePromise('PushNotifications', metodo, opcoes || {})
    : Promise.reject(new Error('Esta versão do app não tem notificações.'));
  const CHAVE_TOKEN = 'b7-app-fcm-token';
  let permissaoApp = 'nao_solicitada';
  let tokenEspera = null;
  let verificada = null;
  const verificar = () => (verificada = verificada ||
    plugin('checkPermissions').then(r => { permissaoApp = traduzir(r && r.receive); }, () => {}));

  const lerToken = () => { try { return localStorage.getItem(CHAVE_TOKEN) || ''; } catch (e) { return ''; } };
  const traduzir = p => p === 'granted' ? 'permitida' : p === 'denied' ? 'bloqueada' : 'nao_solicitada';

  function iniciarPush() {
    const cap = CAP();
    if (!cap) return;
    cap.addListener('PushNotifications', 'registration', t => {
      const valor = t && t.value;
      if (!valor) return;
      try { localStorage.setItem(CHAVE_TOKEN, valor); } catch (e) {}
      if (tokenEspera) { tokenEspera.ok(valor); tokenEspera = null; }
    });
    cap.addListener('PushNotifications', 'registrationError', e => {
      if (tokenEspera) { tokenEspera.erro(new Error((e && e.error) || 'O Firebase não respondeu.')); tokenEspera = null; }
    });
    /* toque no aviso: abre a tela dele e tira das não lidas */
    const abrirAviso = (link, aviso) => {
      const ir = () => {
        if (typeof link === 'string' && link.startsWith('#/')) location.hash = link;
        const pronto = () => { if (B7.Notif) B7.Notif.atualizar(); };
        if (aviso && !/^teste-/.test(aviso) && B7.DB && B7.DB.marcarLida) B7.DB.marcarLida(aviso).then(pronto, pronto);
      };
      /* abriu o app pelo aviso: espera o login montar as telas */
      if (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) ir(); else setTimeout(ir, 2500);
    };
    window.B7AppAbrir = abrirAviso;
    cap.addListener('PushNotifications', 'pushNotificationActionPerformed', ev => {
      const d = (ev && ev.notification && ev.notification.data) || {};
      abrirAviso(d.link, d.id);
    });
    /* aviso com o app aberto: o Android não mostra sozinho — o app mostra
       na barra de notificações, igual a quando está fechado */
    cap.addListener('PushNotifications', 'pushNotificationReceived', n => {
      const d = (n && n.data) || {};
      pedir('mostrarAviso', { titulo: n && n.title || 'Sistema B7', corpo: n && n.body || '', link: d.link || '#/', id: d.id || '',
        imagem: d.imagem || '', logo: d.logo || '', acoes: d.acoes || '[]' });
      if (B7.Notif) B7.Notif.atualizar();
    });
    /* aviso mostrado pelo app e tocado depois que o app fechou */
    setTimeout(() => pedir('linkPendente').then(r => { if (r && r.link) abrirAviso(r.link, r.aviso); }), 1500);
    verificar();
  }

  /* pede um token novo ao Firebase (não pergunta nada à pessoa) */
  function registrarNoFirebase() {
    return new Promise((ok, erro) => {
      tokenEspera = { ok, erro };
      plugin('register').catch(e => { if (tokenEspera) { tokenEspera = null; erro(e); } });
      setTimeout(() => { if (tokenEspera) { tokenEspera = null; erro(new Error('O Firebase não respondeu. Confira a internet.')); } }, 20000);
    });
  }

  async function gravarNoBanco(token) {
    const endpoint = 'fcm:' + token;
    if (!(await B7.DB.temPush(endpoint))) await B7.DB.registrarPush({ endpoint, p256dh: 'fcm', auth: 'fcm' });
  }

  const push = {
    motivo() {
      if (!CAP()) return 'Esta versão do app não tem notificações. Atualize o app.';
      if (recursos.firebase === false) return 'As notificações do app ainda estão sendo ligadas (Firebase). Logo chegam numa atualização.';
      if (permissaoApp === 'bloqueada') return 'As notificações do B7 estão bloqueadas. Libere em Configurações do Android → Apps → Sistema B7 → Notificações.';
      return null;
    },
    permissao: () => permissaoApp,
    verificar,
    inscricao: async () => { const t = lerToken(); return t ? { endpoint: 'fcm:' + t } : null; },
    async ativar() {
      const r = await plugin('requestPermissions');
      permissaoApp = traduzir(r && r.receive);
      if (permissaoApp !== 'permitida') throw new Error('Permissão de notificação não concedida.');
      await gravarNoBanco(await registrarNoFirebase());
    },
    async desativar() {
      try { await plugin('unregister'); } catch (e) {}
      try { localStorage.removeItem(CHAVE_TOKEN); } catch (e) {}
    },
    /* a cada login: token renovado e gravado, sem perguntar nada */
    async garantir() {
      if (permissaoApp !== 'permitida') return;
      await gravarNoBanco(await registrarNoFirebase());
    }
  };

  /* ------------------------------------------ widget "Hoje no B7"
     O widget da tela inicial busca os números sozinho, com uma chave só
     dele (widget_token_novo no banco), nunca com a sessão do app. Aqui:
     ao entrar na conta, a chave é criada e entregue ao Android; ao trocar
     de conta, refeita; ao sair, apagada. Abrir o app também atualiza. */
  function ligarWidget() {
    let quem = null, ultimaAtualizacao = 0, pedindo = false;
    const usuario = () => (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) || null;
    async function conferir() {
      if (pedindo) return;
      const u = usuario();
      const id = u && u.papel !== 'cliente' && !(B7.Auth.naContaDeOutro && B7.Auth.naContaDeOutro()) ? u.id : null;
      if (id === quem) {
        if (id && Date.now() - ultimaAtualizacao > 5 * 60 * 1000 && !document.hidden) { ultimaAtualizacao = Date.now(); pedir('widgetAtualizar'); }
        return;
      }
      pedindo = true;
      try {
        if (!id) { if (quem) await pedir('widgetSair'); quem = null; return; }
        const e = await pedir('widgetEstado');
        if (!(e.temChave && e.perfil === id)) {
          if (!B7.sb) return;
          const { data, error } = await B7.sb.rpc('widget_token_novo');
          if (error || !data) return;
          const cfg = window.B7_CONFIG || {};
          await pedir('widgetToken', { token: data, url: cfg.SUPABASE_URL, anon: cfg.SUPABASE_PUBLISHABLE_KEY });
          await pedir('widgetPerfil', { perfil: id });
        } else {
          pedir('widgetAtualizar');
        }
        quem = id; ultimaAtualizacao = Date.now();
      } catch (e) { /* tenta de novo na próxima volta */ }
      finally { pedindo = false; }
    }
    setInterval(conferir, 4000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) conferir(); });
  }

  if (ativo) { ligar(); iniciarPush(); ligarWidget(); }

  return {
    ativo,
    versao: () => instalada,
    ligarAtualizacao,
    instalar,
    push,
    recursos,
    pedir
  };
})();
