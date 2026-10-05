/* =====================================================================
   PAINEL COMPOSTO (fase 4) — UM Painel para quem tem MAIS DE UMA função
   operacional (ex.: Videomaker + Designer, Coordenador + Videomaker).

   Não é um quarto Painel nem uma pilha dos três: cada domínio continua
   dono das suas regras (js/painel.js → vídeo, js/painel-coord.js →
   editorial, js/painel-design.js → design) e expõe um ADAPTADOR com as
   mesmas fontes e regras do Painel dele. Aqui só se COMPÕE:

     cabeçalho      → um só (funções reais; ação da função principal)
     4 KPIs         → Atrasadas · Vencem hoje · Em andamento · Próximos,
                      somando os domínios com a quebra "3 vídeo · 2 design";
                      clique → a lista canônica (se só um domínio conta e a
                      tela dele mostra exatamente o número) ou uma folha
                      com os itens agrupados por domínio
     atenção        → UMA lista: itens normalizados, prioridade global
                      (1 atraso/bloqueio · 2 pedido de correção/ajuste ·
                      3 hoje · 4 risco próximo · 5 revisão/ação pendente),
                      sem repetir o mesmo registro, até 5
     semana         → UMA semana; eventos dos domínios sem duplicar (a
                      mesma gravação chega pelo vídeo e pela coordenação);
                      o dia abre uma folha agrupada por domínio
     gráfico        → UM de cada vez: o da função principal, com seletor
                      discreto (preferência local "painel_grafico")
     próximos       → UMA lista cronológica curta, até 5

   Administrador não entra aqui como domínio: é acesso, não trabalho.
   Nada é gravado — tudo é derivado dos registros canônicos.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.PainelMulti = (function () {
  const U = () => B7.Painel.ui;
  const D = () => B7.Painel.ui.datas;
  const esc = s => B7.UI.esc(s);
  const painel = () => document.getElementById('painel-dashboard');
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

  const ADAPTADORES = {
    coordenador: () => B7.PainelCoord && B7.PainelCoord.adaptador,
    videomaker: () => B7.Painel && B7.Painel.adaptador,
    designer: () => B7.PainelDesign && B7.PainelDesign.adaptador
  };
  const MARCA = { video: 'Vídeo', design: 'Design', editorial: 'Editorial' };
  const UNIDADE = { video: ['vídeo', 'vídeos'], design: ['design', 'design'], editorial: ['editorial', 'editorial'] };
  const MAX_ATENCAO = 5, MAX_PROXIMOS = 5, MAX_FOLHA = 30;

  const IC_POST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 12.5h8M8 16h5"/></svg>';
  const IC_LINHA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5h14M5 9.5h14M5 14.5h9M5 19.5h6"/></svg>';
  const IC_PINCEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4.5l5 5L10 19H5v-5z"/><path d="M12.5 6.5l5 5"/></svg>';
  const IC_MAIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

  let ctx = null, ads = [], agendado = false;

  /* ------------------------------------------------------------ estado */
  const carregando = (a, fontes) => (fontes || a.fontes).some(f => a.estado(f) === 'carregando');
  const comErro = (a, fontes) => (fontes || a.fontes).filter(f => a.estado(f) === 'erro');
  const todosProntos = () => ads.every(a => !carregando(a));
  function agendar() {
    if (agendado) return;
    agendado = true;
    setTimeout(() => { agendado = false; pintar(); }, 0);
  }

  /* ---------------------------------------------------- folha (drill-down)
     Só um atalho de leitura: cada item leva ao registro canônico. */
  function abrirFolha(titulo, grupos) {
    const corpo = grupos.map(g =>
      '<section class="pnm-folha-grupo"><h4><span class="pnm-dom">' + esc(g.marca) + '</span>' +
        (g.href ? '<a class="pn-link" href="' + esc(g.href) + '">' + esc(g.rotuloLink || 'Abrir a lista') + U().IC.seta + '</a>' : '') + '</h4>' +
        g.itens.slice(0, MAX_FOLHA).map(it =>
          '<a class="pnm-folha-item" href="' + esc(it.href) + '"><b>' + esc(it.titulo) + '</b>' +
            (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</a>').join('') +
        (g.itens.length > MAX_FOLHA ? '<p class="pn-nota">+' + (g.itens.length - MAX_FOLHA) + ' — abra a lista para ver todos.</p>' : '') +
      '</section>').join('');
    const m = B7.UI.modal('<div class="tp-folha-cab"><h3>' + esc(titulo) + '</h3>' +
      '<button type="button" class="ico" data-fecha aria-label="Fechar">' +
      '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="tp-folha-corpo pnm-folha">' + (corpo || '<p class="pn-nota">Nada aqui.</p>') + '</div>', { classe: 'tp-folha pnm-folha-fundo' });
    m.querySelectorAll('a[href]').forEach(a => a.addEventListener('click', () => m.fechar()));
    const caixa = m.querySelector('.modal');
    if (caixa) { caixa.tabIndex = -1; caixa.setAttribute('aria-label', titulo); caixa.focus({ preventScroll: true }); }
    return m;
  }

  /* ================================================================ KPIs */
  const KPIS = [
    { tipo: 'atrasadas', rotulo: 'Atrasadas', tom: 'erro', vazio: 'nada atrasado' },
    { tipo: 'hoje', rotulo: 'Vencem hoje', tom: 'ambar', vazio: 'nada vence hoje' },
    { tipo: 'andamento', rotulo: 'Em andamento', tom: '', vazio: 'nada nas suas mãos agora' },
    { tipo: 'proximos', rotulo: 'Próximos', tom: '', vazio: 'nada nos próximos 7 dias' }
  ];
  const TIPO_PROX = { gravacao: ['gravação', 'gravações'], prazo: ['prazo', 'prazos'], publicacao: ['publicação', 'publicações'] };

  function montarKpi(def) {
    const partes = ads.map(a => ({ a, k: a.kpi(def.tipo) }));
    if (partes.some(p => carregando(p.a, p.k.fontes))) return { def, estado: 'carregando' };
    const validas = partes.filter(p => !comErro(p.a, p.k.fontes).length);
    const falhas = partes.filter(p => comErro(p.a, p.k.fontes).length).map(p => MARCA[p.a.dominio]);
    if (!validas.length) return { def, estado: 'erro' };
    let n, quebra, grupos;
    if (def.tipo === 'proximos') {
      /* a mesma gravação vem do vídeo e da coordenação: conta uma vez */
      const vistos = new Set(), todos = [];
      validas.forEach(p => p.k.itens.forEach(it => { if (!vistos.has(it.chave)) { vistos.add(it.chave); todos.push(Object.assign({ dom: p.a.dominio }, it)); } }));
      n = todos.length;
      const porTipo = {}; todos.forEach(it => { porTipo[it.tipo] = (porTipo[it.tipo] || 0) + 1; });
      quebra = ['gravacao', 'prazo', 'publicacao'].filter(t => porTipo[t]).map(t => plural(porTipo[t], TIPO_PROX[t][0], TIPO_PROX[t][1])).join(' · ');
      grupos = validas.map(p => ({ marca: MARCA[p.a.dominio], itens: todos.filter(it => it.dom === p.a.dominio) })).filter(g => g.itens.length)
        .map(g => Object.assign(g, { itens: g.itens.slice().sort((x, y) => String(x.dia).localeCompare(String(y.dia))) }));
    } else {
      n = validas.reduce((s, p) => s + p.k.n, 0);
      const mais = validas.some(p => p.k.mais);
      quebra = validas.filter(p => p.k.n).map(p => {
        const u = p.k.unidade || UNIDADE[p.a.dominio];
        return (p.k.mais ? p.k.n + '+' : p.k.n) + ' ' + (p.k.n === 1 ? u[0] : u[1]);
      }).join(' · ');
      if (mais) n = n + '+';
      grupos = validas.filter(p => p.k.n).map(p => ({ marca: MARCA[p.a.dominio], href: p.k.href, itens: p.k.itens }));
    }
    const comNum = validas.filter(p => (def.tipo === 'proximos' ? p.k.itens.length : p.k.n));
    /* link direto só quando UM domínio conta e a tela dele mostra
       exatamente esse número; senão, a folha com os itens */
    const direto = comNum.length === 1 && def.tipo !== 'proximos' ? comNum[0].k.href : null;
    return { def, estado: 'ok', n, quebra, falhas, grupos, direto };
  }

  function pintarKpis() {
    const cx = document.getElementById('pnm-kpis'); if (!cx) return;
    const ks = KPIS.map(montarKpi);
    cx.innerHTML = ks.map((k, i) => {
      if (k.estado !== 'ok') return U().kpi({ estado: k.estado, rotulo: k.def.rotulo });
      const vazio = !parseInt(k.n, 10);
      const sub = (vazio ? k.def.vazio : k.quebra) + (k.falhas.length ? ' · sem ' + k.falhas.join(' e ') : '');
      return U().kpi({ estado: 'ok', rotulo: k.def.rotulo, valor: k.n, tom: vazio ? '' : k.def.tom, sub,
        href: vazio ? null : (k.direto || '#pnm-kpi-' + i),
        aria: k.n + ' — ' + k.def.rotulo + (k.quebra ? ' (' + k.quebra + ')' : '') + (k.direto ? ' — abrir a lista' : ' — ver os itens') });
    }).join('');
    cx.querySelectorAll('a[href^="#pnm-kpi-"]').forEach(a => {
      const k = ks[Number(a.getAttribute('href').slice(9))];
      a.setAttribute('role', 'button'); a.setAttribute('aria-haspopup', 'dialog');
      a.addEventListener('click', e => { e.preventDefault(); abrirFolha(k.def.rotulo + ' · ' + k.n, k.grupos); });
    });
  }

  /* ============================================================ atenção
     Cada domínio devolve seus itens já com prioridade global (prio) e
     chave do registro; aqui só se junta, tira repetição (fica o motivo
     mais forte) e ordena: prioridade → data → ordem do domínio. */
  function itensAtencao() {
    const todos = [];
    ads.forEach((a, ia) => (comErro(a).length === a.fontes.length ? [] : a.atencao())
      .forEach((it, ii) => todos.push(Object.assign({ _ord: ia * 1000 + ii }, it))));
    const melhor = new Map();
    todos.forEach(it => {
      const c = it.chave || ('x' + it._ord);
      const atual = melhor.get(c);
      if (!atual || (it.prio || 9) < (atual.prio || 9)) melhor.set(c, it);
    });
    return [...melhor.values()].sort((x, y) => ((x.prio || 9) - (y.prio || 9)) ||
      String(x.dia || '9999').localeCompare(String(y.dia || '9999')) || (x._ord - y._ord));
  }
  function comDominio(it) {
    return Object.assign({}, it, { meta: '<span class="pnm-dom">' + esc(MARCA[it.dominio] || '') + '</span>' + (it.meta || '') });
  }
  function avisosFalha() {
    return ads.filter(a => comErro(a).length).map(a =>
      '<div class="pn-erro" role="alert"><span>Não foi possível carregar ' + (comErro(a).length === a.fontes.length ? 'seus dados' : 'parte dos seus dados') +
        ' de ' + esc(MARCA[a.dominio]) + '.</span>' +
      '<button type="button" class="b fina contorno" data-pnm-retentar="' + a.dominio + '">Tentar de novo</button></div>').join('');
  }
  function pintarAtencao() {
    const cx = document.getElementById('pnm-atencao'); if (!cx) return;
    let corpo;
    if (!todosProntos()) corpo = U().blocoCarregando(4);
    else {
      const itens = itensAtencao();
      const vis = itens.slice(0, MAX_ATENCAO), fora = itens.slice(MAX_ATENCAO);
      const foraPorDom = {}; fora.forEach(it => { foraPorDom[it.dominio] = (foraPorDom[it.dominio] || 0) + 1; });
      corpo = (itens.length
        ? '<div class="pn-att-lista">' + vis.map(comDominio).map(U().linhaAtencao).join('') + '</div>' +
          (fora.length ? '<p class="pn-nota">E mais ' + plural(fora.length, 'item', 'itens') + ' (' +
            esc(Object.keys(foraPorDom).map(d => foraPorDom[d] + ' de ' + MARCA[d].toLowerCase()).join(', ')) + ').</p>' : '')
        : U().blocoVazio('Tudo em dia por aqui.', 'Nada atrasado, nenhum ajuste pedido e nada vencendo agora.')) + avisosFalha();
    }
    cx.innerHTML = '<div class="pn-sec-cab"><h2 id="pnm-t-atencao">Precisa da sua atenção</h2></div>' + corpo;
  }

  /* ============================================================= semana */
  const TIPOS_DIA = [
    { t: 'atrasada', cls: 'pn-dia-atraso', ic: () => U().IC.alerta, um: 'atrasada', varios: 'atrasadas' },
    { t: 'gravacao', cls: 'pn-dia-grav', ic: () => U().IC.camera, um: 'gravação', varios: 'gravações' },
    { t: 'prazo', cls: 'pn-dia-prazo', ic: () => U().IC.relogio, um: 'prazo', varios: 'prazos', junta: ['prazo', 'ajuste'] },
    { t: 'publicacao', cls: 'pn-dia-prazo', ic: () => IC_POST, um: 'publicação', varios: 'publicações' },
    { t: 'linha', cls: 'pn-dia-linha', ic: () => IC_LINHA, um: 'início de linha', varios: 'inícios de linha' }
  ];
  let eventosSemana = [];
  function pintarSemana() {
    const cx = document.getElementById('pnm-semana'); if (!cx) return;
    const d = D(), h = d.hoje(), seg = d.segundaDe(h);
    const dias = Array.from({ length: 7 }, (_, i) => d.somarDias(seg, i));
    let corpo;
    if (!todosProntos()) corpo = '<div class="esqueleto-tela pn-sk-semana">' + Array.from({ length: 5 }, (_, i) => '<i class="esq" style="--esq-d:' + i + '"></i>').join('') + '</div>';
    else {
      const vistos = new Set();
      eventosSemana = [];
      ads.forEach(a => { if (comErro(a).length === a.fontes.length) return;
        a.semana(dias).forEach(e => { const c = e.chave + '|' + e.dia; if (!vistos.has(c)) { vistos.add(c); eventosSemana.push(e); } }); });
      const lista = dias.map(iso => {
        const doDia = eventosSemana.filter(e => e.dia === iso);
        const itens = TIPOS_DIA.map(x => ({ cls: x.cls, ic: x.ic(), um: x.um, varios: x.varios,
          n: doDia.filter(e => (x.junta || [x.t]).includes(e.tipo)).length }));
        return { iso, hoje: iso === h, passado: iso < h, alerta: itens[0].n > 0, botao: doDia.length > 0, itens };
      }).filter((x, i) => i < 5 || x.itens.some(y => y.n));
      const vazia = !eventosSemana.length;
      corpo = '<ol class="pn-semana-lista">' + lista.map(U().diaSemana).join('') + '</ol>' +
        (vazia ? '<p class="pn-nota">Nenhum prazo, gravação ou publicação sua nesta semana.</p>' : '');
    }
    cx.innerHTML = '<div class="pn-sec-cab"><h2 id="pnm-t-semana">Minha semana</h2>' +
      '<span class="pn-sec-sub">' + d.ddmm(seg) + ' – ' + d.ddmm(d.somarDias(seg, 6)) + '</span>' + (B7.Perm && B7.Perm.podeRota('calendario') ? '<a class="pn-link pn-link-cal" href="#/calendario?v=semana&amp;d=' + seg + '">Ver no calendário</a>' : '') + '</div>' + corpo;
    cx.querySelectorAll('[data-pn-dia]').forEach(b => b.onclick = () => abrirDia(b.dataset.pnDia));
  }
  const ROTULO_TIPO = { atrasada: 'atrasada', gravacao: 'gravação', prazo: 'prazo', ajuste: 'ajuste', publicacao: 'publicação', linha: 'início de linha' };
  function abrirDia(iso) {
    const d = D(), doDia = eventosSemana.filter(e => e.dia === iso);
    const grupos = [];
    const grav = doDia.filter(e => e.tipo === 'gravacao');
    ['video', 'design', 'editorial'].forEach(dom => {
      const l = doDia.filter(e => e.dominio === dom && e.tipo !== 'gravacao');
      if (l.length) grupos.push({ marca: MARCA[dom], itens: l.map(e => Object.assign({}, e, { sub: [e.tipo === 'prazo' ? '' : ROTULO_TIPO[e.tipo], e.sub].filter(Boolean).join(' · ') })) });
    });
    if (grav.length) grupos.push({ marca: 'Gravações', itens: grav });
    abrirFolha(d.DOW_LONGO[d.local(iso).getDay()] + ', ' + d.ddmm(iso), grupos);
  }

  /* ============================================================ gráfico */
  function graficoEscolhido() {
    let guardado = null; try { guardado = B7.pref.ler('painel_grafico', null); } catch (e) {}
    return ads.find(a => a.dominio === guardado) || ads[0];
  }
  function pintarGrafico() {
    const cx = document.getElementById('pnm-grafico'); if (!cx) return;
    const atual = graficoEscolhido(); if (!atual) return;
    const g = atual.grafico();
    const seletor = ads.length > 1
      ? '<div class="pnm-graf-sel" role="group" aria-label="Gráfico">' + ads.map(a =>
          '<button type="button" data-pnm-graf="' + a.dominio + '" aria-pressed="' + (a === atual) + '"' + (a === atual ? ' class="on"' : '') + '>' +
          esc(a.rotuloGrafico) + '</button>').join('') + '</div>'
      : '';
    cx.innerHTML = '<div class="pn-sec-cab"><h2 id="pnm-t-grafico">' + esc(g.titulo) + '</h2>' +
        (g.sub ? '<span class="pn-sec-sub">' + esc(g.sub) + '</span>' : '') + seletor +
        (g.link ? '<a class="pn-link" href="' + esc(g.link.href) + '">' + esc(g.link.rotulo) + U().IC.seta + '</a>' : '') + '</div>' + g.corpo;
    cx.querySelectorAll('[data-pnm-graf]').forEach(b => b.onclick = () => {
      try { B7.pref.gravar('painel_grafico', b.dataset.pnmGraf); } catch (e) {}
      pintarGrafico();
      const novo = cx.querySelector('[data-pnm-graf="' + b.dataset.pnmGraf + '"]'); if (novo) novo.focus();
    });
  }

  /* ============================================================ próximos */
  const TIPO_PILL = {
    gravacao: ['Gravação', () => U().IC.camera, 'gravacao'],
    prazo: ['Prazo', () => U().IC.relogio, 'prazo'],
    publicacao: ['Publicação', () => IC_POST, 'prazo']
  };
  function pintarProximos() {
    const cx = document.getElementById('pnm-proximos'); if (!cx) return;
    const d = D();
    let corpo;
    if (!todosProntos()) corpo = U().blocoCarregando(3);
    else {
      const naAtencao = new Set(itensAtencao().slice(0, MAX_ATENCAO).map(it => it.chave));
      const vistos = new Set(), itens = [];
      ads.forEach(a => { if (comErro(a).length === a.fontes.length) return;
        a.proximos().forEach(it => { if (naAtencao.has(it.chave) || vistos.has(it.chave)) return; vistos.add(it.chave); itens.push(it); }); });
      const lista = itens.sort((x, y) => x.ordem - y.ordem).slice(0, MAX_PROXIMOS);
      corpo = lista.length
        ? '<div class="cp-agenda-lista">' + lista.map(c => {
            const p = TIPO_PILL[c.tipo] || TIPO_PILL.prazo;
            return '<a class="cp-ag-item pn-comp" href="' + esc(c.href) + '">' +
              '<span class="cp-ag-data"><span class="dow">' + d.DOW[d.local(c.dia).getDay()] + '</span><span class="dt">' + d.ddmm(c.dia) + '</span></span>' +
              '<span class="cp-ag-tx"><b>' + esc(c.titulo) + '</b><span class="cp-ag-meta pn-att-meta"><span class="pnm-dom">' + esc(c.tipo === 'gravacao' ? 'Gravação' : (MARCA[c.dominio] || '')) + '</span>' + (c.meta || '') + '</span></span>' +
              '<span class="pn-comp-tipo pn-comp-' + p[2] + '">' + p[1]() + '<span>' + p[0] + '</span></span></a>';
          }).join('') + '</div>'
        : U().blocoVazio('Nada marcado para os próximos dias.', 'Gravações, prazos e publicações seus aparecem aqui.');
    }
    const podeAgenda = B7.Perm && B7.Perm.podeRota && B7.Perm.podeRota('calendario');
    cx.innerHTML = U().cabecalhoSecao('pnm-t-prox', 'Próximos', podeAgenda ? { href: '#/calendario?v=semana', rotulo: 'Ver no calendário' } : null) + corpo;
  }

  /* ============================================================= pintura */
  function pintar() {
    if (!document.getElementById('pnm-raiz')) return;
    pintarKpis(); pintarAtencao(); pintarSemana(); pintarGrafico(); pintarProximos();
    painel().querySelectorAll('#pnm-raiz img.pn-logo').forEach(img => {
      img.onerror = () => { const s = document.createElement('span'); s.className = 'pn-logo pn-logo-vazia'; s.textContent = img.dataset.ini || ''; img.replaceWith(s); };
    });
    /* "Tentar de novo" do gráfico (blocoErro das fontes do domínio) */
    painel().querySelectorAll('#pnm-grafico [data-pn-retentar]').forEach(b => {
      b.onclick = () => { const a = graficoEscolhido(); b.dataset.pnRetentar.split(',').filter(Boolean).forEach(f => a.recarregar(f)); };
    });
    painel().querySelectorAll('[data-pnm-retentar]').forEach(b => {
      b.onclick = () => { const a = ads.find(x => x.dominio === b.dataset.pnmRetentar); if (a) comErro(a).forEach(f => a.recarregar(f)); };
    });
  }

  /* ------------------------------------------------------------ abrir */
  function acaoPrincipal(funcao) {
    if (funcao === 'coordenador' && B7.Conteudo && B7.Conteudo.novaLinha && B7.Perm.podeRota('linhas') &&
        !(B7.Conteudo.souDesignerSomenteLeitura && B7.Conteudo.souDesignerSomenteLeitura()))
      return '<button type="button" class="b pri pn-cab-acao" id="pnm-nova-linha">' + IC_MAIS + '<span>Nova linha editorial</span></button>';
    if (funcao === 'videomaker') return '<a class="b contorno pn-cab-acao" href="#/video?minha=1&comp=todas">' + U().IC.camera + '<span>Minha fila de edição</span></a>';
    if (funcao === 'designer') return '<a class="b contorno pn-cab-acao" href="#/design">' + IC_PINCEL + '<span>Produção de Design</span></a>';
    return '';
  }
  function abrir(c) {
    parar();
    ctx = c;
    ads = ctx.funcoes.map(f => ADAPTADORES[f] && ADAPTADORES[f]()).filter(Boolean);
    B7.Dashboard.marcarNav('#/painel');
    B7.Rota.titulo(['Painel']);
    painel().innerHTML = '<div class="conteudo entra pn pnm" id="pnm-raiz">' +
      U().cabecalho({ acao: acaoPrincipal(ctx.principal) }) +
      '<section class="pn-kpis" id="pnm-kpis" aria-label="Indicadores"></section>' +
      '<div class="pn-grade pnm-grade">' +
        '<section class="pn-bloco pn-atencao" id="pnm-atencao" aria-labelledby="pnm-t-atencao"></section>' +
        '<section class="pn-bloco" id="pnm-semana" aria-labelledby="pnm-t-semana"></section>' +
        '<section class="pn-bloco" id="pnm-proximos" aria-labelledby="pnm-t-prox"></section>' +
        '<section class="pn-bloco" id="pnm-grafico" aria-labelledby="pnm-t-grafico"></section>' +
      '</div>' +
    '</div>';
    const b = document.getElementById('pnm-nova-linha');
    if (b) b.onclick = () => B7.Conteudo.novaLinha();
    ads.forEach(a => a.iniciar(agendar));
    pintar();
  }
  function parar() { ads.forEach(a => a.parar && a.parar()); ads = []; }

  return { abrir, parar, _itensAtencao: () => itensAtencao(), _kpi: tipo => montarKpi(KPIS.find(k => k.tipo === tipo)) };
})();
