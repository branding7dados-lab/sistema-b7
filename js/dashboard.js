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
    raiz.querySelectorAll('.spot').forEach(el => {
      el.onmousemove = e => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      };
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
    return '<div class="gl-item' + (g.situacao === 'Cancelada' ? ' cancelada' : '') + '" data-gravacao="' + esc(g.id) + '" ' +
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
  async function abrirGravacoes() {
    marcarNav('#/gravacoes');
    B7.Rota.titulo(['Gravações']);
    esqueleto('lista');
    let gravacoes;
    try { gravacoes = await B7.DB.listarGravacoes(); } catch (e) { return erro(e, 'abrirGravacoes'); }

    const clientes = [...new Map(gravacoes.map(g => [g.client_id, g.cliente_nome])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'pt-BR'));
    const meses = () => [...new Set(gravacoes.map(chaveMes).filter(Boolean))].sort().reverse();
    const resps = [...new Map(gravacoes.filter(g => g.videomaker_id).map(g => [g.videomaker_id, g.videomaker_nome])).entries()];
    const STATUS = [['', 'Todas'], ['Agendada', 'Marcadas'], ['Remarcada', 'Remarcadas'], ['Pendente', 'Sem data'], ['Gravada', 'Concluídas'], ['Cancelada', 'Canceladas']];
    const sel = (id, atual, ops, rot) => '<select class="campo fina gv-filtro' + (atual ? ' ativo' : '') + '" id="' + id + '" aria-label="' + esc(rot) + '">' +
      ops.map(([v, r]) => '<option value="' + esc(v) + '"' + (v === atual ? ' selected' : '') + '>' + esc(r) + '</option>').join('') + '</select>';
    const opcoesMes = () => [['', 'Todos os meses'], ['sem', 'Sem mês (antigas)']].concat(meses().map(k => [k, B7.Gravacao.mesRef(+k.slice(0, 4), +k.slice(5, 7))]));

    painel().innerHTML = '<div class="conteudo gl-pagina">' +
      '<div class="secao-topo"><h2 style="font-size:22px">Gravações</h2>' +
      '<span class="conta" id="gv-conta">' + gravacoes.length + '</span><div class="espaco"></div>' +
      (B7.Perm && B7.Perm.podeRota('calendario') ? '<a class="b contorno gl-cal" href="#/calendario?v=mes&amp;tipo=gravacoes">' + IC.gravacoes + 'Calendário</a>' : '') +
      '<button class="b pri" data-nova-gravacao>' + IC.mais + 'Nova gravação</button></div>' +
      (gravacoes.length ? '<div class="gl-filtros">' +
        '<div class="gl-busca"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
          '<input class="campo fina" id="fg-busca" type="search" placeholder="Buscar cliente ou gravação" aria-label="Buscar cliente ou gravação" value="' + esc(FG.busca || '') + '"></div>' +
        sel('fg-cliente', FG.cliente, [['', 'Todos os clientes']].concat(clientes), 'Cliente') +
        '<span id="fg-mes-cx">' + sel('fg-mes', FG.mes, opcoesMes(), 'Mês de referência') + '</span>' +
        (resps.length ? sel('fg-resp', FG.resp, [['', 'Todos os responsáveis'], ['sem', 'Sem responsável']].concat(resps), 'Responsável') : '') +
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
      pintarStatus();
      ligar();
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
    try { roteiros = await B7.DB.roteirosRecentes(60); } catch (e) { return erro(e, 'abrirRoteiros'); }

    const clientes = [...new Set(roteiros.map(r => r.gravacao && r.gravacao.cliente_nome).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    let vista = 'lista';
    try { vista = localStorage.getItem('b7.roteiros.vista') === 'cards' ? 'cards' : 'lista'; } catch (e) {}
    const F = { status: 'Todos', cliente: '', termo: '', ordem: 'recentes' };

    const ICL = '<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>';
    const ICC = '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>';
    painel().innerHTML = '<div class="conteudo entra rt">' +
      '<div class="rt-cab"><div class="rt-cab-tx"><h1>Roteiros</h1>' +
        '<p id="rt-sub">' + roteiros.length + ' roteiros mexidos por último, de todos os clientes</p></div>' +
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
      if (sub) sub.textContent = (lista.length === roteiros.length ? roteiros.length + ' roteiros mexidos por último, de todos os clientes'
        : lista.length + ' de ' + roteiros.length + ' roteiros');
      const filtrando = F.status !== 'Todos' || F.cliente || F.termo;
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
      if (vista === 'cards') {
        const ord = lista.slice();
        if (F.ordem === 'cliente') ord.sort((a, b) => String((a.gravacao || {}).cliente_nome || '').localeCompare(String((b.gravacao || {}).cliente_nome || ''), 'pt-BR'));
        if (F.ordem === 'gravacao') ord.sort((a, b) => chaveGrav(a.gravacao).localeCompare(chaveGrav(b.gravacao)));
        cx.className = 'grade grade-roteiros';
        cx.innerHTML = ord.map(cardRoteiro).join('');
      } else {
        /* agrupa por gravação, mantendo a ordem de "mexido por último" */
        const grupos = [], idx = new Map();
        lista.forEach(r => {
          const k = r.recording_session_id;
          if (!idx.has(k)) { const grp = { id: k, gravacao: r.gravacao, itens: [], recente: r.updated_at }; idx.set(k, grp); grupos.push(grp); }
          idx.get(k).itens.push(r);
        });
        if (F.ordem === 'cliente') grupos.sort((a, b) => String((a.gravacao || {}).cliente_nome || '').localeCompare(String((b.gravacao || {}).cliente_nome || ''), 'pt-BR') || String(b.recente).localeCompare(String(a.recente)));
        if (F.ordem === 'gravacao') grupos.sort((a, b) => chaveGrav(a.gravacao).localeCompare(chaveGrav(b.gravacao)));
        cx.className = 'rt-lista';
        cx.innerHTML = grupos.map(grupoRoteirosHTML).join('');
      }
      ligar();
    }
    function limpar() {
      Object.assign(F, { status: 'Todos', cliente: '', termo: '' });
      const b = document.getElementById('rt-busca'); if (b) b.value = '';
      const s = document.getElementById('rt-cliente'); if (s) { s.value = ''; s.classList.remove('ativo'); }
      aplicar();
    }
    const busca = document.getElementById('rt-busca');
    if (busca) busca.oninput = B7.UI.debounce(() => { F.termo = norm(busca.value.trim()); aplicar(); }, 120);
    const sc = document.getElementById('rt-cliente');
    if (sc) sc.onchange = () => { F.cliente = sc.value; sc.classList.toggle('ativo', !!sc.value); aplicar(); };
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
    try { clientes = ordenarClientes(await B7.DB.listarClientes()); }
    catch (e) { return erro(e, 'abrirClientes'); }

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

  async function abrirCliente(id, aba) {
    marcarNav('#/clientes');
    abaCliente = aba || 'geral';
    esqueleto('detalhe');

    let cliente, gravacoes, roteiros, linhas = [], semanas = [];
    try {
      [cliente, gravacoes, roteiros] = await Promise.all([
        B7.DB.cliente(id), B7.DB.listarGravacoes(id), B7.DB.roteirosDoCliente(id, aba === 'roteiros' ? 40 : 5)
      ]);
      /* as linhas editoriais são um extra: se o migration ainda não rodou,
         o resto da tela continua funcionando normalmente */
      linhas = await B7.DB.listarLinhas(id).catch(() => []);
      /* idem para o status semanal: sem o migration, o resto segue de pé */
      semanas = await B7.DB.listarStatus({ clienteId: id, limite: 6 }).catch(() => []);
      gravacoes.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      B7.Rota.titulo([cliente.nome]);
    } catch (e) { return erro(e, 'abrirClientes'); }

    /* métricas do cliente, tiradas dos dados reais dele */
    const conta = st => gravacoes.filter(g => g.status === st).length;
    const emAndamento = conta('Rascunho') + conta('Pronto para gravar');
    const ultima = gravacoes[0];

    painel().innerHTML = '<div class="conteudo entra">' +
      '<div class="trilha-nav"><button data-ir="#/">Dashboard</button><span>/</span>' +
        '<button data-ir="#/clientes">Clientes</button><span>/</span><b>' + esc(cliente.nome) + '</b></div>' +

      capaCliente(cliente, gravacoes.length, emAndamento) +

      '<div class="abas-cliente">' +
        [['geral', 'Visão geral'], ['linhas', 'Linha editorial'], ['ideias', 'Ideias'],
         ['gravacoes', 'Gravações'], ['roteiros', 'Roteiros'],
         ['inteligencia', 'Inteligência'], ['onboarding', 'Onboarding'],
         ['arquivados', 'Arquivados']].map(([k, r]) =>
          '<button data-aba-cli="' + k + '"' + (abaCliente === k ? ' class="on"' : '') + '>' + r + '</button>').join('') +
      '</div>' +

      (abaCliente === 'geral' ? visaoGeralCliente(cliente, gravacoes, roteiros, emAndamento, conta, ultima, linhas, semanas)
       : abaCliente === 'gravacoes' ? abaGravacoesCliente(cliente, gravacoes)
       : abaCliente === 'arquivados' ? '<div id="aba-arquivados">' + B7.UI.skeleton('cards', { n: 3, titulo: false }) + '</div>'
       : abaRoteirosCliente(cliente, roteiros)) +
    '</div>';

    ligar();
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
    painel().querySelectorAll('[data-aba-cli]').forEach(b => b.onclick = () => {
      const aba = b.dataset.abaCli;
      if (aba === 'inteligencia') return location.hash = '#/cliente/' + id + '/inteligencia';
      if (aba === 'onboarding')   return location.hash = '#/cliente/' + id + '/onboarding';
      if (aba === 'linhas')       return location.hash = '#/cliente/' + id + '/linhas';
      if (aba === 'ideias')       return location.hash = '#/cliente/' + id + '/ideias';
      if (aba === 'ideias')       return location.hash = '#/cliente/' + id + '/ideias';
      abrirCliente(id, aba);
    });
    if (abaCliente === 'gravacoes') ligarFiltrosGravacoes(gravacoes);
    if (abaCliente === 'arquivados') carregarArquivadosCliente(id);
    /* Oportunidades do cliente (fase 7): segmentos + próximas datas */
    if (abaCliente === 'geral' && B7.Oportunidades) {
      const cx = painel().querySelector('.conteudo');
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

  function capaCliente(c, totalGravacoes, emAndamento) {
    const selo = c.logo_url
      ? '<div class="selo"><img src="' + esc(c.logo_url) + '" alt=""></div>'
      : '<div class="selo">' + esc(B7.UI.iniciais(c.nome)) + '</div>';
    return '<div class="capa-cliente">' +
      '<div class="malha"></div><div class="brilho"></div><div class="b7-marca"></div>' +
      selo +
      '<div class="info"><div class="olho">WORKSPACE · BRANDING7</div>' +
        '<h1>' + esc(c.nome) + '</h1>' +
        '<div class="meta"><span>' + totalGravacoes + ' gravaç' + (totalGravacoes === 1 ? 'ão' : 'ões') + '</span>' +
        '<span class="p"></span><span>' + c.total_roteiros + ' roteiro' + (c.total_roteiros === 1 ? '' : 's') + '</span>' +
        (emAndamento ? '<span class="p"></span><span>' + emAndamento + ' em andamento</span>' : '') +
        '<span class="p"></span><span>última atividade ' + B7.UI.quando(c.ultima_atividade) + '</span></div></div>' +
      '<div class="acoes">' +
        '<button class="b pri" data-nova-gravacao="' + esc(c.id) + '">' + IC.mais + 'Nova gravação</button>' +
        '<button class="b clara" data-editar-cli="' + esc(c.id) + '">Editar cliente</button>' +
        /* O botão de destaque saiu daqui: virou o seletor "Visualizar
           como…" da sidebar (js/previa-usuario.js), que busca entre
           clientes e usuários num campo só. O atalho continua no menu
           "⋯" abaixo, pra quem já está com o cliente aberto — mesma
           rota de sempre (B7.Portal.abrirPrevia), nada mudou nela. */
        '<div class="menu"><button class="ico" style="color:rgba(255,255,255,.7)">⋯</button><div class="lista">' +
          '<button data-nova-gravacao="' + esc(c.id) + '">Nova gravação</button>' +
          '<button data-editar-cli="' + esc(c.id) + '">Editar cliente</button>' +
          (ehAdmin() ? '<button data-ir="#/previa/' + esc(c.id) + '">Visualizar como cliente</button>' : '') +
          (window.__ultimaDoCliente ? '' : '') +
          '<hr><button class="perigo" data-excluir-cli="' + esc(c.id) + '">Excluir cliente</button>' +
        '</div></div>' +
      '</div></div>';
  }

  /* Bloco da linha editorial atual + histórico dos meses anteriores.
     Só aparece quando existe pelo menos uma linha: sem linha, sem ruído. */
  function blocoLinhaEditorial(c, linhas) {
    /* Sem linha nenhuma, o bloco não some: vira o convite para criar. É o
       caminho direto para o planejamento, sem passar por gravações. */
    if (!linhas.length) {
      return '<div class="bloco destaque-linha vazia"><div class="dl-topo">' +
        '<div><small>LINHA EDITORIAL</small>' +
        '<h3>Nenhum planejamento ainda</h3></div>' +
        '<button class="b pri" data-criar-linha="' + esc(c.id) + '">+ Criar linha editorial</button>' +
        '</div><p class="dl-nota">Organize o que este cliente vai publicar no mês.</p></div>';
    }
    const atual = linhas[0];
    const anteriores = linhas.slice(1, 4);
    const progresso = atual.total_conteudos
      ? Math.round((atual.total_estruturados / atual.total_conteudos) * 100) : 0;

    return '<div class="bloco destaque-linha"><div class="dl-topo">' +
        '<div><small>LINHA EDITORIAL ATUAL</small>' +
        '<h3>' + esc(atual.nome || (B7.UI.MESES[atual.mes - 1] + ' ' + atual.ano)) + '</h3></div>' +
        '<button class="b pri" data-abrir-linha="' + esc(atual.id) + '">Abrir linha editorial</button></div>' +
      '<div class="dl-metricas">' +
        '<div><b>' + atual.total_conteudos + '</b><span>CONTEÚDOS</span></div>' +
        '<div><b>' + atual.total_estruturados + '</b><span>ESTRUTURADOS</span></div>' +
      '</div>' +
      '<div class="barra-progresso"><i style="width:' + progresso + '%"></i></div>' +
      (anteriores.length ? '<div class="dl-historico"><small>MESES ANTERIORES</small>' +
        anteriores.map(l => '<button data-abrir-linha="' + esc(l.id) + '">' +
          esc(l.nome || (B7.UI.MESES[l.mes - 1] + ' ' + l.ano)) +
          '<span>' + l.total_conteudos + ' conteúdos</span></button>').join('') + '</div>' : '') +
    '</div>';
  }

  /* Bloco compacto: a semana mais recente e o caminho para criar outra.
     Sem virar um segundo dashboard dentro do client home. */
  function blocoStatusSemanal(c, semanas) {
    semanas = semanas || [];
    if (!semanas.length) {
      return '<div class="bloco destaque-linha vazia"><div class="dl-topo">' +
        '<div><small>STATUS SEMANAL</small><h3>Nenhuma semana registrada</h3></div>' +
        '<button class="b pri" data-nova-semana="' + esc(c.id) + '">+ Novo status</button>' +
        '</div><p class="dl-nota">O acompanhamento de sete dias que vai para o cliente.</p></div>';
    }
    const atual = semanas[0];
    const anteriores = semanas.slice(1, 4);
    return '<div class="bloco destaque-linha"><div class="dl-topo">' +
        '<div><small>STATUS SEMANAL</small><h3>' +
        esc(B7.DocSemana.periodoTexto(atual.semana_inicio, atual.semana_fim)) + '</h3></div>' +
        '<button class="b pri" data-abrir-semana="' + esc(atual.id) + '">Abrir status</button></div>' +
      '<div class="dl-metricas">' +
        '<div><b>' + atual.total_itens + '</b><span>DEMANDAS</span></div>' +
        (atual.total_atencao ? '<div><b>' + atual.total_atencao + '</b><span>AGUARDANDO</span></div>' : '') +
        '<div><b>' + esc(atual.situacao || 'Rascunho') + '</b><span>ESTADO</span></div>' +
      '</div>' +
      (anteriores.length ? '<div class="dl-historico"><small>SEMANAS ANTERIORES</small>' +
        anteriores.map(w => '<button data-abrir-semana="' + esc(w.id) + '">' +
          esc(B7.DocSemana.periodoTexto(w.semana_inicio, w.semana_fim)) +
          '<span>' + w.total_itens + ' demandas</span></button>').join('') + '</div>' : '') +
      '<div class="dl-acoes-mini"><button class="b p" data-nova-semana="' + esc(c.id) + '">' +
      '+ Nova semana</button></div>' +
    '</div>';
  }

  function visaoGeralCliente(c, gravacoes, roteiros, emAndamento, conta, ultima, linhas, semanas) {
    const linhaEditorial = blocoLinhaEditorial(c, linhas || []) + blocoStatusSemanal(c, semanas);
    const metricas =
      '<div class="mini-metricas">' +
        '<div class="mini-metrica"><b>' + gravacoes.length + '</b><span>GRAVAÇÕES</span></div>' +
        '<div class="mini-metrica"><b>' + c.total_roteiros + '</b><span>ROTEIROS</span></div>' +
        '<div class="mini-metrica"><b>' + emAndamento + '</b><span>EM ANDAMENTO</span></div>' +
        '<div class="mini-metrica"><b>' + conta('Gravado') + '</b><span>GRAVADAS</span></div>' +
      '</div>';

    if (!gravacoes.length) {
      return metricas + linhaEditorial + '<div class="cartao vazio" style="position:relative;overflow:hidden">' +
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

    const listaRoteiros = roteiros.length ? roteiros.map(r =>
      '<div class="roteiro-linha" data-gravacao="' + esc(r.recording_session_id) +
        '" data-roteiro="' + esc(r.id) + '">' +
        '<div class="n">' + String((r.position || 0) + 1).padStart(2, '0') + '</div>' +
        '<div class="tx"><b>' + esc(r.titulo || 'Sem título') + '</b><small>' +
        (r.gravacao ? esc(r.gravacao.nome) + ' · ' : '') + 'editado ' + B7.UI.quando(r.updated_at) + '</small></div>' +
        (r.gravacao ? B7.UI.chipStatus(r.gravacao.status) : '') + '</div>').join('')
      : '<div class="vazio" style="padding:26px"><b>Nenhum roteiro ainda</b></div>';

    return metricas + linhaEditorial +
      '<div class="colunas"><div>' +
        '<div class="secao"><div class="secao-topo"><h2>Última gravação</h2></div>' +
          cardDestaque(ultima) + '</div>' +
        (gravacoes.length > 1 ? '<div class="secao"><div class="secao-topo"><h2>Gravações</h2>' +
          '<span class="conta">' + gravacoes.length + '</span><div class="espaco"></div>' +
          '<button class="b fina contorno" data-aba-cli="gravacoes">Ver todas</button></div>' +
          '<div class="grade">' + gravacoes.slice(1, 4).map(cardGravacao).join('') + '</div></div>' : '') +
        '<div class="secao"><div class="secao-topo"><h2>Roteiros recentes</h2>' +
          '<div class="espaco"></div><button class="b fina contorno" data-aba-cli="roteiros">Ver todos</button></div>' +
          listaRoteiros + '</div>' +
      '</div><div class="apoio">' +
        '<div class="bloco"><h3>Ações rápidas</h3>' +
          '<button class="acao-rapida" data-nova-gravacao="' + esc(c.id) + '"><div class="ic">' + IC.mais + '</div>' +
            '<div class="tx"><b>Nova gravação</b><small>para ' + esc(c.nome) + '</small></div></button>' +
          '<button class="acao-rapida" data-editar-cli="' + esc(c.id) + '"><div class="ic">' + IC.pessoa + '</div>' +
            '<div class="tx"><b>Editar cliente</b><small>nome, logo e observações</small></div></button>' +
          '<button class="acao-rapida" data-gravacao="' + esc(ultima.id) + '"><div class="ic">' + IC.play + '</div>' +
            '<div class="tx"><b>Continuar ' + esc(ultima.nome) + '</b><small>editado ' + B7.UI.quando(ultima.updated_at) + '</small></div></button>' +
          '<button class="acao-rapida" data-imprimir="' + esc(ultima.id) + '"><div class="ic">' + IC.imprimir + '</div>' +
            '<div class="tx"><b>Imprimir última gravação</b><small>' + esc(ultima.nome) + '</small></div></button>' +
          '<button class="acao-rapida" data-dup="' + esc(ultima.id) + '"><div class="ic">' + IC.gravacoes + '</div>' +
            '<div class="tx"><b>Duplicar última gravação</b><small>copia roteiros e cenas</small></div></button>' +
        '</div>' +
        '<div class="bloco"><h3>Atividade recente</h3><div class="atividade">' + atividade + '</div></div>' +
        (c.observacoes ? '<div class="bloco"><h3>Observações</h3>' +
          '<p style="font-size:13px;line-height:1.6;color:var(--ink-2)">' + esc(c.observacoes) + '</p></div>' : '') +
      '</div></div>';
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
    return roteiros.map(r =>
      '<div class="roteiro-linha" data-gravacao="' + esc(r.recording_session_id) +
        '" data-roteiro="' + esc(r.id) + '">' +
        '<div class="n">' + String((r.position || 0) + 1).padStart(2, '0') + '</div>' +
        '<div class="tx"><b>' + esc(r.titulo || 'Sem título') + '</b><small>' +
        (r.gravacao ? esc(r.gravacao.nome) + ' · ' : '') + 'editado ' + B7.UI.quando(r.updated_at) + '</small></div>' +
        (r.gravacao ? B7.UI.chipStatus(r.gravacao.status) : '') + '</div>').join('');
  }


  /* =================================================== CONFIGURAÇÕES */
  /* Uma pergunta só decide o que aparece: a regra vive em B7.Perm. */
  const pode = secao => !B7.Perm || B7.Perm.podeConfig(secao);

  function abrirConfig() {
    marcarNav('#/config');
    B7.Rota.titulo(['Configurações']);
    const tema = document.documentElement.getAttribute('data-theme');
    const densidade = B7.pref.ler('densidade', 'confortavel');
    const abertura = B7.pref.ler('abertura', false);
    const recolhida = document.body.classList.contains('recolhida');
    const online = navigator.onLine;

    const opcao = (grupo, atual, itens) =>
      '<div class="opcoes" data-grupo="' + grupo + '">' + itens.map(([v, r]) =>
        '<button data-v="' + v + '"' + (atual === v ? ' class="on"' : '') + '>' + r + '</button>').join('') + '</div>';

    const linha = (titulo, desc, controle) =>
      '<div class="config-linha"><div class="tx"><b>' + titulo + '</b><small>' + desc + '</small></div>' +
      controle + '</div>';

    painel().innerHTML = '<div class="conteudo entra" style="max-width:860px">' +
      '<div class="trilha-nav"><button data-ir="#/">Central B7</button><span>/</span><b>Configurações</b></div>' +
      '<h1 style="font-family:Archivo;font-size:26px;font-weight:900;letter-spacing:-.03em;margin-bottom:20px">Configurações</h1>' +

      '<div class="config-secao"><h3>Aparência</h3>' +
        '<div class="desc">Vale só para este navegador — cada pessoa da equipe ajusta o seu.</div>' +
        linha('Tema', 'claro, escuro ou como está o seu computador',
              opcao('tema', tema, [['light', 'Claro'], ['dark', 'Escuro'], ['auto', 'Sistema']])) +
        linha('Densidade', 'quanto conteúdo cabe na tela',
              opcao('densidade', densidade, [['confortavel', 'Confortável'], ['compacta', 'Compacta']])) +
        linha('Animações', 'o sistema respeita a preferência do seu sistema operacional',
              '<span style="font-size:12.5px;color:var(--ink-3)">' +
              (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduzidas' : 'normais') + '</span>') +
      '</div>' +

      (pode('interface') ? '<div class="config-secao"><h3>Interface</h3>' +
        '<div class="desc">Como a navegação se comporta.</div>' +
        linha('Barra lateral', 'começar recolhida, só com os ícones',
              opcao('sidebar', recolhida ? 'sim' : 'nao', [['nao', 'Expandida'], ['sim', 'Recolhida']])) +
        linha('Atalhos de teclado', 'ver a lista completa',
              '<button class="b contorno" data-atalhos>Ver atalhos</button>') +
      '</div>' : '') +

      (pode('impressao') ? '<div class="config-secao"><h3>Impressão</h3>' +
        '<div class="desc">A ficha A4 não muda com o tema: ela é sempre clara.</div>' +
        linha('Folha de abertura', 'vir marcada por padrão na janela de impressão',
              opcao('abertura', abertura ? 'sim' : 'nao', [['nao', 'Desligada'], ['sim', 'Ligada']])) +
      '</div>' : '') +

      /* O estado do banco vive aqui, e só aqui. Fora das configurações,
         a equipe vê apenas o que afeta o trabalho. */
      /* Diagnóstico do acesso: aparece enquanto não há sessão, e diz
         exatamente qual etapa falta. Sem isto, "o login não funciona"
         não tem como ser investigado por quem está usando o sistema. */
      (B7.Auth && !B7.Auth.usuario() ?
        '<div class="config-secao"><h3>Acesso</h3>' +
          '<div class="desc">Situação da autenticação nesta instalação.</div>' +
          '<div id="cfg-acesso"><div class="cfg-estado">' +
          '<span class="cfg-ponto"></span><span>Verificando…</span></div></div>' +
        '</div>' : '') +

      /* a seção só existe para admin: nada de item com cadeado */
      (pode('usuarios') ?
        '<div class="config-secao"><h3>Usuários e acessos</h3>' +
          '<div class="desc">Contas da equipe e dos clientes. Não existe cadastro público.</div>' +
          '<div class="config-linha"><div class="tx"><b>Gerenciar contas</b>' +
          '<small>criar, redefinir senha, vincular empresas e desativar</small></div>' +
          '<button class="b" data-ir="#/usuarios">Abrir</button></div>' +
        '</div>' : '') +

      /* Banco, backup e sistema são do administrador. Coordenador e
         cliente veem apenas aparência, interface e a própria conta. */
      (pode('banco') ? '<div class="config-secao"><h3>Banco de dados</h3>' +
        '<div class="desc">O estado da conexão com o Supabase, verificado de verdade.</div>' +
        '<div id="cfg-banco"><div class="cfg-estado">' +
        '<span class="cfg-ponto"></span><span>Verificando…</span></div></div>' +
      '</div>' : '') +

      (pode('dados') ? '<div class="config-secao"><h3>Dados</h3>' +
        '<div class="desc">O banco é o Supabase. Isto aqui é segurança extra.</div>' +
        linha('Backup', 'baixa um arquivo com clientes, gravações, roteiros e cenas',
              '<button class="b contorno" data-exportar>Exportar</button>') +
        linha('Restaurar', 'devolve os registros de um arquivo de backup',
              '<button class="b contorno" data-importar>Importar</button>') +
      '</div>' : '') +

      (pode('sistema') ? '<div class="config-secao"><h3>Sistema</h3>' +
        linha('Conexão com o banco', online ? 'tudo certo por aqui' : 'reconecte para voltar a salvar',
              '<span class="chip-status ' + (online ? 'gravado' : 'pronto') + '">' +
              (online ? 'Conectado' : 'Sem conexão') + '</span>') +
        linha('Versão', 'Branding7', '<span style="font-size:12.5px;color:var(--ink-3)">v2.1</span>') +
      '</div>' : '') +

      /* Conta: todo mundo tem, inclusive cliente e coordenador. */
      (B7.Auth && B7.Auth.usuario() ?
        '<div class="config-secao"><h3>Minha conta</h3>' +
          '<div class="desc">Seus dados de acesso nesta plataforma.</div>' +
          linha(esc(B7.Auth.usuario().nome), '@' + esc(B7.Auth.usuario().username) +
                ' · ' + esc(B7.Auth.usuario().papel),
                '<button class="b contorno" data-abrir-perfil>Editar perfil</button>') +
          linha('Sair da conta', 'encerra a sessão neste navegador',
                '<button class="b contorno" data-sair-config>Sair</button>') +
        '</div>' : '') +
    '</div>';

    ligar();
    const btPerfil = painel().querySelector('[data-abrir-perfil]');
    if (btPerfil) btPerfil.onclick = () => B7.Perfil.abrir();
    const btSair = painel().querySelector('[data-sair-config]');
    if (btSair) btSair.onclick = () => B7.Auth.sair();

    painel().querySelectorAll('.opcoes').forEach(cx => {
      cx.querySelectorAll('button').forEach(b => b.onclick = () => {
        cx.querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        const grupo = cx.dataset.grupo, v = b.dataset.v;
        if (grupo === 'tema') {
          /* mesma função do menu da conta: um lugar só decide o tema */
          if (B7.definirTema) B7.definirTema(v === 'auto' ? 'sistema' : v);
          B7.UI.toast('Tema atualizado');
        }
        if (grupo === 'densidade') { B7.aplicarDensidade(v); B7.UI.toast('Densidade: ' + b.textContent.toLowerCase()); }
        if (grupo === 'sidebar') {
          document.body.classList.toggle('recolhida', v === 'sim');
          B7.pref.gravar('sidebar_recolhida', v === 'sim');
        }
        if (grupo === 'abertura') B7.pref.gravar('abertura', v === 'sim');
      });
    });
    const at = painel().querySelector('[data-atalhos]'); if (at) at.onclick = () => B7.UI.atalhos();
    if (pode('banco')) desenharBanco();
    desenharAcesso();
    const ex = painel().querySelector('[data-exportar]'); if (ex) ex.onclick = () => B7.Backup.exportar();
    const im = painel().querySelector('[data-importar]'); if (im) im.onclick = () => B7.Backup.importar();
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
      if (a.entity_type === 'onboarding' && a.client_id) return '#/cliente/' + a.client_id + '/onboarding';
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
    /* o topo acompanha: contexto no celular e a ordem/estilo do "Criar" */
    if (B7.Topo) B7.Topo.contexto();
  }

  function ligar() {
    const p = painel();
    p.querySelectorAll('[data-gravacao]').forEach(el => {
      const abrir = () => {
        const r = el.dataset.roteiro;
        location.hash = '#/gravacao/' + el.dataset.gravacao + (r ? '?roteiro=' + r : '');
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
    p.querySelectorAll('[data-aba-cli]').forEach(b => b.onclick = () => {
      const cli = location.hash.split('/')[2];
      if (cli) abrirCliente(cli, b.dataset.abaCli);
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
  const TIPOS_OK = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
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
        '<small>PNG, JPG, WEBP ou SVG · até ' + LIMITE_MB + ' MB</small></div>' +
        '<div class="bts">' +
          '<button type="button" class="b" id="ul-trocar">' + (logoAtual ? 'Alterar' : 'Selecionar') + '</button>' +
          '<button type="button" class="b perigo" id="ul-remover" style="' + (logoAtual ? '' : 'display:none') + '">Remover</button>' +
        '</div>' +
        '<input type="file" id="ul-input" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="display:none">' +
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
    alvo.innerHTML =
      '<div class="cfg-linha" style="border-top:0"><b>Conexão</b>' +
        '<span class="cfg-estado"><span class="cfg-ponto ' + (r.ok ? 'ok' : 'erro') + '"></span>' +
        (r.ok ? 'Respondendo' : 'Sem resposta') + '</span>' +
        '<button class="b p" data-verificar-banco>Verificar de novo</button></div>' +
      '<div class="cfg-linha"><b>Última verificação</b><span>' + hora +
        (r.ok ? ' · ' + r.ms + ' ms' : '') + '</span></div>' +
      (r.ok ? '' : '<div class="cfg-linha"><b>Detalhe</b><span>' + esc(r.erro) + '</span></div>');
    const b = alvo.querySelector('[data-verificar-banco]');
    if (b) b.onclick = () => {
      alvo.innerHTML = '<div class="cfg-estado"><span class="cfg-ponto"></span>' +
        '<span>Verificando…</span></div>';
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
           trilhaCliente, erroConteudo,
           abrirLixeira, abrirArquivados, arquivarGravacao, paraLixeira,
           modalNovaGravacao, modalNovoCliente, modalEditarCliente, excluirCliente,
           buscar, duplicarGravacao, excluirGravacao, IC,
           get ultima() { return ultimaGravacao; } };
})();
