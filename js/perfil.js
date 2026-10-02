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

  function abrir(secao) {
    const u = B7.Auth && B7.Auth.usuario();
    if (!u) return B7.UI.toast('Entre para ver o seu perfil.', { tipo: 'erro' });

    const empresas = B7.Auth.empresas();

    /* Três abas em vez de uma coluna só: o que a pessoa vem fazer aqui é
       uma coisa de cada vez (trocar a foto, trocar a senha, ajustar os
       avisos), e a coluna única obrigava a rolar por tudo para achar. As
       ações e as regras são as mesmas de antes. */
    const abaInicial = secao === 'notificacoes' ? 'notif' : secao === 'seguranca' ? 'seg' : 'conta';
    const ABAS = [['conta', 'Conta'], ['seg', 'Segurança'], ['notif', 'Notificações']];
    const senha = (id, rot, auto) =>
      '<label class="rot" for="' + id + '">' + rot + '</label>' +
      '<div class="pf-senha"><input class="campo" id="' + id + '" type="password" autocomplete="' + auto + '">' +
      '<button type="button" class="pf-olho" data-olho="' + id + '" aria-label="Mostrar senha" aria-pressed="false">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>' +
      '</button></div>';

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
        '<button type="button" class="pf-x" data-fecha aria-label="Fechar">×</button>' +
      '</div>' +

      '<div class="pf-abas" role="tablist" aria-label="Seções do perfil">' +
        ABAS.map(a => '<button type="button" role="tab" data-aba="' + a[0] + '" aria-selected="' +
          (a[0] === abaInicial) + '">' + a[1] + '</button>').join('') +
      '</div>' +

      '<div class="corpo">' +

        /* ------------------------------------------------------ conta */
        '<section class="pf-painel" data-painel="conta" role="tabpanel">' +

          /* A foto é do usuário: ele troca a dele sem passar pelo admin.
             Escolhe o arquivo, confere no avatar lá em cima e salva. */
          '<div class="pf-cartao">' +
            '<h4>Foto de perfil</h4>' +
            '<p class="ajuda">Aparece no topo, nas listas e nas ações que você faz.</p>' +
            '<div id="pf-zona"></div>' +
            '<div class="perfil-acao">' +
              '<span class="perfil-msg" id="pf-msg-foto" role="status"></span>' +
              (u.avatar_url ? '<button class="b fina perigo" id="pf-remover-foto">Remover foto</button>' : '') +
              '<button class="b pri fina" id="pf-salvar-foto" disabled>Salvar foto</button>' +
            '</div>' +
          '</div>' +

          '<div class="pf-cartao">' +
            '<h4><label for="pf-nome">Nome</label></h4>' +
            '<p class="ajuda">É o que aparece para a equipe nas ações que você faz.</p>' +
            '<div class="pf-campo-acao">' +
              '<input class="campo" id="pf-nome" value="' + esc(u.nome) + '" maxlength="80">' +
              '<button class="b pri fina" id="pf-salvar-nome" disabled>Salvar</button>' +
            '</div>' +
            '<span class="perfil-msg" id="pf-msg-nome" role="status"></span>' +
          '</div>' +

          /* o que só o administrador muda: mostrado, nunca editável */
          '<div class="pf-cartao leitura">' +
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
        '</section>' +

        /* -------------------------------------------------- segurança */
        '<section class="pf-painel" data-painel="seg" role="tabpanel" hidden>' +
          '<div class="pf-cartao">' +
            '<h4>Trocar senha</h4>' +
            '<p class="ajuda">Ao trocar, as outras sessões abertas com esta conta são encerradas.</p>' +
            senha('pf-atual', 'SENHA ATUAL', 'current-password') +
            senha('pf-nova', 'NOVA SENHA', 'new-password') +
            senha('pf-nova2', 'REPETIR A NOVA SENHA', 'new-password') +
            '<ul class="pf-req" id="pf-req" aria-label="Requisitos da nova senha">' +
              '<li data-req="tam">10 caracteres ou mais</li>' +
              '<li data-req="letra">Pelo menos uma letra</li>' +
              '<li data-req="num">Pelo menos um número</li>' +
              '<li data-req="igual">As duas senhas novas iguais</li>' +
            '</ul>' +
            '<div class="perfil-acao">' +
              '<span class="perfil-msg" id="pf-msg-senha" role="status"></span>' +
              '<button class="b pri fina" id="pf-salvar-senha">Trocar senha</button>' +
            '</div>' +
          '</div>' +
        '</section>' +

        /* Notificações: como chega (este aparelho) e o que avisa (por
           função). Cada pessoa decide o seu; nada aqui muda permissão. */
        '<section class="pf-painel" data-painel="notif" role="tabpanel" id="pf-notif" hidden>' +
          '<div class="pf-cartao">' +
            '<h4>Neste aparelho</h4>' +
            '<p class="ajuda">O sino sempre guarda os avisos. Aqui você escolhe como eles chegam neste aparelho.</p>' +
            '<div class="pf-resumo" id="pf-resumo"></div>' +
            opcao('push', 'Push neste aparelho', 'Recebe o aviso mesmo com o Sistema B7 fechado.') +
            opcao('som', 'Som das notificações', 'Um toque curto quando chega um aviso novo com o B7 aberto.') +
            opcao('navegador', 'Aviso do navegador', 'Quando esta aba não estiver em foco, o navegador mostra o aviso.') +
            '<div class="pf-teste-push">' +
              '<div class="pf-teste-tx"><b>Testar notificações</b>' +
              '<small>Envia um aviso de teste para este aparelho, para confirmar que push, ' +
              'permissão e som estão funcionando.</small></div>' +
              '<button type="button" class="b fina contorno" id="pf-testar-notif">Enviar teste</button>' +
            '</div>' +
            /* um exemplo de cada aviso do sistema, só para a própria pessoa:
               serve para ver como cada um chega (texto, imagem, som, link)
               sem precisar provocar o evento de verdade */
            (B7.Auth.papel && B7.Auth.papel() !== 'cliente' ? '<div class="pf-teste-push pf-teste-todos">' +
              '<div class="pf-teste-tx"><b>Ver um exemplo de cada aviso</b>' +
              '<small>Envia para os seus aparelhos com push ligado um exemplo de cada notificação do B7, com o título ' +
              'começando por “Teste”. Não aparece no sino, ninguém mais recebe e nada é alterado nas demandas.</small></div>' +
              '<select class="campo fina" id="pf-exemplos-grupo" aria-label="Quais avisos">' +
                '<option value="">Todos (43 avisos)</option><option value="design">Design (17)</option>' +
                '<option value="video">Vídeo (9)</option><option value="gravacoes">Gravações e agenda (8)</option>' +
                '<option value="cliente">Decisões do cliente (6)</option><option value="geral">Revisão e resumo (3)</option></select>' +
              '<button type="button" class="b fina contorno" id="pf-exemplos">Enviar exemplos</button>' +
            '</div>' : '') +
            '<details class="pf-detalhes"><summary>Detalhes deste aparelho</summary>' +
              '<dl class="pf-estado" id="pf-estado"></dl>' +
              '<small class="pf-versao-sw" id="pf-versao-sw"></small>' +
            '</details>' +
          '</div>' +
          gruposNotificacao() +
          '<div class="pf-msg-fixa"><span class="perfil-msg" id="pf-msg-notif" role="status"></span></div>' +
        '</section>' +

      '</div>' +

      '<div class="acoes">' +
        '<button class="b contorno" id="pf-sair">Sair da conta</button>' +
        '<div style="flex:1"></div>' +
        '<button class="b" data-fecha>Fechar</button>' +
      '</div>',
      { larga: true, extra: 'modal-perfil pf-modal' });

    /* ---------------------------------------------------------- abas */
    function irPara(aba) {
      m.querySelectorAll('[data-aba]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.aba === aba)));
      m.querySelectorAll('[data-painel]').forEach(p => { p.hidden = p.dataset.painel !== aba; });
      const cx = m.querySelector('.corpo'); if (cx) cx.scrollTop = 0;
    }
    m.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => irPara(b.dataset.aba));
    irPara(abaInicial);

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

    /* o botão só acende quando há o que salvar */
    const nomeMudou = () => { const n = campoNome.value.trim(); return !!n && n !== u.nome; };
    campoNome.oninput = () => { btNome.disabled = !nomeMudou(); msgNome.className = 'perfil-msg'; msgNome.textContent = ''; };
    campoNome.onkeydown = e => { if (e.key === 'Enter' && nomeMudou()) btNome.click(); };

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
      btNome.textContent = 'Salvar'; btNome.disabled = !nomeMudou();
    };

    /* --------------------------------------------------------- senha */
    const btSenha = m.querySelector('#pf-salvar-senha');
    const msgSenha = m.querySelector('#pf-msg-senha');

    /* mostrar/ocultar cada senha, e os requisitos conferidos enquanto a
       pessoa digita — em vez de só descobrir o que faltou ao clicar */
    m.querySelectorAll('[data-olho]').forEach(b => b.onclick = () => {
      const campo = m.querySelector('#' + b.dataset.olho);
      const ver = campo.type === 'password';
      campo.type = ver ? 'text' : 'password';
      b.setAttribute('aria-pressed', String(ver));
      b.setAttribute('aria-label', ver ? 'Ocultar senha' : 'Mostrar senha');
    });
    function conferirSenha() {
      const nova = m.querySelector('#pf-nova').value, nova2 = m.querySelector('#pf-nova2').value;
      const ok = {
        tam: nova.length >= 10, letra: /[a-zA-Z]/.test(nova), num: /[0-9]/.test(nova),
        igual: !!nova && nova === nova2
      };
      m.querySelectorAll('#pf-req [data-req]').forEach(li => li.classList.toggle('ok', !!ok[li.dataset.req]));
      msgSenha.className = 'perfil-msg'; msgSenha.textContent = '';
    }
    m.querySelectorAll('#pf-atual, #pf-nova, #pf-nova2').forEach(c => {
      c.oninput = conferirSenha;
      c.onkeydown = e => { if (e.key === 'Enter') btSenha.click(); };
    });

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
        conferirSenha();
        aviso(msgSenha, 'Senha trocada. As outras sessões foram encerradas.', 'ok');
      } catch (e) {
        aviso(msgSenha, e.message || 'Não foi possível trocar a senha.', 'erro');
      }
      btSenha.disabled = false; btSenha.textContent = 'Trocar senha';
    };

    m.querySelector('#pf-sair').onclick = () => B7.Auth.sair();

    /* --------------------------------------------------- notificações */
    ligarNotificacoes(m);
  }

  function opcao(chave, titulo, ajuda) {
    return '<div class="perfil-opcao" data-opcao="' + chave + '">' +
      '<span class="perfil-opcao-tx"><b>' + esc(titulo) + '</b><small>' + esc(ajuda) + '</small>' +
      '<small class="aviso" data-aviso hidden></small></span>' +
      '<button type="button" class="chave" role="switch" aria-checked="false" aria-label="' + esc(titulo) + '" data-chave="' + chave + '"></button>' +
    '</div>';
  }

  /* O que avisa, agrupado pela função da pessoa (B7.Notif.grupos já
     devolve só os grupos que valem para ela). Cada grupo é uma sanfona:
     o primeiro abre, os outros mostram só quantos avisos estão ligados —
     ninguém precisa encarar quinze interruptores de uma vez. */
  function gruposNotificacao() {
    const gs = (B7.Notif && B7.Notif.grupos) ? B7.Notif.grupos() : [];
    if (!gs.length) return '';
    return '<div class="pf-sub">O que te avisa</div>' +
      '<p class="ajuda pf-sub-ajuda">Desligar um aviso tira o push e o som dele. O registro continua no sino.</p>' +
      gs.map((g, i) =>
        '<details class="pf-grupo" data-grupo="' + esc(g.id) + '"' + (i === 0 ? ' open' : '') + '>' +
          '<summary><span>' + esc(g.titulo) + '</span><small data-conta></small></summary>' +
          (g.nota ? '<p class="ajuda pf-grupo-nota">' + esc(g.nota) + '</p>' : '') +
          g.itens.map(it => opcao('n:' + it[0], it[1], it[2])).join('') +
        '</details>').join('');
  }

  /* Cada interruptor grava na hora. "Salvo" só aparece depois de o banco
     responder; se falhar, o interruptor volta e a mensagem explica. */
  async function ligarNotificacoes(m) {
    if (!B7.Notif) return;
    const msg = m.querySelector('#pf-msg-notif');
    const p = B7.Notif.prefs();
    const chave = k => m.querySelector('[data-chave="' + k + '"]');
    const avisoOpcao = (k, texto) => {
      const el = m.querySelector('[data-opcao="' + k + '"] [data-aviso]');
      if (!el) return; el.textContent = texto || ''; el.hidden = !texto;
    };
    const pintar = (k, v) => { const b = chave(k); if (b) b.setAttribute('aria-checked', v ? 'true' : 'false'); };
    const ligada = k => { const b = chave(k); return !!b && b.getAttribute('aria-checked') === 'true'; };

    /* ---- estado deste aparelho: só o que o navegador realmente informa ---- */
    const PERMISSAO = { permitida: 'Permitida', bloqueada: 'Bloqueada', nao_solicitada: 'Não solicitada', indisponivel: 'Sem suporte' };
    const quandoTeste = iso => {
      const d = new Date(iso), h = new Date();
      const hora = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      return (d.toDateString() === h.toDateString() ? 'Hoje' :
        String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0')) + ', ' + hora;
    };
    function pintarEstado() {
      const cx = m.querySelector('#pf-estado');
      if (!cx) return;
      const perm = B7.Push ? B7.Push.permissao() : 'indisponivel';
      const t = B7.Push ? B7.Push.ultimoTeste() : null;
      const linha = (rot, valor, tom) => '<div><dt>' + rot + '</dt><dd' + (tom ? ' class="' + tom + '"' : '') + '>' + esc(valor) + '</dd></div>';
      cx.innerHTML =
        linha('Aparelho', B7.Push ? B7.Push.aparelho() : 'Navegador') +
        linha('Permissão do navegador', PERMISSAO[perm] || perm, perm === 'permitida' ? 'ok' : perm === 'bloqueada' ? 'erro' : '') +
        linha('Push', ligada('push') ? 'Ativado' : 'Desativado', ligada('push') ? 'ok' : '') +
        linha('Som', ligada('som') ? 'Ativado' : 'Desativado', ligada('som') ? 'ok' : '') +
        /* "Enviado" = o servidor de push aceitou. O navegador não confirma
           que o aparelho exibiu, então aqui nunca aparece "Entregue". */
        linha('Último teste', t ? quandoTeste(t.em) + ' · ' + (t.ok ? 'Enviado' : 'Não enviado') : 'Nenhum neste aparelho', t ? (t.ok ? 'ok' : 'erro') : '');

      /* a resposta em uma frase: este aparelho recebe avisos ou não? A
         tabela acima virou detalhe, para quem precisa investigar. */
      const res = m.querySelector('#pf-resumo');
      if (!res) return;
      const semPush = B7.Push && !B7.Push.disponivel();
      const r = perm === 'bloqueada'
        ? ['erro', 'Avisos bloqueados neste navegador', 'Libere as notificações deste site nas configurações do navegador e ative o push de novo.']
        : ligada('push')
          ? ['ok', 'Este aparelho recebe avisos', 'Push ativado' + (ligada('som') ? ' · som ligado' : ' · som desligado') + '.']
          : semPush
            ? ['neutro', 'Push indisponível neste navegador', 'Os avisos aparecem no sino, com o B7 aberto.']
            : ['aviso', 'Push desativado neste aparelho', 'Os avisos só aparecem com o B7 aberto. Ative o push para receber com ele fechado.'];
      res.className = 'pf-resumo ' + r[0];
      res.innerHTML = '<i aria-hidden="true"></i><div><b>' + esc(r[1]) + '</b><span>' + esc(r[2]) + '</span></div>';
    }

    pintar('som', p.som);
    pintar('navegador', p.navegador);
    if ('Notification' in window && Notification.permission === 'denied') {
      avisoOpcao('navegador', 'Bloqueado nas configurações do navegador para este site.');
    }

    /* push: depende de chave pública, service worker e permissão */
    const btPush = chave('push');
    if (B7.Push && !B7.Push.disponivel()) {
      btPush.disabled = true; pintar('push', false);
      avisoOpcao('push', B7.Push.motivo());
    } else if (B7.Push) {
      btPush.disabled = true;
      B7.Push.ativo().then(ativo => { pintar('push', ativo); btPush.disabled = false; pintarEstado(); })
        .catch(() => { btPush.disabled = false; });
    } else { btPush.disabled = true; }
    pintarEstado();

    /* ---- o que avisa: um interruptor por tipo, contagem por grupo ---- */
    const contar = () => m.querySelectorAll('.pf-grupo').forEach(g => {
      const bs = g.querySelectorAll('.chave');
      const on = g.querySelectorAll('.chave[aria-checked="true"]').length;
      const c = g.querySelector('[data-conta]');
      if (c) c.textContent = on === bs.length ? 'todos ligados' : on ? on + ' de ' + bs.length + ' ligados' : 'nenhum ligado';
    });
    m.querySelectorAll('.pf-grupo .chave').forEach(b => {
      const k = b.dataset.chave.slice(2);
      pintar(b.dataset.chave, B7.Notif.prefTipo(k));
      b.onclick = async () => {
        const v = b.getAttribute('aria-checked') !== 'true';
        pintar(b.dataset.chave, v); contar();
        msg.className = 'perfil-msg'; msg.textContent = 'Salvando…';
        try {
          await B7.Notif.gravarPrefTipo(k, v);
          aviso(msg, 'Preferência salva.', 'ok');
        } catch (e) {
          pintar(b.dataset.chave, !v); contar();
          aviso(msg, e.message || 'Não foi possível salvar.', 'erro');
        }
      };
    });
    contar();

    /* Teste: um push de verdade, só para este aparelho, pelo mesmo envio
       dos avisos reais (b7-push → serviço de push → service worker). Não
       grava notificação: não vira pendência nem conta como não lida. O
       som toca aqui mesmo, dentro do clique, que é quando o navegador
       deixa. */
    const btTeste = m.querySelector('#pf-testar-notif');
    if (btTeste) btTeste.onclick = async () => {
      btTeste.disabled = true; const rotulo = btTeste.textContent;
      btTeste.textContent = 'Enviando…';
      msg.className = 'perfil-msg'; msg.textContent = '';
      if (ligada('som')) B7.Notif.tocarSom();
      try {
        const r = B7.Push ? await B7.Push.testar() : { ok: false, texto: 'Push indisponível neste navegador.' };
        aviso(msg, r.texto, r.ok ? 'ok' : 'erro');
        /* inscrição morta foi removida no servidor: o interruptor acompanha */
        if (r.motivo === 'inscricao_expirada' || r.motivo === 'sem_inscricao') pintar('push', false);
      } catch (e) {
        aviso(msg, 'Não foi possível enviar a notificação de teste.', 'erro');
      } finally { btTeste.disabled = false; btTeste.textContent = rotulo; pintarEstado(); }
    };

    const btExemplos = m.querySelector('#pf-exemplos');
    if (btExemplos) btExemplos.onclick = async () => {
      const grupo = m.querySelector('#pf-exemplos-grupo').value;
      btExemplos.disabled = true; const rotulo = btExemplos.textContent;
      btExemplos.textContent = 'Enviando…';
      msg.className = 'perfil-msg'; msg.textContent = '';
      try {
        const n = await B7.DB.notificarTesteTodos(grupo);
        aviso(msg, n + (n === 1 ? ' aviso de exemplo enviado' : ' avisos de exemplo enviados') +
          (ligada('push') ? ' para os seus aparelhos.' : '. O push está desligado neste aparelho, então aqui não chega nada.'),
          ligada('push') ? 'ok' : 'erro');
      } catch (e) {
        aviso(msg, 'Não foi possível enviar os exemplos. ' + (e.message || ''), 'erro');
      } finally { btExemplos.disabled = false; btExemplos.textContent = rotulo; }
    };

    /* versão do service worker ativo — é ele quem desenha o aviso, e um
       aparelho que ainda não recarregou o site continua com o antigo */
    const cxVersao = m.querySelector('#pf-versao-sw');
    if (cxVersao && navigator.serviceWorker && navigator.serviceWorker.controller) {
      try {
        const canal = new MessageChannel();
        canal.port1.onmessage = ev => {
          const v = (ev.data && ev.data.versao) || '';
          if (v) cxVersao.textContent = 'Aparelho rodando ' + v;
        };
        navigator.serviceWorker.controller.postMessage({ tipo: 'b7-versao' }, [canal.port2]);
      } catch (e) {}
    }

    async function gravar(k, v) {
      msg.className = 'perfil-msg'; msg.textContent = 'Salvando…';
      try {
        await B7.Notif.gravarPrefs({ [k]: v });
        aviso(msg, 'Preferência salva.', 'ok');
      } catch (e) {
        pintar(k, !v);
        aviso(msg, e.message || 'Não foi possível salvar.', 'erro');
        throw e;
      } finally { pintarEstado(); }
    }

    chave('som').onclick = async () => {
      const v = chave('som').getAttribute('aria-checked') !== 'true';
      pintar('som', v);
      try { await gravar('som', v); if (v) B7.Notif.tocarSom(); } catch (e) {}
    };
    chave('navegador').onclick = async () => {
      const v = chave('navegador').getAttribute('aria-checked') !== 'true';
      if (v) {
        try {
          const ok = await B7.Notif.pedirPermissao();
          if (!ok) { avisoOpcao('navegador', 'Permissão não concedida.'); return; }
          avisoOpcao('navegador', '');
        } catch (e) { avisoOpcao('navegador', e.message); return; }
      }
      pintar('navegador', v);
      try { await gravar('navegador', v); } catch (e) {}
    };
    btPush.onclick = async () => {
      if (btPush.disabled) return;
      const v = btPush.getAttribute('aria-checked') !== 'true';
      btPush.disabled = true;
      msg.className = 'perfil-msg'; msg.textContent = v ? 'Ativando push…' : 'Desativando push…';
      try {
        if (v) await B7.Push.ativar(); else await B7.Push.desativar();
        pintar('push', v);
        await B7.Notif.gravarPrefs({ push: v });
        aviso(msg, v ? 'Push ativado neste aparelho.' : 'Push desativado neste aparelho.', 'ok');
        avisoOpcao('push', '');
      } catch (e) {
        pintar('push', !v);
        aviso(msg, e.message || 'Não foi possível alterar o push.', 'erro');
      }
      btPush.disabled = false;
      pintarEstado();
    };
  }

  function aviso(el, texto, tipo) {
    el.textContent = texto;
    el.className = 'perfil-msg' + (tipo ? ' ' + tipo : '');
  }

  return { abrir };
})();
