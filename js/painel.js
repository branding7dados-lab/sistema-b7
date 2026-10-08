/* =====================================================================
   PAINEL — espaço de trabalho PESSOAL (um sistema só)
   Este arquivo: primitivos (B7.Painel.ui), resolução do Painel
   (contexto/abrir) e o domínio VÍDEO. Coordenação → js/painel-coord.js;
   Design → js/painel-design.js; várias funções → js/painel-multi.js, que
   compõe UM Painel a partir dos adaptadores de cada domínio.

   Responde "o que EU preciso saber ou fazer agora?". Não é a Central B7
   (visão da agência) nem uma cópia da Produção de Vídeo: resume, prioriza
   e leva para a tela canônica de cada coisa.

   Quem vê: videomaker pelo papel principal ou pela função extra (Kevin =
   admin + videomaker). Não é troca de perfil — admin continua admin; o
   Painel é só mais uma tela, e ela mostra APENAS o trabalho da pessoa,
   mesmo quando o RLS deixaria ver a agência inteira (B7.Perm.painelElegivel).

   Dados: nenhuma tabela nova. Três leituras escopadas (js/database.js):
     • painelDemandasAtivas — demandas_edicao_resumo, videomaker = eu,
       sem entregue/descartado;
     • painelEntregas       — log demandas_edicao_eventos → 'entregue'
       (NÃO entregue_em, que a importação carimbou com a data dela);
     • painelGravacoes      — view agenda_compromissos, tipo 'gravacao'.
   Cada fonte carrega e falha sozinha: uma seção com erro não derruba as
   outras, e erro nunca vira "0".

   Regras canônicas: "atrasada" é B7.Video.ehAtrasada — a mesma regra da
   Produção de Vídeo, para o número do KPI bater com a lista que abre.

   Primitivos (kpi, cabecalhoSecao, linhaAtencao, diaSemana, grafico,
   compromisso) são funções pequenas deste módulo, prontas para o Painel
   do Designer e do Coordenador reaproveitarem — sem motor genérico.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Painel = (function () {
  const esc = s => B7.UI.esc(s);
  const painel = () => document.getElementById('painel-dashboard');
  const hoje = () => B7.UI.hojeISO();
  /* Em "Visualizar como Kevin…" o admin continua logado como ele mesmo,
     mas o Painel mostra o trabalho da pessoa em prévia (só leitura). */
  const emPrevia = () => (B7.PreviaUsuario && B7.PreviaUsuario.ativa && B7.PreviaUsuario.ativa())
    ? B7.PreviaUsuario.usuarioAtivo() : null;
  const meuId = () => {
    const alvo = emPrevia();
    if (alvo && alvo.id) return alvo.id;
    const u = B7.Auth && B7.Auth.usuario(); return u ? u.id : null;
  };

  /* ------------------------------------------------------------ datas
     Datas de calendário (prazo) são texto AAAA-MM-DD e NUNCA passam por
     new Date(texto) — isso lê como meia-noite UTC e, no Brasil, cai no
     dia anterior. Horários de agenda (timestamptz) viram Date normal. */
  /* (fase 6) mesmas funções de data do Calendário B7 — uma regra só */
  const DT = B7.Eventos.DATAS;
  const pad = DT.pad;
  const isoDe = DT.isoLocal;
  const local = DT.local;
  const somarDias = DT.somarDias;
  const difDias = (a, b) => Math.round((local(a) - local(b)) / 86400000);
  const segundaDe = s => { const d = local(s); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return isoDe(d); };
  const DOW = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const DOW_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto',
               'setembro', 'outubro', 'novembro', 'dezembro'];
  const ddmm = s => s.slice(8, 10) + '/' + s.slice(5, 7);
  const hora = DT.horaDoInstante;
  const diaDoTs = DT.diaDoInstante;
  function quandoDia(s) {
    const n = difDias(s, hoje());
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    return DOW_LONGO[local(s).getDay()] + ', ' + ddmm(s);
  }

  /* ------------------------------------------------------------ regras */
  const ativa = d => d.editing_status !== 'entregue' && d.editing_status !== 'descartado';
  const atrasada = d => (B7.Video && B7.Video.ehAtrasada) ? B7.Video.ehAtrasada(d)
    : !!(d.prazo && d.prazo < hoje() && ativa(d) && d.editing_status !== 'aguardando_aprovacao');
  /* mesma semântica do atraso: "aguardando aprovação" já saiu das mãos
     do videomaker, então não "vence" pra ele */
  const comPrazoMeu = d => ativa(d) && d.editing_status !== 'aguardando_aprovacao' && !!d.prazo;
  const venceHoje = d => comPrazoMeu(d) && d.prazo === hoje();
  /* nas mãos: o que o videomaker está (ou deveria estar) editando agora.
     Aguardando aprovação está com o cliente; standby está parado por
     decisão — nenhum dos dois é carga de edição. */
  const NAS_MAOS = ['pendente', 'em_edicao', 'correcao'];
  const rotuloSit = s => (B7.Video && B7.Video.rotuloSituacao) ? B7.Video.rotuloSituacao(s) : s;

  /* ------------------------------------------------------------ estado
     Uma entrada por fonte: 'carregando' | 'ok' | 'erro'. */
  const S = { ativas: null, entregas: null, agenda: null };
  const SEMANAS_GRAFICO = 6;
  let geracao = 0;   /* descarta resposta de uma abertura anterior da tela */
  /* quando o Painel é COMPOSTO (várias funções, js/painel-multi.js), este
     módulo não pinta: só carrega e avisa quem compõe */
  let ouvinte = null;

  /* Consultas iguais entre domínios (ex.: gravações da agenda, que o
     vídeo e a coordenação leem com a MESMA janela) saem uma vez só por
     abertura do Painel. reiniciarCompartilhadas() a cada abertura. */
  let compartilhadas = new Map();
  function umaVez(chave, fn) {
    if (!compartilhadas.has(chave)) {
      const p = Promise.resolve().then(fn);
      compartilhadas.set(chave, p);
      p.catch(() => compartilhadas.delete(chave));   /* falhou: "Tentar de novo" consulta de novo */
    }
    return compartilhadas.get(chave);
  }
  function reiniciarCompartilhadas() { compartilhadas = new Map(); }
  /* janela única das gravações (segunda desta semana → 15 dias à frente) */
  /* Gravações do Painel = a MESMA fonte do Calendário B7 (ocorrências
     via B7.Eventos): só a data atual de cada gravação, marcada ou
     remarcada (não cancelada nem concluída). Da agenda do Google entram
     só os eventos AINDA SEM gravação vinculada — os vinculados já vêm
     pela ocorrência, com a data do B7 (nunca duas vezes, nunca a data
     antiga de um evento que não sincronizou). */
  function gravacoesDaJanela() {
    const ini = segundaDe(hoje()), fim = somarDias(hoje(), 15);
    return umaVez('gravacoes', async () => {
      const [evs, agenda] = await Promise.all([
        B7.Eventos.carregarDominio('gravacao', ini, fim),
        B7.DB.painelGravacoes(local(ini).toISOString(), local(somarDias(fim, 1)).toISOString()).catch(() => [])
      ]);
      const doB7 = evs.filter(e => !e.historico && !e.cancelado && !e.concluido).map(e => ({
        origem: 'ocorrencia', id: e.ocorrenciaId, titulo: e.titulo, inicio: e.extra.bruto.inicio, fim: e.extra.bruto.fim,
        dia_inteiro: e.diaInteiro, local: e.extra.local, gravacao_id: e.fonteId, cliente_nome: e.clienteNome,
        client_id: e.clienteId, videomaker_id: e.responsavelId }));
      const soGoogle = (agenda || []).filter(g => g.origem === 'evento' && !g.gravacao_id);
      return doB7.concat(soGoogle).sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
    });
  }

  function comTempoLimite(p, ms) {
    let id;
    return Promise.race([p, new Promise((_, r) => { id = setTimeout(() => r(new Error('A conexão demorou demais para responder.')), ms); })])
      .finally(() => clearTimeout(id));
  }

  function carregar(fonte) {
    const g = geracao, uid = meuId();
    S[fonte] = { estado: 'carregando' };
    pintar();
    let p;
    if (fonte === 'ativas') p = B7.DB.painelDemandasAtivas(uid);
    else if (fonte === 'entregas') {
      const inicio = somarDias(segundaDe(hoje()), -7 * (SEMANAS_GRAFICO - 1));
      p = B7.DB.painelEntregas(uid, local(inicio).toISOString());
    } else {
      /* da segunda desta semana (a "Minha semana" mostra os dias que já
         passaram) até 14 dias à frente (KPI de 7 dias + compromissos) */
      p = gravacoesDaJanela();
    }
    comTempoLimite(p, 15000)
      .then(dados => { if (g === geracao) { S[fonte] = { estado: 'ok', dados: dados || [] }; pintar(); if (ouvinte) ouvinte(); } })
      .catch(e => { if (g === geracao) { S[fonte] = { estado: 'erro', erro: (e && e.message) || '' }; pintar(); if (ouvinte) ouvinte(); } });
  }

  /* =================================================================
     PRIMITIVOS — reaproveitáveis pelos próximos Painéis
     ================================================================= */
  const IC = {
    seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    relogio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.6V12l3 1.9"/></svg>',
    alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 4.7a1.5 1.5 0 0 1 2.6 0l7.5 13.1a1.5 1.5 0 0 1-1.3 2.2h-15a1.5 1.5 0 0 1-1.3-2.2z"/><path d="M12 9.6V14M12 17h.01"/></svg>',
    refazer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.7 5.7L4 15.5"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6.5" width="12.5" height="11" rx="3.1"/><path d="M15 10.7l4.8-3a.8.8 0 0 1 1.2.7v7.2a.8.8 0 0 1-1.2.7l-4.8-3z"/></svg>',
    pausa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M10 9v6M14 9v6"/></svg>',
    agenda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="4.5" width="17" height="16" rx="3.6"/><path d="M3.5 9.5h17M8 2.8v3M16 2.8v3"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="M8.2 12.3l2.6 2.6 5-5.4"/></svg>',
    subiu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 16l5-5 3.5 3.5L19 8"/><path d="M14 8h5v5"/></svg>'
  };

  /* Card de número. Com href vira link de verdade (Tab + Enter); sem
     destino útil, fica como bloco estático — não finge ser clicável. */
  function kpi(o) {
    const conteudo = o.estado === 'carregando'
      ? '<span class="pn-kpi-rot">' + esc(o.rotulo) + '</span><i class="esq pn-sk-num"></i><i class="esq pn-sk-sub"></i>'
      : o.estado === 'erro'
        ? '<span class="pn-kpi-rot">' + esc(o.rotulo) + '</span><b class="pn-kpi-num">—</b><span class="pn-kpi-sub pn-erro-tx">Não carregou</span>'
        : '<span class="pn-kpi-rot">' + esc(o.rotulo) + '</span><b class="pn-kpi-num">' + o.valor + '</b>' +
          '<span class="pn-kpi-sub">' + esc(o.sub || '') + '</span>' + (o.href ? '<span class="cp-seta pn-kpi-seta">' + IC.seta + '</span>' : '');
    const cls = 'cp-num pn-kpi' + (o.tom && o.estado === 'ok' ? ' pn-tom-' + o.tom : '') +
      (o.estado === 'carregando' ? ' esqueleto-tela' : '');
    return o.href && o.estado === 'ok'
      ? '<a class="' + cls + '" href="' + esc(o.href) + '" aria-label="' + esc(o.aria || (o.valor + ' ' + o.rotulo)) + '">' + conteudo + '</a>'
      : '<div class="' + cls + (o.href ? '' : ' estatico') + '">' + conteudo + '</div>';
  }

  function cabecalhoSecao(id, titulo, link) {
    return '<div class="pn-sec-cab"><h2 id="' + id + '">' + esc(titulo) + '</h2>' +
      (link ? '<a class="pn-link" href="' + esc(link.href) + '">' + esc(link.rotulo) + IC.seta + '</a>' : '') + '</div>';
  }

  function blocoCarregando(linhas) {
    return '<div class="esqueleto-tela pn-sk-lista" role="status" aria-label="Carregando…">' +
      Array.from({ length: linhas }, (_, i) => '<div class="pn-sk-linha" style="--esq-d:' + i + '"><i class="esq pn-sk-ic"></i><div><i class="esq pn-sk-l1"></i><i class="esq pn-sk-l2"></i></div></div>').join('') +
      '</div>';
  }
  function blocoErro(texto, fontes) {
    return '<div class="pn-erro" role="alert"><span>' + esc(texto) + '</span>' +
      '<button type="button" class="b fina contorno" data-pn-retentar="' + esc(fontes.join(',')) + '">Tentar de novo</button></div>';
  }
  function blocoVazio(texto, sub) {
    return '<div class="pn-vazio"><span class="pn-vazio-ic">' + IC.ok + '</span><div><b>' + esc(texto) + '</b>' +
      (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div></div>';
  }

  function logoMini(d) {
    if (!d.cliente_nome) return '';
    return d.cliente_logo_url
      ? '<img class="pn-logo" src="' + esc(d.cliente_logo_url) + '" alt="" loading="lazy" data-ini="' + esc(B7.UI.iniciais(d.cliente_nome)) + '">'
      : '<span class="pn-logo pn-logo-vazia">' + esc(B7.UI.iniciais(d.cliente_nome)) + '</span>';
  }

  /* Uma linha de "Precisa da sua atenção": etiqueta (ícone + texto, a
     urgência nunca depende só da cor), título e contexto. */
  function linhaAtencao(it) {
    return '<a class="pn-att pn-att-' + it.tom + '" href="' + esc(it.href) + '">' +
      '<span class="pn-att-ic" aria-hidden="true">' + it.icone + '</span>' +
      '<span class="pn-att-tx"><span class="pn-att-tag">' + esc(it.tag) + '</span>' +
        '<b>' + esc(it.titulo) + '</b>' +
        (it.meta ? '<span class="pn-att-meta">' + it.meta + '</span>' : '') + '</span>' +
      '<span class="pn-att-seta" aria-hidden="true">' + IC.seta + '</span></a>';
  }

  /* Um dia da semana: ícone + número por tipo de coisa; a palavra
     aparece quando cabe (linha no celular) e sempre vai inteira no
     aria-label. d = { iso, hoje, passado, itens:[{cls, ic, n, um, varios}],
     href? } — com href o dia vira link para a tela canônica daquele dia. */
  function diaSemana(d) {
    const cheios = (d.itens || []).filter(i => i.n);
    const partes = cheios.map(i => '<span class="pn-dia-i ' + i.cls + '" title="' + i.n + ' ' + (i.n === 1 ? i.um : i.varios) + '">' +
      i.ic + '<b>' + i.n + '</b><em> ' + (i.n === 1 ? i.um : i.varios) + '</em></span>');
    const resumo = partes.length ? partes.join('') : '<span class="pn-dia-livre">Livre</span>';
    const falado = DOW_LONGO[local(d.iso).getDay()] + ' ' + ddmm(d.iso) + ': ' +
      (cheios.length ? cheios.map(i => i.n + ' ' + (i.n === 1 ? i.um : i.varios)).join(', ') : 'livre');
    const cls = 'pn-dia' + (d.hoje ? ' hoje' : '') + (d.passado ? ' passado' : '') + (d.alerta ? ' com-alerta' : '');
    const miolo = '<span class="pn-dia-cab"><span class="pn-dia-dow">' + DOW[local(d.iso).getDay()] + '</span>' +
        '<span class="pn-dia-num">' + d.iso.slice(8, 10) + '</span>' + (d.hoje ? '<span class="pn-dia-hoje">hoje</span>' : '') + '</span>' +
      '<span class="pn-dia-itens">' + resumo + '</span>';
    if (d.botao) return '<li class="pn-dia-w"><button type="button" class="' + cls + ' pn-dia-lk" data-pn-dia="' + esc(d.iso) + '" aria-haspopup="dialog" aria-label="' + esc(falado + ' — ver o dia') + '">' + miolo + '</button></li>';
    return d.href
      ? '<li class="pn-dia-w"><a class="' + cls + ' pn-dia-lk" href="' + esc(d.href) + '" aria-label="' + esc(falado) + '">' + miolo + '</a></li>'
      : '<li class="' + cls + '" aria-label="' + esc(falado) + '">' + miolo + '</li>';
  }

  /* Barras em HTML (não SVG com viewBox esticado): o texto nunca deforma
     e a largura acompanha a tela. Série única — sem legenda; a semana
     atual leva o acento, as outras ficam neutras. Número direto só na
     semana atual; as demais mostram no hover/foco (tooltip). */
  function grafico(semanas) {
    const max = Math.max(1, ...semanas.map(s => s.n));
    return '<div class="pn-graf" role="group" aria-label="Entregas por semana">' +
      semanas.map(s =>
        '<div class="pn-graf-col' + (s.atual ? ' atual' : '') + '" tabindex="0" ' +
          'aria-label="' + esc('Semana de ' + ddmm(s.inicio) + ': ' + s.n + (s.n === 1 ? ' entrega' : ' entregas')) + '">' +
          /* o número fica à vista em toda semana com entrega: no celular
             não existe hover para revelar o tooltip */
          '<span class="pn-graf-trilho">' + (s.atual || s.n ? '<span class="pn-graf-val">' + s.n + '</span>' : '') +
            '<i style="height:' + (s.n ? Math.max(5, Math.round(s.n / max * 82)) : 0) + '%"></i></span>' +
          '<span class="pn-graf-rot">' + (s.atual ? 'Esta' : ddmm(s.inicio)) + '</span>' +
          '<span class="pn-graf-tip" role="tooltip">' + s.n + (s.n === 1 ? ' entrega' : ' entregas') + '<small>' + ddmm(s.inicio) + ' – ' + ddmm(somarDias(s.inicio, 6)) + '</small></span>' +
        '</div>').join('') +
      '</div>';
  }

  function compromisso(c) {
    return '<a class="cp-ag-item pn-comp" href="' + esc(c.href) + '">' +
      '<span class="cp-ag-data"><span class="dow">' + DOW[local(c.dia).getDay()] + '</span><span class="dt">' + ddmm(c.dia) + '</span></span>' +
      '<span class="cp-ag-tx"><b>' + esc(c.titulo) + '</b><span class="cp-ag-meta">' + c.meta + '</span></span>' +
      '<span class="pn-comp-tipo pn-comp-' + c.tipo + '">' + (c.tipo === 'gravacao' ? IC.camera : IC.relogio) +
        '<span>' + (c.tipo === 'gravacao' ? 'Gravação' : 'Prazo') + '</span></span></a>';
  }

  /* =================================================================
     DERIVAÇÕES — tudo calculado a partir das fontes canônicas
     ================================================================= */
  /* a MESMA gravação chega pelo vídeo e pela coordenação (mesma agenda):
     a chave é a gravação do sistema, senão o compromisso da agenda */
  const chaveGrav = g => 'grav:' + (g.gravacao_id || ('ag:' + g.origem + ':' + g.id));
  const ok = f => S[f] && S[f].estado === 'ok';
  const minhas = () => ok('ativas') ? S.ativas.dados : [];
  /* gravações do videomaker: as que são DELE (gravacoes.videomaker_id,
     Gravações 2.0) e as que ainda não têm responsável — nunca as de outro
     videomaker. A consulta é a mesma da coordenação (compartilhada); o
     recorte pessoal é feito aqui. */
  const gravacoes = () => ok('agenda') ? S.agenda.dados.filter(g => !g.videomaker_id || g.videomaker_id === meuId()) : [];

  /* Ordem de prioridade (primeiro que couber, sem repetir a mesma demanda):
       1. atrasadas            — no máximo 2 aqui; o KPI já conta todas
       2. gravação HOJE        — compromisso físico, com hora marcada
       3. correção solicitada
       4. vence hoje
       5. gravação amanhã
       6. standby vencido      (standby_revisar_em já chegou)
       7. vence amanhã
     A lista mostra até 5; o resto vive na fila e nos compromissos. */
  const MAX_ATENCAO = 5, MAX_ATRASADAS = 2;
  function itensAtencao() {
    const lista = [], vistos = new Set();
    const add = (chave, it) => { if (!vistos.has(chave)) { vistos.add(chave); it.chave = chave; lista.push(it); } };
    const ds = minhas();
    const cli = d => d.cliente_nome ? logoMini(d) + '<span>' + esc(d.cliente_nome) + '</span>' : '';
    const hrefD = d => '#/video/' + d.id;

    const atrasadasOrd = ds.filter(atrasada).sort((a, b) => a.prazo.localeCompare(b.prazo));
    atrasadasOrd.slice(0, MAX_ATRASADAS).forEach(d => {
      const n = difDias(hoje(), d.prazo);
      add(d.id, { demanda: true, prio: 1, dia: d.prazo, tom: 'erro', icone: IC.alerta, tag: 'Atrasada há ' + n + (n === 1 ? ' dia' : ' dias'),
        titulo: d.titulo, meta: cli(d) + '<span>' + esc(rotuloSit(d.editing_status)) + '</span>', href: hrefD(d) });
    });

    const agora = Date.now();
    const grav = dias => gravacoes().filter(g => {
      const t = new Date(g.inicio).getTime();
      return t >= agora - 3600000 && dias.includes(diaDoTs(g.inicio));
    }).forEach(g => add(chaveGrav(g), { prio: dias[0] === hoje() ? 3 : 4, dia: diaDoTs(g.inicio),
      tom: 'acento', icone: IC.camera,
      tag: 'Gravação ' + quandoDia(diaDoTs(g.inicio)) + (g.dia_inteiro ? '' : ' · ' + hora(g.inicio)),
      titulo: g.titulo, meta: g.local ? '<span>' + esc(g.local) + '</span>' : '',
      href: g.gravacao_id ? '#/gravacao/' + g.gravacao_id : '#/calendario' }));

    grav([hoje()]);
    ds.filter(d => d.editing_status === 'correcao').forEach(d => add(d.id, {
      demanda: true, prio: 2, dia: d.prazo, tom: 'ambar', icone: IC.refazer, tag: 'Correção solicitada', titulo: d.titulo,
      meta: cli(d) + (d.prazo ? '<span>prazo ' + ddmm(d.prazo) + '</span>' : ''), href: hrefD(d) }));
    ds.filter(venceHoje).forEach(d => add(d.id, {
      demanda: true, prio: 3, dia: d.prazo, tom: 'ambar', icone: IC.relogio, tag: 'Vence hoje', titulo: d.titulo,
      meta: cli(d) + '<span>' + esc(rotuloSit(d.editing_status)) + '</span>', href: hrefD(d) }));
    grav([somarDias(hoje(), 1)]);
    ds.filter(d => d.editing_status === 'standby' && d.standby_revisar_em && d.standby_revisar_em <= hoje())
      .forEach(d => add(d.id, { demanda: true, prio: 5, dia: d.standby_revisar_em, tom: 'neutro', icone: IC.pausa, tag: 'Revisar standby', titulo: d.titulo,
        meta: cli(d) + '<span>marcado para ' + ddmm(d.standby_revisar_em) + '</span>', href: hrefD(d) }));
    ds.filter(d => comPrazoMeu(d) && d.prazo === somarDias(hoje(), 1)).forEach(d => add(d.id, {
      demanda: true, prio: 4, dia: d.prazo, tom: 'neutro', icone: IC.agenda, tag: 'Vence amanhã', titulo: d.titulo,
      meta: cli(d) + '<span>' + esc(rotuloSit(d.editing_status)) + '</span>', href: hrefD(d) }));
    /* o teto de 2 atrasadas só existe pra abrir espaço: sobrando vaga,
       as demais atrasadas entram logo depois das duas primeiras (ainda
       na frente de tudo o mais que for menos urgente) */
    const sobra = atrasadasOrd.slice(MAX_ATRASADAS);
    const vagas = Math.max(0, MAX_ATENCAO - lista.length);
    const entram = sobra.slice(0, vagas).map(d => {
      const n = difDias(hoje(), d.prazo);
      return { chave: d.id, demanda: true, prio: 1, dia: d.prazo, tom: 'erro', icone: IC.alerta, tag: 'Atrasada há ' + n + (n === 1 ? ' dia' : ' dias'),
        titulo: d.titulo, meta: cli(d) + '<span>' + esc(rotuloSit(d.editing_status)) + '</span>', href: hrefD(d) };
    }).filter(it => !vistos.has(it.chave));
    const posicao = Math.min(MAX_ATRASADAS, atrasadasOrd.length);
    lista.splice(posicao, 0, ...entram);
    const final = lista.slice();
    final.atrasadasFora = Math.max(0, sobra.length - entram.length);
    return final;
  }

  function diasDaSemana() {
    const seg = segundaDe(hoje());
    const dias = Array.from({ length: 7 }, (_, i) => {
      const iso = somarDias(seg, i);
      const doDia = minhas().filter(d => comPrazoMeu(d) && d.prazo === iso);
      const passado = iso < hoje();
      const nAtr = passado ? doDia.filter(atrasada).length : 0;
      return { iso, hoje: iso === hoje(), passado, alerta: nAtr > 0, itens: [
        { cls: 'pn-dia-atraso', ic: IC.alerta, n: nAtr, um: 'atrasada', varios: 'atrasadas' },
        { cls: 'pn-dia-prazo', ic: IC.relogio, n: passado ? 0 : doDia.length, um: 'prazo', varios: 'prazos' },
        { cls: 'pn-dia-grav', ic: IC.camera, n: gravacoes().filter(g => diaDoTs(g.inicio) === iso).length, um: 'gravação', varios: 'gravações' }
      ] };
    });
    /* fim de semana só entra quando tem alguma coisa nele */
    return dias.filter((d, i) => i < 5 || d.itens.some(x => x.n));
  }

  function semanasEntregues() {
    const ultimo = {};
    (S.entregas.dados || []).forEach(e => {
      if (!e.demandas_edicao || e.demandas_edicao.editing_status !== 'entregue') return; /* reaberta depois */
      if (!ultimo[e.demanda_id] || e.created_at > ultimo[e.demanda_id]) ultimo[e.demanda_id] = e.created_at;
    });
    const segAtual = segundaDe(hoje());
    const semanas = Array.from({ length: SEMANAS_GRAFICO }, (_, i) => {
      const inicio = somarDias(segAtual, -7 * (SEMANAS_GRAFICO - 1 - i));
      return { inicio, n: 0, atual: inicio === segAtual };
    });
    Object.values(ultimo).forEach(ts => {
      const s = semanas.find(w => w.inicio === segundaDe(diaDoTs(ts)));
      if (s) s.n++;
    });
    return semanas;
  }

  function proximosCompromissos(jaListados, limite) {
    const agora = Date.now();
    const itens = [];
    gravacoes().filter(g => new Date(g.inicio).getTime() >= agora && !jaListados.has(chaveGrav(g))).forEach(g => itens.push({ chave: chaveGrav(g),
      tipo: 'gravacao', dia: diaDoTs(g.inicio), ordem: new Date(g.inicio).getTime(), titulo: g.titulo,
      meta: '<span>' + esc(quandoDia(diaDoTs(g.inicio))) + (g.dia_inteiro ? ', dia todo' : ' · ' + hora(g.inicio)) + '</span>' +
            (g.local ? '<span>' + esc(g.local) + '</span>' : ''),
      href: g.gravacao_id ? '#/gravacao/' + g.gravacao_id : '#/calendario' }));
    minhas().filter(d => comPrazoMeu(d) && d.prazo >= hoje() && !jaListados.has(d.id)).forEach(d => itens.push({
      /* prazo não tem hora: ordena como fim do dia, depois das gravações dele */
      chave: d.id, tipo: 'prazo', dia: d.prazo, ordem: local(d.prazo).getTime() + 86399000, titulo: d.titulo,
      meta: '<span>' + esc(quandoDia(d.prazo)) + '</span>' + (d.cliente_nome ? '<span>' + esc(d.cliente_nome) + '</span>' : ''),
      href: '#/video/' + d.id }));
    return itens.sort((a, b) => a.ordem - b.ordem).slice(0, limite || 3);
  }

  /* =================================================================
     PINTURA — cada seção se desenha a partir do estado das SUAS fontes
     ================================================================= */
  function estadoDe(...fontes) {
    if (fontes.some(f => S[f] && S[f].estado === 'erro')) return 'erro';
    if (fontes.some(f => !S[f] || S[f].estado === 'carregando')) return 'carregando';
    return 'ok';
  }

  function pintarKpis() {
    const cx = document.getElementById('pn-kpis'); if (!cx) return;
    const eA = estadoDe('ativas'), eG = estadoDe('agenda');
    const ds = minhas();
    const nAtr = ds.filter(atrasada).length;
    const nHoje = ds.filter(venceHoje).length;
    const maos = ds.filter(d => NAS_MAOS.includes(d.editing_status));
    const nEd = maos.filter(d => d.editing_status === 'em_edicao').length;
    const nCor = maos.filter(d => d.editing_status === 'correcao').length;
    const nPend = maos.filter(d => d.editing_status === 'pendente').length;
    const agora = Date.now(), em7 = agora + 7 * 86400000;
    const grav7 = gravacoes().filter(g => { const t = new Date(g.inicio).getTime(); return t >= agora && t < em7; });
    const prox = grav7[0];
    const subMaos = [nEd && nEd + ' em edição', nCor && nCor + (nCor === 1 ? ' correção' : ' correções'),
                     nPend && nPend + ' para iniciar'].filter(Boolean).join(' · ');

    cx.innerHTML =
      kpi({ estado: eA, rotulo: 'Atrasadas', valor: nAtr, tom: nAtr ? 'erro' : '',
            sub: nAtr ? 'prazo de edição vencido' : 'nenhuma demanda atrasada',
            href: nAtr ? '#/video?prazo=atrasadas&minha=1&comp=todas' : null,
            aria: nAtr + ' demandas atrasadas — abrir na Produção de Vídeo' }) +
      kpi({ estado: eA, rotulo: 'Vencem hoje', valor: nHoje, tom: nHoje ? 'ambar' : '',
            sub: nHoje ? 'entregar até o fim do dia' : 'nada vence hoje',
            href: nHoje ? '#/video?prazo=hoje&minha=1&comp=todas' : null,
            aria: nHoje + ' demandas vencem hoje — abrir na Produção de Vídeo' }) +
      kpi({ estado: eA, rotulo: 'Em produção', valor: maos.length,
            sub: subMaos || 'nada nas suas mãos agora',
            href: '#/video?minha=1&comp=todas', aria: maos.length + ' demandas em produção — abrir sua fila' }) +
      kpi({ estado: eG, rotulo: 'Próximas gravações', valor: grav7.length,
            sub: prox ? 'próxima ' + quandoDia(diaDoTs(prox.inicio)) + (prox.dia_inteiro ? '' : ', ' + hora(prox.inicio)) : 'nenhuma nos próximos 7 dias',
            href: '#/calendario', aria: grav7.length + ' gravações nos próximos 7 dias — abrir o calendário' });
  }

  function pintarAtencao() {
    const cx = document.getElementById('pn-atencao'); if (!cx) return;
    const e = estadoDe('ativas');
    let corpo;
    if (e === 'carregando') corpo = blocoCarregando(3);
    else if (e === 'erro') corpo = blocoErro('Não foi possível carregar suas demandas.', ['ativas']);
    else {
      const itens = itensAtencao();
      /* "+N" conta só demandas (gravação escondida já aparece em
         Próximos compromissos) — o link leva à fila, então o número
         precisa ser do que está na fila */
      const foraDemandas = itens.slice(MAX_ATENCAO).filter(i => i.demanda).length + itens.atrasadasFora;
      corpo = itens.length
        ? '<div class="pn-att-lista">' + itens.slice(0, MAX_ATENCAO).map(linhaAtencao).join('') + '</div>' +
          (foraDemandas ? '<a class="pn-mais" href="#/video?minha=1&comp=todas">+' + foraDemandas +
            (foraDemandas === 1 ? ' demanda' : ' demandas') + ' na sua fila' + IC.seta + '</a>' : '')
        : blocoVazio('Tudo em dia por aqui.', 'Nada atrasado, nenhuma correção e nenhuma gravação nas próximas 48 horas.');
      /* a agenda ainda chegando não segura a lista — ela entra quando vier */
      if (S.agenda && S.agenda.estado === 'erro') corpo += '<p class="pn-nota">As gravações não carregaram — a lista mostra só as demandas.</p>';
    }
    cx.innerHTML = cabecalhoSecao('pn-t-atencao', 'Precisa da sua atenção', { href: '#/video?minha=1&comp=todas', rotulo: 'Minha fila' }) + corpo;
  }

  function pintarSemana() {
    const cx = document.getElementById('pn-semana'); if (!cx) return;
    const e = estadoDe('ativas', 'agenda');
    const seg = segundaDe(hoje());
    const titulo = 'Minha semana';
    let corpo;
    if (e === 'carregando') corpo = '<div class="esqueleto-tela pn-sk-semana">' + Array.from({ length: 5 }, (_, i) => '<i class="esq" style="--esq-d:' + i + '"></i>').join('') + '</div>';
    else if (e === 'erro') corpo = blocoErro('Não foi possível montar sua semana.', ['ativas', 'agenda'].filter(f => S[f] && S[f].estado === 'erro'));
    else corpo = '<ol class="pn-semana-lista">' + diasDaSemana().map(diaSemana).join('') + '</ol>';
    cx.innerHTML = '<div class="pn-sec-cab"><h2 id="pn-t-semana">' + titulo + '</h2>' +
      '<span class="pn-sec-sub">' + ddmm(seg) + ' – ' + ddmm(somarDias(seg, 6)) + '</span>' + (B7.Perm && B7.Perm.podeRota('calendario') ? '<a class="pn-link pn-link-cal" href="#/calendario?v=semana&amp;d=' + seg + '">Ver no calendário</a>' : '') + '</div>' + corpo;
  }

  /* O gráfico do vídeo como peça solta: o Painel do Videomaker e o
     Painel composto (várias funções) desenham o MESMO gráfico. */
  function graficoVideo() {
    const e = estadoDe('entregas');
    let corpo;
    if (e === 'carregando') corpo = '<div class="esqueleto-tela pn-sk-graf">' + Array.from({ length: SEMANAS_GRAFICO }, (_, i) => '<i class="esq" style="--esq-d:' + i + '"></i>').join('') + '</div>';
    else if (e === 'erro') corpo = blocoErro('Não foi possível carregar suas entregas.', ['entregas']);
    else {
      const semanas = semanasEntregues();
      const total = semanas.reduce((s, w) => s + w.n, 0);
      const atual = semanas[semanas.length - 1].n;
      const anteriores = semanas.slice(0, -1);
      const media = anteriores.length ? anteriores.reduce((s, w) => s + w.n, 0) / anteriores.length : 0;
      /* só o lado bom: a semana ainda está em curso, então "abaixo da
         média" numa terça seria um aviso falso */
      const acima = media > 0 && atual - media >= 0.5
        ? '<em class="pn-delta">' + IC.subiu + 'acima da média</em>' : '';
      corpo = !total
        ? blocoVazio('Nenhuma entrega registrada nas últimas semanas.', 'As entregas aparecem aqui quando a demanda é marcada como entregue.')
        : '<div class="pn-prod-corpo"><div class="pn-graf-resumo">' +
          '<div><b>' + total + '</b><span>em ' + SEMANAS_GRAFICO + ' semanas</span></div>' +
          '<div><b>' + atual + '</b><span>nesta semana</span>' + acima + '</div>' +
          '<div><b>' + (Math.round(media * 10) / 10).toString().replace('.', ',') + '</b><span>média semanal</span></div>' +
        '</div>' +
        grafico(semanas) + '</div>';
    }
    return { estado: e, titulo: 'Minha produção', sub: 'vídeos entregues por semana',
             link: { href: '#/video?minha=1&comp=todas&status=entregue', rotulo: 'Ver entregues' }, corpo };
  }
  function pintarProducao() {
    const cx = document.getElementById('pn-producao'); if (!cx) return;
    const g = graficoVideo();
    cx.innerHTML = cabecalhoSecao('pn-t-producao', g.titulo, g.link) + g.corpo;
  }

  function pintarCompromissos() {
    const cx = document.getElementById('pn-compromissos'); if (!cx) return;
    const e = estadoDe('ativas', 'agenda');
    let corpo;
    if (e === 'carregando') corpo = blocoCarregando(3);
    else if (e === 'erro') corpo = blocoErro('Não foi possível carregar seus compromissos.', ['ativas', 'agenda'].filter(f => S[f] && S[f].estado === 'erro'));
    else {
      /* o que já aparece em "Precisa da sua atenção" não se repete aqui */
      const listados = new Set(itensAtencao().slice(0, MAX_ATENCAO).map(it => it.chave));
      const itens = proximosCompromissos(listados);
      corpo = itens.length ? '<div class="cp-agenda-lista">' + itens.map(compromisso).join('') + '</div>'
        : blocoVazio('Nada marcado para os próximos dias.', 'Gravações da agenda e prazos seus aparecem aqui.');
    }
    cx.innerHTML = cabecalhoSecao('pn-t-comp', 'Próximos compromissos', { href: '#/calendario?v=semana', rotulo: 'Ver no calendário' }) + corpo;
  }

  /* A frase do dia, logo abaixo da saudação: o Painel diz em uma linha o
     que pede ação hoje, com os MESMOS números dos KPIs (mesmas regras).
     Enquanto as demandas carregam ou se falharem, não aparece — erro
     nunca vira "nada urgente". */
  function pintarResumo() {
    const cx = document.getElementById('pn-resumo'); if (!cx) return;
    if (estadoDe('ativas') !== 'ok') { cx.innerHTML = ''; return; }
    const ds = minhas(), agora = Date.now();
    const nAtr = ds.filter(atrasada).length, nHoje = ds.filter(venceHoje).length;
    const futuras = gravacoes().filter(g => new Date(g.inicio).getTime() >= agora - 3600000);
    const nGrav = futuras.filter(g => diaDoTs(g.inicio) === hoje()).length;
    const partes = [
      nAtr && '<b class="t-erro">' + nAtr + (nAtr === 1 ? ' demanda atrasada' : ' demandas atrasadas') + '</b>',
      nHoje && '<b class="t-ambar">' + nHoje + (nHoje === 1 ? ' entrega para hoje' : ' entregas para hoje') + '</b>',
      nGrav && '<b class="t-acento">' + nGrav + (nGrav === 1 ? ' gravação hoje' : ' gravações hoje') + '</b>'
    ].filter(Boolean);
    if (partes.length) {
      cx.innerHTML = 'Você tem ' + (partes.length > 1 ? partes.slice(0, -1).join(', ') + ' e ' : '') + partes[partes.length - 1] + '.';
      return;
    }
    /* sem a agenda ainda não dá para dizer que o dia está livre */
    if (estadoDe('agenda') === 'carregando') { cx.innerHTML = ''; return; }
    const prox = futuras.find(g => new Date(g.inicio).getTime() >= agora);
    cx.innerHTML = 'Nada urgente hoje.' + (prox ? ' Próxima gravação: ' +
      esc(quandoDia(diaDoTs(prox.inicio)) + (prox.dia_inteiro ? '' : ', ' + hora(prox.inicio))) + '.' : '');
  }

  function pintar() {
    if (!document.getElementById('pn-raiz')) return;
    pintarResumo(); pintarKpis(); pintarAtencao(); pintarSemana(); pintarProducao(); pintarCompromissos();
    /* logo quebrada → iniciais (mesma regra do sino) */
    painel().querySelectorAll('img.pn-logo').forEach(img => {
      img.onerror = () => { const s = document.createElement('span'); s.className = 'pn-logo pn-logo-vazia'; s.textContent = img.dataset.ini || ''; img.replaceWith(s); };
    });
    painel().querySelectorAll('[data-pn-retentar]').forEach(b => {
      b.onclick = () => b.dataset.pnRetentar.split(',').filter(Boolean).forEach(carregar);
    });
  }

  /* =================================================================
     CABEÇALHO + ABERTURA
     ================================================================= */
  const ROTULO_PAPEL = { admin: 'Administrador', coordenador: 'Coordenador de mídias', designer: 'Designer',
                         videomaker: 'Videomaker' };
  function saudacao() {
    const h = new Date().getHours();
    return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }
  function papeis() {
    const p = B7.Auth.papel();
    const extras = (B7.Auth.funcoesExtra ? B7.Auth.funcoesExtra() : []).filter(f => f !== p);
    return [p].concat(extras).map(x => ROTULO_PAPEL[x] || x).join(' · ');
  }

  /* Cabeçalho comum aos Painéis: data, saudação, papéis reais, a
     alternância de visão (só para quem tem mais de uma função) e UMA
     ação principal. */
  const ROTULO_VISAO = { coordenacao: 'Coordenação', video: 'Edição de vídeo', design: 'Design' };
  function cabecalho(o) {
    const u = B7.Auth.usuario() || {};
    /* em "Visualizar como…" o nome é o da pessoa em prévia */
    const alvo = emPrevia();
    const nome = ((alvo && alvo.nome) || u.nome || u.username || '').split(' ')[0];
    const d = local(hoje());
    const dataLonga = DOW_LONGO[d.getDay()] + ', ' + d.getDate() + ' de ' + MES[d.getMonth()];
    return '<header class="pn-cab">' +
        '<div class="pn-cab-tx"><p class="pn-kicker">Painel <span>·</span> ' + esc(dataLonga) + '</p>' +
          '<h1>' + esc(saudacao() + (nome ? ', ' + nome : '')) + '</h1>' +
          '<p class="pn-papel">' + esc(papeis()) + '</p>' +
          (o.resumo ? '<p class="pn-resumo" id="pn-resumo" aria-live="polite"></p>' : '') + '</div>' +
        '<div class="pn-cab-lado">' +
          (o.acao || '') +
        '</div>' +
      '</header>';
  }

  function abrirVideo(visoes) {
    geracao++;
    B7.Dashboard.marcarNav('#/painel');
    B7.Rota.titulo(['Painel']);

    painel().innerHTML = '<div class="conteudo entra pn" id="pn-raiz">' +
      cabecalho({ visoes, visao: 'video', resumo: true,
        acao: '<a class="b contorno pn-cab-acao" href="#/video?minha=1&comp=todas">' + IC.camera + '<span>Minha fila de edição</span></a>' }) +
      '<section class="pn-kpis" id="pn-kpis" aria-label="Indicadores"></section>' +
      '<div class="pn-grade">' +
        '<section class="pn-bloco pn-atencao" id="pn-atencao" aria-labelledby="pn-t-atencao"></section>' +
        '<section class="pn-bloco" id="pn-semana" aria-labelledby="pn-t-semana"></section>' +
        '<section class="pn-bloco" id="pn-producao" aria-labelledby="pn-t-producao"></section>' +
        '<section class="pn-bloco" id="pn-compromissos" aria-labelledby="pn-t-comp"></section>' +
      '</div>' +
    '</div>';

    ['ativas', 'entregas', 'agenda'].forEach(carregar);
  }


  /* =================================================================
     ADAPTADOR DE VÍDEO — o que este domínio entrega ao Painel COMPOSTO
     (js/painel-multi.js). Mesmas fontes e mesmas regras do Painel do
     Videomaker; aqui só se normaliza o formato. Nada é gravado.
     ================================================================= */
  const cliTx = d => d.cliente_nome || '';
  const itemDemanda = d => ({ chave: d.id, titulo: d.titulo || 'Demanda sem título', dia: d.prazo || null,
    sub: [cliTx(d), rotuloSit(d.editing_status), d.prazo ? 'prazo ' + ddmm(d.prazo) : ''].filter(Boolean).join(' · '),
    href: '#/video/' + d.id });
  const itemGravacao = g => ({ chave: chaveGrav(g), tipo: 'gravacao', titulo: g.titulo || 'Gravação', dia: diaDoTs(g.inicio),
    sub: [quandoDia(diaDoTs(g.inicio)) + (g.dia_inteiro ? '' : ' · ' + hora(g.inicio)), g.cliente_nome || g.local || ''].filter(Boolean).join(' · '),
    href: g.gravacao_id ? '#/gravacao/' + g.gravacao_id : '#/calendario' });
  const adaptador = {
    dominio: 'video', marca: 'Vídeo', rotuloGrafico: 'Vídeo',
    fontes: ['ativas', 'entregas', 'agenda'],
    iniciar(aoMudar) {
      geracao++; ouvinte = aoMudar;
      Object.keys(S).forEach(k => { S[k] = null; });
      this.fontes.forEach(carregar);
    },
    parar() { ouvinte = null; },
    estado: f => (S[f] ? S[f].estado : 'carregando'),
    recarregar: f => carregar(f),
    atencao() {
      if (!ok('ativas')) return [];
      return itensAtencao().map(it => Object.assign({}, it, { dominio: 'video' }));
    },
    kpi(tipo) {
      const ds = minhas(), h = hoje();
      if (tipo === 'atrasadas') {
        const l = ds.filter(atrasada).sort((a, b) => a.prazo.localeCompare(b.prazo));
        return { fontes: ['ativas'], n: l.length, itens: l.map(itemDemanda), href: '#/video?prazo=atrasadas&minha=1&comp=todas' };
      }
      if (tipo === 'hoje') {
        const l = ds.filter(venceHoje);
        return { fontes: ['ativas'], n: l.length, itens: l.map(itemDemanda), href: '#/video?prazo=hoje&minha=1&comp=todas' };
      }
      if (tipo === 'andamento') {
        const l = ds.filter(d => NAS_MAOS.includes(d.editing_status));
        return { fontes: ['ativas'], n: l.length, itens: l.map(itemDemanda), href: '#/video?minha=1&comp=todas' };
      }
      /* próximos 7 dias: gravações a partir de agora + prazos de amanhã
         em diante (os de hoje já estão em "Vencem hoje") */
      const agora = Date.now(), em7 = agora + 7 * 86400000, ate = somarDias(h, 7);
      const grav = gravacoes().filter(g => { const t = new Date(g.inicio).getTime(); return t >= agora && t < em7; }).map(itemGravacao);
      const prazos = ds.filter(d => comPrazoMeu(d) && d.prazo > h && d.prazo <= ate)
        .map(d => Object.assign(itemDemanda(d), { tipo: 'prazo' }));
      return { fontes: ['ativas', 'agenda'], itens: grav.concat(prazos) };
    },
    /* eventos da semana: prazos (e atrasos) das minhas demandas + gravações */
    semana(dias) {
      const h = hoje(), ev = [];
      minhas().filter(d => comPrazoMeu(d) && dias.includes(d.prazo)).forEach(d => {
        if (d.prazo < h) { if (atrasada(d)) ev.push(Object.assign(itemDemanda(d), { tipo: 'atrasada' })); }
        else ev.push(Object.assign(itemDemanda(d), { tipo: 'prazo' }));
      });
      gravacoes().filter(g => dias.includes(diaDoTs(g.inicio))).forEach(g => ev.push(itemGravacao(g)));
      return ev.map(e => Object.assign(e, { dominio: 'video' }));
    },
    proximos() {
      return proximosCompromissos(new Set(), 20).map(c => Object.assign({}, c, { dominio: 'video' }));
    },
    grafico: () => graficoVideo()
  };

  /* =================================================================
     RESOLUÇÃO DO PAINEL — UM Painel por pessoa, montado pelas funções
     OPERACIONAIS reais (B7.Perm.funcoesOperacionais: coordenador →
     videomaker → designer, ordem fixa). Administrador não é função
     operacional: admin puro não tem Painel (casa = Central B7) e admin +
     função recebe o Painel da função. Sem troca de perfil e sem abas de
     papel: uma função → o Painel dela, inteiro e específico; várias →
     o Painel COMPOSTO (js/painel-multi.js). A função "principal" é a
     primeira da ordem e só decide APRESENTAÇÃO (gráfico inicial, ação do
     cabeçalho) — nunca esconde o trabalho das outras.
     ================================================================= */
  function contexto() {
    const todas = (B7.Perm && B7.Perm.funcoesOperacionais) ? B7.Perm.funcoesOperacionais() : ['videomaker'];
    const tem = { coordenador: !!B7.PainelCoord, videomaker: true, designer: !!B7.PainelDesign };
    const funcoes = todas.filter(f => tem[f]);
    return { funcoes, principal: funcoes[0] || null, multi: funcoes.length > 1 };
  }

  function abrir() {
    reiniciarCompartilhadas();
    ouvinte = null;
    if (B7.PainelMulti && B7.PainelMulti.parar) B7.PainelMulti.parar();
    const ctx = contexto();
    geracao++;
    if (ctx.multi && B7.PainelMulti) return B7.PainelMulti.abrir(ctx);
    if (ctx.principal === 'coordenador') return B7.PainelCoord.abrir({});
    if (ctx.principal === 'designer') return B7.PainelDesign.abrir({});
    return abrirVideo([]);
  }

  /* Primitivos para os outros Painéis (fase 2: js/painel-coord.js). */
  const ui = { esc, IC, kpi, cabecalhoSecao, blocoCarregando, blocoErro, blocoVazio, logoMini, linhaAtencao,
               diaSemana, cabecalho, comTempoLimite, emPrevia, meuId, umaVez, gravacoesDaJanela,
               datas: { hoje, pad, isoDe, local, somarDias, difDias, segundaDe, ddmm, hora, diaDoTs, quandoDia, DOW, DOW_LONGO, MES } };

  /* =================================================================
     CINEMA DO PAINEL (pacote zu, 03/10)
     Cada parte do Painel chega em momentos diferentes (cada fonte pinta
     a sua seção quando carrega). Em vez de amarrar animação em cada
     pintura, um observador olha o painel e, quando algo novo aparece:
     • números (KPIs, resumo da produção, barras) contam de 0 ao valor;
     • blocos abaixo da dobra se revelam ao entrar na tela;
     • o gráfico ganha a classe que faz as barras crescerem.
     Só apresentação: nenhum dado, regra ou link muda. Com "reduzir
     movimento", nada disso roda (e nada fica escondido).
     ================================================================= */
  (function cinema() {
    const reduz = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const alvo = document.getElementById('painel-dashboard');
    if (!alvo || !window.MutationObserver) return;
    /* odômetro: cada dígito do indicador gira uma volta e para no valor */
    const pousar = el => {
      el.classList.add('pn-pousou');
      el.addEventListener('animationend', () => el.classList.remove('pn-pousou'), { once: true });
    };
    const rolar = (el, atraso) => {
      const txt = el.textContent.trim();
      if (!/^\d{1,4}$/.test(txt)) return false;
      const fita = Array.from({ length: 20 }, (_, n) => '<span>' + (n % 10) + '</span>').join('');
      el.innerHTML = '<span class="pn-odo" aria-hidden="true">' + Array.from(txt).map((d, i) =>
        '<span class="pn-odo-col"><span class="pn-odo-fita" style="--d:' + d + ';--i:' + i + '">' + fita + '</span></span>').join('') +
        '</span><span class="sr-only">' + txt + '</span>';
      const odo = el.firstChild;
      /* a fita já aparece no 0 enquanto o cartão cai; gira quando ele pousa */
      const total = (atraso || 0) + 1250 + (txt.length - 1) * 230 + 120;
      setTimeout(() => { void odo.offsetWidth; odo.classList.add('gira'); }, Math.max(30, atraso || 0));
      setTimeout(() => {
        if (!odo.isConnected) return;
        odo.classList.add('parou');
        el.textContent = txt;
        pousar(el);
      }, total);
      return true;
    };
    const contar = (el, atraso) => {
      if (el.dataset.pnContou) return;
      const txt = el.textContent.trim(), m = txt.match(/^(\d+)([.,]\d+)?$/);
      el.dataset.pnContou = '1';
      if (!m || reduz()) return;
      if (el.classList.contains('pn-kpi-num') && rolar(el, atraso)) return;
      const fim = parseFloat(txt.replace(',', '.')), dec = m[2] ? m[2].length - 1 : 0;
      if (fim <= 1 && !dec) return;
      const t0 = performance.now(), DUR = el.classList.contains('pn-kpi-num') ? 1300 : 900;
      const quadro = agora => {
        const p = Math.min(1, (agora - t0) / DUR), e = 1 - Math.pow(1 - p, 4);
        el.textContent = (fim * e).toFixed(dec).replace('.', ',');
        if (p < 1) return requestAnimationFrame(quadro);
        el.textContent = txt;
        /* o número "pousa": pulo curto com brilho (styles/painel.css) */
        if (el.classList.contains('pn-kpi-num')) pousar(el);
      };
      el.textContent = (0).toFixed(dec).replace('.', ',');
      requestAnimationFrame(quadro);
    };
    /* céu atrás da saudação: clarão, luzes, raios, partículas, grão (sem a linha de horizonte: no celular ela caía embaixo do título e parecia sublinhado) */
    const BOKEH = [[8, 6, 9, 0, 30], [19, 4, 11, 2.5, -20], [31, 7, 8, 5, 40], [44, 3, 12, 1.2, 10], [57, 5, 10, 3.6, -30],
                   [68, 8, 9, 6.2, 25], [79, 4, 13, .6, -15], [90, 6, 10, 4.4, 20], [96, 3, 11, 7.5, -25]];
    const ceu = cab => {
      if (cab.querySelector(':scope > .pn-ceu')) return;
      const d = document.createElement('div');
      d.className = 'pn-ceu'; d.setAttribute('aria-hidden', 'true');
      d.innerHTML = '<i class="pn-clarao"></i><i class="pn-luz-a"></i><i class="pn-luz-b"></i><i class="pn-raios"></i>' +
        '<span class="pn-bokeh">' + BOKEH.map(([x, s, dur, t, dx]) =>
          '<i style="--x:' + x + '%;--s:' + s + 'px;--d:' + dur + 's;--t:' + t + 's;--dx:' + dx + 'px"></i>').join('') + '</span>' +
        '<i class="pn-grao"></i>';
      cab.insertBefore(d, cab.firstChild);
    };
    /* título letra a letra; o leitor de tela continua lendo a frase
       inteira (aria-label), as letras ficam escondidas dele */
    const letras = h1 => {
      if (h1.classList.contains('pn-letras')) return;
      const txt = h1.textContent, virgula = txt.indexOf(', ');
      let k = 0, pos = 0;
      const html = txt.split(' ').map(pal => {
        const nome = virgula >= 0 && pos > virgula;
        pos += pal.length + 1;
        return '<span class="pn-pal">' + Array.from(pal).map(ch =>
          '<span class="pn-l' + (nome ? ' pn-l-nome' : '') + '" style="--k:' + (k++) + '">' + esc(ch) + '</span>').join('') + '</span>';
      }).join(' ');
      h1.setAttribute('aria-label', txt);
      h1.innerHTML = '<span aria-hidden="true">' + html + '</span>';
      h1.classList.add('pn-letras');
      h1.style.setProperty('--pn-n', k);
      requestAnimationFrame(() => {
        const w = h1.firstChild.getBoundingClientRect().width;
        if (w) h1.style.setProperty('--pn-w', Math.round(w) + 'px');
      });
    };
    /* lanterna: a luz do cartão segue o dedo ou o cursor */
    const luz = (e, liga) => {
      const k = e.target.closest && e.target.closest('.pn-kpi');
      if (!k) return;
      const r = k.getBoundingClientRect();
      k.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      k.style.setProperty('--my', (e.clientY - r.top) + 'px');
      if (liga) { clearTimeout(k._pnLuz); k.classList.add('pn-luz'); }
    };
    const apaga = e => {
      const k = e.target.closest && e.target.closest('.pn-kpi');
      if (!k || (e.relatedTarget && k.contains(e.relatedTarget))) return;
      clearTimeout(k._pnLuz);
      k._pnLuz = setTimeout(() => k.classList.remove('pn-luz'), e.pointerType === 'mouse' ? 0 : 500);
    };
    /* o que vive dentro de um bloco (números do gráfico, barras) só anima
       quando o bloco já apareceu — antes as barras cresciam fora da tela */
    const animarDentro = raiz => {
      raiz.querySelectorAll('.pn-graf-resumo b, .pn-graf-val').forEach(el => {
        const b = el.closest('.pn-bloco');
        if (!b || b.classList.contains('pn-visto')) contar(el);
      });
      raiz.querySelectorAll('.pn-graf:not(.pn-cresce)').forEach(g => {
        const b = g.closest('.pn-bloco');
        if (!b || b.classList.contains('pn-visto')) requestAnimationFrame(() => g.classList.add('pn-cresce'));
      });
    };
    let olho = null;
    const mostrar = b => { b.classList.add('pn-visto'); animarDentro(b); };
    const revelar = raiz => {
      if (!('IntersectionObserver' in window) || reduz()) return;
      /* ordem do filme: topo → indicadores → blocos. Os blocos que já
         estão na tela esperam os indicadores pousarem (no vídeo do
         celular eles chegavam antes dos números) */
      if (!olho) olho = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        olho.unobserve(e.target);
        const r = e.target.closest('.pn'), t = r && r.classList.contains('pn-rapido') ? .55 : 1;
        const falta = r && r._pnInicio ? r._pnInicio + 1250 * t - performance.now() : 0;
        if (falta > 0) setTimeout(() => mostrar(e.target), falta); else mostrar(e.target);
      }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
      raiz.querySelectorAll('.pn-bloco:not([data-pn-olho])').forEach((b, i) => {
        b.dataset.pnOlho = '1';
        b.style.setProperty('--pn-i', i);
        olho.observe(b);
      });
    };
    /* a abertura ainda cobre a tela? o filme espera (primeiro quadro
       parado) e só começa quando a cortina sai */
    const cortina = () => document.querySelector('.b7-abertura:not(.saindo)');
    let esperando = 0;
    let pedido = 0;
    const passar = () => {
      pedido = 0;
      const raiz = alvo.querySelector('.pn');
      if (!raiz) return;
      if (reduz()) return;
      if (!raiz.dataset.pnFilme) {
        raiz.dataset.pnFilme = '1';
        /* a estreia completa é uma por sessão; depois, o mesmo filme mais rápido */
        try {
          if (sessionStorage.getItem('b7_pn_estreia')) raiz.classList.add('pn-calmo');
          else sessionStorage.setItem('b7_pn_estreia', '1');
        } catch (e) {}
      }
      /* zzz4: depois da estreia, voltar ao Painel é chegar, não assistir de
         novo — o filme (desfoque, letras, cartões caindo, odômetro) só uma
         vez por sessão. Repetido a cada toque na barra, parecia a tela
         carregando. Fica só o céu, parado no lugar. */
      if (raiz.classList.contains('pn-calmo')) {
        raiz.querySelectorAll('.pn-cab').forEach(ceu);
        raiz.querySelectorAll('.pn-kpi-num:not([data-pn-contou])').forEach(el => { el.dataset.pnContou = '1'; });
        raiz.querySelectorAll('.pn-bloco').forEach(b => b.classList.add('pn-visto'));
        raiz.querySelectorAll('.pn-graf').forEach(g => g.classList.add('pn-cresce'));
        return;
      }
      if ('IntersectionObserver' in window) raiz.classList.add('pn-cine');
      raiz.querySelectorAll('.pn-cab').forEach(ceu);
      raiz.querySelectorAll('.pn-cab h1').forEach(letras);
      if (cortina()) {
        raiz.classList.add('pn-pausa');
        if (!esperando) esperando = setInterval(() => {
          if (cortina()) return;
          clearInterval(esperando); esperando = 0;
          const r = alvo.querySelector('.pn');
          if (r) r.classList.remove('pn-pausa');
          passar();
        }, 120);
        return;
      }
      raiz.classList.remove('pn-pausa');
      if (!raiz._pnInicio) raiz._pnInicio = performance.now();
      revelar(raiz);
      /* o odômetro começa quando o cartão já caiu no lugar */
      const t = raiz.classList.contains('pn-rapido') ? .55 : 1;
      const atraso = Math.max(0, raiz._pnInicio + 1000 * t - performance.now());
      raiz.querySelectorAll('.pn-kpi-num:not([data-pn-contou])').forEach(el => {
        contar(el, atraso);
      });
      animarDentro(raiz);
      ligarGiro();
    };
    /* giroscópio (Android não pede permissão; iPhone pede — lá não ligamos,
       para não mostrar pedido): o céu acompanha a inclinação do aparelho.
       O ponto neutro é como a pessoa segura o celular e vai se ajustando. */
    let giro = false;
    const ligarGiro = () => {
      if (giro || !('DeviceOrientationEvent' in window) || typeof DeviceOrientationEvent.requestPermission === 'function') return;
      giro = true;
      let b0 = null, g0 = null, gx = 0, gy = 0, quadro = 0;
      const lim = v => Math.max(-1, Math.min(1, v));
      window.addEventListener('deviceorientation', e => {
        if (e.beta == null || e.gamma == null || reduz() || document.hidden) return;
        if (b0 == null) { b0 = e.beta; g0 = e.gamma; }
        b0 += (e.beta - b0) * .004; g0 += (e.gamma - g0) * .004;
        gx = lim((e.gamma - g0) / 18); gy = lim((e.beta - b0) / 18);
        if (quadro) return;
        quadro = requestAnimationFrame(() => {
          quadro = 0;
          const c = alvo.querySelector('.pn-ceu');
          if (!c) return;
          c.style.setProperty('--gx', gx.toFixed(2));
          c.style.setProperty('--gy', gy.toFixed(2));
        });
      }, { passive: true });
    };
    new MutationObserver(() => {
      if (!pedido) pedido = requestAnimationFrame(passar);
    }).observe(alvo, { childList: true, subtree: true });
    alvo.addEventListener('pointermove', e => luz(e, e.pointerType === 'mouse'), { passive: true });
    alvo.addEventListener('pointerdown', e => luz(e, true), { passive: true });
    alvo.addEventListener('pointerout', apaga, { passive: true });
    alvo.addEventListener('pointerup', apaga, { passive: true });
    alvo.addEventListener('pointercancel', apaga, { passive: true });
  })();

  return { abrir, ui, contexto, adaptador };
})();
