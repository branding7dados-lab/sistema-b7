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
  const DESLIGADO_POR_PADRAO = ['adm_revisoes', 'adm_tudo'];   /* zzz88: o resumo diário passou a vir ligado */
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
      ['grav_lembretes', 'Lembretes de gravação', 'Na véspera e uma hora antes — e na véspera, se ainda houver roteiro em aberto.'],
      ['grav_mudancas', 'Gravações remarcadas ou canceladas', 'Das gravações em que sou o responsável.'],
      ['roteiros_prontos', 'Roteiros prontos para gravar', 'Das gravações em que sou o responsável.']
    ] },
    { id: 'design', titulo: 'Design', quem: () => tenho('designer'), itens: [
      ['design_disponivel', 'Novas demandas disponíveis', 'Linha editorial concluída sem designer definido.']
    ] },
    { id: 'coord', titulo: 'Coordenação', quem: () => tenho('coordenador'), itens: [
      ['co_revisoes', 'Aguardando revisão', 'Roteiros, linhas editoriais, peças de Design e vídeos enviados para revisar — e o que está parado na revisão há 3 dias.'],
      ['co_aprovacoes', 'Decisões dos clientes', 'Aprovações, pedidos de ajuste e recusas.'],
      ['co_producao', 'Andamento da produção', 'Vídeo entregue, designer assumiu uma peça, gravação de amanhã com roteiro em aberto, gravação que passou sem ser concluída.'],
      ['co_escalados', 'Atrasos escalados', 'Demanda que continua atrasada dois dias depois do prazo.']
    ] },
    { id: 'geral', titulo: 'Agenda e resumo', quem: () => true, itens: [
      ['agenda', 'Compromissos da agenda', 'Reuniões e apresentações das agendas com lembrete ligado.'],
      ['resumo_diario', 'Resumo diário', 'Um aviso às 8h com os prazos do dia e as gravações de amanhã. Só sai quando há algo.']
    ] },
    /* zzz121: só para quem tem o módulo Oportunidades (é quem recebe) */
    { id: 'oport', titulo: 'Oportunidades', quem: () => !!(B7.Perm && B7.Perm.podeRota && B7.Perm.podeRota('oportunidades')), itens: [
      ['oportunidades', 'Hoje é dia de…', 'Um aviso às 8h com as datas que começam naquele dia. Só sai quando há alguma.']
    ] },
    { id: 'admin', titulo: 'Acompanhar a operação', quem: () => tenho('admin'),
      nota: 'Ser administrador não faz você receber tudo. Ligue só o que quer acompanhar.', itens: [
      ['adm_atrasos', 'Atrasos críticos', 'Demandas atrasadas há 5 dias ou mais e gravações em risco (roteiro em aberto na véspera, data passada sem conclusão).'],
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
      'gravacao.roteiros_pendentes', 'gravacao.sem_conclusao', 'conteudo.revisao_parada',
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
        /* zzz134: mensagem de conversa tem som e aviso próprios (js/conversas.js) */
        if (nova && nova.tipo === 'chat.mensagem') return;
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
    /* o sino balança uma vez: dá pra ver que chegou, mesmo sem som */
    document.querySelectorAll('.sino').forEach(b => {
      b.classList.remove('toca'); void b.offsetWidth; b.classList.add('toca');
      setTimeout(() => b.classList.remove('toca'), 1200);
    });
    const n = await comCliente(bruta);
    if (p.navegador && document.hidden) avisarNavegador(n);
  }

  /* ------------------------------------------------ sons disponíveis
     Cada um recebe `voz(tipo, hz, quando, volume, ataque, queda, até)`.
     Todos curtos (menos de 1 s) e em volume parecido. */
  const SONS = {
    /* madeira: duas notas arredondadas, lá → ré; some rápido */
    toque(v) {
      v('sine', 880, 0, 0.2, 0.004, 0.16); v('sine', 1760, 0, 0.05, 0.003, 0.06);
      v('sine', 1174.66, 0.1, 0.22, 0.004, 0.24); v('sine', 2349.3, 0.1, 0.05, 0.003, 0.08);
    },
    /* gota: um "ploc" que escorrega para cima */
    gota(v) { v('sine', 520, 0, 0.26, 0.006, 0.2, 1040); v('sine', 1040, 0.02, 0.06, 0.004, 0.1, 1560); },
    /* três notas subindo, no jeito dos celulares */
    tritom(v) { [[783.99, 0], [987.77, 0.1], [1174.66, 0.2]].forEach(([hz, q]) => { v('sine', hz, q, 0.18, 0.004, 0.2); v('triangle', hz, q, 0.04, 0.003, 0.07); }); },
    /* sininho: uma nota só, com cauda */
    sininho(v) { v('sine', 1318.51, 0, 0.2, 0.004, 0.75); v('sine', 2637, 0, 0.05, 0.003, 0.35); v('sine', 3955, 0, 0.02, 0.003, 0.18); },
    /* suave: grave e macio, quase um "hum" */
    suave(v) { v('sine', 440, 0, 0.2, 0.03, 0.34); v('sine', 554.37, 0.09, 0.16, 0.03, 0.4); },
    /* pop: um estalo curto e seco */
    pop(v) { v('sine', 700, 0, 0.3, 0.003, 0.09, 350); },
    /* o de antes da zzz110: dois bipes */
    classico(v) { v('sine', 880, 0, 0.18, 0.015, 0.2); v('sine', 1174.7, 0.11, 0.18, 0.015, 0.2); }
  };
  const NOMES_SONS = [['toque', 'Toque'], ['gota', 'Gota'], ['tritom', 'Três notas'], ['sininho', 'Sininho'], ['suave', 'Suave'], ['pop', 'Pop'], ['classico', 'Clássico (antigo)']];
  const somEscolhido = () => { try { const s = B7.pref && B7.pref.ler ? B7.pref.ler('som_notif', 'toque') : 'toque'; return SONS[s] ? s : 'toque'; } catch (e) { return 'toque'; } };

  let ctx = null;
  function tocarSom(repetindo, qual) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = ctx || new AC();
      /* zzz113: o áudio começa "dormindo" e acorda de forma assíncrona.
         Antes, o primeiro pedido saía mudo (só destravava para o próximo).
         Agora, se acordar em até 1,5 s — caso do botão de teste e de um
         aviso que chega logo depois de um clique —, toca em seguida. Sem
         gesto do usuário o navegador não acorda, e nada toca (como antes). */
      if (ctx.state === 'suspended') {
        const pedido = Date.now();
        ctx.resume().then(() => { if (!repetindo && ctx.state === 'running' && Date.now() - pedido < 1500) tocarSom(true, qual); }).catch(() => {});
      }
      if (ctx.state !== 'running') return;   /* sem gesto do usuário o navegador não deixa tocar */
      const t0 = ctx.currentTime + 0.01;
      /* zzz114 — o Kevin odiou o som de "vidro" da zzz110. Em vez de eu
         chutar outro sem ouvir, o administrador escolhe entre vários em
         Configurações → Aparência, ouvindo cada um. O padrão passou a ser
         "Toque": duas notas curtas e arredondadas, de madeira. */
      const som = SONS[qual] || SONS[somEscolhido()] || SONS.toque;
      const mestre = ctx.createGain(); mestre.gain.value = 0.9; mestre.connect(ctx.destination);
      /* peça básica: um oscilador com ataque e queda */
      const voz = (tipo, hz, quando, vol, ataque, queda, ate) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + quando;
        o.type = tipo; o.frequency.setValueAtTime(hz, t);
        if (ate) o.frequency.exponentialRampToValueAtTime(ate, t + queda * 0.6);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + ataque);
        g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + queda);
        o.connect(g); g.connect(mestre); o.start(t); o.stop(t + ataque + queda + 0.05);
      };
      som(voz);
      setTimeout(() => { try { mestre.disconnect(); } catch (e) {} }, 2200);
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
    /* zzz11: sai encolhendo de volta para o sino em vez de sumir seco */
    document.querySelectorAll('.sino-painel:not(.saindo)').forEach(p => {
      p.classList.add('saindo'); p.removeAttribute('id');
      const fim = () => p.remove();
      p.addEventListener('animationend', fim, { once: true });
      setTimeout(fim, 260);
    });
    aberto = false;
    document.querySelectorAll('.sino').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  async function abrirPainel(bt) {
    fechar(); aberto = true; filtro = 'todas';
    /* zzz58: um painel do topo por vez — fecha o menu da conta/Criar */
    if (B7.Topo && B7.Topo.fecharMenu) B7.Topo.fecharMenu(false);
    if (B7.UI && B7.UI.fecharMenus) B7.UI.fecharMenus();
    bt.setAttribute('aria-expanded', 'true');
    /* o primeiro clique no sino também "desbloqueia" o áudio */
    try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { ctx = ctx || new AC(); ctx.resume().catch(() => {}); } } catch (e) {}
    const p = document.createElement('div');
    p.className = 'sino-painel';
    p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Notificações');
    p.innerHTML = '<div class="sino-cab"><div class="sino-cab-tx"><b>Notificações</b><span class="sino-cab-n" id="sino-cab-n"></span></div>' +
      '<button type="button" class="sino-acao" id="sino-todas" title="Marcar todas como lidas">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12.5l4 4 8-9M10.5 16.5l1 1 8.5-10"/></svg><span>Marcar lidas</span></button>' +
      '<button type="button" class="sino-acao so-ic" id="sino-prefs" title="Preferências: o que te avisa, som e push" aria-label="Preferências de notificação">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button></div>' +
      '<div class="sino-filtros" role="group" aria-label="Filtrar notificações">' +
        FILTROS.map(f => '<button type="button" data-filtro="' + f[0] + '" aria-pressed="' + (f[0] === filtro) + '">' + f[1] + '</button>').join('') +
      '</div>' +
      '<div class="sino-lista">' + esqueleto() + '</div>' +
      '<div class="sino-pe" hidden><button class="sino-mais" id="sino-mais">Carregar mais</button></div>';
    const r = bt.getBoundingClientRect();
    p.style.top = (r.bottom + 8) + 'px';
    /* no celular o CSS fixa left/right (folha de largura total) —
       calcular `right` a partir do sino só faz sentido no desktop */
    if (window.innerWidth > 600) p.style.right = Math.max(12, window.innerWidth - r.right) + 'px';
    document.body.appendChild(p);
    p.querySelector('#sino-todas').onclick = async () => {
      /* os pontos apagam em onda antes de a lista ser relida */
      p.querySelectorAll('.sino-item.nova').forEach((a, i) => setTimeout(() => a.classList.remove('nova'), i * 35));
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

  /* tipo do aviso → família (a mesma divisão dos filtros), para o selo */
  function categoria(tipo) {
    for (const f of FILTROS) if (f[2] && f[2].includes(tipo)) return f[0];
    if (/^agenda\.|^resumo\./.test(tipo || '')) return 'prazos';
    return 'outro';
  }
  const SVG = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  const ICONE = {
    atribuicoes: SVG('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
    prazos: SVG('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    correcoes: SVG('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
    aprovacoes: SVG('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    outro: SVG('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/>'),
    sino: SVG('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>')
  };
  const inicioDia = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  function rotuloDia(iso) {
    const dias = Math.round((inicioDia(Date.now()) - inicioDia(iso)) / 864e5);
    if (dias <= 0) return 'Hoje';
    if (dias === 1) return 'Ontem';
    if (dias < 7) return 'Esta semana';
    if (dias < 31) return 'Este mês';
    return 'Mais antigas';
  }
  /* hora curta à direita: 14:32 hoje, "ontem", "3 d", "12/09" */
  function curto(iso) {
    const d = new Date(iso), dias = Math.round((inicioDia(Date.now()) - inicioDia(iso)) / 864e5);
    const min = Math.round((Date.now() - d) / 6e4);
    if (min < 1) return 'agora';
    if (min < 60) return min + ' min';
    if (dias <= 0) return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (dias === 1) return 'ontem';
    if (dias < 7) return dias + ' d';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  }
  const esqueleto = () => Array.from({ length: 4 }, (_, i) =>
    '<div class="sino-esq" style="--i:' + i + '"><span></span><div><i></i><i></i><i></i></div></div>').join('');

  let ultimas = [], pedido = 0;
  async function listar(mais) {
    const p = document.querySelector('.sino-painel:not(.saindo)'); if (!p) return;
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
        ? '<div class="sino-vazio"><span class="sino-vazio-ic" aria-hidden="true">' + ICONE.sino + '</span><b>Tudo em dia.</b><small>O que for atribuído a você, seus prazos e as decisões do seu trabalho aparecem aqui.</small></div>'
        : '<div class="sino-vazio"><span class="sino-vazio-ic" aria-hidden="true">' + ICONE.sino + '</span><b>Nada nesta categoria.</b><small>Veja em “Todas” o que chegou.</small></div>';
      const pe = p.querySelector('.sino-pe'); if (pe) pe.hidden = true;
      return;
    }
    /* zzz11: agrupado por dia, com o tipo do aviso num selo sobre a logo */
    let ultimoDia = null, i = 0;
    lista.innerHTML = ultimas.map(n => {
      const dia = rotuloDia(n.created_at);
      const cab = dia !== ultimoDia ? '<div class="sino-dia" style="--i:' + Math.min(i++, 14) + '">' + dia + '</div>' : '';
      ultimoDia = dia;
      const cat = categoria(n.tipo);
      return cab +
      '<a class="sino-item' + (n.lida_em ? '' : ' nova') + '" data-id="' + esc(n.id) + '" href="' + esc(B7.UI.linkInterno(n.link)) + '" style="--i:' + Math.min(i++, 14) + '">' +
        '<span class="sino-av">' + logoClienteHTML(n) +
          '<span class="sino-selo sino-c-' + cat + '" aria-hidden="true">' + (ICONE[cat] || ICONE.outro) + '</span></span>' +
        '<span class="sino-tx">' +
          '<span class="sino-linha1">' + (n.cliente_nome ? '<i class="sino-cliente">' + esc(n.cliente_nome) + '</i>' : '<i class="sino-cliente">Sistema B7</i>') +
            '<small>' + esc(curto(n.created_at)) + '</small></span>' +
          '<b>' + esc(n.titulo) + '</b>' + (n.mensagem ? '<p>' + esc(n.mensagem) + '</p>' : '') +
        '</span><span class="sino-ponto" aria-hidden="true"></span></a>';
    }).join('');
    const nn = p.querySelector('#sino-cab-n');
    if (nn) { nn.textContent = naoLidas ? naoLidas + (naoLidas === 1 ? ' nova' : ' novas') : ''; nn.hidden = !naoLidas; }
    p.querySelector('.sino-pe').hidden = p.querySelector('#sino-mais').hidden;
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

  return { montar, atualizar, fechar, prefs, gravarPrefs, pedirPermissao, tocarSom, anunciar, PADRAO, NOMES_SONS, somEscolhido,
           prefTipo, gravarPrefTipo, grupos };
})();
