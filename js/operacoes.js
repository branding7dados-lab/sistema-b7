/* =====================================================================
   OPERAÇÕES (4.38.0) — o dash do mês, pedido do Yury.
   Linha = cliente; coluna = serviço; célula = situação.
     Calendário editorial · Artes · Campanha · Gravação · Edição ·
     Publicação · Mês
   A situação vem sozinha do que a equipe já faz no sistema (linha
   editorial, artes, gravações, edição e publicações — RPC operacoes_mes,
   supabase/sql/zzz326_operacoes.sql). Quem quiser ajusta à mão tocando
   na célula ("só move o status"); o ajuste mostra quem fez e pode voltar
   ao automático. O administrador marca o mês como conferido (checklist).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Operacoes = (function () {
  const esc = s => B7.UI.esc(s);
  const painel = () => document.getElementById('painel-dashboard');
  const sb = () => B7.sb;
  const COLS = [
    ['calendario', 'Calendário editorial', ['Pendente', 'Em execução', 'Feito', 'Entregue ao cliente']],
    ['artes', 'Artes', ['Pendente', 'Em execução', 'Entregue', 'Sem artes']],
    ['campanha', 'Campanha', ['Pendente', 'Em execução', 'Rodando', 'Concluída', 'Não tem']],
    ['gravacao', 'Gravação', ['Não agendada', 'Agendada', 'Realizada', 'Não tem']],
    ['edicao', 'Edição', ['Pendente', 'Em execução', 'Entregue', 'Sem vídeos']],
    ['publicacao', 'Publicação', ['Pendente', 'Em execução', 'Feito', 'Não feito']]
  ];
  const FEITO = ['Feito', 'Entregue', 'Entregue ao cliente', 'Realizada', 'Concluída', 'Rodando'];
  const NAO_SE_APLICA = ['Sem artes', 'Sem vídeos', 'Não tem'];
  const ANDAMENTO = ['Em execução', 'Agendada'];
  const tom = s => !s ? 'na' : FEITO.includes(s) ? 'ok' : NAO_SE_APLICA.includes(s) ? 'na' : ANDAMENTO.includes(s) ? 'and' : s === 'Não feito' ? 'atraso' : 'pend';
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const hoje = new Date();
  let ano = hoje.getFullYear(), mes = hoje.getMonth() + 1, linhas = [], filtro = 'todos', busca = '';

  const admin = () => !!(B7.Auth && B7.Auth.papel && B7.Auth.papel() === 'admin');

  /* situação valendo numa célula: a marca manual vence o automático */
  function celula(l, k) {
    const m = (l.marcas || {})[k], a = (l.auto || {})[k] || {};
    if (m && m.status) return { status: m.status, manual: true, por: m.por, em: m.em, nota: m.nota, auto: a };
    if (k === 'campanha') return { status: null, auto: a };
    return Object.assign({}, a, { auto: a });
  }
  function concluido(l) {
    return COLS.every(([k]) => { const s = celula(l, k).status; return !s || FEITO.includes(s) || NAO_SE_APLICA.includes(s); });
  }
  const conferido = l => (l.marcas || {}).mes && l.marcas.mes.status === 'Conferido' ? l.marcas.mes : null;

  async function abrir(params) {
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/operacoes');
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['Operações']);
    const m = params && params.get && params.get('mes');
    if (m && /^\d{4}-\d{2}$/.test(m)) { ano = +m.slice(0, 4); mes = +m.slice(5); }
    painel().innerHTML = '<div class="conteudo entra op-tela">' +
      '<div class="cb-topo"><div class="cb-titulo"><h1>Operações</h1><p class="op-intro">Cada cliente numa linha, cada serviço numa coluna. A situação vem do que a equipe já faz no sistema; toque numa célula para ajustar.</p></div>' +
        '<div class="cb-topo-acoes op-mes"><button class="cb-ic" data-mes="-1" aria-label="Mês anterior">‹</button><b id="op-mes-rot"></b><button class="cb-ic" data-mes="1" aria-label="Próximo mês">›</button></div></div>' +
      '<div class="op-resumo" id="op-resumo"></div>' +
      '<div class="op-barra"><div class="filtro op-filtro">' + [['todos', 'Todos'], ['abertos', 'Com pendência'], ['concluidos', 'Mês concluído']].map(([k, r]) =>
        '<button data-f="' + k + '"' + (filtro === k ? ' class="on"' : '') + '>' + r + '</button>').join('') + '</div>' +
        '<input class="campo op-busca" type="search" placeholder="Buscar cliente" value="' + esc(busca) + '"></div>' +
      '<div id="op-corpo">' + B7.UI.skeleton('tabela', { n: 8, cols: 6 }) + '</div></div>';
    const p = painel();
    p.querySelectorAll('[data-mes]').forEach(b => b.onclick = () => {
      mes += +b.dataset.mes; if (mes < 1) { mes = 12; ano--; } if (mes > 12) { mes = 1; ano++; }
      history.replaceState(null, '', '#/operacoes?mes=' + ano + '-' + String(mes).padStart(2, '0'));
      carregar();
    });
    p.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtro = b.dataset.f; p.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); pintar(); });
    const bu = p.querySelector('.op-busca'); bu.oninput = () => { busca = bu.value.trim().toLowerCase(); pintar(); };
    carregar();
  }

  async function carregar() {
    const rot = document.getElementById('op-mes-rot'); if (rot) rot.textContent = MESES[mes - 1] + ' ' + ano;
    const cx = document.getElementById('op-corpo'); if (!cx) return;
    try {
      const [r, sv] = await Promise.all([sb().rpc('operacoes_mes', { p_ano: ano, p_mes: mes }),
        sb().from('clientes').select('id, servico').neq('servico', 'ativo')]);
      if (r.error) throw r.error;
      /* 4.43.0: clientes inativos ou com contrato cancelado ficam fora */
      const fora = new Set((sv.data || []).map(x => x.id));
      linhas = (Array.isArray(r.data) ? r.data : []).filter(l => !fora.has(l.id));
      pintar();
    } catch (e) {
      cx.innerHTML = '<div class="cb-aviso erro">Não foi possível carregar as operações. <button class="cb-link" id="op-denovo">Tentar de novo</button></div>';
      const b = document.getElementById('op-denovo'); if (b) b.onclick = carregar;
    }
  }

  function pintar() {
    const cx = document.getElementById('op-corpo'); if (!cx) return;
    const total = linhas.length, ok = linhas.filter(concluido).length, conf = linhas.filter(conferido).length;
    const pend = {}; COLS.forEach(([k]) => { pend[k] = linhas.filter(l => { const s = celula(l, k).status; return s && !FEITO.includes(s) && !NAO_SE_APLICA.includes(s); }).length; });
    const rs = document.getElementById('op-resumo');
    if (rs) rs.innerHTML = '<div class="op-r"><b>' + ok + '<small>/' + total + '</small></b><span>clientes com o mês concluído</span><i style="--w:' + (total ? ok * 100 / total : 0) + '%"></i></div>' +
      '<div class="op-r"><b>' + conf + '<small>/' + total + '</small></b><span>conferidos</span><i style="--w:' + (total ? conf * 100 / total : 0) + '%"></i></div>' +
      COLS.map(([k, r]) => '<div class="op-r mini' + (pend[k] ? ' tem' : '') + '"><b>' + pend[k] + '</b><span>' + esc(r) + ' em aberto</span></div>').join('');
    let lista = linhas;
    if (filtro === 'abertos') lista = lista.filter(l => !concluido(l));
    if (filtro === 'concluidos') lista = lista.filter(concluido);
    if (busca) lista = lista.filter(l => String(l.nome || '').toLowerCase().includes(busca));
    if (!lista.length) { cx.innerHTML = '<div class="estado-b7"><div class="b7-marca fraca"></div><p>' + (linhas.length ? 'Nenhum cliente neste filtro.' : 'Nenhum cliente ativo.') + '</p></div>'; return; }
    cx.innerHTML = '<div class="op-rolo"><table class="op-tab"><thead><tr><th class="op-cli">Cliente</th>' +
      COLS.map(([, r]) => '<th>' + esc(r) + '</th>').join('') + '<th>Mês</th></tr></thead><tbody>' +
      lista.map(l => {
        const c = conferido(l), fim = concluido(l);
        return '<tr data-l="' + esc(l.id) + '"><th class="op-cli" scope="row"><a href="#/cliente/' + esc(l.id) + '"><span class="op-logo">' +
            (l.logo_url ? '<img src="' + esc(l.logo_url) + '" alt="" loading="lazy">' : esc(String(l.nome || '?').charAt(0))) + '</span><span>' + esc(l.nome) + '</span></a></th>' +
          COLS.map(([k]) => {
            const v = celula(l, k), t = tom(v.status);
            const conta = !v.manual && v.total ? '<small>' + v.feitas + '/' + v.total + '</small>' : '';
            const dica = v.manual ? 'Ajustado por ' + (v.por || 'alguém') + (v.nota ? ': ' + v.nota : '') + ' (automático: ' + ((v.auto || {}).status || '—') + ')' : 'Automático' + (v.proxima ? ' · próxima ' + B7.UI.dataBR(v.proxima) : '');
            return '<td><button class="op-cel op-' + t + (v.manual ? ' manual' : '') + '" data-c="' + k + '" title="' + esc(dica) + '"><span>' + esc(v.status || '—') + '</span>' + conta + '</button></td>';
          }).join('') +
          '<td><button class="op-cel op-mesc ' + (c ? 'op-ok conf' : fim ? 'op-ok' : 'op-pend') + '" data-c="mes" title="' +
            esc(c ? 'Conferido por ' + (c.por || '') : fim ? 'Tudo feito. ' + (admin() ? 'Toque para marcar como conferido.' : '') : 'Ainda tem coisa em aberto') + '">' +
            '<span>' + (c ? '✓ Conferido' : fim ? 'Mês concluído' : 'Em aberto') + '</span></button></td></tr>';
      }).join('') + '</tbody></table></div>';
    cx.querySelectorAll('[data-c]').forEach(b => b.onclick = () => editar(b.closest('tr').dataset.l, b.dataset.c));
  }

  function editar(id, k) {
    const l = linhas.find(x => x.id === id); if (!l) return;
    if (k === 'mes') {
      if (!admin()) { B7.UI.toast('Só o administrador confere o mês.'); return; }
      const c = conferido(l);
      return salvar(l, 'mes', c ? null : 'Conferido', null, c ? 'Conferência tirada.' : l.nome + ': mês conferido.');
    }
    const col = COLS.find(c => c[0] === k), v = celula(l, k);
    const m = B7.UI.modal('<h3>' + esc(col[1]) + '</h3><div class="sub">' + esc(l.nome) + ' · ' + MESES[mes - 1] + ' ' + ano + '</div>' +
      '<div class="op-ops">' + col[2].map(s => '<button class="op-cel op-' + tom(s) + (s === v.status ? ' sel' : '') + '" data-s="' + esc(s) + '"><span>' + esc(s) + '</span></button>').join('') + '</div>' +
      (k !== 'campanha' ? '<p class="gv-ajuda">Pelo sistema: <b>' + esc((v.auto || {}).status || '—') + '</b>' + ((v.auto || {}).total ? ' (' + v.auto.feitas + ' de ' + v.auto.total + ')' : '') + '.' +
        (v.manual ? ' Ajustado por ' + esc(v.por || 'alguém') + '.' : '') + '</p>' : '') +
      '<label class="rot" for="op-nota">OBSERVAÇÃO (opcional)</label><input class="campo" id="op-nota" maxlength="300" value="' + esc(v.manual ? v.nota || '' : '') + '" placeholder="Ex.: falta 2 artes, cliente atrasou o material">' +
      '<div class="acoes">' + (v.manual ? '<button class="b" data-auto>Voltar ao automático</button>' : '<button class="b" data-fecha>Cancelar</button>') + '</div>', { extra: 'op-modal' });
    m.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { m.fechar(); salvar(l, k, b.dataset.s, m.querySelector('#op-nota').value); });
    const au = m.querySelector('[data-auto]'); if (au) au.onclick = () => { m.fechar(); salvar(l, k, null, null, 'Voltou ao automático.'); };
  }

  async function salvar(l, k, status, nota, msg) {
    const antes = (l.marcas || {})[k];
    l.marcas = Object.assign({}, l.marcas);
    if (status) l.marcas[k] = { status, nota: nota || null, por: ((B7.Auth.usuario() || {}).nome) || 'você', em: new Date().toISOString() };
    else delete l.marcas[k];
    pintar();
    try {
      const r = await sb().rpc('operacoes_marcar', { p_cliente: l.id, p_ano: ano, p_mes: mes, p_coluna: k, p_status: status, p_nota: nota || null });
      if (r.error) throw r.error;
      if (msg) B7.UI.toast(msg);
    } catch (e) {
      if (antes) l.marcas[k] = antes; else delete l.marcas[k];
      pintar(); B7.UI.toast('Não foi possível salvar: ' + ((e && e.message) || ''), { tipo: 'erro' });
    }
  }

  return { abrir };
})();
