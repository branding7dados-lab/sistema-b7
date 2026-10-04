/* =====================================================================
   CALENDÁRIO B7 (fase 6) — UM calendário para a operação inteira.

   Responde: o que acontece na operação, quando, para qual cliente, com
   quem — e onde abrir o registro de verdade.

   É uma VISTA sobre registros canônicos (B7.Eventos, js/eventos.js):
   gravações (ocorrências com histórico), publicações da Linha
   Editorial, prazos de Vídeo e prazos de Design. Nada é copiado para
   uma tabela de calendário; cada evento abre o registro dono dele.

   Vistas: Mês · Semana · Dia (desktop/tablet). No celular (largura
   estreita), agenda: faixa de dias + lista do dia escolhido, com o mês
   num seletor próprio — nunca a grade de 7 colunas microscópica.

   Estado na URL: #/calendario?v=mes|semana|dia&d=AAAA-MM-DD&tipo=…
   &cliente=…&resp=…&canc=1 — os módulos abrem este mesmo calendário já
   filtrado (ex.: Gravações → tipo=gravacoes).

   Google Calendar: a integração que já existia continua (conexão,
   agendas, sincronização best-effort, eventos ainda sem vínculo para
   gestores, marcar/remarcar/cancelar com escrita no Google). Mas o
   Calendário NÃO depende mais dela: as gravações são dados do B7.

   Mais abaixo (CONECTAR / CONFIGURAÇÕES em diante) ficam os modais da
   integração e das ações de ocorrência, reaproveitados da versão
   anterior.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Calendario = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');
  const papel = () => B7.Auth && B7.Auth.papel && B7.Auth.papel();
  const souEquipeInterna = () => ['admin', 'coordenador', 'designer', 'videomaker'].includes(papel());
  const souGestor = () => ['admin', 'coordenador'].includes(papel());
  const E = () => B7.Eventos;
  const D = () => B7.Eventos.DATAS;

  const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const DIAS_SEMANA_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const STATUS_ROTULO = { marcada: 'Marcada', remarcada: 'Remarcada', concluida: 'Concluída', cancelada: 'Cancelada' };
  const STATUS_CLASSE = { marcada: 'cal-st-marcada', remarcada: 'cal-st-remarcada', concluida: 'cal-st-concluida', cancelada: 'cal-st-cancelada' };
  const MAX_CEL = 3;              /* eventos visíveis por célula do mês */
  const MQ_AGENDA = '(max-width: 760px)';
  const ehAgenda = () => window.matchMedia(MQ_AGENDA).matches;

  /* integração Google (usada pelos modais de baixo) */
  let conexao = { conectado: false }, agendas = [], eventos = [], ocorrencias = [], clientesCache = null;

  /* estado da tela */
  const V = { vista: 'mes', data: null, tipo: '', cliente: '', resp: '', canceladas: false, op: false };
  let R = { eventos: [], erros: {}, ini: null, fim: null, carregando: false, pronto: false };
  let geracao = 0, sincronizados = new Map(), nomesResp = new Map(), mqOuvinte = null;

  /* ---- utilidades mantidas para os modais de ocorrência abaixo ---- */
  function isoData(d) {
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return chaveDia(d);
  }
  function chaveDia(d) { return D().isoLocal(new Date(d)); }
  function horaBR(iso) { return D().horaDoInstante(iso); }
  function normalizarOcorrencia(o) {
    return {
      tipo: 'ocorrencia', id: o.id, evento_id: o.evento_id, gravacao_id: o.gravacao_id,
      inicio: o.inicio, fim: o.fim, status: o.status, atual: o.atual,
      ocorrencia_anterior_id: o.ocorrencia_anterior_id,
      motivo_cancelamento: o.motivo_cancelamento, erro_sincronizacao: o.erro_sincronizacao,
      titulo: o.gravacao_nome, cliente_id: o.gravacao_client_id, cliente_nome: o.gravacao_cliente_nome,
      local: o.gravacao_local, agenda_nome: o.agenda_nome, agenda_cor: o.agenda_cor,
      dia_inteiro: !!o.sem_horario, sem_horario: !!o.sem_horario,
      competencia_ano: o.gravacao_competencia_ano, competencia_mes: o.gravacao_competencia_mes
    };
  }

  /* =================================================================
     URL / ESTADO
     ================================================================= */
  function lerParams(params) {
    const p = params || new URLSearchParams(location.hash.split('?')[1] || '');
    let pref = {};
    try { pref = JSON.parse(sessionStorage.getItem('b7.calendario.v2') || '{}'); } catch (e) {}
    const temFiltroUrl = ['v', 'd', 'tipo', 'cliente', 'resp', 'canc', 'op'].some(k => p.has(k));
    const base = temFiltroUrl ? {} : pref;
    V.vista = ['mes', 'semana', 'dia'].includes(p.get('v')) ? p.get('v') : (['mes', 'semana', 'dia'].includes(base.vista) ? base.vista : 'mes');
    V.data = /^\d{4}-\d{2}-\d{2}$/.test(p.get('d') || '') ? p.get('d') : D().hoje();
    V.tipo = p.get('tipo') || (temFiltroUrl ? '' : base.tipo || '');
    V.cliente = p.get('cliente') || (temFiltroUrl ? '' : base.cliente || '');
    V.resp = p.get('resp') || (temFiltroUrl ? '' : base.resp || '');
    V.canceladas = p.get('canc') === '1' || (!temFiltroUrl && !!base.canceladas);
    /* camada de Oportunidades: desligada por padrão */
    V.op = p.get('op') === '1' || (!temFiltroUrl && !!base.op);
    E().ESTADO.oportunidades = V.op;
    if (V.tipo && !E().TIPOS.some(t => t.id === V.tipo)) V.tipo = '';
  }
  function gravarEstado() {
    const q = new URLSearchParams();
    q.set('v', V.vista); q.set('d', V.data);
    if (V.tipo) q.set('tipo', V.tipo);
    if (V.cliente) q.set('cliente', V.cliente);
    if (V.resp) q.set('resp', V.resp);
    if (V.canceladas) q.set('canc', '1');
    if (V.op) q.set('op', '1');
    try { history.replaceState(null, '', location.pathname + location.search + '#/calendario?' + q.toString()); } catch (e) {}
    try { sessionStorage.setItem('b7.calendario.v2', JSON.stringify({ vista: V.vista, tipo: V.tipo, cliente: V.cliente, resp: V.resp, canceladas: V.canceladas, op: V.op })); } catch (e) {}
  }

  /* janela carregada: sempre o mínimo que a vista mostra */
  function janela() {
    const d = V.data;
    if (ehAgenda()) { const i = D().inicioSemana(d); return { ini: i, fim: D().somarDias(i, 6) }; }
    if (V.vista === 'dia') return { ini: d, fim: d };
    if (V.vista === 'semana') { const i = D().inicioSemana(d); return { ini: i, fim: D().somarDias(i, 6) }; }
    const ini = D().inicioSemana(D().primeiroDoMes(d));
    const fim = D().somarDias(D().inicioSemana(D().ultimoDoMes(d)), 6);
    return { ini, fim };
  }

  function rotulo() {
    const d = D().local(V.data);
    if (ehAgenda()) return MESES_LONGOS[d.getMonth()].replace(/^./, c => c.toUpperCase()) + ' de ' + d.getFullYear();
    if (V.vista === 'mes') return MESES_LONGOS[d.getMonth()].replace(/^./, c => c.toUpperCase()) + ' de ' + d.getFullYear();
    if (V.vista === 'semana') {
      const { ini, fim } = janela(); const a = D().local(ini), b = D().local(fim);
      return D().pad(a.getDate()) + ' ' + MESES[a.getMonth()].toUpperCase() + ' — ' + D().pad(b.getDate()) + ' ' + MESES[b.getMonth()].toUpperCase() +
        (a.getFullYear() !== b.getFullYear() || b.getFullYear() !== new Date().getFullYear() ? ' ' + b.getFullYear() : '');
    }
    return d.getDate() + ' de ' + MESES_LONGOS[d.getMonth()] + ' de ' + d.getFullYear();
  }

  /* =================================================================
     ABRIR / CARREGAR
     ================================================================= */
  async function abrir(params) {
    B7.Dashboard.marcarNav('#/calendario');
    B7.Rota.titulo(['Calendário']);
    const p = params || new URLSearchParams(location.hash.split('?')[1] || '');
    if (p.has('conectado')) {
      B7.UI.toast(p.get('conectado') === '1' ? 'Google Calendar conectado.' : 'Não foi possível conectar ao Google.');
      p.delete('conectado');
    }
    lerParams(p);
    if (!souEquipeInterna()) {
      painel().innerHTML = '<div class="conteudo cb"><div class="estado-b7"><b>Sem acesso ao Calendário.</b></div></div>';
      return;
    }
    R = { eventos: [], erros: {}, ini: null, fim: null, carregando: true, pronto: false };
    window.removeEventListener('message', aoReceberMensagemPopup);
    window.addEventListener('message', aoReceberMensagemPopup);
    /* troca de largura (girar o celular, redimensionar): muda a vista sem recarregar a página */
    if (mqOuvinte) { try { window.matchMedia(MQ_AGENDA).removeEventListener('change', mqOuvinte); } catch (e) {} }
    mqOuvinte = () => { if (location.hash.startsWith('#/calendario')) { desenharCasca(); carregar(); } };
    try { window.matchMedia(MQ_AGENDA).addEventListener('change', mqOuvinte); } catch (e) {}
    gravarEstado();
    desenharCasca();
    ligarTempoReal();
    /* o que é só "decoração" (nomes, clientes, status do Google) não segura a primeira pintura */
    Promise.all([
      garantirClientes().catch(() => []),
      B7.DB.listarVideomakers ? B7.DB.listarVideomakers().then(l => (l || []).forEach(v => nomesResp.set(v.id, v.nome))).catch(() => {}) : null,
      B7.DB.statusConexaoCalendario().then(st => { conexao = st || { conectado: false }; }).catch(() => { conexao = { conectado: false }; })
    ]).then(() => {
      const antes = E().ESTADO.googleConectado;
      E().ESTADO.googleConectado = !!conexao.conectado;
      if (conexao.conectado) {
        if (souGestor()) B7.DB.listarCalendariosGoogle().then(r => { agendas = r.agendas || []; }).catch(() => {});
        sincronizarGoogle();
      }
      pintarCabecalho(); pintarFiltros();
      if (antes !== E().ESTADO.googleConectado) carregar({ silencioso: true });
    });
    await carregar();
  }

  function aoReceberMensagemPopup(ev) {
    if (!ev.data || ev.data.tipo !== 'b7-google-agenda') return;
    /* só vale o aviso da própria função google-agenda (servidor do
       Supabase): outra janela não consegue disparar recarga nem texto aqui */
    try { if (ev.origin !== new URL(window.B7_CONFIG.SUPABASE_URL).origin) return; } catch (e) { return; }
    B7.UI.toast(ev.data.ok ? 'Google Calendar conectado.' : (ev.data.mensagem || 'Não foi possível conectar.'));
    carregarTudo();
  }

  /* carrega a janela visível. Mantém o que já está na tela enquanto
     busca (troca de período não pisca a tela inteira). */
  async function carregar(opcoes) {
    const g0 = ++geracao;
    const { ini, fim } = janela();
    const mesmaJanela = R.ini === ini && R.fim === fim;
    R.carregando = true;
    if (!(opcoes && opcoes.silencioso)) pintarCorpo();
    let r;
    try { r = await E().carregar(ini, fim, { forcar: opcoes && opcoes.forcar }); }
    catch (e) { r = { eventos: mesmaJanela ? R.eventos : [], erros: { geral: e.message || 'erro' } }; }
    if (g0 !== geracao) return;
    R = { eventos: r.eventos, erros: r.erros, ini, fim, carregando: false, pronto: true };
    /* os modais da integração usam as linhas cruas */
    ocorrencias = r.eventos.filter(e => e.dominio === 'gravacao').map(e => e.extra.bruto);
    eventos = r.eventos.filter(e => e.dominio === 'google').map(e => e.extra.bruto);
    pintarFiltros(); pintarCorpo();
  }

  /* depois de uma ação (remarcar, cancelar, marcar…): dado novo, sem cache */
  async function recarregarLocal() { E().invalidar(); await carregar({ forcar: true, silencioso: true }); }
  async function carregarTudo() {
    try { conexao = (await B7.DB.statusConexaoCalendario()) || { conectado: false }; } catch (e) {}
    E().ESTADO.googleConectado = !!conexao.conectado;
    if (conexao.conectado && souGestor()) { try { agendas = (await B7.DB.listarCalendariosGoogle()).agendas || []; } catch (e) {} }
    E().invalidar(); pintarCabecalho();
    await carregar({ forcar: true });
  }

  /* sincronização com o Google em segundo plano, no máximo a cada 5 min
     por janela — o Calendário já está na tela com os dados do B7 */
  function sincronizarGoogle() {
    if (!conexao.conectado) return;
    const { ini, fim } = janela(), k = ini + '|' + fim;
    if (Date.now() - (sincronizados.get(k) || 0) < 5 * 60e3) return;
    sincronizados.set(k, Date.now());
    B7.DB.sincronizarCalendario(D().local(ini).toISOString(), D().local(D().somarDias(fim, 1)).toISOString())
      .then(() => { conexao.avisoSync = null; E().invalidar(); return carregar({ forcar: true, silencioso: true }); })
      .catch(e => { conexao.avisoSync = e.message; pintarAvisos(); });
  }

  /* =================================================================
     TEMPO REAL — um canal só por abertura do Calendário, nas tabelas
     de origem dos domínios que a pessoa vê (o RLS filtra o resto). Só
     recarrega quando a mudança altera o que está na tela: data, status,
     título, cliente, responsável, ou linha entrando/saindo da janela.
     Autosave de outros campos (legenda, briefing…) é ignorado. Com a aba
     escondida, a recarga espera ela voltar. O dado do banco continua
     sendo a autoridade: o evento só dispara uma leitura nova.
     ================================================================= */
  let canalRT = null, rtTimer = null, rtPendente = false, rtOuvindoVisib = false;
  const RT = {
    gravacoes_ocorrencias: { dom: 'gravacao', dia: r => r.inicio ? D().diaDoInstante(r.inicio) : null, id: r => 'gravacao:' + r.id },
    conteudos: { dom: 'publicacao', dia: r => D().diaPuro(r.data_postagem), id: r => 'publicacao:' + r.id,
      igual: (ev, r) => !r.deleted_at && ev.titulo === (r.titulo || 'Conteúdo sem título') && (ev.status || '') === (r.status || '') && ev.clienteId === r.client_id },
    demandas_edicao: { dom: 'video', dia: r => D().diaPuro(r.prazo), id: r => 'video:' + r.id,
      igual: (ev, r) => !r.deleted_at && ev.status === r.editing_status && ev.responsavelId === (r.videomaker_id || null) && ev.titulo === (r.titulo || r.codigo || 'Demanda de vídeo') },
    design_deliverables: { dom: 'design', dia: r => D().diaPuro(r.prazo), id: r => 'design:' + r.id,
      igual: (ev, r) => !r.deleted_at && ev.status === r.status && ev.responsavelId === (r.designer_id || null) }
  };
  function fecharTempoReal() { clearTimeout(rtTimer); if (canalRT && B7.DB.fecharCanal) B7.DB.fecharCanal(canalRT); canalRT = null; }
  function ligarTempoReal() {
    fecharTempoReal();
    if (!B7.DB.canal) return;
    const doms = E().dominiosDisponiveis();
    const subs = Object.keys(RT).filter(t => doms.includes(RT[t].dom)).map(t => ({ table: t }));
    if (!subs.length) return;
    canalRT = B7.DB.canal('calendario-b7-' + Date.now(), subs, aoMudarRT);
    if (B7.Rota && B7.Rota.aoSair) B7.Rota.aoSair(fecharTempoReal);
    if (!rtOuvindoVisib) {
      rtOuvindoVisib = true;
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && rtPendente && canalRT) { rtPendente = false; E().invalidar(); carregar({ forcar: true, silencioso: true }); }
      });
    }
  }
  /* exposto para teste: decide se uma mudança mexe na tela */
  function mudancaRelevante(p) {
    const c = RT[p.table]; if (!c || !R.ini) return false;
    const novo = p.new && Object.keys(p.new).length ? p.new : null, velho = p.old || {};
    const id = c.id(novo || velho);
    const naTela = R.eventos.find(e => e.id === id);
    const dia = novo ? c.dia(novo) : null;
    const dentro = !!dia && dia >= R.ini && dia <= R.fim;
    if (!naTela && !dentro) return false;
    if (naTela && novo && dentro && dia === naTela.dia && c.igual && c.igual(naTela, novo)) return false;
    return true;
  }
  function aoMudarRT(p) {
    if (!mudancaRelevante(p)) return;
    clearTimeout(rtTimer);
    rtTimer = setTimeout(() => {
      if (!location.hash.startsWith('#/calendario')) return;
      if (document.hidden) { rtPendente = true; return; }
      E().invalidar(); carregar({ forcar: true, silencioso: true });
    }, 1200);
  }

  /* =================================================================
     CASCA (desenhada uma vez por abertura; o corpo troca sozinho)
     ================================================================= */
  function desenharCasca() {
    const agenda = ehAgenda();
    painel().innerHTML = '<div class="conteudo entra cb' + (agenda ? ' cb-agenda' : '') + '">' +
      '<div class="cb-topo" id="cb-topo"></div>' +
      '<div class="cb-barra" id="cb-barra"></div>' +
      '<div class="cb-filtros" id="cb-filtros"></div>' +
      '<div id="cb-avisos"></div>' +
      '<div class="cb-corpo" id="cb-corpo" aria-live="polite"></div>' +
    '</div>';
    animFaixa = 'entrada';
    pintarCabecalho(); pintarBarra(); pintarFiltros(); pintarCorpo();
    /* celular: arrastar a lista de lado troca o dia */
    if (agenda) {
      const corpo = document.getElementById('cb-corpo');
      ligarDeslize(corpo, () => corpo.querySelector('.cb-palco'), dir => irDia(D().somarDias(V.data, dir), dir), { area: '.cb-palco' });
    }
  }

  function pintarCabecalho() {
    const cx = document.getElementById('cb-topo'); if (!cx) return;
    cx.innerHTML = '<div class="cb-titulo"><h1>Calendário</h1>' +
        '<p>Gravações, publicações e prazos da operação num lugar só.</p>' +
        (ehAgenda() ? '<small class="cb-sub" id="cb-sub" aria-live="polite"></small>' : '') + '</div>' +
      '<div class="cb-topo-acoes">' +
        (souGestor() ? '<button class="b pri" id="cb-marcar" aria-label="Marcar gravação">' + IC_MAIS + '<span>Marcar<span class="cb-lg"> gravação</span></span></button>' : '') +
        (souGestor() ? '<button class="b contorno ico" id="cb-config" aria-label="Configurações do Google Calendar" title="Google Calendar">' + IC_ENGRENAGEM + '</button>' : '') +
      '</div>';
    const m = cx.querySelector('#cb-marcar'); if (m) m.onclick = () => modalMarcarGravacao(ehAgenda() || V.vista === 'dia' ? V.data : undefined);
    const c = cx.querySelector('#cb-config'); if (c) c.onclick = () => modalConfiguracoes();
    pintarSub();
  }

  /* celular: a semana em uma frase, embaixo do título */
  function pintarSub() {
    const el = document.getElementById('cb-sub'); if (!el) return;
    if (!R.pronto) { el.textContent = ''; return; }
    const hoje = D().hoje();
    const l = visiveis().filter(ev => ev.dominio !== 'oportunidade' && !ev.historico);
    const nh = l.filter(ev => ev.dia === hoje).length;
    const temHoje = R.ini && hoje >= R.ini && hoje <= R.fim;
    el.textContent = (l.length ? l.length : 'Nada') + ' nesta semana' +
      (temHoje ? ' · ' + (nh ? nh + ' hoje' : 'hoje livre') : '');
  }

  function pintarBarra() {
    const cx = document.getElementById('cb-barra'); if (!cx) return;
    const agenda = ehAgenda();
    cx.innerHTML =
      '<div class="cb-nav">' +
        '<button class="b contorno ico cb-seta" data-nav="-1" aria-label="' + (agenda ? 'Semana anterior' : 'Período anterior') + '">' + IC_ESQ + '</button>' +
        '<button class="b contorno cb-hoje" data-nav="0">Hoje</button>' +
        '<button class="b contorno ico cb-seta" data-nav="1" aria-label="' + (agenda ? 'Próxima semana' : 'Próximo período') + '">' + IC_DIR + '</button>' +
        (agenda
          ? '<button class="cb-rotulo cb-rotulo-btn" id="cb-mes-btn" aria-haspopup="dialog">' + esc(rotulo()) + IC_BAIXO + '</button>'
          : '<h2 class="cb-rotulo" id="cb-rotulo">' + esc(rotulo()) + '</h2><span class="cb-resumo" id="cb-resumo" aria-live="polite"></span>') +
      '</div>' +
      (agenda ? '' : '<div class="cb-vistas filtro" role="group" aria-label="Vista">' +
        [['mes', 'Mês'], ['semana', 'Semana'], ['dia', 'Dia']].map(([v, r]) =>
          '<button data-vista="' + v + '" class="' + (V.vista === v ? 'on' : '') + '" aria-pressed="' + (V.vista === v) + '">' + r + '</button>').join('') + '</div>') +
      (agenda ? faixaDiasHTML() : '');
    cx.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => navegar(+b.dataset.nav));
    cx.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => { if (V.vista === b.dataset.vista) return; V.vista = b.dataset.vista; anim = 'vista'; mudou(); });
    const mb = cx.querySelector('#cb-mes-btn'); if (mb) mb.onclick = seletorMes;
    cx.querySelectorAll('[data-faixa]').forEach(b => b.onclick = () => irDia(b.dataset.faixa));
    const fx = cx.querySelector('.cb-faixa');
    if (fx) {
      /* semana nova: a faixa entra deslizando do lado de onde veio */
      if (animFaixa) { fx.classList.add('cb-faixa-' + animFaixa); animFaixa = null; }
      posLuz(false);
      ligarDeslize(fx, () => fx, dir => navegar(dir));
    }
  }

  /* ---- celular: pílula de luz que viaja até o dia escolhido ---- */
  let animFaixa = 'entrada';
  const reduz = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function posLuz(animar) {
    const fx = document.querySelector('.cb-faixa'); if (!fx) return;
    let luz = fx.querySelector('.cb-faixa-luz');
    if (!luz) {
      luz = document.createElement('i'); luz.className = 'cb-faixa-luz'; luz.setAttribute('aria-hidden', 'true');
      fx.prepend(luz); fx.classList.add('tem-luz');
      /* largura mudou (fonte carregou, celular girou): a luz acompanha */
      if (window.ResizeObserver) new ResizeObserver(() => { if (fx.isConnected) posLuz(false); }).observe(fx);
    }
    const on = fx.querySelector('button.on');
    if (!on) { luz.style.opacity = '0'; return; }
    const x1 = on.offsetLeft, w1 = on.offsetWidth;
    const x0 = parseFloat(luz.dataset.x), w0 = parseFloat(luz.dataset.w);
    Object.assign(luz.style, { opacity: '1', top: on.offsetTop + 'px', height: on.offsetHeight + 'px', width: w1 + 'px', transform: 'translateX(' + x1 + 'px)' });
    luz.dataset.x = x1; luz.dataset.w = w1;
    if (animar && !isNaN(x0) && x0 !== x1 && luz.animate && !reduz()) {
      /* estica no sentido da viagem e encolhe ao chegar (como gota) */
      const xm = Math.min(x0, x1), wm = Math.abs(x1 - x0) + Math.max(w0, w1) * .7;
      luz.animate([
        { transform: 'translateX(' + x0 + 'px)', width: w0 + 'px' },
        { transform: 'translateX(' + (x1 > x0 ? x0 : xm) + 'px)', width: wm + 'px', offset: .45 },
        { transform: 'translateX(' + x1 + 'px)', width: w1 + 'px' }
      ], { duration: 460, easing: 'cubic-bezier(.3,.8,.2,1)' });
    }
  }
  /* troca o dia escolhido. Na mesma semana, só move a luz e troca a
     lista (sem buscar nada); fora dela, carrega a semana nova. */
  function irDia(novo, dir) {
    if (!novo || novo === V.data) return;
    dir = dir || (novo > V.data ? 1 : -1);
    anim = dir > 0 ? 'prox' : 'ant';
    const mesmaSemana = D().inicioSemana(novo) === D().inicioSemana(V.data);
    V.data = novo;
    if (!mesmaSemana) { animFaixa = anim; mudou(); return; }
    gravarEstado();
    document.querySelectorAll('.cb-faixa [data-faixa]').forEach(b => {
      const on = b.dataset.faixa === novo;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
      b.classList.remove('pulou');
      if (on && !reduz()) { void b.offsetWidth; b.classList.add('pulou'); }
    });
    posLuz(true);
    pintarCorpo();
  }
  /* arrastar de lado: B7.Movimento.deslizar (js/movimento.js) */
  function ligarDeslize(el, alvo, aoIr, opcoes) { if (B7.Movimento && B7.Movimento.deslizar) B7.Movimento.deslizar(el, alvo, aoIr, opcoes); }

  /* animação da próxima pintura com dados: direção do mês, troca de
     vista, filtro ou entrada. Só decide a classe; o CSS anima (e some
     com prefers-reduced-motion). */
  let anim = 'entrada';
  function navegar(dir) {
    if (ehAgenda()) {
      if (dir === 0) { irDia(D().hoje()); return; }
      anim = animFaixa = dir > 0 ? 'prox' : 'ant';
      V.data = D().somarDias(V.data, 7 * dir);
      mudou(); return;
    }
    anim = dir > 0 ? 'prox' : dir < 0 ? 'ant' : 'hoje';
    if (dir === 0) V.data = D().hoje();
    else if (ehAgenda()) V.data = D().somarDias(V.data, 7 * dir);
    else if (V.vista === 'mes') { const d = D().local(D().primeiroDoMes(V.data)); d.setMonth(d.getMonth() + dir); V.data = D().isoLocal(d); }
    else V.data = D().somarDias(V.data, V.vista === 'semana' ? 7 * dir : dir);
    mudou();
  }
  function mudou() { gravarEstado(); pintarBarra(); carregar(); sincronizarGoogle(); }

  /* ------------------------------------------------------ filtros */
  function pintarFiltros() {
    const cx = document.getElementById('cb-filtros'); if (!cx) return;
    const tipos = E().tiposDisponiveis();
    /* contagens do período, respeitando os OUTROS filtros */
    const base = E().filtrar(R.eventos, Object.assign({}, V, { tipo: '' })).filter(ev => ev.dominio !== 'oportunidade');
    const nOp = V.op ? E().filtrar(R.eventos, V).filter(ev => ev.dominio === 'oportunidade').length : 0;
    const nTipo = t => t ? base.filter(ev => t.dominios.includes(ev.dominio)).length : base.length;
    /* responsáveis: por id canônico, com nome vindo do próprio registro */
    const resps = new Map();
    R.eventos.forEach(ev => { if (ev.responsavelId) resps.set(ev.responsavelId, ev.responsavelNome || nomesResp.get(ev.responsavelId) || 'Sem nome'); });
    if (V.resp && !resps.has(V.resp)) resps.set(V.resp, nomesResp.get(V.resp) || 'Responsável');
    const clientes = (clientesCache || []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    if (V.cliente && !clientes.some(c => c.id === V.cliente)) {
      const ev = R.eventos.find(e => e.clienteId === V.cliente); if (ev) clientes.push({ id: V.cliente, nome: ev.clienteNome });
    }
    const ativos = !!(V.tipo || V.cliente || V.resp || V.canceladas);
    const tiposHTML = tipos.length > 1 ? '<div class="cb-tipos filtro" role="group" aria-label="Tipo de evento">' +
        [{ id: '', rot: 'Todos' }].concat(tipos).map(t =>
          '<button data-tipo="' + t.id + '" class="' + (V.tipo === t.id ? 'on' : '') + (t.id ? ' tem-ic' : '') + '" aria-pressed="' + (V.tipo === t.id) + '" title="' + esc(t.rot) + '">' +
            (t.id ? '<i class="cb-dom-ic d-' + t.dominios[0] + '">' + E().DOMINIOS[t.dominios[0]].ic + '</i>' : '') + '<span class="cb-tipo-rot">' + esc(t.rot) + '</span>' +
            (R.pronto ? '<span class="cb-n">' + nTipo(t.id ? t : null) + '</span>' : '') + '</button>').join('') + '</div>' : '';
    const selsHTML =
        '<select class="campo fina' + (V.cliente ? ' ativo' : '') + '" id="cb-f-cliente" aria-label="Cliente"><option value="">Cliente</option>' +
          clientes.map(c => '<option value="' + esc(c.id) + '"' + (c.id === V.cliente ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('') + '</select>' +
        (resps.size ? '<select class="campo fina' + (V.resp ? ' ativo' : '') + '" id="cb-f-resp" aria-label="Responsável"><option value="">Responsável</option>' +
          [...resps.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).map(([id, n]) =>
            '<option value="' + esc(id) + '"' + (id === V.resp ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>' : '') +
        '<label class="cb-check"><input type="checkbox" id="cb-f-canc"' + (V.canceladas ? ' checked' : '') + '><span>Mostrar canceladas</span></label>';
    const opHTML = B7.Oportunidades ? '<button type="button" class="cb-camada-op' + (V.op ? ' on' : '') + '" id="cb-f-op" aria-pressed="' + V.op + '" title="Datas comemorativas e campanhas relevantes' + (V.cliente ? ' para este cliente' : ' para os clientes') + '">' +
          '<i class="cb-dom-ic">' + E().DOMINIOS.oportunidade.ic + '</i>Oportunidades' + (V.op && R.pronto ? '<span class="cb-n">' + nOp + '</span>' : '') + '</button>' : '';
    const limparHTML = ativos ? '<button class="b fina contorno" id="cb-f-limpar">Limpar</button>' : '';
    if (ehAgenda()) {
      /* celular: cliente, responsável e canceladas ficam numa gaveta; o
         botão mostra quantos estão ligados */
      const nSel = (V.cliente ? 1 : 0) + (V.resp ? 1 : 0) + (V.canceladas ? 1 : 0);
      cx.innerHTML = tiposHTML +
        '<div class="cb-sels-linha">' +
          '<button type="button" class="cb-bt-filtros' + (filtrosAbertos ? ' on' : '') + (nSel ? ' tem' : '') + '" id="cb-f-abre" aria-expanded="' + filtrosAbertos + '" aria-controls="cb-gaveta">' +
            IC_FILTRO + '<span>Filtros</span>' + (nSel ? '<span class="cb-n">' + nSel + '</span>' : '') + '<i class="cb-bt-seta">' + IC_BAIXO + '</i></button>' +
          opHTML + limparHTML +
        '</div>' +
        '<div class="cb-gaveta' + (filtrosAbertos ? ' aberta' : '') + '" id="cb-gaveta"><div class="cb-gaveta-in"><div class="cb-sels">' + selsHTML + '</div></div></div>';
      const ab = cx.querySelector('#cb-f-abre');
      ab.onclick = () => {
        filtrosAbertos = !filtrosAbertos;
        ab.classList.toggle('on', filtrosAbertos); ab.setAttribute('aria-expanded', filtrosAbertos);
        cx.querySelector('#cb-gaveta').classList.toggle('aberta', filtrosAbertos);
      };
      const on = cx.querySelector('.cb-tipos .on');
      if (on && on.scrollIntoView && on.offsetLeft + on.offsetWidth > on.parentElement.clientWidth) { try { on.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {} }
    } else {
      cx.innerHTML = tiposHTML + '<div class="cb-sels">' + selsHTML + opHTML + limparHTML + '</div>';
    }
    cx.querySelectorAll('[data-tipo]').forEach(b => b.onclick = () => { V.tipo = b.dataset.tipo; aplicarFiltro(); });
    const sc = cx.querySelector('#cb-f-cliente'); if (sc) sc.onchange = () => { V.cliente = sc.value; aplicarFiltro(); };
    const sr = cx.querySelector('#cb-f-resp'); if (sr) sr.onchange = () => { V.resp = sr.value; aplicarFiltro(); };
    const ck = cx.querySelector('#cb-f-canc'); if (ck) ck.onchange = () => { V.canceladas = ck.checked; aplicarFiltro(); };
    const bop = cx.querySelector('#cb-f-op'); if (bop) bop.onclick = () => { V.op = !V.op; E().ESTADO.oportunidades = V.op; gravarEstado(); pintarFiltros(); carregar({ silencioso: true }); };
    const lp = cx.querySelector('#cb-f-limpar'); if (lp) lp.onclick = () => { Object.assign(V, { tipo: '', cliente: '', resp: '', canceladas: false }); aplicarFiltro(); };
  }
  function aplicarFiltro() { anim = 'filtro'; gravarEstado(); pintarFiltros(); pintarCorpo(); }

  function pintarAvisos() {
    const cx = document.getElementById('cb-avisos'); if (!cx) return;
    const erros = Object.keys(R.erros || {});
    const NOME = { oportunidade: 'as oportunidades', gravacao: 'as gravações', google: 'a agenda do Google', publicacao: 'as publicações', video: 'os prazos de Vídeo', design: 'os prazos de Design', geral: 'o calendário' };
    cx.innerHTML = erros.map(k => '<div class="cb-aviso erro" role="alert">Não foi possível carregar ' + (NOME[k] || k) +
        '. <button class="cb-link" data-recarregar>Tentar de novo</button></div>').join('') +
      (conexao.avisoSync && souGestor() ? '<div class="cb-aviso">A sincronização com o Google falhou agora — o Google pode estar um pouco desatualizado aqui.</div>' : '') +
      (conexao.conectado && souGestor() && agendas.length && !agendas.some(a => a.ativo) ? '<div class="cb-aviso">Nenhuma agenda do Google ativa. Escolha em <button class="cb-link" data-config>Configurações</button>.</div>' : '');
    cx.querySelectorAll('[data-recarregar]').forEach(b => b.onclick = () => { E().invalidar(); carregar({ forcar: true }); });
    cx.querySelectorAll('[data-config]').forEach(b => b.onclick = () => modalConfiguracoes());
  }

  /* =================================================================
     CORPO
     ================================================================= */
  const visiveis = () => E().filtrar(R.eventos, V);
  function porDia(lista) {
    const m = new Map();
    lista.forEach(ev => { if (!m.has(ev.dia)) m.set(ev.dia, []); m.get(ev.dia).push(ev); });
    return m;
  }

  function pintarCorpo() {
    const cx = document.getElementById('cb-corpo'); if (!cx) return;
    pintarAvisos();
    const rot = document.getElementById('cb-rotulo'); if (rot) rot.textContent = rotulo();
    if (!R.pronto) {
      cx.innerHTML = '<div class="cb-carregando">' + B7.UI.skeleton(ehAgenda() ? 'lista' : 'cards', { n: ehAgenda() ? 4 : 6 }) + '</div>';
      return;
    }
    const lista = visiveis();
    let html;
    if (ehAgenda()) html = agendaDiaHTML(lista.filter(ev => ev.dia === V.data), V.data, true, lista);
    else if (V.vista === 'mes') html = mesHTML(lista);
    else if (V.vista === 'semana') html = semanaHTML(lista);
    else html = agendaDiaHTML(lista.filter(ev => ev.dia === V.data), V.data, false);
    const classeAnim = !R.carregando && anim ? ' cb-anim cb-anim-' + anim : '';
    if (!R.carregando) anim = null;
    cx.innerHTML = (R.carregando ? '<div class="cb-atualizando" role="status"><i></i>Atualizando…</div>' : '') +
      '<div class="cb-palco' + classeAnim + '">' + html + '</div>';
    cx.classList.toggle('carregando', !!R.carregando);
    /* ordem de entrada das linhas (cascata contínua entre os grupos) */
    cx.querySelectorAll('.cb-palco .cb-linha').forEach((l, i) => l.style.setProperty('--k', Math.min(i, 8)));
    pintarResumo(lista);
    pintarSub();
    if (ehAgenda()) { pintarPontosFaixa(); posLuz(false); }   /* a lista pode ter mudado a largura (barra de rolagem) */
    ligarCorpo(cx);
  }

  /* resumo ao lado do mês: quanto há no período, sem abrir nada */
  function pintarResumo(lista) {
    const el = document.getElementById('cb-resumo'); if (!el) return;
    if (!R.pronto || ehAgenda()) { el.textContent = ''; return; }
    const n = d => lista.filter(ev => ev.dominio === d && !ev.historico).length;
    const partes = [[n('gravacao'), 'gravaç', 'ão', 'ões'], [n('publicacao'), 'publicaç', 'ão', 'ões'], [n('video') + n('design'), 'prazo', '', 's']]
      .filter(x => x[0]).map(x => x[0] + ' ' + x[1] + (x[0] > 1 ? x[3] : x[2]));
    el.textContent = partes.join(' · ');
  }
  function ligarCorpo(cx) {
    cx.querySelectorAll('[data-add-dia]').forEach(b => b.onclick = ev => { ev.stopPropagation(); modalMarcarGravacao(b.dataset.addDia); });
    cx.querySelectorAll('[data-ev]').forEach(b => b.onclick = ev => { ev.stopPropagation(); previa(b.dataset.ev); });
    cx.querySelectorAll('[data-dia-mais]').forEach(b => b.onclick = ev => { ev.stopPropagation(); folhaDia(b.dataset.diaMais); });
    cx.querySelectorAll('[data-grupo]').forEach(b => b.onclick = ev => { ev.stopPropagation(); const [dia, dominio, cliente] = b.dataset.grupo.split('|'); folhaDia(dia, { dominio, cliente }); });
    cx.querySelectorAll('[data-ir-dia]').forEach(b => b.onclick = () => { V.vista = 'dia'; V.data = b.dataset.irDia; mudou(); });
    cx.querySelectorAll('[data-pular-dia]').forEach(b => b.onclick = () => irDia(b.dataset.pularDia));
  }

  /* ---- peças ---- */
  const DOM = d => E().DOMINIOS[d];
  function horaTx(ev) {
    if (ev.hora) return ev.hora + (ev.horaFim ? '–' + ev.horaFim : '');
    return ev.dominio === 'video' || ev.dominio === 'design' ? 'Prazo' : ev.dominio === 'publicacao' ? 'Publicação' : ev.dominio === 'oportunidade' ? (ev.extra.emAndamento ? 'Em andamento' : 'Data') : 'Dia todo';
  }
  const rotStatus = ev => ev.historico && ev.status === 'remarcada' ? 'Remarcada (data antiga)' : ev.statusRotulo;
  function ariaEvento(ev) {
    return [DOM(ev.dominio).rot, ev.clienteNome, ev.titulo, ev.hora ? 'às ' + ev.hora : horaTx(ev), rotStatus(ev)].filter(Boolean).join(', ');
  }
  /* cor estável por cliente (matiz a partir do id): a cor identifica o
     CLIENTE; o ícone identifica o tipo. Escaneia-se o mês por cliente. */
  const matizCache = new Map();
  const MATIZES = [262, 330, 205, 160, 24, 292, 140, 4, 228, 42, 182, 312];
  function matizCli(id) {
    if (!id) return null;
    if (matizCache.has(id)) return matizCache.get(id);
    /* FNV-1a: ids parecidos caem longe; 12 matizes bem separados (sem
       amarelos lavados) */
    let h = 2166136261; const t = String(id);
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    const m = MATIZES[h % MATIZES.length]; matizCache.set(id, m); return m;
  }
  const estiloCli = id => { const m = matizCli(id); return m == null ? '' : ' style="--cli-h:' + m + '"'; };
  function chipHTML(ev) {
    const txtHTML = ev.dominio === 'gravacao'
      ? '<b>' + esc(ev.clienteNome || ev.titulo) + '</b>'
      : (ev.clienteNome ? '<b>' + esc(ev.clienteNome) + '</b> ' : '') + '<span class="cb-chip-sub">' + esc(ev.titulo) + '</span>';
    const mostrarSt = ev.dominio === 'gravacao' && ev.status !== 'marcada';
    return '<button type="button" class="cb-chip d-' + ev.dominio + ' t-' + ev.tom + (ev.clienteId ? ' tem-cli' : '') + (ev.historico ? ' hist' : '') + (ev.cancelado ? ' canc' : '') + (ev.concluido ? ' feito' : '') + '" ' +
      'data-ev="' + esc(ev.id) + '" title="' + esc(ariaEvento(ev)) + '" aria-label="' + esc(ariaEvento(ev)) + '"' + estiloCli(ev.clienteId) + '>' +
      '<i class="cb-dom-ic">' + DOM(ev.dominio).ic + '</i>' +
      (ev.hora ? '<b class="cb-chip-h">' + ev.hora + '</b>' : '') +
      (mostrarSt ? '<em class="cb-chip-st">' + esc(ev.historico && ev.status === 'remarcada' ? 'Remarcada' : ev.statusRotulo) + '</em>' : '') +
      (AGRUPA[ev.dominio] && ev.tom !== 'neutro' && !ev.concluido ? '<i class="cb-chip-dot t-' + ev.tom + '" aria-hidden="true"></i>' : '') +
      '<span class="cb-chip-tx">' + txtHTML + '</span></button>';
  }
  /* ---- agrupamento por cliente (mês e semana) ----
     Vários prazos/publicações do MESMO cliente no MESMO dia viram um
     chip só ("AutoEscola Modelo · 14 vídeos"), que abre a folha do dia já
     filtrada. Gravação (tem hora) e oportunidade nunca agrupam. */
  const AGRUPA = { video: 1, design: 1, publicacao: 1 };
  function agrupar(evs) {
    const out = [], idx = new Map();
    evs.forEach(ev => {
      if (!AGRUPA[ev.dominio] || !ev.clienteId) { out.push(ev); return; }
      const k = ev.dominio + '|' + ev.clienteId;
      if (idx.has(k)) { idx.get(k).itens.push(ev); return; }
      const g = { grupo: true, dominio: ev.dominio, clienteId: ev.clienteId, clienteNome: ev.clienteNome, dia: ev.dia, itens: [ev] };
      idx.set(k, g); out.push(g);
    });
    return out.map(x => x.grupo && x.itens.length === 1 ? x.itens[0] : x);
  }
  const PLURAL_DOM = { video: ['vídeo', 'vídeos'], design: ['peça', 'peças'], publicacao: ['publicação', 'publicações'] };
  function resumoStatus(itens) {
    const c = new Map(); itens.forEach(e => c.set(e.statusRotulo || '—', (c.get(e.statusRotulo || '—') || 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => n + ' ' + r.toLowerCase()).join(', ');
  }
  function chipGrupoHTML(g) {
    const n = g.itens.length, pl = PLURAL_DOM[g.dominio] || ['item', 'itens'];
    const feitos = g.itens.filter(e => e.concluido).length;
    const aria = (g.clienteNome || 'Cliente') + ': ' + n + ' ' + pl[1] + ' (' + resumoStatus(g.itens) + ')';
    return '<button type="button" class="cb-chip cb-chip-grupo tem-cli d-' + g.dominio + (feitos === n ? ' feito' : '') + '" data-grupo="' + esc(g.dia + '|' + g.dominio + '|' + g.clienteId) + '" ' +
      'title="' + esc(aria) + '" aria-label="' + esc(aria) + '"' + estiloCli(g.clienteId) + '>' +
      '<i class="cb-dom-ic">' + DOM(g.dominio).ic + '</i>' +
      '<span class="cb-chip-tx"><b>' + esc(g.clienteNome || 'Cliente') + '</b></span>' +
      '<span class="cb-chip-n">' + n + '</span></button>';
  }
  const pecaHTML = x => x.grupo ? chipGrupoHTML(x) : chipHTML(x);

  function statusHTML(ev, curto) {
    if (!ev.statusRotulo) return '';
    return '<span class="cb-st t-' + ev.tom + (ev.historico ? ' hist' : '') + '" title="' + esc(rotStatus(ev)) + '">' + esc(curto ? ev.statusRotulo : rotStatus(ev)) + '</span>';
  }
  function linhaHTML(ev, semCliente) {
    const resp = ev.responsavelNome || (ev.responsavelId && nomesResp.get(ev.responsavelId)) || '';
    return '<button type="button" class="cb-linha d-' + ev.dominio + (ev.clienteId ? ' tem-cli' : '') + (ev.historico ? ' hist' : '') + (ev.cancelado ? ' canc' : '') + '" data-ev="' + esc(ev.id) + '" aria-label="' + esc(ariaEvento(ev)) + '"' + estiloCli(ev.clienteId) + '>' +
      (ev.hora
        ? '<span class="cb-linha-h"><b>' + esc(ev.hora) + '</b>' + (ev.horaFim ? '<small>' + esc(ev.horaFim) + '</small>' : '') + '</span>'
        : '<span class="cb-linha-h sem-hora"><i class="cb-dom-ic">' + DOM(ev.dominio).ic + '</i><em>' + esc(horaTx(ev)) + '</em></span>') +
      (ev.dominio === 'oportunidade'
        ? '<span class="cb-linha-tx"><b>' + esc(ev.titulo) + '</b><span>' + esc(ev.sub || '') + '</span>'
        : semCliente
          ? '<span class="cb-linha-tx"><b>' + esc(ev.titulo) + '</b>' + (ev.sub ? '<span>' + esc(ev.sub) + '</span>' : '')
          : '<span class="cb-linha-tx"><b>' + esc(ev.clienteNome || DOM(ev.dominio).rot) + '</b>' +
        '<span>' + esc(ev.titulo) + (ev.sub ? ' · ' + esc(ev.sub) : '') + '</span>') +
        (ev.dominio === 'gravacao' && ev.extra.referencia ? '<small>Referente a ' + esc(ev.extra.referencia) + '</small>' : '') +
      '</span>' +
      '<span class="cb-linha-lado">' + statusHTML(ev) + (resp ? '<small class="cb-resp">' + esc(resp.split(' ')[0]) + '</small>' : '') + '</span>' +
    '</button>';
  }

  const restantes = l => l.reduce((n, x) => n + (x.grupo ? x.itens.length : 1), 0);
  /* ---- MÊS: 7 colunas fixas, semanas completas ---- */
  function mesHTML(lista) {
    const mapa = porDia(lista);
    const hoje = D().hoje(), mesAtual = V.data.slice(0, 7);
    const { ini, fim } = janela();
    const nDias = D().difDias(ini, fim) + 1;
    let cel = '';
    for (let i = 0; i < nDias; i++) {
      const dia = D().somarDias(ini, i), d = D().local(dia);
      const evs = mapa.get(dia) || [], pecas = agrupar(evs);
      const fora = dia.slice(0, 7) !== mesAtual, ehHoje = dia === hoje;
      cel += '<div class="cb-cel' + (fora ? ' fora' : '') + (ehHoje ? ' hoje' : '') + (dia < hoje ? ' passado' : '') + (d.getDay() === 0 || d.getDay() === 6 ? ' fds' : '') + (evs.length ? '' : ' livre') + '" role="gridcell" style="--i:' + i + '">' +
        (souGestor() && dia >= hoje ? '<button type="button" class="cb-cel-add" data-add-dia="' + dia + '" aria-label="Marcar gravação em ' + d.getDate() + ' de ' + MESES_LONGOS[d.getMonth()] + '" title="Marcar gravação neste dia">' + IC_MAIS + '</button>' : '') +
        '<button type="button" class="cb-cel-num" data-ir-dia="' + dia + '" aria-label="Abrir ' + d.getDate() + ' de ' + MESES_LONGOS[d.getMonth()] + (evs.length ? ', ' + evs.length + ' evento' + (evs.length > 1 ? 's' : '') : '') + '">' +
          (ehHoje ? '<span class="cb-hoje-tag">Hoje</span>' : '') + '<b>' + d.getDate() + '</b></button>' +
        '<div class="cb-cel-evs">' + pecas.slice(0, pecas.length > MAX_CEL ? MAX_CEL - 1 : MAX_CEL).map(pecaHTML).join('') +
          (pecas.length > MAX_CEL ? '<button type="button" class="cb-mais" data-dia-mais="' + dia + '">+' + restantes(pecas.slice(MAX_CEL - 1)) + ' mais</button>' : '') +
        '</div></div>';
    }
    return '<div class="cb-mes" role="grid" aria-label="' + esc(rotulo()) + '">' +
      '<div class="cb-mes-cab" role="row">' + DIAS_SEMANA_ABREV.map(x => '<div role="columnheader">' + x.toUpperCase() + '</div>').join('') + '</div>' +
      '<div class="cb-mes-grade">' + cel + '</div></div>' + vazioPeriodo(lista);
  }

  /* ---- SEMANA: colunas por dia; prazos/dia todo em cima, horários embaixo ---- */
  function semanaHTML(lista) {
    const mapa = porDia(lista), hoje = D().hoje(), { ini } = janela();
    let cols = '';
    for (let i = 0; i < 7; i++) {
      const dia = D().somarDias(ini, i), d = D().local(dia), evs = mapa.get(dia) || [];
      const todo = agrupar(evs.filter(e => !e.hora)), hora = evs.filter(e => e.hora);
      const MAXT = 5;
      cols += '<section class="cb-sem-col' + (dia === hoje ? ' hoje' : '') + '" aria-label="' + DIAS_SEMANA[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES_LONGOS[d.getMonth()] + '">' +
        '<button type="button" class="cb-sem-cab" data-ir-dia="' + dia + '"><small>' + DIAS_SEMANA_ABREV[d.getDay()].toUpperCase() + '</small><b>' + d.getDate() + '</b>' + (dia === hoje ? '<em>Hoje</em>' : '') + '</button>' +
        '<div class="cb-sem-todo">' + todo.slice(0, todo.length > MAXT ? MAXT - 1 : MAXT).map(pecaHTML).join('') +
          (todo.length > MAXT ? '<button type="button" class="cb-mais" data-dia-mais="' + dia + '">+' + restantes(todo.slice(MAXT - 1)) + ' mais</button>' : '') + '</div>' +
        '<div class="cb-sem-hora">' + (hora.length ? hora.map(ev =>
          '<button type="button" class="cb-card d-' + ev.dominio + ' t-' + ev.tom + (ev.historico ? ' hist' : '') + (ev.cancelado ? ' canc' : '') + '" data-ev="' + esc(ev.id) + '" aria-label="' + esc(ariaEvento(ev)) + '">' +
            '<span class="cb-card-h"><i class="cb-dom-ic">' + DOM(ev.dominio).ic + '</i>' + esc(horaTx(ev)) + '</span>' +
            '<b>' + esc(ev.clienteNome || ev.titulo) + '</b>' + (ev.clienteNome ? '<span>' + esc(ev.titulo) + '</span>' : '') +
            statusHTML(ev, true) + '</button>').join('') : (todo.length ? '' : '<span class="cb-sem-vazio">—</span>')) + '</div>' +
      '</section>';
    }
    return '<div class="cb-semana">' + cols + '</div>' + vazioPeriodo(lista);
  }

  /* ---- DIA / agenda: agrupado por domínio, só grupos não vazios ---- */
  /* semana (celular): lista de toda a semana carregada, para o "dia livre"
     apontar o próximo dia com algo marcado */
  function agendaDiaHTML(lista, dia, compacto, semana) {
    const d = D().local(dia), hoje = D().hoje();
    const rel = dia === hoje ? 'Hoje' : dia === D().somarDias(hoje, 1) ? 'Amanhã' : dia === D().somarDias(hoje, -1) ? 'Ontem' : DIAS_SEMANA[d.getDay()];
    const cab = '<header class="cb-dia-cab"><h3>' + esc(rel) + ' · <span>' + d.getDate() + ' ' + MESES[d.getMonth()].toUpperCase() + '</span></h3>' +
      (lista.length ? '<small>' + lista.length + ' evento' + (lista.length > 1 ? 's' : '') + '</small>' : '') + '</header>';
    if (!lista.length && semana) {
      const prox = [...new Set(semana.filter(e => e.dia > dia && e.dominio !== 'oportunidade').map(e => e.dia))].sort()[0];
      const dp = prox && D().local(prox);
      return '<div class="cb-dia compacto cb-dia-livre">' + cab +
        '<div class="cb-livre"><span class="cb-livre-ic" aria-hidden="true">' + IC_CAL + '</span>' +
          '<b>' + (dia < hoje ? 'Nada aconteceu neste dia' : 'Dia livre') + '</b>' +
          '<small>Nenhum compromisso' + (filtrando() ? ' com esses filtros' : '') + '.</small>' +
          '<div class="cb-livre-acoes">' +
            (prox ? '<button type="button" class="b contorno fina" data-pular-dia="' + prox + '">Próximo: ' + DIAS_SEMANA_ABREV[dp.getDay()] + ' ' + dp.getDate() + IC_DIR + '</button>' : '') +
            (souGestor() && dia >= hoje ? '<button type="button" class="b pri fina" data-add-dia="' + dia + '">' + IC_MAIS + 'Marcar gravação</button>' : '') +
          '</div></div></div>';
    }
    if (!lista.length) return '<div class="cb-dia' + (compacto ? ' compacto' : '') + '">' + cab + '<div class="cb-vazio">Nenhum evento neste dia' + (filtrando() ? ' com esses filtros' : '') + '.</div></div>';
    const grupos = [];
    Object.keys(E().DOMINIOS).sort((a, b) => DOM(a).ordem - DOM(b).ordem).forEach(dom => {
      const evs = lista.filter(e => e.dominio === dom);
      if (evs.length) grupos.push('<section class="cb-grupo d-' + dom + '" style="--g:' + grupos.length + '"><h4><i class="cb-dom-ic">' + DOM(dom).ic + '</i>' + esc(DOM(dom).grupo) + '<span>' + evs.length + '</span></h4>' +
        '<div class="cb-grupo-lista">' + comSubCliente(evs) + '</div></section>');
    });
    return '<div class="cb-dia' + (compacto ? ' compacto' : '') + '">' + cab + grupos.join('') + '</div>';
  }

  /* dentro de um grupo do dia: cliente com 2+ itens ganha um subtítulo
     e as linhas dele deixam de repetir o nome */
  function comSubCliente(evs) {
    if (!AGRUPA[evs[0].dominio]) return evs.map(e => linhaHTML(e)).join('');
    const cont = new Map(); evs.forEach(e => cont.set(e.clienteId, (cont.get(e.clienteId) || 0) + 1));
    let h = '', atual = null;
    evs.slice().sort((a, b) => String(a.clienteNome || '').localeCompare(String(b.clienteNome || ''), 'pt-BR') ||
      String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR', { numeric: true })).forEach(e => {
      if (cont.get(e.clienteId) > 1 && e.clienteId !== atual) {
        atual = e.clienteId;
        h += '<div class="cb-subcli"><b>' + esc(e.clienteNome || 'Cliente') + '</b><span>' + cont.get(e.clienteId) + '</span></div>';
      }
      h += linhaHTML(e, cont.get(e.clienteId) > 1);
    });
    return h;
  }
  const filtrando = () => !!(V.tipo || V.cliente || V.resp);
  function vazioPeriodo(lista) {
    return lista.length || R.carregando ? '' : '<p class="cb-vazio cb-vazio-periodo">Nenhum compromisso neste período' + (filtrando() ? ' com esses filtros' : '') + '.</p>';
  }

  /* ---- faixa de dias (celular) ---- */
  function faixaDiasHTML() {
    const i = D().inicioSemana(V.data), hoje = D().hoje();
    let h = '<div class="cb-faixa" role="tablist" aria-label="Dias da semana">';
    for (let k = 0; k < 7; k++) {
      const dia = D().somarDias(i, k), d = D().local(dia);
      h += '<button type="button" role="tab" aria-selected="' + (dia === V.data) + '" class="' + (dia === V.data ? 'on' : '') + (dia === hoje ? ' hoje' : '') + (dia < hoje ? ' passou' : '') + '" data-faixa="' + dia + '" style="--d:' + k + '">' +
        '<small>' + DIAS_SEMANA_ABREV[d.getDay()].toUpperCase() + '</small><b>' + d.getDate() + '</b><i class="cb-pontos" data-pontos="' + dia + '"></i></button>';
    }
    return h + '</div>';
  }
  function pintarPontosFaixa() {
    const mapa = porDia(visiveis());
    document.querySelectorAll('[data-pontos]').forEach(el => {
      const evs = mapa.get(el.dataset.pontos) || [];
      const doms = [...new Set(evs.map(e => e.dominio))].slice(0, 3);
      const h = doms.map((d, k) => '<span class="d-' + d + '" style="--p:' + k + '"></span>').join('');
      if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; }   /* só repinta (e anima) o que mudou */
      el.parentElement.setAttribute('aria-label', el.parentElement.textContent.trim() + (evs.length ? ', ' + evs.length + ' evento' + (evs.length > 1 ? 's' : '') : ', sem eventos'));
    });
  }

  /* ---- seletor de mês (celular): folha com o mês, não a grade permanente ---- */
  async function seletorMes() {
    let ref = V.data;
    const m = B7.UI.modal('<div class="cb-sm" id="cb-sm"></div>', { classe: 'tp-folha' });
    const pintar = async () => {
      const cx = m.querySelector('#cb-sm'); if (!cx) return;
      const d0 = D().local(D().primeiroDoMes(ref));
      const ini = D().inicioSemana(D().primeiroDoMes(ref)), fim = D().somarDias(D().inicioSemana(D().ultimoDoMes(ref)), 6);
      const desenhar = mapa => {
        let cel = '';
        for (let k = 0; k <= D().difDias(ini, fim); k++) {
          const dia = D().somarDias(ini, k), d = D().local(dia), n = (mapa.get(dia) || []).length;
          cel += '<button type="button" class="' + (dia.slice(0, 7) !== ref.slice(0, 7) ? 'fora' : '') + (dia === D().hoje() ? ' hoje' : '') + (dia === V.data ? ' on' : '') + '" data-sm-dia="' + dia + '" aria-label="' + d.getDate() + ' de ' + MESES_LONGOS[d.getMonth()] + (n ? ', ' + n + ' eventos' : '') + '">' +
            d.getDate() + (n ? '<i></i>' : '') + '</button>';
        }
        cx.innerHTML = '<div class="tp-folha-cab"><h3>' + MESES_LONGOS[d0.getMonth()].replace(/^./, c => c.toUpperCase()) + ' de ' + d0.getFullYear() + '</h3>' +
          '<button type="button" class="ico" data-fecha aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
          '<div class="cb-sm-nav"><button class="b contorno ico" data-sm="-1" aria-label="Mês anterior">' + IC_ESQ + '</button>' +
          '<button class="b contorno fina" data-sm="0">Hoje</button><button class="b contorno ico" data-sm="1" aria-label="Próximo mês">' + IC_DIR + '</button></div>' +
          '<div class="cb-sm-cab">' + DIAS_SEMANA_ABREV.map(x => '<span>' + x.slice(0, 1).toUpperCase() + '</span>').join('') + '</div>' +
          '<div class="cb-sm-grade">' + cel + '</div>';
        cx.querySelectorAll('[data-fecha]').forEach(b => b.onclick = m.fechar);
        cx.querySelectorAll('[data-sm]').forEach(b => b.onclick = () => {
          const k = +b.dataset.sm;
          if (!k) ref = D().hoje(); else { const x = D().local(D().primeiroDoMes(ref)); x.setMonth(x.getMonth() + k); ref = D().isoLocal(x); }
          pintar();
        });
        cx.querySelectorAll('[data-sm-dia]').forEach(b => b.onclick = () => {
          const novo = b.dataset.smDia; m.fechar();
          if (D().inicioSemana(novo) === D().inicioSemana(V.data)) { irDia(novo); return; }
          anim = animFaixa = novo > V.data ? 'prox' : 'ant'; V.data = novo; mudou();
        });
      };
      desenhar(new Map());
      try { const r = await E().carregar(ini, fim); if (document.body.contains(cx)) desenhar(porDia(E().filtrar(r.eventos, V))); } catch (e) {}
    };
    pintar();
  }

  /* ---- folha do dia ("+N eventos") ---- */
  function folhaDia(dia, filtro) {
    const doDia = visiveis().filter(ev => ev.dia === dia && (!filtro || (ev.dominio === filtro.dominio && ev.clienteId === filtro.cliente)));
    const d0 = D().local(dia);
    const titulo = filtro ? esc((doDia[0] && doDia[0].clienteNome) || 'Cliente') + ' · ' + doDia.length + ' ' + (PLURAL_DOM[filtro.dominio] || ['item', 'itens'])[doDia.length > 1 ? 1 : 0]
      : 'Agenda do dia';
    const m = B7.UI.modal('<div class="tp-folha-cab"><h3>' + titulo + (filtro ? '<small class="cb-folha-sub">' + DIAS_SEMANA[d0.getDay()] + ', ' + d0.getDate() + ' de ' + MESES_LONGOS[d0.getMonth()] + ' · ' + esc(resumoStatus(doDia)) + '</small>' : '') + '</h3><button type="button" class="ico" data-fecha aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="cb-folha-dia' + (filtro ? ' filtrada' : '') + '">' + agendaDiaHTML(doDia, dia, true) + '</div>' +
      '<div class="acoes"><button class="b contorno" data-ver-dia>Abrir na vista Dia</button></div>', { classe: 'tp-folha cb-folha', larga: true });
    m.querySelectorAll('[data-fecha]').forEach(b => b.onclick = m.fechar);
    m.querySelectorAll('[data-ev]').forEach(b => b.onclick = () => { m.fechar(); previa(b.dataset.ev); });
    const vd = m.querySelector('[data-ver-dia]'); if (vd) vd.onclick = () => { m.fechar(); V.vista = 'dia'; V.data = dia; if (ehAgenda()) { pintarBarra(); pintarCorpo(); gravarEstado(); } else mudou(); };
  }

  /* ---- prévia do evento: leve, com o caminho para o registro real ---- */
  function previa(id) {
    const ev = R.eventos.find(e => e.id === id); if (!ev) return;
    if (ev.dominio === 'google') return modalEvento(ev.extra.bruto);
    if (ev.dominio === 'oportunidade') return B7.Oportunidades.folha(ev.fonteId, { dia: ev.extra.ini, cliente: V.cliente || null, aoMudar: recarregarLocal });
    const dom = DOM(ev.dominio), d = D().local(ev.dia);
    const resp = ev.responsavelNome || (ev.responsavelId && nomesResp.get(ev.responsavelId)) || '';
    const quando = DIAS_SEMANA_ABREV[d.getDay()] + ', ' + D().pad(d.getDate()) + ' ' + MESES[d.getMonth()].toUpperCase() + ' ' + d.getFullYear() +
      ' · ' + (ev.hora ? ev.hora + (ev.horaFim ? '–' + ev.horaFim : '') : ev.dominio === 'gravacao' ? 'horário a definir' : ev.dominio === 'publicacao' ? 'data de publicação' : 'prazo');
    const ABRIR = { gravacao: 'Abrir gravação', publicacao: 'Abrir conteúdo', video: 'Abrir demanda de vídeo', design: 'Abrir peça de design' };
    const podeAgir = ev.dominio === 'gravacao' && souGestor() && !ev.historico;
    const linha = (rot, val) => val ? '<div class="cb-pv-l"><dt>' + rot + '</dt><dd>' + val + '</dd></div>' : '';
    const m = B7.UI.modal(
      '<div class="cb-pv d-' + ev.dominio + '">' +
        '<div class="tp-folha-cab"><span class="cb-pv-tipo"><i class="cb-dom-ic">' + dom.ic + '</i>' + esc(dom.rot) + '</span>' +
          '<button type="button" class="ico" data-fecha aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
        '<h3>' + esc(ev.clienteNome || ev.titulo) + '</h3>' +
        (ev.clienteNome ? '<p class="cb-pv-tit">' + esc(ev.titulo) + (ev.sub ? ' · ' + esc(ev.sub) : '') + '</p>' : '') +
        '<div class="cb-pv-st">' + statusHTML(ev) + '</div>' +
        '<dl class="cb-pv-dl">' +
          linha('Quando', esc(quando)) +
          (ev.dominio === 'gravacao' ? linha('Referente a', esc(ev.extra.referencia || 'mês não definido')) : '') +
          linha('Responsável', esc(resp)) +
          linha('Local', esc((ev.extra && ev.extra.local) || '')) +
          linha('Linha editorial', esc((ev.extra && ev.extra.linha) || '')) +
          linha('Gravação', esc((ev.extra && ev.extra.gravacao) || '')) +
        '</dl>' +
        (ev.historico ? '<p class="cb-pv-nota">Esta é uma data antiga desta gravação, mantida no calendário como histórico. A gravação tem uma data mais recente.</p>' : '') +
        (ev.extra && ev.extra.erroSync ? '<p class="cb-pv-nota erro">Não sincronizado com o Google: ' + esc(ev.extra.erroSync) + '</p>' : '') +
        '<div class="acoes">' +
          (podeAgir ? '<button class="b contorno" data-acoes>Remarcar, concluir…</button>' : '') +
          (ev.href ? '<a class="b pri" href="' + esc(ev.href) + '" data-ir>' + esc(ABRIR[ev.dominio] || 'Abrir') + '</a>' : '') +
        '</div>' +
      '</div>', { classe: 'tp-folha cb-folha' });
    m.querySelectorAll('[data-fecha]').forEach(b => b.onclick = m.fechar);
    const ir = m.querySelector('[data-ir]'); if (ir) ir.addEventListener('click', () => m.fechar());
    const ac = m.querySelector('[data-acoes]'); if (ac) ac.onclick = () => { m.fechar(); modalOcorrencia(normalizarOcorrencia(ev.extra.bruto)); };
  }

  /* ícones */
  const SVGI = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const IC_ESQ = SVGI('<path d="M15 6l-6 6 6 6"/>'), IC_DIR = SVGI('<path d="M9 6l6 6-6 6"/>'), IC_BAIXO = SVGI('<path d="M7 10l5 5 5-5"/>');
  const IC_MAIS = SVGI('<path d="M12 5v14M5 12h14"/>');
  const IC_FILTRO = SVGI('<path d="M4 6h16M7 12h10M10 18h4"/>');
  const IC_CAL = SVGI('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M9.5 15l2 2 3.5-3.5"/>');
  let filtrosAbertos = false;
  const IC_ENGRENAGEM = SVGI('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>');

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
        ? '<h4>Agendas</h4><p class="fraca">Escolha quais agendas do Google aparecem no Calendário de Gravações. ' +
          '<b>Avisar a equipe</b> liga os lembretes automáticos daquela agenda — deixe desmarcado em agendas pessoais ou de feriados.</p>' +
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
          (a.ativo ? '<label class="cal-agenda-lembrete" title="Avisa a equipe antes dos compromissos desta agenda (gravação: 1 dia e 1h antes; o resto: 1h antes)">' +
            '<input type="checkbox" data-agenda-lembrete="' + a.id + '"' + (a.lembretes === false ? '' : ' checked') + '>' +
            '<span>Avisar a equipe</span></label>' : '') +
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
      m.querySelectorAll('[data-agenda-lembrete]').forEach(chk => {
        chk.onchange = async () => {
          chk.disabled = true;
          try {
            await B7.DB.alternarLembretesAgenda(chk.dataset.agendaLembrete, chk.checked);
            const a = agendas.find(x => x.id === chk.dataset.agendaLembrete);
            if (a) a.lembretes = chk.checked;
            chk.disabled = false;
            B7.UI.toast(chk.checked ? 'Lembretes ligados para esta agenda.' : 'Lembretes desligados para esta agenda.');
          } catch (e) { chk.disabled = false; chk.checked = !chk.checked; B7.UI.toast(e.message || 'Não foi possível salvar.'); }
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
    /* só vale o aviso da própria função google-agenda (servidor do
       Supabase): outra janela não consegue disparar recarga nem texto aqui */
    try { if (ev.origin !== new URL(window.B7_CONFIG.SUPABASE_URL).origin) return; } catch (e) { return; }
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
        '<div class="sub">Cria a gravação já marcada no calendário' + (conexao.conectado ? ' e o evento na agenda do Google' : '') + '. Os itens (roteiros, trends) entram depois, na tela da gravação.</div>' +
        '<div class="mb"><label class="rot" for="cal-mg-cliente">CLIENTE</label><select class="campo" id="cal-mg-cliente" data-foco><option value="">Escolha o cliente</option>' +
          clientes.map(c => '<option value="' + c.id + '">' + esc(c.nome) + '</option>').join('') + '</select></div>' +
        '<div class="mb"><label class="rot" for="cal-mg-data">DATA</label><input class="campo" type="date" id="cal-mg-data" value="' + dataSugerida + '"></div>' +
        '<div class="mb"><label class="rot">HORÁRIO</label><div class="gv-horas"><input class="campo" type="time" id="cal-mg-hora-ini" value="09:00" aria-label="Início">' +
          '<span aria-hidden="true">até</span><input class="campo" type="time" id="cal-mg-hora-fim" value="10:00" aria-label="Fim"></div></div>' +
        '<div class="mb"><label class="rot">MÊS DE REFERÊNCIA <span class="leve">— obrigatório</span></label>' +
          (B7.Gravacao ? B7.Gravacao.camposMes(+dataSugerida.slice(0, 4), +dataSugerida.slice(5, 7), 'cal-mg') : '') +
          '<div class="ajuda gv-ajuda">O mês de produção a que a gravação pertence. O calendário mostra a gravação no dia em que ela acontece.</div></div>' +
        '<div class="mb"><label class="rot" for="cal-mg-local">LOCAL <span class="leve">— opcional</span></label><input class="campo" id="cal-mg-local"></div>' +
        '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" id="cal-mg-salvar">Marcar gravação</button></div>'
      );
      /* o mês de referência acompanha a data até a pessoa escolher outro */
      let mesManual = false;
      const selMes = m.querySelector('#cal-mg-mes'), selAno = m.querySelector('#cal-mg-ano');
      if (selMes) {
        selMes.onchange = selAno.onchange = () => { mesManual = true; };
        m.querySelector('#cal-mg-data').addEventListener('change', e => {
          const v = e.target.value; if (!v || mesManual) return;
          selMes.value = String(+v.slice(5, 7));
          if (![...selAno.options].some(o => o.value === v.slice(0, 4))) selAno.insertAdjacentHTML('beforeend', '<option>' + v.slice(0, 4) + '</option>');
          selAno.value = v.slice(0, 4);
        });
      }
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
            clienteId, nome, inicioISO: inicio.toISOString(), fimISO: fim.toISOString(), local,
            competenciaAno: selAno ? +selAno.value : null, competenciaMes: selMes ? +selMes.value : null
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
    const dataHora = B7.UI.dataBR(isoData(it.inicio)) + (it.sem_horario ? ' · sem horário' : ' · ' + horaBR(it.inicio) + (it.fim && it.fim !== it.inicio ? '–' + horaBR(it.fim) : ''));
    const podeAgir = souGestor() && it.atual;
    const mesRefTx = it.competencia_ano && B7.Gravacao ? B7.Gravacao.mesRef(it.competencia_ano, it.competencia_mes) : '';
    /* remarcada: diz para onde foi (a ocorrência nova aponta para esta) */
    const proxima = it.status === 'remarcada' || (it.status === 'cancelada' && !it.atual) ? ocorrencias.find(o => o.ocorrencia_anterior_id === it.id) : null;
    const anterior = it.ocorrencia_anterior_id ? ocorrencias.find(o => o.id === it.ocorrencia_anterior_id) : null;

    const m = B7.UI.modal(
      '<h3>' + esc(it.titulo || 'Gravação') + ' <span class="cal-badge-status ' + STATUS_CLASSE[it.status] + '">' + STATUS_ROTULO[it.status] + '</span></h3>' +
      (!it.atual ? '<p class="fraca">Esta é uma ocorrência antiga, mantida só pro histórico do calendário — a gravação já tem uma ocorrência mais recente.</p>' : '') +
      '<div class="cal-detalhe-grid">' +
        '<div><label class="rot">Data e horário' + (it.status === 'remarcada' ? ' (antiga)' : '') + '</label><div class="vd-so-leitura">' + esc(dataHora) + '</div></div>' +
        (it.cliente_nome ? '<div><label class="rot">Cliente</label><div class="vd-so-leitura">' + esc(it.cliente_nome) + '</div></div>' : '') +
        (mesRefTx ? '<div><label class="rot">Mês de referência</label><div class="vd-so-leitura">' + esc(mesRefTx) + '</div></div>' : '') +
        (proxima ? '<div><label class="rot">Remarcada para</label><div class="vd-so-leitura">' + esc(B7.UI.dataBR(isoData(proxima.inicio)) + (proxima.sem_horario ? '' : ' · ' + horaBR(proxima.inicio))) + '</div></div>' : '') +
        (anterior ? '<div><label class="rot">Data anterior</label><div class="vd-so-leitura">' + esc(B7.UI.dataBR(isoData(anterior.inicio)) + (anterior.sem_horario ? '' : ' · ' + horaBR(anterior.inicio))) + ' (' + esc(STATUS_ROTULO[anterior.status] || anterior.status) + ')</div></div>' : '') +
        (it.local ? '<div><label class="rot">Local</label><div class="vd-so-leitura">' + esc(it.local) + '</div></div>' : '') +
        (it.agenda_nome ? '<div><label class="rot">Agenda de origem</label><div class="vd-so-leitura">' + esc(it.agenda_nome) + '</div></div>' : '') +
      '</div>' +
      (it.motivo_cancelamento ? '<div class="vd-dt-campo"><label class="rot">Motivo do cancelamento</label><div class="vd-so-leitura">' + esc(it.motivo_cancelamento) + '</div></div>' : '') +
      (it.erro_sincronizacao ? '<div class="cal-aviso-sync">⚠ Não sincronizado com o Google: ' + esc(it.erro_sincronizacao) + '</div>' : '') +
      (it.gravacao_id ? '<div class="acoes-inline" style="margin-top:8px"><a class="b fina contorno" href="#/gravacao/' + it.gravacao_id + '">Abrir gravação</a></div>' : '') +
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

  return { abrir, recarregar: recarregarLocal, _mudancaRelevante: mudancaRelevante, _aoMudarRT: aoMudarRT };
})();
