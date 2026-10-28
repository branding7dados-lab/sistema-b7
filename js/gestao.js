/* =====================================================================
   GESTÃO (zzz266) — só administrador

   Três abas sobre uma única leitura (gestao_painel):
     • Visão geral  — painel do dono: clientes ativos, entregas do mês
                      (com o mês anterior), atrasos, aprovações, pedidos,
                      satisfação e a série de entregas dos últimos 6 meses;
     • Saúde        — um semáforo por cliente (0–100) com os motivos:
                      atrasos, aprovação parada, demora para responder,
                      ajustes demais, nota baixa, sem entregas;
     • Avulsos      — projetos avulsos em andamento (zzz274, js/projetos.js);
     • Pedidos      — o que os clientes pediram pelo portal, tempo até
                      ficar pronto e quem mais pede.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Gestao = (function () {
  const esc = s => B7.UI.esc(s);
  const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const SIT = { recebido: 'Recebido', em_producao: 'Em produção', concluido: 'Pronto', cancelado: 'Encerrado' };
  let aba = 'geral', dados = null;

  const painel = () => document.getElementById('painel-dashboard');
  const num = v => (v == null ? '—' : Number(v).toLocaleString('pt-BR'));

  async function abrir(params) {
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/gestao');
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['Gestão']);
    if (params && params.get && params.get('aba')) aba = params.get('aba');
    if (!B7.Auth.ehAdmin()) { painel().innerHTML = '<div class="conteudo"><div class="estado-b7"><b>Só o administrador abre a Gestão.</b></div></div>'; return; }
    painel().innerHTML = '<div class="conteudo entra gs">' +
      '<div class="cb-topo"><div class="cb-titulo"><h1>Gestão</h1><p class="gt-intro">A agência num olhar: entregas, saúde de cada cliente e o que eles estão pedindo.</p></div></div>' +
      '<div class="filtro rolavel gt-abas" role="tablist">' + [['geral', 'Visão geral'], ['saude', 'Saúde dos clientes'], ['avulsos', 'Avulsos'], ['pedidos', 'Pedidos'], ['recados', 'Recados']].filter(([k]) => k !== 'avulsos' || B7.Projetos).map(([k, r]) =>
        '<button role="tab" data-aba="' + k + '" class="' + (aba === k ? 'on' : '') + '" aria-selected="' + (aba === k) + '">' + r + '<span class="gt-n" data-n-' + k + '></span></button>').join('') + '</div>' +
      '<div id="gt-corpo">' + B7.UI.skeleton('lista', { n: 4 }) + '</div></div>';
    painel().querySelectorAll('[data-aba]').forEach(b => b.onclick = () => {
      aba = b.dataset.aba;
      painel().querySelectorAll('[data-aba]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      try { history.replaceState(null, '', '#/gestao?aba=' + aba); } catch (e) {}
      pintar();
    });
    const vale = B7.Rota.marca();
    try { dados = await B7.DB.rpc('gestao_painel', {}); }
    catch (e) {
      if (!vale()) return;
      document.getElementById('gt-corpo').innerHTML = '<div class="cb-aviso erro">' + esc(e.message || 'Não foi possível carregar.') + ' <button class="cb-link" data-de-novo>Tentar de novo</button></div>';
      painel().querySelector('[data-de-novo]').onclick = () => abrir();
      return;
    }
    if (!vale()) return;
    const k = dados.kpis || {};
    const n = (id, v, cls) => { const el = painel().querySelector('[data-n-' + id + ']'); if (el && v) { el.textContent = v; el.className = 'gt-n ' + (cls || ''); } };
    n('saude', (k.saude_vermelho || 0) + (k.saude_amarelo || 0), k.saude_vermelho ? 'vermelho' : 'amarelo');
    n('pedidos', k.pedidos_abertos);
    pintar();
  }

  function pintar() {
    const cx = document.getElementById('gt-corpo');
    if (!cx || !dados) return;
    if (aba === 'recados') return recados(cx);
    /* zzz274: projetos avulsos — fora da saúde (não têm mês), com o seu próprio quadro */
    if (aba === 'avulsos' && B7.Projetos) return B7.Projetos.montarGestao(cx);
    cx.innerHTML = aba === 'saude' ? saude() : aba === 'pedidos' ? pedidos() : geral();
    cx.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { location.hash = b.dataset.ir; });
    const ia = cx.querySelector('[data-ia-riscos]');
    if (ia) ia.onclick = () => B7.IAFerramentas.riscos(cx.querySelector('#gt-ia'));
  }

  /* zzz267: a IA lê a saúde dos clientes e diz o que olhar primeiro */
  const iaBloco = () => B7.IAFerramentas && B7.IAFerramentas.ligada()
    ? '<div id="gt-ia"><button type="button" class="gt-ia-bt" data-ia-riscos><span aria-hidden="true">✨</span><b>O que olhar primeiro?</b><small>A IA lê os números e a saúde de cada cliente e te diz por onde começar.</small></button></div>' : '';

  /* ------------------------------------------------------ visão geral */
  function geral() {
    const k = dados.kpis || {};
    const varia = k.entregas_ant ? Math.round(100 * (k.entregas_mes - k.entregas_ant) / k.entregas_ant) : null;
    const dia = new Date((dados.hoje || '') + 'T12:00:00');
    const fracao = dia.getDate() / new Date(dia.getFullYear(), dia.getMonth() + 1, 0).getDate();
    const ritmo = k.entregas_ant && fracao ? Math.round(100 * (k.entregas_mes / fracao - k.entregas_ant) / k.entregas_ant) : null;
    const card = (v, l, sub, cls, ir) => '<' + (ir ? 'button type="button" data-ir="' + ir + '"' : 'div') + ' class="gt-kpi ' + (cls || '') + '"><b>' + v + '</b><span>' + l + '</span>' +
      (sub ? '<small>' + sub + '</small>' : '') + '</' + (ir ? 'button' : 'div') + '>';
    return iaBloco() + '<div class="gt-kpis">' +
      card(num(k.clientes), 'clientes ativos', '', '', '#/clientes') +
      card(num(k.entregas_mes), 'entregas no mês', varia == null || ritmo == null ? '' : (ritmo >= 0 ? '▲ ritmo ' + ritmo + '% acima' : '▼ ritmo ' + Math.abs(ritmo) + '% abaixo') + ' do mês passado', ritmo != null && ritmo < -10 ? 'atencao' : '') +
      card(num(k.atrasos), 'entregas atrasadas', k.atrasos ? 'design e vídeo com prazo vencido' : 'nada atrasado 🎉', k.atrasos ? 'erro' : 'ok', '#/kanban') +
      card(num(k.aprov_pendentes), 'aprovações com o cliente', k.aprov_paradas ? k.aprov_paradas + ' paradas há 3+ dias' : '', k.aprov_paradas ? 'atencao' : '', '#/aprovacoes') +
      card(num(k.pedidos_mes), 'pedidos no mês', k.pedidos_abertos ? k.pedidos_abertos + ' em aberto' : '', '', '#/gestao?aba=pedidos') +
      card(k.satisfacao_media == null ? '—' : String(k.satisfacao_media).replace('.', ','), 'satisfação do mês',
        k.respostas ? k.respostas + (k.respostas === 1 ? ' resposta' : ' respostas') + (k.nps != null ? ' · NPS ' + k.nps : '') : 'a pesquisa abre no dia 20', k.satisfacao_media != null && k.satisfacao_media < 7 ? 'erro' : '') +
    '</div>' +
    '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Entregas por mês</h2><span class="gt-leg"><i class="d"></i>design <i class="v"></i>vídeo <i class="p"></i>publicados</span></div>' + grafico(dados.serie || []) + '</section>' +
    '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Clientes que pedem atenção</h2><button type="button" class="cb-link" data-ir="#/gestao?aba=saude">Ver todos →</button></div>' +
      ((dados.clientes || []).filter(c => c.cor !== 'verde').slice(0, 5).map(linhaCliente).join('') ||
        '<p class="gt-vazio">Todos os clientes estão no verde. 💚</p>') + '</section>';
  }

  function grafico(serie) {
    if (!serie.length) return '<p class="gt-vazio">Sem dados ainda.</p>';
    const max = Math.max(1, ...serie.map(s => s.design + s.video + s.publicados));
    return '<div class="gt-graf" role="img" aria-label="Entregas por mês nos últimos 6 meses">' + serie.map(s => {
      const tot = s.design + s.video + s.publicados, [a, m] = s.mes.split('-');
      const h = v => (100 * v / max).toFixed(1) + '%';
      return '<div class="gt-col" title="' + MESES[+m - 1] + '/' + a.slice(2) + ': ' + s.design + ' design · ' + s.video + ' vídeo · ' + s.publicados + ' publicados">' +
        '<b>' + (tot || '') + '</b><div class="gt-barra"><i class="p" style="height:' + h(s.publicados) + '"></i><i class="v" style="height:' + h(s.video) + '"></i><i class="d" style="height:' + h(s.design) + '"></i></div>' +
        '<span>' + MESES[+m - 1] + '</span></div>';
    }).join('') + '</div>';
  }

  /* ------------------------------------------------------------ saúde */
  function linhaCliente(c) {
    const av = B7.UI.avatarCliente ? B7.UI.avatarCliente(c.nome, c.logo, 'sm') : '';
    return '<button type="button" class="gt-cli ' + esc(c.cor) + '" data-ir="#/cliente/' + esc(c.id) + '">' +
      '<span class="gt-semaforo" aria-label="' + esc(c.cor) + '"><i></i></span>' + av +
      '<span class="gt-cli-tx"><b>' + esc(c.nome) + '</b><small>' + esc((c.motivos || []).join(' · ') || 'Tudo em dia') + '</small></span>' +
      '<span class="gt-pts"><b>' + c.pontos + '</b><small>de 100</small></span></button>';
  }
  function saude() {
    const l = dados.clientes || [];
    const conta = cor => l.filter(c => c.cor === cor).length;
    return iaBloco() + '<div class="gt-semaforos">' +
      '<div class="gt-sem vermelho"><b>' + conta('vermelho') + '</b><span>em risco</span></div>' +
      '<div class="gt-sem amarelo"><b>' + conta('amarelo') + '</b><span>atenção</span></div>' +
      '<div class="gt-sem verde"><b>' + conta('verde') + '</b><span>saudáveis</span></div></div>' +
      '<p class="gt-nota">A nota começa em 100 e cai com: entregas atrasadas, aprovações paradas há 3+ dias, demora para responder, muitas peças voltando com ajuste, nota baixa na pesquisa e meses sem entregas.</p>' +
      '<section class="gt-bloco gt-lista">' + (l.map(linhaCliente).join('') || '<p class="gt-vazio">Nenhum cliente ativo.</p>') + '</section>';
  }

  /* ---------------------------------------------------------- pedidos */
  function pedidos() {
    const k = dados.kpis || {}, l = dados.pedidos || [], pc = dados.pedidos_por_cliente || [];
    const dataBR = iso => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
    return '<div class="gt-kpis tres">' +
      '<div class="gt-kpi"><b>' + num(k.pedidos_mes) + '</b><span>pedidos no mês</span></div>' +
      '<div class="gt-kpi' + (k.pedidos_abertos ? ' atencao' : '') + '"><b>' + num(k.pedidos_abertos) + '</b><span>em aberto</span></div>' +
      '<div class="gt-kpi"><b>' + (k.pedidos_tempo_medio == null ? '—' : String(k.pedidos_tempo_medio).replace('.', ',') + ' d') + '</b><span>tempo médio até ficar pronto</span><small>últimos 90 dias</small></div></div>' +
      (pc.length ? '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Quem mais pede <small>90 dias</small></h2></div><div class="gt-ranking">' +
        pc.slice(0, 8).map(x => '<div><span>' + esc(x.cliente) + '</span><i style="--w:' + (100 * x.total / pc[0].total).toFixed(0) + '%"></i><b>' + x.total + '</b></div>').join('') + '</div></section>' : '') +
      '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Pedidos recentes</h2></div>' + (l.length ? '<div class="gt-peds">' + l.map(p =>
        '<button type="button" class="gt-ped" ' + (p.kanban_id ? 'data-ir="#/kanban/' + esc(p.kanban_id) + '"' : 'disabled') + '>' +
          '<span class="gt-ped-tx"><b>' + esc(p.titulo) + '</b><small>' + esc(p.cliente) + ' · ' + esc(dataBR(p.created_at)) + (p.para_quando ? ' · para ' + esc(dataBR(p.para_quando + 'T12:00:00')) : '') +
            (p.dias != null ? ' · pronto em ' + String(p.dias).replace('.', ',') + ' d' : '') + '</small></span>' +
          '<span class="gt-sit ' + esc(p.situacao) + '">' + esc(SIT[p.situacao] || p.situacao) + '</span></button>').join('') + '</div>'
        : '<p class="gt-vazio">Nenhum pedido ainda. Os clientes pedem pelo portal, em "Pedidos".</p>') + '</section>';
  }

  /* ---------------------------------------------------------- recados
     zzz268: avisos da B7 que aparecem no Início do portal do cliente */
  const TIPOS_REC = [['info', '📣 Aviso'], ['novidade', '✨ Novidade'], ['feriado', '🗓️ Feriado / horário'], ['atencao', '⚠️ Atenção']];
  async function recados(cx) {
    cx.innerHTML = B7.UI.skeleton('lista', { n: 3 });
    let l = [], cli = [];
    try {
      const [r, c] = await Promise.all([
        B7.sb.from('b7_recados').select('*').is('arquivado_em', null).order('created_at', { ascending: false }).limit(30),
        B7.DB.listarClientes().catch(() => [])]);
      l = r.data || []; cli = c || [];
    } catch (e) { cx.innerHTML = '<div class="cb-aviso erro">Não foi possível carregar os recados.</div>'; return; }
    const nomeCli = id => id ? ((cli.find(c => c.id === id) || {}).nome || 'um cliente') : 'Todos os clientes';
    const hoje = new Date().toISOString().slice(0, 10);
    cx.innerHTML = '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Novo recado</h2></div>' +
      '<div class="gt-rec-form">' +
        '<select class="campo" id="gt-rec-tipo">' + TIPOS_REC.map(([k, r]) => '<option value="' + k + '">' + r + '</option>').join('') + '</select>' +
        '<select class="campo" id="gt-rec-cli"><option value="">Todos os clientes</option>' + cli.map(c => '<option value="' + esc(c.id) + '">' + esc(c.nome) + '</option>').join('') + '</select>' +
        '<input class="campo" id="gt-rec-tit" maxlength="100" placeholder="Título (ex.: Recesso de fim de ano)">' +
        '<textarea class="campo" id="gt-rec-tx" rows="2" maxlength="600" placeholder="Detalhes (opcional)"></textarea>' +
        '<label class="gt-rec-ate">Mostrar até <input class="campo" type="date" id="gt-rec-ate" min="' + hoje + '"></label>' +
        '<button type="button" class="b pri" data-rec-pub>Publicar no portal</button></div></section>' +
      '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>No ar</h2></div>' + (l.length ? l.map(r =>
        '<div class="gt-rec"><div><b>' + esc((TIPOS_REC.find(t => t[0] === r.tipo) || TIPOS_REC[0])[1]) + ' · ' + esc(r.titulo) + '</b>' +
          '<small>' + esc(nomeCli(r.client_id)) + (r.ate ? ' · até ' + esc(r.ate.split('-').reverse().join('/')) : ' · sem data para sair') + '</small>' +
          (r.texto ? '<p>' + esc(r.texto) + '</p>' : '') + '</div>' +
          '<button type="button" class="b fina contorno" data-rec-arq="' + esc(r.id) + '">Tirar do ar</button></div>').join('')
        : '<p class="gt-vazio">Nenhum recado no ar. Os clientes veem os recados no Início do portal.</p>') + '</section>';
    cx.querySelector('[data-rec-pub]').onclick = async e => {
      const bt = e.currentTarget, tit = cx.querySelector('#gt-rec-tit').value.trim();
      if (tit.length < 3) return B7.UI.toast('Escreva o título do recado', { tipo: 'erro' });
      bt.disabled = true;
      try {
        await B7.DB.rpc('recado_salvar', { p_client: cx.querySelector('#gt-rec-cli').value || null, p_tipo: cx.querySelector('#gt-rec-tipo').value,
          p_titulo: tit, p_texto: cx.querySelector('#gt-rec-tx').value.trim() || null, p_ate: cx.querySelector('#gt-rec-ate').value || null });
        B7.UI.toast('Recado publicado no portal'); recados(cx);
      } catch (err) { bt.disabled = false; B7.UI.toast(err.message || 'Não foi possível publicar.', { tipo: 'erro' }); }
    };
    cx.querySelectorAll('[data-rec-arq]').forEach(b => b.onclick = async () => {
      try { await B7.DB.rpc('recado_arquivar', { p_id: b.dataset.recArq }); B7.UI.toast('Recado tirado do ar'); recados(cx); }
      catch (err) { B7.UI.toast(err.message || 'Não foi possível.', { tipo: 'erro' }); }
    });
  }

  return { abrir };
})();
