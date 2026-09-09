/* =====================================================================
   MEU PERFIL

   O que a própria pessoa pode mudar sozinha: o nome e a senha. Papel,
   username e empresas vinculadas continuam sendo decisão do
   administrador — se cada um pudesse mudar o próprio papel, não haveria
   controle de acesso nenhum.

   A troca de senha exige a senha atual. Sem isso, alguém que encontrasse
   uma sessão aberta trocaria a senha e tomaria a conta.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Perfil = (function () {
  const esc = B7.UI.esc;

  const ROTULO = {
    admin: 'Administrador',
    coordenador: 'Coordenador de mídias',
    cliente: 'Cliente'
  };

  function abrir() {
    const u = B7.Auth && B7.Auth.usuario();
    if (!u) return B7.UI.toast('Entre para ver o seu perfil.', { tipo: 'erro' });

    const empresas = B7.Auth.empresas();

    const m = B7.UI.modal(
      '<div class="perfil-topo">' +
        '<div class="perfil-avatar av-pessoa tom-' + B7.UI.tomDoNome(u.nome || u.username) + '" id="pf-avatar">' +
          (u.avatar_url
            ? '<img src="' + esc(u.avatar_url) + '" alt="">'
            : '<span>' + esc(B7.UI.iniciais(u.nome || u.username)) + '</span>') + '</div>' +
        '<div class="perfil-id">' +
          '<b>' + esc(u.nome) + '</b>' +
          '<span>@' + esc(u.username) + '</span>' +
          '<span class="perfil-papel ' + esc(u.papel) + '">' +
            esc(ROTULO[u.papel] || u.papel) + '</span>' +
        '</div>' +
      '</div>' +

      '<div class="corpo">' +

        '<div class="perfil-bloco">' +
          '<h4>Nome</h4>' +
          '<p class="ajuda">É o que aparece para a equipe nas ações que você faz.</p>' +
          '<input class="campo" id="pf-nome" value="' + esc(u.nome) + '" maxlength="80">' +
          '<div class="perfil-acao">' +
            '<span class="perfil-msg" id="pf-msg-nome"></span>' +
            '<button class="b pri fina" id="pf-salvar-nome">Salvar nome</button>' +
          '</div>' +

        /* A foto é do usuário: ele troca a dele sem passar pelo admin.
           Escolhe o arquivo; o envio acontece na hora. */
        '<div class="perfil-bloco">' +
          '<h4>Foto de perfil</h4>' +
          '<div id="pf-zona"></div>' +
          '<div class="perfil-acao">' +
            '<span class="perfil-msg" id="pf-msg-foto"></span>' +
            (u.avatar_url ? '<button class="b fina perigo" id="pf-remover-foto">Remover foto</button>' : '') +
            '<button class="b pri fina" id="pf-salvar-foto" disabled>Salvar foto</button>' +
          '</div>' +
        '</div>' +
        '</div>' +

        '<div class="perfil-bloco">' +
          '<h4>Senha</h4>' +
          '<p class="ajuda">Mínimo de 10 caracteres, com letras e números. ' +
          'Ao trocar, as outras sessões abertas com esta conta são encerradas.</p>' +

          '<label class="rot">SENHA ATUAL</label>' +
          '<input class="campo" id="pf-atual" type="password" autocomplete="current-password">' +

          '<label class="rot">NOVA SENHA</label>' +
          '<input class="campo" id="pf-nova" type="password" autocomplete="new-password">' +

          '<label class="rot">REPETIR A NOVA SENHA</label>' +
          '<input class="campo" id="pf-nova2" type="password" autocomplete="new-password">' +

          '<div class="perfil-acao">' +
            '<span class="perfil-msg" id="pf-msg-senha"></span>' +
            '<button class="b pri fina" id="pf-salvar-senha">Trocar senha</button>' +
          '</div>' +
        '</div>' +

        /* o que só o administrador muda: mostrado, nunca editável */
        '<div class="perfil-bloco leitura">' +
          '<h4>Definido pela Branding7</h4>' +
          '<div class="perfil-linha"><span>Usuário</span><b>@' + esc(u.username) + '</b></div>' +
          '<div class="perfil-linha"><span>Perfil</span><b>' +
            esc(ROTULO[u.papel] || u.papel) + '</b></div>' +
          (u.papel === 'cliente'
            ? '<div class="perfil-linha"><span>Empresas</span><b>' +
              (empresas.length ? esc(empresas.map(e => e.nome).join(', ')) : '—') + '</b></div>' +
              '<div class="perfil-linha"><span>Aprovação</span><b>' +
              (u.pode_aprovar ? 'pode aprovar oficialmente' : 'visualiza e comenta') + '</b></div>'
            : '') +
          '<p class="ajuda">Para mudar qualquer um destes, fale com o administrador.</p>' +
        '</div>' +

      '</div>' +

      '<div class="acoes">' +
        '<button class="b" data-fecha>Fechar</button>' +
        '<div style="flex:1"></div>' +
        '<button class="b contorno" id="pf-sair">Sair da conta</button>' +
      '</div>',
      { larga: true, extra: 'modal-perfil' });

    /* ---------------------------------------------------------- foto */
    const btFoto = m.querySelector('#pf-salvar-foto');
    const msgFoto = m.querySelector('#pf-msg-foto');
    const avatarEl = m.querySelector('#pf-avatar');
    const escolha = B7.Foto.montar(m.querySelector('#pf-zona'), {
      aoEscolher: dataUrl => {
        avatarEl.innerHTML = '<img src="' + dataUrl + '" alt="">';
        btFoto.disabled = false;
        msgFoto.className = 'perfil-msg'; msgFoto.textContent = '';
      }
    });
    async function enviarFoto(imagem) {
      msgFoto.className = 'perfil-msg';
      btFoto.disabled = true; btFoto.textContent = 'Enviando…';
      try {
        await B7.DB.chamarAuth({ acao: 'meu_avatar', imagem: imagem });
        await B7.Auth.carregar();
        const novo = B7.Auth.usuario();
        u.avatar_url = novo ? novo.avatar_url : null;
        if (!imagem) avatarEl.innerHTML = '<span>' + esc(B7.UI.iniciais(u.nome || u.username)) + '</span>';
        if (B7.pintarSessao) B7.pintarSessao();
        aviso(msgFoto, imagem ? 'Foto atualizada.' : 'Foto removida.', 'ok');
        const rem = m.querySelector('#pf-remover-foto');
        if (rem && !imagem) rem.remove();
      } catch (e) {
        aviso(msgFoto, e.message || 'Não foi possível salvar a foto.', 'erro');
        btFoto.disabled = !escolha.dataUrl();
      }
      btFoto.textContent = 'Salvar foto';
    }
    btFoto.onclick = () => { if (escolha.dataUrl()) enviarFoto(escolha.dataUrl()); };
    const btRemover = m.querySelector('#pf-remover-foto');
    if (btRemover) btRemover.onclick = () => enviarFoto(null);

    /* ---------------------------------------------------------- nome */
    const campoNome = m.querySelector('#pf-nome');
    const btNome = m.querySelector('#pf-salvar-nome');
    const msgNome = m.querySelector('#pf-msg-nome');

    btNome.onclick = async () => {
      const nome = campoNome.value.trim();
      msgNome.className = 'perfil-msg';
      if (!nome) { return aviso(msgNome, 'Informe um nome.', 'erro'); }
      if (nome === u.nome) { return aviso(msgNome, 'Nada mudou.', ''); }

      btNome.disabled = true; btNome.textContent = 'Salvando…';
      try {
        if (nome !== u.nome) {
          await B7.DB.chamarAuth({ acao: 'meu_perfil', nome: nome });
        }
        await B7.Auth.carregar();
        u.nome = nome;
        aviso(msgNome, 'Perfil atualizado.', 'ok');
        /* o avatar e o menu do topo passam a mostrar o nome novo */
        if (B7.pintarSessao) B7.pintarSessao();
        const idNome = m.querySelector('.perfil-id b');
        if (idNome) idNome.textContent = nome;
        const av = m.querySelector('.perfil-avatar');
        if (av && !u.avatar_url) av.innerHTML = '<span>' + esc(B7.UI.iniciais(nome)) + '</span>';
      } catch (e) {
        aviso(msgNome, e.message || 'Não foi possível salvar.', 'erro');
      }
      btNome.disabled = false; btNome.textContent = 'Salvar nome';
    };

    /* --------------------------------------------------------- senha */
    const btSenha = m.querySelector('#pf-salvar-senha');
    const msgSenha = m.querySelector('#pf-msg-senha');

    btSenha.onclick = async () => {
      const atual = m.querySelector('#pf-atual').value;
      const nova = m.querySelector('#pf-nova').value;
      const nova2 = m.querySelector('#pf-nova2').value;
      msgSenha.className = 'perfil-msg';

      if (!atual) return aviso(msgSenha, 'Informe a senha atual.', 'erro');
      if (nova !== nova2) return aviso(msgSenha, 'As duas senhas novas não conferem.', 'erro');
      if (nova.length < 10 || !/[a-zA-Z]/.test(nova) || !/[0-9]/.test(nova)) {
        return aviso(msgSenha, 'A nova senha precisa de 10 caracteres, com letras e números.', 'erro');
      }
      if (nova === atual) return aviso(msgSenha, 'A nova senha é igual à atual.', 'erro');

      btSenha.disabled = true; btSenha.textContent = 'Trocando…';
      try {
        await B7.DB.chamarAuth({ acao: 'minha_senha', senha_atual: atual, senha_nova: nova });
        m.querySelectorAll('#pf-atual, #pf-nova, #pf-nova2').forEach(c => c.value = '');
        aviso(msgSenha, 'Senha trocada. As outras sessões foram encerradas.', 'ok');
      } catch (e) {
        aviso(msgSenha, e.message || 'Não foi possível trocar a senha.', 'erro');
      }
      btSenha.disabled = false; btSenha.textContent = 'Trocar senha';
    };

    m.querySelector('#pf-sair').onclick = () => B7.Auth.sair();
  }

  function aviso(el, texto, tipo) {
    el.textContent = texto;
    el.className = 'perfil-msg' + (tipo ? ' ' + tipo : '');
  }

  return { abrir };
})();
