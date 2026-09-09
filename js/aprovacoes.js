/* =====================================================================
   APROVAÇÕES — caixa de entrada da equipe

   O que o cliente decidiu, onde e por quê. Lê a view aprovacoes_painel
   (contagens já prontas) e os registros canônicos (partes, comentários,
   eventos). Nada aqui altera texto de roteiro: corrigir é no editor.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Aprovacoes = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');

  const SITUACOES = [
    ['aguardando', 'Aguardando cliente', ['pendente', 'parcial']],
    ['ajustes',    'Ajustes solicitados', ['ajustes']],
    ['recusado',   'Recusados', ['recusado']],
    ['aprovado',   'Aprovados', ['aprovado']],
    ['todos',      'Todos', null]   /* inclui versões substituídas e canceladas */
  ];
  const ROTULO = { pendente: 'Aguardando cliente', parcial: 'Parcialmente revisado', aprovado: 'Aprovado',
                   ajustes: 'Ajustes solicitados', recusado: 'Recusado', substituido: 'Versão substituída',
                   cancelado: 'Cancelado' };
  const TIPO = { roteiro: 'Roteiro', linha: 'Linha editorial', conteudo: 'Conteúdo', semana: 'Status semanal' };
  const rotulo = s => ROTULO[s] || s;

  const F = { situacao: 'aguardando', clienteId: '', tipo: '', busca: '', periodo: '' };

  /* ---- Realtime: a lista e as contagens acompanham o banco ----
     Um canal só, aberto quando a tela entra e fechado ao sair da rota
     (B7.Rota.aoSair). Mudança em aprovacoes ou nas cenas decididas
     agenda uma re-leitura curta; a tela redesenha a partir dos mesmos
     filtros, sem recarregar a página. */
  let canal = null, agendado = null;
  function assinar(assinaturas, aoMudar) {
    desassinar();
    if (!B7.DB.canal) return;
    canal = B7.DB.canal('aprov-' + Date.now(), assinaturas, () => {
      clearTimeout(agendado);
      agendado = setTimeout(aoMudar, 400);
    });
    if (B7.Rota && B7.Rota.aoSair) B7.Rota.aoSair(desassinar);
  }
  function desassinar() {
    clearTimeout(agendado); agendado = null;
    if (canal) { B7.DB.fecharCanal(canal); canal = null; }
  }
  const naRota = prefixo => (location.hash || '#/').split('?')[0] === prefixo;

  function lerFiltrosDaUrl() {
    const q = (location.hash.split('?')[1] || '');
    const p = new URLSearchParams(q);
    if (q) { F.situacao = 'aguardando'; F.clienteId = ''; F.tipo = ''; F.periodo = ''; F.busca = ''; }
    if (p.get('situacao')) F.situacao = p.get('situacao');
    if (p.get('cliente')) F.clienteId = p.get('cliente');
    if (p.get('tipo')) F.tipo = p.get('tipo');
    if (p.get('periodo')) F.periodo = p.get('periodo');
  }

  function periodo() {
    const hoje = new Date();
    const iso = d => d.toISOString().slice(0, 10);
    if (F.periodo === 'mes') return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: iso(hoje) };
    if (F.periodo === '30') { const d = new Date(hoje); d.setDate(d.getDate() - 30); return { de: iso(d), ate: iso(hoje) }; }
    if (F.periodo === 'ano') return { de: hoje.getFullYear() + '-01-01', ate: iso(hoje) };
    return {};
  }

  /* ============================================================ LISTA */
  async function abrir(silencioso) {
    if (B7.Perm && !B7.Perm.podeRota('aprovacoes')) { location.hash = '#/'; return; }
    if (!silencioso) {
      lerFiltrosDaUrl();
      B7.Rota.titulo(['Aprovações']);
      marcarNav();
      painel().innerHTML = '<div class="conteudo"><div class="b7-load"><div class="simbolo"></div>' +
        '<div class="txt">Carregando aprovações…</div></div></div>';
    }
    if (!canal) {
      assinar([{ table: 'aprovacoes' }, { table: 'aprovacao_partes' }], () => {
        if (!naRota('#/aprovacoes')) return desassinar();
        /* quem está digitando na busca não perde o campo: preserva o foco */
        const b = painel().querySelector('#ap-busca');
        if (b && document.activeElement === b) F.refocar = true;
        abrir(true);
      });
    }

    let itens = [], clientes = [], resumo = null;
    try {
      const sit = SITUACOES.find(x => x[0] === F.situacao) || SITUACOES[0];
      const per = periodo();
      [itens, clientes, resumo] = await Promise.all([
        B7.DB.painelAprovacoes({ situacao: sit[2], clienteId: F.clienteId || null, tipo: F.tipo || null,
                                 busca: F.busca || null, de: per.de, ate: per.ate,
                                 somenteAtual: F.situacao !== 'todos' }),
        B7.DB.listarClientes().catch(() => []),
        resumoContagens({ clienteId: F.clienteId || null, de: per.de, ate: per.ate })
      ]);
    } catch (e) {
      return painel().innerHTML = '<div class="conteudo"><div class="estado-b7"><b>Não foi possível carregar as aprovações.</b>' +
        '<p>' + esc(e.message || '') + '</p><p class="ajuda">Se a mensagem falar de tabela ou função inexistente, rode migration_aprovacoes_v2.sql no Supabase.</p></div></div>';
    }

    painel().innerHTML = '<div class="conteudo entra">' +
      '<div class="cab-conteudo"><div><h1>Aprovações</h1>' +
      '<p>O que foi enviado aos clientes e o que eles decidiram. Corrigir é no editor; aqui você vê e acompanha.</p></div></div>' +

      '<div class="ap-resumo">' +
        cartaoResumo('aguardando', resumo.aguardando, 'Aguardando cliente') +
        cartaoResumo('ajustes', resumo.ajustes, 'Ajustes solicitados') +
        cartaoResumo('recusado', resumo.recusado, 'Recusados') +
        cartaoResumo('aprovado', resumo.aprovado, 'Aprovados') +
      '</div>' +

      '<div class="ap-filtros">' +
        '<div class="abas-cliente ap-abas">' + SITUACOES.map(([k, r]) =>
          '<button class="aba' + (F.situacao === k ? ' on' : '') + '" data-sit="' + k + '">' + esc(r) + '</button>').join('') + '</div>' +
        '<div class="ap-filtros-linha">' +
          '<select class="campo" id="ap-cliente"><option value="">Todos os clientes</option>' +
            clientes.map(c => '<option value="' + esc(c.id) + '"' + (F.clienteId === c.id ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('') + '</select>' +
          '<select class="campo" id="ap-tipo"><option value="">Todos os tipos</option>' +
            Object.keys(TIPO).map(t => '<option value="' + t + '"' + (F.tipo === t ? ' selected' : '') + '>' + TIPO[t] + '</option>').join('') + '</select>' +
          '<select class="campo" id="ap-periodo">' +
            [['', 'Qualquer período'], ['mes', 'Este mês'], ['30', 'Últimos 30 dias'], ['ano', 'Este ano']].map(([v, r]) =>
              '<option value="' + v + '"' + (F.periodo === v ? ' selected' : '') + '>' + r + '</option>').join('') + '</select>' +
          '<input class="campo" id="ap-busca" placeholder="Buscar pelo título…" value="' + esc(F.busca) + '">' +
        '</div>' +
      '</div>' +

      (itens.length
        ? '<div class="ap-lista">' + itens.map(linha).join('') + '</div>'
        : '<div class="estado-b7"><b>' + vazio() + '</b><p>Os filtros valem para a lista e para os números acima.</p></div>') +
    '</div>';

    const p = painel();
    p.querySelectorAll('[data-sit]').forEach(b => b.onclick = () => { F.situacao = b.dataset.sit; abrir(true); });
    p.querySelector('#ap-cliente').onchange = e => { F.clienteId = e.target.value; abrir(true); };
    p.querySelector('#ap-tipo').onchange = e => { F.tipo = e.target.value; abrir(true); };
    p.querySelector('#ap-periodo').onchange = e => { F.periodo = e.target.value; abrir(true); };
    let t; p.querySelector('#ap-busca').oninput = e => { clearTimeout(t); t = setTimeout(async () => {
      F.busca = e.target.value.trim(); F.refocar = true; await abrir(true);
    }, 350); };
    if (F.refocar) { F.refocar = false; const b = p.querySelector('#ap-busca'); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    p.querySelectorAll('[data-abrir]').forEach(el => el.onclick = () => { location.hash = '#/aprovacoes/' + el.dataset.abrir; });
    p.querySelectorAll('[data-resumo]').forEach(el => el.onclick = () => { F.situacao = el.dataset.resumo; abrir(true); });
  }

  function vazio() {
    return { aguardando: 'Nenhum material aguardando o cliente.', ajustes: 'Nenhum pedido de ajuste em aberto.',
             recusado: 'Nenhum material recusado.', aprovado: 'Nenhuma aprovação neste recorte.' }[F.situacao] || 'Nada por aqui.';
  }

  /* Contagens pelo MESMO critério da lista: versão atual de cada material,
     no período e cliente selecionados. Um roteiro com 5 cenas aprovadas
     conta uma vez. */
  async function resumoContagens(f) {
    const linhas = await B7.DB.painelAprovacoes({ ...f, somenteAtual: true, limite: 1000 }).catch(() => []);
    const r = { aguardando: 0, ajustes: 0, recusado: 0, aprovado: 0 };
    linhas.forEach(a => {
      if (a.situacao === 'pendente' || a.situacao === 'parcial') r.aguardando++;
      else if (r[a.situacao] !== undefined) r[a.situacao]++;
    });
    return r;
  }
  function cartaoResumo(k, n, r) {
    return '<button class="ap-num ' + k + (F.situacao === k ? ' on' : '') + '" data-resumo="' + k + '"><b>' + n + '</b><span>' + r + '</span></button>';
  }

  function linha(a) {
    const pend = a.situacao === 'pendente' || a.situacao === 'parcial';
    const acao = pend ? 'Aguardando o cliente'
      : a.situacao === 'ajustes' ? 'Corrigir e reenviar'
      : a.situacao === 'recusado' ? 'Repensar a proposta'
      : a.situacao === 'aprovado' ? 'Seguir para a produção' : '';
    return '<div class="ap-item" data-abrir="' + esc(a.id) + '">' +
      B7.UI.avatarCliente(a.cliente_nome, a.cliente_logo_url, 'ap-logo') +
      '<div class="ap-tx">' +
        '<b>' + esc(a.titulo) + '</b>' +
        '<small>' + esc(a.cliente_nome) + ' · ' + esc(TIPO[a.tipo] || a.tipo) + ' · v' + a.versao +
          (a.versao_atual ? '' : ' (substituída)') + ' · enviado ' + esc(B7.UI.quando(a.enviado_em)) +
          (a.enviado_por_nome ? ' por ' + esc(a.enviado_por_nome) : '') + '</small>' +
      '</div>' +
      '<div class="ap-cenas">' + (a.total_partes
        ? '<b>' + (a.partes_aprovadas || 0) + '/' + a.total_partes + '</b><span>cenas ok' + (a.partes_ajustes ? ' · ' + a.partes_ajustes + ' ajuste(s)' : '') + '</span>'
        : '') + '</div>' +
      '<div class="ap-resposta">' + (a.decidido_em
        ? '<b>' + esc(a.decidido_por_nome || 'Cliente') + '</b><span>' + esc(B7.UI.quando(a.decidido_em)) + '</span>'
        : (a.ultima_resposta_cliente ? '<b>Comentou</b><span>' + esc(B7.UI.quando(a.ultima_resposta_cliente)) + '</span>' : '<span>sem resposta</span>')) + '</div>' +
      '<span class="ap-sit ' + esc(a.situacao) + '">' + esc(rotulo(a.situacao)) + '</span>' +
      '<span class="ap-acao">' + esc(acao) + '</span>' +
    '</div>';
  }

  /* ========================================================== DETALHE */
  async function abrirDetalhe(id, silencioso) {
    if (B7.Perm && !B7.Perm.podeRota('aprovacoes')) { location.hash = '#/'; return; }
    if (!silencioso) {
      marcarNav();
      painel().innerHTML = '<div class="conteudo"><div class="b7-load"><div class="simbolo"></div><div class="txt">Abrindo…</div></div></div>';
      /* o cliente decidiu enquanto a equipe olhava: a tela acompanha */
      assinar([{ table: 'aprovacoes', filter: 'id=eq.' + id },
               { table: 'aprovacao_partes', filter: 'aprovacao_id=eq.' + id },
               { table: 'comentarios', filter: 'aprovacao_id=eq.' + id }], () => {
        if (!naRota('#/aprovacoes/' + id)) return desassinar();
        const c = painel().querySelector('#ap-com');
        if (c && c.value.trim()) return;      /* resposta sendo escrita: não apaga */
        abrirDetalhe(id, true);
      });
    }
    let ap, cru, partes = [], comentarios = [], eventos = [], versoes = [];
    try {
      [ap, cru] = await Promise.all([B7.DB.painelAprovacao(id), B7.DB.aprovacao(id)]);
      if (!ap) throw new Error('Aprovação não encontrada.');
      [partes, comentarios, eventos, versoes] = await Promise.all([
        B7.DB.partesDaAprovacao(id).catch(() => []),
        B7.DB.comentariosAprovacao(id).catch(() => []),
        B7.DB.eventosDaAprovacao(id).catch(() => []),
        B7.DB.aprovacoesDoMaterial(ap.tipo, ap.alvo_id).catch(() => [])
      ]);
    } catch (e) {
      return painel().innerHTML = '<div class="conteudo"><div class="estado-b7"><b>' + esc(e.message) + '</b></div></div>';
    }
    B7.Rota.titulo([ap.titulo, 'Aprovações']);
    const snap = (cru && cru.snapshot) || {};
    const cenas = Array.isArray(snap.cenas) ? snap.cenas : [];
    const decisaoDe = pid => partes.find(p => p.parte_id === pid);
    const linkMaterial = ap.tipo === 'roteiro' && ap.gravacao_id ? '#/gravacao/' + ap.gravacao_id + '?roteiro=' + ap.alvo_id
      : ap.tipo === 'linha' ? '#/linha/' + ap.alvo_id
      : ap.tipo === 'conteudo' && ap.linha_id ? '#/linha/' + ap.linha_id + '/criativos'
      : ap.tipo === 'semana' ? '#/semana/' + ap.alvo_id : null;
    const comFalha = eventos.filter(e => e.erro);

    painel().innerHTML = '<div class="conteudo entra ap-detalhe">' +
      '<div class="trilha-nav"><button data-ir="#/">Central B7</button><span>/</span>' +
        '<button data-ir="#/aprovacoes">Aprovações</button><span>/</span><b>' + esc(ap.titulo) + '</b></div>' +

      '<div class="cab-conteudo"><div>' +
        '<span class="ap-sit ' + esc(ap.situacao) + '">' + esc(rotulo(ap.situacao)) + '</span>' +
        '<h1>' + esc(ap.titulo) + '</h1>' +
        '<p>' + esc(ap.cliente_nome) + ' · ' + esc(TIPO[ap.tipo] || ap.tipo) + ' · versão ' + ap.versao +
          (ap.versao_atual ? ' (atual)' : ' (substituída)') + ' · enviado ' + esc(B7.UI.quando(ap.enviado_em)) +
          (ap.enviado_por_nome ? ' por ' + esc(ap.enviado_por_nome) : '') + '</p></div>' +
        '<div class="ap-cab-acoes">' +
          (linkMaterial ? '<button class="b pri" data-ir="' + esc(linkMaterial) + '">Abrir no editor</button>' : '') +
          (ap.demanda_id ? '<button class="b contorno" data-ir="#/kanban">Demanda: ' + esc(B7.Kanban ? B7.Kanban.nomeColuna(ap.demanda_coluna) : ap.demanda_coluna) + '</button>' : '') +
        '</div></div>' +

      /* veredito */
      (ap.decidido_em
        ? '<div class="ap-veredito ' + esc(ap.situacao) + '"><b>' + esc(rotulo(ap.situacao)) + ' por ' + esc(ap.decidido_por_nome || 'cliente') +
          ' · ' + esc(B7.UI.quando(ap.decidido_em)) + '</b>' + (ap.motivo ? '<p>' + esc(ap.motivo) + '</p>' : '') +
          (ap.situacao === 'ajustes' || ap.situacao === 'recusado'
            ? '<p class="ajuda">Corrija no editor e use <b>Enviar para aprovação</b> de novo: isso cria a versão ' + (ap.versao + 1) + ' e avisa o cliente.</p>' : '') +
          '</div>'
        : '<div class="ap-veredito pendente"><b>Sem decisão final do cliente</b><p>' +
          (cenas.length ? (partes.filter(p => p.situacao === 'aprovada').length + ' de ' + cenas.length + ' cenas aprovadas · ' +
            partes.filter(p => p.situacao === 'ajustes').length + ' com ajustes · ' +
            cenas.filter(c => !decisaoDe(c.id)).length + ' sem decisão') : 'O cliente ainda não respondeu.') + '</p></div>') +

      (comFalha.length
        ? '<div class="ap-falha"><b>' + comFalha.length + ' evento(s) não processados</b> — notificação ou Kanban ficaram para trás. ' +
          comFalha.map(e => '<button class="b fina" data-reprocessar="' + esc(e.id) + '">Reprocessar ' + esc(e.tipo) + '</button>').join(' ') +
          '<p class="ajuda">' + esc(comFalha[0].erro) + '</p></div>' : '') +

      '<div class="ap-duplo">' +
        '<section>' +
          '<h3>' + (cenas.length ? 'Cenas da versão ' + ap.versao : 'Material enviado') + '</h3>' +
          (cenas.length
            ? cenas.map((c, i) => {
                const d = decisaoDe(c.id); const sit = d ? d.situacao : 'pendente';
                const coms = comentarios.filter(x => x.parte_id === c.id);
                return '<article class="ap-cena ' + sit + '">' +
                  '<div class="ap-cena-cab"><b>CENA ' + String(i + 1).padStart(2, '0') + '</b>' +
                    '<span class="ap-cena-tipo">' + esc((c.funcao && c.funcao.trim()) || c.tipo || '') + '</span>' +
                    '<span class="ap-cena-sit ' + sit + '">' + (sit === 'aprovada' ? '✓ Aprovada' : sit === 'ajustes' ? 'Ajustes pedidos' : 'Sem decisão') +
                    (d && d.decidido_em ? ' · ' + esc(B7.UI.quando(d.decidido_em)) : '') + '</span></div>' +
                  '<p class="ap-cena-texto">' + esc(c.texto || '') + '</p>' +
                  (coms.length ? '<div class="ap-cena-coms">' + coms.map(comentarioHTML).join('') + '</div>' : '') +
                '</article>';
              }).join('')
            : '<div class="ap-snap">' + Object.keys(snap).filter(k => typeof snap[k] === 'string' && snap[k] && k !== 'titulo')
                .map(k => '<div class="ap-campo"><small>' + esc(k.replace(/_/g, ' ').toUpperCase()) + '</small><p>' + esc(snap[k]) + '</p></div>').join('') +
              (Array.isArray(snap.conteudos) && snap.conteudos.length
                ? '<div class="ap-campo"><small>CONTEÚDOS (' + snap.conteudos.length + ')</small><ul>' +
                  snap.conteudos.map(c => '<li>' + esc(c.tipo || '') + ' — ' + esc(c.titulo || 'Sem título') + '</li>').join('') + '</ul></div>' : '') +
              '</div>') +
        '</section>' +
        '<aside>' +
          '<h3>Observações gerais</h3>' +
          (comentarios.filter(x => !x.parte_id).length
            ? comentarios.filter(x => !x.parte_id).map(comentarioHTML).join('')
            : '<p class="ajuda">Nenhuma observação geral.</p>') +
          '<div class="ap-novo-com"><input class="campo" id="ap-com" placeholder="Responder ao cliente…">' +
            '<button class="b pri fina" id="ap-com-add">Enviar</button></div>' +
          '<h3>Versões</h3><div class="ap-versoes">' +
            versoes.slice().sort((x, y) => y.versao - x.versao).map(v =>
              '<a class="ap-versao' + (v.id === ap.id ? ' atual' : '') + '" href="#/aprovacoes/' + esc(v.id) + '"><b>v' + v.versao + '</b>' +
              '<span class="ap-sit mini ' + esc(v.situacao) + '">' + esc(rotulo(v.situacao)) + '</span><small>' + esc(B7.UI.quando(v.enviado_em)) + '</small></a>').join('') +
          '</div>' +
          '<h3>Linha do tempo</h3><div class="ap-eventos">' +
            (eventos.length ? eventos.map(e => '<div class="ap-evento' + (e.erro ? ' erro' : '') + '"><span>' + esc(B7.UI.quando(e.created_at)) + '</span>' +
              '<b>' + esc(nomeEvento(e.tipo)) + '</b>' + (e.ator_nome ? '<small>' + esc(e.ator_nome) + '</small>' : '') +
              (e.payload && e.payload.rotulo ? '<small>' + esc(e.payload.rotulo) + '</small>' : '') + '</div>').join('')
            : '<p class="ajuda">Sem eventos registrados (aprovação anterior à v2).</p>') +
          '</div>' +
        '</aside>' +
      '</div>' +
    '</div>';

    const p = painel();
    p.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { location.hash = b.dataset.ir; });
    p.querySelectorAll('[data-resolver]').forEach(b => b.onclick = async () => {
      try { await B7.DB.resolverComentario(b.dataset.resolver); abrirDetalhe(id); }
      catch (e) { B7.UI.toast('Não foi possível resolver', { tipo: 'erro' }); }
    });
    p.querySelectorAll('[data-reprocessar]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await B7.DB.reprocessarEvento(b.dataset.reprocessar); B7.UI.toast('Evento reprocessado'); abrirDetalhe(id); }
      catch (e) { b.disabled = false; B7.UI.toast(e.message || 'Falhou de novo', { tipo: 'erro' }); }
    });
    const add = p.querySelector('#ap-com-add');
    if (add) add.onclick = async () => {
      const t = p.querySelector('#ap-com').value.trim(); if (!t) return;
      add.disabled = true;
      try { await B7.DB.comentarAprovacao(id, t); abrirDetalhe(id); }
      catch (e) { add.disabled = false; B7.UI.toast(e.message || 'Não foi possível comentar', { tipo: 'erro' }); }
    };
  }

  function comentarioHTML(c) {
    return '<div class="ap-com' + (c.resolvido ? ' resolvido' : '') + (c.autor_papel === 'cliente' ? ' cliente' : '') + '">' +
      '<div class="ap-com-cab"><b>' + esc(c.autor_nome || 'Equipe') + '</b><span>' + esc(B7.UI.quando(c.created_at)) + '</span>' +
      (!c.resolvido && c.autor_papel === 'cliente' ? '<button class="b fina" data-resolver="' + esc(c.id) + '">Resolvido</button>' : '') + '</div>' +
      '<p>' + esc(c.texto) + '</p></div>';
  }
  function nomeEvento(t) {
    return { 'aprovacao.enviada': 'Enviado ao cliente', 'aprovacao.aprovada': 'Aprovado pelo cliente',
             'aprovacao.ajustes': 'Ajustes solicitados', 'aprovacao.recusada': 'Recusado pelo cliente',
             'parte.aprovada': 'Cena aprovada', 'parte.ajustes': 'Ajuste pedido em cena' }[t] || t;
  }
  function marcarNav() {
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on', a.dataset.ir === '#/aprovacoes'));
    if (B7.moverTrilha) B7.moverTrilha();
  }

  /* ============================================ BLOCO PARA OUTRAS TELAS
     Resumo compacto de um material (editor, linha editorial). */
  function blocoStatus(a, opcoes) {
    opcoes = opcoes || {};
    if (!a) {
      return '<div class="ap-bloco vazio"><span class="ap-bloco-tx"><b>Ainda não enviado ao cliente</b>' +
        '<small>Quando estiver pronto, use Enviar para aprovação. O autosave nunca envia nada.</small></span>' +
        (opcoes.botaoEnviar ? '<button class="b fina pri" data-ap-enviar>Enviar para aprovação</button>' : '') + '</div>';
    }
    const pend = a.situacao === 'pendente' || a.situacao === 'parcial';
    return '<div class="ap-bloco ' + esc(a.situacao) + '">' +
      '<span class="ap-sit ' + esc(a.situacao) + '">' + esc(rotulo(a.situacao)) + '</span>' +
      '<span class="ap-bloco-tx"><b>Versão ' + a.versao + (a.decidido_em ? ' · ' + esc(a.decidido_por_nome || 'cliente') + ' · ' + esc(B7.UI.quando(a.decidido_em)) : ' · enviada ' + esc(B7.UI.quando(a.enviado_em))) + '</b>' +
        '<small>' + (a.total_partes ? (a.partes_aprovadas || 0) + '/' + a.total_partes + ' cenas aprovadas' + (a.partes_ajustes ? ' · ' + a.partes_ajustes + ' com ajustes' : '') + ' · ' : '') +
          (a.comentarios_abertos ? a.comentarios_abertos + ' observação(ões) em aberto' : 'sem observações em aberto') +
          (a.motivo ? ' · “' + esc(a.motivo.slice(0, 90)) + (a.motivo.length > 90 ? '…' : '') + '”' : '') + '</small></span>' +
      '<span class="ap-bloco-acoes"><button class="b fina" data-ir="#/aprovacoes/' + esc(a.id) + '">Ver feedback</button>' +
      (opcoes.botaoEnviar && !pend ? '<button class="b fina pri" data-ap-enviar>Enviar nova versão</button>' : '') +
      (opcoes.botaoEnviar && pend ? '<button class="b fina" data-ap-enviar title="Cria a versão ' + (a.versao + 1) + ' e substitui a atual">Reenviar</button>' : '') +
      '</span></div>';
  }

  return { abrir, abrirDetalhe, blocoStatus, rotulo, TIPO };
})();
