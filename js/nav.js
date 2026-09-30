/* =====================================================================
   NAVEGAÇÃO GLOBAL — um modelo só, duas apresentações

   Regra de produto:
     • PERMISSÃO decide o que a pessoa PODE abrir (B7.Perm.podeRota —
       papel + funções extras, a mesma guarda que o roteador usa);
     • FUNÇÃO OPERACIONAL decide o que aparece PRIMEIRO
       (B7.Perm.funcoesOperacionais: coordenador, videomaker, designer).
   Administrador é gestão/acesso, não persona operacional: admin puro
   não ganha "Meu trabalho" nem Painel — a casa dele é a Central B7.

   Desktop/tablet: barra lateral em grupos (Principal · Meu trabalho ·
   Operação · Mais ferramentas). Celular (≤760px): topo de vidro + barra
   inferior (até 4 destinos + "Mais") + folha "Mais". Mesma resolução de
   itens nos dois — só a apresentação muda.

   Nada aqui é segurança: esconder um item não bloqueia a rota; a guarda
   de rota (app.js) e o banco continuam valendo.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Nav = (function () {
  const esc = s => B7.UI.esc(s);
  const IC = {
      "painel": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4.5 17a7.5 7.5 0 1 1 15 0\"/><path d=\"M12 17l3.6-4.6\"/><circle cx=\"12\" cy=\"17\" r=\"1.3\"/><path d=\"M4 20.5h16\"/></svg>",
      "central": "<svg viewBox=\"0 0 24 24\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"9\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"5\" rx=\"1.5\"/><rect x=\"14\" y=\"12\" width=\"7\" height=\"9\" rx=\"1.5\"/><rect x=\"3\" y=\"16\" width=\"7\" height=\"5\" rx=\"1.5\"/></svg>",
      "clientes": "<svg viewBox=\"0 0 24 24\"><path d=\"M16 19v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V19\"/><circle cx=\"9\" cy=\"7\" r=\"3.2\"/><path d=\"M22 19v-1.5a4 4 0 0 0-3-3.87\"/><path d=\"M16 4.13a4 4 0 0 1 0 7.75\"/></svg>",
      "publicacoes": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"><rect x=\"3.5\" y=\"4.5\" width=\"17\" height=\"16\" rx=\"2.5\"/><path d=\"M3.5 9.5h17M8.5 3v3M15.5 3v3\"/><rect x=\"10\" y=\"12.5\" width=\"4.5\" height=\"4.5\" rx=\"1.2\" fill=\"currentColor\" stroke=\"none\"/></svg>",
      "aprovacoes": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"><path d=\"M9 11.5l2 2 4-4.5\"/><rect x=\"3.5\" y=\"3.5\" width=\"17\" height=\"17\" rx=\"3\"/></svg>",
      "kanban": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"><rect x=\"3\" y=\"4\" width=\"5\" height=\"16\" rx=\"1.5\"/><rect x=\"9.5\" y=\"4\" width=\"5\" height=\"11\" rx=\"1.5\"/><rect x=\"16\" y=\"4\" width=\"5\" height=\"7\" rx=\"1.5\"/></svg>",
      "design": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"><rect x=\"3.5\" y=\"3.5\" width=\"17\" height=\"17\" rx=\"3\"/><path d=\"M8 15.5l3-6.5 2.5 5L15 11l1.5 2.5\"/><circle cx=\"8.3\" cy=\"8.3\" r=\"1.1\"/></svg>",
      "video": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"><rect x=\"2.5\" y=\"6\" width=\"13\" height=\"12\" rx=\"2.5\"/><path d=\"M15.5 10.5l6-3.5v10l-6-3.5z\"/></svg>",
      "gravacoes": "<svg viewBox=\"0 0 24 24\"><path d=\"M3 9.5h18\"/><path d=\"M3.6 9.5l1.7-4.6 15 0-1.7 4.6\"/><path d=\"M8.2 4.9l-1.7 4.6M13.2 4.9l-1.7 4.6M18.2 4.9l-1.7 4.6\"/><rect x=\"3\" y=\"9.5\" width=\"18\" height=\"11\" rx=\"2\"/></svg>",
      "calendario": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\"><rect x=\"3.5\" y=\"4.5\" width=\"17\" height=\"16\" rx=\"2.5\"/><path d=\"M3.5 9.5h17M8.5 3v3M15.5 3v3\"/><circle cx=\"8.3\" cy=\"14\" r=\"1\"/><circle cx=\"12\" cy=\"14\" r=\"1\"/><circle cx=\"15.7\" cy=\"14\" r=\"1\"/></svg>",
      "oportunidades": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z\"/><path d=\"M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z\"/></svg>",
      "roteiros": "<svg viewBox=\"0 0 24 24\"><path d=\"M5 3.5h9l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 20V5a1.5 1.5 0 0 1 1-1.5z\"/><path d=\"M14 3.5V9h5\"/><path d=\"M8.5 13.5h7M8.5 17h4.5\"/></svg>",
      "linhas": "<svg viewBox=\"0 0 24 24\"><rect x=\"3.5\" y=\"4.5\" width=\"17\" height=\"16\" rx=\"2.5\"/><path d=\"M3.5 9.5h17M8.5 3v3M15.5 3v3M7.5 13.5h4M7.5 17h7\"/></svg>",
      "semanas": "<svg viewBox=\"0 0 24 24\"><rect x=\"3.5\" y=\"4.5\" width=\"17\" height=\"16\" rx=\"2.5\"/><path d=\"M3.5 9.5h17M8.5 3v3M15.5 3v3M7.5 13h3M13.5 13h3M7.5 16.5h3\"/></svg>",
      "arquivados": "<svg viewBox=\"0 0 24 24\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"4.5\" rx=\"1.5\"/><path d=\"M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5\"/><path d=\"M10 12h4\"/></svg>",
      "lixeira": "<svg viewBox=\"0 0 24 24\"><path d=\"M4 7h16\"/><path d=\"M9 7V5h6v2\"/><path d=\"M6 7l1 13h10l1-13\"/><path d=\"M10 11v5M14 11v5\"/></svg>",
      "usuarios": "<svg viewBox=\"0 0 24 24\"><path d=\"M16 19v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V19\"/><circle cx=\"9\" cy=\"7\" r=\"3.2\"/><path d=\"M19 8v6M22 11h-6\"/></svg>",
      "config": "<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"3.2\"/><path d=\"M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z\"/></svg>",
      "atalhos": "<svg viewBox=\"0 0 24 24\"><rect x=\"2.5\" y=\"5\" width=\"19\" height=\"14\" rx=\"2.5\"/><path d=\"M7 10h.01M11 10h.01M15 10h.01M7 14h10\"/></svg>",
      "mais": "<svg viewBox=\"0 0 24 24\"><circle cx=\"5.5\" cy=\"12\" r=\"1.4\"/><circle cx=\"12\" cy=\"12\" r=\"1.4\"/><circle cx=\"18.5\" cy=\"12\" r=\"1.4\"/></svg>",
      "vercomo": "<svg viewBox=\"0 0 24 24\"><path d=\"M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>"
  };

  /* ------------------------------------------------------------ itens
     Um registro por destino: rota, rótulo completo, rótulo curto (só a
     barra inferior usa — compressão de rótulo, não renomeação), ícone,
     prefixos de rota que o mantêm ativo em telas internas e a regra de
     acesso. */
  const perm = () => B7.Perm;
  const pode = r => !!(perm() && perm().podeRota(r));
  const papel = () => (B7.Auth && B7.Auth.papel && B7.Auth.papel()) || null;
  const ehAdmin = () => papel() === 'admin';

  const ITENS = {
    painel:      { rota: '#/painel', rotulo: 'Painel', curto: 'Painel', id: 'nav-painel', base: ['painel'],
                   pode: () => !!(perm() && perm().painelElegivel()) },
    /* Central: para o Designer (papel) a rota "#/" é a Central de Design;
       para o videomaker puro "#/" redireciona ao Painel, então some. */
    central:     { rota: '#/', rotulo: 'Central B7', curto: 'Central', base: [''],
                   pode: () => pode('') && !(papel() === 'videomaker' && perm().painelElegivel()) },
    clientes:    { rota: '#/clientes', rotulo: 'Clientes', curto: 'Clientes', base: ['clientes', 'cliente'], pode: () => pode('clientes') },
    publicacoes: { rota: '#/publicacoes', rotulo: 'Publicações do Dia', curto: 'Publicações', id: 'nav-publicacoes', base: ['publicacoes'], pode: () => pode('publicacoes') },
    aprovacoes:  { rota: '#/aprovacoes', rotulo: 'Aprovações', curto: 'Aprovações', id: 'nav-aprovacoes', base: ['aprovacoes'], pode: () => pode('aprovacoes') },
    kanban:      { rota: '#/kanban', rotulo: 'Produção', curto: 'Produção', id: 'nav-kanban', base: ['kanban'], pode: () => pode('kanban') },
    design:      { rota: '#/design', rotulo: 'Design', curto: 'Design', id: 'nav-design', base: ['design'], pode: () => pode('design') },
    video:       { rota: '#/video', rotulo: 'Edição de vídeo', curto: 'Vídeo', id: 'nav-video', base: ['video'], pode: () => pode('video') },
    gravacoes:   { rota: '#/gravacoes', rotulo: 'Gravações', curto: 'Gravações', base: ['gravacoes', 'gravacao', 'diaria'], pode: () => pode('gravacoes') },
    calendario:  { rota: '#/calendario', rotulo: 'Calendário', curto: 'Calendário', id: 'nav-calendario', base: ['calendario'], pode: () => pode('calendario') },
    oportunidades: { rota: '#/oportunidades', rotulo: 'Oportunidades', curto: 'Oportunidades', id: 'nav-oportunidades', base: ['oportunidades'], pode: () => pode('oportunidades') },
    roteiros:    { rota: '#/roteiros', rotulo: 'Roteiros', curto: 'Roteiros', base: ['roteiros'], pode: () => pode('roteiros') },
    linhas:      { rota: '#/linhas', rotulo: 'Linhas editoriais', curto: 'Linhas', base: ['linhas', 'linha'], pode: () => pode('linhas') },
    semanas:     { rota: '#/semanas', rotulo: 'Status semanal', curto: 'Status', base: ['semanas', 'semana'], pode: () => pode('semanas') },
    arquivados:  { rota: '#/arquivados', rotulo: 'Arquivados', curto: 'Arquivados', base: ['arquivados'], pode: () => pode('arquivados') },
    lixeira:     { rota: '#/lixeira', rotulo: 'Lixeira', curto: 'Lixeira', base: ['lixeira'], pode: () => pode('lixeira') },
    usuarios:    { rota: '#/usuarios', rotulo: 'Usuários e acessos', curto: 'Usuários', base: ['usuarios'], pode: () => pode('usuarios') },
    /* Configurações na lateral só para o admin (as preferências de todo
       mundo estão no menu da conta); Atalhos só faz sentido com teclado */
    config:      { rota: '#/config', rotulo: 'Configurações', curto: 'Configurações', id: 'nav-config', base: ['config'], pode: () => ehAdmin() && pode('config') },
    atalhos:     { acao: 'atalhos', rotulo: 'Atalhos', curto: 'Atalhos', id: 'nav-atalhos', base: [], pode: () => ehAdmin() }
  };

  /* --------------------------------------------------- prioridades
     O que cada função operacional faz no dia a dia. Só PRIORIZA: um item
     só aparece se ITENS[x].pode() deixar. */
  const MEU_TRABALHO = {
    coordenador: ['linhas', 'publicacoes', 'roteiros', 'gravacoes', 'aprovacoes'],
    videomaker:  ['video', 'gravacoes', 'roteiros', 'calendario'],
    designer:    ['design', 'linhas']
  };
  /* barra inferior: frequência > completude (máx. 3 além da casa) */
  const INFERIOR = {
    coordenador: ['publicacoes', 'linhas', 'aprovacoes', 'gravacoes'],
    videomaker:  ['video', 'gravacoes', 'calendario', 'roteiros'],
    designer:    ['design', 'linhas', 'calendario'],
    gestao:      ['kanban', 'clientes', 'gravacoes', 'publicacoes']   /* sem função operacional (ex.: admin puro) */
  };
  const OPERACAO = ['clientes', 'publicacoes', 'aprovacoes', 'kanban', 'design', 'video', 'gravacoes', 'calendario', 'oportunidades',
                    'roteiros', 'linhas', 'semanas'];
  const FERRAMENTAS = ['arquivados', 'lixeira', 'usuarios', 'config', 'atalhos'];

  function rotuloDe(id) {
    if (id === 'central' && papel() === 'designer') return 'Central de Design';
    return ITENS[id].rotulo;
  }
  function curtoDe(id) {
    if (id === 'central' && papel() === 'designer') return 'Central';
    return ITENS[id].curto;
  }
  const permitido = id => { try { return !!ITENS[id] && ITENS[id].pode(); } catch (e) { return false; } };

  /* round-robin entre as funções, na ordem fixa delas: quem tem duas
     funções recebe o 1º de cada antes do 2º de qualquer uma — nenhuma
     função "engole" a outra e o resultado é sempre o mesmo */
  function intercalar(listas) {
    const out = [];
    const max = Math.max(0, ...listas.map(l => l.length));
    for (let i = 0; i < max; i++) listas.forEach(l => { if (l[i] && !out.includes(l[i])) out.push(l[i]); });
    return out;
  }

  /* ================================================ RESOLVEDOR ÚNICO */
  function resolver() {
    if (!B7.Auth || !B7.Auth.usuario() || !perm()) return null;
    const funcoes = perm().funcoesOperacionais ? perm().funcoesOperacionais() : [];
    const principal = ['painel', 'central'].filter(permitido);
    const usados = new Set(principal);
    const trabalho = intercalar(funcoes.map(f => MEU_TRABALHO[f] || [])).filter(id => permitido(id) && !usados.has(id));
    trabalho.forEach(id => usados.add(id));
    const operacao = OPERACAO.filter(id => permitido(id) && !usados.has(id));
    operacao.forEach(id => usados.add(id));
    const ferramentas = FERRAMENTAS.filter(permitido);

    /* barra inferior: a casa (Painel se houver; senão a Central) + até 3 */
    const casa = principal[0] || null;
    const prioridade = funcoes.length ? intercalar(funcoes.map(f => INFERIOR[f] || [])) : INFERIOR.gestao;
    const inferior = (casa ? [casa] : []);
    prioridade.concat(trabalho, operacao).forEach(id => {
      if (inferior.length < 4 && !inferior.includes(id) && permitido(id)) inferior.push(id);
    });
    return { funcoes, principal, trabalho, operacao, ferramentas, inferior, casa };
  }

  /* -------------------------------------------------- rota → item */
  function baseAtual() {
    return String(location.hash || '#/').replace(/^#\//, '').split(/[/?]/)[0];
  }
  function itemDaRota(base) {
    const b = base === undefined ? baseAtual() : base;
    /* #/ do designer (Central de Design) e do resto (Central B7) */
    for (const id of Object.keys(ITENS)) if ((ITENS[id].base || []).includes(b)) return id;
    return null;
  }

  /* ============================================== BARRA LATERAL */
  function linkLateral(id) {
    const it = ITENS[id], rot = rotuloDe(id);
    const attrs = (it.rota ? ' data-ir="' + it.rota + '"' : '') + (it.id ? ' id="' + it.id + '"' : '') +
      ' data-nav="' + id + '" aria-label="' + esc(rot) + '"';
    return '<a' + attrs + (it.rota ? ' href="' + it.rota + '"' : ' href="#" role="button"') + '>' + IC[id] + '<span>' + esc(rot) + '</span></a>';
  }
  function grupo(rotulo, ids) {
    return ids.length ? '<div class="grupo" role="presentation">' + rotulo + '</div>' + ids.map(linkLateral).join('') : '';
  }

  function montarLateral() {
    const nav = document.querySelector('.nav');
    const r = resolver();
    if (!nav || !r) return false;
    const ferramentasAtivas = r.ferramentas.some(id => (ITENS[id].base || []).includes(baseAtual()));
    let abertas = ferramentasAtivas;
    try { abertas = abertas || localStorage.getItem('b7-nav-mais') === '1'; } catch (e) {}
    nav.innerHTML =
      grupo('PRINCIPAL', r.principal) +
      grupo('MEU TRABALHO', r.trabalho) +
      grupo(r.trabalho.length ? 'OPERAÇÃO' : 'PRODUÇÃO', r.operacao) +
      (r.ferramentas.length
        ? '<button type="button" class="grupo grupo-alterna" id="nav-mais-toggle" aria-expanded="' + abertas + '" aria-controls="nav-mais">' +
            '<span>MAIS FERRAMENTAS</span><svg viewBox="0 0 24 24" class="seta" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
          '<div class="nav-mais' + (abertas ? ' aberta' : '') + '" id="nav-mais">' + r.ferramentas.map(linkLateral).join('') + '</div>'
        : '');
    nav.dataset.shell = 'interno';
    /* grupo recolhível: lembra a escolha neste navegador */
    const toggle = document.getElementById('nav-mais-toggle'), caixa = document.getElementById('nav-mais');
    if (toggle && caixa) toggle.onclick = () => {
      const ab = !caixa.classList.contains('aberta');
      caixa.classList.toggle('aberta', ab);
      toggle.setAttribute('aria-expanded', String(ab));
      /* fechado: os links escondidos saem da ordem do Tab */
      caixa.querySelectorAll('a').forEach(a => a.tabIndex = ab ? 0 : -1);
      try { localStorage.setItem('b7-nav-mais', ab ? '1' : '0'); } catch (e) {}
    };
    if (caixa && !abertas) caixa.querySelectorAll('a').forEach(a => a.tabIndex = -1);
    const at = document.getElementById('nav-atalhos');
    if (at) at.onclick = e => { e.preventDefault(); B7.UI.atalhos(); };
    ligarDicas(nav);
    marcarAtivo();
    return true;
  }

  /* Recolhida: o nome do item vira dica flutuante (B7.UI.dica, fixa no
     documento — não alarga o contêiner de rolagem da barra). */
  function ligarDicas(nav) {
    nav.querySelectorAll('a').forEach(a => {
      const tx = () => (a.querySelector('span') || {}).textContent || '';
      const mostrar = () => { if (document.body.classList.contains('recolhida')) B7.UI.dica(a, tx()); };
      a.addEventListener('mouseenter', mostrar);
      a.addEventListener('focus', mostrar);
      a.addEventListener('mouseleave', () => B7.UI.esconderDica());
      a.addEventListener('blur', () => B7.UI.esconderDica());
    });
  }

  /* =========================================== CELULAR: BARRA INFERIOR */
  function montarInferior() {
    let barra = document.getElementById('nav-inferior');
    const r = resolver();
    if (!r || document.body.dataset.shell !== 'interno') { if (barra) barra.remove(); return; }
    if (!barra) {
      barra = document.createElement('nav');
      barra.id = 'nav-inferior';
      barra.className = 'nav-inferior';
      barra.setAttribute('aria-label', 'Navegação principal');
      document.body.appendChild(barra);
    }
    barra.innerHTML = '<ul>' + r.inferior.map(id =>
      '<li><a href="' + ITENS[id].rota + '" data-inf="' + id + '" aria-label="' + esc(rotuloDe(id)) + '">' +
        '<span class="ni-ic" aria-hidden="true">' + IC[id] + '</span><span class="ni-tx">' + esc(curtoDe(id)) + '</span></a></li>').join('') +
      '<li><button type="button" data-inf="mais" aria-haspopup="dialog" aria-label="Mais destinos">' +
        '<span class="ni-ic" aria-hidden="true">' + IC.mais + '</span><span class="ni-tx">Mais</span></button></li></ul>';
    barra.querySelector('[data-inf="mais"]').onclick = abrirMais;
    marcarAtivo();
  }

  /* ------------------------------------------------ folha "Mais" */
  let folhaMais = null;
  function abrirMais() {
    const r = resolver(); if (!r) return;
    const ativo = itemDaRota();
    const fora = id => !r.inferior.includes(id);
    const item = id => {
      const it = ITENS[id];
      return '<a class="nm-item' + (ativo === id ? ' on' : '') + '"' + (ativo === id ? ' aria-current="page"' : '') +
        (it.rota ? ' href="' + it.rota + '"' : ' href="#" role="button"') + ' data-mais="' + id + '">' +
        '<span class="nm-ic" aria-hidden="true">' + IC[id] + '</span><span class="nm-tx">' + esc(rotuloDe(id)) + '</span></a>';
    };
    const secao = (titulo, ids) => ids.length ? '<section class="nm-secao"><h4>' + titulo + '</h4><div class="nm-grade">' + ids.map(item).join('') + '</div></section>' : '';
    const gestao = r.ferramentas.filter(id => ['usuarios', 'config'].includes(id));
    const ferr = r.ferramentas.filter(id => !gestao.includes(id) && id !== 'atalhos');
    const podeVerComo = ehAdmin() && B7.PreviaUsuario && B7.PreviaUsuario.abrirSeletor;
    const html =
      secao('PRINCIPAL', r.principal.filter(fora)) +
      secao('MEU TRABALHO', r.trabalho.filter(fora)) +
      secao(r.trabalho.length ? 'OPERAÇÃO' : 'PRODUÇÃO', r.operacao.filter(fora)) +
      secao('GESTÃO', gestao) +
      (ferr.length || podeVerComo ? '<section class="nm-secao"><h4>FERRAMENTAS</h4><div class="nm-grade">' + ferr.map(item).join('') +
        (podeVerComo ? '<a class="nm-item" href="#" role="button" data-vercomo><span class="nm-ic" aria-hidden="true">' + IC.vercomo + '</span><span class="nm-tx">Visualizar como…</span></a>' : '') +
        '</div></section>' : '');
    const bt = document.querySelector('#nav-inferior [data-inf="mais"]');
    if (bt) bt.setAttribute('aria-expanded', 'true');
    folhaMais = B7.UI.modal('<div class="tp-folha-cab"><h3>Mais</h3>' +
      '<button type="button" class="ico" data-fecha aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<nav class="nm-corpo" aria-label="Mais destinos">' + (html || '<p class="nm-vazio">Nada além da barra.</p>') + '</nav>',
      { classe: 'tp-folha nm-folha', aoFechar: () => { folhaMais = null; if (bt) bt.setAttribute('aria-expanded', 'false'); } });
    folhaMais.querySelectorAll('[data-mais]').forEach(a => a.onclick = e => {
      const it = ITENS[a.dataset.mais];
      e.preventDefault();
      const m = folhaMais; if (m) m.fechar();
      if (it.acao === 'atalhos') return B7.UI.atalhos();
      location.hash = it.rota;
    });
    const vc = folhaMais.querySelector('[data-vercomo]');
    if (vc) vc.onclick = e => { e.preventDefault(); const m = folhaMais; if (m) m.fechar(); B7.PreviaUsuario.abrirSeletor(); };
    /* foco no próprio diálogo (leitor de tela anuncia; Tab entra na
       grade) — sem anel de foco pintado num item ao tocar */
    const caixa = folhaMais.querySelector('.modal');
    if (caixa) { caixa.tabIndex = -1; caixa.setAttribute('aria-label', 'Mais destinos'); caixa.focus({ preventScroll: true }); }
  }

  /* ------------------------------------------------ estado ativo
     Lateral: o módulo marca pelo próprio marcarNav (rota exata); aqui só
     cobrimos o que ninguém marcou. Barra inferior: pelo prefixo da rota —
     detalhe de demanda de vídeo deixa "Vídeo" aceso; rota que só existe
     no "Mais" acende o "Mais". */
  function marcarAtivo() {
    const barra = document.getElementById('nav-inferior');
    if (!barra) return;
    const id = itemDaRota();
    const naBarra = !!barra.querySelector('[data-inf="' + id + '"]');
    barra.querySelectorAll('[data-inf]').forEach(el => {
      const on = naBarra ? el.dataset.inf === id : (el.dataset.inf === 'mais' && !!id);
      el.classList.toggle('on', on);
      if (on && el.tagName === 'A') el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange', () => { marcarAtivo(); if (folhaMais) folhaMais.fechar(); });

  /* -------------------------------------------- teclado virtual
     Com o teclado aberto a barra inferior sai de cena: não cobre o
     campo ativo nem briga com a folha/diálogo. */
  (function () {
    const vv = window.visualViewport;
    const checar = () => {
      const aberto = !!vv && (window.innerHeight - vv.height) > 150;
      document.body.classList.toggle('teclado-aberto', aberto);
    };
    if (vv) vv.addEventListener('resize', checar);
    document.addEventListener('focusin', checar);
    document.addEventListener('focusout', () => setTimeout(checar, 60));
  })();

  /* --------------------------------------- tablet: barra em trilho
     Entre 761 e 1080px a barra lateral fica fixa só com ícones (em vez
     de gaveta): a preferência de recolher do desktop não é alterada. */
  function aplicarLargura() {
    if (document.body.dataset.shell !== 'interno') return;
    let tablet = false;
    try { tablet = window.matchMedia('(min-width:761px) and (max-width:1080px)').matches; } catch (e) {}
    const pref = !!(B7.pref && B7.pref.ler('sidebar_recolhida', false));
    document.body.classList.toggle('trilho-tablet', tablet);
    document.body.classList.toggle('recolhida', tablet || pref);
    if (B7.moverTrilha) setTimeout(() => B7.moverTrilha(), 0);
  }
  try { window.matchMedia('(min-width:761px) and (max-width:1080px)').addEventListener('change', aplicarLargura); } catch (e) {}

  function montar() {
    const ok = montarLateral();
    montarInferior();
    aplicarLargura();
    return ok;
  }

  return { montar, montarLateral, montarInferior, aplicarLargura, marcarAtivo, resolver, itemDaRota, abrirMais, rotuloDe, ITENS };
})();
