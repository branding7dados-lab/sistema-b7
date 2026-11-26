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
  let aba = 'geral', dados = null, params0 = null;

  const painel = () => document.getElementById('painel-dashboard');
  const num = v => (v == null ? '—' : Number(v).toLocaleString('pt-BR'));

  async function abrir(params) {
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/gestao');
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['Gestão']);
    if (params && params.get && params.get('aba')) aba = params.get('aba');
    params0 = params || null;
    if (!B7.Auth.ehAdmin()) { painel().innerHTML = '<div class="conteudo"><div class="estado-b7"><b>Só o administrador abre a Gestão.</b></div></div>'; return; }
    /* Espectro: o rótulo acima do título diz onde se está (na Visão geral, "Só administração · mês") */
    const ABAS = [['geral', 'Visão geral'], ['riscos', 'Clientes em risco'], ['contratado', 'Contratado × entregue'], ['prazos', 'Prazos e retrabalho'], ['pacotes', 'Serviços contratados'], ['equipe', 'Equipe'], ['saude', 'Saúde dos clientes'], ['avulsos', 'Avulsos'], ['pedidos', 'Pedidos'], ['recados', 'Recados']];
    const sobre = () => aba === 'geral' ? 'Só administração · ' + new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : (ABAS.find(a => a[0] === aba) || ABAS[0])[1];
    painel().innerHTML = '<div class="conteudo entra gs">' +
      '<div class="cb-topo"><div class="cb-titulo"><p class="v4-sobre" data-gt-sobre>' + esc(sobre()) + '</p><h1>Gestão</h1></div></div>' +
      '<div class="filtro rolavel gt-abas" role="tablist">' + ABAS.filter(([k]) => (k !== 'avulsos' || B7.Projetos) && (k !== 'equipe' || B7.Colaboradores) && (!['riscos', 'contratado', 'prazos'].includes(k) || B7.GestaoExtra) && (k !== 'pacotes' || B7.Pacotes)).map(([k, r]) =>
        '<button role="tab" data-aba="' + k + '" class="' + (aba === k ? 'on' : '') + '" aria-selected="' + (aba === k) + '">' + r + '<span class="gt-n" data-n-' + k + '></span></button>').join('') + '</div>' +
      '<div id="gt-corpo">' + B7.UI.skeleton('lista', { n: 4 }) + '</div></div>';
    painel().querySelectorAll('[data-aba]').forEach(b => b.onclick = () => {
      aba = b.dataset.aba;
      painel().querySelectorAll('[data-aba]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      try { history.replaceState(null, '', '#/gestao?aba=' + aba); } catch (e) {}
      painel().querySelector('[data-gt-sobre]').textContent = sobre();
      params0 = null;
      pintar();
    });
    const vale = B7.Rota.marca();
    try { dados = (await B7.DB.rpc('gestao_painel', {})) || {}; }
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
    const corpo = document.getElementById('gt-corpo');
    if (!corpo || !dados) return;
    /* 4.78.3 (QA): cada aba pinta numa caixa nova. Trocar de aba rápido deixava a resposta atrasada da aba
       anterior (Equipe, Avulsos, Recados carregam depois) escrever por cima da aba marcada; agora ela cai numa
       caixa que já saiu da tela. */
    corpo.innerHTML = '';
    const cx = document.createElement('div');
    corpo.appendChild(cx);
    if (aba === 'recados') return recados(cx);
    /* 4.87.0: abas novas (js/gestao-extra.js) */
    if (aba === 'contratado' && B7.GestaoExtra) return B7.GestaoExtra.contratado(cx);
    if (aba === 'riscos' && B7.GestaoExtra) return B7.GestaoExtra.riscos(cx);
    if (aba === 'prazos' && B7.GestaoExtra) return B7.GestaoExtra.prazos(cx);
    /* 4.88.0: os pacotes que a B7 vende (o mesmo editor das Configurações) */
    if (aba === 'pacotes' && B7.Pacotes) return B7.Pacotes.montar(cx, { gestao: true });
    /* zzz302: entregas de cada pessoa da equipe (js/colaboradores.js) */
    if (aba === 'equipe' && B7.Colaboradores) return B7.Colaboradores.montar(cx, params0);
    /* zzz274: projetos avulsos — fora da saúde (não têm mês), com o seu próprio quadro */
    if (aba === 'avulsos' && B7.Projetos) return B7.Projetos.montarGestao(cx);
    cx.innerHTML = aba === 'saude' ? saude() : aba === 'pedidos' ? pedidos() : geral();
    cx.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { location.hash = b.dataset.ir; });
    const ia = cx.querySelector('[data-ia-riscos]');
    if (ia) ia.onclick = () => B7.IAFerramentas.riscos(cx.querySelector('#gt-ia'));
  }

  /* zzz267: a IA lê a saúde dos clientes e diz o que olhar primeiro */
  const iaBloco = () => B7.IAFerramentas && B7.IAFerramentas.ligada()
    ? '<div id="gt-ia"><button type="button" class="gt-ia-bt" data-ia-riscos><span aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/></svg></span><b>O que olhar primeiro?</b><small>A IA lê os números e a saúde de cada cliente e te diz por onde começar.</small></button></div>' : '';

  /* ------------------------------------------------------ visão geral */
  function geral() {
    const k = dados.kpis || {};
    const varia = k.entregas_ant ? Math.round(100 * (k.entregas_mes - k.entregas_ant) / k.entregas_ant) : null;
    const dia = new Date((dados.hoje || '') + 'T12:00:00');
    const fracao = dia.getDate() / new Date(dia.getFullYear(), dia.getMonth() + 1, 0).getDate();
    const ritmo = k.entregas_ant && fracao ? Math.round(100 * (k.entregas_mes / fracao - k.entregas_ant) / k.entregas_ant) : null;
    /* Espectro: quatro cartões de cor cheia; os outros números do mês vão para "Destaques" */
    const card = (cor, l, v, sub, ir) => '<' + (ir ? 'button type="button" data-ir="' + ir + '"' : 'div') + ' class="gt-kpi gt-k-' + cor + '"><i class="gt-k-luz" aria-hidden="true"></i><span>' + l + '</span><b>' + v + '</b>' +
      (sub ? '<small>' + sub + '</small>' : '') + '</' + (ir ? 'button' : 'div') + '>';
    const ic = (d, cor) => '<svg class="gt-dq-ic ' + cor + '" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
    const IC = { sobe: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>', alerta: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
      estrela: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>', pessoas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7"/><path d="M18 14.7c1.9.7 3.1 2.5 3.5 5.3"/>',
      ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.8 2.8L16.5 9"/>', pedido: '<path d="M4 5h16v11H9l-5 4z"/>' };
    const dq = (svg, tx, ir) => '<' + (ir ? 'button type="button" data-ir="' + ir + '"' : 'p') + ' class="gt-dq">' + svg + '<span>' + tx + '</span></' + (ir ? 'button' : 'p') + '>';
    const verdes = (dados.clientes || []).filter(c => c.cor === 'verde').length;
    return iaBloco() + '<div class="gt-kpis gt-kpis-cor">' +
      card('violeta', 'Clientes ativos', num(k.clientes), (dados.clientes || []).length ? verdes + ' com a saúde no verde' : '', '#/clientes') +
      card('matriz', 'Peças entregues', num(k.entregas_mes), varia == null || ritmo == null ? 'no mês' : 'ritmo ' + Math.abs(ritmo) + '% ' + (ritmo >= 0 ? 'acima' : 'abaixo') + ' do mês passado') +
      card('matriz', 'Entregas atrasadas', num(k.atrasos), k.atrasos ? 'design e vídeo com prazo vencido' : 'nada atrasado', '#/kanban') +
      card('coral', 'Clientes em risco', num(k.saude_vermelho || 0), 'Ver aba', '#/gestao?aba=' + (B7.GestaoExtra ? 'riscos' : 'saude')) +
    '</div>' +
    '<div class="gt-duo">' +
    '<section class="gt-bloco gt-bloco-graf"><div class="gt-bloco-cab"><h2>Entregas por mês</h2></div>' + grafico(dados.serie || []) + '</section>' +
    '<section class="gt-bloco gt-dest"><div class="gt-bloco-cab"><h2>Destaques</h2></div>' +
      dq(k.aprov_paradas ? ic(IC.alerta, 'erro') : ic(IC.ok, 'ok'), num(k.aprov_pendentes) + ' aprovações com o cliente' + (k.aprov_paradas ? ' · ' + k.aprov_paradas + ' paradas há 3+ dias' : ''), '#/aprovacoes') +
      dq(ic(IC.pedido, 'matriz'), num(k.pedidos_mes) + ' pedidos no mês' + (k.pedidos_abertos ? ' · ' + k.pedidos_abertos + ' em aberto' : ''), '#/gestao?aba=pedidos') +
      dq(ic(IC.estrela, k.satisfacao_media != null && k.satisfacao_media < 7 ? 'erro' : 'violeta'), k.satisfacao_media == null ? 'Satisfação: a pesquisa abre no dia 20'
        : 'Satisfação do mês ' + String(k.satisfacao_media).replace('.', ',') + (k.respostas ? ' · ' + k.respostas + (k.respostas === 1 ? ' resposta' : ' respostas') : '') + (k.nps != null ? ' · NPS ' + k.nps : '')) +
      dq(ic(IC.pessoas, k.saude_amarelo ? 'ambar' : 'ok'), k.saude_amarelo ? k.saude_amarelo + (k.saude_amarelo === 1 ? ' cliente pede atenção' : ' clientes pedem atenção') : 'Nenhum cliente em atenção', '#/gestao?aba=saude') +
    '</section></div>' +
    '<section class="gt-bloco gt-atencao"><div class="gt-bloco-cab"><h2>Clientes que pedem atenção</h2><button type="button" class="cb-link" data-ir="#/gestao?aba=saude">Ver todos</button></div>' +
      ((dados.clientes || []).filter(c => c.cor !== 'verde').slice(0, 5).map(linhaCliente).join('') ||
        '<p class="gt-vazio">Todos os clientes estão no verde.</p>') + '</section>';
  }

  function grafico(serie) {
    if (!serie.length) return '<p class="gt-vazio">Sem dados ainda.</p>';
    const max = Math.max(1, ...serie.map(s => s.design + s.video + s.publicados));
    return '<div class="gt-graf" role="img" aria-label="Entregas por mês nos últimos 6 meses">' + serie.map(s => {
      const tot = s.design + s.video + s.publicados, [a, m] = s.mes.split('-');
      const h = v => (100 * v / max).toFixed(1) + '%';
      return '<div class="gt-col" style="--tot:' + h(tot) + '" title="' + MESES[+m - 1] + '/' + a.slice(2) + ': ' + s.design + ' design · ' + s.video + ' vídeo · ' + s.publicados + ' publicados">' +
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
    /* Espectro: um cartão por cliente (a contagem por cor e a regra da nota ficam no rodapé) */
    return iaBloco() + '<section class="gt-bloco gt-lista">' + (l.map(linhaCliente).join('') || '<p class="gt-vazio">Nenhum cliente ativo.</p>') + '</section>' +
      '<p class="gt-nota gt-nota-saude"><span class="gt-sem vermelho"><b>' + conta('vermelho') + '</b> em risco</span><span class="gt-sem amarelo"><b>' + conta('amarelo') + '</b> atenção</span><span class="gt-sem verde"><b>' + conta('verde') + '</b> saudáveis</span>' +
      '<span>A nota começa em 100 e cai com: entregas atrasadas, aprovações paradas há 3+ dias, demora para responder, muitas peças voltando com ajuste, nota baixa na pesquisa e meses sem entregas.</span></p>';
  }

  /* ---------------------------------------------------------- pedidos */
  function pedidos() {
    const k = dados.kpis || {}, l = dados.pedidos || [], pc = dados.pedidos_por_cliente || [];
    const dataBR = iso => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
    /* Espectro: dois cartões lado a lado — os pedidos e, ao lado, os números e quem mais pede */
    return '<div class="gt-duo gt-duo-meio">' +
      '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Pedidos de clientes</h2><p class="gt-sub">Chegam pelo portal</p></div>' + (l.length ? '<div class="gt-peds">' + l.map(p =>
        '<button type="button" class="gt-ped" ' + (p.kanban_id ? 'data-ir="#/kanban/' + esc(p.kanban_id) + '"' : 'disabled') + '>' +
          (B7.UI.avatarCliente ? B7.UI.avatarCliente(p.cliente, p.logo || null, 'sm') : '') +
          '<span class="gt-ped-tx"><b>' + esc(p.titulo) + '</b><small>' + esc(p.cliente) + ' · ' + esc(dataBR(p.created_at)) + (p.para_quando ? ' · para ' + esc(dataBR(p.para_quando + 'T12:00:00')) : '') +
            (p.dias != null ? ' · pronto em ' + String(p.dias).replace('.', ',') + ' d' : '') + '</small></span>' +
          '<span class="gt-sit ' + esc(p.situacao) + '">' + esc(SIT[p.situacao] || p.situacao) + '</span></button>').join('') + '</div>'
        : '<p class="gt-vazio">Nenhum pedido ainda. Os clientes pedem pelo portal, em "Pedidos".</p>') + '</section>' +
      '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Quem mais pede</h2><p class="gt-sub">Últimos 90 dias</p></div>' +
        '<div class="gt-nums">' +
          '<div><b>' + num(k.pedidos_mes) + '</b><span>pedidos no mês</span></div>' +
          '<div class="' + (k.pedidos_abertos ? 'atencao' : '') + '"><b>' + num(k.pedidos_abertos) + '</b><span>em aberto</span></div>' +
          '<div><b>' + (k.pedidos_tempo_medio == null ? '—' : String(k.pedidos_tempo_medio).replace('.', ',') + ' d') + '</b><span>até ficar pronto</span></div></div>' +
        (pc.length ? '<div class="gt-ranking">' +
          pc.slice(0, 8).map(x => '<div><span>' + esc(x.cliente) + '</span><i style="--w:' + (100 * x.total / pc[0].total).toFixed(0) + '%"></i><b>' + x.total + '</b></div>').join('') + '</div>'
          : '<p class="gt-vazio">Ninguém pediu nada nos últimos 90 dias.</p>') + '</section></div>';
  }

  /* ---------------------------------------------------------- recados
     zzz268: avisos da B7 que aparecem no Início do portal do cliente */
  const TIPOS_REC = [['info', 'Aviso'], ['novidade', 'Novidade'], ['feriado', 'Feriado / horário'], ['atencao', 'Atenção']];
  const IC_REC = { info: '<path d="M4 5h16v11H9l-5 4z"/>', novidade: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>',
    feriado: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>', atencao: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>' };
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
    /* Espectro: os recados no ar à esquerda, o novo recado ao lado */
    const tipoDe = r => TIPOS_REC.find(t => t[0] === r.tipo) || TIPOS_REC[0];
    cx.innerHTML = '<div class="gt-duo gt-duo-meio">' +
      '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Recados no ar</h2><p class="gt-sub">Aparecem no Início do portal do cliente</p></div>' + (l.length ? '<div class="gt-recs">' + l.map(r =>
        '<div class="gt-rec"><span class="gt-rec-ic ' + esc(tipoDe(r)[0]) + '" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + IC_REC[tipoDe(r)[0]] + '</svg></span>' +
          '<div><b>' + esc(r.titulo) + '</b>' +
          '<small>' + esc(tipoDe(r)[1]) + ' · ' + esc(nomeCli(r.client_id)) + (r.ate ? ' · até ' + esc(r.ate.split('-').reverse().join('/')) : ' · sem data para sair') + '</small>' +
          (r.texto ? '<p>' + esc(r.texto) + '</p>' : '') + '</div>' +
          '<button type="button" class="b fina contorno" data-rec-arq="' + esc(r.id) + '">Tirar do ar</button></div>').join('') + '</div>'
        : '<p class="gt-vazio">Nenhum recado no ar. Os clientes veem os recados no Início do portal.</p>') + '</section>' +
      '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Novo recado</h2><p class="gt-sub">Publica no portal na hora</p></div>' +
      '<div class="gt-rec-form">' +
        '<select class="campo" id="gt-rec-tipo" aria-label="Tipo do recado">' + TIPOS_REC.map(([k, r]) => '<option value="' + k + '">' + r + '</option>').join('') + '</select>' +
        '<select class="campo" id="gt-rec-cli" aria-label="Para quem"><option value="">Todos os clientes</option>' + cli.map(c => '<option value="' + esc(c.id) + '">' + esc(c.nome) + '</option>').join('') + '</select>' +
        '<input class="campo" id="gt-rec-tit" maxlength="100" placeholder="Título (ex.: Recesso de fim de ano)">' +
        '<textarea class="campo" id="gt-rec-tx" rows="3" maxlength="600" placeholder="Detalhes (opcional)"></textarea>' +
        '<label class="gt-rec-ate">Mostrar até <input class="campo" type="date" id="gt-rec-ate" min="' + hoje + '"></label>' +
        '<button type="button" class="b pri" data-rec-pub>Publicar no portal</button></div></section></div>';
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
