/* =====================================================================
   Cliente Supabase + verificação de configuração
   ===================================================================== */

window.B7 = window.B7 || {};

(function () {
  const cfg = window.B7_CONFIG || {};

  /* Arruma os enganos comuns ao colar a URL: espaço sobrando, barra no
     final (vira // na chamada e o Supabase responde "Invalid path
     specified in request URL") e caminhos colados por engano. */
  function limparURL(bruta) {
    let u = String(bruta || '').trim();
    u = u.replace(/\/+$/, '');                       // tira barras do fim
    u = u.replace(/\/(rest|auth|storage)(\/v\d+)?$/i, '');  // tira caminho da API
    return u;
  }

  const url = limparURL(cfg.SUPABASE_URL);
  const chave = String(cfg.SUPABASE_PUBLISHABLE_KEY || '').trim();

  const faltando = !url || !chave || url === 'COLE_AQUI' || chave === 'COLE_AQUI';

  /* URL do painel no lugar da URL do projeto é o outro engano frequente */
  const urlDoPainel = /supabase\.com\/(dashboard|project)/i.test(url);

  B7.configurado = !faltando && !urlDoPainel;
  B7.sb = null;
  B7.motivoConfig = faltando ? 'faltando' : (urlDoPainel ? 'painel' : null);

  if (B7.configurado && window.supabase && window.supabase.createClient) {
    /* persistSession e autoRefreshToken vieram desligados da época em que
       o sistema não tinha login: não havia sessão para guardar nem para
       renovar. Com autenticação, desligados significam que a sessão morre
       a cada carregamento de página — a causa do laço de login.

       storageKey fixo mantém a sessão estável mesmo se o endereço do
       projeto mudar de forma; sem ele a chave é derivada da URL. */
    B7.sb = window.supabase.createClient(url, chave, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,   /* não há fluxo de redirecionamento aqui */
        storageKey: 'b7-sessao'
      }
    });
  }

  /* Preferências locais (zoom, painel, modo foco, último roteiro).
     Só isso mora no navegador — nenhum dado de roteiro. */
  B7.pref = {
    ler(chave, padrao) {
      try { const v = localStorage.getItem('b7_pref_' + chave); return v === null ? padrao : JSON.parse(v); }
      catch (e) { return padrao; }
    },
    gravar(chave, valor) {
      try { localStorage.setItem('b7_pref_' + chave, JSON.stringify(valor)); } catch (e) {}
    }
  };
})();
