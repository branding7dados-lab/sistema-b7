/* =====================================================================
   B7 DESIGN — fila de peças visuais (cards, capas de reel, carrosséis,
   stories) que nascem de um conteúdo da Linha Editorial ("Enviar para
   Design", em linha.js) ou de uma demanda manual criada aqui.

   Designer entra e vê o que precisa fazer AGORA — não um dashboard.
   Admin/coordenador enxergam a fila inteira, filtram, atribuem e revisam.
   O card nunca é o dono da imagem: a arte mora no Storage privado
   (design-files), a peça guarda só o caminho.

   Toda leitura vem de design_resumo (já junta cliente/linha/designer/
   última versão); toda escrita passa por função do banco
   (migration_design.sql) — mesmo padrão de Kanban e Aprovações.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Design = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');

  /* tipo da PEÇA de design (diferente do tipo do conteúdo de origem:
     Card/Reel/Carrossel/Story — este é o formato que o design entrega) */
  const TIPOS = [
    ['card', 'Card'], ['capa_reel', 'Capa de Reel'], ['carrossel', 'Carrossel'],
    ['stories', 'Stories'], ['outro', 'Outro']
  ];
  const rotuloTipo = t => (TIPOS.find(x => x[0] === t) || [, 'Peça'])[1];

  const STATUS = [
    ['aguardando_producao', 'Aguardando produção'],
    ['em_criacao', 'Em criação'],
    ['revisao_interna', 'Revisão interna'],
    ['ajustes', 'Ajustes'],
    ['aprovado_interno', 'Aprovado internamente'],
    ['aguardando_cliente', 'Aguardando cliente'],
    ['ajustes_cliente', 'Ajustes do cliente'],
    ['aprovado_cliente', 'Aprovado pelo cliente'],
    ['finalizado', 'Finalizado']
  ];
  const rotuloStatus = s => (STATUS.find(x => x[0] === s) || [, s || '—'])[1];
  const ordemStatus = s => { const i = STATUS.findIndex(x => x[0] === s); return i < 0 ? 999 : i; };

  const PRIORIDADES = [['normal', 'Normal'], ['alta', 'Alta'], ['urgente', 'Urgente']];
  const rotuloPrioridade = p => (PRIORIDADES.find(x => x[0] === p) || [, 'Normal'])[1];

  const PAPEIS_ARQUIVO = [
    ['preview', 'Prévia para revisão'], ['producao', 'Arquivos de produção'],
    ['anexo', 'Anexo'], ['final', 'Arquivo final']
  ];
  const rotuloPapel = p => (PAPEIS_ARQUIVO.find(x => x[0] === p) || [, p])[1];

  /* abas do topo — cada uma é, na prática, um filtro de status pronto */
  const ABAS_EQUIPE = [
    ['todas', 'Todas'],
    ['revisao', 'Revisão interna'],
    ['ajustes', 'Ajustes'],
    ['aprovadas', 'Aprovadas'],
    ['finalizadas', 'Finalizadas'],
    ['equipe', 'Equipe']
  ];
  const STATUS_DA_ABA = {
    revisao: ['revisao_interna'],
    ajustes: ['ajustes', 'ajustes_cliente'],
    aprovadas: ['aprovado_interno', 'aguardando_cliente', 'aprovado_cliente'],
    finalizadas: ['finalizado']
  };

  let dados = [], designers = [], clientes = [];

  const ehDesigner = () => B7.Auth.papel() === 'designer';
  const ehEquipe = () => !!(B7.Auth.ehEquipe && B7.Auth.ehEquipe());
  const meuId = () => { const u = B7.Auth.usuario(); return u ? u.id : null; };
  const ehMovel = () => window.matchMedia('(max-width: 760px)').matches;

  const F_PADRAO = { cliente: '', designer: '', tipo: '', status: '', prazo: '', linha: '',
                     prioridade: '', busca: '', vista: 'quadro', aba: null };
  let F = Object.assign({}, F_PADRAO);
  try { Object.assign(F, JSON.parse(sessionStorage.getItem('b7.design.filtros') || '{}')); } catch (e) {}
  function guardarFiltros() { try { sessionStorage.setItem('b7.design.filtros', JSON.stringify(F)); } catch (e) {} }

  /* =================================================================
     TELA PRINCIPAL
     ================================================================= */
  /* comoInicio=true: esta é a Home do Designer (rota "#/"), não a rota
     "#/design" — marca o item de nav certo ("Central B7") e evita um
     título de aba redundante. O conteúdo é exatamente o mesmo. */
  async function abrir(aba, comoInicio) {
    selecionados.clear();
    B7.Dashboard.marcarNav(comoInicio ? '#/' : '#/design');
    B7.Rota.titulo(comoInicio ? [] : ['Design']);
    if (aba) F.aba = aba;
    if (!F.aba) F.aba = ehDesigner() ? 'fila' : 'todas';

    painel().innerHTML = '<div class="conteudo design-tela"><div class="cab-conteudo"><div><h1>Design</h1>' +
      '<p>' + (ehDesigner() ? 'O que você precisa entregar, por Linha Editorial.' : 'A fila de produção visual da equipe.') + '</p></div></div>' +
      B7.UI.skeleton('tabela', { n: 6, cols: 4 }) + '</div>';

    try {
      const chamadas = [B7.DB.listarDesign()];
      if (ehEquipe()) { chamadas.push(B7.DB.listarDesigners().catch(() => [])); chamadas.push(B7.DB.listarClientes().catch(() => [])); }
      const [linhas, dsg, cli] = await Promise.all(chamadas);
      dados = linhas || [];
      designers = dsg || [];
      clientes = cli || [];
    } catch (e) {
      painel().innerHTML = '<div class="conteudo entra"><div class="estado-b7"><b>Não foi possível carregar o Design.</b>' +
        '<p>' + esc(e.message || '') + '</p>' +
        '<p>Se o sistema acabou de ser atualizado, rode migration_design.sql no Supabase.</p></div></div>';
      return;
    }
    desenhar();
    assinar();
  }

  function desenhar() {
    const equipe = ehEquipe();
    painel().innerHTML = '<div class="conteudo entra design-tela">' +
      '<div class="cab-conteudo"><div><h1>Design</h1>' +
      '<p>' + (ehDesigner() ? 'O que você precisa entregar, por Linha Editorial — sem precisar procurar.'
                            : 'A fila de produção visual da equipe.') + '</p></div>' +
      (equipe ? '<button class="b pri" id="ds-nova">+ Nova demanda de Design</button>' : '') + '</div>' +
      (equipe ? '<nav class="ds-abas" role="tablist">' + ABAS_EQUIPE.map(([k, r]) =>
        '<button role="tab" data-aba="' + k + '" class="' + (F.aba === k ? 'on' : '') + '" aria-selected="' + (F.aba === k) + '">' +
        esc(r) + '</button>').join('') + '</nav>' : '') +
      '<div id="ds-barra"></div>' +
      '<div id="ds-area"></div>' +
    '</div>';

    const btNova = painel().querySelector('#ds-nova');
    if (btNova) btNova.onclick = () => modalNovaDemanda();
    painel().querySelectorAll('[data-aba]').forEach(b => b.onclick = () => {
      F.aba = b.dataset.aba; guardarFiltros();
      painel().querySelectorAll('[data-aba]').forEach(x => x.classList.toggle('on', x === b));
      desenharBarra(); desenharArea();
    });

    desenharBarra();
    desenharArea();
  }

  /* =================================================================
     BARRA DE FILTROS — só a equipe tem toolbar cheia; o designer tem
     busca + vista, o essencial para achar uma peça na própria fila.
     ================================================================= */
  function filtrosAtivos() {
    return !!(F.cliente || F.designer || F.tipo || F.status || F.prazo || F.linha || F.prioridade || F.busca.trim());
  }

  function desenharBarra() {
    const cx = painel().querySelector('#ds-barra');
    if (!cx) return;
    const equipe = ehEquipe();
    const opc = (chave, atual, itens, rotulo) =>
      '<select class="campo fina ds-filtro' + (atual ? ' ativo' : '') + '" data-filtro="' + chave + '" aria-label="' + esc(rotulo) + '">' +
      itens.map(([v, r]) => '<option value="' + esc(v) + '"' + (atual === v ? ' selected' : '') + '>' + esc(r) + '</option>').join('') +
      '</select>';

    /* linhas editoriais presentes nos dados atuais — não existe um
       cadastro "todas as linhas" independente de peças de Design */
    const linhasPresentes = [...new Map(dados.filter(d => d.linha_id)
      .map(d => [d.linha_id, d.linha_nome])).entries()];

    cx.innerHTML = '<div class="ds-barra">' +
      '<div class="ds-busca-cx"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>' +
        '<input class="campo fina ds-busca" id="ds-busca" placeholder="Buscar peça, conteúdo ou cliente…" ' +
        'value="' + esc(F.busca) + '" aria-label="Buscar"></div>' +
      (equipe ? opc('cliente', F.cliente, [['', 'Cliente']].concat(clientes.map(c => [c.id, c.nome])), 'Cliente') : '') +
      (equipe ? opc('designer', F.designer, [['', 'Designer'], ['sem', 'Sem responsável']]
        .concat(designers.map(p => [p.id, p.nome])), 'Designer') : '') +
      opc('tipo', F.tipo, [['', 'Tipo']].concat(TIPOS), 'Tipo') +
      (equipe ? opc('status', F.status, [['', 'Status']].concat(STATUS), 'Status') : '') +
      opc('prazo', F.prazo, [['', 'Prazo'], ['atrasadas', 'Atrasadas'], ['hoje', 'Para hoje'],
        ['semana', 'Próximos 7 dias'], ['sem', 'Sem prazo']], 'Prazo') +
      (equipe && linhasPresentes.length ? opc('linha', F.linha, [['', 'Linha editorial']].concat(linhasPresentes), 'Linha editorial') : '') +
      (equipe ? opc('prioridade', F.prioridade, [['', 'Prioridade']].concat(PRIORIDADES), 'Prioridade') : '') +
      (filtrosAtivos() ? '<button class="b fina contorno" id="ds-limpar">Limpar filtros</button>' : '') +
      '<div class="ds-espaco"></div>' +
      '<span class="ds-total" id="ds-total"></span>' +
      (equipe ? '<div class="seg-vista" role="tablist">' +
        '<button role="tab" class="' + (F.vista === 'quadro' ? 'on' : '') + '" data-vista="quadro">Quadro</button>' +
        '<button role="tab" class="' + (F.vista === 'lista' ? 'on' : '') + '" data-vista="lista">Lista</button>' +
      '</div>' : '') +
    '</div>';

    const busca = cx.querySelector('#ds-busca');
    let t;
    busca.oninput = () => { clearTimeout(t); t = setTimeout(() => { F.busca = busca.value; guardarFiltros(); desenharArea(); atualizarLimpar(); }, 220); };
    cx.querySelectorAll('[data-filtro]').forEach(s => s.onchange = () => {
      F[s.dataset.filtro] = s.value; guardarFiltros();
      s.classList.toggle('ativo', !!s.value);
      desenharArea(); atualizarLimpar();
    });
    cx.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => {
      F.vista = b.dataset.vista; guardarFiltros();
      cx.querySelectorAll('[data-vista]').forEach(x => x.classList.toggle('on', x === b));
      desenharArea();
    });
    const limpar = cx.querySelector('#ds-limpar');
    if (limpar) limpar.onclick = () => {
      F.cliente = F.designer = F.tipo = F.status = F.prazo = F.linha = F.prioridade = F.busca = '';
      guardarFiltros(); desenharBarra(); desenharArea();
    };
  }

  function atualizarLimpar() {
    const cx = painel().querySelector('.ds-barra');
    if (!cx) return;
    const existe = cx.querySelector('#ds-limpar');
    if (filtrosAtivos() && !existe) {
      const b = document.createElement('button');
      b.className = 'b fina contorno'; b.id = 'ds-limpar'; b.textContent = 'Limpar filtros';
      b.onclick = () => { F.cliente = F.designer = F.tipo = F.status = F.prazo = F.linha = F.prioridade = F.busca = '';
        guardarFiltros(); desenharBarra(); desenharArea(); };
      cx.insertBefore(b, cx.querySelector('.ds-espaco'));
    } else if (!filtrosAtivos() && existe) existe.remove();
  }

  /* =================================================================
     FILTRAGEM — a mesma lista alimenta quadro, lista e equipe
     ================================================================= */
  function filtrar(lista) {
    const t = F.busca.trim().toLowerCase();
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const em7 = new Date(hoje); em7.setDate(hoje.getDate() + 7);
    const statusAba = F.aba && STATUS_DA_ABA[F.aba];
    return lista.filter(d => {
      if (F.cliente && d.client_id !== F.cliente) return false;
      if (F.designer === 'sem' && d.designer_id) return false;
      if (F.designer && F.designer !== 'sem' && d.designer_id !== F.designer) return false;
      if (F.tipo && d.tipo !== F.tipo) return false;
      if (F.status && d.status !== F.status) return false;
      if (F.linha && d.linha_id !== F.linha) return false;
      if (F.prioridade && (d.prioridade || 'normal') !== F.prioridade) return false;
      if (statusAba && !statusAba.includes(d.status)) return false;
      if (F.prazo) {
        const p = d.prazo ? new Date(d.prazo + 'T00:00:00') : null;
        if (F.prazo === 'sem' && p) return false;
        if (F.prazo !== 'sem' && !p) return false;
        if (F.prazo === 'atrasadas' && !(p < hoje && d.status !== 'finalizado')) return false;
        if (F.prazo === 'hoje' && p.getTime() !== hoje.getTime()) return false;
        if (F.prazo === 'semana' && !(p >= hoje && p <= em7)) return false;
      }
      if (t && !(d.titulo || '').toLowerCase().includes(t) &&
               !(d.conteudo_titulo || '').toLowerCase().includes(t) &&
               !(d.cliente_nome || '').toLowerCase().includes(t) &&
               !(d.designer_nome || '').toLowerCase().includes(t)) return false;
      return true;
    });
  }

  /* fila do designer: o que é dele + o que está sem responsável, para
     poder assumir. Nunca mistura peças de outra pessoa. */
  function filaDoDesigner(lista) {
    const minhas = lista.filter(d => d.designer_id === meuId());
    const semDono = lista.filter(d => !d.designer_id);
    return { minhas, semDono };
  }

  /* =================================================================
     ÁREA
     ================================================================= */
  function desenharArea() {
    const area = painel().querySelector('#ds-area');
    if (!area) return;

    if (F.aba === 'equipe' && ehEquipe()) {
      const vis = filtrar(dados);
      area.innerHTML = viewEquipe(vis);
      ligarEquipe(area);
      const total = painel().querySelector('#ds-total');
      if (total) total.textContent = '';
      return;
    }

    if (!ehEquipe()) {
      /* Central do designer: a Linha Editorial nunca precisa ser
         visitada à parte para descobrir trabalho — "Demandas a fazer"
         (sem responsável) e "Minhas demandas" (já assumidas) aparecem
         aqui, já agrupadas por Linha Editorial. */
      const vis = filtrar(dados);
      const { minhas, semDono } = filaDoDesigner(vis);
      const total = painel().querySelector('#ds-total');
      if (total) total.textContent = (minhas.length + semDono.length) + ' peça' + (minhas.length + semDono.length === 1 ? '' : 's');
      area.innerHTML = viewCentralDesigner(minhas, semDono);
      ligarCentralDesigner(area);
      ligarThumbs(area);
      return;
    }

    const vis = filtrar(dados);
    const total = painel().querySelector('#ds-total');
    if (total) total.textContent = vis.length + (vis.length === 1 ? ' peça' : ' peças');

    area.innerHTML = (F.vista === 'lista' ? viewLista(vis) : viewQuadro(vis));

    ligarArea(area);
    ligarThumbs(area);
  }

  /* =================================================================
     CENTRAL DO DESIGNER — "Demandas a fazer" e "Minhas demandas",
     sempre agrupadas por Linha Editorial. Nunca mistura peça de outro
     designer: "a fazer" é só o que está sem responsável.
     ================================================================= */
  function agruparPorLinha(lista) {
    const grupos = new Map();
    lista.forEach(d => {
      const chave = d.linha_id || '_sem_linha_' + (d.client_id || '');
      if (!grupos.has(chave)) grupos.set(chave, {
        linhaId: d.linha_id || null, linhaNome: d.linha_nome || (d.client_id ? 'Sem linha editorial' : 'Demandas internas'),
        clienteNome: d.cliente_nome || null, itens: []
      });
      grupos.get(chave).itens.push(d);
    });
    return [...grupos.values()].sort((a, b) => (a.linhaNome || '').localeCompare(b.linhaNome || ''));
  }

  function viewCentralDesigner(minhas, semDono) {
    const gruposFazer = agruparPorLinha(semDono);
    const gruposMinhas = agruparPorLinha(minhas);
    return '<div class="ds-central">' +
      '<section class="ds-central-sec"><h3>Demandas a fazer <span>' + semDono.length + '</span></h3>' +
      (gruposFazer.length
        ? gruposFazer.map(g => grupoFazerCartao(g)).join('')
        : '<div class="estado-b7 leve"><p>Nenhuma demanda sem responsável no momento.</p></div>') +
      '</section>' +
      '<section class="ds-central-sec"><h3>Minhas demandas <span>' + minhas.length + '</span></h3>' +
      (gruposMinhas.length
        ? gruposMinhas.map(g => grupoMinhasCartao(g)).join('')
        : '<div class="estado-b7 leve"><p>Nenhuma demanda atribuída a você ainda. Assuma uma acima.</p></div>') +
      '</section>' +
    '</div>';
  }

  function nearestPrazo(itens) {
    const comPrazo = itens.filter(d => d.prazo && d.status !== 'finalizado');
    if (!comPrazo.length) return null;
    comPrazo.sort((a, b) => new Date(a.prazo) - new Date(b.prazo));
    return prazoInfo(comPrazo[0]);
  }

  function grupoFazerCartao(g) {
    const info = nearestPrazo(g.itens);
    return '<article class="ds-grupo-card" data-grupo-abrir="' + esc(g.linhaId || '') + '">' +
      '<div class="ds-grupo-info">' +
        '<b>' + esc(g.linhaNome) + '</b>' +
        (g.clienteNome ? '<span class="ds-cli">' + esc(g.clienteNome) + '</span>' : '') +
        '<span class="ds-grupo-cont">' + g.itens.length + (g.itens.length === 1 ? ' peça' : ' peças') +
          (info ? ' · ' + esc(info.txt) : '') + '</span>' +
      '</div>' +
      (g.linhaId ? '<button class="b fina pri" data-assumir-linha="' + esc(g.linhaId) + '">Assumir demanda' + (g.itens.length > 1 ? ' (' + g.itens.length + ')' : '') + '</button>' : '') +
    '</article>';
  }

  function grupoMinhasCartao(g) {
    const total = g.itens.length;
    const finalizadas = g.itens.filter(d => d.status === 'finalizado').length;
    const ajustes = g.itens.filter(d => d.status === 'ajustes' || d.status === 'ajustes_cliente').length;
    const pct = total ? Math.round((finalizadas / total) * 100) : 0;
    const info = nearestPrazo(g.itens);
    return '<article class="ds-grupo-card ds-grupo-minhas" data-grupo-abrir="' + esc(g.linhaId || '') + '">' +
      '<div class="ds-grupo-info">' +
        '<b>' + esc(g.linhaNome) + '</b>' +
        (g.clienteNome ? '<span class="ds-cli">' + esc(g.clienteNome) + '</span>' : '') +
        '<div class="ds-grupo-progresso"><span style="width:' + pct + '%"></span></div>' +
        '<span class="ds-grupo-cont">' + finalizadas + ' de ' + total + ' finalizadas' +
          (ajustes ? ' · <b class="alerta">' + ajustes + ' em ajuste</b>' : '') +
          (info ? ' · ' + esc(info.txt) : '') + '</span>' +
      '</div>' +
      '<div class="ds-lista ds-lista-grade">' + g.itens.slice().sort(ordenarPorUrgencia).slice(0, 4).map(cartao).join('') + '</div>' +
      (total > 4 && g.linhaId ? '<button class="b fina contorno" data-grupo-abrir="' + esc(g.linhaId) + '">Ver as ' + total + ' peças desta linha</button>' : '') +
    '</article>';
  }

  function ligarCentralDesigner(area) {
    area.querySelectorAll('[data-grupo-abrir]').forEach(el => {
      if (el.closest('[data-peca]')) return; /* não intercepta clique no cartão de peça dentro do grupo */
      el.onclick = e => {
        if (e.target.closest('[data-assumir-linha]') || e.target.closest('[data-peca]')) return;
        const id = el.dataset.grupoAbrir;
        if (id) abrirLinha(id);
      };
    });
    area.querySelectorAll('[data-peca]').forEach(el => el.onclick = e => {
      if (e.target.closest('[data-check]')) return; abrirDetalhe(el.dataset.peca);
    });
    area.querySelectorAll('[data-assumir-linha]').forEach(b => b.onclick = async e => {
      e.stopPropagation();
      const linhaId = b.dataset.assumirLinha;
      b.disabled = true; b.textContent = 'Assumindo…';
      try {
        const r = await B7.DB.assumirDemandaLinha(linhaId);
        const n = (r && r.assumidas) || 0;
        if (n > 0) B7.UI.toast(n === 1 ? '1 demanda assumida' : n + ' demandas assumidas');
        else B7.UI.toast('Nenhuma demanda sobrou para assumir — alguém já pegou.', { tipo: 'aviso' });
        const linhas = await B7.DB.listarDesign();
        dados = linhas || [];
        desenharArea();
      } catch (e2) {
        b.disabled = false; b.textContent = 'Assumir demanda';
        B7.UI.toast('Não foi possível assumir: ' + (e2.message || ''), { tipo: 'erro' });
      }
    });
  }

  /* =================================================================
     VISTA POR LINHA EDITORIAL — leitura da produção de Design daquela
     linha, para o Designer não precisar abrir o editor completo da
     Linha Editorial só para ver o que está em jogo ali.
     ================================================================= */
  async function abrirLinha(linhaId) {
    B7.Dashboard.marcarNav('#/design');
    B7.Rota.titulo(['Design', 'Linha']);
    painel().innerHTML = '<div class="conteudo design-tela">' + B7.UI.skeleton('tabela', { n: 5, cols: 3 }) + '</div>';
    let itens;
    try { itens = await B7.DB.listarDesign({ linhaId }); }
    catch (e) {
      painel().innerHTML = '<div class="conteudo entra"><div class="estado-b7"><b>Não foi possível carregar esta linha.</b><p>' + esc(e.message || '') + '</p></div></div>';
      return;
    }
    const nome = (itens[0] && itens[0].linha_nome) || 'Linha editorial';
    const cliente = itens[0] && itens[0].cliente_nome;
    const semDono = itens.filter(d => !d.designer_id);
    painel().innerHTML = '<div class="conteudo entra design-tela">' +
      '<div class="cab-conteudo"><div>' +
        '<button class="b fina contorno" id="ds-voltar" style="margin-bottom:8px">← Voltar ao Design</button>' +
        '<h1>' + esc(nome) + '</h1>' +
        (cliente ? '<p>' + esc(cliente) + ' · produção de Design desta linha (leitura)</p>' : '<p>Produção de Design desta linha (leitura)</p>') +
      '</div>' +
      (ehDesigner() && semDono.length ? '<button class="b pri" id="ds-assumir-tudo">Assumir demanda (' + semDono.length + ')</button>' : '') +
      '</div>' +
      (itens.length ? '<div class="ds-lista ds-lista-grade">' + itens.slice().sort(ordenarPorUrgencia).map(cartao).join('') + '</div>'
        : '<div class="estado-b7"><b>Nenhuma peça de Design nesta linha ainda.</b></div>') +
    '</div>';
    const voltar = painel().querySelector('#ds-voltar');
    if (voltar) voltar.onclick = () => abrir();
    const assumirTudo = painel().querySelector('#ds-assumir-tudo');
    if (assumirTudo) assumirTudo.onclick = async () => {
      assumirTudo.disabled = true; assumirTudo.textContent = 'Assumindo…';
      try {
        const r = await B7.DB.assumirDemandaLinha(linhaId);
        const n = (r && r.assumidas) || 0;
        B7.UI.toast(n > 0 ? (n === 1 ? '1 demanda assumida' : n + ' demandas assumidas') : 'Nenhuma demanda sobrou para assumir.');
        abrirLinha(linhaId);
      } catch (e) {
        assumirTudo.disabled = false; assumirTudo.textContent = 'Assumir demanda';
        B7.UI.toast('Não foi possível assumir: ' + (e.message || ''), { tipo: 'erro' });
      }
    };
    painel().querySelectorAll('[data-peca]').forEach(el => el.onclick = () => abrirDetalhe(el.dataset.peca));
    ligarThumbs(painel());
  }

  /* =================================================================
     QUADRO — uma coluna por status presente no recorte atual; ordenar
     por urgência (prazo) dentro de cada coluna, mais atrasada primeiro
     ================================================================= */
  function viewQuadro(vis) {
    if (!vis.length) return blocoVazio();
    const statusPresentes = [...new Set(vis.map(d => d.status))].sort((a, b) => ordemStatus(a) - ordemStatus(b));
    const porStatus = s => vis.filter(d => d.status === s).sort(ordenarPorUrgencia);

    const coluna = s => '<section class="ds-col" data-status="' + s + '">' +
      '<header><b>' + esc(rotuloStatus(s)) + '</b><span class="ds-cont">' + porStatus(s).length + '</span></header>' +
      '<div class="ds-lista">' + porStatus(s).map(cartao).join('') + '</div></section>';

    if (ehMovel()) {
      if (!F._colMovel || !statusPresentes.includes(F._colMovel)) F._colMovel = statusPresentes[0];
      return '<div class="ds-movel">' +
        '<div class="ds-movel-sel" role="tablist">' + statusPresentes.map(s =>
          '<button data-col-movel="' + s + '" class="' + (F._colMovel === s ? 'on' : '') + '">' +
          esc(rotuloStatus(s)) + '<b>' + porStatus(s).length + '</b></button>').join('') + '</div>' +
        coluna(F._colMovel) + '</div>';
    }
    return '<div class="ds-quadro">' + statusPresentes.map(coluna).join('') + '</div>';
  }

  function ordenarPorUrgencia(a, b) {
    const pa = a.prazo ? new Date(a.prazo) : null, pb = b.prazo ? new Date(b.prazo) : null;
    if (pa && pb) return pa - pb;
    if (pa) return -1;
    if (pb) return 1;
    return (b.updated_at || '').localeCompare(a.updated_at || '');
  }

  /* =================================================================
     LISTA — compacta, ordenável, com seleção para atribuição em massa
     ================================================================= */
  let selecionados = new Set();

  function viewLista(vis) {
    if (!vis.length) return blocoVazio();
    const equipe = ehEquipe();
    return (equipe ? '<div class="ds-barra-selecao" id="ds-sel-barra" hidden>' +
      '<span id="ds-sel-cont"></span>' +
      '<button class="b fina pri" id="ds-sel-atribuir">Atribuir a…</button>' +
      '<button class="b fina" id="ds-sel-cancelar">Cancelar seleção</button></div>' : '') +
      '<div class="ds-tabela' + (equipe ? ' com-selecao' : '') + '">' +
      '<div class="ds-th">' + (equipe ? '<span></span>' : '') +
        '<span>Peça</span><span>Cliente</span><span>Tipo</span><span>Status</span><span>Designer</span><span>Prazo</span></div>' +
      vis.slice().sort(ordenarPorUrgencia).map(d => {
        const info = prazoInfo(d);
        return '<div class="ds-tr" data-peca="' + esc(d.id) + '" tabindex="0" role="button">' +
          (equipe ? '<span><input type="checkbox" class="ds-check" data-check="' + esc(d.id) + '" aria-label="Selecionar"></span>' : '') +
          '<span class="ds-tr-titulo"><b>' + esc(d.titulo || d.conteudo_titulo || 'Sem título') + '</b>' +
            (d.ultima_versao_estado === 'ajuste_solicitado' ? '<small class="ds-tag-ajuste">ajuste pendente</small>' : '') + '</span>' +
          '<span>' + esc(d.cliente_nome || '—') + '</span>' +
          '<span>' + esc(rotuloTipo(d.tipo)) + '</span>' +
          '<span><i class="ds-chip ' + esc(d.status) + '">' + esc(rotuloStatus(d.status)) + '</i></span>' +
          '<span>' + esc(d.designer_nome || '—') + '</span>' +
          '<span class="' + (info && info.atrasada ? 'ds-prazo atrasada' : 'ds-prazo') + '">' + (info ? esc(info.txt) : '—') + '</span>' +
        '</div>';
      }).join('') + '</div>';
  }

  function blocoVazio() {
    return '<div class="estado-b7"><b>' + (ehDesigner() ? 'Nenhuma peça atribuída a você.' : 'Nenhuma peça com esses filtros.') + '</b>' +
      '<p>' + (ehDesigner() ? 'Quando uma nova demanda de Design for atribuída, ela aparecerá aqui.' : 'Ajuste a busca ou os filtros.') + '</p></div>';
  }

  function blocoSemResponsavel(lista) {
    return '<div class="ds-bloco-sem"><h3>Sem responsável <span>' + lista.length + '</span></h3>' +
      '<p class="ds-sub">Disponíveis para qualquer designer assumir.</p>' +
      '<div class="ds-lista ds-lista-grade">' + lista.slice().sort(ordenarPorUrgencia).map(cartao).join('') + '</div></div>';
  }

  /* =================================================================
     CARTÃO — a mesma peça de dado alimenta quadro, lista (linha) e
     "sem responsável"; aqui é a versão em card usada nos dois primeiros
     ================================================================= */
  function cartao(d) {
    const info = prazoInfo(d);
    const feedback = d.ultima_versao_estado === 'ajuste_solicitado';
    return '<article class="ds-card' + (d.prioridade === 'urgente' ? ' urgente' : d.prioridade === 'alta' ? ' alta' : '') + '" ' +
      'data-peca="' + esc(d.id) + '" tabindex="0" role="button" aria-label="' + esc(d.titulo || d.conteudo_titulo || 'Peça de Design') + '">' +
      '<div class="ds-card-topo">' +
        (d.ultima_previa ? '<div class="ds-thumb" data-previa="' + esc(d.ultima_previa) + '"><span class="ds-thumb-esq"></span></div>'
          : '<div class="ds-thumb ds-thumb-vazia">' + iconeTipo(d.tipo) + '</div>') +
        '<div class="ds-card-info">' +
          '<span class="ds-tipo">' + esc(rotuloTipo(d.tipo)) + '</span>' +
          '<h4>' + esc(d.titulo || d.conteudo_titulo || 'Sem título') + '</h4>' +
          (d.cliente_nome ? '<span class="ds-cli">' + esc(d.cliente_nome) + '</span>' : '<span class="ds-cli sem">Interno</span>') +
        '</div>' +
      '</div>' +
      '<div class="ds-tags">' +
        '<span class="ds-chip ' + esc(d.status) + '">' + esc(rotuloStatus(d.status)) + '</span>' +
        (d.ultima_versao ? '<span class="ds-v">V' + String(d.ultima_versao).padStart(2, '0') + '</span>' : '') +
        (feedback ? '<span class="ds-feedback">Ajuste pendente</span>' : '') +
      '</div>' +
      '<div class="ds-pe">' +
        (d.designer_nome ? B7.UI.avatarPessoa({ nome: d.designer_nome, avatar_url: d.designer_avatar }, 'xs')
          : '<span class="ds-sem-resp" title="Sem responsável"></span>') +
        (info ? '<span class="ds-prazo' + (info.atrasada ? ' atrasada' : info.hoje ? ' hoje' : '') + '">' + esc(info.txt) + '</span>' : '') +
      '</div>' +
    '</article>';
  }

  function iconeTipo(t) {
    const M = {
      card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 15l4-4 4 3 4-5 4 3"/></svg>',
      capa_reel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M10 9.5l5 2.5-5 2.5z"/></svg>',
      carrossel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="7" height="12" rx="1.5"/><rect x="9" y="4" width="7" height="16" rx="1.5"/><rect x="16.5" y="6" width="5.5" height="12" rx="1.5"/></svg>',
      stories: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/></svg>'
    };
    return M[t] || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>';
  }

  /* prazo real ou nada — nunca inventa atraso sem data */
  function prazoInfo(d) {
    if (!d.prazo) return null;
    if (d.status === 'finalizado') return { txt: B7.UI.dataBR(d.prazo), atrasada: false };
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const p = new Date(d.prazo + 'T00:00:00');
    const dias = Math.round((p - hoje) / 86400000);
    if (dias < 0) return { txt: 'Atrasado há ' + (-dias) + (dias === -1 ? ' dia' : ' dias'), atrasada: true };
    if (dias === 0) return { txt: 'Vence hoje', hoje: true };
    if (dias === 1) return { txt: 'Vence amanhã' };
    return { txt: B7.UI.dataBR(d.prazo) };
  }

  /* =================================================================
     THUMBS — carregadas sob demanda (IntersectionObserver), nunca de
     uma vez: uma fila com 40 peças não dispara 40 URLs assinadas juntas
     ================================================================= */
  const cacheThumb = new Map();
  let observerThumb = null;
  function ligarThumbs(raiz) {
    if (!observerThumb && 'IntersectionObserver' in window) {
      observerThumb = new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting) { carregarThumb(en.target); observerThumb.unobserve(en.target); } });
      }, { rootMargin: '200px' });
    }
    raiz.querySelectorAll('.ds-thumb[data-previa]').forEach(el => {
      if (observerThumb) observerThumb.observe(el); else carregarThumb(el);
    });
  }
  async function carregarThumb(el) {
    const caminho = el.dataset.previa;
    if (!caminho) return;
    try {
      let url = cacheThumb.get(caminho);
      if (!url) { url = await B7.DB.urlArquivoDesign(caminho); cacheThumb.set(caminho, url); }
      if (!el.isConnected) return;
      el.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
      el.classList.add('ds-thumb-ok');
      const esq = el.querySelector('.ds-thumb-esq'); if (esq) esq.remove();
    } catch (e) { /* sem prévia visível, a peça continua acessível pelo resto do card */ }
  }

  /* =================================================================
     EQUIPE — quem está com o quê, sem inventar rankings
     ================================================================= */
  function viewEquipe(vis) {
    const grupos = new Map();
    designers.forEach(p => grupos.set(p.id, { pessoa: p, itens: [] }));
    grupos.set('sem', { pessoa: null, itens: [] });
    vis.forEach(d => {
      const chave = d.designer_id || 'sem';
      if (!grupos.has(chave)) grupos.set(chave, { pessoa: { id: chave, nome: d.designer_nome, avatar_url: d.designer_avatar }, itens: [] });
      grupos.get(chave).itens.push(d);
    });

    const cards = [...grupos.values()].filter(g => g.pessoa || g.itens.length).map(g => {
      const itens = g.itens;
      const ativas = itens.filter(d => d.status !== 'finalizado').length;
      const ajustes = itens.filter(d => d.status === 'ajustes' || d.status === 'ajustes_cliente').length;
      const atrasadas = itens.filter(d => { const i = prazoInfo(d); return i && i.atrasada; }).length;
      const chave = g.pessoa ? g.pessoa.id : 'sem';
      return '<article class="ds-equipe-card" data-designer="' + esc(chave) + '" tabindex="0" role="button">' +
        (g.pessoa ? B7.UI.avatarPessoa(g.pessoa, 'sm') : '<span class="ds-sem-resp lg" title="Sem responsável"></span>') +
        '<div class="ds-equipe-info"><b>' + esc(g.pessoa ? g.pessoa.nome : 'Sem responsável') + '</b>' +
          '<div class="ds-equipe-metricas">' +
            '<span>' + ativas + ' ativa' + (ativas === 1 ? '' : 's') + '</span>' +
            (ajustes ? '<span class="alerta">' + ajustes + ' em ajuste</span>' : '') +
            (atrasadas ? '<span class="erro">' + atrasadas + ' atrasada' + (atrasadas === 1 ? '' : 's') + '</span>' : '') +
          '</div></div></article>';
    });

    return '<div class="ds-equipe-grade">' + (cards.length ? cards.join('') :
      '<div class="estado-b7"><b>Nenhum designer ativo.</b><p>Cadastre um perfil com o papel Designer em Usuários.</p></div>') + '</div>';
  }

  function ligarEquipe(area) {
    area.querySelectorAll('[data-designer]').forEach(el => el.onclick = () => {
      const v = el.dataset.designer;
      F.designer = v === 'sem' ? 'sem' : v;
      F.aba = 'todas'; guardarFiltros();
      desenharAbasEstado(); desenharBarra(); desenharArea();
    });
  }
  function desenharAbasEstado() {
    painel().querySelectorAll('[data-aba]').forEach(b => b.classList.toggle('on', b.dataset.aba === F.aba));
  }

  /* =================================================================
     INTERAÇÕES DA ÁREA
     ================================================================= */
  function ligarArea(area) {
    area.querySelectorAll('[data-peca]').forEach(el => {
      el.onclick = e => { if (e.target.closest('[data-check]')) return; abrirDetalhe(el.dataset.peca); };
      el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDetalhe(el.dataset.peca); } };
    });
    area.querySelectorAll('[data-col-movel]').forEach(b => b.onclick = () => { F._colMovel = b.dataset.colMovel; desenharArea(); });

    /* seleção múltipla, só existe na lista */
    const barraSel = area.querySelector('#ds-sel-barra');
    if (barraSel) {
      const atualizarBarra = () => {
        barraSel.hidden = selecionados.size === 0;
        const c = area.querySelector('#ds-sel-cont');
        if (c) c.textContent = selecionados.size + (selecionados.size === 1 ? ' peça selecionada' : ' peças selecionadas');
      };
      area.querySelectorAll('[data-check]').forEach(chk => {
        chk.checked = selecionados.has(chk.dataset.check);
        chk.onclick = e => e.stopPropagation();
        chk.onchange = () => {
          if (chk.checked) selecionados.add(chk.dataset.check); else selecionados.delete(chk.dataset.check);
          atualizarBarra();
        };
      });
      const cancelar = area.querySelector('#ds-sel-cancelar');
      if (cancelar) cancelar.onclick = () => { selecionados.clear(); desenharArea(); };
      const atribuir = area.querySelector('#ds-sel-atribuir');
      if (atribuir) atribuir.onclick = () => abrirSeletorDesigner(null, [...selecionados], () => { selecionados.clear(); });
      atualizarBarra();
    }
  }

  /* Popover simples de atribuição — usado tanto no card/linha quanto em massa */
  function abrirSeletorDesigner(idUnico, idsMassa, aoTerminar) {
    const ids = idsMassa || [idUnico];
    const m = B7.UI.modal('<h3>Atribuir a…</h3>' +
      '<div class="sub">' + (ids.length > 1 ? ids.length + ' peças selecionadas.' : 'Escolha quem vai produzir esta peça.') + '</div>' +
      '<div class="lista solta mostrando" style="position:static;max-height:320px;overflow:auto">' +
        '<button role="menuitem" data-designer="">Sem responsável</button>' +
        designers.map(p => '<button role="menuitem" data-designer="' + esc(p.id) + '">' + esc(p.nome) + '</button>').join('') +
      '</div><div class="acoes"><button class="b" data-fecha>Cancelar</button></div>');
    m.querySelectorAll('[data-designer]').forEach(b => b.onclick = async () => {
      const designerId = b.dataset.designer || null;
      m.fechar();
      let falhas = 0;
      for (const id of ids) {
        try {
          await B7.DB.atribuirDesign(id, designerId);
          const l = await B7.DB.design(id).catch(() => null);
          if (l) { const i = dados.findIndex(x => x.id === id); if (i >= 0) dados[i] = l; }
        } catch (e) { falhas++; }
      }
      if (falhas) B7.UI.toast(falhas + ' peça(s) não puderam ser atribuídas.', { tipo: 'erro' });
      else B7.UI.toast(ids.length > 1 ? 'Peças atribuídas' : 'Peça atribuída');
      if (aoTerminar) aoTerminar();
      desenharArea();
      if (drawer && ids.includes(drawer.id)) atualizarDrawerSeAberto(drawer.id);
    });
  }

  /* =================================================================
     NOVA DEMANDA MANUAL — só título é obrigatório
     ================================================================= */
  function modalNovaDemanda() {
    const m = B7.UI.modal('<h3>Nova demanda de Design</h3>' +
      '<div class="sub">Só o título é obrigatório. O resto pode ser preenchido depois.</div>' +
      '<div class="corpo">' +
        '<label class="rot" for="dn-titulo">TÍTULO</label>' +
        '<input class="campo" id="dn-titulo" data-foco placeholder="ex.: Post de aniversário da marca">' +
        '<div class="linha mb" style="display:flex;gap:12px;margin-top:12px">' +
          '<div style="flex:1"><label class="rot" for="dn-cliente">CLIENTE</label>' +
            '<select class="campo" id="dn-cliente"><option value="">Sem cliente</option>' +
            clientes.map(c => '<option value="' + esc(c.id) + '">' + esc(c.nome) + '</option>').join('') + '</select></div>' +
          '<div style="flex:1"><label class="rot" for="dn-tipo">TIPO</label>' +
            '<select class="campo" id="dn-tipo">' + TIPOS.map(([v, r]) => '<option value="' + v + '"' + (v === 'outro' ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></div>' +
        '</div>' +
        '<div class="linha mb" style="display:flex;gap:12px;margin-top:12px">' +
          '<div style="flex:1"><label class="rot" for="dn-designer">DESIGNER</label>' +
            '<select class="campo" id="dn-designer"><option value="">Sem responsável</option>' +
            designers.map(p => '<option value="' + esc(p.id) + '">' + esc(p.nome) + '</option>').join('') + '</select></div>' +
          '<div style="flex:1"><label class="rot" for="dn-prazo">PRAZO</label><input class="campo" type="date" id="dn-prazo"></div>' +
        '</div>' +
        '<label class="rot" style="margin-top:12px">PRIORIDADE</label>' +
        '<div class="seg-linha" id="dn-prio">' + PRIORIDADES.map(([v, r]) =>
          '<button type="button" data-prio="' + v + '" class="' + (v === 'normal' ? 'on' : '') + '">' + r + '</button>').join('') + '</div>' +
        '<label class="rot" for="dn-desc" style="margin-top:12px">DESCRIÇÃO</label>' +
        '<textarea class="campo alta" id="dn-desc" rows="3" placeholder="O que precisa ser feito, referências, contexto…"></textarea>' +
        '<div id="dn-erro" class="ajuda erro-txt" role="alert"></div>' +
      '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" data-ok>Criar demanda</button></div>',
      { larga: true });

    let prio = 'normal';
    m.querySelectorAll('[data-prio]').forEach(b => b.onclick = () => {
      m.querySelectorAll('[data-prio]').forEach(x => x.classList.remove('on')); b.classList.add('on'); prio = b.dataset.prio;
    });

    m.querySelector('[data-ok]').onclick = async () => {
      const titulo = m.querySelector('#dn-titulo').value.trim();
      const erro = m.querySelector('#dn-erro');
      if (!titulo) { erro.textContent = 'Toda demanda de Design precisa de um título.'; m.querySelector('#dn-titulo').focus(); return; }
      const botao = m.querySelector('[data-ok]');
      botao.disabled = true; botao.textContent = 'Criando…';
      try {
        const id = await B7.DB.criarDesignManual({
          titulo, clientId: m.querySelector('#dn-cliente').value || null,
          tipo: m.querySelector('#dn-tipo').value,
          descricao: m.querySelector('#dn-desc').value.trim(),
          designerId: m.querySelector('#dn-designer').value || null,
          prazo: m.querySelector('#dn-prazo').value || null,
          prioridade: prio
        });
        const linha = await B7.DB.design(id);
        dados.push(linha);
        m.fechar();
        desenharArea();
        B7.UI.toast('Demanda criada');
        abrirDetalhe(id);
      } catch (e) {
        botao.disabled = false; botao.textContent = 'Criar demanda';
        erro.textContent = e.message || 'Não foi possível criar a demanda.';
      }
    };
  }

  /* =================================================================
     REALTIME — design_deliverables e design_versoes, um canal só
     ================================================================= */
  let canal = null, releituraT = null;
  const pendentes = new Set();

  function assinar() {
    desassinar();
    if (!B7.DB.canal) return;
    canal = B7.DB.canal('design-' + Date.now(), [
      { table: 'design_deliverables' }, { table: 'design_versoes' }
    ], p => {
      const id = p.table === 'design_deliverables'
        ? ((p.new && p.new.id) || (p.old && p.old.id))
        : ((p.new && p.new.deliverable_id) || (p.old && p.old.deliverable_id));
      if (id) agendarReleitura(id);
    });
    if (B7.Rota && B7.Rota.aoSair) B7.Rota.aoSair(desassinar);
  }
  function desassinar() {
    clearTimeout(releituraT); pendentes.clear();
    if (canal) { B7.DB.fecharCanal(canal); canal = null; }
  }
  function agendarReleitura(id) {
    pendentes.add(id);
    clearTimeout(releituraT);
    releituraT = setTimeout(async () => {
      const lote = [...pendentes]; pendentes.clear();
      for (const pid of lote) {
        try {
          const linha = await B7.DB.design(pid);
          const i = dados.findIndex(x => x.id === pid);
          if (i >= 0) dados[i] = linha; else dados.push(linha);
        } catch (e) {
          const i = dados.findIndex(x => x.id === pid);
          if (i >= 0) dados.splice(i, 1);
        }
      }
      if (painel().querySelector('#ds-area')) desenharArea();
      lote.forEach(id => { if (drawer && drawer.id === id) atualizarDrawerSeAberto(id); });
    }, 400);
  }

  /* =================================================================
     DETALHE — gaveta lateral
     ================================================================= */
  let drawer = null;   /* { id, el, extra, briefing, versaoAtualId, filaUpload, anterior, tecla } */

  async function abrirDetalhe(id) {
    /* link direto (#/design/<id>, ex.: vindo de uma notificação) chega
       aqui sem a lista por trás — monta a tela normal primeiro, e a
       gaveta abre por cima dela, como no Kanban */
    if (!painel().querySelector('#ds-area')) await abrir();
    let d = dados.find(x => x.id === id);
    if (!d) {
      try { d = await B7.DB.design(id); dados.push(d); } catch (e) {
        B7.UI.toast('Essa peça de Design não foi encontrada.', { tipo: 'erro' });
        return;
      }
    }
    if (drawer && drawer.id !== id) fecharDrawer();

    if (!drawer) {
      const el = document.createElement('div');
      el.className = 'ds-drawer-fundo';
      el.innerHTML = '<aside class="ds-drawer" role="dialog" aria-modal="true" aria-label="Detalhe da peça de Design"><div class="ds-dr-corpo">' +
        B7.UI.skeleton('tabela', { n: 5, cols: 2 }) + '</div></aside>';
      document.body.appendChild(el);
      document.body.classList.add('ds-drawer-aberta');
      el.addEventListener('mousedown', e => { if (e.target === el) fecharDrawer(); });
      const tecla = e => { if (e.key === 'Escape') fecharDrawer(); };
      document.addEventListener('keydown', tecla);
      drawer = { id, el, extra: null, briefing: null, versaoAtualId: null, filaUpload: [],
                 anterior: document.activeElement, tecla };
      if (B7.Rota && B7.Rota.aoSair) B7.Rota.aoSair(fecharDrawer);
    }

    await carregarExtra(d);
    if (!drawer || drawer.id !== id) return;
    desenharDrawer();
  }

  function fecharDrawer() {
    if (!drawer) return;
    document.removeEventListener('keydown', drawer.tecla);
    drawer.el.remove();
    document.body.classList.remove('ds-drawer-aberta');
    const foco = drawer.anterior;
    drawer = null;
    if (foco && foco.focus && document.contains(foco)) foco.focus();
  }

  async function carregarExtra(d) {
    try {
      const [hist] = await Promise.all([B7.DB.historicoDesign(d.id)]);
      drawer.extra = hist;
    } catch (e) { drawer.extra = { versoes: [], notificacoes: [] }; }
    if (!drawer.briefing) {
      try { drawer.briefing = await carregarBriefing(d); } catch (e) { drawer.briefing = { erro: true }; }
    }
  }

  /* Lê o material de origem exatamente como a Linha Editorial guarda —
     mesma leitura, mesma ordem de slides, mesma regra de CTA dinâmico
     (Slide 1 = abertura, último slide = CTA). Peça manual não tem
     conteúdo canônico: mostra a descrição digitada na criação. */
  async function carregarBriefing(d) {
    if (!d.conteudo_id) {
      const descricao = await B7.DB.descricaoDesign(d.id).catch(() => '');
      return { manual: true, descricao };
    }
    const conteudo = await B7.DB.conteudo(d.conteudo_id);
    const extra = { conteudo };
    if (conteudo.tipo === 'Carrossel') extra.slides = await B7.DB.listarSlides(conteudo.id).catch(() => []);
    if (conteudo.tipo === 'Story') extra.frames = await B7.DB.listarFrames(conteudo.id).catch(() => []);
    if (conteudo.script_id) extra.roteiro = await B7.DB.roteiro(conteudo.script_id).catch(() => null);
    if (conteudo.pilar_id && d.linha_id) {
      try { extra.pilar = (await B7.DB.listarPilares(d.linha_id)).find(p => p.id === conteudo.pilar_id); } catch (e) {}
    }
    return extra;
  }

  async function atualizarDrawerSeAberto(id) {
    if (!drawer || drawer.id !== id) return;
    /* não redesenha por cima de uma observação sendo digitada */
    const obs = drawer.el.querySelector('#dv-observacao');
    if (obs && obs.value.trim() && drawer._observacaoTocada) return;
    try { drawer.extra = await B7.DB.historicoDesign(id); } catch (e) {}
    if (drawer && drawer.id === id) desenharDrawer();
  }

  function desenharDrawer() {
    const d = dados.find(x => x.id === drawer.id);
    if (!d) return fecharDrawer();
    const x = drawer.extra || { versoes: [], notificacoes: [] };
    const versoes = x.versoes || [];
    const versaoAtual = versoes[0] || null;   // maior número = mais recente
    drawer.versaoAtualId = versaoAtual ? versaoAtual.id : null;

    const souResponsavel = d.designer_id === meuId();
    const equipe = ehEquipe();
    const podeEditar = equipe || souResponsavel;
    const podeAssumir = ehDesigner() && !d.designer_id;
    const info = prazoInfo(d);

    const aside = drawer.el.querySelector('.ds-drawer');
    aside.innerHTML =
      '<header class="ds-dr-cab">' +
        '<div class="ds-dr-linha1">' +
          '<span class="ds-tipo">' + esc(rotuloTipo(d.tipo)) + '</span>' +
          '<span class="ds-chip ' + esc(d.status) + '">' + esc(rotuloStatus(d.status)) + '</span>' +
          '<span class="ds-espaco"></span>' +
          '<button class="ico" data-fechar aria-label="Fechar">✕</button>' +
        '</div>' +
        '<h3>' + esc(d.titulo || d.conteudo_titulo || 'Sem título') + '</h3>' +
        '<div class="ds-dr-meta">' +
          (d.cliente_nome ? '<span>' + esc(d.cliente_nome) + '</span>' : '<span>Demanda interna</span>') +
          (d.linha_nome ? '<span>· ' + esc(d.linha_nome) + '</span>' : '') +
        '</div>' +
      '</header>' +
      '<div class="ds-dr-corpo" role="tabpanel">' +
        '<div class="ds-dr-grade">' +
          '<label class="ds-dr-campo"><small>RESPONSÁVEL</small>' +
            (equipe
              ? '<select class="campo fina" id="dv-designer"><option value="">Sem responsável</option>' +
                designers.map(p => '<option value="' + esc(p.id) + '"' + (d.designer_id === p.id ? ' selected' : '') + '>' + esc(p.nome) + '</option>').join('') + '</select>'
              : '<div class="ds-dr-valor">' + esc(d.designer_nome || 'Sem responsável') + '</div>') +
          '</label>' +
          '<label class="ds-dr-campo"><small>PRAZO</small>' +
            (equipe ? '<input class="campo fina" type="date" id="dv-prazo" value="' + esc(d.prazo || '') + '">'
                    : '<div class="ds-dr-valor' + (info && info.atrasada ? ' atrasada' : '') + '">' + (info ? esc(info.txt) : 'Sem prazo') + '</div>') +
          '</label>' +
          '<label class="ds-dr-campo"><small>PRIORIDADE</small>' +
            (equipe ? '<select class="campo fina" id="dv-prioridade">' + PRIORIDADES.map(([v, r]) =>
                '<option value="' + v + '"' + ((d.prioridade || 'normal') === v ? ' selected' : '') + '>' + r + '</option>').join('') + '</select>'
                    : '<div class="ds-dr-valor">' + esc(rotuloPrioridade(d.prioridade)) + '</div>') +
          '</label>' +
          '<span class="ds-dr-salvo" id="dv-salvo" aria-live="polite"></span>' +
        '</div>' +
        (podeAssumir ? '<button class="b pri" id="dv-assumir" style="width:100%;margin-top:6px">Assumir esta peça</button>' : '') +

        '<div class="ds-dr-bloco"><h4>Briefing</h4>' + blocoBriefing(d) + '</div>' +

        (podeEditar && d.status !== 'finalizado' ? blocoUpload(d) : '') +

        '<div class="ds-dr-bloco"><h4>Histórico de versões</h4>' + blocoVersoes(versoes) + '</div>' +

        (equipe && versaoAtual && versaoAtual.estado === 'enviada'
          ? '<div class="ds-dr-bloco ds-acoes-revisao">' +
              '<button class="b pri" id="dv-aprovar"' + (souResponsavel ? ' disabled title="Quem produziu a peça não pode aprová-la"' : '') + '>Aprovar internamente</button>' +
              '<button class="b contorno" id="dv-ajuste">Solicitar ajuste</button>' +
            '</div>' : '') +

        '<div class="ds-dr-bloco"><h4>Linha do tempo</h4>' + blocoTimeline(x.notificacoes || []) + '</div>' +
      '</div>' +
      '<footer class="ds-dr-pe">' +
        (equipe && (d.status === 'aprovado_interno' || d.status === 'aprovado_cliente')
          ? '<button class="b pri" id="dv-finalizar">Finalizar</button>' : '') +
        (equipe && versaoAtual && versaoAtual.estado === 'aprovada_interna' && d.client_id
          ? '<button class="b contorno" id="dv-enviar-cliente">Enviar para aprovação do cliente</button>' : '') +
      '</footer>';

    ligarDrawer(d, x, versaoAtual);
  }

  /* ---------------------------------------------------------- briefing */
  function blocoBriefing(d) {
    const b = drawer.briefing;
    if (!b) return '<p class="vazio-leve">Carregando…</p>';
    if (b.erro) return '<p class="vazio-leve">Não foi possível carregar o briefing.</p>';
    if (b.manual) {
      return b.descricao
        ? '<p class="ds-briefing-texto">' + esc(b.descricao) + '</p>'
        : '<p class="vazio-leve">Sem descrição.</p>';
    }
    const c = b.conteudo;
    const campo = (rot, val) => val ? '<div class="ds-campo-briefing"><small>' + rot + '</small><p>' + esc(val) + '</p></div>' : '';
    const linksRef = String(c.referencias || '').split('\n').map(l => l.trim()).filter(Boolean);
    const referencias = linksRef.length
      ? '<div class="ds-campo-briefing"><small>REFERÊNCIAS</small>' + linksRef.map(l =>
          /^https?:\/\//i.test(l) ? '<a class="kd-link" href="' + esc(l) + '" target="_blank" rel="noopener noreferrer">' + esc(l) + '</a>'
                                  : '<span class="kd-link">' + esc(l) + '</span>').join('') + '</div>' : '';
    const pilar = b.pilar ? '<div class="ds-campo-briefing"><small>PILAR</small><p>' + esc(b.pilar.nome || 'Pilar sem nome') + '</p></div>' : '';

    if (c.tipo === 'Card') {
      return campo('OBJETIVO', c.objetivo) + pilar +
        campo('HEADLINE', c.headline) + campo('SUB-HEADLINE', c.sub_headline) + campo('CTA', c.cta) +
        campo('DIREÇÃO VISUAL', c.direcao) + campo('LEGENDA', c.legenda) +
        campo('OBSERVAÇÃO PARA O DESIGN', c.observacao_design) + referencias;
    }
    if (c.tipo === 'Reel') {
      return campo('IDENTIFICAÇÃO DO REEL', c.titulo) + campo('CONTEXTO', c.objetivo || c.ideia_geral) + pilar +
        (b.roteiro
          ? '<div class="ds-campo-briefing"><small>ROTEIRO VINCULADO</small>' +
            '<button class="b fina contorno" data-abrir-roteiro="' + esc(b.roteiro.recording_session_id) + '" data-roteiro-id="' + esc(b.roteiro.id) + '">' +
            'Abrir "' + esc(b.roteiro.titulo || 'roteiro') + '"</button></div>'
          : '') + referencias;
    }
    if (c.tipo === 'Carrossel') {
      const slides = b.slides || [];
      return pilar + '<div class="ds-campo-briefing"><small>SLIDES <span class="ds-leve">— o último é sempre o CTA</span></small>' +
        (slides.length ? slides.map((s, i) => {
          const primeiro = i === 0, ultimo = i === slides.length - 1, unico = slides.length === 1;
          let rot = 'SLIDE ' + String(i + 1).padStart(2, '0');
          if (unico) rot += ' · CAPA · CTA'; else if (primeiro) rot += ' · CAPA'; else if (ultimo) rot += ' · CTA';
          return '<div class="ds-slide"><b>' + rot + '</b>' +
            (s.titulo ? '<p class="ds-slide-tit">' + esc(s.titulo) + '</p>' : '') +
            (s.texto ? '<p>' + esc(s.texto) + '</p>' : '') + '</div>';
        }).join('') : '<p class="vazio-leve">Nenhum slide cadastrado.</p>') + '</div>' +
        campo('LEGENDA', c.legenda) + referencias;
    }
    if (c.tipo === 'Story') {
      const frames = b.frames || [];
      return pilar + '<div class="ds-campo-briefing"><small>STORIES</small>' +
        (frames.length ? frames.map((f, i) => '<div class="ds-slide"><b>STORY ' + String(i + 1).padStart(2, '0') + '</b>' +
          (f.texto ? '<p>' + esc(f.texto) + '</p>' : '') +
          (f.direcao_visual ? '<p class="ds-leve">' + esc(f.direcao_visual) + '</p>' : '') + '</div>').join('')
          : '<p class="vazio-leve">Nenhum story cadastrado.</p>') + '</div>' +
        campo('CTA', c.cta) + referencias;
    }
    return campo('OBJETIVO', c.objetivo) + pilar + referencias;
  }

  /* ---------------------------------------------------------- upload */
  /* Upload é uma forma de mandar para revisão, não a única: a arte pode
     ter sido revisada e aprovada por fora (WhatsApp, e-mail…) — nesse
     caso não existe arquivo nenhum para anexar, e forçar um upload
     symbolic só pra "cumprir tabela" seria mentir sobre o que aconteceu.
     A via externa registra isso honestamente: sem arquivo, com uma
     anotação opcional de canal, e segue o mesmo ciclo de revisão. */
  const CANAIS_EXTERNOS = ['WhatsApp', 'E-mail', 'Reunião', 'Outro'];

  function blocoUpload(d) {
    if (drawer.viaExterna === undefined) drawer.viaExterna = false;
    return '<div class="ds-dr-bloco"><h4>Enviar nova versão</h4>' +
      '<div class="ds-via-toggle" role="tablist">' +
        '<button role="tab" data-via="upload" class="' + (!drawer.viaExterna ? 'on' : '') + '" aria-selected="' + !drawer.viaExterna + '">Enviar arquivo</button>' +
        '<button role="tab" data-via="externa" class="' + (drawer.viaExterna ? 'on' : '') + '" aria-selected="' + !!drawer.viaExterna + '">Revisada por fora (sem arquivo)</button>' +
      '</div>' +
      '<div id="dv-bloco-envio">' + (drawer.viaExterna ? blocoEnvioExterno() : blocoEnvioUpload(d)) + '</div>' +
    '</div>';
  }

  function blocoEnvioUpload(d) {
    const fila = drawer.filaUpload;
    const algumPronto = fila.some(f => f.estado === 'ok');
    const algumEnviando = fila.some(f => f.estado === 'enviando');
    const papeis = PAPEIS_ARQUIVO.filter(([v]) => v !== 'final' ||
      d.status === 'aprovado_interno' || d.status === 'aprovado_cliente');

    return '<div class="ds-drop" id="dv-drop" tabindex="0" role="button" aria-label="Escolher arquivos ou arrastar aqui">' +
        '<input type="file" id="dv-arquivo" multiple hidden>' +
        '<div class="ds-drop-tx"><b>Arraste arquivos aqui</b><span>ou clique para escolher · qualquer formato de arte</span></div>' +
      '</div>' +
      '<div id="dv-fila" class="ds-fila-upload">' + fila.map((f, i) => linhaUpload(f, i, papeis)).join('') + '</div>' +
      '<label class="rot" for="dv-observacao" style="margin-top:12px">OBSERVAÇÃO <span class="ds-leve">— opcional</span></label>' +
      '<textarea class="campo" id="dv-observacao" rows="2" placeholder="O que mudou nesta versão, algo que a revisão deveria olhar…"></textarea>' +
      '<button class="b pri" id="dv-enviar" style="width:100%;margin-top:10px" ' + (algumPronto && !algumEnviando ? '' : 'disabled') + '>' +
        'Enviar para revisão interna</button>' +
      (algumEnviando ? '<p class="ds-leve" style="margin-top:6px">Aguarde o envio terminar para mandar para revisão.</p>' : '');
  }

  function blocoEnvioExterno() {
    return '<p class="ds-leve">Use quando a arte foi mostrada e revisada fora do sistema. Nenhum arquivo é exigido — o resto do fluxo (ajuste, aprovação, finalização) continua igual.</p>' +
      '<label class="rot" for="dv-canal-externo" style="margin-top:10px">CANAL <span class="ds-leve">— opcional</span></label>' +
      '<select class="campo fina" id="dv-canal-externo"><option value="">Não informado</option>' +
        CANAIS_EXTERNOS.map(c => '<option value="' + esc(c) + '"' + (drawer.canalExterno === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') +
      '</select>' +
      '<label class="rot" for="dv-observacao" style="margin-top:12px">OBSERVAÇÃO <span class="ds-leve">— opcional</span></label>' +
      '<textarea class="campo" id="dv-observacao" rows="2" placeholder="ex.: Aprovado no grupo do WhatsApp com o cliente em 10/09…"></textarea>' +
      '<button class="b pri" id="dv-enviar" style="width:100%;margin-top:10px">Marcar como enviada para revisão</button>';
  }

  function linhaUpload(f, i, papeis) {
    const trancado = f.estado === 'enviando' || f.estado === 'ok';
    return '<div class="ds-up-item ds-up-item-' + f.estado + '" data-up="' + i + '">' +
      '<div class="ds-up-nome"><b>' + esc(f.arquivo.name) + '</b><small>' + formatarTamanho(f.arquivo.size) + '</small></div>' +
      '<select class="campo fina" data-up-papel="' + i + '"' + (trancado ? ' disabled' : '') + '>' +
        papeis.map(([v, r]) => '<option value="' + v + '"' + (f.papel === v ? ' selected' : '') + '>' + r + '</option>').join('') + '</select>' +
      (f.estado === 'enviando' ? '<div class="ds-up-barra"><span style="width:' + f.progresso + '%"></span></div><small>' + f.progresso + '%</small>'
        : f.estado === 'ok' ? '<span class="ds-up-ok">Enviado</span>'
        : f.estado === 'erro' ? '<span class="ds-up-erro">' + esc(f.erro || 'O envio foi interrompido') + '</span><button class="b fina" data-up-tentar="' + i + '">Tentar novamente</button>'
        : '<span class="ds-leve">Aguardando…</span>') +
    '</div>';
  }

  function formatarTamanho(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /* rascunho é criado só quando o primeiro arquivo entra na fila —
     abrir a gaveta para olhar não deve gerar uma versão vazia */
  async function garantirRascunho(deliverableId) {
    if (drawer.rascunhoId) return drawer.rascunhoId;
    drawer.rascunhoId = await B7.DB.criarRascunhoDesign(deliverableId);
    return drawer.rascunhoId;
  }

  async function adicionarArquivos(d, arquivos) {
    const novos = [...arquivos].map(arquivo => ({ arquivo, papel: 'preview', estado: 'pendente', progresso: 0, erro: null }));
    drawer.filaUpload.push(...novos);
    redesenharUpload(d);
    for (const f of novos) iniciarUpload(d, f);
  }

  async function iniciarUpload(d, f) {
    f.estado = 'enviando'; f.progresso = 0; f.erro = null;
    redesenharUpload(d);
    try {
      const versaoId = await garantirRascunho(d.id);
      const arquivoId = await B7.DB.enviarArquivoDesign({
        deliverableId: d.id, versaoId, arquivo: f.arquivo, papel: f.papel,
        aoProgredir: pct => { f.progresso = pct; atualizarBarraUpload(f); }
      });
      f.estado = 'ok'; f.arquivoId = arquivoId;
    } catch (e) {
      f.estado = 'erro'; f.erro = e.message || 'O envio foi interrompido.';
    }
    redesenharUpload(d);
  }

  function atualizarBarraUpload(f) {
    /* atualização leve: só a barra do item em questão, sem redesenhar tudo */
    const idx = drawer.filaUpload.indexOf(f);
    if (idx < 0) return;
    const item = drawer.el.querySelector('.ds-up-item[data-up="' + idx + '"] .ds-up-barra span');
    const txt = drawer.el.querySelector('.ds-up-item[data-up="' + idx + '"] .ds-up-barra + small');
    if (item) item.style.width = f.progresso + '%';
    if (txt) txt.textContent = f.progresso + '%';
  }

  function redesenharUpload(d) {
    const cx = drawer.el.querySelector('#dv-fila');
    const papeis = PAPEIS_ARQUIVO.filter(([v]) => v !== 'final' || d.status === 'aprovado_interno' || d.status === 'aprovado_cliente');
    if (cx) cx.innerHTML = drawer.filaUpload.map((f, i) => linhaUpload(f, i, papeis)).join('');
    ligarUpload(d);
    const btn = drawer.el.querySelector('#dv-enviar');
    if (btn) {
      const algumPronto = drawer.filaUpload.some(f => f.estado === 'ok');
      const algumEnviando = drawer.filaUpload.some(f => f.estado === 'enviando');
      btn.disabled = !(algumPronto && !algumEnviando);
    }
  }

  function ligarUpload(d) {
    const el = drawer.el;
    el.querySelectorAll('[data-up-papel]').forEach(s => s.onchange = () => {
      const f = drawer.filaUpload[+s.dataset.upPapel];
      if (f && f.estado === 'pendente') f.papel = s.value;
    });
    el.querySelectorAll('[data-up-tentar]').forEach(b => b.onclick = () => iniciarUpload(d, drawer.filaUpload[+b.dataset.upTentar]));
  }

  /* liga o bloco de envio (upload OU externo) — chamado no desenho
     inicial da gaveta e de novo sempre que o modo é trocado */
  function ligarBlocoEnvio(d) {
    const el = drawer.el;
    const drop = el.querySelector('#dv-drop'), input = el.querySelector('#dv-arquivo');
    if (drop && input) {
      drop.onclick = () => input.click();
      drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
      input.onchange = () => { if (input.files.length) adicionarArquivos(d, input.files); input.value = ''; };
      drop.ondragover = e => { e.preventDefault(); drop.classList.add('arrastando'); };
      drop.ondragleave = () => drop.classList.remove('arrastando');
      drop.ondrop = e => {
        e.preventDefault(); drop.classList.remove('arrastando');
        if (e.dataTransfer.files && e.dataTransfer.files.length) adicionarArquivos(d, e.dataTransfer.files);
      };
      ligarUpload(d);
    }
    const canal = el.querySelector('#dv-canal-externo');
    if (canal) canal.onchange = () => { drawer.canalExterno = canal.value || null; };
    const obs = el.querySelector('#dv-observacao');
    if (obs) obs.oninput = () => { drawer._observacaoTocada = !!obs.value.trim(); };

    const enviar = el.querySelector('#dv-enviar');
    if (!enviar) return;
    enviar.onclick = async () => {
      const via = drawer.viaExterna ? 'externa' : 'upload';
      const rotuloOriginal = enviar.textContent;
      enviar.disabled = true; enviar.textContent = via === 'externa' ? 'Registrando…' : 'Enviando…';
      try {
        const versaoId = await garantirRascunho(d.id);
        await B7.DB.enviarVersaoDesign(versaoId, (obs && obs.value.trim()) || '', via, drawer.canalExterno);
        drawer.filaUpload = []; drawer.rascunhoId = null; drawer._observacaoTocada = false;
        drawer.canalExterno = null; drawer.viaExterna = false;
        const novo = await B7.DB.design(d.id); Object.assign(d, novo);
        drawer.extra = await B7.DB.historicoDesign(d.id);
        B7.UI.toast(via === 'externa' ? 'Registrado — enviada para revisão interna' : 'Peça enviada para revisão interna');
        desenharDrawer(); desenharArea();
      } catch (e) {
        enviar.disabled = false; enviar.textContent = rotuloOriginal;
        B7.UI.toast('Não foi possível enviar: ' + (e.message || ''), { tipo: 'erro' });
      }
    };
  }

  /* ---------------------------------------------------------- versões */
  function blocoVersoes(versoes) {
    const enviadas = versoes.filter(v => v.estado !== 'rascunho');
    if (!enviadas.length) return '<p class="vazio-leve">Nenhuma versão enviada ainda.</p>';
    const ESTADOS = { enviada: 'Enviada para revisão', ajuste_solicitado: 'Ajuste solicitado',
      aprovada_interna: 'Aprovada internamente', enviada_cliente: 'Enviada ao cliente',
      ajuste_cliente: 'Ajuste do cliente', aprovada_cliente: 'Aprovada pelo cliente' };
    return '<div class="ds-versoes">' + enviadas.map(v =>
      '<div class="ds-versao ds-versao-' + v.estado + '">' +
        '<div class="ds-versao-cab"><b>V' + String(v.numero).padStart(2, '0') + '</b>' +
        '<span class="ds-chip-v ' + esc(v.estado) + '">' + esc(ESTADOS[v.estado] || v.estado) + '</span>' +
        (v.via === 'externa' ? '<span class="ds-chip-via">Revisada por fora' + (v.canal_externo ? ' — ' + esc(v.canal_externo) : '') + '</span>' : '') +
        '<small>' + esc(B7.UI.quando(v.enviada_em || v.created_at)) + '</small></div>' +
        (v.observacao ? '<p class="ds-versao-obs">' + esc(v.observacao) + '</p>' : '') +
        (v.estado === 'aprovada_interna' && v.aprovada_em ? '<p class="ds-versao-ap">Aprovada em ' + esc(B7.UI.quando(v.aprovada_em)) + '</p>' : '') +
      '</div>').join('') + '</div>';
  }

  /* ---------------------------------------------------------- timeline */
  function blocoTimeline(notifs) {
    if (!notifs.length) return '<p class="vazio-leve">Sem atividade registrada ainda.</p>';
    const ordenadas = notifs.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return '<div class="ds-timeline">' + ordenadas.map(n =>
      '<div class="ds-tl"><span class="ds-tl-pt"></span><div>' + esc(n.titulo || '') +
        (n.mensagem ? '<p class="ds-tl-msg">“' + esc(n.mensagem) + '”</p>' : '') +
        '<small>' + esc(B7.UI.quando(n.created_at)) + '</small></div></div>').join('') + '</div>';
  }

  /* ---------------------------------------------------------- ligações */
  function ligarDrawer(d, x, versaoAtual) {
    const el = drawer.el;
    el.querySelector('[data-fechar]').onclick = fecharDrawer;

    const salvo = el.querySelector('#dv-salvo');
    const salvar = async (campos, rotulo) => {
      if (salvo) { salvo.textContent = 'Salvando…'; salvo.className = 'ds-dr-salvo salvando'; }
      try {
        if ('designer_id' in campos) await B7.DB.atribuirDesign(d.id, campos.designer_id);
        if ('prazo' in campos || 'prioridade' in campos)
          await B7.DB.definirPrazoPrioridadeDesign(d.id, 'prazo' in campos ? campos.prazo : d.prazo, 'prioridade' in campos ? campos.prioridade : (d.prioridade || 'normal'));
        const novo = await B7.DB.design(d.id);
        Object.assign(d, novo);
        if (salvo) { salvo.textContent = rotulo + ' salvo'; salvo.className = 'ds-dr-salvo salvo'; }
        desenharArea();
      } catch (e) {
        if (salvo) { salvo.textContent = 'Não foi possível salvar'; salvo.className = 'ds-dr-salvo erro'; }
        B7.UI.toast('Não foi possível salvar: ' + (e.message || ''), { tipo: 'erro' });
      }
    };
    const selDesigner = el.querySelector('#dv-designer');
    if (selDesigner) selDesigner.onchange = () => salvar({ designer_id: selDesigner.value || null }, 'Responsável');
    const inpPrazo = el.querySelector('#dv-prazo');
    if (inpPrazo) inpPrazo.onchange = () => salvar({ prazo: inpPrazo.value || null }, 'Prazo');
    const selPrio = el.querySelector('#dv-prioridade');
    if (selPrio) selPrio.onchange = () => salvar({ prioridade: selPrio.value }, 'Prioridade');

    const assumir = el.querySelector('#dv-assumir');
    if (assumir) assumir.onclick = async () => {
      assumir.disabled = true; assumir.textContent = 'Assumindo…';
      try {
        await B7.DB.atribuirDesign(d.id, meuId());
        const novo = await B7.DB.design(d.id); Object.assign(d, novo);
        B7.UI.toast('Peça assumida'); desenharDrawer(); desenharArea();
      } catch (e) {
        assumir.disabled = false; assumir.textContent = 'Assumir esta peça';
        B7.UI.toast('Não foi possível assumir: ' + (e.message || ''), { tipo: 'erro' });
      }
    };

    /* envio da versão — arquivo ou revisão externa */
    el.querySelectorAll('[data-via]').forEach(b => b.onclick = () => {
      const novoValor = b.dataset.via === 'externa';
      if (novoValor === !!drawer.viaExterna) return;
      drawer.viaExterna = novoValor;
      const cx = el.querySelector('#dv-bloco-envio');
      if (cx) cx.innerHTML = drawer.viaExterna ? blocoEnvioExterno() : blocoEnvioUpload(d);
      el.querySelectorAll('[data-via]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      ligarBlocoEnvio(d);
    });
    ligarBlocoEnvio(d);

    /* roteiro vinculado (briefing de Reel), aberto no editor em que ele vive */
    el.querySelectorAll('[data-abrir-roteiro]').forEach(b => b.onclick = () => {
      fecharDrawer();
      location.hash = '#/gravacao/' + b.dataset.abrirRoteiro + '?roteiro=' + b.dataset.roteiroId;
    });

    /* revisão interna */
    const aprovar = el.querySelector('#dv-aprovar');
    if (aprovar && !aprovar.disabled) aprovar.onclick = async () => {
      aprovar.disabled = true; aprovar.textContent = 'Aprovando…';
      try {
        await B7.DB.aprovarInternoDesign(versaoAtual.id);
        const novo = await B7.DB.design(d.id); Object.assign(d, novo);
        drawer.extra = await B7.DB.historicoDesign(d.id);
        B7.UI.toast('Peça aprovada internamente');
        desenharDrawer(); desenharArea();
      } catch (e) {
        aprovar.disabled = false; aprovar.textContent = 'Aprovar internamente';
        B7.UI.toast('Não foi possível aprovar: ' + (e.message || ''), { tipo: 'erro' });
      }
    };
    const ajuste = el.querySelector('#dv-ajuste');
    if (ajuste) ajuste.onclick = async () => {
      const msg = await B7.UI.perguntar({ titulo: 'Solicitar ajuste', rotulo: 'Descreva o que precisa mudar — o designer vê esta mensagem.',
        placeholder: 'ex.: Trocar a headline, o contraste do texto está baixo…', confirmar: 'Solicitar ajuste' });
      if (msg === null) return;
      if (!msg.trim()) { B7.UI.toast('Descreva o ajuste solicitado.', { tipo: 'erro' }); return; }
      try {
        await B7.DB.solicitarAjusteDesign(versaoAtual.id, msg.trim());
        const novo = await B7.DB.design(d.id); Object.assign(d, novo);
        drawer.extra = await B7.DB.historicoDesign(d.id);
        B7.UI.toast('Ajuste solicitado');
        desenharDrawer(); desenharArea();
      } catch (e) { B7.UI.toast('Não foi possível solicitar ajuste: ' + (e.message || ''), { tipo: 'erro' }); }
    };

    /* finalizar / enviar ao cliente */
    const finalizar = el.querySelector('#dv-finalizar');
    if (finalizar) finalizar.onclick = async () => {
      const ok = await B7.UI.confirmar({ titulo: 'Finalizar esta peça?', texto: 'Ela sai da fila de produção. O material continua acessível pelo histórico.', confirmar: 'Finalizar' });
      if (!ok) return;
      try {
        await B7.DB.finalizarDesign(d.id);
        const novo = await B7.DB.design(d.id); Object.assign(d, novo);
        drawer.extra = await B7.DB.historicoDesign(d.id);
        B7.UI.toast('Peça finalizada');
        desenharDrawer(); desenharArea();
      } catch (e) { B7.UI.toast('Não foi possível finalizar: ' + (e.message || ''), { tipo: 'erro' }); }
    };
    const enviarCliente = el.querySelector('#dv-enviar-cliente');
    if (enviarCliente) enviarCliente.onclick = async () => {
      const msg = await B7.UI.perguntar({ titulo: 'Enviar para aprovação do cliente', rotulo: 'Observação opcional para o cliente.',
        placeholder: 'ex.: Segue a arte para aprovação…', confirmar: 'Enviar' });
      if (msg === null) return;
      try {
        await B7.DB.enviarClienteDesign(versaoAtual.id, msg.trim());
        const novo = await B7.DB.design(d.id); Object.assign(d, novo);
        drawer.extra = await B7.DB.historicoDesign(d.id);
        B7.UI.toast('Enviada para aprovação do cliente');
        desenharDrawer(); desenharArea();
      } catch (e) { B7.UI.toast('Não foi possível enviar ao cliente: ' + (e.message || ''), { tipo: 'erro' }); }
    };
  }

  return { abrir, abrirDetalhe, abrirLinha };
})();
