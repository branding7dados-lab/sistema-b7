/* =====================================================================
   DASHBOARD — Central de Produção
   Estrutura do sistema: CLIENTE → GRAVAÇÕES → ROTEIROS → CENAS.
   Uma gravação é um grupo de roteiros de um cliente. A data é apenas
   metadado opcional: quando não existe, nada aparece no lugar dela.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Dashboard = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');

  /* ícones lineares, todos com a mesma espessura — nada de emoji na interface */
  const traco = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const IC = {
    clientes:  '<svg viewBox="0 0 24 24" ' + traco + '><path d="M16 19v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V19"/><circle cx="9" cy="7" r="3.2"/><path d="M22 19v-1.5a4 4 0 0 0-3-3.87"/></svg>',
    gravacoes: '<svg viewBox="0 0 24 24" ' + traco + '><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z"/></svg>',
    roteiros:  '<svg viewBox="0 0 24 24" ' + traco + '><path d="M5 3.5h9l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 20V5a1.5 1.5 0 0 1 1-1.5z"/><path d="M14 3.5V9h5"/><path d="M8.5 13.5h7M8.5 17h4.5"/></svg>',
    andamento: '<svg viewBox="0 0 24 24" ' + traco + '><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>',
    mais:      '<svg viewBox="0 0 24 24" ' + traco + '><path d="M12 5v14M5 12h14"/></svg>',
    pessoa:    '<svg viewBox="0 0 24 24" ' + traco + '><circle cx="12" cy="8" r="3.4"/><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/></svg>',
    play:      '<svg viewBox="0 0 24 24" ' + traco + '><circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z"/></svg>',
    imprimir:  '<svg viewBox="0 0 24 24" ' + traco + '><path d="M6 9V4h12v5M6 18H4v-6h16v6h-2M8 14h8v6H8z"/></svg>'
  };

  let ultimaGravacao = null;    // alimenta as ações rápidas

  /* ---------------------------------------------------- capa da gravação
     Montada em CSS a partir dos dados reais — nenhuma imagem gerada. */
  function capa(g, grande) {
    const selo = g.cliente_logo_url
      ? '<div class="selo"><img src="' + esc(g.cliente_logo_url) + '" alt=""></div>'
      : '<div class="selo">' + esc(B7.UI.iniciais(g.cliente_nome)) + '</div>';
    return '<div class="capa' + (grande ? ' grande' : '') + '">' +
      '<div class="malha"></div><div class="marca"></div>' + selo +
      '<div class="tit"><small>' + esc(g.cliente_nome) + '</small><b>' + esc(g.nome) + '</b></div>' +
    '</div>';
  }

  /* =================================================================
     PRÉVIA DOS ROTEIROS NO HOVER
     Um único cartão para o sistema inteiro, reutilizado a cada card. Os
     eventos são delegados no painel e ligados UMA vez: a versão anterior
     criava um cartão por card e somava um listener de scroll por card a
     cada render — depois de algumas telas o cartão ficava preso aberto.
     Fecha ao sair do card, ao rolar, ao trocar de rota e no ESC. Nunca
     fica sob o cursor: vai para fora do retângulo do card, com folga.
     ================================================================= */
  const cachePrevia = {};
  const Previa = (function () {
    const SELETOR = '.card-gravacao[data-gravacao], .destaque-grav[data-gravacao], .card-roteiro[data-gravacao], .gl-item[data-gravacao]';
    let caixa = null, timer = null, cardAtual = null, ligado = false, pedido = 0;

    function elemento() {
      if (caixa && document.body.contains(caixa)) return caixa;
      caixa = document.createElement('div');
      caixa.className = 'previa-roteiros';
      caixa.setAttribute('aria-hidden', 'true');
      document.body.appendChild(caixa);
      return caixa;
    }

    function fechar() {
      clearTimeout(timer); timer = null;
      pedido++;                     /* invalida qualquer carga em andamento */
      cardAtual = null;
      if (caixa) caixa.classList.remove('aberta');
    }

    function posicionar(card) {
      const r = card.getBoundingClientRect();
      const larg = caixa.offsetWidth, alt = caixa.offsetHeight, M = 12, F = 10;
      let left = r.left + r.width / 2 - larg / 2;
      left = Math.max(M, Math.min(left, window.innerWidth - larg - M));
      /* acima do card por padrão; abaixo quando não couber; se nenhum dos
         dois couber (card mais alto que a janela) vai para o lado, sempre
         fora do retângulo do card — o cursor está dentro dele */
      let top;
      if (r.top - alt - F >= M) { top = r.top - alt - F; caixa.classList.remove('abaixo'); }
      else if (r.bottom + F + alt <= window.innerHeight - M) { top = r.bottom + F; caixa.classList.add('abaixo'); }
      else {
        top = Math.max(M, Math.min(r.top, window.innerHeight - alt - M));
        left = r.right + F + larg <= window.innerWidth - M ? r.right + F : Math.max(M, r.left - larg - F);
        caixa.classList.add('abaixo');
      }
      caixa.style.left = left + 'px';
      caixa.style.top = top + 'px';
    }

    async function abrir(card) {
      const id = card.dataset.gravacao;
      const meu = ++pedido;
      if (!cachePrevia[id]) {
        try { cachePrevia[id] = await B7.DB.previaRoteiros(id, 3); } catch (e) { return; }
      }
      if (meu !== pedido || cardAtual !== card || !document.body.contains(card)) return;
      const roteiros = cachePrevia[id];
      if (!roteiros.length) return;
      const total = +(card.dataset.totalRoteiros || roteiros.length);
      const el = elemento();
      el.innerHTML = '<div class="rot">ROTEIROS</div>' + roteiros.map((r, i) =>
        '<div class="it' + (card.dataset.roteiro === r.id ? ' atual' : '') + '"><b>' +
        String((r.position || i) + 1).padStart(2, '0') + '</b>' +
        '<span>' + esc(r.titulo || 'Sem título') + '</span></div>').join('') +
        (total > roteiros.length ? '<div class="mais">+' + (total - roteiros.length) + ' roteiros</div>' : '');
      posicionar(card);
      requestAnimationFrame(() => { if (cardAtual === card) el.classList.add('aberta'); });
    }

    function aoEntrar(e) {
      const card = e.target.closest(SELETOR);
      if (!card || card === cardAtual) return;
      fechar();
      cardAtual = card;
      timer = setTimeout(() => abrir(card), 380);
    }
    function aoSair(e) {
      if (!cardAtual) return;
      const para = e.relatedTarget;
      if (para && cardAtual.contains(para)) return;    /* ainda dentro do card */
      fechar();
    }

    /* ligado uma vez por sessão: delegação no painel, nada por card */
    function ligar() {
      if (ligado || window.matchMedia('(pointer: coarse)').matches) return;
      ligado = true;
      const p = painel();
      p.addEventListener('mouseover', aoEntrar);
      p.addEventListener('mouseout', aoSair);
      p.addEventListener('scroll', fechar, { passive: true });
      window.addEventListener('scroll', fechar, { passive: true, capture: true });
      window.addEventListener('resize', fechar);
      document.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); });
      window.addEventListener('hashchange', fechar);
    }
    return { ligar, fechar };
  })();
  function ligarPrevia() {
    Previa.ligar();
    Previa.fechar();
    if (B7.Rota && B7.Rota.aoSair) B7.Rota.aoSair(Previa.fechar);
  }

  /* spotlight: o brilho acompanha o cursor apenas nos cards principais */
  function ligarSpotlight(raiz) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    /* uma medida por entrada do mouse e uma escrita por quadro: o mouse
       dispara mais eventos do que a tela desenha, e medir o card a cada
       um deles (depois de escrever a posição anterior) forçava layout */
    raiz.querySelectorAll('.spot').forEach(el => {
      let r = null, x = 0, y = 0, quadro = 0;
      el.onmouseenter = () => { r = el.getBoundingClientRect(); };
      el.onmousemove = e => {
        if (!r) r = el.getBoundingClientRect();
        x = e.clientX - r.left; y = e.clientY - r.top;
        if (quadro) return;
        quadro = requestAnimationFrame(() => {
          quadro = 0;
          el.style.setProperty('--mx', x + 'px');
          el.style.setProperty('--my', y + 'px');
        });
      };
      el.onmouseleave = () => { r = null; };
    });
  }


  /* ------------------------------------------------------- esqueleto */
  /* Troca de rota: a silhueta da tela seguinte, nunca a abertura nem um
     spinner de tela cheia. `tipo` segue B7.UI.skeleton. */
  function esqueleto(tipo, opcoes) {
    painel().innerHTML = '<div class="conteudo">' +
      B7.UI.skeleton(tipo === 'lista' ? 'cards' : (tipo || 'central'), opcoes) + '</div>';
  }

  function erro(e, acao) {
    console.error(e);
    painel().innerHTML = '<div class="conteudo entra">' + estadoB7(IC.gravacoes,
      'Não foi possível carregar esta área.',
      navigator.onLine ? 'O banco não respondeu. Confira a conexão e tente de novo.'
                       : 'Você está sem conexão no momento.',
      '<button class="b pri" onclick="B7.Dashboard.' + (acao || 'abrir') + '()">Tentar novamente</button>' +
      '<button class="b contorno" onclick="location.hash=\'#/\'">Voltar para a Central B7</button>') + '</div>';
  }

  /* ===================================================== DASHBOARD */
  async function abrir() {
    marcarNav('#/');
    B7.Rota.titulo();
    esqueleto();
    let resumo, recentes, clientes, fixados, atividades;
    try {
      [resumo, recentes, clientes, fixados, atividades] = await Promise.all([
        B7.DB.resumo(), B7.DB.gravacoesRecentes(7), B7.DB.listarClientes(),
        B7.DB.fixados().catch(() => ({ gravacoes: [], clientes: [] })),
        B7.DB.atividades(8).catch(() => [])
      ]);
    } catch (e) { return erro(e); }

    ultimaGravacao = recentes[0] || null;
    const destaque = recentes[0];
    const outras = recentes.slice(1, 7);
    const topClientes = ordenarClientes(clientes).slice(0, 5);

    painel().innerHTML = '<div class="conteudo entra">' + hero() + metricas(resumo) +
      '<div class="colunas"><div>' +

        '<div class="secao"><div class="secao-topo"><h2>Continue de onde parou</h2>' +
          '<div class="espaco"></div>' +
          (recentes.length ? '<button class="b fina contorno" data-ir="#/gravacoes">Ver todas</button>' : '') +
        '</div>' +
        (destaque ? cardDestaque(destaque) : vazioGravacoes()) + '</div>' +

        /* fixados só aparecem quando existe algo fixado */
        ((fixados.gravacoes.length || fixados.clientes.length) ?
          '<div class="secao"><div class="secao-topo"><h2>Fixados</h2>' +
            '<span class="conta">' + (fixados.gravacoes.length + fixados.clientes.length) + '</span></div>' +
            (fixados.gravacoes.length ? '<div class="grade">' + fixados.gravacoes.map(cardGravacao).join('') + '</div>' : '') +
            (fixados.clientes.length ? '<div class="grade-clientes" style="margin-top:12px">' +
              fixados.clientes.map(cardCliente).join('') + '</div>' : '') +
          '</div>' : '') +

        (outras.length ? '<div class="secao"><div class="secao-topo"><h2>Gravações recentes</h2>' +
          '<span class="conta">' + outras.length + '</span></div>' +
          '<div class="grade">' + outras.map(cardGravacao).join('') + '</div></div>' : '') +

        '<div class="secao"><div class="secao-topo"><h2>Clientes recentes</h2>' +
          '<span class="conta">' + clientes.length + '</span><div class="espaco"></div>' +
          (clientes.length ? '<button class="b fina contorno" data-ir="#/clientes">Ver todos os clientes</button>' : '') +
        '</div>' +
        (topClientes.length ? '<div class="grade-clientes">' + topClientes.map(cardCliente).join('') + '</div>'
                            : vazioClientes()) +
        '</div>' +

      '</div><div class="apoio">' + acoesRapidas(destaque) +
        '<div class="bloco"><h3>Atividade recente</h3>' + timeline(atividades) + '</div>' +
        institucional() + '</div></div></div>';

    ligar();
  }

  function hero() {
    return '<div class="hero spot">' +
      '<div class="malha"></div><div class="brilho"></div>' +
      '<img class="simbolo" src="assets/brand/symbol-color.png" alt="">' +
      '<div class="miolo">' +
        '<div class="olho"><i></i>PRODUÇÃO B7</div>' +
        '<h1>Central de Produção</h1>' +
        '<p>Da ideia ao take: clientes, gravações e roteiros em um só lugar.</p>' +
        '<div class="acoes">' +
          '<button class="b pri" data-nova-gravacao>' + IC.mais + 'Nova gravação</button>' +
          '<button class="b clara" data-ir="#/gravacoes">Ver gravações</button>' +
        '</div>' +
      '</div></div>';
  }

  function metricas(r) {
    const cx = (ic, valor, rot, sub, destaque) =>
      '<div class="metrica' + (destaque ? ' destaque' : '') + '"><div class="ic">' + ic + '</div>' +
      '<b>' + valor + '</b><div class="rot">' + rot + '</div>' +
      (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>';
    return '<div class="metricas">' +
      cx(IC.clientes, r.clientes, 'CLIENTES',
         r.clientes === 1 ? '1 cliente cadastrado' : r.clientes + ' clientes cadastrados') +
      cx(IC.gravacoes, r.gravacoes, 'GRAVAÇÕES',
         r.gravado + ' já gravada' + (r.gravado === 1 ? '' : 's')) +
      cx(IC.roteiros, r.roteiros, 'ROTEIROS',
         r.mes + ' criado' + (r.mes === 1 ? '' : 's') + ' neste mês') +
      cx(IC.andamento, r.andamento, 'EM ANDAMENTO',
         r.pronto + ' pronta' + (r.pronto === 1 ? '' : 's') + ' · ' +
         r.rascunho + ' rascunho' + (r.rascunho === 1 ? '' : 's'), true) +
      '</div>';
  }

  /* Gravações 2.0: o card diz o mês de produção, a data (física) e
     quanto da lista já foi gravado — não mais só "N roteiros" */
  const metaGravacao = g => {
    const mes = B7.Gravacao && g.competencia_ano ? B7.Gravacao.mesRef(g.competencia_ano, g.competencia_mes) : '';
    const itens = g.total_itens != null ? +g.total_itens : +g.total_roteiros;
    return (mes ? '<span class="gv-card-mes">' + esc(mes) + '</span><span class="p"></span>' : '') +
      (g.data_gravacao ? '<span>' + B7.UI.dataBR(g.data_gravacao) + '</span><span class="p"></span>' : '') +
      '<span>' + (g.total_itens != null && itens ? (+g.itens_gravados) + '/' + itens + ' gravados'
                                               : itens + ' ite' + (itens === 1 ? 'm' : 'ns')) + '</span>';
  };
  const chipGravacao = g => (B7.Gravacao ? B7.Gravacao.chipSituacao(g.situacao) : B7.UI.chipStatus(g.status));

  function cardDestaque(g) {
    return '<div class="destaque-grav spot b7-glow" data-gravacao="' + esc(g.id) + '" ' +
      'data-total-roteiros="' + g.total_roteiros + '">' +
      capa(g, true) +
      '<div class="info"><div class="cli">' + esc(g.cliente_nome) + '</div>' +
        '<h3>' + esc(g.nome) + '</h3>' +
        '<div class="meta">' + metaGravacao(g) + '</div></div>' +
      '<div class="lado">' + chipGravacao(g) +
        '<button class="b pri">' + IC.play + 'Abrir gravação</button>' +
        '<div class="menu"><button class="ico" onclick="event.stopPropagation()">⋯</button>' +
          '<div class="lista"><button data-dup="' + esc(g.id) + '">Duplicar gravação</button>' +
          '<button data-imprimir="' + esc(g.id) + '">Imprimir</button>' +
          '<button data-fixar-grav="' + esc(g.id) + '" data-fixado="' + (g.is_pinned ? '1' : '0') + '">' +
            (g.is_pinned ? 'Desafixar' : 'Fixar') + '</button>' +
          '<button data-arquivar="' + esc(g.id) + '" data-arq="' + (g.archived_at ? '1' : '0') + '">' +
            (g.archived_at ? 'Desarquivar' : 'Arquivar') + '</button><hr>' +
          '<button class="perigo" data-excluir="' + esc(g.id) + '" data-nome="' + esc(g.nome) + '">Excluir gravação</button>' +
          '</div></div>' +
      '</div></div>';
  }

  function cardGravacao(g) {
    return '<div class="card-gravacao spot eleva" data-gravacao="' + esc(g.id) + '" ' +
      'data-total-roteiros="' + g.total_roteiros + '">' +
      capa(g) +
      '<div class="meta">' + metaGravacao(g) + '</div>' +
      '<div class="rodape">' + chipGravacao(g) +
        '<div class="menu"><button class="ico" onclick="event.stopPropagation()">⋯</button>' +
          '<div class="lista"><button data-dup="' + esc(g.id) + '">Duplicar</button>' +
          '<button data-imprimir="' + esc(g.id) + '">Imprimir</button>' +
          '<button data-fixar-grav="' + esc(g.id) + '" data-fixado="' + (g.is_pinned ? '1' : '0') + '">' +
            (g.is_pinned ? 'Desafixar' : 'Fixar') + '</button>' +
          '<button data-arquivar="' + esc(g.id) + '" data-arq="' + (g.archived_at ? '1' : '0') + '">' +
            (g.archived_at ? 'Desarquivar' : 'Arquivar') + '</button><hr>' +
          '<button class="perigo" data-excluir="' + esc(g.id) + '" data-nome="' + esc(g.nome) + '">Excluir</button>' +
          '</div></div>' +
        '<span class="abrir">Abrir →</span></div></div>';
  }

  const IC_PIN = '<svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 3.5 3v1.5h-11V13L10 10z"/><path d="M12 14.5V21"/></svg>';

  function cardCliente(c) {
    /* resumo curto: em card estreito, "última atividade há 3 min" virava
       reticências e não informava nada */
    const resumo = c.total_gravacoes + ' gravaç' + (c.total_gravacoes === 1 ? 'ão' : 'ões') +
      ' · ' + c.total_roteiros + ' roteiro' + (c.total_roteiros === 1 ? '' : 's');
    return '<div class="card-cliente spot eleva" data-cliente="' + esc(c.id) + '" ' +
      'title="' + esc(c.nome) + ' · última atividade ' + esc(B7.UI.quando(c.ultima_atividade)) + '">' +
      B7.UI.avatarCliente(c.nome, c.logo_url) +
      '<div class="nm"><b>' + esc(c.nome) + '</b><small>' + resumo + '</small></div>' +
      '<div class="acoes-card">' +
        '<button class="ico pin' + (c.is_pinned ? ' fixado' : '') + '" data-fixar="' + esc(c.id) + '" ' +
          'data-fixado="' + (c.is_pinned ? '1' : '0') + '" title="' +
          (c.is_pinned ? 'Desafixar cliente' : 'Fixar no topo') + '">' + IC_PIN + '</button>' +
        '<div class="menu"><button class="ico" onclick="event.stopPropagation()">⋯</button><div class="lista">' +
          '<button data-abrir-cli="' + esc(c.id) + '">Abrir workspace</button>' +
          '<button data-nova-gravacao="' + esc(c.id) + '">Nova gravação</button>' +
          '<button data-editar-cli="' + esc(c.id) + '">Editar cliente</button>' +
          '<button data-fixar="' + esc(c.id) + '" data-fixado="' + (c.is_pinned ? '1' : '0') + '">' +
            (c.is_pinned ? 'Desafixar' : 'Fixar no topo') + '</button><hr>' +
          '<button class="perigo" data-excluir-cli="' + esc(c.id) + '">Excluir cliente</button>' +
        '</div></div>' +
      '</div><div class="seta">›</div></div>';
  }

  /* fixados primeiro, depois os mais recentes */
  function ordenarClientes(lista) {
    return lista.slice().sort((a, b) =>
      (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
      String(b.ultima_atividade).localeCompare(String(a.ultima_atividade)));
  }

  function acoesRapidas(destaque) {
    const item = (ic, titulo, sub, attr, off) =>
      '<button class="acao-rapida" ' + attr + (off ? ' disabled' : '') + '>' +
      '<div class="ic">' + ic + '</div><div class="tx"><b>' + titulo + '</b><small>' + esc(sub) + '</small></div></button>';
    return '<div class="bloco"><h3>Ações rápidas</h3>' +
      item(IC.mais, 'Nova gravação', 'começar um grupo de roteiros', 'data-nova-gravacao') +
      item(IC.pessoa, 'Novo cliente', 'cadastrar um cliente', 'data-novo-cliente') +
      item(IC.play, 'Continuar último projeto',
           destaque ? destaque.cliente_nome + ' · ' + destaque.nome : 'nenhuma gravação ainda',
           destaque ? 'data-gravacao="' + esc(destaque.id) + '"' : '', !destaque) +
      item(IC.clientes, 'Abrir clientes', 'ver todos os workspaces', 'data-ir="#/clientes"') +
      item(IC.imprimir, 'Imprimir roteiro recente',
           destaque ? 'abre a impressão de ' + destaque.nome : 'nenhuma gravação ainda',
           destaque ? 'data-imprimir="' + esc(destaque.id) + '"' : '', !destaque) +
      '</div>';
  }

  function institucional() {
    return '<div class="institucional"><div class="brilho"></div>' +
      '<img src="assets/brand/logo-white.png" alt="Branding7">' +
      '<p>Conteúdo que move negócios.</p>' +
      '<small>Toda gravação começa numa ideia bem escrita. Este é o lugar dela.</small></div>';
  }

  function vazioGravacoes() {
    return estadoB7(IC.gravacoes, 'Sua próxima produção começa aqui.',
      'Crie uma gravação para começar a organizar os roteiros.',
      '<button class="b pri" data-nova-gravacao>' + IC.mais + 'Nova gravação</button>');
  }
  function vazioClientes() {
    return estadoB7(IC.clientes, 'Nenhum cliente por aqui ainda.',
      'Cadastre o primeiro cliente para abrir o workspace dele.',
      '<button class="b pri" data-novo-cliente>' + IC.mais + 'Criar cliente</button>');
  }

  /* bloco padrão de estado vazio/erro, com o símbolo B7 ao fundo */
  function estadoB7(icone, titulo, texto, acoes) {
    return '<div class="estado-b7"><div class="b7-marca fraca"></div>' +
      '<div class="ilu">' + icone + '</div><b>' + esc(titulo) + '</b><p>' + esc(texto) + '</p>' +
      (acoes ? '<div class="acoes">' + acoes + '</div>' : '') + '</div>';
  }

  /* ---- agrupamento por mês (gravações e, mais adiante, linhas editoriais)
     "Sem data" primeiro (é o que falta organizar), depois os meses com
     gravação marcada, do mais recente pro mais antigo. */
  function agruparPorMes(lista, campoData) {
    const grupos = new Map();
    lista.forEach(item => {
      const chave = item[campoData] ? String(item[campoData]).slice(0, 7) : '';
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(item);
    });
    return [...grupos.keys()]
      .sort((a, b) => !a ? -1 : !b ? 1 : b.localeCompare(a))
      .map(chave => ({ rotulo: B7.UI.mesRotulo(chave ? chave + '-01' : ''), itens: grupos.get(chave) }));
  }
  function blocoMeses(lista, campoData, renderCard, classeGrade) {
    return agruparPorMes(lista, campoData).map(gr =>
      '<div class="grupo-mes"><h3 class="grupo-mes-tit">' + esc(gr.rotulo) +
        '<span class="conta-mes">' + gr.itens.length + '</span></h3>' +
        '<div class="' + (classeGrade || 'grade') + '">' + gr.itens.map(renderCard).join('') + '</div></div>'
    ).join('');
  }

  /* ================================================ TODAS AS GRAVAÇÕES
     Gravações 2.0: organizadas pelo MÊS DE REFERÊNCIA (o mês de produção
     a que pertencem — independente do dia em que acontecem). Dentro de
     cada mês, pela data ativa; sem data por último. Gravações antigas
     sem mês ficam num grupo próprio, sempre visíveis. Filtros: cliente,
     mês, responsável e status. */
  const FG = { busca: '', cliente: '', mes: '', resp: '', status: '' };
  function chaveMes(g) { return g.competencia_ano ? g.competencia_ano + '-' + String(g.competencia_mes).padStart(2, '0') : ''; }
  function grupoCompetencia(lista) {
    const grupos = new Map();
    lista.forEach(g => { const k = chaveMes(g); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(g); });
    const ord = (a, b) => (!a.data_gravacao ? 1 : 0) - (!b.data_gravacao ? 1 : 0) ||
      String(a.data_gravacao || '').localeCompare(String(b.data_gravacao || '')) || String(b.updated_at).localeCompare(String(a.updated_at));
    return [...grupos.keys()].sort((a, b) => !a ? 1 : !b ? -1 : b.localeCompare(a)).map(k => ({
      rotulo: k ? B7.Gravacao.mesRef(+k.slice(0, 4), +k.slice(5, 7)) : 'Sem mês de referência (gravações antigas)',
      itens: grupos.get(k).sort(ord) }));
  }
  /* ---- linha da lista de Gravações ----
     A capa roxa se repetia em todo card e escondia o que importa. Aqui
     cada gravação é uma linha: QUANDO (dia em destaque), DE QUEM, quanto
     já foi gravado, quem grava e o status. Data que já passou sem a
     gravação ser concluída ganha um aviso. */
  const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const hojeISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const ehAtivaComData = g => (g.situacao === 'Agendada' || g.situacao === 'Remarcada') && !!g.data_gravacao;
  const dataPassou = g => ehAtivaComData(g) && String(g.data_gravacao).slice(0, 10) < hojeISO();
  function quandoRel(g) {
    if (!g.data_gravacao) return '';
    const [y, m, d] = String(g.data_gravacao).slice(0, 10).split('-').map(Number);
    const dias = Math.round((new Date(y, m - 1, d) - new Date(hojeISO() + 'T00:00:00')) / 864e5);
    const hora = g.hora_inicio ? ' · ' + String(g.hora_inicio).slice(0, 5) : '';
    if (g.situacao === 'Gravada' || g.situacao === 'Cancelada') return B7.UI.dataBR(g.data_gravacao) + hora;
    if (dias === 0) return 'Hoje' + hora;
    if (dias === 1) return 'Amanhã' + hora;
    if (dias > 1 && dias <= 6) return 'Em ' + dias + ' dias' + hora;
    return B7.UI.dataBR(g.data_gravacao) + hora;
  }
  function diaTile(g) {
    if (!g.data_gravacao) return '<div class="gl-dia semdata" aria-hidden="true"><b>–</b><small>sem data</small></div>';
    const [y, m, d] = String(g.data_gravacao).slice(0, 10).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const hoje = String(g.data_gravacao).slice(0, 10) === hojeISO();
    return '<div class="gl-dia' + (hoje ? ' hoje' : '') + (g.situacao === 'Cancelada' ? ' off' : '') + '" aria-hidden="true">' +
      '<small>' + DIAS_CURTOS[dt.getDay()] + '</small><b>' + d + '</b><small>' + MESES_CURTOS[m - 1] + '</small></div>';
  }
  function progressoGrav(g) {
    const total = g.total_itens != null ? +g.total_itens : +(g.total_roteiros || 0);
    const feitos = g.total_itens != null ? +(g.itens_gravados || 0) : 0;
    if (!total) return '<div class="gl-prog nada"><span class="gl-prog-tx">Nada na lista ainda</span></div>';
    const pct = Math.round(feitos / total * 100);
    return '<div class="gl-prog' + (feitos === total ? ' completo' : '') + '" title="' + feitos + ' de ' + total + ' itens gravados">' +
      '<div class="gl-barra" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + feitos + '" aria-label="Itens gravados"><i style="width:' + pct + '%"></i></div>' +
      '<span class="gl-prog-tx"><b>' + feitos + '</b>/' + total + ' gravados</span></div>';
  }
  const podeEditarGrav = () => !(B7.Auth && B7.Auth.ehEquipe) || B7.Auth.ehEquipe();
  function linhaGravacao(g) {
    const legado = !g.competencia_ano;
    const aviso = dataPassou(g) ? '<span class="gl-alerta">Data passou · concluir ou remarcar</span>' : '';
    const quando = quandoRel(g);
    /* gl-s-<situação>: a faixa de cor à esquerda (zze) */
    return '<div class="gl-item gl-s-' + esc(String(g.situacao || 'Pendente').toLowerCase()) + (g.situacao === 'Cancelada' ? ' cancelada' : '') + '" data-gravacao="' + esc(g.id) + '" ' +
      'data-total-roteiros="' + (g.total_roteiros || 0) + '" tabindex="0" role="link" aria-label="Abrir gravação ' + esc(g.cliente_nome + ' — ' + g.nome) + '">' +
      diaTile(g) +
      '<div class="gl-quem">' + B7.UI.avatarCliente(g.cliente_nome, g.cliente_logo_url || null, 'p') +
        '<div class="gl-tx"><b>' + esc(g.cliente_nome || 'Sem cliente') + '</b>' +
        '<span class="gl-nome">' + esc(g.nome) + '</span>' +
        '<span class="gl-sub">' + (quando ? '<span class="gl-quando">' + esc(quando) + '</span>' : '') + aviso +
          (legado && podeEditarGrav() ? '<button type="button" class="gl-definir" data-definir-mes="' + esc(g.id) + '">Definir mês</button>' : '') +
        '</span></div></div>' +
      progressoGrav(g) +
      '<div class="gl-resp">' + (g.videomaker_nome
        ? B7.UI.avatarPessoa({ nome: g.videomaker_nome }, 'mini') + '<span>' + esc(String(g.videomaker_nome).split(' ')[0]) + '</span>'
        : '<span class="gl-sem">Sem responsável</span>') + '</div>' +
      '<div class="gl-st">' + chipGravacao(g) + '</div>' +
      '<div class="menu"><button class="ico gl-mais" aria-label="Mais ações" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12h.01M12 12h.01M19 12h.01"/></svg></button>' +
        '<div class="lista">' +
        (legado && podeEditarGrav() ? '<button data-definir-mes="' + esc(g.id) + '">Definir mês de referência</button><hr>' : '') +
        '<button data-dup="' + esc(g.id) + '">Duplicar</button>' +
        '<button data-imprimir="' + esc(g.id) + '">Imprimir roteiros</button>' +
        '<button data-fixar-grav="' + esc(g.id) + '" data-fixado="' + (g.is_pinned ? '1' : '0') + '">' + (g.is_pinned ? 'Desafixar' : 'Fixar') + '</button>' +
        '<button data-arquivar="' + esc(g.id) + '" data-arq="' + (g.archived_at ? '1' : '0') + '">' + (g.archived_at ? 'Desarquivar' : 'Arquivar') + '</button><hr>' +
        '<button class="perigo" data-excluir="' + esc(g.id) + '" data-nome="' + esc(g.nome) + '">Excluir</button>' +
      '</div></div></div>';
  }
  const ROT_SIT = { Agendada: ['marcada', 'marcadas'], Remarcada: ['remarcada', 'remarcadas'], Pendente: ['sem data', 'sem data'], Gravada: ['concluída', 'concluídas'], Cancelada: ['cancelada', 'canceladas'] };
  function resumoGrupo(itens) {
    const c = {}; let feitos = 0, total = 0, atras = 0;
    itens.forEach(g => { const k = g.situacao || 'Pendente'; c[k] = (c[k] || 0) + 1;
      total += +(g.total_itens || 0); feitos += +(g.itens_gravados || 0); if (dataPassou(g)) atras++; });
    const partes = ['Agendada', 'Remarcada', 'Pendente', 'Gravada', 'Cancelada'].filter(k => c[k])
      .map(k => c[k] + ' ' + ROT_SIT[k][c[k] === 1 ? 0 : 1]);
    return '<span class="gl-resumo">' + esc(partes.join(' · ')) +
      (total ? '<span class="gl-resumo-itens">' + feitos + '/' + total + ' itens gravados</span>' : '') +
      (atras ? '<span class="gl-alerta">' + atras + ' com data passada</span>' : '') + '</span>';
  }
  function blocoCompetencia(lista) {
    const atual = hojeISO().slice(0, 7);
    return grupoCompetencia(lista).map(gr => {
      const k = gr.itens[0] ? chaveMes(gr.itens[0]) : '';
      return '<section class="gl-grupo' + (k ? '' : ' legado') + '">' +
        '<header class="gl-grupo-cab"><h3>' + esc(k ? gr.rotulo : 'Sem mês de referência') +
          (k === atual ? '<span class="gl-tag">mês atual</span>' : '') +
          '<span class="conta-mes">' + gr.itens.length + '</span></h3>' +
          (k ? resumoGrupo(gr.itens) : '<span class="gl-resumo">Gravações antigas, de antes do mês de referência. Defina o mês para organizá-las.</span>') +
        '</header>' +
        '<div class="gl-lista">' + gr.itens.map(linhaGravacao).join('') + '</div></section>';
    }).join('');
  }
  function modalDefinirMes(g, aoSalvar) {
    const sug = g.data_gravacao ? String(g.data_gravacao).slice(0, 10) : '';
    const m = B7.UI.modal('<h3>Mês de referência</h3>' +
      '<div class="sub">' + esc(g.cliente_nome + ' · ' + g.nome) + '</div>' +
      '<p class="fraca">A que mês de produção esta gravação pertence? Não precisa ser o mês da data.</p>' +
      B7.Gravacao.camposMes(sug ? +sug.slice(0, 4) : null, sug ? +sug.slice(5, 7) : null, 'dm') +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" id="dm-ok">Salvar</button></div>');
    m.querySelector('#dm-ok').onclick = async () => {
      const mes = +m.querySelector('#dm-mes').value, ano = +m.querySelector('#dm-ano').value;
      if (!mes || !ano) { m.querySelector('#dm-mes').classList.add('erro'); return; }
      try {
        await B7.Save.acao(() => B7.DB.atualizarGravacao(g.id, { competencia_ano: ano, competencia_mes: mes }), 'Mês de referência definido');
        g.competencia_ano = ano; g.competencia_mes = mes; m.fechar(); aoSalvar && aoSalvar();
      } catch (e) {}
    };
  }
  /* Movimento da lista de Gravações (zze): cada linha aparece quando entra
     na tela (cascata curta entre vizinhas) e a barra de itens gravados
     cresce da esquerda nesse momento. Sem IntersectionObserver ou com
     "reduzir movimento": tudo já visível, nada escondido. */
  let olhoGrav = null;
  function animarListaGravacoes(cx) {
    if (!cx || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (olhoGrav) olhoGrav.disconnect();
    cx.classList.add('gl-anima');
    let lote = 0, quadro = 0;
    olhoGrav = new IntersectionObserver(es => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        olhoGrav.unobserve(e.target);
        /* as que entram juntas fazem fila (60 ms entre uma e outra) */
        e.target.style.setProperty('--gl-atraso', Math.min(lote++, 8) * 60 + 'ms');
        e.target.classList.add('gl-visto');
      });
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => { lote = 0; });
    }, { rootMargin: '0px 0px -4% 0px', threshold: .05 });
    cx.querySelectorAll('.gl-item, .gl-grupo-cab').forEach(el => olhoGrav.observe(el));
    /* garantia: o que já está na tela aparece mesmo se o observador
       atrasar (aba em segundo plano, navegador econômico) */
    setTimeout(() => {
      if (!cx.isConnected) return;
      const h = window.innerHeight;
      cx.querySelectorAll('.gl-item:not(.gl-visto), .gl-grupo-cab:not(.gl-visto)').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.top < h && r.bottom > 0) { el.classList.add('gl-visto'); if (olhoGrav) olhoGrav.unobserve(el); }
      });
    }, 1200);
  }

  async function abrirGravacoes() {
    marcarNav('#/gravacoes');
    B7.Rota.titulo(['Gravações']);
    esqueleto('lista');
    let gravacoes;
    const vale = B7.Rota.marca();
    try { gravacoes = await B7.DB.listarGravacoes(); } catch (e) { if (!vale()) return; return erro(e, 'abrirGravacoes'); }
    if (!vale()) return;   /* zzz4: a pessoa já foi para outra tela */

    const clientes = [...new Map(gravacoes.map(g => [g.client_id, g.cliente_nome])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'pt-BR'));
    const meses = () => [...new Set(gravacoes.map(chaveMes).filter(Boolean))].sort().reverse();
    const resps = [...new Map(gravacoes.filter(g => g.videomaker_id).map(g => [g.videomaker_id, g.videomaker_nome])).entries()];
    const STATUS = [['', 'Todas'], ['Agendada', 'Marcadas'], ['Remarcada', 'Remarcadas'], ['Pendente', 'Sem data'], ['Gravada', 'Concluídas'], ['Cancelada', 'Canceladas']];
    const sel = (id, atual, ops, rot) => '<select class="campo fina gv-filtro' + (atual ? ' ativo' : '') + '" id="' + id + '" aria-label="' + esc(rot) + '">' +
      ops.map(([v, r]) => '<option value="' + esc(v) + '"' + (v === atual ? ' selected' : '') + '>' + esc(r) + '</option>').join('') + '</select>';
    const opcoesMes = () => [['', 'Todos os meses'], ['sem', 'Sem mês (antigas)']].concat(meses().map(k => [k, B7.Gravacao.mesRef(+k.slice(0, 4), +k.slice(5, 7))]));

    /* zze: no celular o cabeçalho é compacto (Calendário vira ícone, "+ Nova"
       em pílula) e os três seletores ficam atrás do botão "Filtros" */
    painel().innerHTML = '<div class="conteudo gl-pagina">' +
      '<div class="secao-topo gl-topo"><h2 style="font-size:22px">Gravações</h2>' +
      '<span class="conta" id="gv-conta">' + gravacoes.length + '</span><div class="espaco"></div>' +
      (B7.Perm && B7.Perm.podeRota('calendario') ? '<a class="b contorno gl-cal" href="#/calendario?v=mes&amp;tipo=gravacoes" aria-label="Calendário de gravações">' + IC_CAL + '<span class="gl-so-largo">Calendário</span></a>' : '') +
      '<button class="b pri gl-nova" data-nova-gravacao>' + IC.mais + 'Nova<span class="gl-so-largo">&nbsp;gravação</span></button></div>' +
      (gravacoes.length ? '<div class="gl-filtros">' +
        '<div class="gl-linha-busca"><div class="gl-busca"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
          '<input class="campo fina" id="fg-busca" type="search" placeholder="Buscar cliente ou gravação" aria-label="Buscar cliente ou gravação" value="' + esc(FG.busca || '') + '"></div>' +
          '<button type="button" class="gl-bt-filtros" id="fg-abre" aria-expanded="false" aria-controls="fg-sels">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>' +
            '<span>Filtros</span><b id="fg-qtd" hidden></b></button></div>' +
        '<div class="gl-sels" id="fg-sels">' +
        sel('fg-cliente', FG.cliente, [['', 'Todos os clientes']].concat(clientes), 'Cliente') +
        '<span id="fg-mes-cx">' + sel('fg-mes', FG.mes, opcoesMes(), 'Mês de referência') + '</span>' +
        (resps.length ? sel('fg-resp', FG.resp, [['', 'Todos os responsáveis'], ['sem', 'Sem responsável']].concat(resps), 'Responsável') : '') +
        '</div>' +
        '<button class="b fina contorno gl-limpar" id="fg-limpar" hidden>Limpar filtros</button>' +
        '<span class="gl-quebra"></span><div class="filtro gl-status" id="filtro-status" role="group" aria-label="Status"></div>' +
      '</div>' : '') +
      (gravacoes.length ? '<div id="lista-gravacoes"></div>' : vazioGravacoes()) + '</div>';

    const passa = (g, semStatus) => {
      const t = (FG.busca || '').trim().toLowerCase();
      return (!t || (String(g.cliente_nome || '') + ' ' + String(g.nome || '')).toLowerCase().includes(t)) &&
        (!FG.cliente || g.client_id === FG.cliente) &&
        (!FG.mes || (FG.mes === 'sem' ? !g.competencia_ano : chaveMes(g) === FG.mes)) &&
        (!FG.resp || (FG.resp === 'sem' ? !g.videomaker_id : g.videomaker_id === FG.resp)) &&
        (semStatus || !FG.status || (g.situacao || 'Pendente') === FG.status);
    };
    const pintarStatus = () => {
      const f = document.getElementById('filtro-status'); if (!f) return;
      const base = gravacoes.filter(g => passa(g, true));
      f.innerHTML = STATUS.map(([v, r]) => {
        const n = v ? base.filter(g => (g.situacao || 'Pendente') === v).length : base.length;
        if (v && !n && FG.status !== v) return '';
        return '<button data-f="' + esc(v) + '"' + (FG.status === v ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' +
          esc(r) + '<span class="gl-n">' + n + '</span></button>';
      }).join('');
      f.querySelectorAll('button').forEach(b => b.onclick = () => { FG.status = b.dataset.f; aplicar(); });
    };
    const aplicar = () => {
      const lista = gravacoes.filter(g => passa(g));
      const cx = document.getElementById('lista-gravacoes'); if (!cx) return;
      cx.innerHTML = lista.length ? blocoCompetencia(lista)
        : '<div class="vazio gl-vazio"><b>Nenhuma gravação com esses filtros</b><p>Tente outro cliente, mês ou status.</p></div>';
      const conta = document.getElementById('gv-conta'); if (conta) conta.textContent = lista.length;
      const limpar = document.getElementById('fg-limpar');
      if (limpar) limpar.hidden = !(FG.busca || FG.cliente || FG.mes || FG.resp || FG.status);
      /* quantos seletores estão ativos (no botão "Filtros" do celular) */
      const qtd = document.getElementById('fg-qtd'), nSel = [FG.cliente, FG.mes, FG.resp].filter(Boolean).length;
      if (qtd) { qtd.textContent = nSel; qtd.hidden = !nSel; }
      pintarStatus();
      ligar();
      animarListaGravacoes(cx);
      cx.querySelectorAll('[data-definir-mes]').forEach(b => b.onclick = ev => {
        ev.stopPropagation(); B7.UI.fecharMenus && B7.UI.fecharMenus();
        const g = gravacoes.find(x => x.id === b.dataset.definirMes); if (!g) return;
        modalDefinirMes(g, () => {
          const c = document.getElementById('fg-mes-cx'); if (c) { c.innerHTML = sel('fg-mes', FG.mes, opcoesMes(), 'Mês de referência'); ligarSel('fg-mes', 'mes'); }
          aplicar();
        });
      });
    };
    const ligarSel = (id, k) => {
      const el = document.getElementById(id);
      if (el) el.onchange = () => { FG[k] = el.value; el.classList.toggle('ativo', !!el.value); aplicar(); };
    };
    [['fg-cliente', 'cliente'], ['fg-mes', 'mes'], ['fg-resp', 'resp']].forEach(([id, k]) => ligarSel(id, k));
    const abre = document.getElementById('fg-abre'), sels = document.getElementById('fg-sels');
    if (abre && sels) {
      /* começa aberto se já há seletor ativo (a pessoa voltou para a tela) */
      const abrir = v => { sels.classList.toggle('aberto', v); abre.setAttribute('aria-expanded', String(v)); abre.classList.toggle('on', v); };
      abrir(!!(FG.cliente || FG.mes || FG.resp));
      abre.onclick = () => abrir(!sels.classList.contains('aberto'));
    }
    const busca = document.getElementById('fg-busca');
    if (busca) busca.oninput = B7.UI.debounce(() => { FG.busca = busca.value; aplicar(); }, 120);
    const limpar = document.getElementById('fg-limpar');
    if (limpar) limpar.onclick = () => {
      Object.assign(FG, { busca: '', cliente: '', mes: '', resp: '', status: '' });
      if (busca) busca.value = '';
      ['fg-cliente', 'fg-mes', 'fg-resp'].forEach(id => { const el = document.getElementById(id); if (el) { el.value = ''; el.classList.remove('ativo'); } });
      aplicar();
    };
    ligar();
    aplicar();
    B7.Rota.aoSair(() => { if (olhoGrav) { olhoGrav.disconnect(); olhoGrav = null; } });
  }

  /* ================================================ ROTEIROS RECENTES
     Duas formas de ver a mesma lista:
       • Lista (padrão): agrupada por GRAVAÇÃO — é onde o roteiro vive e
         onde ele é gravado. Cabeçalho do grupo: cliente, gravação, quando
         grava e o andamento dos roteiros; cada linha: título, objetivo,
         estágio e quando foi mexido.
       • Cards: a grade antiga, mais compacta.
     Busca, estágio, cliente e ordenação trabalham em memória. Títulos
     digitados TODO EM MAIÚSCULAS aparecem em caixa de frase (só na tela). */
  const ROT_ORDEM = ['Em criação', 'Em revisão', 'Aprovado internamente', 'Pronto para gravar', 'Gravado'];
  function tituloTela(t) {
    const s = String(t || '').trim();
    if (!s) return 'Sem título';
    const letras = s.replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (letras.length < 6 || letras !== letras.toUpperCase()) return s;
    const baixo = s.toLocaleLowerCase('pt-BR');
    return baixo.charAt(0).toLocaleUpperCase('pt-BR') + baixo.slice(1);
  }
  const hojeLocal = () => B7.Eventos ? B7.Eventos.DATAS.hoje() : new Date().toISOString().slice(0, 10);
  /* quando a gravação acontece, em uma frase curta */
  function quandoGrava(g) {
    if (!g) return '';
    const dia = g.data_gravacao ? String(g.data_gravacao).slice(0, 10) : null;
    const MES = B7.UI.MESES || [];
    if (g.situacao === 'concluida' || g.concluida_em || g.gravada_em) {
      const d = String(g.gravada_em || g.concluida_em || dia || '').slice(0, 10);
      return d ? 'Gravada em ' + B7.UI.dataBR(d).slice(0, 5) : 'Gravada';
    }
    if (dia) {
      const n = B7.Eventos ? B7.Eventos.DATAS.difDias(hojeLocal(), dia) : 0;
      return (n < 0 ? 'Era para ' : 'Grava ') + B7.UI.dataBR(dia).slice(0, 5) + (n === 0 ? ' · hoje' : n === 1 ? ' · amanhã' : n > 1 && n <= 14 ? ' · em ' + n + ' dias' : '');
    }
    if (g.competencia_mes && g.competencia_ano) return 'Ref. ' + (MES[g.competencia_mes - 1] || g.competencia_mes) + ' ' + g.competencia_ano + ' · sem data';
    return 'Sem data';
  }
  /* MÊS DO ROTEIRO: o mês selecionado na gravação (mês de referência);
     se a gravação ainda não tem mês, o mês em que o roteiro foi criado */
  function mesDoRoteiro(r) {
    const g = r.gravacao || {};
    if (g.competencia_ano && g.competencia_mes) return { ano: +g.competencia_ano, mes: +g.competencia_mes, origem: 'gravacao' };
    const d = r.created_at ? new Date(r.created_at) : new Date(r.updated_at || Date.now());
    return { ano: d.getFullYear(), mes: d.getMonth() + 1, origem: 'criacao' };
  }
  const chaveMesRot = m => m.ano + '-' + String(m.mes).padStart(2, '0');
  const rotuloMes = k => { const [a, m] = k.split('-').map(Number); return (B7.UI.MESES[m - 1] || m) + ' ' + a; };
  function cardRoteiro(r) {
    const g = r.gravacao || {};
    const cliente = g.cliente_nome || 'Sem cliente';
    return '<div class="card-roteiro spot eleva" data-gravacao="' + esc(r.recording_session_id) +
      '" data-roteiro="' + esc(r.id) + '" data-total-roteiros="' + (g.total_roteiros || 0) + '" ' +
      'role="link" tabindex="0" aria-label="Abrir roteiro ' + esc(tituloTela(r.titulo)) + '">' +
      '<div class="cr-topo">' + B7.UI.avatarCliente(cliente, g.cliente_logo_url || null) +
        '<div class="cr-quem"><b>' + esc(cliente) + '</b>' +
        '<small>' + IC.gravacoes + esc(g.nome ? tituloTela(g.nome) : 'Gravação removida') + '</small></div>' +
      '</div>' +
      '<h3>' + esc(tituloTela(r.titulo)) + '</h3>' +
      (r.objetivo ? '<p>' + esc(r.objetivo) + '</p>' : '') +
      '<div class="cr-pe">' + B7.UI.chipRevisao(r.status) +
        '<span class="cr-quando" title="' + esc(r.updated_at || '') + '">' + esc(B7.UI.quando(r.updated_at)) + '</span>' +
        (g.id ? '<span class="cr-data">' + esc(quandoGrava(g)) + '</span>' : '') +
      '</div></div>';
  }
  function linhaRoteiroLista(r) {
    return '<div class="rt-linha" data-gravacao="' + esc(r.recording_session_id) + '" data-roteiro="' + esc(r.id) + '" role="link" tabindex="0" ' +
        'aria-label="Abrir roteiro ' + esc(tituloTela(r.titulo)) + '">' +
      '<span class="rt-l-tx"><b>' + esc(tituloTela(r.titulo)) + '</b>' + (r.objetivo ? '<small>' + esc(r.objetivo) + '</small>' : '') + '</span>' +
      '<span class="rt-l-st">' + B7.UI.chipRevisao(r.status) + '</span>' +
      '<span class="rt-l-quando" title="' + esc(r.updated_at || '') + '">' + esc(B7.UI.quando(r.updated_at)) + '</span>' +
      '<span class="rt-l-seta" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span></div>';
  }
  function grupoRoteirosHTML(grp) {
    const g = grp.gravacao || {};
    const cliente = g.cliente_nome || 'Sem cliente';
    const conta = {}; grp.itens.forEach(r => { const k = r.status || 'Em criação'; conta[k] = (conta[k] || 0) + 1; });
    const total = grp.itens.length;
    const barra = ROT_ORDEM.filter(k => conta[k]).map(k =>
      '<i class="rt-seg ' + (B7.UI.CLASSE_REVISAO[k] || 'criacao') + '" style="flex:' + conta[k] + '" title="' + conta[k] + ' ' + esc(k.toLowerCase()) + '"></i>').join('');
    const prontos = (conta['Pronto para gravar'] || 0) + (conta['Gravado'] || 0);
    const qg = quandoGrava(g);
    return '<section class="rt-grupo">' +
      '<header class="rt-g-cab" data-gravacao="' + esc(grp.id) + '" role="link" tabindex="0" aria-label="Abrir gravação ' + esc(g.nome || '') + ' de ' + esc(cliente) + '">' +
        B7.UI.avatarCliente(cliente, g.cliente_logo_url || null) +
        '<span class="rt-g-tx"><b>' + esc(cliente) + '</b><small>' + IC.gravacoes + esc(g.nome ? tituloTela(g.nome) : 'Gravação removida') + '</small></span>' +
        (qg ? '<span class="rt-g-quando' + (/^Grava .*(hoje|amanhã|em \d dias)/.test(qg) ? ' perto' : /^Era/.test(qg) ? ' atras' : '') + '">' + esc(qg) + '</span>' : '') +
        '<span class="rt-g-prog" title="' + prontos + ' de ' + total + ' prontos ou gravados">' +
          '<span class="rt-barra">' + barra + '</span><small>' + prontos + '/' + total + ' prontos' +
          (g.total_roteiros > total ? ' · ' + g.total_roteiros + ' na gravação' : '') + '</small></span>' +
      '</header>' +
      '<div class="rt-g-lista">' + grp.itens.map(linhaRoteiroLista).join('') + '</div></section>';
  }

  async function abrirRoteiros() {
    marcarNav('#/roteiros');
    B7.Rota.titulo(['Roteiros']);
    esqueleto('lista', { n: 6 });
    let roteiros;
    const vale = B7.Rota.marca();
    try { roteiros = await B7.DB.roteirosRecentes(1000); } catch (e) { if (!vale()) return; return erro(e, 'abrirRoteiros'); }
    if (!vale()) return;   /* zzz4: a pessoa já foi para outra tela */
    roteiros.forEach(r => { r._mes = mesDoRoteiro(r); r._chaveMes = chaveMesRot(r._mes); });
    const agoraMes = chaveMesRot({ ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 });
    const meses = [...new Set(roteiros.map(r => r._chaveMes))].sort().reverse();

    const clientes = [...new Set(roteiros.map(r => r.gravacao && r.gravacao.cliente_nome).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    let vista = 'lista';
    try { vista = localStorage.getItem('b7.roteiros.vista') === 'cards' ? 'cards' : 'lista'; } catch (e) {}
    const F = { status: 'Todos', cliente: '', termo: '', ordem: 'recentes', mes: '' };

    const ICL = '<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>';
    const ICC = '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>';
    painel().innerHTML = '<div class="conteudo entra rt">' +
      '<div class="rt-cab"><div class="rt-cab-tx"><h1>Roteiros</h1>' +
        '<p id="rt-sub">' + roteiros.length + ' roteiros, separados pelo mês da gravação</p></div>' +
        (roteiros.length ? '<div class="rt-cab-acoes"><div class="filtro rt-vista" role="group" aria-label="Forma de ver">' +
          '<button data-vista="lista" aria-label="Lista por gravação" title="Lista por gravação">' + ICL + '<span>Lista</span></button>' +
          '<button data-vista="cards" aria-label="Cards" title="Cards">' + ICC + '<span>Cards</span></button></div>' +
          '<button class="b pri" data-nova-gravacao>' + IC.mais + 'Nova gravação</button></div>' : '') +
      '</div>' +
      (roteiros.length ?
        '<div class="filtro rolavel rt-status" id="rt-status" role="group" aria-label="Estágio"></div>' +
        '<div class="rt-barra-f">' +
          '<div class="busca-local"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
            '<input class="campo" id="rt-busca" type="search" placeholder="Buscar por título, cliente, gravação ou objetivo…" autocomplete="off" aria-label="Buscar roteiros"></div>' +
          '<select class="campo rt-sel" id="rt-mes" aria-label="Mês"><option value="">Mês: todos</option>' +
            meses.map(k => '<option value="' + k + '">' + esc(rotuloMes(k)) + (k === agoraMes ? ' (este mês)' : '') + '</option>').join('') + '</select>' +
          (clientes.length > 1 ? '<select class="campo rt-sel" id="rt-cliente" aria-label="Cliente">' +
            '<option value="">Cliente: todos</option>' +
            clientes.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('') + '</select>' : '') +
          '<select class="campo rt-sel" id="rt-ordem" aria-label="Ordenar">' +
            '<option value="recentes">Mexidos por último</option><option value="gravacao">Próximas gravações</option><option value="cliente">Cliente (A–Z)</option></select>' +
          '<button class="b fina contorno" id="rt-limpar-f" style="display:none">Limpar</button>' +
        '</div>' +
        '<div id="lista-roteiros"></div>'
      : estadoB7(IC.roteiros, 'Nenhum roteiro ainda.',
          'Crie uma gravação e escreva o primeiro roteiro: ele aparece aqui assim que for salvo.',
          '<button class="b pri" data-nova-gravacao>' + IC.mais + 'Nova gravação</button>' +
          '<button class="b contorno" data-ir="#/gravacoes">Ver gravações</button>')) +
      '</div>';
    ligar();
    if (!roteiros.length) return;

    const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const passaBase = r => {
      const g = r.gravacao || {};
      if (F.cliente && g.cliente_nome !== F.cliente) return false;
      if (F.mes && r._chaveMes !== F.mes) return false;
      if (F.termo && !norm(r.titulo + ' ' + g.cliente_nome + ' ' + g.nome + ' ' + r.objetivo).includes(F.termo)) return false;
      return true;
    };
    const chaveGrav = g => { const d = g && g.data_gravacao ? String(g.data_gravacao).slice(0, 10) : null; const passou = !d || d < hojeLocal() || (g && (g.gravada_em || g.concluida_em)); return (passou ? '1' : '0') + (d || '9999'); };
    function pintarStatus(base) {
      const cx = document.getElementById('rt-status'); if (!cx) return;
      const n = k => k === 'Todos' ? base.length : base.filter(r => (r.status || 'Em criação') === k).length;
      cx.innerHTML = ['Todos'].concat(ROT_ORDEM).map(k =>
        '<button data-f="' + esc(k) + '" class="' + (F.status === k ? 'on' : '') + '" aria-pressed="' + (F.status === k) + '">' +
          (k === 'Todos' ? '' : '<i class="rt-pt ' + (B7.UI.CLASSE_REVISAO[k] || '') + '"></i>') + esc(k) + '<span class="rt-n">' + n(k) + '</span></button>').join('');
      cx.querySelectorAll('button').forEach(b => b.onclick = () => { F.status = b.dataset.f; aplicar(); });
    }
    function aplicar() {
      const base = roteiros.filter(passaBase);
      pintarStatus(base);
      const lista = base.filter(r => F.status === 'Todos' || (r.status || 'Em criação') === F.status);
      const cx = document.getElementById('lista-roteiros'); if (!cx) return;
      const sub = document.getElementById('rt-sub');
      if (sub) sub.textContent = (lista.length === roteiros.length ? roteiros.length + ' roteiros, separados pelo mês da gravação'
        : lista.length + ' de ' + roteiros.length + ' roteiros');
      const filtrando = F.status !== 'Todos' || F.cliente || F.termo || F.mes;
      const lp = document.getElementById('rt-limpar-f'); if (lp) lp.style.display = filtrando ? '' : 'none';
      painel().querySelectorAll('[data-vista]').forEach(b => { b.classList.toggle('on', b.dataset.vista === vista); b.setAttribute('aria-pressed', b.dataset.vista === vista); });
      if (!lista.length) {
        cx.className = '';
        cx.innerHTML = '<div class="estado-b7 leve"><div class="b7-marca fraca"></div>' +
          '<div class="ilu">' + IC.roteiros + '</div><b>Nenhum roteiro com esses filtros.</b>' +
          '<p>Tente outra palavra, outro estágio ou outro cliente.</p>' +
          '<div class="acoes"><button class="b contorno" id="rt-limpar">Limpar filtros</button></div></div>';
        const l = document.getElementById('rt-limpar'); if (l) l.onclick = limpar;
        return;
      }
      /* uma seção por MÊS (mais novo primeiro); dentro dela, a vista escolhida */
      const porMes = new Map();
      lista.forEach(r => { if (!porMes.has(r._chaveMes)) porMes.set(r._chaveMes, []); porMes.get(r._chaveMes).push(r); });
      const corpoMes = itens => {
        if (vista === 'cards') {
          const ord = itens.slice();
          if (F.ordem === 'cliente') ord.sort((a, b) => String((a.gravacao || {}).cliente_nome || '').localeCompare(String((b.gravacao || {}).cliente_nome || ''), 'pt-BR'));
          if (F.ordem === 'gravacao') ord.sort((a, b) => chaveGrav(a.gravacao).localeCompare(chaveGrav(b.gravacao)));
          return '<div class="grade grade-roteiros">' + ord.map(cardRoteiro).join('') + '</div>';
        }
        /* agrupa por gravação, mantendo a ordem de "mexido por último" */
        const grupos = [], idx = new Map();
        itens.forEach(r => {
          const k = r.recording_session_id;
          if (!idx.has(k)) { const grp = { id: k, gravacao: r.gravacao, itens: [], recente: r.updated_at }; idx.set(k, grp); grupos.push(grp); }
          idx.get(k).itens.push(r);
        });
        if (F.ordem === 'cliente') grupos.sort((a, b) => String((a.gravacao || {}).cliente_nome || '').localeCompare(String((b.gravacao || {}).cliente_nome || ''), 'pt-BR') || String(b.recente).localeCompare(String(a.recente)));
        if (F.ordem === 'gravacao') grupos.sort((a, b) => chaveGrav(a.gravacao).localeCompare(chaveGrav(b.gravacao)));
        return '<div class="rt-lista">' + grupos.map(grupoRoteirosHTML).join('') + '</div>';
      };
      cx.className = 'rt-meses';
      cx.innerHTML = [...porMes.keys()].sort().reverse().map(k => {
        const itens = porMes.get(k);
        const pelaCriacao = itens.filter(r => r._mes.origem === 'criacao').length;
        const gravs = new Set(itens.map(r => r.recording_session_id)).size;
        return '<section class="rt-mes' + (k === agoraMes ? ' atual' : '') + '" data-mes="' + k + '" aria-label="' + esc(rotuloMes(k)) + '">' +
          '<header class="rt-mes-cab"><h2>' + esc(rotuloMes(k)) + '</h2>' +
            (k === agoraMes ? '<em>Este mês</em>' : '') +
            '<span>' + itens.length + ' roteiro' + (itens.length > 1 ? 's' : '') + ' · ' + gravs + ' gravaç' + (gravs > 1 ? 'ões' : 'ão') + '</span>' +
            (pelaCriacao ? '<small title="A gravação ainda não tem mês de referência: o roteiro entra pelo mês em que foi criado.">' + pelaCriacao + ' pelo mês de criação</small>' : '') +
          '</header>' + corpoMes(itens) + '</section>';
      }).join('');
      ligar();
    }
    function limpar() {
      Object.assign(F, { status: 'Todos', cliente: '', termo: '', mes: '' });
      const sm = document.getElementById('rt-mes'); if (sm) { sm.value = ''; sm.classList.remove('ativo'); }
      const b = document.getElementById('rt-busca'); if (b) b.value = '';
      const s = document.getElementById('rt-cliente'); if (s) { s.value = ''; s.classList.remove('ativo'); }
      aplicar();
    }
    const busca = document.getElementById('rt-busca');
    if (busca) busca.oninput = B7.UI.debounce(() => { F.termo = norm(busca.value.trim()); aplicar(); }, 120);
    const sc = document.getElementById('rt-cliente');
    if (sc) sc.onchange = () => { F.cliente = sc.value; sc.classList.toggle('ativo', !!sc.value); aplicar(); };
    const smes = document.getElementById('rt-mes');
    if (smes) smes.onchange = () => { F.mes = smes.value; smes.classList.toggle('ativo', !!smes.value); aplicar(); };
    const so = document.getElementById('rt-ordem');
    if (so) so.onchange = () => { F.ordem = so.value; aplicar(); };
    const lf = document.getElementById('rt-limpar-f'); if (lf) lf.onclick = limpar;
    painel().querySelectorAll('[data-vista]').forEach(b => b.onclick = () => {
      vista = b.dataset.vista;
      try { localStorage.setItem('b7.roteiros.vista', vista); } catch (e) {}
      aplicar();
    });
    aplicar();
  }

  /* ========================================================= CLIENTES */
  async function abrirClientes() {
    marcarNav('#/clientes');
    B7.Rota.titulo(['Clientes']);
    esqueleto('lista');
    let clientes;
    const vale = B7.Rota.marca();
    try { clientes = ordenarClientes(await B7.DB.listarClientes()); }
    catch (e) { if (!vale()) return; return erro(e, 'abrirClientes'); }
    if (!vale()) return;   /* zzz4: a pessoa já foi para outra tela */

    painel().innerHTML = '<div class="conteudo">' +
      '<div class="secao-topo"><h2 style="font-size:22px">Clientes</h2>' +
      '<span class="conta">' + clientes.length + '</span><div class="espaco"></div>' +
      '<div class="filtro" id="filtro-cli">' +
        ['Todos', 'Mais recentes', 'Com gravações', 'Sem gravações'].map((f, i) =>
          '<button data-f="' + esc(f) + '"' + (i === 0 ? ' class="on"' : '') + '>' + esc(f) + '</button>').join('') +
      '</div>' +
      '<input class="campo" id="busca-cli" placeholder="Buscar clientes…" style="width:210px;padding:9px 12px">' +
      '<button class="b pri" data-novo-cliente>' + IC.mais + 'Novo cliente</button></div>' +
      (clientes.length ? '<div class="grade-clientes" id="lista-cli">' + clientes.map(cardCliente).join('') + '</div>'
                       : vazioClientes()) + '</div>';

    ligar();

    let filtroAtual = 'Todos', termo = '';
    const aplicar = () => {
      let lista = clientes.slice();
      lista = ordenarClientes(lista);
      if (filtroAtual === 'Com gravações') lista = lista.filter(c => c.total_gravacoes > 0);
      if (filtroAtual === 'Sem gravações') lista = lista.filter(c => c.total_gravacoes === 0);
      if (termo) lista = lista.filter(c => c.nome.toLowerCase().includes(termo));
      const cx = document.getElementById('lista-cli');
      if (!cx) return;
      cx.innerHTML = lista.length ? lista.map(cardCliente).join('')
        : '<div class="vazio" style="grid-column:1/-1"><b>Nenhum cliente aqui</b>' +
          '<p>Tente outro filtro ou outra busca.</p></div>';
      ligar();
    };
    const f = document.getElementById('filtro-cli');
    if (f) f.querySelectorAll('button').forEach(b => b.onclick = () => {
      f.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); filtroAtual = b.dataset.f; aplicar();
    });
    const busca = document.getElementById('busca-cli');
    if (busca) busca.oninput = () => { termo = busca.value.trim().toLowerCase(); aplicar(); };
  }

  /* ====================================================== UM CLIENTE */
  /* ===================================================================
     WORKSPACE DO CLIENTE
     Não é o dashboard geral filtrado: é a visão daquele cliente —
     capa, resumo próprio, atividade, gravações, roteiros e atalhos.
     A identidade continua sendo a B7; a marca do cliente entra pela
     logo e pelo conteúdo, nunca pelas cores da interface.
     =================================================================== */
  let abaCliente = 'geral';

  /* =================================================================
     HUB DO CLIENTE
     O cliente é o contexto; cada área (Editorial, Gravações, Vídeos…) é
     uma SEÇÃO dele, com endereço próprio — #/cliente/<id>/<secao> —, então
     Voltar, recarregar e link direto funcionam. A seção é uma lente sobre
     os registros canônicos: abrir um item leva à tela canônica dele (a
     mesma do módulo global), que sabe voltar para cá (?de=cliente).
     Uma seção só aparece para quem pode abrir o destino canônico dela:
     o hub nunca dá acesso a nada que o módulo global não daria.
     Nova seção (ex.: Marca, no futuro) = mais uma linha aqui + o desenho.
     ================================================================= */
  const SECOES_CLIENTE = [
    { k: 'geral', r: 'Visão geral' },
    { k: 'linhas', r: 'Editorial', rota: 'linha' },
    { k: 'gravacoes', r: 'Gravações', rota: 'gravacao' },
    { k: 'roteiros', r: 'Roteiros', rota: 'gravacao' },
    { k: 'video', r: 'Vídeos', rota: 'video' },
    { k: 'design', r: 'Design', rota: 'design' },
    { k: 'ideias', r: 'Ideias' },
    { k: 'inteligencia', r: 'Inteligência' },
    { k: 'arquivados', r: 'Arquivados', equipe: true }
  ];
  const podeIrRota = r => !B7.Perm || B7.Perm.podeRota(r);
  const souEquipeCli = () => !(B7.Auth && B7.Auth.usuario()) || (B7.Auth.ehEquipe && B7.Auth.ehEquipe());
  const secaoVisivel = s => (!s.rota || podeIrRota(s.rota)) && (!s.equipe || souEquipeCli());
  const hrefSecao = (id, k) => '#/cliente/' + id + (k === 'geral' ? '' : '/' + k);

  /* cabeçalho compacto + seções: o mesmo em todas as seções do cliente
     (inclusive as que moram em js/conteudo.js: Editorial, Ideias, Inteligência) */
  function shellCliente(c, secao) {
    /* as ações são as mesmas que a capa antiga mostrava a toda a equipe
       interna (o RLS de clientes/gravacoes libera admin, coordenador,
       designer e videomaker). Restringir é decisão de permissão, não de tela. */
    const gestor = souEquipeCli();
    const criaGravacao = gestor;
    const quandoTx = c.ultima_atividade ? 'atualizado ' + B7.UI.quando(c.ultima_atividade) : '';
    const resumoMes = B7.ResumoMes && gestor;
    return '<div class="cli-shell">' +
      (podeIrRota('clientes') ? '<a class="cli-voltar" href="#/clientes">' + IC_VOLTAR + 'Clientes</a>' : '') +
      '<header class="cli-cab">' +
        B7.UI.avatarCliente(c.nome, c.logo_url, 'cli-av') +
        '<div class="cli-cab-tx"><h1>' + esc(c.nome) + '</h1>' +
          (quandoTx ? '<p class="cli-meta">' + esc(quandoTx) + '</p>' : '') + '</div>' +
        (gestor ? '<div class="cli-acoes">' +
          (criaGravacao ? '<button class="b pri fina cli-so-largo" data-nova-gravacao="' + esc(c.id) + '">' + IC.mais + '<span>Nova gravação</span></button>' : '') +
          (resumoMes ? '<button class="b contorno fina cli-so-largo" data-resumo-mes>Resumo do mês</button>' : '') +
          '<div class="menu"><button class="ico" aria-label="Mais ações do cliente">⋯</button><div class="lista">' +
            (criaGravacao ? '<button data-nova-gravacao="' + esc(c.id) + '">Nova gravação</button>' : '') +
            (resumoMes ? '<button data-resumo-mes>Resumo do mês</button>' : '') +
            '<button data-editar-cli="' + esc(c.id) + '">Editar cliente</button>' +
            (ehAdmin() ? '<button data-ir="#/previa/' + esc(c.id) + '">Visualizar como cliente</button>' : '') +
            '<hr><button class="perigo" data-excluir-cli="' + esc(c.id) + '">Excluir cliente</button>' +
          '</div></div></div>' : '') +
      '</header>' +
    '</div>' +
    /* fora do .cli-shell (irmã do corpo) para poder grudar no topo
       enquanto a página rola */
    '<nav class="cli-secoes" aria-label="Seções do cliente"><div class="cli-secoes-rolo">' +
      SECOES_CLIENTE.filter(secaoVisivel).map(s =>
        '<a href="' + hrefSecao(c.id, s.k) + '"' + (s.k === secao ? ' class="on" aria-current="page"' : '') + '>' + esc(s.r) + '</a>').join('') +
      '<i class="cli-ind" aria-hidden="true"></i>' +
    '</div></nav>';
  }
  const IC_VOLTAR = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';

  /* liga as ações do cabeçalho onde quer que ele esteja (telas do
     conteudo.js não passam pelo ligar() geral desta tela) */
  function ligarShellCliente(cliente) {
    const raiz = painel().querySelector('.cli-tela') || painel(); if (!raiz.querySelector('.cli-shell')) return;
    raiz.querySelectorAll('[data-nova-gravacao]').forEach(b => b.onclick = ev => { ev.stopPropagation(); modalNovaGravacao(b.dataset.novaGravacao); });
    raiz.querySelectorAll('[data-editar-cli]').forEach(b => b.onclick = ev => { ev.stopPropagation(); modalEditarCliente(b.dataset.editarCli); });
    raiz.querySelectorAll('[data-excluir-cli]').forEach(b => b.onclick = ev => { ev.stopPropagation(); excluirCliente(b.dataset.excluirCli); });
    raiz.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { location.hash = b.dataset.ir; });
    raiz.querySelectorAll('[data-resumo-mes]').forEach(b => b.onclick = () => {
      if (B7.UI.fecharMenus) B7.UI.fecharMenus();
      B7.ResumoMes.abrir(cliente);
    });
    B7.UI.ligarMenus(raiz);
    /* no celular as seções rolam de lado: a ativa fica à vista */
    /* rola SÓ a faixa das abas (scrollIntoView também rolava a página por
       causa do scroll-padding do painel e escondia o cabeçalho no celular) */
    const on = raiz.querySelector('.cli-secoes a.on'), rolo = raiz.querySelector('.cli-secoes-rolo');
    if (on && rolo && rolo.scrollWidth > rolo.clientWidth) {
      rolo.scrollLeft = Math.max(0, on.offsetLeft - (rolo.clientWidth - on.offsetWidth) / 2);
    }
    posicionarIndicador(raiz, cliente.id);
  }
  /* O sublinhado da seção ativa desliza da aba anterior para a nova: a tela
     é redesenhada a cada seção, então ele nasce onde estava (mesmo cliente)
     e anda até o lugar novo. Cliente diferente: nasce já no lugar. */
  let indAnterior = null;
  function posicionarIndicador(raiz, clienteId) {
    const nav = raiz.querySelector('.cli-secoes'), ind = raiz.querySelector('.cli-ind'), on = raiz.querySelector('.cli-secoes a.on');
    if (!nav || !ind || !on) return;
    const x = on.offsetLeft + 10, w = Math.max(0, on.offsetWidth - 20);
    nav.classList.add('com-ind');
    const pos = (px, pw) => { ind.style.transform = 'translate3d(' + px + 'px,0,0)'; ind.style.width = pw + 'px'; };
    if (indAnterior && indAnterior.cli === clienteId && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ind.style.transition = 'none'; pos(indAnterior.x, indAnterior.w);
      ind.offsetWidth;                       /* fixa o ponto de partida */
      ind.style.transition = '';
      requestAnimationFrame(() => pos(x, w));
    } else pos(x, w);
    indAnterior = { cli: clienteId, x, w };
  }

  /* =================================================================
     TROCA DE SEÇÃO SEM RECARREGAR A TELA (03/10, pacote zz)
     Antes, cada aba apagava o painel inteiro (cabeçalho e abas incluídos),
     mostrava um esqueleto de página e redesenhava tudo — no celular
     parecia que o app recarregava a cada toque. Agora:
     • cabeçalho e abas ficam; a aba nova acende e o sublinhado anda já
       no toque, antes da busca terminar;
     • só o corpo troca, deslizando no sentido da aba (direita/esquerda);
     • esqueleto só no corpo e só se a busca passar de ~160ms;
     • seção já visitada (mesmo cliente, últimos 5 min) reaparece na hora
       como estava, e a versão fresca substitui sem piscar quando chega;
     • toque rápido em várias abas: só a última pinta (número de ordem).
     Vale para as seções daqui e para as do js/conteudo.js (Editorial,
     Ideias, Inteligência). Só apresentação — mesmas buscas, mesmos dados.
     ================================================================= */
  let trocaSeq = 0;
  const memoriaSecao = new Map();           /* 'id|secao' → { html, t } */
  const MEMORIA_MS = 5 * 60 * 1000;
  const ordemSecao = k => SECOES_CLIENTE.findIndex(s => s.k === k);
  const reduzMov = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function telaViva(id) {
    const t = painel().querySelector(':scope > .cli-tela');
    return t && t.dataset.cli === String(id) && t.querySelector(':scope > .cli-corpo') ? t : null;
  }
  function guardarSecao(tela) {
    const corpo = tela && tela.querySelector(':scope > .cli-corpo');
    if (!corpo || corpo.classList.contains('cli-esq') || corpo.classList.contains('cli-previa')) return;
    memoriaSecao.set(tela.dataset.cli + '|' + tela.dataset.sec, { html: corpo.innerHTML, t: Date.now() });
    if (memoriaSecao.size > 24) memoriaSecao.delete(memoriaSecao.keys().next().value);
  }
  function marcarAba(tela, id, secao) {
    tela.querySelectorAll('.cli-secoes a').forEach(a => {
      const on = a.getAttribute('href') === hrefSecao(id, secao);
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const on = tela.querySelector('.cli-secoes a.on'), rolo = tela.querySelector('.cli-secoes-rolo');
    if (on && rolo && rolo.scrollWidth > rolo.clientWidth) {
      const alvo = Math.max(0, on.offsetLeft - (rolo.clientWidth - on.offsetWidth) / 2);
      if (rolo.scrollTo) rolo.scrollTo({ left: alvo, behavior: reduzMov() ? 'auto' : 'smooth' }); else rolo.scrollLeft = alvo;
    }
    posicionarIndicador(tela, id);
  }
  /* se a pessoa tinha rolado para baixo, sobe até as abas (o conteúdo
     novo começa logo abaixo delas, não no meio da página) */
  function subirAteAbas(tela) {
    const nav = tela.querySelector('.cli-secoes'), cab = tela.querySelector('.cli-shell'), p = painel();
    if (!nav || !cab) return;
    /* posição natural das abas = fim do cabeçalho + margem (a posição da
       própria aba mente: ela está grudada) */
    const recuo = parseFloat(getComputedStyle(p).paddingTop) || 0;
    const naturalAbas = cab.getBoundingClientRect().bottom - p.getBoundingClientRect().top + p.scrollTop +
      (parseFloat(getComputedStyle(nav).marginTop) || 0);
    const alvo = Math.round(naturalAbas - recuo);
    if (p.scrollTop > alvo + 4) p.scrollTo({ top: Math.max(0, alvo), behavior: reduzMov() ? 'auto' : 'smooth' });
  }
  function prepararSecaoCliente(id, secao, tipoEsq, opEsq) {
    const seq = ++trocaSeq;
    const tela = telaViva(id);
    if (!tela) { esqueleto(tipoEsq, opEsq); return seq; }
    guardarSecao(tela);
    const de = ordemSecao(tela.dataset.sec), para = ordemSecao(secao);
    tela.style.setProperty('--cli-dir', para >= de ? 1 : -1);
    tela.dataset.sec = secao;
    marcarAba(tela, id, secao);
    subirAteAbas(tela);
    const velho = tela.querySelector(':scope > .cli-corpo');
    clearTimeout(velho._esq);
    /* segura a altura durante a troca: a página não "pula" */
    velho.style.minHeight = velho.offsetHeight + 'px';
    const lembrado = memoriaSecao.get(id + '|' + secao);
    const novo = document.createElement('div');
    if (lembrado && Date.now() - lembrado.t < MEMORIA_MS) {
      novo.className = 'cli-corpo cli-previa cli-chega';
      novo.innerHTML = lembrado.html;
    } else {
      novo.className = 'cli-corpo cli-esq';
      novo.innerHTML = B7.UI.skeleton(tipoEsq === 'detalhe' ? 'lista' : tipoEsq, Object.assign({ titulo: false }, opEsq || {}));
    }
    novo.style.minHeight = velho.style.minHeight;
    velho.classList.add('cli-sai');
    const trocar = () => { if (seq === trocaSeq && velho.isConnected) velho.replaceWith(novo); };
    if (novo.classList.contains('cli-previa') || reduzMov()) trocar();
    else velho._esq = setTimeout(trocar, 160);      /* busca rápida: nem chega a mostrar esqueleto */
    return seq;
  }
  /* pinta a seção: corpo novo se o cabeçalho do mesmo cliente está na
     tela; senão a tela inteira (primeira visita ao cliente). Devolve false
     se a pessoa já foi para outra aba (resposta velha não pinta). */
  function pintarSecaoCliente(cliente, secao, corpoHTML, seq, classeTela) {
    if (seq != null && seq !== trocaSeq) return false;
    const cls = 'conteudo cli-tela' + (classeTela ? ' ' + classeTela : '');
    const tela = telaViva(cliente.id);
    if (tela) {
      tela.className = cls;
      tela.dataset.sec = secao;
      /* o cabeçalho fica — mas se o cliente mudou (nome, logo, "atualizado
         há…") ele é trocado no lugar, sem animar */
      const molde = document.createElement('div');
      molde.innerHTML = shellCliente(cliente, secao);
      const cabNovo = molde.querySelector('.cli-shell'), cabVelho = tela.querySelector(':scope > .cli-shell');
      const limpo = el => el.innerHTML.replace(/ data-ligado="1"/g, '');   /* marca do ligarMenus */
      if (cabNovo && cabVelho && limpo(cabNovo) !== limpo(cabVelho)) cabVelho.replaceWith(cabNovo);
      const atual = tela.querySelector(':scope > .cli-corpo');
      clearTimeout(atual._esq);
      const velhoNaTela = atual.classList.contains('cli-sai');   /* esqueleto nem chegou a entrar */
      const vinhaDaMemoria = atual.classList.contains('cli-previa');
      const novo = document.createElement('div');
      novo.className = 'cli-corpo' + (vinhaDaMemoria || reduzMov() ? '' : ' cli-chega');
      novo.innerHTML = corpoHTML;
      atual.replaceWith(novo);
      if (velhoNaTela) novo.classList.add('cli-chega');
      setTimeout(() => { novo.style.minHeight = ''; }, 400);
      return true;
    }
    painel().innerHTML = '<div class="' + cls + ' entra" data-cli="' + esc(cliente.id) + '" data-sec="' + esc(secao) + '">' +
      shellCliente(cliente, secao) + '<div class="cli-corpo">' + corpoHTML + '</div></div>';
    return true;
  }
  /* depois de editar o cliente, o que estava lembrado pode estar velho */
  function esquecerSecoes(id) {
    [...memoriaSecao.keys()].forEach(k => { if (!id || k.startsWith(id + '|')) memoriaSecao.delete(k); });
  }

  async function abrirCliente(id, aba) {
    marcarNav('#/clientes');
    const def = SECOES_CLIENTE.find(s => s.k === aba);
    abaCliente = def && secaoVisivel(def) && !['linhas', 'ideias', 'inteligencia'].includes(aba) ? aba : 'geral';
    const sec = abaCliente;
    /* seção inexistente ou fora do papel da pessoa: mostra a visão geral
       e corrige o endereço, sem gerar outra navegação */
    if (aba && aba !== 'geral' && sec === 'geral') history.replaceState(null, '', hrefSecao(id, 'geral'));
    const seq = prepararSecaoCliente(id, sec, { geral: 'detalhe', gravacoes: 'cards', arquivados: 'cards' }[sec] || 'lista');

    /* cada seção carrega só o que mostra: abrir "Vídeos" não busca
       gravações, roteiros, linhas e status */
    let cliente, gravacoes = [], roteiros = [], linhas = [], semanas = [], lista = null;
    try {
      const [c, g, r] = await Promise.all([
        B7.DB.cliente(id),
        sec === 'geral' || sec === 'gravacoes' ? B7.DB.listarGravacoes(id) : Promise.resolve([]),
        sec === 'geral' || sec === 'roteiros' ? B7.DB.roteirosDoCliente(id, sec === 'roteiros' ? 40 : 5) : Promise.resolve([])
      ]);
      cliente = c; gravacoes = g; roteiros = r;
      if (sec === 'geral') {
        /* extras: se falharem, o resto da visão geral continua de pé */
        [linhas, semanas] = await Promise.all([
          B7.DB.listarLinhas(id).catch(() => []),
          B7.DB.listarStatus({ clienteId: id, limite: 6 }).catch(() => [])
        ]);
      }
      if (sec === 'video') lista = await B7.DB.videoDoCliente(id).catch(e => { console.error(e); return null; });
      if (sec === 'design') lista = await B7.DB.listarDesign({ clienteId: id }).catch(e => { console.error(e); return null; });
      gravacoes.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      if (seq !== trocaSeq) return;            /* a pessoa já foi para outra aba */
      B7.Rota.titulo(sec === 'geral' ? [cliente.nome] : [cliente.nome, def.r]);
    } catch (e) { if (seq !== trocaSeq) return; return erroCliente(e, id); }

    /* métricas do cliente, tiradas dos dados reais dele */
    const conta = st => gravacoes.filter(g => g.status === st).length;
    const emAndamento = conta('Rascunho') + conta('Pronto para gravar');
    const ultima = gravacoes[0];

    if (!pintarSecaoCliente(cliente, sec,
      sec === 'geral' ? visaoGeralCliente(cliente, gravacoes, roteiros, emAndamento, conta, ultima, linhas, semanas)
       : sec === 'gravacoes' ? abaGravacoesCliente(cliente, gravacoes)
       : sec === 'arquivados' ? '<div id="aba-arquivados">' + B7.UI.skeleton('cards', { n: 3, titulo: false }) + '</div>'
       : sec === 'video' ? secaoVideoCliente(cliente, lista)
       : sec === 'design' ? secaoDesignCliente(cliente, lista)
       : abaRoteirosCliente(cliente, roteiros), seq)) return;

    ligar();
    ligarShellCliente(cliente);
    painel().querySelectorAll('[data-abrir-linha]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      location.hash = '#/linha/' + b.dataset.abrirLinha;
    });
    painel().querySelectorAll('[data-abrir-semana]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      location.hash = '#/semana/' + b.dataset.abrirSemana;
    });
    painel().querySelectorAll('[data-nova-semana]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      B7.Semana.modalNovo(b.dataset.novaSemana);
    });
    painel().querySelectorAll('[data-criar-linha]').forEach(b => b.onclick = async e => {
      e.stopPropagation();
      location.hash = '#/cliente/' + b.dataset.criarLinha + '/linhas';
    });
    if (sec === 'geral') {
      const corpo = painel().querySelector('.cli-corpo');
      /* conta só quando a seção entra animada (não ao trocar a lembrança
         pela versão fresca, que já estava na tela) */
      if (corpo && (corpo.classList.contains('cli-chega') || corpo.closest('.entra'))) contarVisaoGeral(corpo);
      painel().querySelectorAll('.vg-tile[tabindex]').forEach(t => t.onkeydown = e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === t) { e.preventDefault(); t.click(); }
      });
    }
    if (sec === 'gravacoes') ligarFiltrosGravacoes(gravacoes);
    if (sec === 'arquivados') carregarArquivadosCliente(id);
    if (sec === 'video' || sec === 'design') ligarFiltroSecao();
    /* Oportunidades do cliente (fase 7): segmentos + próximas datas */
    if (sec === 'geral' && B7.Oportunidades) {
      const cx = painel().querySelector('.cli-corpo');
      if (cx) { const el = document.createElement('div'); el.id = 'cli-oportunidades'; cx.appendChild(el); B7.Oportunidades.secaoCliente(el, id); }
    }
  }

  /* Arquivados do cliente: gravações e linhas editoriais que saíram de
     circulação sem serem excluídas. Nada some, só sai da frente. */
  async function carregarArquivadosCliente(clienteId) {
    const caixa = document.getElementById('aba-arquivados');
    if (!caixa) return;
    let gravs = [], lins = [];
    try {
      [gravs, lins] = await Promise.all([
        B7.DB.listarGravacoes(clienteId, { somenteArquivadas: true }),
        B7.DB.listarLinhas(clienteId, { somenteArquivadas: true }).catch(() => [])
      ]);
    } catch (e) { console.error(e); }

    if (!gravs.length && !lins.length) {
      caixa.innerHTML = estadoB7(IC.gravacoes, 'Nada arquivado neste cliente.',
        'O que for arquivado aparece aqui e pode voltar a qualquer momento.');
      return;
    }
    caixa.innerHTML =
      (lins.length ? '<div class="secao"><div class="secao-topo"><h2>Linhas editoriais</h2>' +
        '<span class="conta">' + lins.length + '</span></div><div class="grade">' +
        lins.map(l => '<div class="card-gravacao spot" data-ir="#/linha/' + esc(l.id) + '">' +
          '<div class="meta"><span>' + esc(l.nome || 'Linha editorial') + '</span>' +
          '<span class="p"></span><span>' + l.total_conteudos + ' conteúdos</span></div>' +
          '<div class="rodape"><span class="chip-revisao criacao">Arquivada</span>' +
          '<button class="b fina contorno" data-desarquivar-linha="' + esc(l.id) + '">Desarquivar</button>' +
          '</div></div>').join('') + '</div></div>' : '') +
      (gravs.length ? '<div class="secao" style="margin-top:20px"><div class="secao-topo">' +
        '<h2>Gravações</h2><span class="conta">' + gravs.length + '</span></div>' +
        '<div class="grade">' + gravs.map(cardGravacao).join('') + '</div></div>' : '');

    ligar();
    caixa.querySelectorAll('[data-desarquivar-linha]').forEach(b => b.onclick = async e => {
      e.stopPropagation();
      try {
        await B7.Save.acao(() => B7.DB.arquivarLinha(b.dataset.desarquivarLinha, false), 'Linha desarquivada');
        carregarArquivadosCliente(clienteId);
      } catch (err) {}
    });
  }

  /* Cliente que não abre (apagado, sem acesso, link velho): diz o que
     houve e oferece o caminho de volta — nada de tela branca */
  function erroCliente(e, id) {
    console.error(e);
    B7.Rota.titulo(['Cliente']);
    const sumiu = e && (e.code === 'PGRST116' || /0 rows|no rows|multiple \(or no\)/i.test(String(e.message || '')));
    painel().innerHTML = '<div class="conteudo entra">' + estadoB7(IC.clientes,
      sumiu ? 'Cliente não encontrado.' : 'Não foi possível abrir este cliente.',
      sumiu ? 'Ele pode ter sido excluído, ou você não tem acesso a ele.' : 'Verifique a conexão e tente de novo.',
      (sumiu ? '' : '<button class="b pri" onclick="B7.Rota.recarregar()">Tentar novamente</button>') +
      (podeIrRota('clientes') ? '<button class="b contorno" onclick="location.hash=\'#/clientes\'">Ver clientes</button>'
        : '<button class="b contorno" onclick="location.hash=\'#/\'">Ir para o início</button>')) +
      '</div>';
  }

  /* ---------- seções Vídeos e Design: lentes sobre os módulos globais.
     Mesmos registros, mesma tela de detalhe; aqui só o recorte do cliente. */
  const IC_SETA = '<svg class="cs-seta" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const dataCurta = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '';
  /* abre no grupo que tem algo: nada em andamento e tudo entregue → Entregues */
  const grupoInicial = (abertos, fechados) => !abertos && fechados ? 'fechados' : 'abertos';
  function filtroSecao(abertos, fechados, rotAbertos, rotFechados) {
    const ini = grupoInicial(abertos, fechados);
    const bt = (k, rot, n) => '<button' + (ini === k ? ' class="on"' : '') + ' data-cs-f="' + k + '" role="tab" aria-selected="' + (ini === k) + '">' + esc(rot) + ' <span>' + n + '</span></button>';
    return '<div class="filtro cs-filtro" role="tablist">' + bt('abertos', rotAbertos, abertos) + bt('fechados', rotFechados, fechados) + '</div>';
  }
  function ligarFiltroSecao() {
    const f = painel().querySelector('.cs-filtro'); if (!f) return;
    f.querySelectorAll('button').forEach(b => b.onclick = () => {
      f.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      painel().querySelectorAll('[data-cs-grupo]').forEach(g => { g.hidden = g.dataset.csGrupo !== b.dataset.csF; });
    });
  }
  function listaSecao(itens, linha, vazio) {
    return itens.length ? '<div class="cs-lista">' + itens.map(linha).join('') + '</div>'
      : '<div class="cs-vazio">' + esc(vazio) + '</div>';
  }
  function erroSecao(titulo) {
    return estadoB7(IC.andamento, 'Não foi possível carregar ' + titulo + '.', 'Verifique a conexão e tente de novo.',
      '<button class="b pri" onclick="B7.Rota.recarregar()">Tentar novamente</button>');
  }

  function secaoVideoCliente(c, lista) {
    if (!lista) return erroSecao('os vídeos');
    if (!lista.length) return estadoB7(IC.play, 'Nenhum vídeo deste cliente ainda.',
      'As demandas de edição aparecem aqui assim que forem criadas na Produção de Vídeo.',
      podeIrRota('video') ? '<button class="b contorno" onclick="location.hash=\'#/video\'">Abrir Produção de Vídeo</button>' : '');
    const fechado = d => d.editing_status === 'entregue' || d.editing_status === 'descartado';
    const abertos = lista.filter(d => !fechado(d))
      .sort((a, b) => String(a.prazo || '9999').localeCompare(String(b.prazo || '9999')));
    const fechados = lista.filter(fechado);
    const atrasa = d => B7.Video && B7.Video.ehAtrasada ? B7.Video.ehAtrasada(d) : false;
    const rot = s => B7.Video && B7.Video.rotuloSituacao ? B7.Video.rotuloSituacao(s) : s;
    const linha = d => {
      const atrasada = !fechado(d) && atrasa(d);
      const quando = fechado(d) ? (d.entregue_em ? 'entregue ' + B7.UI.quando(d.entregue_em) : 'atualizado ' + B7.UI.quando(d.updated_at))
        : d.prazo ? 'prazo ' + dataCurta(d.prazo) : 'sem prazo';
      return '<a class="cs-item" href="#/video/' + esc(d.id) + '?de=cliente">' +
        '<div class="cs-tx"><b>' + esc(d.titulo || 'Sem título') + '</b>' +
          '<small>' + (d.codigo ? esc(d.codigo) + ' · ' : '') + (d.videomaker_nome ? esc(d.videomaker_nome) + ' · ' : 'sem videomaker · ') +
          '<span class="' + (atrasada ? 'cs-atraso' : '') + '">' + esc(atrasada ? 'atrasado · ' + quando : quando) + '</span></small></div>' +
        '<span class="vd-status vd-status-' + esc(d.editing_status) + '">' + esc(rot(d.editing_status)) + '</span>' + IC_SETA +
      '</a>';
    };
    return '<div class="cs-topo">' + filtroSecao(abertos.length, fechados.length, 'Em produção', 'Entregues') +
        (podeIrRota('video') ? '<a class="b fina contorno" href="#/video">Produção de Vídeo</a>' : '') + '</div>' +
      '<div data-cs-grupo="abertos"' + (grupoInicial(abertos.length, fechados.length) === 'abertos' ? '' : ' hidden') + '>' + listaSecao(abertos, linha, 'Nada em produção agora para este cliente.') + '</div>' +
      '<div data-cs-grupo="fechados"' + (grupoInicial(abertos.length, fechados.length) === 'fechados' ? '' : ' hidden') + '>' + listaSecao(fechados, linha, 'Nenhum vídeo entregue ainda.') + '</div>';
  }

  function secaoDesignCliente(c, lista) {
    if (!lista) return erroSecao('as peças de design');
    if (!lista.length) return estadoB7(IC.roteiros, 'Nenhuma peça de design deste cliente ainda.',
      'As peças aparecem aqui quando a linha editorial for enviada para o design.',
      '<button class="b contorno" onclick="location.hash=\'#/cliente/' + esc(c.id) + '/linhas\'">Ver Editorial</button>');
    const D = B7.Design || {};
    const fechado = d => d.status === 'finalizado';
    const abertos = lista.filter(d => !fechado(d))
      .sort((a, b) => String(a.prazo || '9999').localeCompare(String(b.prazo || '9999')));
    const fechados = lista.filter(fechado);
    const hoje = new Date().toISOString().slice(0, 10);
    const linha = d => {
      const atrasada = !fechado(d) && d.prazo && String(d.prazo).slice(0, 10) < hoje;
      const tipo = D.rotuloTipo ? D.rotuloTipo(d.tipo) : 'Peça';
      const quando = fechado(d) ? 'atualizada ' + B7.UI.quando(d.updated_at) : d.prazo ? 'prazo ' + dataCurta(d.prazo) : 'sem prazo';
      return '<a class="cs-item" href="#/design/' + esc(d.id) + '?de=cliente">' +
        '<div class="cs-tx"><b>' + esc(d.titulo || d.conteudo_titulo || 'Sem título') + '</b>' +
          '<small>' + esc(tipo) + (d.linha_nome ? ' · ' + esc(d.linha_nome) : '') + ' · ' +
          '<span class="' + (atrasada ? 'cs-atraso' : '') + '">' + esc(atrasada ? 'atrasada · ' + quando : quando) + '</span></small></div>' +
        '<span class="cs-chip cs-ds-' + esc(d.status) + '">' + esc(D.rotuloStatus ? D.rotuloStatus(d.status) : d.status) + '</span>' + IC_SETA +
      '</a>';
    };
    return '<div class="cs-topo">' + filtroSecao(abertos.length, fechados.length, 'Em andamento', 'Finalizadas') +
        (podeIrRota('design') ? '<a class="b fina contorno" href="#/design">Design</a>' : '') + '</div>' +
      '<div data-cs-grupo="abertos"' + (grupoInicial(abertos.length, fechados.length) === 'abertos' ? '' : ' hidden') + '>' + listaSecao(abertos, linha, 'Nenhuma peça em andamento para este cliente.') + '</div>' +
      '<div data-cs-grupo="fechados"' + (grupoInicial(abertos.length, fechados.length) === 'fechados' ? '' : ' hidden') + '>' + listaSecao(fechados, linha, 'Nenhuma peça finalizada ainda.') + '</div>';
  }

  /* Bloco da linha editorial atual + histórico dos meses anteriores.
     Só aparece quando existe pelo menos uma linha: sem linha, sem ruído. */
  /* =================================================================
     VISÃO GERAL DO CLIENTE — redesenho (pacote zzd, 03/10)
     Pedido do Kevin (vídeo no celular): melhorar a UI/UX e as animações.
     Antes: 4 caixas grandes de número, dois blocos com botão gradiente
     de largura toda (Linha editorial / Status semanal), capa gigante da
     última gravação e "Ações rápidas" repetindo o menu do cabeçalho.
     Agora, de cima para baixo:
     • faixa de números (um cartão, quatro colunas, contando ao entrar);
     • atalhos em pílulas que rolam de lado (o que antes era a lista de
       "Ações rápidas" — mesmas ações, mesmos data-* e handlers);
     • Linha editorial e Status semanal como cartões tocáveis, com anel de
       progresso desenhando-se; meses/semanas anteriores em pílulas;
     • última gravação compacta (selo, nome, meta, situação, ▶) com o
       mesmo menu ⋯ de antes;
     • roteiros numa lista única com divisórias; atividade como linha do
       tempo. Nenhuma ação a menos, nenhum dado a mais.
     ================================================================= */
  const IC_CAL = '<svg viewBox="0 0 24 24" ' + traco + '><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
  const IC_SEMANA = '<svg viewBox="0 0 24 24" ' + traco + '><path d="M4 19V9M9.3 19V5M14.6 19v-7M20 19v-4"/></svg>';
  const IC_DUP = '<svg viewBox="0 0 24 24" ' + traco + '><rect x="8" y="8" width="12.5" height="12.5" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></svg>';
  const IC_SETA_VG = '<svg class="vg-seta" viewBox="0 0 24 24" ' + traco + '><path d="M9 6l6 6-6 6"/></svg>';
  const nomeLinha = l => l.nome || (B7.UI.MESES[l.mes - 1] + ' ' + l.ano);
  /* anel de progresso (0–100), desenha-se ao entrar (CSS) */
  const anel = (p, rot) => '<span class="vg-anel" style="--p:' + Math.max(0, Math.min(100, p)) + '" role="img" aria-label="' + esc(rot) + '">' +
    '<svg viewBox="0 0 36 36" aria-hidden="true"><circle class="vg-anel-f" cx="18" cy="18" r="15.5"/>' +
    '<circle class="vg-anel-v" cx="18" cy="18" r="15.5" pathLength="100"/></svg><b>' + Math.round(p) + '%</b></span>';

  function blocoLinhaEditorial(c, linhas) {
    /* Sem linha nenhuma, o cartão não some: vira o convite para criar. É o
       caminho direto para o planejamento, sem passar por gravações. */
    if (!linhas.length) {
      return '<div class="vg-tile vg-tile-vazio" data-criar-linha="' + esc(c.id) + '" role="button" tabindex="0">' +
        '<span class="vg-tile-ic vg-tom-rosa">' + IC_CAL + '</span>' +
        '<span class="vg-tile-tx"><small>Linha editorial</small><b>Nenhum planejamento ainda</b>' +
        '<em>organize o que este cliente vai publicar no mês</em></span>' +
        '<span class="vg-pilula">+ Criar</span></div>';
    }
    const atual = linhas[0], anteriores = linhas.slice(1, 4);
    const progresso = atual.total_conteudos ? (atual.total_estruturados / atual.total_conteudos) * 100 : 0;
    return '<div class="vg-tile" data-abrir-linha="' + esc(atual.id) + '" role="link" tabindex="0">' +
        '<span class="vg-tile-ic vg-tom-rosa">' + IC_CAL + '</span>' +
        '<span class="vg-tile-tx"><small>Linha editorial atual</small><b>' + esc(nomeLinha(atual)) + '</b>' +
        '<em>' + atual.total_estruturados + ' de ' + atual.total_conteudos + ' conteúdo' + (atual.total_conteudos === 1 ? '' : 's') +
        ' estruturado' + (atual.total_estruturados === 1 ? '' : 's') + '</em></span>' +
        anel(progresso, Math.round(progresso) + '% estruturado') +
      '</div>' +
      (anteriores.length ? '<div class="vg-anteriores"><small>Anteriores</small>' +
        anteriores.map(l => '<button type="button" data-abrir-linha="' + esc(l.id) + '">' + esc(nomeLinha(l)) +
          '<span>' + l.total_conteudos + '</span></button>').join('') + '</div>' : '');
  }

  /* Status semanal: a semana mais recente e o caminho para criar outra.
     Sem virar um segundo dashboard dentro do client home. */
  function blocoStatusSemanal(c, semanas) {
    semanas = semanas || [];
    if (!semanas.length) {
      return '<div class="vg-tile vg-tile-vazio" data-nova-semana="' + esc(c.id) + '" role="button" tabindex="0">' +
        '<span class="vg-tile-ic vg-tom-violeta">' + IC_SEMANA + '</span>' +
        '<span class="vg-tile-tx"><small>Status semanal</small><b>Nenhuma semana registrada</b>' +
        '<em>o acompanhamento de sete dias que vai para o cliente</em></span>' +
        '<span class="vg-pilula">+ Novo</span></div>';
    }
    const atual = semanas[0], anteriores = semanas.slice(1, 4);
    return '<div class="vg-tile" data-abrir-semana="' + esc(atual.id) + '" role="link" tabindex="0">' +
        '<span class="vg-tile-ic vg-tom-violeta">' + IC_SEMANA + '</span>' +
        '<span class="vg-tile-tx"><small>Status semanal</small><b>' +
          esc(B7.DocSemana.periodoTexto(atual.semana_inicio, atual.semana_fim)) + '</b>' +
        '<em>' + atual.total_itens + ' demanda' + (atual.total_itens === 1 ? '' : 's') +
          (atual.total_atencao ? ' · <i class="vg-atencao">' + atual.total_atencao + ' aguardando</i>' : '') +
          ' · ' + esc(atual.situacao || 'Rascunho') + '</em></span>' +
        '<button type="button" class="vg-pilula" data-nova-semana="' + esc(c.id) + '">+ Nova</button>' +
      '</div>' +
      (anteriores.length ? '<div class="vg-anteriores"><small>Anteriores</small>' +
        anteriores.map(w => '<button type="button" data-abrir-semana="' + esc(w.id) + '">' +
          esc(B7.DocSemana.periodoTexto(w.semana_inicio, w.semana_fim)) +
          '<span>' + w.total_itens + '</span></button>').join('') + '</div>' : '');
  }

  /* última gravação compacta: o mesmo destino e o mesmo menu ⋯ do card grande */
  function ultimaCompacta(g) {
    const selo = g.cliente_logo_url ? '<img src="' + esc(g.cliente_logo_url) + '" alt="">' : esc(B7.UI.iniciais(g.cliente_nome));
    return '<div class="vg-ultima" data-gravacao="' + esc(g.id) + '" tabindex="0" role="link">' +
      '<span class="vg-ultima-capa"><i class="vg-ultima-malha"></i><span class="vg-ultima-selo">' + selo + '</span></span>' +
      '<span class="vg-ultima-tx"><small>Última gravação</small><b>' + esc(g.nome) + '</b>' +
        '<span class="vg-ultima-meta">' + metaGravacao(g) + '</span>' +
        '<span class="vg-ultima-chip">' + chipGravacao(g) + '</span></span>' +
      '<span class="vg-play" aria-hidden="true">' + IC.play + '</span>' +
      '<div class="menu"><button class="ico" aria-label="Mais ações da gravação" onclick="event.stopPropagation()">⋯</button>' +
        '<div class="lista"><button data-dup="' + esc(g.id) + '">Duplicar gravação</button>' +
        '<button data-imprimir="' + esc(g.id) + '">Imprimir</button>' +
        '<button data-fixar-grav="' + esc(g.id) + '" data-fixado="' + (g.is_pinned ? '1' : '0') + '">' + (g.is_pinned ? 'Desafixar' : 'Fixar') + '</button>' +
        '<button data-arquivar="' + esc(g.id) + '" data-arq="' + (g.archived_at ? '1' : '0') + '">' + (g.archived_at ? 'Desarquivar' : 'Arquivar') + '</button><hr>' +
        '<button class="perigo" data-excluir="' + esc(g.id) + '" data-nome="' + esc(g.nome) + '">Excluir gravação</button>' +
      '</div></div></div>';
  }

  function visaoGeralCliente(c, gravacoes, roteiros, emAndamento, conta, ultima, linhas, semanas) {
    const numero = (n, rot, tom) => '<div class="vg-num vg-tom-' + tom + '"><b data-vg-conta="' + (+n || 0) + '">' + (+n || 0) + '</b><span>' + rot + '</span></div>';
    const numeros = '<div class="vg-numeros">' +
      numero(gravacoes.length, 'gravações', 'rosa') + numero(c.total_roteiros, 'roteiros', 'violeta') +
      numero(emAndamento, 'em andamento', 'ambar') + numero(conta('Gravado'), 'gravadas', 'verde') + '</div>';
    /* atalhos: o que era "Ações rápidas" (mesmas ações e handlers) */
    const atalho = (attrs, ic, rot, pri) => '<button type="button" class="vg-atalho' + (pri ? ' pri' : '') + '" ' + attrs + '>' + ic + '<span>' + rot + '</span></button>';
    const atalhos = '<div class="vg-atalhos" role="toolbar" aria-label="Atalhos do cliente">' +
      atalho('data-nova-gravacao="' + esc(c.id) + '"', IC.mais, 'Nova gravação', true) +
      (ultima ? atalho('data-gravacao="' + esc(ultima.id) + '"', IC.play, 'Continuar ' + esc(ultima.nome)) +
        atalho('data-imprimir="' + esc(ultima.id) + '"', IC.imprimir, 'Imprimir') +
        atalho('data-dup="' + esc(ultima.id) + '"', IC_DUP, 'Duplicar') : '') +
      atalho('data-editar-cli="' + esc(c.id) + '"', IC.pessoa, 'Editar cliente') + '</div>';
    const planos = '<div class="vg-planos"><div class="vg-plano">' + blocoLinhaEditorial(c, linhas || []) + '</div>' +
      '<div class="vg-plano">' + blocoStatusSemanal(c, semanas) + '</div></div>';
    const topo = numeros + atalhos + planos;

    if (!gravacoes.length) {
      return topo + '<div class="cartao vazio vg-vazio" style="position:relative;overflow:hidden">' +
        '<div class="b7-marca fraca" style="right:24px;bottom:-10px;width:110px;height:110px"></div>' +
        '<div class="ilu">' + IC.gravacoes + '</div>' +
        '<b>Nenhuma gravação ainda</b><p>Crie a primeira gravação deste cliente para começar.</p>' +
        '<button class="b pri" data-nova-gravacao="' + esc(c.id) + '">' + IC.mais + 'Nova gravação</button></div>';
    }

    /* atividade recente: derivada de updated_at, sem inventar histórico */
    const atividade = gravacoes.slice(0, 5).map(g =>
      '<div class="item" data-gravacao="' + esc(g.id) + '"><div class="pt"></div>' +
      '<div class="tx"><b>' + esc(g.nome) + '</b><small>' +
      (g.status === 'Gravado' ? 'marcada como gravada' : 'atualizada') + ' ' + B7.UI.quando(g.updated_at) +
      ' · ' + g.total_roteiros + ' roteiro' + (g.total_roteiros === 1 ? '' : 's') + '</small></div></div>').join('');

    const listaRoteiros = roteiros.length ? '<div class="vg-lista">' + roteiros.map(r =>
      '<div class="roteiro-linha" data-gravacao="' + esc(r.recording_session_id) +
        '" data-roteiro="' + esc(r.id) + '">' +
        '<div class="n">' + String((r.position || 0) + 1).padStart(2, '0') + '</div>' +
        '<div class="tx"><b>' + esc(r.titulo || 'Sem título') + '</b><small>' +
        (r.gravacao ? esc(r.gravacao.nome) + ' · ' : '') + 'editado ' + B7.UI.quando(r.updated_at) + '</small></div>' +
        (r.gravacao ? B7.UI.chipStatus(r.gravacao.status) : '') + IC_SETA_VG + '</div>').join('') + '</div>'
      : '<div class="vazio" style="padding:26px"><b>Nenhum roteiro ainda</b></div>';
    const cab = (titulo, n, aba, rot) => '<div class="vg-sec-cab"><h2>' + titulo + '</h2>' + (n ? '<span class="conta">' + n + '</span>' : '') +
      (aba ? '<button type="button" class="vg-ver" data-aba-cli="' + aba + '">' + rot + IC_SETA_VG + '</button>' : '') + '</div>';

    return topo +
      '<div class="colunas vg-colunas"><div>' +
        ultimaCompacta(ultima) +
        '<div class="secao vg-sec">' + cab('Roteiros recentes', 0, 'roteiros', 'Ver todos') + listaRoteiros + '</div>' +
        (gravacoes.length > 1 ? '<div class="secao vg-sec vg-outras">' + cab('Outras gravações', gravacoes.length - 1, 'gravacoes', 'Ver todas') +
          '<div class="grade">' + gravacoes.slice(1, 4).map(cardGravacao).join('') + '</div></div>' : '') +
      '</div><div class="apoio">' +
        '<div class="bloco vg-atividade"><h3>Atividade recente</h3><div class="atividade">' + atividade + '</div></div>' +
        (c.observacoes ? '<div class="bloco"><h3>Observações</h3>' +
          '<p style="font-size:13px;line-height:1.6;color:var(--ink-2)">' + esc(c.observacoes) + '</p></div>' : '') +
      '</div></div>';
  }
  /* números contam de 0 ao valor quando a visão geral entra */
  function contarVisaoGeral(raiz) {
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    raiz.querySelectorAll('[data-vg-conta]').forEach((el, i) => {
      const fim = +el.dataset.vgConta; if (!(fim > 1)) return;
      const t0 = performance.now() + i * 70, DUR = 800;
      el.textContent = '0';
      const passo = agora => {
        const p = Math.max(0, Math.min(1, (agora - t0) / DUR)), e = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(fim * e));
        if (p < 1 && el.isConnected) requestAnimationFrame(passo); else el.textContent = String(fim);
      };
      requestAnimationFrame(passo);
    });
  }

  function abaGravacoesCliente(c, gravacoes) {
    return '<div class="barra-filtros">' +
        '<div class="filtro" id="filtro-cli-grav">' +
          ['Todas', 'Em andamento', 'Prontas', 'Gravadas'].map((f, i) =>
            '<button data-f="' + esc(f) + '"' + (i === 0 ? ' class="on"' : '') + '>' + esc(f) + '</button>').join('') +
        '</div>' +
        '<input class="campo" id="busca-grav" placeholder="Buscar gravações…">' +
        '<div class="espaco" style="flex:1"></div>' +
        '<button class="b pri" data-nova-gravacao="' + esc(c.id) + '">' + IC.mais + 'Nova gravação</button>' +
      '</div>' +
      (gravacoes.length
        ? '<div class="grade" id="lista-grav-cli">' + gravacoes.map(cardGravacao).join('') + '</div>'
        : '<div class="cartao vazio"><div class="ilu">' + IC.gravacoes + '</div><b>Nenhuma gravação ainda</b>' +
          '<p>Crie a primeira gravação deste cliente para começar.</p>' +
          '<button class="b pri" data-nova-gravacao="' + esc(c.id) + '">' + IC.mais + 'Nova gravação</button></div>');
  }

  function ligarFiltrosGravacoes(gravacoes) {
    const mapa = { 'Todas': null, 'Em andamento': 'Rascunho', 'Prontas': 'Pronto para gravar', 'Gravadas': 'Gravado' };
    let filtro = 'Todas', termo = '';
    const aplicar = () => {
      let lista = gravacoes.slice();
      if (mapa[filtro]) lista = lista.filter(g => g.status === mapa[filtro]);
      if (termo) lista = lista.filter(g => g.nome.toLowerCase().includes(termo));
      const cx = document.getElementById('lista-grav-cli');
      if (!cx) return;
      cx.innerHTML = lista.length ? lista.map(cardGravacao).join('')
        : '<div class="vazio" style="grid-column:1/-1"><b>Nada por aqui</b><p>Tente outro filtro ou outra busca.</p></div>';
      ligar();
    };
    const f = document.getElementById('filtro-cli-grav');
    if (f) f.querySelectorAll('button').forEach(b => b.onclick = () => {
      f.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); filtro = b.dataset.f; aplicar();
    });
    const busca = document.getElementById('busca-grav');
    if (busca) busca.oninput = () => { termo = busca.value.trim().toLowerCase(); aplicar(); };
  }

  function abaRoteirosCliente(c, roteiros) {
    if (!roteiros.length) {
      return '<div class="cartao vazio"><div class="ilu">' + IC.roteiros + '</div>' +
        '<b>Nenhum roteiro ainda</b><p>Crie uma gravação e comece a escrever.</p>' +
        '<button class="b pri" data-nova-gravacao="' + esc(c.id) + '">' + IC.mais + 'Nova gravação</button></div>';
    }
    /* mesma lista única da visão geral (zzd) */
    return '<div class="vg-lista">' + roteiros.map(r =>
      '<div class="roteiro-linha" data-gravacao="' + esc(r.recording_session_id) +
        '" data-roteiro="' + esc(r.id) + '">' +
        '<div class="n">' + String((r.position || 0) + 1).padStart(2, '0') + '</div>' +
        '<div class="tx"><b>' + esc(r.titulo || 'Sem título') + '</b><small>' +
        (r.gravacao ? esc(r.gravacao.nome) + ' · ' : '') + 'editado ' + B7.UI.quando(r.updated_at) + '</small></div>' +
        (r.gravacao ? B7.UI.chipStatus(r.gravacao.status) : '') + IC_SETA_VG + '</div>').join('') + '</div>';
  }


  /* =================================================== CONFIGURAÇÕES */
  /* Uma pergunta só decide o que aparece: a regra vive em B7.Perm. */
  const pode = secao => !B7.Perm || B7.Perm.podeConfig(secao);

  /* Redesenho (03/10, pacote zza): lista agrupada no jeito dos Ajustes do
     celular — perfil no topo, grupos com ícone colorido, chave liga/
     desliga para o que é sim/não, seletor com pílula que desliza, linhas
     com seta para o que abre outra coisa e "Sair" em vermelho no fim.
     Mesmas preferências, mesmas permissões (pode()), mesmas ações.
     No celular some o que só existe no computador (barra lateral e
     atalhos de teclado). */
  const ICF = {
    tema: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
    tela: '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M9 20.5h6M12 16.5v4"/>',
    densidade: '<rect x="3.5" y="4" width="17" height="6.5" rx="1.8"/><rect x="3.5" y="13.5" width="17" height="6.5" rx="1.8"/>',
    raio: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
    animacao: '<path d="M11 3.5l1.7 4.5 4.6 1.7-4.6 1.7L11 16l-1.7-4.6L4.7 9.7l4.6-1.7z"/><path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    som: '<path d="M11 5.5L6.5 9H3.5v6h3l4.5 3.5z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18.3 6.2a8.5 8.5 0 0 1 0 11.6"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10.2 8.6l5.4 3.4-5.4 3.4z"/>',
    lateral: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>',
    teclado: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8"/>',
    impressao: '<path d="M7 9V3.5h10V9"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>',
    usuarios: '<path d="M15.5 19v-1.3a3.8 3.8 0 0 0-3.8-3.8H6.3a3.8 3.8 0 0 0-3.8 3.8V19"/><circle cx="9" cy="7.3" r="3.3"/><path d="M21.5 19v-1.3a3.8 3.8 0 0 0-2.8-3.6M15.7 4.1a3.3 3.3 0 0 1 0 6.4"/>',
    banco: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13"/><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    exportar: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M4.5 16.5v2.5A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5"/>',
    importar: '<path d="M12 14.5v-11M7.5 8L12 3.5 16.5 8"/><path d="M4.5 16.5v2.5A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5"/>',
    versao: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2M12 7.8h.01"/>',
    rede: '<path d="M2.5 8.8a14 14 0 0 1 19 0M5.5 12.2a9.5 9.5 0 0 1 13 0M8.7 15.5a5 5 0 0 1 6.6 0"/><path d="M12 19.2h.01"/>',
    acesso: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    sair: '<path d="M14.5 4h4A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>'
  };
  const svgF = k => '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICF[k] + '</svg>';
  const SETA_CFG = '<svg class="cfg-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const PAPEL_CFG = { admin: 'Administrador', coordenador: 'Coordenação', designer: 'Designer', videomaker: 'Videomaker', cliente: 'Cliente' };

  function descAnimacoes() {
    if (!B7.Desempenho.animacoesLigadas()) return 'desligadas: tudo aparece na hora, sem movimento';
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'o sistema do aparelho pede movimento reduzido' : 'transições, voo dos cartões e abertura';
  }
  function descDesempenho() {
    const e = B7.Desempenho.estado();
    if (e.modo === 'leve') return 'sem vidro desfocado: mais fluido';
    if (e.modo === 'completo') return 'vidro em tudo, mesmo se travar';
    return e.leve ? 'agora: leve — este aparelho travava com o vidro' : 'agora: completo — fica leve sozinho se travar';
  }

  function abrirConfig() {
    marcarNav('#/config');
    B7.Rota.titulo(['Configurações']);
    /* sem escolha guardada = segue o sistema (antes "Sistema" nunca
       aparecia marcado, porque o atributo é sempre light/dark) */
    let temaGuardado = null; try { temaGuardado = localStorage.getItem('b7_tema'); } catch (e) {}
    const tema = temaGuardado ? document.documentElement.getAttribute('data-theme') : 'auto';
    const densidade = B7.pref.ler('densidade', 'confortavel');
    const abertura = B7.pref.ler('abertura', false);
    const recolhida = document.body.classList.contains('recolhida');
    const online = navigator.onLine;
    const u = B7.Auth && B7.Auth.usuario();
    const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ic = (k, tom) => '<span class="cfg-ic cfg-tom-' + tom + '">' + svgF(k) + '</span>';
    /* uma linha da lista: ícone, texto, e à direita o controle (ou a seta) */
    const L = o => {
      const tag = o.botao ? 'button type="button"' : 'div';
      return '<' + tag + ' class="cfg-l' + (o.cls ? ' ' + o.cls : '') + '"' + (o.attrs || '') + '>' +
        ic(o.ic, o.tom) +
        '<span class="cfg-l-tx"><b>' + o.t + '</b>' + (o.d ? '<small>' + o.d + '</small>' : '') + '</span>' +
        (o.dir || '') + (o.botao && !o.semSeta ? SETA_CFG : '') +
        '</' + (o.botao ? 'button' : 'div') + '>' + (o.abaixo ? '<div class="cfg-l-abaixo">' + o.abaixo + '</div>' : '');
    };
    /* chave liga/desliga (a linha inteira alterna) */
    const chave = (pref, ligada, rot) => '<span class="cfg-sw' + (ligada ? ' on' : '') + '" role="switch" tabindex="0" aria-checked="' + ligada +
      '" aria-label="' + esc(rot) + '" data-chave="' + pref + '"><i></i></span>';
    /* seletor com pílula deslizante */
    const seletor = (grupo, atual, itens) =>
      '<div class="cfg-seg" data-grupo="' + grupo + '" role="radiogroup"><i class="cfg-seg-pill" aria-hidden="true"></i>' + itens.map(([v, r, icone]) =>
        '<button type="button" role="radio" data-v="' + v + '" aria-checked="' + (atual === v) + '"' + (atual === v ? ' class="on"' : '') + '>' +
        (icone ? svgF(icone) : '') + '<span>' + r + '</span></button>').join('') + '</div>';
    const grupo = (titulo, nota, linhas, cls) => linhas ?
      '<section class="cfg-g' + (cls ? ' ' + cls : '') + '">' + (titulo ? '<h2 class="cfg-g-t">' + titulo + '</h2>' : '') +
        '<div class="cfg-lista">' + linhas + '</div>' + (nota ? '<p class="cfg-g-nota">' + nota + '</p>' : '') + '</section>' : '';

    painel().innerHTML = '<div class="conteudo entra cfg-tela">' +
      '<div class="trilha-nav cfg-so-largo"><button data-ir="#/">Central B7</button><span>/</span><b>Configurações</b></div>' +
      '<h1 class="cfg-titulo">Configurações</h1>' +

      /* Conta no topo: quem está usando, e o atalho para o perfil */
      (u ? '<button type="button" class="cfg-perfil" data-abrir-perfil>' +
        (B7.UI.avatarPessoa ? B7.UI.avatarPessoa(u, 'cfg-perfil-av') : '') +
        '<span class="cfg-perfil-tx"><b>' + esc(u.nome || u.username || '') + '</b>' +
        '<small>@' + esc(u.username || '') + ' · ' + esc(PAPEL_CFG[u.papel] || u.papel || '') + '</small>' +
        '<em>Editar perfil e senha</em></span>' + SETA_CFG + '</button>' : '') +

      grupo('Aparência', 'Vale só para este aparelho — cada pessoa da equipe ajusta o seu.',
        L({ ic: 'tema', tom: 'violeta', t: 'Tema',
            abaixo: seletor('tema', tema, [['light', 'Claro', 'sol'], ['dark', 'Escuro', 'tema'], ['auto', 'Sistema', 'tela']]) }) +
        L({ ic: 'densidade', tom: 'azul', t: 'Densidade', d: 'quanto conteúdo cabe na tela',
            abaixo: seletor('densidade', densidade, [['confortavel', 'Confortável'], ['compacta', 'Compacta']]) }) +
        /* zzz6: desligar de verdade (antes só mostrava o que o sistema dizia) */
        (B7.Desempenho && B7.Desempenho.animacoesLigadas
          ? L({ ic: 'animacao', tom: 'rosa', t: 'Animações', cls: 'cfg-alterna',
                d: '<span id="cfg-anim-d">' + descAnimacoes() + '</span>',
                dir: chave('animacoes', B7.Desempenho.animacoesLigadas(), 'Animações ligadas') })
          : L({ ic: 'animacao', tom: 'rosa', t: 'Animações', d: 'segue a preferência do seu sistema',
                dir: '<span class="cfg-valor">' + (reduz ? 'Reduzidas' : 'Normais') + '</span>' })) +
        /* modo leve (js/desempenho.js): vidro sólido onde o aparelho trava */
        (B7.Desempenho ? L({ ic: 'raio', tom: 'laranja', t: 'Desempenho', d: '<span id="cfg-desemp-d">' + descDesempenho() + '</span>',
            abaixo: seletor('desempenho', B7.Desempenho.modo(), [['auto', 'Automático'], ['leve', 'Leve'], ['completo', 'Completo']]) }) : '')) +

      /* a abertura completa aparece uma vez por sessão; aqui dá para
         rever (com som — o toque no botão destrava o áudio) */
      grupo('Abertura', '',
        L({ ic: 'som', tom: 'laranja', t: 'Trilha sonora', d: 'som na animação de entrada', cls: 'cfg-alterna',
            dir: chave('som_abertura', !!B7.pref.ler('som_abertura', true), 'Trilha sonora da abertura') }) +
        L({ ic: 'play', tom: 'rosa', t: 'Ver abertura', d: 'assistir de novo, com som', botao: true, attrs: ' data-ver-abertura' })) +

      (pode('interface') ? grupo('Interface', '',
        L({ ic: 'lateral', tom: 'cinza', t: 'Começar com a barra recolhida', d: 'só os ícones na lateral', cls: 'cfg-alterna',
            dir: chave('sidebar', recolhida, 'Barra lateral recolhida') }) +
        L({ ic: 'teclado', tom: 'cinza', t: 'Atalhos de teclado', d: 'a lista completa', botao: true, attrs: ' data-atalhos' }),
        'cfg-so-largo') : '') +

      (pode('impressao') ? grupo('Impressão', 'A ficha A4 não muda com o tema: ela é sempre clara.',
        L({ ic: 'impressao', tom: 'verde', t: 'Folha de abertura', d: 'já vem marcada na janela de impressão', cls: 'cfg-alterna',
            dir: chave('abertura', !!abertura, 'Folha de abertura marcada por padrão') })) : '') +

      /* Diagnóstico do acesso: aparece enquanto não há sessão, e diz
         exatamente qual etapa falta. */
      (B7.Auth && !B7.Auth.usuario() ? grupo('Acesso', 'Situação da autenticação nesta instalação.',
        '<div class="cfg-l cfg-l-livre">' + ic('acesso', 'cinza') + '<div id="cfg-acesso" class="cfg-l-tx"><div class="cfg-estado">' +
        '<span class="cfg-ponto"></span><span>Verificando…</span></div></div></div>') : '') +

      /* a seção só existe para admin: nada de item com cadeado */
      (pode('usuarios') ? grupo('Administração', 'Contas da equipe e dos clientes. Não existe cadastro público.',
        L({ ic: 'usuarios', tom: 'azul', t: 'Usuários e acessos', d: 'criar, redefinir senha, vincular empresas, desativar',
            botao: true, attrs: ' data-ir="#/usuarios"' })) : '') +

      /* Banco, backup e sistema são do administrador. */
      (pode('banco') || pode('sistema') ? grupo('Sistema', '',
        (pode('banco') ? '<div id="cfg-banco">' + L({ ic: 'banco', tom: 'verde', t: 'Banco de dados', d: 'verificando…',
            dir: '<span class="cfg-ponto pulsa"></span>' }) + '</div>' : '') +
        (pode('sistema') ? L({ ic: 'rede', tom: 'azul', t: 'Conexão deste aparelho',
            d: online ? 'tudo certo por aqui' : 'reconecte para voltar a salvar',
            dir: '<span class="cfg-valor ' + (online ? 'ok' : 'erro') + '">' + (online ? 'Online' : 'Sem conexão') + '</span>' }) +
          /* versão do código carregado — só o administrador vê (conferir deploy) */
          (B7.Auth && B7.Auth.papel && B7.Auth.papel() === 'admin'
            ? L({ ic: 'versao', tom: 'cinza', t: 'Versão', d: 'se não mudou após publicar, recarregue a página',
                  dir: '<code class="cfg-versao">v' + esc(B7.Auth.VERSAO || '') + '</code>' }) : '') : '')) : '') +

      (pode('dados') ? grupo('Backup', 'O banco é o Supabase. O arquivo de backup é segurança extra.',
        L({ ic: 'exportar', tom: 'violeta', t: 'Exportar backup', d: 'clientes, gravações, roteiros e cenas', botao: true, attrs: ' data-exportar' }) +
        L({ ic: 'importar', tom: 'laranja', t: 'Restaurar de um arquivo', d: 'devolve os registros de um backup', botao: true, attrs: ' data-importar' })) : '') +

      (u ? grupo('', 'Encerra a sessão só neste aparelho.',
        L({ ic: 'sair', tom: 'vermelho', t: 'Sair da conta', botao: true, semSeta: true, cls: 'cfg-perigo', attrs: ' data-sair-config' })) : '') +
    '</div>';

    ligar();
    const p = painel();
    const btPerfil = p.querySelector('[data-abrir-perfil]');
    if (btPerfil) btPerfil.onclick = () => B7.Perfil.abrir();
    const btSair = p.querySelector('[data-sair-config]');
    if (btSair) btSair.onclick = () => B7.Auth.sair();

    /* seletores: a pílula desliza até a opção escolhida */
    const moverPilula = (cx, anima) => {
      const on = cx.querySelector('button.on'), pill = cx.querySelector('.cfg-seg-pill');
      if (!on || !pill) return;
      if (!anima) pill.style.transition = 'none';
      pill.style.width = on.offsetWidth + 'px';
      pill.style.transform = 'translate3d(' + on.offsetLeft + 'px,0,0)';
      if (!anima) { pill.offsetWidth; pill.style.transition = ''; }
    };
    p.querySelectorAll('.cfg-seg').forEach(cx => {
      moverPilula(cx, false);
      cx.querySelectorAll('button').forEach(b => b.onclick = () => {
        if (b.classList.contains('on')) return;
        cx.querySelectorAll('button').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
        b.classList.add('on'); b.setAttribute('aria-checked', 'true');
        moverPilula(cx, true);
        const g = cx.dataset.grupo, v = b.dataset.v;
        if (g === 'tema') {
          /* mesma função do menu da conta: um lugar só decide o tema */
          if (B7.definirTema) B7.definirTema(v === 'auto' ? 'sistema' : v);
        }
        if (g === 'desempenho' && B7.Desempenho) {
          B7.Desempenho.definir(v);
          const d = p.querySelector('#cfg-desemp-d'); if (d) d.textContent = descDesempenho();
        }
        if (g === 'densidade') {
          B7.aplicarDensidade(v);
          /* a densidade muda o tamanho das letras: a pílula se ajusta */
          requestAnimationFrame(() => p.querySelectorAll('.cfg-seg').forEach(x => moverPilula(x, false)));
        }
      });
    });
    const aoRedimensionar = () => p.querySelectorAll('.cfg-seg').forEach(x => moverPilula(x, false));
    window.addEventListener('resize', aoRedimensionar);
    B7.Rota.aoSair(() => window.removeEventListener('resize', aoRedimensionar));

    /* chaves: a linha inteira alterna; mesmas preferências de antes */
    const alternar = sw => {
      const v = !sw.classList.contains('on');
      sw.classList.toggle('on', v); sw.setAttribute('aria-checked', String(v));
      const pref = sw.dataset.chave;
      if (pref === 'sidebar') {
        document.body.classList.toggle('recolhida', v);
        B7.pref.gravar('sidebar_recolhida', v);
      }
      if (pref === 'abertura') B7.pref.gravar('abertura', v);
      if (pref === 'animacoes' && B7.Desempenho) {
        B7.Desempenho.definirAnimacoes(v);
        const d = p.querySelector('#cfg-anim-d'); if (d) d.textContent = descAnimacoes();
      }
      if (pref === 'som_abertura') B7.pref.gravar('som_abertura', v);
    };
    p.querySelectorAll('.cfg-alterna').forEach(l => {
      const sw = l.querySelector('.cfg-sw');
      l.onclick = () => alternar(sw);
      sw.onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); alternar(sw); } };
    });

    const va = p.querySelector('[data-ver-abertura]');
    if (va) va.onclick = () => { if (B7.reverAbertura) B7.reverAbertura(); };
    const at = p.querySelector('[data-atalhos]'); if (at) at.onclick = () => B7.UI.atalhos();
    if (pode('banco')) desenharBanco();
    desenharAcesso();
    const ex = p.querySelector('[data-exportar]'); if (ex) ex.onclick = () => B7.Backup.exportar();
    const im = p.querySelector('[data-importar]'); if (im) im.onclick = () => B7.Backup.importar();
  }


  /* ============================ ARQUIVO, LIXEIRA, FIXADOS E ATIVIDADE */
  async function arquivarGravacao(id, arquivar) {
    try {
      await B7.Save.acao(() => B7.DB.arquivar(id, arquivar));
      B7.DB.registrar({ tipo: arquivar ? 'arquivar' : 'restaurar', entidade: 'gravacao', id: id,
        texto: arquivar ? 'Gravação arquivada' : 'Gravação restaurada do arquivo' });
      B7.UI.toast(arquivar ? 'Gravação arquivada' : 'Gravação restaurada', {
        acao: 'Desfazer',
        aoClicar: async () => {
          await B7.Save.acao(() => B7.DB.arquivar(id, !arquivar));
          B7.Rota.recarregar();
        }
      });
      if (location.hash.startsWith('#/gravacao/')) location.hash = '#/';
      else B7.Rota.recarregar();
    } catch (e) {}
  }

  /* excluir agora manda para a lixeira; o registro continua no banco */
  async function paraLixeira(tabela, id, rotulo) {
    try {
      await B7.Save.acao(() => B7.DB.paraLixeira(tabela, id));
      B7.DB.registrar({ tipo: 'lixeira', entidade: tabela, id: id, texto: rotulo + ' movido para a lixeira' });
      B7.UI.toast('Movido para a lixeira', {
        acao: 'Desfazer',
        aoClicar: async () => {
          await B7.Save.acao(() => B7.DB.restaurar_(tabela, id), 'Restaurado');
          B7.Rota.recarregar();
        }
      });
      if (location.hash.startsWith('#/gravacao/')) location.hash = '#/';
      else B7.Rota.recarregar();
    } catch (e) {}
  }

  async function abrirLixeira() {
    marcarNav('#/lixeira');
    B7.Rota.titulo(['Lixeira']);
    esqueleto('lista', { n: 5 });
    let dados;
    try { dados = await B7.DB.lixeira(); } catch (e) { return erro(e, 'abrirLixeira'); }

    const itens = []
      .concat(dados.gravacoes.map(g => ({ tabela: 'gravacoes', id: g.id, nome: g.nome,
        tipo: 'Gravação', cliente: g.cliente_nome, quando: g.deleted_at })))
      .concat(dados.roteiros.map(r => ({ tabela: 'roteiros', id: r.id, nome: r.titulo || 'Sem título',
        tipo: 'Roteiro', cliente: '', quando: r.deleted_at })))
      .concat(dados.clientes.map(c => ({ tabela: 'clientes', id: c.id, nome: c.nome,
        tipo: 'Cliente', cliente: '', quando: c.deleted_at })))
      .sort((a, b) => String(b.quando).localeCompare(String(a.quando)));

    painel().innerHTML = '<div class="conteudo entra">' +
      '<div class="trilha-nav"><button data-ir="#/">Central B7</button><span>/</span><b>Lixeira</b></div>' +
      '<div class="secao-topo"><h2 style="font-size:22px">Lixeira</h2>' +
      '<span class="conta">' + itens.length + '</span></div>' +
      '<p style="font-size:12.5px;color:var(--ink-3);margin-bottom:16px">' +
      'Nada aqui foi apagado do banco. Restaure quando quiser — ou exclua em definitivo, ' +
      'que aí não tem volta.</p>' +
      (itens.length ? '<div class="lista-gravacoes">' + itens.map(i =>
        '<div class="linha-gravacao" style="cursor:default">' +
          '<span class="chip-status rascunho">' + i.tipo + '</span>' +
          '<div class="nm"><b>' + esc(i.nome) + '</b><small>' +
          (i.cliente ? esc(i.cliente) + ' · ' : '') + 'excluído ' + B7.UI.quando(i.quando) + '</small></div>' +
          '<button class="b fina contorno" data-restaurar="' + esc(i.tabela) + ':' + esc(i.id) + '">Restaurar</button>' +
          '<button class="b fina perigo" data-apagar="' + esc(i.tabela) + ':' + esc(i.id) + '" ' +
            'data-nome="' + esc(i.nome) + '">Excluir</button>' +
        '</div>').join('') + '</div>'
        : estadoB7(IC.gravacoes, 'A lixeira está vazia.',
                   'O que você excluir aparece aqui antes de sumir de vez.')) +
      '</div>';

    ligar();
    painel().querySelectorAll('[data-restaurar]').forEach(b => b.onclick = async () => {
      const [tabela, id] = b.dataset.restaurar.split(':');
      try {
        await B7.Save.acao(() => B7.DB.restaurar_(tabela, id), 'Restaurado');
        B7.DB.registrar({ tipo: 'restaurar', entidade: tabela, id: id, texto: 'Restaurado da lixeira' });
        abrirLixeira();
      } catch (e) {}
    });
    painel().querySelectorAll('[data-apagar]').forEach(b => b.onclick = () => {
      const [tabela, id] = b.dataset.apagar.split(':');
      B7.UI.confirmar({
        titulo: 'Excluir permanentemente?',
        texto: '“' + b.dataset.nome + '” será apagado do banco junto com tudo que depende dele. ' +
               'Esta ação não pode ser desfeita.',
        rotulo: 'Excluir para sempre', perigo: true,
        aoConfirmar: async () => {
          try {
            await B7.Save.acao(() => B7.DB.excluirDefinitivo(tabela, id), 'Excluído permanentemente');
            abrirLixeira();
          } catch (e) {}
        }
      });
    });
  }

  async function abrirArquivados() {
    marcarNav('#/arquivados');
    B7.Rota.titulo(['Arquivados']);
    esqueleto('cards', { n: 4 });
    let gravacoes;
    try { gravacoes = await B7.DB.listarGravacoes(null, { somenteArquivadas: true }); }
    catch (e) { return erro(e, 'abrirArquivados'); }

    painel().innerHTML = '<div class="conteudo entra">' +
      '<div class="trilha-nav"><button data-ir="#/">Central B7</button><span>/</span><b>Arquivados</b></div>' +
      '<div class="secao-topo"><h2 style="font-size:22px">Arquivados</h2>' +
      '<span class="conta">' + gravacoes.length + '</span></div>' +
      (gravacoes.length ? '<div class="grade">' + gravacoes.map(cardGravacao).join('') + '</div>'
        : estadoB7(IC.gravacoes, 'Nenhuma gravação arquivada.',
                   'Arquive o que já saiu do ar para limpar a Central sem perder nada.')) +
      '</div>';
    ligar();
  }

  /* ------------------------------------------- atividade (timeline) */
  function timeline(lista) {
    if (!lista.length) return '<div class="vazio" style="padding:26px"><b>Nenhuma atividade recente.</b></div>';
    const hora = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    /* rótulo do que aconteceu, para não depender só da frase gravada */
    const ROTULO = { linha: 'LINHA EDITORIAL', conteudo: 'CONTEÚDO', onboarding: 'ONBOARDING',
                     pilar: 'PILAR', gravacao: 'GRAVAÇÃO', roteiro: 'ROTEIRO', cliente: 'CLIENTE' };
    const destino = a => {
      if (a.entity_type === 'linha' && a.entity_id) return '#/linha/' + a.entity_id;
      if (a.entity_type === 'conteudo' && a.client_id) return '#/cliente/' + a.client_id + '/linhas';
      /* onboarding saiu do produto (02/10): o registro antigo continua no
         histórico com o rótulo, e leva para o cliente */
      if (a.recording_id) return '#/gravacao/' + a.recording_id;
      if (a.client_id) return '#/cliente/' + a.client_id;
      return '';
    };
    return '<div class="linha-tempo">' + lista.map(a => {
      const ir = destino(a);
      return '<div class="tl-item' + (ir ? ' clicavel' : '') + '"' +
        (ir ? ' data-ir="' + esc(ir) + '"' : '') + '><div class="tl-pt"></div>' +
        '<div class="tl-tx"><small>' + hora(a.created_at) + ' · ' + B7.UI.quando(a.created_at) +
        (ROTULO[a.entity_type] ? ' · ' + ROTULO[a.entity_type] : '') + '</small>' +
        '<b>' + esc(a.description || a.action_type) + '</b></div></div>';
    }).join('') + '</div>';
  }

  /* ---- apoio para a Central de Conteúdo ---- */
  function trilhaCliente(cliente, atual) {
    return '<div class="trilha-nav"><button data-ir="#/">Central B7</button><span>/</span>' +
      '<button data-ir="#/clientes">Clientes</button><span>/</span>' +
      '<button data-ir="#/cliente/' + esc(cliente.id) + '">' + esc(cliente.nome) + '</button>' +
      '<span>/</span><b>' + esc(atual) + '</b></div>';
  }
  function erroConteudo(e, clienteId) {
    console.error(e);
    painel().innerHTML = '<div class="conteudo entra">' + estadoB7(IC.gravacoes,
      'Não foi possível carregar esta área.',
      'Se você acabou de atualizar o sistema, rode o migration_vcontent.sql no Supabase.',
      '<button class="b pri" onclick="location.reload()">Tentar novamente</button>' +
      '<button class="b contorno" onclick="location.hash=\'#/cliente/' + esc(clienteId) + '\'">Voltar ao cliente</button>') +
      '</div>';
  }

  /* ====================================================== interações */
  function marcarNav(rota) {
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.dataset.ir === rota));
    if (B7.moverTrilha) B7.moverTrilha();
    /* sanfona da barra: abre o grupo da tela atual */
    if (B7.Nav && B7.Nav.sincronizar) B7.Nav.sincronizar(false);
    /* o topo acompanha: contexto no celular e a ordem/estilo do "Criar" */
    if (B7.Topo) B7.Topo.contexto();
  }

  function ligar() {
    const p = painel();
    /* dentro do hub do cliente, a gravação sabe voltar para ele */
    const naCli = !!p.querySelector('.cli-shell');
    p.querySelectorAll('[data-gravacao]').forEach(el => {
      const abrir = () => {
        const r = el.dataset.roteiro;
        location.hash = '#/gravacao/' + el.dataset.gravacao + (r ? '?roteiro=' + r : naCli ? '?de=cliente' : '');
      };
      el.onclick = ev => { if (!ev.target.closest('.menu')) abrir(); };
      /* cards focáveis abrem com Enter, como um link */
      if (el.getAttribute('tabindex') === '0') el.onkeydown = ev => { if (ev.key === 'Enter') abrir(); };
    });
    p.querySelectorAll('[data-cliente]').forEach(el => el.onclick = ev => {
      if (ev.target.closest('button')) return;
      location.hash = '#/cliente/' + el.dataset.cliente;
    });
    p.querySelectorAll('[data-ir]').forEach(el => el.onclick = () => location.hash = el.dataset.ir);
    /* "Ver todas/todos" da visão geral: vai para a seção, com endereço */
    p.querySelectorAll('[data-aba-cli]').forEach(b => b.onclick = () => {
      const cli = location.hash.split('?')[0].split('/')[2];
      if (cli) location.hash = hrefSecao(cli, b.dataset.abaCli);
    });
    p.querySelectorAll('[data-nova-gravacao]').forEach(b => b.onclick = ev => {
      ev.stopPropagation();
      modalNovaGravacao(b.dataset.novaGravacao || undefined);
    });
    p.querySelectorAll('[data-novo-cliente]').forEach(b => b.onclick = ev => {
      ev.stopPropagation(); modalNovoCliente();
    });
    p.querySelectorAll('[data-dup]').forEach(b => b.onclick = ev => { ev.stopPropagation(); duplicarGravacao(b.dataset.dup); });
    p.querySelectorAll('[data-excluir]').forEach(b => b.onclick = ev => {
      ev.stopPropagation(); excluirGravacao(b.dataset.excluir, b.dataset.nome);
    });
    p.querySelectorAll('[data-arquivar]').forEach(b => b.onclick = ev => {
      ev.stopPropagation(); arquivarGravacao(b.dataset.arquivar, b.dataset.arq !== '1');
    });
    p.querySelectorAll('[data-fixar-grav]').forEach(b => b.onclick = async ev => {
      ev.stopPropagation();
      const fixado = b.dataset.fixado === '1';
      try {
        await B7.Save.acao(() => B7.DB.fixar('gravacoes', b.dataset.fixarGrav, !fixado),
          fixado ? 'Removido dos fixados' : 'Adicionado aos fixados');
        B7.Rota.recarregar();
      } catch (e) {}
    });
    p.querySelectorAll('[data-abrir-cli]').forEach(b => b.onclick = ev => {
      ev.stopPropagation(); location.hash = '#/cliente/' + b.dataset.abrirCli;
    });
    p.querySelectorAll('[data-editar-cli]').forEach(b => b.onclick = ev => {
      ev.stopPropagation(); modalEditarCliente(b.dataset.editarCli);
    });
    p.querySelectorAll('[data-excluir-cli]').forEach(b => b.onclick = ev => {
      ev.stopPropagation(); excluirCliente(b.dataset.excluirCli);
    });
    p.querySelectorAll('[data-imprimir]').forEach(b => b.onclick = ev => {
      ev.stopPropagation();
      location.hash = '#/gravacao/' + b.dataset.imprimir + '?imprimir=1';
    });
    p.querySelectorAll('[data-fixar]').forEach(b => b.onclick = async ev => {
      ev.stopPropagation();
      const fixado = b.dataset.fixado === '1';
      try {
        await B7.Save.acao(() => B7.DB.fixarCliente(b.dataset.fixar, !fixado),
          fixado ? 'Cliente desafixado' : 'Cliente fixado no topo');
        B7.Rota.recarregar();
      } catch (e) {}
    });
    ligarPrevia(p);
    B7.UI.ligarMenus(p);
    ligarSpotlight(p);
  }


  /* ============================================ upload de logo (reuso)
     Monta a área de logo do modal e devolve um objeto com o estado atual.
     A imagem só sobe para o Storage na hora de salvar — assim, cancelar
     não deixa arquivo perdido no bucket. */
  /* SVG ficou de fora (03/10, segurança): pode carregar script, e o bucket
     de logos é público. O banco também recusa. */
  const TIPOS_OK = ['image/png', 'image/jpeg', 'image/webp'];
  const LIMITE_MB = 2;

  function campoLogo(logoAtual) {
    const semLogo = '<span class="vazia"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/>' +
      '<path d="M21 16l-5-5-4.5 5-2-2L3 19"/></svg></span>';
    return '<div class="mb"><label class="rot">LOGO DO CLIENTE <span class="leve">— opcional</span></label>' +
      '<div class="upload-logo" id="ul-area">' +
        '<div class="previa" id="ul-previa">' + (logoAtual ? '<img src="' + esc(logoAtual) + '" alt="">' : semLogo) + '</div>' +
        '<div class="txt"><b id="ul-titulo">' + (logoAtual ? 'Logo cadastrada' : 'Arraste uma imagem ou clique') + '</b>' +
        '<small>PNG, JPG ou WEBP · até ' + LIMITE_MB + ' MB</small></div>' +
        '<div class="bts">' +
          '<button type="button" class="b" id="ul-trocar">' + (logoAtual ? 'Alterar' : 'Selecionar') + '</button>' +
          '<button type="button" class="b perigo" id="ul-remover" style="' + (logoAtual ? '' : 'display:none') + '">Remover</button>' +
        '</div>' +
        '<input type="file" id="ul-input" accept="image/png,image/jpeg,image/webp" style="display:none">' +
      '</div><div class="envio-estado" id="ul-estado"></div></div>';
  }

  function ligarCampoLogo(m, logoAtual) {
    const area = m.querySelector('#ul-area');
    const input = m.querySelector('#ul-input');
    const previa = m.querySelector('#ul-previa');
    const titulo = m.querySelector('#ul-titulo');
    const remover = m.querySelector('#ul-remover');
    const trocar = m.querySelector('#ul-trocar');
    const estado = m.querySelector('#ul-estado');

    /* arquivo escolhido (ainda não enviado) | remover a logo atual | nada */
    const st = { arquivo: null, removida: false, atual: logoAtual || null };

    const mostrarEstado = (texto, classe) => {
      estado.textContent = texto || '';
      estado.className = 'envio-estado' + (classe ? ' ' + classe : '');
    };

    function aceitar(arquivo) {
      if (!arquivo) return;
      if (!TIPOS_OK.includes(arquivo.type)) {
        B7.UI.toast('Formato de imagem não suportado. Use PNG, JPG, WEBP ou SVG.', { tipo: 'erro' });
        return;
      }
      if (arquivo.size > LIMITE_MB * 1024 * 1024) {
        B7.UI.toast('Essa imagem é muito grande. Escolha um arquivo menor que ' + LIMITE_MB + ' MB.', { tipo: 'erro' });
        return;
      }
      st.arquivo = arquivo; st.removida = false;
      const leitor = new FileReader();
      leitor.onload = () => {
        previa.innerHTML = '<img src="' + leitor.result + '" alt="">';
        titulo.textContent = arquivo.name;
        remover.style.display = '';
        trocar.textContent = 'Alterar';
      };
      leitor.readAsDataURL(arquivo);
      mostrarEstado('');
    }

    trocar.onclick = e => { e.stopPropagation(); input.click(); };
    area.onclick = () => input.click();
    input.onchange = () => { aceitar(input.files[0]); input.value = ''; };
    remover.onclick = e => {
      e.stopPropagation();
      st.arquivo = null; st.removida = !!st.atual; st.atual = null;
      previa.innerHTML = campoLogo(null).match(/<div class="previa"[^>]*>([\s\S]*?)<\/div>/)[1];
      titulo.textContent = 'Arraste uma imagem ou clique';
      remover.style.display = 'none';
      trocar.textContent = 'Selecionar';
      mostrarEstado('');
    };
    ['dragenter', 'dragover'].forEach(ev => area.addEventListener(ev, e => {
      e.preventDefault(); area.classList.add('sobre');
    }));
    ['dragleave', 'drop'].forEach(ev => area.addEventListener(ev, e => {
      e.preventDefault(); area.classList.remove('sobre');
    }));
    area.addEventListener('drop', e => { if (e.dataTransfer.files.length) aceitar(e.dataTransfer.files[0]); });

    /* devolve {logo_url, logo_path} já resolvidos, ou null se nada mudou */
    st.resolver = async function (clienteId, logoPathAntigo) {
      if (st.arquivo) {
        mostrarEstado('Enviando logo…', 'enviando');
        try {
          const enviado = await B7.DB.enviarLogo(st.arquivo, clienteId);
          mostrarEstado('Logo atualizada ✓', 'pronto');
          if (logoPathAntigo) B7.DB.apagarLogo(logoPathAntigo);   // só depois de dar certo
          return { logo_url: enviado.url, logo_path: enviado.path };
        } catch (e) {
          mostrarEstado('Não consegui enviar a imagem. A logo anterior foi mantida.', 'falhou');
          throw e;
        }
      }
      if (st.removida) {
        if (logoPathAntigo) B7.DB.apagarLogo(logoPathAntigo);
        return { logo_url: null, logo_path: null };
      }
      return null;
    };
    return st;
  }

  /* ==================================================== novo cliente */
  function modalNovoCliente(aoCriar) {
    const m = B7.UI.modal(
      '<h3>Novo cliente</h3><div class="sub">Só o nome é obrigatório. Logo e observações você pode ' +
      'adicionar agora ou depois.</div>' +
      '<div class="mb"><label class="rot">NOME DO CLIENTE</label>' +
      '<input class="campo" id="nc-nome" data-foco placeholder="Ex: Mercato Sadia"></div>' +
      campoLogo(null) +
      '<div class="mb"><label class="rot">OBSERVAÇÕES <span class="leve">— opcional</span></label>' +
      '<textarea class="campo" id="nc-obs" rows="2" placeholder="Tom de voz, contato, particularidades…"></textarea></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Criar cliente</button></div>');

    const logo = ligarCampoLogo(m, null);
    const nome = m.querySelector('#nc-nome');
    const botao = m.querySelector('[data-ok]');

    const criar = async () => {
      if (!nome.value.trim()) { nome.classList.add('erro'); nome.focus(); return; }
      botao.disabled = true;
      try {
        /* o cliente entra primeiro; a logo sobe em seguida, numa pasta com
           o id dele — assim o arquivo nasce organizado */
        const c = await B7.Save.acao(
          () => B7.DB.criarCliente(nome.value, m.querySelector('#nc-obs').value), 'Cliente criado');
        let completo = c;
        try {
          const nova = await logo.resolver(c.id, null);
          if (nova) {
            await B7.DB.atualizarCliente(c.id, nova);
            completo = Object.assign({}, c, nova);
          }
        } catch (e) {
          B7.UI.toast('Cliente criado, mas a logo não subiu. Tente de novo em “Editar cliente”.', { tipo: 'erro' });
        }
        m.fechar();
        if (aoCriar) aoCriar(completo); else B7.Rota.recarregar();
      } catch (e) {
        botao.disabled = false;
        if (String(e.message || '').includes('duplicate') || e.code === '23505') {
          B7.UI.toast('Já existe um cliente com esse nome', { tipo: 'erro' });
        }
      }
    };
    m.querySelector('[data-ok]').onclick = criar;
    nome.onkeydown = e => { if (e.key === 'Enter') criar(); };
  }


  /* ================================================== editar cliente */
  async function modalEditarCliente(id) {
    let c;
    try { c = await B7.DB.cliente(id); }
    catch (e) { return B7.UI.toast('Não consegui carregar o cliente', { tipo: 'erro' }); }

    const m = B7.UI.modal(
      '<h3>Editar cliente</h3><div class="sub">Trocar o nome não afeta gravações, roteiros nem cenas — ' +
      'o sistema trabalha pelo identificador do cliente.</div>' +
      '<div class="mb"><label class="rot">NOME DO CLIENTE</label>' +
      '<input class="campo" id="ec-nome" data-foco value="' + esc(c.nome) + '"></div>' +
      campoLogo(c.logo_url) +
      '<div class="mb"><label class="rot">OBSERVAÇÕES <span class="leve">— opcional</span></label>' +
      '<textarea class="campo" id="ec-obs" rows="2">' + esc(c.observacoes || '') + '</textarea></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Salvar alterações</button></div>');

    const logo = ligarCampoLogo(m, c.logo_url);
    const nome = m.querySelector('#ec-nome');
    const botao = m.querySelector('[data-ok]');

    botao.onclick = async () => {
      if (!nome.value.trim()) { nome.classList.add('erro'); nome.focus(); return; }
      botao.disabled = true;
      const patch = { nome: nome.value.trim(), observacoes: m.querySelector('#ec-obs').value };
      try {
        /* a logo resolve primeiro: se o envio falhar, nada é gravado e a
           logo antiga continua onde estava */
        const nova = await logo.resolver(c.id, c.logo_path);
        if (nova) Object.assign(patch, nova);
        await B7.Save.acao(() => B7.DB.atualizarCliente(c.id, patch), 'Cliente atualizado');
        m.fechar();
        esquecerSecoes(c.id);
        B7.Rota.recarregar();
      } catch (e) {
        botao.disabled = false;
        if (String(e.message || '').includes('duplicate') || e.code === '23505') {
          B7.UI.toast('Já existe um cliente com esse nome', { tipo: 'erro' });
        }
      }
    };
  }

  /* ================================================= excluir cliente */
  async function excluirCliente(id) {
    let c;
    try { c = await B7.DB.cliente(id); }
    catch (e) { return B7.UI.toast('Não consegui carregar o cliente', { tipo: 'erro' }); }

    const temConteudo = c.total_gravacoes > 0 || c.total_roteiros > 0;
    const detalhe = temConteudo
      ? 'Este cliente tem <b>' + c.total_gravacoes + ' gravaç' + (c.total_gravacoes === 1 ? 'ão' : 'ões') +
        '</b> e <b>' + c.total_roteiros + ' roteiro' + (c.total_roteiros === 1 ? '' : 's') +
        '</b>. Tudo isso será apagado junto, incluindo as cenas. Não dá para desfazer.'
      : 'Este cliente ainda não tem gravações. Nada além dele será removido.';

    const m = B7.UI.modal(
      '<h3>Excluir ' + esc(c.nome) + '?</h3>' +
      '<div class="sub">' + detalhe + '</div>' +
      (temConteudo ? '<div class="mb"><label class="rot">PARA CONFIRMAR, DIGITE O NOME DO CLIENTE</label>' +
        '<input class="campo" id="xc-nome" data-foco placeholder="' + esc(c.nome) + '"></div>' : '') +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok' + (temConteudo ? ' disabled' : '') + '>Excluir cliente</button></div>');

    const botao = m.querySelector('[data-ok]');
    if (temConteudo) {
      const campo = m.querySelector('#xc-nome');
      campo.oninput = () => {
        botao.disabled = campo.value.trim().toLowerCase() !== c.nome.trim().toLowerCase();
      };
    }
    botao.onclick = async () => {
      try {
        if (c.logo_path) B7.DB.apagarLogo(c.logo_path);
        await B7.Save.acao(() => B7.DB.excluirCliente(c.id), 'Cliente excluído');
        m.fechar();
        if (location.hash.startsWith('#/cliente/')) location.hash = '#/clientes';
        else B7.Rota.recarregar();
      } catch (e) {}
    };
  }

  /* =================================================== nova gravação */
  async function modalNovaGravacao(clienteId) {
    let clientes = [];
    try { clientes = await B7.DB.listarClientes(); }
    catch (e) { return B7.UI.toast('Erro ao carregar clientes', { tipo: 'erro' }); }

    const opcoes = clientes.map(c =>
      '<option value="' + esc(c.id) + '"' + (c.id === clienteId ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('');

    const m = B7.UI.modal(
      '<h3>Nova gravação</h3>' +
      '<div class="sub">Uma gravação é uma sessão de produção: tudo o que a equipe vai gravar para um cliente — roteiros, trends, ' +
      'conteúdos da Linha Editorial ou algo de improviso. Nenhum roteiro é obrigatório.</div>' +
      '<div class="mb"><label class="rot">CLIENTE</label>' +
        '<div class="linha linha-2col"><select class="campo" id="ng-cliente">' +
        (clientes.length ? opcoes : '<option value="">— nenhum cliente ainda —</option>') +
        '</select><button class="b contorno" id="ng-novo-cliente" style="flex:none">+ Novo</button></div></div>' +
      '<div class="mb"><label class="rot">NOME DA GRAVAÇÃO</label>' +
        '<input class="campo" id="ng-nome" data-foco placeholder="Ex: Conteúdos Setembro"></div>' +
      '<div class="mb"><label class="rot">MÊS DE REFERÊNCIA <span class="leve">— obrigatório</span></label>' +
        B7.Gravacao.camposMes(null, null, 'ng') +
        '<div class="gv-ajuda">O mês de produção a que a gravação pertence — pode ser diferente do dia em que ela acontece.</div></div>' +
      '<div class="mb"><label class="rot">DATA DA GRAVAÇÃO <span class="leve">— opcional</span></label>' +
        '<div class="gv-data-hora"><input class="campo" id="ng-data" type="date" aria-label="Data da gravação">' +
        '<input class="campo" id="ng-hora" type="time" aria-label="Horário (opcional)"></div>' +
        '<div class="gv-ajuda">Pode marcar depois. Os itens (roteiros, trends, conteúdos) entram na tela da gravação.</div></div>' +
      '<div class="mb"><label class="rot">RESPONSÁVEL <span class="leve">— opcional</span></label>' +
        '<select class="campo" id="ng-vm"><option value="">Sem responsável</option></select></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Criar gravação</button></div>');

    /* mês de referência: a data sugere (se a pessoa ainda não escolheu
       o mês à mão); escolher o mês nunca é desfeito pela data */
    let mesManual = false;
    const selMes = m.querySelector('#ng-mes'), selAno = m.querySelector('#ng-ano');
    selMes.onchange = selAno.onchange = () => { mesManual = true; selMes.classList.remove('erro'); };
    m.querySelector('#ng-data').onchange = e => {
      const v = e.target.value; if (!v || mesManual) return;
      selMes.value = String(+v.slice(5, 7));
      if (![...selAno.options].some(o => o.value === v.slice(0, 4))) selAno.insertAdjacentHTML('beforeend', '<option>' + v.slice(0, 4) + '</option>');
      selAno.value = v.slice(0, 4);
    };
    B7.DB.listarVideomakers().then(vms => {
      const s = m.querySelector('#ng-vm'); if (!s) return;
      s.insertAdjacentHTML('beforeend', (vms || []).map(v => '<option value="' + esc(v.id) + '">' + esc(v.nome) + '</option>').join(''));
    }).catch(() => {});

    m.querySelector('#ng-novo-cliente').onclick = () => {
      modalNovoCliente(c => {
        const sel = m.querySelector('#ng-cliente');
        sel.innerHTML += '<option value="' + esc(c.id) + '" selected>' + esc(c.nome) + '</option>';
        sel.value = c.id;
        m.querySelector('#ng-nome').focus();
      });
    };

    const criar = async () => {
      const sel = m.querySelector('#ng-cliente');
      const nome = m.querySelector('#ng-nome');
      if (!sel.value) { B7.UI.toast('Crie um cliente primeiro', { tipo: 'erro' }); return; }
      if (!nome.value.trim()) { nome.classList.add('erro'); nome.focus(); return; }
      if (!selMes.value) { selMes.classList.add('erro'); selMes.focus(); B7.UI.toast('Escolha o mês de referência', { tipo: 'erro' }); return; }
      const data = m.querySelector('#ng-data').value, hora = m.querySelector('#ng-hora').value;
      try {
        /* a gravação nasce sozinha (sem roteiro nenhum); a data, se houver,
           entra pela regra canônica (ocorrência + histórico) */
        const g = await B7.Save.acao(() => B7.DB.criarGravacao({
          client_id: sel.value,
          nome: nome.value.trim(),
          competencia_ano: +selAno.value, competencia_mes: +selMes.value,
          videomaker_id: m.querySelector('#ng-vm').value || null,
          status: 'Rascunho',
          situacao: 'Pendente'
        }), 'Gravação criada');
        if (data) { try { const rAg = await B7.DB.gravacaoAgendar(g.id, data, hora || null, null); if (B7.Gravacao && B7.Gravacao.googleAposAgendar) await B7.Gravacao.googleAposAgendar(rAg, { nome: g.nome, cliente_nome: (sel.options[sel.selectedIndex] || {}).text || '' }, data, hora || null, null); } catch (e) { B7.UI.toast('Gravação criada, mas a data não foi salva: ' + (e.message || ''), { tipo: 'erro' }); } }
        B7.DB.registrar({ tipo: 'criar', entidade: 'gravacao', id: g.id, cliente: sel.value,
          gravacao: g.id, texto: 'Nova gravação: ' + g.nome });
        m.fechar();
        location.hash = '#/gravacao/' + g.id;
      } catch (e) {}
    };
    m.querySelector('[data-ok]').onclick = criar;
    m.querySelector('#ng-nome').onkeydown = e => { if (e.key === 'Enter') criar(); };
  }

  /* ============================================ duplicar / excluir */
  async function duplicarGravacao(id) {
    let g;
    try { g = await B7.DB.gravacao(id); } catch (e) { return; }
    const clientes = await B7.DB.listarClientes();
    const m = B7.UI.modal(
      '<h3>Duplicar gravação</h3><div class="sub">Copia nome, observações, roteiros e cenas para uma ' +
      'gravação nova, com identificadores próprios. A data vem em branco de propósito, para não ' +
      'carregar sem querer a data antiga.</div>' +
      '<div class="mb"><label class="rot">CLIENTE</label><select class="campo" id="dg-cliente">' +
      clientes.map(c => '<option value="' + esc(c.id) + '"' + (c.id === g.client_id ? ' selected' : '') + '>' +
        esc(c.nome) + '</option>').join('') + '</select></div>' +
      '<div class="mb"><label class="rot">NOME</label>' +
      '<input class="campo" id="dg-nome" data-foco value="' + esc(g.nome + ' (cópia)') + '"></div>' +
      '<div class="mb"><label class="rot">MÊS DE REFERÊNCIA</label>' + B7.Gravacao.camposMes(g.competencia_ano, g.competencia_mes, 'dg') + '</div>' +
      '<div class="mb"><label class="rot">DATA <span class="leve">— opcional</span></label>' +
      '<input class="campo" id="dg-data" type="date"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Duplicar</button></div>');

    m.querySelector('[data-ok]').onclick = async () => {
      try {
        const nova = await B7.Save.acao(() => B7.DB.duplicarGravacao(id, {
          client_id: m.querySelector('#dg-cliente').value,
          nome: m.querySelector('#dg-nome').value.trim() || g.nome,
          data_gravacao: null, situacao: 'Pendente',
          competencia_ano: +m.querySelector('#dg-ano').value || null, competencia_mes: +m.querySelector('#dg-mes').value || null,
          local: g.local, responsavel: g.responsavel, videomaker: g.videomaker,
          observacoes: g.observacoes, status: 'Rascunho'
        }), 'Gravação duplicada');
        const dataDup = m.querySelector('#dg-data').value;
        if (dataDup) { try { await B7.DB.gravacaoAgendar(nova.id, dataDup); } catch (e) {} }
        m.fechar();
        location.hash = '#/gravacao/' + nova.id;
      } catch (e) {}
    };
  }

  /* vai para a lixeira, não para o vazio */
  function excluirGravacao(id, nome) {
    paraLixeira('gravacoes', id, nome || 'Gravação');
  }

  /* ============================================== busca global */
  const buscar = B7.UI.debounce(async function (termo, caixa) {
    if (!termo.trim()) { caixa.classList.remove('aberto'); return; }
    try {
      const r = await B7.DB.buscar(termo);
      let html = '';
      if (r.clientes.length) {
        html += '<div class="grupo">CLIENTES</div>' + r.clientes.map(c =>
          '<div class="res" data-ir="#/cliente/' + esc(c.id) + '">' +
          B7.UI.avatarCliente(c.nome, c.logo_url, 'p') + '<div><b>' + esc(c.nome) + '</b><small>' +
          c.total_gravacoes + ' gravaç' + (c.total_gravacoes === 1 ? 'ão' : 'ões') + ' · ' +
          c.total_roteiros + ' roteiro' + (c.total_roteiros === 1 ? '' : 's') + '</small></div></div>').join('');
      }
      if (r.gravacoes.length) {
        html += '<div class="grupo">GRAVAÇÕES</div>' + r.gravacoes.map(g =>
          '<div class="res" data-ir="#/gravacao/' + esc(g.id) + '"><div class="mini">' + IC.gravacoes +
          '</div><div><b>' + esc(g.nome) + '</b><small>' + esc(g.cliente_nome) +
          (g.competencia_ano && B7.Gravacao ? ' · ' + esc(B7.Gravacao.mesRef(g.competencia_ano, g.competencia_mes)) : '') +
          (g.data_gravacao ? ' · ' + B7.UI.dataBR(g.data_gravacao) : '') + '</small></div></div>').join('');
      }
      if ((r.itensGravacao || []).length) {
        html += '<div class="grupo">ITENS DE GRAVAÇÃO</div>' + r.itensGravacao.map(i =>
          '<div class="res" data-ir="#/gravacao/' + esc(i.gravacao_id) + '"><div class="mini">' + IC.gravacoes +
          '</div><div><b>' + esc(i.titulo || 'Sem título') + '</b><small>' + (i.tipo === 'referencia' ? 'Trend' : 'Avulso') +
          ' · ' + esc(i.gravacao.nome) + '</small></div></div>').join('');
      }
      if (r.roteiros.length) {
        html += '<div class="grupo">ROTEIROS</div>' + r.roteiros.map(t =>
          '<div class="res" data-ir="#/gravacao/' + esc(t.recording_session_id) + '?roteiro=' + esc(t.id) +
          '"><div class="mini">' + IC.roteiros + '</div><div><b>' + esc(t.titulo || 'Sem título') +
          '</b><small>abrir na gravação</small></div></div>').join('');
      }
      if ((r.linhas || []).length) {
        html += '<div class="grupo">LINHAS EDITORIAIS</div>' + r.linhas.map(l =>
          '<div class="res" data-ir="#/linha/' + esc(l.id) + '"><div class="mini">' + IC.roteiros +
          '</div><div><b>' + esc(l.nome || 'Linha editorial') + '</b><small>' + esc(l.cliente_nome) +
          ' · ' + l.total_conteudos + ' conteúdo' + (l.total_conteudos === 1 ? '' : 's') +
          '</small></div></div>').join('');
      }
      if ((r.conteudos || []).length) {
        html += '<div class="grupo">CONTEÚDOS</div>' + r.conteudos.map(c =>
          '<div class="res" data-ir="#/linha/' + esc(c.linha_id) + '/criativos">' +
          '<div class="mini">' + IC.roteiros + '</div><div><b>' + esc(c.titulo || 'Sem título') +
          '</b><small>' + esc(c.tipo) + ' · abrir na linha editorial</small></div></div>').join('');
      }
      if ((r.ideias || []).length) {
        html += '<div class="grupo">IDEIAS</div>' + r.ideias.map(i =>
          '<div class="res" data-ir="#/cliente/' + esc(i.client_id) + '/ideias">' +
          '<div class="mini">' + IC.roteiros + '</div><div><b>' + esc(i.titulo || 'Sem título') +
          '</b><small>' + esc(i.status) + '</small></div></div>').join('');
      }
      if ((r.cenas || []).length) {
        html += '<div class="grupo">NO TEXTO DAS CENAS</div>' + r.cenas.map(c =>
          '<div class="res" data-ir="#/gravacao/' + esc(c.roteiro.recording_session_id) +
          '?roteiro=' + esc(c.roteiro.id) + '"><div class="mini">' + IC.roteiros +
          '</div><div><b>' + esc(String(c.texto || '').slice(0, 60)) + '…</b><small>' +
          esc(c.roteiro.titulo || 'Sem título') + (c.funcao ? ' · ' + esc(c.funcao) : '') +
          '</small></div></div>').join('');
      }
      caixa.innerHTML = html || '<div class="nada">Nada encontrado para “' + esc(termo) + '”</div>';
      caixa.classList.add('aberto');
      caixa.querySelectorAll('[data-ir]').forEach(el => el.onclick = () => {
        caixa.classList.remove('aberto');
        const campo = document.getElementById('campo-busca'); if (campo) campo.value = '';
        location.hash = el.dataset.ir;
      });
    } catch (e) { console.error(e); }
  }, 240);

  /* ------------------------------------------- diagnóstico do acesso */
  async function desenharAcesso() {
    const alvo = document.getElementById('cfg-acesso');
    if (!alvo) return;

    const passo = (ok, titulo, detalhe, comando) =>
      '<div class="cfg-linha"><b>' + (ok ? '✓' : '○') + ' ' + esc(titulo) + '</b>' +
      '<span>' + esc(detalhe) + '</span></div>' +
      (comando ? '<div class="cfg-comando">' + esc(comando) + '</div>' : '');

    /* 1. as tabelas de identidade existem? */
    let migrou = true;
    try { await B7.DB.minhaSessao(); } catch (e) { migrou = false; }

    /* 2. a função responde? o ping devolve 200 e conta o que falta */
    let ping = null, publicada = false;
    try {
      ping = await B7.DB.chamarAuth({ acao: 'ping' });
      publicada = true;
    } catch (e) {
      /* se veio mensagem da própria função, ela está publicada — o que
         falhou foi outra coisa */
      publicada = !(e && e.rede);
    }

    if (!publicada) {
      alvo.innerHTML =
        passo(migrou, 'Migrations de identidade',
          migrou ? 'tabelas de perfis encontradas' : 'rode migration_auth.sql no SQL Editor') +
        passo(false, 'Função de acesso publicada', 'a função b7-auth não respondeu') +
        '<p class="cfg-passos">No painel do Supabase: <b>Edge Functions → Functions → ' +
        'Deploy a new function → Via Editor</b>, com o nome exato <code>b7-auth</code>, ' +
        'colando o conteúdo de <code>supabase/functions/b7-auth/index.ts</code>. ' +
        'Criar o secret não publica a função — são passos separados.</p>' +
        '<p class="cfg-passos">O sistema continua aberto até o corte do RLS, ' +
        'então nada foi perdido.</p>';
      return;
    }

    const temAdmin = ping && ping.admin_existe;
    const temToken = ping && ping.bootstrap_disponivel;

    alvo.innerHTML =
      passo(migrou, 'Migrations de identidade',
        migrou ? 'tabelas de perfis encontradas' : 'rode migration_auth.sql no SQL Editor') +
      passo(true, 'Função de acesso publicada', 'b7-auth respondeu') +
      passo(temAdmin, 'Conta de administrador',
        temAdmin ? 'existe um administrador ativo'
                 : (temToken ? 'o token de bootstrap está pronto — falta criar a conta'
                             : 'crie o secret B7_BOOTSTRAP_TOKEN antes')) +
      passo(false, 'Sessão ativa', 'ninguém está autenticado neste navegador') +
      (temAdmin
        ? '<p class="cfg-passos">Está tudo pronto: use <b>Entrar</b>, no topo da tela.</p>'
        : '<p class="cfg-passos">Abra a função <code>b7-auth</code> no painel, vá na aba de ' +
          'teste e envie a chamada de bootstrap descrita no BOOTSTRAP.md.</p>');
  }

  /* ------------------------------------------- estado real do banco */
  async function desenharBanco() {
    const alvo = document.getElementById('cfg-banco');
    if (!alvo) return;
    const r = await B7.DB.verificarBanco();
    const hora = new Date(r.em).toLocaleTimeString('pt-BR',
      { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    /* uma linha só: estado + tempo de resposta + hora; tocar verifica de novo */
    alvo.innerHTML =
      '<button type="button" class="cfg-l cfg-banco-l" data-verificar-banco aria-label="Verificar o banco de novo">' +
        '<span class="cfg-ic cfg-tom-verde">' + svgF('banco') + '</span>' +
        '<span class="cfg-l-tx"><b>Banco de dados</b><small>' +
          (r.ok ? 'Respondendo · ' + r.ms + ' ms' : 'Sem resposta') + ' · ' + hora + '</small></span>' +
        '<span class="cfg-valor ' + (r.ok ? 'ok' : 'erro') + '"><span class="cfg-ponto ' + (r.ok ? 'ok' : 'erro') + '"></span>' +
          (r.ok ? 'Online' : 'Fora') + '</span>' +
        '<span class="cfg-refazer">Verificar</span>' +
      '</button>' +
      (r.ok ? '' : '<div class="cfg-l cfg-l-detalhe"><small>' + esc(r.erro) + '</small></div>');
    const b = alvo.querySelector('[data-verificar-banco]');
    if (b) b.onclick = () => {
      const s = b.querySelector('small'); if (s) s.textContent = 'verificando…';
      const pt = b.querySelector('.cfg-ponto'); if (pt) pt.className = 'cfg-ponto pulsa';
      desenharBanco();
    };
  }

  const ehAdmin = () => !!(B7.Auth && B7.Auth.ehAdmin());

  /* Quem chega numa rota administrativa sem ser admin vê isto — sem
     detalhe do que existe do outro lado. */
  function semPermissao(rota) {
    marcarNav('#/');
    /* A mensagem muda com o papel: dizer "é do administrador" para um
       coordenador é verdade, mas para um cliente soa como se ele tivesse
       errado o caminho de uma área que existe para ele. */
    const papel = (B7.Auth && B7.Auth.papel()) || null;
    const titulo = papel === 'cliente'
      ? 'Esta área não faz parte do seu acompanhamento.'
      : 'Esta área é do administrador.';
    const texto = papel === 'cliente'
      ? 'Aqui você acompanha e aprova os materiais da sua empresa. ' +
        'O resto é a operação interna da Branding7.'
      : 'Sua conta não tem acesso a esta parte do sistema.';
    painel().innerHTML = '<div class="conteudo entra">' +
      estadoB7(IC.roteiros || '', titulo, texto,
        '<button class="b pri" onclick="location.hash=\'#/\'">Voltar ao início</button>') +
    '</div>';
  }

  return { abrir, marcarNav, semPermissao, abrirClientes, abrirCliente, abrirGravacoes, abrirRoteiros, abrirConfig,
           trilhaCliente, erroConteudo, shellCliente, ligarShellCliente,
           prepararSecaoCliente, pintarSecaoCliente, esquecerSecoes, secaoVigente: seq => seq === trocaSeq,
           abrirLixeira, abrirArquivados, arquivarGravacao, paraLixeira,
           modalNovaGravacao, modalNovoCliente, modalEditarCliente, excluirCliente,
           buscar, duplicarGravacao, excluirGravacao, IC,
           get ultima() { return ultimaGravacao; } };
})();
