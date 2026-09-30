/* =====================================================================
   GRAVAÇÃO (fase 5 — Gravações 2.0)

   Rota #/gravacao/<id>. Abrir uma gravação mostra a GRAVAÇÃO — a sessão
   de produção — e não mais o primeiro roteiro. O editor de roteiros
   continua igual, em #/gravacao/<id>/roteiros (ou ?roteiro=<id>).

   Responde: o que vamos gravar, quando, para qual mês de produção e o
   que de fato foi gravado.

   Dados (nenhum copiado):
     • gravacoes_resumo           — a gravação, mês de referência, responsável
     • gravacao_itens_resumo      — os itens: roteiro / referência (trend) /
                                    avulso / conteúdo da Linha Editorial,
                                    com o que cada um aponta
     • gravacoes_ocorrencias      — datas: a atual e as antigas (remarcações)
     • gravacao_historico         — ações persistidas de verdade
   Toda escrita passa pelas funções do banco (B7.DB.gravacao*): elas
   validam permissão, guardam o histórico e mantêm o status do roteiro
   igual ao do item.

   Status (mesma semântica e mesmas cores do Calendário):
     Marcada (azul) · Remarcada (amarelo) · Concluída (verde) ·
     Cancelada (vermelho) · Sem data (legado/ainda não marcada)
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Gravacao = (function () {
  const esc = s => B7.UI.esc(s);
  const painel = () => document.getElementById('painel-dashboard');
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  /* situação da gravação (gravacoes.situacao) → rótulo e classe do Calendário */
  const SITUACAO = {
    Agendada: { rot: 'Marcada', cls: 'cal-st-marcada' },
    Remarcada: { rot: 'Remarcada', cls: 'cal-st-remarcada' },
    Gravada: { rot: 'Concluída', cls: 'cal-st-concluida' },
    Cancelada: { rot: 'Cancelada', cls: 'cal-st-cancelada' },
    Pendente: { rot: 'Sem data', cls: 'gv-st-semdata' }
  };
  const rotuloSituacao = s => (SITUACAO[s] || SITUACAO.Pendente).rot;
  function chipSituacao(s) {
    const x = SITUACAO[s] || SITUACAO.Pendente;
    return '<span class="cal-badge-status gv-badge ' + x.cls + '">' + esc(x.rot) + '</span>';
  }
  const mesRef = (ano, mes) => (ano && mes) ? MESES[mes - 1] + ' de ' + ano : '';

  const TIPO = {
    roteiro: { rot: 'Roteiro', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12.5h6M9 16h4"/></svg>' },
    referencia: { rot: 'Trend', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/></svg>' },
    avulso: { rot: 'Avulso', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l2.4 5 5.4.6-4 3.7 1.1 5.4L12 15.6l-4.9 2.6 1.1-5.4-4-3.7 5.4-.6z"/></svg>' },
    conteudo: { rot: 'Conteúdo', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 12.5h8M8 16h5"/></svg>' }
  };
  const IC = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 12.5l4.2 4.2 8.8-9.4"/></svg>',
    abrir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4.5h5.5V10M19.5 4.5l-8 8M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/></svg>',
    seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    voltar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M5 12h.01M12 12h.01M19 12h.01"/></svg>',
    agenda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8.5 3v3M15.5 3v3"/></svg>',
    pessoa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5"/></svg>',
    local: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
    mes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 13.5h3M8 17h6"/></svg>'
  };

  let S = null;          /* { id, g, itens, ocs, hist, estado:{itens,hist} } */
  let geracao = 0;

  const ehEquipe = () => !!(B7.Auth && B7.Auth.ehEquipe && B7.Auth.ehEquipe());
  const meuId = () => {
    const alvo = (B7.PreviaUsuario && B7.PreviaUsuario.ativa && B7.PreviaUsuario.ativa()) ? B7.PreviaUsuario.usuarioAtivo() : null;
    if (alvo && alvo.id) return alvo.id;
    const u = B7.Auth && B7.Auth.usuario(); return u ? u.id : null;
  };
  const podeEditar = () => ehEquipe();
  const podeMarcar = () => ehEquipe() || (S && S.g && S.g.videomaker_id && S.g.videomaker_id === meuId());

  /* ------------------------------------------------------------ datas
     data_gravacao é AAAA-MM-DD (nunca new Date(texto)); hora é HH:MM:SS */
  function dataLonga(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    const dt = new Date(a, m - 1, d);
    return DOW[dt.getDay()] + ', ' + String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/' + a;
  }
  const hhmm = t => t ? String(t).slice(0, 5) : '';
  function quandoGravacao(g) {
    if (!g.data_gravacao) return 'Sem data marcada';
    return dataLonga(g.data_gravacao) + (g.hora_inicio ? ' · ' + hhmm(g.hora_inicio) + (g.hora_fim ? '–' + hhmm(g.hora_fim) : '') : ' · sem horário');
  }
  /* instante de uma ocorrência (timestamptz) → dd/mm HH:MM no fuso local */
  function quandoOc(iso, semHorario) {
    const d = new Date(iso);
    const dia = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    return semHorario ? dia : dia + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* ========================================================= abrir */
  async function abrir(id) {
    const g0 = ++geracao;
    B7.Dashboard.marcarNav('#/gravacoes');
    B7.Rota.titulo(['Gravação']);
    painel().innerHTML = '<div class="conteudo gv entra">' + B7.UI.skeleton('lista', { n: 4 }) + '</div>';
    let g;
    try { g = await B7.DB.gravacao(id); }
    catch (e) {
      if (g0 !== geracao) return;
      painel().innerHTML = '<div class="conteudo gv"><div class="estado-b7"><b>Não foi possível abrir esta gravação.</b><p>' +
        esc(e.message || '') + '</p><a class="b contorno" href="#/gravacoes">Voltar para Gravações</a></div></div>';
      return;
    }
    if (g0 !== geracao) return;
    S = { id, g, itens: [], ocs: [], hist: [], estado: { itens: 'carregando', hist: 'carregando' } };
    B7.Rota.titulo([g.nome, g.cliente_nome]);
    desenhar();
    carregarItens(g0);
    carregarHistorico(g0);
  }

  function carregarItens(g0) {
    S.estado.itens = 'carregando'; pintarItens();
    B7.DB.gravacaoItens(S.id).then(l => {
      if (g0 !== geracao) return;
      S.itens = (l || []).filter(i => !(i.tipo === 'roteiro' && i.roteiro_removido));
      S.estado.itens = 'ok'; pintarItens(); pintarResumoTopo();
    }).catch(() => { if (g0 !== geracao) return; S.estado.itens = 'erro'; pintarItens(); });
  }
  function carregarHistorico(g0) {
    S.estado.hist = 'carregando'; pintarHistorico();
    Promise.all([B7.DB.gravacaoHistorico(S.id), B7.DB.gravacaoOcorrencias(S.id)]).then(([h, o]) => {
      if (g0 !== geracao) return;
      S.hist = h || []; S.ocs = o || []; S.estado.hist = 'ok'; pintarHistorico();
    }).catch(() => { if (g0 !== geracao) return; S.estado.hist = 'erro'; pintarHistorico(); });
  }
  async function recarregarGravacao() {
    try { S.g = await B7.DB.gravacao(S.id); } catch (e) {}
    pintarCabecalho(); pintarResumoTopo(); pintarDetalhes();
    carregarHistorico(geracao);
  }

  /* ======================================================= desenho */
  function desenhar() {
    painel().innerHTML = '<div class="conteudo gv entra" id="gv-raiz">' +
      '<a class="gv-voltar" href="#/gravacoes">' + IC.voltar + 'Gravações</a>' +
      '<header class="gv-cab" id="gv-cab"></header>' +
      '<div class="gv-grade">' +
        '<div class="gv-principal">' +
          '<section class="gv-bloco" id="gv-itens" aria-labelledby="gv-t-itens"></section>' +
          '<section class="gv-bloco" id="gv-obs" aria-labelledby="gv-t-obs"></section>' +
        '</div>' +
        '<aside class="gv-lado">' +
          '<section class="gv-bloco" id="gv-detalhes" aria-labelledby="gv-t-det"></section>' +
          '<section class="gv-bloco" id="gv-hist" aria-labelledby="gv-t-hist"></section>' +
        '</aside>' +
      '</div>' +
    '</div>';
    pintarCabecalho(); pintarItens(); pintarObservacoes(); pintarDetalhes(); pintarHistorico();
  }

  function pintarCabecalho() {
    const cx = document.getElementById('gv-cab'); if (!cx) return;
    const g = S.g;
    const sit = g.situacao || 'Pendente';
    const concluida = sit === 'Gravada', cancelada = sit === 'Cancelada';
    const mes = mesRef(g.competencia_ano, g.competencia_mes);
    cx.innerHTML =
      '<div class="gv-cab-topo">' +
        '<a class="gv-cli" href="#/cliente/' + esc(g.client_id) + '">' + B7.UI.avatarCliente(g.cliente_nome, g.cliente_logo_url, 'p') +
          '<span>' + esc(g.cliente_nome || '') + '</span></a>' +
        chipSituacao(sit) +
      '</div>' +
      '<h1 class="gv-nome">' + esc(g.nome) + '</h1>' +
      '<div class="gv-fatos">' +
        '<span class="gv-fato gv-fato-mes' + (mes ? '' : ' falta') + '">' + IC.mes +
          (mes ? '<span><small>Mês de referência</small><b>' + esc(mes) + '</b></span>'
               : '<span><small>Mês de referência</small><b>Não definido</b></span>') + '</span>' +
        '<span class="gv-fato">' + IC.agenda + '<span><small>' + (sit === 'Remarcada' ? 'Nova data' : 'Data da gravação') + '</small><b>' +
          esc(quandoGravacao(g)) + '</b></span></span>' +
        '<span class="gv-fato">' + IC.pessoa + '<span><small>Responsável</small><b>' +
          esc(g.videomaker_nome || g.videomaker || 'Sem responsável') + '</b></span></span>' +
      '</div>' +
      (!mes && podeEditar() ? '<div class="gv-aviso"><span>Esta gravação é anterior ao mês de referência. Defina o mês para ela aparecer na produção certa.</span>' +
        '<button type="button" class="b fina contorno" data-gv="editar">Definir mês</button></div>' : '') +
      '<div class="gv-acoes">' +
        (podeEditar() && !concluida ? '<button type="button" class="b ' + (g.data_gravacao && !cancelada ? 'contorno' : 'pri') + '" data-gv="agendar">' +
          IC.agenda + '<span>' + (g.data_gravacao ? (cancelada ? 'Remarcar (reativar)' : 'Remarcar') : 'Marcar data') + '</span></button>' : '') +
        (podeEditar() && !concluida && !cancelada ? '<button type="button" class="b contorno" data-gv="concluir">' + IC.check + '<span>Concluir gravação</span></button>' : '') +
        '<a class="b contorno" href="#/gravacao/' + esc(g.id) + '/roteiros">' + TIPO.roteiro.ic + '<span>Abrir roteiros</span></a>' +
        '<button type="button" class="b ico gv-mais-acoes" data-gv="menu" aria-label="Mais ações" aria-haspopup="menu">' + IC.menu + '</button>' +
      '</div>';
    ligarAcoes(cx);
  }

  /* resumo "4 de 6 gravados" — no topo do checklist */
  function pintarResumoTopo() { pintarItens(); }

  function linhaItem(it, i, total) {
    const t = TIPO[it.tipo] || TIPO.avulso;
    let titulo, sub = [], acao = '';
    if (it.tipo === 'roteiro') {
      titulo = it.roteiro_titulo || 'Roteiro sem título';
      if (it.roteiro_status) sub.push(it.roteiro_status);
      const casa = it.roteiro_gravacao_id || S.id;
      if (casa !== S.id) sub.push('escrito em outra gravação');
      acao = '<a class="b fina contorno gv-it-abrir" href="#/gravacao/' + esc(casa) + '?roteiro=' + esc(it.roteiro_id) + '">Abrir roteiro' + IC.seta + '</a>';
    } else if (it.tipo === 'referencia') {
      titulo = it.titulo;
      let host = ''; try { host = new URL(it.url).hostname.replace(/^www\./, ''); } catch (e) {}
      if (host) sub.push(host);
      acao = '<a class="b fina contorno gv-it-abrir" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer nofollow">Abrir referência' + IC.abrir + '</a>';
    } else if (it.tipo === 'conteudo') {
      titulo = it.conteudo_titulo || 'Conteúdo sem título';
      if (it.conteudo_tipo) sub.push(it.conteudo_tipo);
      if (it.conteudo_data_postagem) sub.push('postagem ' + B7.UI.dataBR(it.conteudo_data_postagem));
      if (it.conteudo_linha_id) acao = '<a class="b fina contorno gv-it-abrir" href="#/linha/' + esc(it.conteudo_linha_id) + '?conteudo=' + esc(it.conteudo_id) + '">Abrir conteúdo' + IC.seta + '</a>';
    } else {
      titulo = it.titulo;
    }
    const gravadoTx = it.gravado ? 'Gravado' + (it.gravado_por_nome ? ' por ' + it.gravado_por_nome.split(' ')[0] : '') : 'Não gravado';
    const marcar = podeMarcar();
    return '<li class="gv-it' + (it.gravado ? ' feito' : '') + '" data-item="' + esc(it.id) + '">' +
      (marcar
        ? '<button type="button" class="gv-check" role="checkbox" aria-checked="' + (it.gravado ? 'true' : 'false') + '" data-marcar="' + esc(it.id) + '" ' +
            'aria-label="' + esc((it.gravado ? 'Desmarcar ' : 'Marcar como gravado: ') + t.rot + ' — ' + titulo) + '">' + IC.check + '</button>'
        : '<span class="gv-check estatico" aria-hidden="true">' + (it.gravado ? IC.check : '') + '</span>') +
      '<div class="gv-it-tx">' +
        '<span class="gv-it-tipo">' + t.ic + esc(t.rot) + '</span>' +
        '<b>' + esc(titulo) + '</b>' +
        (it.observacao ? '<p class="gv-it-obs">' + esc(it.observacao) + '</p>' : '') +
        '<span class="gv-it-meta">' + sub.map(x => '<span>' + esc(x) + '</span>').join('') +
          '<span class="gv-it-estado">' + esc(gravadoTx) + '</span></span>' +
      '</div>' +
      '<div class="gv-it-acoes">' + acao +
        (podeEditar() ? '<button type="button" class="b ico fina" data-item-menu="' + esc(it.id) + '" aria-label="Opções do item" aria-haspopup="menu">' + IC.menu + '</button>' : '') +
      '</div></li>';
  }

  function pintarItens() {
    const cx = document.getElementById('gv-itens'); if (!cx || !S) return;
    const e = S.estado.itens;
    const total = S.itens.length, feitos = S.itens.filter(i => i.gravado).length;
    const sit = S.g.situacao || 'Pendente';
    let corpo;
    if (e === 'carregando') corpo = B7.UI.skeleton('lista', { n: 3 });
    else if (e === 'erro') corpo = '<div class="pn-erro" role="alert"><span>Não foi possível carregar os itens desta gravação.</span>' +
      '<button type="button" class="b fina contorno" data-gv="recarregar-itens">Tentar de novo</button></div>';
    else if (!total) corpo = '<div class="gv-vazio"><b>Nenhum item adicionado à gravação.</b>' +
      '<span>Adicione roteiros, trends, conteúdos da Linha Editorial ou o que for gravar de improviso — roteiro não é obrigatório.</span></div>';
    else {
      const faltam = total - feitos;
      let aviso = '';
      if (sit === 'Gravada') aviso = '<div class="gv-faixa gv-faixa-ok">' + IC.check + '<span>Gravação concluída' +
        (S.g.concluida_em ? ' em ' + esc(B7.UI.dataBR(String(S.g.concluida_em).slice(0, 10))) : '') + ' — ' + feitos + ' de ' + total + ' itens gravados.' +
        (faltam ? ' ' + (faltam === 1 ? 'O item restante continua pendente.' : 'Os ' + faltam + ' restantes continuam pendentes.') : '') + '</span></div>';
      else if (!faltam && sit !== 'Cancelada' && podeEditar()) aviso = '<div class="gv-faixa gv-faixa-ok">' + IC.check +
        '<span>Todos os itens foram gravados.</span><button type="button" class="b pri fina" data-gv="concluir">Concluir gravação</button></div>';
      corpo = aviso + '<ol class="gv-lista">' + S.itens.map((it, i) => linhaItem(it, i, total)).join('') + '</ol>';
    }
    cx.innerHTML = '<div class="gv-sec-cab"><h2 id="gv-t-itens">O que vamos gravar</h2>' +
      (e === 'ok' && total ? '<span class="gv-progresso" aria-label="' + feitos + ' de ' + total + ' itens gravados"><b>' + feitos + '</b> de ' + total + ' gravados' +
        '<i style="--p:' + Math.round(feitos / total * 100) + '%"></i></span>' : '') +
      (podeEditar() ? '<button type="button" class="b fina ' + (total ? 'contorno' : 'pri') + ' gv-add" data-gv="adicionar">' + IC.mais + '<span>Adicionar item</span></button>' : '') +
      '</div>' + corpo;
    ligarAcoes(cx);
    cx.querySelectorAll('[data-marcar]').forEach(b => b.onclick = () => alternarItem(b.dataset.marcar, b));
    cx.querySelectorAll('[data-item-menu]').forEach(b => b.onclick = () => menuItem(b.dataset.itemMenu, b));
  }

  function pintarObservacoes() {
    const cx = document.getElementById('gv-obs'); if (!cx) return;
    const pode = podeEditar();
    cx.innerHTML = '<div class="gv-sec-cab"><h2 id="gv-t-obs">Observações</h2></div>' +
      (pode ? '<textarea class="campo gv-obs-campo" id="gv-obs-campo" rows="3" placeholder="Combinados, pedidos do cliente, o que levar…" aria-labelledby="gv-t-obs">' +
                esc(S.g.observacoes || '') + '</textarea>'
            : (S.g.observacoes ? '<p class="gv-obs-tx">' + esc(S.g.observacoes) + '</p>' : '<p class="pn-nota">Sem observações.</p>'));
    const t = cx.querySelector('#gv-obs-campo');
    if (t) {
      B7.UI.autoAltura(t);
      /* mesmo autosave do resto do B7: o texto digitado nunca é
         sobrescrito por dado do servidor enquanto a pessoa está aqui */
      t.oninput = () => { B7.UI.autoAltura(t); S.g.observacoes = t.value; B7.Save.campo('gravacoes', S.id, { observacoes: t.value }); };
    }
  }

  function pintarDetalhes() {
    const cx = document.getElementById('gv-detalhes'); if (!cx) return;
    const g = S.g;
    const linha = (rot, val) => '<div class="gv-det"><dt>' + esc(rot) + '</dt><dd>' + val + '</dd></div>';
    cx.innerHTML = '<div class="gv-sec-cab"><h2 id="gv-t-det">Detalhes</h2>' +
        (podeEditar() ? '<button type="button" class="b fina contorno" data-gv="editar">Editar</button>' : '') + '</div>' +
      '<dl class="gv-dets">' +
        linha('Status', chipSituacao(g.situacao || 'Pendente')) +
        linha('Mês de referência', esc(mesRef(g.competencia_ano, g.competencia_mes) || 'Não definido (gravação antiga)')) +
        linha('Data', esc(quandoGravacao(g))) +
        linha('Responsável', esc(g.videomaker_nome || g.videomaker || '—')) +
        (g.local ? linha('Local', esc(g.local)) : '') +
        linha('Preparação', B7.UI.chipStatus(g.status)) +
      '</dl>';
    ligarAcoes(cx);
  }

  /* ---------------------------------------------------- histórico */
  const ROTULO_HIST = {
    criada: 'Gravação criada', data_definida: 'Data marcada', remarcada: 'Remarcada', concluida: 'Gravação concluída',
    cancelada: 'Gravação cancelada', item_adicionado: 'Item adicionado', item_removido: 'Item removido da gravação',
    item_gravado: 'Item gravado', item_desmarcado: 'Item desmarcado', mes_definido: 'Mês de referência definido',
    responsavel_definido: 'Responsável definido'
  };
  const ROTULO_TIPO_ITEM = { roteiro: 'roteiro', referencia: 'trend', avulso: 'avulso', conteudo: 'conteúdo' };
  function textoHist(h) {
    const d = h.dados || {};
    const mesTx = v => { if (!v) return 'sem mês'; const [a, m] = String(v).split('-').map(Number); return mesRef(a, m); };
    switch (h.tipo) {
      case 'remarcada': return 'De ' + quandoOc(d.de, d.de_sem_horario) + (d.anterior_status === 'cancelada' ? ' (cancelada)' : '') +
        ' para ' + quandoOc(d.para, d.para_sem_horario) + (d.motivo ? ' — ' + d.motivo : '');
      case 'data_definida': return quandoOc(d.para, d.para_sem_horario);
      case 'concluida': return (d.itens != null ? d.gravados + ' de ' + d.itens + ' itens gravados' : '');
      case 'cancelada': return d.motivo || '';
      case 'item_adicionado': case 'item_removido': case 'item_gravado': case 'item_desmarcado':
        return (ROTULO_TIPO_ITEM[d.tipo] ? ROTULO_TIPO_ITEM[d.tipo] + ' · ' : '') + (d.titulo || '') + (d.via ? ' (' + d.via + ')' : '');
      case 'mes_definido': return (d.de ? mesTx(d.de) + ' → ' : '') + mesTx(d.para);
      case 'responsavel_definido': return (d.de ? d.de + ' → ' : '') + (d.para || 'sem responsável');
      case 'criada': return d.competencia ? 'Mês de referência: ' + mesTx(d.competencia) : '';
      default: return '';
    }
  }
  function pintarHistorico() {
    const cx = document.getElementById('gv-hist'); if (!cx || !S) return;
    const e = S.estado.hist;
    let corpo;
    if (e === 'carregando') corpo = B7.UI.skeleton('lista', { n: 3 });
    else if (e === 'erro') corpo = '<div class="pn-erro" role="alert"><span>Não foi possível carregar o histórico.</span>' +
      '<button type="button" class="b fina contorno" data-gv="recarregar-hist">Tentar de novo</button></div>';
    else {
      /* datas: a atual e as antigas (nunca somem) */
      const datas = S.ocs.length > 1 || S.ocs.some(o => !o.atual)
        ? '<div class="gv-datas"><h3>Datas desta gravação</h3><ol>' + S.ocs.map(o =>
            '<li class="' + (o.atual ? 'atual' : '') + '"><span class="cal-badge-status ' + ({ marcada: 'cal-st-marcada', remarcada: 'cal-st-remarcada', concluida: 'cal-st-concluida', cancelada: 'cal-st-cancelada' }[o.status] || '') + '">' +
              esc({ marcada: 'Marcada', remarcada: 'Remarcada', concluida: 'Concluída', cancelada: 'Cancelada' }[o.status] || o.status) + '</span>' +
              '<span>' + esc(quandoOc(o.inicio, o.sem_horario)) + (o.atual ? ' · atual' : '') + '</span></li>').join('') + '</ol></div>'
        : '';
      const lista = S.hist.length
        ? '<ol class="gv-hist-lista">' + S.hist.map(h => '<li><b>' + esc(ROTULO_HIST[h.tipo] || h.tipo) + '</b>' +
            (textoHist(h) ? '<span>' + esc(textoHist(h)) + '</span>' : '') +
            '<small>' + esc((h.ator_nome ? h.ator_nome.split(' ')[0] + ' · ' : '') + B7.UI.quando(h.criado_em)) + '</small></li>').join('') + '</ol>'
        : '<p class="pn-nota">O histórico começa a ser registrado a partir desta versão do sistema.</p>';
      corpo = datas + lista;
    }
    cx.innerHTML = '<div class="gv-sec-cab"><h2 id="gv-t-hist">Histórico</h2></div>' + corpo;
    ligarAcoes(cx);
  }

  /* ======================================================= ações */
  function ligarAcoes(raiz) {
    raiz.querySelectorAll('[data-gv]').forEach(b => {
      b.onclick = () => {
        const a = b.dataset.gv;
        if (a === 'agendar') return modalAgendar();
        if (a === 'concluir') return concluir();
        if (a === 'editar') return modalEditar();
        if (a === 'adicionar') return menuAdicionar(b);
        if (a === 'menu') return menuGravacao(b);
        if (a === 'recarregar-itens') return carregarItens(geracao);
        if (a === 'recarregar-hist') return carregarHistorico(geracao);
      };
    });
  }

  async function alternarItem(itemId, botao) {
    const it = S.itens.find(x => x.id === itemId); if (!it) return;
    const novo = !it.gravado;
    /* resposta imediata na tela; se o banco recusar, volta */
    it.gravado = novo; it.gravado_por_nome = novo ? ((B7.Auth.usuario() || {}).nome || '') : null;
    pintarItens();
    try {
      await B7.Save.acao(() => B7.DB.gravacaoItemMarcar(itemId, novo));
      if (it.tipo === 'roteiro') it.roteiro_status = novo ? 'Gravado' : (it.roteiro_status === 'Gravado' ? 'Pronto para gravar' : it.roteiro_status);
      pintarItens(); carregarHistorico(geracao);
      const alvo = document.querySelector('[data-marcar="' + itemId + '"]'); if (alvo) alvo.focus();
    } catch (e) { it.gravado = !novo; pintarItens(); }
  }

  /* folha/menu simples: lista de botões (no celular vira folha pelo B7.UI.modal) */
  function menuSimples(titulo, opcoes) {
    const m = B7.UI.modal('<div class="tp-folha-cab"><h3>' + esc(titulo) + '</h3><button type="button" class="ico" data-fecha aria-label="Fechar">' +
      '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="tp-folha-corpo gv-menu" role="menu">' + opcoes.map((o, i) =>
        (o.separar ? '<hr>' : '') + '<button type="button" class="tp-item' + (o.perigo ? ' perigo' : '') + '" role="menuitem" data-op="' + i + '">' +
        (o.ic ? '<span class="tp-item-ic">' + o.ic + '</span>' : '') +
        '<span class="tp-item-tx"><b>' + esc(o.rotulo) + '</b>' + (o.dica ? '<small>' + esc(o.dica) + '</small>' : '') + '</span></button>').join('') +
      '</div>', { classe: 'tp-folha' });
    m.querySelectorAll('[data-op]').forEach(b => b.onclick = () => { m.fechar(); opcoes[+b.dataset.op].fazer(); });
    const cx = m.querySelector('.modal'); if (cx) { cx.tabIndex = -1; cx.focus({ preventScroll: true }); }
  }

  function menuGravacao() {
    const g = S.g, sit = g.situacao || 'Pendente';
    const ops = [];
    if (podeEditar()) ops.push({ rotulo: 'Editar detalhes', dica: 'nome, mês de referência, responsável, local', fazer: modalEditar });
    ops.push({ rotulo: 'Abrir roteiros', dica: 'editor de roteiros desta gravação', fazer: () => { location.hash = '#/gravacao/' + g.id + '/roteiros'; } });
    ops.push({ rotulo: 'Imprimir roteiros', fazer: () => { location.hash = '#/gravacao/' + g.id + '/roteiros?imprimir=1'; } });
    if (B7.Perm && B7.Perm.podeRota('calendario')) ops.push({ rotulo: 'Ver no calendário', fazer: () => { location.hash = '#/calendario'; } });
    if (podeEditar() && sit !== 'Gravada' && sit !== 'Cancelada') ops.push({ rotulo: 'Cancelar gravação', dica: 'nada é apagado — fica no histórico', perigo: true, separar: true, fazer: modalCancelar });
    menuSimples(g.nome, ops);
  }

  function menuItem(itemId) {
    const idx = S.itens.findIndex(x => x.id === itemId); const it = S.itens[idx]; if (!it) return;
    const ops = [];
    if (idx > 0) ops.push({ rotulo: 'Mover para cima', fazer: () => mover(it, -1) });
    if (idx < S.itens.length - 1) ops.push({ rotulo: 'Mover para baixo', fazer: () => mover(it, 1) });
    if (it.tipo === 'referencia' || it.tipo === 'avulso') ops.push({ rotulo: 'Editar', fazer: () => modalItemLivre(it.tipo, it) });
    ops.push({ rotulo: 'Tirar da gravação', perigo: true, separar: true,
      dica: it.tipo === 'roteiro' ? 'o roteiro continua existindo' : it.tipo === 'conteudo' ? 'o conteúdo continua na Linha Editorial' : 'fica registrado no histórico',
      fazer: () => remover(it) });
    menuSimples(({ roteiro: it.roteiro_titulo, conteudo: it.conteudo_titulo }[it.tipo]) || it.titulo || 'Item', ops);
  }

  async function mover(it, delta) {
    try { await B7.Save.acao(() => B7.DB.gravacaoItemMover(it.id, delta)); carregarItens(geracao); } catch (e) {}
  }
  async function remover(it) {
    const nome = ({ roteiro: it.roteiro_titulo, conteudo: it.conteudo_titulo }[it.tipo]) || it.titulo || 'este item';
    const ok = await B7.UI.confirmar({
      titulo: 'Tirar "' + nome + '" da gravação?',
      texto: it.tipo === 'roteiro' ? 'Só o vínculo sai daqui — o roteiro e as cenas continuam intactos.'
           : it.tipo === 'conteudo' ? 'Só o vínculo sai daqui — o conteúdo continua na Linha Editorial.'
           : 'O item sai da lista; o registro fica no histórico da gravação.',
      rotulo: 'Tirar da gravação', perigo: true });
    if (!ok) return;
    try { await B7.Save.acao(() => B7.DB.gravacaoItemRemover(it.id), 'Item retirado da gravação'); carregarItens(geracao); carregarHistorico(geracao); } catch (e) {}
  }

  /* ---------------------------------------------- adicionar item */
  function menuAdicionar() {
    menuSimples('Adicionar à gravação', [
      { rotulo: 'Roteiro novo', dica: 'escreve um roteiro dentro desta gravação', ic: TIPO.roteiro.ic, fazer: novoRoteiro },
      { rotulo: 'Roteiro existente', dica: 'um roteiro já escrito para este cliente', ic: TIPO.roteiro.ic, fazer: () => seletor('roteiro') },
      { rotulo: 'Trend / referência', dica: 'um link para se inspirar (Instagram, TikTok…)', ic: TIPO.referencia.ic, fazer: () => modalItemLivre('referencia') },
      { rotulo: 'Conteúdo avulso', dica: 'depoimento, bastidor, algo de improviso', ic: TIPO.avulso.ic, fazer: () => modalItemLivre('avulso') },
      { rotulo: 'Conteúdo da Linha Editorial', dica: 'um criativo já planejado para o cliente', ic: TIPO.conteudo.ic, fazer: () => seletor('conteudo') }
    ]);
  }

  async function novoRoteiro() {
    try {
      const pos = S.itens.filter(i => i.tipo === 'roteiro').length + 1;
      const r = await B7.Save.acao(() => B7.DB.criarRoteiro({ recording_session_id: S.id, position: pos, titulo: '', status: 'Em criação' }));
      location.hash = '#/gravacao/' + S.id + '?roteiro=' + r.id;
    } catch (e) {}
  }

  function modalItemLivre(tipo, it) {
    const ref = tipo === 'referencia';
    const m = B7.UI.modal('<h3>' + (it ? 'Editar ' : '') + (ref ? 'Trend / referência' : 'Conteúdo avulso') + '</h3>' +
      '<label class="rot" for="gv-il-titulo">' + (ref ? 'Nome' : 'O que vai ser gravado') + '</label>' +
      '<input class="campo" id="gv-il-titulo" data-foco maxlength="140" value="' + esc(it ? it.titulo || '' : '') + '" placeholder="' +
        (ref ? 'Ex.: Trend recepcionista POV' : 'Ex.: Depoimento da Dra. Ana') + '">' +
      (ref ? '<label class="rot" for="gv-il-url">Link</label><input class="campo" id="gv-il-url" type="url" inputmode="url" autocomplete="off" ' +
        'placeholder="https://www.instagram.com/…" value="' + esc(it ? it.url || '' : '') + '">' : '') +
      '<label class="rot" for="gv-il-obs">Observação <span class="leve">— opcional</span></label>' +
      '<textarea class="campo" id="gv-il-obs" rows="3" placeholder="' + (ref ? 'Ex.: usar a mesma entrada, adaptando para odontologia' : 'Ex.: perguntar sobre o novo equipamento') + '">' +
        esc(it ? it.observacao || '' : '') + '</textarea>' +
      '<div class="ajuda erro-txt" id="gv-il-erro"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" id="gv-il-ok">' + (it ? 'Salvar' : 'Adicionar') + '</button></div>');
    m.querySelector('#gv-il-ok').onclick = async () => {
      const titulo = m.querySelector('#gv-il-titulo').value.trim();
      let url = ref ? m.querySelector('#gv-il-url').value.trim() : null;
      const observacao = m.querySelector('#gv-il-obs').value.trim();
      const erro = m.querySelector('#gv-il-erro');
      if (!titulo) { erro.textContent = 'Dê um nome para o item.'; return; }
      if (ref) {
        if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
        try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw 0; } catch (e) { erro.textContent = 'Cole um link válido (ex.: https://www.instagram.com/…).'; return; }
      }
      const bt = m.querySelector('#gv-il-ok'); bt.disabled = true;
      try {
        if (it) await B7.DB.gravacaoItemEditar(it.id, { titulo, url, observacao });
        else await B7.DB.gravacaoItemAdicionar(S.id, { tipo, titulo, url, observacao });
        m.fechar(); B7.UI.toast(it ? 'Item atualizado' : 'Item adicionado'); carregarItens(geracao); carregarHistorico(geracao);
      } catch (e) { bt.disabled = false; erro.textContent = e.message || 'Não foi possível salvar.'; }
    };
  }

  /* seletor de roteiro/conteúdo: só do CLIENTE da gravação; o mês de
     referência vem primeiro (contexto forte), sem bloquear outros meses */
  async function seletor(tipo) {
    const g = S.g;
    const m = B7.UI.modal('<h3>' + (tipo === 'roteiro' ? 'Roteiro existente' : 'Conteúdo da Linha Editorial') + '</h3>' +
      '<div class="sub">' + esc(g.cliente_nome || '') + (g.competencia_ano ? ' · ' + esc(mesRef(g.competencia_ano, g.competencia_mes)) + ' primeiro' : '') + '</div>' +
      '<input class="campo" id="gv-sel-busca" type="search" placeholder="Buscar pelo título…" aria-label="Buscar" data-foco>' +
      '<div class="gv-sel-lista" id="gv-sel-lista">' + B7.UI.skeleton('lista', { n: 4 }) + '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>', { larga: true });
    let lista = [];
    try {
      lista = tipo === 'roteiro' ? await B7.DB.roteirosDoCliente(g.client_id) : await B7.DB.conteudosDoCliente(g.client_id);
    } catch (e) {
      m.querySelector('#gv-sel-lista').innerHTML = '<div class="pn-erro"><span>Não foi possível carregar a lista.</span></div>'; return;
    }
    const ja = new Set(S.itens.map(i => tipo === 'roteiro' ? i.roteiro_id : i.conteudo_id).filter(Boolean));
    const mesDe = x => tipo === 'roteiro'
      ? (x.gravacoes && x.gravacoes.competencia_ano ? x.gravacoes.competencia_ano * 100 + x.gravacoes.competencia_mes : null)
      : (x.linhas_editoriais ? x.linhas_editoriais.ano * 100 + x.linhas_editoriais.mes : (x.data_postagem ? +x.data_postagem.slice(0, 4) * 100 + +x.data_postagem.slice(5, 7) : null));
    const alvo = g.competencia_ano ? g.competencia_ano * 100 + g.competencia_mes : null;
    const desenharLista = () => {
      const t = m.querySelector('#gv-sel-busca').value.trim().toLowerCase();
      const vis = lista.filter(x => !t || String(x.titulo || '').toLowerCase().includes(t));
      const doMes = alvo ? vis.filter(x => mesDe(x) === alvo) : [], outros = alvo ? vis.filter(x => mesDe(x) !== alvo) : vis;
      const linha = x => {
        const dentro = ja.has(x.id);
        const sub = tipo === 'roteiro'
          ? [x.status, x.gravacoes ? x.gravacoes.nome : ''].filter(Boolean).join(' · ')
          : [x.tipo, x.data_postagem ? 'postagem ' + B7.UI.dataBR(x.data_postagem) : '', x.linhas_editoriais ? x.linhas_editoriais.nome : ''].filter(Boolean).join(' · ');
        return '<button type="button" class="gv-sel-it" data-sel="' + esc(x.id) + '"' + (dentro ? ' disabled' : '') + '>' +
          '<b>' + esc(x.titulo || 'Sem título') + '</b><small>' + esc(dentro ? 'já está nesta gravação' : sub) + '</small></button>';
      };
      const bloco = (tit, l) => l.length ? '<h4 class="gv-sel-grupo">' + esc(tit) + '</h4>' + l.slice(0, 60).map(linha).join('') : '';
      m.querySelector('#gv-sel-lista').innerHTML = (vis.length
        ? bloco(alvo ? mesRef(g.competencia_ano, g.competencia_mes) : 'Deste cliente', doMes) + bloco(alvo ? 'Outros meses' : '', outros)
        : '<p class="pn-nota">' + (lista.length ? 'Nada encontrado com essa busca.' : (tipo === 'roteiro' ? 'Este cliente ainda não tem roteiros.' : 'Este cliente ainda não tem conteúdos nas Linhas Editoriais.')) + '</p>');
      m.querySelectorAll('[data-sel]').forEach(b => b.onclick = async () => {
        b.disabled = true;
        try {
          await B7.DB.gravacaoItemAdicionar(S.id, tipo === 'roteiro' ? { tipo, roteiroId: b.dataset.sel } : { tipo, conteudoId: b.dataset.sel });
          ja.add(b.dataset.sel); B7.UI.toast('Adicionado à gravação'); desenharLista(); carregarItens(geracao); carregarHistorico(geracao);
        } catch (e) { b.disabled = false; B7.UI.toast(e.message || 'Não foi possível adicionar.', { tipo: 'erro' }); }
      });
    };
    m.querySelector('#gv-sel-busca').oninput = B7.UI.debounce(desenharLista, 150);
    desenharLista();
  }

  /* ---------------------------------------------- data / status */
  function modalAgendar() {
    const g = S.g, remarcar = !!g.data_gravacao;
    const m = B7.UI.modal('<h3>' + (remarcar ? 'Remarcar gravação' : 'Marcar data da gravação') + '</h3>' +
      (remarcar ? '<p class="fraca">A data atual (' + esc(quandoGravacao(g)) + ') não some: ela fica no histórico e no calendário como "Remarcada".</p>' : '') +
      '<div class="vd-grid-2">' +
        '<div><label class="rot" for="gv-ag-data">' + (remarcar ? 'Nova data' : 'Data') + '</label><input class="campo" type="date" id="gv-ag-data" data-foco value="' + esc(remarcar ? '' : '') + '"></div>' +
        '<div></div>' +
        '<div><label class="rot" for="gv-ag-ini">Início <span class="leve">— opcional</span></label><input class="campo" type="time" id="gv-ag-ini" value="' + esc(hhmm(g.hora_inicio)) + '"></div>' +
        '<div><label class="rot" for="gv-ag-fim">Fim <span class="leve">— opcional</span></label><input class="campo" type="time" id="gv-ag-fim" value="' + esc(hhmm(g.hora_fim)) + '"></div>' +
      '</div>' +
      (remarcar ? '<label class="rot" for="gv-ag-motivo">Motivo <span class="leve">— opcional</span></label><input class="campo" id="gv-ag-motivo" placeholder="Ex.: cliente pediu para mudar">' : '') +
      (!g.competencia_ano ? '<p class="fraca">Defina também o mês de referência em "Editar detalhes".</p>' : '') +
      '<div class="ajuda erro-txt" id="gv-ag-erro"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Voltar</button><button class="b pri" id="gv-ag-ok">' + (remarcar ? 'Remarcar' : 'Marcar') + '</button></div>');
    /* início novo depois do fim antigo: o fim antigo deixa de fazer sentido */
    m.querySelector('#gv-ag-ini').addEventListener('change', e => {
      const f = m.querySelector('#gv-ag-fim'); if (f.value && e.target.value && f.value < e.target.value) f.value = '';
    });
    m.querySelector('#gv-ag-ok').onclick = async () => {
      const data = m.querySelector('#gv-ag-data').value, ini = m.querySelector('#gv-ag-ini').value, fim = m.querySelector('#gv-ag-fim').value;
      const motivo = m.querySelector('#gv-ag-motivo') ? m.querySelector('#gv-ag-motivo').value.trim() : '';
      const erro = m.querySelector('#gv-ag-erro');
      if (!data) { erro.textContent = 'Escolha a data.'; return; }
      if (fim && !ini) { erro.textContent = 'Informe o início junto com o fim.'; return; }
      if (fim && ini && fim < ini) { erro.textContent = 'O fim não pode ser antes do início.'; return; }
      const bt = m.querySelector('#gv-ag-ok'); bt.disabled = true;
      try {
        const r = await B7.Save.acao(() => B7.DB.gravacaoAgendar(S.id, data, ini, fim, motivo));
        m.fechar();
        B7.UI.toast(r && r.remarcacao ? 'Gravação remarcada — a data antiga continua no histórico.' : 'Data marcada.');
        await googleAposAgendar(r, S.g, data, ini, fim);
        recarregarGravacao();
      } catch (e) { bt.disabled = false; erro.textContent = e.message || ''; }
    };
  }

  /* Google (best-effort, igual ao Calendário): se a gravação já tem
     evento, ele se move junto; se ainda não tem e há horário, cria.
     Usado pelo detalhe e pela criação/duplicação na lista. */
  async function googleAposAgendar(r, g, data, ini, fim) {
    if (!r || !data) return;
    const iniD = new Date(data + 'T' + (ini || '12:00') + ':00');
    const fimD = fim ? new Date(data + 'T' + fim + ':00') : new Date(iniD.getTime() + 3600e3);
    if (r.evento_id && B7.DB.atualizarEventoGoogle) {
      try { await B7.DB.atualizarEventoGoogle(r.evento_id, iniD.toISOString(), fimD.toISOString(), r.ocorrencia_id); }
      catch (e) { B7.UI.toast('Remarcado no B7, mas não deu pra atualizar no Google: ' + (e.message || ''), { tempo: 8000 }); }
      return;
    }
    if (!r.ocorrencia_id || r.sem_mudanca || !B7.DB.criarEventoGoogle || !B7.DB.statusConexaoCalendario) return;
    let conectado = false;
    try { const st = await B7.DB.statusConexaoCalendario(); conectado = !!(st && st.conectado); } catch (e) {}
    if (!conectado) return;
    if (!ini) { B7.UI.toast('Sem horário: o evento não foi criado no Google. Informe o início para criar.', { tempo: 7000 }); return; }
    try { await B7.DB.criarEventoGoogle(r.ocorrencia_id, 'Grav. ' + ((g && (g.cliente_nome || g.nome)) || ''), iniD.toISOString(), fimD.toISOString(), (g && g.local) || ''); }
    catch (e) { B7.UI.toast('Data salva no B7, mas não deu pra criar o evento no Google: ' + (e.message || ''), { tempo: 8000 }); }
  }

  async function concluir() {
    const total = S.itens.length, feitos = S.itens.filter(i => i.gravado).length, faltam = total - feitos;
    const ok = await B7.UI.confirmar({
      titulo: 'Concluir esta gravação?',
      texto: (total ? feitos + ' de ' + total + ' itens estão marcados como gravados.' +
        (faltam ? ' Os ' + (faltam === 1 ? 'que falta continua' : faltam + ' que faltam continuam') + ' como não gravados — nada é marcado sozinho.' : '') + ' '
        : '') + 'Isso registra que a gravação aconteceu e libera as demandas de edição.',
      rotulo: 'Concluir gravação' });
    if (!ok) return;
    try {
      await B7.Save.acao(() => B7.DB.gravacaoConcluir(S.id));
      B7.UI.toast('Gravação concluída.', B7.Perm && B7.Perm.podeRota('video') ? { acao: 'Gerar demandas de edição', aoClicar: () => { location.hash = '#/video'; } } : undefined);
      recarregarGravacao(); pintarItens();
    } catch (e) {}
  }

  function modalCancelar() {
    const m = B7.UI.modal('<h3>Cancelar gravação</h3>' +
      '<p class="fraca">Nada é apagado: a gravação, os itens e as datas continuam no histórico, marcados como cancelados.</p>' +
      '<label class="rot" for="gv-cn-motivo">Motivo <span class="leve">— opcional</span></label>' +
      '<textarea class="campo" id="gv-cn-motivo" rows="3" data-foco placeholder="Ex.: cliente desmarcou"></textarea>' +
      '<div class="acoes"><button class="b" data-fecha>Voltar</button><button class="b perigo" id="gv-cn-ok">Cancelar gravação</button></div>');
    m.querySelector('#gv-cn-ok').onclick = async () => {
      const bt = m.querySelector('#gv-cn-ok'); bt.disabled = true;
      try {
        const r = await B7.Save.acao(() => B7.DB.gravacaoCancelar(S.id, m.querySelector('#gv-cn-motivo').value.trim()));
        m.fechar(); B7.UI.toast('Gravação cancelada.');
        if (r && r.evento_id && B7.DB.cancelarEventoGoogle) {
          try { await B7.DB.cancelarEventoGoogle(r.evento_id, r.ocorrencia_id); }
          catch (e) { B7.UI.toast('Cancelada no B7, mas não deu pra cancelar no Google: ' + (e.message || ''), { tempo: 8000 }); }
        }
        recarregarGravacao();
      } catch (e) { bt.disabled = false; }
    };
  }

  /* campos do mês de referência — mês + ano, nunca um dia */
  function camposMes(ano, mes, prefixo) {
    const hoje = new Date();
    const a0 = hoje.getFullYear() - 1, a1 = hoje.getFullYear() + 2;
    const anos = []; for (let a = Math.min(a0, ano || a0); a <= Math.max(a1, ano || a1); a++) anos.push(a);
    return '<div class="gv-mes-campos">' +
      '<select class="campo" id="' + prefixo + '-mes" aria-label="Mês de referência"><option value="">Mês</option>' +
        MESES.map((n, i) => '<option value="' + (i + 1) + '"' + (mes === i + 1 ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
      '<select class="campo" id="' + prefixo + '-ano" aria-label="Ano de referência">' +
        anos.map(a => '<option value="' + a + '"' + ((ano || hoje.getFullYear()) === a ? ' selected' : '') + '>' + a + '</option>').join('') + '</select>' +
    '</div>';
  }

  async function modalEditar() {
    const g = S.g;
    let vms = [];
    try { vms = (await B7.DB.listarVideomakers()) || []; } catch (e) {}
    const m = B7.UI.modal('<h3>Detalhes da gravação</h3>' +
      '<label class="rot" for="gv-ed-nome">Nome da gravação</label><input class="campo" id="gv-ed-nome" data-foco value="' + esc(g.nome || '') + '">' +
      '<label class="rot">Mês de referência <span class="leve">— obrigatório</span></label>' + camposMes(g.competencia_ano, g.competencia_mes, 'gv-ed') +
      '<p class="fraca">É o mês de produção a que a gravação pertence — pode ser diferente do dia em que ela acontece.</p>' +
      '<label class="rot" for="gv-ed-vm">Responsável (videomaker)</label><select class="campo" id="gv-ed-vm"><option value="">Sem responsável</option>' +
        vms.map(v => '<option value="' + esc(v.id) + '"' + (v.id === g.videomaker_id ? ' selected' : '') + '>' + esc(v.nome) + '</option>').join('') + '</select>' +
      '<label class="rot" for="gv-ed-local">Local <span class="leve">— opcional</span></label><input class="campo" id="gv-ed-local" value="' + esc(g.local || '') + '">' +
      '<div class="ajuda erro-txt" id="gv-ed-erro"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" id="gv-ed-ok">Salvar</button></div>');
    m.querySelector('#gv-ed-ok').onclick = async () => {
      const nome = m.querySelector('#gv-ed-nome').value.trim();
      const mes = +m.querySelector('#gv-ed-mes').value, ano = +m.querySelector('#gv-ed-ano').value;
      const erro = m.querySelector('#gv-ed-erro');
      if (!nome) { erro.textContent = 'Dê um nome para a gravação.'; return; }
      if (!mes || !ano) { erro.textContent = 'Escolha o mês de referência.'; return; }
      const patch = { nome, competencia_mes: mes, competencia_ano: ano,
        videomaker_id: m.querySelector('#gv-ed-vm').value || null, local: m.querySelector('#gv-ed-local').value.trim() };
      const bt = m.querySelector('#gv-ed-ok'); bt.disabled = true;
      try {
        await B7.Save.acao(() => B7.DB.atualizarGravacao(S.id, patch), 'Gravação atualizada');
        m.fechar(); recarregarGravacao();
      } catch (e) { bt.disabled = false; erro.textContent = e.message || ''; }
    };
  }

  return { abrir, rotuloSituacao, chipSituacao, camposMes, mesRef, SITUACAO, googleAposAgendar };
})();
