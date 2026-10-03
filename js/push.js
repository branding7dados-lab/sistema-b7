/* =====================================================================
   PUSH — avisos mesmo com o sistema fechado

   Só a chave PÚBLICA VAPID vive aqui (js/config.js → VAPID_PUBLIC_KEY).
   O envio acontece na Edge Function b7-push, com a chave privada em
   variável de ambiente. Ver PUSH.md.

   Ligar = pedir permissão ao navegador, assinar no service worker e
   gravar a inscrição em push_subscricoes (só a própria pessoa enxerga).
   Desligar = cancelar a inscrição e apagar a linha. Sem chave pública
   configurada o recurso fica desligado e a interface explica o motivo.

   A permissão do navegador só é pedida dentro de ativar(), que só roda
   depois de um clique da pessoa — nunca ao abrir o sistema.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Push = (function () {
  const chave = () => String((window.B7_CONFIG || {}).VAPID_PUBLIC_KEY || '').trim();

  /* por que não dá — a interface mostra isto no lugar do botão */
  function motivo() {
    if (!chave()) return 'Chave pública VAPID não configurada em js/config.js (VAPID_PUBLIC_KEY).';
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return 'Este navegador não tem service worker (ou o sistema não está em https).';
    if (!('PushManager' in window)) return 'Este navegador não suporta push. No iPhone, adicione o Sistema B7 à tela de início.';
    if (!('Notification' in window)) return 'Este navegador não suporta notificações.';
    if (Notification.permission === 'denied') return 'As notificações foram bloqueadas para este site. Libere nas configurações do navegador.';
    return null;
  }
  const disponivel = () => !motivo();

  function base64ParaBytes(s) {
    const pad = '='.repeat((4 - s.length % 4) % 4);
    const b = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
    return out;
  }

  async function registro() {
    const r = await navigator.serviceWorker.getRegistration('./');
    return r || navigator.serviceWorker.register('./sw.js');
  }

  /* inscrição atual deste navegador, se houver */
  async function inscricao() {
    if (!disponivel()) return null;
    try { const r = await registro(); return await r.pushManager.getSubscription(); }
    catch (e) { return null; }
  }

  /* está ligado neste navegador E registrado no banco para esta conta? */
  async function ativo() {
    const s = await inscricao();
    if (!s) return false;
    try { return await B7.DB.temPush(s.endpoint); } catch (e) { return false; }
  }

  async function ativar() {
    const m = motivo();
    if (m) throw new Error(m);
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Permissão de notificação não concedida.');
    const r = await registro();
    await navigator.serviceWorker.ready;
    let s = await r.pushManager.getSubscription();
    if (!s) {
      s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaBytes(chave()) });
    }
    const j = s.toJSON();
    await B7.DB.registrarPush({ endpoint: s.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
    try { localStorage.removeItem('b7-push-desligado-aqui'); } catch (e) {}
    return true;
  }

  async function desativar() {
    try { localStorage.setItem('b7-push-desligado-aqui', '1'); } catch (e) {}
    const s = await inscricao();
    if (s) {
      try { await B7.DB.removerPush(s.endpoint); } catch (e) {}
      try { await s.unsubscribe(); } catch (e) {}
    }
    return true;
  }

  /* --------------------------------------------------- estado do aparelho */
  /* permissão do navegador, em palavras */
  function permissao() {
    if (!('Notification' in window)) return 'indisponivel';
    return Notification.permission === 'granted' ? 'permitida'
      : Notification.permission === 'denied' ? 'bloqueada' : 'nao_solicitada';
  }

  /* "Android · Chrome" — só o que o navegador conta sobre si mesmo; nada
     de modelo de aparelho adivinhado */
  function aparelho() {
    const ua = navigator.userAgent || '';
    const so = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
      : /Windows/i.test(ua) ? 'Windows' : /Mac OS X/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : '';
    const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
      : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
    let app = false;
    try { app = window.matchMedia('(display-mode: standalone)').matches; } catch (e) {}
    return ([so, nav].filter(Boolean).join(' · ') || 'Navegador') + (app ? ' (app instalado)' : '');
  }

  /* ------------------------------------------------------------- teste */
  /* O que cada resposta significa para a pessoa. "enviado" é o serviço
     de push ter aceitado a mensagem — o navegador não devolve confirmação
     de que o aparelho exibiu, então nunca dizemos "entregue". */
  const TEXTO_TESTE = {
    enviado: 'Enviado. O aviso deve aparecer neste aparelho em alguns segundos.',
    indisponivel: '',
    sem_permissao: 'As notificações ainda não foram permitidas neste navegador. Ligue "Push neste aparelho" para permitir.',
    bloqueada: 'O navegador bloqueou as notificações deste site. Libere nas configurações do navegador e tente de novo.',
    sem_inscricao: 'O push não está ligado neste aparelho. Ligue "Push neste aparelho" e teste de novo.',
    inscricao_expirada: 'A inscrição deste aparelho tinha expirado e foi removida. Ligue "Push neste aparelho" de novo.',
    sem_sessao: 'Sua sessão expirou. Entre de novo e repita o teste.',
    funcao_indisponivel: 'Não foi possível enviar a notificação de teste: o serviço de push não respondeu.',
    falha_envio: 'Não foi possível enviar a notificação de teste.'
  };

  const CHAVE_TESTE = 'b7-push-ultimo-teste';
  function ultimoTeste() {
    try { return JSON.parse(localStorage.getItem(CHAVE_TESTE) || 'null'); } catch (e) { return null; }
  }

  /* Manda um push de verdade só para este aparelho. Devolve
     { ok, motivo, texto } e guarda o resultado (por aparelho). */
  async function testar() {
    let r;
    const m = motivo();
    if (permissao() === 'bloqueada') r = { ok: false, motivo: 'bloqueada' };
    else if (m) r = { ok: false, motivo: 'indisponivel', texto: m };
    else if (permissao() !== 'permitida') r = { ok: false, motivo: 'sem_permissao' };
    else {
      const s = await inscricao();
      if (!s) r = { ok: false, motivo: 'sem_inscricao' };
      else {
        try { r = await B7.DB.testarPush(s.endpoint); }
        catch (e) { r = { ok: false, motivo: 'falha_envio' }; }
      }
    }
    r = r || { ok: false, motivo: 'falha_envio' };
    if (r.ok) r.motivo = 'enviado';
    r.texto = r.texto || TEXTO_TESTE[r.motivo] || TEXTO_TESTE.falha_envio;
    try { localStorage.setItem(CHAVE_TESTE, JSON.stringify({ em: new Date().toISOString(), ok: !!r.ok, motivo: r.motivo })); } catch (e) {}
    return r;
  }

  /* o service worker pede para abrir um link quando a pessoa clica no
     aviso e já existe uma aba do sistema: troca de rota, sem recarregar */
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', ev => {
        const d = ev.data || {};
        if (d.tipo === 'b7-abrir' && typeof d.link === 'string' && d.link.startsWith('#/')) {
          location.hash = d.link;
          /* quem abriu pelo aviso já viu: sai das não lidas */
          const pronto = () => { if (B7.Notif) B7.Notif.atualizar(); };
          if (d.id && B7.DB && B7.DB.marcarLida) B7.DB.marcarLida(d.id).then(pronto, pronto);
          else pronto();
        }
      });
    }
  } catch (e) {}

  /* ------------------------------------------- manter vivo (zzz2)
     Chamado a cada login. Duas coisas que faziam o aviso "não chegar":
     1. A inscrição some ou troca por baixo (navegador limpou dados,
        app reinstalado, o serviço de push renovou a chave) e o banco
        continua com a antiga. Com a permissão JÁ dada, refazer a
        inscrição não pergunta nada à pessoa: aqui ela é conferida e,
        se preciso, refeita e regravada.
     2. Quase ninguém da equipe tinha ligado o push (o banco registrava
        "sem_inscricao"). Quem ainda não ligou recebe um convite com
        botão — a permissão do navegador só é pedida depois desse toque —
        no máximo uma vez por semana, por aparelho. */
  const CHAVE_CONVITE = 'b7-push-convite';
  const CHAVE_DESLIGADO = 'b7-push-desligado-aqui';
  async function manter() {
    try {
      if (!disponivel() || !B7.Auth || !B7.Auth.usuario()) return;
      /* dentro da conta de outra pessoa, nada de inscrever o aparelho dela */
      if (B7.Auth.naContaDeOutro && B7.Auth.naContaDeOutro()) return;
      /* só o "desligado" explícito da pessoa conta (o padrão do sino é push:false) */
      const prefs = (B7.Auth.usuario() || {}).preferencias || {};
      let desligadoAqui = false; try { desligadoAqui = localStorage.getItem(CHAVE_DESLIGADO) === '1'; } catch (e) {}
      if (desligadoAqui) return;          /* a pessoa desligou neste aparelho */
      if (permissao() === 'permitida') {
        if (prefs.push === false) return;
        const r = await registro();
        await navigator.serviceWorker.ready;
        let s = await r.pushManager.getSubscription();
        /* chave do servidor trocada: a inscrição velha nunca mais recebe */
        if (s && s.options && s.options.applicationServerKey) {
          const atual = new Uint8Array(s.options.applicationServerKey), certa = base64ParaBytes(chave());
          if (atual.length !== certa.length || atual.some((b, i) => b !== certa[i])) { try { await s.unsubscribe(); } catch (e) {} s = null; }
        }
        if (!s) s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaBytes(chave()) });
        if (!(await B7.DB.temPush(s.endpoint))) {
          const j = s.toJSON();
          await B7.DB.registrarPush({ endpoint: s.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
        }
        return;
      }
      if (permissao() !== 'nao_solicitada' || prefs.push === false) return;
      let ultimo = 0; try { ultimo = Number(localStorage.getItem(CHAVE_CONVITE) || 0); } catch (e) {}
      if (Date.now() - ultimo < 7 * 864e5) return;
      setTimeout(() => {
        if (permissao() !== 'nao_solicitada' || !B7.UI || !B7.UI.toast) return;
        try { localStorage.setItem(CHAVE_CONVITE, String(Date.now())); } catch (e) {}
        B7.UI.toast('Receba os avisos do B7 neste aparelho, mesmo com o sistema fechado.', {
          acao: 'Ativar', tempo: 12000,
          aoClicar: () => ativar().then(
            () => {
              if (B7.Notif && B7.Notif.gravarPrefs) B7.Notif.gravarPrefs({ push: true }).catch(() => {});
              B7.UI.toast('Pronto: os avisos chegam neste aparelho.');
            },
            e => B7.UI.toast(e.message || 'Não foi possível ativar.', { tipo: 'erro' }))
        });
      }, 6000);
    } catch (e) { /* manter nunca atrapalha a abertura */ }
  }

  return { disponivel, motivo, ativo, ativar, desativar, inscricao, permissao, aparelho, testar, ultimoTeste, manter };
})();
