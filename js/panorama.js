/* =====================================================================
   PANORAMA — o raio-X do mês por cliente (Kevin, 08/10/2026)
   Substitui a antiga Central B7, que era uma tela de contadores que
   ninguém abria. Responde UMA pergunta: "como está cada cliente este mês
   e quem está travado?".

   Uma linha por cliente, uma coluna por etapa do mês:
     Linha editorial · Roteiros · Gravação · Vídeos · Design ·
     Aprovação · Publicações
   Cada célula diz onde está (feito/total) e tem um de cinco estados:
     vazio (não começou) · andamento · atenção · atraso · concluído.

   Os números vêm de UMA função do banco (panorama_mes), que respeita as
   regras de acesso de quem abre: cada pessoa só recebe o que já pode
   ler em cada módulo. Nada é gravado aqui.

   A rota continua sendo "#/" (a mesma da antiga Central); designer e
   videomaker têm casas próprias e não passam por aqui (js/app.js).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Panorama = (function () {
  const esc = s => B7.UI.esc(s);
  const painel = () => document.getElementById('painel-dashboard');
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const agora = new Date();
  let S = { ano: agora.getFullYear(), mes: agora.getMonth() + 1, filtro: 'todos', busca: '', ordem: 'atencao', dados: null, dir: 0, tudo: false };

  const sv = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const IC = {
    linha: sv('<rect x="3.5" y="4.5" width="17" height="15" rx="3.6"/><path d="M7.6 9.6h.01M7.6 14.4h.01M11 9.6h5.5M11 14.4h5.5"/>'),
    roteiros: sv('<path d="M7 3.5h6.1a2 2 0 0 1 1.4.6l4.4 4.4a2 2 0 0 1 .6 1.4V18a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 18V6A2.5 2.5 0 0 1 7 3.5z"/><path d="M8.5 12.6h7M8.5 16.2h4.5"/>'),
    gravacoes: sv('<rect x="3.5" y="4.5" width="17" height="15.5" rx="3.2"/><path d="M3.5 9.6h17M8.4 4.8L6.8 9.4M13.2 4.8l-1.6 4.6M18 4.8l-1.6 4.6"/>'),
    video: sv('<rect x="2.5" y="6.5" width="12.5" height="11" rx="3.1"/><path d="M15 10.7l4.8-3a.8.8 0 0 1 1.2.7v7.2a.8.8 0 0 1-1.2.7l-4.8-3z"/>'),
    design: sv('<rect x="3.5" y="4.5" width="17" height="15" rx="3.6"/><path d="M4.6 16.4l4-4a1.5 1.5 0 0 1 2.1 0l2.3 2.3 1.6-1.6a1.5 1.5 0 0 1 2.1 0l2.7 2.7M15.4 9.2h.01"/>'),
    aprovacoes: sv('<circle cx="12" cy="12" r="8.6"/><path d="M8.2 12.3l2.6 2.6 5-5.4"/>'),
    publicacoes: sv('<rect x="3.5" y="4.5" width="17" height="16" rx="3.6"/><path d="M3.5 9.5h17M8 2.8v3M16 2.8v3"/><rect x="9.8" y="12.3" width="4.4" height="4.4" rx="1.3"/>'),
    esq: sv('<path d="M15 6l-6 6 6 6"/>'), dir: sv('<path d="M9 6l6 6-6 6"/>'),
    lupa: sv('<circle cx="10.8" cy="10.8" r="6.8"/><path d="M20 20l-4.3-4.3"/>'),
    ok: sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    alerta: sv('<path d="M10.7 4.7a1.5 1.5 0 0 1 2.6 0l7.5 13.1a1.5 1.5 0 0 1-1.3 2.2h-15a1.5 1.5 0 0 1-1.3-2.2z"/><path d="M12 9.6V14M12 17h.01"/>'),
    seta: sv('<path d="M9 6l6 6-6 6"/>')
  };
  const ETAPAS = [
    ['linha', 'Linha'], ['roteiros', 'Roteiros'], ['gravacoes', 'Gravação'], ['video', 'Vídeos'],
    ['design', 'Design'], ['aprovacoes', 'Aprovação'], ['publicacoes', 'Publicações']
  ];

  /* ------------------------------------------------------------ leitura
     Cada célula vira { estado, valor, sub, pct } — a mesma regra serve à
     tabela, aos cartões do celular e aos totais do topo. */
  const dia = iso => { const p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; };
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
  function celula(c, k) {
    const v = c[k];
    if (k === 'aprovacoes') {
      const n = Number(v) || 0;
      return n ? { estado: 'atencao', valor: String(n), sub: n === 1 ? 'aguardando' : 'aguardando', pct: null }
               : { estado: 'vazio', valor: '', sub: 'nada pendente', pct: null };
    }
    if (!v || !Number(v.total === undefined ? 1 : v.total)) {
      if (k === 'linha' && v) { /* linha existe mesmo sem conteúdos */ } else return { estado: 'vazio', valor: '', sub: k === 'linha' ? 'sem linha' : 'nada no mês', pct: null };
    }
    if (k === 'linha') {
      const t = Number(v.total_conteudos) || 0, e = Number(v.total_estruturados) || 0;
      /* aprovada: o que importa é que está fechada — mostra o tamanho dela, não "0/22" */
      if (v.status === 'Aprovada') return { estado: 'ok', valor: t ? String(t) : '', sub: 'aprovada', pct: 1 };
      return { estado: 'andamento', valor: t ? e + '/' + t : '', sub: t ? 'estruturados' : 'em criação', pct: t ? e / t : 0 };
    }
    if (k === 'roteiros') {
      const t = v.total, g = v.gravados;
      if (g >= t) return { estado: 'ok', valor: g + '/' + t, sub: 'gravados', pct: 1 };
      return { estado: 'andamento', valor: g + '/' + t, sub: v.prontos ? plural(v.prontos, 'pronto', 'prontos') : 'gravados', pct: g / t };
    }
    if (k === 'gravacoes') {
      const t = v.total, g = v.gravadas;
      if (!t) return { estado: 'vazio', valor: '', sub: 'nada no mês', pct: null };
      if (g >= t) return { estado: 'ok', valor: g + '/' + t, sub: t === 1 ? 'gravada' : 'gravadas', pct: 1 };
      if (v.atrasadas) return { estado: 'atraso', valor: g + '/' + t, sub: 'data passou', pct: g / t };
      if (v.marcadas) return { estado: 'andamento', valor: g + '/' + t, sub: v.proxima ? 'dia ' + dia(v.proxima) : 'marcada', pct: g / t };
      return { estado: 'atencao', valor: g + '/' + t, sub: 'sem data', pct: g / t };
    }
    if (k === 'video') {
      const t = v.total, e = v.entregues;
      if (e >= t) return { estado: 'ok', valor: e + '/' + t, sub: 'entregues', pct: 1 };
      if (v.atrasados) return { estado: 'atraso', valor: e + '/' + t, sub: plural(v.atrasados, 'atrasado', 'atrasados'), pct: e / t };
      return { estado: 'andamento', valor: e + '/' + t, sub: v.aprovacao ? v.aprovacao + ' em aprovação' : (v.correcao ? v.correcao + ' em correção' : 'entregues'), pct: e / t };
    }
    if (k === 'design') {
      const t = v.total, f = v.finalizados;
      if (f >= t) return { estado: 'ok', valor: f + '/' + t, sub: 'finalizadas', pct: 1 };
      if (v.atrasados) return { estado: 'atraso', valor: f + '/' + t, sub: plural(v.atrasados, 'atrasada', 'atrasadas'), pct: f / t };
      return { estado: 'andamento', valor: f + '/' + t, sub: v.revisao ? v.revisao + ' em revisão' : 'finalizadas', pct: f / t };
    }
    /* publicacoes */
    const t = v.total, p = v.publicados;
    if (p >= t) return { estado: 'ok', valor: p + '/' + t, sub: 'publicadas', pct: 1 };
    if (v.atrasados) return { estado: 'atraso', valor: p + '/' + t, sub: plural(v.atrasados, 'atrasada', 'atrasadas'), pct: p / t };
    return { estado: 'andamento', valor: p + '/' + t, sub: v.programados ? v.programados + ' programadas' : 'publicadas', pct: p / t };
  }
  function ler(c) {
    const cels = {}; let soma = 0, n = 0, atraso = 0, atencao = 0, ok = 0, vivos = 0;
    ETAPAS.forEach(([k]) => {
      const x = celula(c, k); cels[k] = x;
      if (x.estado !== 'vazio') vivos++;
      if (x.estado === 'atraso') atraso++;
      if (x.estado === 'atencao') atencao++;
      if (x.estado === 'ok') ok++;
      if (x.pct !== null && x.pct !== undefined) { soma += x.pct; n++; }
    });
    const estado = atraso ? 'atraso' : atencao ? 'atencao' : !vivos ? 'vazio' : (n && ok === n ? 'ok' : 'andamento');
    return { c, cels, estado, pct: n ? soma / n : 0, etapas: n, atraso, atencao };
  }

  /* ------------------------------------------------------------- tela */
  function mesRotulo() { return MESES[S.mes - 1] + ' de ' + S.ano; }
  const ehMesAtual = () => S.ano === agora.getFullYear() && S.mes === agora.getMonth() + 1;

  /* --- Espectro: quatro cartões do mês, a tabela "cliente a cliente" e a coluna do que espera ação.
     Tudo sai do mesmo panorama_mes: nada é inventado aqui. */
  const num = v => Number(v) || 0;
  const ROT_ESTADO = { atraso: 'Atrasado', atencao: 'Atenção', andamento: 'Em dia', ok: 'Entregue', vazio: 'Sem movimento' };
  const ROT_ETAPA = { linha: 'Linha editorial', roteiros: 'Roteiros', gravacoes: 'Gravação', video: 'Edição', design: 'Design', aprovacoes: 'Aprovação', publicacoes: 'Publicações' };
  function totais(linhas) {
    const t = { n: { atraso: 0, atencao: 0, andamento: 0, ok: 0, vazio: 0 }, soma: 0, com: 0, atrasados: 0, cliAtraso: 0, aprov: 0, cliAprov: 0, pub: 0, pubTotal: 0 };
    linhas.forEach(l => {
      const c = l.c; t.n[l.estado]++; if (l.etapas) { t.soma += l.pct; t.com++; }
      const a = num(c.video && c.video.atrasados) + num(c.design && c.design.atrasados) + num(c.publicacoes && c.publicacoes.atrasados) + num(c.gravacoes && c.gravacoes.atrasadas);
      t.atrasados += a; if (l.atraso) t.cliAtraso++;
      const ap = num(c.aprovacoes); t.aprov += ap; if (ap) t.cliAprov++;
      t.pub += num(c.publicacoes && c.publicacoes.publicados); t.pubTotal += num(c.publicacoes && c.publicacoes.total);
    });
    return t;
  }
  /* o que espera ação: cada etapa em atraso ou pedindo atenção, cliente a cliente */
  function esperando(linhas) {
    const peso = { atraso: 0, atencao: 1 }, itens = [];
    linhas.forEach(l => ETAPAS.forEach(([k]) => {
      const x = l.cels[k], c = l.c; if (x.estado !== 'atraso' && x.estado !== 'atencao') return;
      let tit, sub, ic = IC[k], tom = x.estado === 'atraso' ? 'erro' : 'ambar';
      if (k === 'aprovacoes') { tit = plural(num(c.aprovacoes), 'peça em aprovação', 'peças em aprovação'); sub = 'Aguardando aprovação'; tom = 'violeta'; }
      else if (k === 'gravacoes') { tit = x.estado === 'atraso' ? 'Gravação com data vencida' : 'Gravação sem data'; sub = 'Gravações · ' + x.valor + ' gravadas'; }
      else if (k === 'video') { tit = plural(num(c.video.atrasados), 'vídeo atrasado', 'vídeos atrasados'); sub = 'Edição · ' + x.valor + ' entregues'; ic = IC.alerta; }
      else if (k === 'design') { tit = plural(num(c.design.atrasados), 'arte atrasada', 'artes atrasadas'); sub = 'Design · ' + x.valor + ' finalizadas'; ic = IC.alerta; }
      else { tit = plural(num(c.publicacoes.atrasados), 'publicação atrasada', 'publicações atrasadas'); sub = 'Publicações · ' + x.valor + ' publicadas'; ic = IC.alerta; }
      itens.push({ id: c.id, tit: tit + ' · ' + (c.nome || ''), sub, ic, tom, p: peso[x.estado] });
    }));
    return itens.sort((a, b) => a.p - b.p);
  }

  function cartoesHTML(todas) {
    const t = totais(todas), esp = esperando(todas).length;
    const pct = t.pubTotal ? Math.round(t.pub / t.pubTotal * 100) : 0;
    const cartao = (cor, rot, valor, sub) => '<div class="pano-kpi pano-kpi-' + cor + '"><i class="pano-kpi-luz" aria-hidden="true"></i>' +
      '<div class="pano-kpi-tx"><p class="pano-kpi-rot">' + rot + '</p><p class="pano-kpi-n">' + valor + '</p><p class="pano-kpi-sub">' + esc(sub) + '</p></div></div>';
    const n = v => '<span data-conta="' + v + '">0</span>';
    return '<section class="pano-kpis" aria-label="Resumo do mês">' +
      cartao('coral', 'Atrasados', n(t.atrasados), t.cliAtraso ? plural(t.cliAtraso, 'cliente com peça vencida', 'clientes com peça vencida') : 'Nenhum cliente com peça vencida') +
      cartao('roxo', 'Em aprovação', n(t.aprov), t.aprov ? 'Aguardando retorno · ' + plural(t.cliAprov, 'cliente', 'clientes') : 'Nada aguardando aprovação') +
      cartao('violeta', 'Esperando você', n(esp), 'Atrasos, aprovações e gravações sem data') +
      cartao('matriz', 'Mês entregue', n(pct) + '%', t.pubTotal ? t.pub + ' de ' + plural(t.pubTotal, 'publicação', 'publicações') : 'Nenhuma publicação no mês') +
    '</section>';
  }

  function pendente(l) {
    const c = l.c, p = [];
    if (l.estado === 'atraso') {
      if (num(c.video && c.video.atrasados)) p.push(plural(num(c.video.atrasados), 'vídeo', 'vídeos'));
      if (num(c.design && c.design.atrasados)) p.push(plural(num(c.design.atrasados), 'arte', 'artes'));
      if (num(c.publicacoes && c.publicacoes.atrasados)) p.push(plural(num(c.publicacoes.atrasados), 'publicação', 'publicações'));
      if (l.cels.gravacoes.estado === 'atraso') p.push('Gravação');
      return p.slice(0, 2).join(' · ');
    }
    if (l.estado === 'atencao') {
      if (l.cels.aprovacoes.estado === 'atencao') p.push(plural(num(c.aprovacoes), 'peça', 'peças'));
      if (l.cels.gravacoes.estado === 'atencao') p.push('Gravação');
      return p.join(' · ');
    }
    if (l.estado === 'andamento') { const e = ETAPAS.find(([k]) => l.cels[k].estado === 'andamento'); return e ? ROT_ETAPA[e[0]] : '—'; }
    return '—';
  }
  function linhaHTML(l, i) {
    const c = l.c, pct = Math.round(l.pct * 100);
    let tom = { atraso: 'erro', atencao: 'ambar', andamento: 'ok', ok: 'ok', vazio: 'neutro' }[l.estado], rot = ROT_ESTADO[l.estado];
    if (l.estado === 'atencao') { if (l.cels.aprovacoes.estado === 'atencao') { tom = 'violeta'; rot = 'Em aprovação'; } else rot = 'Sem data'; }
    const pecas = num(c.publicacoes && c.publicacoes.total);
    const sub = [typeof c.servico === 'string' && c.servico ? c.servico : '', pecas ? plural(pecas, 'publicação', 'publicações') : (l.estado === 'vazio' ? 'nada no mês' : '')].filter(Boolean).join(' · ');
    const dica = ETAPAS.map(([k, r]) => r + ': ' + (l.cels[k].valor ? l.cels[k].valor + ' ' : '') + l.cels[k].sub).join(' · ');
    let h = 0; String(c.nome || '').split('').forEach(ch => { h = (h * 31 + ch.charCodeAt(0)) % 997; });
    return '<a class="pano-linha pano-e-' + l.estado + '" href="#/cliente/' + esc(c.id) + '" style="--i:' + Math.min(i, 24) + '" data-nome="' + esc((c.nome || '').toLowerCase()) + '" title="' + esc(dica) + '">' +
      '<div class="pano-quem">' + B7.UI.avatarCliente(c.nome, c.logo_url, 'pano-av pano-av-' + (h % 4)) +
        '<div class="pano-quem-tx"><b>' + esc(c.nome) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div></div>' +
      '<div class="pano-prog" data-rot="Andamento">' + (l.etapas
        ? '<span class="pano-trilho"><i style="--p:' + pct + '%"></i></span><b>' + pct + '%</b>'
        : '<span class="pano-trilho"></span><b>—</b>') + '</div>' +
      '<div class="pano-sit"><span class="pano-pill pano-t-' + tom + '"><i></i>' + rot + '</span></div>' +
      '<span class="pano-pend">' + esc(pendente(l)) + '</span>' +
      '<span class="pano-ir" aria-hidden="true">' + IC.seta + '</span>' +
    '</a>';
  }

  function ladoHTML(todas) {
    const t = totais(todas), itens = esperando(todas), media = t.com ? Math.round(t.soma / t.com * 100) : 0;
    const resumo = [t.com ? 'Média de ' + media + '% nas etapas' : '', t.n.atraso ? t.n.atraso + ' com atraso' : '', t.n.ok ? plural(t.n.ok, 'entregue', 'entregues') : ''].filter(Boolean).join(' · ');
    const rel = B7.Relatorio && B7.Auth.ehEquipe && B7.Auth.ehEquipe(), vis = S.tudo ? itens : itens.slice(0, 4);
    return '<aside class="pano-lado">' +
      '<div class="pano-mes-cartao"><i class="pano-mes-luz" aria-hidden="true"></i><div class="pano-mes-tx">' +
        '<p class="pano-mes-rot">ANDAMENTO DO MÊS</p>' +
        '<p class="pano-mes-tit">' + plural(t.com, 'cliente com movimento', 'clientes com movimento') + '</p>' +
        '<p class="pano-mes-sub">' + esc('de ' + todas.length + ' em ' + mesRotulo() + (resumo ? ' · ' + resumo : '')) + '</p>' +
        (rel || B7.Retro ? '<div class="pano-mes-acoes">' +
          /* zzz254: entregas, prazos e aprovações do mês, por cliente e por pessoa */
          (rel ? '<button type="button" class="pano-mes-bt-claro" data-relatorio>' + IC.roteiros + 'Relatório do mês</button>' : '') +
          /* zzz280: o mês contado em histórias */
          (B7.Retro ? '<button type="button" class="pano-mes-bt-vidro" data-retro>Retrospectiva</button>' : '') + '</div>' : '') +
      '</div></div>' +
      '<div class="pano-cartao pano-espera"><div class="pano-espera-cab"><p class="pano-cartao-tit">Esperando você</p><span class="pano-pill pano-t-violeta"><i></i>' + itens.length + '</span></div>' +
        (itens.length
          ? '<div class="pano-espera-lista">' + vis.map(x => '<a class="pano-item" href="#/cliente/' + esc(x.id) + '"><span class="pano-item-ic pano-t-' + x.tom + '">' + x.ic + '</span>' +
              '<span class="pano-item-tx"><b>' + esc(x.tit) + '</b><small>' + esc(x.sub) + '</small></span></a>').join('') + '</div>' +
            (itens.length > 4 ? '<button type="button" class="pano-ver-tudo" data-tudo>' + (S.tudo ? 'Ver menos' : 'Ver tudo') + '</button>' : '')
          : '<p class="pano-espera-nada">Nada esperando ação neste mês.</p>') +
      '</div></aside>';
  }

  function ordenar(linhas) {
    const peso = { atraso: 0, atencao: 1, andamento: 2, ok: 3, vazio: 4 };
    const az = (a, b) => String(a.c.nome || '').localeCompare(String(b.c.nome || ''), 'pt-BR');
    return linhas.slice().sort(S.ordem === 'az' ? az : (a, b) => peso[a.estado] - peso[b.estado] || a.pct - b.pct || az(a, b));
  }
  function filtrar(linhas) {
    const t = S.busca.trim().toLowerCase();
    return linhas.filter(l => (S.filtro === 'todos' || l.estado === S.filtro) && (!t || String(l.c.nome || '').toLowerCase().includes(t)));
  }

  function corpoHTML() {
    const todas = (S.dados || []).map(ler);
    const vis = ordenar(filtrar(todas));
    const filtro = (k, rot) => '<button type="button" data-filtro="' + k + '" class="' + (S.filtro === k ? 'on' : '') + '" aria-pressed="' + (S.filtro === k) + '">' + rot + '</button>';
    const ordem = (k, rot) => '<button type="button" data-ordem="' + k + '" class="' + (S.ordem === k ? 'on' : '') + '" title="Ordenar por ' + rot.toLowerCase() + '">' + rot + '<i aria-hidden="true"></i></button>';
    const cab = '<div class="pano-cab"><span>' + ordem('az', 'Cliente') + '</span><span>Andamento do mês</span><span>' + ordem('atencao', 'Situação') + '</span><span>Pendente</span><span></span></div>';
    return cartoesHTML(todas) +
      '<div class="pano-grade">' +
        '<div class="pano-cartao pano-tabela">' +
          '<div class="pano-tabela-cab"><p class="pano-cartao-tit">O mês, cliente a cliente</p>' +
            '<label class="pano-busca">' + IC.lupa + '<input type="search" id="pan-busca" placeholder="Buscar cliente" value="' + esc(S.busca) + '" aria-label="Buscar cliente"></label>' +
            '<div class="pano-seg" role="group" aria-label="Filtro">' +
              filtro('todos', 'Todos') + filtro('atraso', 'Com atraso') + filtro('atencao', 'Atenção') + filtro('andamento', 'Em dia') + filtro('ok', 'Entregue') + filtro('vazio', 'Sem movimento') +
            '</div></div>' +
          cab +
          '<div class="pano-linhas">' + (vis.length ? vis.map(linhaHTML).join('')
            : '<div class="pano-sem">' + (todas.length ? 'Nenhum cliente nesse recorte. Tire o filtro ou a busca para ver todos.' : 'Nenhum cliente por aqui ainda.') + '</div>') + '</div>' +
        '</div>' +
        ladoHTML(todas) +
      '</div>';
  }

  function esqueleto() {
    return '<div class="pano-kpis">' + Array.from({ length: 4 }).map(() => '<div class="pano-kpi pano-carrega"></div>').join('') + '</div>' +
      '<div class="pano-grade"><div class="pano-cartao pano-tabela pano-carrega"></div><div class="pano-lado"><div class="pano-mes-cartao pano-carrega"></div><div class="pano-cartao pano-carrega"></div></div></div>';
  }

  function saudacao() {
    const d = new Date(), h = d.getHours(), u = (B7.Auth.usuario && B7.Auth.usuario()) || {};
    const nome = String(u.nome || '').trim().split(/\s+/)[0];
    return (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite') + (nome ? ', ' + nome : '') + ' · ' + d.getDate() + ' de ' + MESES[d.getMonth()].toLowerCase();
  }
  function topoHTML() {
    return '<header class="pano-topo">' +
      '<p class="pano-sauda">' + esc(saudacao()) + '</p>' +
      /* zzz283: os atalhos do mês (relatório, retrospectiva) ficam à parte, no cartão "Andamento do mês" */
      '<div class="pano-mes" role="group" aria-label="Mês">' +
        '<h1 id="pan-mes-rot" aria-live="polite">' + esc(mesRotulo()) + '</h1>' +
        '<button type="button" class="pano-mes-bt" data-mes="-1" aria-label="Mês anterior">' + IC.esq + '</button>' +
        '<button type="button" class="pano-mes-bt" data-mes="1" aria-label="Próximo mês">' + IC.dir + '</button>' +
        '<button type="button" class="pano-hoje" data-mes="0"' + (ehMesAtual() ? ' disabled' : '') + '>Este mês</button>' +
      '</div></header>';
  }

  /* números que sobem contando (só leitura visual; o valor real já está no aria/texto final) */
  function contar(raiz) {
    const calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('modo-leve');
    raiz.querySelectorAll('[data-conta]').forEach(el => {
      const fim = Number(el.dataset.conta) || 0;
      if (calmo || !fim || document.hidden) { el.textContent = fim; return; }
      const t0 = performance.now(), dur = 900;
      const passo = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(fim * e); if (k < 1) requestAnimationFrame(passo); };
      requestAnimationFrame(passo);
      setTimeout(() => { el.textContent = fim; }, dur + 200);   /* rede de segurança */
    });
  }

  function pintarCorpo(animar) {
    const cx = document.getElementById('pan-corpo'); if (!cx) return;
    cx.innerHTML = corpoHTML();
    cx.classList.remove('pan-entra', 'pan-entra-esq', 'pan-entra-dir');
    if (animar) { void cx.offsetWidth; cx.classList.add(S.dir < 0 ? 'pan-entra-esq' : S.dir > 0 ? 'pan-entra-dir' : 'pan-entra'); }
    contar(cx);
    ligarCorpo(cx);
  }
  function ligarCorpo(cx) {
    const troca = () => { const al = cx.querySelector('.pano-linhas'); if (al) { al.classList.remove('pano-troca'); void al.offsetWidth; al.classList.add('pano-troca'); } };
    cx.querySelectorAll('[data-filtro]').forEach(b => b.onclick = () => {
      S.filtro = S.filtro === b.dataset.filtro ? 'todos' : b.dataset.filtro; S.dir = 0; pintarCorpo(false); troca();
    });
    cx.querySelectorAll('[data-ordem]').forEach(b => b.onclick = () => { if (S.ordem === b.dataset.ordem) return; S.ordem = b.dataset.ordem; S.dir = 0; pintarCorpo(false); troca(); });
    const bs = cx.querySelector('#pan-busca');
    if (bs) bs.oninput = () => {
      S.busca = bs.value;
      const todas = (S.dados || []).map(ler), vis = ordenar(filtrar(todas));
      const al = cx.querySelector('.pano-linhas');
      if (al) al.innerHTML = vis.map(linhaHTML).join('') || '<div class="pano-sem">Nenhum cliente com esse nome.</div>';
      if (al) al.classList.add('pano-sem-anim');
    };
    const rel = cx.querySelector('[data-relatorio]'); if (rel) rel.onclick = () => B7.Relatorio.abrir(S.ano, S.mes);
    const rt = cx.querySelector('[data-retro]'); if (rt) rt.onclick = () => B7.Retro.abrir(S.ano, S.mes);
    const tudo = cx.querySelector('[data-tudo]'); if (tudo) tudo.onclick = () => { S.tudo = !S.tudo; S.dir = 0; pintarCorpo(false); };
  }

  let pedido = 0;
  async function carregar(animar) {
    const meu = ++pedido;
    const cx = document.getElementById('pan-corpo'); if (!cx) return;
    if (!S.dados) cx.innerHTML = esqueleto(); else cx.classList.add('pan-buscando');
    let dados;
    try { dados = await B7.DB.panoramaMes(S.ano, S.mes); }
    catch (e) {
      if (meu !== pedido) return;
      cx.classList.remove('pan-buscando');
      cx.innerHTML = '<div class="estado-b7 pan-nada"><b>Não foi possível carregar o Panorama.</b><p>' + esc((e && e.message) || 'Tente de novo em instantes.') + '</p>' +
        '<div class="acoes"><button type="button" class="b contorno" id="pan-tentar">Tentar de novo</button></div></div>';
      const t = document.getElementById('pan-tentar'); if (t) t.onclick = () => carregar(true);
      return;
    }
    if (meu !== pedido || !document.getElementById('pan-corpo')) return;
    S.dados = Array.isArray(dados) ? dados : [];
    cx.classList.remove('pan-buscando');
    pintarCorpo(animar);
  }

  async function abrir() {
    B7.Dashboard.marcarNav('#/');
    B7.Rota.titulo(['Panorama']);
    painel().innerHTML = '<div class="conteudo entra pan">' + topoHTML() + '<div id="pan-corpo" class="pan-corpo"></div></div>';
    const raiz = painel().querySelector('.pan');
    raiz.querySelectorAll('[data-mes]').forEach(b => b.onclick = () => {
      const d = Number(b.dataset.mes);
      if (d === 0) { S.dir = (agora.getFullYear() * 12 + agora.getMonth() + 1) > (S.ano * 12 + S.mes) ? 1 : -1; S.ano = agora.getFullYear(); S.mes = agora.getMonth() + 1; }
      else { S.dir = d; let m = S.mes + d, a = S.ano; if (m < 1) { m = 12; a--; } if (m > 12) { m = 1; a++; } S.mes = m; S.ano = a; }
      const rot = document.getElementById('pan-mes-rot');
      if (rot) { rot.textContent = mesRotulo(); rot.classList.remove('pano-vira'); void rot.offsetWidth; rot.classList.add('pano-vira'); }
      const hj = raiz.querySelector('.pano-hoje'); if (hj) hj.disabled = ehMesAtual();
      carregar(true);
    });
    S.dir = 0;
    await carregar(true);
  }

  /* ler/ETAPAS: o Painel (js/painel.js) resume a agência com a MESMA regra */
  return { abrir, ler, ETAPAS };
})();
