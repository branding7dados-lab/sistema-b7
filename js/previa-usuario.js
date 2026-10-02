/* =====================================================================
   PRÉVIA DE USUÁRIO — administrador vendo o sistema como outro papel

   Irmã da prévia de cliente (js/portal.js): o administrador continua
   logado como ele mesmo — nenhuma sessão nova, nenhuma senha — mas
   enquanto a simulação está ativa (B7.Auth.simularPapel), a navegação
   e as rotas (js/permissoes.js) já obedecem ao papel escolhido, porque
   as duas já decidem tudo a partir de B7.Auth.papel()/funcoesExtra().
   Esta prévia não duplica regra nenhuma dali.

   Diferente do Portal do Cliente, a área interna não tem um "modo
   leitura" pronto em cada tela: ações de salvar/editar estão
   espalhadas por dezenas de módulos. Em vez de tocar em cada uma, a
   prévia bloqueia a ESCRITA na camada de dados (ver
   ligarBloqueioEscrita): a tela inteira continua clicável e navegável
   — abas, filtros, cartões, detalhe de demanda — e qualquer tentativa
   de gravar recebe um aviso em vez de ir pro banco. */

window.B7 = window.B7 || {};

B7.PreviaUsuario = (function () {
  let alvo = null;      /* { id, nome, papel, funcoes_extra } */

  const esc = s => (B7.UI ? B7.UI.esc(s) : String(s == null ? '' : s));
  const rotuloPapel = p => ({
    admin: 'Administrador', coordenador: 'Coordenador de mídias',
    designer: 'Designer', videomaker: 'Videomaker', cliente: 'Cliente'
  }[p] || p);

  /* A nav só remonta do zero quando nav.dataset.shell muda (ver
     montarShellInterno em js/app.js) — por isso zeramos a marca antes
     de chamar de novo. Ela então clona o <template> intacto e reaplica
     aplicarPapelNaNavegacao()/B7.Perm.aplicarNavegacao() com o papel
     ATUAL de B7.Auth.papel(), que é o que entrar/sair da simulação
     muda. O mesmo caminho serve pros dois sentidos: não existe um
     "desfazer" separado, só remontar de novo com o papel real. */
  function remontarNav() {
    const nav = document.querySelector('.nav');
    if (nav) delete nav.dataset.shell;
    if (B7.montarShellInterno) B7.montarShellInterno();
  }

  /* -----------------------------------------------------------------
     BLOQUEIO DE ESCRITA — na camada de dados, não na tela.
     A versão anterior desabilitava TODO botão/campo dentro de .area
     (e reaplicava via MutationObserver). Resultado relatado: "não
     consigo clicar nos botões, entrar nas demandas" — a prévia virava
     uma tela morta, sem abas, filtros, cartões nem navegação. Agora a
     navegação fica 100% livre e o que é travado é só a ESCRITA: toda
     gravação do sistema passa por B7.DB.rpc, sb.from().insert/update/
     delete/upsert, sb.rpc, sb.storage e B7.Save — esses cinco pontos
     recebem um substituto que recusa com aviso enquanto a prévia está
     ativa. Leitura (select) continua normal.
     ----------------------------------------------------------------- */
  let originais = null;
  let ultimoAviso = 0;
  const MSG = 'Modo visualização — nenhuma alteração é salva.';

  function avisar() {
    const agora = Date.now();
    if (agora - ultimoAviso < 2500) return;
    ultimoAviso = agora;
    try { if (B7.UI && B7.UI.toast) B7.UI.toast(MSG); } catch (e) {}
  }
  function recusar() {
    avisar();
    const e = new Error(MSG); e.code = 'B7_PREVIA'; e.status = 403;
    return Promise.reject(e);
  }
  const METODOS_ESCRITA = ['insert', 'update', 'delete', 'upsert'];
  const METODOS_STORAGE = ['upload', 'remove', 'update', 'move', 'copy', 'uploadToSignedUrl'];

  function ligarBloqueioEscrita() {
    if (originais) return;
    const sb = B7.sb;
    originais = {
      dbRpc: B7.DB && B7.DB.rpc,
      dbAuth: B7.DB && B7.DB.chamarAuth,
      saveCampo: B7.Save && B7.Save.campo,
      saveAcao: B7.Save && B7.Save.acao,
      sbFrom: sb && sb.from,
      sbRpc: sb && sb.rpc,
      storageFrom: sb && sb.storage && sb.storage.from
    };
    if (B7.DB) {
      B7.DB.rpc = recusar;
      B7.DB.chamarAuth = recusar;
    }
    if (B7.Save) {
      B7.Save.campo = () => avisar();
      B7.Save.acao = () => recusar();
    }
    if (sb) {
      sb.from = function (tabela) {
        const b = originais.sbFrom.call(sb, tabela);
        METODOS_ESCRITA.forEach(m => { b[m] = recusar; });
        return b;
      };
      sb.rpc = recusar;
      if (sb.storage && originais.storageFrom) {
        sb.storage.from = function (bucket) {
          const b = originais.storageFrom.call(sb.storage, bucket);
          METODOS_STORAGE.forEach(m => { if (typeof b[m] === 'function') b[m] = recusar; });
          return b;
        };
      }
    }
  }

  function desligarBloqueioEscrita() {
    if (!originais) return;
    const o = originais; originais = null;
    const sb = B7.sb;
    if (B7.DB) { B7.DB.rpc = o.dbRpc; B7.DB.chamarAuth = o.dbAuth; }
    if (B7.Save) { B7.Save.campo = o.saveCampo; B7.Save.acao = o.saveAcao; }
    if (sb) {
      if (o.sbFrom) sb.from = o.sbFrom;
      if (o.sbRpc) sb.rpc = o.sbRpc;
      if (sb.storage && o.storageFrom) sb.storage.from = o.storageFrom;
    }
  }

  function montarBanner() {
    const antigo = document.getElementById('pv-banner-usuario');
    if (antigo) antigo.remove();
    const b = document.createElement('div');
    b.id = 'pv-banner-usuario';
    b.className = 'pv-banner-usuario';
    b.setAttribute('role', 'status');
    b.innerHTML =
      '<div class="pv-banner-tx"><b>Visualizando como ' + esc(alvo.nome) + '</b>' +
      '<span>' + esc(rotuloPapel(alvo.papel)) +
        (alvo.funcoes_extra && alvo.funcoes_extra.length ? ' · ' + alvo.funcoes_extra.map(rotuloPapel).join(' · ') : '') +
        ' · navegue à vontade — nada que você fizer aqui é salvo</span></div>' +
      '<button class="b fina" id="pv-sair-previa">Voltar ao Admin</button>';
    document.body.appendChild(b);
    document.body.classList.add('modo-previa-usuario');
    b.querySelector('#pv-sair-previa').onclick = sair;
  }

  /* =================================================================
     ENTRAR / SAIR
     ================================================================= */
  function abrir(usuario) {
    if (!B7.Auth || !B7.Auth.ehAdmin || !B7.Auth.ehAdmin()) return false;
    if (!usuario || !usuario.id || !usuario.papel) return false;
    if (usuario.papel === 'cliente') return false; /* isso é prévia de cliente, não de usuário */
    alvo = { id: usuario.id, nome: usuario.nome || usuario.username || 'Usuário',
             papel: usuario.papel, funcoes_extra: usuario.funcoes_extra || [] };
    B7.Auth.simularPapel(alvo.papel, alvo.funcoes_extra);
    remontarNav();
    montarBanner();
    ligarBloqueioEscrita();
    if (B7.UI) B7.UI.fecharMenus && B7.UI.fecharMenus();
    irParaInicio();
    return true;
  }

  function sair() {
    if (!alvo) return false;
    alvo = null;
    desligarBloqueioEscrita();
    const b = document.getElementById('pv-banner-usuario');
    if (b) b.remove();
    document.body.classList.remove('modo-previa-usuario');
    if (B7.Auth) B7.Auth.encerrarSimulacao();
    remontarNav();
    irParaInicio();
    return true;
  }

  /* location.hash = '#/' não dispara hashchange quando o endereço já é
     esse (comum: quem abre o seletor geralmente já está na Central) —
     sem isto, o painel continuaria mostrando a tela do papel anterior
     mesmo com a nav já trocada. B7.Rota.ir() força a rota a rodar de
     novo com o papel atual, esteja o endereço mudando ou não. */
  function irParaInicio() {
    if (location.hash === '#/' || !location.hash) {
      if (B7.Rota && B7.Rota.ir) B7.Rota.ir();
    } else {
      location.hash = '#/';
    }
  }

  const ativa = () => !!alvo;
  const usuarioAtivo = () => alvo;

  /* =================================================================
     SELETOR DA SIDEBAR — "Visualizar como…"
     Substitui o antigo botão "Visualizar como cliente" (que ficava por
     cliente, no Dashboard): busca e seleciona empresas (abre a prévia
     de cliente já existente, #/previa/<id> — nenhuma mudança lá) e
     usuários da equipe (abre a prévia acima) num campo só. Markup
     estático em index.html, dentro de .pe-lateral, com data-papel="admin"
     — some sozinho pra quem não é admin pelo mesmo mecanismo que já
     esconde item de menu (aplicarPapelNaNavegacao em js/app.js).
     ================================================================= */
  let itens = null; /* { clientes:[...], usuarios:[...] } — recarregado a cada abertura */

  function normal(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function linhaResultado(item) {
    const inic = B7.UI && B7.UI.iniciais ? B7.UI.iniciais(item.nome) : item.nome.slice(0, 2).toUpperCase();
    const sub = item.tipo === 'usuario'
      ? rotuloPapel(item.papel) + (item.funcoes_extra.length ? ' · ' + item.funcoes_extra.map(rotuloPapel).join(' · ') : '')
      : 'Empresa';
    return '<div class="res" data-tipo="' + item.tipo + '" data-id="' + esc(item.id) + '">' +
      '<div class="mini">' + esc(inic) + '</div>' +
      '<div><b>' + esc(item.nome) + '</b><small>' + esc(sub) + '</small></div>' +
    '</div>';
  }

  function renderizarLista(q) {
    const lista = document.getElementById('ver-como-lista');
    if (!lista || !itens) return;
    const termo = normal(q);
    const clientes = itens.clientes.filter(c => !termo || normal(c.nome).includes(termo));
    const usuarios = itens.usuarios.filter(u => !termo || normal(u.nome).includes(termo));
    if (!clientes.length && !usuarios.length) {
      lista.innerHTML = '<div class="nada">Nada encontrado.</div>';
      return;
    }
    lista.innerHTML =
      (clientes.length ? '<div class="grupo">CLIENTES</div>' + clientes.map(linhaResultado).join('') : '') +
      (usuarios.length ? '<div class="grupo">USUÁRIOS</div>' + usuarios.map(linhaResultado).join('') : '');
    lista.querySelectorAll('.res').forEach(el => el.onclick = () => {
      const tipo = el.dataset.tipo, id = el.dataset.id;
      fecharCaixa();
      if (tipo === 'cliente') {
        location.hash = '#/previa/' + id;
      } else {
        const u = itens.usuarios.find(x => x.id === id);
        if (u) escolherModo(u);
      }
    });
  }

  /* Escolhida uma pessoa da equipe, há dois caminhos, e a diferença entre
     eles é grande demais para ficar implícita: só olhar (nada é salvo) ou
     entrar na conta dela (tudo é salvo, no nome dela). */
  function escolherModo(u) {
    const papeis = rotuloPapel(u.papel) + (u.funcoes_extra.length ? ' · ' + u.funcoes_extra.map(rotuloPapel).join(' · ') : '');
    const m = B7.UI.modal('<h3>' + esc(u.nome) + '</h3>' +
      '<div class="sub">' + esc(papeis) + '</div>' +
      '<div class="vc-opcoes">' +
        '<button type="button" class="vc-opcao" data-modo="ver">' +
          '<b>Só visualizar</b><small>Você vê o sistema como esta pessoa vê. Nada do que fizer é salvo.</small></button>' +
        '<button type="button" class="vc-opcao forte" data-modo="entrar">' +
          '<b>Entrar na conta</b><small>Você trabalha como esta pessoa: o que fizer é salvo e fica registrado no nome dela. ' +
          'A entrada fica anotada na auditoria, com o seu nome.</small></button>' +
      '</div>' +
      '<div class="ajuda erro-txt" id="vc-erro" role="alert"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button></div>');
    m.querySelector('[data-modo="ver"]').onclick = () => { m.fechar(); abrir(u); };
    const bt = m.querySelector('[data-modo="entrar"]');
    bt.onclick = async () => {
      const erro = m.querySelector('#vc-erro');
      erro.textContent = '';
      m.querySelectorAll('.vc-opcao').forEach(b => { b.disabled = true; });
      bt.querySelector('b').textContent = 'Entrando…';
      try { await B7.Auth.entrarComo(u.id); }   /* recarrega a página ao dar certo */
      catch (e) {
        m.querySelectorAll('.vc-opcao').forEach(b => { b.disabled = false; });
        bt.querySelector('b').textContent = 'Entrar na conta';
        erro.textContent = (e && e.message) || 'Não foi possível entrar na conta.';
      }
    };
  }

  async function carregarItens() {
    const [clientes, dados] = await Promise.all([
      (B7.DB && B7.DB.listarClientes ? B7.DB.listarClientes() : Promise.resolve([])).catch(() => []),
      (B7.DB && B7.DB.chamarAuth ? B7.DB.chamarAuth({ acao: 'listar_usuarios' }) : Promise.resolve({}))
        .catch(() => ({ usuarios: [], funcoes_extra: [] }))
    ]);
    const eu = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
    const usuariosTodos = (dados.usuarios || []).filter(u => u.papel !== 'cliente' && u.estado === 'ativa' &&
      !(eu && eu.id === u.id));   /* a própria conta não entra: não há o que ver "como eu mesmo" */
    const funcoesExtraTodas = dados.funcoes_extra || [];
    const funcoesExtraDe = id => funcoesExtraTodas.filter(f => f.perfil_id === id).map(f => f.funcao);
    itens = {
      clientes: (clientes || []).map(c => ({ tipo: 'cliente', id: c.id, nome: c.nome || 'Sem nome' })),
      usuarios: usuariosTodos.map(u => ({
        tipo: 'usuario', id: u.id, nome: u.nome || u.username || 'Usuário',
        papel: u.papel, funcoes_extra: funcoesExtraDe(u.id)
      }))
    };
  }

  /* "Visualizar como…" fora da barra lateral (29/09): abre como diálogo
     (folha no celular) a partir do menu da conta ou do "Mais". Mesmos
     ids de busca/lista, então renderizarLista e carregarItens valem. */
  let modalSeletor = null;
  function abrirSeletor() {
    if (!B7.Auth || !(B7.Auth.ehAdminReal ? B7.Auth.ehAdminReal() : B7.Auth.ehAdmin())) return;
    /* dentro da conta de outra pessoa não se entra em mais uma: primeiro volta */
    if (B7.Auth.naContaDeOutro && B7.Auth.naContaDeOutro()) return;
    if (modalSeletor) return;
    modalSeletor = B7.UI.modal('<div class="tp-folha-cab"><h3>Visualizar como…</h3>' +
      '<button type="button" class="ico" data-fecha aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<p class="sub" style="margin:0 10px 10px">Veja o Portal de uma empresa (somente leitura) ou escolha alguém da equipe para visualizar ou entrar na conta.</p>' +
      '<div class="ver-como-caixa ver-como-dialogo"><input id="ver-como-busca" data-foco placeholder="Buscar cliente ou usuário…" autocomplete="off" aria-label="Buscar cliente ou usuário">' +
      '<div class="ver-como-lista" id="ver-como-lista"><div class="nada">Carregando…</div></div></div>',
      { classe: 'tp-folha', aoFechar: () => { modalSeletor = null; } });
    const campo = modalSeletor.querySelector('#ver-como-busca');
    campo.addEventListener('input', () => renderizarLista(campo.value));
    carregarItens().then(() => renderizarLista(campo.value)).catch(() => {
      const l = document.getElementById('ver-como-lista'); if (l) l.innerHTML = '<div class="nada">Não foi possível carregar.</div>';
    });
  }

  function fecharCaixa() {
    if (modalSeletor) { const m = modalSeletor; modalSeletor = null; m.fechar(); }
  }

  /* =================================================================
     RODAPÉ DA BARRA LATERAL (#ver-como, em index.html)
     Dois estados, redesenhados sempre que a navegação é montada:
       • administrador na própria conta → botão "Visualizar como…", que
         abre o mesmo seletor do menu da conta;
       • administrador dentro da conta de outra pessoa → quem ele está
         sendo agora e o botão de voltar. É o lembrete permanente de que
         tudo o que for feito sai no nome dela.
     Para qualquer outra pessoa, o bloco fica vazio e escondido.
     ================================================================= */
  const IC_OLHO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const IC_VOLTA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';

  async function voltarParaMinhaConta(botao) {
    if (botao) { botao.disabled = true; const s = botao.querySelector('span'); if (s) s.textContent = 'Voltando…'; }
    await B7.Auth.voltarParaMinhaConta();   /* recarrega a página */
  }

  function montarSeletor() {
    const cx = document.getElementById('ver-como');
    if (!cx || !B7.Auth) return;
    const A = B7.Auth;

    if (A.naContaDeOutro && A.naContaDeOutro()) {
      const u = A.usuario(), origem = A.contaDeOrigem() || {};
      const titulo = 'Voltar para a conta de ' + (origem.nome || 'administrador');
      cx.hidden = false;
      cx.className = 'ver-como como-outro';
      cx.innerHTML =
        '<div class="co-quem" title="Você está na conta de ' + esc(u.nome) + '. O que fizer fica registrado nesta conta.">' +
          (B7.UI.avatarPessoa ? B7.UI.avatarPessoa(u, 'co-av') : '') +
          '<div class="co-tx"><small>Você está como</small><b>' + esc(u.nome) + '</b></div>' +
        '</div>' +
        '<button type="button" class="co-voltar" id="co-voltar" title="' + esc(titulo) + '" aria-label="' + esc(titulo) + '">' +
          IC_VOLTA + '<span>Voltar para minha conta</span></button>';
      const bt = cx.querySelector('#co-voltar');
      bt.onclick = () => voltarParaMinhaConta(bt);
      montarFaixaCelular(u);
      return;
    }

    const pode = A.ehAdminReal && A.ehAdminReal() && !ativa();
    cx.className = 'ver-como';
    cx.hidden = !pode;
    cx.innerHTML = pode
      ? '<button type="button" class="ver-como-bt" id="ver-como-bt" title="Visualizar como…">' + IC_OLHO + '<span>Visualizar como…</span></button>'
      : '';
    const bt = cx.querySelector('#ver-como-bt');
    if (bt) bt.onclick = abrirSeletor;
  }

  /* No celular não existe barra lateral: o mesmo aviso e o mesmo botão
     vão para uma faixa no topo (o CSS só a mostra em tela estreita). */
  function montarFaixaCelular(u) {
    if (document.getElementById('co-faixa')) return;
    const f = document.createElement('div');
    f.id = 'co-faixa';
    f.className = 'pv-banner-usuario co-faixa';
    f.setAttribute('role', 'status');
    f.innerHTML = '<div class="pv-banner-tx"><b>Você está como ' + esc(u.nome) + '</b>' +
      '<span>O que fizer fica registrado nesta conta.</span></div>' +
      '<button type="button" class="b fina" id="co-voltar-faixa"><span>Voltar para minha conta</span></button>';
    document.body.appendChild(f);
    document.body.classList.add('na-conta-de-outro');
    const bt = f.querySelector('#co-voltar-faixa');
    bt.onclick = () => voltarParaMinhaConta(bt);
  }

  return { abrir, sair, ativa, usuarioAtivo, montarSeletor, abrirSeletor };
})();
