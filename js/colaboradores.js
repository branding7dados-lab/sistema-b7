/* =====================================================================
   EQUIPE NA GESTÃO (zzz302) — só administrador

   O que cada pessoa da equipe entregou no período, o que está atrasado e
   o que precisa de atenção. Uma leitura só (gestao_colaboradores, no
   banco) que conta vídeo, design, gravações e itens gravados.

     • No alto: o período e os números da equipe (entregas, pontualidade
       dos vídeos, atrasos agora e o que está sem responsável);
     • Colaboradores × Parceiros B7: um cartão por pessoa com o que
       entregou, a barra das últimas 8 semanas e o que está na mão dela;
     • Tocar no cartão abre o detalhe: o que pede atenção (atrasado, vence,
       parado, standby), o resto da fila e as próximas gravações.

   Mora em Gestão → Equipe (js/gestao.js chama montar()); a tela de
   Usuários leva direto para uma pessoa com #/gestao?aba=equipe&p=<id>.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Colaboradores = (function () {
  const esc = s => B7.UI.esc(s);
  const ROT_FUNCAO = { videomaker: 'Vídeo', designer: 'Design', coordenador: 'Coordenação' };
  const ROT_MOTIVO = { atrasado: 'Atrasado', vence: 'Vence logo', parado: 'Parado', standby: 'Standby', sem_prazo: 'Sem prazo', ok: 'No prazo' };
  const ROT_STATUS = {
    pendente: 'A fazer', em_edicao: 'Em edição', correcao: 'Em correção', standby: 'Standby',
    aguardando_producao: 'A fazer', em_criacao: 'Em criação', ajustes: 'Ajustes', ajustes_cliente: 'Ajustes do cliente'
  };
  const PERIODOS = [['mes', 'Este mês'], ['ant', 'Mês passado'], ['30', 'Últimos 30 dias'], ['semana', 'Esta semana']];
  const estado = { periodo: 'mes', grupo: 'colaborador', dados: null, pedida: null };

  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function intervalo(p) {
    const h = new Date(); h.setHours(12, 0, 0, 0);
    if (p === 'ant') return [iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), iso(new Date(h.getFullYear(), h.getMonth(), 0))];
    if (p === '30') { const d = new Date(h); d.setDate(d.getDate() - 29); return [iso(d), iso(h)]; }
    if (p === 'semana') { const d = new Date(h); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [iso(d), iso(h)]; }
    return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), iso(h)];
  }
  const dataBR = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) : '';
  const diaSemana = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '') : '';
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

  /* números de uma pessoa, já somados vídeo + design */
  function resumo(p) {
    const v = p.video || {}, d = p.design || {}, g = p.gravacoes || {};
    const entregues = (v.entregues || 0) + (d.entregues || 0);
    const naMao = (v.na_mao || 0) + (d.na_mao || 0);
    const atrasados = (v.atrasados || 0) + (d.atrasados || 0);
    const pend = p.pendencias || [];
    const atencao = pend.filter(x => x.motivo !== 'ok' && x.motivo !== 'sem_prazo');
    const pontual = v.entregues ? Math.round(100 * (v.no_prazo || 0) / v.entregues) : null;
    const situacao = atrasados ? 'atrasado' : atencao.length ? 'atencao' : naMao ? 'emdia' : 'livre';
    const movimento = entregues || naMao || (g.feitas || 0) || (g.itens || 0) || pend.length || (g.proximas || []).length ||
      (v.com_cliente || 0) || (d.com_cliente || 0);
    return { v, d, g, entregues, naMao, atrasados, atencao, pontual, situacao, movimento, comCliente: (v.com_cliente || 0) + (d.com_cliente || 0),
      ajustes: (v.ajustes || 0) + (d.ajustes || 0) };
  }
  const ROT_SITUACAO = { atrasado: 'Com atraso', atencao: 'Pede atenção', emdia: 'Em dia', livre: 'Sem fila' };

  function tags(p) {
    const fs = [p.funcao].concat(p.funcoes_adicionais || []).filter((f, i, a) => f && ROT_FUNCAO[f] && a.indexOf(f) === i);
    return (p.grupo === 'parceiro' ? '<span class="cl-tag parceiro">Parceiro B7</span>' : '') +
      fs.map(f => '<span class="cl-tag ' + esc(f) + '">' + ROT_FUNCAO[f] + '</span>').join('');
  }
  function linhaStatus(p) {
    if (p.ausencia) return '<span class="cl-fora">' + esc(B7.Equipe && B7.Equipe.rotuloAusencia ? B7.Equipe.rotuloAusencia(p.ausencia)
      : 'Ausente' + (p.ausencia.fim ? ' até ' + dataBR(p.ausencia.fim) : '')) + '</span>';
    return p.visto ? '<span>Visto ' + esc(B7.UI.quando(p.visto)) + '</span>' : '<span>Nunca acessou</span>';
  }
  function barras(serie) {
    const s = serie || [], max = Math.max(1, ...s);
    return '<div class="cl-serie" role="img" aria-label="Entregas nas últimas 8 semanas: ' + s.join(', ') + '">' +
      s.map((n, i) => '<i class="' + (i === s.length - 1 ? 'atual' : '') + '" style="--h:' + Math.max(n ? 8 : 3, Math.round(100 * n / max)) + '%" title="' +
        (i === s.length - 1 ? 'Esta semana' : (s.length - 1 - i) + ' semana' + (s.length - 1 - i === 1 ? '' : 's') + ' atrás') + ': ' + n + '"></i>').join('') + '</div>';
  }

  /* ---------------------------------------------------------------- tela */
  async function montar(cx, params) {
    if (params && params.get) {
      if (params.get('p')) estado.pedida = params.get('p');
      if (params.get('per') && PERIODOS.some(x => x[0] === params.get('per'))) estado.periodo = params.get('per');
    }
    cx.innerHTML = B7.UI.skeleton('lista', { n: 4 });
    const [de, ate] = intervalo(estado.periodo);
    try { estado.dados = await B7.DB.rpc('gestao_colaboradores', { p_de: de, p_ate: ate }); }
    catch (e) {
      cx.innerHTML = '<div class="cb-aviso erro">' + esc(e.message || 'Não foi possível carregar a equipe.') + ' <button class="cb-link" data-de-novo>Tentar de novo</button></div>';
      cx.querySelector('[data-de-novo]').onclick = () => montar(cx);
      return;
    }
    if (!cx.isConnected) return;
    pintar(cx);
    if (estado.pedida) {
      const p = (estado.dados.pessoas || []).find(x => x.id === estado.pedida);
      estado.pedida = null;
      if (p) detalhe(p);
    }
  }

  function pintar(cx) {
    const D = estado.dados || {}, todas = D.pessoas || [];
    const doGrupo = todas.filter(p => estado.grupo === 'todos' || p.grupo === estado.grupo);
    const R = new Map(todas.map(p => [p.id, resumo(p)]));
    const soma = (l, f) => l.reduce((n, p) => n + f(R.get(p.id)), 0);
    const ent = soma(doGrupo, r => r.entregues), vEnt = soma(doGrupo, r => r.v.entregues || 0), vPrazo = soma(doGrupo, r => r.v.no_prazo || 0);
    const sd = D.sem_dono || {}, atr = soma(doGrupo, r => r.atrasados), semDono = (sd.video || 0) + (sd.design || 0);
    const ativos = doGrupo.filter(p => R.get(p.id).movimento);
    const parados = doGrupo.filter(p => !R.get(p.id).movimento);
    /* quem pede mais atenção primeiro, depois quem entregou mais */
    const peso = { atrasado: 0, atencao: 1, emdia: 2, livre: 3 };
    ativos.sort((a, b) => peso[R.get(a.id).situacao] - peso[R.get(b.id).situacao] || R.get(b.id).entregues - R.get(a.id).entregues ||
      String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    const nGrupo = g => todas.filter(p => g === 'todos' || p.grupo === g).length;

    cx.innerHTML = '<div class="cl">' +
      '<div class="cl-barra">' +
        '<div class="cl-seg" role="tablist" aria-label="Quem mostrar">' +
          [['colaborador', 'Colaboradores'], ['parceiro', 'Parceiros B7'], ['todos', 'Todos']].map(([k, r]) =>
            '<button type="button" role="tab" data-cl-grupo="' + k + '" class="' + (estado.grupo === k ? 'on' : '') + '" aria-selected="' + (estado.grupo === k) + '">' +
              r + '<b>' + nGrupo(k) + '</b></button>').join('') +
        '</div>' +
        '<div class="cl-per" role="group" aria-label="Período">' + PERIODOS.map(([k, r]) =>
          '<button type="button" data-cl-per="' + k + '" class="' + (estado.periodo === k ? 'on' : '') + '">' + r + '</button>').join('') + '</div>' +
      '</div>' +
      '<p class="cl-periodo">De ' + dataBR(D.de) + ' a ' + dataBR(D.ate) + ' · atrasos e fila contam o que está aberto hoje.</p>' +
      '<div class="gt-kpis cl-kpis">' +
        '<div class="gt-kpi"><b>' + ent + '</b><span>entregas no período</span><small>vídeos e peças de design</small></div>' +
        '<div class="gt-kpi ' + (vEnt && 100 * vPrazo / vEnt < 70 ? 'atencao' : vEnt ? 'ok' : '') + '"><b>' + (vEnt ? Math.round(100 * vPrazo / vEnt) + '%' : '—') + '</b>' +
          '<span>vídeos no prazo</span><small>' + (vEnt ? vPrazo + ' de ' + vEnt + ' entregues até o prazo' : 'nenhum vídeo entregue') + '</small></div>' +
        '<div class="gt-kpi ' + (atr ? 'erro' : 'ok') + '"><b>' + atr + '</b><span>atrasados agora</span><small>' + (atr ? 'prazo vencido e ainda na mão' : 'nada atrasado 🎉') + '</small></div>' +
        '<button type="button" class="gt-kpi ' + (semDono ? 'atencao' : 'ok') + '" data-ir="' + (sd.video ? '#/video' : '#/design') + '"><b>' + semDono + '</b>' +
          '<span>sem responsável</span><small>' + (semDono ? 'vídeos e peças esperando alguém' : 'tudo tem dono') + '</small></button>' +
      '</div>' +
      (ativos.length ? '<div class="cl-grade">' + ativos.map((p, i) => cartao(p, R.get(p.id), i)).join('') + '</div>'
        : '<div class="estado-b7"><b>Ninguém com trabalho neste período.</b><p>Troque o período ou o grupo lá em cima.</p></div>') +
      (parados.length ? '<p class="cl-sem">Sem entregas nem fila no período: ' + parados.map(p => esc(p.nome)).join(', ') + '.</p>' : '') +
    '</div>';

    cx.querySelectorAll('[data-cl-grupo]').forEach(b => b.onclick = () => { estado.grupo = b.dataset.clGrupo; pintar(cx); });
    cx.querySelectorAll('[data-cl-per]').forEach(b => b.onclick = () => { estado.periodo = b.dataset.clPer; montar(cx); });
    cx.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { location.hash = b.dataset.ir; });
    cx.querySelectorAll('[data-cl-pessoa]').forEach(el => {
      const abrirP = () => detalhe(todas.find(p => p.id === el.dataset.clPessoa));
      el.onclick = abrirP;
      el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirP(); } };
    });
  }

  function cartao(p, r, i) {
    const pill = (n, rot, cls) => n ? '<span class="cl-pil ' + (cls || '') + '"><b>' + n + '</b>' + rot + '</span>' : '';
    return '<article class="cl-card ' + r.situacao + '" tabindex="0" role="button" data-cl-pessoa="' + esc(p.id) + '" style="--i:' + Math.min(i, 12) + '"' +
        ' aria-label="Ver as entregas de ' + esc(p.nome) + '">' +
      '<header class="cl-topo">' +
        '<span class="cl-av">' + B7.UI.avatarPessoa(p, 'lu-avatar') + '</span>' +
        '<div class="cl-id"><b>' + esc(p.nome) + '</b><small>' + linhaStatus(p) + '</small></div>' +
        '<span class="cl-sit ' + r.situacao + '">' + ROT_SITUACAO[r.situacao] + '</span>' +
      '</header>' +
      '<div class="cl-tags">' + tags(p) + '</div>' +
      '<div class="cl-meio">' +
        '<div class="cl-num"><b>' + r.entregues + '</b><span>' + (r.entregues === 1 ? 'entrega' : 'entregas') +
          (r.pontual != null ? ' · <em class="' + (r.pontual < 70 ? 'baixo' : '') + '">' + r.pontual + '% no prazo</em>' : '') + '</span></div>' +
        barras(p.serie) +
      '</div>' +
      '<div class="cl-pils">' +
        pill(r.atrasados, 'atrasado' + (r.atrasados === 1 ? '' : 's'), 'erro') +
        pill(Math.max(0, r.atencao.length - r.atrasados), r.atencao.length - r.atrasados === 1 ? 'pede atenção' : 'pedem atenção', 'ambar') +
        pill(r.naMao, 'na mão', '') +
        pill(r.comCliente, 'com o cliente', 'leve') +
        pill(r.ajustes, r.ajustes === 1 ? 'ajuste pedido' : 'ajustes pedidos', 'leve') +
        pill(r.g.feitas || 0, (r.g.feitas === 1 ? 'gravação' : 'gravações'), 'leve') +
        pill(r.g.itens || 0, (r.g.itens === 1 ? 'item gravado' : 'itens gravados'), 'leve') +
        (!r.naMao && !r.atrasados && !r.comCliente ? '<span class="cl-pil leve">fila vazia</span>' : '') +
      '</div>' +
    '</article>';
  }

  /* ------------------------------------------------------------ detalhe */
  function detalhe(p) {
    if (!p) return;
    const r = resumo(p), D = estado.dados || {};
    const pend = p.pendencias || [];
    const atencao = pend.filter(x => x.motivo !== 'ok' && x.motivo !== 'sem_prazo');
    const resto = pend.filter(x => x.motivo === 'ok' || x.motivo === 'sem_prazo');
    const prox = r.g.proximas || [];
    const quando = x => x.motivo === 'atrasado' ? 'venceu ' + dataBR(x.prazo) + (x.dias_atraso > 0 ? ' · há ' + plural(x.dias_atraso, 'dia', 'dias') : '')
      : x.motivo === 'vence' ? 'vence ' + (x.dias_atraso === 0 ? 'hoje' : x.dias_atraso === -1 ? 'amanhã' : dataBR(x.prazo))
      : x.motivo === 'parado' ? 'sem mexer há ' + plural(x.dias_parado, 'dia', 'dias')
      : x.prazo ? 'prazo ' + dataBR(x.prazo) : 'sem prazo';
    const item = x => '<button type="button" class="cl-item ' + esc(x.motivo) + '" data-ir="' + esc(x.link) + '">' +
      '<span class="cl-item-ic ' + esc(x.tipo) + '" aria-hidden="true">' + (x.tipo === 'video' ? '▶' : '◆') + '</span>' +
      '<span class="cl-item-tx"><b>' + esc(x.titulo) + '</b><small>' + esc([x.cliente, ROT_STATUS[x.status] || x.status, quando(x)].filter(Boolean).join(' · ')) + '</small></span>' +
      (x.motivo !== 'ok' ? '<span class="cl-mot ' + esc(x.motivo) + '">' + ROT_MOTIVO[x.motivo] + '</span>' : '') + '</button>';
    /* o que fazer agora, em frases curtas */
    const dicas = [];
    if (r.atrasados) {
      const velho = Math.max(0, ...pend.filter(x => x.motivo === 'atrasado').map(x => x.dias_atraso || 0));
      dicas.push(plural(r.atrasados, 'entrega atrasada', 'entregas atrasadas') + (velho ? ' — a mais antiga há ' + plural(velho, 'dia', 'dias') : '') + '. Converse sobre prioridade ou passe parte da fila.');
    }
    const parados = pend.filter(x => x.motivo === 'parado').length;
    if (parados) dicas.push(plural(parados, 'item parado', 'itens parados') + ' há mais de 7 dias sem mudar de etapa.');
    const vence = pend.filter(x => x.motivo === 'vence').length;
    if (vence) dicas.push(plural(vence, 'item vence', 'itens vencem') + ' em até 2 dias.');
    if (pend.filter(x => x.motivo === 'sem_prazo').length) dicas.push(plural(pend.filter(x => x.motivo === 'sem_prazo').length, 'vídeo está', 'vídeos estão') + ' sem prazo definido.');
    if (r.ajustes >= 3) dicas.push(plural(r.ajustes, 'ajuste pedido', 'ajustes pedidos') + ' no período — vale olhar o que está voltando.');
    if (!dicas.length) dicas.push(r.naMao ? 'Tudo em dia. Nada atrasado nem parado.' : 'Sem nada na mão agora — dá para receber trabalho novo.');

    const num = (n, rot, sub, cls) => '<div class="cl-dnum ' + (cls || '') + '"><b>' + n + '</b><span>' + rot + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>';
    const m = B7.UI.modal(
      '<div class="cl-det">' +
        '<header class="cl-det-topo"><span class="cl-av g">' + B7.UI.avatarPessoa(p, 'lu-avatar') + '</span>' +
          '<div><h3>' + esc(p.nome) + '</h3><div class="cl-tags">' + tags(p) + '<span class="cl-sit ' + r.situacao + '">' + ROT_SITUACAO[r.situacao] + '</span></div>' +
          '<small class="cl-det-sub">' + linhaStatus(p) + ' · de ' + dataBR(D.de) + ' a ' + dataBR(D.ate) + '</small></div>' +
          '<button class="ico cl-x" data-fecha aria-label="Fechar">✕</button></header>' +
        '<div class="cl-dnums">' +
          num(r.entregues, 'entregues', [r.v.entregues ? plural(r.v.entregues, 'vídeo', 'vídeos') : '', r.d.entregues ? plural(r.d.entregues, 'peça', 'peças') : ''].filter(Boolean).join(' · ')) +
          num(r.pontual == null ? '—' : r.pontual + '%', 'vídeos no prazo', r.v.entregues ? (r.v.no_prazo || 0) + ' de ' + r.v.entregues : '', r.pontual != null && r.pontual < 70 ? 'ambar' : '') +
          num(r.atrasados, 'atrasados', '', r.atrasados ? 'erro' : '') +
          num(r.naMao, 'na mão', r.comCliente ? r.comCliente + ' com o cliente' : '') +
          ((r.g.feitas || r.g.itens) ? num(r.g.feitas || 0, 'gravações', r.g.itens ? plural(r.g.itens, 'item gravado', 'itens gravados') : '') : '') +
        '</div>' +
        '<div class="cl-dicas"><b>O que precisa</b><ul>' + dicas.map(d => '<li>' + esc(d) + '</li>').join('') + '</ul></div>' +
        (atencao.length ? '<section class="cl-sec"><h4>Pede atenção <span>' + atencao.length + '</span></h4>' + atencao.map(item).join('') + '</section>' : '') +
        (resto.length ? '<section class="cl-sec"><h4>Na fila <span>' + resto.length + '</span></h4>' + resto.slice(0, 15).map(item).join('') +
          (resto.length > 15 ? '<p class="cl-mais">e mais ' + (resto.length - 15) + '…</p>' : '') + '</section>' : '') +
        (prox.length ? '<section class="cl-sec"><h4>Próximas gravações</h4>' + prox.map(g =>
          '<button type="button" class="cl-item" data-ir="#/gravacao/' + esc(g.id) + '"><span class="cl-item-ic grav" aria-hidden="true">●</span>' +
          '<span class="cl-item-tx"><b>' + esc(g.nome || 'Gravação') + '</b><small>' + esc([g.cliente, diaSemana(g.data)].filter(Boolean).join(' · ')) + '</small></span></button>').join('') + '</section>' : '') +
        '<div class="acoes cl-det-acoes">' +
          (r.v.na_mao || r.v.entregues ? '<button class="b contorno" data-ir="#/video">Abrir Vídeo</button>' : '') +
          (r.d.na_mao || r.d.entregues ? '<button class="b contorno" data-ir="#/design">Abrir Design</button>' : '') +
          '<button class="b pri" data-fecha>Fechar</button></div>' +
      '</div>', { larga: true, extra: 'cl-modal' });
    m.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => {
      const f = m.querySelector('[data-fecha]'); if (f) f.click();
      location.hash = b.dataset.ir;
    });
  }

  return { montar, _resumo: resumo };
})();
