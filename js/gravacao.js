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
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.9" style="fill:currentColor;stroke:none"/><circle cx="12" cy="12" r="1.9" style="fill:currentColor;stroke:none"/><circle cx="18.5" cy="12" r="1.9" style="fill:currentColor;stroke:none"/></svg>',
    lapis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    impressora: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9V4h10v5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2"/><path d="M7 14h10v6H7z"/></svg>',
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
  const horaTx = g => g.hora_inicio ? hhmm(g.hora_inicio) + (g.hora_fim ? '–' + hhmm(g.hora_fim) : '') : '';
  function diasAte(iso) {
    if (!iso) return null;
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    const h = new Date(); const hoje = new Date(h.getFullYear(), h.getMonth(), h.getDate());
    return Math.round((new Date(a, m - 1, d) - hoje) / 864e5);
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
    const ed = podeEditar();
    const dias = diasAte(g.data_gravacao);
    const ativa = !concluida && !cancelada;
    /* quando: "Hoje", "Amanhã", "em 5 dias" ou o aviso de data que passou */
    let rel = '';
    if (g.data_gravacao && ativa) {
      if (dias === 0) rel = '<em class="gv-rel hoje">Hoje</em>';
      else if (dias === 1) rel = '<em class="gv-rel">Amanhã</em>';
      else if (dias > 1 && dias <= 14) rel = '<em class="gv-rel">em ' + dias + ' dias</em>';
      else if (dias < 0) rel = '<em class="gv-rel passou">a data passou</em>';
    }
    /* fato: vira botão para quem pode mudar — clicar no que se quer mudar */
    const fato = (cls, ic, rot, valor, extra, acao) => {
      const miolo = ic + '<span><small>' + rot + '</small><b>' + valor + '</b>' + (extra || '') + '</span>';
      return acao && ed
        ? '<button type="button" class="gv-fato ' + cls + '" data-gv="' + acao + '" title="Alterar">' + miolo + '<i class="gv-fato-ed">' + IC.lapis + '</i></button>'
        : '<span class="gv-fato ' + cls + '">' + miolo + '</span>';
    };
    const dataValor = g.data_gravacao ? esc(dataLonga(g.data_gravacao)) + (horaTx(g) ? ' · ' + esc(horaTx(g)) : '') : 'Sem data';
    const dataExtra = (g.data_gravacao && !horaTx(g) ? '<i class="gv-fato-nota">horário a definir</i>' : '') + rel;
    /* ação principal muda com o momento da gravação */
    const principal = !ed || !ativa ? '' :
      !g.data_gravacao ? 'agendar' :
      (dias != null && dias <= 0) || (S.itens.length && S.itens.every(i => i.gravado)) ? 'concluir' : 'agendar';
    const btAgendar = ed && !concluida
      ? '<button type="button" class="b ' + (principal === 'agendar' ? 'pri' : 'contorno') + '" data-gv="agendar">' + IC.agenda +
          '<span>' + (g.data_gravacao ? (cancelada ? 'Reativar com nova data' : 'Remarcar') : 'Marcar data') + '</span></button>' : '';
    const btConcluir = ed && ativa
      ? '<button type="button" class="b ' + (principal === 'concluir' ? 'pri' : 'contorno') + '" data-gv="concluir">' + IC.check + '<span>Concluir gravação</span></button>' : '';
    /* aberta de dentro do cliente (?de=cliente): o voltar leva de volta
       para as Gravações DELE, não para a lista geral */
    const voltar = document.querySelector('#gv-raiz > .gv-voltar');
    if (voltar && new URLSearchParams(location.hash.split('?')[1] || '').get('de') === 'cliente' && g.client_id) {
      voltar.href = '#/cliente/' + g.client_id + '/gravacoes';
      voltar.innerHTML = IC.voltar + esc(g.cliente_nome || 'Cliente');
    }
    cx.innerHTML =
      '<div class="gv-cab-topo">' +
        '<a class="gv-cli" href="#/cliente/' + esc(g.client_id) + '">' + B7.UI.avatarCliente(g.cliente_nome, g.cliente_logo_url, 'p') +
          '<span>' + esc(g.cliente_nome || '') + '</span></a>' +
      '</div>' +
      '<div class="gv-titulo"><h1 class="gv-nome">' + esc(g.nome) + '</h1>' + chipSituacao(sit) + '</div>' +
      '<div class="gv-fatos">' +
        fato('gv-fato-mes' + (mes ? '' : ' falta'), IC.mes, 'Mês de referência', mes ? esc(mes) : 'Não definido', '', 'editar') +
        fato('gv-fato-data' + (dias != null && dias < 0 && ativa ? ' atrasada' : ''), IC.agenda, sit === 'Remarcada' ? 'Nova data' : 'Data da gravação', dataValor, dataExtra, concluida ? '' : 'agendar') +
        fato('gv-fato-resp' + (g.videomaker_nome ? '' : ' vazio'), IC.pessoa, 'Responsável', esc(g.videomaker_nome || g.videomaker || 'Ninguém ainda'), '', 'editar') +
      '</div>' +
      (!mes && ed ? '<div class="gv-aviso"><span>Esta gravação é anterior ao mês de referência. Defina o mês para ela aparecer na produção certa.</span>' +
        '<button type="button" class="b fina contorno" data-gv="editar">Definir mês</button></div>' : '') +
      '<div class="gv-acoes">' +
        (principal === 'concluir' ? btConcluir + btAgendar : btAgendar + btConcluir) +
        '<a class="b contorno" href="#/gravacao/' + esc(g.id) + '/roteiros">' + TIPO.roteiro.ic + '<span>Abrir roteiros</span></a>' +
        '<button type="button" class="b contorno ico gv-mais-acoes" data-gv="menu" aria-label="Mais ações" aria-haspopup="menu">' + IC.menu + '</button>' +
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
      if (it.roteiro_status && !it.gravado) sub.push(it.roteiro_status);
      const casa = it.roteiro_gravacao_id || S.id;
      if (casa !== S.id) sub.push('escrito em outra gravação');
      acao = '<a class="b fina gv-it-abrir" href="#/gravacao/' + esc(casa) + '?roteiro=' + esc(it.roteiro_id) + '">Abrir roteiro' + IC.seta + '</a>';
    } else if (it.tipo === 'referencia') {
      titulo = it.titulo;
      let host = ''; try { host = new URL(it.url).hostname.replace(/^www\./, ''); } catch (e) {}
      if (host) sub.push(host);
      acao = '<a class="b fina gv-it-abrir" href="' + esc(B7.UI.linkExterno(it.url)) + '" target="_blank" rel="noopener noreferrer nofollow">Abrir referência' + IC.abrir + '</a>';
    } else if (it.tipo === 'conteudo') {
      titulo = it.conteudo_titulo || 'Conteúdo sem título';
      if (it.conteudo_tipo) sub.push(it.conteudo_tipo);
      if (it.conteudo_data_postagem) sub.push('postagem ' + B7.UI.dataBR(it.conteudo_data_postagem));
      if (it.conteudo_linha_id) acao = '<a class="b fina gv-it-abrir" href="#/linha/' + esc(it.conteudo_linha_id) + '?conteudo=' + esc(it.conteudo_id) + '">Abrir conteúdo' + IC.seta + '</a>';
    } else {
      titulo = it.titulo;
    }
    const gravadoTx = it.gravado ? 'Gravado' + (it.gravado_por_nome ? ' por ' + it.gravado_por_nome.split(' ')[0] : '') : '';
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
          (gravadoTx ? '<span class="gv-it-estado">' + IC.check + esc(gravadoTx) + '</span>' : '') + '</span>' +
      '</div>' +
      '<div class="gv-it-acoes">' + acao +
        (podeEditar() ? '<button type="button" class="b ico fina gv-it-mais" data-item-menu="' + esc(it.id) + '" aria-label="Opções do item" aria-haspopup="menu">' + IC.menu + '</button>' : '') +
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
      (e === 'ok' && total ? '<span class="gv-progresso' + (feitos === total ? ' completo' : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + feitos + '" aria-label="' + feitos + ' de ' + total + ' itens gravados">' +
        '<i style="--p:' + Math.round(feitos / total * 100) + '%"></i><span><b>' + feitos + '</b> de ' + total + ' gravados</span></span>' : '') +
      /* teleprompter: só quando há roteiro na lista — lê o roteiro canônico, sem cópia */
      (e === 'ok' && S.itens.some(i => i.tipo === 'roteiro' && i.roteiro_id) && window.B7.Teleprompter
        ? '<button type="button" class="b fina contorno gv-tele" data-gv="teleprompter" title="Mostra os roteiros desta gravação para leitura, em tela cheia">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="12" rx="2.5"/><path d="M7.5 9.5h9M7.5 12.5h6M9 20h6"/></svg>' +
            '<span>Teleprompter</span></button>' : '') +
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
    const ed = podeEditar();
    cx.innerHTML = '<div class="gv-sec-cab"><h2 id="gv-t-det">Detalhes</h2>' +
        (ed ? '<button type="button" class="b fina contorno" data-gv="editar">' + IC.lapis + '<span>Editar</span></button>' : '') + '</div>' +
      '<dl class="gv-dets">' +
        linha('Local', g.local ? esc(g.local)
          : (ed ? '<button type="button" class="gv-det-add" data-gv="editar">Adicionar local</button>' : '<span class="gv-det-vazio">—</span>')) +
        linha('Roteiros', B7.UI.chipStatus(g.status)) +
        (g.created_at ? linha('Criada', esc(B7.UI.dataBR(String(g.created_at).slice(0, 10)))) : '') +
        (g.concluida_em ? linha('Concluída', esc(B7.UI.dataBR(String(g.concluida_em).slice(0, 10)))) : '') +
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
  /* "gravado" e "desmarcado" do mesmo item com poucos minutos de
     diferença se anulam — só poluem a leitura. O registro completo
     continua no banco e aparece em "Ver histórico completo". */
  function histLimpo(lista) {
    if (S.histTudo) return lista;
    const par = { item_gravado: 'item_desmarcado', item_desmarcado: 'item_gravado' };
    const chave = h => { const d = h.dados || {}; return (d.item_id || '') + '|' + (d.tipo || '') + '|' + (d.titulo || ''); };
    const fora = new Set();
    for (let i = 0; i < lista.length; i++) {
      const a = lista[i]; if (fora.has(i) || !par[a.tipo]) continue;
      for (let j = i + 1; j < lista.length; j++) {
        const b = lista[j]; if (fora.has(j) || !par[b.tipo]) continue;
        if (chave(b) !== chave(a)) continue;
        if (b.tipo === par[a.tipo] && Math.abs(new Date(a.criado_em) - new Date(b.criado_em)) <= 30 * 60e3) { fora.add(i); fora.add(j); }
        break;
      }
    }
    return lista.filter((_, i) => !fora.has(i));
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
      const limpo = histLimpo(S.hist);
      const LIM = 6, mostrar = S.histTudo ? limpo : limpo.slice(0, LIM);
      const escondidos = S.hist.length - mostrar.length;
      const lista = S.hist.length
        ? '<ol class="gv-hist-lista">' + mostrar.map(h => '<li class="t-' + esc(h.tipo) + '"><b>' + esc(ROTULO_HIST[h.tipo] || h.tipo) + '</b>' +
            (textoHist(h) ? '<span>' + esc(textoHist(h)) + '</span>' : '') +
            '<small>' + esc((h.ator_nome ? h.ator_nome.split(' ')[0] + ' · ' : '') + B7.UI.quando(h.criado_em)) + '</small></li>').join('') + '</ol>' +
          (escondidos > 0 && !S.histTudo ? '<button type="button" class="gv-hist-mais" data-gv="hist-tudo">Ver histórico completo (' + S.hist.length + ')</button>' : '') +
          (S.histTudo && limpo.length < S.hist.length ? '<p class="gv-hist-nota">Mostrando tudo, inclusive marcações desfeitas logo em seguida.</p>' : '')
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
        if (a === 'teleprompter') return abrirTeleprompter();
        if (a === 'menu') return menuGravacao(b);
        if (a === 'recarregar-itens') return carregarItens(geracao);
        if (a === 'recarregar-hist') return carregarHistorico(geracao);
        if (a === 'hist-tudo') { S.histTudo = true; return pintarHistorico(); }
      };
    });
  }

  /* Teleprompter desta gravação: os roteiros da lista, na ordem dela.
     "Marcar como gravado", lá dentro, é o MESMO check desta lista (mesma
     função do banco), e só acontece se a pessoa pedir. */
  function abrirTeleprompter() {
    const sessao = S;
    B7.Teleprompter.abrirDaGravacao(S.g, S.itens, {
      podeMarcar: podeMarcar(),
      marcar: async itemId => {
        const it = sessao.itens.find(x => x.id === itemId);
        if (!it || it.gravado) return;
        await B7.Save.acao(() => B7.DB.gravacaoItemMarcar(itemId, true));
        it.gravado = true; it.gravado_por_nome = (B7.Auth.usuario() || {}).nome || '';
        if (it.tipo === 'roteiro') it.roteiro_status = 'Gravado';
        if (S === sessao) { pintarItens(); carregarHistorico(geracao); }
      }
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
    if (podeEditar()) ops.push({ rotulo: 'Editar detalhes', dica: 'nome, mês de referência, responsável, local', ic: IC.lapis, fazer: modalEditar });
    ops.push({ rotulo: 'Imprimir roteiros', dica: 'versão para levar na gravação', ic: IC.impressora, fazer: () => { location.hash = '#/gravacao/' + g.id + '/roteiros?imprimir=1'; } });
    if (B7.Perm && B7.Perm.podeRota('calendario')) ops.push({ rotulo: 'Ver no calendário', dica: 'a semana desta gravação, com o histórico de datas', ic: IC.agenda, fazer: () => { location.hash = '#/calendario?v=semana&tipo=gravacoes&d=' + (g.data_gravacao ? String(g.data_gravacao).slice(0, 10) : (B7.UI.hojeISO ? B7.UI.hojeISO() : '')); } });
    if (podeEditar() && sit !== 'Gravada' && sit !== 'Cancelada') ops.push({ rotulo: 'Cancelar gravação', dica: 'nada é apagado — fica no histórico', ic: IC.x, perigo: true, separar: true, fazer: modalCancelar });
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
      '<div class="sub">' + (ref ? 'Um link para a equipe se inspirar na hora de gravar.' : 'Algo para gravar sem roteiro: depoimento, bastidor, improviso.') + '</div>' +
      '<div class="mb"><label class="rot" for="gv-il-titulo">' + (ref ? 'NOME' : 'O QUE VAI SER GRAVADO') + '</label>' +
      '<input class="campo" id="gv-il-titulo" data-foco maxlength="140" value="' + esc(it ? it.titulo || '' : '') + '" placeholder="' +
        (ref ? 'Ex.: Trend recepcionista POV' : 'Ex.: Depoimento da Dra. Ana') + '"></div>' +
      (ref ? '<div class="mb"><label class="rot" for="gv-il-url">LINK</label><input class="campo" id="gv-il-url" type="url" inputmode="url" autocomplete="off" ' +
        'placeholder="https://www.instagram.com/…" value="' + esc(it ? it.url || '' : '') + '"></div>' : '') +
      '<div class="mb"><label class="rot" for="gv-il-obs">OBSERVAÇÃO <span class="leve">— opcional</span></label>' +
      '<textarea class="campo" id="gv-il-obs" rows="3" placeholder="' + (ref ? 'Ex.: usar a mesma entrada, adaptando para odontologia' : 'Ex.: perguntar sobre o novo equipamento') + '">' +
        esc(it ? it.observacao || '' : '') + '</textarea></div>' +
      '<div class="ajuda erro-txt" id="gv-il-erro" role="alert"></div>' +
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
    const hoje = new Date(), iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const m = B7.UI.modal('<h3>' + (remarcar ? (g.situacao === 'Cancelada' ? 'Reativar com nova data' : 'Remarcar gravação') : 'Marcar data da gravação') + '</h3>' +
      '<div class="sub">' + esc(g.cliente_nome || '') + ' · ' + esc(g.nome || '') +
        (remarcar ? '<br>Hoje está em <b>' + esc(quandoGravacao(g)) + '</b>. Essa data não some: fica no histórico e no calendário como "Remarcada".' : '') + '</div>' +
      '<div class="mb"><label class="rot" for="gv-ag-data">' + (remarcar ? 'NOVA DATA' : 'DATA') + '</label>' +
        '<input class="campo" type="date" id="gv-ag-data" data-foco min="' + iso(new Date(hoje.getFullYear() - 1, 0, 1)) + '"></div>' +
      '<div class="mb"><label class="rot">HORÁRIO <span class="leve">— opcional</span></label>' +
        '<div class="gv-horas"><input class="campo" type="time" id="gv-ag-ini" aria-label="Início" value="' + esc(hhmm(g.hora_inicio)) + '">' +
        '<span aria-hidden="true">até</span><input class="campo" type="time" id="gv-ag-fim" aria-label="Fim" value="' + esc(hhmm(g.hora_fim)) + '"></div>' +
        '<div class="ajuda gv-ajuda">Sem horário, a gravação fica o dia todo no calendário e o evento do Google não é criado.</div></div>' +
      (remarcar ? '<div class="mb"><label class="rot" for="gv-ag-motivo">MOTIVO <span class="leve">— opcional</span></label>' +
        '<input class="campo" id="gv-ag-motivo" placeholder="Ex.: cliente pediu para mudar"></div>' : '') +
      (!g.competencia_ano ? '<p class="gv-ajuda">Defina também o mês de referência em "Editar detalhes".</p>' : '') +
      '<div class="ajuda erro-txt" id="gv-ag-erro" role="alert"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Voltar</button><button class="b pri" id="gv-ag-ok">' + (remarcar ? 'Salvar nova data' : 'Marcar data') + '</button></div>');
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
      '<div class="sub">Nada é apagado: a gravação, os itens e as datas continuam no histórico, marcados como cancelados. Dá para reativar depois com uma nova data.</div>' +
      '<div class="mb"><label class="rot" for="gv-cn-motivo">MOTIVO <span class="leve">— opcional</span></label>' +
      '<textarea class="campo" id="gv-cn-motivo" rows="3" data-foco placeholder="Ex.: cliente desmarcou"></textarea></div>' +
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

  /* atalhos "este mês / próximo mês": o caso comum em um toque. Disparam
     'change' nos selects, então quem escuta (sugestão pela data etc.)
     trata como escolha manual. */
  function atalhosMes(prefixo) {
    const h = new Date();
    const op = [[h.getFullYear(), h.getMonth() + 1], [h.getMonth() === 11 ? h.getFullYear() + 1 : h.getFullYear(), h.getMonth() === 11 ? 1 : h.getMonth() + 2]];
    const js = (a, m) => "var r=this.closest('.gv-mes-bloco')||document,M=r.querySelector('#" + prefixo + "-mes'),A=r.querySelector('#" + prefixo + "-ano');" +
      "if(![].some.call(A.options,function(o){return o.value=='" + a + "'}))A.insertAdjacentHTML('beforeend','<option>" + a + "</option>');" +
      "M.value='" + m + "';A.value='" + a + "';M.dispatchEvent(new Event('change',{bubbles:true}));A.dispatchEvent(new Event('change',{bubbles:true}));M.classList.remove('erro');";
    return '<div class="gv-mes-atalhos">' + op.map(([a, m], i) =>
      '<button type="button" class="gv-chip" data-a="' + a + '" data-m="' + m + '" onclick="' + js(a, m).replace(/"/g, '&quot;') + '">' + (i ? 'Próximo mês' : 'Este mês') + ' · ' + MESES[m - 1] + '</button>').join('') + '</div>';
  }

  /* campos do mês de referência — mês + ano, nunca um dia */
  function camposMes(ano, mes, prefixo) {
    const hoje = new Date();
    const a0 = hoje.getFullYear() - 1, a1 = hoje.getFullYear() + 2;
    const anos = []; for (let a = Math.min(a0, ano || a0); a <= Math.max(a1, ano || a1); a++) anos.push(a);
    return '<div class="gv-mes-bloco"><div class="gv-mes-campos">' +
      '<select class="campo" id="' + prefixo + '-mes" aria-label="Mês de referência"><option value="">Mês</option>' +
        MESES.map((n, i) => '<option value="' + (i + 1) + '"' + (mes === i + 1 ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
      '<select class="campo" id="' + prefixo + '-ano" aria-label="Ano de referência">' +
        anos.map(a => '<option value="' + a + '"' + ((ano || hoje.getFullYear()) === a ? ' selected' : '') + '>' + a + '</option>').join('') + '</select>' +
    '</div>' + atalhosMes(prefixo) + '</div>';
  }

  async function modalEditar() {
    const g = S.g;
    let vms = [];
    try { vms = (await B7.DB.listarVideomakers()) || []; } catch (e) {}
    const m = B7.UI.modal('<h3>Editar gravação</h3>' +
      '<div class="sub">' + esc(g.cliente_nome || '') + '</div>' +
      '<div class="mb"><label class="rot" for="gv-ed-nome">NOME DA GRAVAÇÃO</label><input class="campo" id="gv-ed-nome" data-foco value="' + esc(g.nome || '') + '"></div>' +
      '<div class="mb"><label class="rot">MÊS DE REFERÊNCIA <span class="leve">— obrigatório</span></label>' + camposMes(g.competencia_ano, g.competencia_mes, 'gv-ed') +
        '<div class="ajuda gv-ajuda">O mês de produção a que a gravação pertence. Pode ser diferente do dia em que ela acontece.</div></div>' +
      '<div class="gv-grid-2">' +
        '<div class="mb"><label class="rot" for="gv-ed-vm">RESPONSÁVEL</label><select class="campo" id="gv-ed-vm"><option value="">Sem responsável</option>' +
          vms.map(v => '<option value="' + esc(v.id) + '"' + (v.id === g.videomaker_id ? ' selected' : '') + '>' + esc(v.nome) + '</option>').join('') + '</select></div>' +
        '<div class="mb"><label class="rot" for="gv-ed-local">LOCAL <span class="leve">— opcional</span></label><input class="campo" id="gv-ed-local" placeholder="Ex.: consultório, estúdio B7" value="' + esc(g.local || '') + '"></div>' +
      '</div>' +
      '<div class="ajuda erro-txt" id="gv-ed-erro" role="alert"></div>' +
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
