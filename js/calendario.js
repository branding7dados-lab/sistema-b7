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
   conectar/desconectar) passa pela Edge Function "google-agenda"
   (js/database.js → chamarCalendarioGoogle). O que só precisa do banco
   (status da conexão, escolher agendas ativas, ler eventos já
   sincronizados, vincular/desvincular/criar gravação a partir de um
   evento) é RPC direto — mesmo padrão do resto do B7.

   Sem job agendado neste projeto (mesma limitação já registrada em
   migration_video_gestao.sql): a sincronização acontece quando alguém
   da equipe abre esta tela, pedindo os eventos da janela visível — não
   um relógio rodando sozinho no servidor.
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
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  let conexao = null, agendas = [], eventos = [], clientesCache = null;
  let carregando = true, erroCarga = null;
  let janelaRef = new Date();   // data de referência pra calcular a janela visível

  const F_PADRAO = { vista: 'agenda', cliente: '', agenda: '', status: '', busca: '' };
  let F = Object.assign({}, F_PADRAO);
  try { Object.assign(F, JSON.parse(sessionStorage.getItem('b7.calendario.filtros') || '{}')); } catch (e) {}
  function guardarFiltros() { try { sessionStorage.setItem('b7.calendario.filtros', JSON.stringify(F)); } catch (e) {} }

  function inicioDoDia(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function inicioDaSemana(d) { const x = inicioDoDia(d); x.setDate(x.getDate() - x.getDay()); return x; }
  function isoData(d) { return d.toISOString().slice(0, 10); }

  function calcularJanela() {
    if (F.vista === 'semana') {
      const inicio = inicioDaSemana(janelaRef);
      const fim = new Date(inicio.getTime() + 7 * DIA_MS);
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
    F.vista = F.vista === 'semana' ? 'semana' : 'agenda';

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
        const [ags, evs] = await Promise.all([
          B7.DB.listarCalendariosGoogle().then(r => r.agendas || []).catch(() => agendas),
          B7.DB.eventosCalendario(inicio.toISOString(), fim.toISOString()).catch(() => [])
        ]);
        agendas = ags; eventos = evs;
      } else {
        agendas = []; eventos = [];
      }
    } catch (e) {
      erroCarga = e.message || 'Não foi possível carregar o calendário.';
    }
    carregando = false;
    desenhar();
  }

  async function apenasRecarregarEventos() {
    if (!conexao || !conexao.conectado) return;
    const { inicio, fim } = calcularJanela();
    try {
      await B7.DB.sincronizarCalendario(inicio.toISOString(), fim.toISOString());
    } catch (e) { conexao.avisoSync = e.message; }
    try { eventos = await B7.DB.eventosCalendario(inicio.toISOString(), fim.toISOString()); }
    catch (e) { /* mantém o que já tinha — nunca esvazia a tela por causa de uma falha de rede */ }
    desenhar();
  }

  /* =================================================================
     FILTROS
     ================================================================= */
  function eventosFiltrados() {
    const t = F.busca.trim().toLowerCase();
    return eventos.filter(ev => {
      if (F.agenda && ev.agenda_id !== F.agenda) return false;
      if (F.cliente === '__sem__' && ev.gravacao_client_id) return false;
      if (F.cliente && F.cliente !== '__sem__' && ev.gravacao_client_id !== F.cliente) return false;
      if (F.status === 'vinculado' && !ev.gravacao_id) return false;
      if (F.status === 'nao_vinculado' && ev.gravacao_id) return false;
      if (F.status === 'cancelado' && ev.status_provider !== 'cancelled') return false;
      if (t && !((ev.titulo || '').toLowerCase().includes(t) || (ev.local || '').toLowerCase().includes(t) ||
                 (ev.gravacao_cliente_nome || '').toLowerCase().includes(t))) return false;
      return true;
    }).sort((a, b) => a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0);
  }

  function clientesPresentes() {
    const mapa = new Map();
    eventos.forEach(ev => { if (ev.gravacao_client_id) mapa.set(ev.gravacao_client_id, ev.gravacao_cliente_nome); });
    return [...mapa.entries()].sort((a, b) => (a[1] || '').localeCompare(b[1] || '', 'pt-BR'));
  }

  /* =================================================================
     DESENHO
     ================================================================= */
  function rotuloJanela() {
    const { inicio, fim } = calcularJanela();
    if (F.vista === 'semana') {
      const ultimo = new Date(fim.getTime() - DIA_MS);
      return inicio.getDate() + ' ' + MESES[inicio.getMonth()] + ' – ' + ultimo.getDate() + ' ' + MESES[ultimo.getMonth()];
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

    const visiveis = eventosFiltrados();
    const porDia = agruparPorDia(visiveis);

    painel().innerHTML = '<div class="conteudo entra cal-tela">' +
      '<div class="cab-conteudo"><div><h1>Calendário de Gravações</h1>' +
      '<p>' + (conexao.conectado ? 'Conectado como ' + esc(conexao.conta_email || 'conta do Google') : 'Google Calendar não conectado') + '</p></div>' +
      '<div class="vd-acoes-topo">' +
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
          '<button class="b fina' + (F.vista === 'semana' ? ' pri' : ' contorno') + '" data-vista="semana">Semana</button>' +
          '<button class="b fina' + (F.vista === 'agenda' ? ' pri' : ' contorno') + '" data-vista="agenda">Agenda</button>' +
        '</div>' +
      '</div>' +
      '<div class="cal-filtros">' +
        '<select class="campo" id="cal-f-cliente"><option value="">Todos os clientes</option><option value="__sem__">Sem cliente vinculado</option>' +
          clientesPresentes().map(([id, nome]) => '<option value="' + id + '"' + (F.cliente === id ? ' selected' : '') + '>' + esc(nome) + '</option>').join('') +
        '</select>' +
        '<select class="campo" id="cal-f-agenda"><option value="">Todas as agendas</option>' +
          agendas.filter(a => a.ativo).map(a => '<option value="' + a.id + '"' + (F.agenda === a.id ? ' selected' : '') + '>' + esc(a.nome) + '</option>').join('') +
        '</select>' +
        '<select class="campo" id="cal-f-status"><option value="">Todos</option>' +
          '<option value="vinculado"' + (F.status === 'vinculado' ? ' selected' : '') + '>Vinculados a uma gravação</option>' +
          '<option value="nao_vinculado"' + (F.status === 'nao_vinculado' ? ' selected' : '') + '>Não vinculados</option>' +
          '<option value="cancelado"' + (F.status === 'cancelado' ? ' selected' : '') + '>Cancelados</option>' +
        '</select>' +
        '<input class="campo" id="cal-f-busca" placeholder="Buscar título, local, cliente…" value="' + esc(F.busca) + '">' +
      '</div>' : '') +

      '<div id="cal-corpo">' + (conexao.conectado ? corpoHTML(porDia, visiveis.length) : '') + '</div>' +
    '</div>';

    ligar();
    if (F.cliente || F.agenda || F.status || F.busca) atualizarSelectsAposDesenho();
  }

  function atualizarSelectsAposDesenho() { /* valores já vêm marcados via selected= acima */ }

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
    lista.forEach(ev => {
      const chave = (ev.inicio || '').slice(0, 10);
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(ev);
    });
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  function corpoHTML(porDia, total) {
    if (!total) {
      return '<div class="estado-b7"><b>Nenhum evento nesta janela.</b><p>Ajuste os filtros ou navegue para outra semana.</p></div>';
    }
    const hojeStr = B7.UI.hojeISO();
    return '<div class="cal-dias">' + porDia.map(([diaISO, evs]) => {
      const d = new Date(diaISO + 'T00:00:00');
      const ehHoje = diaISO === hojeStr;
      return '<div class="cal-dia' + (ehHoje ? ' hoje' : '') + '">' +
        '<div class="cal-dia-cab"><b>' + DIAS_SEMANA[d.getDay()] + '</b><span>' + d.getDate() + ' de ' + MESES[d.getMonth()] + '</span>' + (ehHoje ? '<em>hoje</em>' : '') + '</div>' +
        '<div class="cal-dia-corpo">' + evs.map(eventoCardHTML).join('') + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function eventoCardHTML(ev) {
    const cancelado = ev.status_provider === 'cancelled';
    const hora = ev.dia_inteiro ? 'Dia inteiro' : horaBR(ev.inicio) + (ev.fim ? '–' + horaBR(ev.fim) : '');
    return '<div class="cal-evento' + (cancelado ? ' cancelado' : '') + '" data-evento="' + ev.id + '" tabindex="0">' +
      '<div class="cal-evento-hora">' + hora + '</div>' +
      '<div class="cal-evento-corpo">' +
        '<div class="cal-evento-titulo">' + esc(ev.titulo) + (cancelado ? ' <span class="vd-status vd-status-descartado">Cancelado</span>' : '') + '</div>' +
        '<div class="cal-evento-meta">' +
          (ev.gravacao_cliente_nome ? '<span>' + esc(ev.gravacao_cliente_nome) + '</span>' : '') +
          (ev.local ? '<span>' + esc(ev.local) + '</span>' : '') +
          '<span class="cal-evento-agenda" style="' + (ev.agenda_cor ? 'color:' + esc(ev.agenda_cor) : '') + '">' + esc(ev.agenda_nome || 'Agenda') + '</span>' +
        '</div>' +
      '</div>' +
      (ev.gravacao_id ? '<span class="cal-vinculo-badge">Vinculado</span>' : '<span class="cal-vinculo-badge fraca">Sem vínculo</span>') +
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

    const btAnt = cx.querySelector('#cal-ant'), btProx = cx.querySelector('#cal-prox'), btHoje = cx.querySelector('#cal-hoje');
    const passo = F.vista === 'semana' ? 7 : 21;
    if (btAnt) btAnt.onclick = () => { janelaRef = new Date(janelaRef.getTime() - passo * DIA_MS); carregarTudo(); };
    if (btProx) btProx.onclick = () => { janelaRef = new Date(janelaRef.getTime() + passo * DIA_MS); carregarTudo(); };
    if (btHoje) btHoje.onclick = () => { janelaRef = new Date(); carregarTudo(); };

    cx.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => {
      F.vista = b.dataset.vista; guardarFiltros(); janelaRef = new Date(); carregarTudo();
    });

    const fCliente = cx.querySelector('#cal-f-cliente'); if (fCliente) fCliente.onchange = e => { F.cliente = e.target.value; guardarFiltros(); desenhar(); };
    const fAgenda = cx.querySelector('#cal-f-agenda'); if (fAgenda) fAgenda.onchange = e => { F.agenda = e.target.value; guardarFiltros(); desenhar(); };
    const fStatus = cx.querySelector('#cal-f-status'); if (fStatus) fStatus.onchange = e => { F.status = e.target.value; guardarFiltros(); desenhar(); };
    const fBusca = cx.querySelector('#cal-f-busca');
    if (fBusca) fBusca.oninput = B7.UI.debounce ? B7.UI.debounce(e => { F.busca = e.target.value; guardarFiltros(); desenhar(); }, 250) : e => { F.busca = e.target.value; guardarFiltros(); desenhar(); };

    cx.querySelectorAll('[data-evento]').forEach(el => {
      const abrir = () => { const ev = eventos.find(x => x.id === el.dataset.evento); if (ev) modalEvento(ev); };
      el.onclick = abrir;
      el.onkeydown = e => { if (e.key === 'Enter') abrir(); };
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
          '</div><button class="b fina contorno" id="cal-cfg-desconectar">Desconectar</button>'
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
      return agendas.map(a =>
        '<label class="cal-agenda-item"><input type="checkbox" data-agenda="' + a.id + '"' + (a.ativo ? ' checked' : '') + '>' +
        '<span>' + esc(a.nome) + '</span></label>').join('') +
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
          } catch (e) { chk.checked = !chk.checked; B7.UI.toast(e.message || 'Não foi possível salvar.'); }
          chk.disabled = false;
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
     DETALHE DO EVENTO
     ================================================================= */
  function modalEvento(ev) {
    const cancelado = ev.status_provider === 'cancelled';
    const dt = new Date(ev.inicio);
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
      (ev.gravacao_id
        ? '<div class="cal-gravacao-vinculada"><b>' + esc(ev.gravacao_nome) + '</b><span>' + esc(ev.gravacao_cliente_nome || '') + '</span>' +
          '<div class="acoes-inline"><a class="b fina contorno" href="#/gravacao/' + ev.gravacao_id + '">Ver gravação</a>' +
          (souGestor() ? '<button class="b fina contorno" id="cal-desvincular">Desvincular</button>' : '') + '</div></div>'
        : '<p class="fraca">Este evento ainda não está vinculado a nenhuma gravação do B7.</p>' +
          (souGestor() ? '<div class="acoes-inline"><button class="b fina contorno" id="cal-vincular">Vincular gravação</button>' +
            '<button class="b fina contorno" id="cal-criar">Criar gravação</button></div>' : '')) +
      '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>'
    );
    const btVincular = m.querySelector('#cal-vincular'); if (btVincular) btVincular.onclick = () => { m.fechar(); modalVincular(ev); };
    const btCriar = m.querySelector('#cal-criar'); if (btCriar) btCriar.onclick = () => { m.fechar(); modalCriarGravacao(ev); };
    const btDesvincular = m.querySelector('#cal-desvincular'); if (btDesvincular) btDesvincular.onclick = async () => {
      const ok = await B7.UI.confirmar({ titulo: 'Desvincular este evento?', texto: 'A gravação em si não é apagada — só deixa de estar ligada a este evento da agenda.', rotulo: 'Desvincular' });
      if (!ok) return;
      try { await B7.DB.desvincularCalendario(ev.id); m.fechar(); B7.UI.toast('Desvinculado.'); apenasRecarregarEventos(); }
      catch (e) { B7.UI.toast(e.message || 'Não foi possível desvincular.'); }
    };
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
          m.fechar(); B7.UI.toast('Vinculado.'); apenasRecarregarEventos();
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
          m.fechar(); B7.UI.toast('Gravação criada e vinculada.'); apenasRecarregarEventos();
        } catch (e) { btn.disabled = false; btn.textContent = 'Criar gravação'; B7.UI.toast(e.message || 'Não foi possível criar a gravação.'); }
      };
    });
  }

  return { abrir };
})();
