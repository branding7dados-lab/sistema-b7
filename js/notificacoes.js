/* =====================================================================
   NOTIFICAÇÕES — sino no topo

   A verdade mora na tabela notificacoes (uma por evento e pessoa). O
   sino consulta o banco ao abrir, a cada 60 s e quando a aba volta a
   ficar visível; se o Realtime estiver disponível, ele só antecipa a
   consulta. Perder uma mensagem do Realtime nunca perde a notificação.

   Quem recebe cada aviso é decidido no banco (notif_entregar, ver
   migration_notificacoes_inteligentes.sql): atribuído/responsável,
   função operacional ou admin que escolheu acompanhar. Aqui só se
   mostra o que chegou.

   Estados do badge:
     carregando → antes da primeira resposta do banco (nada de "0" falso)
     número     → não lidas
     escondido  → zero

   Um único canal Realtime por sessão: montar() pode ser chamado várias
   vezes (cada pintarSessao), e só a primeira assina.

   Ao chegar notificação nova: som curto (WebAudio, gerado na hora) e,
   se a aba não estiver em foco, notificação do navegador. As duas
   respeitam as preferências da pessoa (perfis.preferencias) — e ficam
   quietas quando a notificação nasceu silenciosa (a pessoa desligou
   aquele tipo de aviso: fica no sino, não interrompe).
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Notif = (function () {
  const esc = B7.UI.esc;
  const PADRAO = { som: true, navegador: true, push: false };
  let naoLidas = null, timer = null, canal = null, canalDe = null, aberto = false, ligado = false;
  let ultimoAnuncio = 0, ultimoIdAnunciado = null;
  let filtro = 'todas';

  /* ------------------------------------------------------ preferências */
  function prefs() {
    const u = B7.Auth && B7.Auth.usuario();
    const p = (u && u.preferencias && typeof u.preferencias === 'object') ? u.preferencias : {};
    return Object.assign({}, PADRAO, p);
  }
  async function gravarPrefs(patch) {
    const novas = await B7.DB.gravarPreferencias(patch);
    const u = B7.Auth && B7.Auth.usuario();
    if (u) u.preferencias = Object.assign({}, u.preferencias || {}, novas || patch);
    return prefs();
  }

  /* ------------------------------------------- o que avisa cada pessoa
     Espelho de notif_pref_ativa() no banco: tudo ligado por padrão,
     menos o que é acompanhamento amplo. As chaves são as mesmas que
     perfil_preferencias_gravar aceita. */
  const DESLIGADO_POR_PADRAO = ['adm_revisoes', 'adm_tudo', 'resumo_diario'];
  function prefTipo(chave) {
    const n = prefs().notif;
    if (n && typeof n[chave] === 'boolean') return n[chave];
    return !DESLIGADO_POR_PADRAO.includes(chave);
  }
  function gravarPrefTipo(chave, v) { return gravarPrefs({ notif: { [chave]: !!v } }); }

  /* Só aparece o grupo da função que a pessoa tem (papel ou função
     extra — multifunção vê a soma). Nada de opção de Designer para quem
     não é Designer. */
  function tenho(funcao) {
    const A = B7.Auth;
    if (!A || !A.papel) return false;
    return A.papel() === funcao || (A.funcoesExtra ? A.funcoesExtra() : []).includes(funcao);
  }
  const GRUPOS = [
    { id: 'meu', titulo: 'Meu trabalho', quem: () => true, itens: [
      ['atribuicoes', 'Atribuições a mim', 'Demandas, peças e gravações que passam a ser minhas.'],
      ['prazos', 'Meus prazos', 'Entrega marcada para amanhã.'],
      ['atrasos', 'Meus atrasos', 'Quando o prazo passa — e de novo se continuar atrasado.'],
      ['correcoes', 'Correções e ajustes', 'Pedidos da equipe ou do cliente no que eu produzo.'],
      ['aprovacoes', 'Aprovações do meu trabalho', 'O cliente ou a revisão interna aprovou.']
    ] },
    { id: 'video', titulo: 'Gravações', quem: () => tenho('videomaker'), itens: [
      ['grav_lembretes', 'Lembretes de gravação', 'Na véspera e uma hora antes.'],
      ['grav_mudancas', 'Gravações remarcadas ou canceladas', 'Das gravações em que sou o responsável.'],
      ['roteiros_prontos', 'Roteiros prontos para gravar', 'Das gravações em que sou o responsável.']
    ] },
    { id: 'design', titulo: 'Design', quem: () => tenho('designer'), itens: [
      ['design_disponivel', 'Novas demandas disponíveis', 'Linha editorial concluída sem designer definido.']
    ] },
    { id: 'coord', titulo: 'Coordenação', quem: () => tenho('coordenador'), itens: [
      ['co_revisoes', 'Aguardando revisão', 'Roteiros, linhas editoriais, peças de Design e vídeos enviados para revisar.'],
      ['co_aprovacoes', 'Decisões dos clientes', 'Aprovações, pedidos de ajuste e recusas.'],
      ['co_producao', 'Andamento da produção', 'Vídeo entregue, designer assumiu uma peça.'],
      ['co_escalados', 'Atrasos escalados', 'Demanda que continua atrasada dois dias depois do prazo.']
    ] },
    { id: 'geral', titulo: 'Agenda e resumo', quem: () => true, itens: [
      ['agenda', 'Compromissos da agenda', 'Reuniões e apresentações das agendas com lembrete ligado.'],
      ['resumo_diario', 'Resumo diário', 'Um aviso às 8h com os prazos do dia e as gravações de amanhã. Só sai quando há algo.']
    ] },
    { id: 'admin', titulo: 'Acompanhar a operação', quem: () => tenho('admin'),
      nota: 'Ser administrador não faz você receber tudo. Ligue só o que quer acompanhar.', itens: [
      ['adm_atrasos', 'Atrasos críticos', 'Demandas atrasadas há 5 dias ou mais.'],
      ['adm_revisoes', 'Revisões pendentes da agência', 'O mesmo que a coordenação recebe em "Aguardando revisão".'],
      ['adm_tudo', 'Todas as movimentações da agência', 'Tudo, de todo mundo. Costuma ser muito aviso.']
    ] }
  ];
  /* grupos que valem para a pessoa logada (cliente do Portal não tem nenhum) */
  function grupos() {
    const A = B7.Auth;
    if (!A || !A.papel || A.papel() === 'cliente') return [];
    return GRUPOS.filter(g => g.quem());
  }

  /* --------------------------------------------------- filtros do sino
     Poucas categorias, e só as que existem nos dados. O tipo é o mesmo
     nome semântico do evento no banco e no push. */
  const FILTROS = [
    ['todas', 'Todas', null],
    ['atribuicoes', 'Atribuições', ['video.atribuida', 'design.atribuida', 'design.criada', 'gravacao.atribuida',
      'linha.concluida', 'linha.briefing_atualizado', 'roteiro.pronto']],
    ['prazos', 'Prazos', ['video.prazo_amanha', 'video.atrasado', 'video.atrasado_escalado', 'video.atrasado_critico',
      'design.prazo_amanha', 'design.atrasado', 'design.atrasado_escalado', 'design.atrasado_critico',
      'design.revisao_parada', 'design.cliente_parado',
      'agenda.gravacao_24h', 'agenda.gravacao_1h', 'agenda.apresentacao_24h', 'agenda.apresentacao_1h',
      'agenda.reuniao_24h', 'agenda.reuniao_1h', 'agenda.outro_24h', 'agenda.outro_1h',
      'gravacao.remarcada', 'gravacao.cancelada', 'resumo.diario']],
    ['correcoes', 'Correções', ['video.correcao_solicitada', 'design.ajuste_solicitado', 'design.cliente_ajustes',
      'design.cliente_recusado', 'aprovacao.ajustes', 'aprovacao.recusada', 'parte.ajustes']],
    ['aprovacoes', 'Aprovações', ['aprovacao.aprovada', 'aprovacao.enviada', 'aprovacao.anulada', 'parte.aprovada',
      'parte.anulada', 'design.cliente_aprovado', 'design.cliente_pendente', 'design.cliente_parcial',
      'design.aprovado_interno', 'design.versao_enviada', 'design.finalizado',
      'video.aguardando_aprovacao', 'video.aprovado_cliente', 'video.entregue', 'roteiro.revisao', 'linha.revisao']]
  ];
  const tiposDoFiltro = () => { const f = FILTROS.find(x => x[0] === filtro); return f ? f[2] : null; };

  /* -------------------------------------------------------------- sino */
  function montar() {
    if (!B7.Auth || !B7.Auth.usuario()) return;
    document.querySelectorAll('.topo .area-sessao').forEach(area => {
      if (area.previousElementSibling && area.previousElementSibling.classList.contains('sino')) return;
      const bt = document.createElement('button');
      bt.className = 'ico sino'; bt.title = 'Notificações'; bt.setAttribute('aria-label', 'Notificações');
      bt.type = 'button'; bt.setAttribute('aria-haspopup', 'dialog'); bt.setAttribute('aria-expanded', 'false');
      bt.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
        '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg><span class="sino-n"></span>';
      bt.onclick = e => { e.stopPropagation(); alternar(bt); };
      area.parentNode.insertBefore(bt, area);
    });
    pintarBadge();
    if (!ligado) {
      ligado = true;
      document.addEventListener('click', e => { if (aberto && !e.target.closest('.sino-painel') && !e.target.closest('.sino')) fechar(); });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizar(); });
      window.addEventListener('online', atualizar);
      window.addEventListener('hashchange', fechar);
      /* Esc fecha o painel e devolve o foco ao sino */
      document.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || !aberto) return;
        fechar();
        const s = document.querySelector('.tela.ativa .sino') || document.querySelector('.sino');
        if (s) s.focus();
      });
      timer = setInterval(atualizar, 60000);
      avisarLoteAoEntrar();
    }
    realtime();
    atualizar();
  }

  /* ----------------------------------------- som de "voltei, tem coisa nova"
     Toca no máximo UMA vez por lote genuinamente novo acumulado enquanto a
     pessoa estava fora (offline, outra aba, sessão anterior) — nunca de
     novo para notificações que o reload já contabilizou. A marca d'água
     (perfis.preferencias.ultimo_som_em) é persistida no banco para
     sobreviver a reload e valer em qualquer dispositivo/login; nada aqui
     marca a notificação como lida. */
  async function avisarLoteAoEntrar() {
    try {
      const u = await B7.DB.ultimaNaoLida();
      if (!u) return;
      const p = prefs();
      const marca = p.ultimo_som_em ? Date.parse(p.ultimo_som_em) : 0;
      const criada = Date.parse(u.created_at);
      if (!(criada > marca)) return;      /* já contabilizada em login/reload anterior */
      if (p.som) tocarSom();
      try { await gravarPrefs({ ultimo_som_em: u.created_at }); } catch (e) {}
    } catch (e) {}
  }

  function pintarBadge() {
    const carregando = naoLidas === null;
    document.querySelectorAll('.sino').forEach(b => {
      b.classList.toggle('carregando', carregando);
      b.classList.toggle('tem', !carregando && naoLidas > 0);
      b.title = carregando ? 'Notificações (carregando…)' : naoLidas ? naoLidas + ' não lida(s)' : 'Notificações';
      /* o número não depende só da cor: vai por extenso no nome acessível */
      b.setAttribute('aria-label', carregando ? 'Notificações, carregando'
        : naoLidas ? 'Notificações: ' + naoLidas + (naoLidas === 1 ? ' não lida' : ' não lidas') : 'Notificações: nenhuma não lida');
      const n = b.querySelector('.sino-n');
      if (!n) return;
      if (carregando) { n.textContent = ''; n.hidden = false; n.setAttribute('aria-label', 'carregando'); return; }
      n.removeAttribute('aria-label');
      n.textContent = naoLidas > 99 ? '99+' : String(naoLidas);
      n.hidden = !naoLidas;
    });
  }

  async function atualizar() {
    if (!B7.Auth || !B7.Auth.usuario() || !navigator.onLine) return;
    let n;
    try { n = await B7.DB.notificacoesNaoLidas(); } catch (e) { return; }
    const antes = naoLidas;
    naoLidas = n;
    pintarBadge();
    /* subiu sem passar pelo Realtime (polling ou aba voltando): anuncia a
       mais recente, uma vez só */
    if (antes !== null && n > antes && Date.now() - ultimoAnuncio > 3000) {
      try {
        const [ultima] = await B7.DB.notificacoes({ limite: 1 });
        if (ultima && !ultima.lida_em) anunciar(ultima);
      } catch (e) {}
    }
    if (aberto) listar();
  }

  /* --------------------------------------------------------- realtime */
  function realtime() {
    try {
      const u = B7.Auth.usuario();
      if (!B7.sb || !B7.sb.channel || !u) return;
      if (canal && canalDe === u.id) return;          /* já assinado nesta sessão */
      if (canal) { B7.DB.fecharCanal(canal); canal = null; }
      canalDe = u.id;
      canal = B7.DB.canal('notif-' + u.id, [
        { event: 'INSERT', table: 'notificacoes', filter: 'destinatario_id=eq.' + u.id }
      ], p => {
        const nova = p && p.new;
        if (nova && nova.id) anunciar(nova);
        atualizar();
      });
    } catch (e) { canal = null; /* sem realtime: o polling cobre */ }
  }

  /* --------------------------------------------- som + aviso do navegador */
  /* O Realtime entrega a linha crua de `notificacoes`, que só tem
     client_id — o nome e a logo vêm daqui, com cache em memória pra não
     consultar o mesmo cliente a cada aviso. Quem chega pelo polling já
     vem da view, com tudo, e passa direto. */
  const cacheClientes = new Map();
  async function comCliente(n) {
    if (!n || !n.client_id || n.cliente_nome) return n;
    if (cacheClientes.has(n.client_id)) return Object.assign({}, n, cacheClientes.get(n.client_id));
    try {
      const c = await B7.DB.clienteParaAviso(n.client_id);
      if (c) { cacheClientes.set(n.client_id, c); return Object.assign({}, n, c); }
    } catch (e) {}
    return n;
  }

  const silenciosa = n => !!(n && n.dados && typeof n.dados === 'object' && n.dados.silenciosa);

  /* Um aviso por notificação: o mesmo id nunca toca duas vezes, venha do
     Realtime, do polling ou de uma reconexão. */
  async function anunciar(bruta) {
    if (!bruta || bruta.id === ultimoIdAnunciado) return;
    ultimoIdAnunciado = bruta.id; ultimoAnuncio = Date.now();
    if (silenciosa(bruta)) return;        /* a pessoa desligou este tipo: só o sino */
    /* exemplo de teste: só o push do aparelho, sem som nem aviso do sistema aberto */
    if (bruta.dados && typeof bruta.dados === 'object' && bruta.dados.teste) return;
    const p = prefs();
    if (p.som) tocarSom();
    const n = await comCliente(bruta);
    if (p.navegador && document.hidden) avisarNavegador(n);
  }

  let ctx = null;
  function tocarSom() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = ctx || new AC();
      if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); }
      if (ctx.state !== 'running') return;   /* sem gesto do usuário o navegador não deixa tocar */
      const t0 = ctx.currentTime;
      /* duas notas curtas, suaves: aviso, não alarme */
      [[880, 0], [1174.7, 0.11]].forEach(([f, dt]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + dt);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + dt + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.22);
        o.connect(g); g.connect(ctx.destination);
        o.start(t0 + dt); o.stop(t0 + dt + 0.25);
      });
    } catch (e) {}
  }

  /* Mesmo formato do push (sw.js): o título é o que aconteceu e o corpo
     traz cliente · item · contexto — os dois já vêm prontos do banco.
     Mesma tag que o service worker usa: o navegador substitui em vez de
     mostrar duas vezes o mesmo aviso. */
  function avisarNavegador(n) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const nt = new Notification(n.titulo || 'Sistema B7', {
        body: [n.cliente_nome, n.mensagem].filter(Boolean).join(' · '), tag: 'b7-notif-' + n.id,
        icon: n.cliente_logo_url || 'assets/icons/icon-192.png', badge: 'assets/icons/badge-96.png'
      });
      nt.onclick = () => { try { window.focus(); } catch (e) {} if (n.link) location.hash = n.link; nt.close(); };
    } catch (e) {}
  }

  /* pede a permissão do navegador (só depois de um clique da pessoa) */
  async function pedirPermissao() {
    if (!('Notification' in window)) throw new Error('Este navegador não suporta notificações.');
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') throw new Error('As notificações foram bloqueadas para este site. Libere nas configurações do navegador.');
    const r = await Notification.requestPermission();
    return r === 'granted';
  }

  /* ------------------------------------------------------------ painel */
  function alternar(bt) { aberto ? fechar() : abrirPainel(bt); }
  function fechar() {
    const p = document.querySelector('.sino-painel'); if (p) p.remove(); aberto = false;
    document.querySelectorAll('.sino').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  async function abrirPainel(bt) {
    fechar(); aberto = true; filtro = 'todas';
    bt.setAttribute('aria-expanded', 'true');
    /* o primeiro clique no sino também "desbloqueia" o áudio */
    try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { ctx = ctx || new AC(); ctx.resume().catch(() => {}); } } catch (e) {}
    const p = document.createElement('div');
    p.className = 'sino-painel';
    p.innerHTML = '<div class="sino-cab"><b>Notificações</b>' +
      '<button class="b fina" id="sino-todas">Marcar todas como lidas</button></div>' +
      '<div class="sino-filtros" role="group" aria-label="Filtrar notificações">' +
        FILTROS.map(f => '<button type="button" data-filtro="' + f[0] + '" aria-pressed="' + (f[0] === filtro) + '">' + f[1] + '</button>').join('') +
      '</div>' +
      '<div class="sino-lista"><div class="b7-load"><div class="simbolo"></div></div></div>' +
      '<div class="sino-pe"><button class="b fina" id="sino-mais">Carregar mais</button>' +
      '<button class="b fina" id="sino-prefs" title="O que te avisa, som e push">Preferências</button></div>';
    const r = bt.getBoundingClientRect();
    p.style.top = (r.bottom + 8) + 'px';
    /* no celular o CSS fixa left/right (folha de largura total) —
       calcular `right` a partir do sino só faz sentido no desktop */
    if (window.innerWidth > 600) p.style.right = Math.max(12, window.innerWidth - r.right) + 'px';
    document.body.appendChild(p);
    p.querySelector('#sino-todas').onclick = async () => {
      try { await B7.DB.marcarTodasLidas(); await atualizar(); listar(); } catch (e) {}
    };
    p.querySelectorAll('[data-filtro]').forEach(b => b.onclick = () => {
      filtro = b.dataset.filtro;
      p.querySelectorAll('[data-filtro]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      listar();
    });
    p.querySelector('#sino-mais').onclick = () => listar(true);
    p.querySelector('#sino-prefs').onclick = () => { fechar(); if (B7.Perfil) B7.Perfil.abrir('notificacoes'); };
    listar();
  }

  /* Logo do cliente no item do sino — mesma ideia da Produção de Vídeo:
     imagem quando existe, iniciais quando não. Aviso que não é de cliente
     nenhum (resumo, agenda sem gravação) leva o símbolo da B7: a coluna
     não fica com buraco e dá pra ver na hora que é do sistema. */
  function logoClienteHTML(n) {
    if (!n.cliente_nome) return '<span class="sino-logo sino-logo-b7" aria-hidden="true"></span>';
    if (n.cliente_logo_url) {
      /* data-ini vira o conteúdo se a imagem falhar (logo apagada do
         bucket, rede ruim) — melhor as iniciais do que ícone quebrado. */
      return '<img class="sino-logo" src="' + esc(n.cliente_logo_url) + '" alt="" loading="lazy" ' +
        'data-ini="' + esc(B7.UI.iniciais ? B7.UI.iniciais(n.cliente_nome) : '') + '">';
    }
    const ini = B7.UI.iniciais ? B7.UI.iniciais(n.cliente_nome) : n.cliente_nome.slice(0, 2).toUpperCase();
    return '<span class="sino-logo sino-logo-vazia">' + esc(ini) + '</span>';
  }

  let ultimas = [], pedido = 0;
  async function listar(mais) {
    const p = document.querySelector('.sino-painel'); if (!p) return;
    const lista = p.querySelector('.sino-lista');
    const meu = ++pedido;       /* troca rápida de filtro: só a última resposta pinta */
    try {
      const novas = await B7.DB.notificacoes({
        limite: 20, tipos: tiposDoFiltro(),
        antesDe: mais && ultimas.length ? ultimas[ultimas.length - 1].created_at : null
      });
      if (meu !== pedido) return;
      ultimas = mais ? ultimas.concat(novas) : novas;
      p.querySelector('#sino-mais').hidden = novas.length < 20;
    } catch (e) {
      if (meu !== pedido) return;
      lista.innerHTML = '<div class="sino-vazio">Não foi possível carregar. <small>' + esc(e.message || '') + '</small></div>';
      return;
    }
    if (!ultimas.length) {
      lista.innerHTML = filtro === 'todas'
        ? '<div class="sino-vazio"><b>Nada por aqui.</b><small>O que for atribuído a você, seus prazos e as decisões do seu trabalho aparecem nesta lista.</small></div>'
        : '<div class="sino-vazio"><b>Nada nesta categoria.</b><small>Veja em “Todas” o que chegou.</small></div>';
      return;
    }
    lista.innerHTML = ultimas.map(n =>
      '<a class="sino-item' + (n.lida_em ? '' : ' nova') + '" data-id="' + esc(n.id) + '" href="' + esc(B7.UI.linkInterno(n.link)) + '">' +
        '<span class="sino-ponto"></span>' +
        logoClienteHTML(n) +
        '<span class="sino-tx">' +
          (n.cliente_nome ? '<i class="sino-cliente">' + esc(n.cliente_nome) + '</i>' : '') +
          '<b>' + esc(n.titulo) + '</b>' + (n.mensagem ? '<p>' + esc(n.mensagem) + '</p>' : '') +
        '<small>' + esc(B7.UI.quando(n.created_at)) + '</small></span></a>').join('');
    lista.querySelectorAll('img.sino-logo').forEach(img => {
      img.onerror = () => {
        const v = document.createElement('span');
        v.className = 'sino-logo sino-logo-vazia';
        v.textContent = img.dataset.ini || '';
        img.replaceWith(v);
      };
    });
    lista.querySelectorAll('.sino-item').forEach(a => a.onclick = async () => {
      if (a.classList.contains('nova')) {
        a.classList.remove('nova');
        try { await B7.DB.marcarLida(a.dataset.id); } catch (e) {}
        atualizar();
      }
      fechar();
    });
  }

  return { montar, atualizar, fechar, prefs, gravarPrefs, pedirPermissao, tocarSom, anunciar, PADRAO,
           prefTipo, gravarPrefTipo, grupos };
})();
