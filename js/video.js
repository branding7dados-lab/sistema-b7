/* =====================================================================
   B7 VÍDEO — PRODUÇÃO DE VÍDEO (Parte 1.1) + CENTRAL DE VÍDEO

   Correção/evolução sobre a Parte 1 (fila de Demandas de Edição,
   atribuição, mudança de situação, link externo, importação de
   planilha — tudo isso continua igual, ver migration_video.sql/
   migration_video_kanban.sql/migration_video_import_fix.sql). O que
   muda aqui é a EXPERIÊNCIA, não os dados: nenhuma Demanda de Edição é
   recriada, nenhum dado importado é apagado.

   Uma tela só atrás da rota "#/video": PRODUÇÃO DE VÍDEO — a fila
   inteira, por competência (mês/ano), com filtros, lista/Kanban e
   resumo. Quem abre:
     - equipe (admin/coordenador): tudo, inclusive as ferramentas de
       gestão (nova demanda, importar, pacotes, gestão, descartados,
       atribuir, editar e excluir demanda);
     - videomaker (papel principal OU função extra): vê TODAS as
       demandas e opera qualquer uma (situação, versão, materiais,
       conclusão, comentários) — um cobre o outro —, sem as ferramentas
       de gestão. Ver migration_video_videomaker_opera_todas.sql.
   Quem é videomaker tem o filtro "Minha fila"; o "o que precisa de mim
   agora" mora no Painel.

   Mesma arquitetura de sempre: leitura direta de demandas_edicao_resumo
   (RLS já filtra o que cada um pode ver), toda escrita passa por
   função do banco (js/database.js só embrulha as chamadas).
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Video = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');
  const souEquipe = () => B7.Auth && ['admin', 'coordenador'].includes(B7.Auth.papel());
  const souVideomakerElegivel = () => B7.Auth && B7.Auth.souVideomakerElegivel && B7.Auth.souVideomakerElegivel();
  /* operar = mudar situação, registrar versão, materiais, conclusão e
     comentar, em QUALQUER demanda. Gerir (souEquipe) continua à parte. */
  const possoOperar = () => !!(souEquipe() || souVideomakerElegivel());
  /* "eu": em "Visualizar como…" é a pessoa em prévia (a prévia bloqueia
     toda escrita — ver js/previa-usuario.js), senão a sessão real. Assim
     "comigo"/"minha fila" mostram o trabalho de quem está sendo visto,
     igual ao Painel. */
  const meuId = () => {
    const alvo = (B7.PreviaUsuario && B7.PreviaUsuario.ativa && B7.PreviaUsuario.ativa()) ? B7.PreviaUsuario.usuarioAtivo() : null;
    if (alvo && alvo.id) return alvo.id;
    const u = B7.Auth && B7.Auth.usuario(); return u ? u.id : null;
  };
  const hoje = () => B7.UI.hojeISO();
  const IC = {
    mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    grafico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 19h16M7 16V9M12 16V5M17 16v-6"/></svg>',
    pacote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>',
    planilha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/></svg>',
    lixeira: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
    seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    versao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4-2.5z" fill="currentColor" stroke="none"/></svg>'
  };

  const SITUACOES = [
    ['pendente', 'Pendente'],
    ['em_edicao', 'Em edição'],
    ['aguardando_aprovacao', 'Aguardando aprovação'],
    ['correcao', 'Correção'],
    ['standby', 'Standby'],
    ['entregue', 'Entregue'],
    ['descartado', 'Descartado']
  ];
  const rotuloSituacao = s => (SITUACOES.find(x => x[0] === s) || [, s])[1];
  /* Descartado nunca entra no filtro/Kanban/resumo da produção normal —
     só existe na lista completa (badge, seletor de Situação no
     detalhe). Ver "Descartados" (modalDescartados) pra consultar. */
  const SITUACOES_ATIVAS = SITUACOES.filter(([v]) => v !== 'descartado');

  const PRIORIDADES = [['normal', 'Normal'], ['alta', 'Alta'], ['urgente', 'Urgente']];

  /* Cor por videomaker: não existe (nem foi pedido) campo de cor
     cadastrado por pessoa — a cor é calculada a partir do id (sempre a
     mesma pra cada pessoa, sem precisar guardar nada novo no banco). */
  const PALETA_VIDEOMAKER = ['#2E86AB', '#E07A5F', '#3D8361', '#8E44AD', '#C9A227', '#D64550',
    '#1B998B', '#F4A259', '#5C6BC0', '#B5838D', '#457B9D', '#6A994E'];
  function corVideomaker(id) {
    if (!id) return '#9aa0a6';
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return PALETA_VIDEOMAKER[h % PALETA_VIDEOMAKER.length];
  }
  function quemHTML(d) {
    if (!d.videomaker_id || !d.videomaker_nome) return '<span class="vd-quem fraca">sem responsável</span>';
    /* nome do videomaker num span próprio: precisa de um elemento
       separado pra truncar com reticências no card estreito (celular)
       sem empurrar o prazo, que fica ao lado — ver .vd-quem no CSS. */
    return '<span class="vd-quem"><i class="vd-quem-dot" style="background:' + corVideomaker(d.videomaker_id) + '"></i>' +
      '<span class="vd-quem-nome">' + esc(d.videomaker_nome) + '</span></span>';
  }
  /* Logo do cliente: quando não tem logo cadastrada (clientes.js —
     campo já existia antes desta rodada), mostra a inicial do nome em
     vez de deixar um buraco em branco. */
  function logoClienteHTML(d, tamanho) {
    tamanho = tamanho || 'sm';
    if (d.cliente_logo_url) {
      return '<img class="vd-logo-cliente ' + tamanho + '" src="' + esc(d.cliente_logo_url) + '" alt="" loading="lazy">';
    }
    const inicial = (d.cliente_nome || '?').trim().charAt(0) || '?';
    return '<span class="vd-logo-cliente vd-logo-cliente-vazia ' + tamanho + '">' + esc(inicial) + '</span>';
  }

  const ROTULO_PROBLEMA = {
    sem_nome_de_cliente: 'Sem nome de cliente na planilha',
    cliente_nao_encontrado: 'Cliente não encontrado — escolha na lista',
    possivel_duplicata: 'Possível duplicata — já existe uma demanda igual. Escolha o cliente de novo pra confirmar mesmo assim.'
  };
  const rotuloProblema = p => ROTULO_PROBLEMA[p] || p;
  const rotuloPrioridade = p => (PRIORIDADES.find(x => x[0] === p) || [, 'Normal'])[1];

  const MESES_NOME = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const competenciaChave = d => (d.competencia_ano && d.competencia_mes)
    ? d.competencia_ano + '-' + String(d.competencia_mes).padStart(2, '0') : '';
  const competenciaRotulo = chave => {
    const [ano, mes] = chave.split('-');
    return MESES_NOME[Number(mes)] + ' de ' + ano;
  };
  const mesAtualChave = () => { const h = new Date(); return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0'); };

  let demandas = [], clientes = [], videomakers = [], pacotesVideoCache = [];
  let versoesAtual = [];   /* versões da demanda aberta no momento (Workspace de Vídeo) */
  let comentariosPorVersao = {};   /* versao_id -> lista de comentários com timecode */

  /* Teto de tempo para uma carga de tela. `fetch` não desiste sozinho: se a
     conexão fica pendurada (rede caindo, celular trocando de torre, proxy
     que engole a resposta), a promessa nunca resolve NEM rejeita, e quem
     está esperando por ela fica no esqueleto de carregamento pra sempre.
     Isso transforma esse silêncio num erro tratável, com "tentar de novo". */
  function comTempoLimite(promessa, ms) {
    let id;
    const limite = new Promise((_, rejeitar) => {
      id = setTimeout(() => rejeitar(new Error('A conexão demorou demais para responder. Tente de novo.')), ms);
    });
    return Promise.race([promessa, limite]).finally(() => clearTimeout(id));
  }

  /* =================================================================
     FILTROS — persistidos por sessão (mesmo padrão de B7.Design),
     compartilhados por Lista, Quadro e resumo.
     ================================================================= */
  const F_PADRAO = { competencia: '', cliente: '', status: '', responsavel: '', prioridade: '',
                     prazo: '', busca: '', vista: 'lista', minhaFila: false };
  let F = Object.assign({}, F_PADRAO);
  try { Object.assign(F, JSON.parse(sessionStorage.getItem('b7.video.filtros') || '{}')); } catch (e) {}
  function guardarFiltros() { try { sessionStorage.setItem('b7.video.filtros', JSON.stringify(F)); } catch (e) {} }

  /* =================================================================
     CARGA
     ================================================================= */
  /* Links com filtro (ex.: KPI "Atrasadas" do Painel → #/video?prazo=
     atrasadas&minha=1&comp=todas). Os filtros são aplicados por cima do
     padrão e gravados como os de sempre; a query sai do endereço logo em
     seguida, pra um refresh não reaplicar e a barra ficar limpa. */
  function aplicarFiltrosDaUrl(params) {
    if (!params || !['prazo', 'minha', 'comp', 'status'].some(k => params.has(k))) return;
    const vista = F.vista;
    F = Object.assign({}, F_PADRAO, { vista });
    if (params.get('prazo') === 'atrasadas' || params.get('prazo') === 'hoje') F.prazo = params.get('prazo');
    if (params.get('minha') === '1') F.minhaFila = true;
    if (params.get('comp')) F.competencia = params.get('comp');
    if (params.get('status') && SITUACOES.some(([v]) => v === params.get('status'))) F.status = params.get('status');
    guardarFiltros();
    try { history.replaceState(null, '', '#/video'); } catch (e) {}
  }

  async function abrir(params) {
    aplicarFiltrosDaUrl(params);
    B7.Dashboard.marcarNav('#/video');
    const equipe = souEquipe();
    B7.Rota.titulo(['Produção de Vídeo']);
    painel().innerHTML = '<div class="conteudo vd-tela">' +
      '<header class="vd-cab"><h1>Produção de Vídeo</h1>' +
      '<p>Carregando as demandas…</p></header>' +
      B7.UI.skeleton('tabela', { n: 5, cols: 5 }) + '</div>';

    try {
      /* videomakers: o filtro "Responsável" é de todo mundo; clientes e
         pacotes só servem às ferramentas de gestão */
      const chamadas = [B7.DB.minhasDemandasVideo(), B7.DB.listarVideomakers().catch(() => [])];
      if (equipe) chamadas.push(B7.DB.listarClientes(), B7.DB.pacotesVideo());
      const [d, v, c, p] = await Promise.all(chamadas);
      demandas = d || [];
      clientes = c || [];
      videomakers = v || [];
      pacotesVideoCache = p || [];
    } catch (e) {
      painel().innerHTML = '<div class="conteudo vd-tela"><div class="estado-b7">' +
        '<b>Não foi possível carregar a Produção de Vídeo.</b>' +
        '<p>' + esc(e.message || 'Confira a conexão e tente de novo.') + '</p>' +
        '<div class="acoes"><button class="b pri" onclick="location.reload()">Tentar de novo</button></div>' +
        '</div></div>';
      return;
    }

    if (!F.competencia) F.competencia = mesAtualChave();

    desenharProducao();
  }

  /* =================================================================
     PRODUÇÃO DE VÍDEO — equipe e videomakers
     ================================================================= */
  function competenciasDisponiveis() {
    const chaves = new Set(demandas.map(competenciaChave).filter(Boolean));
    chaves.add(mesAtualChave());
    return [...chaves].sort().reverse();
  }

  /* tudo que não é o filtro de status/prazo — alimenta o resumo (cada
     chip do resumo é, ele mesmo, um filtro rápido de status/prazo) */
  function baseFiltrada() {
    const t = F.busca.trim().toLowerCase();
    return demandas.filter(d => {
      /* Descartado nunca aparece na produção normal (Lista/Kanban/
         resumo) — nem via filtro de status. Fica só no arquivo
         "Descartados" (descarregado à parte, ver modalDescartados). */
      if (d.editing_status === 'descartado') return false;
      if (F.competencia !== 'todas' && competenciaChave(d) !== F.competencia) return false;
      if (F.cliente && d.client_id !== F.cliente) return false;
      if (F.responsavel === 'sem' && d.videomaker_id) return false;
      if (F.responsavel && F.responsavel !== 'sem' && d.videomaker_id !== F.responsavel) return false;
      if (F.prioridade && (d.prioridade || 'normal') !== F.prioridade) return false;
      if (F.minhaFila && d.videomaker_id !== meuId()) return false;
      if (t && !((d.titulo || '').toLowerCase().includes(t) || (d.cliente_nome || '').toLowerCase().includes(t) ||
                 (d.codigo || '').toLowerCase().includes(t))) return false;
      return true;
    });
  }
  function filtrar(lista) {
    return lista.filter(d => {
      /* Entregue some da Lista e do Kanban por padrão — só volta a
         aparecer se a pessoa escolher "Entregue" no filtro de status
         (ou clicar no chip "entregues" do resumo, que é o mesmo
         filtro). Continua contando no resumo normalmente. */
      if (F.status) { if (d.editing_status !== F.status) return false; }
      else if (d.editing_status === 'entregue') return false;
      if (F.prazo === 'atrasadas' && !ehAtrasada(d)) return false;
      /* "vence hoje" segue a mesma semântica do atraso: aguardando
         aprovação já saiu das mãos do videomaker */
      if (F.prazo === 'hoje' && (d.prazo !== hoje() || d.editing_status === 'aguardando_aprovacao')) return false;
      return true;
    });
  }
  function ehAtrasada(d) {
    /* "Aguardando aprovação" também não conta como atrasada: o prazo é
       da EDIÇÃO ficar pronta, e isso já aconteceu — quem está devendo
       resposta agora é o cliente, não o videomaker. Evita punir o
       videomaker porque o cliente demorou a decidir. */
    return !!(d.prazo && d.prazo < hoje() && d.editing_status !== 'entregue' && d.editing_status !== 'descartado' &&
              d.editing_status !== 'aguardando_aprovacao');
  }
  function venceHoje(d) {
    return d.prazo === hoje() && !['entregue', 'descartado', 'aguardando_aprovacao'].includes(d.editing_status);
  }
  function filtrosAtivos() {
    return !!(F.cliente || F.status || F.responsavel || F.prioridade || F.prazo || F.busca.trim() || F.minhaFila);
  }

  function desenharProducao() {
    const base = baseFiltrada();
    const visiveis = filtrar(base);
    const comp = competenciasDisponiveis();
    const souTambemVideomaker = souVideomakerElegivel();
    const equipe = souEquipe();
    const descartados = demandas.filter(d => d.editing_status === 'descartado');

    /* pendências de meses ANTERIORES ao selecionado, ainda em aberto —
       nunca somem, só ficam fora da projeção do mês corrente até
       alguém trocar de competência ou clicar no aviso (spec: "não deixe
       trabalho antigo desaparecer operacionalmente"). */
    const anteriores = F.competencia !== 'todas'
      ? demandas.filter(d => competenciaChave(d) && competenciaChave(d) < F.competencia &&
                             d.editing_status !== 'entregue' && d.editing_status !== 'descartado')
      : [];

    painel().innerHTML = '<div class="conteudo entra vd-tela">' +
      '<div class="cab-conteudo"><div><h1>Produção de Vídeo</h1>' +
      '<p>Toda a fila de edição da B7 em um só lugar.</p></div>' +
      /* ferramentas de gestão: só equipe (o banco recusa de qualquer jeito) */
      (equipe
        ? '<div class="vd-acoes-topo">' +
          '<div class="vd-acoes-sec" role="group" aria-label="Ferramentas">' +
            '<button class="b fina" id="vd-gestao">' + IC.grafico + 'Gestão</button>' +
            '<button class="b fina" id="vd-pacotes">' + IC.pacote + 'Pacotes</button>' +
            '<button class="b fina" id="vd-importar">' + IC.planilha + 'Importar</button>' +
            (descartados.length
              ? '<button class="b fina" id="vd-descartados">' + IC.lixeira + 'Descartados <span class="vd-contagem">' + descartados.length + '</span></button>'
              : '') +
          '</div>' +
          '<button class="b pri" id="vd-nova">' + IC.mais + 'Nova demanda</button></div>'
        : '') +
      '</div>' +
      '<datalist id="vd-pacotes-lista">' + pacotesVideoCache.map(p => '<option value="' + esc(p.nome) + '">').join('') + '</datalist>' +
      (anteriores.length
        ? '<div class="vd-aviso-anteriores" id="vd-aviso-anteriores">' +
          '<b>' + anteriores.length + '</b> demanda' + (anteriores.length === 1 ? '' : 's') +
          ' de meses anteriores ainda em aberto.<button class="b fina contorno" id="vd-ver-anteriores">Ver</button></div>'
        : '') +
      '<div id="vd-resumo"></div>' +
      '<div id="vd-barra"></div>' +
      '<div id="vd-area"></div>' +
    '</div>';

    const btNova = document.getElementById('vd-nova');
    if (btNova) btNova.onclick = () => modalNovaDemanda();
    const btImportar = document.getElementById('vd-importar');
    if (btImportar) btImportar.onclick = () => modalImportar();
    const btDescartados = document.getElementById('vd-descartados');
    if (btDescartados) btDescartados.onclick = () => modalDescartados(descartados);
    const btPacotes = document.getElementById('vd-pacotes');
    if (btPacotes) btPacotes.onclick = () => modalPacotes();
    const btGestao = document.getElementById('vd-gestao');
    if (btGestao) btGestao.onclick = () => modalGestao();
    const btVerAnteriores = document.getElementById('vd-ver-anteriores');
    if (btVerAnteriores) btVerAnteriores.onclick = () => {
      F.competencia = 'todas'; F.prazo = 'atrasadas'; guardarFiltros(); desenharProducao();
    };

    desenharResumo(base);
    desenharBarra(comp, souTambemVideomaker);
    desenharArea(visiveis);

    /* Alertas de prazo: recalculados (server-side, com a chave única
       evitando duplicar) toda vez que a equipe abre a Produção de
       Vídeo — não há job agendado neste projeto (ver nota no topo de
       migration_video_gestao.sql), então é assim que eles acontecem:
       de forma preguiçosa, ao alguém abrir a tela. Silencioso de
       propósito — não é motivo pra travar a tela se falhar. */
    B7.DB.verificarAlertasPrazoVideo().catch(() => {});
  }

  function desenharResumo(base) {
    const cx = painel().querySelector('#vd-resumo');
    if (!cx) return;
    const contar = pred => base.filter(pred).length;
    const chips = [
      ['prazo:atrasadas', contar(ehAtrasada), 'atrasada' + (contar(ehAtrasada) === 1 ? '' : 's'), F.prazo === 'atrasadas'],
      ['prazo:hoje', contar(venceHoje), contar(venceHoje) === 1 ? 'vence hoje' : 'vencem hoje', F.prazo === 'hoje'],
      ['status:pendente', contar(d => d.editing_status === 'pendente'), 'pendente' + (contar(d => d.editing_status === 'pendente') === 1 ? '' : 's'), F.status === 'pendente'],
      ['status:em_edicao', contar(d => d.editing_status === 'em_edicao'), 'em edição', F.status === 'em_edicao'],
      ['status:aguardando_aprovacao', contar(d => d.editing_status === 'aguardando_aprovacao'), 'aguardando aprovação', F.status === 'aguardando_aprovacao'],
      ['status:correcao', contar(d => d.editing_status === 'correcao'), 'em correção', F.status === 'correcao'],
      ['status:standby', contar(d => d.editing_status === 'standby'), 'em standby', F.status === 'standby'],
      ['status:entregue', contar(d => d.editing_status === 'entregue'), 'entregue' + (contar(d => d.editing_status === 'entregue') === 1 ? '' : 's'), F.status === 'entregue']
    ].filter(c => c[1] > 0 || c[3]);

    cx.innerHTML = '<div class="ds-resumo-rapido vd-resumo-rapido">' + chips.map(([chave, n, rot, on]) =>
      '<button class="ds-rapido-item vd-rapido-' + esc(chave.split(':')[1]) + (on ? ' on' : '') + '" data-resumo="' + chave + '">' +
      '<i class="vd-dot"></i><b>' + n + '</b> ' + esc(rot) + '</button>').join('') +
      '</div>';

    cx.querySelectorAll('[data-resumo]').forEach(b => b.onclick = () => {
      const [dim, val] = b.dataset.resumo.split(':');
      const ligado = (dim === 'prazo' ? F.prazo === val : F.status === val);
      if (dim === 'prazo') F.prazo = ligado ? '' : val;
      else { F.status = ligado ? '' : val; }
      guardarFiltros();
      desenharProducao();
    });
  }

  function desenharBarra(comp, souTambemVideomaker) {
    const cx = painel().querySelector('#vd-barra');
    if (!cx) return;
    const opc = (chave, atual, itens, rotulo) =>
      '<select class="campo fina ds-filtro' + (atual ? ' ativo' : '') + '" data-filtro="' + chave + '" aria-label="' + esc(rotulo) + '">' +
      itens.map(([v, r]) => '<option value="' + esc(v) + '"' + (atual === v ? ' selected' : '') + '>' + esc(r) + '</option>').join('') +
      '</select>';
    const clientesPresentes = [...new Map(demandas.filter(d => d.client_id).map(d => [d.client_id, d.cliente_nome])).entries()]
      .sort((a, b) => (a[1] || '').localeCompare(b[1] || ''));

    cx.innerHTML = '<div class="ds-barra">' +
      '<div class="ds-busca-cx"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>' +
        '<input class="campo fina ds-busca" id="vd-busca" placeholder="Buscar código, cliente ou título…" ' +
        'value="' + esc(F.busca) + '" aria-label="Buscar"></div>' +
      opc('competencia', F.competencia, [['todas', 'Todos os meses']].concat(comp.map(c => [c, competenciaRotulo(c)])), 'Competência') +
      opc('cliente', F.cliente, [['', 'Cliente']].concat(clientesPresentes), 'Cliente') +
      opc('status', F.status, [['', 'Status']].concat(SITUACOES_ATIVAS), 'Status') +
      opc('responsavel', F.responsavel, [['', 'Responsável'], ['sem', 'Sem responsável']]
        .concat(videomakers.map(v => [v.id, v.nome])), 'Responsável') +
      opc('prioridade', F.prioridade, [['', 'Prioridade']].concat(PRIORIDADES), 'Prioridade') +
      (filtrosAtivos() ? '<button class="b fina contorno" id="vd-limpar">Limpar filtros</button>' : '') +
      '<div class="ds-espaco"></div>' +
      (souTambemVideomaker
        ? '<label class="op-mini vd-minha-fila' + (F.minhaFila ? ' on' : '') + '"><input type="checkbox" id="vd-minha-fila"' +
          (F.minhaFila ? ' checked' : '') + '><span>Minha fila</span></label>'
        : '') +
      '<div class="seg-vista" role="tablist">' +
        '<button role="tab" class="' + (F.vista === 'lista' ? 'on' : '') + '" data-vista="lista">Lista</button>' +
        '<button role="tab" class="' + (F.vista === 'kanban' ? 'on' : '') + '" data-vista="kanban">Kanban</button>' +
      '</div>' +
    '</div>';

    const busca = cx.querySelector('#vd-busca');
    let t;
    busca.oninput = () => { clearTimeout(t); t = setTimeout(() => { F.busca = busca.value; guardarFiltros(); desenharArea(filtrar(baseFiltrada())); desenharResumo(baseFiltrada()); }, 220); };
    cx.querySelectorAll('[data-filtro]').forEach(s => s.onchange = () => {
      F[s.dataset.filtro] = s.value; guardarFiltros();
      desenharProducao();
    });
    const minhaFila = cx.querySelector('#vd-minha-fila');
    if (minhaFila) minhaFila.onchange = () => { F.minhaFila = minhaFila.checked; guardarFiltros(); desenharProducao(); };
    cx.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => {
      F.vista = b.dataset.vista; guardarFiltros();
      cx.querySelectorAll('[data-vista]').forEach(x => x.classList.toggle('on', x === b));
      desenharArea(filtrar(baseFiltrada()));
    });
    const limpar = cx.querySelector('#vd-limpar');
    if (limpar) limpar.onclick = () => {
      F.cliente = F.status = F.responsavel = F.prioridade = F.prazo = F.busca = '';
      F.minhaFila = false;
      guardarFiltros(); desenharProducao();
    };
  }

  function desenharArea(visiveis) {
    const cx = painel().querySelector('#vd-area');
    if (!cx) return;
    cx.innerHTML = '<p class="vd-total">' + (visiveis.length
      ? visiveis.length + ' demanda' + (visiveis.length === 1 ? '' : 's') +
        (F.competencia !== 'todas' ? ' em ' + esc(competenciaRotulo(F.competencia)) : '')
      : '') + '</p>' +
      (visiveis.length
        ? (F.vista === 'lista' ? tabelaHTML(visiveis) : quadroHTML(visiveis))
        : '<div class="estado-b7"><b>Nenhuma demanda com esses filtros.</b>' +
          '<p>Ajuste a busca, o mês ou os filtros ativos.</p></div>');
    ligarArea(cx);
  }

  /* ---------------- LISTA (versão moderna da planilha) ---------------- */
  function tabelaHTML(lista) {
    const ordenada = [...lista].sort((a, b) => {
      const pa = a.prazo || '9999-99-99', pb = b.prazo || '9999-99-99';
      return pa < pb ? -1 : pa > pb ? 1 : 0;
    });
    return '<div class="tabela-rolavel"><table class="vd-tabela"><thead><tr>' +
      '<th>Código</th><th>Cliente</th><th>Título</th><th>Prioridade</th><th>Prazo</th><th>Status</th><th>Responsável</th>' +
      '</tr></thead><tbody>' +
      ordenada.map(d => {
        const atrasada = ehAtrasada(d);
        return '<tr data-demanda="' + d.id + '" tabindex="0">' +
          '<td class="vd-codigo" data-rot="Código">' + esc(d.codigo || '—') + '</td>' +
          '<td data-rot="Cliente"><div class="vd-tb-cliente">' + logoClienteHTML(d, 'sm') + '<span>' + esc(d.cliente_nome || '—') + '</span></div></td>' +
          '<td class="vd-tb-titulo" data-rot="Título">' + tituloComFallback(d) + '</td>' +
          '<td data-rot="Prioridade">' + prioridadeBadge(d.prioridade) + '</td>' +
          '<td data-rot="Prazo">' + prazoHTML(d, atrasada) + '</td>' +
          '<td data-rot="Status">' + statusBadge(d.editing_status) + '</td>' +
          '<td data-rot="Responsável">' + quemHTML(d) + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function tituloComFallback(d) {
    if (!/^Sem título \(planilha\)/.test(d.titulo || '')) return esc(d.titulo);
    const partes = d.titulo.split(' — código ');
    return '<span class="vd-sem">Sem título</span>' +
      '<small class="vd-tb-sub">Importado da planilha' + (partes[1] ? ' · código ' + esc(partes[1]) : '') + '</small>';
  }
  function prioridadeBadge(p) {
    p = p || 'normal';
    return '<span class="vd-prioridade vd-prioridade-' + p + '">' + esc(rotuloPrioridade(p)) + '</span>';
  }
  function statusBadge(s) {
    return '<span class="vd-status vd-status-' + s + '">' + esc(rotuloSituacao(s)) + '</span>';
  }
  function prazoHTML(d, atrasada) {
    if (!d.prazo) return '<span class="vd-sem">—</span>';
    const dias = Math.round((new Date(hoje()) - new Date(d.prazo)) / 86400000);
    return '<span class="vd-prazo' + (atrasada ? ' atrasado' : '') + '">' + esc(B7.UI.dataBR(d.prazo)) +
      (atrasada ? '<small>' + (dias === 1 ? '1 dia em atraso' : dias + ' dias em atraso') + '</small>' : '') + '</span>';
  }

  /* ---------------- QUADRO (Kanban secundário, mesmos dados) ---------------- */
  const COLUNAS_KANBAN = SITUACOES_ATIVAS;
  const LIMITE_COLUNA = 30;
  function quadroHTML(lista) {
    /* mesma regra da Lista: coluna "Entregue" só aparece se alguém
       filtrar explicitamente por ela — senão fica ocupando espaço
       vazia pra sempre, já que "entregue" já sai de `lista` por causa
       do filtrar() acima. */
    const colunas = F.status === 'entregue' ? COLUNAS_KANBAN : COLUNAS_KANBAN.filter(([chave]) => chave !== 'entregue');
    const grupos = colunas.map(([chave, nome]) => ({
      chave, nome, itens: lista.filter(d => d.editing_status === chave)
    }));
    return '<div class="vd-quadro">' + grupos.map(colunaHTML).join('') + '</div>';
  }
  function colunaHTML(g) {
    const mostrar = g.itens.slice(0, LIMITE_COLUNA);
    const resto = g.itens.length - mostrar.length;
    return '<div class="vd-coluna vd-coluna-' + g.chave + '" data-coluna="' + g.chave + '">' +
      '<div class="vd-coluna-cab"><span><i class="vd-dot"></i>' + esc(g.nome) + '</span><b>' + g.itens.length + '</b></div>' +
      '<div class="vd-coluna-corpo" data-solta="' + g.chave + '">' +
      (mostrar.length ? mostrar.map(cardHTML).join('') : '<div class="vd-vazia">Nenhuma demanda</div>') +
      (resto > 0 ? '<button class="vd-ver-mais" data-coluna-ver-mais="' + g.chave + '">+' + resto + ' em ' + esc(g.nome.toLowerCase()) + '…</button>' : '') +
      '</div></div>';
  }
  function cardHTML(d) {
    const atrasada = ehAtrasada(d);
    const prio = d.prioridade || 'normal';
    return '<div class="vd-card vd-card-p-' + prio + (atrasada ? ' vd-card-atrasada' : '') + '" data-demanda="' + d.id + '" data-situacao="' + d.editing_status + '"' +
      (possoOperar() ? ' draggable="true"' : '') + ' tabindex="0">' +
      '<div class="vd-card-topo"><span class="vd-card-cliente">' + logoClienteHTML(d, 'sm') + '<b>' + esc(d.cliente_nome || 'Cliente') + '</b></span>' +
      (d.codigo ? '<span class="vd-codigo">' + esc(d.codigo) + '</span>' : '') + '</div>' +
      '<div class="vd-card-titulo">' + tituloComFallback(d) + '</div>' +
      (prio !== 'normal' ? prioridadeBadge(prio) : '') +
      '<div class="vd-card-rodape">' +
      quemHTML(d) +
      (d.prazo ? '<span class="vd-prazo-pill' + (atrasada ? ' atrasado' : '') + '">' + esc(B7.UI.dataBR(d.prazo).slice(0, 5)) + '</span>' : '') +
      '</div></div>';
  }

  function ligarArea(cx) {
    cx.querySelectorAll('[data-demanda]').forEach(el => {
      const ir = () => location.hash = '#/video/' + el.dataset.demanda;
      el.onclick = ir;
      el.onkeydown = e => { if (e.key === 'Enter') ir(); };
    });
    cx.querySelectorAll('[data-coluna-ver-mais]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const col = b.closest('.vd-coluna');
      const chave = b.dataset.colunaVerMais;
      const todos = filtrar(baseFiltrada()).filter(d => d.editing_status === chave);
      col.querySelector('.vd-coluna-corpo').innerHTML = todos.map(cardHTML).join('');
      col.querySelectorAll('[data-demanda]').forEach(el => {
        const ir = () => location.hash = '#/video/' + el.dataset.demanda;
        el.onclick = ir; el.onkeydown = ev => { if (ev.key === 'Enter') ir(); };
      });
      ligarArrastarVideo(cx);
    });
    if (F.vista === 'kanban' && possoOperar()) ligarArrastarVideo(cx);
  }

  /* =================================================================
     ARRASTAR E SOLTAR NO KANBAN — mesmo padrão nativo (HTML5 drag/drop,
     sem biblioteca) já usado no Kanban geral (js/kanban.js). O drop
     nunca escreve status "na marra": sempre passa pela mesma ação de
     negócio que um botão chamaria (mudarStatusVideo / enviar para
     aprovação / registrar entrega) — nunca um "update direto".
     ================================================================= */
  function ligarArrastarVideo(cx) {
    let arrastando = null;
    const limpar = () => cx.querySelectorAll('[data-solta]').forEach(z => z.classList.remove('sobre'));

    cx.querySelectorAll('.vd-card[draggable="true"]').forEach(card => {
      card.ondragstart = e => {
        arrastando = card.dataset.demanda;
        card.classList.add('arrastando');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.demanda);
      };
      /* dragend sempre dispara — solto no destino certo, cancelado com
         Esc, ou solto fora de qualquer coluna: nenhum desses casos
         pode deixar classe/estado grudado na tela. */
      card.ondragend = () => { card.classList.remove('arrastando'); arrastando = null; limpar(); };
    });

    cx.querySelectorAll('[data-solta]').forEach(zona => {
      zona.ondragover = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; zona.classList.add('sobre'); };
      zona.ondragleave = e => { if (!zona.contains(e.relatedTarget)) zona.classList.remove('sobre'); };
      zona.ondrop = e => {
        e.preventDefault();
        const id = arrastando || e.dataTransfer.getData('text/plain');
        limpar();
        if (!id) return;
        const d = demandas.find(x => x.id === id);
        const destino = zona.dataset.solta;
        if (!d || destino === d.editing_status) return;
        moverCartaoVideo(d, destino);
      };
    });
  }

  async function commitStatusVideo(d, status, mensagem) {
    try {
      await B7.DB.mudarStatusVideo(d.id, status, mensagem || null);
      d.editing_status = status;
      B7.UI.toast('Situação atualizada.');
    } catch (e) {
      B7.UI.toast(e.message || 'Não foi possível mover a demanda.');
    } finally {
      desenharProducao();
    }
  }
  async function commitAcaoVideo(d, acao, statusFinal) {
    try {
      await acao();
      d.editing_status = statusFinal;
      B7.UI.toast('Situação atualizada.');
    } catch (e) {
      B7.UI.toast(e.message || 'Não foi possível mover a demanda.');
    } finally {
      desenharProducao();
    }
  }

  /* Roteia o drop pela MESMA lógica de negócio de sempre — nunca um
     status "cru". Cada destino com regra própria pede confirmação (ou
     bloqueia) antes de qualquer escrita; se a pessoa cancelar, nada
     muda e o card só volta pro lugar no próximo redesenho. */
  async function moverCartaoVideo(d, destino) {
    if (destino === d.editing_status) return;

    if (destino === 'correcao') {
      const mensagem = await B7.UI.perguntar({ titulo: 'O que precisa corrigir?', confirmar: 'Marcar correção' });
      if (mensagem === null) return;
      await commitStatusVideo(d, 'correcao', mensagem);
      return;
    }

    if (destino === 'aguardando_aprovacao') {
      let versoes = [];
      try { versoes = await B7.DB.versoesDemandaVideo(d.id); } catch (e) { versoes = []; }
      const atual = versoes[0];
      /* Sem versão registrada no B7: o vídeo está no Drive e isso basta.
         Mover o cartão só atualiza a situação — registrar versão aqui é
         opcional, nunca condição para avançar. */
      if (!atual) { await commitStatusVideo(d, 'aguardando_aprovacao', null); return; }
      const ok = await B7.UI.confirmar({
        titulo: 'Enviar para aprovação?',
        texto: 'Enviar V' + String(atual.numero).padStart(2, '0') + ' para a aprovação do cliente?',
        confirmar: 'Enviar para aprovação'
      });
      if (!ok) return;
      await commitAcaoVideo(d, () => B7.DB.enviarParaAprovacaoVideo(d.id, atual.id), 'aguardando_aprovacao');
      return;
    }

    if (destino === 'entregue') {
      let versoes = [];
      try { versoes = await B7.DB.versoesDemandaVideo(d.id); } catch (e) { versoes = []; }
      const atual = versoes[0];
      if (!atual || atual.decisao_cliente !== 'aprovado') {
        B7.UI.toast('Esta versão ainda não foi aprovada pelo cliente.');
        return;
      }
      const ok = await B7.UI.confirmar({
        titulo: 'Registrar entrega?',
        texto: 'Marcar V' + String(atual.numero).padStart(2, '0') + ' como entregue?',
        confirmar: 'Registrar entrega'
      });
      if (!ok) return;
      await commitAcaoVideo(d, () => B7.DB.registrarEntregaVideo(d.id, atual.id, null), 'entregue');
      return;
    }

    if (d.editing_status === 'entregue') {
      /* reabrir trabalho já entregue não pode ser um deslize de mouse */
      const ok = await B7.UI.confirmar({
        titulo: 'Reabrir demanda entregue?',
        texto: 'Essa demanda já foi marcada como entregue. Quer mesmo reabrir e mudar a situação?',
        confirmar: 'Reabrir', perigo: true
      });
      if (!ok) return;
    }

    /* transições simples, sem dado extra: pendente / em edição / standby */
    await commitStatusVideo(d, destino, null);
  }

  /* =================================================================
     PRAZO SUGERIDO = data da gravação + 3 dias úteis (seg–sex, sem
     feriados — não existe cadastro de feriados neste projeto). Só uma
     SUGESTÃO: o campo continua editável e, uma vez que a pessoa mexa
     nele manualmente, nenhum redesenho/auto-preenchimento seguinte
     pode sobrescrever o que ela escolheu.
     ================================================================= */
  function somarDiasUteis(dataISO, n) {
    const d = new Date(dataISO + 'T00:00:00');
    let restante = n;
    while (restante > 0) {
      d.setDate(d.getDate() + 1);
      const dia = d.getDay(); // 0=domingo, 6=sábado
      if (dia !== 0 && dia !== 6) restante--;
    }
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function prazoSugeridoDeGravacao(dataGravacaoISO) {
    return dataGravacaoISO ? somarDiasUteis(dataGravacaoISO, 3) : '';
  }

  /* =================================================================
     NOVA DEMANDA DE EDIÇÃO (equipe) — criação manual (comportamento de
     sempre, sem nenhuma mudança) OU, quando uma gravação com roteiros é
     escolhida, geração em lote (1 demanda por roteiro marcado) — tudo
     no MESMO modal, sem abrir uma segunda tela. A geração em lote
     reaproveita a mesma função de banco de sempre
     (video_gerar_demandas_de_gravacao, já aplicada e com a numeração
     "#N" por gravação) — esta função só decide QUANDO chamar qual.
     ================================================================= */
  function modalNovaDemanda(opts) {
    opts = opts || {};
    if (!clientes.length) { B7.UI.toast('Cadastre um cliente antes de criar uma demanda.'); return; }
    const compAtual = F.competencia !== 'todas' && F.competencia ? F.competencia.split('-') : null;

    let gravacoesCache = [];
    let roteirosDaGravacao = [];
    let roteiroSelecionados = new Set();
    let prazoEditadoManualmente = false;
    let ajustandoPrazoProgramaticamente = false;

    const m = B7.UI.modal(
      '<h3>Nova demanda de edição</h3>' +
      '<p class="sub">Uma demanda manual, ou várias de uma vez a partir dos roteiros de uma gravação.</p>' +

      '<div class="vd-nd-sec"><div class="vd-nd-sec-t"><i>1</i><span>Cliente e gravação</span></div>' +
        '<label class="rot">Cliente</label>' +
        '<select class="campo" id="vd-nd-cliente" data-foco>' +
          clientes.map(c => '<option value="' + c.id + '">' + esc(c.nome) + '</option>').join('') +
        '</select>' +
        '<label class="rot">Gravação <em>opcional</em></label>' +
        '<select class="campo" id="vd-nd-gravacao"><option value="">Carregando…</option></select>' +
        '<p class="fraca vd-nd-gravacao-dica">Escolher uma gravação traz os roteiros dela aqui — marque os que viram demanda. Não precisa estar marcada como gravada.</p>' +
        '<div id="vd-nd-roteiros"></div>' +
        '<p class="vd-nd-aviso-lote" id="vd-nd-aviso-lote" hidden></p>' +
      '</div>' +

      '<div class="vd-nd-sec" id="vd-nd-manual"><div class="vd-nd-sec-t"><i>2</i><span>A demanda</span></div>' +
        '<label class="rot">Título</label>' +
        '<input class="campo" id="vd-nd-titulo" placeholder="Ex.: Reel de lançamento">' +
        '<div class="vd-grid-2">' +
          '<div><label class="rot">Código <em>opcional</em></label><input class="campo" id="vd-nd-codigo" placeholder="Ex.: 014"></div>' +
          '<div><label class="rot">Pacote <em>opcional</em></label><input class="campo" id="vd-nd-pacote" list="vd-pacotes-lista" placeholder="Ex.: B7 Start" autocomplete="off"></div>' +
        '</div>' +
      '</div>' +

      '<div class="vd-nd-sec"><div class="vd-nd-sec-t"><i id="vd-nd-num3">3</i><span>Prazo e responsável</span></div>' +
        '<div class="vd-grid-2">' +
          '<div><label class="rot">Prazo <em>opcional</em></label><input class="campo" type="date" id="vd-nd-prazo"></div>' +
          '<div id="vd-nd-prioridade-cx"><label class="rot">Prioridade</label><select class="campo" id="vd-nd-prioridade">' +
            PRIORIDADES.map(([v, r]) => '<option value="' + v + '"' + (v === 'normal' ? ' selected' : '') + '>' + r + '</option>').join('') +
          '</select></div>' +
        '</div>' +
        '<p class="fraca vd-nd-aviso-prioridade" id="vd-nd-aviso-prioridade" hidden>Na geração em lote cada demanda nasce com prioridade Normal e sem pacote — ajuste depois, uma a uma.</p>' +
        '<label class="rot">Responsável <em>opcional</em></label>' +
        '<select class="campo" id="vd-nd-videomaker">' +
          '<option value="">Sem atribuir ainda</option>' +
          videomakers.map(v => '<option value="' + v.id + '">' + esc(v.nome) + '</option>').join('') +
        '</select>' +
      '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" id="vd-nd-salvar">Criar demanda</button></div>');

    const selCliente = m.querySelector('#vd-nd-cliente');
    const selGravacao = m.querySelector('#vd-nd-gravacao');
    const cxRoteiros = m.querySelector('#vd-nd-roteiros');
    const cxManual = m.querySelector('#vd-nd-manual');
    const cxAvisoLote = m.querySelector('#vd-nd-aviso-lote');
    const cxPrioridade = m.querySelector('#vd-nd-prioridade-cx');
    const cxAvisoPrioridade = m.querySelector('#vd-nd-aviso-prioridade');
    const campoPrazo = m.querySelector('#vd-nd-prazo');
    const btnSalvar = m.querySelector('#vd-nd-salvar');

    campoPrazo.oninput = () => { if (!ajustandoPrazoProgramaticamente) prazoEditadoManualmente = true; };
    function definirPrazoSugerido(dataGravacaoISO) {
      if (prazoEditadoManualmente || !dataGravacaoISO) return;
      ajustandoPrazoProgramaticamente = true;
      campoPrazo.value = prazoSugeridoDeGravacao(dataGravacaoISO);
      ajustandoPrazoProgramaticamente = false;
    }

    /* Roteiro já com demanda ativa: reaproveita o campo `codigo` que já
       vem em `demandas` (cache carregado por abrir()) pra mostrar o
       código existente, ex. "já tem demanda #2" — nunca marcado pra
       seleção, nunca duplicado. */
    function codigoDemandaExistente(roteiroId) {
      const existente = demandas.find(d => d.roteiro_id === roteiroId && d.editing_status !== 'descartado');
      return existente && existente.codigo ? existente.codigo : '';
    }

    function roteirosHTML() {
      if (!roteirosDaGravacao.length) return '<p class="fraca">Esta gravação não tem roteiros cadastrados.</p>';
      const g = gravacoesCache.find(x => x.id === selGravacao.value);
      const avisoStatus = g && g.status && g.status !== 'Gravado'
        ? '<p class="vd-nd-status-grav">Gravação ainda <b>' + esc(g.status) + '</b> — tudo bem, a demanda pode nascer antes de marcar como gravada.</p>'
        : '';
      return avisoStatus + '<label class="rot">Roteiros (marque os que viram demanda — nada é marcado automaticamente)</label>' +
        '<div class="vd-roteiros-lista">' + roteirosDaGravacao.map(r => {
          const codigoExistente = r.ja_tem_demanda ? codigoDemandaExistente(r.id) : '';
          return '<label class="vd-roteiro-item' + (roteiroSelecionados.has(r.id) ? ' on' : '') + (r.ja_tem_demanda ? ' ja' : '') + '"><input type="checkbox" data-roteiro="' + r.id + '"' +
            (roteiroSelecionados.has(r.id) ? ' checked' : '') + (r.ja_tem_demanda ? ' disabled' : '') + '>' +
            '<span><b>' + esc(r.titulo || '(sem título)') + '</b>' + (r.objetivo ? '<small>' + esc(r.objetivo) + '</small>' : '') + '</span>' +
            (r.ja_tem_demanda ? '<span class="vd-badge-ja">já virou demanda' + (codigoExistente ? ' ' + esc(codigoExistente) : '') + '</span>' : '') +
          '</label>';
        }).join('') + '</div>';
    }

    function atualizarModoLote() {
      const n = roteiroSelecionados.size;
      const num3 = m.querySelector('#vd-nd-num3');
      if (num3) num3.textContent = n > 0 ? '2' : '3';
      if (n > 0) {
        cxManual.hidden = true;
        cxPrioridade.hidden = true;
        cxAvisoPrioridade.hidden = false;
        cxAvisoLote.hidden = false;
        cxAvisoLote.textContent = n + ' roteiro' + (n === 1 ? '' : 's') + ' selecionado' + (n === 1 ? '' : 's') +
          ' — ser' + (n === 1 ? 'á criada 1 demanda' : 'ão criadas ' + n + ' demandas') + '.';
        btnSalvar.textContent = n === 1 ? 'Gerar 1 demanda' : 'Gerar ' + n + ' demandas';
      } else {
        cxManual.hidden = false;
        cxPrioridade.hidden = false;
        cxAvisoPrioridade.hidden = true;
        cxAvisoLote.hidden = true;
        btnSalvar.textContent = 'Criar demanda';
      }
    }

    async function carregarGravacoes(clienteId) {
      selGravacao.innerHTML = '<option value="">Carregando…</option>';
      cxRoteiros.innerHTML = '';
      roteiroSelecionados = new Set();
      roteirosDaGravacao = [];
      atualizarModoLote();
      if (!clienteId) { selGravacao.innerHTML = '<option value="">Sem vínculo</option>'; return; }
      try {
        gravacoesCache = await B7.DB.gravacoesDoClienteParaVideo(clienteId) || [];
        selGravacao.innerHTML = '<option value="">Sem vínculo</option>' +
          gravacoesCache.map(g => '<option value="' + g.id + '">' + esc(g.nome) +
            (g.data_gravacao ? ' · ' + esc(B7.UI.dataBR(g.data_gravacao)) : '') +
            (g.status && g.status !== 'Gravado' ? ' · ' + esc(g.status) : '') + '</option>').join('');
      } catch (e) { gravacoesCache = []; selGravacao.innerHTML = '<option value="">Sem vínculo</option>'; }
    }
    carregarGravacoes(selCliente.value);
    selCliente.onchange = () => carregarGravacoes(selCliente.value);

    selGravacao.onchange = async () => {
      const gravacaoId = selGravacao.value;
      roteiroSelecionados = new Set();
      roteirosDaGravacao = [];
      cxRoteiros.innerHTML = '';
      atualizarModoLote();
      if (!gravacaoId) return;
      const g = gravacoesCache.find(x => x.id === gravacaoId);
      definirPrazoSugerido(g && g.data_gravacao);
      /* O checklist de roteiros aparece pra QUALQUER gravação, não só
         pra "Gravado": na prática nem sempre dá tempo de marcar a
         gravação como gravada antes de a edição começar, e exigir isso
         só travava a criação da demanda. O status da gravação vira
         apenas um aviso informativo dentro da lista. */
      cxRoteiros.innerHTML = '<p class="fraca">Carregando roteiros…</p>';
      try {
        const [roteiros, existentes] = await Promise.all([
          B7.DB.roteirosParaAutomacaoVideo(gravacaoId),
          Promise.resolve(demandas.filter(d => d.gravacao_id === gravacaoId && d.editing_status !== 'descartado'))
        ]);
        const comRoteiro = new Set(existentes.filter(d => d.roteiro_id).map(d => d.roteiro_id));
        roteirosDaGravacao = (roteiros || []).map(r => ({ ...r, ja_tem_demanda: comRoteiro.has(r.id) }));
        if (selGravacao.value !== gravacaoId) return; // usuário já trocou de novo
        cxRoteiros.innerHTML = roteirosHTML();
        cxRoteiros.querySelectorAll('[data-roteiro]').forEach(chk => {
          chk.onchange = () => {
            if (chk.checked) roteiroSelecionados.add(chk.dataset.roteiro); else roteiroSelecionados.delete(chk.dataset.roteiro);
            chk.closest('.vd-roteiro-item').classList.toggle('on', chk.checked);
            atualizarModoLote();
          };
        });
      } catch (e) { cxRoteiros.innerHTML = '<p class="fraca">Não foi possível carregar os roteiros desta gravação.</p>'; }
    };

    btnSalvar.onclick = async () => {
      const gravacaoId = selGravacao.value || null;

      /* -------- Modo lote: N roteiros marcados = N demandas -------- */
      if (roteiroSelecionados.size > 0) {
        const n = roteiroSelecionados.size;
        const ok = await B7.UI.confirmar({
          titulo: n === 1 ? '1 roteiro selecionado' : n + ' roteiros selecionados',
          texto: (n === 1 ? 'Será criada 1 demanda de edição.' : 'Serão criadas ' + n + ' demandas de edição.') +
            ' Cada uma nasce com o título do roteiro correspondente.',
          confirmar: n === 1 ? 'Gerar 1 demanda' : 'Gerar ' + n + ' demandas'
        });
        if (!ok) return;
        btnSalvar.disabled = true; btnSalvar.textContent = 'Gerando…';
        try {
          const resultado = await B7.DB.gerarDemandasDeGravacaoVideo(
            gravacaoId, [...roteiroSelecionados],
            m.querySelector('#vd-nd-videomaker').value || null,
            campoPrazo.value || null
          );
          const novas = (resultado || []).filter(r => !r.ja_existia);
          const existiam = (resultado || []).filter(r => r.ja_existia);
          const codigosNovos = novas.map(r => r.codigo).filter(Boolean);
          m.fechar();
          let msg = novas.length + ' demanda' + (novas.length === 1 ? '' : 's') + ' criada' + (novas.length === 1 ? '' : 's') + ' com sucesso';
          if (codigosNovos.length) msg += ' (' + codigosNovos.join(', ') + ')';
          msg += existiam.length ? ' · ' + existiam.length + ' já existia' + (existiam.length === 1 ? '' : 'm') + '.' : '.';
          B7.UI.toast(msg);
          abrir();
        } catch (e) {
          btnSalvar.disabled = false; atualizarModoLote();
          B7.UI.toast(e.message || 'Não foi possível gerar as demandas.');
        }
        return;
      }

      /* -------- Modo manual: comportamento de sempre, inalterado -------- */
      const titulo = m.querySelector('#vd-nd-titulo').value.trim();
      if (!titulo) { B7.UI.toast('Dê um título para a demanda.'); return; }
      btnSalvar.disabled = true; btnSalvar.textContent = 'Criando…';
      try {
        await B7.DB.criarDemandaVideo({
          clienteId: selCliente.value,
          titulo,
          codigo: m.querySelector('#vd-nd-codigo').value.trim(),
          pacote: m.querySelector('#vd-nd-pacote').value.trim(),
          prazo: campoPrazo.value || null,
          videomakerId: m.querySelector('#vd-nd-videomaker').value || null,
          gravacaoId,
          prioridade: m.querySelector('#vd-nd-prioridade').value,
          competenciaAno: compAtual ? Number(compAtual[0]) : null,
          competenciaMes: compAtual ? Number(compAtual[1]) : null
        });
        m.fechar();
        B7.UI.toast('Demanda criada.');
        abrir();
      } catch (e) {
        btnSalvar.disabled = false; btnSalvar.textContent = 'Criar demanda';
        B7.UI.toast(e.message || 'Não foi possível criar a demanda.');
      }
    };
  }

  /* =================================================================
     DESCARTADOS — arquivo à parte; não polui a produção ativa mas o
     histórico continua consultável (nada é apagado de verdade).
     ================================================================= */
  function modalDescartados(lista) {
    const ordenada = [...lista].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
    const m = B7.UI.modal(
      '<h3>Descartados <span class="vd-contagem">' + ordenada.length + '</span></h3>' +
      '<p class="fraca">Demandas marcadas como descartadas. Nada foi apagado — só ficam fora da produção ativa.</p>' +
      '<div class="vd-lista-modal">' +
      (ordenada.length ? ordenada.map(d =>
        '<div class="vd-lm-item" data-demanda="' + d.id + '" tabindex="0" role="button">' +
          logoClienteHTML(d, 'md') +
          '<div class="vd-lm-tx"><small>' + esc(d.cliente_nome || '—') + (d.codigo ? ' · <span class="vd-codigo">' + esc(d.codigo) + '</span>' : '') + '</small>' +
            '<b>' + tituloComFallback(d) + '</b>' +
            '<div class="vd-lm-meta">' +
              (d.competencia_ano ? '<span>' + esc(competenciaRotulo(competenciaChave(d))) + '</span>' : '') +
              '<span>' + quemHTML(d) + '</span>' +
              (d.updated_at ? '<span>descartada em ' + esc(B7.UI.dataBR(d.updated_at.slice(0, 10))) + '</span>' : '') +
            '</div></div>' +
          '<span class="vd-lm-seta">' + IC.seta + '</span>' +
        '</div>').join('') : '<div class="vd-rot-vazio"><b>Nenhuma demanda descartada.</b></div>') +
      '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>');
    m.querySelectorAll('[data-demanda]').forEach(tr => {
      tr.onclick = () => { m.fechar(); location.hash = '#/video/' + tr.dataset.demanda; };
      tr.onkeydown = e => { if (e.key === 'Enter') tr.click(); };
    });
  }

  /* =================================================================
     PACOTES PREDEFINIDOS — catálogo de sugestões pro campo "Pacote"
     (migration_video_pacotes.sql). Não é obrigatório nem trava texto
     livre — só evita redigitar/variar o nome toda vez.
     ================================================================= */
  function modalPacotes() {
    const conteudo = () => {
      const linhas = [...pacotesVideoCache].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      return '<h3>Pacotes</h3>' +
        '<p class="sub">Sugestões pro campo "Pacote" das demandas. A cota mensal alimenta a Gestão (quantos vídeos o cliente contratou × quantos foram entregues).</p>' +
        '<form id="vd-pct-form" class="vd-pct-form">' +
          '<input class="campo" id="vd-pct-nome" placeholder="Novo pacote — ex.: B7 Play" autocomplete="off" data-foco>' +
          '<button class="b pri" type="submit">' + IC.mais + 'Adicionar</button>' +
        '</form>' +
        (linhas.length
          ? '<div class="vd-pacotes-adm">' + linhas.map(p =>
              '<div class="vd-pacote-item"><span class="vd-pacote-ico">' + IC.pacote + '</span><span class="vd-pacote-nome">' + esc(p.nome) + '</span>' +
              '<label class="vd-pacote-cota"><input class="campo vd-pacote-quota" type="number" min="1" step="1" placeholder="—" inputmode="numeric" ' +
                'data-quota-pacote="' + p.id + '" value="' + (p.quantidade_contratada || '') + '" aria-label="Cota mensal"><span>vídeos/mês</span></label>' +
              '<button class="vd-cm-excluir" data-excluir-pacote="' + p.id + '" title="Excluir pacote" aria-label="Excluir pacote">×</button></div>').join('') + '</div>'
          : '<div class="vd-rot-vazio"><b>Nenhum pacote ainda.</b><p>Cadastre o primeiro acima.</p></div>') +
        '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>';
    };

    const atualizarDatalists = () => {
      document.querySelectorAll('#vd-pacotes-lista').forEach(dl => {
        dl.innerHTML = pacotesVideoCache.map(p => '<option value="' + esc(p.nome) + '">').join('');
      });
    };

    const m = B7.UI.modal(conteudo());
    const redesenhar = () => {
      m.querySelector('.modal').innerHTML = conteudo();
      m.querySelectorAll('[data-fecha]').forEach(b => b.onclick = m.fechar);
      ligar();
    };
    function ligar() {
      const form = m.querySelector('#vd-pct-form');
      if (form) form.onsubmit = async e => {
        e.preventDefault();
        const nome = m.querySelector('#vd-pct-nome').value.trim();
        if (!nome) return;
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
          await B7.DB.criarPacoteVideo(nome);
          pacotesVideoCache = await B7.DB.pacotesVideo().catch(() => pacotesVideoCache);
          atualizarDatalists();
          redesenhar();
        } catch (err) { btn.disabled = false; B7.UI.toast(err.message || 'Não foi possível criar o pacote.'); }
      };
      m.querySelectorAll('[data-excluir-pacote]').forEach(btn => {
        btn.onclick = async () => {
          const ok = await B7.UI.confirmar({
            titulo: 'Excluir este pacote?',
            texto: 'Só some da lista de sugestões — não muda nenhuma demanda já cadastrada com esse pacote.',
            perigo: true, rotulo: 'Excluir'
          });
          if (!ok) return;
          try {
            await B7.DB.excluirPacoteVideo(btn.dataset.excluirPacote);
            pacotesVideoCache = await B7.DB.pacotesVideo().catch(() => pacotesVideoCache);
            atualizarDatalists();
            redesenhar();
          } catch (err) { B7.UI.toast(err.message || 'Não foi possível excluir.'); }
        };
      });
      /* Cota (quantidade_contratada): salva ao sair do campo ou Enter —
         null quando vazio (limpa a cota, volta a ser só sugestão). */
      m.querySelectorAll('[data-quota-pacote]').forEach(inp => {
        const salvar = async () => {
          const bruto = inp.value.trim();
          const qtd = bruto ? Number(bruto) : null;
          if (bruto && (!Number.isFinite(qtd) || qtd <= 0)) { B7.UI.toast('A cota precisa ser um número maior que zero.'); return; }
          try {
            await B7.DB.definirQuotaPacoteVideo(inp.dataset.quotaPacote, qtd);
            pacotesVideoCache = await B7.DB.pacotesVideo().catch(() => pacotesVideoCache);
            B7.UI.toast('Cota atualizada.');
          } catch (err) { B7.UI.toast(err.message || 'Não foi possível salvar a cota.'); }
        };
        inp.onblur = salvar;
        inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } };
      });
    }
    ligar();
  }

  /* =================================================================
     GESTÃO — resumo do mês, carga da equipe, produção por cliente,
     relatório por videomaker e fechamento mensal (Parte 3,
     migration_video_gestao.sql). Tudo calculado no banco (agregação em
     SQL, não soma linha por linha no navegador).
     ================================================================= */
  function numFmt(n) { return (n === null || n === undefined) ? '—' : String(n); }
  function diasFmt(n) { return (n === null || n === undefined) ? '—' : n + ' dia' + (n === 1 ? '' : 's'); }

  /* Visão simples de gargalo: entre os status em aberto, qual concentra
     mais demandas agora. Não é mineração de processo — só ajuda a
     enxergar rápido se o entrave é a equipe (em_edicao/correcao/pendente)
     ou o cliente (aguardando_aprovacao) ou algo parado (standby). */
  const GARGALO_ROTULOS = {
    pendente: 'Pendente (ainda não iniciadas)',
    em_edicao: 'Em edição',
    aguardando_aprovacao: 'Aguardando aprovação do cliente',
    correcao: 'Em correção',
    standby: 'Em standby'
  };
  const GARGALO_LEITURA = {
    pendente: 'a fila de início — a equipe ainda não começou essas demandas.',
    em_edicao: 'o trabalho de edição em si — a equipe está com essas demandas em mãos.',
    aguardando_aprovacao: 'a resposta do cliente, não a equipe — essas demandas já foram entregues para aprovação.',
    correcao: 'o ciclo de correção — a equipe está retrabalhando essas demandas.',
    standby: 'demandas paradas por decisão registrada — vale revisar se ainda cabe esperar.'
  };
  function gargaloHTML(porStatus) {
    const chaves = Object.keys(GARGALO_ROTULOS);
    const total = chaves.reduce((s, k) => s + (porStatus[k] || 0), 0);
    if (!total) return '';
    let maior = null;
    chaves.forEach(k => {
      const n = porStatus[k] || 0;
      if (n > 0 && (!maior || n > porStatus[maior])) maior = k;
    });
    if (!maior) return '';
    const n = porStatus[maior] || 0;
    const pct = Math.round((n / total) * 100);
    // Só destaca quando o status realmente concentra a maior parte do trabalho em aberto.
    if (pct < 40) return '';
    return '<p class="vd-gargalo"><b>' + numFmt(n) + '</b> de <b>' + numFmt(total) + '</b> demandas em aberto (' + pct + '%) estão em <b>' +
      esc(GARGALO_ROTULOS[maior]) + '</b> — hoje o gargalo é ' + esc(GARGALO_LEITURA[maior]) + '</p>';
  }

  function modalGestao() {
    const compChave = (F.competencia && F.competencia !== 'todas') ? F.competencia : mesAtualChave();
    const [anoIni, mesIni] = compChave.split('-').map(Number);
    let estado = { ano: anoIni, mes: mesIni, carregando: true, erro: null,
      resumo: null, carga: [], porCliente: [], porVideomaker: [], fechado: false };

    const cascaHTML = () =>
      '<div class="vd-gestao-topo"><div><h3>Gestão</h3><p class="sub">Produção de vídeo por competência.</p></div>' +
      '<div class="vd-gestao-comp">' +
        '<select class="campo" id="vg-comp" aria-label="Competência">' +
          competenciasDisponiveis().filter(c => c !== 'todas').map(c =>
            '<option value="' + c + '"' + (c === (estado.ano + '-' + String(estado.mes).padStart(2, '0')) ? ' selected' : '') + '>' + esc(competenciaRotulo(c)) + '</option>').join('') +
        '</select>' +
        (estado.fechado ? '<span class="vd-badge-fechado">Mês fechado</span>' : '') +
      '</div></div>' +
      '<div id="vg-corpo">' + (estado.carregando ? B7.UI.skeleton('tabela', { n: 4, cols: 3 }) :
        estado.erro ? '<p class="fraca">' + esc(estado.erro) + '</p>' : corpoHTML()) + '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>';

    function corpoHTML() {
      const r = estado.resumo || {};
      const porStatus = r.por_status || {};
      const abertas = ['pendente', 'em_edicao', 'aguardando_aprovacao', 'correcao', 'standby']
        .reduce((s, k) => s + (porStatus[k] || 0), 0);
      return (
        '<div class="vd-gestao-cards">' +
          '<div class="vg-card vg-total"><b>' + numFmt(r.total) + '</b><span>demandas no mês</span></div>' +
          '<div class="vg-card' + (r.atrasadas ? ' vg-alerta' : ' vg-ok') + '"><b>' + numFmt(r.atrasadas) + '</b><span>atrasadas</span></div>' +
          '<div class="vg-card' + (r.vence_hoje ? ' vg-atencao' : '') + '"><b>' + numFmt(r.vence_hoje) + '</b><span>vencem hoje</span></div>' +
          '<div class="vg-card vg-ok"><b>' + numFmt(r.entregues_no_prazo) + '</b><span>entregues no prazo</span></div>' +
          '<div class="vg-card"><b>' + numFmt(r.entregues_com_atraso) + '</b><span>entregues com atraso</span></div>' +
          '<div class="vg-card"><b>' + diasFmt(r.tempo_medio_producao_dias) + '</b><span>tempo médio de produção' +
            (r.demandas_com_tempo_medido ? '<em>' + r.demandas_com_tempo_medido + ' medida' + (r.demandas_com_tempo_medido === 1 ? '' : 's') + '</em>' : '') + '</span></div>' +
          '<div class="vg-card vg-larga"><b>' + numFmt(r.ciclos_correcao_total) + '</b><span>ciclos de correção<em>cliente ' + numFmt(r.ciclos_correcao_cliente) + ' · interna ' + numFmt(r.ciclos_correcao_interna) + '</em></span></div>' +
        '</div>' +
        '<p class="fraca">Tempo médio de produção mede do início da edição até o primeiro envio para aprovação — só conta demandas com essa trilha de eventos completa (ver nota no rodapé). Ciclo de correção "cliente" é uma inferência sobre o texto da decisão registrada, não um campo estruturado à parte.</p>' +
        gargaloHTML(porStatus) +

        '<h4>Carga da equipe (agora)</h4>' +
        '<div class="tabela-rolavel"><table class="vd-tabela"><thead><tr>' +
        '<th>Videomaker</th><th>P/ iniciar</th><th>Em edição</th><th>Correção</th><th>Aguard. aprov.</th><th>Standby</th><th>Atrasadas</th><th>Vence hoje</th><th>Total ativo</th>' +
        '</tr></thead><tbody>' +
        (estado.carga.length ? estado.carga.map(v =>
          '<tr><td data-rot="Videomaker">' + esc(v.videomaker_nome) + '</td><td data-rot="P/ iniciar">' + v.para_iniciar + '</td><td data-rot="Em edição">' + v.em_edicao + '</td>' +
          '<td data-rot="Correção">' + v.correcao + '</td><td data-rot="Aguard. aprov.">' + v.aguardando_aprovacao + '</td><td data-rot="Standby">' + v.standby + '</td>' +
          '<td data-rot="Atrasadas"' + (v.atrasadas ? ' class="vd-cel-alerta"' : '') + '>' + v.atrasadas + '</td><td data-rot="Vence hoje">' + v.vence_hoje + '</td><td data-rot="Total ativo">' + v.total_ativo + '</td></tr>').join('')
          : '<tr><td colspan="9"><i class="vd-sem">Sem videomakers ativos.</i></td></tr>') +
        '</tbody></table></div>' +

        '<h4>Produção por cliente</h4>' +
        '<div class="tabela-rolavel"><table class="vd-tabela"><thead><tr>' +
        '<th>Cliente</th><th>Pacote</th><th>Cota/mês</th><th>Total</th><th>Entregues</th><th>Em produção</th><th>Aguard. aprov.</th><th>Correção</th>' +
        '</tr></thead><tbody>' +
        (estado.porCliente.length ? estado.porCliente.map(c =>
          '<tr><td data-rot="Cliente">' + esc(c.client_nome) + '</td><td data-rot="Pacote">' + (c.pacote ? esc(c.pacote) : '<i class="vd-sem">sem pacote</i>') + '</td>' +
          '<td data-rot="Cota/mês">' + (c.quantidade_contratada != null ? c.quantidade_contratada : '<i class="vd-sem">não definida</i>') + '</td>' +
          '<td data-rot="Total">' + c.total + '</td><td data-rot="Entregues">' + c.entregues + '</td><td data-rot="Em produção">' + c.em_producao + '</td><td data-rot="Aguard. aprov.">' + c.aguardando_aprovacao + '</td><td data-rot="Correção">' + c.correcao + '</td></tr>').join('')
          : '<tr><td colspan="8"><i class="vd-sem">Nenhuma demanda nesta competência.</i></td></tr>') +
        '</tbody></table></div>' +
        '<p class="fraca">Cota/mês só aparece quando alguém define uma quantidade contratada pro pacote com esse nome exato (ver "Pacotes") — sem isso, nunca inventamos uma cota.</p>' +

        '<h4>Relatório por videomaker</h4>' +
        '<div class="tabela-rolavel"><table class="vd-tabela"><thead><tr>' +
        '<th>Videomaker</th><th>Entregues</th><th>Em edição</th><th>Aguard. aprov.</th><th>Correção</th><th>Entregues c/ atraso</th><th>Tempo médio</th>' +
        '</tr></thead><tbody>' +
        (estado.porVideomaker.length ? estado.porVideomaker.map(v =>
          '<tr><td data-rot="Videomaker">' + esc(v.videomaker_nome) + '</td><td data-rot="Entregues">' + v.entregues + '</td><td data-rot="Em edição">' + v.em_edicao + '</td>' +
          '<td data-rot="Aguard. aprov.">' + v.aguardando_aprovacao + '</td><td data-rot="Correção">' + v.correcao + '</td><td data-rot="Entregues c/ atraso">' + v.entregues_com_atraso + '</td>' +
          '<td data-rot="Tempo médio">' + diasFmt(v.tempo_medio_producao_dias) + '</td></tr>').join('')
          : '<tr><td colspan="7"><i class="vd-sem">Nenhuma demanda nesta competência.</i></td></tr>') +
        '</tbody></table></div>' +

        '<h4>Fechamento mensal</h4>' +
        (estado.fechado
          ? '<p class="fraca">Este mês está fechado. O fechamento não impede reabrir — é um retrato (snapshot), não uma trava definitiva.</p>' +
            '<div class="acoes-inline"><button class="b contorno" id="vg-reabrir">Reabrir mês</button></div>'
          : (abertas
              ? '<p class="vd-aviso-texto"><b>' + abertas + '</b> demanda' + (abertas === 1 ? '' : 's') + ' ainda em aberto nesta competência (não entregue nem descartada).</p>'
              : '<p class="fraca">Nenhuma pendência em aberto nesta competência.</p>') +
            '<div class="acoes-inline"><button class="b pri" id="vg-fechar">Fechar mês</button></div>')
      );
    }

    const m = B7.UI.modal(cascaHTML(), { larga: true, extra: 'vd-modal-gestao' });

    async function carregar() {
      estado.carregando = true; estado.erro = null;
      m.querySelector('.modal').innerHTML = cascaHTML();
      ligarTopo();
      try {
        const [resumo, carga, porCliente, porVideomaker, fechado] = await Promise.all([
          B7.DB.resumoGestaoVideo(estado.ano, estado.mes),
          B7.DB.cargaEquipeVideo(),
          B7.DB.producaoPorClienteVideo(estado.ano, estado.mes),
          B7.DB.relatorioPorVideomakerVideo(estado.ano, estado.mes),
          B7.DB.mesFechadoVideo(estado.ano, estado.mes)
        ]);
        estado.resumo = resumo || {};
        estado.carga = carga || [];
        estado.porCliente = porCliente || [];
        estado.porVideomaker = porVideomaker || [];
        estado.fechado = !!fechado;
      } catch (e) {
        estado.erro = e.message || 'Não foi possível carregar a gestão deste mês.';
      }
      estado.carregando = false;
      m.querySelector('.modal').innerHTML = cascaHTML();
      ligarTopo();
      ligarCorpo();
    }

    function ligarTopo() {
      m.querySelectorAll('[data-fecha]').forEach(b => b.onclick = m.fechar);
      const sel = m.querySelector('#vg-comp');
      if (sel) sel.onchange = () => {
        const [a, mm] = sel.value.split('-').map(Number);
        estado.ano = a; estado.mes = mm;
        carregar();
      };
    }
    function ligarCorpo() {
      const btFechar = m.querySelector('#vg-fechar');
      if (btFechar) btFechar.onclick = async () => {
        const ok = await B7.UI.confirmar({
          titulo: 'Fechar ' + esc(competenciaRotulo(estado.ano + '-' + String(estado.mes).padStart(2, '0'))) + '?',
          texto: 'Guarda um retrato das métricas de agora. Não apaga nem trava nada — dá pra reabrir quando quiser.',
          rotulo: 'Fechar mês'
        });
        if (!ok) return;
        btFechar.disabled = true;
        try {
          await B7.DB.fecharMesVideo(estado.ano, estado.mes, estado.resumo || {});
          B7.UI.toast('Mês fechado.');
          carregar();
        } catch (e) { btFechar.disabled = false; B7.UI.toast(e.message || 'Não foi possível fechar o mês.'); }
      };
      const btReabrir = m.querySelector('#vg-reabrir');
      if (btReabrir) btReabrir.onclick = async () => {
        const ok = await B7.UI.confirmar({
          titulo: 'Reabrir este mês?',
          texto: 'O mês volta a poder receber alterações normalmente.',
          rotulo: 'Reabrir'
        });
        if (!ok) return;
        btReabrir.disabled = true;
        try {
          await B7.DB.reabrirMesVideo(estado.ano, estado.mes);
          B7.UI.toast('Mês reaberto.');
          carregar();
        } catch (e) { btReabrir.disabled = false; B7.UI.toast(e.message || 'Não foi possível reabrir o mês.'); }
      };
    }

    ligarTopo();
    carregar();
  }

  /* =================================================================
     AUTOMAÇÃO GRAVAÇÃO → EDIÇÃO — antes vivia num modal separado
     (modalGerarDemandas, acionado por um botão próprio "Gerar de
     gravação", com sua própria cópia da lógica de checklist de
     roteiros). Fundida dentro do modal "Nova demanda de edição"
     (modalNovaDemanda acima), que agora é a ÚNICA fonte de verdade pra
     criação manual E geração em lote — a equipe não precisa mais criar
     a demanda, abrir, vincular gravação e roteiro um por um, nem abrir
     uma segunda tela pra gerar em lote: basta escolher a gravação
     dentro do próprio "+ Nova demanda". O botão "Gerar de gravação" e
     a função modalGerarDemandas foram removidos — eles só abriam esse
     mesmo modal sem nenhuma lógica própria, e mantê-los como um botão
     separado abrindo uma tela idêntica só confundia (relatado pelo
     usuário: "a tela de Gerar de gravação tá com a mesma tela do Nova
     demanda").
     ================================================================= */

  /* Roteiro(s) vinculado(s) — uma demanda pode ter vários roteiros. A
     escrita sempre substitui o conjunto inteiro (video_definir_roteiros),
     então tanto remover um chip quanto adicionar um novo mandam a lista
     completa de novo.

     Esta função chegou a sumir do arquivo numa fusão de versões: os
     handlers em ligarDetalhe (data-remover-roteiro, vd-dt-roteiro-add)
     continuaram aqui, mas a função que desenha o bloco não — e como ela é
     chamada no meio da montagem do HTML do detalhe, o ReferenceError
     interrompia a renderização inteira e a tela ficava eternamente no
     esqueleto de carregamento. */
  /* =================================================================
     ROTEIROS DA DEMANDA — o videomaker precisa LER o roteiro sem sair
     da demanda. Cada roteiro vinculado vira um cartão com título,
     objetivo, situação e as cenas (lidas aqui mesmo, expandindo), mais
     a ficha A4 (espiada) e o atalho pro editor. `rc` é o contexto de
     roteiros carregado em abrirDetalhe: { gravacao, roteiros (todos da
     gravação), cenasPorRoteiro (só dos vinculados) }.
     ================================================================= */
  function cenaLeituraHTML(c, i) {
    const tipo = c.tipo || 'Narrativa';
    const etiqueta = (c.funcao && c.funcao.trim()) ? c.funcao.trim() : tipo;
    const paragrafos = t => String(t || '').split('\n').map(x => x.trim()).filter(Boolean).map(x => '<p>' + esc(x) + '</p>').join('') || '<p class="fraca">(sem texto)</p>';
    return '<div class="vd-rot-cena vd-rot-cena-' + esc(tipo.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()) + '">' +
      '<div class="vd-rot-cena-cab"><b>Cena ' + (i + 1) + '</b><span>' + esc(etiqueta) + '</span>' +
        (c.direcao ? '<i>' + esc(c.direcao) + '</i>' : '') + '</div>' +
      '<div class="vd-rot-cena-txt">' + paragrafos(c.texto) + '</div>' +
      (tipo === 'Narração' && String(c.sugestao_cenas || '').trim()
        ? '<div class="vd-rot-cena-sug"><b>Sugestão de cenas</b>' + paragrafos(c.sugestao_cenas) + '</div>' : '') +
    '</div>';
  }

  function secaoRoteiros(d, rc, podeEditar) {
    const vinc = d.roteiros_vinculados || [];
    const todos = (rc && rc.roteiros) || [];
    const cenasPor = (rc && rc.cenasPorRoteiro) || {};
    const abertoPorPadrao = vinc.length === 1;

    const cartoes = vinc.map(v => {
      const r = todos.find(x => x.id === v.id) || v;
      const idx = todos.findIndex(x => x.id === v.id);
      const cenas = cenasPor[v.id] || [];
      const num = idx >= 0 ? String(idx + 1).padStart(2, '0') : '—';
      return '<article class="vd-rot' + (abertoPorPadrao ? ' aberto' : '') + '" data-roteiro-card="' + esc(v.id) + '">' +
        '<header class="vd-rot-cab">' +
          '<div class="vd-rot-num">ROTEIRO ' + num + '</div>' +
          '<div class="vd-rot-tit"><h3>' + esc(r.titulo || '(sem título)') + '</h3>' +
            (r.objetivo ? '<p>' + esc(r.objetivo) + '</p>' : '') + '</div>' +
          '<div class="vd-rot-meta">' + (r.status ? B7.UI.chipRevisao(r.status) : '') +
            '<span>' + cenas.length + ' cena' + (cenas.length === 1 ? '' : 's') + '</span></div>' +
        '</header>' +
        '<div class="vd-rot-acoes">' +
          '<button type="button" class="b fina" data-rot-ler="' + esc(v.id) + '" aria-expanded="' + (abertoPorPadrao ? 'true' : 'false') + '">' +
            (abertoPorPadrao ? 'Recolher' : 'Ler roteiro') + '</button>' +
          (idx >= 0 ? '<button type="button" class="b fina contorno" data-rot-ficha="' + esc(v.id) + '">Ficha A4</button>' : '') +
          (d.gravacao_id ? '<a class="b fina contorno" href="#/gravacao/' + esc(d.gravacao_id) + '?roteiro=' + esc(v.id) + '">Abrir no editor</a>' : '') +
          (podeEditar ? '<button type="button" class="b fina contorno vd-rot-remover" data-remover-roteiro="' + esc(v.id) + '" title="Desvincular da demanda">Desvincular</button>' : '') +
        '</div>' +
        '<div class="vd-rot-corpo" id="vd-rot-corpo-' + esc(v.id) + '"' + (abertoPorPadrao ? '' : ' hidden') + '>' +
          (cenas.length ? cenas.map(cenaLeituraHTML).join('') : '<p class="fraca">Este roteiro ainda não tem cenas escritas.</p>') +
        '</div>' +
      '</article>';
    }).join('');

    const vazio = !vinc.length
      ? '<div class="vd-rot-vazio"><b>Nenhum roteiro vinculado.</b>' +
        '<p>' + (d.gravacao_id
          ? 'Escolha um roteiro da gravação vinculada para o videomaker ler aqui mesmo.'
          : 'Vincule uma gravação (no painel ao lado) para poder escolher roteiros dela.') + '</p></div>'
      : '';

    const adicionar = podeEditar && d.gravacao_id
      ? '<div class="vd-link-linha vd-rot-add"><select class="campo" id="vd-dt-roteiro-add"><option value="">Carregando roteiros…</option></select>' +
        '<button class="b" id="vd-dt-roteiro-add-bt" disabled>Vincular</button></div>'
      : '';

    return '<section class="vd-bloco vd-bloco-roteiros">' +
      '<div class="vd-bloco-cab"><label class="rot">Roteiro' + (vinc.length === 1 ? '' : 's') + (vinc.length ? ' · ' + vinc.length : '') + '</label>' +
        (rc && rc.gravacao && rc.gravacao.status && rc.gravacao.status !== 'Gravado'
          ? '<span class="vd-rot-grav-status" title="Situação da gravação vinculada">Gravação: ' + esc(rc.gravacao.status) + '</span>' : '') +
      '</div>' +
      cartoes + vazio + adicionar +
    '</section>';
  }

  /* Contexto pra espiada da ficha A4 (B7.QuickView.abrir usa o mesmo
     formato da impressão). */
  function ctxQuickViewDe(d, rc) {
    const g = rc.gravacao || {};
    return {
      cliente: g.cliente_nome || d.cliente_nome || '',
      clienteLogo: g.cliente_logo_url || d.cliente_logo_url || null,
      gravacao: g.nome || d.gravacao_nome || '',
      dataGravacao: g.data_gravacao ? B7.UI.dataBR(g.data_gravacao) : '',
      gravacaoId: d.gravacao_id,
      roteiros: rc.roteiros || [],
      cenasPorRoteiro: rc.cenasPorRoteiro || {}
    };
  }

  /* Faixa de resumo sob o título: o estado da demanda de relance, sem
     precisar correr o olho pelo painel lateral. */
  const ETAPAS = [['pendente', 'Pendente'], ['em_edicao', 'Em edição'], ['aguardando_aprovacao', 'Aprovação'], ['entregue', 'Entregue']];
  function etapasHTML(d) {
    const st = d.editing_status;
    const idx = { pendente: 0, em_edicao: 1, correcao: 1, standby: 1, aguardando_aprovacao: 2, entregue: 3, descartado: -1 }[st];
    const rotuloAtual = st === 'correcao' ? 'Em correção' : st === 'standby' ? 'Standby' : null;
    return '<ol class="vd-etapas' + (st === 'descartado' ? ' descartada' : '') + '">' + ETAPAS.map(([k, r], i) => {
      const cls = i < idx ? 'feita' : i === idx ? 'atual' : '';
      const rot = (i === idx && rotuloAtual) ? rotuloAtual : r;
      return '<li class="' + cls + (i === idx && (st === 'correcao' || st === 'standby') ? ' desvio' : '') + '"><i>' + (i < idx ? '✓' : i + 1) + '</i><span>' + esc(rot) + '</span></li>';
    }).join('') + '</ol>';
  }

  function faixaResumoHTML(d, atrasada) {
    const partes = [
      (d.editing_status === 'descartado' ? statusBadge(d.editing_status) : ''),
      (d.prioridade && d.prioridade !== 'normal' ? prioridadeBadge(d.prioridade) : ''),
      '<span class="vd-resumo-item' + (atrasada ? ' atrasado' : '') + '">' +
        (d.prazo ? 'Prazo ' + esc(B7.UI.dataBR(d.prazo)) + (atrasada ? ' · atrasada' : '') : 'Sem prazo') + '</span>',
      '<span class="vd-resumo-item">' + quemHTML(d) + '</span>'
    ];
    if (d.gravacao_nome) partes.push('<span class="vd-resumo-item">🎬 ' + esc(d.gravacao_nome) + '</span>');
    return '<div class="vd-resumo">' + partes.filter(Boolean).join('') + '</div>';
  }

  /* Checklist de conclusão — o processo real da B7: manda no grupo de
     concluídos e sobe no Drive. Registrar versão é opcional (serve pra
     aprovação pelo sistema). As colunas só existem depois de
     migration_video_conclusao.sql: sem elas, o bloco não aparece. */
  function secaoConclusao(d, podeOperar) {
    if (d.enviado_grupo_em === undefined) return '';
    const feitas = [d.enviado_grupo_em, d.upado_drive_em].filter(Boolean).length;
    const item = (etapa, ts, rot, sub) =>
      '<label class="vd-check' + (ts ? ' on' : '') + (podeOperar ? '' : ' so-leitura') + '">' +
        '<input type="checkbox" data-conclusao="' + etapa + '"' + (ts ? ' checked' : '') + (podeOperar ? '' : ' disabled') + '>' +
        '<span class="vd-check-cx"></span>' +
        '<span class="vd-check-tx"><b>' + rot + '</b><small>' + (ts ? 'feito ' + esc(quandoBR(ts)) : sub) + '</small></span>' +
      '</label>';
    const entregar = podeOperar && feitas === 2 && d.editing_status !== 'entregue' && d.editing_status !== 'descartado'
      ? '<div class="vd-conclusao-pronta"><span>Tudo feito. Quer fechar a demanda?</span><button class="b pri fina" id="vd-marcar-entregue">Marcar como entregue</button></div>'
      : '';
    return '<section class="vd-bloco vd-bloco-conclusao' + (feitas === 2 ? ' completa' : '') + '">' +
      '<div class="vd-bloco-cab"><label class="rot">Conclusão</label><span class="vd-progresso"><i style="width:' + (feitas * 50) + '%"></i></span><small>' + feitas + ' de 2</small></div>' +
      '<div class="vd-checks">' +
        item('grupo', d.enviado_grupo_em, 'Enviado no grupo de concluídos', 'WhatsApp da equipe') +
        item('drive', d.upado_drive_em, 'Upado no Drive', 'na pasta do cliente') +
      '</div>' +
      (podeOperar
        ? '<div class="vd-dt-campo vd-dt-link"><label class="rot">Link no Drive <em>opcional</em></label>' +
          '<div class="vd-link-linha"><input class="campo" id="vd-dt-link" placeholder="https://drive.google.com/…" value="' + esc(d.link_material || '') + '">' +
          '<button class="b" id="vd-dt-link-salvar">Salvar</button></div></div>'
        : (d.link_material ? '<a class="b fina contorno vd-abrir-materiais" href="' + esc(d.link_material) + '" target="_blank" rel="noopener">Abrir no Drive</a>' : '')) +
      (podeOperar && d.link_material ? '<a class="b fina contorno vd-abrir-materiais" href="' + esc(d.link_material) + '" target="_blank" rel="noopener">Abrir no Drive</a>' : '') +
      entregar +
    '</section>';
  }

  /* =================================================================
     DETALHE DE UMA DEMANDA — layout principal + painel lateral
     ================================================================= */
  async function abrirDetalhe(id) {
    B7.Dashboard.marcarNav('#/video');
    B7.Rota.titulo(['Produção de Vídeo', 'Demanda']);
    painel().innerHTML = '<div class="conteudo vd-tela">' + B7.UI.skeleton('lista', { n: 4 }) + '</div>';

    let d, historico;
    const rc = { gravacao: null, roteiros: [], cenasPorRoteiro: {} };
    try {
      /* Tudo que a tela precisa vai junto, numa rodada só. Antes eram três
         `await` em fila (clientes → videomakers → pacotes) DEPOIS do lote
         principal, e ainda uma consulta de comentários POR VERSÃO: numa
         conexão ruim cada ida e volta somava, e a tela ficava no esqueleto
         esperando requisições que nem dependiam uma da outra. Os
         comentários agora vêm de uma consulta só, filtrada por demanda
         (video_comentarios_resumo já traz demanda_id), e são separados por
         versão aqui no cliente. */
      const equipe = souEquipe();
      const chamadas = [
        B7.DB.demandaVideo(id),
        B7.DB.historicoDemandaVideo(id),
        B7.DB.versoesDemandaVideo(id).catch(() => []),
        B7.DB.comentariosDemandaVideo(id).catch(() => []),
        equipe && !clientes.length ? B7.DB.listarClientes().catch(() => null) : Promise.resolve(null),
        equipe && !videomakers.length ? B7.DB.listarVideomakers().catch(() => null) : Promise.resolve(null),
        equipe && !pacotesVideoCache.length ? B7.DB.pacotesVideo().catch(() => null) : Promise.resolve(null)
      ];
      /* Rede que trava (sem resposta e sem erro) deixava a tela no
         esqueleto pra sempre — o usuário só via "carregando" eternamente.
         Com teto de tempo, isso vira um erro com botão de tentar de novo. */
      const [dd, hh, vv, cc, cl, vm, pc] = await comTempoLimite(Promise.all(chamadas), 20000);
      d = dd; historico = hh; versoesAtual = vv;
      if (cl) clientes = cl;
      if (vm) videomakers = vm;
      if (pc) pacotesVideoCache = pc;
      comentariosPorVersao = {};
      (cc || []).forEach(c => {
        (comentariosPorVersao[c.versao_id] = comentariosPorVersao[c.versao_id] || []).push(c);
      });

      /* Segunda rodada, só quando há gravação: a gravação (pra ficha
         A4 e pro status), TODOS os roteiros dela (numeração + seletor
         de vínculo) e as cenas só dos vinculados (pra leitura inline).
         Falha aqui não derruba a tela — a demanda abre sem a leitura. */
      if (d.gravacao_id) {
        const idsVinc = (d.roteiros_vinculados || []).map(r => r.id);
        const [g, rs, cs] = await comTempoLimite(Promise.all([
          B7.DB.gravacao(d.gravacao_id).catch(() => null),
          B7.DB.listarRoteiros(d.gravacao_id).catch(() => []),
          idsVinc.length ? B7.DB.listarCenasDaGravacao(idsVinc).catch(() => []) : Promise.resolve([])
        ]), 15000).catch(() => [null, [], []]);
        rc.gravacao = g; rc.roteiros = rs || [];
        (cs || []).forEach(c => { (rc.cenasPorRoteiro[c.script_id] = rc.cenasPorRoteiro[c.script_id] || []).push(c); });
      }
    } catch (e) {
      /* PGRST116 = a consulta com .single() não achou nenhuma linha —
         o caso mais comum é um link antigo (ex.: clique numa notificação
         de dias atrás) apontando pra uma demanda que já foi excluída
         (Lixeira) ou descartada depois que o aviso foi criado. Nesse caso
         a mensagem de erro crua do Postgres ("Cannot coerce…") não ajuda
         ninguém — mostra o motivo real, em português. */
      const excluida = e && (e.code === 'PGRST116' || /coerce the result/i.test(e.message || ''));
      painel().innerHTML = '<div class="conteudo vd-tela"><div class="estado-b7">' +
        (excluida
          ? '<b>Esta demanda não foi encontrada.</b><p>Ela pode ter sido excluída ou movida para a Lixeira desde que o link foi criado.</p>'
          : '<b>Não foi possível abrir esta demanda.</b><p>' + esc(e.message || '') + '</p>') +
        '<div class="acoes">' +
          (excluida ? '' : '<button class="b pri" id="vd-dt-tentar">Tentar de novo</button>') +
          '<button class="b" onclick="location.hash=\'#/video\'">Voltar</button>' +
        '</div></div></div>';
      const btTentar = document.getElementById('vd-dt-tentar');
      if (btTentar) btTentar.onclick = () => abrirDetalhe(id);
      return;
    }

    const podeEditar = souEquipe();
    const podeOperar = possoOperar();
    const atrasada = ehAtrasada(d);
    const correcoes = versoesAtual.filter(v => v.decisao_cliente === 'correcao' || v.decisao_cliente === 'recusado').length;

    const temConclusao = d.enviado_grupo_em !== undefined;
    painel().innerHTML = '<div class="conteudo entra vd-tela vd-detalhe">' +
      '<div class="trilha"><a href="#/video">Produção de Vídeo</a><span>/</span><b>' + esc(d.titulo) + '</b></div>' +
      '<header class="vd-hero">' +
        '<div class="vd-hero-linha">' +
          '<div class="vd-hero-id">' + logoClienteHTML(d, 'lg') +
            '<div class="vd-cab-texto"><p class="vd-hero-cliente"><span>' + esc(d.cliente_nome || '') + '</span>' + (d.codigo ? '<span class="vd-codigo">' + esc(d.codigo) + '</span>' : '') +
              (d.competencia_ano ? '<span class="vd-hero-comp">' + esc(competenciaRotulo(competenciaChave(d))) + '</span>' : '') + '</p>' +
              '<h1>' + tituloComFallback(d) + '</h1>' +
              faixaResumoHTML(d, atrasada) +
            '</div></div>' +
          (podeEditar
            ? '<div class="vd-acoes-topo">' +
              (d.editing_status !== 'descartado' ? '<button class="b fina contorno" id="vd-dt-descartar">Descartar</button>' : '') +
              '<button class="b fina contorno perigo" id="vd-dt-excluir">Excluir</button></div>'
            : '') +
        '</div>' +
        etapasHTML(d) +
      '</header>' +

      '<div class="vd-detalhe-corpo">' +
        '<div class="vd-detalhe-principal">' +
          secaoRoteiros(d, rc, podeEditar) +

          secaoVersoes(d, versoesAtual, podeEditar, podeOperar) +

          secaoConclusao(d, podeOperar) +

          (temConclusao ? '' :
          '<section class="vd-bloco">' +
            '<div class="vd-bloco-cab"><label class="rot">Material editado</label></div>' +
            (d.link_material
              ? '<a class="b pri vd-abrir-materiais" href="' + esc(d.link_material) + '" target="_blank" rel="noopener">Abrir materiais</a>'
              : (podeOperar ? '' : '<div class="vd-so-leitura">Sem materiais vinculados ainda.</div>')) +
            (podeOperar
              ? '<div class="vd-dt-campo vd-dt-link"><div class="vd-link-linha"><input class="campo" id="vd-dt-link" placeholder="https://drive.google.com/…" value="' + esc(d.link_material || '') + '">' +
                '<button class="b" id="vd-dt-link-salvar">Salvar</button></div>' +
                '<p class="fraca">Link externo (Drive, WeTransfer…) — o vídeo não é enviado para dentro do sistema.</p></div>'
              : '') +
          '</section>') +

          (podeEditar
            ? '<section class="vd-bloco"><div class="vd-bloco-cab"><label class="rot">Observações</label><span class="vd-autosave-dica" id="vd-obs-estado"></span></div>' +
              '<textarea class="campo alta" id="vd-dt-obs" rows="4" placeholder="Orientações para a edição, referências, pontos de atenção…">' + esc(d.observacoes || '') + '</textarea></section>'
            : (d.observacoes ? '<section class="vd-bloco"><div class="vd-bloco-cab"><label class="rot">Observações</label></div><div class="vd-so-leitura">' + esc(d.observacoes) + '</div></section>' : '')) +

          '<section class="vd-bloco"><div class="vd-bloco-cab"><label class="rot">Histórico</label></div>' +
          (historico.length
            ? '<ul class="vd-timeline">' + historico.map(linhaHistorico).join('') + '</ul>'
            : '<div class="vd-so-leitura">Sem eventos ainda.</div>') +
          '</section>' +
        '</div>' +

        '<aside class="vd-detalhe-lateral">' +
          '<div class="vd-lat-grupo"><div class="vd-lat-titulo">Fluxo</div>' +
          '<div class="vd-dt-campo"><label class="rot">Situação</label>' +
          (podeOperar && d.editing_status !== 'descartado'
            ? '<select class="campo" id="vd-dt-status">' +
              SITUACOES_ATIVAS.map(([v, n]) => '<option value="' + v + '"' + (v === d.editing_status ? ' selected' : '') + '>' + n + '</option>').join('') +
              '</select>'
            : '<div class="vd-so-leitura">' + statusBadge(d.editing_status) + '</div>') +
          '</div>' +
          (versoesAtual.length
            ? '<div class="vd-dt-campo"><label class="rot">Versão atual</label>' +
              '<div class="vd-so-leitura">V' + String(versoesAtual[0].numero).padStart(2, '0') +
              (correcoes ? ' · ' + correcoes + ' correção(ões)' : '') + '</div></div>'
            : '') +
          '<div class="vd-dt-campo"><label class="rot">Responsável</label>' +
          (podeEditar
            ? '<select class="campo" id="vd-dt-videomaker"><option value="">Sem atribuir</option>' +
              videomakers.map(v => '<option value="' + v.id + '"' + (v.id === d.videomaker_id ? ' selected' : '') + '>' + esc(v.nome) + '</option>').join('') +
              '</select>'
            : '<div class="vd-so-leitura">' + quemHTML(d) + '</div>') +
          '</div>' +
          '<div class="vd-dt-campo"><label class="rot">Prazo</label>' +
          (podeEditar ? '<input class="campo" type="date" id="vd-dt-prazo" value="' + (d.prazo || '') + '">' :
            '<div class="vd-so-leitura">' + (d.prazo ? esc(B7.UI.dataBR(d.prazo)) + (atrasada ? ' — atrasada' : '') : '—') + '</div>') +
          '</div>' +
          '<div class="vd-dt-campo"><label class="rot">Prioridade</label>' +
          (podeEditar
            ? '<select class="campo" id="vd-dt-prioridade">' +
              PRIORIDADES.map(([v, r]) => '<option value="' + v + '"' + (v === (d.prioridade || 'normal') ? ' selected' : '') + '>' + r + '</option>').join('') +
              '</select>'
            : '<div class="vd-so-leitura">' + prioridadeBadge(d.prioridade) + '</div>') +
          '</div>' +
          (d.editing_status === 'standby'
            ? '<div class="vd-dt-campo"><label class="rot">Revisar standby em</label>' +
              (podeOperar
                ? '<div class="vd-link-linha"><input class="campo" type="date" id="vd-dt-standby" value="' + (d.standby_revisar_em || '') + '">' +
                  '<button class="b" id="vd-dt-standby-salvar">Salvar</button></div>' +
                  '<p class="fraca">Lembrete visual — não manda notificação sozinho.</p>'
                : '<div class="vd-so-leitura">' + (d.standby_revisar_em ? esc(B7.UI.dataBR(d.standby_revisar_em)) : '—') + '</div>') +
              '</div>'
            : '') +
          '</div>' +

          '<div class="vd-lat-grupo"><div class="vd-lat-titulo">Contexto</div>' +
          '<div class="vd-dt-campo"><label class="rot">Gravação vinculada</label>' +
          (podeEditar
            ? '<select class="campo" id="vd-dt-gravacao"><option value="">Carregando…</option></select>' +
              '<p class="fraca">Trocar a gravação desvincula os roteiros da anterior.</p>'
            : '<div class="vd-so-leitura">' + (d.gravacao_nome ? esc(d.gravacao_nome) + ' (' + esc(d.gravacao_situacao || '') + ')' : 'sem vínculo') + '</div>') +
          '</div>' +
          '<div class="vd-dt-campo"><label class="rot">Pacote</label>' +
          (podeEditar
            ? '<input class="campo" id="vd-dt-pacote" list="vd-pacotes-lista" value="' + esc(d.pacote || '') + '" autocomplete="off" placeholder="Ex.: B7 Start">' +
              '<datalist id="vd-pacotes-lista">' + pacotesVideoCache.map(p => '<option value="' + esc(p.nome) + '">').join('') + '</datalist>'
            : '<div class="vd-so-leitura">' + esc(d.pacote || '—') + '</div>') +
          '</div>' +
          '<div class="vd-dt-campo"><label class="rot">Competência</label>' +
          '<div class="vd-so-leitura">' + (d.competencia_ano ? esc(competenciaRotulo(competenciaChave(d))) : '—') + '</div>' +
          '</div>' +
          '<div class="vd-dt-campo"><label class="rot">Origem</label>' +
          '<div class="vd-so-leitura">' + (d.origem === 'importacao' ? 'Importada de planilha' : 'Criada manualmente') + '</div>' +
          '</div>' +
          '</div>' +
          (podeEditar ? '<p class="fraca vd-lat-rodape">As alterações deste painel são salvas automaticamente.</p>' : '') +
        '</aside>' +
      '</div>' +
    '</div>';

    ligarDetalhe(d, rc);
  }

  /* =================================================================
     WORKSPACE DE VÍDEO — versões, envio para aprovação, decisão do
     cliente e entrega (Parte 2). Reusa o mesmo padrão de link externo
     já usado em "Link do material editado" — os arquivos de vídeo do
     B7 vivem fora do sistema (Drive/WeTransfer), então uma "versão"
     aqui é sempre um link + nome, nunca um upload pra dentro do banco.
     ================================================================= */
  const CANAIS_DECISAO = [['whatsapp', 'WhatsApp'], ['ligacao', 'Ligação'], ['reuniao', 'Reunião'],
    ['presencial', 'Presencial'], ['outro', 'Outro']];
  const rotuloCanal = c => (CANAIS_DECISAO.find(x => x[0] === c) || [, c])[1];
  const vNum = n => 'V' + String(n).padStart(2, '0');
  const quandoBR = ts => { try { return new Date(ts).toLocaleDateString('pt-BR') + ' às ' + new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };

  /* Extrai o ID do arquivo de um link do Google Drive (vários formatos
     de link que o Drive gera ao compartilhar). Links que não são do
     Drive (WeTransfer, etc.) retornam null — nesse caso não tem como
     embutir, só o link externo mesmo. */
  function driveIdDe(url) {
    if (!url) return null;
    let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
    if (m) return m[1];
    m = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    if (m) return m[1];
    return null;
  }

  /* Comentários com timecode. O preview do Drive é um iframe de outro
     domínio sem API pública pra ler "em que segundo o vídeo está" nem
     pra pular pra um tempo — então o timecode aqui é digitado por quem
     comenta (campo mm:ss), não capturado do player. */
  const tcFmt = seg => { seg = Math.max(0, Math.floor(seg || 0)); return Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0'); };
  function parseTC(str) {
    str = (str || '').trim();
    if (!str) return null;
    if (/^\d+$/.test(str)) return parseInt(str, 10);
    const m = str.match(/^(\d{1,3}):([0-5]?\d)$/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
  }

  function secaoComentarios(v, podeOperar) {
    const lista = comentariosPorVersao[v.id] || [];
    const podeExcluir = c => souEquipe() || c.autor_id === meuId();
    return '<div class="vd-comentarios">' +
      '<label class="rot">Comentários' + (lista.length ? ' <span class="vd-contagem">' + lista.length + '</span>' : '') + '</label>' +
      (lista.length
        ? '<div class="vd-comentarios-lista">' + lista.map(c =>
            '<div class="vd-comentario">' +
              '<b class="vd-cm-tc">' + tcFmt(c.timecode_seg) + '</b>' +
              '<div class="vd-cm-corpo"><p>' + esc(c.texto) + '</p>' +
              '<span class="vd-cm-meta">' + esc(c.autor_nome || 'equipe') + ' · ' + esc(quandoBR(c.created_at)) + '</span></div>' +
              (podeExcluir(c) ? '<button class="vd-cm-excluir" data-excluir-comentario="' + c.id + '" title="Excluir comentário" aria-label="Excluir comentário">×</button>' : '') +
            '</div>').join('') + '</div>'
        : '<p class="fraca">Nenhum comentário ainda.</p>') +
      (podeOperar
        ? '<form class="vd-cm-form" data-versao="' + v.id + '">' +
            '<input class="campo vd-cm-tempo" name="tempo" placeholder="mm:ss" maxlength="6" autocomplete="off">' +
            '<input class="campo vd-cm-texto" name="texto" placeholder="Comentar em qual ponto do vídeo…" autocomplete="off">' +
            '<button class="b fina" type="submit">Comentar</button>' +
          '</form>'
        : '') +
    '</div>';
  }

  function secaoVersoes(d, versoes, podeEditar, podeOperar) {
    if (!podeOperar && !versoes.length) return '';
    const atual = versoes[0];

    /* Vídeo do Drive: embutido via iframe de pré-visualização do
       próprio Google (só funciona se o arquivo estiver compartilhado
       como "qualquer pessoa com o link"). Continua sendo o arquivo
       hospedado no Drive — não baixa, não copia, não sobe nada pro
       nosso banco. Link que não é do Drive não tem como embutir: fica
       só o botão de abrir. */
    const blocoArquivo = v => {
      if (!v.arquivo_url) return '<i class="vd-sem">sem arquivo/link</i>';
      const nomeArq = v.arquivo_nome ? ' <span class="vd-quem">' + esc(v.arquivo_nome) + '</span>' : '';
      const driveId = driveIdDe(v.arquivo_url);
      if (!driveId) {
        return '<a class="b fina" href="' + esc(v.arquivo_url) + '" target="_blank" rel="noopener">Abrir vídeo</a>' + nomeArq;
      }
      return '<div class="vd-player"><iframe src="https://drive.google.com/file/d/' + driveId + '/preview" allow="autoplay" loading="lazy" ' +
        'title="' + esc(v.arquivo_nome || 'Vídeo ' + vNum(v.numero)) + '"></iframe>' +
        '<button type="button" class="vd-player-tela-cheia" title="Tela cheia" aria-label="Ver em tela cheia">⛶</button>' +
        '</div>' +
        '<div class="vd-player-legenda"><a class="b fina" href="' + esc(v.arquivo_url) + '" target="_blank" rel="noopener">Abrir no Drive</a>' + nomeArq + '</div>';
    };

    let acao = '';
    if (!atual) {
      acao = '<div class="vd-vazio-versao"><span class="vd-vazio-ico">' + IC.versao + '</span>' +
        '<b>Nenhuma versão registrada ainda.</b>' +
        '<p>Opcional: registre o link como V01 se o cliente for aprovar pelo sistema. Se a entrega é só grupo + Drive, use a Conclusão logo abaixo.</p>' +
        (podeOperar ? '<button class="b pri" id="vd-vs-nova">' + IC.mais + 'Registrar V01</button>' : '') + '</div>';
    } else {
      let decisaoHTML = '';
      if (d.editing_status === 'aguardando_aprovacao' && !atual.decisao_cliente) {
        decisaoHTML = '<div class="vd-decisao vd-decisao-pendente"><b>DECISÃO DO CLIENTE</b>' +
          '<p>Aguardando decisão sobre a ' + vNum(atual.numero) + '.</p>' +
          (podeEditar ? '<button class="b pri" id="vd-vs-decisao">Registrar decisão do cliente</button>' : '') +
          '</div>';
      } else if (atual.decisao_cliente === 'aprovado') {
        decisaoHTML = '<div class="vd-decisao vd-decisao-aprovada"><b>DECISÃO DO CLIENTE</b>' +
          '<p>Aprovado — via ' + esc(rotuloCanal(atual.decisao_canal)) +
          (atual.decisao_registrado_por ? ', registrado por ' + esc(atual.decisao_registrado_por_nome || 'equipe') : '') +
          (atual.decisao_em ? ' · ' + esc(quandoBR(atual.decisao_em)) : '') + '</p>' +
          (d.editing_status !== 'entregue' && podeEditar ? '<button class="b pri" id="vd-vs-entrega">Registrar entrega</button>' : '') +
          '</div>';
      } else if ((atual.decisao_cliente === 'correcao' || atual.decisao_cliente === 'recusado') && d.editing_status === 'correcao') {
        decisaoHTML = '<div class="vd-decisao vd-decisao-correcao"><b>' +
          (atual.decisao_cliente === 'recusado' ? 'RECUSADO PELO CLIENTE' : 'AJUSTE SOLICITADO PELO CLIENTE') + '</b>' +
          '<p class="vd-decisao-canal">Via ' + esc(rotuloCanal(atual.decisao_canal)) +
          (atual.decisao_em ? ' · ' + esc(quandoBR(atual.decisao_em)) : '') + '</p>' +
          '<p class="vd-decisao-obs">' + esc(atual.decisao_observacao || '') + '</p>' +
          (podeOperar ? '<button class="b pri" id="vd-vs-nova">Enviar nova versão</button>' : '') +
          '</div>';
      } else if (d.editing_status === 'entregue' && atual.entregue_em) {
        decisaoHTML = '<div class="vd-decisao vd-decisao-aprovada"><b>VERSÃO FINAL</b>' +
          '<p>Entregue em ' + esc(quandoBR(atual.entregue_em)) + '.</p></div>';
      }

      const podeEnviarAprovacao = podeOperar && !atual.enviada_aprovacao_em &&
        (d.editing_status === 'em_edicao' || d.editing_status === 'correcao' || d.editing_status === 'pendente');

      acao = '<div class="vd-versao-atual">' +
        '<div class="vd-versao-cab"><b>' + vNum(atual.numero) + ' · Atual</b>' + statusBadge(d.editing_status) + '</div>' +
        '<div class="vd-versao-arquivo">' + blocoArquivo(atual) + '</div>' +
        (atual.observacao ? '<p class="fraca">' + esc(atual.observacao) + '</p>' : '') +
        decisaoHTML +
        '<div class="acoes vd-versao-acoes">' +
        (podeEnviarAprovacao ? '<button class="b" id="vd-vs-enviar">Enviar para aprovação</button>' : '') +
        (podeOperar && !decisaoHTML.includes('vd-vs-nova') ? '<button class="b fina contorno" id="vd-vs-nova">Registrar nova versão</button>' : '') +
        '</div>' +
        secaoComentarios(atual, podeOperar) +
      '</div>';
    }

    const antigas = versoes.slice(1);
    return '<section class="vd-bloco vd-workspace"><div class="vd-bloco-cab"><label class="rot">Versões' + (versoes.length ? ' · ' + versoes.length : '') + '</label></div>' +
      acao +
      (antigas.length
        ? '<div class="vd-versoes-antigas">' + antigas.map(v =>
            '<details class="vd-versao-antiga"><summary>' + vNum(v.numero) +
            (v.decisao_cliente ? ' · ' + (v.decisao_cliente === 'aprovado' ? 'Aprovada' : v.decisao_cliente === 'recusado' ? 'Recusada' : 'Correção solicitada') : ' · substituída') +
            '</summary><div class="vd-versao-antiga-corpo">' +
              blocoArquivo(v) +
              (v.observacao ? '<p class="fraca">' + esc(v.observacao) + '</p>' : '') +
              (v.decisao_observacao ? '<p class="vd-decisao-obs">' + esc(v.decisao_observacao) + '</p>' : '') +
              secaoComentarios(v, podeOperar) +
            '</div></details>').join('') + '</div>'
        : '') +
      '</section>';
  }

  function modalNovaVersao(d) {
    const ultima = versoesAtual[0];
    const m = B7.UI.modal(
      '<h3>' + (ultima ? 'Registrar ' + vNum(ultima.numero + 1) : 'Registrar V01') + '</h3>' +
      '<label class="rot">Link do vídeo</label>' +
      '<input class="campo" id="vd-nv-url" placeholder="https://drive.google.com/…" data-foco>' +
      '<label class="rot">Nome do arquivo (opcional)</label>' +
      '<input class="campo" id="vd-nv-nome" placeholder="Ex.: corte-final-v2.mov">' +
      '<label class="rot">Observação (opcional)</label>' +
      '<textarea class="campo alta" id="vd-nv-obs" rows="2" placeholder="Ex.: Ajustes solicitados pelo cliente."></textarea>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" id="vd-nv-salvar">Registrar</button></div>');
    m.querySelector('#vd-nv-salvar').onclick = async () => {
      const url = m.querySelector('#vd-nv-url').value.trim();
      if (!url) { B7.UI.toast('Informe o link do vídeo.'); return; }
      const btn = m.querySelector('#vd-nv-salvar');
      btn.disabled = true; btn.textContent = 'Registrando…';
      try {
        await B7.DB.criarVersaoVideo(d.id, {
          arquivoUrl: url, arquivoNome: m.querySelector('#vd-nv-nome').value.trim(), observacao: m.querySelector('#vd-nv-obs').value.trim()
        });
        m.fechar();
        B7.UI.toast('Versão registrada.');
        abrirDetalhe(d.id);
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Registrar';
        B7.UI.toast(e.message || 'Não foi possível registrar a versão.');
      }
    };
  }

  function modalDecisaoCliente(d, versao) {
    const m = B7.UI.modal(
      '<h3>Decisão do cliente — ' + vNum(versao.numero) + '</h3>' +
      '<p class="fraca">O cliente não precisa acessar o sistema — registre aqui o que ele decidiu, mesmo que tenha respondido por WhatsApp, ligação etc.</p>' +
      '<label class="rot">Decisão</label>' +
      '<select class="campo" id="vd-dc-decisao" data-foco>' +
        '<option value="aprovado">Aprovado pelo cliente</option>' +
        '<option value="correcao">Cliente solicitou correção</option>' +
        '<option value="recusado">Recusado pelo cliente</option>' +
      '</select>' +
      '<label class="rot">Canal</label>' +
      '<select class="campo" id="vd-dc-canal">' +
        CANAIS_DECISAO.map(([v, r]) => '<option value="' + v + '"' + (v === 'whatsapp' ? ' selected' : '') + '>' + r + '</option>').join('') +
      '</select>' +
      '<label class="rot" id="vd-dc-obs-rot">O que o cliente pediu? (obrigatório se não for aprovação)</label>' +
      '<textarea class="campo alta" id="vd-dc-obs" rows="3" placeholder="Ex.: Retirar a cena aos 00:34 e diminuir a abertura."></textarea>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" id="vd-dc-salvar">Registrar decisão</button></div>');

    m.querySelector('#vd-dc-salvar').onclick = async () => {
      const decisao = m.querySelector('#vd-dc-decisao').value;
      const canal = m.querySelector('#vd-dc-canal').value;
      const obs = m.querySelector('#vd-dc-obs').value.trim();
      if (decisao !== 'aprovado' && !obs) { B7.UI.toast('Descreva o que o cliente pediu.'); return; }
      const btn = m.querySelector('#vd-dc-salvar');
      btn.disabled = true; btn.textContent = 'Registrando…';
      try {
        await B7.DB.registrarDecisaoClienteVideo(versao.id, decisao, canal, obs);
        m.fechar();
        B7.UI.toast('Decisão registrada.');
        abrirDetalhe(d.id);
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Registrar decisão';
        B7.UI.toast(e.message || 'Não foi possível registrar a decisão.');
      }
    };
  }

  function linhaHistorico(ev) {
    let texto;
    if (ev.tipo === 'criada') texto = 'Demanda criada';
    else if (ev.tipo === 'atribuida') texto = ev.mensagem === 'Atribuição removida' ? 'Atribuição removida' : 'Responsável atribuído';
    else if (ev.tipo === 'status') texto = 'Situação mudou para "' + esc(rotuloSituacao(ev.para_status)) + '"';
    else if (ev.tipo === 'link_material') texto = 'Link do material atualizado';
    else if (ev.tipo === 'versao') texto = esc(ev.mensagem || 'Nova versão registrada');
    else if (ev.tipo === 'decisao_cliente') texto = esc(ev.mensagem || 'Decisão do cliente registrada');
    else if (ev.tipo === 'conclusao') texto = esc(ev.mensagem || 'Conclusão atualizada');
    else texto = esc(ev.tipo);
    const cor = ev.tipo === 'status' ? ' vd-tl-' + esc(ev.para_status || '') : ev.tipo === 'conclusao' ? ' vd-tl-ok' : '';
    return '<li class="vd-tl-item' + cor + '"><i class="vd-tl-dot"></i><div class="vd-tl-corpo"><b>' + esc(ev.ator_nome || 'Alguém') + '</b> ' + texto +
      (ev.mensagem && ev.tipo === 'status' ? '<div class="vd-tl-msg">' + esc(ev.mensagem) + '</div>' : '') +
      '<span class="vd-tl-quando">' + esc(B7.UI.quando ? B7.UI.quando(ev.created_at) : ev.created_at) + '</span></div></li>';
  }

  function ligarDetalhe(d, rc) {
    rc = rc || { gravacao: null, roteiros: [], cenasPorRoteiro: {} };
    const selStatus = document.getElementById('vd-dt-status');
    if (selStatus) selStatus.onchange = async () => {
      const novo = selStatus.value;
      let mensagem = null;
      if (novo === 'correcao') {
        mensagem = await B7.UI.perguntar({ titulo: 'O que precisa corrigir?', confirmar: 'Marcar correção' });
        if (mensagem === null) { selStatus.value = d.editing_status; return; }
      }
      try {
        await B7.DB.mudarStatusVideo(d.id, novo, mensagem || null);
        B7.UI.toast('Situação atualizada.');
        abrirDetalhe(d.id);
      } catch (e) { B7.UI.toast(e.message || 'Não foi possível mudar a situação.'); selStatus.value = d.editing_status; }
    };

    const selVm = document.getElementById('vd-dt-videomaker');
    if (selVm) selVm.onchange = async () => {
      try { await B7.DB.atribuirVideo(d.id, selVm.value || null); B7.UI.toast('Atribuição atualizada.'); abrirDetalhe(d.id); }
      catch (e) { B7.UI.toast(e.message || 'Não foi possível atribuir.'); selVm.value = d.videomaker_id || ''; }
    };

    const btNovaVersao = document.getElementById('vd-vs-nova');
    if (btNovaVersao) btNovaVersao.onclick = () => modalNovaVersao(d);

    const btEnviarAprovacao = document.getElementById('vd-vs-enviar');
    if (btEnviarAprovacao) btEnviarAprovacao.onclick = async () => {
      const atual = versoesAtual[0];
      if (!atual) return;
      const ok = await B7.UI.confirmar({
        titulo: 'Enviar para aprovação?',
        texto: 'Enviar ' + vNum(atual.numero) + ' para a aprovação do cliente?',
        confirmar: 'Enviar para aprovação'
      });
      if (!ok) return;
      btEnviarAprovacao.disabled = true;
      try {
        await B7.DB.enviarParaAprovacaoVideo(d.id, atual.id);
        B7.UI.toast('Enviado para aprovação.');
        abrirDetalhe(d.id);
      } catch (e) { btEnviarAprovacao.disabled = false; B7.UI.toast(e.message || 'Não foi possível enviar para aprovação.'); }
    };

    const btDecisao = document.getElementById('vd-vs-decisao');
    if (btDecisao) btDecisao.onclick = () => { if (versoesAtual[0]) modalDecisaoCliente(d, versoesAtual[0]); };

    const btEntrega = document.getElementById('vd-vs-entrega');
    if (btEntrega) btEntrega.onclick = async () => {
      const atual = versoesAtual[0];
      if (!atual) return;
      const ok = await B7.UI.confirmar({
        titulo: 'Registrar entrega?',
        texto: 'Marcar ' + vNum(atual.numero) + ' como entregue?',
        confirmar: 'Registrar entrega'
      });
      if (!ok) return;
      btEntrega.disabled = true;
      try {
        await B7.DB.registrarEntregaVideo(d.id, atual.id, null);
        B7.UI.toast('Entrega registrada.');
        abrirDetalhe(d.id);
      } catch (e) { btEntrega.disabled = false; B7.UI.toast(e.message || 'Não foi possível registrar a entrega.'); }
    };

    document.querySelectorAll('[data-conclusao]').forEach(chk => {
      chk.onchange = async () => {
        const etapa = chk.dataset.conclusao, marcado = chk.checked;
        chk.disabled = true;
        try {
          await B7.DB.marcarConclusaoVideo(d.id, etapa, marcado);
          B7.UI.toast(marcado ? 'Marcado.' : 'Desmarcado.');
          abrirDetalhe(d.id);
        } catch (e) { chk.disabled = false; chk.checked = !marcado; B7.UI.toast(e.message || 'Não foi possível salvar.'); }
      };
    });
    const btEntregue = document.getElementById('vd-marcar-entregue');
    if (btEntregue) btEntregue.onclick = async () => {
      const ok = await B7.UI.confirmar({ titulo: 'Marcar como entregue?', texto: 'A demanda sai da fila ativa e entra nos entregues do mês.', confirmar: 'Marcar como entregue' });
      if (!ok) return;
      btEntregue.disabled = true;
      try { await B7.DB.mudarStatusVideo(d.id, 'entregue', null); B7.UI.toast('Demanda entregue.'); abrirDetalhe(d.id); }
      catch (e) { btEntregue.disabled = false; B7.UI.toast(e.message || 'Não foi possível marcar.'); }
    };

    const btLink = document.getElementById('vd-dt-link-salvar');
    if (btLink) btLink.onclick = async () => {
      const link = document.getElementById('vd-dt-link').value.trim();
      btLink.disabled = true;
      try { await B7.DB.definirLinkVideo(d.id, link); B7.UI.toast('Link salvo.'); abrirDetalhe(d.id); }
      catch (e) { B7.UI.toast(e.message || 'Não foi possível salvar o link.'); }
      finally { btLink.disabled = false; }
    };

    const btStandby = document.getElementById('vd-dt-standby-salvar');
    if (btStandby) btStandby.onclick = async () => {
      const data = document.getElementById('vd-dt-standby').value || null;
      btStandby.disabled = true;
      try { await B7.DB.definirStandbyVideo(d.id, data); B7.UI.toast('Data salva.'); abrirDetalhe(d.id); }
      catch (e) { B7.UI.toast(e.message || 'Não foi possível salvar.'); }
      finally { btStandby.disabled = false; }
    };

    const selGravacaoDt = document.getElementById('vd-dt-gravacao');
    if (selGravacaoDt) {
      B7.DB.gravacoesDoClienteParaVideo(d.client_id).then(gs => {
        selGravacaoDt.innerHTML = '<option value="">Sem vínculo</option>' +
          gs.map(g => '<option value="' + g.id + '"' + (g.id === d.gravacao_id ? ' selected' : '') + '>' +
            esc(g.nome) + (g.data_gravacao ? ' · ' + esc(B7.UI.dataBR(g.data_gravacao)) : '') +
            (g.status && g.status !== 'Gravado' ? ' · ' + esc(g.status) : '') + '</option>').join('');
      }).catch(() => { selGravacaoDt.innerHTML = '<option value="">Sem vínculo</option>'; });
      selGravacaoDt.onchange = async () => {
        const novo = selGravacaoDt.value || null;
        if ((d.roteiros_vinculados || []).length && novo !== d.gravacao_id) {
          const ok = await B7.UI.confirmar({
            titulo: 'Trocar a gravação?',
            texto: 'Os roteiros vinculados pertencem à gravação atual e serão desvinculados desta demanda.',
            confirmar: 'Trocar'
          });
          if (!ok) { selGravacaoDt.value = d.gravacao_id || ''; return; }
        }
        selGravacaoDt.disabled = true;
        try {
          if ((d.roteiros_vinculados || []).length && novo !== d.gravacao_id) await B7.DB.definirRoteirosVideo(d.id, []);
          await B7.DB.editarDemandaVideo(d.id, { gravacaoId: novo, temGravacao: true });
          B7.UI.toast('Gravação atualizada.');
          abrirDetalhe(d.id);
        } catch (e) { selGravacaoDt.disabled = false; selGravacaoDt.value = d.gravacao_id || ''; B7.UI.toast(e.message || 'Não foi possível vincular a gravação.'); }
      };
    }

    /* Painel lateral salva sozinho — mesmo padrão do resto do sistema
       (B7.Save mostra "Salvo ✓" no topo). Prazo e prioridade salvam na
       hora; pacote ao sair do campo; observações com pausa de digitação. */
    const campoPrazoDt = document.getElementById('vd-dt-prazo');
    if (campoPrazoDt) campoPrazoDt.onchange = () => {
      B7.Save.campo('demandas_edicao', d.id, { prazo: campoPrazoDt.value || null, temPrazo: true });
      d.prazo = campoPrazoDt.value || null;
    };
    const selPrioridadeDt = document.getElementById('vd-dt-prioridade');
    if (selPrioridadeDt) selPrioridadeDt.onchange = () => {
      B7.Save.campo('demandas_edicao', d.id, { prioridade: selPrioridadeDt.value });
    };
    const campoPacoteDt = document.getElementById('vd-dt-pacote');
    if (campoPacoteDt) campoPacoteDt.onchange = () => {
      B7.Save.campo('demandas_edicao', d.id, { pacote: campoPacoteDt.value.trim() });
    };
    const campoObs = document.getElementById('vd-dt-obs');
    const obsEstado = document.getElementById('vd-obs-estado');
    if (campoObs) {
      let ultimoObs = campoObs.value;
      campoObs.oninput = () => {
        if (obsEstado) obsEstado.textContent = 'digitando…';
        B7.Save.campo('demandas_edicao', d.id, { observacoes: campoObs.value.trim() });
        clearTimeout(campoObs._t);
        campoObs._t = setTimeout(() => { if (obsEstado && campoObs.value !== ultimoObs) { obsEstado.textContent = 'salvo automaticamente'; ultimoObs = campoObs.value; } }, 1400);
      };
    }

    /* Roteiros: ler inline, ficha A4 (espiada), desvincular, vincular. */
    document.querySelectorAll('[data-rot-ler]').forEach(bt => {
      bt.onclick = () => {
        const corpo = document.getElementById('vd-rot-corpo-' + bt.dataset.rotLer);
        const card = bt.closest('.vd-rot');
        if (!corpo) return;
        const abrir = corpo.hidden;
        corpo.hidden = !abrir;
        bt.textContent = abrir ? 'Recolher' : 'Ler roteiro';
        bt.setAttribute('aria-expanded', abrir ? 'true' : 'false');
        if (card) card.classList.toggle('aberto', abrir);
      };
    });
    document.querySelectorAll('[data-rot-ficha]').forEach(bt => {
      bt.onclick = () => {
        const r = (rc.roteiros || []).find(x => x.id === bt.dataset.rotFicha);
        if (!r || !B7.QuickView) { B7.UI.toast('Não foi possível abrir a ficha deste roteiro.'); return; }
        B7.QuickView.abrir(ctxQuickViewDe(d, rc), r);
      };
    });

    /* Roteiro(s) vinculado(s) — remover chip ou adicionar via select,
       sempre reenviando o CONJUNTO completo (video_definir_roteiros
       substitui, não soma). */
    const vinculados = d.roteiros_vinculados || [];
    async function salvarRoteirosVinculados(idsNovos, elBotao) {
      if (elBotao) elBotao.disabled = true;
      try {
        await B7.DB.definirRoteirosVideo(d.id, idsNovos);
        B7.UI.toast('Roteiros vinculados atualizados.');
        abrirDetalhe(d.id);
      } catch (e) {
        if (elBotao) elBotao.disabled = false;
        B7.UI.toast(e.message || 'Não foi possível atualizar os roteiros vinculados.');
      }
    }
    document.querySelectorAll('[data-remover-roteiro]').forEach(bt => {
      bt.onclick = async () => {
        const ok = await B7.UI.confirmar({ titulo: 'Desvincular este roteiro?', texto: 'O roteiro continua existindo na gravação — só deixa de aparecer nesta demanda.', confirmar: 'Desvincular' });
        if (!ok) return;
        const restantes = vinculados.filter(r => r.id !== bt.dataset.removerRoteiro).map(r => r.id);
        salvarRoteirosVinculados(restantes, bt);
      };
    });
    const selRoteiroAdd = document.getElementById('vd-dt-roteiro-add');
    const btRoteiroAdd = document.getElementById('vd-dt-roteiro-add-bt');
    if (selRoteiroAdd && d.gravacao_id) {
      const pronto = roteiros => {
        const jaVinculados = new Set(vinculados.map(r => r.id));
        const disponiveis = (roteiros || []).filter(r => !jaVinculados.has(r.id));
        selRoteiroAdd.innerHTML = '<option value="">' + (disponiveis.length ? 'Vincular outro roteiro…' : 'Todos os roteiros da gravação já estão vinculados') + '</option>' +
          disponiveis.map((r, i) => '<option value="' + r.id + '">' + esc(r.titulo || '(sem título)') + '</option>').join('');
        selRoteiroAdd.onchange = () => { if (btRoteiroAdd) btRoteiroAdd.disabled = !selRoteiroAdd.value; };
      };
      if (rc.roteiros && rc.roteiros.length) pronto(rc.roteiros);
      else B7.DB.listarRoteiros(d.gravacao_id).then(pronto).catch(() => { selRoteiroAdd.innerHTML = '<option value="">Não foi possível carregar</option>'; });
    }
    if (btRoteiroAdd) btRoteiroAdd.onclick = () => {
      if (!selRoteiroAdd.value) return;
      const novos = [...vinculados.map(r => r.id), selRoteiroAdd.value];
      salvarRoteirosVinculados(novos, btRoteiroAdd);
    };

    const btDescartar = document.getElementById('vd-dt-descartar');
    if (btDescartar) btDescartar.onclick = async () => {
      const ok = await B7.UI.confirmar({
        titulo: 'Descartar esta demanda?',
        texto: 'A demanda sai do Kanban e da lista ativa, mas fica guardada em "Descartados" e pode ser consultada depois. Isso não apaga o histórico.',
        perigo: true, rotulo: 'Descartar'
      });
      if (!ok) return;
      btDescartar.disabled = true;
      try {
        await B7.DB.mudarStatusVideo(d.id, 'descartado', null);
        B7.UI.toast('Demanda descartada.');
        abrirDetalhe(d.id);
      } catch (e) { btDescartar.disabled = false; B7.UI.toast(e.message || 'Não foi possível descartar.'); }
    };

    const btExcluir = document.getElementById('vd-dt-excluir');
    if (btExcluir) btExcluir.onclick = async () => {
      const ok = await B7.UI.confirmar({ titulo: 'Excluir esta demanda?', texto: 'A demanda sai da lista. Isso não apaga o histórico.', perigo: true, rotulo: 'Excluir' });
      if (!ok) return;
      try { await B7.DB.excluirDemandaVideo(d.id); B7.UI.toast('Demanda excluída.'); location.hash = '#/video'; }
      catch (e) { B7.UI.toast(e.message || 'Não foi possível excluir.'); }
    };

    /* Tela cheia: pede fullscreen no próprio container do player (não no
       iframe/vídeo por dentro) — funciona mesmo com o conteúdo do Drive
       sendo de outra origem, porque a API de Fullscreen opera sobre o
       elemento em si, não sobre o que tem dentro dele. */
    document.querySelectorAll('.vd-player-tela-cheia').forEach(btn => {
      btn.onclick = () => {
        const caixa = btn.closest('.vd-player');
        if (!caixa) return;
        const pedir = caixa.requestFullscreen || caixa.webkitRequestFullscreen || caixa.msRequestFullscreen;
        if (pedir) pedir.call(caixa).catch(() => B7.UI.toast('Não foi possível abrir em tela cheia.'));
      };
    });

    document.querySelectorAll('.vd-cm-form').forEach(form => {
      form.onsubmit = async e => {
        e.preventDefault();
        const versaoId = form.dataset.versao;
        const seg = parseTC(form.tempo.value);
        const texto = form.texto.value.trim();
        if (seg === null) { B7.UI.toast('Timecode inválido. Use mm:ss (ex.: 1:23).'); return; }
        if (!texto) { B7.UI.toast('Escreva o comentário.'); return; }
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
          await B7.DB.criarComentarioVideo(versaoId, seg, texto);
          B7.UI.toast('Comentário adicionado.');
          abrirDetalhe(d.id);
        } catch (err) { btn.disabled = false; B7.UI.toast(err.message || 'Não foi possível comentar.'); }
      };
    });

    document.querySelectorAll('[data-excluir-comentario]').forEach(btn => {
      btn.onclick = async () => {
        const ok = await B7.UI.confirmar({ titulo: 'Excluir comentário?', texto: 'Essa ação não pode ser desfeita.', perigo: true, rotulo: 'Excluir' });
        if (!ok) return;
        btn.disabled = true;
        try { await B7.DB.excluirComentarioVideo(btn.dataset.excluirComentario); B7.UI.toast('Comentário excluído.'); abrirDetalhe(d.id); }
        catch (err) { btn.disabled = false; B7.UI.toast(err.message || 'Não foi possível excluir.'); }
      };
    });
  }

  /* ================================================================
     IMPORTAÇÃO DE PLANILHA (CSV ou XLSX)
     O navegador lê e interpreta o arquivo; o banco só recebe JSON já
     pronto (ver migration_video.sql, seção 13, e
     migration_video_import_fix.sql). Testado contra uma planilha real
     de produção (732 linhas, cabeçalho "Mês, Cliente, Pacote, Cód.,
     Briefing / Título, Prioridade, Data de Gravação, Prazo de
     ENTREGA, STATUS, Responsável, Observações", com uma linha de lixo
     antes do cabeçalho de verdade) — ver o relatório do build.

     Como planilha real de produção quase nunca usa exatamente
     "cliente"/"titulo" como cabeçalho, a leitura:
     1) Acha a linha de cabeçalho de verdade em vez de assumir que é a
        primeira linha do arquivo — pontua as primeiras linhas por
        quantas colunas reconhecidas elas têm e usa a que pontuar mais.
     2) Casa CADA coluna por uma lista de sinônimos, não por igualdade
        exata do nome da coluna.

     "prioridade" e "responsavel" (planilha) e "data_gravacao" viram
     CAMPOS PRÓPRIOS no objeto de linha (a partir deste build — antes,
     só entravam compostos dentro de observações e não davam pra
     recuperar depois; migration_video_producao.sql tem um backfill
     que recupera o que já foi importado assim, lendo o texto composto
     de volta). Continuam também aparecendo, em texto, dentro de
     observações — não tira informação de quem já usa a tela assim.
     ================================================================ */
  function normalizarCabecalho(h) {
    return String(h == null ? '' : h).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  const SINONIMOS_COLUNA = {
    cliente: ['cliente'],
    titulo: ['titulo', 'briefing'],
    codigo: ['cod'],
    pacote: ['pacote'],
    prazo: ['prazo'],
    competencia: ['mes'],
    status: ['status', 'situacao'],
    observacoes: ['observaco'],
    prioridade: ['prioridade'],
    responsavel: ['responsavel'],
    data_gravacao: ['gravacao']
  };

  function mapearColunas(cabecalhoNormalizado) {
    const mapa = {};
    cabecalhoNormalizado.forEach((h, i) => {
      if (!h) return;
      for (const campo in SINONIMOS_COLUNA) {
        if (mapa[campo] !== undefined) continue;
        if (SINONIMOS_COLUNA[campo].some(chave => h.includes(chave))) { mapa[campo] = i; break; }
      }
    });
    return mapa;
  }

  function acharLinhaCabecalho(bruto) {
    let melhorIndice = 0, melhorPontuacao = -1;
    for (let i = 0; i < Math.min(bruto.length, 15); i++) {
      const pontos = Object.keys(mapearColunas(bruto[i].map(normalizarCabecalho))).length;
      if (pontos > melhorPontuacao) { melhorPontuacao = pontos; melhorIndice = i; }
    }
    return melhorIndice;
  }

  const MESES_PT = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
  function parseCompetencia(v) {
    const s = normalizarCabecalho(v);
    /* Célula de DATA de verdade no Excel (mesmo quando exibida como
       "janeiro/2026" por formatação customizada): a leitura do XLSX
       (cellDates + dateNF: 'yyyy-mm-dd', ver parseXLSX) devolve o valor
       real da data, não o texto formatado — vem como "2026-01-15" ou
       "2026-01" (ou, no CSV puro, às vezes "2026-01-01T00:00:00.000Z").
       Descoberto testando contra a importação real: a coluna Mês é
       gravada como data no arquivo original, não como texto. */
    let m = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?/);
    if (m) return { ano: m[1], mes: String(Number(m[2])) };
    /* Texto digitado direto ("janeiro/2026", "Janeiro /2026" etc.) —
       continua funcionando pra planilhas onde a coluna é texto mesmo. */
    m = s.match(/([a-z]+)\s*\/\s*(\d{4})/);
    const mes = m && MESES_PT[m[1]];
    return mes ? { ano: m[2], mes: String(mes) } : {};
  }

  function parseDataBR(v) {
    const s = String(v || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '';
  }

  const STATUS_PLANILHA = {
    entregue: 'entregue', descartado: 'descartado', pendente: 'pendente',
    edicao: 'em_edicao', 'em edicao': 'em_edicao', correcao: 'correcao',
    ajuste: 'correcao', ajustes: 'correcao', standby: 'standby'
  };
  function parseStatus(v) { return STATUS_PLANILHA[normalizarCabecalho(v)] || ''; }

  function linhasParaObjetos(bruto) {
    if (!bruto.length) return [];
    const idxCab = acharLinhaCabecalho(bruto);
    const mapa = mapearColunas(bruto[idxCab].map(normalizarCabecalho));
    const pegar = (linha, campo) => mapa[campo] !== undefined ? String(linha[mapa[campo]] == null ? '' : linha[mapa[campo]]).trim() : '';

    return bruto.slice(idxCab + 1)
      .filter(l => l.some(v => String(v == null ? '' : v).trim() !== ''))
      .map(l => {
        const comp = parseCompetencia(pegar(l, 'competencia'));
        const prioridade = pegar(l, 'prioridade');
        const responsavel = pegar(l, 'responsavel');
        const dataGravacao = parseDataBR(pegar(l, 'data_gravacao'));
        const extras = [];
        if (prioridade) extras.push('Prioridade (planilha): ' + prioridade);
        if (responsavel) extras.push('Responsável (planilha): ' + responsavel);
        if (dataGravacao) extras.push('Data de gravação (planilha): ' + dataGravacao.split('-').reverse().join('/'));
        const observacoes = [pegar(l, 'observacoes'), ...extras].filter(Boolean).join(' · ');

        return {
          cliente: pegar(l, 'cliente'),
          titulo: pegar(l, 'titulo'),
          codigo: pegar(l, 'codigo'),
          pacote: pegar(l, 'pacote'),
          prazo: parseDataBR(pegar(l, 'prazo')),
          observacoes,
          ano: comp.ano || '',
          mes: comp.mes || '',
          status: parseStatus(pegar(l, 'status')),
          prioridade,
          responsavel
        };
      });
  }

  function csvParaLinhasBrutas(texto) {
    const linhas = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '');
    if (!linhas.length) return [];
    const sep = linhas[0].includes(';') && !linhas[0].includes(',') ? ';' : ',';
    const partirLinha = l => {
      const campos = []; let atual = '', dentro = false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === '"') { if (dentro && l[i + 1] === '"') { atual += '"'; i++; } else { dentro = !dentro; } }
        else if (c === sep && !dentro) { campos.push(atual); atual = ''; }
        else atual += c;
      }
      campos.push(atual);
      return campos.map(x => x.trim());
    };
    return linhas.map(partirLinha);
  }
  function parseCSV(texto) { return linhasParaObjetos(csvParaLinhasBrutas(texto)); }

  function parseXLSX(arrayBuffer) {
    if (!window.XLSX) throw new Error('Biblioteca de leitura de XLSX não carregou.');
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const aba = wb.SheetNames[0];
    if (!aba) return [];
    const bruto = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
    return linhasParaObjetos(bruto);
  }

  /* Casca visual trocada nesta rodada (arrastar-e-soltar + prévia do
     arquivo antes de processar) — a lógica de dados (achar cabeçalho,
     reconhecer coluna, parseCSV/parseXLSX/linhasParaObjetos,
     staging em lote no banco, resolução de cliente linha a linha,
     confirmação explícita) NÃO foi tocada, só passou a rodar um passo
     depois: ao clicar "Continuar", não mais no instante do <input
     type=file> disparar onchange. */
  const ACEITA_IMPORTACAO = '.csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  function formatarTamanhoArquivo(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  function modalImportar() {
    let arquivoEscolhido = null;

    const m = B7.UI.modal(
      '<h3>Importar planilha (CSV ou XLSX)</h3>' +
      '<p class="fraca">O sistema encontra sozinho a linha de cabeçalho (mesmo com linhas de lixo antes ' +
      'dela) e reconhece colunas parecidas com Cliente, Briefing/Título, Cód., Pacote, Prazo, Mês/Competência ' +
      'e Status, em qualquer ordem. Uma coluna de cliente é obrigatória — as demais são opcionais e, quando ' +
      'faltar título, a linha ainda é importada com um título de referência. No XLSX só a primeira aba do ' +
      'arquivo é lida. Nada é gravado como demanda antes de você revisar e confirmar.</p>' +
      '<div class="vd-imp-solta" id="vd-imp-solta" tabindex="0" role="button" aria-label="Escolher arquivo">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M12 4l-4 4M12 4l4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>' +
        '<b>Arraste um arquivo aqui</b>' +
        '<span>ou <u>selecionar arquivo</u> — CSV ou XLSX</span>' +
        '<input type="file" accept="' + ACEITA_IMPORTACAO + '" id="vd-imp-arquivo" class="vd-imp-input-oculto" data-foco>' +
      '</div>' +
      '<div class="vd-imp-arquivo-escolhido" id="vd-imp-escolhido" hidden></div>' +
      '<div id="vd-imp-resultado"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>', { larga: true });

    const zona = m.querySelector('#vd-imp-solta');
    const input = m.querySelector('#vd-imp-arquivo');
    const cxEscolhido = m.querySelector('#vd-imp-escolhido');
    const area = m.querySelector('#vd-imp-resultado');

    function mostrarArquivo(arquivo) {
      arquivoEscolhido = arquivo;
      zona.hidden = true;
      const ehXlsx = /\.xlsx?$/i.test(arquivo.name);
      cxEscolhido.hidden = false;
      cxEscolhido.innerHTML =
        '<div class="vd-imp-arquivo-info">' +
          '<span class="vd-imp-arquivo-tipo">' + (ehXlsx ? 'XLSX' : 'CSV') + '</span>' +
          '<div class="vd-imp-arquivo-nome"><b>' + esc(arquivo.name) + '</b><small>' + formatarTamanhoArquivo(arquivo.size) + '</small></div>' +
        '</div>' +
        '<div class="acoes-inline">' +
          '<button class="b fina contorno" id="vd-imp-trocar">Trocar arquivo</button>' +
          '<button class="b pri fina" id="vd-imp-continuar">Continuar</button>' +
        '</div>';
      cxEscolhido.querySelector('#vd-imp-trocar').onclick = () => {
        arquivoEscolhido = null;
        input.value = '';
        cxEscolhido.hidden = true; cxEscolhido.innerHTML = '';
        area.innerHTML = '';
        zona.hidden = false;
      };
      cxEscolhido.querySelector('#vd-imp-continuar').onclick = () => processarArquivo(arquivo);
    }

    input.onchange = () => { if (input.files[0]) mostrarArquivo(input.files[0]); };
    zona.onclick = e => { if (e.target !== input) input.click(); };
    zona.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
    ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation(); zona.classList.add('sobre');
    }));
    ['dragleave', 'dragend', 'drop'].forEach(ev => zona.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation(); zona.classList.remove('sobre');
    }));
    zona.addEventListener('drop', e => {
      const arquivo = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (arquivo) mostrarArquivo(arquivo);
    });

    async function processarArquivo(arquivo) {
      const ehXlsx = /\.xlsx?$/i.test(arquivo.name);
      let linhas;
      try {
        linhas = ehXlsx ? parseXLSX(await arquivo.arrayBuffer()) : parseCSV(await arquivo.text());
      } catch (e) {
        B7.UI.toast('Não foi possível ler este arquivo (' + (e.message || 'formato inválido') + ').');
        return;
      }
      if (!linhas.length) { B7.UI.toast('Planilha vazia.'); return; }

      area.innerHTML = '<p>Processando ' + linhas.length + ' linha(s)…</p>';
      let loteId;
      try { loteId = await B7.DB.importarPlanilhaVideo(arquivo.name, linhas); }
      catch (e) { area.innerHTML = '<p class="vd-erro">' + esc(e.message || 'Falha ao importar.') + '</p>'; return; }
      await desenharResultadoImportacao(area, loteId);
    }
  }

  async function desenharResultadoImportacao(area, loteId) {
    const [lote, linhasImp] = await Promise.all([
      B7.DB.loteImportacaoVideo(loteId), B7.DB.linhasImportacaoVideo(loteId)
    ]);
    if (!clientes.length) clientes = await B7.DB.listarClientes().catch(() => []);

    const pendentes = linhasImp.filter(l => !l.confirmada);
    const naoResolvidas = pendentes.filter(l => !l.resolvida);
    const prontas = pendentes.filter(l => l.resolvida);

    const grupos = [];
    const porNome = new Map();
    naoResolvidas.forEach(l => {
      const chave = (l.cliente_nome_planilha || '').trim().toLowerCase();
      let g = porNome.get(chave);
      if (!g) {
        g = { nome: l.cliente_nome_planilha, linhas: [], problemas: new Set() };
        porNome.set(chave, g);
        grupos.push(g);
      }
      g.linhas.push(l);
      (l.problemas || []).forEach(p => g.problemas.add(p));
    });

    area.innerHTML =
      '<p><b>' + lote.linhas_ok + '</b> linha(s) prontas, <b>' + lote.linhas_erro + '</b> com pendência, de ' + lote.total_linhas + ' no total.</p>' +
      (grupos.length
        ? '<p class="fraca">Resolver o cliente de um grupo abaixo aplica a mesma escolha a todas as linhas com esse nome na planilha.</p>' +
          '<table class="vd-imp-tabela"><thead><tr><th>Linhas</th><th>Cliente (planilha)</th><th>Problema</th><th></th></tr></thead><tbody>' +
          grupos.map(g => '<tr data-linha="' + g.linhas[0].id + '">' +
            '<td>' + g.linhas.length + '</td>' +
            '<td>' + esc(g.nome || '—') + '</td>' +
            '<td>' + esc(Array.from(g.problemas).map(rotuloProblema).join(' · ')) + '</td>' +
            '<td><select class="campo fina" data-resolver="' + g.linhas[0].id + '"><option value="">resolver cliente…</option>' +
              clientes.map(c => '<option value="' + c.id + '">' + esc(c.nome) + '</option>').join('') + '</select></td>' +
            '</tr>').join('') +
          '</tbody></table>'
        : '') +
      (prontas.length ? '<p class="vd-ok">' + prontas.length + ' linha(s) resolvida(s), prontas para confirmar.</p>' : '') +
      (pendentes.length
        ? (prontas.length ? '<div class="acoes"><button class="b pri" id="vd-imp-confirmar">Confirmar linhas prontas</button></div>' : '')
        : '<p class="vd-ok">Tudo confirmado.</p>');

    area.querySelectorAll('[data-resolver]').forEach(sel => sel.onchange = async () => {
      if (!sel.value) return;
      try {
        const n = await B7.DB.resolverLinhaImportacaoVideo(sel.dataset.resolver, sel.value, true);
        if (n > 1) B7.UI.toast(n + ' linha(s) resolvida(s) com este cliente.');
        await desenharResultadoImportacao(area, loteId);
      } catch (e) { B7.UI.toast(e.message || 'Não foi possível resolver esta linha.'); }
    });

    const btConfirmar = area.querySelector('#vd-imp-confirmar');
    if (btConfirmar) btConfirmar.onclick = async () => {
      btConfirmar.disabled = true; btConfirmar.textContent = 'Confirmando…';
      try {
        const n = await B7.DB.confirmarLoteImportacaoVideo(loteId);
        B7.UI.toast(n + ' demanda(s) criada(s).');
        await desenharResultadoImportacao(area, loteId);
        abrir();
      } catch (e) {
        btConfirmar.disabled = false; btConfirmar.textContent = 'Confirmar linhas prontas';
        B7.UI.toast(e.message || 'Não foi possível confirmar.');
      }
    };
  }

  /* ehAtrasada e rotuloSituacao saem daqui para o Painel (js/painel.js)
     usar a MESMA regra que a Produção de Vídeo mostra — o número do KPI
     tem que bater com a lista que abre ao clicar nele. */
  return { abrir, abrirDetalhe, ehAtrasada, rotuloSituacao };
})();
