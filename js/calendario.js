/* =====================================================================
   B7 CALENDÁRIO DE GRAVAÇÕES (Parte 3) — integração real com o Google
   Calendar da conta branding7dados.

   Este sistema já teve uma agenda integrada ao Google; foi removida de
   propósito numa rodada anterior ("essa função passa a viver no sistema
   da N7", CENTRAL.md). Está sendo reconstruída aqui a pedido de quem usa
   o sistema — a reversão foi decisão de vocês, registrada no changelog
   desta rodada.

   Arquitetura: o navegador NUNCA fala direto com a API do Google. Tudo
   que precisa do token de acesso (listar agendas, sincronizar eventos,
   conectar/desconectar, mover/cancelar um evento) passa pela Edge
   Function "google-agenda" (js/database.js → chamarCalendarioGoogle). O
   que só precisa do banco é RPC direto — mesmo padrão do resto do B7.

   Sem job agendado neste projeto (mesma limitação já registrada em
   migration_video_gestao.sql): a sincronização acontece quando alguém
   da equipe abre esta tela, não um relógio rodando sozinho no servidor.

   STATUS DE OCORRÊNCIA (migration_calendario_status.sql) — o coração
   desta rodada: cada gravação vinculada a um evento vira uma ou mais
   "ocorrências" ao longo do tempo (public.gravacoes_ocorrencias). Remarcar
   NUNCA apaga a ocorrência antiga: ela fica congelada na data original,
   com status "remarcada" (amarelo), e uma ocorrência nova aparece na
   data nova, "marcada" (azul) — as duas ligadas à mesma gravação, pro
   histórico do calendário nunca sumir. Cancelar mantém a linha no lugar,
   só muda a cor pra vermelho. Concluída fica verde. A tela combina esse
   histórico de ocorrências com os eventos do Google que AINDA não foram
   vinculados a nenhuma gravação (esses continuam aparecendo do jeito que
   já apareciam, com o badge "Sem vínculo").
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Calendario = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');
  const papel = () => B7.Auth && B7.Auth.papel && B7.Auth.papel();
  const souEquipeInterna = () => ['admin', 'coordenador', 'designer', 'videomaker'].includes(papel());
  const souGestor = () => ['admin', 'coordenador'].includes(papel());

  const DIA_MS = 86400000;
  const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const DIAS_SEMANA_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  const STATUS_ROTULO = { marcada: 'Marcada', remarcada: 'Remarcada', concluida: 'Concluída', cancelada: 'Cancelada' };
  const STATUS_CLASSE = { marcada: 'cal-st-marcada', remarcada: 'cal-st-remarcada', concluida: 'cal-st-concluida', cancelada: 'cal-st-cancelada' };

  let conexao = null, agendas = [], eventos = [], ocorrencias = [], clientesCache = null;
  let carregando = true, erroCarga = null;
  let janelaRef = new Date();   // data de referência pra calcular a janela visível

  const F_PADRAO = { vista: 'hoje', cliente: '', agenda: '', status: '', busca: '' };
  let F = Object.assign({}, F_PADRAO);
  try { Object.assign(F, JSON.parse(sessionStorage.getItem('b7.calendario.filtros') || '{}')); } catch (e) {}
  if (!['hoje', 'mes', 'semana', 'agenda'].includes(F.vista)) F.vista = 'hoje';
  function guardarFiltros() { try { sessionStorage.setItem('b7.calendario.filtros', JSON.stringify(F)); } catch (e) {} }

  function inicioDoDia(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function inicioDaSemana(d) { const x = inicioDoDia(d); x.setDate(x.getDate() - x.getDay()); return x; }
  function isoData(d) { return d.toISOString ? d.toISOString().slice(0, 10) : String(d).slice(0, 10); }
  function chaveDia(d) {
    const x = new Date(d);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }

  function calcularJanela() {
    if (F.vista === 'hoje') {
      const inicio = inicioDoDia(janelaRef);
      const fim = new Date(inicio.getTime() + DIA_MS);
      return { inicio, fim };
    }
    if (F.vista === 'semana') {
      const inicio = inicioDaSemana(janelaRef);
      const fim = new Date(inicio.getTime() + 7 * DIA_MS);
      return { inicio, fim };
    }
    if (F.vista === 'mes') {
      const primeiroDoMes = new Date(janelaRef.getFullYear(), janelaRef.getMonth(), 1);
      const inicio = inicioDaSemana(primeiroDoMes);
      const ultimoDoMes = new Date(janelaRef.getFullYear(), janelaRef.getMonth() + 1, 0);
      const fimSemana = inicioDaSemana(ultimoDoMes);
      const fim = new Date(fimSemana.getTime() + 7 * DIA_MS);
      return { inicio, fim };
    }
    // "agenda": janela rolante de 21 dias a partir da referência
    const inicio = inicioDoDia(janelaRef);
    const fim = new Date(inicio.getTime() + 21 * DIA_MS);
    return { inicio, fim };
  }

  /* =================================================================
     CARGA
     ================================================================= */
  async function abrir() {
    B7.Dashboard.marcarNav('#/calendario');
    B7.Rota.titulo(['Calendário de Gravações']);
    janelaRef = new Date();

    /* retorno do popup de conexão do Google (ver paginaRetorno na Edge
       Function) — se abriu direto sem popup, o parâmetro chega na URL. */
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    if (params.has('conectado')) {
      history.replaceState(null, '', location.pathname + location.search + '#/calendario');
      B7.UI.toast(params.get('conectado') === '1' ? 'Google Calendar conectado.' : 'Não foi possível conectar ao Google.');
    }
    window.addEventListener('message', aoReceberMensagemPopup);

    await carregarTudo();
  }

  function aoReceberMensagemPopup(ev) {
    if (!ev.data || ev.data.tipo !== 'b7-google-agenda') return;
    B7.UI.toast(ev.data.ok ? 'Google Calendar conectado.' : (ev.data.mensagem || 'Não foi possível conectar.'));
    carregarTudo();
  }

  async function carregarTudo() {
    carregando = true; erroCarga = null;
    desenhar();
    try {
      const st = await B7.DB.statusConexaoCalendario();
      conexao = st || { conectado: false };
      if (conexao.conectado) {
        const { inicio, fim } = calcularJanela();
        /* sincroniza (best-effort — se falhar, ainda tenta ler o que já
           tem no banco da última vez que deu certo, nunca some com a
           tela) e depois lê do banco, que é a fonte que a tela usa. */
        try { await B7.DB.sincronizarCalendario(inicio.toISOString(), fim.toISOString()); }
        catch (eSync) { conexao.avisoSync = eSync.message; }
        const [ags, evs, ocs] = await Promise.all([
          B7.DB.listarCalendariosGoogle().then(r => r.agendas || []).catch(() => agendas),
          B7.DB.eventosCalendario(inicio.toISOString(), fim.toISOString()).catch(() => []),
          B7.DB.ocorrenciasCalendario(inicio.toISOString(), fim.toISOString()).catch(() => [])
        ]);
        agendas = ags; eventos = evs; ocorrencias = ocs;
      } else {
        agendas = []; eventos = []; ocorrencias = [];
      }
    } catch (e) {
      erroCarga = e.message || 'Não foi possível carregar o calendário.';
    }
    carregando = false;
    desenhar();
  }

  /* Recarrega só o que já está sincronizado (sem chamar a API do Google
     de novo) — usada depois de uma ação nossa (vincular, remarcar,
     cancelar, concluir…) pra atualizar a tela rápido sem gastar mais uma
     chamada de sincronização. */
  async function recarregarLocal() {
    const { inicio, fim } = calcularJanela();
    try {
      const [evs, ocs] = await Promise.all([
        B7.DB.eventosCalendario(inicio.toISOString(), fim.toISOString()),
        B7.DB.ocorrenciasCalendario(inicio.toISOString(), fim.toISOString())
      ]);
      eventos = evs; ocorrencias = ocs;
    } catch (e) { /* mantém o que já tinha — nunca esvazia a tela por causa de uma falha de rede */ }
    desenhar();
  }

  async function apenasRecarregarEventos() {
    if (!conexao || !conexao.conectado) return;
    const { inicio, fim } = calcularJanela();
    try {
      await B7.DB.sincronizarCalendario(inicio.toISOString(), fim.toISOString());
    } catch (e) { conexao.avisoSync = e.message; }
    try {
      const [evs, ocs] = await Promise.all([
        B7.DB.eventosCalendario(inicio.toISOString(), fim.toISOString()),
        B7.DB.ocorrenciasCalendario(inicio.toISOString(), fim.toISOString())
      ]);
      eventos = evs; ocorrencias = ocs;
    } catch (e) { /* mantém o que já tinha */ }
    desenhar();
  }

  /* =================================================================
     ITENS COMBINADOS — ocorrências (gravações com histórico de status) +
     eventos do Google ainda sem nenhuma gravação vinculada.
     ================================================================= */
  function itensCombinados() {
    const semVinculo = eventos.filter(ev => !ev.gravacao_id).map(ev => ({
      tipo: 'evento', id: ev.id, inicio: ev.inicio, fim: ev.fim, dia_inteiro: ev.dia_inteiro,
      titulo: ev.titulo, local: ev.local, agenda_id: ev.agenda_id, agenda_nome: ev.agenda_nome, agenda_cor: ev.agenda_cor,
      status_provider: ev.status_provider
    }));
    const daOcorrencia = ocorrencias.map(o => ({
      tipo: 'ocorrencia', id: o.id, evento_id: o.evento_id, gravacao_id: o.gravacao_id,
      inicio: o.inicio, fim: o.fim, status: o.status, atual: o.atual,
      ocorrencia_anterior_id: o.ocorrencia_anterior_id,
      motivo_cancelamento: o.motivo_cancelamento, erro_sincronizacao: o.erro_sincronizacao,
      titulo: o.gravacao_nome, cliente_id: o.gravacao_client_id, cliente_nome: o.gravacao_cliente_nome,
      cliente_logo_url: o.gravacao_cliente_logo_url, local: o.gravacao_local,
      agenda_id: o.agenda_id, agenda_nome: o.agenda_nome, agenda_cor: o.agenda_cor
    }));
    return semVinculo.concat(daOcorrencia).sort((a, b) => a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0);
  }

  /* =================================================================
     FILTROS
     ================================================================= */
  function itensFiltrados() {
    const t = F.busca.trim().toLowerCase();
    return itensCombinados().filter(it => {
      if (F.agenda && it.agenda_id !== F.agenda) return false;
      if (F.cliente === '__sem__' && it.tipo !== 'evento') return false;
      if (F.cliente && F.cliente !== '__sem__' && it.cliente_id !== F.cliente) return false;
      if (F.status === 'nao_vinculado' && it.tipo !== 'evento') return false;
      if (['marcada', 'remarcada', 'concluida', 'cancelada'].includes(F.status)) {
        if (it.tipo !== 'ocorrencia' || it.status !== F.status) return false;
      }
      if (t) {
        const alvo = ((it.titulo || '') + ' ' + (it.local || '') + ' ' + (it.cliente_nome || '')).toLowerCase();
        if (!alvo.includes(t)) return false;
      }
      return true;
    });
  }

  function clientesPresentes() {
    const mapa = new Map();
    ocorrencias.forEach(o => { if (o.gravacao_client_id) mapa.set(o.gravacao_client_id, o.gravacao_cliente_nome); });
    return [...mapa.entries()].sort((a, b) => (a[1] || '').localeCompare(b[1] || '', 'pt-BR'));
  }

  /* =================================================================
     DESENHO
     ================================================================= */
  function rotuloJanela() {
    const { inicio, fim } = calcularJanela();
    if (F.vista === 'hoje') {
      return 'Hoje, ' + inicio.getDate() + ' de ' + MESES_LONGOS[inicio.getMonth()];
    }
    if (F.vista === 'semana') {
      const ultimo = new Date(fim.getTime() - DIA_MS);
      return inicio.getDate() + ' ' + MESES[inicio.getMonth()] + ' – ' + ultimo.getDate() + ' ' + MESES[ultimo.getMonth()];
    }
    if (F.vista === 'mes') {
      return MESES_LONGOS[janelaRef.getMonth()].replace(/^./, c => c.toUpperCase()) + ' de ' + janelaRef.getFullYear();
    }
    return 'Próximos 21 dias, a partir de ' + inicio.getDate() + ' ' + MESES[inicio.getMonth()];
  }

  function desenhar() {
    if (!souEquipeInterna()) {
      painel().innerHTML = '<div class="conteudo cal-tela"><div class="estado-b7"><b>Sem acesso.</b></div></div>';
      return;
    }
    if (carregando) {
      painel().innerHTML = '<div class="conteudo cal-tela"><header class="vd-cab"><h1>Calendário de Gravações</h1></header>' +
        B7.UI.skeleton('tabela', { n: 5, cols: 2 }) + '</div>';
      return;
    }
    if (erroCarga) {
      painel().innerHTML = '<div class="conteudo cal-tela"><div class="estado-b7"><b>Não foi possível carregar o Calendário.</b>' +
        '<p>' + esc(erroCarga) + '</p><div class="acoes"><button class="b pri" id="cal-tentar-de-novo">Tentar de novo</button></div></div></div>';
      const bt = document.getElementById('cal-tentar-de-novo');
      if (bt) bt.onclick = carregarTudo;
      return;
    }

    const visiveis = itensFiltrados();

    painel().innerHTML = '<div class="conteudo entra cal-tela">' +
      '<div class="cab-conteudo"><div><h1>Calendário de Gravações</h1>' +
      '<p>' + (conexao.conectado ? 'Conectado como ' + esc(conexao.conta_email || 'conta do Google') : 'Google Calendar não conectado') + '</p></div>' +
      '<div class="vd-acoes-topo">' +
        (conexao.conectado && souGestor() ? '<button class="b pri" id="cal-marcar">+ Marcar gravação</button>' : '') +
        (conexao.conectado ? '<button class="b fina contorno" id="cal-atualizar">Atualizar</button>' : '') +
        (souGestor() ? '<button class="b fina contorno" id="cal-config">Configurações</button>' : '') +
      '</div></div>' +

      (!conexao.conectado ? avisoDesconectadoHTML() :
        (conexao.avisoSync ? '<div class="vd-aviso-anteriores">Não foi possível atualizar agora — mostrando os últimos dados sincronizados. <small class="fraca">' + esc(conexao.avisoSync) + '</small></div>' : '') +
        (agendas.filter(a => a.ativo).length === 0 ? '<div class="vd-aviso-anteriores">Nenhuma agenda ativa. ' + (souGestor() ? 'Escolha ao menos uma em <b>Configurações</b>.' : 'Peça a um admin/coordenador para escolher uma em Configurações.') + '</div>' : '')
      ) +

      (conexao.conectado ? '<div class="cal-barra">' +
        '<div class="cal-nav">' +
          '<button class="b fina contorno" id="cal-ant">‹</button>' +
          '<button class="b fina contorno" id="cal-hoje">Hoje</button>' +
          '<button class="b fina contorno" id="cal-prox">›</button>' +
          '<span class="cal-rotulo-janela">' + esc(rotuloJanela()) + '</span>' +
        '</div>' +
        '<div class="cal-vista">' +
          '<button class="b fina' + (F.vista === 'hoje' ? ' pri' : ' contorno') + '" data-vista="hoje">Hoje</button>' +
          '<button class="b fina' + (F.vista === 'mes' ? ' pri' : ' contorno') + '" data-vista="mes">Mês</button>' +
          '<button class="b fina' + (F.vista === 'semana' ? ' pri' : ' contorno') + '" data-vista="semana">Semana</button>' +
          '<button class="b fina' + (F.vista === 'agenda' ? ' pri' : ' contorno') + '" data-vista="agenda">Agenda</button>' +
        '</div>' +
      '</div>' +
      '<div class="cal-legenda">' +
        '<span class="cal-legenda-item"><i class="cal-dot cal-st-marcada"></i>Marcada</span>' +
        '<span class="cal-legenda-item"><i class="cal-dot cal-st-remarcada"></i>Remarcada</span>' +
        '<span class="cal-legenda-item"><i class="cal-dot cal-st-concluida"></i>Concluída</span>' +
        '<span class="cal-legenda-item"><i class="cal-dot cal-st-cancelada"></i>Cancelada</span>' +
      '</div>' +
      '<div class="cal-filtros">' +
        '<select class="campo" id="cal-f-cliente"><option value="">Todos os clientes</option>' +
          clientesPresentes().map(([id, nome]) => '<option value="' + id + '"' + (F.cliente === id ? ' selected' : '') + '>' + esc(nome) + '</option>').join('') +
        '</select>' +
        '<select class="campo" id="cal-f-agenda"><option value="">Todas as agendas</option>' +
          agendas.filter(a => a.ativo).map(a => '<option value="' + a.id + '"' + (F.agenda === a.id ? ' selected' : '') + '>' + esc(a.nome) + '</option>').join('') +
        '</select>' +
        '<select class="campo" id="cal-f-status"><option value="">Todos os status</option>' +
          '<option value="marcada"' + (F.status === 'marcada' ? ' selected' : '') + '>Marcada</option>' +
          '<option value="remarcada"' + (F.status === 'remarcada' ? ' selected' : '') + '>Remarcada</option>' +
          '<option value="concluida"' + (F.status === 'concluida' ? ' selected' : '') + '>Concluída</option>' +
          '<option value="cancelada"' + (F.status === 'cancelada' ? ' selected' : '') + '>Cancelada</option>' +
          '<option value="nao_vinculado"' + (F.status === 'nao_vinculado' ? ' selected' : '') + '>Sem vínculo (evento cru do Google)</option>' +
        '</select>' +
        '<input class="campo" id="cal-f-busca" placeholder="Buscar título, local, cliente…" value="' + esc(F.busca) + '">' +
      '</div>' : '') +

      '<div id="cal-corpo">' + (conexao.conectado ? (F.vista === 'mes' ? gradeMesHTML(visiveis) : corpoListaHTML(visiveis)) : '') + '</div>' +
    '</div>';

    ligar();
  }

  function avisoDesconectadoHTML() {
    return '<div class="estado-b7 cal-desconectado"><b>O calendário de gravações ainda não está conectado ao Google.</b>' +
      '<p>' + (souGestor()
        ? 'Conecte a conta branding7dados em Configurações para ver as gravações agendadas aqui.'
        : 'Peça a um admin/coordenador para conectar a conta Google em Configurações.') + '</p>' +
      (souGestor() ? '<div class="acoes"><button class="b pri" id="cal-conectar-vazio">Conectar Google Calendar</button></div>' : '') +
      '</div>';
  }

  function agruparPorDia(lista) {
    const mapa = new Map();
    lista.forEach(it => {
      const chave = (it.inicio || '').slice(0, 10);
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(it);
    });
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  /* ---------------------------------------------------------------
     VISTA LISTA (Semana / Agenda) — mesma casca de antes
     --------------------------------------------------------------- */
  function corpoListaHTML(lista) {
    if (!lista.length) {
      return '<div class="estado-b7"><b>Nenhum item nesta janela.</b><p>Ajuste os filtros ou navegue para outro período.</p></div>';
    }
    const hojeStr = B7.UI.hojeISO();
    const porDia = agruparPorDia(lista);
    return '<div class="cal-dias">' + porDia.map(([diaISO, itens]) => {
      const d = new Date(diaISO + 'T00:00:00');
      const ehHoje = diaISO === hojeStr;
      return '<div class="cal-dia' + (ehHoje ? ' hoje' : '') + '">' +
        '<div class="cal-dia-cab"><b>' + DIAS_SEMANA[d.getDay()] + '</b><span>' + d.getDate() + ' de ' + MESES[d.getMonth()] + '</span>' + (ehHoje ? '<em>hoje</em>' : '') + '</div>' +
        '<div class="cal-dia-corpo">' + itens.map(itemCardHTML).join('') + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  /* ---------------------------------------------------------------
     VISTA GRADE DE MÊS
     --------------------------------------------------------------- */
  function gradeMesHTML(lista) {
    const { inicio } = calcularJanela();
    const porDia = new Map();
    lista.forEach(it => {
      const chave = chaveDia(new Date(it.inicio));
      if (!porDia.has(chave)) porDia.set(chave, []);
      porDia.get(chave).push(it);
    });
    const hojeStr = chaveDia(new Date());
    const mesAtual = janelaRef.getMonth();
    const totalDias = Math.round((calcularJanela().fim - inicio) / DIA_MS);

    let html = '<div class="cal-grade-mes">' +
      '<div class="cal-grade-cab">' + DIAS_SEMANA_ABREV.map(d => '<div>' + d + '</div>').join('') + '</div>' +
      '<div class="cal-grade-corpo">';

    for (let i = 0; i < totalDias; i++) {
      const d = new Date(inicio.getTime() + i * DIA_MS);
      const chave = chaveDia(d);
      const itens = (porDia.get(chave) || []).sort((a, b) => a.inicio < b.inicio ? -1 : 1);
      const foraDoMes = d.getMonth() !== mesAtual;
      const ehHoje = chave === hojeStr;
      const MOSTRAR = 3;
      html += '<div class="cal-cel' + (foraDoMes ? ' fora' : '') + (ehHoje ? ' hoje' : '') + '" data-dia="' + chave + '">' +
        '<div class="cal-cel-num">' + d.getDate() + (ehHoje ? '<em>hoje</em>' : '') +
          (souGestor() ? '<button class="cal-cel-add" data-dia-marcar="' + chave + '" title="Marcar gravação neste dia" aria-label="Marcar gravação neste dia">+</button>' : '') +
        '</div>' +
        '<div class="cal-cel-itens">' +
          itens.slice(0, MOSTRAR).map(it => cellChipHTML(it)).join('') +
          (itens.length > MOSTRAR ? '<button class="cal-cel-mais" data-dia-mais="' + chave + '">+' + (itens.length - MOSTRAR) + ' mais</button>' : '') +
        '</div>' +
      '</div>';
    }
    html += '</div></div>';
    return html;
  }

  function cellChipHTML(it) {
    const cor = it.tipo === 'ocorrencia' ? STATUS_CLASSE[it.status] : (it.status_provider === 'cancelled' ? 'cal-st-cancelada' : 'cal-st-semvinculo');
    const titulo = it.tipo === 'ocorrencia' ? (it.titulo || 'Gravação') : (it.titulo || '(sem título)');
    return '<button class="cal-chip ' + cor + '" data-item-tipo="' + it.tipo + '" data-item-id="' + it.id + '">' +
      '<i class="cal-dot"></i><span>' + esc(horaBR(it.inicio)) + ' ' + esc(titulo) + '</span></button>';
  }

  function itemCardHTML(it) {
    const hora = it.dia_inteiro ? 'Dia inteiro' : horaBR(it.inicio) + (it.fim ? '–' + horaBR(it.fim) : '');
    if (it.tipo === 'evento') {
      const cancelado = it.status_provider === 'cancelled';
      return '<div class="cal-evento' + (cancelado ? ' cancelado' : '') + '" data-item-tipo="evento" data-item-id="' + it.id + '" tabindex="0">' +
        '<div class="cal-evento-hora">' + hora + '</div>' +
        '<div class="cal-evento-corpo">' +
          '<div class="cal-evento-titulo">' + esc(it.titulo) + (cancelado ? ' <span class="vd-status vd-status-descartado">Cancelado no Google</span>' : '') + '</div>' +
          '<div class="cal-evento-meta">' +
            (it.local ? '<span>' + esc(it.local) + '</span>' : '') +
            '<span class="cal-evento-agenda" style="' + (it.agenda_cor ? 'color:' + esc(it.agenda_cor) : '') + '">' + esc(it.agenda_nome || 'Agenda') + '</span>' +
          '</div>' +
        '</div>' +
        '<span class="cal-vinculo-badge fraca">Sem vínculo</span>' +
      '</div>';
    }
    // ocorrência
    return '<div class="cal-evento cal-oc ' + STATUS_CLASSE[it.status] + '" data-item-tipo="ocorrencia" data-item-id="' + it.id + '" tabindex="0">' +
      '<div class="cal-evento-hora">' + hora + '</div>' +
      '<div class="cal-evento-corpo">' +
        '<div class="cal-evento-titulo">' + esc(it.titulo || 'Gravação') +
          ' <span class="cal-badge-status ' + STATUS_CLASSE[it.status] + '">' + STATUS_ROTULO[it.status] + '</span>' +
          (!it.atual ? ' <span class="fraca">(histórico)</span>' : '') +
        '</div>' +
        '<div class="cal-evento-meta">' +
          (it.cliente_nome ? '<span>' + esc(it.cliente_nome) + '</span>' : '') +
          (it.local ? '<span>' + esc(it.local) + '</span>' : '') +
          (it.agenda_nome ? '<span class="cal-evento-agenda" style="' + (it.agenda_cor ? 'color:' + esc(it.agenda_cor) : '') + '">' + esc(it.agenda_nome) + '</span>' : '') +
        '</div>' +
        (it.erro_sincronizacao ? '<div class="cal-aviso-sync">⚠ ' + esc(it.erro_sincronizacao) + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  function horaBR(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* =================================================================
     LIGAÇÕES
     ================================================================= */
  function ligar() {
    const cx = painel();
    const btAtualizar = cx.querySelector('#cal-atualizar');
    if (btAtualizar) btAtualizar.onclick = async () => { btAtualizar.disabled = true; await apenasRecarregarEventos(); btAtualizar.disabled = false; };
    const btConfig = cx.querySelector('#cal-config');
    if (btConfig) btConfig.onclick = () => modalConfiguracoes();
    const btConectarVazio = cx.querySelector('#cal-conectar-vazio');
    if (btConectarVazio) btConectarVazio.onclick = () => conectarGoogle();
    const btMarcar = cx.querySelector('#cal-marcar');
    if (btMarcar) btMarcar.onclick = () => modalMarcarGravacao();
    cx.querySelectorAll('[data-dia-marcar]').forEach(el => {
      el.onclick = ev => { ev.stopPropagation(); modalMarcarGravacao(el.dataset.diaMarcar); };
    });

    const btAnt = cx.querySelector('#cal-ant'), btProx = cx.querySelector('#cal-prox'), btHoje = cx.querySelector('#cal-hoje');
    if (btAnt) btAnt.onclick = () => { navegar(-1); };
    if (btProx) btProx.onclick = () => { navegar(1); };
    if (btHoje) btHoje.onclick = () => { janelaRef = new Date(); carregarTudo(); };

    cx.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => {
      F.vista = b.dataset.vista; guardarFiltros(); janelaRef = new Date(); carregarTudo();
    });

    const fCliente = cx.querySelector('#cal-f-cliente'); if (fCliente) fCliente.onchange = e => { F.cliente = e.target.value; guardarFiltros(); desenhar(); };
    const fAgenda = cx.querySelector('#cal-f-agenda'); if (fAgenda) fAgenda.onchange = e => { F.agenda = e.target.value; guardarFiltros(); desenhar(); };
    const fStatus = cx.querySelector('#cal-f-status'); if (fStatus) fStatus.onchange = e => { F.status = e.target.value; guardarFiltros(); desenhar(); };
    const fBusca = cx.querySelector('#cal-f-busca');
    if (fBusca) fBusca.oninput = B7.UI.debounce ? B7.UI.debounce(e => { F.busca = e.target.value; guardarFiltros(); desenhar(); }, 250) : e => { F.busca = e.target.value; guardarFiltros(); desenhar(); };

    cx.querySelectorAll('[data-item-tipo]').forEach(el => {
      const abrirItem = () => abrirDetalheDoItem(el.dataset.itemTipo, el.dataset.itemId);
      el.onclick = abrirItem;
      el.onkeydown = e => { if (e.key === 'Enter') abrirItem(); };
    });
    cx.querySelectorAll('[data-dia-mais]').forEach(el => {
      el.onclick = () => modalDia(el.dataset.diaMais);
    });
  }

  function navegar(direcao) {
    if (F.vista === 'mes') {
      janelaRef = new Date(janelaRef.getFullYear(), janelaRef.getMonth() + direcao, 1);
    } else {
      const passo = F.vista === 'hoje' ? 1 : F.vista === 'semana' ? 7 : 21;
      janelaRef = new Date(janelaRef.getTime() + direcao * passo * DIA_MS);
    }
    carregarTudo();
  }

  function abrirDetalheDoItem(tipo, id) {
    if (tipo === 'evento') {
      const ev = eventos.find(x => x.id === id);
      if (ev) modalEvento(ev);
    } else {
      const oc = ocorrencias.find(x => x.id === id);
      if (oc) modalOcorrencia(normalizarOcorrencia(oc));
    }
  }

  function normalizarOcorrencia(o) {
    return {
      tipo: 'ocorrencia', id: o.id, evento_id: o.evento_id, gravacao_id: o.gravacao_id,
      inicio: o.inicio, fim: o.fim, status: o.status, atual: o.atual,
      ocorrencia_anterior_id: o.ocorrencia_anterior_id,
      motivo_cancelamento: o.motivo_cancelamento, erro_sincronizacao: o.erro_sincronizacao,
      titulo: o.gravacao_nome, cliente_id: o.gravacao_client_id, cliente_nome: o.gravacao_cliente_nome,
      local: o.gravacao_local, agenda_nome: o.agenda_nome, agenda_cor: o.agenda_cor
    };
  }

  /* dia inteiro num modal — usado no "+X mais" da grade de mês */
  function modalDia(diaISO) {
    const d = new Date(diaISO + 'T00:00:00');
    const itens = itensFiltrados().filter(it => chaveDia(new Date(it.inicio)) === diaISO)
      .sort((a, b) => a.inicio < b.inicio ? -1 : 1);
    const m = B7.UI.modal(
      '<h3>' + DIAS_SEMANA[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES_LONGOS[d.getMonth()] + '</h3>' +
      '<div class="cal-dia-corpo">' + (itens.length ? itens.map(itemCardHTML).join('') : '<p class="fraca">Nada nesta data.</p>') + '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>',
      { larga: true }
    );
    m.querySelectorAll('[data-item-tipo]').forEach(el => {
      el.onclick = () => { m.fechar(); abrirDetalheDoItem(el.dataset.itemTipo, el.dataset.itemId); };
    });
  }

  /* =================================================================
     CONECTAR / CONFIGURAÇÕES
     ================================================================= */
  async function conectarGoogle() {
    try {
      const { url } = await B7.DB.iniciarConexaoCalendario();
      const janela = window.open(url, 'b7-google-agenda', 'width=520,height=680');
      if (!janela) { B7.UI.toast('O navegador bloqueou a janela — permita pop-ups para este site e tente de novo.'); return; }
      /* fallback: se o popup fechar sem mandar postMessage (ex.: usuário
         fechou manualmente), recarrega o status mesmo assim. */
      const verificar = setInterval(() => {
        if (janela.closed) { clearInterval(verificar); carregarTudo(); }
      }, 1000);
    } catch (e) { B7.UI.toast(e.message || 'Não foi possível iniciar a conexão.'); }
  }

  function modalConfiguracoes() {
    const conteudo = () =>
      '<h3>Configurações do Calendário</h3>' +
      (conexao.conectado
        ? '<div class="cal-conexao-ok"><b>Conectado</b><span>' + esc(conexao.conta_email || '') + '</span>' +
          (conexao.ultima_sincronizacao ? '<small class="fraca">Última sincronização: ' + esc(B7.UI.quando ? B7.UI.quando(conexao.ultima_sincronizacao) : conexao.ultima_sincronizacao) + '</small>' : '') +
          '</div><button class="b fina contorno" id="cal-cfg-desconectar">Desconectar</button>' +
          '<p class="fraca" style="margin-top:10px">Conectou antes desta rodada (só leitura)? Desconecte e conecte de novo pra conceder a nova permissão de escrita — sem ela, remarcar/cancelar não move o evento no Google.</p>'
        : '<p class="fraca">Nenhuma conta do Google conectada ainda.</p><button class="b pri" id="cal-cfg-conectar">Conectar Google Calendar</button>') +
      (conexao.conectado
        ? '<h4>Agendas</h4><p class="fraca">Escolha quais agendas do Google aparecem no Calendário de Gravações.</p>' +
          '<div id="cal-cfg-agendas">' + agendasListaHTML() + '</div>'
        : '') +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>';

    const m = B7.UI.modal(conteudo(), { larga: true });
    function redesenhar() { m.querySelector('.modal').innerHTML = conteudo(); ligarModal(); }
    function agendasListaHTML() {
      if (!agendas.length) return '<p class="fraca">Nenhuma agenda encontrada — clique em "Atualizar lista" ou confira a conexão.</p><button class="b fina contorno" id="cal-cfg-listar">Atualizar lista de agendas</button>';
      return agendas.map(a => {
        const semEscrita = a.papel_acesso && a.papel_acesso !== 'owner' && a.papel_acesso !== 'writer';
        return '<div class="cal-agenda-item">' +
          '<label><input type="checkbox" data-agenda="' + a.id + '"' + (a.ativo ? ' checked' : '') + '><span>' + esc(a.nome) + '</span></label>' +
          (a.ativo ? '<label class="cal-agenda-padrao"' +
            (semEscrita ? ' title="Esta conta só tem permissão de leitura nesta agenda — não dá pra criar eventos aqui"' : ' title="Gravações marcadas pelo calendário criam o evento nesta agenda"') +
            '><input type="radio" name="cal-agenda-escrita" data-agenda-padrao="' + a.id + '"' +
            (a.escrita_padrao ? ' checked' : '') + (semEscrita ? ' disabled' : '') + '>' +
            '<span>' + (semEscrita ? 'Só leitura — não pode ser agenda de escrita' : 'Usar para novas gravações') + '</span></label>' : '') +
        '</div>';
      }).join('') +
        (agendas.some(a => a.ativo) && !agendas.some(a => a.escrita_padrao) ?
          '<p class="cal-aviso-sync" style="margin:6px 0 10px">⚠ Nenhuma agenda escolhida pra receber novas gravações — marque uma acima.</p>' : '') +
        (agendas.some(a => a.escrita_padrao && a.papel_acesso && a.papel_acesso !== 'owner' && a.papel_acesso !== 'writer') ?
          '<p class="cal-aviso-sync" style="margin:6px 0 10px">⚠ A agenda de escrita atual é só leitura pra esta conta — marcar gravação vai falhar no Google. Clique em "Atualizar lista de agendas" e escolha outra.</p>' : '') +
        '<button class="b fina contorno" id="cal-cfg-listar">Atualizar lista de agendas</button>';
    }
    function ligarModal() {
      m.querySelectorAll('[data-fecha]').forEach(b => b.onclick = m.fechar);
      const btConectar = m.querySelector('#cal-cfg-conectar');
      if (btConectar) btConectar.onclick = async () => { await conectarGoogle(); };
      const btDesconectar = m.querySelector('#cal-cfg-desconectar');
      if (btDesconectar) btDesconectar.onclick = async () => {
        const ok = await B7.UI.confirmar({
          titulo: 'Desconectar o Google Calendar?',
          texto: 'O calendário para de sincronizar. Os eventos já sincronizados continuam visíveis até você conectar de novo — nada é apagado.',
          perigo: true, rotulo: 'Desconectar'
        });
        if (!ok) return;
        btDesconectar.disabled = true;
        try {
          await B7.DB.desconectarCalendario();
          B7.UI.toast('Desconectado.');
          m.fechar();
          carregarTudo();
        } catch (e) { btDesconectar.disabled = false; B7.UI.toast(e.message || 'Não foi possível desconectar.'); }
      };
      const btListar = m.querySelector('#cal-cfg-listar');
      if (btListar) btListar.onclick = async () => {
        btListar.disabled = true; btListar.textContent = 'Atualizando…';
        try {
          const r = await B7.DB.listarCalendariosGoogle();
          agendas = r.agendas || [];
          redesenhar();
        } catch (e) { btListar.disabled = false; btListar.textContent = 'Atualizar lista de agendas'; B7.UI.toast(e.message || 'Não foi possível listar as agendas.'); }
      };
      m.querySelectorAll('[data-agenda]').forEach(chk => {
        chk.onchange = async () => {
          chk.disabled = true;
          try {
            await B7.DB.alternarAgendaCalendario(chk.dataset.agenda, chk.checked);
            const a = agendas.find(x => x.id === chk.dataset.agenda);
            if (a) a.ativo = chk.checked;
            if (a && !chk.checked && a.escrita_padrao) a.escrita_padrao = false;
            redesenhar();
          } catch (e) { chk.checked = !chk.checked; B7.UI.toast(e.message || 'Não foi possível salvar.'); }
        };
      });
      m.querySelectorAll('[data-agenda-padrao]').forEach(rd => {
        rd.onchange = async () => {
          rd.disabled = true;
          try {
            await B7.DB.definirAgendaEscritaPadrao(rd.dataset.agendaPadrao);
            agendas.forEach(a => { a.escrita_padrao = (a.id === rd.dataset.agendaPadrao); });
            redesenhar();
          } catch (e) { rd.checked = false; B7.UI.toast(e.message || 'Não foi possível salvar.'); }
        };
      });
    }
    ligarModal();

    /* se a conexão mudar enquanto o modal está aberto (ex.: conectou
       via popup), refaz o conteúdo. */
    window.addEventListener('message', function ouvinte(ev) {
      if (!ev.data || ev.data.tipo !== 'b7-google-agenda') return;
      window.removeEventListener('message', ouvinte);
      carregarTudo().then(() => { if (document.body.contains(m)) redesenhar(); });
    });
  }

  /* =================================================================
     DETALHE DE UM EVENTO SEM VÍNCULO (fluxo de antes: vincular / criar)
     ================================================================= */
  function modalEvento(ev) {
    const cancelado = ev.status_provider === 'cancelled';
    const dataHora = (ev.dia_inteiro ? B7.UI.dataBR(ev.inicio.slice(0, 10)) + ' · dia inteiro'
      : B7.UI.dataBR(ev.inicio.slice(0, 10)) + ' · ' + horaBR(ev.inicio) + (ev.fim ? '–' + horaBR(ev.fim) : ''));

    const m = B7.UI.modal(
      '<h3>' + esc(ev.titulo) + (cancelado ? ' <span class="vd-status vd-status-descartado">Cancelado</span>' : '') + '</h3>' +
      '<div class="cal-detalhe-grid">' +
        '<div><label class="rot">Data e horário</label><div class="vd-so-leitura">' + esc(dataHora) + '</div></div>' +
        (ev.local ? '<div><label class="rot">Local</label><div class="vd-so-leitura">' + esc(ev.local) + '</div></div>' : '') +
        '<div><label class="rot">Agenda de origem</label><div class="vd-so-leitura">' + esc(ev.agenda_nome || '—') + '</div></div>' +
        (ev.responsavel_texto ? '<div><label class="rot">Responsável (na agenda)</label><div class="vd-so-leitura">' + esc(ev.responsavel_texto) + '</div></div>' : '') +
      '</div>' +
      (ev.descricao ? '<div class="vd-dt-campo"><label class="rot">Descrição</label><div class="vd-so-leitura">' + esc(ev.descricao) + '</div></div>' : '') +
      '<div class="vd-dt-campo"><label class="rot">Gravação</label>' +
        '<p class="fraca">Este evento ainda não está vinculado a nenhuma gravação do B7.</p>' +
        (souGestor() ? '<div class="acoes-inline"><button class="b fina contorno" id="cal-vincular">Vincular gravação</button>' +
          '<button class="b fina contorno" id="cal-criar">Criar gravação</button></div>' : '') +
      '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>'
    );
    const btVincular = m.querySelector('#cal-vincular'); if (btVincular) btVincular.onclick = () => { m.fechar(); modalVincular(ev); };
    const btCriar = m.querySelector('#cal-criar'); if (btCriar) btCriar.onclick = () => { m.fechar(); modalCriarGravacao(ev); };
  }

  async function garantirClientes() {
    if (!clientesCache) clientesCache = await B7.DB.listarClientes().catch(() => []);
    return clientesCache;
  }

  function modalVincular(ev) {
    garantirClientes().then(clientes => {
      const m = B7.UI.modal(
        '<h3>Vincular a uma gravação existente</h3>' +
        '<label class="rot">Cliente</label><select class="campo" id="cal-vn-cliente" data-foco><option value="">Escolha um cliente</option>' +
          clientes.map(c => '<option value="' + c.id + '">' + esc(c.nome) + '</option>').join('') + '</select>' +
        '<label class="rot">Gravação</label><select class="campo" id="cal-vn-gravacao"><option value="">Escolha um cliente primeiro</option></select>' +
        '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" id="cal-vn-salvar" disabled>Vincular</button></div>'
      );
      const selCliente = m.querySelector('#cal-vn-cliente'), selGravacao = m.querySelector('#cal-vn-gravacao'), btSalvar = m.querySelector('#cal-vn-salvar');
      selCliente.onchange = async () => {
        const cid = selCliente.value;
        selGravacao.innerHTML = '<option value="">Carregando…</option>'; btSalvar.disabled = true;
        if (!cid) { selGravacao.innerHTML = '<option value="">Escolha um cliente primeiro</option>'; return; }
        try {
          const gs = await B7.DB.gravacoesDoClienteParaVideo(cid);
          selGravacao.innerHTML = gs.length ? '<option value="">Escolha uma gravação</option>' + gs.map(g =>
            '<option value="' + g.id + '">' + esc(g.nome) + (g.data_gravacao ? ' · ' + esc(B7.UI.dataBR(g.data_gravacao)) : '') + '</option>').join('')
            : '<option value="">Nenhuma gravação para este cliente</option>';
        } catch (e) { selGravacao.innerHTML = '<option value="">Não foi possível carregar</option>'; }
      };
      selGravacao.onchange = () => { btSalvar.disabled = !selGravacao.value; };
      btSalvar.onclick = async () => {
        if (!selGravacao.value) return;
        btSalvar.disabled = true; btSalvar.textContent = 'Vinculando…';
        try {
          await B7.DB.vincularGravacaoCalendario(ev.id, selGravacao.value);
          m.fechar(); B7.UI.toast('Vinculado.'); recarregarLocal();
        } catch (e) { btSalvar.disabled = false; btSalvar.textContent = 'Vincular'; B7.UI.toast(e.message || 'Não foi possível vincular.'); }
      };
    });
  }

  function modalCriarGravacao(ev) {
    garantirClientes().then(clientes => {
      const dataSugerida = (ev.inicio || '').slice(0, 10);
      const m = B7.UI.modal(
        '<h3>Criar gravação a partir deste evento</h3>' +
        '<p class="fraca">Só os dados confiáveis do evento entram pré-preenchidos — confira antes de confirmar.</p>' +
        '<label class="rot">Cliente</label><select class="campo" id="cal-cg-cliente" data-foco><option value="">Escolha o cliente</option>' +
          clientes.map(c => '<option value="' + c.id + '">' + esc(c.nome) + '</option>').join('') + '</select>' +
        '<label class="rot">Nome da gravação</label><input class="campo" id="cal-cg-nome" value="' + esc(ev.titulo || '') + '">' +
        '<div class="vd-grid-2">' +
          '<div><label class="rot">Data</label><input class="campo" type="date" id="cal-cg-data" value="' + dataSugerida + '"></div>' +
          '<div><label class="rot">Local</label><input class="campo" id="cal-cg-local" value="' + esc(ev.local || '') + '"></div>' +
        '</div>' +
        '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" id="cal-cg-salvar">Criar gravação</button></div>'
      );
      m.querySelector('#cal-cg-salvar').onclick = async () => {
        const clienteId = m.querySelector('#cal-cg-cliente').value;
        const nome = m.querySelector('#cal-cg-nome').value.trim();
        if (!clienteId) { B7.UI.toast('Escolha o cliente.'); return; }
        if (!nome) { B7.UI.toast('Dê um nome para a gravação.'); return; }
        const btn = m.querySelector('#cal-cg-salvar'); btn.disabled = true; btn.textContent = 'Criando…';
        try {
          await B7.DB.criarGravacaoDeEventoCalendario({
            eventoId: ev.id, clienteId, nome,
            dataGravacao: m.querySelector('#cal-cg-data').value || dataSugerida,
            local: m.querySelector('#cal-cg-local').value.trim(),
            observacoes: 'Criada a partir do Calendário de Gravações (evento "' + ev.titulo + '").'
          });
          m.fechar(); B7.UI.toast('Gravação criada e vinculada.'); recarregarLocal();
        } catch (e) { btn.disabled = false; btn.textContent = 'Criar gravação'; B7.UI.toast(e.message || 'Não foi possível criar a gravação.'); }
      };
    });
  }

  /* =================================================================
     MARCAR GRAVAÇÃO — direto do calendário, sem precisar de um evento
     do Google pré-existente. Cria a gravação + a ocorrência 'marcada'
     no B7 primeiro (sempre vale); tenta criar o evento no Google depois,
     best-effort — se falhar, avisa mas não desfaz nada. É esta a porta
     de entrada principal pro sistema de status (era isso que faltava:
     antes só dava pra vincular/criar a partir de um evento que já
     existisse no Google).
     ================================================================= */
  function modalMarcarGravacao(diaSugeridoISO) {
    if (conexao.conectado && agendas.some(a => a.ativo) && !agendas.some(a => a.escrita_padrao)) {
      B7.UI.toast('Escolha em Configurações qual agenda recebe as gravações marcadas por aqui — sem isso, a gravação é criada no B7 mas não sincroniza com o Google.', { tempo: 7000 });
    }
    garantirClientes().then(clientes => {
      const dataSugerida = diaSugeridoISO || B7.UI.hojeISO();
      const m = B7.UI.modal(
        '<h3>Marcar gravação</h3>' +
        '<p class="fraca">Cria a gravação já com status "Marcada" no calendário e, se houver uma agenda de escrita configurada, cria o evento correspondente no Google.</p>' +
        '<label class="rot">Cliente</label><select class="campo" id="cal-mg-cliente" data-foco><option value="">Escolha o cliente</option>' +
          clientes.map(c => '<option value="' + c.id + '">' + esc(c.nome) + '</option>').join('') + '</select>' +
        '<div class="vd-grid-2">' +
          '<div><label class="rot">Data</label><input class="campo" type="date" id="cal-mg-data" value="' + dataSugerida + '"></div>' +
          '<div></div>' +
          '<div><label class="rot">Início</label><input class="campo" type="time" id="cal-mg-hora-ini" value="09:00"></div>' +
          '<div><label class="rot">Fim</label><input class="campo" type="time" id="cal-mg-hora-fim" value="10:00"></div>' +
        '</div>' +
        '<label class="rot">Local <span class="leve">— opcional</span></label><input class="campo" id="cal-mg-local">' +
        '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" id="cal-mg-salvar">Marcar gravação</button></div>'
      );
      m.querySelector('#cal-mg-salvar').onclick = async () => {
        const clienteId = m.querySelector('#cal-mg-cliente').value;
        const data = m.querySelector('#cal-mg-data').value;
        const hIni = m.querySelector('#cal-mg-hora-ini').value || '09:00';
        const hFim = m.querySelector('#cal-mg-hora-fim').value || hIni;
        const local = m.querySelector('#cal-mg-local').value.trim();
        if (!clienteId) { B7.UI.toast('Escolha o cliente.'); return; }
        if (!data) { B7.UI.toast('Escolha a data.'); return; }
        /* Nome padrão — não perguntamos mais: só o dia da gravação
           importa aqui, o nome de exibição (no B7 e no Google) é sempre
           "Grav. <cliente>". Quem quiser um nome diferente pode ajustar
           depois pelo "Editar" da ocorrência. */
        const clienteEscolhido = clientes.find(c => c.id === clienteId);
        const nome = 'Grav. ' + (clienteEscolhido ? clienteEscolhido.nome : '');
        const inicio = new Date(data + 'T' + hIni + ':00');
        const fim = new Date(data + 'T' + hFim + ':00');
        if (fim < inicio) { B7.UI.toast('O horário de fim não pode ser antes do início.'); return; }

        const btn = m.querySelector('#cal-mg-salvar'); btn.disabled = true; btn.textContent = 'Marcando…';
        try {
          const resp = await B7.DB.marcarGravacaoCalendario({
            clienteId, nome, inicioISO: inicio.toISOString(), fimISO: fim.toISOString(), local
          });
          m.fechar();
          B7.UI.toast('Gravação marcada — agora dá pra remarcar, cancelar ou concluir por aqui.');
          if (conexao.conectado && resp && resp.ocorrencia_id) {
            try { await B7.DB.criarEventoGoogle(resp.ocorrencia_id, nome, inicio.toISOString(), fim.toISOString(), local); }
            catch (eGoogle) { B7.UI.toast('Marcada no B7, mas não deu pra criar o evento no Google: ' + (eGoogle.message || ''), { tempo: 8000 }); }
          }
          await recarregarLocal();
          if (resp && resp.ocorrencia_id) {
            const nova = ocorrencias.find(o => o.id === resp.ocorrencia_id);
            if (nova) modalOcorrencia(normalizarOcorrencia(nova));
          }
        } catch (e) { btn.disabled = false; btn.textContent = 'Marcar gravação'; B7.UI.toast(e.message || 'Não foi possível marcar a gravação.'); }
      };
    });
  }

  /* =================================================================
     DETALHE DE UMA OCORRÊNCIA (gravação com status) — o coração desta
     rodada: Marcar como Concluída / Remarcar / Cancelar.
     ================================================================= */
  function modalOcorrencia(it) {
    const dataHora = B7.UI.dataBR(isoData(it.inicio)) + ' · ' + horaBR(it.inicio) + (it.fim ? '–' + horaBR(it.fim) : '');
    const podeAgir = souGestor() && it.atual;

    const m = B7.UI.modal(
      '<h3>' + esc(it.titulo || 'Gravação') + ' <span class="cal-badge-status ' + STATUS_CLASSE[it.status] + '">' + STATUS_ROTULO[it.status] + '</span></h3>' +
      (!it.atual ? '<p class="fraca">Esta é uma ocorrência antiga, mantida só pro histórico do calendário — a gravação já tem uma ocorrência mais recente.</p>' : '') +
      '<div class="cal-detalhe-grid">' +
        '<div><label class="rot">Data e horário' + (it.status === 'remarcada' ? ' (antiga)' : '') + '</label><div class="vd-so-leitura">' + esc(dataHora) + '</div></div>' +
        (it.cliente_nome ? '<div><label class="rot">Cliente</label><div class="vd-so-leitura">' + esc(it.cliente_nome) + '</div></div>' : '') +
        (it.local ? '<div><label class="rot">Local</label><div class="vd-so-leitura">' + esc(it.local) + '</div></div>' : '') +
        (it.agenda_nome ? '<div><label class="rot">Agenda de origem</label><div class="vd-so-leitura">' + esc(it.agenda_nome) + '</div></div>' : '') +
      '</div>' +
      (it.motivo_cancelamento ? '<div class="vd-dt-campo"><label class="rot">Motivo do cancelamento</label><div class="vd-so-leitura">' + esc(it.motivo_cancelamento) + '</div></div>' : '') +
      (it.erro_sincronizacao ? '<div class="cal-aviso-sync">⚠ Não sincronizado com o Google: ' + esc(it.erro_sincronizacao) + '</div>' : '') +
      (it.gravacao_id ? '<div class="acoes-inline" style="margin-top:8px"><a class="b fina contorno" href="#/gravacao/' + it.gravacao_id + '">Ver gravação</a></div>' : '') +
      (podeAgir ? '<div class="acoes cal-oc-acoes">' +
        (it.gravacao_id ? '<button class="b fina contorno" id="cal-oc-editar">Editar</button>' : '') +
        (it.status !== 'concluida' && it.status !== 'cancelada' ? '<button class="b fina contorno" id="cal-oc-remarcar">Remarcar</button>' : '') +
        (it.status === 'cancelada' ? '<button class="b fina contorno" id="cal-oc-remarcar">Remarcar (reativar)</button>' : '') +
        (it.status === 'marcada' || it.status === 'remarcada' ? '<button class="b fina contorno" id="cal-oc-cancelar">Cancelar gravação</button>' : '') +
        (it.status === 'marcada' || it.status === 'remarcada' ? '<button class="b pri" id="cal-oc-concluir">Marcar como Concluída</button>' : '') +
        (it.gravacao_id ? '<button class="b fina perigo" id="cal-oc-excluir">Excluir gravação</button>' : '') +
      '</div>' : '') +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>'
    );

    const btEditar = m.querySelector('#cal-oc-editar');
    if (btEditar) btEditar.onclick = () => { m.fechar(); modalEditarGravacao(it); };
    const btRemarcar = m.querySelector('#cal-oc-remarcar');
    if (btRemarcar) btRemarcar.onclick = () => { m.fechar(); modalRemarcar(it); };
    const btCancelar = m.querySelector('#cal-oc-cancelar');
    if (btCancelar) btCancelar.onclick = () => { m.fechar(); modalCancelar(it); };
    const btConcluir = m.querySelector('#cal-oc-concluir');
    if (btConcluir) btConcluir.onclick = async () => {
      const ok = await B7.UI.confirmar({
        titulo: 'Marcar esta gravação como concluída?',
        texto: 'Registra que a gravação realmente aconteceu e libera a gravação pra virar demanda de edição.',
        rotulo: 'Marcar como concluída'
      });
      if (!ok) return;
      m.fechar();
      try {
        await B7.DB.ocorrenciaConcluir(it.id);
        B7.UI.toast('Gravação marcada como concluída.', {
          acao: 'Gerar demandas de edição',
          aoClicar: () => { location.hash = '#/video'; }
        });
        recarregarLocal();
      } catch (e) { B7.UI.toast(e.message || 'Não foi possível marcar como concluída.'); }
    };
    const btExcluir = m.querySelector('#cal-oc-excluir');
    if (btExcluir) btExcluir.onclick = async () => {
      const ok = await B7.UI.confirmar({
        titulo: 'Excluir esta gravação?',
        texto: 'Diferente de Cancelar: isto apaga a gravação de vez — todo o histórico dela no calendário, roteiros e cenas ligados a ela (se houver) e o evento no Google. Não dá pra desfazer.',
        perigo: true, rotulo: 'Excluir de vez'
      });
      if (!ok) return;
      btExcluir.disabled = true; btExcluir.textContent = 'Excluindo…';
      try {
        const resp = await B7.DB.excluirGravacaoCalendario(it.id);
        m.fechar();
        B7.UI.toast('Gravação excluída.');
        if (resp && resp.evento_id) {
          try { await B7.DB.excluirEventoGoogle(resp.evento_id); }
          catch (eGoogle) { B7.UI.toast('Excluída no B7, mas não deu pra excluir o evento no Google: ' + (eGoogle.message || ''), { tempo: 8000 }); }
        }
        recarregarLocal();
      } catch (e) { btExcluir.disabled = false; btExcluir.textContent = 'Excluir gravação'; B7.UI.toast(e.message || 'Não foi possível excluir.'); }
    };
  }

  /* Editar nome/cliente/local da gravação por trás da ocorrência — não
     mexe em data/horário (isso é o Remarcar) nem em status. Esses três
     campos vivem em `gravacoes` (não em `gravacoes_ocorrencias`), então
     reaproveita B7.DB.atualizarGravacao, que já existe pro resto do
     sistema; se a ocorrência tiver evento no Google, tenta atualizar o
     título/local de lá também, best-effort, igual ao resto. */
  function modalEditarGravacao(it) {
    garantirClientes().then(clientes => {
      const m = B7.UI.modal(
        '<h3>Editar gravação</h3>' +
        '<label class="rot">Cliente</label><select class="campo" id="cal-ed-cliente" data-foco>' +
          clientes.map(c => '<option value="' + c.id + '"' + (c.id === it.cliente_id ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('') +
        '</select>' +
        '<label class="rot">Nome da gravação</label><input class="campo" id="cal-ed-nome" value="' + esc(it.titulo || '') + '">' +
        '<label class="rot">Local <span class="leve">— opcional</span></label><input class="campo" id="cal-ed-local" value="' + esc(it.local || '') + '">' +
        '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" id="cal-ed-salvar">Salvar</button></div>'
      );
      m.querySelector('#cal-ed-salvar').onclick = async () => {
        const clienteId = m.querySelector('#cal-ed-cliente').value;
        const nome = m.querySelector('#cal-ed-nome').value.trim();
        const local = m.querySelector('#cal-ed-local').value.trim();
        if (!clienteId) { B7.UI.toast('Escolha o cliente.'); return; }
        if (!nome) { B7.UI.toast('Dê um nome para a gravação.'); return; }
        const btn = m.querySelector('#cal-ed-salvar'); btn.disabled = true; btn.textContent = 'Salvando…';
        try {
          await B7.DB.atualizarGravacao(it.gravacao_id, { client_id: clienteId, nome, local });
          m.fechar(); B7.UI.toast('Gravação atualizada.');
          if (it.evento_id) {
            try { await B7.DB.editarMetaEventoGoogle(it.evento_id, { titulo: nome, local }, it.id); }
            catch (eGoogle) { B7.UI.toast('Atualizado no B7, mas não deu pra atualizar o título/local no Google: ' + (eGoogle.message || ''), { tempo: 8000 }); }
          }
          recarregarLocal();
        } catch (e) { btn.disabled = false; btn.textContent = 'Salvar'; B7.UI.toast(e.message || 'Não foi possível salvar.'); }
      };
    });
  }

  function modalRemarcar(it) {
    const d = new Date(it.inicio);
    const dataAtual = isoData(d);
    const horaIni = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    let horaFim = horaIni;
    if (it.fim) { const f = new Date(it.fim); horaFim = String(f.getHours()).padStart(2, '0') + ':' + String(f.getMinutes()).padStart(2, '0'); }

    const m = B7.UI.modal(
      '<h3>Remarcar — ' + esc(it.titulo || 'Gravação') + '</h3>' +
      '<p class="fraca">A data antiga (' + esc(B7.UI.dataBR(dataAtual)) + ') continua no calendário como "Remarcada", pro histórico — ela não some.</p>' +
      '<div class="vd-grid-2">' +
        '<div><label class="rot">Nova data</label><input class="campo" type="date" id="cal-rm-data" value="' + dataAtual + '" data-foco></div>' +
        '<div></div>' +
        '<div><label class="rot">Início</label><input class="campo" type="time" id="cal-rm-hora-ini" value="' + horaIni + '"></div>' +
        '<div><label class="rot">Fim</label><input class="campo" type="time" id="cal-rm-hora-fim" value="' + horaFim + '"></div>' +
      '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" id="cal-rm-salvar">Remarcar</button></div>'
    );
    m.querySelector('#cal-rm-salvar').onclick = async () => {
      const data = m.querySelector('#cal-rm-data').value;
      const hIni = m.querySelector('#cal-rm-hora-ini').value;
      const hFim = m.querySelector('#cal-rm-hora-fim').value || hIni;
      if (!data || !hIni) { B7.UI.toast('Escolha a nova data e horário.'); return; }
      const novoInicio = new Date(data + 'T' + hIni + ':00');
      const novoFim = new Date(data + 'T' + hFim + ':00');
      if (novoFim < novoInicio) { B7.UI.toast('O horário de fim não pode ser antes do início.'); return; }
      const btn = m.querySelector('#cal-rm-salvar'); btn.disabled = true; btn.textContent = 'Remarcando…';
      try {
        const resp = await B7.DB.ocorrenciaRemarcar(it.id, novoInicio.toISOString(), novoFim.toISOString());
        if (resp && resp.evento_id) {
          try { await B7.DB.atualizarEventoGoogle(resp.evento_id, novoInicio.toISOString(), novoFim.toISOString(), resp.nova_ocorrencia_id); }
          catch (eGoogle) { B7.UI.toast('Remarcado no B7, mas não deu pra atualizar no Google: ' + (eGoogle.message || '') + ' — o evento no Google continua com a data antiga.', { tempo: 8000 }); }
        }
        m.fechar(); B7.UI.toast('Gravação remarcada.'); recarregarLocal();
      } catch (e) { btn.disabled = false; btn.textContent = 'Remarcar'; B7.UI.toast(e.message || 'Não foi possível remarcar.'); }
    };
  }

  function modalCancelar(it) {
    const m = B7.UI.modal(
      '<h3>Cancelar — ' + esc(it.titulo || 'Gravação') + '</h3>' +
      '<p class="fraca">A gravação continua visível nesta data no calendário, só que marcada como cancelada — nada é apagado.</p>' +
      '<label class="rot">Motivo (opcional)</label><textarea class="campo" id="cal-cn-motivo" rows="3" placeholder="Ex.: cliente remarcou por telefone, equipe indisponível…"></textarea>' +
      '<div class="acoes"><button class="b" data-fecha>Voltar</button><button class="b perigo" id="cal-cn-confirmar">Cancelar gravação</button></div>'
    );
    m.querySelector('#cal-cn-confirmar').onclick = async () => {
      const motivo = m.querySelector('#cal-cn-motivo').value.trim();
      const btn = m.querySelector('#cal-cn-confirmar'); btn.disabled = true; btn.textContent = 'Cancelando…';
      try {
        const resp = await B7.DB.ocorrenciaCancelar(it.id, motivo);
        if (resp && resp.evento_id) {
          try { await B7.DB.cancelarEventoGoogle(resp.evento_id, it.id); }
          catch (eGoogle) { B7.UI.toast('Cancelado no B7, mas não deu pra cancelar no Google: ' + (eGoogle.message || '') + ' — cancele manualmente na agenda, se precisar.', { tempo: 8000 }); }
        }
        m.fechar(); B7.UI.toast('Gravação cancelada.'); recarregarLocal();
      } catch (e) { btn.disabled = false; btn.textContent = 'Cancelar gravação'; B7.UI.toast(e.message || 'Não foi possível cancelar.'); }
    };
  }

  return { abrir };
})();
