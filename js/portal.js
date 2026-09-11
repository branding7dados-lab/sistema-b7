/* =====================================================================
   PORTAL DO CLIENTE

   Ambiente próprio, não uma versão reduzida do sistema interno. A
   pergunta que a home responde é "o que precisa de mim, e o que a
   Branding7 está produzindo para a minha empresa?" — não "qual o
   panorama da agência".

   A troca de layout acontece antes de qualquer coisa aparecer: a
   navegação da equipe nem existe no DOM (fica num <template> em
   index.html) até o papel da sessão ser conhecido. O cliente recebe a
   navegação daqui; a equipe recebe a dela em app.js.

   PRÉVIA DO ADMIN ("Visualizar como cliente")
   O administrador abre este mesmo portal com a empresa escolhida
   (#/previa/<client_id>). Ele continua autenticado como admin: nada de
   senha do cliente. Tudo fica somente leitura — nenhum comando de
   decisão é enviado ao banco. As consultas passam pelas MESMAS views e
   filtros que o cliente usa (portal_producao, portal_gravacoes,
   portal_status, visivel_cliente, publicado_em) e recebem o client_id
   da empresa em prévia.

   O que a prévia NÃO consegue simular (porque, no banco, o admin é
   equipe e passa pelo RLS sem corte):
     - o corte de serviço pausado/cancelado no banco: a tela de bloqueio
       aparece igual, mas é a interface que deixa de consultar, não o
       RLS recusando;
     - o vínculo perfil↔empresa: o admin vê qualquer empresa;
     - "Meu perfil" mostra o perfil do próprio admin, não o de um
       usuário cliente;
     - notificações e Realtime chegam para o admin, não para o cliente.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Portal = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');
  /* As telas do portal escrevem dentro de um wrapper .conteudo. Este
     atalho evita repetir a estrutura em cada tela. */
  const conteudo = () => {
    let alvo = painel().querySelector('.conteudo');
    if (!alvo) {
      painel().innerHTML = '<div class="conteudo entra"></div>';
      alvo = painel().querySelector('.conteudo');
    }
    return alvo;
  };

  /* ---- prévia do admin ----
     Quando preenchido, o portal mostra a empresa escolhida pelo admin e
     fica somente leitura. Fora da prévia é null. */
  let previa = null;

  /* ---- empresa da sessão ----
     O cliente pode estar vinculado a mais de uma empresa. A escolhida
     fica em sessionStorage e é SEMPRE conferida contra a lista da
     sessão (B7.sessao.empresas): um id vindo da URL que não esteja lá
     é ignorado. Fora da lista, nada é consultado. */
  const CHAVE_EMPRESA = 'b7_portal_empresa';
  function empresasDaSessao() {
    const u = B7.Auth && B7.Auth.usuario();
    return (u && Array.isArray(u.empresas)) ? u.empresas : [];
  }
  function empresa() {
    if (previa) return previa;
    const lista = empresasDaSessao();
    if (!lista.length) return null;
    let id = null;
    try { id = sessionStorage.getItem(CHAVE_EMPRESA); } catch (e) {}
    return lista.find(e => e.id === id) || lista[0];
  }
  /* Devolve true se o id é de uma empresa autorizada; false (e não
     muda nada) se não for. */
  function definirEmpresa(id) {
    if (previa) return false;
    const ok = empresasDaSessao().some(e => e.id === id);
    if (ok) {
      try { sessionStorage.setItem(CHAVE_EMPRESA, id); } catch (e) {}
      const sel = document.getElementById('pt-empresa');
      if (sel && sel.value !== id) sel.value = id;
    }
    return ok;
  }

  /* Endereços do portal. Na prévia, tudo vive sob #/previa/<id>/…, para
     o admin poder navegar e voltar sem perder o contexto. */
  const rota = secao => {
    const base = previa ? '#/previa/' + previa.id : '#';
    return secao ? base + '/' + secao : (previa ? base : '#/');
  };

  const FORMATOS = {
    roteiro: 'Roteiro', linha: 'Linha editorial',
    conteudo: 'Conteúdo', semana: 'Status semanal'
  };

  /* Status em linguagem de cliente (ver portal_status_amigavel no SQL). */
  const STATUS_CLIENTE = {
    em_producao: 'Em produção', em_revisao: 'Em revisão',
    aguardando_voce: 'Aguardando você', aprovado: 'Aprovado',
    programado: 'Programado', publicado: 'Publicado'
  };
  const ORDEM_STATUS = ['aguardando_voce', 'em_producao', 'em_revisao', 'aprovado', 'programado', 'publicado'];
  const STATUS_GRAVACAO = {
    em_preparacao: 'Em preparação', programada: 'Programada',
    gravada: 'Gravada', cancelada: 'Cancelada'
  };

  /* ---- Realtime do portal ----
     As telas acompanham o banco: mudança em aprovacoes (ou conteudos,
     gravacoes, status_semanais) da empresa agenda uma re-leitura curta.
     Um canal por tela, fechado ao sair da rota. */
  let canal = null, agendado = null;
  function assinar(aoMudar, tabelas) {
    desassinar();
    const emp = empresa();
    if (!emp || !B7.DB.canal) return;
    const lista = (tabelas || ['aprovacoes']).map(t => ({ table: t, filter: 'client_id=eq.' + emp.id }));
    canal = B7.DB.canal('portal-' + emp.id + '-' + Date.now(), lista,
      () => { clearTimeout(agendado); agendado = setTimeout(aoMudar, 400); });
    if (B7.Rota && B7.Rota.aoSair) B7.Rota.aoSair(desassinar);
  }
  function desassinar() {
    clearTimeout(agendado); agendado = null;
    if (canal) { B7.DB.fecharCanal(canal); canal = null; }
  }
  const naRota = prefixo => (location.hash || '#/').split('?')[0] === prefixo;

  /* =================================================================
     LAYOUT
     A navegação do cliente é montada do zero, não filtrada da interna.
     ================================================================= */
  const ITENS_NAV = [
    ['', 'inicio', 'Início'],
    ['aprovacoes', 'aprovacoes', 'Aprovações'],
    ['minha-linha', 'linha', 'Linha Editorial'],
    ['minha-producao', 'producao', 'Produção'],
    ['minhas-gravacoes', 'gravacoes', 'Gravações'],
    ['meus-status', 'semana', 'Status Semanal'],
    ['historico', 'historico', 'Histórico'],
    ['perfil', 'perfil', 'Meu perfil']
  ];

  function montarLayout() {
    const nav = document.querySelector('.nav');
    if (!nav) return;

    const emp = empresa();
    const lista = previa ? [] : empresasDaSessao();

    /* app.js usa esta marca para saber que a nav precisa ser
       reconstruída ao sair da prévia */
    nav.dataset.shell = 'portal';
    nav.innerHTML =
      /* Deixa claro em que ambiente a pessoa está. Sem isso, o portal
         parecia uma versão reduzida do sistema interno. */
      '<div class="pt-marcador' + (previa ? ' previa' : '') + '">' +
        '<span class="pt-marcador-rot">' + (previa ? 'PRÉVIA DO CLIENTE' : 'PORTAL DO CLIENTE') + '</span>' +
        (lista.length > 1
          ? '<select class="pt-marcador-sel" id="pt-empresa" aria-label="Empresa">' +
              lista.map(e => '<option value="' + esc(e.id) + '"' + (emp && e.id === emp.id ? ' selected' : '') + '>' +
                esc(e.nome) + '</option>').join('') + '</select>'
          : (emp ? '<span class="pt-marcador-emp">' + esc(emp.nome) + '</span>' : '')) +
      '</div>' +
      ITENS_NAV.map(([secao, icone, texto]) =>
        '<a data-ir="' + rota(secao) + '">' + ICONE[icone] +
        '<span>' + esc(texto) + '</span></a>').join('');

    const sel = nav.querySelector('#pt-empresa');
    if (sel) sel.onchange = () => {
      if (definirEmpresa(sel.value)) { location.hash = '#/'; if (naRota('#/')) abrirHome(); }
    };

    /* Sair fica no rodapé da barra, onde a pessoa procura. Na prévia o
       admin não sai da conta: ele volta ao sistema. */
    const rodape = document.querySelector('.lateral .pe-lateral')
      || document.querySelector('.lateral');
    const antigo = document.getElementById('pt-sair');
    if (antigo) antigo.remove();
    if (rodape) {
      const bt = document.createElement('button');
      bt.id = 'pt-sair';
      bt.className = 'pt-sair';
      bt.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="1.7" stroke-linecap="round"><path d="M15 17l5-5-5-5"/>' +
        '<path d="M20 12H9"/><path d="M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/></svg>' +
        '<span>' + (previa ? 'Voltar ao Admin' : 'Sair da conta') + '</span>';
      bt.onclick = () => previa ? voltarAoAdmin() : B7.Auth.sair();
      rodape.insertBefore(bt, rodape.firstChild);
    }

    document.body.classList.add('modo-portal');
    document.body.classList.toggle('modo-previa', !!previa);
    montarBanner();
    if (B7.moverTrilha) setTimeout(() => B7.moverTrilha(), 0);
  }

  /* Faixa fixa no topo da área: "Prévia do cliente: <empresa>" com o
     caminho de volta. Só existe na prévia. */
  function montarBanner() {
    const antigo = document.getElementById('pt-banner-previa');
    if (antigo) antigo.remove();
    if (!previa) return;
    const tela = document.getElementById('tela-dashboard');
    if (!tela) return;
    const b = document.createElement('div');
    b.id = 'pt-banner-previa';
    b.className = 'pt-banner-previa';
    b.setAttribute('role', 'status');
    b.innerHTML = '<div class="pt-banner-tx"><b>Prévia do cliente: ' + esc(previa.nome) + '</b>' +
      '<span>Você continua como administrador. Tudo aqui é somente leitura: nenhuma decisão é registrada.</span></div>' +
      '<button class="b fina" id="pt-voltar-admin">Voltar ao Admin</button>';
    tela.insertBefore(b, tela.firstChild);
    b.querySelector('#pt-voltar-admin').onclick = voltarAoAdmin;
  }

  function voltarAoAdmin() {
    const destino = previa ? '#/cliente/' + previa.id : '#/';
    location.hash = destino;
  }

  /* =================================================================
     PRÉVIA — entrada e saída
     Chamado por app.js quando a rota é #/previa/<id>/… e a sessão é de
     administrador. O id é conferido no banco (B7.DB.cliente respeita o
     RLS: só a equipe lê a ficha). Sair da prévia devolve o shell
     interno; quem remonta é app.js (B7.montarShellInterno).
     ================================================================= */
  async function abrirPrevia(clientId, partes, params) {
    if (!B7.Auth || !B7.Auth.ehAdmin()) {
      B7.UI.toast('A prévia do cliente é do administrador.', { tipo: 'erro' });
      location.replace('#/');
      return;
    }
    if (!previa || previa.id !== clientId) {
      carregando('Abrindo a prévia do cliente…');
      let c = null;
      try { c = await B7.DB.cliente(clientId); } catch (e) { c = null; }
      if (!c) {
        B7.UI.toast('Empresa não encontrada para a prévia.', { tipo: 'erro' });
        location.replace('#/clientes');
        return;
      }
      previa = { id: c.id, nome: c.nome, logo_url: c.logo_url || null,
                 servico: c.servico || 'ativo', mensagem: c.servico_mensagem || null };
      B7.Portal.somenteLeitura = true;
      desassinar();
      montarLayout();
    }
    const secao = partes[0] || '';
    if (secao === 'aprovacoes')       return abrirAprovacoes(params && params.get('f'));
    if (secao === 'minha-linha')      return abrirLinha();
    if (secao === 'minha-producao')   return abrirProducao();
    if (secao === 'minhas-gravacoes') return abrirGravacoes();
    if (secao === 'meus-status')      return abrirStatus();
    if (secao === 'historico')        return abrirHistorico();
    if (secao === 'perfil')           return abrirPerfil();
    if (secao === 'revisar' && partes[1]) return abrirRevisao(partes[1]);
    return abrirHome();
  }

  function sairPrevia() {
    if (!previa) return false;
    previa = null;
    B7.Portal.somenteLeitura = false;
    desassinar();
    const banner = document.getElementById('pt-banner-previa');
    if (banner) banner.remove();
    const sair = document.getElementById('pt-sair');
    if (sair) sair.remove();
    document.body.classList.remove('modo-portal', 'modo-previa');
    return true;
  }
  const emPrevia = () => !!previa;

  const ICONE = {
    inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    aprovacoes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>',
    linha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8.5 3v3M15.5 3v3"/></svg>',
    producao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7h16M4 12h10M4 17h13"/></svg>',
    gravacoes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z"/></svg>',
    semana: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    historico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 7v5l3.5 2"/><circle cx="12" cy="12" r="8.5"/></svg>',
    perfil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20.5v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>'
  };

  /* Toda tela do portal começa por aqui: marca o item da navegação e
     recusa carregar qualquer coisa se o serviço não estiver ativo. */
  function prepararTela(secao, texto) {
    marcarNav(rota(secao));
    const emp = empresa();
    if (emp && emp.servico !== 'ativo') { telaServico(emp); return null; }
    if (!emp) { semEmpresa(); return null; }
    if (texto) carregando(texto);
    return emp;
  }

  /* Conta de cliente sem empresa vinculada: não há o que mostrar, e
     inventar uma empresa seria pior do que dizer isso. */
  function semEmpresa() {
    tela('Portal do Cliente', 'Sua conta ainda não está vinculada a uma empresa.',
      vazio('Nada para acompanhar por enquanto.',
            'Peça à Branding7 para vincular sua conta à sua empresa. Assim que isso acontecer, o acompanhamento aparece aqui.'));
  }

  /* =================================================================
     HOME
     Responde, nesta ordem: o que precisa de mim; o que está sendo
     produzido; o que mudou há pouco; qual é a linha editorial; o que
     está acontecendo nesta semana.
     ================================================================= */
  async function abrirHome(silencioso) {
    const u = B7.Auth.usuario() || {};
    const emp = prepararTela('', silencioso ? null : 'Carregando seu acompanhamento…');
    if (!emp) return;
    if (!canal) assinar(() => { if (naRota(rota(''))) abrirHome(true); else desassinar(); },
                        ['aprovacoes', 'conteudos', 'status_semanais']);

    let pendentes = [], producao = [], recentes = [], gravacoes = [], semana = null, linha = null;
    try {
      [pendentes, producao, recentes, gravacoes, semana, linha] = await Promise.all([
        B7.DB.painelAprovacoes({ clienteId: emp.id, situacao: ['pendente', 'parcial'], somenteAtual: true, limite: 30 }).catch(() => []),
        B7.DB.producaoDoCliente(emp.id).catch(() => []),
        B7.DB.painelAprovacoes({ clienteId: emp.id, situacao: ['aprovado', 'ajustes', 'recusado'], limite: 12 }).catch(() => []),
        B7.DB.gravacoesDoCliente(emp.id).catch(() => []),
        B7.DB.ultimoStatusPublicado(emp.id).catch(() => null),
        B7.DB.linhaVisivelAtual(emp.id).catch(() => null)
      ]);
    } catch (e) { /* segue com o que veio */ }

    recentes = recentes.filter(a => a.decidido_em)
      .sort((a, b) => String(b.decidido_em).localeCompare(String(a.decidido_em))).slice(0, 5);
    const hoje = new Date().toISOString().slice(0, 10);
    const proxima = gravacoes
      .filter(g => g.status_cliente === 'programada' && g.data_gravacao && g.data_gravacao >= hoje)
      .sort((a, b) => String(a.data_gravacao).localeCompare(String(b.data_gravacao)))[0] || null;

    /* Nome real de quem está logado. Na prévia é o admin mesmo: fingir
       um nome de cliente seria inventar dado. */
    const primeiro = ((u.nome || u.username || '').trim().split(/\s+/)[0]) || '';

    painel().innerHTML = '<div class="conteudo entra portal-home">' +

      '<header class="ph-cab">' +
        '<div>' +
          '<h1>Olá' + (primeiro ? ', ' + esc(primeiro) : '') + '.</h1>' +
          '<p class="ph-emp">Acompanhe a produção da ' + esc(emp.nome) + '.</p>' +
        '</div>' +
      '</header>' +

      /* ---- o que depende do cliente vem primeiro ---- */
      '<section class="ph-secao" id="ph-atencao">' +
        '<div class="ph-titulo"><h2>Precisa da sua atenção</h2>' +
          (pendentes.length
            ? '<span class="ph-conta">' + pendentes.length + '</span>' : '') +
        '</div>' +
        (pendentes.length
          ? '<div class="ph-lista">' + pendentes.map(cartaoPendente).join('') + '</div>'
          : '<div class="ph-vazio"><div class="ph-vazio-ic">' + ICONE.aprovacoes + '</div>' +
            '<b>Tudo certo por aqui.</b>' +
            '<p>Não há materiais aguardando sua aprovação.</p>' +
            '</div>') +
      '</section>' +

      /* ---- resumo da produção, em linguagem de cliente ---- */
      '<section class="ph-secao">' +
        '<div class="ph-titulo"><h2>O que está em produção</h2>' +
          (producao.length ? '<a class="ph-link" href="' + rota('minha-producao') + '">Ver produção →</a>' : '') +
        '</div>' +
        resumoProducao(producao) +
      '</section>' +

      /* ---- o que mudou, a linha e a semana ---- */
      '<section class="ph-duplo">' +
        blocoRecentes(recentes) +
        blocoLinha(linha) +
        (proxima ? blocoGravacao(proxima) : '') +
        blocoSemana(semana) +
      '</section>' +
    '</div>';

    ligar();
  }

  function cartaoPendente(a) {
    const quando = a.enviado_em ? B7.UI.quando(a.enviado_em) : '';
    const aberta = a.situacao === 'pendente' || a.situacao === 'parcial';
    const acao = a.situacao === 'parcial' ? 'Continuar a revisão'
               : a.situacao === 'pendente' ? 'Revisar e decidir' : 'Abrir';
    return '<button class="ph-item" data-aprovacao="' + esc(a.id) + '">' +
      '<span class="ph-item-tipo">' + esc(FORMATOS[a.tipo] || a.tipo) + '</span>' +
      '<span class="ph-item-tx">' +
        '<b>' + esc(a.titulo || 'Sem título') + '</b>' +
        '<small>Versão ' + String(a.versao || 1).padStart(2, '0') +
        (quando ? ' · enviada ' + esc(quando) : '') +
        (a.total_partes ? ' · ' + (a.partes_aprovadas || 0) + '/' + a.total_partes + ' cenas aprovadas' : '') +
        (a.partes_ajustes ? ' · ' + a.partes_ajustes + ' com ajustes' : '') +
        '</small>' +
      '</span>' +
      '<span class="pt-sit mini ' + esc(a.situacao) + '">' + esc(rotuloSituacao(a.situacao)) + '</span>' +
      '<span class="ph-item-ir">' + esc(acao) + (aberta ? ' →' : '') + '</span>' +
    '</button>';
  }

  /* Contagem por status amigável. Só aparece o que existe: um zero em
     "Publicado" não informa nada. */
  function resumoProducao(lista) {
    if (!lista.length) {
      return '<div class="ph-bloco vazio"><p>Nenhum material liberado para acompanhamento ainda. ' +
        'A Branding7 libera cada peça conforme a produção avança.</p></div>';
    }
    const conta = {};
    lista.forEach(c => { conta[c.status_cliente] = (conta[c.status_cliente] || 0) + 1; });
    return '<div class="ph-status">' + ORDEM_STATUS.filter(s => conta[s]).map(s =>
      '<a class="ph-st ' + esc(s) + '" href="' + rota('minha-producao') + '?status=' + esc(s) + '">' +
        '<b>' + conta[s] + '</b><span>' + esc(STATUS_CLIENTE[s]) + '</span></a>').join('') + '</div>';
  }

  function blocoRecentes(lista) {
    if (!lista.length) {
      return '<div class="ph-bloco vazio"><h3>Aprovado ou alterado recentemente</h3>' +
        '<p>Suas decisões recentes aparecem aqui.</p></div>';
    }
    return '<div class="ph-bloco largo"><h3>Aprovado ou alterado recentemente</h3>' +
      '<div class="ph-recentes">' + lista.map(a =>
        '<a class="ph-rec" href="' + rota('revisar/' + a.id) + '">' +
          '<span class="pt-sit mini ' + esc(a.situacao) + '">' + esc(rotuloSituacao(a.situacao)) + '</span>' +
          '<b>' + esc(a.titulo || 'Material') + '</b>' +
          '<small>' + esc(FORMATOS[a.tipo] || a.tipo) + ' · v' + (a.versao || 1) + ' · ' + esc(B7.UI.quando(a.decidido_em)) + '</small>' +
        '</a>').join('') + '</div>' +
      '<a class="ph-ir" href="' + rota('historico') + '">Ver histórico →</a></div>';
  }

  function blocoLinha(l) {
    if (!l) {
      return '<div class="ph-bloco vazio"><h3>Linha editorial</h3>' +
        '<p>A Branding7 ainda não liberou o planejamento deste período.</p></div>';
    }
    return '<a class="ph-bloco" href="' + rota('minha-linha') + '">' +
      '<h3>Linha editorial atual</h3>' +
      '<b>' + esc(l.nome || 'Planejamento') + '</b>' +
      (l.objetivo ? '<p>' + esc(String(l.objetivo).slice(0, 140)) + (l.objetivo.length > 140 ? '…' : '') + '</p>' : '') +
      '<span class="ph-ir">Abrir →</span></a>';
  }

  function blocoGravacao(g) {
    return '<a class="ph-bloco" href="' + rota('minhas-gravacoes') + '">' +
      '<h3>Próxima gravação</h3>' +
      '<b>' + esc(g.nome || 'Gravação') + '</b>' +
      '<p>' + esc(B7.UI.dataBR(g.data_gravacao)) +
        (Array.isArray(g.roteiros) && g.roteiros.length
          ? ' · ' + g.roteiros.length + (g.roteiros.length === 1 ? ' roteiro' : ' roteiros') : '') + '</p>' +
      '<span class="ph-ir">Ver gravações →</span></a>';
  }

  function blocoSemana(s) {
    if (!s) {
      return '<div class="ph-bloco vazio"><h3>Status semanal</h3>' +
        '<p>A Branding7 ainda não publicou o relatório da semana.</p></div>';
    }
    return '<a class="ph-bloco" href="' + rota('meus-status') + '">' +
      '<h3>Status semanal</h3>' +
      '<b>' + esc(B7.DocSemana ? B7.DocSemana.periodoTexto(s.semana_inicio, s.semana_fim)
                                : 'Semana') + '</b>' +
      '<p>' + (s.total_itens || 0) + (s.total_itens === 1 ? ' demanda' : ' demandas') + ' no período · publicado ' +
        esc(B7.UI.quando(s.publicado_em)) + '</p>' +
      '<span class="ph-ir">Abrir →</span></a>';
  }

  /* =================================================================
     SERVIÇO PAUSADO OU CANCELADO
     O desfoque é só apresentação: nada privado é carregado por trás.
     No banco, posso_ver_cliente() já recusa tudo para o cliente.
     ================================================================= */
  function telaServico(emp) {
    desassinar();
    const cancelado = emp.servico === 'cancelado';
    painel().innerHTML = '<div class="conteudo entra">' +
      '<div class="ph-bloqueio">' +
        '<div class="ph-bloqueio-fundo" aria-hidden="true">' +
          '<div class="ph-fake"></div><div class="ph-fake"></div><div class="ph-fake curto"></div>' +
        '</div>' +
        '<div class="ph-bloqueio-caixa">' +
          '<img class="ph-marca" src="assets/brand/logo-color.png" alt="Branding7">' +
          '<h2>' + (cancelado ? 'Serviço encerrado' : 'Serviço temporariamente pausado') + '</h2>' +
          '<p>' + esc(emp.mensagem || (cancelado
            ? 'Seu serviço com a Branding7 foi encerrado. O histórico permanece guardado.'
            : 'O acompanhamento está suspenso no momento. Nada foi perdido: ' +
              'seus materiais continuam guardados.')) + '</p>' +
          '<p class="ph-bloqueio-ct">Fale com a Branding7 para mais informações.</p>' +
          (previa ? '<p class="ph-bloqueio-ct">Prévia: é isto que o cliente vê enquanto o serviço está ' +
            (cancelado ? 'cancelado' : 'pausado') + '. Nenhum material foi consultado.</p>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* =================================================================
     CENTRAL DE APROVAÇÕES DO CLIENTE
     Todos = versões atuais em qualquer situação. Histórico = tudo,
     inclusive versões substituídas e decisões anteriores.
     ================================================================= */
  let filtroAtual = 'pendente';
  const ABAS = [['todos', 'Todos'], ['pendente', 'Pendentes'], ['ajustes', 'Ajustes solicitados'],
                ['recusado', 'Recusados'], ['aprovado', 'Aprovados'], ['historico', 'Histórico']];
  async function abrirAprovacoes(filtro, silencioso) {
    const emp = prepararTela('aprovacoes', silencioso ? null : 'Carregando as aprovações…');
    if (!emp) return;
    if (!canal) assinar(() => { if (naRota(rota('aprovacoes'))) abrirAprovacoes(filtroAtual, true); else desassinar(); });

    const situacao = ABAS.some(([v]) => v === filtro) ? filtro : 'pendente';
    filtroAtual = situacao;
    const mapa = { pendente: ['pendente', 'parcial'], ajustes: ['ajustes'], recusado: ['recusado'],
                   aprovado: ['aprovado'], todos: null, historico: null };
    let itens = [];
    try {
      itens = await B7.DB.painelAprovacoes({
        clienteId: emp.id, situacao: mapa[situacao] || null,
        somenteAtual: situacao !== 'historico' && situacao !== 'aprovado'
      });
    } catch (e) { itens = []; }
    if (situacao === 'todos') itens = itens.filter(a => a.situacao !== 'substituido' && a.situacao !== 'cancelado');
    if (situacao === 'historico') itens = itens.filter(a => a.situacao !== 'pendente');

    const vazioTexto = {
      pendente: 'Nenhum material aguardando sua decisão.',
      ajustes: 'Nenhum material com ajustes solicitados.',
      recusado: 'Nenhum material recusado.',
      aprovado: 'Nenhum material aprovado ainda.',
      historico: 'Quando você decidir sobre um material, a decisão fica registrada aqui.',
      todos: 'A Branding7 ainda não enviou materiais para você.'
    }[situacao];

    painel().innerHTML = '<div class="conteudo entra portal-home">' +
      '<header class="ph-cab"><div><h1>Aprovações</h1>' +
      '<p class="ph-emp">Materiais que a Branding7 enviou para a ' + esc(emp.nome) + '.</p></div></header>' +

      '<div class="abas-cliente ap-abas">' + ABAS.map(([v, r]) =>
        '<button class="aba' + (v === situacao ? ' on' : '') + '" data-filtro="' + v + '">' +
        esc(r) + '</button>').join('') + '</div>' +

      (itens.length
        ? '<div class="ph-lista">' + itens.map(cartaoPendente).join('') + '</div>'
        : '<div class="ph-vazio"><b>Nada por aqui.</b><p>' + esc(vazioTexto) + '</p></div>') +
    '</div>';

    painel().querySelectorAll('[data-filtro]').forEach(b =>
      b.onclick = () => abrirAprovacoes(b.dataset.filtro, true));
    ligar();
  }

  /* =================================================================
     AUXILIARES
     ================================================================= */
  function marcarNav(destino) {
    document.querySelectorAll('.nav a').forEach(a =>
      a.classList.toggle('on', a.dataset.ir === destino));
    /* a trilha luminosa só anda quando alguém manda — sem isto ela
       ficava parada no Início enquanto a tela trocava */
    if (B7.moverTrilha) B7.moverTrilha();
  }

  function ligar() {
    painel().querySelectorAll('[data-aprovacao]').forEach(b =>
      b.onclick = () => { location.hash = rota('revisar/' + b.dataset.aprovacao); });
  }



  /* =================================================================
     LINHA EDITORIAL DO CLIENTE
     O planejamento do mês que a equipe liberou. Sem notas internas,
     sem campos técnicos.
     ================================================================= */
  async function abrirLinha() {
    const emp = prepararTela('minha-linha', 'Carregando o planejamento…');
    if (!emp) return;

    let linha = null, conteudos = [];
    try {
      linha = await B7.DB.linhaVisivelAtual(emp.id);
      if (linha) conteudos = await B7.DB.conteudosVisiveis(emp.id).catch(() => []);
    } catch (e) {}

    if (!linha) {
      return tela('Linha Editorial',
        'O planejamento de conteúdo do mês.',
        vazio('Nenhum planejamento liberado ainda.',
              'Assim que a Branding7 publicar a linha editorial do mês, ela aparece aqui.'));
    }

    const doMes = conteudos.filter(c => c.linha_id === linha.id);
    /* a aprovação do planejamento é uma decisão separada da visualização */
    let ap = null;
    try {
      const lista = await B7.DB.painelAprovacoes({ clienteId: emp.id, tipo: 'linha', alvoIds: [linha.id], somenteAtual: true, limite: 1 });
      ap = lista[0] || null;
    } catch (e) {}
    const faixaAp = ap
      ? '<a class="pt-faixa-link ' + esc(ap.situacao) + '" href="' + rota('revisar/' + ap.id) + '">' +
          '<b>' + esc(rotuloSituacao(ap.situacao)) + ' · versão ' + ap.versao + '</b>' +
          '<span>' + (ap.situacao === 'pendente' || ap.situacao === 'parcial'
            ? 'A Branding7 enviou este planejamento para sua aprovação. Revisar →'
            : 'Ver a decisão e as observações →') + '</span></a>'
      : '';
    tela('Linha Editorial', esc(linha.nome || 'Planejamento do mês'),
      faixaAp +
      (linha.objetivo
        ? '<div class="pt-destaque"><small>OBJETIVO DO MÊS</small><p>' +
          esc(linha.objetivo) + '</p></div>' : '') +

      (doMes.length
        ? '<div class="pt-grade">' + doMes.map(c =>
            '<article class="pt-item">' +
              '<span class="pt-formato">' + esc(c.tipo || 'Conteúdo') + '</span>' +
              '<h4>' + esc(c.titulo || 'Sem título') + '</h4>' +
              (c.data_postagem
                ? '<span class="pt-data">' + esc(B7.UI.dataBR(c.data_postagem)) + '</span>' : '') +
              (c.objetivo ? '<p>' + esc(c.objetivo) + '</p>' : '') +
            '</article>').join('') + '</div>'
        : vazio('O planejamento ainda não tem conteúdos liberados.',
                'A equipe libera cada peça conforme fica pronta.')));
  }

  /* =================================================================
     PRODUÇÃO — o andamento do que é da empresa
     Vem da view portal_producao: só o liberado, com status amigável.
     Agrupado por período; filtro por tipo e por status.
     ================================================================= */
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
                 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const nomePeriodo = p => {
    const m = /^(\d{4})-(\d{2})$/.exec(p || '');
    if (!m) return 'Sem data';
    const nome = MESES[parseInt(m[2], 10) - 1] || '';
    return nome.charAt(0).toUpperCase() + nome.slice(1) + ' de ' + m[1];
  };

  async function abrirProducao(filtros) {
    const emp = prepararTela('minha-producao', 'Carregando a produção…');
    if (!emp) return;
    if (!canal) assinar(() => { if (naRota(rota('minha-producao'))) abrirProducao(filtros); else desassinar(); },
                        ['conteudos', 'aprovacoes']);

    let lista = [];
    try { lista = await B7.DB.producaoDoCliente(emp.id); } catch (e) { lista = []; }

    if (!lista.length) {
      return tela('Produção', 'O andamento dos materiais da ' + esc(emp.nome) + '.',
        vazio('Nada liberado para acompanhamento ainda.',
              'A Branding7 libera os materiais conforme avança a produção.'));
    }

    const q = new URLSearchParams((location.hash.split('?')[1]) || '');
    const f = Object.assign({ tipo: q.get('tipo') || '', status: q.get('status') || '' }, filtros || {});
    const tipos = [...new Set(lista.map(c => c.tipo).filter(Boolean))];
    const statusPresentes = ORDEM_STATUS.filter(s => lista.some(c => c.status_cliente === s));
    const filtrada = lista.filter(c => (!f.tipo || c.tipo === f.tipo) && (!f.status || c.status_cliente === f.status));

    const porPeriodo = {};
    filtrada.forEach(c => { (porPeriodo[c.periodo || ''] = porPeriodo[c.periodo || ''] || []).push(c); });
    const periodos = Object.keys(porPeriodo).sort().reverse();

    const chip = (grupo, valor, texto, ativo) =>
      '<button class="pt-chip' + (ativo ? ' on' : '') + '" data-' + grupo + '="' + esc(valor) + '">' + esc(texto) + '</button>';

    tela('Produção', 'O andamento dos materiais da ' + esc(emp.nome) + '.',
      '<div class="pt-filtros">' +
        '<div class="pt-chips" role="group" aria-label="Tipo">' +
          chip('tipo', '', 'Todos os tipos', !f.tipo) + tipos.map(t => chip('tipo', t, t, f.tipo === t)).join('') +
        '</div>' +
        '<div class="pt-chips" role="group" aria-label="Situação">' +
          chip('status', '', 'Todas as situações', !f.status) +
          statusPresentes.map(s => chip('status', s, STATUS_CLIENTE[s], f.status === s)).join('') +
        '</div>' +
      '</div>' +
      (filtrada.length
        ? periodos.map(p =>
            '<section class="pt-periodo"><h3>' + esc(nomePeriodo(p)) + '</h3>' +
            '<div class="pt-lista">' + porPeriodo[p].map(itemProducao).join('') + '</div></section>').join('')
        : vazio('Nenhum material com esse filtro.', 'Experimente outra combinação de tipo e situação.')));

    const c = conteudo();
    c.querySelectorAll('[data-tipo]').forEach(b => b.onclick = () => abrirProducao(Object.assign({}, f, { tipo: b.dataset.tipo })));
    c.querySelectorAll('[data-status]').forEach(b => b.onclick = () => abrirProducao(Object.assign({}, f, { status: b.dataset.status })));
    ligar();
  }

  function itemProducao(c) {
    const abre = c.aprovacao_id ? ' data-aprovacao="' + esc(c.aprovacao_id) + '"' : '';
    const tag = c.aprovacao_id ? 'button' : 'div';
    return '<' + tag + ' class="pt-linha-item' + (c.aprovacao_id ? ' abre' : '') + '"' + abre + '>' +
      '<div><b>' + esc(c.titulo || 'Sem título') + '</b>' +
      '<span>' + esc(c.tipo || 'Conteúdo') +
      (c.data_postagem ? ' · ' + esc(B7.UI.dataBR(c.data_postagem)) : '') +
      (c.aprovacao_versao ? ' · versão ' + c.aprovacao_versao : '') + '</span></div>' +
      '<span class="pt-sit ' + esc(c.status_cliente) + '">' + esc(STATUS_CLIENTE[c.status_cliente] || c.status_cliente) + '</span>' +
      (c.aprovacao_id ? '<span class="ph-item-ir">' +
        (c.status_cliente === 'aguardando_voce' ? 'Revisar →' : 'Abrir →') + '</span>' : '') +
    '</' + tag + '>';
  }

  /* =================================================================
     GRAVAÇÕES — só o que a equipe liberou
     Vem da view portal_gravacoes: nome, data (se houver), situação em
     linguagem de cliente e os roteiros por título. Data ausente é dita
     como ausente, nunca inventada. O cliente não "aprova" que a
     gravação aconteceu: isso é registro da equipe.
     ================================================================= */
  async function abrirGravacoes() {
    const emp = prepararTela('minhas-gravacoes', 'Carregando as gravações…');
    if (!emp) return;
    if (!canal) assinar(() => { if (naRota(rota('minhas-gravacoes'))) abrirGravacoes(); else desassinar(); },
                        ['gravacoes', 'aprovacoes']);

    let lista = [];
    try { lista = await B7.DB.gravacoesDoCliente(emp.id); } catch (e) { lista = []; }

    if (!lista.length) {
      return tela('Gravações', 'As gravações da ' + esc(emp.nome) + ' que a Branding7 liberou para acompanhamento.',
        vazio('Nenhuma gravação liberada ainda.',
              'Quando a Branding7 liberar uma gravação para acompanhamento, ela aparece aqui com os roteiros relacionados.'));
    }

    const ordem = { programada: 0, em_preparacao: 1, gravada: 2, cancelada: 3 };
    lista.sort((a, b) => (ordem[a.status_cliente] - ordem[b.status_cliente]) ||
      String(b.data_gravacao || '').localeCompare(String(a.data_gravacao || '')));

    tela('Gravações', 'As gravações da ' + esc(emp.nome) + ' que a Branding7 liberou para acompanhamento.',
      '<div class="pt-gravacoes">' + lista.map(g => {
        const roteiros = Array.isArray(g.roteiros) ? g.roteiros : [];
        return '<article class="pt-grav ' + esc(g.status_cliente) + '">' +
          '<div class="pt-grav-cab">' +
            '<div><h4>' + esc(g.nome || 'Gravação') + '</h4>' +
              '<span class="pt-grav-data">' + (g.data_gravacao
                ? esc(B7.UI.dataBR(g.data_gravacao))
                : 'Sem data definida') + '</span></div>' +
            '<span class="pt-sit ' + esc(g.status_cliente) + '">' + esc(STATUS_GRAVACAO[g.status_cliente] || g.status_cliente) + '</span>' +
          '</div>' +
          (roteiros.length
            ? '<div class="pt-grav-rot"><small>ROTEIROS</small>' + roteiros.map(r =>
                r.aprovacao_id
                  ? '<a class="pt-grav-r" href="' + rota('revisar/' + r.aprovacao_id) + '"><b>' + esc(r.titulo) + '</b>' +
                    '<span class="pt-sit mini ' + esc(r.aprovacao_situacao) + '">' + esc(rotuloSituacao(r.aprovacao_situacao)) +
                    (r.aprovacao_versao ? ' · v' + r.aprovacao_versao : '') + '</span></a>'
                  : '<div class="pt-grav-r"><b>' + esc(r.titulo) + '</b><span class="pt-sit mini">Em produção</span></div>'
              ).join('') + '</div>'
            : '<p class="pt-nada">Os roteiros desta gravação ainda não foram enviados para você.</p>') +
        '</article>';
      }).join('') + '</div>');
  }

  /* =================================================================
     STATUS SEMANAL PUBLICADO
     Só o publicado: rascunho é interno. O mais recente abre com as
     demandas; os anteriores ficam listados. PDF e PNG usam o mesmo
     gerador da equipe, sem criar versão (isso é registro da equipe).
     ================================================================= */
  async function abrirStatus(id) {
    const emp = prepararTela('meus-status', 'Carregando os relatórios…');
    if (!emp) return;

    let lista = [];
    try { lista = await B7.DB.statusPublicados(emp.id); } catch (e) { lista = []; }

    if (!lista.length) {
      return tela('Status Semanal', 'O acompanhamento de sete dias.',
        vazio('Nenhum relatório publicado ainda.',
              'A Branding7 publica aqui o resumo de cada semana.'));
    }

    const atual = lista.find(s => s.id === id) || lista[0];
    const anteriores = lista.filter(s => s.id !== atual.id);
    const periodo = s => B7.DocSemana ? B7.DocSemana.periodoTexto(s.semana_inicio, s.semana_fim)
      : B7.UI.dataBR(s.semana_inicio) + ' a ' + B7.UI.dataBR(s.semana_fim);

    tela('Status Semanal', 'O acompanhamento de sete dias.',
      '<div class="pt-destaque pt-status-cab">' +
        '<div><small>' + esc(periodo(atual)).toUpperCase() + '</small>' +
        '<p>' + (atual.titulo ? esc(atual.titulo) + ' · ' : '') + 'Publicado ' + esc(B7.UI.quando(atual.publicado_em)) + '.</p></div>' +
        '<div class="pt-status-bts">' +
          '<button class="b contorno fina" data-baixar="pdf">Baixar PDF</button>' +
          '<button class="b contorno fina" data-baixar="png">Baixar PNG</button>' +
        '</div>' +
      '</div>' +
      '<div class="pt-lista" id="pt-semana-itens">' + B7.UI.skeleton('lista', { n: 3 }) + '</div>' +
      (anteriores.length
        ? '<section class="pt-bloco"><h3>Relatórios anteriores</h3><div class="pt-lista">' +
          anteriores.map(s => '<button class="pt-linha-item abre" data-status="' + esc(s.id) + '">' +
            '<div><b>' + esc(periodo(s)) + '</b><span>' + (s.total_itens || 0) +
            (s.total_itens === 1 ? ' demanda' : ' demandas') + ' · publicado ' + esc(B7.UI.quando(s.publicado_em)) + '</span></div>' +
            '<span class="ph-item-ir">Abrir →</span></button>').join('') + '</div></section>'
        : ''));

    const c = conteudo();
    c.querySelectorAll('[data-status]').forEach(b => b.onclick = () => abrirStatus(b.dataset.status));
    c.querySelectorAll('[data-baixar]').forEach(b => b.onclick = async () => {
      if (!B7.BaixarSemana) return B7.UI.toast('Exportação indisponível nesta tela', { tipo: 'erro' });
      const formato = b.dataset.baixar;
      b.disabled = true; b.textContent = 'Gerando…';
      try {
        const ctx = await B7.BaixarSemana.reunir(atual.id);
        if (formato === 'png') await B7.BaixarSemana.gerarPNG(ctx, {});
        else await B7.BaixarSemana.gerarPDF(ctx, {});
        B7.UI.toast(formato.toUpperCase() + ' gerado');
      } catch (e) {
        B7.UI.toast('Não foi possível gerar o ' + formato.toUpperCase(), { tipo: 'erro' });
      } finally { b.disabled = false; b.textContent = 'Baixar ' + formato.toUpperCase(); }
    });

    try {
      const itens = await B7.DB.itensDoStatus(atual.id);
      const alvo = document.getElementById('pt-semana-itens');
      if (!alvo) return;
      alvo.innerHTML = itens.length
        ? itens.map(i => '<div class="pt-linha-item"><div><b>' + esc(i.titulo) + '</b>' +
            '<span>' + esc(i.formato || i.etapa || '') +
            (i.data ? ' · ' + esc(B7.UI.dataBR(i.data)) : '') + '</span></div>' +
            '<span class="pt-sit">' + esc(i.situacao || '') + '</span></div>').join('')
        : '<p class="pt-nada">Sem demandas registradas nesta semana.</p>';
    } catch (e) {
      const alvo = document.getElementById('pt-semana-itens');
      if (alvo) alvo.innerHTML = '<p class="pt-nada">Não foi possível carregar as demandas desta semana.</p>';
    }
  }

  /* =================================================================
     HISTÓRICO — tudo que já foi decidido, inclusive versões substituídas
     ================================================================= */
  async function abrirHistorico() {
    const emp = prepararTela('historico', 'Carregando o histórico…');
    if (!emp) return;

    let itens = [];
    try { itens = await B7.DB.painelAprovacoes({ clienteId: emp.id }); } catch (e) {}
    const decididos = itens.filter(a => a.situacao !== 'pendente');

    if (!decididos.length) {
      return tela('Histórico', 'Tudo que você já revisou.',
        vazio('Nada decidido ainda.',
              'Quando você aprovar ou pedir ajustes em um material, ele aparece aqui.'));
    }

    tela('Histórico', 'Tudo que você já revisou.',
      '<div class="pt-lista">' + decididos.map(a =>
        '<button class="pt-linha-item abre" data-aprovacao="' + esc(a.id) + '">' +
          '<div><b>' + esc(a.titulo || 'Material') + '</b>' +
          '<span>' + esc(rotuloTipo(a.tipo)) + ' · versão ' + (a.versao || 1) +
          (a.decidido_em ? ' · decidido ' + esc(B7.UI.quando(a.decidido_em))
            : (a.enviado_em ? ' · enviado ' + esc(B7.UI.quando(a.enviado_em)) : '')) + '</span></div>' +
          '<span class="pt-sit ' + esc(a.situacao) + '">' +
          esc(rotuloSituacao(a.situacao)) + '</span>' +
        '</button>').join('') + '</div>');
    ligar();
  }

  /* =================================================================
     MEU PERFIL
     O avatar é da pessoa, não da empresa: a logo do cliente fica no
     marcador da barra lateral, a foto fica aqui. Editar (nome, foto,
     senha) usa o mesmo modal da equipe (B7.Perfil), que já sobe a foto.
     ================================================================= */
  function abrirPerfil() {
    marcarNav(rota('perfil'));
    const u = B7.Auth.usuario() || {};
    const emp = empresa();
    const lista = previa ? [] : empresasDaSessao();
    const foto = u.avatar_url
      ? '<img src="' + esc(u.avatar_url) + '" alt="">'
      : '<span>' + esc(B7.UI.iniciais(u.nome || u.username || '')) + '</span>';
    const tom = u.avatar_url ? ' com-foto' : ' tom-' + B7.UI.tomDoNome(u.nome || u.username || '');

    tela('Meu perfil', 'Seus dados de acesso ao portal.',
      '<div class="pt-perfil">' +
        '<div class="pt-perfil-cab">' +
          '<div class="pt-perfil-av av-pessoa' + tom + '">' + foto + '</div>' +
          '<div class="pt-perfil-id"><b>' + esc(u.nome || '') + '</b>' +
            '<span>@' + esc(u.username || '') + '</span>' +
            (u.papel === 'cliente' && u.pode_aprovar
              ? '<small>Sua conta aprova materiais em nome da empresa.</small>'
              : u.papel === 'cliente'
                ? '<small>Sua conta acompanha e comenta; a aprovação oficial fica com o responsável da empresa.</small>'
                : '') +
          '</div>' +
          '<button class="b pri" id="pt-editar-perfil"' + (previa ? ' disabled title="Na prévia, o perfil é o do administrador"' : '') +
            '>Editar perfil e foto</button>' +
        '</div>' +
        (previa
          ? '<p class="pt-nada">Na prévia, este é o perfil do administrador. O cliente vê aqui o próprio nome, ' +
            'foto e empresa, e pode trocar a foto e a senha.</p>'
          : '') +
        '<div class="pt-perfil-emp"><small>' + (lista.length === 1 ? 'EMPRESA' : 'EMPRESAS') + '</small>' +
          ((previa ? [previa] : lista).map(e =>
            '<div class="pt-perfil-e' + (emp && e.id === emp.id ? ' atual' : '') + '">' +
              (e.logo_url ? '<img src="' + esc(e.logo_url) + '" alt="">' : '<i>' + esc(B7.UI.iniciais(e.nome)) + '</i>') +
              '<b>' + esc(e.nome) + '</b>' +
              (e.servico && e.servico !== 'ativo' ? '<span class="pt-sit mini">' + (e.servico === 'pausado' ? 'Pausado' : 'Encerrado') + '</span>' : '') +
            '</div>').join('') || '<p class="pt-nada">Nenhuma empresa vinculada.</p>') +
        '</div>' +
        '<p class="pt-nada">Tema e aparência ficam no botão do topo.' +
          (lista.length > 1 ? ' Para mudar de empresa, use o seletor na barra lateral.' : '') + '</p>' +
      '</div>');

    const bt = document.getElementById('pt-editar-perfil');
    if (bt && !previa) bt.onclick = () => {
      if (B7.Perfil) B7.Perfil.abrir(); else B7.Auth.abrirPerfil();
    };
  }

  /* ---- utilidades das telas do portal ---- */
  /* Troca de rota no portal: a silhueta da lista que vem a seguir. O
     texto continua servindo aos leitores de tela. */
  function carregando(texto) {
    painel().innerHTML = '<div class="conteudo portal-home">' +
      '<span class="sr-only">' + esc(texto) + '</span>' +
      B7.UI.skeleton('lista', { n: 4 }) + '</div>';
  }

  function tela(titulo, subtitulo, corpo) {
    painel().innerHTML = '<div class="conteudo entra portal-home">' +
      '<header class="ph-cab"><div><h1>' + esc(titulo) + '</h1>' +
      '<p class="ph-emp">' + subtitulo + '</p></div></header>' +
      corpo +
    '</div>';
  }

  function vazio(titulo, texto) {
    return '<div class="pt-vazio"><div class="b7-marca fraca"></div>' +
      '<b>' + esc(titulo) + '</b><p>' + esc(texto) + '</p></div>';
  }

  /* =================================================================
     REVISÃO DE UM MATERIAL

     O cliente lê, decide por cena e decide o roteiro inteiro. Nunca
     edita: o texto pertence ao editor da equipe. O que ele escreve vira
     comentário, não substituição.
     ================================================================= */
  async function abrirRevisao(id) {
    marcarNav(rota('aprovacoes'));
    /* serviço pausado/cancelado: nada é carregado, nem por link direto */
    const empRev = empresa();
    if (empRev && empRev.servico !== 'ativo') return telaServico(empRev);
    painel().innerHTML = '<div class="conteudo entra portal-revisao"></div>';
    conteudo().innerHTML = '<span class="sr-only">Abrindo material…</span>' + B7.UI.skeleton('detalhe');

    let ap, partes = [], comentarios = [], versoes = [];
    try {
      ap = await B7.DB.painelAprovacao(id);
      if (!ap) throw new Error('Material não encontrado.');
      /* na prévia, o material precisa ser da empresa escolhida; para o
         cliente o RLS já garante isso (e o toast acima nunca aparece) */
      if (previa && ap.client_id !== previa.id) throw new Error('Este material não é da empresa em prévia.');
      [partes, comentarios, versoes] = await Promise.all([
        B7.DB.partesDaAprovacao(id).catch(() => []),
        B7.DB.comentariosAprovacao(id).catch(() => []),
        B7.DB.aprovacoesDoMaterial(ap.tipo, ap.alvo_id).catch(() => [])
      ]);
      /* o snapshot não vem no painel: busca a linha crua */
      const cru = await B7.DB.aprovacao(id);
      ap.snapshot = (cru && cru.snapshot) || {};
    } catch (e) {
      return conteudo().innerHTML = '<div class="pt-vazio"><b>' +
        esc(e.message || 'Não foi possível abrir este material.') + '</b></div>';
    }

    const snap = ap.snapshot || {};
    const cenas = Array.isArray(snap.cenas) ? snap.cenas : [];
    const aberta = ap.situacao === 'pendente' || ap.situacao === 'parcial';
    const decisaoDe = pid => partes.find(x => x.parte_id === pid) || null;
    const u = B7.Auth.usuario() || {};
    const aprovador = u.papel !== 'cliente' || !!u.pode_aprovar;
    const podeAprovar = !B7.Portal.somenteLeitura && aberta && aprovador;
    /* Prévia do admin: os botões de decisão aparecem, mas desabilitados
       e com o motivo — o admin precisa ver o que o cliente vê, sem
       nunca conseguir decidir em nome dele. */
    const previaAtiva = !!previa;
    const mostraDecisao = podeAprovar || (previaAtiva && aberta);
    const desab = previaAtiva ? ' disabled title="Prévia do cliente: somente leitura"' : '';
    const atual = versoes.find(v => v.situacao !== 'substituido' && v.versao > ap.versao) ||
                  versoes.reduce((m, v) => (!m || v.versao > m.versao) ? v : m, null);
    const superada = ap.situacao === 'substituido' || (atual && atual.id !== ap.id && atual.versao > ap.versao);

    const cenasAprovadas = partes.filter(p => p.situacao === 'aprovada').length;
    const cenasAjustes = partes.filter(p => p.situacao === 'ajustes').length;
    const cenasPendentes = cenas.filter(c => !decisaoDe(c.id)).length;

    conteudo().innerHTML =
      '<a class="pt-voltar" href="' + rota('aprovacoes') + '">← Aprovações</a>' +

      (superada
        ? '<div class="pt-aviso-versao"><b>Esta é a versão ' + (ap.versao || 1) + ', que já foi substituída.</b> ' +
          'Suas decisões nela ficam guardadas no histórico, mas não valem para a versão nova. ' +
          (atual && atual.id !== ap.id
            ? '<a href="' + rota('revisar/' + atual.id) + '">Abrir a versão atual (v' + atual.versao + ') →</a>' : '') +
          '</div>' : '') +

      '<header class="pt-rev-cab">' +
        '<div>' +
          '<span class="pt-tipo">' + esc(rotuloTipo(ap.tipo)) + ' · versão ' + (ap.versao || 1) + '</span>' +
          '<h1>' + esc(ap.titulo || snap.titulo || 'Material') + '</h1>' +
          '<p>Enviado ' + esc(B7.UI.quando(ap.enviado_em)) +
            (ap.observacao_envio ? ' · ' + esc(ap.observacao_envio) : '') + '</p>' +
        '</div>' +
        '<span class="pt-sit ' + esc(ap.situacao) + '">' + esc(rotuloSituacao(ap.situacao)) + '</span>' +
      '</header>' +

      /* anulação (v3): texto neutro; o motivo só aparece se o Admin marcou */
      (ap.decisao_anulada || partes.some(x => x.anulada_em && x.situacao === 'pendente')
        ? '<div class="pt-faixa anulada"><b>A aprovação anterior foi anulada pela Branding7.</b><span>' +
          (ap.anulacao_visivel_cliente && ap.anulacao_motivo ? esc(ap.anulacao_motivo) + ' · ' : '') +
          (aberta ? 'Este material voltou para a sua revisão: você pode decidir de novo.' : '') + '</span></div>' : '') +

      faixaDecisao(ap, cenas.length, cenasAprovadas, cenasAjustes, cenasPendentes) +

      (cenas.length
        ? '<div class="pt-cenas">' + cenas.map((c, i) => cartaoCena(c, i, decisaoDe, mostraDecisao, desab)).join('') + '</div>'
        : '<div class="pt-corpo-simples">' + corpoSimples(snap, ap.tipo) + '</div>') +

      '<section class="pt-bloco">' +
        '<h3>Observações</h3>' +
        '<div class="pt-coments" id="pt-coments">' +
          (comentarios.length ? comentarios.map(comentario).join('')
            : '<p class="pt-nada">Nenhuma observação ainda.</p>') +
        '</div>' +
        (B7.Portal.somenteLeitura || !aberta ? '' :
          '<div class="pt-novo-com">' +
            '<input class="campo" id="pt-com" placeholder="Escrever uma observação geral…">' +
            '<button class="b pri" id="pt-com-add">Enviar</button>' +
          '</div>') +
      '</section>' +

      (mostraDecisao
        ? '<div class="pt-decisao' + (previaAtiva ? ' previa' : '') + '">' +
            '<div class="pt-decisao-tx"><b>Sua decisão sobre a versão ' + (ap.versao || 1) + '</b>' +
              '<span id="pt-aviso">' + (previaAtiva
                ? 'Prévia do cliente: as decisões ficam desativadas. Nenhum comando é enviado ao banco.'
                : cenasAjustes
                ? cenasAjustes + ' cena(s) com ajustes pedidos — a aprovação completa fica bloqueada até uma nova versão.'
                : (cenas.length && cenasPendentes
                    ? cenasPendentes + ' cena(s) ainda sem decisão. Aprovar o ' + rotuloTipo(ap.tipo).toLowerCase() + ' completo vale para todas.'
                    : 'Escolha uma ação. Ela vale para esta versão inteira.')) + '</span></div>' +
            '<div class="pt-decisao-bts">' +
              '<button class="b perigo contorno" id="pt-recusar"' + desab + '>Recusar</button>' +
              '<button class="b contorno" id="pt-ajustes"' + desab + '>Solicitar ajustes</button>' +
              '<button class="b pri grande" id="pt-aprovar"' + (cenasAjustes || previaAtiva ? ' disabled' : '') +
                (previaAtiva ? ' title="Prévia do cliente: somente leitura"' : '') + '>' +
                (ap.tipo === 'roteiro' ? 'Aprovar roteiro completo' : 'Aprovar ' + rotuloTipo(ap.tipo).toLowerCase()) + '</button>' +
            '</div>' +
          '</div>'
        : '<div class="pt-decidido">' +
            (!aberta
              ? textoEncerrado(ap)
              : (aprovador ? 'Modo de visualização: nenhuma decisão é registrada.'
                           : 'Sua conta acompanha e comenta; a aprovação oficial fica com o responsável da empresa.')) +
          '</div>') +

      (versoes.length > 1
        ? '<section class="pt-bloco"><h3>Versões deste material</h3><div class="pt-versoes">' +
          versoes.slice().sort((x, y) => y.versao - x.versao).map(v =>
            '<a class="pt-versao' + (v.id === ap.id ? ' atual' : '') + '" href="' + rota('revisar/' + v.id) + '">' +
              '<b>v' + v.versao + '</b><span class="pt-sit mini ' + esc(v.situacao) + '">' + esc(rotuloSituacao(v.situacao)) + '</span>' +
              '<small>' + esc(B7.UI.quando(v.enviado_em)) + '</small></a>').join('') +
          '</div></section>' : '') +

      (ap.tipo === 'roteiro'
        ? '<div class="pt-baixar"><button class="b contorno" id="pt-pdf">Baixar PDF</button></div>'
        : '');

    ligarRevisao(ap, cenas, partes);
  }

  /* faixa de destaque com o veredito da versão */
  function faixaDecisao(ap, total, aprovadas, ajustes, pendentes) {
    if (ap.situacao === 'aprovado') {
      return '<div class="pt-faixa aprovado"><b>' + (ap.tipo === 'roteiro' ? 'Roteiro aprovado' : rotuloTipo(ap.tipo) + (ap.tipo === 'linha' ? ' aprovada' : ' aprovado')) +
        '</b><span>Versão ' + ap.versao + ' · por ' + esc(ap.decidido_por_nome || 'você') + ' · ' + esc(B7.UI.quando(ap.decidido_em)) + '</span></div>';
    }
    if (ap.situacao === 'ajustes') {
      return '<div class="pt-faixa ajustes"><b>Ajustes solicitados</b><span>' +
        (ap.motivo ? esc(ap.motivo) + ' · ' : '') + 'A Branding7 vai preparar uma nova versão.</span></div>';
    }
    if (ap.situacao === 'recusado') {
      return '<div class="pt-faixa recusado"><b>Recusado</b><span>Motivo: ' + esc(ap.motivo || '—') +
        ' · A equipe vai avaliar um novo caminho.</span></div>';
    }
    if (ap.situacao === 'substituido') {
      return '<div class="pt-faixa substituido"><b>Versão substituída</b><span>Uma versão mais nova foi enviada.</span></div>';
    }
    if (total) {
      return '<div class="pt-faixa parcial"><b>' + (aprovadas ? aprovadas + ' de ' + total + ' cenas aprovadas' : 'Aguardando sua revisão') +
        '</b><span>' + (ajustes ? ajustes + ' com ajustes pedidos · ' : '') + (pendentes ? pendentes + ' sem decisão' : 'todas as cenas decididas') + '</span></div>';
    }
    return '';
  }

  function textoEncerrado(ap) {
    const q = ap.decidido_em ? ' ' + esc(B7.UI.quando(ap.decidido_em)) : '';
    if (ap.decisao_anulada) return 'A aprovação anterior foi anulada pela Branding7.' +
      (ap.situacao === 'substituido' ? ' Esta versão foi substituída por uma mais nova.' : '');
    if (ap.situacao === 'aprovado') return 'Esta versão foi aprovada' + q + '. Para mudar de ideia, fale com a equipe.';
    if (ap.situacao === 'ajustes') return 'Você pediu ajustes' + q + '. Quando a Branding7 enviar a nova versão, ela aparece em Aprovações.';
    if (ap.situacao === 'recusado') return 'Você recusou esta versão' + q + '.';
    if (ap.situacao === 'substituido') return 'Esta versão foi substituída por uma mais nova.';
    return 'Esta versão está encerrada.';
  }

  function cartaoCena(c, i, decisaoDe, podeAprovar, desab) {
    const pid = c.id || ('cena-' + i);
    desab = desab || '';
    /* snapshot antigo sem id de cena: mostra, mas não decide por cena */
    if (!c.id) podeAprovar = false;
    const d = decisaoDe(pid);
    const sit = d ? d.situacao : 'pendente';
    const rot = 'Cena ' + String(i + 1).padStart(2, '0');
    const campo = (r, valor) => valor
      ? '<div class="pt-campo"><small>' + r + '</small><p>' + esc(valor) + '</p></div>' : '';
    return '<article class="pt-cena ' + esc(sit) + '" data-parte="' + esc(pid) + '" data-rotulo="' + esc(rot) + '">' +
      '<div class="pt-cena-cab">' +
        '<span class="pt-cena-n">' + rot.toUpperCase() + '</span>' +
        (sit !== 'pendente'
          ? '<span class="pt-cena-sit ' + esc(sit) + '">' +
            (sit === 'aprovada' ? '✓ Aprovada' : 'Ajustes pedidos') +
            (d && d.decidido_em ? ' · ' + esc(B7.UI.quando(d.decidido_em)) : '') + '</span>'
          : (d && d.anulada_em ? '<span class="pt-cena-sit anulada">Decisão anterior anulada pela Branding7</span>' : '')) +
      '</div>' +
      '<div class="pt-cena-meta">' +
        (c.tipo ? '<span class="pt-cena-tipo">' + esc((c.funcao && c.funcao.trim()) || c.tipo) + '</span>' : '') +
        (c.direcao ? '<span class="pt-cena-dir">' + esc(c.direcao) + '</span>' : '') +
      '</div>' +
      (c.titulo ? '<h4>' + esc(c.titulo) + '</h4>' : '') +
      campo(c.tipo ? c.tipo.toUpperCase() : 'TEXTO', c.texto) +
      campo('SUGESTÃO DE CENAS', c.sugestao_cenas) +
      campo('HOOK', c.hook) + campo('NARRATIVA', c.narrativa) +
      campo('NARRAÇÃO', c.narracao) + campo('CTA', c.cta) + campo('TOMADA', c.tomada) +
      (podeAprovar
        ? '<div class="pt-cena-acoes">' +
            (sit === 'ajustes'
              ? '<button class="b fina" data-cena-ok="' + esc(pid) + '"' + desab + '>Aprovar esta cena afinal</button>'
              : sit === 'aprovada'
                /* cena já aprovada: mostra o estado, não repete o botão de aprovar */
                ? '<button class="b fina" data-cena-ajuste="' + esc(pid) + '"' + desab + '>Pedir ajuste</button>' +
                  '<span class="pt-cena-ok">Aprovada</span>'
                : '<button class="b fina" data-cena-ajuste="' + esc(pid) + '"' + desab + '>Pedir ajuste</button>' +
                  '<button class="b fina pri" data-cena-ok="' + esc(pid) + '"' + desab + '>Aprovar cena</button>') +
          '</div>'
        : '') +
    '</article>';
  }

  function corpoSimples(snap, tipo) {
    let html = '';
    if (tipo === 'linha') {
      const itens = Array.isArray(snap.conteudos) ? snap.conteudos : [];
      html += (snap.periodo ? '<div class="pt-campo"><small>PERÍODO</small><p>' + esc(snap.periodo) + '</p></div>' : '');
      ['objetivo', 'posicionamento_mes', 'canais', 'estrategia'].forEach(k => {
        if (snap[k]) html += '<div class="pt-campo"><small>' + k.replace(/_/g, ' ').toUpperCase() + '</small><p>' + esc(snap[k]) + '</p></div>';
      });
      if (itens.length) {
        html += '<div class="pt-campo"><small>CONTEÚDOS PLANEJADOS (' + itens.length + ')</small><div class="pt-grade">' +
          itens.map(c => '<article class="pt-item"><span class="pt-formato">' + esc(c.tipo || 'Conteúdo') + '</span>' +
            '<h4>' + esc(c.titulo || 'Sem título') + '</h4>' +
            (c.data_postagem ? '<span class="pt-data">' + esc(B7.UI.dataBR(c.data_postagem)) + '</span>' : '') +
            (c.objetivo ? '<p>' + esc(c.objetivo) + '</p>' : '') +
            (c.roteiro_titulo ? '<p class="pt-nada">Roteiro: ' + esc(c.roteiro_titulo) + '</p>' : '') +
            '</article>').join('') + '</div></div>';
      }
      return html || '<p class="pt-nada">Este planejamento não tem detalhes para exibir.</p>';
    }
    const campos = ['objetivo', 'ideia_geral', 'headline', 'legenda', 'cta', 'direcao'];
    html = campos.filter(k => snap[k])
      .map(k => '<div class="pt-campo"><small>' + k.replace(/_/g, ' ').toUpperCase() +
        '</small><p>' + esc(snap[k]) + '</p></div>').join('');
    return html || '<p class="pt-nada">Este material não tem detalhes para exibir.</p>';
  }

  function comentario(c) {
    return '<div class="pt-com' + (c.resolvido ? ' resolvido' : '') + (c.autor_papel === 'cliente' ? ' cliente' : ' equipe') + '">' +
      '<div class="pt-com-cab"><b>' + esc(c.autor_nome || 'Equipe') + '</b>' +
      (c.parte_rotulo ? '<i>' + esc(c.parte_rotulo) + '</i>' : '') +
      '<span>' + esc(B7.UI.quando(c.created_at)) + '</span></div>' +
      '<p>' + esc(c.texto) + '</p></div>';
  }

  /* Uma ação de cada vez: enquanto um comando está em voo, os outros
     botões ficam travados. O banco garante a idempotência de qualquer
     forma — isto é só para a pessoa não ver dois toasts. */
  let emVoo = false;
  async function comando(botoes, fn) {
    /* rede de segurança da prévia: mesmo que um botão desabilitado seja
       reativado pelo console, nenhum comando sai daqui */
    if (previa) { B7.UI.toast('Prévia do cliente: nenhuma decisão é registrada.', { tipo: 'erro' }); return; }
    if (emVoo) return;
    emVoo = true;
    botoes.forEach(b => { if (b) { b.disabled = true; b.dataset.tx = b.textContent; b.textContent = 'Enviando…'; } });
    try { return await fn(); }
    finally {
      emVoo = false;
      botoes.forEach(b => { if (b) { b.disabled = false; b.textContent = b.dataset.tx || b.textContent; } });
    }
  }
  function explicarErro(e, padrao) {
    const msg = (e && e.message) || padrao;
    B7.UI.toast(msg, { tipo: 'erro', tempo: 9000 });
  }

  function ligarRevisao(ap, cenas, partes) {
    const c = conteudo();
    /* Prévia do admin: nenhum comando é ligado. Os botões já vêm
       desabilitados; se algum for reativado à mão, só avisa. */
    if (previa) {
      c.querySelectorAll('[data-cena-ok],[data-cena-ajuste],#pt-aprovar,#pt-ajustes,#pt-recusar,#pt-com-add')
        .forEach(b => b.onclick = e => {
          e.preventDefault();
          B7.UI.toast('Prévia do cliente: nenhuma decisão é registrada.', { tipo: 'erro' });
        });
      return ligarPdf(ap, c);
    }
    const rotuloDe = pid => { const el = c.querySelector('[data-parte="' + pid + '"]'); return el ? el.dataset.rotulo : 'Cena'; };
    const todos = () => [...c.querySelectorAll('[data-cena-ok],[data-cena-ajuste],#pt-aprovar,#pt-ajustes,#pt-recusar')];

    c.querySelectorAll('[data-cena-ok]').forEach(b => b.onclick = () => comando(todos(), async () => {
      try {
        const r = await B7.DB.decidirParte(ap.id, b.dataset.cenaOk, rotuloDe(b.dataset.cenaOk), 'aprovada');
        if (r && r.resultado === 'inalterado') B7.UI.toast('Esta cena já estava aprovada');
        else B7.UI.toast(rotuloDe(b.dataset.cenaOk) + ' aprovada');
        abrirRevisao(ap.id);
      } catch (e) { explicarErro(e, 'Não foi possível registrar a decisão'); if (/versão|substitu|encerrada/i.test(e.message || '')) abrirRevisao(ap.id); }
    }));

    c.querySelectorAll('[data-cena-ajuste]').forEach(b => b.onclick = async () => {
      const texto = await B7.UI.perguntar({
        titulo: 'O que precisa mudar na ' + rotuloDe(b.dataset.cenaAjuste).toLowerCase() + '?',
        rotulo: 'Sua observação vai para a equipe. O texto não muda sozinho.',
        placeholder: 'ex.: trocar o exemplo do início', confirmar: 'Pedir ajuste'
      });
      if (texto === null) return;
      if (!texto) return B7.UI.toast('Descreva o ajuste para a equipe entender o pedido', { tipo: 'erro' });
      comando(todos(), async () => {
        try {
          await B7.DB.decidirParte(ap.id, b.dataset.cenaAjuste, rotuloDe(b.dataset.cenaAjuste), 'ajustes', texto);
          B7.UI.toast('Ajuste pedido na ' + rotuloDe(b.dataset.cenaAjuste).toLowerCase());
          abrirRevisao(ap.id);
        } catch (e) { explicarErro(e, 'Não foi possível registrar o pedido'); }
      });
    });

    const add = c.querySelector('#pt-com-add');
    if (add) add.onclick = async () => {
      const campo = c.querySelector('#pt-com');
      const texto = campo.value.trim();
      if (!texto) return;
      add.disabled = true;
      try { await B7.DB.comentarAprovacao(ap.id, texto); abrirRevisao(ap.id); }
      catch (e) { add.disabled = false; explicarErro(e, 'Não foi possível enviar a observação'); }
    };

    const bAprovar = c.querySelector('#pt-aprovar');
    if (bAprovar) bAprovar.onclick = async () => {
      const semDecisao = cenas.filter(x => !partes.find(p => p.parte_id === x.id)).length;
      const ok = await B7.UI.confirmar({
        titulo: ap.tipo === 'roteiro' ? 'Aprovar o roteiro completo?' : 'Aprovar ' + rotuloTipo(ap.tipo).toLowerCase() + '?',
        texto: 'Você está aprovando a versão ' + ap.versao + ' inteira' +
               (semDecisao ? ', incluindo ' + semDecisao + ' cena(s) que você não decidiu individualmente' : '') +
               '. A equipe recebe a aprovação na hora e segue para a próxima etapa.',
        confirmar: 'Aprovar'
      });
      if (!ok) return;
      comando(todos(), async () => {
        try {
          const r = await B7.DB.decidirAprovacao(ap.id, 'aprovado', null, ap.versao);
          B7.UI.toast(r && r.resultado === 'inalterado' ? 'Esta versão já estava aprovada' : 'Aprovado — a Branding7 foi avisada');
          abrirRevisao(ap.id);
        } catch (e) { explicarErro(e, 'Não foi possível registrar a aprovação'); if (/versão|substitu|decidida/i.test(e.message || '')) abrirRevisao(ap.id); }
      });
    };

    const bAjustes = c.querySelector('#pt-ajustes');
    if (bAjustes) bAjustes.onclick = async () => {
      const cenasAj = partes.filter(p => p.situacao === 'ajustes').length;
      const texto = await B7.UI.perguntar({
        titulo: 'O que precisa ser ajustado?',
        rotulo: cenasAj ? 'Você já pediu ajustes em ' + cenasAj + ' cena(s). Acrescente o que faltar; a equipe recebe tudo junto.'
                        : 'Descreva o que deve mudar. A equipe prepara uma nova versão e envia de novo para você.',
        placeholder: 'ex.: o tom está formal demais para o nosso público', confirmar: 'Solicitar ajustes'
      });
      if (texto === null) return;
      if (!texto && !cenasAj) return B7.UI.toast('Descreva o que precisa ser ajustado', { tipo: 'erro' });
      comando(todos(), async () => {
        try {
          await B7.DB.decidirAprovacao(ap.id, 'ajustes', texto, ap.versao);
          B7.UI.toast('Ajustes solicitados — a Branding7 foi avisada');
          abrirRevisao(ap.id);
        } catch (e) { explicarErro(e, 'Não foi possível registrar o pedido de ajustes'); }
      });
    };

    const bRecusar = c.querySelector('#pt-recusar');
    if (bRecusar) bRecusar.onclick = async () => {
      const motivo = await B7.UI.perguntar({
        titulo: 'Recusar esta versão?',
        rotulo: 'Recusar é diferente de pedir ajustes: significa que a proposta não serve e a equipe precisa repensar o caminho. O motivo é obrigatório e fica registrado.',
        placeholder: 'ex.: esse conceito não representa a marca', confirmar: 'Recusar'
      });
      if (motivo === null) return;
      if (!motivo) return B7.UI.toast('Recusar exige um motivo', { tipo: 'erro' });
      const ok = await B7.UI.confirmar({ titulo: 'Confirmar a recusa', perigo: true,
        texto: 'A versão ' + ap.versao + ' será marcada como recusada com o motivo informado. Isso não pode ser desfeito por você.',
        confirmar: 'Recusar de vez' });
      if (!ok) return;
      comando(todos(), async () => {
        try {
          await B7.DB.decidirAprovacao(ap.id, 'recusado', motivo, ap.versao);
          B7.UI.toast('Recusa registrada — a Branding7 foi avisada');
          abrirRevisao(ap.id);
        } catch (e) { explicarErro(e, 'Não foi possível registrar a recusa'); }
      });
    };

    ligarPdf(ap, c);
  }

  /* O PDF da versão enviada vale para o cliente e para a prévia: é
     leitura, não decisão. */
  function ligarPdf(ap, c) {
    const pdf = c.querySelector('#pt-pdf');
    if (pdf) pdf.onclick = async () => {
      const snap = ap.snapshot || {};
      if (!Array.isArray(snap.cenas) || !snap.cenas.length) {
        return B7.UI.toast('Esta versão não tem cenas para gerar o PDF', { tipo: 'erro' });
      }
      const roteiro = {
        id: ap.alvo_id, titulo: snap.titulo || '', objetivo: snap.objetivo || '',
        observacao_gravacao: snap.observacao_gravacao || '',
        escala: snap.escala || 1, escala_automatica: snap.escala_automatica !== false
      };
      const ctx = {
        cliente: snap.cliente || (empresa() || {}).nome || '',
        clienteLogo: snap.cliente_logo_url || null,
        gravacao: snap.gravacao || '',
        dataGravacao: snap.data_gravacao ? B7.UI.dataBR(snap.data_gravacao) : '',
        roteiros: [roteiro], cenasPorRoteiro: { [roteiro.id]: snap.cenas }
      };
      const nome = B7.Export.nomeArquivo([ctx.cliente, 'ROTEIRO', roteiro.titulo, 'V' + (ap.versao || 1)], 'pdf');
      pdf.disabled = true; pdf.textContent = 'Gerando PDF…';
      try { await B7.Export.gerarPDF(ctx, [roteiro.id], false, nome); }
      catch (e) { B7.UI.toast('Não foi possível gerar o PDF', { tipo: 'erro' }); }
      finally { pdf.disabled = false; pdf.textContent = 'Baixar PDF'; }
    };
  }

  const rotuloTipo = t => ({ roteiro: 'Roteiro', linha: 'Linha editorial',
    conteudo: 'Conteúdo', semana: 'Status semanal' }[t] || t);
  const rotuloSituacao = s => ({ pendente: 'Aguardando você', parcial: 'Parcialmente revisado',
    aprovado: 'Aprovado', ajustes: 'Ajustes solicitados', recusado: 'Recusado',
    substituido: 'Versão substituída', cancelado: 'Cancelado' }[s] || s);

  return { montarLayout, abrirHome, abrirAprovacoes, abrirRevisao,
           abrirLinha, abrirProducao, abrirGravacoes, abrirStatus, abrirHistorico, abrirPerfil,
           abrirPrevia, sairPrevia, emPrevia, definirEmpresa, rota,
           telaServico, empresa, marcarNav, somenteLeitura: false };
})();
