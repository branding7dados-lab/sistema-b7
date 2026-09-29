/* =====================================================================
   PAINEL DO COORDENADOR DE MÍDIAS (fase 2 do Painel)

   Responde "o que depende de mim agora?" na operação editorial. Não é a
   Central B7 (visão ampla da agência, que continua intacta), nem outra
   Linha Editorial, outro calendário ou outro Kanban: resume, prioriza e
   leva para a tela canônica de cada coisa.

   Quem vê: B7.Perm.painelVisoes() inclui 'coordenacao' — Coordenador de
   mídias pelo papel principal, ou Administrador com a função extra
   "coordenador". Quem também é videomaker alterna a VISÃO no cabeçalho
   (?visao=video); a identidade e as permissões nunca mudam.

   ESCOPO: o sistema não tem "coordenador responsável" por cliente
   (clientes não tem dono; perfis não tem carteira). Então o Painel mostra
   a operação que a conta ALCANÇA (RLS da equipe = todos os clientes),
   recortada por data e status — nunca o histórico inteiro.

   Dados: nenhuma tabela nova. Seis leituras, cada uma carrega e falha
   sozinha (erro nunca vira "0"):
     • linhas    — B7.DB.listarTodasLinhas(60): a MESMA da tela Linhas;
     • conteudos — conteúdos com data de postagem do começo do mês (ou da
                   semana) até 13 dias à frente (mesma regra de
                   Publicações do Dia: só deleted_at);
     • pendentes — B7.DB.publicacoesPendentes(hoje, hoje-60, 50): a MESMA
                   consulta de "Pendentes de dias anteriores";
     • revisao   — Design em "Revisão interna" (listarDesign), conteúdos e
                   roteiros "Em revisão";
     • ajustes   — aprovações com "Ajustes solicitados" (versão atual),
                   a MESMA consulta de #/aprovacoes?situacao=ajustes;
     • agenda    — gravações da agenda (agenda_compromissos) + status dos
                   roteiros das gravações de hoje e amanhã.

   Regras canônicas vêm das telas donas delas: Linha →
   B7.Conteudo.REGRAS_LINHA; status de conteúdo → STATUS_CONTEUDO.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.PainelCoord = (function () {
  const U = () => B7.Painel.ui;
  const D = () => B7.Painel.ui.datas;
  const esc = s => B7.UI.esc(s);
  const painel = () => document.getElementById('painel-dashboard');

  /* ------------------------------------------------------------ regras */
  const NAO_PRONTO = ['Ideia', 'Em criação', 'Em revisão'];    /* ainda antes de "Aprovado" */
  const PRONTO = ['Aprovado', 'Programado'];                    /* pronto para sair */
  const ROTEIRO_NAO_PRONTO = ['Em criação', 'Em revisão'];      /* B7.UI REVISAO: antes de aprovado/pronto */
  const JANELA_PROXIMAS = 7;       /* KPI: hoje + 6 dias */
  const JANELA_LISTA = 14;         /* lista "Próximas publicações" */
  const MAX_LINHAS = 5;
  const regrasLinha = () => (B7.Conteudo && B7.Conteudo.REGRAS_LINHA) || {
    andamento: { teste: l => l.status !== 'Finalizada' },
    planejamento: { teste: () => false },
    revisao: { teste: l => l.status === 'Em revisão' }
  };
  const nomeLinha = l => l.nome || ((B7.UI.MESES[(l.mes || 1) - 1] || '') + ' ' + (l.ano || ''));
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

  const IC_POST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 12.5h8M8 16h5"/></svg>';
  const IC_LINHA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5h14M5 9.5h14M5 14.5h9M5 19.5h6"/></svg>';
  const IC_REVISAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>';
  const IC_MAIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

  /* ------------------------------------------------------------ estado */
  const S = { linhas: null, conteudos: null, pendentes: null, revisao: null, ajustes: null, agenda: null };
  const FONTES = Object.keys(S);
  let geracao = 0;

  function intervaloConteudos() {
    const h = D().hoje();
    const iniMes = h.slice(0, 8) + '01';
    const seg = D().segundaDe(h);
    const [a, m] = h.split('-').map(Number);
    const fimMes = h.slice(0, 8) + String(new Date(a, m, 0).getDate()).padStart(2, '0');
    const ate = D().somarDias(h, JANELA_LISTA - 1);
    return { de: iniMes < seg ? iniMes : seg, ate: fimMes > ate ? fimMes : ate };
  }

  function consulta(fonte) {
    const h = D().hoje();
    if (fonte === 'linhas') return B7.DB.listarTodasLinhas(60);
    if (fonte === 'conteudos') { const r = intervaloConteudos(); return B7.DB.painelCoordConteudos(r.de, r.ate); }
    if (fonte === 'pendentes') return B7.DB.publicacoesPendentes(h, D().somarDias(h, -60), 50);
    if (fonte === 'ajustes') return B7.DB.painelAprovacoes({ situacao: ['ajustes'], somenteAtual: true, limite: 200 });
    if (fonte === 'revisao') {
      return Promise.all([
        B7.DB.listarDesign({ status: 'revisao_interna' }),
        B7.DB.painelCoordConteudosEmRevisao(),
        B7.DB.painelCoordRoteirosEmRevisao()
      ]).then(([design, conteudos, roteiros]) => ({ design: design || [], conteudos: conteudos || [], roteiros: roteiros || [] }));
    }
    /* agenda: gravações da segunda desta semana até 15 dias à frente; e,
       numa segunda consulta só, os roteiros das gravações de hoje/amanhã */
    const de = D().local(D().segundaDe(h)), ate = D().local(D().somarDias(h, 15));
    return B7.DB.painelGravacoes(de.toISOString(), ate.toISOString()).then(async grav => {
      grav = grav || [];
      const perto = [h, D().somarDias(h, 1)];
      const ids = [...new Set(grav.filter(g => g.gravacao_id && perto.includes(D().diaDoTs(g.inicio))).map(g => g.gravacao_id))];
      const roteiros = ids.length ? (await B7.DB.painelCoordRoteirosDasGravacoes(ids)) || [] : [];
      return { gravacoes: grav, roteiros };
    });
  }

  function carregar(fonte) {
    const g = geracao;
    S[fonte] = { estado: 'carregando' };
    pintar();
    U().comTempoLimite(consulta(fonte), 15000)
      .then(dados => { if (g === geracao) { S[fonte] = { estado: 'ok', dados: dados || [] }; pintar(); } })
      .catch(e => { if (g === geracao) { S[fonte] = { estado: 'erro', erro: (e && e.message) || '' }; pintar(); } });
  }

  const ok = f => S[f] && S[f].estado === 'ok';
  function estadoDe(...fontes) {
    if (fontes.some(f => S[f] && S[f].estado === 'erro')) return 'erro';
    if (fontes.some(f => !S[f] || S[f].estado === 'carregando')) return 'carregando';
    return 'ok';
  }
  const dados = f => ok(f) ? S[f].dados : null;
  const conteudos = () => dados('conteudos') || [];
  const linhas = () => dados('linhas') || [];
  const agenda = () => dados('agenda') || { gravacoes: [], roteiros: [] };
  const revisao = () => dados('revisao') || { design: [], conteudos: [], roteiros: [] };

  /* ------------------------------------------------------------ helpers */
  const cliNome = c => (c.clientes && c.clientes.nome) || c.cliente_nome || '';
  const cliLogo = c => (c.clientes && c.clientes.logo_url) || c.cliente_logo_url || '';
  function cli(c) {
    const nome = cliNome(c);
    return nome ? U().logoMini({ cliente_nome: nome, cliente_logo_url: cliLogo(c) }) + '<span>' + esc(nome) + '</span>' : '';
  }
  const hrefConteudo = c => c.linha_id ? '#/linha/' + c.linha_id + '?conteudo=' + c.id : '#/publicacoes/' + String(c.data_postagem).slice(0, 10);
  const doDia = iso => conteudos().filter(c => String(c.data_postagem).slice(0, 10) === iso);
  const contaStatus = lista => {
    const m = {}; lista.forEach(c => { m[c.status] = (m[c.status] || 0) + 1; });
    const nome = { 'Ideia': 'em ideia', 'Em criação': 'em criação', 'Em revisão': 'em revisão' };
    return NAO_PRONTO.filter(s => m[s]).map(s => m[s] + ' ' + nome[s]).join(' · ');
  };

  /* =================================================================
     "PRECISA DA SUA ATENÇÃO" — grupos derivados, em ordem de prioridade
     Cada grupo com 1 item vira a linha do próprio item; com vários, vira
     uma linha-resumo que abre a tela canônica já filtrada (quando ela
     existe). risco:true conta no KPI "Precisam de atenção"; revisao:true
     conta no KPI "Revisões pendentes".
     ================================================================= */
  function grupos() {
    const IC = U().IC, d = D(), h = d.hoje(), amanha = d.somarDias(h, 1);
    const out = [];
    const add = g => { if (g && g.n) out.push(g); };

    /* 1. publicações atrasadas — mesma lista de "Pendentes de dias anteriores" */
    if (ok('pendentes')) {
      const p = S.pendentes.dados;
      const maisAntiga = p.reduce((m, c) => (!m || c.data_postagem < m ? c.data_postagem : m), null);
      add({ risco: true, n: p.length, rotulo: plural(p.length, 'publicação atrasada', 'publicações atrasadas'),
        linha: p.length === 1
          ? { tom: 'erro', icone: IC.alerta, tag: 'Publicação atrasada', titulo: p[0].titulo || 'Sem título',
              meta: cli(p[0]) + '<span>era para ' + d.ddmm(String(p[0].data_postagem)) + '</span><span>' + esc(p[0].status) + '</span>', href: hrefConteudo(p[0]) }
          : { tom: 'erro', icone: IC.alerta, tag: 'Publicações atrasadas',
              titulo: (p.length >= 50 ? '50+' : p.length) + ' publicações com a data vencida',
              meta: '<span>ainda sem “Publicado”</span>' + (maisAntiga ? '<span>desde ' + d.ddmm(String(maisAntiga)) + '</span>' : ''),
              href: '#/publicacoes' } });
    }

    /* 2. planejamento atrasado — linha ainda "Em criação" com o período
          começado ou começando em até 7 dias */
    if (ok('linhas')) {
      const ls = linhas().filter(regrasLinha().planejamento.teste)
        .sort((a, b) => String(B7.Conteudo.inicioLinha(a)).localeCompare(String(B7.Conteudo.inicioLinha(b))));
      const quando = l => { const ini = B7.Conteudo.inicioLinha(l); return ini <= h ? 'começou em ' + d.ddmm(ini) : 'começa ' + d.quandoDia(ini); };
      const comecou = ls.some(l => B7.Conteudo.inicioLinha(l) <= h);
      add({ risco: true, n: ls.length, rotulo: plural(ls.length, 'linha ainda em criação', 'linhas ainda em criação'),
        linha: ls.length === 1
          ? { tom: comecou ? 'erro' : 'ambar', icone: IC_LINHA, tag: 'Linha editorial ainda em criação',
              titulo: (ls[0].cliente_nome ? ls[0].cliente_nome + ' · ' : '') + nomeLinha(ls[0]),
              meta: '<span>' + esc(quando(ls[0])) + '</span>', href: '#/linha/' + ls[0].id }
          : { tom: comecou ? 'erro' : 'ambar', icone: IC_LINHA, tag: 'Planejamento atrasado',
              titulo: ls.length + ' linhas editoriais ainda em criação',
              meta: '<span>' + esc(ls.slice(0, 3).map(l => l.cliente_nome || nomeLinha(l)).join(', ') + (ls.length > 3 ? '…' : '')) + '</span>',
              href: '#/linhas?status=planejamento' } });
    }

    /* 3. ajustes pedidos pelo cliente — "Corrigir e reenviar" */
    if (ok('ajustes')) {
      const a = S.ajustes.dados;
      add({ risco: true, n: a.length, rotulo: plural(a.length, 'ajuste pedido pelo cliente', 'ajustes pedidos pelo cliente'),
        linha: a.length === 1
          ? { tom: 'ambar', icone: IC.refazer, tag: 'Ajustes pedidos pelo cliente', titulo: a[0].titulo || 'Material',
              meta: cli(a[0]) + (a[0].decidido_em ? '<span>pedido ' + esc(d.quandoDia(d.diaDoTs(a[0].decidido_em))) + '</span>' : ''),
              href: '#/aprovacoes/' + a[0].id }
          : { tom: 'ambar', icone: IC.refazer, tag: 'Ajustes pedidos pelo cliente', titulo: a.length + ' materiais para corrigir e reenviar',
              meta: '<span>' + esc([...new Set(a.map(x => x.cliente_nome).filter(Boolean))].slice(0, 3).join(', ')) + '</span>',
              href: '#/aprovacoes?situacao=ajustes' } });
    }

    /* 4 e 6. publicações de hoje / amanhã que ainda não estão prontas */
    const naoProntas = (iso, tom, icone, quandoTx) => {
      if (!ok('conteudos')) return null;
      const l = doDia(iso).filter(c => NAO_PRONTO.includes(c.status));
      return { risco: true, n: l.length, rotulo: plural(l.length, 'publicação ' + quandoTx + ' não pronta', 'publicações ' + quandoTx + ' não prontas'),
        linha: l.length === 1
          ? { tom, icone, tag: 'Publicação ' + quandoTx + ' ainda não pronta', titulo: l[0].titulo || 'Sem título',
              meta: cli(l[0]) + '<span>' + esc(l[0].status) + '</span>', href: hrefConteudo(l[0]) }
          : { tom, icone, tag: 'Publicações ' + quandoTx + ' ainda não prontas', titulo: l.length + ' publicações antes de “Aprovado”',
              meta: '<span>' + esc(contaStatus(l)) + '</span>', href: '#/publicacoes/' + iso } };
    };
    /* 5 e 7. gravação de hoje / amanhã com roteiro ainda em criação */
    const gravacoesRisco = (iso, quandoTx, tom) => {
      if (!ok('agenda')) return [];
      const ag = agenda(), agora = Date.now();
      return ag.gravacoes.filter(g => g.gravacao_id && d.diaDoTs(g.inicio) === iso && new Date(g.inicio).getTime() >= agora - 3600000)
        .filter((g, i, arr) => arr.findIndex(x => x.gravacao_id === g.gravacao_id) === i)
        .map(g => {
          const rs = ag.roteiros.filter(r => r.recording_session_id === g.gravacao_id);
          const pend = rs.filter(r => ROTEIRO_NAO_PRONTO.includes(r.status)).length;
          if (rs.length && !pend) return null;
          return { risco: true, n: 1, rotulo: 'gravação ' + quandoTx + ' sem preparação completa',
            linha: { tom, icone: U().IC.camera, tag: 'Gravação ' + quandoTx + (g.dia_inteiro ? '' : ' · ' + d.hora(g.inicio)),
              titulo: g.titulo || 'Gravação',
              meta: (g.cliente_nome ? '<span>' + esc(g.cliente_nome) + '</span>' : '') +
                '<span>' + (rs.length ? plural(pend, 'roteiro ainda em criação', 'roteiros ainda em criação') : 'nenhum roteiro na gravação') + '</span>',
              href: '#/gravacao/' + g.gravacao_id } };
        }).filter(Boolean);
    };

    add(naoProntas(h, 'ambar', IC.relogio, 'de hoje'));
    gravacoesRisco(h, 'hoje', 'acento').forEach(add);
    add(naoProntas(amanha, 'neutro', IC.agenda, 'de amanhã'));
    gravacoesRisco(amanha, 'amanhã', 'neutro').forEach(add);

    /* 8+. revisões que esperam a coordenação */
    if (ok('linhas')) {
      const lr = linhas().filter(regrasLinha().revisao.teste);
      add({ revisao: true, n: lr.length, rotulo: plural(lr.length, 'linha em revisão', 'linhas em revisão'),
        linha: lr.length === 1
          ? { tom: 'neutro', icone: IC_REVISAR, tag: 'Linha editorial em revisão', titulo: (lr[0].cliente_nome ? lr[0].cliente_nome + ' · ' : '') + nomeLinha(lr[0]),
              meta: '', href: '#/linha/' + lr[0].id }
          : { tom: 'neutro', icone: IC_REVISAR, tag: 'Linhas editoriais em revisão', titulo: lr.length + ' linhas esperando revisão',
              meta: '', href: '#/linhas?status=revisao' } });
    }
    if (ok('revisao')) {
      const r = revisao();
      /* roteiros e conteúdos não têm lista canônica filtrada por status:
         a linha-resumo abre o mais antigo/mais próximo, e diz qual é */
      const rr = r.roteiros;
      const hrefRot = x => '#/gravacao/' + x.recording_session_id + '?roteiro=' + x.id;
      const gravCli = x => x.gravacoes && x.gravacoes.clientes ? x.gravacoes.clientes : null;
      add({ revisao: true, n: rr.length, rotulo: plural(rr.length, 'roteiro em revisão', 'roteiros em revisão'),
        linha: rr.length ? { tom: 'neutro', icone: IC_REVISAR, tag: rr.length === 1 ? 'Roteiro aguardando revisão' : rr.length + ' roteiros aguardando revisão',
          titulo: rr[0].titulo || 'Roteiro sem título',
          meta: (gravCli(rr[0]) ? cli({ clientes: gravCli(rr[0]) }) : '') + (rr.length > 1 ? '<span>o mais antigo</span>' : ''),
          href: hrefRot(rr[0]) } : null });
      const cr = r.conteudos;
      add({ revisao: true, n: cr.length, rotulo: plural(cr.length, 'conteúdo em revisão', 'conteúdos em revisão'),
        linha: cr.length ? { tom: 'neutro', icone: IC_REVISAR, tag: cr.length === 1 ? 'Conteúdo aguardando revisão' : cr.length + ' conteúdos aguardando revisão',
          titulo: cr[0].titulo || 'Sem título',
          meta: cli(cr[0]) + (cr[0].data_postagem ? '<span>postagem ' + d.ddmm(String(cr[0].data_postagem)) + '</span>' : '') +
                (cr.length > 1 ? '<span>o mais próximo</span>' : ''),
          href: hrefConteudo(cr[0]) } : null });
      const ds = r.design;
      add({ revisao: true, n: ds.length, rotulo: plural(ds.length, 'arte em revisão interna', 'artes em revisão interna'),
        linha: ds.length === 1
          ? { tom: 'neutro', icone: IC_REVISAR, tag: 'Arte aguardando revisão interna', titulo: ds[0].titulo || ds[0].conteudo_titulo || 'Peça',
              meta: cli(ds[0]), href: '#/design/' + ds[0].id }
          : { tom: 'neutro', icone: IC_REVISAR, tag: 'Design · revisão interna', titulo: ds.length + ' artes esperando sua revisão',
              meta: '<span>' + esc([...new Set(ds.map(x => x.cliente_nome).filter(Boolean))].slice(0, 3).join(', ')) + '</span>',
              href: '#/design?aba=revisao&limpar=1' } });
    }
    return out;
  }

  /* =================================================================
     PINTURA
     ================================================================= */
  function pintarKpis() {
    const cx = document.getElementById('pnc-kpis'); if (!cx) return;
    const kpi = U().kpi, d = D(), h = d.hoje();

    /* 1. linhas em andamento */
    const la = linhas().filter(regrasLinha().andamento.teste);
    const porSt = s => la.filter(l => l.status === s).length;
    const subL = [porSt('Em criação') && porSt('Em criação') + ' em criação', porSt('Em revisão') && porSt('Em revisão') + ' em revisão',
                  porSt('Aprovada') && plural(porSt('Aprovada'), 'aprovada', 'aprovadas')].filter(Boolean).join(' · ');

    /* 2 e 4. atenção (riscos) e revisões — dos mesmos grupos da lista */
    const eRisco = estadoDe('pendentes', 'linhas', 'ajustes', 'conteudos', 'agenda');
    const eRev = estadoDe('linhas', 'revisao');
    const gs = grupos();
    const riscos = gs.filter(g => g.risco), revs = gs.filter(g => g.revisao);
    const nRisco = riscos.reduce((s, g) => s + g.n, 0), nRev = revs.reduce((s, g) => s + g.n, 0);
    const pendCheio = ok('pendentes') && S.pendentes.dados.length >= 50;
    const soUm = revs.length === 1 ? revs[0] : null;
    /* só vira link quando existe UM destino que mostra exatamente esse
       número: a lista filtrada (Design/Linhas) ou o próprio item */
    const hrefRev = soUm && soUm.linha && (soUm.n === 1 || /^#\/(design\?|linhas\?)/.test(soUm.linha.href)) ? soUm.linha.href : null;

    /* 3. próximas publicações — hoje + 6 dias, ainda não publicadas */
    const ate = d.somarDias(h, JANELA_PROXIMAS - 1);
    const prox = conteudos().filter(c => { const x = String(c.data_postagem).slice(0, 10); return x >= h && x <= ate && c.status !== 'Publicado'; });
    const prontas = prox.filter(c => PRONTO.includes(c.status)).length;

    cx.innerHTML =
      kpi({ estado: estadoDe('linhas'), rotulo: 'Linhas editoriais em andamento', valor: la.length,
            sub: subL || 'nenhuma em andamento', href: la.length ? '#/linhas?status=andamento' : null,
            aria: la.length + ' linhas editoriais em andamento — abrir a lista' }) +
      kpi({ estado: eRisco, rotulo: 'Precisam de atenção', valor: nRisco + (pendCheio ? '+' : ''), tom: nRisco ? 'erro' : '',
            sub: nRisco ? riscos.slice(0, 2).map(g => g.rotulo).join(' · ') : 'nada em risco agora' }) +
      kpi({ estado: estadoDe('conteudos'), rotulo: 'Próximas publicações', valor: prox.length,
            sub: prox.length ? 'próximos 7 dias · ' + prontas + (prontas === 1 ? ' pronta' : ' prontas') : 'nada nos próximos 7 dias',
            href: '#/publicacoes', aria: prox.length + ' publicações nos próximos 7 dias — abrir Publicações do Dia' }) +
      kpi({ estado: eRev, rotulo: 'Revisões pendentes', valor: nRev, tom: nRev ? 'ambar' : '',
            sub: nRev ? revs.map(g => g.rotulo).join(' · ') : 'nenhuma revisão esperando', href: hrefRev,
            aria: nRev + ' revisões internas pendentes' });

    /* "Precisam de atenção" não tem uma tela canônica única: o card leva
       à lista logo abaixo (útil no celular, onde ela fica fora da tela) */
    const cards = cx.querySelectorAll('.pn-kpi');
    const c2 = cards[1];
    if (c2 && eRisco === 'ok' && nRisco) {
      c2.classList.remove('estatico'); c2.classList.add('pn-kpi-rolar');
      c2.setAttribute('role', 'button'); c2.setAttribute('tabindex', '0');
      c2.setAttribute('aria-label', nRisco + ' itens precisam de atenção — ir para a lista');
      const ir = () => { const alvo = document.getElementById('pnc-atencao'); if (alvo) { alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const t = document.getElementById('pnc-t-atencao'); if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); } } };
      c2.onclick = ir;
      c2.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(); } };
    }
  }

  function pintarAtencao() {
    const cx = document.getElementById('pnc-atencao'); if (!cx) return;
    const fontes = ['pendentes', 'linhas', 'ajustes', 'conteudos', 'agenda', 'revisao'];
    const carregando = fontes.filter(f => !S[f] || S[f].estado === 'carregando');
    const comErro = fontes.filter(f => S[f] && S[f].estado === 'erro');
    let corpo;
    /* espera o bloco inteiro: a prioridade só faz sentido com tudo na mesa */
    if (carregando.length) corpo = U().blocoCarregando(4);
    else if (comErro.length === fontes.length) corpo = U().blocoErro('Não foi possível carregar o que precisa da sua atenção.', comErro);
    else {
      const gs = grupos();
      const vis = gs.slice(0, MAX_LINHAS), fora = gs.slice(MAX_LINHAS);
      corpo = gs.length
        ? '<div class="pn-att-lista">' + vis.map(g => U().linhaAtencao(g.linha)).join('') + '</div>' +
          (fora.length ? '<p class="pn-nota">E mais: ' + esc(fora.map(g => g.rotulo).join(' · ')) + '.</p>' : '')
        : U().blocoVazio('Tudo em dia por aqui.', 'Nenhuma publicação atrasada, nenhum ajuste do cliente e nenhuma revisão esperando.');
      if (comErro.length) corpo += U().blocoErro('Parte das informações não carregou — a lista pode estar incompleta.', comErro);
    }
    cx.innerHTML = '<div class="pn-sec-cab"><h2 id="pnc-t-atencao">Precisa da sua atenção</h2></div>' + corpo;
  }

  function pintarSemana() {
    const cx = document.getElementById('pnc-semana'); if (!cx) return;
    const d = D(), h = d.hoje(), seg = d.segundaDe(h);
    const e = estadoDe('conteudos', 'agenda', 'linhas');
    let corpo;
    if (e === 'carregando') corpo = '<div class="esqueleto-tela pn-sk-semana">' + '<i class="esq"></i>'.repeat(5) + '</div>';
    else if (e === 'erro') corpo = U().blocoErro('Não foi possível montar a semana.', ['conteudos', 'agenda', 'linhas'].filter(f => S[f] && S[f].estado === 'erro'));
    else {
      const IC = U().IC;
      const dias = Array.from({ length: 7 }, (_, i) => {
        const iso = d.somarDias(seg, i), passado = iso < h;
        const pubs = doDia(iso);
        const atr = passado ? pubs.filter(c => c.status !== 'Publicado').length : 0;
        const nGrav = agenda().gravacoes.filter(g => d.diaDoTs(g.inicio) === iso).length;
        const nLin = linhas().filter(l => regrasLinha().andamento.teste(l) && B7.Conteudo.inicioLinha(l) === iso).length;
        return { iso, hoje: iso === h, passado, alerta: atr > 0, href: '#/publicacoes/' + iso, itens: [
          { cls: 'pn-dia-atraso', ic: IC.alerta, n: atr, um: 'atrasada', varios: 'atrasadas' },
          { cls: 'pn-dia-prazo', ic: IC_POST, n: pubs.length - atr, um: passado ? 'publicada' : 'publicação', varios: passado ? 'publicadas' : 'publicações' },
          { cls: 'pn-dia-grav', ic: IC.camera, n: nGrav, um: 'gravação', varios: 'gravações' },
          { cls: 'pn-dia-linha', ic: IC_LINHA, n: nLin, um: 'início de linha', varios: 'inícios de linha' }
        ] };
      }).filter((x, i) => i < 5 || x.itens.some(y => y.n));
      const vazia = dias.every(x => !x.itens.some(y => y.n));
      corpo = '<ol class="pn-semana-lista">' + dias.map(U().diaSemana).join('') + '</ol>' +
        (vazia ? '<p class="pn-nota">Semana tranquila por enquanto.</p>' : '');
    }
    cx.innerHTML = '<div class="pn-sec-cab"><h2 id="pnc-t-semana">Minha semana</h2>' +
      '<span class="pn-sec-sub">' + d.ddmm(seg) + ' – ' + d.ddmm(d.somarDias(seg, 6)) + '</span></div>' + corpo;
  }

  /* Fluxo de conteúdos do mês: barras horizontais, uma por status
     canônico (na ordem do fluxo). Série única, barras neutras — a
     identidade de cada etapa vem do chip de status que o sistema já usa
     (B7.Linha.chipConteudo), não de uma paleta nova. */
  function pintarFluxo() {
    const cx = document.getElementById('pnc-fluxo'); if (!cx) return;
    const d = D(), h = d.hoje();
    const mesIdx = Number(h.slice(5, 7)) - 1;
    const e = estadoDe('conteudos');
    let corpo;
    if (e === 'carregando') corpo = '<div class="esqueleto-tela pnc-sk-fluxo">' + '<i class="esq"></i>'.repeat(6) + '</div>';
    else if (e === 'erro') corpo = U().blocoErro('Não foi possível carregar o fluxo de conteúdos.', ['conteudos']);
    else {
      const doMes = conteudos().filter(c => String(c.data_postagem).slice(0, 7) === h.slice(0, 7));
      const ordem = (B7.Conteudo && B7.Conteudo.STATUS_CONTEUDO) || ['Ideia', 'Em criação', 'Em revisão', 'Aprovado', 'Programado', 'Publicado'];
      const etapas = ordem.map(s => ({ s, itens: doMes.filter(c => c.status === s) }));
      const outros = doMes.filter(c => !ordem.includes(c.status));
      if (outros.length) etapas.push({ s: 'Outro status', itens: outros, outro: true });
      const max = Math.max(1, ...etapas.map(x => x.itens.length));
      const pub = doMes.filter(c => c.status === 'Publicado').length;
      const vencidos = doMes.filter(c => c.status !== 'Publicado' && String(c.data_postagem).slice(0, 10) < h).length;
      const chip = s => (B7.Linha && B7.Linha.chipConteudo) ? B7.Linha.chipConteudo(s) : '<span class="status-conteudo">' + esc(s) + '</span>';
      corpo = !doMes.length
        ? U().blocoVazio('Nenhum conteúdo com data neste mês.', 'Os conteúdos aparecem aqui quando ganham data de postagem na Linha Editorial.')
        : '<div class="pn-prod-corpo pnc-fluxo-corpo"><div class="pn-graf-resumo">' +
            '<div><b>' + doMes.length + '</b><span>conteúdos em ' + B7.UI.MESES[mesIdx].toLowerCase() + '</span></div>' +
            '<div><b>' + Math.round(pub / doMes.length * 100) + '%</b><span>já publicados</span></div>' +
            '<div><b>' + vencidos + '</b><span>com a data vencida</span></div>' +
          '</div>' +
          '<div class="pnc-fluxo" role="list" aria-label="Conteúdos do mês por etapa">' + etapas.map(x => {
            const n = x.itens.length;
            const venc = x.s === 'Publicado' ? 0 : x.itens.filter(c => String(c.data_postagem).slice(0, 10) < h).length;
            const pct = Math.round(n / doMes.length * 100);
            return '<div class="pnc-etapa' + (n ? '' : ' vazia') + '" role="listitem" tabindex="0" aria-label="' +
                esc(x.s + ': ' + plural(n, 'conteúdo', 'conteúdos') + (venc ? ', ' + venc + ' com a data vencida' : '')) + '">' +
              '<span class="pnc-etapa-rot">' + (x.outro ? '<span class="status-conteudo">Outro</span>' : chip(x.s)) + '</span>' +
              '<span class="pnc-etapa-trilho"><i style="width:' + (n ? Math.max(2, Math.round(n / max * 100)) : 0) + '%"></i></span>' +
              '<span class="pnc-etapa-n"><b>' + n + '</b>' +
                (venc ? '<small class="pnc-venc">' + U().IC.alerta + venc + ' vencid' + (venc === 1 ? 'o' : 'os') + '</small>' : '') + '</span>' +
              '<span class="pn-graf-tip" role="tooltip">' + plural(n, 'conteúdo', 'conteúdos') + ' · ' + pct + '%<small>' +
                (venc ? venc + ' com a data de postagem já passada' : 'em ' + esc(x.s.toLowerCase())) + '</small></span>' +
            '</div>';
          }).join('') + '</div></div>';
    }
    cx.innerHTML = U().cabecalhoSecao('pnc-t-fluxo', 'Fluxo de conteúdos', { href: '#/publicacoes', rotulo: 'Publicações do dia' })
      .replace('</h2>', '</h2><span class="pn-sec-sub">' + esc(B7.UI.MESES[mesIdx].toLowerCase() + ' · por data de postagem') + '</span>') + corpo;
  }

  function pintarPublicacoes() {
    const cx = document.getElementById('pnc-publicacoes'); if (!cx) return;
    const d = D(), h = d.hoje(), ate = d.somarDias(h, JANELA_LISTA - 1);
    const e = estadoDe('conteudos');
    let corpo;
    if (e === 'carregando') corpo = U().blocoCarregando(4);
    else if (e === 'erro') corpo = U().blocoErro('Não foi possível carregar as próximas publicações.', ['conteudos']);
    else {
      const lista = conteudos().filter(c => { const x = String(c.data_postagem).slice(0, 10); return x >= h && x <= ate && c.status !== 'Publicado'; })
        .sort((a, b) => String(a.data_postagem).localeCompare(String(b.data_postagem)) ||
          cliNome(a).localeCompare(cliNome(b), 'pt-BR') || (a.position || 0) - (b.position || 0));
      const chip = s => (B7.Linha && B7.Linha.chipConteudo) ? B7.Linha.chipConteudo(s) : '<span class="status-conteudo">' + esc(s) + '</span>';
      corpo = lista.length
        ? '<div class="cp-agenda-lista">' + lista.slice(0, 5).map(c => {
            const dia = String(c.data_postagem).slice(0, 10);
            return '<a class="cp-ag-item pn-comp pnc-pub" href="' + esc(hrefConteudo(c)) + '">' +
              '<span class="cp-ag-data"><span class="dow">' + d.DOW[d.local(dia).getDay()] + '</span><span class="dt">' + d.ddmm(dia) + '</span></span>' +
              '<span class="cp-ag-tx"><b>' + esc(c.titulo || 'Sem título') + '</b>' +
                '<span class="cp-ag-meta pn-att-meta">' + cli(c) + (c.tipo ? '<span>' + esc(c.tipo) + '</span>' : '') + '</span></span>' +
              chip(c.status) + '</a>';
          }).join('') + '</div>' +
          (lista.length > 5 ? '<a class="pn-mais" href="#/publicacoes">+' + (lista.length - 5) + ' nos próximos ' + JANELA_LISTA + ' dias' + U().IC.seta + '</a>' : '')
        : U().blocoVazio('Nenhuma publicação próxima.', 'Nada com data de postagem nos próximos ' + JANELA_LISTA + ' dias.');
    }
    cx.innerHTML = U().cabecalhoSecao('pnc-t-pub', 'Próximas publicações', { href: '#/publicacoes', rotulo: 'Ver calendário' }) + corpo;
  }

  function pintar() {
    if (!document.getElementById('pnc-raiz')) return;
    pintarKpis(); pintarAtencao(); pintarSemana(); pintarFluxo(); pintarPublicacoes();
    painel().querySelectorAll('#pnc-raiz img.pn-logo').forEach(img => {
      img.onerror = () => { const s = document.createElement('span'); s.className = 'pn-logo pn-logo-vazia'; s.textContent = img.dataset.ini || ''; img.replaceWith(s); };
    });
    painel().querySelectorAll('#pnc-raiz [data-pn-retentar]').forEach(b => {
      b.onclick = () => b.dataset.pnRetentar.split(',').filter(Boolean).forEach(carregar);
    });
  }

  /* ------------------------------------------------------------ abrir */
  function abrir(o) {
    geracao++;
    B7.Dashboard.marcarNav('#/painel');
    B7.Rota.titulo(['Painel']);
    const podeCriarLinha = !!(B7.Conteudo && B7.Conteudo.novaLinha) && B7.Perm.podeRota('linhas') &&
      !(B7.Conteudo.souDesignerSomenteLeitura && B7.Conteudo.souDesignerSomenteLeitura());
    painel().innerHTML = '<div class="conteudo entra pn pnc" id="pnc-raiz">' +
      U().cabecalho({ visoes: (o && o.visoes) || ['coordenacao'], visao: 'coordenacao',
        acao: podeCriarLinha ? '<button type="button" class="b pri pn-cab-acao" id="pnc-nova-linha">' + IC_MAIS + '<span>Nova linha editorial</span></button>' : '' }) +
      '<section class="pn-kpis" id="pnc-kpis" aria-label="Indicadores"></section>' +
      '<div class="pn-grade pnc-grade">' +
        '<section class="pn-bloco pn-atencao" id="pnc-atencao" aria-labelledby="pnc-t-atencao"></section>' +
        '<section class="pn-bloco" id="pnc-semana" aria-labelledby="pnc-t-semana"></section>' +
        '<section class="pn-bloco" id="pnc-publicacoes" aria-labelledby="pnc-t-pub"></section>' +
        '<section class="pn-bloco" id="pnc-fluxo" aria-labelledby="pnc-t-fluxo"></section>' +
      '</div>' +
    '</div>';
    const b = document.getElementById('pnc-nova-linha');
    if (b) b.onclick = () => B7.Conteudo.novaLinha();
    FONTES.forEach(carregar);
  }

  return { abrir };
})();
