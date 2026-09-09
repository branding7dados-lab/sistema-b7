/* =====================================================================
   PRESENÇA — "visto por último"

   Um heartbeat leve: perfil_heartbeat() grava perfis.last_seen_at só
   para a própria sessão (security definer, auth.uid()). O frontend
   chama no máximo uma vez a cada 5 minutos — na entrada, ao trocar de
   rota e ao voltar o foco da aba, sempre respeitando o intervalo.
   A tela de Usuários lê isso para mostrar "Online agora" / "Último
   acesso". Nada aqui toca auth.users.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Presenca = (function () {
  const INTERVALO = 5 * 60 * 1000;   /* 5 min */
  let ultimo = 0, ligado = false, timer = null, emCurso = false;

  async function tocar(forcar) {
    if (!B7.Auth || !B7.Auth.usuario() || !navigator.onLine || !B7.DB || !B7.DB.heartbeat) return;
    if (document.hidden) return;                       /* aba escondida não conta como presença */
    const agora = Date.now();
    if (!forcar && agora - ultimo < INTERVALO) return;
    if (emCurso) return;
    emCurso = true;
    try { await B7.DB.heartbeat(); ultimo = agora; }
    catch (e) { /* função ausente (migration_presenca não rodou) ou rede: tenta na próxima */ }
    finally { emCurso = false; }
  }

  function iniciar() {
    if (ligado || !B7.Auth || !B7.Auth.usuario()) return;
    ligado = true;
    tocar();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tocar(); });
    window.addEventListener('hashchange', () => tocar());
    window.addEventListener('online', () => tocar());
    timer = setInterval(() => tocar(), INTERVALO);
  }

  /* ---- rótulo de acesso, usado pela lista de usuários ----
     Online = visto há menos de 5 min. Fora disso vale o mais recente entre
     last_seen_at, last_login_at e o antigo ultimo_acesso. */
  function rotulo(u) {
    const seen = u && u.last_seen_at ? new Date(u.last_seen_at).getTime() : 0;
    if (seen && Date.now() - seen < INTERVALO) return { online: true, texto: 'Online agora' };
    const candidatos = [u && u.last_seen_at, u && u.last_login_at, u && u.ultimo_acesso]
      .filter(Boolean).map(x => new Date(x).getTime()).filter(x => !isNaN(x));
    if (!candidatos.length) return { online: false, texto: 'Nunca acessou' };
    const max = new Date(Math.max.apply(null, candidatos)).toISOString();
    return { online: false, texto: 'Último acesso: ' + B7.UI.quando(max) };
  }

  return { iniciar, tocar, rotulo, INTERVALO };
})();
