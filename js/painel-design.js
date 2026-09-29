/* =====================================================================
   PAINEL DO DESIGNER (fase 3 do Painel)

   Responde "o que EU preciso criar, ajustar ou entregar agora?". Não é a
   Central de Design (que continua em "#/", intacta) nem a Produção de
   Design (#/design, o navegador canônico): resume, prioriza e leva para
   a tela canônica de cada coisa.

   Quem vê: B7.Perm.painelVisoes() inclui 'design' — Designer pelo papel
   principal ou pela função extra "designer". Quem também tem outra
   função alterna a VISÃO no cabeçalho (?visao=design); identidade e
   permissões nunca mudam.

   ESCOPO: sempre designer_id = a pessoa (em "Visualizar como…", a pessoa
   em prévia). Nunca a fila da agência, mesmo quando o RLS deixaria ver.

   Dados: nenhuma tabela nova. Três leituras (js/database.js), cada uma
   carrega e falha sozinha — erro nunca vira "0":
     • minhas — design_resumo (a MESMA view da Produção de Design), minhas,
                sem as finalizadas;
     • partes — arquivo efetivo por slide/frame das peças em ajuste (mesma
                regra de design_arquivos_efetivos), só para dizer QUAL
                parte voltou — nunca para contar peças;
     • envios — design_versoes que eu enviei neste mês (gráfico).

   REGRAS CANÔNICAS (cada KPI abre a Produção de Design com o MESMO
   recorte — design.js aceita ?limpar=1&rapido|designer|status|prazo):
     • Ajustes pendentes  = status ajustes | ajustes_cliente
                            (= filtro rápido "em ajustes" / aba Ajustes);
     • Vencem hoje        = prazo = hoje e não finalizada
                            (= filtro de prazo "Para hoje");
     • Em criação         = status em_criacao;
     • Aguardando revisão = status revisao_interna (revisão INTERNA da
                            B7; o que está com o cliente é outra coisa e
                            aparece só no subtítulo).
     • Produção           = versão enviada por mim (design_versoes.
                            enviada_em, designer_id = eu). Cada envio conta
                            — um reenvio depois de ajuste também é trabalho
                            entregue. Rascunho nunca conta.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.PainelDesign = (function () {
  const U = () => B7.Painel.ui;
  const D = () => B7.Painel.ui.datas;
  const esc = s => B7.UI.esc(s);
  const painel = () => document.getElementById('painel-dashboard');
  const meuId = () => U().meuId();
  const ehEquipe = () => !!(B7.Auth && B7.Auth.ehEquipe && B7.Auth.ehEquipe());

  /* ------------------------------------------------------------ regras */
  const ROTULO = { aguardando_producao: 'Aguardando produção', em_criacao: 'Em criação', revisao_interna: 'Revisão interna',
    ajustes: 'Ajustes', aprovado_interno: 'Aprovado internamente', aguardando_cliente: 'Aguardando cliente',
    ajustes_cliente: 'Ajustes do cliente', aprovado_cliente: 'Aprovado pelo cliente', finalizado: 'Finalizado' };
  const rotulo = s => ROTULO[s] || s || '—';
  /* nas mãos do designer: o que depende de ação DELE. Revisão interna,
     aprovado e aguardando cliente já saíram das mãos dele. */
  const NA_MAO = ['aguardando_producao', 'em_criacao', 'ajustes', 'ajustes_cliente'];
  const AJUSTES = ['ajustes', 'ajustes_cliente'];
  const COM_CLIENTE = ['aprovado_interno', 'aguardando_cliente'];   /* aprovado pelo cliente já voltou */
  const MAX_ATENCAO = 5, MAX_ATRASADAS = 2, MAX_PROXIMOS = 5;
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
  const pad2 = n => String(n).padStart(2, '0');

  const IC_PINCEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4.5l5 5L10 19H5v-5z"/><path d="M12.5 6.5l5 5"/></svg>';
  const IC_BRIEF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12.5h6M9 16h4"/></svg>';
  const IC_INICIAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M10.5 9l4.5 3-4.5 3z"/></svg>';

  /* ------------------------------------------------------------ estado */
  const S = { minhas: null, partes: null, envios: null };
  let geracao = 0;

  function intervaloMes() {
    const h = D().hoje();
    const [a, m] = h.split('-').map(Number);
    return { ini: h.slice(0, 8) + '01', fim: h.slice(0, 8) + pad2(new Date(a, m, 0).getDate()) };
  }

  function consulta(fonte) {
    const uid = meuId();
    if (!uid) return Promise.reject(new Error('Sessão não encontrada.'));
    if (fonte === 'minhas') return B7.DB.painelDesignMinhas(uid);
    if (fonte === 'envios') return B7.DB.painelDesignEnvios(uid, D().local(intervaloMes().ini).toISOString());
    /* partes depende de "minhas": só as peças em ajuste */
    const ids = (S.minhas && S.minhas.estado === 'ok' ? S.minhas.dados : []).filter(d => AJUSTES.includes(d.status)).map(d => d.id);
    return ids.length ? B7.DB.painelDesignPartes(ids) : Promise.resolve({});
  }

  function carregar(fonte) {
    const g = geracao;
    S[fonte] = { estado: 'carregando' };
    pintar();
    U().comTempoLimite(consulta(fonte), 15000)
      .then(dados => {
        if (g !== geracao) return;
        S[fonte] = { estado: 'ok', dados: dados || (fonte === 'partes' ? {} : []) };
        pintar();
        if (fonte === 'minhas') carregar('partes');
      })
      .catch(e => {
        if (g !== geracao) return;
        S[fonte] = { estado: 'erro', erro: (e && e.message) || '' };
        if (fonte === 'minhas') S.partes = { estado: 'erro' };
        pintar();
      });
  }

  const ok = f => S[f] && S[f].estado === 'ok';
  function estadoDe(...fontes) {
    if (fontes.some(f => S[f] && S[f].estado === 'erro')) return 'erro';
    if (fontes.some(f => !S[f] || S[f].estado === 'carregando')) return 'carregando';
    return 'ok';
  }
  const minhas = () => ok('minhas') ? S.minhas.dados : [];

  /* ------------------------------------------------------------ destinos
     Os KPIs abrem a Produção de Design com o MESMO recorte. O navegador
     do Designer usa o filtro rápido ("comigo"/"em ajustes"); a visão da
     equipe (Admin + Designer) usa o filtro de designer = eu. */
  function hrefDesign(o) {
    o = o || {};
    const q = [];
    if (ehEquipe()) {
      q.push('aba=' + (o.aba || 'todas'), 'limpar=1', 'designer=' + encodeURIComponent(meuId() || ''));
    } else {
      q.push('limpar=1', 'rapido=' + (o.rapido || 'comigo'));
    }
    if (o.status) q.push('status=' + o.status);
    if (o.prazo) q.push('prazo=' + o.prazo);
    return '#/design?' + q.join('&');
  }
  const hrefPeca = d => '#/design/' + d.id;

  /* ------------------------------------------------------------ helpers */
  function cli(d) {
    return d.cliente_nome ? U().logoMini(d) + '<span>' + esc(d.cliente_nome) + '</span>' : '';
  }
  const nomePeca = d => d.titulo || d.conteudo_titulo || 'Peça sem título';
  const comPrazoAtiva = d => !!d.prazo && d.status !== 'finalizado';
  const naMaoComPrazo = d => !!d.prazo && NA_MAO.includes(d.status);

  /* partes que voltaram: arquivo efetivo marcado "ajuste" (revisão
     interna) ou com ajuste do cliente. A peça continua UMA linha — o
     slide só qualifica ("Slide 04", "Slides 02, 04 +1"). */
  function partesEmAjuste(d) {
    if (!ok('partes')) return [];
    return ((S.partes.dados || {})[d.id] || [])
      .filter(a => a.parte_id && (a.cliente_ajuste || a.revisao === 'ajuste'))
      .sort((a, b) => (a.parte_posicao || 0) - (b.parte_posicao || 0));
  }
  function textoPartes(lista) {
    if (!lista.length) return '';
    const nome = lista[0].parte_tipo === 'frame' ? ['Story', 'Stories'] : ['Slide', 'Slides'];
    const nums = lista.map(a => pad2((a.parte_posicao || 0) + 1));
    if (nums.length === 1) return nome[0] + ' ' + nums[0];
    return nome[1] + ' ' + nums.slice(0, 2).join(', ') + (nums.length > 2 ? ' +' + (nums.length - 2) : '');
  }

  /* =================================================================
     "PRECISA DA SUA ATENÇÃO" — prioridade fixa, uma linha por peça:
       1. atrasadas (nas minhas mãos)  — até 2 na frente
       2. ajuste do cliente
       3. ajuste interno (revisão devolvida)
       4. vence hoje (nas minhas mãos)
       5. briefing atualizado (bloqueio: conferir antes de seguir)
       6. vence amanhã / depois de amanhã
       7. para começar (aguardando produção, já atribuída a mim)
     ================================================================= */
  function itensAtencao() {
    const IC = U().IC, d = D(), h = d.hoje();
    const lista = [], vistos = new Set();
    const add = (peca, it) => { if (vistos.has(peca.id)) return; vistos.add(peca.id); it.chave = peca.id; it.href = hrefPeca(peca); lista.push(it); };
    const ds = minhas();
    const porPrazo = (a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999') || String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    const metaStatus = (p, extra) => cli(p) + (extra ? '<span>' + esc(extra) + '</span>' : '') +
      (p.prazo ? '<span>prazo ' + d.ddmm(p.prazo) + '</span>' : '');

    const atrasadas = ds.filter(p => naMaoComPrazo(p) && p.prazo < h).sort(porPrazo);
    const itemAtraso = p => { const n = d.difDias(h, p.prazo);
      return { tom: 'erro', icone: IC.alerta, tag: 'Atrasada há ' + plural(n, 'dia', 'dias'), titulo: nomePeca(p),
               meta: cli(p) + '<span>' + esc(rotulo(p.status)) + '</span>' + (textoPartes(partesEmAjuste(p)) ? '<span>' + esc(textoPartes(partesEmAjuste(p))) + '</span>' : '') }; };
    atrasadas.slice(0, MAX_ATRASADAS).forEach(p => add(p, itemAtraso(p)));

    ds.filter(p => p.status === 'ajustes_cliente').sort(porPrazo).forEach(p => add(p, {
      tom: 'erro', icone: IC.refazer, tag: 'Ajuste do cliente', titulo: nomePeca(p), meta: metaStatus(p, textoPartes(partesEmAjuste(p))) }));
    ds.filter(p => p.status === 'ajustes').sort(porPrazo).forEach(p => add(p, {
      tom: 'ambar', icone: IC.refazer, tag: 'Revisão pediu ajuste', titulo: nomePeca(p), meta: metaStatus(p, textoPartes(partesEmAjuste(p))) }));
    ds.filter(p => naMaoComPrazo(p) && p.prazo === h).forEach(p => add(p, {
      tom: 'ambar', icone: IC.relogio, tag: 'Vence hoje', titulo: nomePeca(p), meta: cli(p) + '<span>' + esc(rotulo(p.status)) + '</span>' }));
    ds.filter(p => p.briefing_desatualizado).sort(porPrazo).forEach(p => add(p, {
      tom: 'neutro', icone: IC_BRIEF, tag: 'Briefing atualizado', titulo: nomePeca(p),
      meta: cli(p) + '<span>confira antes de seguir</span>' }));
    [1, 2].forEach(n => ds.filter(p => naMaoComPrazo(p) && p.prazo === d.somarDias(h, n)).forEach(p => add(p, {
      tom: 'neutro', icone: IC.agenda, tag: n === 1 ? 'Vence amanhã' : 'Vence ' + d.quandoDia(p.prazo).split(',')[0],
      titulo: nomePeca(p), meta: cli(p) + '<span>' + esc(rotulo(p.status)) + '</span>' })));
    ds.filter(p => p.status === 'aguardando_producao').sort(porPrazo).forEach(p => add(p, {
      tom: 'neutro', icone: IC_INICIAR, tag: 'Para começar', titulo: nomePeca(p), meta: metaStatus(p) }));

    /* atrasadas além das 2 primeiras entram logo depois delas, se sobrar vaga */
    const sobra = atrasadas.slice(MAX_ATRASADAS).filter(p => !vistos.has(p.id));
    const vagas = Math.max(0, MAX_ATENCAO - lista.length);
    const entram = sobra.slice(0, vagas).map(p => Object.assign(itemAtraso(p), { chave: p.id, href: hrefPeca(p) }));
    lista.splice(Math.min(MAX_ATRASADAS, atrasadas.length), 0, ...entram);
    return lista;
  }

  /* ================================================================ KPIs */
  function pintarKpis() {
    const cx = document.getElementById('pnd-kpis'); if (!cx) return;
    const kpi = U().kpi, h = D().hoje(), e = estadoDe('minhas');
    const ds = minhas();
    const aj = ds.filter(p => AJUSTES.includes(p.status));
    const ajCli = aj.filter(p => p.status === 'ajustes_cliente').length, ajInt = aj.length - ajCli;
    const hoje = ds.filter(p => comPrazoAtiva(p) && p.prazo === h);
    const hojeMao = hoje.filter(p => NA_MAO.includes(p.status)).length;
    const criacao = ds.filter(p => p.status === 'em_criacao').length;
    const paraComecar = ds.filter(p => p.status === 'aguardando_producao').length;
    const revisao = ds.filter(p => p.status === 'revisao_interna').length;
    const comCliente = ds.filter(p => COM_CLIENTE.includes(p.status)).length;

    cx.innerHTML =
      kpi({ estado: e, rotulo: 'Ajustes pendentes', valor: aj.length, tom: aj.length ? (ajCli ? 'erro' : 'ambar') : '',
            sub: aj.length ? [ajCli && plural(ajCli, 'do cliente', 'do cliente'), ajInt && plural(ajInt, 'da revisão', 'da revisão')].filter(Boolean).join(' · ')
              : 'nenhum ajuste pedido',
            href: aj.length ? hrefDesign({ rapido: 'ajustes', aba: 'ajustes' }) : null,
            aria: plural(aj.length, 'peça com ajuste pendente', 'peças com ajuste pendente') + ' — abrir na Produção de Design' }) +
      kpi({ estado: e, rotulo: 'Vencem hoje', valor: hoje.length, tom: hojeMao ? 'ambar' : '',
            sub: hoje.length ? [hojeMao && hojeMao + ' com você', (hoje.length - hojeMao) && (hoje.length - hojeMao) + ' já enviada' + (hoje.length - hojeMao === 1 ? '' : 's')].filter(Boolean).join(' · ')
              : 'nada vence hoje',
            href: hoje.length ? hrefDesign({ prazo: 'hoje' }) : null,
            aria: plural(hoje.length, 'peça vence', 'peças vencem') + ' hoje — abrir na Produção de Design' }) +
      kpi({ estado: e, rotulo: 'Em criação', valor: criacao,
            sub: paraComecar ? '+ ' + plural(paraComecar, 'para começar', 'para começar') : (criacao ? 'peças que você está criando' : 'nada em criação agora'),
            href: criacao ? hrefDesign({ status: 'em_criacao' }) : null,
            aria: plural(criacao, 'peça em criação', 'peças em criação') + ' — abrir na Produção de Design' }) +
      kpi({ estado: e, rotulo: 'Aguardando revisão', valor: revisao,
            sub: (revisao ? 'revisão interna da B7' : 'nada esperando revisão') + (comCliente ? ' · ' + comCliente + ' com o cliente' : ''),
            href: revisao ? hrefDesign({ status: 'revisao_interna' }) : null,
            aria: plural(revisao, 'peça aguardando', 'peças aguardando') + ' revisão interna — abrir na Produção de Design' });
  }

  /* ============================================================ atenção */
  function pintarAtencao() {
    const cx = document.getElementById('pnd-atencao'); if (!cx) return;
    const e = estadoDe('minhas');
    let corpo;
    if (e === 'carregando') corpo = U().blocoCarregando(3);
    else if (e === 'erro') corpo = U().blocoErro('Não foi possível carregar suas peças.', ['minhas']);
    else {
      const itens = itensAtencao();
      const fora = itens.length - Math.min(itens.length, MAX_ATENCAO);
      corpo = itens.length
        ? '<div class="pn-att-lista">' + itens.slice(0, MAX_ATENCAO).map(U().linhaAtencao).join('') + '</div>' +
          (fora ? '<a class="pn-mais" href="' + esc(hrefDesign()) + '">+' + plural(fora, 'peça', 'peças') + ' na sua fila' + U().IC.seta + '</a>' : '')
        : U().blocoVazio('Nada pedindo sua ação agora.', 'Nenhum ajuste, nenhum prazo vencendo e nenhuma peça para começar.');
      if (S.partes && S.partes.estado === 'erro') corpo += '<p class="pn-nota">Não foi possível ver quais slides voltaram — abra a peça para conferir.</p>';
    }
    cx.innerHTML = U().cabecalhoSecao('pnd-t-atencao', 'Precisa da sua atenção', { href: hrefDesign(), rotulo: 'Minhas peças' }) + corpo;
  }

  /* ============================================================= semana
     Só prazos REAIS de peças minhas. Peça sem prazo não é "encaixada"
     em dia nenhum — ela aparece numa nota abaixo. */
  function pintarSemana() {
    const cx = document.getElementById('pnd-semana'); if (!cx) return;
    const d = D(), h = d.hoje(), seg = d.segundaDe(h), IC = U().IC;
    const e = estadoDe('minhas');
    let corpo;
    if (e === 'carregando') corpo = '<div class="esqueleto-tela pn-sk-semana">' + '<i class="esq"></i>'.repeat(5) + '</div>';
    else if (e === 'erro') corpo = U().blocoErro('Não foi possível montar sua semana.', ['minhas']);
    else {
      const ds = minhas();
      const dias = Array.from({ length: 7 }, (_, i) => {
        const iso = d.somarDias(seg, i), passado = iso < h;
        const doDia = ds.filter(p => comPrazoAtiva(p) && p.prazo === iso);
        const atr = passado ? doDia.filter(p => NA_MAO.includes(p.status)).length : 0;
        const aj = passado ? 0 : doDia.filter(p => AJUSTES.includes(p.status)).length;
        return { iso, hoje: iso === h, passado, alerta: atr > 0,
          href: iso === h && doDia.length ? hrefDesign({ prazo: 'hoje' }) : null, itens: [
          { cls: 'pn-dia-atraso', ic: IC.alerta, n: atr, um: 'atrasada', varios: 'atrasadas' },
          { cls: 'pn-dia-ajuste', ic: IC.refazer, n: aj, um: 'ajuste', varios: 'ajustes' },
          { cls: 'pn-dia-prazo', ic: IC.relogio, n: passado ? 0 : doDia.length - aj, um: 'entrega', varios: 'entregas' }
        ] };
      }).filter((x, i) => i < 5 || x.itens.some(y => y.n));
      const vazia = dias.every(x => !x.itens.some(y => y.n));
      const semPrazo = ds.filter(p => !p.prazo && NA_MAO.concat(['revisao_interna']).includes(p.status)).length;
      corpo = '<ol class="pn-semana-lista">' + dias.map(U().diaSemana).join('') + '</ol>' +
        (semPrazo ? '<p class="pn-nota">' + esc(plural(semPrazo, 'peça sua está', 'peças suas estão')) + ' sem prazo definido e não aparece' + (semPrazo === 1 ? '' : 'm') + ' aqui.</p>'
          : (vazia ? '<p class="pn-nota">Nenhum prazo seu nesta semana.</p>' : ''));
    }
    cx.innerHTML = '<div class="pn-sec-cab"><h2 id="pnd-t-semana">Minha semana</h2>' +
      '<span class="pn-sec-sub">' + d.ddmm(seg) + ' – ' + d.ddmm(d.somarDias(seg, 6)) + '</span></div>' + corpo;
  }

  /* =========================================================== produção
     Um gráfico só: versões enviadas por semana, dentro do mês atual.
     Semanas começam na segunda e são cortadas nos limites do mês. */
  function semanasDoMes() {
    const d = D(), h = d.hoje(), m = intervaloMes();
    const semanas = [];
    for (let seg = d.segundaDe(m.ini); seg <= m.fim; seg = d.somarDias(seg, 7)) {
      const ini = seg < m.ini ? m.ini : seg;
      const fimSem = d.somarDias(seg, 6);
      const fim = fimSem > m.fim ? m.fim : fimSem;
      semanas.push({ ini, fim, n: 0, atual: ini <= h && h <= fim, futura: ini > h });
    }
    return semanas;
  }
  function pintarProducao() {
    const cx = document.getElementById('pnd-producao'); if (!cx) return;
    const d = D(), e = estadoDe('envios'), mes = D().MES[D().local(D().hoje()).getMonth()];
    let corpo;
    if (e === 'carregando') corpo = '<div class="esqueleto-tela pn-sk-graf">' + '<i class="esq"></i>'.repeat(5) + '</div>';
    else if (e === 'erro') corpo = U().blocoErro('Não foi possível carregar sua produção.', ['envios']);
    else {
      const semanas = semanasDoMes();
      const envios = (S.envios.dados || []).filter(v => v.enviada_em);
      envios.forEach(v => { const dia = d.diaDoTs(v.enviada_em); const s = semanas.find(w => w.ini <= dia && dia <= w.fim); if (s) s.n++; });
      const total = semanas.reduce((a, w) => a + w.n, 0);
      const pecas = new Set(envios.filter(v => semanas.some(w => { const dia = d.diaDoTs(v.enviada_em); return w.ini <= dia && dia <= w.fim; })).map(v => v.deliverable_id)).size;
      const atual = (semanas.find(w => w.atual) || { n: 0 }).n;
      const max = Math.max(1, ...semanas.map(w => w.n));
      const faixa = w => w.ini === w.fim ? d.ddmm(w.ini) : w.ini.slice(8, 10) + '–' + w.fim.slice(8, 10);
      corpo = !total
        ? U().blocoVazio('Nenhuma versão enviada em ' + mes + ' ainda.', 'Cada versão que você envia para revisão conta aqui.')
        : '<div class="pn-prod-corpo"><div class="pn-graf-resumo">' +
            '<div><b>' + total + '</b><span>' + (total === 1 ? 'versão enviada' : 'versões enviadas') + ' em ' + esc(mes) + '</span></div>' +
            '<div><b>' + pecas + '</b><span>' + (pecas === 1 ? 'peça diferente' : 'peças diferentes') + '</span></div>' +
            '<div><b>' + atual + '</b><span>nesta semana</span></div>' +
          '</div>' +
          '<div class="pn-graf pnd-graf" role="group" aria-label="Versões enviadas por semana em ' + esc(mes) + '">' +
          semanas.map(w =>
            '<div class="pn-graf-col' + (w.atual ? ' atual' : '') + (w.futura ? ' futura' : '') + '" tabindex="0" ' +
              'aria-label="' + esc('Semana ' + faixa(w) + ': ' + plural(w.n, 'versão enviada', 'versões enviadas') + (w.futura ? ' (ainda não chegou)' : '')) + '">' +
              '<span class="pn-graf-trilho">' + (w.atual || w.n ? '<span class="pn-graf-val">' + (w.futura ? '' : w.n) + '</span>' : '') +
                '<i style="height:' + (w.n ? Math.max(5, Math.round(w.n / max * 82)) : 0) + '%"></i></span>' +
              '<span class="pn-graf-rot">' + (w.atual ? 'Esta' : faixa(w)) + '</span>' +
              '<span class="pn-graf-tip" role="tooltip">' + plural(w.n, 'versão', 'versões') + '<small>' + d.ddmm(w.ini) + ' – ' + d.ddmm(w.fim) + '</small></span>' +
            '</div>').join('') +
          '</div></div>';
    }
    cx.innerHTML = U().cabecalhoSecao('pnd-t-producao', 'Minha produção', { href: hrefDesign(), rotulo: 'Minhas peças' }) + corpo;
  }

  /* ===================================================== próximos prazos */
  function pintarProximos() {
    const cx = document.getElementById('pnd-proximos'); if (!cx) return;
    const d = D(), h = d.hoje(), IC = U().IC, e = estadoDe('minhas');
    let corpo;
    if (e === 'carregando') corpo = U().blocoCarregando(3);
    else if (e === 'erro') corpo = U().blocoErro('Não foi possível carregar seus prazos.', ['minhas']);
    else {
      /* o que já está em "Precisa da sua atenção" não se repete */
      const listados = new Set(itensAtencao().slice(0, MAX_ATENCAO).map(it => it.chave));
      const itens = minhas().filter(p => comPrazoAtiva(p) && p.prazo >= h && !listados.has(p.id))
        .sort((a, b) => a.prazo.localeCompare(b.prazo)).slice(0, MAX_PROXIMOS);
      const semPrazo = minhas().filter(p => !p.prazo && NA_MAO.includes(p.status)).length;
      corpo = itens.length
        ? '<div class="cp-agenda-lista">' + itens.map(p =>
            '<a class="cp-ag-item pn-comp" href="' + esc(hrefPeca(p)) + '">' +
              '<span class="cp-ag-data"><span class="dow">' + d.DOW[d.local(p.prazo).getDay()] + '</span><span class="dt">' + d.ddmm(p.prazo) + '</span></span>' +
              '<span class="cp-ag-tx"><b>' + esc(nomePeca(p)) + '</b><span class="cp-ag-meta"><span>' + esc(d.quandoDia(p.prazo)) + '</span>' +
                (p.cliente_nome ? '<span>' + esc(p.cliente_nome) + '</span>' : '') + '</span></span>' +
              '<span class="pn-comp-tipo pn-comp-prazo">' + (NA_MAO.includes(p.status) ? IC_PINCEL : IC.relogio) +
                '<span>' + esc(rotulo(p.status)) + '</span></span></a>').join('') + '</div>'
        : U().blocoVazio(semPrazo ? 'Nenhum prazo definido pela frente.' : 'Nenhum prazo pela frente.', semPrazo
            ? plural(semPrazo, 'peça sua em produção está', 'peças suas em produção estão') + ' sem prazo definido.'
            : 'Prazos das suas peças aparecem aqui.');
    }
    cx.innerHTML = U().cabecalhoSecao('pnd-t-prox', 'Próximos prazos', { href: '#/design', rotulo: 'Ver produção' }) + corpo;
  }

  function pintar() {
    if (!document.getElementById('pnd-raiz')) return;
    pintarKpis(); pintarAtencao(); pintarSemana(); pintarProducao(); pintarProximos();
    painel().querySelectorAll('#pnd-raiz img.pn-logo').forEach(img => {
      img.onerror = () => { const s = document.createElement('span'); s.className = 'pn-logo pn-logo-vazia'; s.textContent = img.dataset.ini || ''; img.replaceWith(s); };
    });
    painel().querySelectorAll('#pnd-raiz [data-pn-retentar]').forEach(b => {
      b.onclick = () => b.dataset.pnRetentar.split(',').filter(Boolean).forEach(carregar);
    });
  }

  /* ------------------------------------------------------------ abrir
     Designer não cria demanda de Design (só a equipe cria) — então a
     ação do cabeçalho é ir para a produção, não um "Criar" de mentira. */
  function abrir(o) {
    geracao++;
    Object.keys(S).forEach(k => { S[k] = null; });
    B7.Dashboard.marcarNav('#/painel');
    B7.Rota.titulo(['Painel']);
    painel().innerHTML = '<div class="conteudo entra pn pnd" id="pnd-raiz">' +
      U().cabecalho({ visoes: (o && o.visoes) || ['design'], visao: 'design',
        acao: '<a class="b contorno pn-cab-acao" href="' + esc(hrefDesign()) + '">' + IC_PINCEL + '<span>Produção de Design</span></a>' }) +
      '<section class="pn-kpis" id="pnd-kpis" aria-label="Indicadores"></section>' +
      '<div class="pn-grade pnd-grade">' +
        '<section class="pn-bloco pn-atencao" id="pnd-atencao" aria-labelledby="pnd-t-atencao"></section>' +
        '<section class="pn-bloco" id="pnd-semana" aria-labelledby="pnd-t-semana"></section>' +
        '<section class="pn-bloco" id="pnd-proximos" aria-labelledby="pnd-t-prox"></section>' +
        '<section class="pn-bloco" id="pnd-producao" aria-labelledby="pnd-t-producao"></section>' +
      '</div>' +
    '</div>';
    carregar('minhas');
    carregar('envios');
  }

  return { abrir, _regras: { NA_MAO, AJUSTES, COM_CLIENTE, textoPartes, semanasDoMes } };
})();
