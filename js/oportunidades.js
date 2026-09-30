/* =====================================================================
   B7.Oportunidades — DATAS COMEMORATIVAS E CAMPANHAS (fase 7)

   Uma oportunidade é uma data canônica (ex.: "Dia do Cirurgião-Dentista",
   25/10) com fontes que a comprovam. Ela NÃO é tarefa, conteúdo nem
   evento operacional: é contexto editorial.

   De onde vem o dado
     • O backend (Edge Function oportunidades-sync + pg_cron semanal)
       busca as fontes oficiais e grava tudo normalizado no banco.
     • Aqui só LEMOS as definições (algumas centenas) uma vez, em cache,
       e resolvemos as ocorrências de cada ano no navegador:
         fixa   → mês/dia (29/02 só em ano bissexto)
         regra  → 'nth:M:DS:N' (N-ésimo dia-da-semana; -1 último, -2
                  penúltimo), 'ultimo_dia:M', 'mes_inteiro:M'
         datas  → datas explícitas por ano (feriados móveis etc.)
       Data pura nunca passa por new Date('AAAA-MM-DD').

   Relevância por cliente (determinística e explicável — sem IA)
     ajuste manual 'ignorar' / 'nao_relevante'  → fora (para ESSE cliente)
     ajuste manual 'relevante'                  → Muito relevante
     categoria = segmento do cliente            → Muito relevante
     tag = nome/segmento do cliente             → Muito relevante
     categoria = tema-pai do segmento, quando
       o segmento cobre o tema todo (Medicina,
       Farmácia) ou a data é "ampla" do tema     → Relacionada
     categoria = subtema de um segmento amplo    → Relacionada
     geral / feriado nacional                   → Geral
     datas estaduais/municipais não casam sozinhas (só por ajuste).

   Escrita: só por RPC (o banco decide quem pode). "Usar na Linha
   Editorial" só cria o VÍNCULO — nenhum conteúdo, post, roteiro,
   design, vídeo ou gravação é criado.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Oportunidades = (function () {
  const esc = s => B7.UI.esc(s);
  const D = () => B7.Eventos.DATAS;
  const papel = () => (B7.Auth && B7.Auth.papel && B7.Auth.papel()) || null;
  const souGestor = () => ['admin', 'coordenador'].includes(papel());
  const souAdmin = () => papel() === 'admin';
  const souEquipeInterna = () => ['admin', 'coordenador', 'designer', 'videomaker'].includes(papel());

  /* ------------------------------------------------------------ vocabulário */
  const CONF = {
    oficial:    { rot: 'Oficial', tom: 'verde', desc: 'Confirmada em fonte oficial: lei, órgão público, organismo internacional ou conselho profissional.' },
    verificada: { rot: 'Verificada', tom: 'azul', desc: 'Conferida pela equipe ou vinda de fonte pública confiável, sem ato oficial próprio.' },
    popular:    { rot: 'Popular / comercial', tom: 'ambar', desc: 'Data de mercado ou costume, sem instituição oficial.' },
    pendente:   { rot: 'Pendente de verificação', tom: 'neutro', desc: 'Veio de fonte secundária e ainda não foi confirmada em fonte oficial.' }
  };
  const NATUREZA = { comemorativa: 'Data comemorativa', feriado: 'Feriado', campanha: 'Campanha' };
  const ABRANGENCIA = { internacional: 'Internacional', nacional: 'Nacional', estadual: 'Estadual', municipal: 'Municipal' };
  const FONTES_ROT = {
    ms_calendario: 'Ministério da Saúde', oms: 'Organização Mundial da Saúde', onu: 'Nações Unidas', brasilapi: 'BrasilAPI (feriados)',
    camara: 'Câmara dos Deputados', planalto: 'Planalto — legislação federal', conselho: 'Conselho profissional',
    calendarr: 'Calendarr (agregador)', manual: 'Cadastro manual verificado'
  };
  const NIVEL = {
    muito: { rot: 'Muito relevante', ordem: 1, tom: 'verde' },
    relacionada: { rot: 'Relacionada', ordem: 2, tom: 'azul' },
    geral: { rot: 'Geral', ordem: 3, tom: 'neutro' }
  };
  /* segmentos que cobrem o tema-pai inteiro (toda data de Saúde interessa) */
  const AMPLOS = { medicina: true, farmacia: true };
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const SVG = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const IC = SVG('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>');
  const IC_FECHA = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const IC_LINK = SVG('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>');

  /* ------------------------------------------------------------ base (cache) */
  let B = null, baseEm = 0, emCurso = null;
  const TTL = 10 * 60e3;
  function montar(bruto, clientes) {
    const ops = new Map(), todas = new Map();
    (bruto.ops || []).forEach(o => { todas.set(o.id, o); if (o.ativo && o.revisao !== 'ignorada') ops.set(o.id, o); });
    const agrupar = (lista, k) => { const m = new Map(); (lista || []).forEach(x => { if (!m.has(x[k])) m.set(x[k], []); m.get(x[k]).push(x); }); return m; };
    const temas = new Map((bruto.temas || []).map(t => [t.id, t]));
    const ajustes = new Map((bruto.ajustes || []).map(a => [a.oportunidade_id + '|' + a.client_id, a.decisao]));
    const cls = (clientes || []).filter(c => !c.deleted_at).map(c => ({ id: c.id, nome: c.nome, logo: c.logo_url }))
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    return {
      ops, todas, datas: agrupar(bruto.datas, 'oportunidade_id'), provas: agrupar(bruto.provas, 'oportunidade_id'),
      temas, segmentos: agrupar(bruto.segmentos, 'client_id'), ajustes, clientes: cls, clientesMap: new Map(cls.map(c => [c.id, c]))
    };
  }
  async function carregarBase(forcar) {
    if (!forcar && B && Date.now() - baseEm < TTL) return B;
    if (emCurso) return emCurso;
    emCurso = Promise.all([B7.DB.oportunidadesBase(), B7.DB.listarClientes().catch(() => [])])
      .then(([bruto, clientes]) => { B = montar(bruto, clientes); baseEm = Date.now(); return B; })
      .finally(() => { emCurso = null; });
    return emCurso;
  }
  function invalidar() { B = null; baseEm = 0; if (B7.Eventos && B7.Eventos.invalidar) B7.Eventos.invalidar(); }

  /* ------------------------------------------------------------ datas */
  const pad = n => String(n).padStart(2, '0');
  const iso = (a, m, d) => a + '-' + pad(m) + '-' + pad(d);
  const diasNoMes = (a, m) => new Date(a, m, 0).getDate();
  const bissexto = a => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
  /* N-ésimo dia-da-semana do mês; n = -1 último, -2 penúltimo */
  function nth(a, m, dow, n) {
    const ult = diasNoMes(a, m);
    if (n > 0) {
      const off = (dow - new Date(a, m - 1, 1).getDay() + 7) % 7;
      const dia = 1 + off + (n - 1) * 7;
      return dia <= ult ? iso(a, m, dia) : null;
    }
    const off = (new Date(a, m - 1, ult).getDay() - dow + 7) % 7;
    const dia = ult - off + (n + 1) * 7;
    return dia >= 1 ? iso(a, m, dia) : null;
  }
  /* início (e duração) num ano, para fixa/regra */
  function inicioNoAno(op, a) {
    if (op.tipo_data === 'fixa') {
      if (!op.mes || !op.dia) return null;
      if (op.mes === 2 && op.dia === 29 && !bissexto(a)) return null;
      if (op.dia > diasNoMes(a, op.mes)) return null;
      return { ini: iso(a, op.mes, op.dia), dur: op.duracao_dias || 1 };
    }
    if (op.tipo_data === 'regra' && op.regra) {
      const p = String(op.regra).split(':');
      if (p[0] === 'nth') { const s = nth(a, +p[1], +p[2], +p[3]); return s ? { ini: s, dur: op.duracao_dias || 1 } : null; }
      if (p[0] === 'ultimo_dia') return { ini: iso(a, +p[1], diasNoMes(a, +p[1])), dur: 1 };
      if (p[0] === 'mes_inteiro') return { ini: iso(a, +p[1], 1), dur: diasNoMes(a, +p[1]) };
    }
    return null;
  }
  /* ocorrências que tocam [ini, fim] → [{ini, fim}] */
  function ocorrencias(op, ini, fim, base) {
    const out = [];
    if (op.tipo_data === 'datas') {
      ((base || B).datas.get(op.id) || []).forEach(d => {
        const s = String(d.data).slice(0, 10), e = d.data_fim ? String(d.data_fim).slice(0, 10) : D().somarDias(s, (op.duracao_dias || 1) - 1);
        if (s <= fim && e >= ini) out.push({ ini: s, fim: e });
      });
      return out.sort((x, y) => x.ini.localeCompare(y.ini));
    }
    const a0 = +ini.slice(0, 4) - 1, a1 = +fim.slice(0, 4);
    for (let a = a0; a <= a1; a++) {
      const o = inicioNoAno(op, a); if (!o) continue;
      const e = D().somarDias(o.ini, o.dur - 1);
      if (o.ini <= fim && e >= ini) out.push({ ini: o.ini, fim: e });
    }
    return out;
  }
  /* próxima ocorrência a partir de um dia (até 2 anos à frente) */
  function proxima(op, desde) {
    const l = ocorrencias(op, desde, D().somarDias(desde, 730));
    return l.find(o => o.fim >= desde) || null;
  }

  /* ------------------------------------------------------------ relevância */
  const nomeTema = id => (B && B.temas.get(id) && B.temas.get(id).nome) || id;
  function relevancia(op, cid, base) {
    const b = base || B;
    const aj = b.ajustes.get(op.id + '|' + cid);
    if (aj === 'ignorar') return { nivel: null, ajuste: aj, motivos: ['Ignorada para este cliente'] };
    if (aj === 'nao_relevante') return { nivel: null, ajuste: aj, motivos: ['Marcada como não relevante para este cliente'] };
    if (aj === 'relevante') return { nivel: 'muito', ajuste: aj, motivos: ['Marcada como relevante pela equipe'] };
    const segs = b.segmentos.get(cid) || [];
    const cats = op.categorias || [], tags = op.tags || [];
    const motivos = []; let nivel = null;
    const local = op.abrangencia === 'estadual' || op.abrangencia === 'municipal';
    if (!local && segs.length) {
      segs.forEach(s => {
        if (cats.includes(s.tema_id)) { nivel = 'muito'; motivos.push('Relacionada ao segmento ' + nomeTema(s.tema_id) + (s.origem === 'sugerido' ? ' (sugerido)' : '')); }
      });
      if (!nivel) {
        segs.forEach(s => {
          /* palavras do PRÓPRIO segmento — sem as do tema-pai ("Ótica e
             saúde visual" não pode casar toda data de saúde por "saude") */
          const tema = b.temas.get(s.tema_id) || {};
          const doPai = new Set(tema.pai ? [tema.pai].concat(norm(nomeTema(tema.pai)).split(' ')) : []);
          const palavras = new Set([s.tema_id].concat(norm(nomeTema(s.tema_id)).split(' ')).filter(w => w.length > 3 && !doPai.has(w)));
          const t = tags.find(x => palavras.has(x));
          if (t && !nivel) { nivel = 'muito'; motivos.push('Correspondência: tag "' + t + '" (' + nomeTema(s.tema_id) + ')'); }
        });
      }
      if (!nivel) {
        segs.forEach(s => {
          const tema = b.temas.get(s.tema_id); const pai = tema && tema.pai;
          if (pai && cats.includes(pai)) {
            if (AMPLOS[s.tema_id]) { nivel = 'relacionada'; motivos.push('Tema ' + nomeTema(pai) + ' — segmento ' + nomeTema(s.tema_id)); }
            else if (ehDataAmpla(op, pai)) { nivel = 'relacionada'; motivos.push('Data ampla de ' + nomeTema(pai)); }
          }
          /* segmento amplo (ex.: Saúde) e data de um subtema dele */
          const sub = cats.find(c => { const t = b.temas.get(c); return t && t.pai === s.tema_id; });
          if (sub && !nivel) { nivel = 'relacionada'; motivos.push(nomeTema(sub) + ' faz parte de ' + nomeTema(s.tema_id)); }
        });
      }
    }
    if (!nivel && !local && (op.geral || op.natureza === 'feriado')) { nivel = 'geral'; motivos.push(op.natureza === 'feriado' ? 'Feriado nacional' : 'Data de interesse geral'); }
    return { nivel, motivos: [...new Set(motivos)] };
  }
  /* "data ampla" do tema: o nome é só o tema (ex.: "Dia Mundial da Saúde",
     "Dia Nacional da Saúde"). "Saúde Mental" ou "Saúde nas Escolas" não. */
  const VAZIAS = new Set(['dia', 'mundial', 'nacional', 'internacional', 'da', 'de', 'do', 'das', 'dos', 'e', 'semana', 'mes']);
  function ehDataAmpla(op, pai) {
    const w = norm(op.nome).split(' ').filter(x => x && !VAZIAS.has(x));
    return w.length === 1 && w[0] === norm(nomeTema(pai));
  }
  /* todos os clientes com alguma relação (ignorados vêm marcados) */
  function relacionados(op, base) {
    const b = base || B, out = [];
    b.clientes.forEach(c => {
      const r = relevancia(op, c.id, b);
      if (r.nivel === 'muito' || r.nivel === 'relacionada' || r.ajuste) out.push(Object.assign({ cliente: c }, r));
    });
    return out.sort((x, y) => ((NIVEL[x.nivel] || { ordem: 9 }).ordem - (NIVEL[y.nivel] || { ordem: 9 }).ordem) ||
      String(x.cliente.nome).localeCompare(String(y.cliente.nome), 'pt-BR'));
  }

  /* itens do período, cada um com a relevância já resolvida.
     opcoes.cliente → relevância daquele cliente (ignoradas somem). */
  async function periodo(ini, fim, opcoes) {
    const b = await carregarBase();
    const cliente = opcoes && opcoes.cliente;
    const out = [];
    b.ops.forEach(op => {
      ocorrencias(op, ini, fim, b).forEach(oc => {
        const rels = relacionados(op, b);
        const porCliente = {};
        rels.forEach(r => { if (r.nivel) porCliente[r.cliente.id] = r.nivel; });
        const geralOk = !!(op.geral || op.natureza === 'feriado') && op.abrangencia !== 'estadual' && op.abrangencia !== 'municipal';
        const ativos = rels.filter(r => r.nivel === 'muito' || r.nivel === 'relacionada');
        const nivelMax = ativos.some(r => r.nivel === 'muito') ? 'muito' : ativos.length ? 'relacionada' : geralOk ? 'geral' : null;
        const item = { op, ini: oc.ini, fim: oc.fim, relacionados: rels, porCliente, nivelMax, geral: geralOk };
        if (cliente) {
          const r = relevancia(op, cliente, b);
          item.rel = r;
          if (!r.nivel) return;
        }
        out.push(item);
      });
    });
    return out.sort((x, y) => x.ini.localeCompare(y.ini) || ((NIVEL[x.nivelMax] || { ordem: 9 }).ordem - (NIVEL[y.nivelMax] || { ordem: 9 }).ordem) ||
      String(x.op.nome).localeCompare(String(y.op.nome), 'pt-BR'));
  }

  /* ------------------------------------------------------------ textos */
  function quandoTx(ini, fim) {
    const d = D().local(ini);
    let t = DIAS[d.getDay()] + ', ' + d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear();
    if (fim && fim !== ini) { const f = D().local(fim); t = d.getDate() + ' ' + MESES[d.getMonth()] + (d.getFullYear() !== f.getFullYear() ? ' ' + d.getFullYear() : '') + ' – ' + f.getDate() + ' ' + MESES[f.getMonth()] + ' ' + f.getFullYear(); }
    return t;
  }
  function faltaTx(ini, fim) {
    const hoje = D().hoje(), n = D().difDias(hoje, ini);
    if (n > 1) return 'Faltam ' + n + ' dias';
    if (n === 1) return 'Amanhã';
    if (n === 0) return 'Hoje';
    if (fim && fim >= hoje) return 'Em andamento até ' + D().local(fim).getDate() + ' ' + MESES[D().local(fim).getMonth()];
    return 'Já passou';
  }
  const selo = (rot, tom, title) => '<span class="op-selo t-' + tom + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(rot) + '</span>';
  const seloConf = op => { const c = CONF[op.confiabilidade] || CONF.pendente; return selo(c.rot, c.tom, c.desc); };
  const seloNivel = n => n && NIVEL[n] ? selo(NIVEL[n].rot, NIVEL[n].tom) : '';
  const regraTx = op => {
    if (op.tipo_data !== 'regra' || !op.regra) return '';
    const p = op.regra.split(':');
    if (p[0] === 'nth') return (+p[3] === -1 ? 'Último(a) ' : +p[3] === -2 ? 'Penúltimo(a) ' : p[3] + 'º ') + DIAS_LONGOS[+p[2]] + ' de ' + MESES_LONGOS[+p[1] - 1];
    if (p[0] === 'ultimo_dia') return 'Último dia de ' + MESES_LONGOS[+p[1] - 1];
    if (p[0] === 'mes_inteiro') return 'O mês de ' + MESES_LONGOS[+p[1] - 1] + ' inteiro';
    return '';
  };

  /* =================================================================
     FOLHA DA OPORTUNIDADE (Calendário, página, cliente, linha)
     ctx: { dia, cliente, aoMudar }
     ================================================================= */
  async function folha(opId, ctx) {
    ctx = ctx || {};
    const m = B7.UI.modal('<div class="op-folha" id="op-folha">' + B7.UI.skeleton('lista', { n: 3 }) + '</div>', { classe: 'tp-folha cb-folha op-fundo', larga: true });
    let b;
    try { b = await carregarBase(); } catch (e) { m.querySelector('#op-folha').innerHTML = '<p class="cb-vazio">Não foi possível carregar a oportunidade.</p>'; return; }
    const pintar = () => {
      const cx = m.querySelector('#op-folha'); if (!cx) return;
      const op = b.todas.get(opId);
      if (!op) { cx.innerHTML = '<div class="tp-folha-cab"><h3>Oportunidade</h3><button type="button" class="ico" data-fecha aria-label="Fechar">' + IC_FECHA + '</button></div><p class="cb-vazio">Esta oportunidade não existe mais.</p>'; cx.querySelector('[data-fecha]').onclick = m.fechar; return; }
      const hoje = D().hoje();
      const oc = (ctx.dia && ocorrencias(op, ctx.dia, ctx.dia, b)[0]) || proxima(op, hoje) || { ini: ctx.dia || hoje, fim: ctx.dia || hoje };
      const rels = relacionados(op, b);
      const ctxCli = ctx.cliente && b.clientesMap.get(ctx.cliente);
      const relCtx = ctxCli ? relevancia(op, ctxCli.id, b) : null;
      const provas = (b.provas.get(op.id) || []).slice().sort((x, y) => (y.ativo - x.ativo) || String(x.fonte_id).localeCompare(y.fonte_id));
      const cats = (op.categorias || []).map(nomeTema);
      const linhaRel = r => '<li class="op-rel' + (r.nivel ? '' : ' fora') + '">' +
        B7.UI.avatarCliente(r.cliente.nome, r.cliente.logo, 'op-av') +
        '<div class="op-rel-tx"><b>' + esc(r.cliente.nome) + '</b><small>' + esc(r.motivos.join(' · ')) + '</small></div>' +
        '<div class="op-rel-lado">' + (r.nivel ? seloNivel(r.nivel) : '') +
          (souGestor() ? (r.ajuste
            ? '<button class="b fina contorno" data-desfazer="' + esc(r.cliente.id) + '">Desfazer</button>'
            : '<button class="b fina contorno" data-ignorar="' + esc(r.cliente.id) + '" title="Deixa de aparecer para este cliente (os outros não mudam)">Ignorar para este cliente</button>') : '') +
        '</div></li>';
      cx.innerHTML =
        '<div class="cb-pv d-oportunidade">' +
          '<div class="tp-folha-cab"><span class="cb-pv-tipo"><i class="cb-dom-ic">' + IC + '</i>Oportunidade</span>' +
            '<button type="button" class="ico" data-fecha aria-label="Fechar">' + IC_FECHA + '</button></div>' +
          '<h3>' + esc(op.nome) + '</h3>' +
          '<p class="cb-pv-tit">' + esc(quandoTx(oc.ini, oc.fim)) + ' · <b>' + esc(faltaTx(oc.ini, oc.fim)) + '</b>' + (regraTx(op) ? ' · ' + esc(regraTx(op)) : '') + '</p>' +
          '<div class="op-selos">' + seloConf(op) + selo(NATUREZA[op.natureza] || op.natureza, 'neutro') + selo(ABRANGENCIA[op.abrangencia] || op.abrangencia, 'neutro') +
            cats.map(c => '<span class="op-cat">' + esc(c) + '</span>').join('') + '</div>' +
          (op.descricao ? '<p class="op-desc">' + esc(op.descricao) + '</p>' : '') +
          ((op.aliases || []).length ? '<p class="op-alias">Também conhecida como: ' + esc(op.aliases.join(' · ')) + '</p>' : '') +
          (op.revisao === 'revisar' ? '<p class="cb-pv-nota">Em revisão: pode ser a mesma data de outra oportunidade' + (op.possivel_duplicata_de && b.todas.get(op.possivel_duplicata_de) ? ' (“' + esc(b.todas.get(op.possivel_duplicata_de).nome) + '”)' : '') + '.</p>' : '') +
          (!op.ativo ? '<p class="cb-pv-nota erro">Oportunidade desativada.</p>' : '') +

          (ctxCli ? '<section class="op-sec"><h4>Para ' + esc(ctxCli.nome) + '</h4>' +
            '<div class="op-ctx">' + (relCtx.nivel ? seloNivel(relCtx.nivel) : selo(relCtx.ajuste ? 'Fora para este cliente' : 'Sem relação direta', 'neutro')) +
              '<small>' + esc(relCtx.motivos.join(' · ') || 'Nenhum segmento do cliente corresponde a esta data.') + '</small>' +
              (souGestor() ? (relCtx.ajuste ? '<button class="b fina contorno" data-desfazer="' + esc(ctxCli.id) + '">Desfazer ajuste</button>'
                : (relCtx.nivel ? '<button class="b fina contorno" data-ignorar="' + esc(ctxCli.id) + '">Ignorar para este cliente</button>'
                  : '<button class="b fina contorno" data-relevante="' + esc(ctxCli.id) + '">Marcar como relevante</button>')) : '') +
            '</div></section>' : '') +

          '<section class="op-sec"><h4>Clientes relacionados <span>' + rels.filter(r => r.nivel).length + '</span></h4>' +
            (rels.length ? '<ul class="op-rels">' + rels.filter(r => !ctxCli || r.cliente.id !== ctxCli.id).map(linhaRel).join('') + '</ul>'
              : '<p class="op-nada">' + (op.geral || op.natureza === 'feriado' ? 'Data geral: serve para qualquer cliente, sem um segmento específico.' : 'Nenhum cliente com segmento correspondente.') + '</p>') +
          '</section>' +

          '<section class="op-sec"><h4>Fontes <span>' + provas.length + '</span></h4>' +
            (provas.length ? '<ul class="op-fontes">' + provas.map(p =>
              '<li class="' + (p.ativo ? '' : 'inativa') + '"><div><b>' + esc(FONTES_ROT[p.fonte_id] || p.fonte_id) + '</b>' +
                '<small>' + esc([p.titulo_na_fonte !== op.nome ? '“' + p.titulo_na_fonte + '”' : '', p.detalhe].filter(Boolean).join(' · ')) + '</small>' +
                '<small class="op-visto">' + (p.ativo ? 'Conferida em ' : 'Não aparece mais na fonte desde ') + esc(B7.UI.dataBR ? B7.UI.dataBR(String(p.visto_em).slice(0, 10)) : String(p.visto_em).slice(0, 10)) + '</small></div>' +
                (p.url ? '<a class="b fina contorno" href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer">' + IC_LINK + 'Ver fonte</a>' : '') + '</li>').join('') + '</ul>'
              : '<p class="op-nada">Sem fonte registrada.</p>') +
          '</section>' +

          '<section class="op-sec" id="op-linhas"><h4>Linhas editoriais</h4><p class="op-nada">Carregando…</p></section>' +

          '<div class="acoes">' +
            (souGestor() ? '<a class="b contorno" href="#/oportunidades" data-ir>Todas as oportunidades</a>' : '') +
            (souGestor() && op.ativo ? '<button class="b pri" data-usar>Usar na Linha Editorial</button>' : '') +
          '</div>' +
        '</div>';
      cx.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
      cx.querySelectorAll('[data-ir]').forEach(x => x.addEventListener('click', () => m.fechar()));
      const ajustar = async (cid, decisao, msg) => {
        try {
          await B7.DB.oportunidadeAjustarCliente(op.id, cid, decisao);
          invalidar(); b = await carregarBase(true); pintar();
          B7.UI.toast(msg);
          ctx.aoMudar && ctx.aoMudar();
        } catch (e) { B7.UI.toast('Não foi possível salvar: ' + (e.message || 'erro')); }
      };
      cx.querySelectorAll('[data-ignorar]').forEach(x => x.onclick = () => ajustar(x.dataset.ignorar, 'ignorar', 'Ignorada só para ' + ((b.clientesMap.get(x.dataset.ignorar) || {}).nome || 'este cliente') + '.'));
      cx.querySelectorAll('[data-relevante]').forEach(x => x.onclick = () => ajustar(x.dataset.relevante, 'relevante', 'Marcada como relevante.'));
      cx.querySelectorAll('[data-desfazer]').forEach(x => x.onclick = () => ajustar(x.dataset.desfazer, null, 'Ajuste desfeito.'));
      const primeiroMuito = rels.find(r => r.nivel === 'muito');
      const sugerido = ctxCli ? ctxCli.id : primeiroMuito ? primeiroMuito.cliente.id : null;
      const us = cx.querySelector('[data-usar]'); if (us) us.onclick = () => modalUsarLinha(op, oc, sugerido, () => { pintarLinhas(); ctx.aoMudar && ctx.aoMudar(); });
      pintarLinhas();
    };
    const pintarLinhas = async () => {
      const sec = m.querySelector('#op-linhas'); if (!sec) return;
      let l = [];
      try { l = await B7.DB.oportunidadeLinhas({ oportunidade: opId }); } catch (e) { sec.querySelector('.op-nada').textContent = 'Não foi possível carregar os vínculos.'; return; }
      if (!document.body.contains(sec)) return;
      sec.innerHTML = '<h4>Linhas editoriais <span>' + l.length + '</span></h4>' + (l.length ? '<ul class="op-vincs">' + l.map(v => {
        const ln = v.linhas_editoriais || {}, cli = b.clientesMap.get(ln.client_id);
        return '<li><a href="#/linha/' + esc(v.linha_id) + '" data-ir-linha>' + esc((cli ? cli.nome + ' · ' : '') + (ln.nome || 'Linha editorial')) + '</a>' +
          (v.data_ocorrencia ? '<small>' + esc(D().local(v.data_ocorrencia).getDate() + ' ' + MESES[D().local(v.data_ocorrencia).getMonth()]) + '</small>' : '') +
          (v.observacao ? '<small>' + esc(v.observacao) + '</small>' : '') +
          (souGestor() ? '<button class="cb-link" data-desv="' + esc(v.linha_id) + '">Remover vínculo</button>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="op-nada">Ainda não usada em nenhuma linha.</p>');
      sec.querySelectorAll('[data-ir-linha]').forEach(a => a.addEventListener('click', () => m.fechar()));
      sec.querySelectorAll('[data-desv]').forEach(x => x.onclick = async () => {
        try { await B7.DB.oportunidadeDesvincularLinha(opId, x.dataset.desv); B7.UI.toast('Vínculo removido. Nada mais foi alterado.'); pintarLinhas(); ctx.aoMudar && ctx.aoMudar(); }
        catch (e) { B7.UI.toast('Não foi possível remover: ' + (e.message || 'erro')); }
      });
    };
    pintar();
    return m;
  }

  /* ------------------------------------------------ usar na Linha Editorial
     Só registra o vínculo oportunidade ↔ linha (com a data). Nada é gerado. */
  async function modalUsarLinha(op, oc, clienteSugerido, aoConcluir) {
    const b = await carregarBase();
    const rels = relacionados(op, b).filter(r => r.nivel);
    const idsRel = new Set(rels.map(r => r.cliente.id));
    const outros = b.clientes.filter(c => !idsRel.has(c.id));
    const alvoMes = +oc.ini.slice(5, 7), alvoAno = +oc.ini.slice(0, 4);
    const m = B7.UI.modal(
      '<h3>Usar na Linha Editorial</h3>' +
      '<div class="sub">' + esc(op.nome) + ' · ' + esc(quandoTx(oc.ini, oc.fim)) + '</div>' +
      '<div class="mb"><label class="rot" for="op-u-cli">CLIENTE</label><select class="campo" id="op-u-cli"><option value="">Escolha o cliente…</option>' +
        (rels.length ? '<optgroup label="Relacionados">' + rels.map(r => '<option value="' + esc(r.cliente.id) + '">' + esc(r.cliente.nome) + ' — ' + esc(NIVEL[r.nivel].rot) + '</option>').join('') + '</optgroup>' : '') +
        '<optgroup label="Outros clientes">' + outros.map(c => '<option value="' + esc(c.id) + '">' + esc(c.nome) + '</option>').join('') + '</optgroup></select></div>' +
      '<div class="mb"><label class="rot" for="op-u-linha">LINHA EDITORIAL</label><select class="campo" id="op-u-linha" disabled><option value="">Escolha o cliente primeiro</option></select>' +
        '<small class="op-dica" id="op-u-dica"></small></div>' +
      '<div class="mb"><label class="rot" for="op-u-obs">OBSERVAÇÃO <span class="leve">(opcional)</span></label><textarea class="campo" id="op-u-obs" rows="2" placeholder="Ex.: pensar em carrossel educativo"></textarea></div>' +
      '<p class="op-aviso-sem">Isso só registra a oportunidade na linha. Nenhum conteúdo, roteiro, design, vídeo ou gravação é criado.</p>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" data-ok disabled>Vincular</button></div>');
    const selCli = m.querySelector('#op-u-cli'), selLinha = m.querySelector('#op-u-linha'), ok = m.querySelector('[data-ok]'), dica = m.querySelector('#op-u-dica');
    const carregarLinhas = async () => {
      selLinha.disabled = true; ok.disabled = true; dica.textContent = '';
      if (!selCli.value) { selLinha.innerHTML = '<option value="">Escolha o cliente primeiro</option>'; return; }
      selLinha.innerHTML = '<option value="">Carregando…</option>';
      let linhas = [];
      try { linhas = await B7.DB.listarLinhas(selCli.value); } catch (e) { selLinha.innerHTML = '<option value="">Não foi possível carregar</option>'; return; }
      if (!linhas.length) { selLinha.innerHTML = '<option value="">Este cliente não tem linha editorial</option>'; dica.textContent = 'Crie a linha do mês no cliente e volte aqui.'; return; }
      const alvo = linhas.find(l => +l.mes === alvoMes && +l.ano === alvoAno);
      selLinha.innerHTML = linhas.map(l => '<option value="' + esc(l.id) + '"' + (alvo && alvo.id === l.id ? ' selected' : '') + '>' + esc(l.nome || (MESES_LONGOS[(l.mes || 1) - 1] + ' ' + l.ano)) + '</option>').join('');
      selLinha.disabled = false; ok.disabled = false;
      dica.textContent = alvo ? 'Sugerida: linha do mês da data.' : 'Nenhuma linha de ' + MESES_LONGOS[alvoMes - 1] + ' de ' + alvoAno + ' — escolha outra ou crie a do mês.';
    };
    selCli.onchange = carregarLinhas;
    if (clienteSugerido) { selCli.value = clienteSugerido; carregarLinhas(); }
    ok.onclick = async () => {
      if (!selLinha.value) return;
      ok.disabled = true;
      try {
        await B7.DB.oportunidadeVincularLinha(op.id, selLinha.value, oc.ini, m.querySelector('#op-u-obs').value);
        m.fechar();
        B7.UI.toast('Vinculada à linha. Nenhum conteúdo foi criado.');
        aoConcluir && aoConcluir();
      } catch (e) { ok.disabled = false; B7.UI.toast('Não foi possível vincular: ' + (e.message || 'erro')); }
    };
  }

  /* =================================================================
     PÁGINA #/oportunidades (admin e coordenação)
     ================================================================= */
  const P = { aba: 'proximas', dias: 30, cat: '', rel: '', cliente: '', conf: '', abr: '', q: '' };
  const painel = () => document.getElementById('painel-dashboard');
  function lerParams(p) {
    P.aba = ['proximas', 'revisao', 'fontes'].includes(p.get('aba')) ? p.get('aba') : 'proximas';
    P.dias = [7, 15, 30, 60].includes(+p.get('p')) ? +p.get('p') : 30;
    P.cat = p.get('cat') || ''; P.rel = p.get('rel') || ''; P.cliente = p.get('cliente') || '';
    P.conf = p.get('conf') || ''; P.abr = p.get('abr') || ''; P.q = p.get('q') || '';
    if (!souAdmin() && P.aba !== 'proximas') P.aba = 'proximas';
  }
  function gravarParams() {
    const q = new URLSearchParams();
    if (P.aba !== 'proximas') q.set('aba', P.aba);
    if (P.dias !== 30) q.set('p', P.dias);
    ['cat', 'rel', 'cliente', 'conf', 'abr', 'q'].forEach(k => { if (P[k]) q.set(k, P[k]); });
    const s = q.toString();
    try { history.replaceState(null, '', location.pathname + location.search + '#/oportunidades' + (s ? '?' + s : '')); } catch (e) {}
  }
  async function abrir(params) {
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/oportunidades');
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['Oportunidades']);
    if (!souGestor()) { painel().innerHTML = '<div class="conteudo op"><div class="estado-b7"><b>Sem acesso a Oportunidades.</b></div></div>'; return; }
    lerParams(params || new URLSearchParams(location.hash.split('?')[1] || ''));
    painel().innerHTML = '<div class="conteudo entra op">' +
      '<div class="cb-topo"><div class="cb-titulo"><h1>Oportunidades</h1><p>Datas comemorativas e campanhas com fonte, e para quais clientes elas fazem sentido.</p></div>' +
        '<div class="cb-topo-acoes"><a class="b contorno" href="#/calendario?v=mes&op=1">' + IC + '<span>Ver no Calendário</span></a></div></div>' +
      (souAdmin() ? '<div class="filtro op-abas" role="tablist">' + [['proximas', 'Próximas'], ['revisao', 'Revisão'], ['fontes', 'Fontes']].map(([k, r]) =>
        '<button role="tab" data-aba="' + k + '" class="' + (P.aba === k ? 'on' : '') + '" aria-selected="' + (P.aba === k) + '">' + r + '<span class="cb-n" data-n-' + k + '></span></button>').join('') + '</div>' : '') +
      '<div id="op-corpo">' + B7.UI.skeleton('lista', { n: 5 }) + '</div></div>';
    painel().querySelectorAll('[data-aba]').forEach(x => x.onclick = () => { P.aba = x.dataset.aba; gravarParams(); abrir(new URLSearchParams(location.hash.split('?')[1] || '')); });
    try { await carregarBase(); } catch (e) { document.getElementById('op-corpo').innerHTML = '<div class="cb-aviso erro">Não foi possível carregar as oportunidades. <button class="cb-link" data-de-novo>Tentar de novo</button></div>'; painel().querySelector('[data-de-novo]').onclick = () => abrir(params); return; }
    const nRev = [...B.todas.values()].filter(o => o.ativo && o.revisao === 'revisar').length;
    const nr = painel().querySelector('[data-n-revisao]'); if (nr) nr.textContent = nRev || '';
    if (P.aba === 'revisao') return pintarRevisao();
    if (P.aba === 'fontes') return pintarFontes();
    pintarProximas();
  }

  async function pintarProximas() {
    const cx = document.getElementById('op-corpo'); if (!cx) return;
    const hoje = D().hoje(), fim = D().somarDias(hoje, P.dias - 1);
    const temas = [...B.temas.values()].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    cx.innerHTML = '<div class="cb-filtros op-filtros">' +
      '<div class="filtro" role="group" aria-label="Período">' + [7, 15, 30, 60].map(n => '<button data-dias="' + n + '" class="' + (P.dias === n ? 'on' : '') + '" aria-pressed="' + (P.dias === n) + '">' + n + ' dias</button>').join('') + '</div>' +
      '<div class="cb-sels">' +
        '<input class="campo fina op-busca" id="op-q" type="search" placeholder="Buscar por nome, apelido ou tag" value="' + esc(P.q) + '" aria-label="Buscar">' +
        sel('op-cliente', 'Cliente: todos', B.clientes.map(c => [c.id, c.nome]), P.cliente) +
        sel('op-rel', 'Relevância: todas', [['muito', 'Muito relevante'], ['relacionada', 'Relacionada'], ['geral', 'Geral'], ['relevantes', 'Qualquer relevância']], P.rel) +
        sel('op-cat', 'Categoria: todas', temas.map(t => [t.id, (t.pai ? '— ' : '') + t.nome]), P.cat) +
        sel('op-conf', 'Confiabilidade: todas', Object.keys(CONF).map(k => [k, CONF[k].rot]), P.conf) +
        sel('op-abr', 'Abrangência: todas', Object.keys(ABRANGENCIA).map(k => [k, ABRANGENCIA[k]]), P.abr) +
        ((P.cat || P.rel || P.cliente || P.conf || P.abr || P.q) ? '<button class="b fina contorno" id="op-limpar">Limpar</button>' : '') +
      '</div></div><div id="op-lista"></div>';
    cx.querySelectorAll('[data-dias]').forEach(x => x.onclick = () => { P.dias = +x.dataset.dias; gravarParams(); pintarProximas(); });
    [['op-cliente', 'cliente'], ['op-rel', 'rel'], ['op-cat', 'cat'], ['op-conf', 'conf'], ['op-abr', 'abr']].forEach(([id, k]) => {
      const s = cx.querySelector('#' + id); if (s) s.onchange = () => { P[k] = s.value; gravarParams(); pintarProximas(); };
    });
    const q = cx.querySelector('#op-q');
    q.oninput = (B7.UI.debounce || (f => f))(() => { P.q = q.value.trim(); gravarParams(); pintarLista(hoje, fim); }, 200);
    const lp = cx.querySelector('#op-limpar'); if (lp) lp.onclick = () => { Object.assign(P, { cat: '', rel: '', cliente: '', conf: '', abr: '', q: '' }); gravarParams(); pintarProximas(); };
    pintarLista(hoje, fim);
  }
  const sel = (id, vazio, opcoes, valor) => '<select class="campo fina' + (valor ? ' ativo' : '') + '" id="' + id + '" aria-label="' + esc(vazio.split(':')[0]) + '"><option value="">' + esc(vazio) + '</option>' +
    opcoes.map(([v, r]) => '<option value="' + esc(v) + '"' + (v === valor ? ' selected' : '') + '>' + esc(r) + '</option>').join('') + '</select>';

  /* filtros combinados da página (exposto para teste) */
  function filtrarItens(itens, f) {
    const q = norm(f.q);
    return itens.filter(it => {
      const op = it.op;
      const nivel = f.cliente ? (it.rel && it.rel.nivel) : it.nivelMax;
      if (f.rel === 'relevantes' ? !nivel : (f.rel && nivel !== f.rel)) return false;
      if (f.cat && !(op.categorias || []).includes(f.cat) && !(op.categorias || []).some(c => B.temas.get(c) && B.temas.get(c).pai === f.cat)) return false;
      if (f.conf && op.confiabilidade !== f.conf) return false;
      if (f.abr && op.abrangencia !== f.abr) return false;
      if (q && !(norm(op.nome).includes(q) || (op.aliases || []).some(a => norm(a).includes(q)) || (op.tags || []).some(t => t.includes(q)))) return false;
      return true;
    });
  }
  async function pintarLista(hoje, fim) {
    const cx = document.getElementById('op-lista'); if (!cx) return;
    let itens;
    try { itens = await periodo(hoje, fim, { cliente: P.cliente || null }); } catch (e) { cx.innerHTML = '<div class="cb-aviso erro">Não foi possível calcular as oportunidades.</div>'; return; }
    const lista = filtrarItens(itens, P);
    if (!lista.length) { cx.innerHTML = '<p class="cb-vazio">Nenhuma oportunidade nos próximos ' + P.dias + ' dias' + ((P.cat || P.rel || P.cliente || P.conf || P.abr || P.q) ? ' com esses filtros' : '') + '.</p>'; return; }
    const grupos = new Map();
    lista.forEach(it => { const k = it.ini < hoje ? hoje : it.ini; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(it); });
    cx.innerHTML = '<p class="op-contagem">' + lista.length + ' oportunidade' + (lista.length > 1 ? 's' : '') + ' nos próximos ' + P.dias + ' dias</p>' +
      [...grupos.entries()].map(([dia, its]) => {
        const d = D().local(dia);
        return '<section class="op-dia"><h3>' + esc(DIAS[d.getDay()] + ', ' + d.getDate() + ' ' + MESES[d.getMonth()]) + '<span>' + esc(faltaTx(dia)) + '</span></h3>' +
          its.map(cartaoHTML).join('') + '</section>';
      }).join('');
    cx.querySelectorAll('[data-op]').forEach(x => x.onclick = () => folha(x.dataset.op, { dia: x.dataset.dia, cliente: P.cliente || null, aoMudar: () => pintarLista(hoje, fim) }));
  }
  function cartaoHTML(it) {
    const op = it.op, rels = it.relacionados.filter(r => r.nivel === 'muito' || r.nivel === 'relacionada');
    const nivel = P.cliente ? it.rel && it.rel.nivel : it.nivelMax;
    return '<button type="button" class="op-card" data-op="' + esc(op.id) + '" data-dia="' + esc(it.ini) + '">' +
      '<i class="op-card-ic">' + IC + '</i>' +
      '<span class="op-card-tx"><b>' + esc(op.nome) + '</b>' +
        '<small>' + esc([NATUREZA[op.natureza], it.fim !== it.ini ? 'até ' + D().local(it.fim).getDate() + ' ' + MESES[D().local(it.fim).getMonth()] : '', (op.categorias || []).map(nomeTema).slice(0, 3).join(', ')].filter(Boolean).join(' · ')) + '</small>' +
        (P.cliente && it.rel ? '<small class="op-motivo">' + esc(it.rel.motivos.join(' · ')) + '</small>'
          : rels.length ? '<small class="op-clis">' + esc(rels.slice(0, 3).map(r => r.cliente.nome).join(', ') + (rels.length > 3 ? ' +' + (rels.length - 3) : '')) + '</small>' : '') +
      '</span><span class="op-card-lado">' + seloNivel(nivel) + seloConf(op) + '</span></button>';
  }

  /* ---- revisão (admin): possíveis duplicatas ---- */
  function pintarRevisao() {
    const cx = document.getElementById('op-corpo'); if (!cx) return;
    const fila = [...B.todas.values()].filter(o => o.ativo && o.revisao === 'revisar')
      .sort((a, b) => ((a.mes || 0) - (b.mes || 0)) || ((a.dia || 0) - (b.dia || 0)));
    const resumo = op => {
      const oc = proxima(op, D().hoje());
      const pv = (B.provas.get(op.id) || []).map(p => FONTES_ROT[p.fonte_id] || p.fonte_id);
      return '<div class="op-rv-lado"><b>' + esc(op.nome) + '</b><small>' + esc(oc ? quandoTx(oc.ini, oc.fim) : '—') + '</small>' +
        '<small>' + esc([...new Set(pv)].join(', ') || 'sem fonte') + '</small>' + seloConf(op) + '</div>';
    };
    cx.innerHTML = '<p class="op-contagem">Datas que o sincronizador não teve certeza se são a mesma. Nada é unido sozinho.</p>' +
      (fila.length ? fila.map(op => {
        const dup = op.possivel_duplicata_de && B.todas.get(op.possivel_duplicata_de);
        return '<article class="op-rv" data-rv="' + esc(op.id) + '">' + resumo(op) +
          (dup ? '<span class="op-rv-vs">parece</span>' + resumo(dup) : '<span class="op-rv-vs"></span><div></div>') +
          '<div class="op-rv-acoes">' +
            (dup ? '<button class="b fina pri" data-unir="' + esc(dup.id) + '">Unir (manter “' + esc(dup.nome.slice(0, 28)) + (dup.nome.length > 28 ? '…' : '') + '”)</button>' : '') +
            '<button class="b fina contorno" data-ok-rv>Não é duplicata</button>' +
            '<button class="b fina contorno" data-desativar>Desativar</button></div></article>';
      }).join('') : '<p class="cb-vazio">Nada para revisar.</p>');
    const agir = async (fn, msg) => { try { await fn(); invalidar(); await carregarBase(true); B7.UI.toast(msg); abrir(new URLSearchParams(location.hash.split('?')[1] || '')); } catch (e) { B7.UI.toast('Não foi possível: ' + (e.message || 'erro')); } };
    cx.querySelectorAll('[data-rv]').forEach(card => {
      const id = card.dataset.rv;
      const u = card.querySelector('[data-unir]'); if (u) u.onclick = () => agir(() => B7.DB.oportunidadeUnir(u.dataset.unir, id), 'Unidas. As fontes e os ajustes passaram para a oportunidade mantida.');
      card.querySelector('[data-ok-rv]').onclick = () => agir(() => B7.DB.oportunidadeDefinirEstado(id, null, 'ok'), 'Mantidas separadas.');
      card.querySelector('[data-desativar]').onclick = async () => {
        if (!(await B7.UI.confirmar({ titulo: 'Desativar oportunidade?', texto: 'Ela deixa de aparecer no Calendário e nas listas. As fontes continuam registradas.', rotulo: 'Desativar' }))) return;
        agir(() => B7.DB.oportunidadeDefinirEstado(id, false, 'ignorada'), 'Desativada.');
      };
    });
  }

  /* ---- fontes (admin): saúde, sincronização, cadastro manual ---- */
  const METODO = { automatica: 'Automática (semanal)', assistida: 'Cadastro assistido', verificacao: 'Verificação manual', nao_integrada: 'Não integrada' };
  const AUTORIDADE = { oficial: 'Oficial', operacional: 'Operacional', secundaria: 'Secundária' };
  const ST_FONTE = { ok: ['Funcionando', 'verde'], falha: ['Falhou', 'vermelho'], suspeita: ['Resultado suspeito', 'ambar'], nunca: ['Sem sincronização', 'neutro'] };
  async function pintarFontes() {
    const cx = document.getElementById('op-corpo'); if (!cx) return;
    let fontes = [], execs = [];
    try { [fontes, execs] = await Promise.all([B7.DB.oportunidadeFontes(), B7.DB.oportunidadeExecucoes(12)]); }
    catch (e) { cx.innerHTML = '<div class="cb-aviso erro">Não foi possível carregar as fontes.</div>'; return; }
    const dt = v => v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const contagem = {}; B.provas.forEach(l => l.forEach(p => { if (p.ativo) contagem[p.fonte_id] = (contagem[p.fonte_id] || 0) + 1; }));
    cx.innerHTML = '<div class="op-fontes-topo"><p class="op-contagem">As fontes automáticas são lidas no servidor uma vez por semana. O Calendário só lê o que já foi gravado aqui.</p>' +
        '<div class="cb-topo-acoes"><button class="b contorno" id="op-manual">Adicionar data verificada</button><button class="b pri" id="op-sync">Sincronizar agora</button></div></div>' +
      '<div class="op-ftabela">' + fontes.map(f => {
        const st = f.metodo === 'automatica' ? (ST_FONTE[f.status] || ST_FONTE.nunca) : null;
        return '<article class="op-fonte"><div class="op-fonte-cab"><b>' + esc(f.nome) + '</b>' + (st ? selo(st[0], st[1]) : selo(METODO[f.metodo] || f.metodo, 'neutro')) + '</div>' +
          '<dl class="cb-pv-dl">' +
            '<div class="cb-pv-l"><dt>Autoridade</dt><dd>' + esc(AUTORIDADE[f.autoridade] || f.autoridade) + '</dd></div>' +
            '<div class="cb-pv-l"><dt>Método</dt><dd>' + esc(METODO[f.metodo] || f.metodo) + '</dd></div>' +
            '<div class="cb-pv-l"><dt>Datas com prova</dt><dd>' + (contagem[f.id] || 0) + '</dd></div>' +
            (f.metodo === 'automatica' ? '<div class="cb-pv-l"><dt>Último sucesso</dt><dd>' + esc(dt(f.ultimo_sucesso)) + '</dd></div>' +
              '<div class="cb-pv-l"><dt>Última leitura</dt><dd>' + esc((f.itens_ultimo != null ? f.itens_ultimo + ' itens' : '—') + (f.criados_ultimo ? ' · ' + f.criados_ultimo + ' novas' : '')) + '</dd></div>' : '') +
          '</dl>' + (f.erro ? '<p class="cb-pv-nota erro">' + esc(f.erro) + '</p>' : '') +
          (f.descricao ? '<p class="op-fonte-desc">' + esc(f.descricao) + '</p>' : '') +
          (f.url ? '<a class="cb-link" href="' + esc(f.url) + '" target="_blank" rel="noopener noreferrer">Abrir a fonte</a>' : '') + '</article>';
      }).join('') + '</div>' +
      '<h3 class="op-h3">Últimas sincronizações</h3>' +
      (execs.length ? '<ul class="op-execs">' + execs.map(e => '<li>' + selo((ST_FONTE[e.status] || [e.status])[0] || e.status, (ST_FONTE[e.status] || [0, 'neutro'])[1]) +
        '<b>' + esc(FONTES_ROT[e.fonte_id] || e.fonte_id) + '</b><small>' + esc(dt(e.iniciado_em) + ' · ' + (e.disparo === 'manual' ? 'manual' : 'automática') +
          (e.buscados != null ? ' · ' + e.buscados + ' lidos, ' + (e.criados || 0) + ' novos, ' + ((e.atualizados || 0) + (e.vinculados || 0)) + ' atualizados' + (e.para_revisao ? ', ' + e.para_revisao + ' p/ revisão' : '') : '') +
          (e.erro ? ' · ' + e.erro : '')) + '</small></li>').join('') + '</ul>' : '<p class="op-nada">Nenhuma sincronização ainda.</p>');
    cx.querySelector('#op-sync').onclick = async ev => {
      const bt = ev.currentTarget; bt.disabled = true; bt.textContent = 'Sincronizando…';
      try {
        const r = await B7.DB.oportunidadesSincronizar(true);
        const res = (r && r.resultados) || {};
        const falhas = Object.keys(res).filter(k => res[k] && res[k].status && res[k].status !== 'ok');
        B7.UI.toast(r && r.pulado ? r.pulado : falhas.length ? 'Sincronizado, com problema em: ' + falhas.map(k => FONTES_ROT[k] || k).join(', ') : 'Fontes sincronizadas.');
        invalidar(); await carregarBase(true); pintarFontes();
      } catch (e) { B7.UI.toast('Não foi possível sincronizar: ' + (e.message || 'erro')); bt.disabled = false; bt.textContent = 'Sincronizar agora'; }
    };
    cx.querySelector('#op-manual').onclick = modalManual;
  }

  function modalManual() {
    const temas = [...B.temas.values()].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const opts = (arr, v) => arr.map(([k, r]) => '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + esc(r) + '</option>').join('');
    const m = B7.UI.modal(
      '<h3>Adicionar data verificada</h3><div class="sub">Só entra com fonte. Se o nome já existir (ou for um apelido), a fonte é somada à oportunidade existente.</div>' +
      '<div class="mb"><label class="rot" for="om-nome">NOME</label><input class="campo" id="om-nome" data-foco placeholder="Ex.: Dia do Nutricionista"></div>' +
      '<div class="mb"><label class="rot">QUANDO</label><div class="op-m-quando">' +
        '<select class="campo" id="om-tipo">' + opts([['fixa', 'Data fixa'], ['regra', 'Regra (ex.: 2º domingo)']], 'fixa') + '</select>' +
        '<span id="om-fixa"><input class="campo" id="om-dia" type="number" min="1" max="31" placeholder="Dia" aria-label="Dia"></span>' +
        '<span id="om-regra" hidden><select class="campo" id="om-n" aria-label="Qual">' + opts([['1', '1º'], ['2', '2º'], ['3', '3º'], ['4', '4º'], ['-1', 'Último']], '2') + '</select>' +
          '<select class="campo" id="om-dow" aria-label="Dia da semana">' + opts(DIAS_LONGOS.map((d, i) => [String(i), d]), '0') + '</select></span>' +
        '<select class="campo" id="om-mes" aria-label="Mês">' + opts(MESES_LONGOS.map((x, i) => [String(i + 1), x]), '1') + '</select>' +
        '<input class="campo" id="om-dur" type="number" min="1" max="31" value="1" aria-label="Duração em dias" title="Duração em dias"></div></div>' +
      '<div class="op-m-grade">' +
        '<div class="mb"><label class="rot" for="om-nat">NATUREZA</label><select class="campo" id="om-nat">' + opts(Object.entries(NATUREZA), 'comemorativa') + '</select></div>' +
        '<div class="mb"><label class="rot" for="om-abr">ABRANGÊNCIA</label><select class="campo" id="om-abr">' + opts(Object.entries(ABRANGENCIA), 'nacional') + '</select></div>' +
        '<div class="mb"><label class="rot" for="om-conf">CONFIABILIDADE</label><select class="campo" id="om-conf">' + opts([['oficial', 'Oficial'], ['verificada', 'Verificada'], ['popular', 'Popular / comercial']], 'oficial') + '</select></div>' +
        '<div class="mb"><label class="rot" for="om-fonte">FONTE</label><select class="campo" id="om-fonte">' + opts([['planalto', 'Planalto (lei/decreto)'], ['camara', 'Câmara dos Deputados'], ['conselho', 'Conselho profissional'], ['manual', 'Outra fonte verificada']], 'planalto') + '</select></div>' +
      '</div>' +
      '<div class="mb"><label class="rot" for="om-url">LINK DA FONTE</label><input class="campo" id="om-url" type="url" placeholder="https://…"></div>' +
      '<div class="mb"><label class="rot" for="om-ref">REFERÊNCIA <span class="leve">(ex.: Lei nº 0.000/2000, art. 1º)</span></label><input class="campo" id="om-ref"></div>' +
      '<div class="mb"><label class="rot">CATEGORIAS</label><div class="op-m-cats">' + temas.map(t => '<label class="cb-check"><input type="checkbox" value="' + esc(t.id) + '"><span>' + esc(t.nome) + '</span></label>').join('') + '</div></div>' +
      '<div class="mb"><label class="rot" for="om-tags">TAGS <span class="leve">(separadas por vírgula)</span></label><input class="campo" id="om-tags"></div>' +
      '<div class="mb"><label class="rot" for="om-alias">OUTROS NOMES <span class="leve">(separados por vírgula)</span></label><input class="campo" id="om-alias"></div>' +
      '<div class="mb"><label class="rot" for="om-desc">DESCRIÇÃO <span class="leve">(opcional)</span></label><textarea class="campo" id="om-desc" rows="2"></textarea></div>' +
      '<label class="cb-check mb"><input type="checkbox" id="om-geral"><span>Data geral (serve para qualquer cliente)</span></label>' +
      '<p class="op-erro" id="om-erro" role="alert"></p>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" data-ok>Adicionar</button></div>', { larga: true });
    const $ = s => m.querySelector(s);
    $('#om-tipo').onchange = () => { const r = $('#om-tipo').value === 'regra'; $('#om-fixa').hidden = r; $('#om-regra').hidden = !r; };
    const lista = s => s.split(',').map(x => x.trim()).filter(Boolean);
    $('[data-ok]').onclick = async () => {
      const erro = t => { $('#om-erro').textContent = t; };
      const nome = $('#om-nome').value.trim(), tipo = $('#om-tipo').value, mes = +$('#om-mes').value, dia = +$('#om-dia').value, dur = +$('#om-dur').value || 1;
      if (nome.length < 4) return erro('Informe o nome da data.');
      if (tipo === 'fixa' && !(dia >= 1 && dia <= diasNoMes(2024, mes))) return erro('Dia inválido para esse mês.');
      if (!(dur >= 1 && dur <= 31)) return erro('Duração entre 1 e 31 dias.');
      if (!$('#om-url').value.trim() && !$('#om-ref').value.trim()) return erro('Informe o link ou a referência da fonte — sem fonte a data não entra.');
      const d = {
        nome, tipo_data: tipo, mes, dia: tipo === 'fixa' ? dia : null, regra: tipo === 'regra' ? 'nth:' + mes + ':' + $('#om-dow').value + ':' + $('#om-n').value : null,
        duracao: dur, natureza: $('#om-nat').value, abrangencia: $('#om-abr').value, confiabilidade: $('#om-conf').value,
        categorias: [...m.querySelectorAll('.op-m-cats input:checked')].map(x => x.value), tags: lista($('#om-tags').value), aliases: lista($('#om-alias').value),
        geral: $('#om-geral').checked, descricao: $('#om-desc').value.trim(), fonte_id: $('#om-fonte').value, fonte_url: $('#om-url').value.trim(), fonte_detalhe: $('#om-ref').value.trim()
      };
      $('[data-ok]').disabled = true;
      try { await B7.DB.oportunidadeCadastrarManual(d); m.fechar(); B7.UI.toast('Data adicionada com fonte.'); invalidar(); await carregarBase(true); pintarFontes(); }
      catch (e) { $('[data-ok]').disabled = false; erro(e.message || 'Não foi possível salvar.'); }
    };
  }

  /* =================================================================
     CLIENTE — segmentos + próximas oportunidades do cliente
     ================================================================= */
  async function secaoCliente(el, clienteId) {
    if (!el || !souEquipeInterna()) return;
    el.innerHTML = '<section class="op-cli"><header class="op-cli-cab"><h3>' + IC + 'Oportunidades</h3></header>' + B7.UI.skeleton('lista', { n: 2 }) + '</section>';
    let b, itens;
    try { b = await carregarBase(); itens = await periodo(D().hoje(), D().somarDias(D().hoje(), 29), { cliente: clienteId }); }
    catch (e) { el.innerHTML = '<section class="op-cli"><header class="op-cli-cab"><h3>' + IC + 'Oportunidades</h3></header><p class="op-nada">Não foi possível carregar as oportunidades.</p></section>'; return; }
    if (!document.body.contains(el)) return;
    const segs = b.segmentos.get(clienteId) || [];
    const ignoradas = [...b.ajustes.entries()].filter(([k, v]) => k.endsWith('|' + clienteId) && (v === 'ignorar' || v === 'nao_relevante')).length;
    const relevantes = itens.filter(i => i.rel.nivel === 'muito' || i.rel.nivel === 'relacionada');
    const gerais = itens.filter(i => i.rel.nivel === 'geral');
    el.innerHTML = '<section class="op-cli">' +
      '<header class="op-cli-cab"><h3>' + IC + 'Oportunidades <small>próximos 30 dias</small></h3>' +
        '<div class="op-cli-links"><a class="cb-link" href="#/calendario?v=mes&op=1&cliente=' + esc(clienteId) + '">Ver no calendário</a>' +
        (souGestor() ? '<a class="cb-link" href="#/oportunidades?cliente=' + esc(clienteId) + '">Ver todas</a>' : '') + '</div></header>' +
      '<div class="op-segs"><span class="op-segs-rot">Segmentos</span>' +
        (segs.length ? segs.map(s => '<span class="op-seg' + (s.origem === 'sugerido' ? ' sug' : '') + '" title="' + (s.origem === 'sugerido' ? 'Sugerido — confirme editando' : 'Definido pela equipe') + '">' + esc(nomeTema(s.tema_id)) + (s.origem === 'sugerido' ? ' <em>sugerido</em>' : '') + '</span>').join('')
          : '<span class="op-nada">Nenhum segmento — só datas gerais aparecem.</span>') +
        (souGestor() ? '<button class="b fina contorno" data-segs>' + (segs.length ? 'Editar' : 'Definir segmentos') + '</button>' : '') + '</div>' +
      (relevantes.length ? '<ul class="op-cli-lista">' + relevantes.slice(0, 8).map(i => itemCompactoHTML(i, i.rel.nivel, i.rel.motivos)).join('') + '</ul>'
        : '<p class="op-nada">Nenhuma data do segmento nos próximos 30 dias.</p>') +
      (gerais.length ? '<p class="op-gerais">Datas gerais: ' + gerais.slice(0, 4).map(i => '<button class="cb-link" data-op="' + esc(i.op.id) + '" data-dia="' + esc(i.ini) + '">' + esc(i.op.nome) + '</button>').join(', ') + (gerais.length > 4 ? ' e mais ' + (gerais.length - 4) : '') + '</p>' : '') +
      (ignoradas ? '<p class="op-ign">' + ignoradas + ' oportunidade' + (ignoradas > 1 ? 's ignoradas' : ' ignorada') + ' para este cliente.</p>' : '') +
    '</section>';
    const recarregar = () => secaoCliente(el, clienteId);
    el.querySelectorAll('[data-op]').forEach(x => x.onclick = () => folha(x.dataset.op, { dia: x.dataset.dia, cliente: clienteId, aoMudar: recarregar }));
    const bs = el.querySelector('[data-segs]'); if (bs) bs.onclick = () => modalSegmentos(clienteId, recarregar);
  }
  function itemCompactoHTML(i, nivel, motivos) {
    const d = D().local(i.ini < D().hoje() ? D().hoje() : i.ini);
    return '<li><button type="button" class="op-item" data-op="' + esc(i.op.id) + '" data-dia="' + esc(i.ini) + '">' +
      '<span class="op-item-data"><b>' + d.getDate() + '</b><small>' + MESES[d.getMonth()] + '</small></span>' +
      '<span class="op-item-tx"><b>' + esc(i.op.nome) + '</b><small>' + esc(faltaTx(i.ini, i.fim) + (motivos && motivos.length ? ' · ' + motivos[0] : '')) + '</small></span>' +
      seloNivel(nivel) + '</button></li>';
  }
  async function modalSegmentos(clienteId, aoSalvar) {
    const b = await carregarBase();
    const atuais = new Map((b.segmentos.get(clienteId) || []).map(s => [s.tema_id, s.origem]));
    const raiz = [...b.temas.values()].filter(t => !t.pai).sort((x, y) => (x.ordem || 0) - (y.ordem || 0));
    const filhos = id => [...b.temas.values()].filter(t => t.pai === id).sort((x, y) => (x.ordem || 0) - (y.ordem || 0));
    const chip = t => '<label class="op-chip' + (atuais.has(t.id) ? ' on' : '') + '"><input type="checkbox" value="' + esc(t.id) + '"' + (atuais.has(t.id) ? ' checked' : '') + '>' +
      esc(t.nome) + (atuais.get(t.id) === 'sugerido' ? ' <em>sugerido</em>' : '') + '</label>';
    const cli = b.clientesMap.get(clienteId);
    const m = B7.UI.modal('<h3>Segmentos do cliente</h3><div class="sub">' + esc(cli ? cli.nome : '') + ' · escolha um ou mais. É o que decide quais datas são relevantes para ele.</div>' +
      '<div class="op-chips">' + raiz.map(t => '<div class="op-chips-g">' + chip(t) + filhos(t.id).map(chip).join('') + '</div>').join('') + '</div>' +
      '<p class="op-dica">Ao salvar, os segmentos sugeridos que ficarem marcados passam a valer como definidos pela equipe.</p>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" data-ok>Salvar</button></div>', { larga: true });
    m.querySelectorAll('.op-chip input').forEach(i => i.onchange = () => i.parentElement.classList.toggle('on', i.checked));
    m.querySelector('[data-ok]').onclick = async () => {
      const temas = [...m.querySelectorAll('.op-chip input:checked')].map(i => i.value);
      try { await B7.DB.clienteSegmentosDefinir(clienteId, temas); m.fechar(); B7.UI.toast('Segmentos salvos.'); invalidar(); await carregarBase(true); aoSalvar && aoSalvar(); }
      catch (e) { B7.UI.toast('Não foi possível salvar: ' + (e.message || 'erro')); }
    };
  }

  /* =================================================================
     LINHA EDITORIAL — oportunidades vinculadas (+ sugestões do mês)
     ================================================================= */
  async function secaoLinha(el, linha) {
    if (!el || !linha || !souEquipeInterna()) return;
    let b, vinc = [], sug = [];
    try {
      b = await carregarBase();
      vinc = await B7.DB.oportunidadeLinhas({ linha: linha.id });
      if (linha.mes && linha.ano && linha.client_id) {
        const ini = iso(linha.ano, linha.mes, 1), fim = iso(linha.ano, linha.mes, diasNoMes(linha.ano, linha.mes));
        const ja = new Set(vinc.map(v => v.oportunidade_id));
        sug = (await periodo(ini, fim, { cliente: linha.client_id })).filter(i => i.rel.nivel === 'muito' && !ja.has(i.op.id));
      }
    } catch (e) { el.innerHTML = ''; return; }
    if (!document.body.contains(el)) return;
    if (!vinc.length && !sug.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<section class="op-linha"><h4>' + IC + 'Oportunidades' + (vinc.length ? ' <span>' + vinc.length + '</span>' : '') + '</h4>' +
      (vinc.length ? '<ul class="op-linha-l">' + vinc.map(v => {
        const op = b.todas.get(v.oportunidade_id); if (!op) return '';
        const d = v.data_ocorrencia ? D().local(v.data_ocorrencia) : null;
        return '<li><button class="op-linha-it" data-op="' + esc(op.id) + '" data-dia="' + esc(v.data_ocorrencia || '') + '">' + (d ? '<b>' + d.getDate() + ' ' + MESES[d.getMonth()] + '</b>' : '') + esc(op.nome) +
          (v.observacao ? '<small>' + esc(v.observacao) + '</small>' : '') + '</button>' +
          (souGestor() ? '<button class="cb-link" data-desv="' + esc(op.id) + '" aria-label="Remover vínculo com ' + esc(op.nome) + '">Remover</button>' : '') + '</li>';
      }).join('') + '</ul>' : '') +
      (sug.length ? '<p class="op-linha-sug">Do segmento neste mês: ' + sug.slice(0, 5).map(i => '<button class="cb-link" data-op="' + esc(i.op.id) + '" data-dia="' + esc(i.ini) + '">' + esc(i.op.nome) + ' (' + D().local(i.ini).getDate() + '/' + pad(+i.ini.slice(5, 7)) + ')</button>').join(' · ') + '</p>' : '') +
    '</section>';
    const recarregar = () => secaoLinha(el, linha);
    el.querySelectorAll('[data-op]').forEach(x => x.onclick = () => folha(x.dataset.op, { dia: x.dataset.dia || null, cliente: linha.client_id, aoMudar: recarregar }));
    el.querySelectorAll('[data-desv]').forEach(x => x.onclick = async () => {
      try { await B7.DB.oportunidadeDesvincularLinha(x.dataset.desv, linha.id); B7.UI.toast('Vínculo removido. Nenhum conteúdo foi alterado.'); recarregar(); }
      catch (e) { B7.UI.toast('Não foi possível remover: ' + (e.message || 'erro')); }
    });
  }

  /* resumo discreto para o Painel da coordenação */
  async function resumoPainel(dias) {
    const hoje = D().hoje();
    const itens = await periodo(hoje, D().somarDias(hoje, (dias || 15) - 1));
    const rel = itens.filter(i => i.nivelMax === 'muito' || i.nivelMax === 'relacionada');
    return { total: rel.length, clientes: new Set(rel.flatMap(i => i.relacionados.filter(r => r.nivel === 'muito').map(r => r.cliente.id))).size, primeira: rel[0] || null };
  }

  return {
    CONF, NIVEL, NATUREZA, ABRANGENCIA, FONTES_ROT, IC,
    carregarBase, invalidar, ocorrencias, proxima, nth, relevancia, relacionados, periodo, filtrarItens,
    folha, modalUsarLinha, abrir, secaoCliente, secaoLinha, resumoPainel, modalSegmentos,
    _montar: montar, _definirBase: b => { B = b; baseEm = Date.now(); }
  };
})();
