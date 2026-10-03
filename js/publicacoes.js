/* =====================================================================
   B7 — PUBLICAÇÕES DO DIA

   Visão operacional diária, cross-cliente, das postagens que JÁ existem
   nas Linhas Editoriais. É uma VIEW sobre dado canônico, nunca uma
   segunda fonte de verdade:

   - não existe tabela de "publicações" nem campo duplicado de data;
   - a consulta lê `public.conteudos.data_postagem` direto (via
     B7.DB.publicacoesDoPeriodo), então mudar a data na Linha Editorial
     move o item de dia aqui sozinho, sem sincronizar nada;
   - este módulo NUNCA escreve no banco. A seção "Pendentes de dias
     anteriores" é uma condição DERIVADA (data já passou e o status ainda
     não é "Publicado"), não uma mudança de status. Quem promove
     "Programado" → "Publicado" continua sendo, e só, a Linha Editorial
     (verificarPostagensAutomaticas em js/linha.js, ao abrir a linha).

   NÃO substitui nem toca: o Calendário de Postagens da Linha Editorial
   (visão mensal de um cliente) nem o #/calendario (Calendário de
   Gravações, integração Google). É complementar aos dois.

   SEM HORÁRIO: `conteudos` não tem hora de publicação e não vamos
   inventar uma. A ordem dentro do dia é cliente → position → created_at,
   estável, nunca a ordem que o banco devolver por acaso.

   DATAS: "date-only" do começo ao fim — strings 'AAAA-MM-DD'. Nunca
   `new Date('AAAA-MM-DD')`, que é meia-noite UTC e no Brasil vira o dia
   anterior. Toda conta de dia passa pelos helpers abaixo, que montam
   Date a partir de componentes LOCAIS (mesma disciplina de js/linha.js).
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Publicacoes = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');

  const DIAS_ABREV  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const DIAS_LONGOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
                       'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  /* ordem de leitura do resumo: do que ainda é ideia até o que já saiu.
     Só aparece o status que realmente existir no dia. */
  const ORDEM_STATUS = ['Ideia', 'Em criação', 'Em revisão', 'Aprovado', 'Programado', 'Publicado'];

  const DIAS_FAIXA = 7;      /* dias visíveis na faixa (o selecionado no meio) */
  const JANELA_PROXIMOS = 14; /* quantos dias à frente contamos de uma vez só */

  /* ------------------------------------------------------------ datas */
  const pad = n => String(n).padStart(2, '0');
  const iso = (a, m, d) => a + '-' + pad(m) + '-' + pad(d);
  const ehISO = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  function comps(s) {
    const [a, m, d] = String(s).slice(0, 10).split('-').map(Number);
    return { a, m, d };
  }
  /* Date só a partir de componentes locais — nunca do parse da string */
  function local(s) { const { a, m, d } = comps(s); return new Date(a, m - 1, d); }
  function somarDias(s, n) {
    const dt = local(s);
    dt.setDate(dt.getDate() + n);   /* atravessa mês e ano sozinho */
    return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  }
  const diaSemana = s => local(s).getDay();
  const hoje = () => B7.UI.hojeISO();
  /* diferença em DIAS de calendário (não em horas): as duas pontas viram
     meia-noite local, então horário de verão não muda a conta */
  function difDias(a, b) { return Math.round((local(b) - local(a)) / 86400000); }

  function rotuloDiaLongo(s) {
    const { a, m, d } = comps(s);
    const anoAtual = comps(hoje()).a;
    return DIAS_LONGOS[diaSemana(s)] + ', ' + d + ' de ' + MESES[m - 1] +
           (a !== anoAtual ? ' de ' + a : '');
  }
  function rotuloDiaCurto(s) {
    const { m, d } = comps(s);
    return DIAS_ABREV[diaSemana(s)] + ' ' + d + '/' + pad(m);
  }
  /* "Amanhã", "Ontem" ou o nome do dia — sempre relativo ao dia REAL */
  function rotuloRelativo(s) {
    const dif = difDias(hoje(), s);
    if (dif === 0) return 'Hoje';
    if (dif === 1) return 'Amanhã';
    if (dif === -1) return 'Ontem';
    return DIAS_LONGOS[diaSemana(s)] + ' · ' + comps(s).d + '/' + pad(comps(s).m);
  }
  const plural = (n, um, muitos) => n + ' ' + (n === 1 ? um : muitos);

  /* ------------------------------------------------------------ estado */
  const E = {
    dia: '', itens: [], proximos: [], carregando: true, erro: null,
    pendentes: [], pendentesCarregadas: false, pendentesErro: null
  };
  let pedido = 0;   /* descarta resposta de consulta que chegou atrasada */

  const podeEditarCriativos = () => !(B7.Auth && B7.Auth.usuario()) || B7.Auth.ehEquipe();

  /* ----------------------------------------------------------- filtros
     100% em memória: os itens do dia já estão em E.itens, então trocar
     filtro NUNCA dispara consulta nova. Persistidos em B7.pref (o mesmo
     mecanismo do resto do sistema) — nada de storage próprio.

     Valores "sujos" do banco (canal vazio, "Instagram" e "Intagram"
     convivendo) entram na lista como estão: a tela não conserta dado,
     só não quebra. O que vem vazio vira a opção SEM (sentinela), nunca
     um canal inventado. */
  const F_PADRAO = { cliente: '', status: '', tipo: '', canal: '', agrupar: 'cliente' };
  const CHAVE_FILTROS = 'publicacoes_filtros';
  const CHAVE_ABERTO  = 'publicacoes_filtros_abertos';
  const SEM = '__sem__';
  let F = Object.assign({}, F_PADRAO);
  let filtrosAbertos = null;   /* null = ainda não decidido nesta sessão */

  function lerFiltros() {
    let g = null;
    try { g = B7.pref && B7.pref.ler(CHAVE_FILTROS, null); } catch (e) {}
    F = Object.assign({}, F_PADRAO, (g && typeof g === 'object') ? g : {});
    ['cliente', 'status', 'tipo', 'canal'].forEach(k => { F[k] = typeof F[k] === 'string' ? F[k] : ''; });
    if (F.agrupar !== 'status') F.agrupar = 'cliente';
  }
  function guardarFiltros() { try { B7.pref.gravar(CHAVE_FILTROS, F); } catch (e) {} }

  const CHAVES_F = ['cliente', 'status', 'tipo', 'canal'];
  const filtrosAtivos = () => CHAVES_F.some(k => !!F[k]);
  const qtdFiltros = () => CHAVES_F.filter(k => !!F[k]).length;
  function limparFiltros() {
    CHAVES_F.forEach(k => { F[k] = ''; });
    guardarFiltros();
    desenharCorpo();
  }

  /* tela larga = onde o desenho dos filtros fica sempre aberto.
     Espelha o @media (min-width: 761px) do CSS desta tela. */
  function ehLargo() {
    try { return !window.matchMedia || window.matchMedia('(min-width: 761px)').matches; }
    catch (e) { return true; }
  }

  const chaveTipo  = c => String(c.tipo  || '').trim() || SEM;
  const chaveCanal = c => String(c.canal || '').trim() || SEM;
  const chaveStatus = c => c.status || 'Ideia';

  /* só os valores que EXISTEM no dia selecionado */
  function opcoesDia(itens) {
    const clientes = new Map(), tipos = new Set(), canais = new Set(), status = new Set();
    itens.forEach(c => {
      const id = idCliente(c);
      if (id) clientes.set(String(id), nomeCliente(c));
      status.add(chaveStatus(c));
      tipos.add(chaveTipo(c));
      canais.add(chaveCanal(c));
    });
    const ordenar = s => [...s].filter(v => v !== SEM).sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .concat(s.has(SEM) ? [SEM] : []);
    return {
      clientes: [...clientes.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')),
      status: ORDEM_STATUS.filter(s => status.has(s))
        .concat([...status].filter(s => ORDEM_STATUS.indexOf(s) < 0).sort((a, b) => a.localeCompare(b, 'pt-BR'))),
      tipos: ordenar(tipos),
      canais: ordenar(canais)
    };
  }

  /* Trocar de dia MANTÉM os filtros, mas larga o que não existe mais
     naquele dia — em vez de mostrar "nenhum resultado" sem explicação. */
  function sanearFiltros(itens) {
    const o = opcoesDia(itens);
    let mudou = false;
    const manter = (k, ok) => { if (F[k] && !ok) { F[k] = ''; mudou = true; } };
    manter('cliente', o.clientes.some(p => p[0] === F.cliente));
    manter('status', o.status.indexOf(F.status) >= 0);
    manter('tipo', o.tipos.indexOf(F.tipo) >= 0);
    manter('canal', o.canais.indexOf(F.canal) >= 0);
    if (mudou) guardarFiltros();
    return o;
  }

  function aplicarFiltros(itens) {
    return itens.filter(c =>
      (!F.cliente || String(idCliente(c)) === F.cliente) &&
      (!F.status  || chaveStatus(c) === F.status) &&
      (!F.tipo    || chaveTipo(c) === F.tipo) &&
      (!F.canal   || chaveCanal(c) === F.canal));
  }

  /* ------------------------------------------------------------- abrir */
  async function abrir(diaParam) {
    E.dia = ehISO(diaParam) ? diaParam : hoje();
    lerFiltros();
    filtrosAbertos = null;
    E.pendentesCarregadas = false;
    E.pendentes = []; E.pendentesErro = null;
    E.carregando = true; E.ini = E.fim = null; E.itens = [];
    animDia = null; passoFaixa = 0; pendentesAbertos = false;
    B7.Dashboard.marcarNav('#/publicacoes');
    B7.Rota.titulo(['Publicações do Dia']);
    desenharTela();
    await carregar();
  }

  /* Troca de dia acontece EM MEMÓRIA: o endereço é atualizado sem
     recarregar a página (nada de location.reload em lugar nenhum) e só o
     corpo é redesenhado — o cabeçalho e a faixa de dias ficam de pé. */
  function irParaDia(d) {
    if (!ehISO(d) || d === E.dia) return;
    const dif = difDias(E.dia, d);
    animDia = dif > 0 ? 'prox' : 'ant';
    passoFaixa = dif;
    E.dia = d;
    try { history.replaceState(null, '', '#/publicacoes/' + d); } catch (e) {}
    carregar();   /* carregar já redesenha a faixa */
  }

  /* ------------------------------------------------------------ consulta */
  async function carregar() {
    const req = ++pedido;
    /* o atalho para o Calendário B7 acompanha o dia escolhido */
    const cal = document.getElementById('pb-cal'); if (cal && E.dia) cal.setAttribute('href', '#/calendario?v=semana&tipo=publicacoes&d=' + E.dia);
    /* o dia novo já está entre os que vieram na última consulta? então
       aparece NA HORA (sem esqueleto) e a busca atualiza por baixo */
    const jaTem = !E.erro && !E.carregando && E.ini && E.dia >= E.ini && E.dia <= E.fim;
    if (!jaTem) { E.carregando = true; E.erro = null; }
    desenharFaixa(); desenharCorpo();

    const faixaIni = somarDias(E.dia, -Math.floor(DIAS_FAIXA / 2));
    const faixaFim = somarDias(faixaIni, DIAS_FAIXA - 1);

    try {
      /* Duas consultas, as duas com escopo de data: a faixa visível (7
         dias, com os dados completos) e os próximos 14 dias só com a data
         pra contar — nunca uma consulta por dia, nunca o histórico todo. */
      const [itens, proximos] = await Promise.all([
        B7.DB.publicacoesDoPeriodo(faixaIni, faixaFim),
        B7.DB.contagemPublicacoesPorDia(somarDias(E.dia, 1), somarDias(E.dia, JANELA_PROXIMOS))
      ]);
      if (req !== pedido) return;
      E.itens = itens || [];
      E.ini = faixaIni; E.fim = faixaFim;
      E.proximos = contarPorDia(proximos || []);
      E.carregando = false;
    } catch (e) {
      if (req !== pedido) return;
      console.error('Publicações do Dia', e);
      E.carregando = false;
      /* erro NUNCA se disfarça de vazio: some com a lista e mostra o erro */
      E.erro = e;
      E.itens = []; E.proximos = []; E.ini = E.fim = null;
    }
    desenharFaixa(); desenharCorpo();
    carregarPendentes();
  }

  /* Pendentes é sempre relativo ao dia REAL (não ao dia sendo olhado),
     então basta carregar uma vez por abertura da tela. */
  async function carregarPendentes() {
    if (E.pendentesCarregadas) return;
    E.pendentesCarregadas = true;
    try {
      /* recorte de 60 dias pra trás: o que passou há meses não é
         "pendente do dia a dia", é limpeza de linha editorial */
      E.pendentes = await B7.DB.publicacoesPendentes(hoje(), somarDias(hoje(), -60), 50) || [];
    } catch (e) {
      console.warn('Pendentes de dias anteriores', e);
      E.pendentesErro = e;
      E.pendentes = [];
    }
    const alvo = document.getElementById('pb-pendentes');
    if (alvo) {
      alvo.outerHTML = htmlPendentes();
      const novo = document.getElementById('pb-pendentes');
      if (novo) { novo.classList.add('pb-chega'); numerarPendentes(novo); }
    }
    pintarSub();
    ligarCorpo();
  }

  function contarPorDia(linhas) {
    const mapa = new Map();
    linhas.forEach(l => {
      const d = String(l.data_postagem || '').slice(0, 10);
      if (!ehISO(d)) return;
      mapa.set(d, (mapa.get(d) || 0) + 1);
    });
    return [...mapa.entries()].map(([dia, total]) => ({ dia, total })).sort((x, y) => x.dia < y.dia ? -1 : 1);
  }

  /* --------------------------------------------------------- derivados */
  const nomeCliente = c => (c.clientes && c.clientes.nome) || 'Cliente sem nome';
  const logoCliente = c => (c.clientes && c.clientes.logo_url) || '';
  const idCliente   = c => c.client_id || (c.clientes && c.clientes.id) || '';
  const nomePilar   = c => (c.pilares && c.pilares.nome) || '';
  function nomeLinha(c) {
    const l = c.linhas_editoriais;
    if (!l) return 'Linha editorial';
    return l.nome || ((MESES[(+l.mes || 1) - 1] || '') + ' ' + (l.ano || ''));
  }

  const doDia = () => E.itens.filter(c => String(c.data_postagem || '').slice(0, 10) === E.dia);

  /* cliente (A→Z) → position → created_at. Ordem estável e explicável;
     nunca a ordem que o banco devolveu por acaso. */
  function agruparPorCliente(lista) {
    const grupos = new Map();
    lista.forEach(c => {
      const chave = idCliente(c) || nomeCliente(c);
      if (!grupos.has(chave)) grupos.set(chave, { nome: nomeCliente(c), logo: logoCliente(c), itens: [] });
      grupos.get(chave).itens.push(c);
    });
    const saida = [...grupos.values()];
    saida.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    saida.forEach(g => g.itens.sort(ordemNoGrupo));
    return saida;
  }

  function ordemNoGrupo(a, b) {
    const pa = a.position == null ? 1e9 : a.position, pb = b.position == null ? 1e9 : b.position;
    if (pa !== pb) return pa - pb;
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  }

  /* Agrupamento alternativo: por status, na MESMA ordem de leitura do
     resumo do dia (ORDEM_STATUS). Status que não estiver na lista vai
     para o fim, em ordem alfabética — nunca some. Dentro do grupo, a
     ordem continua cliente A→Z → position → created_at. */
  function agruparPorStatus(lista) {
    const grupos = new Map();
    lista.forEach(c => {
      const s = chaveStatus(c);
      if (!grupos.has(s)) grupos.set(s, { status: s, itens: [] });
      grupos.get(s).itens.push(c);
    });
    const pos = s => { const i = ORDEM_STATUS.indexOf(s); return i < 0 ? 999 : i; };
    const saida = [...grupos.values()];
    saida.sort((a, b) => (pos(a.status) - pos(b.status)) || a.status.localeCompare(b.status, 'pt-BR'));
    saida.forEach(g => g.itens.sort((a, b) =>
      nomeCliente(a).localeCompare(nomeCliente(b), 'pt-BR') || ordemNoGrupo(a, b)));
    return saida;
  }

  /* --------------------------------------------------------- desenho */
  function desenharTela() {
    painel().innerHTML =
      '<div class="conteudo pb-tela entra">' +
        '<header class="pb-cab">' +
          '<div class="pb-cab-tx">' +
            '<h1>Publicações do Dia</h1>' +
            '<p>O que está marcado para sair hoje, em todos os clientes. Vem direto das Linhas Editoriais.</p>' +
            '<small class="pb-sub" id="pb-sub" aria-live="polite"></small>' +
          '</div>' +
          '<div class="pb-cab-acoes">' +
            (B7.Perm && B7.Perm.podeRota('calendario') ? '<a class="b contorno pb-bt-cal" id="pb-cal" href="#/calendario?v=semana&amp;tipo=publicacoes" title="Ver no calendário" aria-label="Ver no calendário">' +
              svg(ICONES.calendario) + '<span>Ver no calendário</span></a>' : '') +
          '</div>' +
        '</header>' +
        /* cartão da semana: mês, Hoje e "ir para" em cima; os dias embaixo */
        '<section class="pb-semana">' +
          '<div class="pb-semana-topo">' +
            '<b class="pb-mes" id="pb-mes"></b>' +
            '<div class="pb-semana-acoes">' +
              '<button type="button" class="b contorno pb-bt-hoje" data-hoje>Hoje</button>' +
              '<label class="pb-seletor-data" title="Ir para um dia">' + svg(ICONES.escolher) + '<span class="pb-rot">Ir para</span>' +
                '<input type="date" id="pb-data" aria-label="Escolher um dia"></label>' +
            '</div>' +
          '</div>' +
          '<nav class="pb-faixa-caixa" id="pb-faixa" aria-label="Navegação de dias"></nav>' +
        '</section>' +
        '<div id="pb-filtros"></div>' +
        '<div id="pb-corpo"></div>' +
      '</div>';

    painel().querySelector('[data-hoje]').onclick = () => irParaDia(hoje());
    const inp = painel().querySelector('#pb-data');
    inp.onchange = () => { if (ehISO(inp.value)) irParaDia(inp.value); else inp.value = E.dia; };
    /* celular: o ícone abre o seletor do próprio aparelho */
    inp.addEventListener('click', () => { try { inp.showPicker && inp.showPicker(); } catch (e) {} });
    primeira = true; primeiraFaixa = true;
    desenharFaixa();
    desenharCorpo();
    /* arrastar de lado: na faixa e na lista do dia, troca o dia */
    if (B7.Movimento && B7.Movimento.deslizar) {
      const fx = document.getElementById('pb-faixa'), corpo = document.getElementById('pb-corpo');
      B7.Movimento.deslizar(fx, () => fx.querySelector('.pb-faixa'), dir => irParaDia(somarDias(E.dia, dir)));
      B7.Movimento.deslizar(corpo, () => corpo.querySelector('.pb-bloco-dia'), dir => irParaDia(somarDias(E.dia, dir)));
    }
  }
  const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  let primeira = true;       /* primeira pintura com dados: entrada em cascata */
  let primeiraFaixa = true;  /* os dias entram em cascata só ao abrir a tela */
  let animDia = null;        /* 'prox' | 'ant' — direção da próxima troca de dia */
  let passoFaixa = 0;        /* quantos dias a faixa andou (desliza para recentrar) */
  let pendentesAbertos = false;
  const PEND_VISIVEIS = 5;

  function desenharFaixa() {
    const el = document.getElementById('pb-faixa');
    if (!el) return;
    const inicio = somarDias(E.dia, -Math.floor(DIAS_FAIXA / 2));
    const h = hoje();
    const contagens = new Map();
    const temDados = !E.carregando && !E.erro && E.ini;
    if (temDados) {
      E.itens.forEach(c => {
        const d = String(c.data_postagem || '').slice(0, 10);
        contagens.set(d, (contagens.get(d) || 0) + 1);
      });
    }

    let dias = '';
    for (let i = 0; i < DIAS_FAIXA; i++) {
      const d = somarDias(inicio, i);
      const sel = d === E.dia, ehHoje = d === h;
      const n = contagens.get(d) || 0;
      /* só conta o que a última consulta cobriu: fora dela, em branco
         (nunca um "—" que diria "zero" sem ter olhado) */
      const sabe = temDados && d >= E.ini && d <= E.fim;
      dias +=
        '<button type="button" class="pb-dia' + (sel ? ' on' : '') + (ehHoje ? ' hoje' : '') + (d < h ? ' passou' : '') + '" ' +
          'data-dia="' + d + '"' + (sel ? ' aria-current="date"' : '') + ' style="--d:' + i + '"' +
          ' aria-label="' + esc(rotuloDiaLongo(d)) + (ehHoje ? ' (hoje)' : '') + (sabe ? ', ' + plural(n, 'publicação', 'publicações') : '') + '">' +
          '<span class="pb-dia-semana">' + DIAS_ABREV[diaSemana(d)] + '</span>' +
          '<span class="pb-dia-num">' + comps(d).d + '</span>' +
          (ehHoje ? '<span class="pb-dia-hoje">Hoje</span>'
                  : '<span class="pb-dia-contagem' + (sabe && n ? ' tem' : '') + '">' + (sabe ? (n || '—') : '') + '</span>') +
        '</button>';
    }
    const mes = document.getElementById('pb-mes');
    if (mes) { const { a, m } = comps(E.dia); mes.textContent = MESES[m - 1].replace(/^./, x => x.toUpperCase()) + ' de ' + a; }

    /* mesma semana na tela? atualiza só o miolo dos dias (as contagens),
       sem trocar os elementos — não corta a animação que estiver rodando */
    const fxAntes = el.querySelector('.pb-faixa');
    if (fxAntes && el.dataset.ini === inicio && el.dataset.sel === E.dia) {
      const tmp = document.createElement('div'); tmp.innerHTML = dias;
      const novos = tmp.querySelectorAll('.pb-dia'), velhos = fxAntes.querySelectorAll('.pb-dia');
      if (novos.length === velhos.length) {
        velhos.forEach((b, k) => { b.innerHTML = novos[k].innerHTML; b.setAttribute('aria-label', novos[k].getAttribute('aria-label')); });
        return;
      }
    }
    el.dataset.ini = inicio; el.dataset.sel = E.dia;
    const faixaNova = primeiraFaixa; primeiraFaixa = false;
    el.innerHTML =
      '<button type="button" class="pb-seta" data-passo="-7" aria-label="Semana anterior">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<div class="pb-faixa' + (faixaNova ? ' pb-faixa-entra' : '') + '" role="group">' + dias + '</div>' +
      '<button type="button" class="pb-seta" data-passo="7" aria-label="Próxima semana">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></button>';

    el.querySelectorAll('[data-dia]').forEach(b => b.onclick = () => irParaDia(b.dataset.dia));
    el.querySelectorAll('[data-passo]').forEach(b => b.onclick = () => irParaDia(somarDias(E.dia, +b.dataset.passo)));

    const inp = document.getElementById('pb-data');
    if (inp && inp.value !== E.dia) inp.value = E.dia;
    const ativo = el.querySelector('.pb-dia.on');
    const fx = el.querySelector('.pb-faixa');
    /* trocou de dia: a faixa desliza o tanto de dias que andou, para o
       escolhido voltar ao meio (como um carrossel); salto grande, só um
       deslize curto no sentido certo */
    if (passoFaixa && fx && fx.animate && !reduz()) {
      const um = ativo ? ativo.offsetWidth + parseFloat(getComputedStyle(fx).columnGap || getComputedStyle(fx).gap || 0) : 60;
      const de = Math.abs(passoFaixa) <= 3 ? passoFaixa * um : Math.sign(passoFaixa) * 46;
      fx.animate([{ transform: 'translateX(' + de + 'px)', opacity: Math.abs(passoFaixa) <= 3 ? 1 : 0 }, { transform: 'none', opacity: 1 }],
        { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
      if (ativo) ativo.classList.add('pulou');
    }
    passoFaixa = 0;
    /* o dia selecionado nunca fica escondido na rolagem */
    if (ativo && ativo.scrollIntoView && fx && fx.scrollWidth > fx.clientWidth + 2) {
      try { ativo.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
    }
  }
  const reduz = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------- barra de filtros
     Vive FORA de #pb-corpo (é irmã dele) só quando há dia com conteúdo.
     No celular ela é um botão "Filtros" recolhido; em tela larga o botão
     some no CSS e o corpo da barra fica sempre aberto. */
  function desenharFiltros(opc) {
    const cx = document.getElementById('pb-filtros');
    if (!cx) return;
    if (!opc) { cx.innerHTML = ''; return; }

    /* preserva o foco do teclado: a barra é remontada a cada mudança */
    const ativo = document.activeElement;
    const focoEm = (ativo && ativo.dataset && (ativo.dataset.filtro || ativo.dataset.agrupar)) || '';
    const focoTipo = ativo && ativo.dataset && ativo.dataset.filtro ? 'filtro' : 'agrupar';

    if (filtrosAbertos === null) {
      filtrosAbertos = ehLargo() ? true : !!(B7.pref && B7.pref.ler(CHAVE_ABERTO, false));
    }

    /* seletor com uma opção só não é filtro, é enfeite: se o dia inteiro
       tem um único canal (o caso normal aqui), o seletor de canal nem
       aparece. Se houver filtro ativo naquele eixo, aparece sempre —
       nada pode ficar preso sem um jeito de desligar. */
    const sel = (chave, rotulo, itens) =>
      (itens.length <= 2 && !F[chave]) ? '' :
      '<select class="campo fina pb-filtro' + (F[chave] ? ' ativo' : '') + '" data-filtro="' + chave + '" ' +
        'aria-label="' + esc(rotulo) + '">' +
        itens.map(([v, r]) => '<option value="' + esc(v) + '"' + (F[chave] === v ? ' selected' : '') + '>' +
          esc(r) + '</option>').join('') +
      '</select>';

    const rotuloVazio = (v, vazio) => v === SEM ? vazio : v;
    const n = qtdFiltros();

    cx.innerHTML =
      '<div class="pb-filtros' + (filtrosAbertos ? '' : ' fechado') + (filtrosAtivos() ? ' com-filtro' : '') + '">' +
        '<button type="button" class="pb-filtros-botao" aria-expanded="' + (filtrosAbertos ? 'true' : 'false') + '" ' +
          'aria-controls="pb-filtros-corpo" data-alternar-filtros>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
            '<path d="M4 6h16M7 12h10M10 18h4"/></svg>' +
          '<span>Filtros</span>' +
          (n ? '<span class="pb-filtros-n">' + n + '</span>' : '') +
        '</button>' +
        '<div class="pb-filtros-corpo" id="pb-filtros-corpo">' +
          sel('cliente', 'Filtrar por cliente',
            [['', 'Todos os clientes']].concat(opc.clientes)) +
          sel('status', 'Filtrar por status',
            [['', 'Todos os status']].concat(opc.status.map(s => [s, s]))) +
          sel('tipo', 'Filtrar por formato',
            [['', 'Todos os formatos']].concat(opc.tipos.map(t => [t, rotuloVazio(t, 'Sem formato')]))) +
          sel('canal', 'Filtrar por canal',
            [['', 'Todos os canais']].concat(opc.canais.map(t => [t, rotuloVazio(t, 'Sem canal')]))) +
          '<div class="pb-agrupar seg-vista" role="group" aria-label="Agrupar publicações por">' +
            '<button type="button" class="' + (F.agrupar === 'cliente' ? 'on' : '') + '" data-agrupar="cliente" ' +
              'aria-pressed="' + (F.agrupar === 'cliente' ? 'true' : 'false') + '">Por cliente</button>' +
            '<button type="button" class="' + (F.agrupar === 'status' ? 'on' : '') + '" data-agrupar="status" ' +
              'aria-pressed="' + (F.agrupar === 'status' ? 'true' : 'false') + '">Por status</button>' +
          '</div>' +
          (filtrosAtivos()
            ? '<button type="button" class="b fina contorno pb-limpar" data-limpar-filtros>Limpar filtros</button>'
            : '') +
        '</div>' +
      '</div>';

    cx.querySelectorAll('[data-filtro]').forEach(s => s.onchange = () => {
      F[s.dataset.filtro] = s.value;
      guardarFiltros();
      desenharCorpo();
    });
    cx.querySelectorAll('[data-agrupar]').forEach(b => b.onclick = () => {
      if (F.agrupar === b.dataset.agrupar) return;
      F.agrupar = b.dataset.agrupar;
      guardarFiltros();
      desenharCorpo();
    });
    const limpar = cx.querySelector('[data-limpar-filtros]');
    if (limpar) limpar.onclick = limparFiltros;
    const alternar = cx.querySelector('[data-alternar-filtros]');
    if (alternar) alternar.onclick = () => {
      filtrosAbertos = !filtrosAbertos;
      try { B7.pref.gravar(CHAVE_ABERTO, filtrosAbertos); } catch (e) {}
      const caixa = cx.querySelector('.pb-filtros');
      if (caixa) caixa.classList.toggle('fechado', !filtrosAbertos);
      alternar.setAttribute('aria-expanded', filtrosAbertos ? 'true' : 'false');
    };

    if (focoEm) {
      const alvo = cx.querySelector('[data-' + focoTipo + '="' + focoEm + '"]');
      if (alvo && alvo.focus) { try { alvo.focus(); } catch (e) {} }
    }
  }

  function desenharCorpo() {
    const el = document.getElementById('pb-corpo');
    if (!el) return;

    if (E.carregando) {
      /* skeleton LOCAL: o cabeçalho, o dia selecionado e a barra de
         filtros continuam na tela — só o miolo vira esqueleto */
      el.innerHTML = '<div class="pb-secao">' + B7.UI.skeleton('lista', { n: 4, titulo: false }) + '</div>';
      return;
    }

    if (E.erro) {
      desenharFiltros(null);
      el.innerHTML =
        '<div class="pb-estado pb-estado-erro" role="alert">' +
          '<b>Não foi possível carregar as publicações deste dia.</b>' +
          '<p>' + esc((E.erro && E.erro.message) || 'Confira a conexão e tente de novo.') + '</p>' +
          '<div class="acoes"><button class="b pri" data-retry>Tentar de novo</button></div>' +
        '</div>';
      el.querySelector('[data-retry]').onclick = () => carregar();
      return;
    }

    const todos = doDia();
    /* saneia ANTES de desenhar: filtro que não existe mais neste dia cai
       sozinho, em vez de virar um "nenhum resultado" sem explicação */
    const opc = sanearFiltros(todos);
    desenharFiltros(todos.length ? opc : null);

    const itens = aplicarFiltros(todos);
    /* animação: entrada (primeira pintura), direção da troca de dia, ou
       nada (atualização por baixo / filtro trocado sem mudar de dia) */
    const anim = primeira ? 'entrada' : animDia;
    primeira = false; animDia = null;
    const blocoHTML = htmlCabecalhoDia(itens, todos) +
      (todos.length ? (itens.length ? htmlGrupos(itens) : htmlVazioFiltro(todos.length)) : htmlVazio());
    const apoioHTML = htmlProximos() + htmlPendentes();
    /* atualização por baixo que não mudou nada na tela: não troca os
       elementos (não corta a animação de entrada que ainda está rodando) */
    const bVelho = el.querySelector(':scope > .pb-bloco-dia'), aVelho = el.querySelector(':scope > .pb-apoio');
    if (!anim && bVelho && aVelho && bVelho._html === blocoHTML) {
      if (aVelho._html !== apoioHTML) { aVelho.innerHTML = apoioHTML; aVelho._html = apoioHTML; aVelho.className = 'pb-apoio'; }
      numerarPendentes(el); pintarSub(); ligarCorpo();
      return;
    }
    el.innerHTML =
      '<div class="pb-bloco-dia' + (anim ? ' pb-anim pb-anim-' + anim : '') + '">' + blocoHTML + '</div>' +
      '<div class="pb-apoio' + (anim === 'entrada' ? ' pb-anim pb-anim-entrada' : '') + '">' + apoioHTML + '</div>';
    el.querySelector('.pb-bloco-dia')._html = blocoHTML;
    el.querySelector('.pb-apoio')._html = apoioHTML;
    el.querySelectorAll('.pb-bloco-dia .pb-grupo-cab, .pb-bloco-dia .pb-card').forEach((c, i) => c.style.setProperty('--k', Math.min(i, 9)));
    numerarPendentes(el);
    pintarSub();
    ligarCorpo();
  }

  /* topo: o dia em uma frase ("1 publicação hoje · 50 pendentes") */
  function pintarSub() {
    const s = document.getElementById('pb-sub'); if (!s) return;
    if (E.carregando || E.erro) { s.textContent = ''; return; }
    const n = doDia().length;
    s.textContent = (E.dia === hoje() ? (n ? plural(n, 'publicação hoje', 'publicações hoje') : 'Nada para hoje')
        : plural(n, 'publicação', 'publicações') + ' em ' + rotuloDiaCurto(E.dia).toLowerCase()) +
      (E.pendentes.length ? ' · ' + plural(E.pendentes.length, 'pendente', 'pendentes') : '');
  }
  const numerarPendentes = raiz => raiz.querySelectorAll('.pb-pendente').forEach((p, i) => p.style.setProperty('--k', Math.min(i, 6)));

  function htmlCabecalhoDia(itens, todos) {
    const clientes = new Set(itens.map(idCliente)).size;
    const contagem = {};
    /* o resumo conta o DIA INTEIRO: o chip nunca mente sobre o total só
       porque há filtro — ele é o próprio atalho para filtrar. */
    todos.forEach(c => { const s = chaveStatus(c); contagem[s] = (contagem[s] || 0) + 1; });
    /* só os status que existem NESTE dia — nada de legenda com zero */
    const chips = ORDEM_STATUS.filter(s => contagem[s]).map(s => {
      const on = F.status === s;
      return '<button type="button" class="pb-resumo-item' + (on ? ' on' : '') + '" data-status-chip="' + esc(s) + '" ' +
        'aria-pressed="' + (on ? 'true' : 'false') + '" ' +
        'title="' + (on ? 'Limpar o filtro de status' : esc('Mostrar só ' + s)) + '">' +
        chip(s) + '<b>' + contagem[s] + '</b></button>';
    }).join('');

    const filtrando = filtrosAtivos();
    let totais;
    if (!todos.length) totais = 'Nenhuma publicação prevista';
    else if (filtrando) totais = 'Mostrando ' + itens.length + ' de ' +
      plural(todos.length, 'publicação', 'publicações') +
      (itens.length ? ' · ' + plural(clientes, 'cliente', 'clientes') : '');
    else totais = plural(todos.length, 'publicação', 'publicações') + ' · ' + plural(clientes, 'cliente', 'clientes');

    return '<header class="pb-dia-cab">' +
      '<h2>' + esc(rotuloDiaLongo(E.dia)) + (E.dia === hoje() ? '<span class="pb-selo-hoje">Hoje</span>' : '') + '</h2>' +
      '<p class="pb-totais">' + totais +
        (filtrando ? ' <button type="button" class="pb-totais-limpar" data-limpar-filtros>Limpar filtros</button>' : '') +
      '</p>' +
      (chips ? '<div class="pb-resumo">' + chips + '</div>' : '') +
      '</header>';
  }

  /* o mapa de cores de status é UM só no sistema (MAPA_STATUS_CONTEUDO em
     js/linha.js). Aqui a gente só reusa — nada de segunda paleta. */
  function chip(status) {
    return (B7.Linha && B7.Linha.chipConteudo)
      ? B7.Linha.chipConteudo(status)
      : '<span class="status-conteudo sc-ideia">' + esc(status || '') + '</span>';
  }

  function avatar(nome, logo, tamanho) {
    const cls = 'pb-avatar ' + (tamanho || 'sm');
    if (logo) return '<img class="' + cls + '" src="' + esc(logo) + '" alt="" loading="lazy">';
    return '<span class="' + cls + ' vazio">' + esc(B7.UI.iniciais(nome || '?')) + '</span>';
  }

  /* O cartão é SEMPRE o mesmo HTML: traz o nome do cliente e o chip de
     status nos dois modos de agrupamento. Quem some com a repetição é o
     CSS, e só em tela larga (o celular continua exatamente como está):
     agrupado por cliente esconde o nome do cliente no cartão; agrupado
     por status esconde o chip. Nada sai do fluxo de tabulação. */
  function htmlGrupos(itens) {
    if (F.agrupar === 'status') {
      return '<div class="pb-grupos" data-agrupar="status">' + agruparPorStatus(itens).map(g =>
        '<section class="pb-grupo">' +
          '<header class="pb-grupo-cab pb-grupo-cab-status">' + chip(g.status) +
            '<span class="pb-grupo-n">' + plural(g.itens.length, 'publicação', 'publicações') + '</span>' +
          '</header>' +
          '<div class="pb-cards">' + g.itens.map(c =>
            htmlCard(c, { nome: nomeCliente(c), logo: logoCliente(c) })).join('') + '</div>' +
        '</section>').join('') + '</div>';
    }
    return '<div class="pb-grupos" data-agrupar="cliente">' + agruparPorCliente(itens).map(g =>
      '<section class="pb-grupo">' +
        '<header class="pb-grupo-cab">' + avatar(g.nome, g.logo, 'md') +
          '<b class="pb-grupo-nome">' + esc(g.nome) + '</b>' +
          '<span class="pb-grupo-n">' + plural(g.itens.length, 'publicação', 'publicações') + '</span>' +
        '</header>' +
        '<div class="pb-cards">' + g.itens.map(c => htmlCard(c, g)).join('') + '</div>' +
      '</section>').join('') + '</div>';
  }

  /* ícones das ações secundárias: em tela larga o rótulo vira title +
     aria-label e sobra só o ícone; no celular o ícone é que some e o
     texto continua igualzinho. */
  const ICONES = {
    ver: '<circle cx="12" cy="12" r="3"/><path d="M2 12s3.6-6.6 10-6.6S22 12 22 12s-3.6 6.6-10 6.6S2 12 2 12z"/>',
    criativos: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
    linha: '<path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/><path d="M18 14.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4.5"/>',
    copiar: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
    calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    escolher: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M12 13.5v4M10 15.5h4"/>'
  };
  /* rótulo inteiro no leitor de tela e no title; no celular aparece o
     curto ao lado do ícone; em tela larga, só o ícone */
  function acao(attr, id, rotulo, icone, curto) {
    return '<button type="button" class="pb-acao pb-acao-ico" data-' + attr + '="' + esc(id) + '" ' +
      'title="' + esc(rotulo) + '" aria-label="' + esc(rotulo) + '">' +
      '<svg class="pb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icone + '</svg>' +
      '<span class="pb-acao-tx">' + esc(rotulo) + '</span><span class="pb-acao-curto" aria-hidden="true">' + esc(curto || rotulo) + '</span></button>';
  }

  function htmlCard(c, g) {
    const temLegenda = !!String(c.legenda || '').trim();
    const meta = [c.canal, c.tipo, B7.UI.dataBR(c.data_postagem), nomePilar(c)].filter(Boolean);
    return '<article class="pb-card">' +
      '<div class="pb-card-topo">' +
        '<span class="pb-card-cliente">' + avatar(g.nome, g.logo, 'sm') + '<span>' + esc(g.nome) + '</span></span>' +
        chip(c.status) +
      '</div>' +
      '<h3 class="pb-card-titulo">' + esc(c.titulo || 'Sem título') + '</h3>' +
      '<div class="pb-card-meta">' + meta.map(t => '<span>' + esc(t) + '</span>').join('<i class="p"></i>') + '</div>' +
      '<div class="pb-card-acoes">' +
        (temLegenda ? '<button type="button" class="pb-acao pb-acao-copiar" data-copiar="' + esc(c.id) + '" aria-label="Copiar legenda">' +
          '<svg class="pb-ico-m" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONES.copiar + '</svg>' +
          '<span class="pb-acao-tx">Copiar legenda</span><span class="pb-acao-curto" aria-hidden="true">Copiar</span></button>' : '') +
        acao('ver', c.id, 'Ver detalhes', ICONES.ver, 'Detalhes') +
        (c.linha_id ? acao('criativos', c.id, 'Abrir nos Criativos', ICONES.criativos, 'Criativos') +
                      acao('linha', c.id, 'Abrir Linha Editorial', ICONES.linha, 'Linha') : '') +
      '</div>' +
    '</article>';
  }

  function htmlVazioFiltro(total) {
    return '<div class="pb-estado">' +
      '<b>Nenhuma publicação com os filtros aplicados.</b>' +
      '<p>' + esc('Este dia tem ' + plural(total, 'publicação', 'publicações') +
        ', mas nenhuma corresponde ao que está filtrado agora.') + '</p>' +
      '<div class="acoes"><button type="button" class="b contorno" data-limpar-filtros>Limpar filtros</button></div>' +
      '</div>';
  }

  function htmlVazio() {
    const prox = E.proximos[0];
    const contexto = prox
      ? 'O próximo dia com publicação é ' + rotuloRelativo(prox.dia).toLowerCase() +
        ' — ' + plural(prox.total, 'publicação', 'publicações') + '.'
      : 'Nada marcado nos próximos ' + JANELA_PROXIMOS + ' dias também.';
    return '<div class="pb-estado pb-estado-livre">' +
      '<span class="pb-estado-ic" aria-hidden="true">' + svg(ICONES.calendario + '<path d="M9.5 15l2 2 3.5-3.5"/>') + '</span>' +
      '<b>Nenhuma publicação prevista para este dia.</b>' +
      '<p>' + esc(contexto) + '</p>' +
      (prox ? '<div class="acoes"><button class="b contorno" data-dia-ir="' + prox.dia + '">Ver ' +
              esc(rotuloRelativo(prox.dia).toLowerCase()) + '</button></div>' : '') +
      '</div>';
  }

  function htmlProximos() {
    if (!E.proximos.length) return '';
    const lista = E.proximos.slice(0, 8);
    const max = Math.max(...lista.map(p => p.total), 1);
    return '<section class="pb-secao pb-proximos">' +
      '<h3>Próximas publicações</h3>' +
      '<div class="pb-proximos-lista">' + lista.map((p, i) => {
        const dif = difDias(hoje(), p.dia), { d, m } = comps(p.dia);
        const nome = dif === 1 ? 'Amanhã' : DIAS_LONGOS[diaSemana(p.dia)].replace('-feira', '');
        return '<button type="button" class="pb-proximo" data-dia-ir="' + p.dia + '" style="--k:' + i + ';--p:' + (p.total / max).toFixed(3) + '" ' +
            'aria-label="' + esc(rotuloRelativo(p.dia) + ': ' + plural(p.total, 'publicação', 'publicações')) + '">' +
          '<span class="pb-prox-topo"><b>' + esc(nome) + '</b><small>' + d + '/' + pad(m) + '</small></span>' +
          '<span class="pb-prox-n"><b>' + p.total + '</b>' + (p.total === 1 ? 'publicação' : 'publicações') + '</span>' +
          '<i class="pb-prox-barra" aria-hidden="true"></i>' +
        '</button>';
      }).join('') + '</div>' +
      '</section>';
  }

  function htmlPendentes() {
    if (!E.pendentesCarregadas) {
      return '<section class="pb-secao" id="pb-pendentes">' +
        '<h3>Pendentes de dias anteriores</h3>' +
        '<p class="pb-fraca">Conferindo…</p></section>';
    }
    if (E.pendentesErro) {
      return '<section class="pb-secao" id="pb-pendentes">' +
        '<h3>Pendentes de dias anteriores</h3>' +
        '<p class="pb-fraca">Não foi possível conferir os pendentes agora.</p></section>';
    }
    if (!E.pendentes.length) return '<section class="pb-secao" id="pb-pendentes" hidden></section>';

    /* "há 3 dias" diz mais rápido o tamanho do atraso; a data fica no title */
    const atraso = c => {
      const n = difDias(String(c.data_postagem || '').slice(0, 10), hoje());
      return n <= 0 ? 'hoje' : n === 1 ? 'ontem' : 'há ' + n + ' dias';
    };
    const linha = c =>
      '<button type="button" class="pb-pendente" data-pendente="' + esc(c.id) + '">' +
        '<span class="pb-pendente-data" title="' + esc(B7.UI.dataBR(c.data_postagem)) + '">' +
          '<span class="pb-pd-rel">' + esc(atraso(c)) + '</span><span class="pb-pd-abs">' + esc(B7.UI.dataBR(c.data_postagem)) + '</span></span>' +
        '<span class="pb-pendente-cliente">' + esc((c.clientes && c.clientes.nome) || 'Cliente') + '</span>' +
        '<span class="pb-pendente-titulo">' + esc(c.titulo || 'Sem título') + '</span>' +
        chip(c.status) +
      '</button>';
    const total = E.pendentes.length;
    const primeiros = E.pendentes.slice(0, PEND_VISIVEIS).map(linha).join('');
    const resto = E.pendentes.slice(PEND_VISIVEIS).map(linha).join('');

    return '<section class="pb-secao pb-pendentes-secao" id="pb-pendentes">' +
      '<h3>Pendentes de dias anteriores <span class="pb-etiqueta">' + total + '</span></h3>' +
      '<p class="pb-fraca">A data de postagem já passou e o status ainda não é “Publicado”. Esta tela só mostra — nada aqui muda o status.</p>' +
      '<div class="pb-pendentes-lista">' + primeiros + '</div>' +
      (resto
        ? '<div class="pb-pend-mais' + (pendentesAbertos ? ' aberta' : '') + '" id="pb-pend-mais"><div class="pb-pend-mais-in"><div class="pb-pendentes-lista">' + resto + '</div></div></div>' +
          '<button type="button" class="pb-pend-alternar" data-pend-alternar aria-expanded="' + pendentesAbertos + '" aria-controls="pb-pend-mais">' +
            '<span>' + (pendentesAbertos ? 'Mostrar menos' : 'Ver todos os ' + total) + '</span>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg></button>'
        : '') +
      '</section>';
  }

  /* ---------------------------------------------------------- ligações */
  function acharItem(id) {
    return E.itens.find(c => c.id === id) || E.pendentes.find(c => c.id === id) || null;
  }

  function ligarCorpo() {
    const el = document.getElementById('pb-corpo');
    if (!el) return;

    el.querySelectorAll('[data-dia-ir]').forEach(b => b.onclick = () => irParaDia(b.dataset.diaIr));
    /* pendentes: os 5 primeiros sempre; o resto abre e fecha deslizando */
    el.querySelectorAll('[data-pend-alternar]').forEach(b => b.onclick = () => {
      pendentesAbertos = !pendentesAbertos;
      const caixa = document.getElementById('pb-pend-mais');
      if (caixa) caixa.classList.toggle('aberta', pendentesAbertos);
      b.setAttribute('aria-expanded', pendentesAbertos);
      b.querySelector('span').textContent = pendentesAbertos ? 'Mostrar menos' : 'Ver todos os ' + E.pendentes.length;
    });

    /* Clicar num chip do resumo filtra por aquele status; clicar de novo
       limpa. É o mesmo estado F.status do seletor — não existe um segundo
       filtro escondido. */
    el.querySelectorAll('[data-status-chip]').forEach(b => b.onclick = () => {
      const s = b.dataset.statusChip;
      F.status = (F.status === s) ? '' : s;
      guardarFiltros();
      desenharCorpo();
    });
    el.querySelectorAll('[data-limpar-filtros]').forEach(b => b.onclick = limparFiltros);

    /* Copiar legenda: a ÚNICA implementação de clipboard do sistema, com
       o texto canônico do banco. O botão só existe quando há legenda —
       nunca finge sucesso copiando vazio. */
    el.querySelectorAll('[data-copiar]').forEach(b => b.onclick = () => {
      const c = acharItem(b.dataset.copiar);
      if (c) B7.UI.copiarTexto(c.legenda);
    });

    el.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => verDetalhes(b.dataset.ver, b));
    el.querySelectorAll('[data-pendente]').forEach(b => b.onclick = () => verDetalhes(b.dataset.pendente, b));

    /* Navegação SEMPRE por ID estável (linha_id / id do conteúdo) —
       nunca procurando um registro por título ou data. */
    el.querySelectorAll('[data-criativos]').forEach(b => b.onclick = () => {
      const c = acharItem(b.dataset.criativos);
      if (c && c.linha_id) location.hash = '#/linha/' + c.linha_id + '/criativos?conteudo=' + c.id;
    });
    el.querySelectorAll('[data-linha]').forEach(b => b.onclick = () => {
      const c = acharItem(b.dataset.linha);
      if (c && c.linha_id) location.hash = '#/linha/' + c.linha_id;
    });
  }

  /* A gaveta de detalhe é a que já existe (B7.QuickView) — não existe uma
     segunda tela de detalhe de conteúdo no sistema. Abrir e fechar não
     mexe no dia selecionado: a gaveta é um overlay, a tela fica atrás. */
  function verDetalhes(id, gatilho) {
    const c = acharItem(id);
    if (!c || !B7.QuickView) return;
    B7.QuickView.abrirConteudo(Object.assign({}, c, { tipo: c.tipo || 'Card' }), {
      cliente: nomeCliente(c), clienteLogo: logoCliente(c), linha: nomeLinha(c),
      contexto: 'postagem', podeAbrirCriativos: podeEditarCriativos() && !!c.linha_id,
      linhaId: c.linha_id || '', gatilho: gatilho
    });
  }

  return { abrir };
})();
