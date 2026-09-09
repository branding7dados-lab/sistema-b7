/* =====================================================================
   PUSH — avisos mesmo com o sistema fechado

   Só a chave PÚBLICA VAPID vive aqui (js/config.js → VAPID_PUBLIC_KEY).
   O envio acontece na Edge Function b7-push, com a chave privada em
   variável de ambiente. Ver PUSH.md.

   Ligar = pedir permissão ao navegador, assinar no service worker e
   gravar a inscrição em push_subscricoes (só a própria pessoa enxerga).
   Desligar = cancelar a inscrição e apagar a linha. Sem chave pública
   configurada o recurso fica desligado e a interface explica o motivo.
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
    return true;
  }

  async function desativar() {
    const s = await inscricao();
    if (s) {
      try { await B7.DB.removerPush(s.endpoint); } catch (e) {}
      try { await s.unsubscribe(); } catch (e) {}
    }
    return true;
  }

  /* o service worker pede para abrir um link quando a pessoa clica no
     aviso e já existe uma aba do sistema: troca de rota, sem recarregar */
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', ev => {
        const d = ev.data || {};
        if (d.tipo === 'b7-abrir' && typeof d.link === 'string' && d.link.startsWith('#/')) {
          location.hash = d.link;
          if (B7.Notif) B7.Notif.atualizar();
        }
      });
    }
  } catch (e) {}

  return { disponivel, motivo, ativo, ativar, desativar, inscricao };
})();
