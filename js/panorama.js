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
  let S = { ano: agora.getFullYear(), mes: agora.getMonth() + 1, filtro: 'todos', busca: '', ordem: 'atencao', dados: null, dir: 0 };

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

  function anel(pct, rotulo) {
    const r = 34, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct || 0));
    return '<div class="pan-anel" role="img" aria-label="' + esc(rotulo) + '">' +
      '<svg viewBox="0 0 80 80"><defs><linearGradient id="panAnelG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF7AC0"/><stop offset="1" stop-color="#8E6BFF"/></linearGradient></defs>' +
      '<circle class="pan-anel-f" cx="40" cy="40" r="' + r + '"/>' +
      '<circle class="pan-anel-v" cx="40" cy="40" r="' + r + '" style="--c:' + c.toFixed(1) + ';--o:' + (c * (1 - p)).toFixed(1) + '"/></svg>' +
      '<b><span data-conta="' + Math.round(p * 100) + '">0</span><i>%</i></b></div>';
  }

  function heroi(linhas) {
    const n = { atraso: 0, atencao: 0, andamento: 0, ok: 0, vazio: 0 };
    let soma = 0, com = 0;
    linhas.forEach(l => { n[l.estado]++; if (l.etapas) { soma += l.pct; com++; } });
    const chip = (k, rot, v) => '<button type="button" class="pan-kpi pan-e-' + k + (S.filtro === k ? ' on' : '') + '" data-filtro="' + k + '" aria-pressed="' + (S.filtro === k) + '">' +
      '<b data-conta="' + v + '">0</b><span>' + rot + '</span></button>';
    return '<section class="pan-heroi" aria-label="Resumo do mês">' +
      '<i class="pan-heroi-luz" aria-hidden="true"></i><i class="pan-heroi-luz dois" aria-hidden="true"></i>' +
      '<div class="pan-heroi-esq">' + anel(com ? soma / com : 0, 'Andamento médio do mês') +
        '<div class="pan-heroi-tx"><span>Andamento do mês</span><strong>' + esc(mesRotulo()) + '</strong>' +
        '<small>' + plural(com, 'cliente com movimento', 'clientes com movimento') + ' de ' + linhas.length + '</small></div></div>' +
      '<div class="pan-kpis">' +
        chip('atraso', 'com atraso', n.atraso) + chip('atencao', 'pedem atenção', n.atencao) +
        chip('andamento', 'em andamento', n.andamento) + chip('ok', 'em dia', n.ok) + chip('vazio', 'sem movimento', n.vazio) +
      '</div></section>';
  }

  function celHTML(x, k, rot) {
    const pct = x.pct === null || x.pct === undefined ? null : Math.round(Math.max(0, Math.min(1, x.pct)) * 100);
    const marca = x.estado === 'ok' ? '<i class="pan-cel-ic">' + IC.ok + '</i>' : x.estado === 'atraso' ? '<i class="pan-cel-ic">' + IC.alerta + '</i>' : '';
    return '<div class="pan-cel pan-e-' + x.estado + '" data-etapa="' + k + '" title="' + esc(rot + ': ' + (x.valor ? x.valor + ' ' : '') + x.sub) + '">' +
      '<span class="pan-cel-rot">' + IC[k] + '<em>' + esc(rot) + '</em></span>' +
      (x.estado === 'vazio'
        ? '<span class="pan-cel-vazio">' + (k === 'aprovacoes' ? '—' : '·') + '</span>'
        : '<span class="pan-cel-topo"><b>' + esc(x.valor || '') + '</b>' + marca + '</span>' +
          (pct !== null ? '<span class="pan-barra"><i style="--p:' + pct + '%"></i></span>' : '') +
          '<small>' + esc(x.sub) + '</small>') +
    '</div>';
  }
  function linhaHTML(l, i) {
    const c = l.c, pct = Math.round(l.pct * 100);
    const rot = { atraso: 'com atraso', atencao: 'pede atenção', andamento: 'em andamento', ok: 'em dia', vazio: 'sem movimento' }[l.estado];
    return '<a class="pan-linha pan-e-' + l.estado + '" href="#/cliente/' + esc(c.id) + '" style="--i:' + Math.min(i, 24) + '" data-nome="' + esc((c.nome || '').toLowerCase()) + '">' +
      '<div class="pan-quem">' + B7.UI.avatarCliente(c.nome, c.logo_url, 'pan-av') +
        '<div class="pan-quem-tx"><b>' + esc(c.nome) + '</b>' +
          '<span class="pan-quem-sub"><i class="pan-ponto"></i>' + rot + (l.etapas ? ' · ' + pct + '%' : '') + '</span></div></div>' +
      '<div class="pan-cels">' + ETAPAS.map(([k, r]) => celHTML(l.cels[k], k, r)).join('') + '</div>' +
      '<span class="pan-ir" aria-hidden="true">' + IC.seta + '</span>' +
    '</a>';
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
    const cab = '<div class="pan-cab" aria-hidden="true"><span class="pan-cab-quem">Cliente</span><div class="pan-cels">' +
      ETAPAS.map(([k, r]) => '<span class="pan-cab-et">' + IC[k] + '<em>' + r + '</em></span>').join('') + '</div><span class="pan-ir"></span></div>';
    return heroi(todas) +
      '<div class="pan-barra-f">' +
        '<label class="pan-busca">' + IC.lupa + '<input type="search" id="pan-busca" placeholder="Buscar cliente…" value="' + esc(S.busca) + '" aria-label="Buscar cliente"></label>' +
        '<div class="pan-seg" role="group" aria-label="Ordem">' +
          '<button type="button" data-ordem="atencao" class="' + (S.ordem === 'atencao' ? 'on' : '') + '">Quem precisa primeiro</button>' +
          '<button type="button" data-ordem="az" class="' + (S.ordem === 'az' ? 'on' : '') + '">A–Z</button></div>' +
        (S.filtro !== 'todos' ? '<button type="button" class="pan-limpa" data-filtro="todos">Mostrar todos</button>' : '') +
      '</div>' +
      (vis.length
        ? '<div class="pan-tabela">' + cab + '<div class="pan-linhas">' + vis.map(linhaHTML).join('') + '</div></div>'
        : '<div class="estado-b7 pan-nada"><b>' + (todas.length ? 'Nenhum cliente nesse recorte.' : 'Nenhum cliente por aqui ainda.') + '</b>' +
          (todas.length ? '<p>Tire o filtro ou a busca para ver todos.</p>' : '') + '</div>');
  }

  function esqueleto() {
    return '<div class="pan-heroi pan-carrega"></div>' +
      '<div class="pan-tabela"><div class="pan-linhas">' + Array.from({ length: 7 }).map((_, i) => '<div class="pan-linha pan-carrega" style="--i:' + i + '"></div>').join('') + '</div></div>';
  }

  function topoHTML() {
    return '<header class="pan-topo">' +
      '<div class="pan-tit"><h1>Panorama</h1><p>Como está cada cliente no mês, etapa por etapa.</p></div>' +
      '<div class="pan-mes" role="group" aria-label="Mês">' +
        '<button type="button" class="pan-mes-bt" data-mes="-1" aria-label="Mês anterior">' + IC.esq + '</button>' +
        '<b id="pan-mes-rot" aria-live="polite">' + esc(mesRotulo()) + '</b>' +
        '<button type="button" class="pan-mes-bt" data-mes="1" aria-label="Próximo mês">' + IC.dir + '</button>' +
        '<button type="button" class="pan-hoje" data-mes="0"' + (ehMesAtual() ? ' disabled' : '') + '>Este mês</button>' +
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
    cx.querySelectorAll('[data-filtro]').forEach(b => b.onclick = () => {
      S.filtro = S.filtro === b.dataset.filtro ? 'todos' : b.dataset.filtro; S.dir = 0; pintarCorpo(false);
      const al = cx.querySelector('.pan-linhas'); if (al) { al.classList.remove('pan-troca'); void al.offsetWidth; al.classList.add('pan-troca'); }
    });
    cx.querySelectorAll('[data-ordem]').forEach(b => b.onclick = () => { if (S.ordem === b.dataset.ordem) return; S.ordem = b.dataset.ordem; S.dir = 0; pintarCorpo(false);
      const al = cx.querySelector('.pan-linhas'); if (al) al.classList.add('pan-troca'); });
    const bs = cx.querySelector('#pan-busca');
    if (bs) bs.oninput = () => {
      S.busca = bs.value;
      const todas = (S.dados || []).map(ler), vis = ordenar(filtrar(todas));
      const al = cx.querySelector('.pan-linhas');
      if (al) al.innerHTML = vis.map(linhaHTML).join('') || '<div class="pan-sem">Nenhum cliente com esse nome.</div>';
      if (al) al.classList.add('pan-sem-anim');
    };
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
      if (rot) { rot.textContent = mesRotulo(); rot.classList.remove('pan-vira'); void rot.offsetWidth; rot.classList.add('pan-vira'); }
      const hj = raiz.querySelector('.pan-hoje'); if (hj) hj.disabled = ehMesAtual();
      carregar(true);
    });
    S.dir = 0;
    await carregar(true);
  }

  /* ler/ETAPAS: o Painel (js/painel.js) resume a agência com a MESMA regra */
  return { abrir, ler, ETAPAS };
})();
