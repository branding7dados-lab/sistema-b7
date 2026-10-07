/* =====================================================================
   TOPO GLOBAL — uma barra só, para todo mundo

   Hierarquia (desktop):  [Buscar no B7…  Ctrl K]  ·····  [estado de
   salvamento, só quando importa] [sino] [conta] [+ Criar]
   Celular: mesma lógica, outra composição — busca vira ícone, o meio
   mostra onde a pessoa está, e Criar/Conta abrem em folha (bottom sheet,
   o próprio B7.UI.modal, que no celular já sobe de baixo).

   Não existe "topo do admin", "topo do videomaker"… O papel só muda:
     • as ações de Criar (resolvidas por PERMISSÃO — B7.Perm.podeRota +
       a mesma checagem que a tela dona do fluxo faz antes de mostrar o
       botão dela), sem duplicar quando duas funções dão a mesma ação;
     • os destinos e o rótulo das funções no menu da conta.
   Nada disso é segurança: o banco e a guarda de rota continuam valendo.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Topo = (function () {
  const esc = s => B7.UI.esc(s);
  const ehCelular = () => { try { return window.matchMedia('(max-width: 760px)').matches; } catch (e) { return false; } };
  const ehMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

  const IC = {
    mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    grav: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5h18M3 9.5l2.2-5 3 .9-1.9 4.1M9.6 9.5l2-4.4 3 .9-1.6 3.5M15.6 9.5l1.4-3.2 3 .9-1 2.3"/><rect x="3" y="9.5" width="18" height="11" rx="2"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z"/></svg>',
    linha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8.5 3v3M15.5 3v3M7.5 13.5h4M7.5 17h7"/></svg>',
    design: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 15.5l3-6.5 2.5 5L15 11l1.5 2.5"/><circle cx="8.3" cy="8.3" r="1.1"/></svg>',
    kanban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="11" rx="1.5"/><rect x="16" y="4" width="5" height="7" rx="1.5"/></svg>',
    semana: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8.5 3v3M15.5 3v3M7.5 13h3M13.5 13h3M7.5 16.5h3"/></svg>',
    cliente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M16 19v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V19"/><circle cx="9" cy="7" r="3.2"/><path d="M19 8v6M22 11h-6"/></svg>',
    olho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    perfil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/></svg>',
    config: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    usuarios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M16 19v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V19"/><circle cx="9" cy="7" r="3.2"/><path d="M22 19v-1.5a4 4 0 0 0-3-3.87M16 4.13a4 4 0 0 1 0 7.75"/></svg>',
    teclado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/></svg>',
    abertura: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z"/></svg>',
    sair: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/></svg>',
    sistema: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20h6M12 16.5V20"/></svg>',
    sol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>',
    lua: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/></svg>'
  };

  /* =================================================================
     CRIAR — resolvedor central de ações
     Cada ação existe UMA vez aqui, com:
       • pode(): a permissão real — a rota do módulo dono do fluxo
         (B7.Perm.podeRota já faz a união papel + função extra) e, quando
         a própria tela restringe o botão dela, a mesma regra;
       • fazer(): o fluxo canônico que já existe (nenhum fluxo novo).
     Como a lista é de AÇÕES e não de papéis, a união de funções nunca
     duplica: "Nova gravação" vale uma vez, venha do admin ou do
     coordenador. Sem sessão ou sem B7.Perm → lista vazia (falha segura).
     ================================================================= */
  const podeRota = r => !!(B7.Perm && B7.Perm.podeRota(r));
  const ehEquipe = () => !!(B7.Auth && B7.Auth.ehEquipe && B7.Auth.ehEquipe());

  /* Abre a tela dona do fluxo e aciona o MESMO botão que a pessoa
     clicaria nela — assim o modal nasce com os dados que a tela carrega
     (clientes, pacotes, competência…), sem uma segunda versão dele. */
  function naTelaClicar(hash, seletor) {
    const clicar = () => {
      const inicio = Date.now();
      (function tentar() {
        /* zzz48: só clica se a pessoa ainda estiver na tela que pediu.
           Antes a busca continuava por 8s mesmo depois de ela navegar
           para outro lugar — e se voltasse nesse intervalo, o modal
           abria sozinho, sem ninguém ter pedido. */
        if ((location.hash || '#/').split('?')[0] !== hash) return;
        const b = document.querySelector(seletor);
        if (b) return b.click();
        if (Date.now() - inicio < 8000) setTimeout(tentar, 120);
      })();
    };
    const atual = (location.hash || '#/').split('?')[0];
    if (atual === hash) clicar();
    else { location.hash = hash; clicar(); }
  }

  const ACOES = [
    { id: 'gravacao', rotulo: 'Nova gravação', dica: 'agenda e roteiros de um cliente', ic: IC.grav,
      contexto: ['gravacoes', 'gravacao', 'roteiros'],
      pode: () => podeRota('gravacoes'),
      fazer: () => B7.Dashboard.modalNovaGravacao() },
    { id: 'video', rotulo: 'Nova demanda de vídeo', dica: 'edição a partir de uma gravação', ic: IC.video,
      contexto: ['video'],
      pode: () => podeRota('video'),
      fazer: () => naTelaClicar('#/video', '#vd-nova') },
    { id: 'linha', rotulo: 'Nova linha editorial', dica: 'planejamento de um mês', ic: IC.linha,
      contexto: ['linhas', 'linha'],
      pode: () => podeRota('linhas') && !!(B7.Conteudo && B7.Conteudo.novaLinha) &&
        !(B7.Conteudo.souDesignerSomenteLeitura && B7.Conteudo.souDesignerSomenteLeitura()),
      fazer: () => B7.Conteudo.novaLinha() },
    /* a tela de Design só mostra "+ Nova demanda de Design" para a equipe */
    { id: 'design', rotulo: 'Nova demanda de Design', dica: 'peça avulsa fora da linha', ic: IC.design,
      contexto: ['design'],
      pode: () => podeRota('design') && ehEquipe(),
      fazer: () => naTelaClicar('#/design', '#ds-nova') },
    { id: 'kanban', rotulo: 'Nova demanda de produção', dica: 'no quadro de Produção', ic: IC.kanban,
      contexto: ['kanban'],
      pode: () => podeRota('kanban'),
      fazer: () => naTelaClicar('#/kanban', '#kb-nova') },
    { id: 'semana', rotulo: 'Novo status semanal', dica: 'acompanhamento de sete dias', ic: IC.semana,
      contexto: ['semanas', 'semana'],
      pode: () => podeRota('semanas') && !!(B7.Semana && B7.Semana.modalNovo),
      fazer: () => B7.Semana.modalNovo(null) },
    { id: 'cliente', rotulo: 'Novo cliente', dica: 'cadastrar um cliente', ic: IC.cliente, separar: true,
      contexto: ['clientes', 'cliente'],
      pode: () => podeRota('clientes'),
      fazer: () => B7.Dashboard.modalNovoCliente() }
  ];

  /* Telas que JÁ têm o próprio botão primário de criar no cabeçalho da
     página: ali o "Criar" do topo vira secundário (contorno), para a tela
     não ter dois botões magenta disputando o mesmo clique. */
  const TELAS_COM_PRIMARIO = ['gravacoes', 'video', 'linhas', 'design', 'clientes', 'semanas', 'kanban', 'calendario'];

  function rotaBase() {
    return String(location.hash || '#/').replace(/^#\//, '').split(/[/?]/)[0];
  }

  function acoesCriar() {
    if (!B7.Auth || !B7.Auth.usuario() || !B7.Perm) return [];
    if (B7.Auth.ehCliente && B7.Auth.ehCliente()) return [];
    let lista;
    try { lista = ACOES.filter(a => a.pode()); } catch (e) { return []; }
    /* contexto: a ação do módulo aberto sobe para o topo da lista */
    const base = rotaBase();
    const ctx = lista.find(a => a.contexto.includes(base));
    if (ctx) lista = [ctx].concat(lista.filter(a => a !== ctx));
    return lista.map(a => Object.assign({}, a, { daTela: a === ctx }));
  }
  function executar(id) {
    const a = acoesCriar().find(x => x.id === id);
    if (a) a.fazer();          /* só executa o que a pessoa pode */
  }

  /* =================================================================
     MENU SUSPENSO acessível (desktop) / FOLHA (celular)
     role=menu, setas ↑↓, Home/End, Esc fecha e devolve o foco ao botão.
     ================================================================= */
  let aberto = null;   /* { gatilho, caixa } */
  function fecharMenu(devolverFoco) {
    if (!aberto) return;
    const { gatilho, caixa } = aberto;
    aberto = null;
    caixa.remove();
    gatilho.setAttribute('aria-expanded', 'false');
    if (devolverFoco) gatilho.focus();
  }
  function abrirMenu(gatilho, html, ligar, opts) {
    const reabrir = aberto && aberto.gatilho === gatilho;
    fecharMenu(false);
    if (reabrir) return;
    if (B7.UI.fecharMenus) B7.UI.fecharMenus();
    /* zzz58: o clique no gatilho não borbulha, então o sino não se fechava sozinho */
    if (B7.Notif && B7.Notif.fechar) B7.Notif.fechar();
    const caixa = document.createElement('div');
    caixa.className = 'tp-menu ' + (opts.classe || '');
    caixa.setAttribute('role', 'menu');
    caixa.setAttribute('aria-label', opts.rotulo || '');
    caixa.innerHTML = html;
    document.body.appendChild(caixa);
    const r = gatilho.getBoundingClientRect();
    const larg = caixa.offsetWidth;
    caixa.style.top = Math.round(r.bottom + 8) + 'px';
    caixa.style.left = Math.round(Math.max(10, Math.min(window.innerWidth - larg - 10, r.right - larg))) + 'px';
    caixa.style.maxHeight = Math.max(200, window.innerHeight - r.bottom - 24) + 'px';
    gatilho.setAttribute('aria-expanded', 'true');
    aberto = { gatilho, caixa };
    const itens = () => [...caixa.querySelectorAll('[role="menuitem"],[role="menuitemradio"]')];
    caixa.addEventListener('keydown', e => {
      const l = itens(), i = l.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (i < 0 ? l[0] : (l[i + 1] || l[0])).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (l[i - 1] || l[l.length - 1]).focus(); }
      else if (e.key === 'Home') { e.preventDefault(); l[0] && l[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); l[l.length - 1] && l[l.length - 1].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); fecharMenu(true); }
      else if (e.key === 'Tab') fecharMenu(false);
    });
    ligar(caixa, () => fecharMenu(false));
    /* aberto pelo teclado: foco no 1º item; pelo mouse/toque: foco na
       caixa (as setas continuam funcionando, sem anel de foco à toa) */
    caixa.tabIndex = -1;
    requestAnimationFrame(() => {
      caixa.classList.add('mostrando');
      const p = itens()[0];
      if (opts.teclado && p) p.focus(); else caixa.focus({ preventScroll: true });
    });
  }
  document.addEventListener('click', e => {
    if (aberto && !aberto.caixa.contains(e.target) && !aberto.gatilho.contains(e.target)) fecharMenu(false);
  });
  window.addEventListener('resize', () => fecharMenu(false));
  window.addEventListener('hashchange', () => fecharMenu(false));
  /* o título de contexto (celular) e o Criar acompanham a rota mesmo em
     telas que não chamam marcarNav */
  window.addEventListener('hashchange', () => setTimeout(() => { if (document.getElementById('topo-ctx')) contexto(); }, 0));

  /* zzz13: título grande × título do topo (celular). Enquanto o título
     grande da página está à vista, o nome no topo some — antes aparecia
     "Configurações" duas vezes. Ao rolar e o título grande passar por
     baixo do topo, o nome sobe no topo (como os apps do iPhone). */
  (function tituloGrande() {
    let io = null, atual = null;
    const marcar = v => document.body.classList.toggle('titulo-na-pagina', v);
    function procurar() {
      const pn = document.getElementById('painel-dashboard');
      const h = pn && pn.querySelector('.conteudo h1');
      if (h === atual) return;
      atual = h;
      if (io) { io.disconnect(); io = null; }
      if (!h || !('IntersectionObserver' in window)) return marcar(false);
      const topo = document.querySelector('.tela.ativa .topo');
      const alto = topo ? Math.round(topo.getBoundingClientRect().bottom) : 64;
      io = new IntersectionObserver(es => marcar(es[es.length - 1].isIntersecting),
        { rootMargin: '-' + alto + 'px 0px 0px 0px', threshold: 0 });
      io.observe(h);
    }
    let agendado = 0;
    const agendar = () => { if (!agendado) agendado = requestAnimationFrame(() => { agendado = 0; procurar(); }); };
    const ligarObs = () => {
      const pn = document.getElementById('painel-dashboard');
      if (!pn) return setTimeout(ligarObs, 400);
      new MutationObserver(agendar).observe(pn, { childList: true, subtree: true });
      agendar();
    };
    ligarObs();
    window.addEventListener('hashchange', agendar);
  })();

  /* Folha no celular: o B7.UI.modal já vira bottom sheet ≤520px, prende o
     foco, fecha no Esc/fora e devolve o foco ao gatilho. */
  function abrirFolha(titulo, html, ligar, aoFechar) {
    const m = B7.UI.modal('<div class="tp-folha-cab"><h3>' + esc(titulo) + '</h3>' +
      '<button type="button" class="ico" data-fecha aria-label="Fechar">' +
      '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="tp-folha-corpo" role="menu" aria-label="' + esc(titulo) + '">' + html + '</div>', { classe: 'tp-folha', aoFechar });
    ligar(m, () => m.fechar());
    const caixa = m.querySelector('.modal');
    if (caixa) { caixa.tabIndex = -1; caixa.setAttribute('aria-label', titulo); caixa.focus({ preventScroll: true }); }
    return m;
  }

  /* ------------------------------------------------------------ Criar */
  function itemAcao(a) {
    return (a.separar ? '<hr>' : '') +
      '<button type="button" class="tp-item" role="menuitem" data-criar="' + a.id + '">' +
        '<span class="tp-item-ic">' + a.ic + '</span>' +
        '<span class="tp-item-tx"><b>' + esc(a.rotulo) + '</b><small>' + esc(a.daTela ? 'nesta tela · ' + a.dica : a.dica) + '</small></span>' +
      '</button>';
  }
  function ligarAcoes(raiz, fechar) {
    raiz.querySelectorAll('[data-criar]').forEach(b => b.onclick = () => { const id = b.dataset.criar; fechar(); executar(id); });
  }
  function abrirCriar(gatilho, teclado) {
    const lista = acoesCriar();
    if (!lista.length) return;
    const html = lista.map(itemAcao).join('');
    /* zzj: o "+" gira até virar "×" enquanto as opções estão abertas, e
       elas entram em leque (uma depois da outra, --i lido pelo CSS) */
    const leque = raiz => raiz && raiz.querySelectorAll('.tp-item').forEach((b, i) => b.style.setProperty('--i', i));
    if (ehCelular()) {
      gatilho.classList.add('girou');
      const m = abrirFolha('Criar', html, ligarAcoes, () => gatilho.classList.remove('girou'));
      leque(m);
      return m;
    }
    abrirMenu(gatilho, html, ligarAcoes, { classe: 'tp-menu-criar', rotulo: 'Criar', teclado });
    leque(aberto && aberto.caixa);
  }

  function renderCriar() {
    const slot = document.getElementById('topo-criar');
    if (!slot) return;
    const lista = acoesCriar();
    /* zero ações: nada de botão vazio */
    if (!lista.length) { slot.innerHTML = ''; slot.hidden = true; return; }
    slot.hidden = false;
    const secundario = TELAS_COM_PRIMARIO.includes(rotaBase());
    /* zzz26: no celular, tela que já tem o "+" dela não mostra o do
       topo — eram dois "+" lado a lado fazendo quase a mesma coisa */
    slot.classList.toggle('tp-criar-dup', secundario);
    const cls = 'b ' + (secundario ? 'contorno' : 'pri') + ' tp-criar';
    /* uma ação só: o botão já é ela, sem menu de um item */
    if (lista.length === 1) {
      const a = lista[0];
      slot.innerHTML = '<button type="button" class="' + cls + '" id="tp-criar" data-criar="' + a.id + '" aria-label="' + esc(a.rotulo) + '">' +
        IC.mais + '<span class="txt">' + esc(a.rotulo) + '</span></button>';
      slot.querySelector('#tp-criar').onclick = () => executar(a.id);
      return;
    }
    slot.innerHTML = '<button type="button" class="' + cls + '" id="tp-criar" aria-haspopup="menu" aria-expanded="false" aria-label="Criar">' +
      IC.mais + '<span class="txt">Criar</span><span class="tp-caret">' + IC.seta + '</span></button>';
    slot.querySelector('#tp-criar').onclick = e => { e.stopPropagation(); abrirCriar(e.currentTarget, e.detail === 0); };
  }

  /* ------------------------------------------------------------ Busca
     Uma busca só: o gatilho do topo abre a MESMA paleta do Ctrl K
     (B7.UI.paleta), que busca no banco (RLS) e só oferece destinos que
     a pessoa pode abrir. Digitar com o gatilho focado já começa a busca. */
  function abrirBusca(textoInicial) {
    if (B7.UI.paleta) B7.UI.paleta(textoInicial || '');
  }
  function ligarBusca() {
    const g = document.getElementById('busca-gatilho');
    if (!g || g.dataset.ligado) return;
    g.dataset.ligado = '1';
    const kbd = g.querySelector('kbd');
    if (kbd) kbd.textContent = ehMac ? '⌘ K' : 'Ctrl K';
    g.setAttribute('aria-keyshortcuts', ehMac ? 'Meta+K' : 'Control+K');
    g.onclick = () => abrirBusca('');
    g.addEventListener('keydown', e => {
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') { e.preventDefault(); abrirBusca(e.key); }
    });
  }

  /* --------------------------------------------------------- Contexto
     No celular o meio do topo diz onde a pessoa está (o item ativo da
     barra lateral); no desktop a própria barra lateral já diz. */
  function contexto() {
    /* a marca do topo (celular) leva à casa real da pessoa */
    const marca = document.querySelector('.topo-marca');
    if (marca) marca.dataset.ir = (B7.Perm && B7.Perm.painelElegivel && B7.Perm.painelElegivel()) ? '#/painel' : '#/';
    const el = document.getElementById('topo-ctx');
    if (!el) return;
    const on = document.querySelector('.nav a.on span');
    const id = B7.Nav && B7.Nav.itemDaRota();
    el.textContent = (id && B7.Nav.ITENS[id] ? B7.Nav.rotuloDe(id) : '') || (on && on.textContent.trim()) || 'Branding7';
    renderCriar();   /* o contexto também muda a ordem/estilo do Criar */
  }

  /* ------------------------------------------------------------ Conta */
  const ROTULO_PAPEL = { admin: 'Administrador', coordenador: 'Coordenador de mídias', designer: 'Designer',
                         videomaker: 'Videomaker', cliente: 'Cliente' };
  /* As funções REAIS da conta logada (não as da prévia "Visualizar
     como…", em que o admin continua sendo ele mesmo). */
  function funcoesDoUsuario(u) {
    u = u || (B7.Auth && B7.Auth.usuario());
    if (!u) return '';
    const p = u.papel;
    const extras = (Array.isArray(u.funcoes_extra) ? u.funcoes_extra : []).filter(f => f !== p);
    /* coordenação como função extra só vale para admin (B7.Perm) */
    const validos = extras.filter(f => f !== 'coordenador' || p === 'admin');
    return [p].concat(validos).map(x => ROTULO_PAPEL[x] || x).join(' · ');
  }
  function modoTema() {
    let salvo = null; try { salvo = localStorage.getItem('b7_tema'); } catch (e) {}
    return salvo === 'dark' || salvo === 'light' ? salvo : 'sistema';
  }

  /* zzz6: "Sua conta" redesenhada — cabeçalho com a pessoa em destaque
     (anel de luz no avatar, funções em pílulas), itens com ícone colorido
     e uma linha do que fazem, tema com pílula que desliza, chave de
     animações e entrada em cascata (--i lido por styles/topo.css). */
  const SETA_TC = '<svg class="tc-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  function htmlConta(u) {
    const tom = ' tom-' + B7.UI.tomDoNome(u.nome || u.username);
    const foto = u.avatar_url ? '<img src="' + esc(u.avatar_url) + '" alt="">'
      : '<span>' + esc(B7.UI.iniciais(u.nome || u.username)) + '</span>';
    let i = 0;
    const item = (attr, ic, cor, tx, sub, extra) => '<button type="button" class="tp-item tc-item' + (extra || '') + '" role="menuitem" ' + attr +
      ' style="--i:' + (i++) + '">' +
      '<span class="tc-ic tc-' + cor + '">' + ic + '</span>' +
      '<span class="tc-tx"><b>' + esc(tx) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' + SETA_TC + '</button>';
    const m = modoTema();
    const tema = (v, ic, tx) => '<button type="button" role="menuitemradio" aria-checked="' + (m === v) + '" class="tp-tema' +
      (m === v ? ' on' : '') + '" data-tema-modo="' + v + '">' + ic + '<span>' + tx + '</span></button>';
    const cliente = B7.Auth.ehCliente && B7.Auth.ehCliente();
    const naContaDeOutro = !!(B7.Auth.naContaDeOutro && B7.Auth.naContaDeOutro());
    const papeis = funcoesDoUsuario(u).split(' · ').filter(Boolean);
    const animOn = !(B7.Desempenho && B7.Desempenho.animacoesLigadas) || B7.Desempenho.animacoesLigadas();
    return '<div class="tc">' +
      '<div class="tc-cab">' +
        '<i class="tc-luz" aria-hidden="true"></i>' +
        '<span class="tc-av"><span class="tp-conta-av av-pessoa' + (u.avatar_url ? ' com-foto' : tom) + '">' + foto + '</span></span>' +
        '<span class="tc-id"><b>' + esc(u.nome || u.username) + '</b>' +
          '<small>@' + esc(u.username || '') + '</small>' +
          '<span class="tc-papeis">' + papeis.map(x => '<i>' + esc(x) + '</i>').join('') + '</span></span>' +
      '</div>' +
      '<div class="tc-lista">' +
        item('data-conta="perfil"', IC.perfil, 'violeta', 'Meu perfil', 'foto, nome, senha e notificações') +
        (!cliente && B7.Perm && B7.Perm.podeRota('config') ? item('data-conta="config"', IC.config, 'azul', 'Preferências e configurações', 'tema, desempenho, abertura e sistema') : '') +
        (B7.Perm && B7.Perm.podeConfig('usuarios') && !cliente ? item('data-conta="usuarios"', IC.usuarios, 'verde', 'Usuários e acessos', 'contas da equipe e dos clientes') : '') +
        (!cliente ? item('data-conta="atalhos"', IC.teclado, 'cinza', 'Atalhos de teclado', 'a lista completa', ' tp-so-desktop') : '') +
        (B7.Auth.ehAdminReal && B7.Auth.ehAdminReal() && B7.PreviaUsuario && B7.PreviaUsuario.abrirSeletor && !naContaDeOutro
          ? item('data-conta="vercomo"', IC.olho, 'laranja', 'Visualizar como…', 'ver o sistema com o acesso de outra pessoa') : '') +
        (B7.reverAbertura ? item('data-conta="abertura"', IC.abertura, 'rosa', 'Ver abertura', 'assistir de novo, com som') : '') +
      '</div>' +
      '<div class="tp-secao tc-secao" role="group" aria-label="Aparência" style="--i:' + (i++) + '"><span class="tp-secao-rot">Aparência</span>' +
        '<div class="tp-temas tc-temas"><i class="tc-pilula" aria-hidden="true"></i>' +
          tema('sistema', IC.sistema, 'Sistema') + tema('light', IC.sol, 'Claro') + tema('dark', IC.lua, 'Escuro') + '</div>' +
        (B7.Desempenho && B7.Desempenho.definirAnimacoes
          ? '<button type="button" class="tc-anim" role="menuitemcheckbox" aria-checked="' + animOn + '" data-conta-anim>' +
              '<span class="tc-tx"><b>Animações</b><small>' + (animOn ? 'ligadas' : 'desligadas: tudo aparece na hora') + '</small></span>' +
              '<span class="tc-sw' + (animOn ? ' on' : '') + '" aria-hidden="true"><i></i></span></button>' : '') +
      '</div>' +
      /* dentro da conta de outra pessoa, sair é voltar para a própria
         (B7.Auth.sair já faz isso) — o rótulo diz o que vai acontecer */
      '<div class="tc-fim" style="--i:' + (i++) + '">' +
        item('data-conta="sair"', IC.sair, 'vermelho', naContaDeOutro ? 'Voltar para minha conta' : 'Sair da conta',
          naContaDeOutro ? 'sai da conta de ' + (u.nome || u.username) : 'encerra a sessão só neste aparelho', ' perigo') +
      '</div>' +
    '</div>';
  }
  function ligarConta(raiz, fechar) {
    const acao = {
      perfil: () => (B7.Perfil ? B7.Perfil.abrir() : B7.Auth.abrirPerfil()),
      config: () => { location.hash = '#/config'; },
      usuarios: () => { location.hash = '#/usuarios'; },
      atalhos: () => B7.UI.atalhos(),
      vercomo: () => B7.PreviaUsuario.abrirSeletor(),
      abertura: () => B7.reverAbertura(),
      sair: () => B7.Auth.sair()
    };
    raiz.querySelectorAll('[data-conta]').forEach(b => b.onclick = () => { const k = b.dataset.conta; fechar(); acao[k] && acao[k](); });
    /* pílula do tema: desliza até a opção escolhida */
    const caixa = raiz.querySelector('.tc-temas'), pil = caixa && caixa.querySelector('.tc-pilula');
    const moverPilula = anima => {
      const on = caixa && caixa.querySelector('.tp-tema.on');
      if (!on || !pil) return;
      if (!anima) pil.style.transition = 'none';
      pil.style.width = on.offsetWidth + 'px';
      pil.style.transform = 'translate3d(' + on.offsetLeft + 'px,0,0)';
      pil.style.opacity = '1';
      if (!anima) { pil.offsetWidth; pil.style.transition = ''; }
    };
    requestAnimationFrame(() => moverPilula(false));
    raiz.querySelectorAll('[data-tema-modo]').forEach(b => b.onclick = () => {
      if (B7.definirTema) B7.definirTema(b.dataset.temaModo);
      raiz.querySelectorAll('[data-tema-modo]').forEach(x => {
        const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on));
      });
      moverPilula(true);
    });
    const an = raiz.querySelector('[data-conta-anim]');
    if (an) an.onclick = () => {
      const v = an.getAttribute('aria-checked') !== 'true';
      B7.Desempenho.definirAnimacoes(v);
      an.setAttribute('aria-checked', String(v));
      an.querySelector('.tc-sw').classList.toggle('on', v);
      an.querySelector('small').textContent = v ? 'ligadas' : 'desligadas: tudo aparece na hora';
    };
  }

  function pintarConta() {
    const areas = document.querySelectorAll('.topo .area-sessao');
    if (!B7.Auth) return;
    const u = B7.Auth.usuario();
    areas.forEach(alvo => {
      if (!u) {
        if (B7.acessoIndisponivel) {
          alvo.innerHTML = '<button class="b p" data-entrar>Entrar</button>';
          alvo.querySelector('[data-entrar]').onclick = () => B7.Auth.telaLogin();
        } else alvo.innerHTML = '';
        return;
      }
      const tom = ' tom-' + B7.UI.tomDoNome(u.nome || u.username);
      const foto = u.avatar_url ? '<img src="' + esc(u.avatar_url) + '" alt="">'
        : '<span>' + esc(B7.UI.iniciais(u.nome || u.username)) + '</span>';
      alvo.innerHTML = '<button type="button" class="ico-sessao tp-conta av-pessoa' + (u.avatar_url ? ' com-foto' : tom) + '" ' +
        'aria-haspopup="menu" aria-expanded="false" aria-label="Sua conta: ' + esc(u.nome || u.username) + '" title="' + esc(u.nome || '') + '">' +
        foto + '</button>';
      const bt = alvo.querySelector('.tp-conta');
      bt.onclick = e => {
        e.stopPropagation();
        const html = htmlConta(B7.Auth.usuario() || u);
        if (ehCelular()) return abrirFolha('Sua conta', html, ligarConta);
        abrirMenu(bt, html, ligarConta, { classe: 'tp-menu-conta', rotulo: 'Sua conta', teclado: e.detail === 0 });
      };
    });
  }

  /* ------------------------------------------------------------ montar */
  function render() {
    ligarBusca();
    renderCriar();
    contexto();
  }

  return { fecharMenu, render, renderCriar, contexto, pintarConta, acoesCriar, executar, abrirBusca, funcoesDoUsuario, ACOES };
})();
