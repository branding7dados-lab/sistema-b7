/* =====================================================================
   CENTRAL DE PRODUÇÃO
   Três categorias e nada mais: Gravações, Linhas Editoriais, Roteiros.
   Cada número tem definição própria e abre a lista que o compõe — total
   e lista usam a mesma regra, então não existe divergência.

   O que não mora aqui: "continue de onde parou" (isso é dos módulos de
   edição) e indicador de banco (isso é das configurações).
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Central = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');
  const MESES = B7.UI.MESES;

  /* filtros globais — ficam na sessão, não no banco */
  let F = { periodo: 'todos', de: null, ate: null, clienteId: null };

  const IC = {
    claquete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="2.5" y="7.5" width="19" height="13" rx="2.5"/><path d="M2.5 11.5h19M7 7.5l2.5-4M13 7.5l2.5-4"/></svg>',
    calendario: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8.5 3v3M15.5 3v3"/></svg>',
    roteiro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M5.5 3.5h8l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4.5 20V5a1.5 1.5 0 0 1 1-1.5z"/><path d="M13.5 3.5V9h5M8 13h7M8 16.5h4.5"/></svg>',
    mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M12.5 6l6 6-6 6"/></svg>'
  };

  /* ---------------------------------------------------------- períodos */
  function intervalo(chave) {
    const hoje = new Date();
    const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
                     '-' + String(d.getDate()).padStart(2, '0');
    if (chave === 'mes') {
      return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
               ate: iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
               rotulo: MESES[hoje.getMonth()] + ' ' + hoje.getFullYear() };
    }
    if (chave === 'ano') {
      return { de: hoje.getFullYear() + '-01-01', ate: hoje.getFullYear() + '-12-31',
               rotulo: String(hoje.getFullYear()) };
    }
    return { de: null, ate: null, rotulo: 'Todos os períodos' };
  }

  /* =================================================================== */
  async function abrir() {
    /* sem isto, a Central era a única tela que não se identificava na
       barra lateral: o usuário não sabia onde estava */
    B7.Dashboard.marcarNav('#/');
    B7.Rota.titulo();
    painel().innerHTML = '<div class="conteudo">' + esqueleto() + '</div>';

    const p = intervalo(F.periodo);
    F.de = p.de; F.ate = p.ate;

    let dados, clientes;
    try {
      [dados, clientes] = await Promise.all([
        B7.DB.painelProducao({ de: F.de, ate: F.ate, clienteId: F.clienteId }),
        B7.DB.listarClientes().catch(() => [])
      ]);
    } catch (e) { return B7.Dashboard.erroConteudo(e); }

    /* listas de apoio são extras: nenhuma delas derruba a Central */
    const [recentesLinhas, recentesRoteiros] = await Promise.all([
      (B7.DB.listarTodasLinhas ? B7.DB.listarTodasLinhas(4) : Promise.resolve([]))
        .catch(() => []),
      B7.DB.listarRoteirosPor(null, { de: F.de, ate: F.ate }).catch(() => [])
    ]);

    painel().innerHTML = '<div class="conteudo entra">' +
      cabecalho(p, clientes) +
      categoriaGravacoes(dados.gravacoes) +
      categoriaLinhas(dados.linhas, recentesLinhas) +
      categoriaRoteiros(dados.roteiros, recentesRoteiros.slice(0, 4)) +
    '</div>';

    ligar(clientes);
  }

  const esqueleto = () => '<div class="cp-esqueleto">' +
    Array.from({ length: 3 }, () =>
      '<div class="cp-cat-sk"><div class="sk sk-l" style="width:180px"></div>' +
      '<div class="cp-tres">' + '<div class="sk sk-card"></div>'.repeat(3) + '</div></div>').join('') +
    '</div>';

  /* --------------------------------------------------------- cabeçalho */
  function cabecalho(p, clientes) {
    const cliente = F.clienteId && clientes.find(c => c.id === F.clienteId);
    return '<div class="cp-cab">' +
      '<div><h1>Central de Produção</h1>' +
      '<p>Panorama geral da produção da Branding7.</p></div>' +
      '<div class="menu cp-criar"><button class="b pri">' + IC.mais + ' Criar</button>' +
        '<div class="lista">' +
          '<button data-criar="gravacao">Nova gravação</button>' +
          '<button data-criar="roteiro">Novo roteiro</button>' +
          '<button data-criar="linha">Nova linha editorial</button>' +
          '<button data-criar="semana">Novo status semanal</button>' +
          '<hr><button data-criar="cliente">Novo cliente</button>' +
        '</div></div>' +
    '</div>' +

    '<div class="cp-filtros">' +
      '<div class="opcoes" id="cp-periodo">' +
        [['todos', 'Todos'], ['mes', 'Este mês'], ['ano', 'Este ano']].map(([k, r]) =>
          '<button data-periodo="' + k + '"' + (F.periodo === k ? ' class="on"' : '') + '>' +
          r + '</button>').join('') +
      '</div>' +
      '<select class="campo p" id="cp-cliente">' +
        '<option value="">Todos os clientes</option>' +
        clientes.map(c => '<option value="' + esc(c.id) + '"' +
          (F.clienteId === c.id ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('') +
      '</select>' +
      '<span class="cp-escopo">' + esc(p.rotulo) +
        (cliente ? ' · ' + esc(cliente.nome) : '') + '</span>' +
    '</div>';
  }

  /* ------------------------------------------------- bloco de categoria */
  function categoria(id, icone, titulo, acao, numeros, extra) {
    return '<section class="cp-cat' + (id === 'gravacoes' ? ' destaque' : '') + '">' +
      '<div class="cp-cat-cab">' +
        '<span class="cp-ic">' + icone + '</span>' +
        '<h2>' + titulo + '</h2>' +
        '<button class="b fina" data-ir="' + acao.href + '">' + acao.texto + ' ' + IC.seta + '</button>' +
      '</div>' +
      '<div class="cp-tres">' + numeros + '</div>' +
      (extra || '') +
    '</section>';
  }

  /* Um card de número. Clicar abre a lista que compõe exatamente ele. */
  function numero(valor, rotulo, chave, tom) {
    return '<button class="cp-num' + (tom ? ' ' + tom : '') + '" data-abrir="' + chave + '">' +
      '<b>' + valor + '</b><span>' + rotulo + '</span>' +
      '<i class="cp-seta">' + IC.seta + '</i></button>';
  }

  /* ---------------------------------------------------------- GRAVAÇÕES */
  function categoriaGravacoes(g) {
    const numeros = numero(g.total, 'Total de gravações', 'grav:todas') +
      numero(g.gravadas, 'Gravadas', 'grav:gravadas', 'ok') +
      numero(g.faltam, 'Faltam gravar', 'grav:faltam', 'pendente');

    /* andamento: contagens pequenas e clicáveis, não mais quatro cards */
    const andamento = [
      g.agendadas ? [g.agendadas, 'agendadas', 'grav:agendadas'] : null,
      g.sem_data ? [g.sem_data, 'sem agendamento', 'grav:sem_data'] : null,
      g.canceladas ? [g.canceladas, 'canceladas', 'grav:canceladas'] : null
    ].filter(Boolean);

    const faixa = andamento.length
      ? '<div class="cp-andamento">' + andamento.map(([n, r, k]) =>
          '<button data-abrir="' + k + '"><b>' + n + '</b> ' + r + '</button>').join('') + '</div>'
      : '';

    if (!g.total && !g.canceladas) {
      return categoria('gravacoes', IC.claquete, 'Gravações',
        { href: '#/gravacoes', texto: 'Ver gravações' }, numeros,
        '<div class="cp-vazio"><b>Nenhuma gravação ainda.</b>' +
        '<p>Comece registrando a próxima gravação da agência.</p>' +
        '<button class="b pri" data-criar="gravacao">+ Nova gravação</button></div>');
    }

    return categoria('gravacoes', IC.claquete, 'Gravações',
      { href: '#/gravacoes', texto: 'Ver gravações' }, numeros,
      faixa);
  }

  /* --------------------------------------------------- LINHAS EDITORIAIS */
  function categoriaLinhas(l, recentes) {
    const numeros = numero(l.total, 'Total de linhas editoriais', 'linha:todas') +
      numero(l.elaboracao, 'Em elaboração', 'linha:elaboracao', 'pendente') +
      numero(l.finalizadas, 'Finalizadas', 'linha:finalizadas', 'ok');

    if (!l.total) {
      return categoria('linhas', IC.calendario, 'Linhas editoriais',
        { href: '#/linhas', texto: 'Ver linhas editoriais' }, numeros,
        '<div class="cp-vazio"><b>Nenhuma linha editorial ainda.</b>' +
        '<p>Monte o planejamento do mês de um cliente.</p>' +
        '<button class="b pri" data-criar="linha">+ Nova linha editorial</button></div>');
    }

    const lista = recentes.length
      ? '<div class="cp-lista">' + recentes.map(x =>
          '<div class="cp-item" data-ir="#/linha/' + esc(x.id) + '">' +
          '<div class="cp-item-tx"><b>' + esc(x.cliente_nome || '') + ' · ' +
            esc(x.nome || (MESES[x.mes - 1] + ' ' + x.ano)) + '</b>' +
          '<div class="cp-item-meta">' +
            '<span>' + (x.total_conteudos || 0) + ' conteúdo' +
              ((x.total_conteudos || 0) === 1 ? '' : 's') + '</span>' +
            '<span>· ' + esc(x.status || 'Em criação') + '</span>' +
            (x.updated_at ? '<span>· ' + esc(B7.UI.quando(x.updated_at)) + '</span>' : '') +
          '</div></div>' +
          '<span class="cp-item-abrir">Abrir ' + IC.seta + '</span></div>').join('') + '</div>'
      : '';

    return categoria('linhas', IC.calendario, 'Linhas editoriais',
      { href: '#/linhas', texto: 'Ver linhas editoriais' }, numeros, lista);
  }

  /* ------------------------------------------------------------ ROTEIROS */
  function categoriaRoteiros(r, recentes) {
    const numeros = numero(r.total, 'Total de roteiros', 'rot:todos') +
      numero(r.andamento, 'Em andamento', 'rot:andamento', 'pendente') +
      numero(r.gravados, 'Gravados', 'rot:gravados', 'ok');

    /* "prontos para gravar" é um estágio de passagem: fica na faixa, junto
       do que ainda precisa de ação */
    const faixaRot = r.prontos
      ? '<div class="cp-andamento"><button data-abrir="rot:prontos">' +
        '<b>' + r.prontos + '</b> prontos para gravar</button></div>'
      : '';

    if (!r.total) {
      return categoria('roteiros', IC.roteiro, 'Roteiros',
        { href: '#/roteiros', texto: 'Ver roteiros' }, numeros,
        '<div class="cp-vazio"><b>Nenhum roteiro ainda.</b>' +
        '<p>Os roteiros vivem dentro de uma gravação.</p>' +
        '<button class="b pri" data-criar="gravacao">+ Nova gravação</button></div>');
    }

    const lista = recentes.length
      ? '<div class="cp-lista">' + recentes.map(x =>
          '<div class="cp-item" data-abrir-roteiro="' + esc(x.id) + '">' +
          '<div class="cp-item-tx"><b>' + esc(x.titulo || 'Sem título') + '</b>' +
          '<div class="cp-item-meta">' +
            '<span>' + esc(x.status || '') + '</span>' +
            (x.updated_at ? '<span>· ' + esc(B7.UI.quando(x.updated_at)) + '</span>' : '') +
          '</div></div>' +
          '<span class="cp-item-abrir">Abrir ' + IC.seta + '</span></div>').join('') + '</div>'
      : '';

    return categoria('roteiros', IC.roteiro, 'Roteiros',
      { href: '#/roteiros', texto: 'Ver roteiros' }, numeros, faixaRot + lista);
  }

  /* ------------------------------------------------------------ ligações */
  function ligar(clientes) {
    const p = painel();
    p.querySelectorAll('[data-ir]').forEach(el => el.onclick = e => {
      if (e.target.closest('button[data-vincular]')) return;
      location.hash = el.dataset.ir;
    });
    B7.UI.ligarMenus(p);

    p.querySelectorAll('[data-periodo]').forEach(b => b.onclick = () => {
      F.periodo = b.dataset.periodo; abrir();
    });
    const sel = document.getElementById('cp-cliente');
    if (sel) sel.onchange = () => { F.clienteId = sel.value || null; abrir(); };

    p.querySelectorAll('[data-criar]').forEach(b => b.onclick = () => criar(b.dataset.criar));
    p.querySelectorAll('[data-abrir]').forEach(b => b.onclick = () => abrirLista(b.dataset.abrir));
    p.querySelectorAll('[data-abrir-roteiro]').forEach(el => el.onclick = async () => {
      /* roteiro abre dentro da gravação dele */
      try {
        const r = await B7.DB.roteiro(el.dataset.abrirRoteiro);
        location.hash = '#/gravacao/' + r.recording_session_id;
      } catch (e) { B7.UI.toast('Não foi possível abrir o roteiro', { tipo: 'erro' }); }
    });
  }

  function criar(tipo) {
    if (tipo === 'gravacao') return B7.Dashboard.modalNovaGravacao();
    if (tipo === 'linha') return B7.Conteudo.abrirLinhasGlobais().then(() => {
      const b = document.getElementById('nova-linha-global');
      if (b) b.click();
    });
    if (tipo === 'semana') return B7.Semana.modalNovo(null);
    if (tipo === 'cliente') return B7.Dashboard.modalNovoCliente();
    if (tipo === 'roteiro') {
      B7.UI.toast('Um roteiro nasce dentro de uma gravação');
      return location.hash = '#/gravacoes';
    }
  }

  /* Abre a lista que compõe o número clicado, com a mesma regra usada
     para contar. */
  const REGRAS = {
    'grav:todas':     { situacoes: ['Pendente', 'Agendada', 'Gravada'], rotulo: 'Todas as gravações' },
    'grav:gravadas':  { situacoes: ['Gravada'], rotulo: 'Gravações concluídas' },
    'grav:faltam':    { situacoes: ['Pendente', 'Agendada'], rotulo: 'Faltam gravar' },
    'grav:agendadas': { situacoes: ['Agendada'], rotulo: 'Gravações agendadas' },
    'grav:sem_data':  { situacoes: 'sem_data', rotulo: 'Sem agendamento' },
    'grav:canceladas': { situacoes: ['Cancelada'], rotulo: 'Gravações canceladas' },
    'rot:todos':      { status: null, rotulo: 'Todos os roteiros' },
    'rot:andamento':  { status: ['Em criação', 'Em revisão', 'Aprovado internamente'],
                        rotulo: 'Roteiros em andamento' },
    'rot:prontos':    { status: ['Pronto para gravar'], rotulo: 'Prontos para gravar' },
    'rot:gravados':   { status: ['Gravado'], rotulo: 'Roteiros gravados' },
    'linha:todas':       { linha: 'todas', rotulo: 'Todas as linhas editoriais' },
    'linha:elaboracao':  { linha: 'elaboracao', rotulo: 'Linhas em elaboração' },
    'linha:finalizadas': { linha: 'finalizadas', rotulo: 'Linhas finalizadas' }
  };

  async function abrirLista(chave) {
    const regra = REGRAS[chave];
    if (!regra) return;
    const filtros = { de: F.de, ate: F.ate, clienteId: F.clienteId };

    const m = B7.UI.modal('<h3>' + esc(regra.rotulo) + '</h3>' +
      '<div class="sub" id="cpl-sub">Carregando…</div>' +
      '<div id="cpl-lista" class="cp-lista-modal"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>', { larga: true });

    try {
      let itens = [], render;
      if (regra.situacoes !== undefined) {
        itens = await B7.DB.listarGravacoesPor(regra.situacoes, filtros);
        render = g => '<div class="cp-item" data-ir="#/gravacao/' + esc(g.id) + '">' +
          '<div class="cp-item-tx"><b>' + esc(g.nome || 'Sem nome') + '</b>' +
          '<div class="cp-item-meta"><span>' + esc(g.cliente_nome || '') + '</span>' +
          (g.data_gravacao ? '<span>· ' + esc(B7.UI.dataBR(g.data_gravacao)) + '</span>'
                           : '<span>· sem data</span>') +
          '<span>· ' + esc(g.situacao || '') + '</span></div></div></div>';
      } else if (regra.status !== undefined) {
        itens = await B7.DB.listarRoteirosPor(regra.status, filtros);
        render = r => '<div class="cp-item" data-abrir-roteiro="' + esc(r.id) + '">' +
          '<div class="cp-item-tx"><b>' + esc(r.titulo || 'Sem título') + '</b>' +
          '<div class="cp-item-meta"><span>' + esc(r.status || '') + '</span></div></div></div>';
      } else {
        const todas = await B7.DB.listarTodasLinhas(60);
        itens = todas.filter(l => {
          if (F.clienteId && l.client_id !== F.clienteId) return false;
          if (regra.linha === 'finalizadas') return l.status === 'Finalizada';
          if (regra.linha === 'elaboracao') return l.status !== 'Finalizada';
          return true;
        });
        render = l => '<div class="cp-item" data-ir="#/linha/' + esc(l.id) + '">' +
          '<div class="cp-item-tx"><b>' + esc(l.cliente_nome || '') + ' · ' +
          esc(l.nome || (MESES[l.mes - 1] + ' ' + l.ano)) + '</b>' +
          '<div class="cp-item-meta"><span>' + (l.total_conteudos || 0) + ' conteúdos</span>' +
          '<span>· ' + esc(l.status || '') + '</span></div></div></div>';
      }

      m.querySelector('#cpl-sub').textContent =
        itens.length + (itens.length === 1 ? ' registro' : ' registros');
      m.querySelector('#cpl-lista').innerHTML = itens.length
        ? itens.map(render).join('')
        : '<div class="vazio-leve">Nenhum registro com este filtro.</div>';
      m.querySelectorAll('[data-ir]').forEach(el => el.onclick = () => {
        m.fechar(); location.hash = el.dataset.ir;
      });
      m.querySelectorAll('[data-abrir-roteiro]').forEach(el => el.onclick = async () => {
        try {
          const r = await B7.DB.roteiro(el.dataset.abrirRoteiro);
          m.fechar();
          location.hash = '#/gravacao/' + r.recording_session_id;
        } catch (e) {}
      });
    } catch (e) {
      /* A mensagem genérica escondia a causa e impedia qualquer
         diagnóstico. Erro de coluna quase sempre significa migration
         faltando; erro de permissão, RLS. Dizer isso economiza horas. */
      const msg = (e && e.message) || '';
      let explicacao = msg;
      if (/column .* does not exist|42703/i.test(msg)) {
        explicacao = 'O banco está sem uma coluna que esta lista usa. ' +
          'Rode migration_central.sql no Supabase — ele recria a view de gravações.';
      } else if (/permission denied|42501/i.test(msg)) {
        explicacao = 'Seu acesso não alcança estes registros. ' +
          'Se o corte do RLS acabou de rodar, confira se você entrou com uma conta da equipe.';
      } else if (/relation .* does not exist|42P01/i.test(msg)) {
        explicacao = 'Falta uma tabela ou view no banco. Rode as migrations pendentes.';
      }
      const alvo = m.querySelector('#cpl-sub');
      alvo.innerHTML = '<b>Não foi possível carregar a lista.</b>' +
        (explicacao ? '<br><span class="cpl-causa">' + esc(explicacao) + '</span>' : '');
      console.error('B7 · lista da central:', msg);
    }
  }

  return { abrir, filtros: () => F };
})();
