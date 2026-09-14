/* =====================================================================
   B7 VÍDEO — PRODUÇÃO DE VÍDEO (Parte 1.1) + CENTRAL DE VÍDEO

   Correção/evolução sobre a Parte 1 (fila de Demandas de Edição,
   atribuição, mudança de situação, link externo, importação de
   planilha — tudo isso continua igual, ver migration_video.sql/
   migration_video_kanban.sql/migration_video_import_fix.sql). O que
   muda aqui é a EXPERIÊNCIA, não os dados: nenhuma Demanda de Edição é
   recriada, nenhum dado importado é apagado.

   Duas telas distintas atrás da mesma rota "#/video":
     - PRODUÇÃO DE VÍDEO (equipe — admin/coordenador): fila inteira,
       por competência (mês/ano), com filtros, lista/quadro e resumo.
     - CENTRAL DE VÍDEO (quem é videomaker — papel principal OU função
       extra, ver migration_video_producao.sql): fila pessoal, o que
       precisa de atenção agora, sem exigir troca de "modo".
   Quem é equipe E videomaker (ex.: Kevin, admin + função extra
   videomaker) vê Produção de Vídeo com uma aba "Minha fila" — não
   dois itens de menu, nem duas contas.

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
  const meuId = () => { const u = B7.Auth && B7.Auth.usuario(); return u ? u.id : null; };
  const hoje = () => B7.UI.hojeISO();

  const SITUACOES = [
    ['pendente', 'Pendente'],
    ['em_edicao', 'Em edição'],
    ['correcao', 'Correção'],
    ['standby', 'Standby'],
    ['entregue', 'Entregue'],
    ['descartado', 'Descartado']
  ];
  const rotuloSituacao = s => (SITUACOES.find(x => x[0] === s) || [, s])[1];

  const PRIORIDADES = [['normal', 'Normal'], ['alta', 'Alta'], ['urgente', 'Urgente']];

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

  let demandas = [], clientes = [], videomakers = [];

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
  async function abrir() {
    B7.Dashboard.marcarNav('#/video');
    const equipe = souEquipe();
    B7.Rota.titulo([equipe ? 'Produção de Vídeo' : 'Central de Vídeo']);
    painel().innerHTML = '<div class="conteudo vd-tela">' +
      '<header class="vd-cab"><h1>' + esc(equipe ? 'Produção de Vídeo' : 'Central de Vídeo') + '</h1>' +
      '<p>Carregando as demandas…</p></header>' +
      B7.UI.skeleton('tabela', { n: 5, cols: 5 }) + '</div>';

    try {
      const chamadas = [B7.DB.minhasDemandasVideo()];
      if (equipe) chamadas.push(B7.DB.listarClientes(), B7.DB.listarVideomakers());
      const [d, c, v] = await Promise.all(chamadas);
      demandas = d || [];
      clientes = c || [];
      videomakers = v || [];
    } catch (e) {
      painel().innerHTML = '<div class="conteudo vd-tela"><div class="estado-b7">' +
        '<b>Não foi possível carregar a Produção de Vídeo.</b>' +
        '<p>' + esc(e.message || 'Confira a conexão e tente de novo.') + '</p>' +
        '<div class="acoes"><button class="b pri" onclick="location.reload()">Tentar de novo</button></div>' +
        '</div></div>';
      return;
    }

    if (!F.competencia) F.competencia = mesAtualChave();

    if (equipe) desenharProducao(); else desenharCentral();
  }

  /* =================================================================
     PRODUÇÃO DE VÍDEO — equipe (admin/coordenador)
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
      if (F.status && d.editing_status !== F.status) return false;
      if (F.prazo === 'atrasadas' && !ehAtrasada(d)) return false;
      return true;
    });
  }
  function ehAtrasada(d) {
    return !!(d.prazo && d.prazo < hoje() && d.editing_status !== 'entregue' && d.editing_status !== 'descartado');
  }
  function filtrosAtivos() {
    return !!(F.cliente || F.status || F.responsavel || F.prioridade || F.prazo || F.busca.trim() || F.minhaFila);
  }

  function desenharProducao() {
    const base = baseFiltrada();
    const visiveis = filtrar(base);
    const comp = competenciasDisponiveis();
    const souTambemVideomaker = souVideomakerElegivel();

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
      '<div class="vd-acoes-topo">' +
        '<button class="b contorno" id="vd-importar">Importar planilha</button>' +
        '<button class="b pri" id="vd-nova">+ Nova demanda</button></div>' +
      '</div>' +
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
    const btVerAnteriores = document.getElementById('vd-ver-anteriores');
    if (btVerAnteriores) btVerAnteriores.onclick = () => {
      F.competencia = 'todas'; F.prazo = 'atrasadas'; guardarFiltros(); desenharProducao();
    };

    desenharResumo(base);
    desenharBarra(comp, souTambemVideomaker);
    desenharArea(visiveis);
  }

  function desenharResumo(base) {
    const cx = painel().querySelector('#vd-resumo');
    if (!cx) return;
    const contar = pred => base.filter(pred).length;
    const chips = [
      ['prazo:atrasadas', contar(ehAtrasada), 'atrasada' + (contar(ehAtrasada) === 1 ? '' : 's'), F.prazo === 'atrasadas'],
      ['status:pendente', contar(d => d.editing_status === 'pendente'), 'pendente' + (contar(d => d.editing_status === 'pendente') === 1 ? '' : 's'), F.status === 'pendente'],
      ['status:em_edicao', contar(d => d.editing_status === 'em_edicao'), 'em edição', F.status === 'em_edicao'],
      ['status:correcao', contar(d => d.editing_status === 'correcao'), 'em correção', F.status === 'correcao'],
      ['status:standby', contar(d => d.editing_status === 'standby'), 'em standby', F.status === 'standby'],
      ['status:entregue', contar(d => d.editing_status === 'entregue'), 'entregue' + (contar(d => d.editing_status === 'entregue') === 1 ? '' : 's'), F.status === 'entregue']
    ].filter(c => c[1] > 0 || c[3]);

    cx.innerHTML = '<div class="ds-resumo-rapido">' + chips.map(([chave, n, rot, on]) =>
      '<button class="ds-rapido-item' + (on ? ' on' : '') + '" data-resumo="' + chave + '"><b>' + n + '</b> ' + esc(rot) + '</button>').join('') +
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
      opc('status', F.status, [['', 'Status']].concat(SITUACOES), 'Status') +
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
          '<td class="vd-codigo">' + esc(d.codigo || '—') + '</td>' +
          '<td>' + esc(d.cliente_nome || '—') + '</td>' +
          '<td class="vd-tb-titulo">' + tituloComFallback(d) + '</td>' +
          '<td>' + prioridadeBadge(d.prioridade) + '</td>' +
          '<td>' + prazoHTML(d, atrasada) + '</td>' +
          '<td>' + statusBadge(d.editing_status) + '</td>' +
          '<td>' + (d.videomaker_nome ? esc(d.videomaker_nome) : '<i class="vd-sem">sem responsável</i>') + '</td>' +
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
  const COLUNAS_KANBAN = SITUACOES;
  const LIMITE_COLUNA = 30;
  function quadroHTML(lista) {
    const grupos = COLUNAS_KANBAN.map(([chave, nome]) => ({
      chave, nome, itens: lista.filter(d => d.editing_status === chave)
    }));
    return '<div class="vd-quadro">' + grupos.map(colunaHTML).join('') + '</div>';
  }
  function colunaHTML(g) {
    const mostrar = g.itens.slice(0, LIMITE_COLUNA);
    const resto = g.itens.length - mostrar.length;
    return '<div class="vd-coluna" data-coluna="' + g.chave + '">' +
      '<div class="vd-coluna-cab"><span>' + esc(g.nome) + '</span><b>' + g.itens.length + '</b></div>' +
      '<div class="vd-coluna-corpo">' +
      (mostrar.length ? mostrar.map(cardHTML).join('') : '<div class="vd-vazia">—</div>') +
      (resto > 0 ? '<button class="vd-ver-mais" data-coluna-ver-mais="' + g.chave + '">+' + resto + ' entregue' + (resto === 1 ? '' : 's') + '…</button>' : '') +
      '</div></div>';
  }
  function cardHTML(d) {
    const atrasada = ehAtrasada(d);
    return '<div class="vd-card" data-demanda="' + d.id + '" tabindex="0">' +
      '<div class="vd-card-topo"><b>' + esc(d.cliente_nome || 'Cliente') + '</b>' +
      (d.codigo ? '<span class="vd-codigo">' + esc(d.codigo) + '</span>' : '') + '</div>' +
      '<div class="vd-card-titulo">' + tituloComFallback(d) + '</div>' +
      (d.prioridade && d.prioridade !== 'normal' ? prioridadeBadge(d.prioridade) : '') +
      '<div class="vd-card-rodape">' +
      (d.videomaker_nome ? '<span class="vd-quem">' + esc(d.videomaker_nome) + '</span>' : '<span class="vd-quem fraca">sem responsável</span>') +
      (d.prazo ? '<span class="vd-prazo' + (atrasada ? ' atrasado' : '') + '">' + esc(B7.UI.dataBR(d.prazo)) + '</span>' : '') +
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
    });
  }

  /* =================================================================
     CENTRAL DE VÍDEO — quem é videomaker (papel ou função extra), e
     não é equipe. Mesmo espírito de "Central do Designer" (js/design.js):
     o que precisa de mim agora, não um painel administrativo.
     ================================================================= */
  function desenharCentral() {
    const minhas = demandas; /* RLS já entrega só o que é meu quando não sou equipe */
    const ativas = minhas.filter(d => d.editing_status !== 'entregue' && d.editing_status !== 'descartado');
    const atrasadasAgora = ativas.filter(ehAtrasada);
    const correcoes = ativas.filter(d => d.editing_status === 'correcao');
    const emEdicao = ativas.filter(d => d.editing_status === 'em_edicao' && !ehAtrasada(d) && d.editing_status !== 'correcao');
    const pendentes = ativas.filter(d => d.editing_status === 'pendente' && !ehAtrasada(d));
    const standby = ativas.filter(d => d.editing_status === 'standby');
    const mesAtual = mesAtualChave();
    const anteriores = ativas.filter(d => competenciaChave(d) && competenciaChave(d) < mesAtual);
    const entreguesRecentes = minhas.filter(d => d.editing_status === 'entregue')
      .sort((a, b) => (b.entregue_em || '').localeCompare(a.entregue_em || '')).slice(0, 6);

    /* ordem de prioridade da própria tela (não muda status/prioridade
       real de nada — é só a ordem de leitura): atrasadas, correções,
       hoje/amanhã, alta prioridade, o resto */
    const prazoLabel = d => d.prazo === hoje() ? 'hoje' : (d.prazo && d.prazo > hoje() && diasAte(d.prazo) === 1 ? 'amanhã' : '');
    const precisaAgora = [...atrasadasAgora, ...correcoes,
      ...emEdicao.filter(d => prazoLabel(d)), ...pendentes.filter(d => prazoLabel(d)),
      ...emEdicao.filter(d => !prazoLabel(d) && d.prioridade === 'alta'),
      ...pendentes.filter(d => !prazoLabel(d) && d.prioridade === 'alta')]
      .filter((d, i, arr) => arr.findIndex(x => x.id === d.id) === i);
    const restoAtivo = ativas.filter(d => !precisaAgora.some(p => p.id === d.id) && !anteriores.some(a => a.id === d.id));

    painel().innerHTML = '<div class="conteudo entra vd-tela vd-central">' +
      '<header class="vd-cab"><div><h1>O que precisa de você agora</h1>' +
      '<p>' + minhas.length + ' demanda' + (minhas.length === 1 ? '' : 's') + ' atribuída' + (minhas.length === 1 ? '' : 's') + ' a você.</p></div></header>' +

      (anteriores.length
        ? '<section class="vd-sec"><h2>Pendências de meses anteriores <span>' + anteriores.length + '</span></h2>' +
          '<div class="vd-fila">' + anteriores.map(linhaCentral).join('') + '</div></section>'
        : '') +

      (precisaAgora.length
        ? '<section class="vd-sec vd-sec-precisa"><h2>Precisa de você agora <span>' + precisaAgora.length + '</span></h2>' +
          '<div class="vd-fila">' + precisaAgora.map(linhaCentral).join('') + '</div></section>'
        : '') +

      (standby.length
        ? '<section class="vd-sec"><h2>Em standby <span>' + standby.length + '</span></h2>' +
          '<div class="vd-fila">' + standby.map(linhaCentral).join('') + '</div></section>'
        : '') +

      (restoAtivo.length
        ? '<section class="vd-sec"><h2>Demais demandas em aberto <span>' + restoAtivo.length + '</span></h2>' +
          '<div class="vd-fila">' + restoAtivo.map(linhaCentral).join('') + '</div></section>'
        : '') +

      (entreguesRecentes.length
        ? '<section class="vd-sec vd-sec-fraca"><h2>Entregues recentemente</h2>' +
          '<div class="vd-fila">' + entreguesRecentes.map(linhaCentral).join('') + '</div></section>'
        : '') +

      (!minhas.length
        ? '<div class="estado-b7"><b>Nenhuma demanda atribuída a você ainda.</b>' +
          '<p>Assim que a equipe atribuir algo, aparece aqui.</p></div>'
        : '') +
    '</div>';

    ligarArea(painel());
  }

  function diasAte(iso) { return Math.round((new Date(iso) - new Date(hoje())) / 86400000); }

  function linhaCentral(d) {
    const atrasada = ehAtrasada(d);
    return '<article class="vd-item-central" data-demanda="' + d.id + '" tabindex="0" role="button">' +
      '<div class="vd-ic-tx">' +
        '<span class="vd-ic-cliente">' + esc(d.cliente_nome || 'Cliente') + (d.codigo ? ' · ' + esc(d.codigo) : '') + '</span>' +
        '<b>' + tituloComFallback(d) + '</b>' +
      '</div>' +
      '<div class="vd-ic-meta">' +
        statusBadge(d.editing_status) +
        (d.prioridade && d.prioridade !== 'normal' ? prioridadeBadge(d.prioridade) : '') +
        (d.prazo ? '<span class="vd-prazo' + (atrasada ? ' atrasado' : '') + '">' + esc(B7.UI.dataBR(d.prazo)) + '</span>' : '') +
      '</div>' +
    '</article>';
  }

  /* =================================================================
     NOVA DEMANDA (manual, equipe)
     ================================================================= */
  function modalNovaDemanda() {
    if (!clientes.length) { B7.UI.toast('Cadastre um cliente antes de criar uma demanda.'); return; }
    const compAtual = F.competencia !== 'todas' && F.competencia ? F.competencia.split('-') : null;
    const m = B7.UI.modal(
      '<h3>Nova demanda de edição</h3>' +
      '<label class="rot">Cliente</label>' +
      '<select class="campo" id="vd-nd-cliente" data-foco>' +
        clientes.map(c => '<option value="' + c.id + '">' + esc(c.nome) + '</option>').join('') +
      '</select>' +
      '<label class="rot">Título</label>' +
      '<input class="campo" id="vd-nd-titulo" placeholder="Ex.: Reel de lançamento">' +
      '<div class="vd-grid-2">' +
        '<div><label class="rot">Código (opcional)</label><input class="campo" id="vd-nd-codigo" placeholder="Ex.: 014"></div>' +
        '<div><label class="rot">Pacote (opcional)</label><input class="campo" id="vd-nd-pacote" placeholder="Ex.: Mensal 8 vídeos"></div>' +
      '</div>' +
      '<div class="vd-grid-2">' +
        '<div><label class="rot">Prazo (opcional)</label><input class="campo" type="date" id="vd-nd-prazo"></div>' +
        '<div><label class="rot">Prioridade</label><select class="campo" id="vd-nd-prioridade">' +
          PRIORIDADES.map(([v, r]) => '<option value="' + v + '"' + (v === 'normal' ? ' selected' : '') + '>' + r + '</option>').join('') +
        '</select></div>' +
      '</div>' +
      '<label class="rot">Responsável (videomaker, opcional)</label>' +
      '<select class="campo" id="vd-nd-videomaker">' +
        '<option value="">Sem atribuir ainda</option>' +
        videomakers.map(v => '<option value="' + v.id + '">' + esc(v.nome) + '</option>').join('') +
      '</select>' +
      '<label class="rot">Vincular a uma gravação deste cliente (opcional)</label>' +
      '<select class="campo" id="vd-nd-gravacao"><option value="">Carregando…</option></select>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" id="vd-nd-salvar">Criar demanda</button></div>');

    const selGravacao = m.querySelector('#vd-nd-gravacao');
    const carregarGravacoes = async clienteId => {
      selGravacao.innerHTML = '<option value="">Carregando…</option>';
      try {
        const gs = await B7.DB.gravacoesDoClienteParaVideo(clienteId);
        selGravacao.innerHTML = '<option value="">Sem vínculo</option>' +
          gs.map(g => '<option value="' + g.id + '">' + esc(g.nome) + (g.data_gravacao ? ' · ' + esc(B7.UI.dataBR(g.data_gravacao)) : '') + '</option>').join('');
      } catch (e) { selGravacao.innerHTML = '<option value="">Sem vínculo</option>'; }
    };
    carregarGravacoes(m.querySelector('#vd-nd-cliente').value);
    m.querySelector('#vd-nd-cliente').onchange = e => carregarGravacoes(e.target.value);

    m.querySelector('#vd-nd-salvar').onclick = async () => {
      const titulo = m.querySelector('#vd-nd-titulo').value.trim();
      if (!titulo) { B7.UI.toast('Dê um título para a demanda.'); return; }
      const btn = m.querySelector('#vd-nd-salvar');
      btn.disabled = true; btn.textContent = 'Criando…';
      try {
        await B7.DB.criarDemandaVideo({
          clienteId: m.querySelector('#vd-nd-cliente').value,
          titulo,
          codigo: m.querySelector('#vd-nd-codigo').value.trim(),
          pacote: m.querySelector('#vd-nd-pacote').value.trim(),
          prazo: m.querySelector('#vd-nd-prazo').value || null,
          videomakerId: m.querySelector('#vd-nd-videomaker').value || null,
          gravacaoId: selGravacao.value || null,
          prioridade: m.querySelector('#vd-nd-prioridade').value,
          competenciaAno: compAtual ? Number(compAtual[0]) : null,
          competenciaMes: compAtual ? Number(compAtual[1]) : null
        });
        m.fechar();
        B7.UI.toast('Demanda criada.');
        abrir();
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Criar demanda';
        B7.UI.toast(e.message || 'Não foi possível criar a demanda.');
      }
    };
  }

  /* =================================================================
     DETALHE DE UMA DEMANDA — layout principal + painel lateral
     ================================================================= */
  async function abrirDetalhe(id) {
    B7.Dashboard.marcarNav('#/video');
    B7.Rota.titulo([souEquipe() ? 'Produção de Vídeo' : 'Central de Vídeo', 'Demanda']);
    painel().innerHTML = '<div class="conteudo vd-tela">' + B7.UI.skeleton('lista', { n: 4 }) + '</div>';

    let d, historico;
    try {
      [d, historico] = await Promise.all([B7.DB.demandaVideo(id), B7.DB.historicoDemandaVideo(id)]);
      if (souEquipe() && !clientes.length) clientes = await B7.DB.listarClientes().catch(() => []);
      if (souEquipe() && !videomakers.length) videomakers = await B7.DB.listarVideomakers().catch(() => []);
    } catch (e) {
      painel().innerHTML = '<div class="conteudo vd-tela"><div class="estado-b7">' +
        '<b>Não foi possível abrir esta demanda.</b><p>' + esc(e.message || '') + '</p>' +
        '<div class="acoes"><button class="b" onclick="location.hash=\'#/video\'">Voltar</button></div>' +
        '</div></div>';
      return;
    }

    const podeEditar = souEquipe();
    const podeOperar = souEquipe() || d.videomaker_id === meuId();
    const atrasada = ehAtrasada(d);

    painel().innerHTML = '<div class="conteudo entra vd-tela vd-detalhe">' +
      '<div class="trilha"><a href="#/video">' + esc(souEquipe() ? 'Produção de Vídeo' : 'Central de Vídeo') + '</a><span>/</span><b>' + esc(d.titulo) + '</b></div>' +
      '<header class="vd-cab"><div><h1>' + tituloComFallback(d) + '</h1>' +
      '<p>' + esc(d.cliente_nome || '') + (d.codigo ? ' · ' + esc(d.codigo) : '') +
      (d.competencia_ano ? ' · ' + esc(competenciaRotulo(competenciaChave(d))) : '') + '</p></div>' +
      (podeEditar ? '<button class="b fina contorno" id="vd-dt-excluir">Excluir</button>' : '') +
      '</header>' +

      '<div class="vd-detalhe-corpo">' +
        '<div class="vd-detalhe-principal">' +
          (d.link_material
            ? '<a class="b pri vd-abrir-materiais" href="' + esc(d.link_material) + '" target="_blank" rel="noopener">Abrir materiais</a>'
            : (podeOperar ? '' : '<div class="estado-b7 vd-sem-material"><b>Sem materiais vinculados ainda.</b></div>')) +
          '<div class="vd-dt-campo vd-dt-link"><label class="rot">Link do material editado</label>' +
          (podeOperar
            ? '<div class="vd-link-linha"><input class="campo" id="vd-dt-link" placeholder="https://drive.google.com/…" value="' + esc(d.link_material || '') + '">' +
              '<button class="b" id="vd-dt-link-salvar">Salvar</button></div>' +
              '<p class="fraca">Link externo (Drive, WeTransfer…) — nesta etapa o vídeo não é enviado para dentro do sistema.</p>'
            : '') +
          '</div>' +

          (podeEditar
            ? '<div class="vd-dt-campo"><label class="rot">Observações</label>' +
              '<textarea class="campo alta" id="vd-dt-obs" rows="4">' + esc(d.observacoes || '') + '</textarea></div>'
            : (d.observacoes ? '<div class="vd-dt-campo"><label class="rot">Observações</label><div class="vd-so-leitura">' + esc(d.observacoes) + '</div></div>' : '')) +

          '<div class="vd-dt-campo"><label class="rot">Histórico</label>' +
          (historico.length
            ? '<ul class="vd-timeline">' + historico.map(linhaHistorico).join('') + '</ul>'
            : '<div class="vd-so-leitura">Sem eventos ainda.</div>') +
          '</div>' +
        '</div>' +

        '<aside class="vd-detalhe-lateral">' +
          '<div class="vd-dt-campo"><label class="rot">Situação</label>' +
          (podeOperar
            ? '<select class="campo" id="vd-dt-status">' +
              SITUACOES.map(([v, n]) => '<option value="' + v + '"' + (v === d.editing_status ? ' selected' : '') + '>' + n + '</option>').join('') +
              '</select>'
            : '<div class="vd-so-leitura">' + statusBadge(d.editing_status) + '</div>') +
          '</div>' +
          '<div class="vd-dt-campo"><label class="rot">Prioridade</label>' +
          (podeEditar
            ? '<select class="campo" id="vd-dt-prioridade">' +
              PRIORIDADES.map(([v, r]) => '<option value="' + v + '"' + (v === (d.prioridade || 'normal') ? ' selected' : '') + '>' + r + '</option>').join('') +
              '</select>'
            : '<div class="vd-so-leitura">' + prioridadeBadge(d.prioridade) + '</div>') +
          '</div>' +
          '<div class="vd-dt-campo"><label class="rot">Responsável</label>' +
          (podeEditar
            ? '<select class="campo" id="vd-dt-videomaker"><option value="">Sem atribuir</option>' +
              videomakers.map(v => '<option value="' + v.id + '"' + (v.id === d.videomaker_id ? ' selected' : '') + '>' + esc(v.nome) + '</option>').join('') +
              '</select>'
            : '<div class="vd-so-leitura">' + esc(d.videomaker_nome || 'sem responsável') + '</div>') +
          '</div>' +
          '<div class="vd-dt-campo"><label class="rot">Prazo</label>' +
          (podeEditar ? '<input class="campo" type="date" id="vd-dt-prazo" value="' + (d.prazo || '') + '">' :
            '<div class="vd-so-leitura">' + (d.prazo ? esc(B7.UI.dataBR(d.prazo)) + (atrasada ? ' — atrasada' : '') : '—') + '</div>') +
          '</div>' +
          '<div class="vd-dt-campo"><label class="rot">Competência</label>' +
          '<div class="vd-so-leitura">' + (d.competencia_ano ? esc(competenciaRotulo(competenciaChave(d))) : '—') + '</div>' +
          '</div>' +
          '<div class="vd-dt-campo"><label class="rot">Pacote</label>' +
          (podeEditar ? '<input class="campo" id="vd-dt-pacote" value="' + esc(d.pacote || '') + '">' :
            '<div class="vd-so-leitura">' + esc(d.pacote || '—') + '</div>') +
          '</div>' +
          '<div class="vd-dt-campo"><label class="rot">Gravação vinculada</label>' +
          (podeEditar
            ? '<select class="campo" id="vd-dt-gravacao"><option value="">Carregando…</option></select>'
            : '<div class="vd-so-leitura">' + (d.gravacao_nome ? esc(d.gravacao_nome) + ' (' + esc(d.gravacao_situacao || '') + ')' : 'sem vínculo') + '</div>') +
          '</div>' +
          '<div class="vd-dt-campo"><label class="rot">Origem</label>' +
          '<div class="vd-so-leitura">' + (d.origem === 'importacao' ? 'Importada de planilha' : 'Criada manualmente') + '</div>' +
          '</div>' +
          (podeEditar ? '<div class="acoes"><button class="b pri" id="vd-dt-salvar">Salvar alterações</button></div>' : '') +
        '</aside>' +
      '</div>' +
    '</div>';

    ligarDetalhe(d);
  }

  function linhaHistorico(ev) {
    let texto;
    if (ev.tipo === 'criada') texto = 'Demanda criada';
    else if (ev.tipo === 'atribuida') texto = ev.mensagem === 'Atribuição removida' ? 'Atribuição removida' : 'Responsável atribuído';
    else if (ev.tipo === 'status') texto = 'Situação mudou para "' + esc(rotuloSituacao(ev.para_status)) + '"';
    else if (ev.tipo === 'link_material') texto = 'Link do material atualizado';
    else texto = esc(ev.tipo);
    return '<li><b>' + esc(ev.ator_nome || 'Alguém') + '</b> — ' + texto +
      (ev.mensagem && ev.tipo === 'status' ? '<div class="vd-tl-msg">' + esc(ev.mensagem) + '</div>' : '') +
      '<span class="vd-tl-quando">' + esc(B7.UI.quando ? B7.UI.quando(ev.created_at) : ev.created_at) + '</span></li>';
  }

  function ligarDetalhe(d) {
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

    const btLink = document.getElementById('vd-dt-link-salvar');
    if (btLink) btLink.onclick = async () => {
      const link = document.getElementById('vd-dt-link').value.trim();
      btLink.disabled = true;
      try { await B7.DB.definirLinkVideo(d.id, link); B7.UI.toast('Link salvo.'); abrirDetalhe(d.id); }
      catch (e) { B7.UI.toast(e.message || 'Não foi possível salvar o link.'); }
      finally { btLink.disabled = false; }
    };

    const selGravacaoDt = document.getElementById('vd-dt-gravacao');
    if (selGravacaoDt) {
      B7.DB.gravacoesDoClienteParaVideo(d.client_id).then(gs => {
        selGravacaoDt.innerHTML = '<option value="">Sem vínculo</option>' +
          gs.map(g => '<option value="' + g.id + '"' + (g.id === d.gravacao_id ? ' selected' : '') + '>' +
            esc(g.nome) + (g.data_gravacao ? ' · ' + esc(B7.UI.dataBR(g.data_gravacao)) : '') + '</option>').join('');
      }).catch(() => { selGravacaoDt.innerHTML = '<option value="">Sem vínculo</option>'; });
    }

    const btSalvar = document.getElementById('vd-dt-salvar');
    if (btSalvar) btSalvar.onclick = async () => {
      btSalvar.disabled = true; btSalvar.textContent = 'Salvando…';
      try {
        await B7.DB.editarDemandaVideo(d.id, {
          pacote: document.getElementById('vd-dt-pacote').value.trim(),
          prazo: document.getElementById('vd-dt-prazo').value || null,
          temPrazo: true,
          observacoes: document.getElementById('vd-dt-obs') ? document.getElementById('vd-dt-obs').value.trim() : undefined,
          gravacaoId: document.getElementById('vd-dt-gravacao').value || null,
          temGravacao: true,
          prioridade: document.getElementById('vd-dt-prioridade').value
        });
        B7.UI.toast('Alterações salvas.');
        abrirDetalhe(d.id);
      } catch (e) {
        btSalvar.disabled = false; btSalvar.textContent = 'Salvar alterações';
        B7.UI.toast(e.message || 'Não foi possível salvar.');
      }
    };

    const btExcluir = document.getElementById('vd-dt-excluir');
    if (btExcluir) btExcluir.onclick = async () => {
      const ok = await B7.UI.confirmar({ titulo: 'Excluir esta demanda?', texto: 'A demanda sai da lista. Isso não apaga o histórico.', perigo: true, rotulo: 'Excluir' });
      if (!ok) return;
      try { await B7.DB.excluirDemandaVideo(d.id); B7.UI.toast('Demanda excluída.'); location.hash = '#/video'; }
      catch (e) { B7.UI.toast(e.message || 'Não foi possível excluir.'); }
    };
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

  function modalImportar() {
    const m = B7.UI.modal(
      '<h3>Importar planilha (CSV ou XLSX)</h3>' +
      '<p class="fraca">O sistema encontra sozinho a linha de cabeçalho (mesmo com linhas de lixo antes ' +
      'dela) e reconhece colunas parecidas com Cliente, Briefing/Título, Cód., Pacote, Prazo, Mês/Competência ' +
      'e Status, em qualquer ordem. Uma coluna de cliente é obrigatória — as demais são opcionais e, quando ' +
      'faltar título, a linha ainda é importada com um título de referência. No XLSX só a primeira aba do ' +
      'arquivo é lida.</p>' +
      '<input type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" id="vd-imp-arquivo" data-foco>' +
      '<div id="vd-imp-resultado"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>', { larga: true });

    m.querySelector('#vd-imp-arquivo').onchange = async ev => {
      const arquivo = ev.target.files[0];
      if (!arquivo) return;
      const ehXlsx = /\.xlsx?$/i.test(arquivo.name);
      let linhas;
      try {
        linhas = ehXlsx ? parseXLSX(await arquivo.arrayBuffer()) : parseCSV(await arquivo.text());
      } catch (e) {
        B7.UI.toast('Não foi possível ler este arquivo (' + (e.message || 'formato inválido') + ').');
        return;
      }
      if (!linhas.length) { B7.UI.toast('Planilha vazia.'); return; }

      const area = m.querySelector('#vd-imp-resultado');
      area.innerHTML = '<p>Processando ' + linhas.length + ' linha(s)…</p>';
      let loteId;
      try { loteId = await B7.DB.importarPlanilhaVideo(arquivo.name, linhas); }
      catch (e) { area.innerHTML = '<p class="vd-erro">' + esc(e.message || 'Falha ao importar.') + '</p>'; return; }
      await desenharResultadoImportacao(area, loteId);
    };
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

  return { abrir, abrirDetalhe };
})();
