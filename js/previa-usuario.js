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
        if (u) abrir(u);
      }
    });
  }

  async function carregarItens() {
    const [clientes, dados] = await Promise.all([
      (B7.DB && B7.DB.listarClientes ? B7.DB.listarClientes() : Promise.resolve([])).catch(() => []),
      (B7.DB && B7.DB.chamarAuth ? B7.DB.chamarAuth({ acao: 'listar_usuarios' }) : Promise.resolve({}))
        .catch(() => ({ usuarios: [], funcoes_extra: [] }))
    ]);
    const usuariosTodos = (dados.usuarios || []).filter(u => u.papel !== 'cliente' && u.estado === 'ativa');
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

  function abrirCaixa() {
    const caixa = document.getElementById('ver-como');
    const campo = document.getElementById('ver-como-busca');
    const lista = document.getElementById('ver-como-lista');
    if (!caixa || !campo || !lista) return;
    caixa.classList.add('aberto');
    document.getElementById('ver-como-bt').setAttribute('aria-expanded', 'true');
    campo.value = '';
    lista.innerHTML = '<div class="nada">Carregando…</div>';
    campo.focus();
    carregarItens().then(() => renderizarLista('')).catch(() => {
      lista.innerHTML = '<div class="nada">Não foi possível carregar.</div>';
    });
  }

  function fecharCaixa() {
    const caixa = document.getElementById('ver-como');
    if (!caixa) return;
    caixa.classList.remove('aberto');
    const bt = document.getElementById('ver-como-bt');
    if (bt) bt.setAttribute('aria-expanded', 'false');
  }

  /* Markup fixo (index.html) — só liga os eventos, e só uma vez, mesmo
     que a nav (e portanto esta chamada) remonte várias vezes ao entrar
     e sair de uma prévia. */
  function montarSeletor() {
    const bt = document.getElementById('ver-como-bt');
    const campo = document.getElementById('ver-como-busca');
    if (!bt || bt.dataset.ligado) return;
    bt.dataset.ligado = '1';
    bt.onclick = () => {
      const caixa = document.getElementById('ver-como');
      if (caixa && caixa.classList.contains('aberto')) fecharCaixa(); else abrirCaixa();
    };
    campo.addEventListener('input', () => renderizarLista(campo.value));
    document.addEventListener('click', e => {
      if (!e.target.closest('#ver-como')) fecharCaixa();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') fecharCaixa();
    });
  }

  return { abrir, sair, ativa, usuarioAtivo, montarSeletor };
})();
