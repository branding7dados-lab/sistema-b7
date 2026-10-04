/* =====================================================================
   USUÁRIOS E ACESSOS — só para o Administrador

   Nada aqui decide permissão: toda operação passa pela função b7-auth,
   que relê o papel de quem chamou direto do banco. Se alguém abrir esta
   tela sem ser admin, os botões existem mas o backend recusa.

   A senha aparece uma única vez, no momento da criação ou da
   redefinição, para a equipe copiar e entregar. Depois disso ela não é
   recuperável — nem por aqui, nem por ninguém.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Usuarios = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');

  const PAPEIS = [
    ['admin', 'Administrador', 'controla a plataforma, contas e configurações'],
    ['coordenador', 'Coordenador de mídias', 'produz e organiza o conteúdo'],
    ['designer', 'Designer', 'produz as artes a partir da Linha Editorial'],
    ['videomaker', 'Videomaker', 'filma e edita os vídeos das demandas'],
    ['cliente', 'Cliente', 'acompanha e aprova o que foi liberado']
  ];
  const rotuloPapel = p => (PAPEIS.find(x => x[0] === p) || [, p])[1];

  /* Funções extras de produção (B7 Vídeo Parte 1.1): aditivo ao papel
     principal acima, não substitui nada. Hoje só "videomaker" — uma
     pessoa continua com UM papel (ex.: Administrador) e pode acumular
     essa função extra sem precisar de uma segunda conta (ex.: Kevin,
     Administrador + Videomaker, numa conta só). Nunca combina com
     Cliente (perfil externo) — o bloco some quando o papel escolhido é
     "cliente", tanto ao criar quanto ao editar. */
  const FUNCOES_EXTRA = [
    ['videomaker', 'Videomaker', 'também filma e edita, além do papel principal'],
    /* Coordenação como função extra existe só para o Administrador: ele
       já tem, no banco, todas as permissões de coordenação; a função só
       liga o Painel do Coordenador (casa padrão). Em qualquer outro papel
       ela exigiria permissões que o papel não tem — por isso some. */
    ['coordenador', 'Coordenador de mídias', 'recebe o Painel de coordenação (só para Administrador)'],
    /* Designer como função extra: só Administrador e Coordenador (já são
       equipe no banco — leem e editam todo o Design). A função faz a
       pessoa aparecer como responsável possível das peças e ganhar o
       Painel do Designer. */
    ['designer', 'Designer', 'pode receber peças de Design (Administrador ou Coordenador)']
  ];
  /* a função extra não se aplica a este papel? (redundante ou restrita) */
  const extraIndisponivel = (funcao, papel) => funcao === papel || (funcao === 'coordenador' && papel !== 'admin') ||
    (funcao === 'designer' && papel !== 'admin' && papel !== 'coordenador');
  const rotuloFuncaoExtra = f => (FUNCOES_EXTRA.find(x => x[0] === f) || [, f])[1];

  /* =================================================================
     LISTA
     ================================================================= */
  async function abrir() {
    B7.Dashboard.marcarNav('#/config');
    B7.Rota.titulo(['Usuários e acessos']);
    painel().innerHTML = '<div class="conteudo">' + B7.UI.skeleton('lista', { n: 5 }) + '</div>';

    let dados, clientes;
    try {
      [dados, clientes] = await Promise.all([
        B7.DB.chamarAuth({ acao: 'listar_usuarios' }),
        B7.DB.listarClientes().catch(() => [])
      ]);
    } catch (e) {
      /* sem sessão o caminho é entrar, não ficar lendo mensagem de erro */
      const semSessao = !B7.Auth || !B7.Auth.usuario();
      return painel().innerHTML = '<div class="conteudo entra">' +
        '<div class="trilha"><a href="#/config">Configurações</a><span>/</span>' +
        '<b>Usuários e acessos</b></div>' +
        '<div class="estado-b7"><div class="b7-marca fraca"></div>' +
        (semSessao
          ? '<b>Entre para gerenciar as contas.</b>' +
            '<p>Esta área é do administrador. Use o botão <b>Entrar</b>, no topo da tela.</p>' +
            '<div class="acoes"><button class="b pri" id="ua-entrar">Entrar</button></div>'
          : '<b>' + esc(e.message || 'Não foi possível carregar as contas.') + '</b>' +
            '<p>Sua conta precisa ser de administrador para abrir esta área.</p>') +
        '</div></div>';
    } finally {
      const b = document.getElementById('ua-entrar');
      if (b) b.onclick = () => B7.Auth.telaLogin();
    }

    const usuarios = dados.usuarios || [];
    const vinculos = dados.vinculos || [];
    const funcoesExtraTodas = dados.funcoes_extra || [];
    const empresasDe = id => vinculos.filter(v => v.perfil_id === id)
      .map(v => (v.clientes && v.clientes.nome) || '');
    const funcoesExtraDe = id => funcoesExtraTodas.filter(f => f.perfil_id === id).map(f => f.funcao);

    const presenca = u => B7.Presenca ? B7.Presenca.rotulo(u)
      : { online: false, texto: u.ultimo_acesso ? 'Último acesso: ' + B7.UI.quando(u.ultimo_acesso) : 'Nunca acessou' };
    const ativos = usuarios.filter(u => u.estado === 'ativa');
    const online = ativos.filter(u => presenca(u).online).length;
    const inativas = usuarios.length - ativos.length;

    /* zzz9: tela mais calma — cabeçalho igual ao das outras telas, filtros
       numa fileira de pílulas com contagem e as pessoas numa lista
       agrupada (Equipe / Clientes), uma linha por conta. Mesmas ações e
       mesmos dados de antes. */
    const equipeN = ativos.filter(u => u.papel !== 'cliente').length;
    const clientesN = ativos.filter(u => u.papel === 'cliente').length;
    const pilula = (id, rot, n) => '<button type="button" class="lu3-pil' + (filtro.tipo === id ? ' on' : '') + '" data-lu-tipo="' + id + '">' +
      (id === 'online' ? '<i class="lu3-ponto' + (n ? ' vivo' : '') + '" aria-hidden="true"></i>' : '') +
      rot + '<b>' + n + '</b></button>';

    painel().innerHTML = '<div class="conteudo entra lu3">' +
      '<div class="trilha"><a href="#/config">Configurações</a><span>/</span>' +
      '<b>Usuários e acessos</b></div>' +
      '<div class="cab-conteudo lu3-cab"><div><h1>Usuários e acessos</h1>' +
        '<p>' + usuarios.length + ' conta' + (usuarios.length === 1 ? '' : 's') +
          (online ? ' · <span class="lu3-on">' + online + ' online agora</span>' : '') +
          ' · criadas pela Branding7, sem cadastro público.</p></div>' +
        '<button class="b pri lu3-novo" id="novo-usuario"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Novo usuário</span></button>' +
      '</div>' +

      (usuarios.length
        ? '<div class="lu3-barra">' +
            '<label class="lu-busca lu3-busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
            '<input id="lu-busca" placeholder="Buscar por nome ou usuário…" autocomplete="off" value="' + esc(filtro.termo) + '"></label>' +
            '<div class="lu3-pils" role="group" aria-label="Filtrar contas">' +
              pilula('todos', 'Todas', usuarios.length) +
              pilula('online', 'Online', online) +
              pilula('equipe', 'Equipe', equipeN) +
              (clientesN ? pilula('clientes', 'Clientes', clientesN) : '') +
              (inativas ? pilula('inativas', 'Desativadas', inativas) : '') +
            '</div>' +
          '</div>' +
          '<div id="lu-lista"></div>'
        : '<div class="estado-b7"><b>Nenhuma conta ainda.</b>' +
          '<p>Crie a primeira conta de coordenador ou cliente.</p></div>') +
    '</div>';

    document.getElementById('novo-usuario').onclick = () => modalNovo(clientes);

    const abrirAcao = (u, acao, estado) => {
      if (acao === 'senha') return modalSenha(u);
      if (acao === 'editar') return modalEditar(u, clientes, vinculos, funcoesExtraDe(u.id));
      if (acao === 'estado') return alterarEstado(u, estado);
      if (acao === 'foto') return modalFoto(u);
      if (acao === 'excluir') return excluirConta(u);
    };

    /* A lista é redesenhada a partir do que já veio do servidor: buscar
       e filtrar não refazem a consulta. Equipe e clientes em blocos
       separados — quem produz × quem acompanha. */
    function pintar() {
      const alvo = document.getElementById('lu-lista');
      if (!alvo) return;
      const termo = filtro.termo.trim().toLowerCase();
      const passaTipo = u => filtro.tipo === 'online' ? (u.estado === 'ativa' && presenca(u).online)
        : filtro.tipo === 'equipe' ? u.papel !== 'cliente'
        : filtro.tipo === 'clientes' ? u.papel === 'cliente'
        : filtro.tipo === 'inativas' ? u.estado !== 'ativa' : true;
      const passa = u => passaTipo(u) && (!termo || (u.nome || '').toLowerCase().includes(termo) ||
        (u.username || '').toLowerCase().includes(termo));
      const eu = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
      const minha = u => (eu && eu.id === u.id ? 0 : 1);
      const ordem = (a, b) => minha(a) - minha(b) ||
        (a.estado === 'ativa' ? 0 : 1) - (b.estado === 'ativa' ? 0 : 1) ||
        (presenca(b).online ? 1 : 0) - (presenca(a).online ? 1 : 0) ||
        String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
      const equipe = usuarios.filter(u => u.papel !== 'cliente' && passa(u)).sort(ordem);
      const clis = usuarios.filter(u => u.papel === 'cliente' && passa(u)).sort(ordem);
      let n = 0;
      const bloco = (titulo, ajuda, lista, ehCliente) => !lista.length ? '' :
        '<section class="lu3-grupo">' +
          '<h2 class="lu3-grupo-tit" title="' + ajuda + '">' + titulo + '<span>' + lista.length + '</span></h2>' +
          '<div class="lu3-lista">' +
            lista.map(u => linhaPessoa(u, empresasDe(u.id), funcoesExtraDe(u.id), presenca(u), ehCliente, n++)).join('') +
          '</div></section>';

      alvo.innerHTML = (equipe.length || clis.length)
        ? bloco('Equipe', 'Quem produz e organiza o trabalho dentro do B7.', equipe, false) +
          bloco('Clientes', 'Quem acompanha e aprova pelo Portal, só nas empresas vinculadas.', clis, true)
        : '<div class="estado-b7"><b>Ninguém aqui' + (filtro.termo ? ' para “' + esc(filtro.termo) + '”' : '') + '.</b></div>';

      B7.UI.ligarMenus(alvo);
      alvo.querySelectorAll('[data-acao-conta]').forEach(b => b.onclick = e => {
        e.stopPropagation();
        abrirAcao(usuarios.find(x => x.id === b.dataset.id), b.dataset.acaoConta, b.dataset.estado);
      });
      /* o cartão inteiro abre "Editar acesso"; o menu ⋯ guarda o resto */
      alvo.querySelectorAll('.lu3-linha').forEach(el => {
        const abrirEdicao = () => abrirAcao(usuarios.find(x => x.id === el.dataset.id), 'editar');
        el.onclick = e => { if (!e.target.closest('.menu')) abrirEdicao(); };
        el.onkeydown = e => { if (e.key === 'Enter' && e.target === el) abrirEdicao(); };
      });
    }
    pintar();
    painel().querySelectorAll('[data-lu-tipo]').forEach(b => b.onclick = () => {
      const t = b.dataset.luTipo;
      filtro.tipo = filtro.tipo === t || t === 'todos' ? 'todos' : t;
      painel().querySelectorAll('[data-lu-tipo]').forEach(x => x.classList.toggle('on', x.dataset.luTipo === filtro.tipo));
      pintar();
    });
    const busca = document.getElementById('lu-busca');
    if (busca) busca.oninput = B7.UI.debounce(() => { filtro.termo = busca.value; pintar(); }, 120);
  }

  /* uma conta = uma linha: foto (com o ponto verde de online), nome,
     @usuário e papel; à direita, empresas (cliente) e o último acesso.
     A linha inteira abre "Editar acesso"; o ⋯ guarda o resto. */
  function linhaPessoa(u, empresas, funcoesExtra, pres, ehCliente, i) {
    const inativa = u.estado !== 'ativa';
    const eu = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
    const souEu = !!(eu && eu.id === u.id);
    const quando = pres.online ? 'Online agora' : String(pres.texto || '').replace(/^Último acesso:\s*/i, '');
    const nunca = !pres.online && /^nunca/i.test(quando);
    const acesso = inativa ? '<span class="lu-estado">Desativada</span>'
      : '<span class="lu3-acesso' + (pres.online ? ' online' : nunca ? ' nunca' : '') + '">' + esc(quando) + '</span>';
    return '<div class="lu3-linha' + (inativa ? ' inativa' : '') + (pres.online && !inativa ? ' online' : '') + '" tabindex="0" data-id="' + esc(u.id) + '"' +
        ' style="--i:' + Math.min(i, 14) + '" title="Editar acesso de ' + esc(u.nome) + '">' +
      '<span class="lu3-av">' + B7.UI.avatarPessoa(u, 'lu-avatar') + '</span>' +
      '<div class="lu3-id">' +
        '<b>' + esc(u.nome) + (souEu ? '<em>você</em>' : '') + '</b>' +
        '<span class="lu3-meta"><span class="lu3-papel lu3-p-' + esc(u.papel) + '">' + esc(rotuloPapel(u.papel)) + '</span>' +
          (funcoesExtra || []).map(f => '<span class="lu3-extra">+ ' + esc(rotuloFuncaoExtra(f)) + '</span>').join('') +
          (ehCliente && u.pode_aprovar ? '<span class="lu3-extra">aprova</span>' : '') +
          '<span class="lu3-user">@' + esc(u.username) + '</span></span>' +
        (ehCliente
          ? '<span class="lu3-empresas"' + (empresas.length ? ' title="' + esc(empresas.join(', ')) + '"' : '') + '>' +
              (empresas.length ? esc(empresas.slice(0, 2).join(', ')) + (empresas.length > 2 ? ' +' + (empresas.length - 2) : '')
                : '<i>sem empresa vinculada</i>') + '</span>'
          : '') +
        '<span class="lu3-acesso-cx lu3-so-estreito">' + acesso + '</span>' +
      '</div>' +
      '<span class="lu3-acesso-cx lu3-so-largo">' + acesso + '</span>' +
      '<div class="menu"><button class="ico" aria-label="Ações da conta de ' + esc(u.nome) + '">⋯</button><div class="lista">' +
        '<button data-acao-conta="editar" data-id="' + esc(u.id) + '">Editar acesso</button>' +
        '<button data-acao-conta="foto" data-id="' + esc(u.id) + '">Foto de perfil</button>' +
        '<button data-acao-conta="senha" data-id="' + esc(u.id) + '">Redefinir senha</button>' +
        '<hr>' +
        (inativa
          ? '<button data-acao-conta="estado" data-estado="ativa" data-id="' + esc(u.id) + '">Reativar conta</button>'
          : '<button data-acao-conta="estado" data-estado="desativada" data-id="' + esc(u.id) + '">Desativar conta</button>') +
        '<button class="perigo" data-acao-conta="excluir" data-id="' + esc(u.id) + '">Excluir conta</button>' +
      '</div></div>' +
    '</div>';
  }

  /* o que estava digitado na busca sobrevive a um redesenho da tela
     (depois de editar uma conta, a lista é recarregada) */
  const filtro = { termo: '', tipo: 'todos' };

  /* =================================================================
     CRIAR
     ================================================================= */
  function modalNovo(clientes) {
    const m = B7.UI.modal('<h3>Novo usuário</h3>' +
      '<div class="sub">A conta é criada aqui e a senha é entregue pela equipe. ' +
      'Não há e-mail nem convite.</div>' +

      /* linha-2col: classe própria (ver styles/dashboard.css) porque a
         .linha genérica de global.css tem um bug — o ajuste mobile dela
         usa grid-template-columns num container que é display:flex, ou
         seja, não faz nada; NOME e USUÁRIO ficavam espremidos lado a
         lado até em tela de celular estreita. */
      '<div class="linha mb linha-2col">' +
        '<div><label class="rot">NOME</label>' +
          '<input class="campo" id="nu-nome" placeholder="Nome da pessoa"></div>' +
        '<div><label class="rot">USUÁRIO</label>' +
          '<input class="campo" id="nu-user" autocapitalize="none" spellcheck="false" ' +
          'placeholder="ex.: maria.silva"></div>' +
      '</div>' +

      '<label class="rot">PERFIL</label>' +
      '<div class="grade-formatos exp-formatos" id="nu-papel">' +
        PAPEIS.map(([v, r, d], i) =>
          '<button class="opcao-formato' + (v === 'cliente' ? ' on' : '') + '" data-papel="' + v + '">' +
          '<b>' + r + '</b><small>' + d + '</small></button>').join('') +
      '</div>' +

      '<div id="nu-cliente" class="mb" style="margin-top:14px">' +
        '<label class="rot">EMPRESAS QUE ESTA PESSOA ACOMPANHA</label>' +
        (clientes.length
          ? '<div class="nu-empresas">' + clientes.map(c =>
              '<label class="op-mini"><input type="checkbox" value="' + esc(c.id) + '">' +
              '<span>' + esc(c.nome) + '</span></label>').join('') + '</div>'
          : '<div class="vazio-leve">Cadastre um cliente primeiro.</div>') +
        '<label class="op-mini" style="margin-top:10px" id="nu-aprovar">' +
          '<input type="checkbox"><span>Pode aprovar oficialmente' +
          '<small>sem isso, a pessoa visualiza e comenta, mas não aprova</small></span></label>' +
      '</div>' +

      '<div id="nu-extras" class="mb" style="margin-top:14px">' +
        '<label class="rot">FUNÇÕES EXTRAS (ALÉM DO PERFIL PRINCIPAL)</label>' +
        '<div class="nu-empresas">' + FUNCOES_EXTRA.map(([v, r, d]) =>
          '<label class="op-mini" data-funcao-extra="' + v + '"><input type="checkbox" value="' + v + '">' +
          '<span>' + r + '<small>' + d + '</small></span></label>').join('') + '</div>' +
      '</div>' +

      '<label class="rot" style="margin-top:6px">SENHA INICIAL</label>' +
      '<div class="nu-senha">' +
        '<input class="campo" id="nu-senha" autocomplete="new-password">' +
        '<button class="b p" type="button" id="nu-gerar">Gerar</button>' +
      '</div>' +
      '<div class="ajuda">Mínimo de 10 caracteres, com letras e números.</div>' +

      '<div id="nu-erro" class="ajuda erro-txt"></div>' +

      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Criar usuário</button></div>', { larga: true });

    let papel = 'cliente';
    const blocoCliente = m.querySelector('#nu-cliente');
    const blocoExtras = m.querySelector('#nu-extras');
    const atualizarExtras = () => {
      /* função extra é só para papel interno, e não faz sentido marcar
         a mesma função que já é o papel principal (ex.: Videomaker não
         ganha a função extra "Videomaker") */
      blocoExtras.style.display = papel === 'cliente' ? 'none' : '';
      blocoExtras.querySelectorAll('[data-funcao-extra]').forEach(l => {
        const redundante = extraIndisponivel(l.dataset.funcaoExtra, papel);
        l.style.display = redundante ? 'none' : '';
        if (redundante) { l.querySelector('input').checked = false; l.classList.remove('on'); }
      });
    };
    m.querySelectorAll('#nu-papel [data-papel]').forEach(b => b.onclick = () => {
      m.querySelectorAll('#nu-papel button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      papel = b.dataset.papel;
      /* empresa e permissão de aprovação só fazem sentido para cliente */
      blocoCliente.style.display = papel === 'cliente' ? '' : 'none';
      atualizarExtras();
    });
    atualizarExtras();
    m.querySelectorAll('.op-mini input').forEach(cx => cx.onchange = () =>
      cx.closest('.op-mini').classList.toggle('on', cx.checked));

    m.querySelector('#nu-gerar').onclick = () => {
      m.querySelector('#nu-senha').value = gerarSenha();
      m.querySelector('#nu-senha').type = 'text';
    };

    m.querySelector('[data-ok]').onclick = async () => {
      const erro = m.querySelector('#nu-erro');
      const botao = m.querySelector('[data-ok]');
      const empresas = [...m.querySelectorAll('#nu-cliente input[type=checkbox][value]')]
        .filter(c => c.checked).map(c => c.value);
      const funcoesExtra = [...m.querySelectorAll('#nu-extras input[type=checkbox]')]
        .filter(c => c.checked).map(c => c.value);
      const corpo = {
        acao: 'criar_usuario',
        nome: m.querySelector('#nu-nome').value.trim(),
        username: m.querySelector('#nu-user').value.trim(),
        senha: m.querySelector('#nu-senha').value,
        papel: papel,
        empresas: papel === 'cliente' ? empresas : [],
        pode_aprovar: papel === 'cliente' && m.querySelector('#nu-aprovar input').checked,
        funcoes_extra: papel === 'cliente' ? [] : funcoesExtra
      };
      erro.textContent = '';
      botao.disabled = true; botao.textContent = 'Criando…';
      try {
        await B7.DB.chamarAuth(corpo);
        const senha = corpo.senha;
        m.fechar();
        mostrarSenha(corpo.username, senha, 'Conta criada');
        abrir();
      } catch (e) {
        botao.disabled = false; botao.textContent = 'Criar usuário';
        erro.textContent = e.message || 'Não foi possível criar a conta.';
      }
    };
  }

  /* =================================================================
     EDITAR ACESSO
     ================================================================= */
  function modalEditar(u, clientes, vinculos, funcoesExtraAtuais) {
    const ligadas = vinculos.filter(v => v.perfil_id === u.id).map(v => v.client_id);
    const extrasAtuais = funcoesExtraAtuais || [];
    const m = B7.UI.modal('<h3>Editar acesso</h3>' +
      '<div class="sub">@' + esc(u.username) + ' — o nome de usuário não muda.</div>' +

      '<div class="mb"><label class="rot">NOME</label>' +
        '<input class="campo" id="ed-nome" value="' + esc(u.nome) + '"></div>' +

      '<label class="rot">PERFIL</label>' +
      '<div class="grade-formatos exp-formatos" id="ed-papel">' +
        PAPEIS.map(([v, r, d]) =>
          '<button class="opcao-formato' + (u.papel === v ? ' on' : '') + '" data-papel="' + v + '">' +
          '<b>' + r + '</b><small>' + d + '</small></button>').join('') +
      '</div>' +

      '<div id="ed-cliente" style="margin-top:14px' +
        (u.papel === 'cliente' ? '' : ';display:none') + '">' +
        '<label class="rot">EMPRESAS</label>' +
        (clientes.length
          ? '<div class="nu-empresas">' + clientes.map(c =>
              '<label class="op-mini' + (ligadas.includes(c.id) ? ' on' : '') + '">' +
              '<input type="checkbox" value="' + esc(c.id) + '"' +
              (ligadas.includes(c.id) ? ' checked' : '') + '>' +
              '<span>' + esc(c.nome) + '</span></label>').join('') + '</div>'
          : '') +
        '<label class="op-mini' + (u.pode_aprovar ? ' on' : '') + '" style="margin-top:10px" id="ed-aprovar">' +
          '<input type="checkbox"' + (u.pode_aprovar ? ' checked' : '') + '>' +
          '<span>Pode aprovar oficialmente</span></label>' +
      '</div>' +

      '<div id="ed-extras" style="margin-top:14px' +
        (u.papel === 'cliente' ? ';display:none' : '') + '">' +
        '<label class="rot">FUNÇÕES EXTRAS (ALÉM DO PERFIL PRINCIPAL)</label>' +
        '<div class="nu-empresas">' + FUNCOES_EXTRA.map(([v, r, d]) => {
          const marcada = extrasAtuais.includes(v);
          const redundante = extraIndisponivel(v, u.papel);
          return '<label class="op-mini' + (marcada ? ' on' : '') + '" data-funcao-extra="' + v + '"' +
            (redundante ? ' style="display:none"' : '') + '>' +
            '<input type="checkbox" value="' + v + '"' + (marcada ? ' checked' : '') + '>' +
            '<span>' + r + '<small>' + d + '</small></span></label>';
        }).join('') + '</div>' +
      '</div>' +

      '<div id="ed-erro" class="ajuda erro-txt"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Salvar</button></div>', { larga: true });

    let papel = u.papel;
    const atualizarExtras = () => {
      const blocoExtras = m.querySelector('#ed-extras');
      blocoExtras.style.display = papel === 'cliente' ? 'none' : '';
      blocoExtras.querySelectorAll('[data-funcao-extra]').forEach(l => {
        const redundante = extraIndisponivel(l.dataset.funcaoExtra, papel);
        l.style.display = redundante ? 'none' : '';
        if (redundante) { l.querySelector('input').checked = false; l.classList.remove('on'); }
      });
    };
    m.querySelectorAll('#ed-papel [data-papel]').forEach(b => b.onclick = () => {
      m.querySelectorAll('#ed-papel button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      papel = b.dataset.papel;
      m.querySelector('#ed-cliente').style.display = papel === 'cliente' ? '' : 'none';
      atualizarExtras();
    });
    m.querySelectorAll('.op-mini input').forEach(cx => cx.onchange = () =>
      cx.closest('.op-mini').classList.toggle('on', cx.checked));

    m.querySelector('[data-ok]').onclick = async () => {
      const erro = m.querySelector('#ed-erro');
      const botao = m.querySelector('[data-ok]');
      const empresas = [...m.querySelectorAll('#ed-cliente input[type=checkbox][value]')]
        .filter(c => c.checked).map(c => c.value);
      const funcoesExtra = [...m.querySelectorAll('#ed-extras input[type=checkbox]')]
        .filter(c => c.checked).map(c => c.value);
      erro.textContent = '';
      botao.disabled = true; botao.textContent = 'Salvando…';
      try {
        await B7.DB.chamarAuth({
          acao: 'alterar_conta', perfil_id: u.id,
          nome: m.querySelector('#ed-nome').value.trim(),
          papel: papel,
          empresas: papel === 'cliente' ? empresas : [],
          pode_aprovar: papel === 'cliente' && m.querySelector('#ed-aprovar input').checked,
          funcoes_extra: papel === 'cliente' ? [] : funcoesExtra
        });
        m.fechar();
        B7.UI.toast('Acesso atualizado');
        abrir();
      } catch (e) {
        botao.disabled = false; botao.textContent = 'Salvar';
        erro.textContent = e.message || 'Não foi possível salvar.';
      }
    };
  }

  /* =================================================================
     REDEFINIR SENHA
     ================================================================= */
  function modalSenha(u) {
    const m = B7.UI.modal('<h3>Redefinir senha</h3>' +
      '<div class="sub">A senha atual não pode ser consultada — só substituída. ' +
      'As sessões abertas de @' + esc(u.username) + ' serão encerradas.</div>' +
      '<label class="rot">NOVA SENHA</label>' +
      '<div class="nu-senha">' +
        '<input class="campo" id="rs-senha" autocomplete="new-password">' +
        '<button class="b p" type="button" id="rs-gerar">Gerar</button>' +
      '</div>' +
      '<div class="ajuda">Mínimo de 10 caracteres, com letras e números.</div>' +
      '<div id="rs-erro" class="ajuda erro-txt"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Redefinir</button></div>');

    m.querySelector('#rs-gerar').onclick = () => {
      m.querySelector('#rs-senha').value = gerarSenha();
      m.querySelector('#rs-senha').type = 'text';
    };
    m.querySelector('[data-ok]').onclick = async () => {
      const senha = m.querySelector('#rs-senha').value;
      const erro = m.querySelector('#rs-erro');
      const botao = m.querySelector('[data-ok]');
      erro.textContent = '';
      botao.disabled = true; botao.textContent = 'Redefinindo…';
      try {
        await B7.DB.chamarAuth({ acao: 'redefinir_senha', perfil_id: u.id, senha });
        m.fechar();
        mostrarSenha(u.username, senha, 'Senha redefinida');
      } catch (e) {
        botao.disabled = false; botao.textContent = 'Redefinir';
        erro.textContent = e.message || 'Não foi possível redefinir.';
      }
    };
  }

  async function alterarEstado(u, estado) {
    const desativando = estado !== 'ativa';
    const ok = await B7.UI.confirmar({
      titulo: desativando ? 'Desativar esta conta?' : 'Reativar esta conta?',
      texto: desativando
        ? '@' + u.username + ' deixa de entrar e as sessões abertas são encerradas. ' +
          'O histórico e a autoria continuam preservados.'
        : '@' + u.username + ' volta a acessar com a mesma senha de antes.',
      confirmar: desativando ? 'Desativar' : 'Reativar',
      perigo: desativando
    });
    if (!ok) return;
    try {
      await B7.DB.chamarAuth({ acao: 'alterar_conta', perfil_id: u.id, estado });
      B7.UI.toast(desativando ? 'Conta desativada' : 'Conta reativada');
      abrir();
    } catch (e) {
      B7.UI.toast(e.message || 'Não foi possível alterar', { tipo: 'erro' });
    }
  }

  /* =================================================================
     A SENHA APARECE UMA VEZ SÓ
     ================================================================= */
  function mostrarSenha(username, senha, titulo) {
    const m = B7.UI.modal('<h3>' + esc(titulo) + '</h3>' +
      '<div class="sub">Copie agora e entregue pelo canal que a equipe usa. ' +
      'Esta senha não poderá ser consultada depois.</div>' +
      '<div class="senha-entrega">' +
        '<div><small>USUÁRIO</small><b>' + esc(username) + '</b></div>' +
        '<div><small>SENHA</small><b id="se-valor">' + esc(senha) + '</b></div>' +
      '</div>' +
      '<button class="b contorno" id="se-copiar" style="width:100%">Copiar usuário e senha</button>' +
      '<div class="acoes"><button class="b pri" data-fecha>Concluído</button></div>');

    m.querySelector('#se-copiar').onclick = async () => {
      try {
        await navigator.clipboard.writeText('Usuário: ' + username + '\nSenha: ' + senha);
        m.querySelector('#se-copiar').textContent = 'Copiado';
      } catch (e) {
        B7.UI.toast('Não foi possível copiar — selecione o texto acima', { tipo: 'erro' });
      }
    };
  }


  /* =================================================================
     FOTO DE PERFIL

     A foto é do usuário, mas o Admin pode gerenciá-la sem a senha dele.
     O endereço é validado como imagem antes de salvar: um link quebrado
     viraria um quadrado vazio sem explicação.
     ================================================================= */
  function modalFoto(u) {
    const iniciais = esc(B7.UI.iniciais(u.nome || u.username));
    const m = B7.UI.modal('<h3>Foto de perfil</h3>' +
      '<div class="sub">De @' + esc(u.username) + '. A pessoa também pode trocar a dela.</div>' +

      '<div class="foto-atual">' +
        '<div class="foto-previa av-pessoa tom-' + B7.UI.tomDoNome(u.nome || u.username) + '" id="fp-previa">' +
          (u.avatar_url ? '<img src="' + esc(u.avatar_url) + '" alt="">' : '<span>' + iniciais + '</span>') +
        '</div>' +
        '<div class="foto-tx"><b>' + esc(u.nome) + '</b>' +
        '<span id="fp-estado">' + (u.avatar_url ? 'tem foto' : 'usando as iniciais') + '</span></div>' +
      '</div>' +

      '<div id="fp-zona"></div>' +
      '<div id="fp-erro" class="ajuda erro-txt"></div>' +

      '<div class="acoes">' +
        (u.avatar_url ? '<button class="b perigo" data-remover>Remover foto</button>' +
          '<div style="flex:1"></div>' : '') +
        '<button class="b" data-fecha>Cancelar</button>' +
        '<button class="b pri" data-ok disabled>Salvar foto</button>' +
      '</div>');

    const botao = m.querySelector('[data-ok]');
    const escolha = B7.Foto.montar(m.querySelector('#fp-zona'), {
      aoEscolher: dataUrl => {
        m.querySelector('#fp-previa').innerHTML = '<img src="' + dataUrl + '" alt="">';
        m.querySelector('#fp-estado').textContent = 'nova foto — ainda não salva';
        botao.disabled = false;
      }
    });

    const salvar = async (imagem) => {
      const erro = m.querySelector('#fp-erro');
      erro.textContent = '';
      botao.disabled = true; botao.textContent = 'Salvando…';
      try {
        await B7.DB.chamarAuth({ acao: 'avatar_de', perfil_id: u.id, imagem: imagem });
        m.fechar();
        B7.UI.toast(imagem ? 'Foto atualizada' : 'Foto removida');
        abrir();
      } catch (e) {
        botao.disabled = !escolha.dataUrl(); botao.textContent = 'Salvar foto';
        erro.textContent = e.message || 'Não foi possível salvar.';
      }
    };

    botao.onclick = () => { if (escolha.dataUrl()) salvar(escolha.dataUrl()); };
    const rem = m.querySelector('[data-remover]');
    if (rem) rem.onclick = () => salvar(null);
  }

  /* =================================================================
     EXCLUIR CONTA
     ================================================================= */
  async function excluirConta(u) {
    const ok = await B7.UI.confirmar({
      titulo: 'Excluir a conta de ' + u.nome + '?',
      texto: '@' + u.username + ' perde o acesso definitivamente e não dá para desfazer. ' +
             'O que essa pessoa produziu — roteiros, comentários, aprovações — continua ' +
             'no sistema, com a autoria preservada. Se você só quer suspender o acesso, ' +
             'use Desativar conta.',
      confirmar: 'Excluir definitivamente',
      perigo: true
    });
    if (!ok) return;

    try {
      await B7.DB.chamarAuth({ acao: 'excluir_conta', perfil_id: u.id, confirmar: 'EXCLUIR' });
      B7.UI.toast('Conta excluída');
      abrir();
    } catch (e) {
      B7.UI.toast(e.message || 'Não foi possível excluir', { tipo: 'erro' });
    }
  }

  /* Sorteio com crypto: Math.random não serve para gerar credencial. */
  function gerarSenha() {
    const letras = 'abcdefghijkmnopqrstuvwxyz';
    const maius = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const nums = '23456789';
    const todos = letras + maius + nums;
    const bytes = new Uint32Array(14);
    crypto.getRandomValues(bytes);
    let s = '';
    for (let i = 0; i < 14; i++) s += todos[bytes[i] % todos.length];
    /* garante ao menos uma letra e um número, que é o que a função exige */
    return s.slice(0, 12) + maius[bytes[12] % maius.length] + nums[bytes[13] % nums.length];
  }

  return { abrir, gerarSenha };
})();
