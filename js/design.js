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
  const vazio = t => !String(t || '').trim();
  const painel = () => document.getElementById('painel-dashboard');

  /* tipo da PEÇA de design (diferente do tipo do conteúdo de origem:
     Card/Reel/Carrossel/Story — este é o formato que o design entrega) */
  const TIPOS = [
    ['card', 'Card'], ['capa_reel', 'Capa de Reel'], ['carrossel', 'Carrossel'],
    ['stories', 'Stories'], ['outro', 'Outro']
  ];
  const rotuloTipo = t => (TIPOS.find(x => x[0] === t) || [, 'Peça'])[1];
  /* plural certo por tipo (não é só "singular + s": "Carrossel" vira
     "Carrosséis", "Capa de Reel" vira "Capas de Reel") — usado nos
     resumos de produção ("4 Cards", "2 Carrosséis…") */
  const PLURAL_TIPO = { card: 'Cards', capa_reel: 'Capas de Reel', carrossel: 'Carrosséis', stories: 'Stories', outro: 'Outros' };
  const rotuloTipoContagem = (t, n) => n + ' ' + (n === 1 ? rotuloTipo(t) : (PLURAL_TIPO[t] || rotuloTipo(t) + 's'));

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
                     prioridade: '', busca: '', vista: 'quadro', aba: null,
                     /* só o navegador do designer usa estes dois: modo de exibição
                        (linhas de produção vs. peças individuais) e o filtro rápido
                        do resumo do topo (disponíveis/comigo/ajustes/revisão) */
                     modo: 'linhas', rapido: '' };
  let F = Object.assign({}, F_PADRAO);
  try { Object.assign(F, JSON.parse(sessionStorage.getItem('b7.design.filtros') || '{}')); } catch (e) {}
  function guardarFiltros() { try { sessionStorage.setItem('b7.design.filtros', JSON.stringify(F)); } catch (e) {} }

  /* =================================================================
     TELA PRINCIPAL
     ================================================================= */
  /* Rota "#/design". Para a equipe é a fila inteira (quadro/lista/
     equipe). Para o Designer é o NAVEGADOR da própria fila — busca,
     filtros e todas as peças por Linha Editorial. A home dele (rota
     "#/") é outra tela, abrirCentral(): o que precisa de ação agora. */
  async function carregarDados() {
    /* designers sempre carregado (não só p/ equipe): o Designer precisa
       da lista pra "compartilhar" uma peça disponível com um colega de
       uma linha que ele já está produzindo — mesma consulta que a
       equipe já usava, nenhuma nova */
    const chamadas = [B7.DB.listarDesign(), B7.DB.listarDesigners().catch(() => [])];
    if (ehEquipe()) chamadas.push(B7.DB.listarClientes().catch(() => []));
    const [linhas, dsg, cli] = await Promise.all(chamadas);
    dados = linhas || [];
    designers = dsg || [];
    clientes = cli || [];
  }
  function erroCarga(e) {
    painel().innerHTML = '<div class="conteudo entra"><div class="estado-b7"><b>Não foi possível carregar o Design.</b>' +
      '<p>' + esc(e.message || '') + '</p>' +
      '<p>Se o sistema acabou de ser atualizado, rode migration_design.sql no Supabase.</p></div></div>';
  }

  async function abrir(aba) {
    selecionados.clear();
    B7.Dashboard.marcarNav('#/design');
    B7.Rota.titulo(['Design']);
    if (aba) F.aba = aba;
    if (!F.aba) F.aba = ehDesigner() ? 'fila' : 'todas';

    painel().innerHTML = '<div class="conteudo design-tela"><div class="cab-conteudo"><div><h1>Produção de Design</h1>' +
      '<p>' + (ehDesigner() ? 'Acompanhe as linhas editoriais e peças em produção.' : 'A fila de produção visual da equipe.') + '</p></div></div>' +
      B7.UI.skeleton('cards', { n: 6, titulo: false }) + '</div>';

    try { await carregarDados(); } catch (e) { erroCarga(e); return; }
    desenhar();
    assinar();
  }

  function desenhar() {
    const equipe = ehEquipe();
    painel().innerHTML = '<div class="conteudo entra design-tela">' +
      '<div class="cab-conteudo"><div><h1>Produção de Design</h1>' +
      '<p>' + (ehDesigner() ? 'Acompanhe as linhas editoriais e peças em produção.'
                            : 'A fila de produção visual da equipe.') + '</p></div>' +
      (equipe ? '<button class="b pri" id="ds-nova">+ Nova demanda de Design</button>' : '') + '</div>' +
      (equipe ? '<nav class="ds-abas" role="tablist">' + ABAS_EQUIPE.map(([k, r]) =>
        '<button role="tab" data-aba="' + k + '" class="' + (F.aba === k ? 'on' : '') + '" aria-selected="' + (F.aba === k) + '">' +
        esc(r) + '</button>').join('') + '</nav>' : '') +
      '<div id="ds-resumo"></div>' +
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
    return !!(F.cliente || F.designer || F.tipo || F.status || F.prazo || F.linha || F.prioridade || F.busca.trim() || (ehEquipe() && F.rapido));
  }

  function desenharBarra() {
    const cx = painel().querySelector('#ds-barra');
    if (!cx) return;
    const equipe = ehEquipe();
    const opc = (chave, atual, itens, rotulo) =>
      '<select class="campo fina ds-filtro' + (atual ? ' ativo' : '') + '" data-filtro="' + chave + '" aria-label="' + esc(rotulo) + '">' +
      itens.map(([v, r]) => '<option value="' + esc(v) + '"' + (atual === v ? ' selected' : '') + '>' + esc(r) + '</option>').join('') +
      '</select>';

    /* linhas/clientes presentes nos dados atuais — não existe um
       cadastro "todos os clientes com peça de Design" independente */
    const linhasPresentes = [...new Map(dados.filter(d => d.linha_id)
      .map(d => [d.linha_id, d.linha_nome])).entries()];
    const clientesPresentes = [...new Map(dados.filter(d => d.client_id)
      .map(d => [d.client_id, d.cliente_nome])).entries()].sort((a, b) => (a[1] || '').localeCompare(b[1] || ''));

    cx.innerHTML = '<div class="ds-barra">' +
      '<div class="ds-busca-cx"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>' +
        '<input class="campo fina ds-busca" id="ds-busca" placeholder="Buscar cliente, linha editorial ou peça…" ' +
        'value="' + esc(F.busca) + '" aria-label="Buscar"></div>' +
      (equipe ? opc('cliente', F.cliente, [['', 'Cliente']].concat(clientes.map(c => [c.id, c.nome])), 'Cliente')
        : (clientesPresentes.length > 1 ? opc('cliente', F.cliente, [['', 'Cliente']].concat(clientesPresentes), 'Cliente') : '')) +
      (equipe ? opc('designer', F.designer, [['', 'Designer'], ['sem', 'Sem responsável']]
        .concat(designers.map(p => [p.id, p.nome])), 'Designer') : '') +
      opc('tipo', F.tipo, [['', 'Tipo']].concat(TIPOS), 'Tipo') +
      opc('status', F.status, [['', 'Status']].concat(STATUS), 'Status') +
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
      '</div>' : '<div class="seg-vista" role="tablist">' +
        '<button role="tab" class="' + (F.modo === 'linhas' ? 'on' : '') + '" data-modo="linhas">Linhas editoriais</button>' +
        '<button role="tab" class="' + (F.modo === 'pecas' ? 'on' : '') + '" data-modo="pecas">Peças</button>' +
      '</div>') +
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
    cx.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => {
      F.modo = b.dataset.modo; guardarFiltros();
      cx.querySelectorAll('[data-modo]').forEach(x => x.classList.toggle('on', x === b));
      desenharArea();
    });
    const limpar = cx.querySelector('#ds-limpar');
    if (limpar) limpar.onclick = () => {
      F.cliente = F.designer = F.tipo = F.status = F.prazo = F.linha = F.prioridade = F.busca = F.rapido = '';
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
      b.onclick = () => { F.cliente = F.designer = F.tipo = F.status = F.prazo = F.linha = F.prioridade = F.busca = F.rapido = '';
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
      /* atalhos do "Precisa de você" (equipe) */
      if (F.rapido && ehEquipe()) {
        if (F.rapido === 'revisao' && d.status !== 'revisao_interna') return false;
        if (F.rapido === 'cliente' && d.status !== 'aguardando_cliente') return false;
        if (F.rapido === 'aprovado' && d.status !== 'aprovado_interno') return false;
        if (F.rapido === 'semdono' && !(d.status === 'aguardando_producao' && !d.designer_id)) return false;
        if (F.rapido === 'atrasadas') {
          const p = d.prazo ? new Date(d.prazo + 'T00:00:00') : null;
          if (!(p && p < hoje && d.status !== 'finalizado')) return false;
        }
      }
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
      /* Navegador do designer ("Produção de Design"): a fila inteira,
         com dois modos — "Linhas editoriais" (projetos, o padrão) e
         "Peças" (cada peça individual, para buscar uma específica).
         O detalhe completo de uma linha mora na página de demanda. */
      const vis = filtrar(dados);
      const { minhas, semDono } = filaDoDesigner(vis);
      desenharResumoDesigner(minhas, semDono);
      const total = painel().querySelector('#ds-total');
      if (total) total.textContent = (minhas.length + semDono.length) + ' peça' + (minhas.length + semDono.length === 1 ? '' : 's');
      area.innerHTML = F.modo === 'pecas' ? viewPecasDesigner(minhas, semDono) : viewProjetosDesigner(minhas, semDono);
      ligarCentral(area);
      ligarThumbs(area);
      return;
    }

    desenharResumoEquipe();
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

  /* "Precisa de mim": só o que exige AÇÃO minha agora — nunca o que já
     mandei e está esperando revisão/aprovação de outra pessoa. */
  function precisaDeMim(minhas) {
    return minhas.filter(d => d.status === 'aguardando_producao' || d.status === 'ajustes' ||
      d.status === 'ajustes_cliente' || d.briefing_desatualizado);
  }
  /* "Continuar de onde parei": só o que está mesmo em produção comigo
     agora, mais recente primeiro — some sozinho quando não há nada. */
  function continuarDeOndeParei(minhas) {
    return minhas.filter(d => d.status === 'em_criacao')
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')).slice(0, 3);
  }

  /* Navegador (#/design) do Designer: a fila inteira — "Precisa de
     mim"/"Continuar de onde parei" moram na Central (#/), para as
     duas telas não serem a mesma coisa com nome diferente. Aqui é o
     NAVEGADOR de produção: "Linhas editoriais" (projetos — o padrão)
     ou "Peças" (cada peça, pra buscar uma específica). */
  const RAPIDO_STATUS = {
    ajustes: ['ajustes', 'ajustes_cliente'],
    revisao: ['revisao_interna', 'aprovado_interno', 'aguardando_cliente', 'aprovado_cliente']
  };

  /* resumo compacto do topo — "13 disponíveis · 4 comigo · 2 ajustes
     · 3 em revisão" — cada item é também um filtro rápido. Zero só
     aparece nos dois primeiros (moldam a leitura da página inteira);
     ajustes/revisão zerados não ocupam espaço à toa. */
  function desenharResumoDesigner(minhas, semDono) {
    const cx = painel().querySelector('#ds-resumo');
    if (!cx) return;
    const ajustes = minhas.filter(d => RAPIDO_STATUS.ajustes.includes(d.status)).length;
    const revisao = minhas.filter(d => RAPIDO_STATUS.revisao.includes(d.status)).length;
    const itens = [
      ['disponivel', semDono.length, semDono.length === 1 ? 'disponível' : 'disponíveis'],
      ['comigo', minhas.length, 'comigo']
    ];
    if (ajustes) itens.push(['ajustes', ajustes, ajustes === 1 ? 'em ajuste' : 'em ajustes']);
    if (revisao) itens.push(['revisao', revisao, 'em revisão']);
    if (F.rapido && !itens.some(i => i[0] === F.rapido)) F.rapido = '';
    cx.innerHTML = itens.length ? '<div class="ds-resumo-rapido" role="tablist">' + itens.map(([k, n, r]) =>
      '<button class="ds-rapido-item' + (F.rapido === k ? ' on' : '') + '" data-rapido="' + k + '" role="tab" aria-selected="' + (F.rapido === k) + '">' +
        '<b>' + n + '</b> ' + esc(r) + '</button>').join('') + '</div>' : '';
    cx.querySelectorAll('[data-rapido]').forEach(b => b.onclick = () => {
      F.rapido = F.rapido === b.dataset.rapido ? '' : b.dataset.rapido;
      guardarFiltros(); desenharArea();
    });
  }

  function textoVazioMinhas() {
    return (F.rapido === 'ajustes' || F.rapido === 'revisao')
      ? 'Nenhuma linha com peças nesse estado agora.'
      : 'Você ainda não tem demandas atribuídas.';
  }

  function viewProjetosDesigner(minhas, semDono) {
    let minhasF = minhas;
    if (RAPIDO_STATUS[F.rapido]) minhasF = minhas.filter(d => RAPIDO_STATUS[F.rapido].includes(d.status));
    const mostraDisp = F.rapido !== 'comigo' && !RAPIDO_STATUS[F.rapido];
    const mostraMinhas = F.rapido !== 'disponivel';

    const secDisponiveis = () => {
      const grupos = agruparPorLinha(semDono);
      return '<section class="ds-central-sec"><h3>Demandas disponíveis <span>' + semDono.length + '</span></h3>' +
        (grupos.length ? '<div class="cp-grade">' + grupos.map(g => cartaoProjeto(g, 'disponivel')).join('') + '</div>'
          : '<p class="ds-vazio-linha">Nenhuma demanda disponível no momento.</p>') + '</section>';
    };
    const secMinhas = () => {
      const grupos = agruparPorLinha(minhasF).map(g => Object.assign(g, resumoLinha(g.itens)))
        .sort((a, b) => (a.concluida - b.concluida) || (b.ajustes - a.ajustes) || (a.linhaNome || '').localeCompare(b.linhaNome || ''));
      return '<section class="ds-central-sec"><h3>Minhas demandas <span>' + minhasF.length + '</span></h3>' +
        (grupos.length ? '<div class="cp-grade">' + grupos.map(g => cartaoProjeto(g, 'minha')).join('') + '</div>'
          : '<p class="ds-vazio-linha">' + esc(textoVazioMinhas()) + (minhas.length ? '' : ' Assuma uma das linhas disponíveis.') + '</p>') + '</section>';
    };

    if (!mostraDisp) return '<div class="ds-central">' + secMinhas() + '</div>';
    if (!mostraMinhas) return '<div class="ds-central">' + secDisponiveis() + '</div>';
    /* sem filtro rápido ativo: se ainda não há nada assumido, a fila
       disponível vem primeiro — é o que o designer precisa ver agora */
    return '<div class="ds-central">' + (minhas.length === 0 ? secDisponiveis() + secMinhas() : secMinhas() + secDisponiveis()) + '</div>';
  }

  /* modo "Peças": a mesma peça (design_resumo) sem agrupar por linha
     — pra buscar/filtrar um item específico visualmente, não numa
     tabela. Reaproveita o cartão de peça já usado no quadro/lista. */
  function viewPecasDesigner(minhas, semDono) {
    let lista;
    if (F.rapido === 'disponivel') lista = semDono;
    else if (F.rapido === 'comigo') lista = minhas;
    else if (RAPIDO_STATUS[F.rapido]) lista = minhas.filter(d => RAPIDO_STATUS[F.rapido].includes(d.status));
    else lista = minhas.concat(semDono);
    lista = lista.slice().sort(ordenarPorUrgencia);
    if (!lista.length) return '<div class="estado-b7"><b>Nenhuma peça corresponde aos filtros.</b></div>';
    return '<div class="ds-lista ds-lista-grade">' + lista.map(cartao).join('') + '</div>';
  }

  /* iniciais como placeholder — nunca o avatar do usuário como se
     fosse a marca do cliente; logo real só quando o cliente já tem
     um (cliente_logo_url, exposto por design_resumo) */
  function avatarCliente(nome, logoUrl) {
    if (logoUrl) return '<img class="cp-logo" src="' + esc(logoUrl) + '" alt="" loading="lazy">';
    const iniciais = (nome || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '·';
    return '<span class="cp-logo cp-logo-ini">' + esc(iniciais) + '</span>';
  }

  /* até 3 prévias reais da linha — nunca a arte em resolução total
     (ligarThumbs resolve a URL assinada sob demanda, como no cartão
     de peça) e nunca um espaço vazio reservado quando não há prévia */
  function tirasPrevia(itens) {
    const comPrevia = itens.map(d => ({ d, fonte: fontePrevia(d) })).filter(x => x.fonte).slice(0, 3);
    if (!comPrevia.length) return '';
    return '<div class="cp-previas">' + comPrevia.map(({ fonte }) =>
      '<div class="ds-thumb cp-previa" data-previa="' + esc(fonte) + '"><span class="ds-thumb-esq"></span></div>').join('') + '</div>';
  }

  function formatosIcone(itens) {
    const porTipo = new Map();
    itens.forEach(d => porTipo.set(d.tipo, (porTipo.get(d.tipo) || 0) + 1));
    const formatos = [...porTipo.entries()].sort((a, b) => b[1] - a[1]);
    return '<div class="cp-formatos">' + formatos.map(([t, n]) =>
      '<span class="cp-formato">' + iconeTipo(t) + esc(rotuloTipoContagem(t, n)) + '</span>').join('') + '</div>';
  }

  /* CARTÃO DE PROJETO — a unidade visual do navegador em "Linhas
     editoriais": identidade do cliente em primeiro lugar (não o mês),
     linha + versão como metadado, prévias reais, formatos com ícone,
     progresso real (Design, não o status editorial) e uma ação
     primária por estado — nunca mais de duas. */
  function cartaoProjeto(g, modo) {
    const r = Object.assign({ linhaId: g.linhaId, linhaNome: g.linhaNome, clienteNome: g.clienteNome, itens: g.itens }, resumoLinha(g.itens));
    const disponivel = modo === 'disponivel';
    const partes = [];
    if (r.fazer) partes.push(r.fazer + ' para fazer');
    if (r.criacao) partes.push(r.criacao + ' em criação');
    if (r.ajustes) partes.push('<b class="alerta">' + r.ajustes + ' em ajuste' + (r.ajustes === 1 ? '' : 's') + '</b>');
    if (r.revisao) partes.push(r.revisao + ' em revisão');
    const briefing = r.itens.some(d => d.briefing_desatualizado);
    const logoUrl = (r.itens[0] && r.itens[0].cliente_logo_url) || null;

    return '<article class="cartao-projeto' + (r.concluida ? ' concluido' : '') + '"' +
      (r.linhaId ? ' data-linha-abrir="' + esc(r.linhaId) + '" tabindex="0" role="button" aria-label="Ver peças de ' + esc(r.linhaNome) + '"' : '') + '>' +
      '<div class="cp-cab">' + avatarCliente(r.clienteNome, logoUrl) +
        '<div class="cp-cab-tx"><b class="cp-cliente">' + esc(r.clienteNome || 'Interno') + '</b>' +
        '<span class="cp-linha">Linha Editorial · ' + esc(r.linhaNome) + (r.versao ? ' · V' + String(r.versao).padStart(2, '0') : '') + '</span></div>' +
      '</div>' +
      tirasPrevia(r.itens) +
      formatosIcone(r.itens) +
      (disponivel
        ? '<div class="cp-status">' + r.total + (r.total === 1 ? ' peça disponível' : ' peças disponíveis') + ' para produção</div>'
        : '<div class="cp-progresso">' +
            '<div class="ds-grupo-progresso"><span style="width:' + r.pct + '%"></span></div>' +
            '<span class="cp-pct">' + (r.concluida ? 'Concluída — ' : '') + r.finalizadas + ' de ' + r.total + ' finalizada' + (r.total === 1 ? '' : 's') + '</span>' +
          '</div>' +
          (partes.length ? '<div class="cp-estados">' + partes.join(' · ') + '</div>' : '')) +
      (briefing ? '<div class="cp-aviso">Briefing atualizado</div>' : '') +
      (r.prazo ? '<div class="cp-prazo' + (r.prazo.atrasada ? ' atrasada' : r.prazo.hoje ? ' hoje' : '') + '">' +
        (r.prazo.atrasada || r.prazo.hoje ? '' : 'Prazo: ') + esc(r.prazo.txt) + '</div>' : '') +
      '<div class="cp-acoes">' +
        (r.linhaId ? '<button class="b fina contorno" data-linha-abrir="' + esc(r.linhaId) + '">Ver peças</button>' : '') +
        (disponivel
          ? (r.linhaId ? '<button class="b pri fina" data-assumir-linha="' + esc(r.linhaId) + '">Assumir demanda' + (r.total > 1 ? ' (' + r.total + ')' : '') + '</button>' : '')
          : (r.linhaId ? '<button class="b pri fina" data-linha-abrir="' + esc(r.linhaId) + '">' + (r.concluida ? 'Ver produção' : 'Continuar produção') + '</button>' : '')) +
      '</div>' +
    '</article>';
  }

  function nearestPrazo(itens) {
    const comPrazo = itens.filter(d => d.prazo && d.status !== 'finalizado');
    if (!comPrazo.length) return null;
    comPrazo.sort((a, b) => new Date(a.prazo) - new Date(b.prazo));
    return prazoInfo(comPrazo[0]);
  }

  /* redesenha o que estiver montado — o navegador (#ds-area), a
     Central (#dsc-raiz) ou a página de demanda (#ds-linha-raiz) — a
     partir dos dados já em memória, sem nova consulta */
  function redesenharTela() {
    if (painel().querySelector('#dsc-raiz')) desenharCentral();
    else if (painel().querySelector('#ds-linha-raiz') && linhaAberta) desenharLinha();
    else if (painel().querySelector('#ds-area')) desenharArea();
  }

  /* =================================================================
     CENTRAL DE DESIGN — home do Designer (rota "#/").
     Não é a fila: é "o que precisa de mim agora, onde eu parei e como
     estão as minhas linhas". Tudo derivado de design_resumo, a mesma
     consulta única do navegador — nenhum número aqui é inventado: a
     porcentagem de uma linha é finalizadas ÷ total, o prazo é o prazo
     real da peça mais próxima, e seção sem conteúdo não aparece.
     ================================================================= */
  async function abrirCentral() {
    selecionados.clear();
    B7.Dashboard.marcarNav('#/');
    B7.Rota.titulo([]);
    painel().innerHTML = '<div class="conteudo design-tela dsc-tela">' +
      '<header class="dsc-cab"><h1>' + esc(saudacao()) + '</h1><p>Carregando o que precisa da sua atenção…</p></header>' +
      B7.UI.skeleton('tabela', { n: 4, cols: 3 }) + '</div>';
    try { await carregarDados(); } catch (e) { erroCarga(e); return; }
    desenharCentral();
    assinar();
  }

  function saudacao() {
    const u = B7.Auth.usuario() || {};
    const primeiro = ((u.nome || u.username || '').trim().split(/\s+/)[0]) || '';
    const h = new Date().getHours();
    const s = h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    return s + (primeiro ? ', ' + primeiro : '') + '.';
  }

  /* por que esta peça precisa de mim — o rótulo que o Designer lê
     antes do título, para saber o tipo de ação sem abrir a peça */
  function motivoPrecisa(d) {
    if (d.status === 'ajustes_cliente') return { k: 'cliente', t: 'Ajuste do cliente' };
    if (d.status === 'ajustes') return { k: 'ajuste', t: 'Ajuste solicitado' };
    if (d.briefing_desatualizado) return { k: 'briefing', t: 'Briefing atualizado' };
    return { k: 'comecar', t: 'Para começar' };
  }

  function desenharCentral() {
    const { minhas, semDono } = filaDoDesigner(dados);
    const precisa = precisaDeMim(minhas).sort(ordenarPorUrgencia);
    /* uma peça aparece uma vez só: se já está em "Precisa de mim"
       (ex.: em criação com briefing atualizado), não repete abaixo */
    const idsPrecisa = new Set(precisa.map(d => d.id));
    const continuar = continuarDeOndeParei(minhas.filter(d => !idsPrecisa.has(d.id)));
    const emCriacao = minhas.filter(d => d.status === 'em_criacao').length;
    const esperando = minhas.filter(d => ['revisao_interna', 'aprovado_interno', 'aguardando_cliente', 'aprovado_cliente'].includes(d.status)).length;
    const linhas = agruparPorLinha(minhas)
      .map(g => Object.assign(g, resumoLinha(g.itens)))
      .sort((a, b) => (a.concluida - b.concluida) || (b.ajustes - a.ajustes) || (a.linhaNome || '').localeCompare(b.linhaNome || ''));
    const disponiveis = agruparPorLinha(semDono);
    const nada = !minhas.length && !semDono.length;

    const sub = nada ? 'Sua fila está vazia. Quando uma demanda de Design for criada, ela aparece aqui.'
      : precisa.length ? (precisa.length === 1 ? 'Uma peça precisa da sua atenção.' : precisa.length + ' peças precisam da sua atenção.')
      : continuar.length ? 'Nada pendente de ajuste. Continue de onde parou.'
      : semDono.length ? 'Nada pendente com você. Há demandas disponíveis para assumir.'
      : 'Tudo em dia.';

    const num = (n, r, k, on) => '<button class="dsc-num' + (on && n ? ' on' : '') + '" data-dsc-ir="' + k + '"' + (n ? '' : ' disabled') + '>' +
      '<b>' + n + '</b><span>' + r + '</span></button>';

    painel().innerHTML = '<div class="conteudo entra design-tela dsc-tela" id="dsc-raiz">' +
      '<header class="dsc-cab"><div><h1>' + esc(saudacao()) + '</h1><p>' + esc(sub) + '</p></div>' +
        '<a class="b fina contorno" href="#/design">Ver toda a fila</a></header>' +

      (nada ? '' : '<div class="dsc-nums">' +
        num(precisa.length, precisa.length === 1 ? 'precisa de mim' : 'precisam de mim', 'precisa', true) +
        num(emCriacao, 'em criação', 'continuar') +
        num(esperando, 'esperando revisão', 'linhas') +
        num(semDono.length, semDono.length === 1 ? 'disponível para assumir' : 'disponíveis para assumir', 'disponiveis') +
      '</div>') +

      (precisa.length ? '<section class="dsc-sec dsc-precisa" id="dsc-precisa"><h2>Precisa de mim <span>' + precisa.length + '</span></h2>' +
        '<div class="dsc-fila">' + precisa.map(linhaPrecisa).join('') + '</div></section>' : '') +

      (continuar.length ? '<section class="dsc-sec" id="dsc-continuar"><h2>Continuar de onde parei</h2>' +
        '<div class="ds-lista ds-lista-grade">' + continuar.map(cartao).join('') + '</div></section>' : '') +

      (linhas.length ? '<section class="dsc-sec" id="dsc-linhas"><h2>Minhas linhas em produção <span>' + linhas.length + '</span></h2>' +
        '<div class="dsc-linhas">' + linhas.map(pacoteLinha).join('') + '</div></section>' : '') +

      (disponiveis.length ? '<section class="dsc-sec" id="dsc-disponiveis"><h2>Demandas disponíveis <span>' + semDono.length + '</span></h2>' +
        '<p class="dsc-sub">Sem responsável ainda — qualquer designer pode assumir.</p>' +
        '<div class="dsc-disp">' + disponiveis.map(linhaDisponivel).join('') + '</div></section>' : '') +

      (nada ? '<div class="estado-b7"><b>Nenhuma peça de Design na sua fila.</b>' +
        '<p>As demandas nascem na Linha Editorial de cada cliente ("Enviar para Design") ou são criadas pela coordenação.</p></div>' : '') +
    '</div>';

    ligarCentral(painel().querySelector('#dsc-raiz'));
    ligarThumbs(painel());
  }

  /* números reais de uma linha — nunca porcentagem sem base */
  function resumoLinha(itens) {
    const total = itens.length;
    const finalizadas = itens.filter(d => d.status === 'finalizado').length;
    const ajustes = itens.filter(d => d.status === 'ajustes' || d.status === 'ajustes_cliente').length;
    const criacao = itens.filter(d => d.status === 'em_criacao').length;
    const revisao = itens.filter(d => ['revisao_interna', 'aprovado_interno', 'aguardando_cliente', 'aprovado_cliente'].includes(d.status)).length;
    const fazer = itens.filter(d => d.status === 'aguardando_producao').length;
    return { total, finalizadas, ajustes, criacao, revisao, fazer,
      pct: total ? Math.round((finalizadas / total) * 100) : 0, concluida: total > 0 && finalizadas === total ? 1 : 0,
      prazo: nearestPrazo(itens), versao: (itens.find(d => d.linha_versao_confirmada) || {}).linha_versao_confirmada || null };
  }

  function linhaPrecisa(d) {
    const m = motivoPrecisa(d);
    const info = prazoInfo(d);
    return '<article class="dsc-item" data-peca="' + esc(d.id) + '" tabindex="0" role="button">' +
      (fontePrevia(d) ? '<div class="ds-thumb" data-previa="' + esc(fontePrevia(d)) + '"><span class="ds-thumb-esq"></span></div>'
        : '<div class="ds-thumb ds-thumb-vazia">' + iconeTipo(d.tipo) + '</div>') +
      '<div class="dsc-item-tx">' +
        '<span class="dsc-motivo ' + m.k + '">' + esc(m.t) + '</span>' +
        '<h4>' + esc(d.titulo || d.conteudo_titulo || 'Sem título') + '</h4>' +
        '<span class="dsc-meta">' + esc(rotuloTipo(d.tipo)) +
          (d.cliente_nome ? ' · ' + esc(d.cliente_nome) : '') + (d.linha_nome ? ' · ' + esc(d.linha_nome) : '') +
          (d.ultima_versao ? ' · V' + String(d.ultima_versao).padStart(2, '0') : '') + '</span>' +
      '</div>' +
      (info ? '<span class="ds-prazo' + (info.atrasada ? ' atrasada' : info.hoje ? ' hoje' : '') + '">' + esc(info.txt) + '</span>' : '<span class="ds-prazo"></span>') +
      '<svg class="dsc-seta" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>' +
    '</article>';
  }

  function pacoteLinha(g) {
    const partes = [];
    if (g.fazer) partes.push(g.fazer + ' para fazer');
    if (g.criacao) partes.push(g.criacao + ' em criação');
    if (g.ajustes) partes.push('<b class="alerta">' + g.ajustes + ' em ajuste</b>');
    if (g.revisao) partes.push(g.revisao + ' em revisão');
    return '<article class="dsc-linha' + (g.concluida ? ' concluida' : '') + '"' + (g.linhaId ? ' data-linha-abrir="' + esc(g.linhaId) + '" tabindex="0" role="button"' : '') + '>' +
      '<div class="dsc-linha-cab">' +
        '<div><span class="dsc-cli">' + esc(g.clienteNome || 'Interno') + '</span>' +
          '<h3>' + esc(g.linhaNome) + (g.versao ? '<span class="ds-v-badge">V' + String(g.versao).padStart(2, '0') + '</span>' : '') + '</h3></div>' +
        '<b class="dsc-pct">' + g.pct + '%</b>' +
      '</div>' +
      '<div class="ds-grupo-progresso"><span style="width:' + g.pct + '%"></span></div>' +
      '<div class="dsc-linha-st">' + (g.concluida ? 'Concluída — ' : '') + g.finalizadas + ' de ' + g.total + ' finalizada' + (g.total === 1 ? '' : 's') +
        (partes.length ? ' · ' + partes.join(' · ') : '') + '</div>' +
      chipsFormatos(g.itens) +
      '<div class="dsc-linha-pe">' +
        (g.prazo ? '<span class="ds-prazo' + (g.prazo.atrasada ? ' atrasada' : g.prazo.hoje ? ' hoje' : '') + '">' +
          (g.prazo.atrasada || g.prazo.hoje ? '' : 'Próximo prazo: ') + esc(g.prazo.txt) + '</span>' : '<span></span>') +
        (g.linhaId ? '<span class="dsc-abrir">Abrir produção →</span>' : '') +
      '</div>' +
    '</article>';
  }

  function linhaDisponivel(g) {
    const info = nearestPrazo(g.itens);
    return '<article class="dsc-disp-row"' + (g.linhaId ? ' data-linha-abrir="' + esc(g.linhaId) + '" tabindex="0" role="button"' : '') + '>' +
      '<div class="dsc-disp-tx">' +
        '<b>' + esc(g.linhaNome) + '</b>' +
        '<span class="dsc-meta">' + (g.clienteNome ? esc(g.clienteNome) + ' · ' : '') + g.itens.length + (g.itens.length === 1 ? ' peça' : ' peças') +
          (info ? ' · <i class="' + (info.atrasada ? 'atrasada' : info.hoje ? 'hoje' : '') + '">' + esc(info.txt) + '</i>' : '') + '</span>' +
      '</div>' +
      chipsFormatos(g.itens) +
      (g.linhaId ? '<button class="b fina pri" data-assumir-linha="' + esc(g.linhaId) + '">Assumir' + (g.itens.length > 1 ? ' (' + g.itens.length + ')' : '') + '</button>' : '') +
    '</article>';
  }

  function ligarCentral(raiz) {
    if (!raiz) return;
    raiz.querySelectorAll('[data-dsc-ir]').forEach(b => b.onclick = () => {
      const alvo = { precisa: '#dsc-precisa', continuar: '#dsc-continuar', linhas: '#dsc-linhas', disponiveis: '#dsc-disponiveis' }[b.dataset.dscIr];
      const el = alvo && raiz.querySelector(alvo);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else location.hash = '#/design';
    });
    raiz.querySelectorAll('[data-peca]').forEach(el => {
      el.onclick = () => abrirDetalhe(el.dataset.peca);
      el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDetalhe(el.dataset.peca); } };
    });
    raiz.querySelectorAll('[data-linha-abrir]').forEach(el => {
      const ir = e => { if (e.target.closest('[data-assumir-linha]')) return; location.hash = '#/design/linha/' + el.dataset.linhaAbrir; };
      el.onclick = ir;
      el.onkeydown = e => { if (e.key === 'Enter') ir(e); };
    });
    raiz.querySelectorAll('[data-assumir-linha]').forEach(b => b.onclick = async e => {
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
        redesenharTela();
      } catch (e2) {
        b.disabled = false; b.textContent = 'Assumir';
        B7.UI.toast('Não foi possível assumir: ' + (e2.message || ''), { tipo: 'erro' });
      }
    });
  }

  /* =================================================================
     PÁGINA DE DEMANDA — a produção de Design de UMA Linha Editorial,
     como projeto de verdade: cliente, versão confirmada, progresso
     real e abas por estado. O Designer não precisa abrir o editor
     completo da Linha Editorial só para ver o que está em jogo ali.
     ================================================================= */
  const ABAS_LINHA = [
    ['todas', 'Todas'], ['fazer', 'Para fazer'], ['criacao', 'Em criação'],
    ['ajustes', 'Ajustes'], ['revisao', 'Revisão'], ['finalizadas', 'Finalizadas']
  ];
  const STATUS_DA_ABA_LINHA = {
    fazer: ['aguardando_producao'], criacao: ['em_criacao'],
    ajustes: ['ajustes', 'ajustes_cliente'],
    revisao: ['revisao_interna', 'aprovado_interno', 'aguardando_cliente', 'aprovado_cliente'],
    finalizadas: ['finalizado']
  };
  let linhaAberta = null;   /* id da linha aberta na página de demanda, ou null */
  let itensLinha = [];      /* peças dessa linha — cache local para as abas não refazerem consulta */
  let abaLinha = 'todas';

  /* Rodada 5b: as outras 3 abas da página de demanda (Contexto/Pilares/
     Referências) — SÓ leitura, sempre, pros dois papéis que abrem essa
     tela. Antes disso, o botão "Ver contexto da Linha Editorial" levava
     pra fora do Design inteiro (`#/linha/:id`, o editor completo de
     verdade, com os 5 abas do Coordenador e todos os campos abertos —
     só desabilitados pra quem é designer). Isso obrigava o Designer a
     sair da tela de peças pra ver de que trata a linha, e reaproveitava
     `js/linha.js` (pensado pra edição do Coordenador) só pra mostrar
     3 informações de leitura. Agora as 4 "abas" (Peças de Design /
     Contexto / Pilares / Referências) vivem na MESMA tela, sem sair do
     Design nem tocar em `js/linha.js` — um componente próprio,
     começando por esta página (abre caminho pra um dia fazer o mesmo
     com a fila de Criativos/Postagens, se um Videomaker precisar). */
  const ABAS_LINHA_TOPO = [
    ['pecas', 'Peças de Design'], ['contexto', 'Contexto'],
    ['pilares', 'Pilares'], ['referencias', 'Referências']
  ];
  let abaLinhaTopo = 'pecas';
  let contextoLinha = null;  /* { linha, pilares } | { erro: true } | null (ainda não pedido) */

  async function abrirLinha(linhaId) {
    linhaAberta = linhaId; abaLinha = 'todas';
    abaLinhaTopo = 'pecas'; contextoLinha = null;
    B7.Dashboard.marcarNav('#/design');
    B7.Rota.titulo(['Design', 'Linha']);
    painel().innerHTML = '<div class="conteudo design-tela">' + B7.UI.skeleton('tabela', { n: 5, cols: 3 }) + '</div>';
    try { itensLinha = await B7.DB.listarDesign({ linhaId }); }
    catch (e) {
      painel().innerHTML = '<div class="conteudo entra"><div class="estado-b7"><b>Não foi possível carregar esta linha.</b><p>' + esc(e.message || '') + '</p></div></div>';
      linhaAberta = null;
      return;
    }
    desenharLinha();
    assinar();
  }

  function desenharLinha() {
    const itens = itensLinha;
    const nome = (itens[0] && itens[0].linha_nome) || 'Linha editorial';
    const cliente = itens[0] && itens[0].cliente_nome;
    const versao = itens[0] && itens[0].linha_versao_confirmada;
    const total = itens.length;
    const finalizadas = itens.filter(d => d.status === 'finalizado').length;
    const pct = total ? Math.round((finalizadas / total) * 100) : 0;
    const semDono = itens.filter(d => !d.designer_id);

    painel().innerHTML = '<div class="conteudo entra design-tela" id="ds-linha-raiz">' +
      '<button class="b fina contorno" id="ds-voltar" style="margin-bottom:12px">← Voltar ao Design</button>' +
      '<div class="dl-cab">' +
        '<div class="dl-cab-tx">' +
          (cliente ? '<span class="dsc-cli">' + esc(cliente) + '</span>' : '') +
          '<h1>' + esc(nome) + (versao ? '<span class="ds-v-badge">V' + String(versao).padStart(2, '0') + '</span>' : '') + '</h1>' +
        '</div>' +
        '<div class="dl-cab-pct"><b>' + pct + '%</b><span>' + finalizadas + ' de ' + total + ' finalizada' + (total === 1 ? '' : 's') + '</span></div>' +
      '</div>' +
      '<div class="ds-grupo-progresso dl-progresso"><span style="width:' + pct + '%"></span></div>' +
      (ehDesigner() && semDono.length ? '<button class="b pri dl-assumir" id="ds-assumir-tudo">Assumir demanda (' + semDono.length + ')</button>' : '') +
      ('<nav class="ds-abas dl-abas-topo" role="tablist">' + ABAS_LINHA_TOPO.map(([k, r]) =>
        '<button role="tab" data-aba-linha-topo="' + k + '" class="' + (abaLinhaTopo === k ? 'on' : '') + '" aria-selected="' + (abaLinhaTopo === k) + '">' +
          esc(r) + '</button>').join('') + '</nav>') +
      (abaLinhaTopo === 'pecas' ? corpoPecas(itens, total)
        : abaLinhaTopo === 'contexto' ? corpoContexto()
        : abaLinhaTopo === 'pilares' ? corpoPilares()
        : corpoReferencias()) +
    '</div>';

    const voltar = painel().querySelector('#ds-voltar');
    if (voltar) voltar.onclick = () => { linhaAberta = null; abrir(); };
    painel().querySelectorAll('[data-aba-linha-topo]').forEach(b => b.onclick = () => trocarAbaLinhaTopo(b.dataset.abaLinhaTopo));
    const assumirTudo = painel().querySelector('#ds-assumir-tudo');
    if (assumirTudo) assumirTudo.onclick = async () => {
      assumirTudo.disabled = true; assumirTudo.textContent = 'Assumindo…';
      try {
        const r = await B7.DB.assumirDemandaLinha(linhaAberta);
        const n = (r && r.assumidas) || 0;
        B7.UI.toast(n > 0 ? (n === 1 ? '1 demanda assumida' : n + ' demandas assumidas') : 'Nenhuma demanda sobrou para assumir.');
        const linhas = await B7.DB.listarDesign();
        dados = linhas || [];
        desenharLinha();
      } catch (e) {
        assumirTudo.disabled = false; assumirTudo.textContent = 'Assumir demanda';
        B7.UI.toast('Não foi possível assumir: ' + (e.message || ''), { tipo: 'erro' });
      }
    };
    painel().querySelectorAll('[data-aba-linha]').forEach(b => b.onclick = () => { abaLinha = b.dataset.abaLinha; desenharLinha(); });
    painel().querySelectorAll('[data-peca]').forEach(el => el.onclick = () => abrirDetalhe(el.dataset.peca));
    ligarThumbs(painel());
  }

  /* aba "Peças de Design" — exatamente o corpo que já existia aqui
     antes da Rodada 5b (resumo por status + subabas + grade de peças),
     só extraído pra função própria porque agora divide a tela com as
     outras 3 abas. */
  function corpoPecas(itens, total) {
    const statusAba = STATUS_DA_ABA_LINHA[abaLinha];
    const vis = (statusAba ? itens.filter(d => statusAba.includes(d.status)) : itens).slice().sort(ordenarPorUrgencia);
    return resumoProducao(itens) +
      ('<nav class="ds-abas dl-abas" role="tablist">' + ABAS_LINHA.map(([k, r]) => {
        const n = k === 'todas' ? total : itens.filter(d => STATUS_DA_ABA_LINHA[k].includes(d.status)).length;
        return '<button role="tab" data-aba-linha="' + k + '" class="' + (abaLinha === k ? 'on' : '') + '" aria-selected="' + (abaLinha === k) + '">' +
          esc(r) + (n ? ' <b>' + n + '</b>' : '') + '</button>';
      }).join('') + '</nav>') +
      (vis.length ? '<div class="ds-lista ds-lista-grade">' + vis.map(cartao).join('') + '</div>'
        : '<div class="estado-b7"><b>' + (total ? 'Nada nesta aba.' : 'Nenhuma peça de Design nesta linha ainda.') + '</b></div>');
  }

  /* =================================================================
     Rodada 5b — CONTEXTO / PILARES / REFERÊNCIAS: as outras 3 abas,
     sempre somente leitura (pros dois papéis que passam por aqui — não
     é a tela de edição, é um resumo de apoio pra quem vai produzir a
     peça). Buscam a linha e os pilares sob demanda, na primeira vez que
     a pessoa clica numa dessas abas — nunca de cara, pra não pesar
     quem só quer ver as peças (o caso mais comum). `contextoLinha` fica
     em cache pelo resto da visita a esta linha; zera em abrirLinha().

     Decisão consciente: NÃO busca `listarConteudos` (a lista de
     criativos da linha) só pra estas abas — evitaria uma consulta a
     mais e a aba "Peças de Design" já mostra o resumo de produção real.
     Por isso a aba Pilares aqui mostra o planejado (percentual/funil/
     objetivo) mas não a distribuição real×planejado (que precisa dos
     criativos) — essa continua só no editor completo da Linha Editorial
     (`#/linha/:id`, Coordenador).
     ================================================================= */
  async function trocarAbaLinhaTopo(k) {
    abaLinhaTopo = k;
    if (k !== 'pecas' && !contextoLinha) {
      desenharLinha();   /* mostra o esqueleto de carregamento já */
      try {
        const [linha, pilares] = await Promise.all([
          B7.DB.linha(linhaAberta), B7.DB.listarPilares(linhaAberta).catch(() => [])
        ]);
        contextoLinha = { linha, pilares };
      } catch (e) { contextoLinha = { erro: true }; }
      if (abaLinhaTopo === k) desenharLinha();
      return;
    }
    desenharLinha();
  }

  function blocoCarregandoOuErro() {
    if (!contextoLinha) return B7.UI.skeleton('detalhe');
    if (contextoLinha.erro) return '<div class="estado-b7"><b>Não foi possível carregar.</b><p>Tenta de novo em instantes.</p></div>';
    return null;
  }

  /* texto de leitura — nada aparece quando vazio, igual ao resto do
     app (nunca mostra rótulo com campo em branco embaixo) */
  function blocoTexto(rot, v) {
    return !String(v || '').trim() ? '' :
      '<div class="bloco mb"><h3>' + esc(rot) + '</h3><p class="texto-bloco">' + esc(v) + '</p></div>';
  }

  function corpoContexto() {
    const carregando = blocoCarregandoOuErro();
    if (carregando) return carregando;
    const l = contextoLinha.linha;
    const canais = (l.canais || '').split(',').map(x => x.trim()).filter(Boolean);
    const periodo = (l.periodo_inicio || l.periodo_fim)
      ? (l.periodo_inicio ? B7.UI.dataBR(l.periodo_inicio) : '…') + ' – ' + (l.periodo_fim ? B7.UI.dataBR(l.periodo_fim) : '…')
      : null;

    const geral = (periodo || canais.length || l.meta_conteudos)
      ? '<div class="bloco mb"><h3>Informações gerais</h3>' +
          (periodo ? '<div class="pl-campo"><b>PERÍODO</b><p>' + esc(periodo) + '</p></div>' : '') +
          (canais.length ? '<div class="pl-campo"><b>CANAIS</b><div class="chips-canais">' +
            canais.map(c => '<span class="chip-canal on">' + esc(c) + '</span>').join('') + '</div></div>' : '') +
          (l.meta_conteudos ? '<div class="pl-campo"><b>META DE CONTEÚDOS</b><p>' + esc(l.meta_conteudos) + '</p></div>' : '') +
        '</div>' : '';

    const posicionamento = (l.posicionamento || l.tom_voz || l.puv || l.percepcao)
      ? '<div class="bloco"><h3>Posicionamento</h3>' +
          blocoLeituraCampo('A MARCA SE POSICIONA COMO', l.posicionamento) +
          blocoLeituraCampo('TOM DE VOZ', l.tom_voz) +
          blocoLeituraCampo('PROPOSTA ÚNICA DE VALOR', l.puv) +
          blocoLeituraCampo('PERCEPÇÃO DESEJADA', l.percepcao) +
        '</div>' : '';

    const nada = !l.objetivo && !geral && !posicionamento;
    if (nada) return '<div class="estado-b7"><b>Sem contexto cadastrado ainda.</b><p>Período, canais, objetivo e ' +
      'posicionamento aparecem aqui quando alguém da equipe preencher na Linha Editorial.</p></div>';

    return blocoTexto('Objetivo do período', l.objetivo) + geral + posicionamento;
  }

  function blocoLeituraCampo(rot, v) {
    return !String(v || '').trim() ? '' : '<div class="pl-campo"><b>' + esc(rot) + '</b><p>' + esc(v) + '</p></div>';
  }

  function corpoPilares() {
    const carregando = blocoCarregandoOuErro();
    if (carregando) return carregando;
    const pilares = contextoLinha.pilares || [];
    if (!pilares.length) return '<div class="estado-b7"><b>Nenhum pilar cadastrado ainda.</b>' +
      '<p>Os pilares de conteúdo do mês aparecem aqui quando a equipe cadastrar na Linha Editorial.</p></div>';
    const pct = p => Math.max(0, +p.percentual || 0);
    const soma = Math.round(pilares.reduce((s, p) => s + pct(p), 0) * 100) / 100;
    const avisoSoma = soma === 100 ? '<span class="ok">Soma 100%</span>'
      : soma < 100 ? '<span class="falta">Soma ' + soma + '% — faltam ' + Math.round((100 - soma) * 100) / 100 + '%</span>'
      : '<span class="falta">Soma ' + soma + '% — passa ' + Math.round((soma - 100) * 100) / 100 + '% de 100</span>';
    return '<div class="bloco mb bloco-pilares">' +
      '<div class="pil-cab"><h3>PILARES DE CONTEÚDO</h3><div class="pil-soma">' + avisoSoma + '</div></div>' +
      '<div id="lista-pilares">' + pilares.map((p, i) =>
        '<div class="cartao-pilar leitura"><div class="pilar-num">' + String(i + 1).padStart(2, '0') + '</div>' +
          '<div class="pilar-corpo"><div class="pl-cab"><b class="pl-nome">' + esc(p.nome || 'Tipo não definido') + '</b>' +
            '<span class="pl-pct">' + pct(p) + '%</span>' +
            (p.funil ? '<span class="pl-funil">' + esc(p.funil) + '</span>' : '') + '</div>' +
            blocoLeituraCampo('OBJETIVO DO PILAR', p.objetivo) +
            blocoLeituraCampo('OBSERVAÇÕES', p.observacoes) +
          '</div></div>').join('') + '</div>' +
    '</div>';
  }

  function corpoReferencias() {
    const carregando = blocoCarregandoOuErro();
    if (carregando) return carregando;
    const linhas = String((contextoLinha.linha || {}).referencias || '').split('\n').map(x => x.trim()).filter(Boolean);
    if (!linhas.length) return '<div class="estado-b7"><b>Nenhuma referência cadastrada ainda.</b>' +
      '<p>Links de apoio para os conteúdos do mês aparecem aqui quando a equipe cadastrar na Linha Editorial.</p></div>';
    const ehLink = s => /^https?:\/\//i.test(s);
    return '<div class="bloco"><h3>Referências do mês</h3><ul class="ds-lista-referencias">' +
      linhas.map(l => '<li>' + (ehLink(l)
        ? '<a href="' + esc(l) + '" target="_blank" rel="noopener">' + esc(l) + '</a>'
        : esc(l)) + '</li>').join('') + '</ul></div>';
  }

  /* =================================================================
     QUADRO — uma coluna por status presente no recorte atual; ordenar
     por urgência (prazo) dentro de cada coluna, mais atrasada primeiro
     ================================================================= */
  /* "PRECISA DE VOCÊ" — o que a equipe (Admin/Coordenador) tem pra
     fazer AGORA, contado sobre a fila inteira (ignora os filtros): o que
     está esperando revisão interna, o que está aprovado por dentro e
     ainda não foi ao cliente, o que aguarda decisão do cliente, o que
     ninguém assumiu e o que estourou o prazo. Cada chip é um atalho de
     filtro (liga/desliga). Sem inventar métrica: são contagens. */
  function desenharResumoEquipe() {
    const cx = painel().querySelector('#ds-resumo');
    if (!cx || !ehEquipe() || F.aba === 'equipe') { if (cx) cx.innerHTML = ''; return; }
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const n = {
      revisao: dados.filter(d => d.status === 'revisao_interna').length,
      aprovado: dados.filter(d => d.status === 'aprovado_interno').length,
      cliente: dados.filter(d => d.status === 'aguardando_cliente').length,
      semdono: dados.filter(d => d.status === 'aguardando_producao' && !d.designer_id).length,
      atrasadas: dados.filter(d => d.prazo && new Date(d.prazo + 'T00:00:00') < hoje && d.status !== 'finalizado').length
    };
    const itens = [
      ['revisao', n.revisao, 'para revisar', 'Peças enviadas pelo designer, esperando a revisão interna', 'urgente'],
      ['aprovado', n.aprovado, 'aprovada' + (n.aprovado === 1 ? '' : 's') + ' sem envio ao cliente', 'Aprovadas por dentro — falta registrar a decisão do cliente ou enviar pelo Portal', 'atencao'],
      ['cliente', n.cliente, 'aguardando o cliente', 'Enviadas ao cliente, sem decisão registrada', 'neutra'],
      ['semdono', n.semdono, 'sem responsável', 'Aguardando produção e ninguém assumiu — atribua um designer', 'atencao'],
      ['atrasadas', n.atrasadas, 'atrasada' + (n.atrasadas === 1 ? '' : 's'), 'Prazo passou e a peça não foi finalizada', 'urgente']
    ];
    const nada = itens.every(i => !i[1]);
    cx.innerHTML = '<div class="ds-precisa">' +
      '<small>PRECISA DE VOCÊ</small>' +
      (nada ? '<span class="ds-precisa-ok">Nada esperando a equipe agora.</span>' :
        itens.filter(i => i[1] > 0).map(i =>
          '<button class="ds-precisa-chip ' + i[4] + (F.rapido === i[0] ? ' on' : '') + '" data-rapido="' + i[0] + '" title="' + esc(i[3]) + '" aria-pressed="' + (F.rapido === i[0]) + '">' +
            '<b>' + i[1] + '</b> ' + esc(i[2]) + '</button>').join('')) +
    '</div>';
    cx.querySelectorAll('[data-rapido]').forEach(b => b.onclick = () => {
      F.rapido = F.rapido === b.dataset.rapido ? '' : b.dataset.rapido;
      /* o atalho já recorta por status; a aba "Todas" evita que uma aba
         mais estreita esconda o resultado */
      if (F.rapido) { F.aba = 'todas'; painel().querySelectorAll('[data-aba]').forEach(x => x.classList.toggle('on', x.dataset.aba === 'todas')); }
      guardarFiltros(); desenharArea(); atualizarLimpar();
    });
  }

  /* colunas do quadro da equipe: as que têm peça, na ordem do fluxo, e
     SEMPRE as duas filas da equipe (revisão interna e aguardando
     cliente) — vazias dizem "nada aqui", em vez de sumir e parecer que
     não existe etapa de revisão */
  const COLUNAS_FIXAS_EQUIPE = ['revisao_interna', 'aguardando_cliente'];

  /* fila de "Aguardando produção" agrupada por cliente: 40 cards viram
     meia dúzia de grupos recolhíveis, cada um com "Atribuir" em massa */
  function colunaBacklog(itens, s) {
    const grupos = new Map();
    itens.forEach(d => { const k = d.client_id || '_'; if (!grupos.has(k)) grupos.set(k, { nome: d.cliente_nome || 'Interno', itens: [] }); grupos.get(k).itens.push(d); });
    const lista = [...grupos.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome));
    F._backlogFechados = F._backlogFechados || [];
    return '<section class="ds-col ds-col-backlog" data-status="' + s + '">' +
      '<header><b>' + esc(rotuloStatus(s)) + '</b><span class="ds-cont">' + itens.length + '</span></header>' +
      '<div class="ds-lista">' + lista.map(([k, g]) => {
        const semDono = g.itens.filter(d => !d.designer_id).length;
        return '<details class="ds-grupo-cli"' + (F._backlogFechados.includes(k) ? '' : ' open') + ' data-grupo="' + esc(k) + '">' +
          '<summary><b>' + esc(g.nome) + '</b><span class="ds-cont">' + g.itens.length + '</span>' +
            (semDono ? '<button class="b fina contorno" data-atribuir-grupo="' + esc(k) + '" title="Atribuir um designer a todas as peças deste cliente ainda sem responsável">Atribuir ' + semDono + '</button>' : '') +
          '</summary>' +
          g.itens.sort(ordenarPorUrgencia).map(d => cartao(d, { compacto: true })).join('') +
        '</details>';
      }).join('') + '</div></section>';
  }

  function viewQuadro(vis) {
    if (!vis.length && !ehEquipe()) return blocoVazio();
    const presentes = new Set(vis.map(d => d.status));
    if (ehEquipe() && !filtrosAtivos() && !F.rapido && (!F.aba || F.aba === 'todas')) COLUNAS_FIXAS_EQUIPE.forEach(c => presentes.add(c));
    const statusPresentes = [...presentes].sort((a, b) => ordemStatus(a) - ordemStatus(b));
    if (!statusPresentes.length) return blocoVazio();
    const porStatus = s => vis.filter(d => d.status === s).sort(ordenarPorUrgencia);

    const coluna = s => {
      const itens = porStatus(s);
      if (ehEquipe() && s === 'aguardando_producao' && itens.length > 6 && !ehMovel()) return colunaBacklog(itens, s);
      return '<section class="ds-col' + (itens.length ? '' : ' vazia') + '" data-status="' + s + '">' +
        '<header><b>' + esc(rotuloStatus(s)) + '</b><span class="ds-cont">' + itens.length + '</span></header>' +
        '<div class="ds-lista">' + (itens.length ? itens.map(d => cartao(d, { compacto: ehEquipe() })).join('')
          : '<p class="ds-col-nada">Nada aqui agora.</p>') + '</div></section>';
    };

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
     RESUMO DE PRODUÇÃO — "11 peças · 4 Cards, 4 Capas de Reel, 2
     Carrosséis, 1 Stories · 5 finalizadas · 2 em ajustes · 1 em
     revisão · 3 para fazer". Só conta o que já está nos dados
     (design_resumo) que a tela já carregou — nada de consulta nova.
     ================================================================= */
  function chipsFormatos(itens) {
    const porTipo = new Map();
    itens.forEach(d => porTipo.set(d.tipo, (porTipo.get(d.tipo) || 0) + 1));
    const formatos = [...porTipo.entries()].sort((a, b) => b[1] - a[1]);
    return '<div class="ds-resumo-formatos">' + formatos.map(([t, n]) =>
      '<span class="ds-resumo-chip">' + esc(rotuloTipoContagem(t, n)) + '</span>').join('') + '</div>';
  }

  /* progresso REAL por formato — "3/4 Cards, 1/2 Carrosséis" — nunca
     só a contagem: finalizada ÷ total daquele formato, na linha atual */
  function chipsProgressoFormato(itens) {
    const porTipo = new Map();
    itens.forEach(d => {
      if (!porTipo.has(d.tipo)) porTipo.set(d.tipo, { total: 0, feitas: 0 });
      const g = porTipo.get(d.tipo); g.total++; if (d.status === 'finalizado') g.feitas++;
    });
    const formatos = [...porTipo.entries()].sort((a, b) => b[1].total - a[1].total);
    return '<div class="ds-resumo-formatos">' + formatos.map(([t, g]) =>
      '<span class="ds-resumo-chip' + (g.feitas === g.total ? ' feito' : '') + '">' + g.feitas + '/' + g.total + ' ' +
      esc(PLURAL_TIPO[t] || rotuloTipo(t)) + '</span>').join('') + '</div>';
  }

  function resumoProducao(itens) {
    if (!itens.length) return '';
    const total = itens.length;
    const finalizadas = itens.filter(d => d.status === 'finalizado').length;
    const ajustes = itens.filter(d => d.status === 'ajustes' || d.status === 'ajustes_cliente').length;
    const emRevisao = itens.filter(d => ['revisao_interna', 'aprovado_interno', 'aguardando_cliente', 'aprovado_cliente'].includes(d.status)).length;
    const aFazer = total - finalizadas - ajustes - emRevisao;
    return '<div class="ds-resumo-producao">' +
      '<div class="ds-resumo-total">' + total + (total === 1 ? ' peça de Design' : ' peças de Design') + '</div>' +
      chipsProgressoFormato(itens) +
      '<div class="ds-resumo-status">' +
        (finalizadas ? '<span>' + finalizadas + ' finalizada' + (finalizadas === 1 ? '' : 's') + '</span>' : '') +
        (ajustes ? '<span class="alerta">' + ajustes + ' em ajuste' + (ajustes === 1 ? '' : 's') + '</span>' : '') +
        (emRevisao ? '<span>' + emRevisao + ' em revisão</span>' : '') +
        (aFazer ? '<span>' + aFazer + ' para fazer</span>' : '') +
      '</div></div>';
  }

  /* =================================================================
     CARTÃO — a mesma peça de dado alimenta quadro, lista (linha) e
     "sem responsável"; aqui é a versão em card usada nos dois primeiros
     ================================================================= */
  function cartao(d, op) {
    op = op || {};
    const info = prazoInfo(d);
    const feedback = d.ultima_versao_estado === 'ajuste_solicitado';
    return '<article class="ds-card' + (d.prioridade === 'urgente' ? ' urgente' : d.prioridade === 'alta' ? ' alta' : '') + '" ' +
      'data-peca="' + esc(d.id) + '" tabindex="0" role="button" aria-label="' + esc(d.titulo || d.conteudo_titulo || 'Peça de Design') + '">' +
      '<div class="ds-card-topo">' +
        (fontePrevia(d) ? '<div class="ds-thumb" data-previa="' + esc(fontePrevia(d)) + '"><span class="ds-thumb-esq"></span></div>'
          : '<div class="ds-thumb ds-thumb-vazia">' + iconeTipo(d.tipo) + '</div>') +
        '<div class="ds-card-info">' +
          '<span class="ds-tipo">' + esc(rotuloTipo(d.tipo)) + '</span>' +
          '<h4>' + esc(d.titulo || d.conteudo_titulo || 'Sem título') + '</h4>' +
          (d.cliente_nome ? '<span class="ds-cli">' + esc(d.cliente_nome) + (d.linha_nome && !op.compacto ? ' · ' + esc(d.linha_nome) : '') + '</span>' : '<span class="ds-cli sem">Interno</span>') +
        '</div>' +
      '</div>' +
      '<div class="ds-tags">' +
        /* no quadro da equipe a coluna já é o status — o chip só repete;
           fica só o que acrescenta (versão, ajuste pendente, origem) */
        (op.compacto ? (d.status === 'ajustes_cliente' ? '<span class="ds-chip ajustes_cliente">Cliente</span>' : '')
                     : '<span class="ds-chip ' + esc(d.status) + '">' + esc(rotuloStatus(d.status)) + '</span>') +
        (d.ultima_versao ? '<span class="ds-v">V' + String(d.ultima_versao).padStart(2, '0') + '</span>' : '') +
        (feedback ? '<span class="ds-feedback">Ajuste pendente</span>' : '') +
      '</div>' +
      '<div class="ds-pe">' +
        (d.designer_nome
          ? '<span class="ds-resp">' + B7.UI.avatarPessoa({ nome: d.designer_nome, avatar_url: d.designer_avatar }, 'xs') +
              '<b>' + esc(d.designer_nome.split(/\s+/)[0]) + '</b></span>'
          : '<span class="ds-resp-vazio"><span class="ds-sem-resp"></span>Sem responsável</span>') +
        (info ? '<span class="ds-prazo' + (info.atrasada ? ' atrasada' : info.hoje ? ' hoje' : '') + '">' + esc(info.txt) + '</span>' : '') +
      '</div>' +
    '</article>';
  }

  /* qual caminho usar pra desenhar a prévia de uma peça, sem nunca
     tentar montar imagem de algo que não é imagem (Rodada 5). Prefere
     a miniatura otimizada (gerada no upload, Rodada 5 em diante); cai
     pro arquivo original só quando ele É mesmo uma imagem (peça antiga,
     enviada antes desta miniatura existir); e retorna null — vira
     placeholder limpo por formato — quando o último preview é vídeo,
     PDF ou qualquer coisa que não dá pra desenhar como background-image. */
  function fontePrevia(d) {
    if (d.ultima_previa_thumb) return d.ultima_previa_thumb;
    const ehImagem = !d.ultima_previa_mime || d.ultima_previa_mime.indexOf('image/') === 0;
    return (d.ultima_previa && ehImagem) ? d.ultima_previa : null;
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
    area.querySelectorAll('details.ds-grupo-cli').forEach(det => det.ontoggle = () => {
      const k = det.dataset.grupo; F._backlogFechados = F._backlogFechados || [];
      if (det.open) F._backlogFechados = F._backlogFechados.filter(x => x !== k); else if (!F._backlogFechados.includes(k)) F._backlogFechados.push(k);
    });
    area.querySelectorAll('[data-atribuir-grupo]').forEach(b => b.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      const k = b.dataset.atribuirGrupo;
      const ids = dados.filter(d => (d.client_id || '_') === k && d.status === 'aguardando_producao' && !d.designer_id).map(d => d.id);
      if (ids.length) abrirSeletorDesigner(null, ids);
    });

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
          /* página de demanda tem cache próprio (itensLinha) — pode
             estar aberta sem `dados` ter sido carregado (link direto) */
          const j = itensLinha.findIndex(x => x.id === pid);
          if (j >= 0) itensLinha[j] = linha;
          else if (linhaAberta && linha.linha_id === linhaAberta) itensLinha.push(linha);
        } catch (e) {
          const i = dados.findIndex(x => x.id === pid);
          if (i >= 0) dados.splice(i, 1);
          const j = itensLinha.findIndex(x => x.id === pid);
          if (j >= 0) itensLinha.splice(j, 1);
        }
      }
      redesenharTela();
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
    /* Central (#dsc-raiz) e vista por linha também são telas de Design:
       a gaveta abre por cima delas sem trocar a tela de trás */
    if (!painel().querySelector('.design-tela')) await abrir();
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
      el.className = 'ds-ws-fundo';
      el.innerHTML = '<div class="ds-ws" role="dialog" aria-modal="true" aria-label="Peça de Design"><div class="ds-ws-corpo"><div class="ds-ws-principal">' +
        B7.UI.skeleton('tabela', { n: 5, cols: 2 }) + '</div></div></div>';
      document.body.appendChild(el);
      document.body.classList.add('ds-ws-aberta');
      el.addEventListener('mousedown', e => { if (e.target === el) fecharDrawer(); });
      /* setas do teclado só navegam slide/story quando o foco já está
         dentro do navegador (uma pill ou uma seta ‹/›) — nunca sequestra
         Left/Right de um campo de texto ou de qualquer outro controle */
      const tecla = e => {
        if (e.key === 'Escape') { fecharDrawer(); return; }
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
            document.activeElement && document.activeElement.closest('.ds-nav-slides')) {
          e.preventDefault();
          moverSlide(e.key === 'ArrowRight' ? 1 : -1);
        }
      };
      document.addEventListener('keydown', tecla);
      drawer = { id, el, extra: null, briefing: null, versaoAtualId: null, filaUpload: [], ajustesCliente: {},
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
    document.body.classList.remove('ds-ws-aberta');
    const foco = drawer.anterior;
    drawer = null;
    if (foco && foco.focus && document.contains(foco)) foco.focus();
  }

  async function carregarExtra(d) {
    try {
      const [hist] = await Promise.all([B7.DB.historicoDesign(d.id)]);
      drawer.extra = hist;
      await carregarNomesRevisores();
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

  /* quem decidiu cada slide (pra linha do tempo) — só ids ainda não
     conhecidos; falha silenciosa (a timeline sai sem o nome) */
  async function carregarNomesRevisores() {
    if (!drawer || !drawer.extra) return;
    drawer.nomesPerfis = drawer.nomesPerfis || {};
    const ids = (drawer.extra.arquivos || []).map(a => a.revisado_por).filter(id => id && !drawer.nomesPerfis[id]);
    if (!ids.length) return;
    try { Object.assign(drawer.nomesPerfis, await B7.DB.nomesPerfis(ids)); } catch (e) {}
  }

  async function atualizarDrawerSeAberto(id) {
    if (!drawer || drawer.id !== id) return;
    /* não redesenha por cima de uma observação sendo digitada */
    const obs = drawer.el.querySelector('#dv-observacao');
    if (obs && obs.value.trim() && drawer._observacaoTocada) return;
    try { drawer.extra = await B7.DB.historicoDesign(id); } catch (e) {}
    if (drawer && drawer.id === id) desenharDrawer();
  }

  /* Uma peça precisa de uma ação clara a cada momento — nunca duas
     igualmente fortes competindo (era o caso antes: "Finalizar" e
     "Enviar para aprovação do cliente" podiam aparecer juntos, os dois
     como botão cheio, para a mesma peça vinculada a cliente). Esta
     função decide QUAL é a ação primária do estado atual; o resto vira
     secundário (contorno) ou simplesmente não aparece agora. */
  function acaoPrimaria(d, versaoAtual, souResponsavel, equipe, podeAssumir) {
    if (podeAssumir) return { primaria: { id: 'dv-assumir', label: 'Assumir esta peça' } };
    if (equipe && versaoAtual && versaoAtual.estado === 'enviada') {
      /* multiparte (Arquivos 2.0): a decisão é por slide, na área
         principal; aqui só o fechamento — "Aprovar carrossel" só com
         tudo aprovado, "Enviar ajustes ao Designer" só com algum ajuste
         marcado (§23/§45/§46). Uma ação de fechamento = uma notificação. */
      if (ehMultiparte() && drawer.briefing) {
        const r = resumoDecisoes(d);
        const conj = d.tipo === 'stories' ? 'Stories' : 'carrossel';
        const nomeP = d.tipo === 'stories' ? 'story' : 'slide';
        const partesDecididas = r.aprovados + r.ajustes;
        const resumo = souResponsavel ? 'Quem produziu a peça não pode revisá-la.'
          : r.total - r.semArquivo === 0 ? 'Nenhum ' + nomeP + ' com arquivo nesta versão — aprove ou peça ajuste pela peça inteira.'
          : r.aprovados + ' aprovado' + (r.aprovados === 1 ? '' : 's') + ' · ' + r.ajustes + ' em ajuste · ' + r.pendentes + ' sem decisão' +
            (r.semArquivo ? ' · ' + r.semArquivo + ' sem arquivo' : '');
        if (r.total - r.semArquivo === 0) {
          return { primaria: { id: 'dv-aprovar', label: 'Aprovar internamente', desabilitada: souResponsavel },
                   secundarias: [{ id: 'dv-ajuste', label: 'Solicitar ajuste' }], resumo };
        }
        /* "Aprovar carrossel inteiro": aprova de uma vez todo slide ainda
           sem decisão (o banco marca como aprovado ao aprovar a peça) —
           quem não tem tempo de passar slide a slide aprova tudo num
           clique. Só trava com ajuste marcado ou slide sem arquivo. */
        const inteiro = r.pendentes > 0;
        return { primaria: { id: inteiro ? 'dv-aprovar-inteiro' : 'dv-fechar-aprovar', label: inteiro ? 'Aprovar ' + conj + ' inteiro' : 'Aprovar ' + conj,
                             desabilitada: souResponsavel || r.ajustes > 0 || r.semArquivo > 0 },
                 secundarias: [{ id: 'dv-fechar-ajustes', label: 'Enviar ajustes ao Designer', desabilitada: souResponsavel || r.ajustes === 0 }],
                 resumo: resumo + (inteiro && !souResponsavel && r.ajustes === 0 && r.semArquivo === 0
                   ? ' — “Aprovar ' + conj + ' inteiro” aprova de uma vez os ' + r.pendentes + ' sem decisão.'
                   : r.ajustes > 0 ? ' — com ajuste marcado, só dá pra enviar ajustes.' : '') };
      }
      return { primaria: { id: 'dv-aprovar', label: 'Aprovar internamente', desabilitada: souResponsavel },
               secundarias: [{ id: 'dv-ajuste', label: 'Solicitar ajuste' }] };
    }
    if (equipe && d.client_id && versaoAtual && (versaoAtual.estado === 'aprovada_interna' || versaoAtual.estado === 'enviada_cliente')) {
      /* aprovada por dentro: o próximo passo é a DECISÃO DO CLIENTE. Como
         hoje quase tudo acontece pelo WhatsApp, a ação primária é
         registrar o que o cliente decidiu; mandar pelo Portal continua
         disponível como caminho alternativo. Finalizar sem decisão do
         cliente pularia etapa — fica secundário, não some. */
      const r = resumoAjustesCliente();
      const sec = [];
      if (versaoAtual.estado === 'aprovada_interna') sec.push({ id: 'dv-enviar-cliente', label: 'Enviar pelo Portal do Cliente' });
      if (versaoAtual.estado === 'aprovada_interna' && d.status === 'aprovado_interno') sec.push({ id: 'dv-finalizar', label: 'Finalizar mesmo assim' });
      return { primaria: { id: 'dv-decisao-cliente', label: r ? 'Enviar ajustes do cliente ao Designer' : 'Registrar decisão do cliente' },
               secundarias: sec, resumo: r ? r + ' com ajuste do cliente marcado — confirme e envie' : (versaoAtual.estado === 'enviada_cliente' ? 'Aguardando a decisão do cliente (Portal, WhatsApp, ligação…).' : null) };
    }
    if (equipe && (d.status === 'aprovado_interno' || d.status === 'aprovado_cliente')) {
      return { primaria: { id: 'dv-finalizar', label: 'Finalizar' } };
    }
    return null;
  }

  function acaoPrimariaHTML(acao) {
    if (!acao) return '';
    return '<div class="ds-ws-lateral-acao">' +
      (acao.resumo ? '<p class="ds-ws-resumo-decisoes">' + esc(acao.resumo) + '</p>' : '') +
      '<button class="b pri ds-ws-acao-primaria" id="' + acao.primaria.id + '"' +
        (acao.primaria.desabilitada ? ' disabled title="' + (acao.resumo ? esc(acao.resumo) : 'Quem produziu a peça não pode aprová-la') + '"' : '') + '>' +
        esc(acao.primaria.label) + '</button>' +
      ((acao.secundarias || []).length
        ? '<div class="ds-ws-acoes-sec">' + acao.secundarias.map(s =>
            '<button class="b contorno" id="' + s.id + '"' + (s.desabilitada ? ' disabled' : '') + '>' + esc(s.label) + '</button>').join('') + '</div>' : '') +
    '</div>';
  }

  /* prévia grande da arte mais recente — mesmo carregamento sob demanda
     dos cartões, só maior. Aqui usa sempre o ARQUIVO ORIGINAL (nunca a
     miniatura de 320px) — é a peça inteira, a pessoa abriu de propósito
     pra ver a arte de verdade. Mas só quando o último preview É uma
     imagem (Rodada 5): vídeo, PDF etc. mostram o ícone por formato em
     vez de um quadrado quebrado tentando abrir como background-image —
     o arquivo continua acessível pelo histórico de versões, só não dá
     pra pré-visualizar aqui dentro. */
  /* =================================================================
     ARQUIVOS 2.0 — arte por slide/frame, arquivo efetivo, revisão por
     parte, tela cheia, download e ZIP ordenado.

     CAUSA RAIZ da prévia em "tira" que existia aqui: a prévia grande era
     um <div class="ds-ws-preview ds-thumb"> com background-image. A
     classe .ds-thumb (a do card de 52px) trazia height:52px e
     background-size:cover — a "prévia grande" virava uma faixa de
     100% × 52px com a arte cortada no meio. E mesmo sem isso o
     container tinha aspect-ratio 4/5 + max-height 440px numa coluna de
     ~800px: viraria uma caixa 800×440 com cover cortando qualquer arte
     4:5/9:16/1:1. Agora a arte é um <img> de verdade com
     object-fit:contain, dentro de uma moldura que reserva a proporção
     REAL do arquivo (largura/altura gravadas no upload) — nada de
     esticar, nada de cortar.
     ================================================================= */
  const cacheUrlArte = new Map();   // caminho → url assinada (curta)

  /* partes canônicas da peça aberta, na ordem da Linha Editorial —
     null quando a peça é de arte única (Card, Capa de Reel, Story de 1
     frame, demanda manual). Índice 0..n-1 é o parte_posicao gravado no
     upload — id ESTÁVEL do slide/frame é o vínculo de verdade. */
  function partesDaPeca() {
    const b = drawer && drawer.briefing;
    if (!b || b.manual || !b.conteudo) return null;
    let lista = null, tipo = null;
    if (b.conteudo.tipo === 'Carrossel') { lista = b.slides || []; tipo = 'slide'; }
    else if (b.conteudo.tipo === 'Story') { lista = b.frames || []; tipo = 'frame'; }
    if (!lista || !lista.length) return null;
    return lista.map((it, i) => ({ tipo, id: it.id, posicao: i, item: it,
      rotulo: tipo === 'slide' ? (it.titulo || '') : (it.texto || '') }));
  }
  function ehMultiparte() { const p = partesDaPeca(); return !!(p && p.length > 1); }
  const chaveParte = a => a.parte_id || '_';

  function ordenarMaisRecente(a, b) {
    return (b.versao_numero - a.versao_numero) || (b.posicao - a.posicao) || ((b.created_at || '').localeCompare(a.created_at || ''));
  }
  /* arquivo efetivo por parte — MESMA regra de design_arquivos_efetivos
     no banco: preview mais recente de versão já enviada (rascunho nunca
     conta) */
  function arquivosEfetivos() {
    const m = new Map();
    ((drawer.extra && drawer.extra.arquivos) || []).filter(a => a.papel === 'preview' && a.versao_estado !== 'rascunho')
      .sort(ordenarMaisRecente).forEach(a => { if (!m.has(chaveParte(a))) m.set(chaveParte(a), a); });
    return m;
  }
  function arquivosRascunho() {
    const m = new Map();
    ((drawer.extra && drawer.extra.arquivos) || []).filter(a => a.papel === 'preview' && a.versao_estado === 'rascunho')
      .sort(ordenarMaisRecente).forEach(a => { if (!m.has(chaveParte(a))) m.set(chaveParte(a), a); });
    return m;
  }
  function historicoParte(chave) {
    return ((drawer.extra && drawer.extra.arquivos) || [])
      .filter(a => a.papel === 'preview' && a.versao_estado !== 'rascunho' && chaveParte(a) === chave).sort(ordenarMaisRecente);
  }
  /* arquivos de versão enviada sem vínculo de slide numa peça multiparte
     — uploads de antes da estrutura por slide. Ficam acessíveis, nunca
     são "encaixados" num slide por ordem de chegada. */
  function arquivosLegados() {
    if (!ehMultiparte()) return [];
    return ((drawer.extra && drawer.extra.arquivos) || [])
      .filter(a => a.papel === 'preview' && !a.parte_id && a.versao_estado !== 'rascunho').sort(ordenarMaisRecente);
  }
  function ehImagem(a) { return !!a && !!a.mime && a.mime.indexOf('image/') === 0; }

  /* o estado que a pessoa lê na parte: o que a arte atual está esperando */
  function estadoParte(d, efetivo, rascunho, podeEditar) {
    if (rascunho && podeEditar) return { k: 'novo', t: 'Nova versão · ainda não enviada' };
    if (!efetivo) return { k: 'vazio', t: 'Sem arquivo' };
    /* ajuste pedido PELO CLIENTE (registrado pela B7 ou pelo Portal) tem
       precedência sobre a decisão interna — é o que o designer precisa
       atender agora, e a origem é outra */
    if (efetivo.cliente_ajuste) return { k: 'cliente', t: 'Ajuste do cliente' };
    if (efetivo.revisao === 'aprovado') return { k: 'aprovado', t: 'Aprovado' };
    if (efetivo.revisao === 'ajuste') return { k: 'ajuste', t: 'Ajuste solicitado' };
    if (d.status === 'revisao_interna') return { k: 'pendente', t: 'Aguardando revisão' };
    return { k: 'pendente', t: 'Enviado' };
  }

  /* ---- nomes limpos de download (§14/§58) — nunca o nome original
     "IMG_9382.png", nunca uuid; extensão original preservada ---- */
  function slug(s) {
    return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }
  function extensaoDe(a) {
    const m = /\.([a-z0-9]{1,6})$/i.exec(a.nome_original || '');
    if (m) return m[1].toLowerCase();
    const porMime = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' };
    return porMime[a.mime] || 'bin';
  }
  const pad2 = n => String(n).padStart(2, '0');
  function baseNomePeca(d) {
    const base = slug(d.titulo || d.conteudo_titulo) || 'arte';
    return d.tipo === 'capa_reel' && base.indexOf('capa') !== 0 ? 'capa-' + base : base;
  }
  function nomeDownload(d, a, parte) {
    const ext = extensaoDe(a);
    const v = a.versao_numero ? '-v' + pad2(a.versao_numero) : '';
    if (parte) return pad2(parte.posicao + 1) + '-' + (slug(parte.rotulo) || (parte.tipo === 'frame' ? 'story' : 'slide')) + v + '.' + ext;
    return baseNomePeca(d) + v + '.' + ext;
  }

  /* ---- download do ORIGINAL (bytes intactos) com nome limpo ---- */
  async function baixarArquivo(d, a, parte, botao) {
    const rot = botao ? botao.textContent : '';
    if (botao) { botao.disabled = true; botao.textContent = 'Preparando…'; }
    try {
      const blob = await B7.DB.baixarArquivoDesign(a.caminho);
      salvarBlob(blob, nomeDownload(d, a, parte));
    } catch (e) {
      B7.UI.toast('Não foi possível preparar o download.', { tipo: 'erro' });
    } finally { if (botao) { botao.disabled = false; botao.textContent = rot; } }
  }
  function salvarBlob(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  /* ---- ZIP ordenado (§15/§16): só os arquivos EFETIVOS de cada parte,
     na ordem canônica, prefixo numérico zero-padded. Montado no
     navegador a partir de URLs assinadas curtas (mesma autorização de
     sempre — nenhuma credencial de serviço no cliente). A escrita do
     .zip em si (sem biblioteca externa) vive em B7.Export.montarZip —
     compartilhada com a exportação em lote do Status Semanal. ---- */
  async function baixarConjunto(d, botao, somenteDisponiveis) {
    const partes = partesDaPeca() || []; const efet = arquivosEfetivos();
    const alvo = partes.map(p => ({ parte: p, arq: efet.get(p.id) })).filter(x => x.arq);
    if (!alvo.length) { B7.UI.toast('Nenhum arquivo para baixar ainda.', { tipo: 'aviso' }); return; }
    const rot = botao.textContent; botao.disabled = true;
    try {
      const entradas = []; const usados = new Set();
      for (let i = 0; i < alvo.length; i++) {
        botao.textContent = 'Preparando download… ' + (i + 1) + '/' + alvo.length;
        const blob = await B7.DB.baixarArquivoDesign(alvo[i].arq.caminho);
        let nome = pad2(alvo[i].parte.posicao + 1) + '-' + (slug(alvo[i].parte.rotulo) || (alvo[i].parte.tipo === 'frame' ? 'story' : 'slide')) + '.' + extensaoDe(alvo[i].arq);
        while (usados.has(nome)) nome = nome.replace(/(\.[^.]+)$/, '-' + pad2(alvo[i].arq.versao_numero || 0) + '$1');
        usados.add(nome);
        entradas.push({ nome, bytes: new Uint8Array(await blob.arrayBuffer()) });
      }
      const nomeZip = baseNomePeca(d) + (somenteDisponiveis ? '-parcial' : (d.versao_atual ? '-v' + pad2(d.versao_atual) : '')) + '.zip';
      salvarBlob(B7.Export.montarZip(entradas), nomeZip);
      botao.textContent = rot;
    } catch (e) {
      botao.textContent = rot;
      B7.UI.toast('Não foi possível preparar o download.', { tipo: 'erro' });
    } finally { botao.disabled = false; }
  }

  /* ---- prévia grande: <img> contido na proporção real ---- */
  function cartaoArquivo(a, d, parte) {
    return '<div class="ds-arte-arquivo">' + iconeTipo(d.tipo) +
      '<div class="ds-arte-arquivo-tx"><b>' + esc(a.nome_original || 'arquivo') + '</b>' +
      '<small>' + esc((a.mime || 'tipo desconhecido') + ' · ' + formatarTamanho(a.tamanho_bytes || 0)) + '</small>' +
      '<span class="ds-leve">Este formato não abre como prévia no navegador — o download funciona normalmente.</span></div>' +
      '<button class="b fina contorno" data-baixar="' + esc(a.id) + '">Baixar arquivo</button></div>';
  }
  function molduraArte(a, d, parte) {
    if (!a) return '<div class="ds-arte-moldura vazia"><div class="ds-arte-vazio">' + iconeTipo(d.tipo) + '<span>Sem arquivo</span></div></div>';
    if (!ehImagem(a)) return '<div class="ds-arte-moldura arquivo">' + cartaoArquivo(a, d, parte) + '</div>';
    const prop = a.largura && a.altura ? ' style="--prop:' + a.largura + '/' + a.altura + '"' : '';
    return '<div class="ds-arte-moldura"' + prop + '>' +
      '<img class="ds-arte-img" data-caminho="' + esc(a.caminho) + '" data-arte="' + esc(a.id) + '" alt="' + esc(a.nome_original || '') + '" draggable="false">' +
      '<span class="ds-arte-carregando" aria-hidden="true"></span></div>';
  }
  function metaArte(a) {
    if (!a) return '';
    return '<span class="ds-arte-meta">V' + pad2(a.versao_numero || 0) +
      (a.largura && a.altura ? ' · ' + a.largura + '×' + a.altura : '') +
      (a.tamanho_bytes ? ' · ' + formatarTamanho(a.tamanho_bytes) : '') + '</span>';
  }

  /* painel de UMA arte (parte ou única): moldura + estado + ações +
     feedback + decisão da revisão + slot de upload + histórico */
  function painelArte(d, x, parte, ctx) {
    const chave = parte ? parte.id : '_';
    const efet = ctx.efetivos.get(chave) || null, rasc = ctx.rascunhos.get(chave) || null;
    const escolhido = drawer.arteHistorico && drawer.arteHistorico[chave];
    const hist = historicoParte(chave);
    const historico = escolhido ? hist.find(h => h.id === escolhido) : null;
    const mostrado = historico || (ctx.podeEditar && rasc) || efet;
    const est = historico ? { k: 'historico', t: 'Versão anterior' } : estadoParte(d, efet, rasc, ctx.podeEditar);
    const nomeParte = parte ? (parte.tipo === 'frame' ? 'story' : 'slide') : null;
    const rotBaixar = parte ? 'Baixar ' + nomeParte : 'Baixar arquivo';
    const podeDecidir = ctx.podeRevisar && !!efet && !rasc && !historico;
    const podeUpload = ctx.podeEditar && d.status !== 'finalizado';
    const up = parte && drawer.uploadsParte && drawer.uploadsParte[parte.id];

    /* pra quem vai REENVIAR (slide em ajuste ou sem arte), o pedido e o
       botão de upload vêm ANTES da arte grande — senão ficam abaixo da
       dobra e o designer tem que rolar pra achar o que fazer */
    const precisaAgir = podeUpload && parte && (!efet || ((efet.revisao === 'ajuste' || efet.cliente_ajuste) && !rasc)) && !historico;
    /* dois feedbacks, duas origens, dois visuais (§13): "Ajuste interno
       B7" (vermelho) × "Ajuste solicitado pelo cliente" (roxo, com o
       canal). Nunca misturados num bloco só. */
    const marcado = ctx.ajustesCliente && parte && ctx.ajustesCliente[parte.id];
    const blocoFeedback =
      ((efet && efet.cliente_ajuste && !historico)
        ? '<div class="ds-arte-feedback cliente"><b>Ajuste solicitado pelo cliente' + (parte ? ' neste ' + nomeParte : '') +
            (efet.cliente_ajuste_canal ? ' · via ' + esc(rotuloCanal(efet.cliente_ajuste_canal)) : '') + '</b><p>' + esc(efet.cliente_ajuste) + '</p></div>' : '') +
      ((efet && efet.revisao === 'ajuste' && efet.revisao_mensagem && !historico)
        ? '<div class="ds-arte-feedback"><b>Ajuste interno B7' + (parte ? ' neste ' + nomeParte : '') + '</b><p>' + esc(efet.revisao_mensagem) + '</p></div>' : '') +
      (marcado
        ? '<div class="ds-arte-feedback cliente a-enviar"><b>Ajuste do cliente · a enviar ao designer</b><p>' + esc(marcado) + '</p>' +
            '<div class="ds-arte-decisao"><button class="b fina" data-ajuste-cliente="' + esc(parte.id) + '">Editar</button>' +
            '<button class="b fina" data-ajuste-cliente-remover="' + esc(parte.id) + '">Remover</button></div></div>' : '');
    const blocoUploadParte = () => {
      const precisa = !!(efet && (efet.revisao === 'ajuste' || efet.cliente_ajuste));
      return '<div class="ds-arte-upload' + (precisa ? ' precisa' : '') + '">' +
        (up && up.estado === 'enviando'
          ? '<div class="ds-up-barra"><span style="width:' + up.progresso + '%"></span></div><small>Enviando ' + esc(up.nome) + ' · ' + up.progresso + '%</small>'
          : up && up.estado === 'erro'
          ? '<span class="ds-up-erro">' + esc(up.erro || 'O envio foi interrompido') + '</span><button class="b fina" data-up-tentar-parte="' + esc(parte.id) + '">Tentar novamente</button>'
          : '<label class="b fina ' + (precisa || (!efet && !rasc) ? 'pri' : 'contorno') + ' ds-arte-escolher">' +
              (rasc ? 'Substituir arquivo' : precisa ? 'Enviar nova versão do ' + nomeParte + ' ' + pad2(parte.posicao + 1) : efet ? 'Substituir arquivo' : 'Enviar arquivo') +
              '<input type="file" hidden data-up-parte="' + esc(parte.id) + '"></label>' +
            (rasc ? '<button class="b fina" data-remover-rascunho="' + esc(rasc.id) + '">Remover</button>' : '')) +
      '</div>';
    };

    const blocoDecisao = () => !podeDecidir ? '' : '<div class="ds-arte-decisao topo">' +
        '<span class="ds-arte-estado st-' + est.k + '">' + esc(est.t) + '</span>' +
        (efet.revisao === 'aprovado'
          ? '<span class="ds-arte-decidido ok">Aprovado</span><button class="b fina" data-decidir="pendente" data-arquivo="' + esc(efet.id) + '">Desfazer</button>'
          : efet.revisao === 'ajuste'
          ? '<span class="ds-arte-decidido ajuste">Ajuste pedido</span><button class="b fina" data-decidir="ajuste" data-arquivo="' + esc(efet.id) + '">Editar pedido</button><button class="b fina" data-decidir="pendente" data-arquivo="' + esc(efet.id) + '">Desfazer</button>'
          : '<button class="b fina pri" data-decidir="aprovado" data-arquivo="' + esc(efet.id) + '">' + (parte ? 'Aprovar ' + nomeParte : 'Aprovar') + '</button>' +
            '<button class="b fina contorno" data-decidir="ajuste" data-arquivo="' + esc(efet.id) + '">' + (parte ? 'Solicitar ajuste neste ' + nomeParte : 'Solicitar ajuste') + '</button>') +
      '</div>';
    const blocoAjusteCliente = () => (ctx.podeRegistrarCliente && parte && efet && !marcado && !historico)
      ? '<div class="ds-arte-decisao topo"><span class="ds-arte-estado st-' + est.k + '">' + esc(est.t) + '</span>' +
        '<button class="b fina contorno cliente" data-ajuste-cliente="' + esc(parte.id) + '">Registrar ajuste do cliente neste ' + nomeParte + '</button></div>' : '';

    let html = '<div class="ds-arte' + (parte ? '' : ' unica') + '" data-parte="' + esc(chave) + '">' +
      (precisaAgir ? blocoFeedback + blocoUploadParte() : '') +
      /* pra quem REVISA, a decisão fica antes da arte grande — visível
         sem rolar, em qualquer altura de tela */
      blocoDecisao() + blocoAjusteCliente() +
      molduraArte(mostrado, d, parte) +
      '<div class="ds-arte-barra">' +
        (podeDecidir || (ctx.podeRegistrarCliente && parte && efet && !marcado && !historico) ? '' : '<span class="ds-arte-estado st-' + est.k + '">' + esc(est.t) + '</span>') + metaArte(mostrado) +
        (mostrado ? '<div class="ds-arte-acoes">' +
          (ehImagem(mostrado) ? '<button class="b fina contorno" data-tela-cheia="' + esc(mostrado.id) + '">Ver em tela cheia</button>' : '') +
          '<button class="b fina contorno" data-baixar="' + esc(mostrado.id) + '">' + (historico ? 'Baixar V' + pad2(historico.versao_numero) : rotBaixar) + '</button>' +
        '</div>' : '') +
      '</div>';

    if (!precisaAgir) html += blocoFeedback;
    if (podeUpload && parte && !precisaAgir) html += blocoUploadParte();
    if (hist.length > 1 || (hist.length === 1 && rasc && ctx.podeEditar)) {
      html += '<div class="ds-arte-hist"><small>VERSÕES' + (parte ? ' DESTE ' + nomeParte.toUpperCase() : '') + '</small>' +
        hist.map(h => '<button class="ds-arte-hist-v' + ((historico ? historico.id === h.id : (!rasc || !ctx.podeEditar) && efet && efet.id === h.id) ? ' on' : '') + '" data-ver-versao="' + esc(h.id) + '" data-parte-chave="' + esc(chave) + '">' +
          'V' + pad2(h.versao_numero) + rotuloHist(h) + '</button>').join('') +
        (historico ? '<button class="ds-arte-hist-v" data-ver-versao="" data-parte-chave="' + esc(chave) + '">Voltar à atual</button>' : '') +
      '</div>';
    }
    return html + '</div>';
  }

  /* rótulo curto da versão no histórico: decisão do arquivo (Arquivos
     2.0) ou, sem ela, o estado da versão (fluxo simples de arte única) */
  function rotuloHist(h) {
    if (h.revisao === 'aprovado') return ' · aprovada';
    if (h.revisao === 'ajuste') return ' · ajuste';
    if (h.versao_estado === 'ajuste_solicitado' || h.versao_estado === 'ajuste_cliente') return ' · ajuste';
    if (h.versao_estado === 'aprovada_interna' || h.versao_estado === 'aprovada_cliente') return ' · aprovada';
    return '';
  }

  function contextoArte(d) {
    const souResponsavel = d.designer_id === meuId(), equipe = ehEquipe();
    return {
      efetivos: arquivosEfetivos(), rascunhos: arquivosRascunho(),
      podeEditar: (equipe || souResponsavel) && d.status !== 'finalizado',
      podeRevisar: equipe && !souResponsavel && d.status === 'revisao_interna',
      /* decisão do cliente registrada pela B7: só Admin/Coordenador, com
         a peça aprovada por dentro ou já aguardando o cliente */
      podeRegistrarCliente: equipe && podeRegistrarDecisaoCliente(d),
      ajustesCliente: drawer.ajustesCliente || {}
    };
  }

  /* ---- ARTE ÚNICA (Card, Capa de Reel, Story de 1 frame, manual) ---- */
  function blocoArteUnica(d, x) {
    const ctx = contextoArte(d);
    /* Story de 1 frame / Carrossel de 1 slide: um slot só, pela lateral,
       sem "Story 01" na tela (arquivo sem parte_id, como Card) */
    return '<section class="ds-arte-secao"><small class="ds-arte-titulo">ARTE</small>' + painelArte(d, x, null, ctx) + '</section>';
  }

  /* ---- MULTIPARTE (Carrossel, Story com vários frames): navegador de
     slide com estado por parte + arte grande da parte atual + briefing
     canônico da parte; "Ver todos" vira a visão geral em grade ---- */
  function blocoArteMultiparte(d, x) {
    const partes = partesDaPeca(); const ctx = contextoArte(d);
    const total = partes.length, tipoItem = partes[0].tipo;
    const idx = Math.min(Math.max(drawer.slideIndice || 0, 0), total - 1);
    drawer.slideIndice = idx;
    const nomeConj = tipoItem === 'frame' ? 'Stories' : 'carrossel';
    /* "sem arquivo" = nem efetivo (enviado) nem rascunho deste designer */
    const faltam = partes.filter(p => !ctx.efetivos.get(p.id) && !(ctx.podeEditar && ctx.rascunhos.get(p.id)));
    const estados = partes.map(p => estadoParte(d, ctx.efetivos.get(p.id), ctx.rascunhos.get(p.id), ctx.podeEditar));
    const qtd = k => estados.filter(e => e.k === k).length;

    const resumo = '<div class="ds-arte-resumo">' +
      (qtd('aprovado') ? '<span class="st-aprovado">' + qtd('aprovado') + ' aprovado' + (qtd('aprovado') > 1 ? 's' : '') + '</span>' : '') +
      (qtd('ajuste') ? '<span class="st-ajuste">' + qtd('ajuste') + ' em ajuste</span>' : '') +
      (qtd('cliente') ? '<span class="st-cliente">' + qtd('cliente') + ' com ajuste do cliente</span>' : '') +
      (Object.keys(ctx.ajustesCliente || {}).length ? '<span class="st-cliente">' + Object.keys(ctx.ajustesCliente).length + ' marcado' + (Object.keys(ctx.ajustesCliente).length > 1 ? 's' : '') + ' pra enviar</span>' : '') +
      (qtd('pendente') ? '<span class="st-pendente">' + qtd('pendente') + ' aguardando</span>' : '') +
      (qtd('novo') ? '<span class="st-novo">' + qtd('novo') + ' nov' + (qtd('novo') > 1 ? 'os' : 'o') + '</span>' : '') +
      (faltam.length ? '<span class="st-vazio">' + faltam.length + ' ' + (tipoItem === 'frame' ? 'story' : 'slide') + (faltam.length > 1 ? 's' : '') + ' ainda sem arquivo (' + faltam.map(p => pad2(p.posicao + 1)).join(', ') + ')</span>' : '') +
    '</div>';
    const disponiveis = partes.length - faltam.length;
    const baixarTudo = disponiveis
      ? (faltam.length
          ? '<button class="b fina contorno" data-baixar-conjunto="parcial" title="O ' + nomeConj + ' ainda não está completo">Baixar arquivos disponíveis (' + disponiveis + '/' + total + ')</button>'
          : '<button class="b fina pri" data-baixar-conjunto="tudo">Baixar ' + nomeConj + '</button>')
      : '';

    const rotSecao = tipoItem === 'slide' ? 'SLIDES' : 'STORIES';
    const dica = tipoItem === 'slide' ? ' <span class="ds-leve">— o último é sempre o CTA</span>' : '';
    /* §31: envio em lote é conveniência — vários arquivos de uma vez, mas
       cada um é MAPEADO a um slide antes de subir (modal), nunca
       encaixado por ordem alfabética às cegas */
    const enviarVarios = ctx.podeEditar && d.status !== 'finalizado'
      ? '<label class="b fina contorno ds-arte-escolher">Enviar vários ' + (tipoItem === 'frame' ? 'stories' : 'slides') + '<input type="file" hidden multiple id="dv-lote"></label>' : '';
    let html = '<section class="ds-arte-secao ds-nav-slides"><div class="ds-nav-topo"><small>' + rotSecao + dica + '</small>' +
      '<div class="ds-nav-topo-acoes">' + enviarVarios + baixarTudo +
      '<button class="b fina contorno ds-nav-alternar" data-slides-modo="' + (drawer.slideModoTodos ? 'navegador' : 'todos') + '">' +
        (drawer.slideModoTodos ? 'Ver em navegador' : 'Ver todos (' + total + ')') + '</button></div></div>' + resumo;

    if (drawer.slideModoTodos) {
      html += '<div class="ds-arte-grade">' + partes.map((p, i) => {
        const a = (ctx.podeEditar && ctx.rascunhos.get(p.id)) || ctx.efetivos.get(p.id);
        const e = estados[i];
        return '<button class="ds-arte-mini st-' + e.k + '" data-slide-ir="' + i + '" aria-label="' + esc(rotuloItemNav(i, total, tipoItem)) + '">' +
          (a && ehImagem(a) ? '<span class="ds-arte-mini-img ds-thumb" data-previa="' + esc(a.caminho_thumb || a.caminho) + '"><span class="ds-thumb-esq"></span></span>'
            : '<span class="ds-arte-mini-img vazia">' + iconeTipo(d.tipo) + '</span>') +
          '<b>' + pad2(i + 1) + '</b><small>' + esc(e.t) + '</small></button>';
      }).join('') + '</div>' +
      '<div class="ds-arte-lista">' + partes.map((p, i) => itemNavHTML(p.item, i, total, tipoItem)).join('') + '</div>';
      return html + '</section>';
    }

    html += '<div class="ds-nav-pills" role="tablist" aria-label="Navegar pelos ' + rotSecao.toLowerCase() + '">' +
      partes.map((p, i) => '<button class="ds-nav-pill st-' + estados[i].k + (ctx.ajustesCliente && ctx.ajustesCliente[p.id] ? ' marcado-cliente' : '') + (i === idx ? ' on' : '') + '" data-slide-ir="' + i + '" role="tab" aria-selected="' + (i === idx) + '" ' +
        'aria-label="' + esc(rotuloItemNav(i, total, tipoItem) + ' — ' + estados[i].t) + '" title="' + esc(estados[i].t) + '">' + pad2(i + 1) + '</button>').join('') + '</div>' +
      '<div class="ds-nav-foco">' +
        '<button class="ico ds-nav-seta" data-slide-nav="-1" aria-label="anterior"' + (idx === 0 ? ' disabled' : '') + '>‹</button>' +
        '<div class="ds-nav-foco-corpo">' + painelArte(d, x, partes[idx], ctx) + itemNavHTML(partes[idx].item, idx, total, tipoItem, true) + '</div>' +
        '<button class="ico ds-nav-seta" data-slide-nav="1" aria-label="próximo"' + (idx === total - 1 ? ' disabled' : '') + '>›</button>' +
      '</div>';
    const legados = arquivosLegados();
    if (legados.length) {
      html += '<div class="ds-arte-legado"><small>ARQUIVOS ANTERIORES <span class="ds-leve">— enviados antes da estrutura por ' + (tipoItem === 'frame' ? 'story' : 'slide') + ', sem vínculo</span></small>' +
        legados.map(a => '<div class="ds-arte-legado-item"><b>' + esc(a.nome_original) + '</b><small>V' + pad2(a.versao_numero) + ' · ' + formatarTamanho(a.tamanho_bytes || 0) + '</small>' +
          (ehImagem(a) ? '<button class="b fina contorno" data-tela-cheia="' + esc(a.id) + '">Ver</button>' : '') +
          '<button class="b fina contorno" data-baixar="' + esc(a.id) + '">Baixar</button></div>').join('') + '</div>';
    }
    return html + '</section>';
  }

  function blocoArte(d, x) {
    if (!drawer.briefing) return '<section class="ds-arte-secao"><div class="ds-arte-moldura vazia"><div class="ds-arte-vazio">' + iconeTipo(d.tipo) + '<span>Carregando…</span></div></div></section>';
    return ehMultiparte() ? blocoArteMultiparte(d, x) : blocoArteUnica(d, x);
  }

  /* carrega as <img> da arte (URL assinada curta, cache por caminho);
     se o navegador não conseguir renderizar, vira card de arquivo — nunca
     ícone de imagem quebrada */
  function ligarArte(raiz, d) {
    raiz.querySelectorAll('img.ds-arte-img[data-caminho]').forEach(async img => {
      const caminho = img.dataset.caminho; if (!caminho || img.dataset.ligada) return;
      img.dataset.ligada = '1';
      const moldura = img.closest('.ds-arte-moldura');
      const falhou = () => {
        const a = arquivoPorId(img.dataset.arte);
        if (moldura && a) { moldura.classList.add('arquivo'); moldura.innerHTML = cartaoArquivo(a, d, null); ligarBaixar(moldura, d); }
      };
      img.onload = () => { if (moldura) moldura.classList.add('ok'); };
      img.onerror = falhou;
      try {
        let url = cacheUrlArte.get(caminho);
        if (!url) { url = await B7.DB.urlArquivoDesign(caminho); cacheUrlArte.set(caminho, url); }
        if (img.isConnected) img.src = url;
      } catch (e) { falhou(); }
    });
  }
  function arquivoPorId(id) { return ((drawer && drawer.extra && drawer.extra.arquivos) || []).find(a => a.id === id) || null; }
  /* parte canônica do arquivo — só faz sentido em peça multiparte; em
     arte única (inclusive Story de 1 frame) o nome de download é o da
     demanda, sem prefixo "01-" */
  function parteDoArquivo(a) {
    if (!a || !a.parte_id || !ehMultiparte()) return null;
    return (partesDaPeca() || []).find(p => p.id === a.parte_id) || null;
  }
  function ligarBaixar(raiz, d) {
    raiz.querySelectorAll('[data-baixar]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const a = arquivoPorId(b.dataset.baixar); if (a) baixarArquivo(d, a, parteDoArquivo(a), b);
    });
  }

  /* ---- TELA CHEIA (§11): ajustar, zoom +/−/reset, ‹ › entre partes,
     Esc fecha, setas navegam ---- */
  function abrirTelaCheia(d, arquivoId) {
    const ctx = contextoArte(d);
    const partes = partesDaPeca();
    /* sequência navegável: a arte mostrada de cada parte (ou só a única) */
    let seq = [];
    if (partes && partes.length > 1) {
      seq = partes.map(p => (ctx.podeEditar && ctx.rascunhos.get(p.id)) || ctx.efetivos.get(p.id)).filter(a => a && ehImagem(a));
    }
    const inicial = arquivoPorId(arquivoId);
    if (!seq.some(a => a.id === arquivoId) && inicial) seq = [inicial];
    if (!seq.length) return;
    let i = Math.max(0, seq.findIndex(a => a.id === arquivoId)); let zoom = 1;

    const el = document.createElement('div'); el.className = 'ds-lightbox'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Arte em tela cheia');
    const desenhar = () => {
      const a = seq[i]; const parte = parteDoArquivo(a);
      el.innerHTML = '<div class="ds-lb-topo">' +
          '<span class="ds-lb-tit">' + esc(parte ? rotuloItemNav(parte.posicao, (partes || []).length, parte.tipo) : (d.titulo || '')) + ' · V' + pad2(a.versao_numero || 0) + (a.largura ? ' · ' + a.largura + '×' + a.altura : '') + '</span>' +
          '<div class="ds-lb-acoes">' +
            '<button class="ico" data-lb-zoom="-1" aria-label="Diminuir">−</button><span class="ds-lb-zoom">' + Math.round(zoom * 100) + '%</span>' +
            '<button class="ico" data-lb-zoom="1" aria-label="Aumentar">+</button><button class="b fina contorno" data-lb-zoom="0">Ajustar</button>' +
            '<button class="b fina contorno" data-baixar="' + esc(a.id) + '">Baixar</button>' +
            '<button class="ico" data-lb-fechar aria-label="Fechar">✕</button></div></div>' +
        '<div class="ds-lb-corpo">' +
          (seq.length > 1 ? '<button class="ico ds-lb-seta" data-lb-nav="-1" aria-label="anterior"' + (i === 0 ? ' disabled' : '') + '>‹</button>' : '') +
          '<div class="ds-lb-area"><img class="ds-lb-img" alt="" draggable="false" style="transform:scale(' + zoom + ')"></div>' +
          (seq.length > 1 ? '<button class="ico ds-lb-seta" data-lb-nav="1" aria-label="próximo"' + (i === seq.length - 1 ? ' disabled' : '') + '>›</button>' : '') +
        '</div>' +
        (seq.length > 1 ? '<div class="ds-lb-pills">' + seq.map((s, k) => '<button class="ds-nav-pill' + (k === i ? ' on' : '') + '" data-lb-ir="' + k + '">' + pad2((parteDoArquivo(s) || { posicao: k }).posicao + 1) + '</button>').join('') + '</div>' : '');
      const img = el.querySelector('.ds-lb-img');
      const caminho = a.caminho;
      (async () => { try { let url = cacheUrlArte.get(caminho); if (!url) { url = await B7.DB.urlArquivoDesign(caminho); cacheUrlArte.set(caminho, url); } img.src = url; } catch (e) {} })();
      el.querySelectorAll('[data-lb-zoom]').forEach(b => b.onclick = () => { const z = +b.dataset.lbZoom; zoom = z === 0 ? 1 : Math.min(6, Math.max(0.25, zoom * (z > 0 ? 1.25 : 0.8))); desenhar(); });
      el.querySelectorAll('[data-lb-nav]').forEach(b => b.onclick = () => { i = Math.min(seq.length - 1, Math.max(0, i + (+b.dataset.lbNav))); zoom = 1; desenhar(); });
      el.querySelectorAll('[data-lb-ir]').forEach(b => b.onclick = () => { i = +b.dataset.lbIr; zoom = 1; desenhar(); });
      el.querySelector('[data-lb-fechar]').onclick = fechar;
      ligarBaixar(el, d);
      const area = el.querySelector('.ds-lb-area');
      area.ondblclick = () => { zoom = zoom === 1 ? 2 : 1; desenhar(); };
    };
    const tecla = e => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); fechar(); }
      else if (e.key === 'ArrowLeft' && seq.length > 1 && i > 0) { e.stopImmediatePropagation(); i--; zoom = 1; desenhar(); }
      else if (e.key === 'ArrowRight' && seq.length > 1 && i < seq.length - 1) { e.stopImmediatePropagation(); i++; zoom = 1; desenhar(); }
      else if (e.key === '+' || e.key === '=') { zoom = Math.min(6, zoom * 1.25); desenhar(); }
      else if (e.key === '-') { zoom = Math.max(0.25, zoom * 0.8); desenhar(); }
    };
    const anterior = document.activeElement;
    function fechar() {
      document.removeEventListener('keydown', tecla, true);
      el.remove(); document.body.classList.remove('ds-lb-aberta');
      if (anterior && anterior.focus && document.contains(anterior)) anterior.focus();
    }
    document.addEventListener('keydown', tecla, true);   // captura: fecha SÓ a tela cheia, nunca o workspace por trás
    el.addEventListener('mousedown', e => { if (e.target === el || e.target.classList.contains('ds-lb-area')) fechar(); });
    document.body.appendChild(el); document.body.classList.add('ds-lb-aberta');
    desenhar();
    const f = el.querySelector('[data-lb-fechar]'); if (f) f.focus();
  }

  /* ---- upload por parte (§5/§30/§42): cada slide tem seu slot; a falha
     de um não apaga o outro; "Substituir" troca só o rascunho daquela
     parte ---- */
  async function uploadParte(d, parte, arquivo) {
    drawer.uploadsParte = drawer.uploadsParte || {};
    const up = drawer.uploadsParte[parte.id] = { estado: 'enviando', progresso: 0, erro: null, nome: arquivo.name, arquivo };
    desenharDrawer();
    try {
      const versaoId = await garantirRascunho(d.id);
      const anterior = arquivosRascunho().get(parte.id);
      await B7.DB.enviarArquivoDesign({
        deliverableId: d.id, versaoId, arquivo, papel: 'preview',
        parte: { tipo: parte.tipo, id: parte.id, posicao: parte.posicao },
        aoProgredir: pct => {
          up.progresso = pct;
          const barra = drawer.el.querySelector('.ds-arte[data-parte="' + parte.id + '"] .ds-up-barra span');
          const txt = drawer.el.querySelector('.ds-arte[data-parte="' + parte.id + '"] .ds-up-barra + small');
          if (barra) barra.style.width = pct + '%';
          if (txt) txt.textContent = 'Enviando ' + arquivo.name + ' · ' + pct + '%';
        }
      });
      /* substituição: o registro antigo do rascunho sai só DEPOIS do novo
         subir com sucesso — falha no meio nunca deixa a parte sem arte */
      if (anterior) { try { await B7.DB.removerArquivoRascunhoDesign(anterior.id); } catch (e) {} }
      delete drawer.uploadsParte[parte.id];
      drawer.extra = await B7.DB.historicoDesign(d.id);
    } catch (e) {
      up.estado = 'erro'; up.erro = e.message || 'O envio foi interrompido.';
    }
    if (drawer && drawer.id === d.id) desenharDrawer();
  }

  /* ---- envio em lote com mapeamento (§31) ---- */
  function chutarParte(nome, partes, usados) {
    /* prefixo numérico no nome ("03-…", "slide 3", "IMG_3.png" não conta)
       vira sugestão; sem prefixo, a próxima parte livre na ordem */
    const m = /^(?:slide|story|frame)?[\s_-]*0*(\d{1,2})(?!\d)/i.exec(nome.trim());
    if (m) { const p = partes[+m[1] - 1]; if (p && !usados.has(p.id)) return p; }
    return partes.find(p => !usados.has(p.id)) || null;
  }
  function modalLote(d, arquivos) {
    const partes = partesDaPeca(); const nomeP = partes[0].tipo === 'frame' ? 'Story' : 'Slide';
    const usados = new Set(); const mapa = [...arquivos].map(f => { const p = chutarParte(f.name, partes, usados); if (p) usados.add(p.id); return { arquivo: f, parteId: p ? p.id : '' }; });
    const opcoes = sel => '<option value="">— não enviar —</option>' + partes.map(p => '<option value="' + esc(p.id) + '"' + (sel === p.id ? ' selected' : '') + '>' + nomeP + ' ' + pad2(p.posicao + 1) + (p.rotulo ? ' · ' + esc(p.rotulo.slice(0, 28)) : '') + '</option>').join('');
    const m = B7.UI.modal('<h3>Enviar vários ' + nomeP.toLowerCase() + 's</h3>' +
      '<div class="sub">Confira a que ' + nomeP.toLowerCase() + ' cada arquivo pertence antes de enviar. A sugestão vem do número no nome do arquivo; sem número, segue a ordem.</div>' +
      '<div class="ds-lote">' + mapa.map((x, i) => '<div class="ds-lote-item"><b>' + esc(x.arquivo.name) + '</b><small>' + formatarTamanho(x.arquivo.size) + '</small>' +
        '<select class="campo fina" data-lote="' + i + '">' + opcoes(x.parteId) + '</select></div>').join('') + '</div>' +
      '<p class="ds-up-erro" id="ds-lote-erro" hidden></p>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" data-ok>Enviar</button></div>', { larga: true });
    m.querySelectorAll('[data-lote]').forEach(sel => sel.onchange = () => { mapa[+sel.dataset.lote].parteId = sel.value; });
    m.querySelector('[data-ok]').onclick = async () => {
      const escolhidos = mapa.filter(x => x.parteId);
      const erro = m.querySelector('#ds-lote-erro');
      const vistos = new Set(); const dup = escolhidos.find(x => vistos.has(x.parteId) || !vistos.add(x.parteId));
      if (!escolhidos.length) { erro.textContent = 'Escolha ao menos um ' + nomeP.toLowerCase() + '.'; erro.hidden = false; return; }
      if (dup) { erro.textContent = 'Dois arquivos apontam para o mesmo ' + nomeP.toLowerCase() + ' — ajuste antes de enviar.'; erro.hidden = false; return; }
      m.fechar();
      /* um de cada vez, na ordem canônica — falha de um não derruba os outros (uploadParte já trata) */
      escolhidos.sort((a, b) => partes.findIndex(p => p.id === a.parteId) - partes.findIndex(p => p.id === b.parteId));
      for (const x of escolhidos) {
        const parte = partes.find(p => p.id === x.parteId);
        if (parte && drawer && drawer.id === d.id) await uploadParte(d, parte, x.arquivo);
      }
    };
  }

  /* =================================================================
     DECISÃO DO CLIENTE registrada pela B7 (WhatsApp, ligação, reunião…)
     — mesma linha de `aprovacoes` que o Portal usa; só a procedência
     muda. O ator é quem REGISTRA (pessoa da B7), nunca o cliente.
     ================================================================= */
  const CANAIS_DECISAO = [['whatsapp', 'WhatsApp'], ['ligacao', 'Ligação'], ['reuniao', 'Reunião'], ['presencial', 'Presencial'], ['outro', 'Outro']];
  function rotuloCanal(c) { const x = CANAIS_DECISAO.find(k => k[0] === c); return x ? x[1] : (c === 'portal' ? 'Portal do Cliente' : (c || '')); }
  function podeRegistrarDecisaoCliente(d) {
    return !!d.client_id && (d.status === 'aprovado_interno' || d.status === 'aguardando_cliente');
  }
  function resumoAjustesCliente() {
    const m = drawer && drawer.ajustesCliente || {}; const n = Object.keys(m).length;
    if (!n) return '';
    const partes = partesDaPeca() || [];
    const nomes = partes.filter(p => m[p.id]).map(p => pad2(p.posicao + 1));
    const nomeP = partes[0] && partes[0].tipo === 'frame' ? 'story' : 'slide';
    return n + ' ' + nomeP + (n > 1 ? 's' : '') + ' (' + nomes.join(', ') + ')';
  }
  async function marcarAjusteCliente(d, parteId) {
    const parte = (partesDaPeca() || []).find(p => p.id === parteId); if (!parte) return;
    const nomeP = parte.tipo === 'frame' ? 'story' : 'slide';
    drawer.ajustesCliente = drawer.ajustesCliente || {};
    const msg = await B7.UI.perguntar({ titulo: 'Ajuste do cliente no ' + nomeP + ' ' + pad2(parte.posicao + 1),
      rotulo: 'O que o cliente pediu neste ' + nomeP + '? Fica marcado aqui até você enviar tudo junto ao designer.',
      valor: drawer.ajustesCliente[parteId] || '', placeholder: 'ex.: Produto precisa ficar maior.', confirmar: 'Marcar' });
    if (msg === null) return;
    if (!msg.trim()) { delete drawer.ajustesCliente[parteId]; } else drawer.ajustesCliente[parteId] = msg.trim();
    desenharDrawer();
  }

  /* linha da decisão do cliente na lateral — a verdade de como aconteceu:
     "Aprovado pelo cliente · Via WhatsApp · Registrado por Ana" ou
     "Via Portal do Cliente · Aprovado por <cliente>"; anulação aparece
     por cima, sem apagar a decisão original */
  function rotuloSituacaoCliente(a) {
    const anulada = a.anulada_em && (!a.decidido_em || a.decidido_em <= a.anulada_em);
    const sit = anulada ? a.situacao_anterior : a.situacao;
    const R = { aprovado: 'Aprovado pelo cliente', ajustes: 'Cliente solicitou ajustes', recusado: 'Recusado pelo cliente',
                pendente: 'Aguardando cliente', parcial: 'Parcialmente revisado', substituido: 'Substituída por versão mais nova' };
    return { texto: R[sit] || sit, anulada, sit };
  }
  function blocoDecisaoCliente(d, x) {
    const lista = (x.aprovacoes || []).slice();
    const atual = lista[0] || null;
    const equipe = ehEquipe();
    if (!d.client_id) return '';
    if (!lista.length && !podeRegistrarDecisaoCliente(d) && d.status !== 'aprovado_cliente' && d.status !== 'ajustes_cliente') return '';
    const item = a => {
      const r = rotuloSituacaoCliente(a);
      const externa = a.origem_decisao === 'externa';
      const decidida = ['aprovado', 'ajustes', 'recusado'].includes(r.sit);
      return '<div class="ds-dc-item ds-dc-' + esc(r.sit) + (r.anulada ? ' anulada' : '') + '">' +
        '<b>' + esc(r.texto) + '</b><small>Envio ' + a.versao + (a.snapshot && a.snapshot.numero ? ' · arte V' + pad2(a.snapshot.numero) : '') + '</small>' +
        (decidida ? '<span>' + (externa ? 'Via ' + esc(rotuloCanal(a.canal_decisao)) + ' · registrado por ' + esc(a.registrado_por_nome || a.decidido_por_nome || 'equipe')
                                          : 'Via Portal do Cliente · ' + esc(a.decidido_por_nome || 'cliente')) +
                     ' · ' + esc(B7.UI.quando(a.decidido_em)) + '</span>' : '') +
        (a.observacao_decisao ? '<p>“' + esc(a.observacao_decisao) + '”</p>' : (a.motivo && r.sit !== 'aprovado' ? '<p>' + esc(a.motivo) + '</p>' : '')) +
        (r.anulada ? '<span class="ds-dc-anulada">Anulada por ' + esc(a.anulada_por_nome || 'Administrador') + ' · ' + esc(B7.UI.quando(a.anulada_em)) +
                     (a.anulacao_motivo ? ' · “' + esc(a.anulacao_motivo) + '”' : '') + ' · voltou a aguardar o cliente</span>' : '') +
        (equipe && decidida && !r.anulada && a.versao === (lista[0] && lista[0].versao) ? '<button class="b fina" data-ir-aprovacao="' + esc(a.id) + '">Ver nas Aprovações</button>' : '') +
      '</div>';
    };
    const cabecalho = d.status === 'aprovado_cliente' ? 'Aprovado pelo cliente'
      : d.status === 'ajustes_cliente' ? (atual && atual.situacao === 'recusado' ? 'Recusado pelo cliente' : 'Cliente solicitou ajustes')
      : d.status === 'aguardando_cliente' ? 'Aguardando cliente'
      : d.status === 'aprovado_interno' ? 'Sem decisão ainda' : null;
    return '<div class="ds-dr-bloco ds-dc"><h4>Decisão do cliente' +
      (cabecalho ? ' <span class="ds-dc-status st-' + esc(d.status) + '">' + esc(cabecalho) + '</span>' : '') + '</h4>' +
      (lista.length ? lista.map(item).join('') : '<p class="ds-dc-vazio">O cliente ainda não decidiu. Quando decidir — pelo Portal ou por fora (WhatsApp, ligação…) — use “Registrar decisão do cliente” acima.</p>') +
    '</div>';
  }

  /* modal "Registrar decisão do cliente" — o que o cliente decidiu, por
     onde, e (opcional) o que disse. Nada de conta do cliente, nada de
     sessão: quem registra é quem está logado (Admin/Coordenador). */
  function modalDecisaoCliente(d) {
    const partes = partesDaPeca() || []; const multi = partes.length > 1;
    const marcados = partes.filter(p => drawer.ajustesCliente && drawer.ajustesCliente[p.id]);
    const nomeP = partes[0] && partes[0].tipo === 'frame' ? 'story' : 'slide';
    const decisaoInicial = marcados.length ? 'ajustes' : 'aprovado';
    const m = B7.UI.modal('<h3>Registrar decisão do cliente</h3>' +
      '<div class="sub">Use quando a decisão aconteceu fora do sistema (WhatsApp, ligação…). O histórico vai mostrar que foi você quem registrou, em nome do cliente — nunca que o cliente entrou no Portal.</div>' +
      '<div class="ds-dc-opcoes" role="radiogroup">' +
        [['aprovado', 'Aprovado pelo cliente', 'A arte atual (' + (d.versao_atual ? 'V' + pad2(d.versao_atual) : 'versão atual') + ') fica aprovada pelo cliente.'],
         ['ajustes', 'Cliente solicitou ajustes', multi ? (marcados.length ? marcados.length + ' ' + nomeP + (marcados.length > 1 ? 's' : '') + ' marcado' + (marcados.length > 1 ? 's' : '') + ': ' + marcados.map(p => pad2(p.posicao + 1)).join(', ') : 'Marque os ' + nomeP + 's na área principal, ou descreva abaixo.') : 'Descreva abaixo o que o cliente pediu.'],
         ['recusado', 'Recusado pelo cliente', 'Mais forte que ajustes — exige o motivo do cliente.'],
         ['enviado', 'Só marcar como enviado ao cliente', 'A peça fica “Aguardando cliente” até a decisão chegar.']]
        .filter(o => o[0] !== 'enviado' || d.status === 'aprovado_interno')
        .map(o => '<label class="ds-dc-opcao"><input type="radio" name="dc-decisao" value="' + o[0] + '"' + (o[0] === decisaoInicial ? ' checked' : '') + '><span><b>' + o[1] + '</b><small>' + esc(o[2]) + '</small></span></label>').join('') +
      '</div>' +
      '<label class="rot" for="dc-canal">CANAL</label>' +
      '<select class="campo fina" id="dc-canal">' + CANAIS_DECISAO.map(c => '<option value="' + c[0] + '">' + c[1] + '</option>').join('') + '</select>' +
      '<label class="rot" for="dc-obs" id="dc-obs-rot">OBSERVAÇÃO <span class="ds-leve">— opcional</span></label>' +
      '<textarea class="campo" id="dc-obs" rows="3" placeholder="ex.: Cliente aprovou pelo grupo do WhatsApp."></textarea>' +
      '<p class="ds-up-erro" id="dc-erro" hidden></p>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" data-ok>Registrar</button></div>', { larga: false });
    const atualizarRotulo = () => {
      const v = m.querySelector('input[name="dc-decisao"]:checked').value;
      const rot = m.querySelector('#dc-obs-rot'); const ta = m.querySelector('#dc-obs');
      if (v === 'recusado') { rot.innerHTML = 'MOTIVO DO CLIENTE <span class="ds-leve">— obrigatório</span>'; ta.placeholder = 'ex.: Cliente não aprovou a linha visual desta campanha.'; }
      else if (v === 'ajustes') { rot.innerHTML = (multi && marcados.length ? 'OBSERVAÇÃO GERAL <span class="ds-leve">— opcional</span>' : 'O QUE O CLIENTE PEDIU <span class="ds-leve">— obrigatório</span>'); ta.placeholder = 'ex.: Aumentar o título e trocar a foto.'; }
      else { rot.innerHTML = 'OBSERVAÇÃO <span class="ds-leve">— opcional</span>'; ta.placeholder = 'ex.: Cliente aprovou pelo grupo do WhatsApp.'; }
    };
    m.querySelectorAll('input[name="dc-decisao"]').forEach(r => r.onchange = atualizarRotulo); atualizarRotulo();
    m.querySelector('[data-ok]').onclick = async () => {
      const decisao = m.querySelector('input[name="dc-decisao"]:checked').value;
      const canal = m.querySelector('#dc-canal').value; const obs = m.querySelector('#dc-obs').value.trim();
      const erro = m.querySelector('#dc-erro'); erro.hidden = true;
      if (decisao === 'recusado' && !obs) { erro.textContent = 'Recusar exige o motivo do cliente.'; erro.hidden = false; return; }
      if (decisao === 'ajustes' && !obs && !marcados.length) { erro.textContent = multi ? 'Marque os ' + nomeP + 's com ajuste ou descreva o pedido.' : 'Descreva o que o cliente pediu.'; erro.hidden = false; return; }
      if (decisao === 'aprovado' && marcados.length) { erro.textContent = 'Há ' + nomeP + 's marcados com ajuste do cliente — remova as marcações ou registre como ajustes.'; erro.hidden = false; return; }
      const partesEnvio = decisao === 'ajustes' ? marcados.map(p => ({ parte_id: p.id, mensagem: drawer.ajustesCliente[p.id] })) : [];
      const btn = m.querySelector('[data-ok]'); btn.disabled = true; btn.textContent = 'Registrando…';
      try {
        const r = await B7.DB.registrarDecisaoClienteDesign(d.id, decisao, canal, obs, partesEnvio);
        m.fechar();
        drawer.ajustesCliente = {};
        const novo = await B7.DB.design(d.id); Object.assign(d, novo);
        drawer.extra = await B7.DB.historicoDesign(d.id);
        B7.UI.toast(r && r.resultado === 'inalterado' ? 'Essa decisão já estava registrada' :
          decisao === 'aprovado' ? 'Aprovação do cliente registrada' : decisao === 'ajustes' ? 'Ajustes do cliente enviados ao designer' :
          decisao === 'recusado' ? 'Recusa do cliente registrada' : 'Marcada como enviada ao cliente');
        desenharDrawer(); redesenharTela();
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Registrar';
        erro.textContent = 'Não foi possível registrar: ' + (e.message || ''); erro.hidden = false;
      }
    };
  }

  /* ---- decisão por parte (§21/§46/§47): só a ação formal muda o
     estado; idempotente (o servidor grava o mesmo valor de novo) ---- */
  async function decidirParte(d, arquivoId, decisao, botao) {
    let msg = null;
    const a = arquivoPorId(arquivoId); const parte = parteDoArquivo(a);
    if (decisao === 'ajuste') {
      msg = await B7.UI.perguntar({ titulo: parte ? 'Solicitar ajuste no ' + (parte.tipo === 'frame' ? 'story' : 'slide') + ' ' + pad2(parte.posicao + 1) : 'Solicitar ajuste',
        rotulo: 'Descreva o que precisa mudar' + (parte ? ' neste ' + (parte.tipo === 'frame' ? 'story' : 'slide') : '') + ' — o designer vê esta mensagem.',
        valor: (a && a.revisao_mensagem) || '', placeholder: 'ex.: Aumentar o produto e dar mais destaque ao preço…', confirmar: 'Registrar ajuste' });
      if (msg === null) return;
      if (!msg.trim()) { B7.UI.toast('Descreva o ajuste.', { tipo: 'erro' }); return; }
    }
    if (botao) botao.disabled = true;
    try {
      await B7.DB.revisarParteDesign(arquivoId, decisao, msg ? msg.trim() : null);
      drawer.extra = await B7.DB.historicoDesign(d.id);
      await carregarNomesRevisores();
      desenharDrawer();
    } catch (e) {
      if (botao) botao.disabled = false;
      B7.UI.toast('Não foi possível registrar: ' + (e.message || ''), { tipo: 'erro' });
    }
  }

  /* resumo das decisões por parte — decide o que a lateral oferece
     (Aprovar carrossel × Enviar ajustes ao Designer) */
  function resumoDecisoes(d) {
    const partes = partesDaPeca() || []; const efet = arquivosEfetivos();
    const lista = partes.map(p => efet.get(p.id));
    return {
      total: partes.length,
      semArquivo: lista.filter(a => !a).length,
      aprovados: lista.filter(a => a && a.revisao === 'aprovado').length,
      ajustes: lista.filter(a => a && a.revisao === 'ajuste').length,
      pendentes: lista.filter(a => a && !a.revisao).length
    };
  }

  /* ajuste pedido em destaque no topo do conteúdo principal — a peça
     está em "Ajustes"/"Ajustes do cliente" porque alguém escreveu o
     que precisa mudar; isso não pode ficar perdido no meio da linha
     do tempo, lá embaixo */
  function feedbackAjuste(d, x) {
    if (d.status !== 'ajustes' && d.status !== 'ajustes_cliente') return '';
    const notifs = (x.notificacoes || []).slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const n = notifs.find(n => n.mensagem && n.mensagem.trim());
    if (!n) return '';
    return '<div class="ds-ws-feedback' + (d.status === 'ajustes_cliente' ? ' cliente' : '') + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
        '<path d="M10.3 3.9L2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>' +
      '<div><b>' + (d.status === 'ajustes_cliente' ? 'Ajuste do cliente' : 'Ajuste solicitado') + '</b>' +
      '<p>' + esc(n.mensagem.trim()) + '</p></div></div>';
  }

  /* conteúdo principal do workspace — cada formato real (Card, Reel,
     Carrossel, Story) tem tratamento próprio: Card e Reel destacam o
     campo mais importante (Rodada 3); Carrossel e Story ganham o
     navegador de slide/story (Rodada 4). Só a peça manual (sem
     conteúdo canônico) continua no briefing genérico. */
  function conteudoPrincipal(d) {
    const b = drawer.briefing;
    if (!b) return '<p class="vazio-leve">Carregando…</p>';
    if (b.erro) return '<p class="vazio-leve">Não foi possível carregar o briefing.</p>';
    if (!b.manual && b.conteudo.tipo === 'Card') return blocoPrincipalCard(b);
    if (!b.manual && b.conteudo.tipo === 'Reel') return blocoPrincipalReel(b);
    if (!b.manual && b.conteudo.tipo === 'Carrossel') return blocoPrincipalCarrossel(b);
    if (!b.manual && b.conteudo.tipo === 'Story') return blocoPrincipalStory(b);
    return blocoBriefing(d);
  }

  function pilarBriefingHTML(b) {
    return b.pilar ? '<div class="ds-campo-briefing"><small>PILAR</small><p>' + esc(b.pilar.nome || 'Pilar sem nome') + '</p></div>' : '';
  }
  function referenciasBriefingHTML(c) {
    const links = String(c.referencias || '').split('\n').map(l => l.trim()).filter(Boolean);
    if (!links.length) return '';
    return '<div class="ds-campo-briefing"><small>REFERÊNCIAS</small>' + links.map(l =>
      /^https?:\/\//i.test(l) ? '<a class="kd-link" href="' + esc(l) + '" target="_blank" rel="noopener noreferrer">' + esc(l) + '</a>'
                              : '<span class="kd-link">' + esc(l) + '</span>').join('') + '</div>';
  }

  function blocoPrincipalCard(b) {
    const c = b.conteudo;
    const campo = (rot, val) => val ? '<div class="ds-campo-briefing"><small>' + rot + '</small><p>' + esc(val) + '</p></div>' : '';
    return (vazio(c.headline) ? '' : '<div class="ds-ws-campo-principal"><small>HEADLINE</small><p>' + esc(c.headline) + '</p></div>') +
      campo('OBJETIVO', c.objetivo) + pilarBriefingHTML(b) +
      campo('SUB-HEADLINE', c.sub_headline) + campo('CTA', c.cta) +
      campo('DIREÇÃO VISUAL', c.direcao) + campo('LEGENDA', c.legenda) +
      campo('OBSERVAÇÃO PARA O DESIGN', c.observacao_design) + referenciasBriefingHTML(c);
  }

  function blocoPrincipalReel(b) {
    const c = b.conteudo;
    const campo = (rot, val) => val ? '<div class="ds-campo-briefing"><small>' + rot + '</small><p>' + esc(val) + '</p></div>' : '';
    return (vazio(c.titulo) ? '' : '<div class="ds-ws-campo-principal"><small>IDENTIFICAÇÃO DO REEL</small><p>' + esc(c.titulo) + '</p></div>') +
      campo('CONTEXTO', c.objetivo || c.ideia_geral) + pilarBriefingHTML(b) +
      (b.roteiro
        ? '<div class="ds-ws-roteiro-cta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
            '<path d="M6 4h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M9 13h6M9 17h4"/></svg>' +
          '<span>Roteiro vinculado — <b>' + esc(b.roteiro.titulo || 'roteiro') + '</b></span>' +
          '<button class="b fina contorno" data-abrir-roteiro>Ver roteiro</button></div>'
        : '') +
      referenciasBriefingHTML(c);
  }

  /* "Ver roteiro" — antes fechava o workspace e navegava para o editor
     completo da Gravação (que edita, não só mostra). Agora abre a
     mesma ficha usada no PDF/impressão (B7.Folha.folhaHTML), num modal
     só de leitura, sem sair do workspace e sem nenhum controle de
     edição — o roteiro continua só sendo editado na Gravação. */
  async function verRoteiro(roteiro, d) {
    if (!roteiro) return;
    let gravacao = null, cenas = [];
    try {
      [gravacao, cenas] = await Promise.all([
        B7.DB.gravacao(roteiro.recording_session_id).catch(() => null),
        B7.DB.listarCenas(roteiro.id).catch(() => [])
      ]);
    } catch (e) {}
    const html = '<h3>' + esc(roteiro.titulo || 'Roteiro vinculado') + '</h3>' +
      '<p class="sub">Somente leitura — o roteiro é editado na Gravação, não aqui.</p>' +
      '<div class="corpo ds-roteiro-corpo" id="dv-roteiro-corpo">' + B7.Folha.folhaHTML({
        cliente: d.cliente_nome || '', clienteLogo: d.cliente_logo_url || null,
        gravacao: gravacao ? gravacao.nome : '',
        dataGravacao: gravacao && gravacao.data_gravacao ? B7.UI.dataBR(gravacao.data_gravacao) : '',
        roteiro, cenas, indice: 0, total: 1
      }) + '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>';
    const m = B7.UI.modal(html, { larga: true, extra: 'ds-roteiro-modal' });
    const corpo = m.querySelector('#dv-roteiro-corpo');
    const folha = corpo && corpo.querySelector('.folha');
    if (!folha) return;
    if (roteiro.escala_automatica !== false) B7.Folha.ajustar(folha);
    requestAnimationFrame(() => {
      const escala = Math.min(1, (corpo.clientWidth - 4) / 794);
      folha.style.transformOrigin = 'top left';
      folha.style.transform = 'scale(' + escala + ')';
      corpo.style.height = Math.round(folha.scrollHeight * escala + 8) + 'px';
    });
  }

  function desenharDrawer() {
    const d = dados.find(x => x.id === drawer.id);
    if (!d) return fecharDrawer();
    const x = drawer.extra || { versoes: [], notificacoes: [] };
    const versoes = x.versoes || [];
    const versaoAtual = versoes[0] || null;   // maior número = mais recente
    /* nenhuma versão enviada ainda = o designer não chegou a produzir
       nada nesta peça (mesmo já em "Em criação", com responsável
       atribuído) — é exatamente o caso de "o designer não teve tempo,
       upa por ele": aqui o envio em nome do designer não é uma
       exceção rara, é o caminho normal, então fica ABERTO por padrão
       em vez de recolhido (ver blocoUpload/recolhido logo abaixo). */
    const nenhumaVersaoEnviada = !versoes.some(v => v.estado !== 'rascunho');
    drawer.versaoAtualId = versaoAtual ? versaoAtual.id : null;

    const souResponsavel = d.designer_id === meuId();
    const equipe = ehEquipe();
    const podeEditar = equipe || souResponsavel;
    const podeAssumir = ehDesigner() && !d.designer_id;
    /* "compartilhar": um designer que já tem outra peça nesta MESMA
       linha pode atribuir uma peça ainda sem dono a um colega — só
       vale a pena mostrar quando há pra quem compartilhar */
    const podeCompartilhar = ehDesigner() && !d.designer_id && !!d.linha_id &&
      dados.some(x => x.linha_id === d.linha_id && x.designer_id === meuId()) &&
      designers.some(p => p.id !== meuId());
    const info = prazoInfo(d);
    const acao = acaoPrimaria(d, versaoAtual, souResponsavel, equipe, podeAssumir);

    const raiz = drawer.el.querySelector('.ds-ws');
    raiz.innerHTML =
      '<header class="ds-ws-topo">' +
        '<button class="ico ds-ws-voltar" data-fechar aria-label="Fechar">←</button>' +
        '<div class="ds-ws-topo-tx">' +
          '<div class="ds-ws-topo-linha1">' +
            '<span class="ds-tipo">' + esc(rotuloTipo(d.tipo)) + '</span>' +
            '<span class="ds-chip ' + esc(d.status) + '">' + esc(rotuloStatus(d.status)) + '</span>' +
          '</div>' +
          '<h3>' + esc(d.titulo || d.conteudo_titulo || 'Sem título') + '</h3>' +
          '<div class="ds-ws-topo-meta">' +
            (d.cliente_nome ? '<span>' + esc(d.cliente_nome) + '</span>' : '<span>Demanda interna</span>') +
            (d.linha_nome ? '<span>· ' + esc(d.linha_nome) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<button class="ico" data-fechar aria-label="Fechar">✕</button>' +
      '</header>' +
      '<div class="ds-ws-corpo">' +
        '<div class="ds-ws-principal" role="tabpanel">' +
          feedbackAjuste(d, x) +
          blocoArte(d, x) +
          conteudoPrincipal(d) +
        '</div>' +
        '<div class="ds-ws-lateral">' +
          acaoPrimariaHTML(acao) +
          (podeCompartilhar ? '<div class="ds-dr-compartilhar">' +
              '<small>OU ATRIBUIR A UM COLEGA DESTA LINHA</small>' +
              '<div class="ds-dr-compartilhar-linha">' +
                '<select class="campo fina" id="dv-colega"><option value="">Escolher designer…</option>' +
                  designers.filter(p => p.id !== meuId()).map(p => '<option value="' + esc(p.id) + '">' + esc(p.nome) + '</option>').join('') +
                '</select>' +
                '<button class="b fina contorno" id="dv-compartilhar">Compartilhar</button>' +
              '</div></div>' : '') +
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
          blocoDecisaoCliente(d, x) +

          /* o designer responsável (ou equipe sem designer atribuído) tem o
             envio à mão; quem só revisa vê o envio recolhido, como exceção */
          (podeEditar && d.status !== 'finalizado' ? blocoUpload(d, equipe && !souResponsavel && !!d.designer_id && !nenhumaVersaoEnviada,
            equipe && !souResponsavel && !!d.designer_id && nenhumaVersaoEnviada) : '') +

          '<details class="ds-dr-bloco ds-dr-recolhido"' + (drawer.versoesAberto || !ehMultiparte() ? ' open' : '') + ' id="dv-versoes"><summary>Histórico de versões</summary>' + blocoVersoes(versoes) + '</details>' +
          '<details class="ds-dr-bloco ds-dr-recolhido"' + (drawer.timelineAberta ? ' open' : '') + ' id="dv-timeline"><summary>Linha do tempo</summary>' + blocoTimeline(x.notificacoes || []) + '</details>' +
        '</div>' +
      '</div>';

    ligarDrawer(d, x, versaoAtual);
    ligarThumbs(drawer.el);
    ligarArte(drawer.el, d);
  }

  /* ---------------------------------------------------------- briefing
     Só sobra pra peça MANUAL (sem conteúdo canônico — nada de Linha
     Editorial por trás, só a descrição digitada na criação da peça).
     Card, Reel, Carrossel e Story têm workspace dedicado — ver
     conteudoPrincipal(). O `return` final é só uma rede de segurança
     para um tipo desconhecido, que não deveria acontecer (FORMATOS só
     tem os quatro). */
  function blocoBriefing(d) {
    const b = drawer.briefing;
    if (!b) return '<p class="vazio-leve">Carregando…</p>';
    if (b.erro) return '<p class="vazio-leve">Não foi possível carregar o briefing.</p>';
    if (b.manual) {
      return b.descricao
        ? '<p class="ds-briefing-texto">' + esc(b.descricao) + '</p>'
        : '<p class="vazio-leve">Sem descrição.</p>';
    }
    return '<p class="vazio-leve">Formato não reconhecido.</p>';
  }

  /* --------------------------------------------------- navegador de
     slide/story (Rodada 4)
     Troca a lista empilhada por um navegador: pills numeradas (01, 02,
     03…) com o item atual em destaque, setas ‹/› pra andar um de cada
     vez, e "Ver todos (N)" pra abrir a sequência inteira empilhada de
     novo — sem perder a leitura de ponta a ponta pra quem prefere
     rolar. Puramente leitura: nenhum input/textarea aqui, igual sempre
     foi neste workspace (Designer nunca edita a Linha Editorial por
     aqui). O estado (item atual / modo) vive em `drawer`, junto do
     resto do estado da peça aberta — reseta sozinho ao trocar de peça,
     porque `drawer` é recriado do zero em abrirDetalhe(). */

  /* Slide 1 = capa, último = CTA — sempre calculado pela posição, nunca
     um campo gravado no banco. Mesma regra de js/linha.js:rotuloSlide,
     só que Story nunca teve essa rotulagem (não tem capa/CTA). */
  function rotuloItemNav(i, total, tipoItem) {
    if (tipoItem !== 'slide') return 'STORY ' + String(i + 1).padStart(2, '0');
    const primeiro = i === 0, ultimo = i === total - 1, unico = total === 1;
    let rot = 'SLIDE ' + String(i + 1).padStart(2, '0');
    if (unico) rot += ' · CAPA · CTA'; else if (primeiro) rot += ' · CAPA'; else if (ultimo) rot += ' · CTA';
    return rot;
  }

  function itemNavHTML(it, i, total, tipoItem, destaque) {
    const rot = rotuloItemNav(i, total, tipoItem);
    const corpo = tipoItem === 'slide'
      ? ((it.titulo ? '<p class="ds-slide-tit">' + esc(it.titulo) + '</p>' : '') +
         (it.texto ? '<p>' + esc(it.texto) + '</p>' : '') +
         (!it.titulo && !it.texto ? '<p class="vazio-leve">Sem conteúdo.</p>' : ''))
      : ((it.texto ? '<p>' + esc(it.texto) + '</p>' : '') +
         (it.direcao_visual ? '<p class="ds-leve">' + esc(it.direcao_visual) + '</p>' : '') +
         (!it.texto && !it.direcao_visual ? '<p class="vazio-leve">Sem conteúdo.</p>' : ''));
    return '<div class="ds-slide' + (destaque ? ' ds-slide-foco' : '') + '"><b>' + rot + '</b>' + corpo + '</div>';
  }

  function navegadorSlides(itens, tipoItem) {
    const rotSecao = tipoItem === 'slide' ? 'SLIDES' : 'STORIES';
    const dica = tipoItem === 'slide' ? ' <span class="ds-leve">— o último é sempre o CTA</span>' : '';
    if (!itens.length) {
      return '<div class="ds-campo-briefing"><small>' + rotSecao + dica + '</small>' +
        '<p class="vazio-leve">Nenhum ' + (tipoItem === 'slide' ? 'slide' : 'story') + ' cadastrado.</p></div>';
    }
    const total = itens.length;
    const idx = Math.min(Math.max(drawer.slideIndice || 0, 0), total - 1);
    drawer.slideIndice = idx;   // corrige sozinho se a peça mudou e ficou com menos itens

    if (drawer.slideModoTodos) {
      return '<div class="ds-campo-briefing"><small>' + rotSecao + dica + '</small>' +
        (total > 1 ? '<button class="b fina contorno ds-nav-alternar" data-slides-modo="navegador">Ver em navegador</button>' : '') +
        itens.map((it, i) => itemNavHTML(it, i, total, tipoItem)).join('') + '</div>';
    }

    const nomeItem = tipoItem === 'slide' ? 'slide' : 'story';
    return '<div class="ds-campo-briefing ds-nav-slides"><div class="ds-nav-topo"><small>' + rotSecao + dica + '</small>' +
      (total > 1 ? '<button class="b fina contorno ds-nav-alternar" data-slides-modo="todos">Ver todos (' + total + ')</button>' : '') +
      '</div>' +
      (total > 1 ? '<div class="ds-nav-pills" role="tablist" aria-label="Navegar pelos ' + rotSecao.toLowerCase() + '">' +
        itens.map((it, i) => '<button class="ds-nav-pill' + (i === idx ? ' on' : '') + '" data-slide-ir="' + i + '" ' +
          'role="tab" aria-selected="' + (i === idx) + '" aria-label="' + esc(rotuloItemNav(i, total, tipoItem)) + '">' +
          String(i + 1).padStart(2, '0') + '</button>').join('') + '</div>' : '') +
      '<div class="ds-nav-foco">' +
        (total > 1 ? '<button class="ico ds-nav-seta" data-slide-nav="-1" aria-label="' + nomeItem + ' anterior"' + (idx === 0 ? ' disabled' : '') + '>‹</button>' : '') +
        itemNavHTML(itens[idx], idx, total, tipoItem, true) +
        (total > 1 ? '<button class="ico ds-nav-seta" data-slide-nav="1" aria-label="próximo ' + nomeItem + '"' + (idx === total - 1 ? ' disabled' : '') + '>›</button>' : '') +
      '</div></div>';
  }

  /* itens de slide/story da peça atualmente aberta — usado pelas setas
     de navegação por teclado, que não têm o array à mão diretamente */
  function itensNavAtuais() {
    const b = drawer && drawer.briefing;
    if (!b || b.manual || !b.conteudo) return { itens: [], tipoItem: null };
    if (b.conteudo.tipo === 'Carrossel') return { itens: b.slides || [], tipoItem: 'slide' };
    if (b.conteudo.tipo === 'Story') return { itens: b.frames || [], tipoItem: 'frame' };
    return { itens: [], tipoItem: null };
  }

  function moverSlide(delta) {
    const { itens } = itensNavAtuais();
    if (!itens.length || drawer.slideModoTodos) return;
    const atual = Math.min(Math.max(drawer.slideIndice || 0, 0), itens.length - 1);
    const novo = Math.min(Math.max(atual + delta, 0), itens.length - 1);
    if (novo === atual) return;
    drawer.slideIndice = novo;
    desenharDrawer();
    const pill = drawer.el.querySelector('.ds-nav-pill.on');
    if (pill) pill.focus(); else { const foco = drawer.el.querySelector('.ds-nav-seta:not([disabled])'); if (foco) foco.focus(); }
  }

  /* Arquivos 2.0: quando a peça é multiparte, o navegador de slides
     (pills + item atual) já vive dentro do bloco de ARTE — a arte de
     cada slide e o briefing daquele slide andam juntos. Aqui só sobra o
     que é da peça inteira (legenda/CTA/referências). navegadorSlides()
     continua servindo o caso sem arte por parte (ex.: Story de 1 frame
     cai em blocoArteUnica; um Carrossel sem slide cadastrado). */
  function blocoPrincipalCarrossel(b) {
    const c = b.conteudo;
    const campo = (rot, val) => val ? '<div class="ds-campo-briefing"><small>' + rot + '</small><p>' + esc(val) + '</p></div>' : '';
    return pilarBriefingHTML(b) + (ehMultiparte() ? '' : navegadorSlides(b.slides || [], 'slide')) +
      campo('LEGENDA', c.legenda) + referenciasBriefingHTML(c);
  }

  function blocoPrincipalStory(b) {
    const c = b.conteudo;
    const campo = (rot, val) => val ? '<div class="ds-campo-briefing"><small>' + rot + '</small><p>' + esc(val) + '</p></div>' : '';
    return pilarBriefingHTML(b) + (ehMultiparte() ? '' : navegadorSlides(b.frames || [], 'frame')) +
      campo('CTA', c.cta) + referenciasBriefingHTML(c);
  }

  /* ---------------------------------------------------------- upload */
  /* Upload é uma forma de mandar para revisão, não a única: a arte pode
     ter sido revisada e aprovada por fora (WhatsApp, e-mail…) — nesse
     caso não existe arquivo nenhum para anexar, e forçar um upload
     symbolic só pra "cumprir tabela" seria mentir sobre o que aconteceu.
     A via externa registra isso honestamente: sem arquivo, com uma
     anotação opcional de canal, e segue o mesmo ciclo de revisão. */
  const CANAIS_EXTERNOS = ['WhatsApp', 'E-mail', 'Reunião', 'Outro'];

  function blocoUpload(d, recolhido, semNadaAinda) {
    if (drawer.viaExterna === undefined) drawer.viaExterna = false;
    const corpo = '<div class="ds-via-toggle" role="tablist">' +
        '<button role="tab" data-via="upload" class="' + (!drawer.viaExterna ? 'on' : '') + '" aria-selected="' + !drawer.viaExterna + '">Enviar arquivo</button>' +
        '<button role="tab" data-via="externa" class="' + (drawer.viaExterna ? 'on' : '') + '" aria-selected="' + !!drawer.viaExterna + '">Revisada por fora (sem arquivo)</button>' +
      '</div>' +
      '<div id="dv-bloco-envio">' + (drawer.viaExterna ? blocoEnvioExterno() : blocoEnvioUpload(d)) + '</div>';
    /* §43: pra quem REVISA (equipe que não é o designer responsável) o
       envio de versão é exceção, não o fluxo — fica recolhido, abaixo
       das ações de revisão, sem competir com "Aprovar"/"Solicitar ajuste".
       Exceto quando o designer ainda não enviou nada: aí não é exceção,
       é o motivo de a equipe estar aqui ("o designer não teve tempo") —
       fica aberto, com um aviso em vez do rótulo "— exceção". */
    if (recolhido) {
      return '<details class="ds-dr-bloco ds-dr-recolhido"' + (drawer.envioAberto ? ' open' : '') + '><summary>Enviar versão em nome do designer <span class="ds-leve">— exceção</span></summary>' + corpo + '</details>';
    }
    const titulo = semNadaAinda ? 'Enviar arquivo pelo designer' : 'Enviar nova versão';
    const aviso = semNadaAinda
      ? '<p class="ds-leve" style="margin:2px 0 10px">O designer ainda não enviou nenhuma arte — se ele não tiver tempo, a equipe pode subir o arquivo por ele.</p>' : '';
    return '<div class="ds-dr-bloco"><h4>' + titulo + '</h4>' + aviso + corpo + '</div>';
  }

  function blocoEnvioUpload(d) {
    const fila = drawer.filaUpload;
    const algumEnviando = fila.some(f => f.estado === 'enviando') ||
      Object.values(drawer.uploadsParte || {}).some(u => u.estado === 'enviando');
    const multi = ehMultiparte();
    /* multiparte: a arte entra pelo slot de cada slide (área principal);
       aqui embaixo só arquivo de apoio (fonte, anexo) e o envio */
    const papeis = PAPEIS_ARQUIVO.filter(([v]) => (v !== 'final' ||
      d.status === 'aprovado_interno' || d.status === 'aprovado_cliente') && (!multi || v !== 'preview'));

    let resumoPartes = '';
    let pronto = fila.some(f => f.estado === 'ok');
    if (multi) {
      const partes = partesDaPeca(); const efet = arquivosEfetivos(); const rasc = arquivosRascunho();
      const nomeP = d.tipo === 'stories' ? 'Stories' : 'Slides';
      const novos = partes.filter(p => rasc.get(p.id)), herdados = partes.filter(p => !rasc.get(p.id) && efet.get(p.id)),
            faltam = partes.filter(p => !rasc.get(p.id) && !efet.get(p.id));
      pronto = novos.length > 0 && faltam.length === 0;
      resumoPartes = '<div class="ds-envio-partes">' +
        (novos.length ? '<p><b>Nesta versão:</b> ' + nomeP.toLowerCase() + ' ' + novos.map(p => pad2(p.posicao + 1)).join(', ') + '</p>' : '<p class="ds-leve">Nenhum arquivo novo nesta versão ainda — use “Enviar arquivo” em cada ' + (d.tipo === 'stories' ? 'story' : 'slide') + ' acima.</p>') +
        (herdados.length ? '<p><b>Mantidos da versão anterior:</b> ' + herdados.map(p => pad2(p.posicao + 1)).join(', ') + '</p>' : '') +
        (faltam.length ? '<p class="ds-up-erro">Faltam arquivos nos ' + nomeP + ' ' + faltam.map(p => pad2(p.posicao + 1)).join(', ') + '.</p>' : '') +
      '</div>';
    }

    return resumoPartes +
      '<div class="ds-drop' + (multi ? ' ds-drop-apoio' : '') + '" id="dv-drop" tabindex="0" role="button" aria-label="Escolher arquivos ou arrastar aqui">' +
        '<input type="file" id="dv-arquivo" multiple hidden>' +
        '<div class="ds-drop-tx"><b>' + (multi ? 'Arquivo de apoio (fonte, anexo)' : 'Arraste arquivos aqui') + '</b><span>' + (multi ? 'opcional · PSD, AI, PDF… não substitui a arte dos slides' : 'ou clique para escolher · qualquer formato de arte') + '</span></div>' +
      '</div>' +
      '<div id="dv-fila" class="ds-fila-upload">' + fila.map((f, i) => linhaUpload(f, i, papeis)).join('') + '</div>' +
      '<label class="rot" for="dv-observacao" style="margin-top:12px">OBSERVAÇÃO <span class="ds-leve">— opcional</span></label>' +
      '<textarea class="campo" id="dv-observacao" rows="2" placeholder="O que mudou nesta versão, algo que a revisão deveria olhar…"></textarea>' +
      '<button class="b pri" id="dv-enviar" style="width:100%;margin-top:10px" ' + (pronto && !algumEnviando ? '' : 'disabled') + '>' +
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
    const novos = [...arquivos].map(arquivo => ({ arquivo, papel: ehMultiparte() ? 'anexo' : 'preview', estado: 'pendente', progresso: 0, erro: null }));
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
    if (btn) btn.disabled = !envioPronto();
  }

  /* pode mandar pra revisão? arte única: algum arquivo ok na fila.
     multiparte: algum slide novo no rascunho e nenhum slide sem arte
     (novo ou herdado). Nunca com upload em andamento. */
  function envioPronto() {
    const enviando = drawer.filaUpload.some(f => f.estado === 'enviando') ||
      Object.values(drawer.uploadsParte || {}).some(u => u.estado === 'enviando');
    if (enviando) return false;
    if (!ehMultiparte()) return drawer.filaUpload.some(f => f.estado === 'ok');
    const efet = arquivosEfetivos(), rasc = arquivosRascunho();
    const partes = partesDaPeca();
    return partes.some(p => rasc.get(p.id)) && partes.every(p => rasc.get(p.id) || efet.get(p.id));
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
        drawer.canalExterno = null; drawer.viaExterna = false; drawer.uploadsParte = {}; drawer.arteHistorico = null;
        const novo = await B7.DB.design(d.id); Object.assign(d, novo);
        drawer.extra = await B7.DB.historicoDesign(d.id);
        B7.UI.toast(via === 'externa' ? 'Registrado — enviada para revisão interna' : 'Peça enviada para revisão interna');
        desenharDrawer(); redesenharTela();
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
  /* Linha do tempo = notificações (como sempre) + eventos POR SLIDE
     derivados dos dados reais de arquivos/versões (Arquivos 2.0, §50):
     "Slide 03 — V02 enviada" (data de envio da versão que trouxe o
     arquivo), "Slide 03 — ajuste solicitado por Yury" / "aprovado por
     Yury" (revisado_em/revisado_por do arquivo). Nada é inventado a
     partir de render: cada linha tem um registro e um timestamp por
     trás. Só pra peça multiparte — arte única já está coberta pelas
     notificações da versão. */
  function eventosPorParte() {
    if (!drawer.briefing || !ehMultiparte()) return [];
    const partes = partesDaPeca(); const porId = new Map(partes.map(p => [p.id, p]));
    const nomes = drawer.nomesPerfis || {};
    const nomeP = partes[0].tipo === 'frame' ? 'Story' : 'Slide';
    const ev = [];
    ((drawer.extra && drawer.extra.arquivos) || []).filter(a => a.papel === 'preview' && a.parte_id && a.versao_estado !== 'rascunho').forEach(a => {
      const p = porId.get(a.parte_id); const rot = nomeP + ' ' + pad2(p ? p.posicao + 1 : (a.parte_posicao || 0) + 1);
      const v = ((drawer.extra && drawer.extra.versoes) || []).find(x => x.id === a.versao_id) || {};
      ev.push({ t: v.enviada_em || a.created_at, titulo: rot + ' — V' + pad2(a.versao_numero) + ' enviada' });
      if (a.cliente_ajuste && a.cliente_ajuste_em) {
        ev.push({ t: a.cliente_ajuste_em, titulo: rot + ' — ajuste solicitado pelo cliente' + (a.cliente_ajuste_canal ? ' (via ' + rotuloCanal(a.cliente_ajuste_canal) + ')' : ''), mensagem: a.cliente_ajuste });
      }
      if (a.revisao && a.revisado_em) {
        const quem = nomes[a.revisado_por] ? ' por ' + nomes[a.revisado_por] : '';
        ev.push({ t: a.revisado_em, titulo: rot + ' — ' + (a.revisao === 'ajuste' ? 'ajuste solicitado' : 'aprovado') + quem,
                  mensagem: a.revisao === 'ajuste' ? a.revisao_mensagem : null });
      }
    });
    return ev;
  }
  function blocoTimeline(notifs) {
    const itens = notifs.map(n => ({ t: n.created_at, titulo: n.titulo, mensagem: n.mensagem })).concat(eventosPorParte());
    if (!itens.length) return '<p class="vazio-leve">Sem atividade registrada ainda.</p>';
    const ordenadas = itens.sort((a, b) => (b.t || '').localeCompare(a.t || ''));
    return '<div class="ds-timeline">' + ordenadas.map(n =>
      '<div class="ds-tl"><span class="ds-tl-pt"></span><div>' + esc(n.titulo || '') +
        (n.mensagem ? '<p class="ds-tl-msg">“' + esc(n.mensagem) + '”</p>' : '') +
        '<small>' + esc(B7.UI.quando(n.t)) + '</small></div></div>').join('') + '</div>';
  }

  /* ---------------------------------------------------------- ligações */
  function ligarDrawer(d, x, versaoAtual) {
    const el = drawer.el;
    el.querySelectorAll('[data-fechar]').forEach(b => b.onclick = fecharDrawer);

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
        redesenharTela();
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
        B7.UI.toast('Peça assumida'); desenharDrawer(); redesenharTela();
      } catch (e) {
        assumir.disabled = false; assumir.textContent = 'Assumir esta peça';
        B7.UI.toast('Não foi possível assumir: ' + (e.message || ''), { tipo: 'erro' });
      }
    };

    const compartilhar = el.querySelector('#dv-compartilhar');
    if (compartilhar) compartilhar.onclick = async () => {
      const sel = el.querySelector('#dv-colega');
      const colegaId = sel && sel.value;
      if (!colegaId) { B7.UI.toast('Escolha um designer para compartilhar.', { tipo: 'aviso' }); return; }
      const colegaNome = sel.options[sel.selectedIndex].textContent;
      compartilhar.disabled = true; compartilhar.textContent = 'Compartilhando…';
      try {
        await B7.DB.atribuirDesign(d.id, colegaId);
        const novo = await B7.DB.design(d.id); Object.assign(d, novo);
        B7.UI.toast('Peça atribuída a ' + colegaNome); desenharDrawer(); redesenharTela();
      } catch (e) {
        compartilhar.disabled = false; compartilhar.textContent = 'Compartilhar';
        B7.UI.toast('Não foi possível compartilhar: ' + (e.message || ''), { tipo: 'erro' });
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

    /* roteiro vinculado (briefing de Reel) — ficha de leitura, sem sair
       do workspace (ver verRoteiro()); nunca abre o editor completo
       daqui, que edita o roteiro e não é o que "Ver roteiro" promete */
    el.querySelectorAll('[data-abrir-roteiro]').forEach(b => b.onclick = () => {
      verRoteiro(drawer.briefing && drawer.briefing.roteiro, d);
    });

    /* navegador de slide/story (Rodada 4) — ver navegadorSlides() */
    el.querySelectorAll('[data-slide-ir]').forEach(b => b.onclick = () => {
      drawer.slideIndice = +b.dataset.slideIr;
      /* miniatura da visão geral: seleciona E abre em grande (§34) */
      if (b.classList.contains('ds-arte-mini')) drawer.slideModoTodos = false;
      desenharDrawer();
      const pill = drawer.el.querySelector('.ds-nav-pill.on');
      if (pill) pill.focus();
    });
    el.querySelectorAll('[data-slide-nav]').forEach(b => b.onclick = () => moverSlide(+b.dataset.slideNav));
    el.querySelectorAll('[data-slides-modo]').forEach(b => b.onclick = () => {
      const querVerTodos = b.dataset.slidesModo === 'todos';
      drawer.slideModoTodos = querVerTodos;
      desenharDrawer();
      const alvo = drawer.el.querySelector('.ds-nav-alternar');
      if (alvo) alvo.focus();
    });

    /* Arquivos 2.0 — arte: download, tela cheia, decisão por parte,
       upload por slot, histórico por parte, ZIP do conjunto */
    ligarBaixar(el, d);
    el.querySelectorAll('[data-tela-cheia]').forEach(b => b.onclick = () => abrirTelaCheia(d, b.dataset.telaCheia));
    el.querySelectorAll('[data-decidir]').forEach(b => b.onclick = () => decidirParte(d, b.dataset.arquivo, b.dataset.decidir, b));
    el.querySelectorAll('input[data-up-parte]').forEach(inp => inp.onchange = () => {
      const parte = (partesDaPeca() || []).find(p => p.id === inp.dataset.upParte);
      if (parte && inp.files && inp.files[0]) uploadParte(d, parte, inp.files[0]);
      inp.value = '';
    });
    const lote = el.querySelector('#dv-lote');
    if (lote) lote.onchange = () => { if (lote.files && lote.files.length) modalLote(d, lote.files); lote.value = ''; };
    el.querySelectorAll('[data-up-tentar-parte]').forEach(b => b.onclick = () => {
      const parte = (partesDaPeca() || []).find(p => p.id === b.dataset.upTentarParte);
      const up = drawer.uploadsParte && drawer.uploadsParte[b.dataset.upTentarParte];
      if (parte && up && up.arquivo) uploadParte(d, parte, up.arquivo);
    });
    el.querySelectorAll('[data-remover-rascunho]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await B7.DB.removerArquivoRascunhoDesign(b.dataset.removerRascunho); drawer.extra = await B7.DB.historicoDesign(d.id); desenharDrawer(); }
      catch (e) { b.disabled = false; B7.UI.toast('Não foi possível remover: ' + (e.message || ''), { tipo: 'erro' }); }
    });
    el.querySelectorAll('[data-ver-versao]').forEach(b => b.onclick = () => {
      drawer.arteHistorico = drawer.arteHistorico || {};
      if (b.dataset.verVersao) drawer.arteHistorico[b.dataset.parteChave] = b.dataset.verVersao; else delete drawer.arteHistorico[b.dataset.parteChave];
      desenharDrawer();
    });
    el.querySelectorAll('[data-baixar-conjunto]').forEach(b => b.onclick = () => baixarConjunto(d, b, b.dataset.baixarConjunto === 'parcial'));
    /* arrastar arquivo direto no slot de um slide */
    el.querySelectorAll('.ds-arte[data-parte]').forEach(slot => {
      const parte = (partesDaPeca() || []).find(p => p.id === slot.dataset.parte);
      if (!parte || !slot.querySelector('input[data-up-parte]')) return;
      slot.ondragover = e => { e.preventDefault(); slot.classList.add('arrastando'); };
      slot.ondragleave = () => slot.classList.remove('arrastando');
      slot.ondrop = e => { e.preventDefault(); slot.classList.remove('arrastando'); if (e.dataTransfer.files && e.dataTransfer.files[0]) uploadParte(d, parte, e.dataTransfer.files[0]); };
    });
    const detVersoes = el.querySelector('#dv-versoes'); if (detVersoes) detVersoes.ontoggle = () => { drawer.versoesAberto = detVersoes.open; };
    const detTimeline = el.querySelector('#dv-timeline'); if (detTimeline) detTimeline.ontoggle = () => { drawer.timelineAberta = detTimeline.open; };
    const detEnvio = el.querySelector('details.ds-dr-recolhido:not([id])'); if (detEnvio) detEnvio.ontoggle = () => { drawer.envioAberto = detEnvio.open; };

    /* decisão do cliente registrada pela B7 */
    const decisaoCliente = el.querySelector('#dv-decisao-cliente');
    if (decisaoCliente) decisaoCliente.onclick = () => modalDecisaoCliente(d);
    el.querySelectorAll('[data-ajuste-cliente]').forEach(b => b.onclick = () => marcarAjusteCliente(d, b.dataset.ajusteCliente));
    el.querySelectorAll('[data-ajuste-cliente-remover]').forEach(b => b.onclick = () => { if (drawer.ajustesCliente) delete drawer.ajustesCliente[b.dataset.ajusteClienteRemover]; desenharDrawer(); });
    el.querySelectorAll('[data-ir-aprovacao]').forEach(b => b.onclick = () => { location.hash = '#/aprovacoes/' + b.dataset.irAprovacao; });

    /* fechamento da revisão multiparte (§23/§45): uma ação, uma notificação */
    const fecharRevisao = async (botao, rotulo) => {
      botao.disabled = true; botao.textContent = 'Registrando…';
      try {
        const resultado = await B7.DB.fecharRevisaoDesign(versaoAtual.id);
        const novo = await B7.DB.design(d.id); Object.assign(d, novo);
        drawer.extra = await B7.DB.historicoDesign(d.id);
        B7.UI.toast(resultado === 'aprovado' ? 'Peça aprovada internamente' : 'Ajustes enviados ao designer');
        desenharDrawer(); redesenharTela();
      } catch (e) {
        botao.disabled = false; botao.textContent = rotulo;
        B7.UI.toast('Não foi possível registrar: ' + (e.message || ''), { tipo: 'erro' });
      }
    };
    const aprovarInteiro = el.querySelector('#dv-aprovar-inteiro');
    if (aprovarInteiro && !aprovarInteiro.disabled) aprovarInteiro.onclick = async () => {
      const r = resumoDecisoes(d);
      const ok = await B7.UI.confirmar({ titulo: aprovarInteiro.textContent + '?', texto: 'Os ' + r.pendentes + ' ' + (d.tipo === 'stories' ? 'stories' : 'slides') + ' sem decisão ficam aprovados junto' + (r.aprovados ? ' com os ' + r.aprovados + ' já aprovados' : '') + '. A peça vai pra “Aprovado internamente”.', confirmar: 'Aprovar tudo' });
      if (!ok) return;
      const rot = aprovarInteiro.textContent; aprovarInteiro.disabled = true; aprovarInteiro.textContent = 'Aprovando…';
      try {
        await B7.DB.aprovarInternoDesign(versaoAtual.id);
        const novo = await B7.DB.design(d.id); Object.assign(d, novo);
        drawer.extra = await B7.DB.historicoDesign(d.id);
        B7.UI.toast('Peça aprovada internamente'); desenharDrawer(); redesenharTela();
      } catch (e) {
        aprovarInteiro.disabled = false; aprovarInteiro.textContent = rot;
        B7.UI.toast('Não foi possível aprovar: ' + (e.message || ''), { tipo: 'erro' });
      }
    };
    const fecharAprovar = el.querySelector('#dv-fechar-aprovar');
    if (fecharAprovar && !fecharAprovar.disabled) fecharAprovar.onclick = () => fecharRevisao(fecharAprovar, fecharAprovar.textContent);
    const fecharAjustes = el.querySelector('#dv-fechar-ajustes');
    if (fecharAjustes && !fecharAjustes.disabled) fecharAjustes.onclick = async () => {
      const r = resumoDecisoes(d);
      const ok = await B7.UI.confirmar({ titulo: 'Enviar ajustes ao Designer?', texto: r.ajustes + ' ' + (d.tipo === 'stories' ? 'story' : 'slide') + (r.ajustes > 1 ? 's' : '') + ' com ajuste pedido' + (r.pendentes ? ' · ' + r.pendentes + ' ainda sem decisão (ficam como estão)' : '') + '. O designer recebe uma notificação só, com tudo junto.', confirmar: 'Enviar ajustes' });
      if (ok) fecharRevisao(fecharAjustes, fecharAjustes.textContent);
    };

    /* revisão interna */
    const aprovar = el.querySelector('#dv-aprovar');
    if (aprovar && !aprovar.disabled) aprovar.onclick = async () => {
      aprovar.disabled = true; aprovar.textContent = 'Aprovando…';
      try {
        await B7.DB.aprovarInternoDesign(versaoAtual.id);
        const novo = await B7.DB.design(d.id); Object.assign(d, novo);
        drawer.extra = await B7.DB.historicoDesign(d.id);
        B7.UI.toast('Peça aprovada internamente');
        desenharDrawer(); redesenharTela();
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
        desenharDrawer(); redesenharTela();
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
        desenharDrawer(); redesenharTela();
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
        desenharDrawer(); redesenharTela();
      } catch (e) { B7.UI.toast('Não foi possível enviar ao cliente: ' + (e.message || ''), { tipo: 'erro' }); }
    };
  }

  return { abrir, abrirCentral, abrirDetalhe, abrirLinha };
})();
