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
    ['cliente', 'Cliente', 'acompanha e aprova o que foi liberado']
  ];
  const rotuloPapel = p => (PAPEIS.find(x => x[0] === p) || [, p])[1];

  /* =================================================================
     LISTA
     ================================================================= */
  async function abrir() {
    B7.Dashboard.marcarNav('#/config');
    B7.Rota.titulo(['Usuários e acessos']);
    painel().innerHTML = '<div class="conteudo"><div class="b7-load"><div class="simbolo"></div>' +
      '<div class="txt">Carregando contas…</div><div class="barra-load"><i></i></div></div></div>';

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
    const empresasDe = id => vinculos.filter(v => v.perfil_id === id)
      .map(v => (v.clientes && v.clientes.nome) || '');

    painel().innerHTML = '<div class="conteudo entra">' +
      '<div class="trilha"><a href="#/config">Configurações</a><span>/</span>' +
      '<b>Usuários e acessos</b></div>' +
      '<div class="cab-conteudo"><div><h1>Usuários e acessos</h1>' +
      '<p>Contas criadas pela Branding7. Não existe cadastro público.</p></div>' +
      '<button class="b pri" id="novo-usuario">+ Novo usuário</button></div>' +

      (usuarios.length
        ? '<div class="lista-usuarios">' + usuarios.map(u => linhaUsuario(u, empresasDe(u.id))).join('') + '</div>'
        : '<div class="estado-b7"><b>Nenhuma conta ainda.</b>' +
          '<p>Crie a primeira conta de coordenador ou cliente.</p></div>') +
    '</div>';

    document.getElementById('novo-usuario').onclick = () => modalNovo(clientes);
    B7.UI.ligarMenus(painel());
    painel().querySelectorAll('[data-acao-conta]').forEach(b => b.onclick = () => {
      const u = usuarios.find(x => x.id === b.dataset.id);
      const acao = b.dataset.acaoConta;
      if (acao === 'senha') return modalSenha(u);
      if (acao === 'editar') return modalEditar(u, clientes, vinculos);
      if (acao === 'estado') return alterarEstado(u, b.dataset.estado);
      if (acao === 'foto') return modalFoto(u);
      if (acao === 'excluir') return excluirConta(u);
    });
  }

  /* "Online agora" (visto há < 5 min), "Último acesso: …" ou "Nunca
     acessou". Vem de perfis.last_seen_at / last_login_at (heartbeat e
     login) — nunca de auth.users. */
  function acessoHTML(u) {
    const r = B7.Presenca ? B7.Presenca.rotulo(u)
      : { online: false, texto: u.ultimo_acesso ? 'Último acesso: ' + B7.UI.quando(u.ultimo_acesso) : 'Nunca acessou' };
    const classe = r.online ? ' online' : (r.texto === 'Nunca acessou' ? ' nunca' : '');
    return '<span class="lu-acesso' + classe + '" title="' + esc(r.online ? 'Ativo nos últimos 5 minutos' : r.texto) + '">' + esc(r.texto) + '</span>';
  }

  function linhaUsuario(u, empresas) {
    const inativa = u.estado !== 'ativa';
    return '<div class="lu-item' + (inativa ? ' inativa' : '') + '">' +
      B7.UI.avatarPessoa(u, 'lu-avatar') +
      '<div class="lu-tx">' +
        '<b>' + esc(u.nome) + '</b>' +
        '<span class="lu-user">@' + esc(u.username) + '</span>' +
      '</div>' +
      '<span class="lu-papel ' + esc(u.papel) + '">' + esc(rotuloPapel(u.papel)) + '</span>' +
      '<span class="lu-empresas">' +
        (empresas.length ? esc(empresas.slice(0, 2).join(', ')) +
          (empresas.length > 2 ? ' +' + (empresas.length - 2) : '')
         : (u.papel === 'cliente' ? '<i>sem empresa vinculada</i>' : '—')) +
      '</span>' +
      acessoHTML(u) +
      (inativa ? '<span class="lu-estado">desativada</span>' : '') +
      '<div class="menu"><button class="ico">⋯</button><div class="lista">' +
        '<button data-acao-conta="editar" data-id="' + esc(u.id) + '">Editar acesso</button>' +
        '<button data-acao-conta="foto" data-id="' + esc(u.id) + '">Foto de perfil</button>' +
        '<button data-acao-conta="senha" data-id="' + esc(u.id) + '">Redefinir senha</button>' +
        '<hr>' +
        (inativa
          ? '<button data-acao-conta="estado" data-estado="ativa" data-id="' + esc(u.id) + '">Reativar conta</button>'
          : '<button data-acao-conta="estado" data-estado="desativada" data-id="' +
            esc(u.id) + '">Desativar conta</button>') +
        '<button class="perigo" data-acao-conta="excluir" data-id="' + esc(u.id) +
          '">Excluir conta</button>' +
      '</div></div>' +
    '</div>';
  }

  /* =================================================================
     CRIAR
     ================================================================= */
  function modalNovo(clientes) {
    const m = B7.UI.modal('<h3>Novo usuário</h3>' +
      '<div class="sub">A conta é criada aqui e a senha é entregue pela equipe. ' +
      'Não há e-mail nem convite.</div>' +

      '<div class="linha mb">' +
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
    m.querySelectorAll('#nu-papel [data-papel]').forEach(b => b.onclick = () => {
      m.querySelectorAll('#nu-papel button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      papel = b.dataset.papel;
      /* empresa e permissão de aprovação só fazem sentido para cliente */
      blocoCliente.style.display = papel === 'cliente' ? '' : 'none';
    });
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
      const corpo = {
        acao: 'criar_usuario',
        nome: m.querySelector('#nu-nome').value.trim(),
        username: m.querySelector('#nu-user').value.trim(),
        senha: m.querySelector('#nu-senha').value,
        papel: papel,
        empresas: papel === 'cliente' ? empresas : [],
        pode_aprovar: papel === 'cliente' && m.querySelector('#nu-aprovar input').checked
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
  function modalEditar(u, clientes, vinculos) {
    const ligadas = vinculos.filter(v => v.perfil_id === u.id).map(v => v.client_id);
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

      '<div id="ed-erro" class="ajuda erro-txt"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Salvar</button></div>', { larga: true });

    let papel = u.papel;
    m.querySelectorAll('#ed-papel [data-papel]').forEach(b => b.onclick = () => {
      m.querySelectorAll('#ed-papel button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      papel = b.dataset.papel;
      m.querySelector('#ed-cliente').style.display = papel === 'cliente' ? '' : 'none';
    });
    m.querySelectorAll('.op-mini input').forEach(cx => cx.onchange = () =>
      cx.closest('.op-mini').classList.toggle('on', cx.checked));

    m.querySelector('[data-ok]').onclick = async () => {
      const erro = m.querySelector('#ed-erro');
      const botao = m.querySelector('[data-ok]');
      const empresas = [...m.querySelectorAll('#ed-cliente input[type=checkbox][value]')]
        .filter(c => c.checked).map(c => c.value);
      erro.textContent = '';
      botao.disabled = true; botao.textContent = 'Salvando…';
      try {
        await B7.DB.chamarAuth({
          acao: 'alterar_conta', perfil_id: u.id,
          nome: m.querySelector('#ed-nome').value.trim(),
          papel: papel,
          empresas: papel === 'cliente' ? empresas : [],
          pode_aprovar: papel === 'cliente' && m.querySelector('#ed-aprovar input').checked
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
