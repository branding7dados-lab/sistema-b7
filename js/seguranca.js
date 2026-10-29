/* =====================================================================
   SEGURANÇA DA CONTA (zzz218) — B7.Seguranca

   · Verificação em 2 etapas: depois da senha, um código de 6 números
     por e-mail (a pessoa cadastra e confirma o e-mail) ou do app
     autenticador (Google Authenticator, Authy, Microsoft Authenticator).
     Quem decide se liga é a pessoa; o administrador pode exigir para a
     administração e coordenação ou para todos.
   · "Confiar neste aparelho": 30 dias sem pedir o código neste
     navegador (o servidor guarda só o hash do token).
   · Entrar com Google: a pessoa vincula a conta Google em Meu perfil →
     Segurança e passa a ter o botão "Entrar com Google" no login. Só no
     navegador (o Google não deixa entrar por dentro do programa de
     Windows nem do app de Android) e só quando o Google está ligado no
     projeto.

   Quem confere tudo é o servidor (b7-auth, dois_fatores.ts): sem o
   código certo, a sessão não sai de lá.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Seguranca = (function () {
  const esc = s => (B7.UI && B7.UI.esc ? B7.UI.esc(s) : String(s == null ? '' : s));
  const auth = corpo => B7.DB.chamarAuth(corpo);
  const SVG = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const IC = {
    escudo: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.3-4.6"/>',
    email: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/>',
    app: '<rect x="7" y="2.8" width="10" height="18.4" rx="2.4"/><path d="M11 17.6h2"/>',
    google: '<path d="M20.6 12.2c0-.6-.1-1.2-.2-1.8H12v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"/><path d="M12 21c2.4 0 4.5-.8 5.9-2.2L15 16.6c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21z"/><path d="M7 13.8a5.4 5.4 0 0 1 0-3.6V7.9H4a9 9 0 0 0 0 8.2z"/><path d="M12 6.5c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 4 7.9l3 2.3c.7-2.1 2.7-3.7 5-3.7z"/>',
    ok: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.5l2.8 2.8L16.3 9.6"/>'
  };
  /* logo oficial do Google (4 cores) — para o botão do login ficar bonito */
  const GOOGLE_LOGO = '<svg class="lg-g-logo" viewBox="0 0 48 48" aria-hidden="true">' +
    '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
    '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
    '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
    '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
    '</svg>';
  const mascara = e => { if (!e) return ''; const [u, d] = String(e).split('@'); return (u.length <= 2 ? u[0] + '*' : u.slice(0, 2) + '*'.repeat(Math.min(6, u.length - 2))) + '@' + d; };

  /* ---------------------------------------------- aparelho de confiança */
  const chaveAparelho = u => 'b7_aparelho_' + String(u || '').trim().toLowerCase();
  function lerAparelho(username) { try { return localStorage.getItem(chaveAparelho(username)) || null; } catch (e) { return null; } }
  function gravarAparelho(username, token) { try { if (token) localStorage.setItem(chaveAparelho(username), token); } catch (e) {} }
  function esquecerAparelhosLocais() {
    try { Object.keys(localStorage).filter(k => k.startsWith('b7_aparelho_')).forEach(k => localStorage.removeItem(k)); } catch (e) {}
  }
  const nomeAparelho = () => {
    const ua = navigator.userAgent || '';
    const so = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Mac OS/.test(ua) ? 'Mac' : 'Aparelho';
    const nav = /Electron\//.test(ua) ? 'programa do B7' : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'navegador';
    return so + ' · ' + nav;
  };

  /* ===================================================== passo do login */
  /* ------------------------------------------ esqueci minha senha (zzz296)
     Três passos dentro da própria caixa do login: usuário → código + senha
     nova → pronto. O servidor responde igual exista a conta ou não. */
  const OLHO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  function esqueciSenha(form, opcoes) {
    const voltar = u => opcoes.voltar(u);
    let usuario = String(opcoes.username || '').trim();
    function passo1() {
      form.innerHTML =
        '<img class="login-marca" src="assets/brand/logo-white.png" alt="Branding7">' +
        '<span class="lg2-ic" aria-hidden="true">' + SVG(IC.escudo) + '</span>' +
        '<h1>Esqueceu a senha?</h1>' +
        '<p class="login-sub">Digite o seu usuário. Enviamos um código para o <b>e-mail de recuperação</b> da sua conta, e com ele você cria uma senha nova.</p>' +
        '<label class="rot" for="es-user">USUÁRIO</label>' +
        '<input class="campo" id="es-user" autocomplete="username" autocapitalize="none" spellcheck="false" required>' +
        '<div class="login-erro" id="lg-erro" role="alert"></div>' +
        '<button class="b pri login-entrar" type="submit">Enviar código</button>' +
        '<div class="lg2-links"><span></span><button type="button" class="lg2-link" id="es-voltar">Voltar ao login</button></div>';
      const campo = form.querySelector('#es-user'), erro = form.querySelector('#lg-erro'), bt = form.querySelector('.login-entrar');
      campo.value = usuario;
      form.querySelector('#es-voltar').onclick = () => voltar(campo.value.trim());
      form.onsubmit = async e => {
        e.preventDefault();
        const u = campo.value.trim(); if (!u) return;
        erro.textContent = ''; bt.disabled = true; bt.textContent = 'Enviando…';
        try { await auth({ acao: 'senha_esqueci', username: u }); usuario = u; passo2(); }
        catch (ex) { bt.disabled = false; bt.textContent = 'Enviar código'; erro.textContent = ex.message || 'Não foi possível enviar agora.'; }
      };
      setTimeout(() => campo.focus(), 60);
    }
    function passo2() {
      form.innerHTML =
        '<img class="login-marca" src="assets/brand/logo-white.png" alt="Branding7">' +
        '<span class="lg2-ic" aria-hidden="true">' + SVG(IC.email) + '</span>' +
        '<h1>Crie uma senha nova</h1>' +
        '<p class="login-sub">Se a conta <b>' + esc(usuario) + '</b> tem e-mail de recuperação, o código acabou de chegar lá (vale 10 minutos — olhe também o spam). ' +
          'Não tem e-mail cadastrado? Peça para a Branding7 trocar a sua senha.</p>' +
        '<label class="rot" for="es-cod">CÓDIGO DO E-MAIL</label>' +
        '<input class="campo lg2-cod" id="es-cod" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" placeholder="000000" required>' +
        '<label class="rot" for="es-senha">SENHA NOVA</label>' +
        '<div class="login-senha"><input class="campo" id="es-senha" type="password" autocomplete="new-password" required>' +
          '<button type="button" class="login-olho" aria-label="Mostrar senha">' + OLHO + '</button></div>' +
        '<label class="rot" for="es-senha2">REPITA A SENHA NOVA</label>' +
        '<input class="campo" id="es-senha2" type="password" autocomplete="new-password" required>' +
        '<p class="es-regra">Pelo menos 10 caracteres, com letras e números.</p>' +
        '<div class="login-erro" id="lg-erro" role="alert"></div>' +
        '<button class="b pri login-entrar" type="submit">Trocar senha</button>' +
        '<div class="lg2-links"><button type="button" class="lg2-link" id="es-reenviar">Reenviar código</button>' +
          '<button type="button" class="lg2-link" id="es-voltar">Voltar ao login</button></div>';
      const cod = form.querySelector('#es-cod'), s1 = form.querySelector('#es-senha'), s2 = form.querySelector('#es-senha2');
      const erro = form.querySelector('#lg-erro'), bt = form.querySelector('.login-entrar'), olho = form.querySelector('.login-olho');
      cod.addEventListener('input', () => { cod.value = cod.value.replace(/\D/g, '').slice(0, 6); if (cod.value.length === 6) s1.focus(); });
      olho.onclick = () => { const v = s1.type === 'text'; s1.type = s2.type = v ? 'password' : 'text'; olho.classList.toggle('on', !v); };
      form.querySelector('#es-voltar').onclick = () => voltar(usuario);
      const re = form.querySelector('#es-reenviar');
      re.onclick = async () => {
        re.disabled = true; erro.textContent = '';
        try { await auth({ acao: 'senha_esqueci', username: usuario }); re.textContent = 'Código reenviado'; setTimeout(() => { re.textContent = 'Reenviar código'; re.disabled = false; }, 30000); }
        catch (e) { erro.textContent = e.message || 'Não foi possível reenviar.'; re.disabled = false; }
      };
      form.onsubmit = async e => {
        e.preventDefault();
        erro.textContent = '';
        if (cod.value.length !== 6) { erro.textContent = 'Digite os 6 números do código.'; return cod.focus(); }
        if (s1.value.length < 10 || !/[a-zA-Z]/.test(s1.value) || !/[0-9]/.test(s1.value)) { erro.textContent = 'A senha precisa de pelo menos 10 caracteres, com letras e números.'; return s1.focus(); }
        if (s1.value !== s2.value) { erro.textContent = 'As duas senhas não são iguais.'; return s2.focus(); }
        bt.disabled = true; bt.textContent = 'Trocando…';
        try {
          await auth({ acao: 'senha_trocar', username: usuario, codigo: cod.value, senha: s1.value });
          s1.value = s2.value = '';
          passo3();
        } catch (ex) {
          bt.disabled = false; bt.textContent = 'Trocar senha';
          erro.textContent = ex.message || 'Não foi possível trocar a senha.';
          if (/código/i.test(erro.textContent)) { cod.value = ''; cod.focus(); }
        }
      };
      setTimeout(() => cod.focus(), 60);
    }
    function passo3() {
      form.innerHTML =
        '<img class="login-marca" src="assets/brand/logo-white.png" alt="Branding7">' +
        '<span class="lg2-ic es-ok" aria-hidden="true">' + SVG(IC.ok) + '</span>' +
        '<h1>Senha trocada!</h1>' +
        '<p class="login-sub">Pronto. Agora é só entrar com a senha nova. Se você estava logado em outro aparelho, vai precisar entrar de novo lá.</p>' +
        '<button class="b pri login-entrar" type="submit">Entrar</button>';
      form.onsubmit = e => { e.preventDefault(); voltar(usuario); };
      setTimeout(() => { const b = form.querySelector('.login-entrar'); if (b) b.focus(); }, 60);
    }
    passo1();
  }

  function passoLogin(form, info, opcoes) {
    const porEmail = info.metodo === 'email';
    form.innerHTML =
      '<img class="login-marca" src="assets/brand/logo-white.png" alt="Branding7">' +
      '<span class="lg2-ic" aria-hidden="true">' + SVG(porEmail ? IC.email : IC.app) + '</span>' +
      '<h1>Confirme que é você</h1>' +
      '<p class="login-sub">' + (porEmail ? 'Enviamos um e-mail para <b>' + esc(info.email) + '</b>. Toque em <b>“Sou eu”</b> no e-mail (pode ser no celular) ou digite o código de 6 números. Vale por 10 minutos.'
        : 'Abra o seu app autenticador e digite o código de 6 números do <b>Sistema B7</b>.') + '</p>' +
      '<label class="rot" for="lg-cod">CÓDIGO</label>' +
      '<input class="campo lg2-cod" id="lg-cod" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" placeholder="000000" required>' +
      '<label class="lg2-lembrar"><input type="checkbox" id="lg-lembrar"> Confiar neste aparelho por 30 dias</label>' +
      '<div class="login-erro" id="lg-erro" role="alert"></div>' +
      '<button class="b pri login-entrar" type="submit">Confirmar</button>' +
      '<div class="lg2-links">' + (porEmail ? '<button type="button" class="lg2-link" id="lg-reenviar">Reenviar código</button>' : '<span></span>') +
        '<button type="button" class="lg2-link" id="lg-voltar">Voltar</button></div>';
    const cod = form.querySelector('#lg-cod'), erro = form.querySelector('#lg-erro'), bt = form.querySelector('.login-entrar');
    cod.addEventListener('input', () => { cod.value = cod.value.replace(/\D/g, '').slice(0, 6); if (cod.value.length === 6) form.requestSubmit ? form.requestSubmit() : form.onsubmit(new Event('submit')); });
    form.querySelector('#lg-voltar').onclick = () => opcoes.voltar();
    const re = form.querySelector('#lg-reenviar');
    if (re) re.onclick = async () => {
      re.disabled = true; erro.textContent = '';
      try { await auth({ acao: 'login_2fa_reenviar', desafio: info.desafio }); erro.textContent = ''; re.textContent = 'Código reenviado'; setTimeout(() => { re.textContent = 'Reenviar código'; re.disabled = false; }, 30000); }
      catch (e) { erro.textContent = e.message || 'Não foi possível reenviar.'; re.disabled = false; }
    };
    let indo = false;
    form.onsubmit = async e => {
      if (e && e.preventDefault) e.preventDefault();
      if (indo || cod.value.length !== 6) return;
      indo = true; erro.textContent = ''; bt.disabled = true; bt.textContent = 'Conferindo…';
      const lembrar = form.querySelector('#lg-lembrar').checked;
      try {
        const r = await auth({ acao: 'login_2fa', desafio: info.desafio, codigo: cod.value, lembrar, aparelho_nome: nomeAparelho() });
        if (r && r.aparelho) gravarAparelho(opcoes.username, r.aparelho);
        await opcoes.concluir(r);
      } catch (ex) {
        indo = false; bt.disabled = false; bt.textContent = 'Confirmar';
        const msg = ex.message || 'Não foi possível confirmar.';
        erro.textContent = msg; cod.value = ''; cod.focus();
        if (/entre de novo/i.test(msg)) { bt.textContent = 'Voltar ao login'; bt.type = 'button'; bt.onclick = () => opcoes.voltar(); }
      }
    };
    setTimeout(() => cod.focus(), 60);
    /* zzz221: o botão do e-mail aprova a entrada; esta tela pergunta de tempos em tempos e entra sozinha */
    if (porEmail) {
      const inicio = Date.now();
      const espiar = async () => {
        if (!cod.isConnected || indo || Date.now() - inicio > 11 * 60 * 1000) return;
        try {
          const r = await auth({ acao: 'login_2fa_status', desafio: info.desafio, lembrar: form.querySelector('#lg-lembrar').checked, aparelho_nome: nomeAparelho() });
          if (r && !r.pendente && r.access_token && !indo && cod.isConnected) {
            indo = true; bt.disabled = true; bt.textContent = 'Confirmado pelo e-mail…';
            if (r.aparelho) gravarAparelho(opcoes.username, r.aparelho);
            return await opcoes.concluir(r);
          }
        } catch (e) {
          if (/entre de novo|expirou/i.test(e.message || '')) return;
        }
        setTimeout(espiar, 3000);
      };
      setTimeout(espiar, 4000);
    }
  }

  /* =============================================================== Google */
  /* zzz273: o programa do Windows novo abre o Google no navegador e recebe a volta
     (window.B7Desktop.oauth); o antigo e o app de Android ainda não */
  const pcComGoogle = () => !!(window.B7Desktop && typeof window.B7Desktop.oauth === 'function');
  const semGoogleAqui = () => (/Electron\//.test(navigator.userAgent || '') && !pcComGoogle()) ||
    !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const VOLTA_PC = 'http://127.0.0.1:47821/callback';
  /* no programa: pede o endereço sem sair da tela, abre no navegador e, com o código
     de volta, recarrega com ?code= — o mesmo caminho da volta no navegador (retornoOAuth) */
  async function pelaJanelaDoPc(pedir) {
    const { data, error } = await pedir({ redirectTo: VOLTA_PC, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } });
    if (error) throw error;
    if (!data || !data.url) throw new Error('O Supabase não devolveu o endereço de login.');
    B7.UI.toast('Continue no navegador: escolha a sua conta Google e volte para o programa.', { tipo: 'info', tempo: 9000 });
    const r = await window.B7Desktop.oauth(data.url);
    if (!r || r.erro) { if (r && r.erro === 'cancelado') return; throw new Error((r && r.erro) || 'Sem resposta do Google.'); }
    location.replace(location.pathname + '?code=' + encodeURIComponent(r.code) + location.hash);
  }
  let googleCache = null;
  async function googleLigado() {
    if (googleCache !== null) return googleCache;
    if (semGoogleAqui() || !B7.sb) return (googleCache = false);
    try {
      const cfg = window.B7_CONFIG || {};
      const base = String(cfg.SUPABASE_URL || '').trim().replace(/\/+$/, '');
      const r = await fetch(base + '/auth/v1/settings', { headers: { apikey: String(cfg.SUPABASE_PUBLISHABLE_KEY || '').trim() } });
      const d = await r.json();
      googleCache = !!(d && d.external && d.external.google);
    } catch (e) { googleCache = false; }
    return googleCache;
  }
  const voltaUrl = () => location.origin + location.pathname;
  const marcarOauth = t => { try { localStorage.setItem('b7_oauth', t); } catch (e) {} };
  async function entrarComGoogle() {
    marcarOauth('login');
    if (pcComGoogle()) return pelaJanelaDoPc(op => B7.sb.auth.signInWithOAuth({ provider: 'google', options: op }));
    const { error } = await B7.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: voltaUrl(), queryParams: { prompt: 'select_account' } } });
    if (error) throw error;
  }
  async function vincularGoogle() {
    marcarOauth('vincular');
    if (pcComGoogle()) return pelaJanelaDoPc(op => B7.sb.auth.linkIdentity({ provider: 'google', options: op }));
    const { error } = await B7.sb.auth.linkIdentity({ provider: 'google', options: { redirectTo: voltaUrl(), queryParams: { prompt: 'select_account' } } });
    if (error) throw error;
  }
  async function identidadeGoogle() {
    try { const { data } = await B7.sb.auth.getUserIdentities(); return ((data && data.identities) || []).find(i => i.provider === 'google') || null; }
    catch (e) { return null; }
  }
  function traduzirErro(msg, tipo) {
    const m = String(msg || '');
    if (/sign ?ups? not allowed|signup.*disabled|user not found/i.test(m)) return 'Essa conta Google não está ligada a nenhum usuário do B7. Entre com usuário e senha e vincule o Google em Meu perfil → Segurança.';
    if (/manual linking/i.test(m)) return 'O administrador precisa ativar o "Manual linking" no Supabase para vincular contas Google.';
    if (/already|identity.*exists/i.test(m)) return 'Essa conta Google já está ligada a outro usuário do B7.';
    if (/access_denied|cancel/i.test(m)) return tipo === 'vincular' ? 'Vinculação com o Google cancelada.' : 'Entrada com o Google cancelada.';
    return (tipo === 'vincular' ? 'Não foi possível vincular o Google: ' : 'Não foi possível entrar com o Google: ') + m;
  }
  /* volta do Google (?code=… ou ?error=…): troca o código pela sessão */
  async function retornoOAuth() {
    const u = new URL(location.href);
    const code = u.searchParams.get('code'), erro = u.searchParams.get('error_description') || u.searchParams.get('error');
    if (!code && !erro) return null;
    let tipo = '';
    try { tipo = localStorage.getItem('b7_oauth') || ''; localStorage.removeItem('b7_oauth'); } catch (e) {}
    ['code', 'error', 'error_code', 'error_description', 'state', 'sb'].forEach(k => u.searchParams.delete(k));
    try { history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams : '') + location.hash); } catch (e) {}
    if (erro) return { erro: traduzirErro(erro, tipo) };
    if (!B7.sb) return null;
    const { error } = await B7.sb.auth.exchangeCodeForSession(code);
    if (error) return { erro: traduzirErro(error.message, tipo) };
    return { ok: true, tipo };
  }
  async function botaoGoogleLogin(form) {
    if (!(await googleLigado()) || !form.isConnected) return;
    const bt = form.querySelector('.login-entrar'); if (!bt) return;
    bt.insertAdjacentHTML('afterend', '<div class="lg-ou"><span>ou</span></div><button type="button" class="b contorno lg-google"><span class="lg-g-badge">' + GOOGLE_LOGO + '</span>Entrar com Google</button>');
    form.querySelector('.lg-google').onclick = async () => {
      try { await entrarComGoogle(); } catch (e) { const er = form.querySelector('#lg-erro'); if (er) er.textContent = traduzirErro(e.message, 'login'); }
    };
  }

  /* ==================================================== cartão do perfil */
  let st = null;
  async function montarCartao(cx, cxGoogle) {
    if (!cx) return;
    cx.innerHTML = '<div class="pf-carregando">' + (B7.UI.skeleton ? B7.UI.skeleton('lista', { n: 2 }) : 'Carregando…') + '</div>';
    try { st = await auth({ acao: 'seg_status' }); }
    catch (e) { cx.innerHTML = '<p class="ajuda">Não foi possível ver a verificação em 2 etapas agora. ' + esc(e.message || '') + '</p>'; return; }
    if (!cx.isConnected) return;
    const ligado = !!st.metodo, adm = !!(B7.Auth && B7.Auth.ehAdminReal && B7.Auth.ehAdminReal());
    const emailOk = st.email_envio === 'ok';
    const como = st.metodo === 'email' ? 'por e-mail · ' + esc(mascara(st.email)) : st.metodo === 'app' ? 'pelo app autenticador' : '';
    cx.innerHTML =
      '<h4 class="pf-tit"><span class="pf-ic pf-verde" aria-hidden="true">' + SVG(IC.escudo) + '</span>Verificação em 2 etapas' +
        '<span class="seg-pill' + (ligado ? ' on' : '') + '">' + (ligado ? 'Ligada' : 'Desligada') + '</span></h4>' +
      '<p class="ajuda">' + (ligado ? 'Ao entrar com usuário e senha, o sistema pede também um código ' + como + '.'
        : 'Mais proteção: além da senha, o sistema pede um código de 6 números. Mesmo que alguém descubra a sua senha, não entra.') + '</p>' +
      (st.exigido && !ligado ? '<div class="seg-aviso">A administração pede que você ligue a verificação em 2 etapas.</div>' : '') +
      (ligado
        ? '<div class="seg-acoes"><button type="button" class="b fina contorno" data-seg="trocar">Trocar para ' + (st.metodo === 'email' ? 'app autenticador' : 'e-mail') + '</button>' +
            (st.aparelhos ? '<button type="button" class="b fina contorno" data-seg="esquecer">Esquecer aparelhos de confiança (' + st.aparelhos + ')</button>' : '') +
            '<button type="button" class="b fina contorno perigo" data-seg="desligar">Desligar</button></div>'
        : '<div class="seg-opcoes">' +
            '<button type="button" class="seg-op" data-seg="email"' + (emailOk ? '' : ' disabled') + '>' + SVG(IC.email) + '<span><b>Código por e-mail</b><small>' +
              (emailOk ? 'Chega no seu e-mail a cada entrada' : 'O envio de e-mail ainda não está configurado') + '</small></span></button>' +
            '<button type="button" class="seg-op" data-seg="app">' + SVG(IC.app) + '<span><b>App autenticador</b><small>Google Authenticator, Authy ou Microsoft Authenticator</small></span></button>' +
          '</div>') +
      /* zzz247: nas Configurações a regra da equipe fica em Equipe → Segurança da equipe */
      (adm && !cx.closest('.cfg-meu-perfil') ? '<div class="seg-politica"><label class="rot" for="seg-pol">PARA A EQUIPE (SÓ ADMINISTRADOR)</label><div class="seg-pol-l">' +
          '<select class="campo fina" id="seg-pol"><option value="ninguem">Cada pessoa decide</option><option value="gestao">Exigir de administração e coordenação</option><option value="todos">Exigir de toda a equipe</option></select>' +
          '<button type="button" class="b fina pri" id="seg-pol-b" disabled>Salvar</button></div>' +
          '<small class="ajuda">Quem é exigido e ainda não ligou recebe o pedido ao entrar. Quem perdeu o celular: Usuários e acessos → ⋯ → "Desligar verificação em 2 etapas".</small></div>' : '') +
      /* zzz296: e-mail de recuperação — é para lá que vai o "Esqueci minha senha" */
      '<div class="seg-rec"><h4 class="pf-tit"><span class="pf-ic pf-azul" aria-hidden="true">' + SVG(IC.email) + '</span>E-mail de recuperação' +
        '<span class="seg-pill' + (st.email_recuperacao ? ' on' : '') + '">' + (st.email_recuperacao ? 'Cadastrado' : 'Não cadastrado') + '</span></h4>' +
        '<p class="ajuda">' + (st.email_recuperacao ? 'Se você esquecer a senha, o código para criar uma nova chega em <b>' + esc(mascara(st.email_recuperacao)) + '</b>.'
          : 'Cadastre um e-mail seu: se um dia você esquecer a senha, é por ele que você cria uma nova, sem depender de ninguém.') + '</p>' +
        '<div class="seg-acoes"><button type="button" class="b fina contorno" data-seg-rec' + (emailOk ? '' : ' disabled') + '>' +
          (st.email_recuperacao ? 'Trocar e-mail' : 'Cadastrar e-mail') + '</button></div></div>';
    const brec = cx.querySelector('[data-seg-rec]');
    if (brec) brec.onclick = () => fluxoRecuperacao(() => montarCartao(cx, cxGoogle));
    cx.querySelectorAll('[data-seg]').forEach(b => b.onclick = () => {
      const a = b.dataset.seg;
      if (a === 'email') return fluxoEmail(() => montarCartao(cx, cxGoogle));
      if (a === 'app') return fluxoApp(() => montarCartao(cx, cxGoogle));
      if (a === 'trocar') return (st.metodo === 'email' ? fluxoApp : fluxoEmail)(() => montarCartao(cx, cxGoogle));
      if (a === 'esquecer') return (async () => {
        try { await auth({ acao: 'seg_aparelhos_esquecer' }); esquecerAparelhosLocais(); B7.UI.toast('Pronto. Todo aparelho vai pedir o código de novo.'); montarCartao(cx, cxGoogle); }
        catch (e) { B7.UI.toast(e.message || 'Não foi possível.', { tipo: 'erro' }); }
      })();
      if (a === 'desligar') return desligar(() => montarCartao(cx, cxGoogle));
    });
    const pol = cx.querySelector('#seg-pol');
    if (pol) {
      pol.value = st.politica || 'ninguem';
      const bp = cx.querySelector('#seg-pol-b');
      pol.onchange = () => { bp.disabled = pol.value === (st.politica || 'ninguem'); };
      bp.onclick = async () => {
        bp.disabled = true;
        try { await auth({ acao: 'seg_politica', exigir_2fa: pol.value }); st.politica = pol.value; B7.UI.toast('Regra salva. Vale a partir da próxima entrada de cada pessoa.'); }
        catch (e) { B7.UI.toast(e.message || 'Não foi possível salvar.', { tipo: 'erro' }); bp.disabled = false; }
      };
    }
    montarGoogle(cxGoogle);
  }

  async function montarGoogle(cx) {
    if (!cx) return;
    /* zzz271: em vez de sumir, o cartão diz por que não dá para vincular
       (no app, só no navegador; no servidor, o Google ainda não foi ligado) */
    if (!(await googleLigado())) {
      const app = semGoogleAqui();
      const adm = !!(B7.Auth && B7.Auth.ehAdminReal && B7.Auth.ehAdminReal());
      cx.hidden = false;
      cx.innerHTML = '<h4 class="pf-tit"><span class="pf-ic pf-azul" aria-hidden="true">' + SVG(IC.google) + '</span>Entrar com Google' +
          '<span class="seg-pill">' + (app ? 'Só no navegador' : 'Indisponível') + '</span></h4>' +
        '<p class="ajuda">' + (app
          ? (/Electron\//.test(navigator.userAgent || '') ? 'Atualize o programa do Windows (Ajuda → Procurar atualização) para entrar com o Google por aqui. Enquanto isso, dá para vincular pelo navegador (Chrome, Edge…) em Meu perfil → Segurança.' : 'O app de Android ainda não entra com o Google. Use o navegador (Chrome) do celular ou do computador: vincule em Meu perfil → Segurança e o botão "Entrar com Google" aparece no login.')
          : adm
          ? 'O login com Google ainda não está ligado no servidor. É preciso criar as credenciais do Google (Google Cloud) e ativar o provedor Google e o "Manual linking" no Supabase — depois disso este botão funciona para todo mundo.'
          : 'O login com Google ainda não foi ativado pela administração.') + '</p>';
      return;
    }
    cx.hidden = false;
    const idt = await identidadeGoogle();
    const email = idt && idt.identity_data && idt.identity_data.email;
    cx.innerHTML = '<h4 class="pf-tit"><span class="pf-ic pf-azul" aria-hidden="true">' + SVG(IC.google) + '</span>Entrar com Google' +
        '<span class="seg-pill' + (idt ? ' on' : '') + '">' + (idt ? 'Vinculada' : 'Não vinculada') + '</span></h4>' +
      '<p class="ajuda">' + (idt ? 'Você pode entrar com a conta Google <b>' + esc(email || '') + '</b> no lugar do usuário e senha (só no navegador).'
        : 'Vincule a sua conta Google para entrar com um clique, sem digitar a senha (só no navegador).') + '</p>' +
      '<div class="seg-acoes">' + (idt ? '<button type="button" class="b fina contorno" id="seg-g-sair">Desvincular</button>' : '<button type="button" class="b fina pri" id="seg-g-ligar">Vincular conta Google</button>') + '</div>';
    const ligar = cx.querySelector('#seg-g-ligar');
    if (ligar) ligar.onclick = async () => { try { await vincularGoogle(); } catch (e) { B7.UI.toast(traduzirErro(e.message, 'vincular'), { tipo: 'erro' }); } };
    const sair = cx.querySelector('#seg-g-sair');
    if (sair) sair.onclick = async () => {
      if (!(await B7.UI.confirmar({ titulo: 'Desvincular a conta Google?', texto: 'Você volta a entrar só com usuário e senha.', confirmar: 'Desvincular' }))) return;
      try { const { error } = await B7.sb.auth.unlinkIdentity(idt); if (error) throw error; B7.UI.toast('Conta Google desvinculada.'); montarGoogle(cx); }
      catch (e) { B7.UI.toast('Não foi possível desvincular: ' + (e.message || ''), { tipo: 'erro' }); }
    };
  }

  /* ---------------------------------------------------- ligar por e-mail */
  /* zzz296: cadastrar o e-mail de recuperação (código de 6 números) */
  function fluxoRecuperacao(aoTerminar) {
    const m = B7.UI.modal('<h3>E-mail de recuperação</h3>' +
      '<p class="sub">Use um e-mail seu, que você consegue abrir. Se esquecer a senha, o código para criar uma nova chega nele.</p>' +
      '<div class="seg-passo" id="rec-p1"><label class="rot" for="rec-email">SEU E-MAIL</label>' +
        '<input class="campo" id="rec-email" type="email" autocomplete="email" data-foco placeholder="voce@gmail.com" value="' + esc((st && (st.email_recuperacao || st.email)) || '') + '"></div>' +
      '<div class="seg-passo" id="rec-p2" hidden><label class="rot" for="rec-cod">CÓDIGO QUE CHEGOU</label>' +
        '<input class="campo seg-cod" id="rec-cod" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"><small class="ajuda" id="rec-dica"></small></div>' +
      '<div class="login-erro" id="rec-erro" role="alert"></div>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="rec-ok">Enviar código</button></div>');
    const q = s => m.querySelector(s), ok = q('#rec-ok'), erro = q('#rec-erro');
    let etapa = 1;
    q('#rec-cod').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
    ok.onclick = async () => {
      erro.textContent = ''; ok.disabled = true;
      try {
        if (etapa === 1) {
          const r = await auth({ acao: 'seg_rec_enviar', email: q('#rec-email').value.trim() });
          etapa = 2; q('#rec-p1').hidden = true; q('#rec-p2').hidden = false; ok.textContent = 'Confirmar';
          q('#rec-dica').textContent = 'Enviamos para ' + r.email + '. Digite o código aqui. Não chegou? Confira o spam.';
          q('#rec-cod').focus();
        } else {
          await auth({ acao: 'seg_rec_confirmar', codigo: q('#rec-cod').value });
          m.fechar(); B7.UI.toast('E-mail de recuperação cadastrado.'); aoTerminar && aoTerminar(true); return;
        }
      } catch (e) { erro.textContent = e.message || 'Não foi possível.'; }
      ok.disabled = false;
    };
  }

  function fluxoEmail(aoTerminar) {
    const m = B7.UI.modal('<h3>Código por e-mail</h3>' +
      '<p class="sub">Escreva um e-mail seu, que você abre no celular. Vamos mandar um código para confirmar.</p>' +
      '<div class="seg-passo" id="seg-p1"><label class="rot" for="seg-email">SEU E-MAIL</label>' +
        '<input class="campo" id="seg-email" type="email" autocomplete="email" data-foco placeholder="voce@gmail.com" value="' + esc((st && st.email) || '') + '"></div>' +
      '<div class="seg-passo" id="seg-p2" hidden><label class="rot" for="seg-cod">CÓDIGO QUE CHEGOU</label>' +
        '<input class="campo seg-cod" id="seg-cod" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"><small class="ajuda" id="seg-dica"></small></div>' +
      '<div class="login-erro" id="seg-erro" role="alert"></div>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="seg-ok">Enviar código</button></div>');
    const q = s => m.querySelector(s), ok = q('#seg-ok'), erro = q('#seg-erro');
    let etapa = 1;
    q('#seg-cod').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
    ok.onclick = async () => {
      erro.textContent = ''; ok.disabled = true;
      try {
        if (etapa === 1) {
          const r = await auth({ acao: 'seg_email_enviar', email: q('#seg-email').value.trim() });
          etapa = 2; q('#seg-p1').hidden = true; q('#seg-p2').hidden = false; ok.textContent = 'Confirmar';
          q('#seg-dica').textContent = 'Enviamos para ' + r.email + '. Toque em “Confirmar meu e-mail” no e-mail (pode ser no celular) ou digite o código aqui. Não chegou? Confira o spam.';
          q('#seg-cod').focus();
          /* zzz221: se a pessoa confirmar pelo botão do e-mail, esta janela percebe sozinha */
          const alvo = q('#seg-email').value.trim().toLowerCase(), inicio = Date.now();
          const espiar = async () => {
            if (!m.isConnected || Date.now() - inicio > 11 * 60 * 1000) return;
            try {
              const s2 = await auth({ acao: 'seg_status' });
              if (s2 && s2.metodo === 'email' && String(s2.email || '').toLowerCase() === alvo && m.isConnected) {
                m.fechar(); B7.UI.toast('E-mail confirmado. Verificação em 2 etapas ligada.'); aoTerminar && aoTerminar(true); return;
              }
            } catch (e) {}
            setTimeout(espiar, 3500);
          };
          setTimeout(espiar, 4000);
        } else {
          await auth({ acao: 'seg_email_confirmar', codigo: q('#seg-cod').value });
          m.fechar(); B7.UI.toast('Verificação em 2 etapas ligada por e-mail.'); aoTerminar && aoTerminar(true);
        }
      } catch (e) { erro.textContent = e.message || 'Não foi possível.'; }
      ok.disabled = false;
    };
    return m;
  }

  /* --------------------------------------------- ligar pelo app autenticador */
  async function fluxoApp(aoTerminar) {
    const m = B7.UI.modal('<h3>App autenticador</h3>' +
      '<ol class="seg-lista"><li>Instale no celular um app autenticador (Google Authenticator, Microsoft Authenticator ou Authy).</li>' +
        '<li>No app, toque em <b>+</b> e leia o QR Code abaixo (ou digite a chave).</li><li>Digite aqui o código de 6 números que aparece no app.</li></ol>' +
      '<div class="seg-qr" id="seg-qr">' + (B7.UI.skeleton ? B7.UI.skeleton('lista', { n: 1 }) : '') + '</div>' +
      '<label class="rot" for="seg-cod">CÓDIGO DO APP</label><input class="campo seg-cod" id="seg-cod" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">' +
      '<div class="login-erro" id="seg-erro" role="alert"></div>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="seg-ok" disabled>Confirmar</button></div>', { larga: true });
    const q = s => m.querySelector(s), ok = q('#seg-ok'), erro = q('#seg-erro');
    q('#seg-cod').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
    try {
      const [r] = await Promise.all([auth({ acao: 'seg_app_iniciar' }), B7.vendor ? B7.vendor('qrcode').catch(() => null) : null]);
      let svg = '';
      if (window.qrcode) { const c = window.qrcode(0, 'M'); c.addData(r.uri); c.make(); svg = c.createSvgTag(5, 10); }
      q('#seg-qr').innerHTML = (svg ? '<div class="seg-qr-img">' + svg + '</div>' : '') +
        '<div class="seg-qr-tx"><small>Chave (se não der para ler o QR Code):</small><code>' + esc(r.segredo.replace(/(.{4})/g, '$1 ').trim()) + '</code>' +
        (/Android|iPhone|iPad/.test(navigator.userAgent || '') ? '<a class="b fina contorno" href="' + esc(r.uri) + '">Abrir no app do celular</a>' : '') + '</div>';
      ok.disabled = false;
    } catch (e) { q('#seg-qr').innerHTML = '<p class="ajuda">' + esc(e.message || 'Não foi possível começar.') + '</p>'; }
    ok.onclick = async () => {
      erro.textContent = ''; ok.disabled = true;
      try { await auth({ acao: 'seg_app_confirmar', codigo: q('#seg-cod').value }); m.fechar(); B7.UI.toast('Verificação em 2 etapas ligada pelo app.'); aoTerminar && aoTerminar(true); }
      catch (e) { erro.textContent = e.message || 'Não foi possível.'; ok.disabled = false; }
    };
    return m;
  }

  /* ----------------------------------------------------------- desligar */
  function desligar(aoTerminar) {
    const m = B7.UI.modal('<h3>Desligar a verificação em 2 etapas?</h3><p class="sub">Para confirmar, digite a sua senha.</p>' +
      '<input class="campo" id="seg-senha" type="password" autocomplete="current-password" data-foco>' +
      '<div class="login-erro" id="seg-erro" role="alert"></div>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri perigo" id="seg-ok">Desligar</button></div>');
    const ok = m.querySelector('#seg-ok'), erro = m.querySelector('#seg-erro');
    ok.onclick = async () => {
      ok.disabled = true; erro.textContent = '';
      try { await auth({ acao: 'seg_desligar', senha: m.querySelector('#seg-senha').value }); esquecerAparelhosLocais(); m.fechar(); B7.UI.toast('Verificação em 2 etapas desligada.'); aoTerminar && aoTerminar(); }
      catch (e) { erro.textContent = e.message || 'Não foi possível.'; ok.disabled = false; }
    };
  }

  /* ------------------------------ quando a administração exige (ao entrar) */
  function configurar(opcoes) {
    opcoes = opcoes || {};
    let pronto = false;
    const reabrir = () => { if (!pronto && opcoes.obrigatorio) setTimeout(() => configurar(opcoes), 250); };
    const m = B7.UI.modal('<div class="seg-intro"><span class="lg2-ic">' + SVG(IC.escudo) + '</span>' +
      '<h3>Ligue a verificação em 2 etapas</h3><p class="sub">' + (opcoes.obrigatorio ? 'A administração pediu mais proteção para a sua conta. ' : '') +
        'Além da senha, o sistema vai pedir um código de 6 números ao entrar. Escolha como quer receber:</p></div>' +
      '<div class="seg-opcoes"><button type="button" class="seg-op" data-c="email">' + SVG(IC.email) + '<span><b>Código por e-mail</b><small>Chega no seu e-mail a cada entrada</small></span></button>' +
        '<button type="button" class="seg-op" data-c="app">' + SVG(IC.app) + '<span><b>App autenticador</b><small>Google Authenticator, Authy ou Microsoft Authenticator</small></span></button></div>' +
      '<div class="acoes">' + (opcoes.obrigatorio ? '<button type="button" class="b contorno" id="seg-sair">Sair da conta</button>' : '<button type="button" class="b contorno" data-fecha>Agora não</button>') + '</div>',
      { aoFechar: () => setTimeout(() => { if (!fluxoAberto) reabrir(); }, 0) });
    let fluxoAberto = false;
    const terminou = ok => { fluxoAberto = false; if (ok) pronto = true; else reabrir(); };
    m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
      fluxoAberto = true; m.fechar();
      const f = b.dataset.c === 'email' ? fluxoEmail(terminou) : null;
      const prom = b.dataset.c === 'app' ? fluxoApp(terminou) : Promise.resolve(f);
      /* fechar o passo sem terminar volta para a escolha */
      Promise.resolve(prom).then(mm => { if (mm && mm.addEventListener) {
        const obs = new MutationObserver(() => { if (!mm.isConnected) { obs.disconnect(); setTimeout(() => { if (!pronto) terminou(false); }, 50); } });
        obs.observe(document.body, { childList: true });
      } });
    });
    const sair = m.querySelector('#seg-sair');
    if (sair) sair.onclick = () => { pronto = true; m.fechar(); if (B7.Auth && B7.Auth.sair) B7.Auth.sair(); };
  }

  return { lerAparelho, passoLogin, esqueciSenha, retornoOAuth, botaoGoogleLogin, montarCartao, configurar, googleLigado };
})();
