/* =====================================================================
   TOUR, DICAS E PRIMEIROS PASSOS (zzz213)

   B7.Tour — três ajudas que aparecem na própria tela:
     · TOUR GUIADO: um holofote em cada parte da tela, com um balão que
       explica e os botões Voltar / Próximo / Pular. O de boas-vindas
       muda conforme a função da pessoa e roda uma vez, sozinho, depois
       do primeiro acesso (dá para refazer pela Ajuda).
     · DICA NA PRIMEIRA VISITA: a primeira vez que a pessoa abre uma tela
       que tem tutorial, um cartão discreto no canto conta para que ela
       serve, com "Ver tutorial". Some e não volta; dá para desligar.
     · PRIMEIROS PASSOS: uma lista que se marca sozinha conforme a pessoa
       usa o sistema (abriu a tela X, usou a busca, abriu o sino…). Fica
       no início da Ajuda.
   Tudo é guardado neste aparelho, por pessoa (B7.pref). Nada vai para o
   banco e nada aqui muda dado da agência.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Tour = (function () {
  const esc = s => (B7.UI && B7.UI.esc ? B7.UI.esc(s) : String(s));
  const usuario = () => (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) || null;
  const chave = () => 'tour_' + ((usuario() || {}).id || 'anon');
  const est = () => { let e = null; try { e = B7.pref && B7.pref.ler(chave(), null); } catch (x) {} e = e || {}; e.telas = e.telas || {}; e.passos = e.passos || {}; return e; };
  const salvar = e => { try { if (B7.pref) B7.pref.gravar(chave(), e); } catch (x) {} };
  const visivel = el => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  const achar = alvos => { for (const s of [].concat(alvos || [])) { let el = null; try { el = document.querySelector(s); } catch (x) {} if (visivel(el)) return el; } return null; };
  const reduz = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.classList.contains('sem-animacao');
  const funcao = () => {
    const f = B7.Auth && B7.Auth.funcao && B7.Auth.funcao(), p = B7.Auth && B7.Auth.papel && B7.Auth.papel();
    return ['designer', 'videomaker', 'coordenador'].includes(f) ? f : (p === 'admin' ? 'admin' : (['designer', 'videomaker', 'coordenador'].includes(p) ? p : 'coordenador'));
  };
  const ehAdmin = () => !!(B7.Auth && (B7.Auth.ehAdminReal ? B7.Auth.ehAdminReal() : B7.Auth.ehAdmin && B7.Auth.ehAdmin()));
  const podeUsar = () => {
    const u = usuario(), p = B7.Auth && B7.Auth.papel && B7.Auth.papel();
    if (!u || p === 'cliente') return false;
    if (B7.Auth.naContaDeOutro && B7.Auth.naContaDeOutro()) return false;
    if (document.body.classList.contains('em-manutencao')) return false;
    return true;
  };
  const nav = rota => ['.lateral a[data-ir="#/' + rota + '"]', '.lateral a[href="#/' + rota + '"]', '#nav-' + rota, '#nav-inferior a[href="#/' + rota + '"]'];

  /* ================================================================ MOTOR */
  let atual = null;
  function fechar(concluiu) {
    if (!atual) return;
    const a = atual; atual = null;
    window.removeEventListener('resize', a.reposicionar); window.removeEventListener('scroll', a.reposicionar, true);
    document.removeEventListener('keydown', a.teclas, true);
    a.raiz.classList.add('saindo');
    setTimeout(() => a.raiz.remove(), reduz() ? 0 : 220);
    if (a.op.aoFim) { try { a.op.aoFim(!!concluiu); } catch (x) {} }
  }
  function rodar(passos, op) {
    fechar(false);
    const lista = (passos || []).filter(p => !p.alvo || achar(p.alvo));
    if (!lista.length) return false;
    const raiz = document.createElement('div');
    raiz.className = 'tr-raiz'; raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-modal', 'true'); raiz.setAttribute('aria-label', (op && op.nome) || 'Tour');
    raiz.innerHTML = '<div class="tr-bloqueio"></div><div class="tr-foco" aria-hidden="true"></div><div class="tr-balao" tabindex="-1"></div>';
    document.body.appendChild(raiz);
    atual = { lista, i: 0, op: op || {}, raiz };
    let pend = 0;
    atual.reposicionar = () => { if (pend) return; pend = requestAnimationFrame(() => { pend = 0; posicionar(); }); };
    atual.teclas = ev => {
      if (!atual) return;
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fechar(false); }
      else if (ev.key === 'ArrowRight' || ev.key === 'Enter') { ev.preventDefault(); ir(1); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); ir(-1); }
    };
    window.addEventListener('resize', atual.reposicionar); window.addEventListener('scroll', atual.reposicionar, true);
    document.addEventListener('keydown', atual.teclas, true);
    mostrar();
    return true;
  }
  function ir(d) {
    if (!atual) return;
    const n = atual.i + d;
    if (n < 0) return;
    if (n >= atual.lista.length) return fechar(true);
    atual.i = n; mostrar();
  }
  function mostrar() {
    const a = atual, p = a.lista[a.i], ult = a.i === a.lista.length - 1, n = a.lista.length;
    const b = a.raiz.querySelector('.tr-balao');
    b.innerHTML = (p.icone ? '<span class="tr-ic" aria-hidden="true">' + p.icone + '</span>' : '') +
      '<div class="tr-tx"><small>' + (n > 1 ? (a.i + 1) + ' de ' + n : esc(a.op.nome || 'Dica')) + '</small><b>' + esc(p.titulo) + '</b><p>' + esc(p.texto) + '</p></div>' +
      (n > 1 ? '<div class="tr-pontos" aria-hidden="true">' + a.lista.map((x, k) => '<i' + (k === a.i ? ' class="on"' : k < a.i ? ' class="ja"' : '') + '></i>').join('') + '</div>' : '') +
      '<div class="tr-bts">' + (ult ? '' : '<button type="button" class="tr-pular" data-tr="pular">Pular tour</button>') +
        (a.i > 0 ? '<button type="button" class="b contorno fina" data-tr="voltar">Voltar</button>' : '') +
        '<button type="button" class="b pri fina" data-tr="prox">' + esc(ult ? (p.botao || 'Concluir') : 'Próximo') + '</button></div>';
    b.querySelectorAll('[data-tr]').forEach(x => x.onclick = () => {
      const t = x.dataset.tr;
      if (t === 'pular') fechar(false); else if (t === 'voltar') ir(-1);
      else { if (ult && p.aoConcluir) { try { p.aoConcluir(); } catch (e) {} } ir(1); }
    });
    b.classList.remove('entra'); void b.offsetWidth; b.classList.add('entra');
    const el = p.alvo ? achar(p.alvo) : null;
    if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (x) {} }
    posicionar();
    try { b.querySelector('[data-tr="prox"]').focus({ preventScroll: true }); } catch (x) {}
  }
  function posicionar() {
    if (!atual) return;
    const a = atual, p = a.lista[a.i], el = p.alvo ? achar(p.alvo) : null;
    const foco = a.raiz.querySelector('.tr-foco'), b = a.raiz.querySelector('.tr-balao');
    const W = window.innerWidth, H = window.innerHeight, m = 14;
    const bw = Math.min(360, W - 24);
    b.style.width = bw + 'px';
    if (!el) {
      a.raiz.classList.add('sem-alvo');
      foco.style.cssText = 'left:' + (W / 2) + 'px;top:' + (H / 2) + 'px;width:0;height:0';
      b.style.left = Math.round((W - bw) / 2) + 'px'; b.style.top = Math.round(Math.max(16, (H - b.offsetHeight) / 2)) + 'px';
      return;
    }
    a.raiz.classList.remove('sem-alvo');
    const r = el.getBoundingClientRect(), pad = 6;
    foco.style.cssText = 'left:' + (r.left - pad) + 'px;top:' + (r.top - pad) + 'px;width:' + (r.width + pad * 2) + 'px;height:' + (r.height + pad * 2) + 'px';
    const bh = b.offsetHeight;
    let left, top;
    if (r.right + m + bw < W - 8 && r.width < W * 0.5 && r.height > H * 0.35) { left = r.right + m; top = r.top + Math.min(40, r.height / 4); }    /* alvo alto (menu): ao lado */
    else if (r.bottom + m + bh < H - 8) { top = r.bottom + m; left = r.left + r.width / 2 - bw / 2; }
    else if (r.top - m - bh > 8) { top = r.top - m - bh; left = r.left + r.width / 2 - bw / 2; }
    else { top = (H - bh) / 2; left = r.left > W / 2 ? r.left - m - bw : r.right + m; }
    b.style.left = Math.round(Math.max(12, Math.min(W - bw - 12, left))) + 'px';
    b.style.top = Math.round(Math.max(12, Math.min(H - bh - 12, top))) + 'px';
  }

  /* ======================================================== BOAS-VINDAS */
  const SV = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  const IC = {
    oi: SV('<path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6-4.6-1.9 4.6-1.9z"/>'),
    menu: SV('<path d="M4 6h16M4 12h16M4 18h10"/>'),
    tela: SV('<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M3.5 9h17"/>'),
    busca: SV('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'),
    mais: SV('<path d="M12 5v14M5 12h14"/>'),
    sino: SV('<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>'),
    chat: SV('<path d="M4.5 6.5A2.5 2.5 0 017 4h10a2.5 2.5 0 012.5 2.5v7A2.5 2.5 0 0117 16h-5.2L8 19.4V16H7a2.5 2.5 0 01-2.5-2.5z"/>'),
    ajuda: SV('<circle cx="12" cy="12" r="8.6"/><path d="M9.6 9.4a2.5 2.5 0 014.8.9c0 1.7-2.4 2.2-2.4 3.7M12 17.2v.1"/>'),
    conta: SV('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.7-3.7 3.5-5.5 7-5.5s6.3 1.8 7 5.5"/>'),
    ok: SV('<circle cx="12" cy="12" r="8.6"/><path d="M8 12.5l2.8 2.8L16.3 9.6"/>')
  };
  const TELAS = {
    designer: [['design', 'Design', 'As suas peças: o que fazer, o que está em revisão e o que o cliente pediu de ajuste. Comece o dia por aqui.']],
    videomaker: [['video', 'Edição de vídeo', 'As suas demandas de edição, por cliente e por mês, com prazo e situação.'],
      ['gravacoes', 'Gravações', 'As gravações marcadas, com roteiro, local e horário.']],
    coordenador: [['linhas', 'Linhas editoriais', 'O planejamento de cada cliente no mês: pilares, conteúdos e datas.'],
      ['calendario', 'Calendário', 'Tudo que vai ao ar e todas as gravações, num calendário só.']],
    admin: [['panorama', 'Panorama', 'A agência inteira no mês: cada cliente, o que andou e o que está atrasado.'],
      ['config', 'Configurações', 'Contas, aparência, recursos, manutenção e as telas do administrador.']]
  };
  /* zzz215: o administrador tem um tour próprio, da administração */
  function passosAdmin(nome) {
    return [
      { icone: IC.oi, titulo: 'Olá' + (nome ? ', ' + nome : '') + '! Este é o tour da administração', texto: 'Onde ficam as ferramentas que só o administrador usa. Dá para pular e refazer pela Ajuda.' },
      { icone: IC.menu, alvo: ['.lateral', '#nav-inferior'], titulo: 'O menu', texto: 'Você vê todas as telas. A equipe vê só as da função de cada um (você define isso em Usuários e acessos).' },
      { icone: IC.tela, alvo: nav('config'), titulo: 'Configurações → Admin', texto: 'Aparência do sistema, recursos, manutenção, sessões, IA, comunicado, saúde do sistema, resumo da semana e redistribuição.' },
      { icone: IC.tela, alvo: nav('panorama'), titulo: 'Panorama', texto: 'A agência inteira no mês: cada cliente, o que andou e o que está atrasado.' },
      { icone: IC.busca, alvo: ['#busca-gatilho', '.busca-gatilho'], titulo: 'Busca', texto: 'Ache qualquer cliente, demanda, tela ou configuração. No teclado: Ctrl+K.' },
      { icone: IC.sino, alvo: ['.topo .sino'], titulo: 'Avisos', texto: 'Inclui os chamados novos da equipe e os que estão parados há mais de 24 h.' },
      { icone: IC.conta, alvo: ['.topo .area-sessao'], titulo: 'O menu da sua foto', texto: 'Usuários e acessos, a Central de atendimento (os chamados da equipe) e o Visualizar como… ficam aqui.' },
      { icone: IC.ajuda, alvo: ['.topo .aj-bt'], titulo: 'Ajuda da administração', texto: 'O ? abre a ajuda: para você, primeiro os tutoriais da administração; os da equipe ficam numa aba ao lado.' },
      { icone: IC.ok, titulo: 'Pronto!', texto: 'Na Ajuda da administração tem a lista do que conferir primeiro.', botao: 'Abrir a ajuda da administração',
        aoConcluir: () => { location.hash = '#/ajuda'; } }
    ];
  }
  function passosBoasVindas() {
    const u = usuario() || {}, f = funcao(), nome = String(u.nome || '').trim().split(/\s+/)[0];
    if (ehAdmin()) return passosAdmin(nome);
    return [
      { icone: IC.oi, titulo: 'Bem-vindo ao Sistema B7' + (nome ? ', ' + nome : '') + '!', texto: 'Um tour de 1 minuto pelo que você mais vai usar. Dá para pular quando quiser e refazer depois pela Ajuda.' },
      { icone: IC.menu, alvo: ['.lateral', '#nav-inferior'], titulo: 'O menu', texto: 'Aqui ficam as telas da sua função. Cada pessoa vê só o que usa no dia a dia.' },
      ...(TELAS[f] || []).map(t => ({ icone: IC.tela, alvo: nav(t[0]), titulo: t[1], texto: t[2] })),
      { icone: IC.busca, alvo: ['#busca-gatilho', '.busca-gatilho'], titulo: 'Busca', texto: 'Ache qualquer cliente, gravação, demanda ou tela digitando poucas letras. No teclado: Ctrl+K.' },
      { icone: IC.mais, alvo: ['#tp-criar'], titulo: 'Criar', texto: 'Atalho para criar uma demanda, uma gravação ou uma peça sem procurar a tela.' },
      { icone: IC.sino, alvo: ['.topo .sino', '.topo [data-sino]'], titulo: 'Avisos', texto: 'O que foi passado para você, prazos e respostas chegam aqui (e no celular, se você permitir).' },
      { icone: IC.chat, alvo: ['.topo .conv-bt'], titulo: 'Conversas', texto: 'O chat da equipe: texto, áudio, imagem e arquivo, com quem está online.' },
      { icone: IC.ajuda, alvo: ['.topo .aj-bt'], titulo: 'Ajuda desta tela', texto: 'O ? abre o tutorial da tela em que você está. Lá também dá para refazer este tour.' },
      { icone: IC.conta, alvo: ['.topo .area-sessao'], titulo: 'Sua conta', texto: 'Perfil, tema claro ou escuro, atalhos e o Suporte, para relatar um problema ou mandar uma ideia.' },
      { icone: IC.ok, titulo: 'Pronto!', texto: 'Na Ajuda tem uma lista de primeiros passos que vai se marcando sozinha conforme você usa o sistema.', botao: 'Ver primeiros passos',
        aoConcluir: () => { location.hash = '#/ajuda'; } }
    ];
  }
  function boasVindas() {
    marcar(ehAdmin() ? 'tour-adm' : 'tour');
    return rodar(passosBoasVindas(), { nome: 'Tour de boas-vindas', aoFim: () => { const e = est(); e.boasVindas = Date.now(); salvar(e); } });
  }

  /* ==================================================== DICA DA TELA */
  let dicaEl = null, timerDica = 0;
  function tirarDica() { if (dicaEl) { const d = dicaEl; dicaEl = null; d.classList.add('saindo'); setTimeout(() => d.remove(), 220); } }
  function dicaDaTela() {
    clearTimeout(timerDica);
    tirarDica();
    if (!podeUsar() || atual || !B7.Ajuda || !B7.Ajuda.daRota) return;
    const e = est();
    if (e.semDicas || !e.boasVindas) return;      /* primeiro o tour; depois as dicas */
    const base = String(location.hash || '#/').replace(/^#\//, '').split(/[/?]/)[0];
    if (!base || base === 'ajuda' || e.telas[base]) return;
    const t = B7.Ajuda.daRota(base);
    if (!t) return;
    timerDica = setTimeout(() => {
      if (atual || dicaEl || String(location.hash || '#/').replace(/^#\//, '').split(/[/?]/)[0] !== base) return;
      const s = est(); s.telas[base] = Date.now(); salvar(s);
      const serve = String(t.serve || '').replace(/\*\*/g, '');
      dicaEl = document.createElement('aside');
      dicaEl.className = 'tr-dica'; dicaEl.setAttribute('role', 'status');
      dicaEl.innerHTML = '<span class="tr-ic" aria-hidden="true">' + IC.ajuda + '</span><div class="tr-tx"><small>Primeira vez aqui?</small><b>' + esc(t.titulo) + '</b>' +
        '<p>' + esc(serve.length > 150 ? serve.slice(0, 149).trimEnd() + '…' : serve) + '</p>' +
        '<div class="tr-bts"><a class="b pri fina" href="#/ajuda/' + esc(t.id) + '">Ver tutorial</a><button type="button" class="b contorno fina" data-d="ok">Agora não</button></div>' +
        '<button type="button" class="tr-nunca" data-d="nunca">Não mostrar mais dicas</button></div>' +
        '<button type="button" class="tr-x" data-d="ok" aria-label="Fechar dica">✕</button>';
      document.body.appendChild(dicaEl);
      dicaEl.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
        if (b.dataset.d === 'nunca') { const s2 = est(); s2.semDicas = true; salvar(s2); B7.UI.toast('Pronto: as dicas não aparecem mais. Dá para religar na Ajuda.'); }
        tirarDica();
      });
      dicaEl.querySelector('a').onclick = () => tirarDica();
    }, 1400);
  }

  /* ================================================== PRIMEIROS PASSOS */
  const COMUNS = [
    { id: 'tour', t: 'Fazer o tour de boas-vindas' },
    { id: 'busca', t: 'Buscar alguma coisa (Ctrl+K)' },
    { id: 'sino', t: 'Abrir os avisos (o sino)' },
    { id: 'conversa', t: 'Abrir as Conversas da equipe' },
    { id: 'ajuda', t: 'Ler um tutorial na Ajuda', rota: 'ajuda' }
  ];
  const POR_FUNCAO = {
    designer: [{ id: 'r:design', t: 'Abrir a Produção de Design', rota: 'design' }, { id: 'r:linhas', t: 'Ver uma linha editorial', rota: 'linhas' }, { id: 'r:calendario', t: 'Olhar o Calendário', rota: 'calendario' }],
    videomaker: [{ id: 'r:video', t: 'Abrir a Edição de vídeo', rota: 'video' }, { id: 'r:gravacoes', t: 'Ver as Gravações', rota: 'gravacoes' }, { id: 'r:roteiros', t: 'Abrir os Roteiros', rota: 'roteiros' }],
    coordenador: [{ id: 'r:linhas', t: 'Abrir as Linhas editoriais', rota: 'linhas' }, { id: 'r:calendario', t: 'Olhar o Calendário', rota: 'calendario' }, { id: 'r:publicacoes', t: 'Ver as Publicações do dia', rota: 'publicacoes' }, { id: 'r:aprovacoes', t: 'Abrir as Aprovações', rota: 'aprovacoes' }],
    admin: [{ id: 'r:panorama', t: 'Abrir o Panorama', rota: 'panorama' }, { id: 'r:config', t: 'Conhecer as Configurações', rota: 'config' }, { id: 'r:usuarios', t: 'Ver Usuários e acessos', rota: 'usuarios' }]
  };
  const ADMIN_PASSOS = [
    { id: 'tour-adm', t: 'Fazer o tour da administração' },
    { id: 'r:config', t: 'Abrir as Configurações (aba Admin)', rota: 'config' },
    { id: 'r:usuarios', t: 'Conferir Usuários e acessos', rota: 'usuarios' },
    { id: 'r:suporte', t: 'Abrir a Central de atendimento', rota: 'suporte' },
    { id: 'r:panorama', t: 'Abrir o Panorama', rota: 'panorama' },
    { id: 'ajuda', t: 'Ler um tutorial da administração', rota: 'ajuda' }
  ];
  let modoCartao = false;
  const lista = () => (modoCartao ? ADMIN_PASSOS : (POR_FUNCAO[funcao() === 'admin' ? 'coordenador' : funcao()] || []).concat(COMUNS)).filter(p => !p.rota || p.rota === 'ajuda' || !B7.Perm || !B7.Perm.podeRota || B7.Perm.podeRota(p.rota));
  function marcar(id) {
    if (!usuario()) return;
    const e = est(); if (e.passos[id]) return;
    e.passos[id] = Date.now(); salvar(e);
    const cx = document.getElementById('tr-check'); if (cx) cx.outerHTML = cartao(modoCartao);
    ligarCartao();
  }
  function cartao(adm) {
    modoCartao = !!adm && ehAdmin();
    const e = est(), l = lista(), feitos = l.filter(p => e.passos[p.id]).length, pct = Math.round(feitos / Math.max(1, l.length) * 100);
    const C = 2 * Math.PI * 22;
    return '<section class="tr-check" id="tr-check"><div class="tr-check-cab">' +
        '<svg class="tr-anel" viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="22"/><circle class="v" cx="27" cy="27" r="22" style="stroke-dasharray:' + C.toFixed(1) + ';stroke-dashoffset:' + (C * (1 - pct / 100)).toFixed(1) + '"/></svg>' +
        '<div><h2>' + (modoCartao ? 'Para conferir primeiro' : 'Primeiros passos') + '</h2><small>' + (feitos === l.length ? 'Tudo feito. Você já conhece o essencial!' : feitos + ' de ' + l.length + ' · vão se marcando sozinhos conforme você usa') + '</small></div>' +
        '<div class="tr-check-ac"><button type="button" class="b contorno fina" data-tr-tour>' + (e.boasVindas ? 'Refazer o tour' : 'Fazer o tour') + '</button>' +
          '<button type="button" class="tr-link" data-tr-dicas>' + (e.semDicas ? 'Religar as dicas' : 'Desligar as dicas') + '</button></div></div>' +
      '<ul>' + l.map(p => '<li class="' + (e.passos[p.id] ? 'ok' : '') + '">' +
        (p.rota && !e.passos[p.id] ? '<a href="#/' + esc(p.rota) + '">' : '<span>') +
        '<i aria-hidden="true">' + (e.passos[p.id] ? SV('<path d="M5.5 12.5l4.2 4.2 8.8-9.4"/>') : '') + '</i>' + esc(p.t) +
        (p.rota && !e.passos[p.id] ? '</a>' : '</span>') + '</li>').join('') + '</ul></section>';
  }
  function ligarCartao() {
    const cx = document.getElementById('tr-check'); if (!cx) return;
    const bt = cx.querySelector('[data-tr-tour]'); if (bt) bt.onclick = () => boasVindas();
    const dc = cx.querySelector('[data-tr-dicas]'); if (dc) dc.onclick = () => {
      const e = est(); e.semDicas = !e.semDicas; if (!e.semDicas) e.telas = {}; salvar(e);
      B7.UI.toast(e.semDicas ? 'Dicas desligadas.' : 'Dicas religadas: elas aparecem de novo na primeira visita a cada tela.');
      cx.outerHTML = cartao(modoCartao); ligarCartao();
    };
  }

  /* ======================================================== GATILHOS */
  let ligado = false;
  function aoEntrar() {
    if (!podeUsar()) return;
    if (!ligado) {
      ligado = true;
      window.addEventListener('hashchange', () => { aoRota(); dicaDaTela(); });
      document.addEventListener('click', ev => {
        const t = ev.target;
        if (!t || !t.closest) return;
        if (t.closest('.sino, [data-sino]')) marcar('sino');
        if (t.closest('.conv-bt')) marcar('conversa');
        if (t.closest('.busca-gatilho')) marcar('busca');
      }, true);
      document.addEventListener('keydown', ev => { if ((ev.ctrlKey || ev.metaKey) && String(ev.key).toLowerCase() === 'k') marcar('busca'); }, true);
    }
    aoRota();
    const e = est();
    if (!e.boasVindas) {
      /* espera a abertura e a primeira tela assentarem */
      setTimeout(() => { if (podeUsar() && !atual && !est().boasVindas && !document.querySelector('.b7-abertura, .fundo-modal, .cva')) boasVindas(); else if (!est().boasVindas) setTimeout(aoEntrar, 8000); }, 3200);
    } else dicaDaTela();
  }
  function aoRota() {
    const base = String(location.hash || '#/').replace(/^#\//, '').split(/[/?]/)[0];
    if (base === 'ajuda') { if (/^#\/ajuda\/./.test(location.hash)) marcar('ajuda'); }
    else if (base === 'conversa') marcar('conversa');
    else if (base) marcar('r:' + base);
  }

  return { rodar, fechar, boasVindas, aoEntrar, cartao, ligarCartao, marcar, ativo: () => !!atual };
})();
