/* =====================================================================
   APP ANDROID (pacote zzy, 03/10)
   O APK é uma "Trusted Web Activity": abre este mesmo site no Chrome, em
   tela cheia. O CONTEÚDO se atualiza sozinho (é o site). O que pode
   ficar velho é só a casca (o APK) — quando ela muda, apk.json (na raiz
   do site) ganha um versionCode maior e o app avisa aqui, com o botão
   para baixar a versão nova.
   • O APK abre o site com ?app=android&apk=<versionCode>: guardamos isso
     no aparelho para saber, nas próximas aberturas, que estamos no app.
   • Fora do app, no Android, Configurações mostra "Baixar o app".
   ===================================================================== */
window.B7 = window.B7 || {};

B7.AppAndroid = (function () {
  const CHAVE = 'b7_apk';
  const LINK = 'https://github.com/branding7dados-lab/sistema-b7/releases/latest/download/sistema-b7.apk';
  const ler = () => { try { return +(localStorage.getItem(CHAVE) || 0); } catch (e) { return 0; } };

  /* marca vinda do APK (só na abertura) — e tira da barra de endereço */
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('app') === 'android') {
      const v = +(q.get('apk') || 1);
      localStorage.setItem(CHAVE, String(v));
      q.delete('app'); q.delete('apk');
      const resto = q.toString();
      history.replaceState(null, '', location.pathname + (resto ? '?' + resto : '') + location.hash);
    }
  } catch (e) {}

  const noApp = () => ler() > 0 && (window.matchMedia('(display-mode: standalone)').matches ||
    document.referrer.startsWith('android-app://') || /Android/i.test(navigator.userAgent));
  const ehAndroid = () => /Android/i.test(navigator.userAgent);

  let info = null;
  async function consultar() {
    if (info) return info;
    try {
      const r = await fetch('apk.json?t=' + Date.now(), { cache: 'no-store' });
      if (r.ok) info = await r.json();
    } catch (e) {}
    return info;
  }

  /* abre o download do APK novo: o Chrome baixa e o Android oferece instalar
     por cima (mesma assinatura — nada se perde) */
  function baixar(url) { location.href = url || (info && info.url) || LINK; }

  async function verificar(manual) {
    if (!noApp()) return false;
    const i = await consultar();
    const atual = ler();
    if (i && i.versionCode > atual) {
      if (B7.UI && B7.UI.toast) B7.UI.toast('Nova versão do app Android (' + i.versionName + ').', {
        acao: 'Atualizar', tempo: 15000, aoClicar: () => baixar(i.url) });
      return true;
    }
    if (manual && B7.UI && B7.UI.toast) B7.UI.toast('O app já está na versão mais nova.');
    return false;
  }

  /* uma checagem por abertura, depois que o sistema montou */
  setTimeout(() => verificar(false), 6000);

  return {
    noApp, ehAndroid, verificar, baixar,
    versao: () => ler(),
    link: LINK
  };
})();
