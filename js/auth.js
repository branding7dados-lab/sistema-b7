/* =====================================================================
   AUTENTICAÇÃO — sessão e tela de login

   O login não acontece direto no Supabase: o cliente não tem e-mail, e a
   tradução username → identidade técnica mora no backend, para que
   ninguém consiga descobrir quais usernames existem. Aqui só entram o
   que a pessoa digitou e a sessão que a função devolve.

   Nada de senha em memória depois do envio, nada de papel vindo do
   frontend: o papel é lido do banco a cada abertura.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Auth = (function () {
  const esc = B7.UI ? B7.UI.esc : (s => String(s || ''));

  /* Aparece no rodapé da tela de acesso. Serve para saber, olhando, qual
     build está publicado — sem isso não dá para distinguir "o bug voltou"
     de "a correção não subiu". */
  const VERSAO = '2026-09-14-k';

  /* Rastro dos eventos de sessão, guardado entre recarregamentos.
     Sem ele, um laço que atravessa reloads é invisível: cada página
     começa do zero e o console perde a história. */
  function anotar(evento, extra) {
    try {
      const linhas = JSON.parse(sessionStorage.getItem('b7_rastro') || '[]');
      linhas.push({
        t: new Date().toISOString().slice(11, 23),
        e: evento,
        x: extra === undefined ? '' : String(extra).slice(0, 120)
      });
      /* só o fim interessa: o começo do laço se repete */
      sessionStorage.setItem('b7_rastro', JSON.stringify(linhas.slice(-40)));
    } catch (e) {}
  }
  function rastro() {
    try { return JSON.parse(sessionStorage.getItem('b7_rastro') || '[]'); }
    catch (e) { return []; }
  }

  let sessao = null;      /* { id, username, nome, papel, estado, empresas } */

  const sb = () => B7.DB.cliente_supabase ? B7.DB.cliente_supabase() : null;

  /* O navegador guarda o que precisamos? Em aba anônima ou com cookies
     bloqueados, a resposta é não — e nenhum login sobreviveria. */
  function testarArmazenamento() {
    try {
      localStorage.setItem('b7_teste_guarda', '1');
      const ok = localStorage.getItem('b7_teste_guarda') === '1';
      localStorage.removeItem('b7_teste_guarda');
      return ok;
    } catch (e) { return false; }
  }

  /* ---------------------------------------------------------- estado */
  const usuario = () => sessao;
  const papel = () => (sessao ? sessao.papel : null);
  const ehEquipe = () => ['admin', 'coordenador'].includes(papel());
  const ehAdmin = () => papel() === 'admin';
  const ehCliente = () => papel() === 'cliente';

  /* Funções extras de produção (B7 Vídeo Parte 1.1): uma pessoa continua
     com UM papel principal (acima), mas pode acumular funções extras
     sem precisar de uma segunda conta — hoje só "videomaker". Kevin
     pode ser papel='admin' com funcoes_extra=['videomaker']: continua
     admin por completo e também é elegível para receber Demandas de
     Edição. Vem de minha_sessao (migration_video_producao.sql); numa
     instalação sem essa migração, funcoesExtra() simplesmente devolve
     lista vazia (a coluna não existe na sessão e some ao contrato). */
  const funcoesExtra = () => (sessao && sessao.funcoes_extra) || [];
  const souVideomakerElegivel = () => papel() === 'videomaker' || funcoesExtra().includes('videomaker');

  /* Empresas que a sessão alcança. Para a equipe, vazio significa todas. */
  const empresas = () => (sessao && sessao.empresas) || [];

  /* =================================================================
     CARREGAR A SESSÃO
     A view minha_sessao já filtra por auth.uid(), então o que chega aqui
     é sempre do próprio usuário — não há como pedir a de outro.
     ================================================================= */
  async function carregar() {
    /* Sem token não adianta consultar: a resposta viria vazia e o sistema
       concluiria "não está logado" mesmo logo depois de entrar. */
    const tokenAtivo = await B7.DB.sessaoSupabase();
    if (!tokenAtivo) { anotar('carregar', 'sem token'); sessao = null; return null; }
    anotar('carregar', 'token presente');

    try {
      const linhas = await B7.DB.minhaSessao();
      sessao = linhas || null;
      anotar('perfil', sessao ? ('ok: ' + sessao.username + '/' + sessao.papel) : 'vazio');
      if (!sessao) {
        /* token válido e perfil ausente é outro problema, não falta de
           login: registrar ajuda a distinguir os dois na instalação */
        console.warn('B7: sessão ativa, mas nenhum perfil correspondente foi encontrado.');
      }
    } catch (e) {
      console.warn('B7: falha ao ler o perfil da sessão.', e && e.message);
      anotar('perfil', 'erro: ' + (e && e.message));
      sessao = null;
    }
    return sessao;
  }

  /* =================================================================
     LOGIN
     ================================================================= */
  async function entrar(username, senha) {
    anotar('entrar', username);
    const r = await B7.DB.chamarAuth({ acao: 'login', username, senha });
    if (!r || !r.access_token) {
      throw new Error(r && r.erro ? r.erro : 'Não foi possível entrar.');
    }
    /* assume a sessão devolvida pela função; a partir daqui o supabase-js
       cuida da renovação do token */
    anotar('entrar', 'credencial aceita');
    await B7.DB.assumirSessao(r.access_token, r.refresh_token);
    await carregar();
    if (sessao) { try { sessionStorage.removeItem('b7_voltas_login'); } catch (e) {} }
    if (!sessao) {
      /* A credencial foi aceita, mas o perfil não veio. Duas causas
         possíveis, e a distinção economiza tempo de quem instala:
         a view minha_sessao não existe (migration incompleta) ou a
         conta existe no Auth sem perfil correspondente. */
      let detalhe = 'Entrou, mas o perfil não foi encontrado.';
      try {
        await B7.DB.minhaSessao();
        detalhe = 'Sua conta não tem perfil ativo. Fale com a Branding7.';
      } catch (x) {
        detalhe = 'A base de identidade não respondeu. Confira se o ' +
                  'migration_auth.sql foi executado.';
      }
      await B7.DB.encerrarSessao();
      sessao = null;
      throw new Error(detalhe);
    }
    return sessao;
  }

  /* Verifica que a sessão sobreviveria a um recarregamento. Sem isto, o
     reload que abre o sistema poderia devolver a pessoa ao login, num
     laço sem fim. */
  async function sessaoPersiste() {
    const s = await B7.DB.sessaoSupabase();
    return !!s;
  }

  async function sair() {
    anotar('sair', 'chamado');
    sessao = null;
    try { await B7.DB.encerrarSessao(); } catch (e) {}
    /* limpa o que ficou em memória e em cache local, para a próxima
       pessoa que abrir o navegador não ver dado de quem saiu */
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('b7_') && k !== 'b7_tema' && k !== 'b7_densidade') {
          localStorage.removeItem(k);
        }
      });
      sessionStorage.clear();
    } catch (e) {}
    location.hash = '';
    location.reload();
  }

  /* =================================================================
     TELA DE LOGIN
     Só logo, título, usuário, senha e Entrar. Sem escolha de perfil,
     sem cadastro, sem e-mail, sem login social.
     ================================================================= */
  function telaLogin(mensagem) {
    const tela = document.createElement('div');
    tela.className = 'tela-login';
    tela.innerHTML =
      /* Camadas do fundo: dois brilhos que respiram, a malha discreta e
         um rastro de luz. Nada disso carrega informação — some inteiro
         em prefers-reduced-motion. */
      '<div class="login-fundo">' +
        '<span class="brilho um"></span><span class="brilho dois"></span>' +
        '<span class="malha"></span><span class="rastro"></span>' +
      '</div>' +

      '<form class="login-caixa" autocomplete="off">' +
        /* fundo escuro pede a versão branca da marca: a colorida some */
        '<img class="login-marca" src="assets/brand/logo-white.png" alt="Branding7">' +
        '<h1>Acessar a plataforma</h1>' +
        '<p class="login-sub">Use o usuário e a senha que a Branding7 forneceu.</p>' +

        (mensagem ? '<div class="login-aviso">' + esc(mensagem) + '</div>' : '') +

        '<label class="rot" for="lg-user">USUÁRIO</label>' +
        '<input class="campo" id="lg-user" name="b7-user" autocomplete="username" ' +
          'autocapitalize="none" spellcheck="false" required>' +

        '<label class="rot" for="lg-senha">SENHA</label>' +
        '<div class="login-senha">' +
          '<input class="campo" id="lg-senha" name="b7-senha" type="password" ' +
            'autocomplete="current-password" required>' +
          '<button type="button" class="login-olho" aria-label="Mostrar senha">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
            '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/>' +
            '<circle cx="12" cy="12" r="3"/></svg></button>' +
        '</div>' +

        '<div class="login-erro" id="lg-erro" role="alert"></div>' +

        '<button class="b pri login-entrar" type="submit">Entrar</button>' +
      '</form>' +
      '<div class="login-rodape">v' + esc(VERSAO) + '</div>';

    document.body.appendChild(tela);
    document.body.classList.add('sem-sessao');

    const form = tela.querySelector('form');
    const campoUser = tela.querySelector('#lg-user');
    const campoSenha = tela.querySelector('#lg-senha');
    const erro = tela.querySelector('#lg-erro');
    const botao = tela.querySelector('.login-entrar');

    tela.querySelector('.login-olho').onclick = () => {
      const mostrando = campoSenha.type === 'text';
      campoSenha.type = mostrando ? 'password' : 'text';
      tela.querySelector('.login-olho').setAttribute('aria-label',
        mostrando ? 'Mostrar senha' : 'Ocultar senha');
      tela.querySelector('.login-olho').classList.toggle('on', !mostrando);
      campoSenha.focus();
    };

    form.onsubmit = async e => {
      e.preventDefault();
      const u = campoUser.value.trim();
      const s = campoSenha.value;
      if (!u || !s) return;

      erro.textContent = '';
      botao.disabled = true;
      botao.textContent = 'Entrando…';
      try {
        await entrar(u, s);
        /* a senha não fica em memória depois de enviada */
        campoSenha.value = '';
        tela.remove();
        document.body.classList.remove('sem-sessao');
        if (B7.aoEntrar) B7.aoEntrar();
      } catch (ex) {
        botao.disabled = false;
        botao.textContent = 'Entrar';
        erro.textContent = ex.message || 'Não foi possível entrar.';
        campoSenha.value = '';
        campoSenha.focus();
      }
    };

    setTimeout(() => campoUser.focus(), 60);
    return tela;
  }

  /* =================================================================
     PORTA DE ENTRADA
     Chamado no arranque: se há sessão válida, segue; senão, mostra o
     login. Enquanto a autenticação não for obrigatória (o corte do RLS
     ainda não rodou), `exigir` fica desligado e o sistema abre como
     hoje — assim ninguém fica trancado do lado de fora no meio da
     transição.
     ================================================================= */
  async function iniciar({ exigir = false } = {}) {
    anotar('iniciar', 'exigir=' + exigir);
    /* sem a função publicada, não há como autenticar: seguir sem sessão
       é melhor do que travar o sistema numa tela que não funciona */
    let disponivel = true;
    try { await B7.DB.chamarAuth({ acao: 'ping' }); }
    catch (e) { disponivel = !(e && e.rede); }   /* erro da função ≠ função ausente */

    await carregar();

    if (sessao) { anotar('iniciar', 'sessão válida — segue'); return { sessao, exigido: false }; }

    /* Sem o serviço de acesso publicado não existe login possível. Em vez
       de mostrar uma porta que não abre, deixamos o sistema como estava e
       o diagnóstico das Configurações aponta o que falta. */
    if (!disponivel) {
      console.warn('B7: serviço de acesso indisponível — login não exigido.');
      return { sessao: null, exigido: false, indisponivel: true };
    }
    if (!exigir) return { sessao: null, exigido: false };

    /* Detector de laço: se a tela de acesso reaparece várias vezes em
       poucos minutos, alguma coisa impede a sessão de sobreviver ao
       recarregamento. Em vez de repetir para sempre, mostramos o motivo. */
    let voltas = 0;
    try {
      const bruto = sessionStorage.getItem('b7_voltas_login');
      voltas = bruto ? parseInt(bruto, 10) || 0 : 0;
      sessionStorage.setItem('b7_voltas_login', String(voltas + 1));
    } catch (e) {}

    let aviso = '';
    if (voltas >= 2) {
      const guardaOk = testarArmazenamento();
      aviso = guardaOk
        ? 'A sessão não está sendo mantida entre as páginas. Se o problema ' +
          'persistir, o perfil da conta pode não existir no banco — confira em ' +
          'Configurações → Acesso.'
        : 'Este navegador está bloqueando o armazenamento local para o site. ' +
          'Saia da navegação anônima ou libere cookies e dados para este endereço.';
    }

    anotar('telaLogin', 'volta ' + voltas);
    telaLogin(aviso);
    return { sessao: null, exigido: true, voltas };
  }

  /* =================================================================
     MEU PERFIL
     Nome e senha da própria pessoa. Papel, empresas e estado não estão
     aqui: quem muda isso é o administrador, e deixar esses campos na
     tela do próprio usuário só criaria a expectativa de poder mexer.
     ================================================================= */
  function abrirPerfil() {
    const u = usuario();
    if (!u) return;
    const rotulo = { admin: 'Administrador', coordenador: 'Coordenador de mídias',
                     cliente: 'Cliente' }[u.papel] || u.papel;

    const m = B7.UI.modal(
      '<div class="perfil-topo">' +
        '<div class="perfil-avatar" id="pf-avatar">' +
          (u.avatar_url
            ? '<img src="' + esc(u.avatar_url) + '" alt="">'
            : esc((u.nome || u.username).slice(0, 2).toUpperCase())) + '</div>' +
        '<div><h3>' + esc(u.nome) + '</h3>' +
        '<div class="perfil-sub">@' + esc(u.username) + ' · ' + esc(rotulo) + '</div></div>' +
      '</div>' +

      '<div class="corpo">' +
        '<label class="rot">NOME</label>' +
        '<input class="campo" id="pf-nome" value="' + esc(u.nome) + '">' +
        '<div class="ajuda">É o nome que aparece para a equipe.</div>' +

        '<label class="rot">FOTO DE PERFIL</label>' +
        '<input class="campo" id="pf-foto" placeholder="https://…" value="' +
          esc(u.avatar_url || '') + '">' +
        '<div class="ajuda">Cole o link de uma imagem. ' +
          'Deixe vazio para voltar às iniciais.</div>' +

        '<div class="perfil-sep"><span>Trocar a senha</span></div>' +
        '<div class="ajuda" style="margin-top:0">Deixe em branco para manter a atual.</div>' +

        '<label class="rot">SENHA ATUAL</label>' +
        '<input class="campo" id="pf-atual" type="password" autocomplete="current-password">' +

        '<label class="rot">NOVA SENHA</label>' +
        '<input class="campo" id="pf-nova" type="password" autocomplete="new-password">' +
        '<div class="ajuda">Mínimo de 10 caracteres, com letras e números.</div>' +

        '<div id="pf-erro" class="ajuda erro-txt"></div>' +
      '</div>' +

      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Salvar</button></div>', { extra: 'modal-perfil' });

    const campoFoto = m.querySelector('#pf-foto');
    if (campoFoto) campoFoto.oninput = () => {
      const alvo = m.querySelector('#pf-avatar');
      const url = campoFoto.value.trim();
      alvo.innerHTML = url
        ? '<img src="' + esc(url) + '" alt="" onerror="this.remove()">'
        : esc((u.nome || u.username).slice(0, 2).toUpperCase());
    };

    m.querySelector('[data-ok]').onclick = async () => {
      const nome = m.querySelector('#pf-nome').value.trim();
      const atual = m.querySelector('#pf-atual').value;
      const nova = m.querySelector('#pf-nova').value;
      const erro = m.querySelector('#pf-erro');
      const botao = m.querySelector('[data-ok]');

      const foto = m.querySelector('#pf-foto').value.trim();
      if (!nome) { erro.textContent = 'O nome não pode ficar vazio.'; return; }
      if (nova && !atual) {
        erro.textContent = 'Informe a senha atual para definir uma nova.';
        return;
      }

      erro.textContent = '';
      botao.disabled = true; botao.textContent = 'Salvando…';
      try {
        await B7.DB.chamarAuth({
          acao: 'meu_perfil', nome,
          senha: nova || undefined,
          senha_atual: nova ? atual : undefined
        });
        /* a foto vai numa ação própria: ela é do usuário e segue regra
           diferente da senha */
        if (foto !== (u.avatar_url || '')) {
          await B7.DB.chamarAuth({ acao: 'meu_avatar', avatar_url: foto || null });
        }
        await carregar();
        m.fechar();
        if (B7.pintarSessao) B7.pintarSessao();
        B7.UI.toast(nova ? 'Perfil e senha atualizados' : 'Perfil atualizado');
      } catch (e) {
        botao.disabled = false; botao.textContent = 'Salvar';
        erro.textContent = e.message || 'Não foi possível salvar.';
      }
    };
  }

  return { VERSAO, anotar, rastro, iniciar, abrirPerfil, entrar, sair, carregar, telaLogin, sessaoPersiste,
           usuario, papel, empresas, ehEquipe, ehAdmin, ehCliente, funcoesExtra, souVideomakerElegivel };
})();
