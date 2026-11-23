/* =====================================================================
   GESTÃO — TRÊS ABAS NOVAS (4.87.0), para o administrador e o Financeiro
     • Contratado × entregue — pacote do cliente × planejado × publicado (gestao_contratado);
     • Clientes em risco     — quem precisa de atenção e por quê, com a saúde semana a semana (gestao_riscos);
     • Prazos e retrabalho   — por pessoa e por cliente, mês a mês (gestao_prazos).
   Cada aba desenha na caixa que a Gestão entrega (cx); se a pessoa já trocou de aba, a resposta não pinta.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.GestaoExtra = (function () {
  const esc = s => B7.UI.esc(s);
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mesDe = d => { const m = /^(\d{4})-(\d{2})/.exec(String(d || '')); return m ? MESES[+m[2] - 1] + '/' + m[1] : ''; };
  const MESES_L = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const rotMes = ym => { const [a, m] = String(ym).split('-'); return MESES[+m - 1] + '/' + String(a).slice(2); };
  const logo = (url, nome) => '<span class="ge-logo">' + (url ? '<img src="' + esc(url) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '<b>' + esc(String(nome || '?').slice(0, 2).toUpperCase()) + '</b></span>';
  const vazio = t => '<p class="gt-vazio">' + esc(t) + '</p>';
  const carregando = () => (B7.UI.skeleton ? B7.UI.skeleton('lista', { n: 4 }) : '<p class="gt-vazio">Carregando…</p>');
  const erro = (cx, e, de) => { cx.innerHTML = '<div class="cb-aviso erro">' + esc((e && e.message) || 'Não foi possível carregar.') + ' <button class="cb-link" data-de-novo>Tentar de novo</button></div>'; cx.querySelector('[data-de-novo]').onclick = de; };

  /* ------------------------------------------------------------ Contratado × entregue */
  const hoje = new Date();
  let anoC = hoje.getFullYear(), mesC = hoje.getMonth() + 1, soAbaixo = false;
  async function contratado(cx) {
    cx.innerHTML = carregando();
    let d;
    try { d = (await B7.DB.rpc('gestao_contratado', { p_ano: anoC, p_mes: mesC })) || {}; } catch (e) { if (cx.isConnected) erro(cx, e, () => contratado(cx)); return; }
    if (!cx.isConnected) return;
    const l = d.clientes || [], sem = d.sem_pacote || [], comeca = d.comeca || [];
    const abaixo = l.filter(c => c.abaixo || c.atras_ritmo);
    const vis = soAbaixo ? abaixo : l;
    const barra = c => { const p = c.contratado ? Math.min(100, Math.round(100 * c.publicados / c.contratado)) : 0, r = Math.round(100 * (d.ritmo || 0));
      return '<span class="ge-barra' + (c.abaixo ? ' ruim' : c.atras_ritmo ? ' atencao' : '') + '" title="' + c.publicados + ' de ' + c.contratado + ' publicados"><i style="--w:' + p + '%"></i>' +
        (!d.fechado ? '<em style="--x:' + r + '%" title="onde deveria estar hoje"></em>' : '') + '</span>'; };
    cx.innerHTML =
      '<div class="ge-cab"><div class="ge-mes"><button class="b contorno p" data-mes="-1" aria-label="Mês anterior">‹</button><b>' + MESES_L[mesC - 1] + ' ' + anoC + '</b>' +
        '<button class="b contorno p" data-mes="1" aria-label="Próximo mês">›</button></div>' +
        '<label class="ge-chk"><input type="checkbox" data-so-abaixo' + (soAbaixo ? ' checked' : '') + '> Só quem está abaixo</label></div>' +
      '<div class="gt-kpis tres">' +
        '<div class="gt-kpi"><b>' + l.length + '</b><span>clientes com pacote</span></div>' +
        '<div class="gt-kpi' + (abaixo.length ? ' atencao' : '') + '"><b>' + abaixo.length + '</b><span>' + (d.fechado ? 'ficaram abaixo do contratado' : 'atrás do ritmo do mês') + '</span></div>' +
        '<div class="gt-kpi"><b>' + l.reduce((s, c) => s + c.publicados, 0) + '<small>/' + l.reduce((s, c) => s + c.contratado, 0) + '</small></b><span>publicados × contratados</span></div></div>' +
      '<p class="gt-nota">' + (d.fechado ? 'Mês fechado: "abaixo" quando publicou menos do que o pacote.' : 'Mês em andamento: a marca na barra é onde o cliente deveria estar hoje (' + Math.round(100 * (d.ritmo || 0)) + '% do mês).') +
        ' Contam os conteúdos da Linha editorial do mês, por tipo do pacote.</p>' +
      '<section class="gt-bloco ge-lista">' + (vis.length ? vis.map(c =>
        '<button type="button" class="ge-lin" data-ir="#/cliente/' + esc(c.id) + '">' + logo(c.logo, c.nome) +
          '<span class="ge-lin-tx"><b>' + esc(c.nome) + '</b><small>' + esc(c.pacote || 'Pacote') + (c.ajustado ? ' (ajustado)' : '') + ' · ' + c.planejados + ' planejados</small>' +
            '<span class="ge-tipos">' + (c.itens || []).map(t => '<span class="' + (t.publicados < t.contratado && d.fechado ? 'falta' : '') + '">' + esc(t.tipo) + ' ' + t.publicados + '/' + t.contratado + '</span>').join('') + '</span></span>' +
          '<span class="ge-lin-n">' + barra(c) + '<b>' + c.publicados + '/' + c.contratado + '</b>' +
            (c.abaixo ? '<em class="ge-selo ruim">faltaram ' + c.faltam + '</em>' : c.atras_ritmo ? '<em class="ge-selo atencao">atrás do ritmo</em>' : '') + '</span></button>').join('')
        : vazio(soAbaixo ? 'Ninguém abaixo do contratado neste mês.' : 'Nenhum cliente com pacote definido.')) + '</section>' +
      (sem.length ? '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Sem pacote definido <small>' + sem.length + '</small></h2></div><p class="gt-nota">Defina o pacote no cadastro do cliente para entrar nesta conta.</p>' +
        '<div class="ge-chips">' + sem.map(c => '<button type="button" class="ge-chip" data-ir="#/cliente/' + esc(c.id) + '/cadastro">' + esc(c.nome) + '</button>').join('') + '</div></section>' : '') +
      /* 4.88.0: pacote com "vale desde" depois deste mês — ainda não entra na conta */
      (comeca.length ? '<section class="gt-bloco" data-ge-comeca><div class="gt-bloco-cab"><h2>Pacote ainda não começou <small>' + comeca.length + '</small></h2></div>' +
        '<div class="ge-chips">' + comeca.map(c => '<button type="button" class="ge-chip" data-ir="#/cliente/' + esc(c.id) + '/cadastro">' + esc(c.nome) + ' · começa em ' + esc(mesDe(c.desde)) + '</button>').join('') + '</div></section>' : '');
    cx.querySelectorAll('[data-mes]').forEach(b => b.onclick = () => { mesC += +b.dataset.mes; if (mesC < 1) { mesC = 12; anoC--; } if (mesC > 12) { mesC = 1; anoC++; } contratado(cx); });
    cx.querySelector('[data-so-abaixo]').onchange = e => { soAbaixo = e.target.checked; contratado(cx); };
    ligarIr(cx);
  }

  /* ------------------------------------------------------------ Clientes em risco */
  function grafico(semanas) {
    const p = (semanas || []).map(s => +s.pontos);
    if (p.length < 2) return '<span class="ge-spark vazio" title="O histórico começa a contar a partir de 4.87">histórico começando</span>';
    const w = 120, h = 32, x = i => (i * w / (p.length - 1)).toFixed(1), y = v => (h - 2 - (v / 100) * (h - 4)).toFixed(1);
    const caiu = p[p.length - 1] < p[0];
    return '<svg class="ge-spark' + (caiu ? ' caiu' : '') + '" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="Saúde nas últimas semanas: de ' + p[0] + ' para ' + p[p.length - 1] + '">' +
      '<polyline fill="none" stroke-width="2" points="' + p.map((v, i) => x(i) + ',' + y(v)).join(' ') + '"/></svg>';
  }
  async function riscos(cx) {
    cx.innerHTML = carregando();
    let d;
    try { d = (await B7.DB.rpc('gestao_riscos', {})) || {}; } catch (e) { if (cx.isConnected) erro(cx, e, () => riscos(cx)); return; }
    if (!cx.isConnected) return;
    const l = d.clientes || [];
    const cor = p => p >= 75 ? 'verde' : p >= 50 ? 'amarelo' : 'vermelho';
    cx.innerHTML = '<p class="gt-nota">Aparece aqui quem tem saúde abaixo de 50, saúde que caiu 15 pontos ou mais em 4 semanas, nota de 6 ou menos na pesquisa, atraso em 2 dos últimos 3 meses ou que ficou abaixo do contratado no mês passado.</p>' +
      '<section class="gt-bloco ge-lista">' + (l.length ? l.map(c =>
        '<button type="button" class="ge-lin" data-ir="#/cliente/' + esc(c.id) + '">' + logo(c.logo, c.nome) +
          '<span class="ge-lin-tx"><b>' + esc(c.nome) + '</b><ul class="ge-motivos">' + (c.motivos || []).map(m => '<li>' + esc(m) + '</li>').join('') + '</ul></span>' +
          '<span class="ge-lin-n">' + grafico(c.semanas) + '<b class="ge-pt ' + cor(c.pontos) + '">' + c.pontos + '</b>' +
            (c.antes != null ? '<small>' + (c.pontos - c.antes >= 0 ? '+' : '') + (c.pontos - c.antes) + ' em 4 sem.</small>' : '') + '</span></button>').join('')
        : vazio('Nenhum cliente em risco agora. 🎉')) + '</section>';
    ligarIr(cx);
  }

  /* ------------------------------------------------------------ Prazos e retrabalho */
  let visaoP = 'pessoas';
  const pct = v => v == null ? '—' : v + '%';
  const dias = v => v == null ? '—' : String(v).replace('.', ',') + ' d';
  function tendencia(ms, campo, maiorMelhor) {
    const v = (ms || []).filter(m => m[campo] != null);
    if (v.length < 2) return '';
    const a = +v[v.length - 2][campo], b = +v[v.length - 1][campo];
    if (a === b) return '';
    const melhor = maiorMelhor ? b > a : b < a;
    return '<i class="ge-tend ' + (melhor ? 'bom' : 'ruim') + '" title="' + (melhor ? 'melhorou' : 'piorou') + ' contra o mês anterior">' + (b > a ? '▲' : '▼') + '</i>';
  }
  async function prazos(cx) {
    cx.innerHTML = carregando();
    let d;
    try { d = (await B7.DB.rpc('gestao_prazos', { p_meses: 6 })) || {}; } catch (e) { if (cx.isConnected) erro(cx, e, () => prazos(cx)); return; }
    if (!cx.isConnected) return;
    const meses = d.meses || [], l = (visaoP === 'pessoas' ? d.pessoas : d.clientes) || [];
    const ult = ms => (ms || [])[ms.length - 1] || {};
    const totais = (d.pessoas || []).reduce((a, p) => { const u = ult(p.meses); a.ent += u.entregas || 0; a.atr += p.atrasados_hoje || 0; return a; }, { ent: 0, atr: 0 });
    cx.innerHTML =
      '<div class="ge-cab"><div class="filtro ge-visao" role="tablist">' + [['pessoas', 'Por pessoa'], ['clientes', 'Por cliente']].map(([k, r]) =>
        '<button role="tab" data-visao="' + k + '" class="' + (visaoP === k ? 'on' : '') + '" aria-selected="' + (visaoP === k) + '">' + r + '</button>').join('') + '</div></div>' +
      '<div class="gt-kpis tres">' +
        '<div class="gt-kpi"><b>' + totais.ent + '</b><span>entregas neste mês</span></div>' +
        '<div class="gt-kpi' + (totais.atr ? ' atencao' : '') + '"><b>' + totais.atr + '</b><span>atrasadas hoje</span></div>' +
        '<div class="gt-kpi"><b>' + meses.length + '</b><span>meses na conta</span><small>' + esc(meses.length ? rotMes(meses[0]) + ' a ' + rotMes(meses[meses.length - 1]) : '') + '</small></div></div>' +
      '<p class="gt-nota">No prazo: entregue até a data do prazo. Tempo: do pedido à entrega. ' + (visaoP === 'pessoas' ? 'Versões: média de versões por arte (retrabalho no Design).' : 'Ajustes: aprovações que voltaram pedindo ajuste.') + ' A seta compara com o mês anterior.</p>' +
      '<section class="gt-bloco ge-tab-cx"><table class="ge-tab"><thead><tr><th>' + (visaoP === 'pessoas' ? 'Pessoa' : 'Cliente') + '</th>' +
        meses.map(m => '<th>' + esc(rotMes(m)) + '</th>').join('') + '<th>No prazo</th><th>Tempo</th><th>' + (visaoP === 'pessoas' ? 'Versões' : 'Ajustes') + '</th><th>Atrasadas hoje</th></tr></thead><tbody>' +
        (l.length ? l.map(x => { const u = ult(x.meses), extra = visaoP === 'pessoas' ? 'versoes' : 'ajustes_pct';
          return '<tr><th>' + esc(x.nome) + (x.funcao ? '<small>' + esc(x.funcao) + '</small>' : '') + '</th>' +
            (x.meses || []).map(m => '<td title="' + m.entregas + ' entregas · ' + pct(m.no_prazo_pct) + ' no prazo">' + (m.entregas || '·') + '</td>').join('') +
            '<td class="' + (u.no_prazo_pct != null && u.no_prazo_pct < 70 ? 'ruim' : '') + '">' + pct(u.no_prazo_pct) + tendencia(x.meses, 'no_prazo_pct', true) + '</td>' +
            '<td>' + dias(u.dias) + tendencia(x.meses, 'dias', false) + '</td>' +
            '<td>' + (visaoP === 'pessoas' ? (u.versoes == null ? '—' : String(u.versoes).replace('.', ',')) : pct(u.ajustes_pct)) + tendencia(x.meses, extra, false) + '</td>' +
            '<td class="' + (x.atrasados_hoje ? 'ruim' : '') + '">' + (x.atrasados_hoje || 0) + '</td></tr>'; }).join('')
          : '<tr><td colspan="' + (meses.length + 5) + '">' + vazio('Sem entregas nos últimos meses.') + '</td></tr>') + '</tbody></table></section>';
    cx.querySelectorAll('[data-visao]').forEach(b => b.onclick = () => { visaoP = b.dataset.visao; prazos(cx); });
  }

  function ligarIr(cx) { cx.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { location.hash = b.dataset.ir; }); }

  return { contratado, riscos, prazos };
})();
