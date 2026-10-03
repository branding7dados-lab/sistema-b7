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
  /* Atalhos saiu da barra permanente: continua no menu da conta e na tecla "?" */
  const FERRAMENTAS = ['arquivados', 'lixeira', 'usuarios', 'config'];

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
  /* ============================================ SANFONA (desktop)
     Os mesmos quatro grupos de sempre (Principal · Meu trabalho ·
     Operação · Mais ferramentas), agora em sanfona: UM grupo aberto por
     vez. Quem abre: 1) o grupo da rota atual; 2) o último aberto à mão
     (localStorage, só quando a rota não resolve); 3) Meu trabalho para
     quem tem função operacional, Principal para os demais.
     Fechar à mão o grupo da rota atual deixa um ponto discreto nele.
     Recolhida (ou tablet em trilho): em vez de uma coluna com todos os
     ícones, um ícone por GRUPO, que abre um painel flutuante ao lado. */
  const SVGN = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const IC_GRUPO = {
    principal: SVGN('<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6h-6v6H5.5A1.5 1.5 0 0 1 4 19z"/>'),
    trabalho: SVGN('<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>'),
    operacao: SVGN('<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>'),
    ferramentas: SVGN('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>')
  };
  const CHEVRON = '<svg class="ng-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const CHAVE_GRUPO = 'b7-nav-grupo';
  let G = { grupos: [], aberto: null, rota: null, funcoes: [] };

  function gruposDe(r) {
    return [
      { id: 'principal', rotulo: 'Principal', ids: r.principal },
      { id: 'trabalho', rotulo: 'Meu trabalho', ids: r.trabalho },
      { id: 'operacao', rotulo: r.trabalho.length ? 'Operação' : 'Produção', ids: r.operacao },
      { id: 'ferramentas', rotulo: 'Mais ferramentas', ids: r.ferramentas }
    ].filter(g => g.ids.length);            /* grupo sem item autorizado não existe */
  }
  function grupoHTML(g) {
    return '<section class="ng" data-grupo="' + g.id + '">' +
      '<button type="button" class="ng-cab" id="ng-cab-' + g.id + '" aria-expanded="false" aria-controls="ng-painel-' + g.id + '">' +
        '<span class="ng-tit">' + esc(g.rotulo) + '</span>' +
        '<i class="ng-ponto" aria-hidden="true"></i><span class="ng-leitor"></span>' + CHEVRON + '</button>' +
      '<div class="ng-painel" id="ng-painel-' + g.id + '" role="region" aria-labelledby="ng-cab-' + g.id + '">' +
        '<div class="ng-in"><div class="ng-lista">' + g.ids.map(linkLateral).join('') + '</div></div></div>' +
    '</section>';
  }
  function trilhoHTML() {
    return '<div class="nav-trilho" role="toolbar" aria-orientation="vertical" aria-label="Grupos de navegação">' +
      G.grupos.map(g => '<button type="button" class="ntr-bt" data-grupo-bt="' + g.id + '" aria-label="' + esc(g.rotulo) + '" aria-haspopup="true" aria-expanded="false">' +
        IC_GRUPO[g.id] + '<i class="ntr-ponto" aria-hidden="true"></i></button>').join('') + '</div>';
  }

  function montarLateral() {
    const nav = document.querySelector('.nav');
    const r = resolver();
    if (!nav || !r) return false;
    fecharFlyout(true);
    G = { grupos: gruposDe(r), aberto: null, rota: null, funcoes: r.funcoes };
    nav.innerHTML = '<div class="nav-acordeao">' + G.grupos.map(grupoHTML).join('') + '</div>' + trilhoHTML();
    nav.dataset.shell = 'interno';
    nav.querySelectorAll('.ng-cab').forEach(b => b.onclick = () => {
      const id = b.closest('.ng').dataset.grupo;
      abrirGrupo(G.aberto === id ? null : id, true);
    });
    nav.querySelectorAll('.ntr-bt').forEach(b => {
      b.onclick = ev => alternarFlyout(b.dataset.grupoBt, b, ev.detail === 0);
      const dica = () => { if (!flyout || flyout.dataset.grupo !== b.dataset.grupoBt) B7.UI.dica(b, b.getAttribute('aria-label')); };
      b.addEventListener('mouseenter', dica);
      b.addEventListener('focus', dica);
      b.addEventListener('mouseleave', () => B7.UI.esconderDica());
      b.addEventListener('blur', () => B7.UI.esconderDica());
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const bts = [...nav.querySelectorAll('.ntr-bt')], i = bts.indexOf(b);
        (bts[(i + (e.key === 'ArrowDown' ? 1 : bts.length - 1)) % bts.length]).focus();
      });
    });
    sincronizar(true);
    marcarAtivo();
    return true;
  }

  /* qual grupo contém o destino atual? (o módulo marca .on; antes disso,
     a rota decide) */
  function grupoAtivo() {
    const on = document.querySelector('.nav .ng a.on');
    const id = (on && on.dataset.nav) || itemDaRota();
    const g = G.grupos.find(x => x.ids.includes(id));
    return g ? g.id : null;
  }
  function grupoPadrao() {
    let lembrado = null;
    try { lembrado = localStorage.getItem(CHAVE_GRUPO); } catch (e) {}
    const existe = id => G.grupos.some(g => g.id === id);
    if (lembrado && existe(lembrado)) return lembrado;
    if (G.funcoes.length && existe('trabalho')) return 'trabalho';
    return existe('principal') ? 'principal' : (G.grupos[0] && G.grupos[0].id) || null;
  }
  function abrirGrupo(id, manual) {
    G.aberto = id;
    document.querySelectorAll('.nav .ng').forEach(sec => {
      const ab = sec.dataset.grupo === id;
      sec.classList.toggle('aberto', ab);
      const cab = sec.querySelector('.ng-cab');
      cab.setAttribute('aria-expanded', String(ab));
    });
    if (manual) { try { if (id) localStorage.setItem(CHAVE_GRUPO, id); } catch (e) {} }
    marcarGrupoAtivo();
  }
  /* ponto discreto no grupo (fechado) que contém a tela atual, e o
     mesmo sinal no ícone do grupo quando a barra está recolhida */
  function marcarGrupoAtivo() {
    const ativo = grupoAtivo();
    document.querySelectorAll('.nav .ng').forEach(sec => {
      const tem = sec.dataset.grupo === ativo;
      sec.classList.toggle('tem-ativo', tem);
      const leitor = sec.querySelector('.ng-leitor');
      if (leitor) leitor.textContent = tem && !sec.classList.contains('aberto') ? ' (tela atual está aqui)' : '';
    });
    document.querySelectorAll('.nav .ntr-bt').forEach(b => b.classList.toggle('tem-ativo', b.dataset.grupoBt === ativo));
    document.querySelectorAll('.nav .ng a').forEach(a => { if (a.classList.contains('on')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  /* chamado pelo marcarNav dos módulos e na troca de rota: a rota tem
     prioridade — se ela mudou e mora em outro grupo, esse grupo abre */
  /* B7.Perm.aplicarNavegacao ainda pode retirar itens do DOM depois da
     montagem: o modelo acompanha, e grupo que ficar vazio some inteiro */
  function podarVazios() {
    const nav = document.querySelector('.nav'); if (!nav) return;
    G.grupos = G.grupos.filter(g => {
      g.ids = g.ids.filter(id => nav.querySelector('.ng a[data-nav="' + id + '"]'));
      if (g.ids.length) return true;
      const sec = nav.querySelector('.ng[data-grupo="' + g.id + '"]'); if (sec) sec.remove();
      const bt = nav.querySelector('[data-grupo-bt="' + g.id + '"]'); if (bt) bt.remove();
      return false;
    });
  }
  function sincronizar(inicial) {
    podarVazios();
    if (!G.grupos.length) return;
    const rota = String(location.hash || '#/').split('?')[0];
    const mudou = rota !== G.rota;
    G.rota = rota;
    const ativo = grupoAtivo();
    if (inicial) abrirGrupo(ativo || grupoPadrao(), false);
    else if (mudou && ativo && ativo !== G.aberto) abrirGrupo(ativo, false);
    else marcarGrupoAtivo();
    if (mudou && !inicial) {
      /* item ativo fora da área visível da barra: traz para perto, sem
         rolar a página e só quando precisa */
      setTimeout(() => {
        const nav = document.querySelector('.nav'), a = nav && nav.querySelector('.ng.aberto a.on');
        if (!a || document.body.classList.contains('recolhida')) return;
        const rn = nav.getBoundingClientRect(), ra = a.getBoundingClientRect();
        if (ra.top < rn.top || ra.bottom > rn.bottom) nav.scrollTop += ra.top < rn.top ? ra.top - rn.top - 8 : ra.bottom - rn.bottom + 8;
      }, 200);
    }
  }

  /* ---------------------------------------- painel flutuante (recolhida)
     Vive no <body> (position:fixed): não entra na caixa de rolagem da
     barra, então não cria rolagem lateral. Abre por clique/Enter/Espaço;
     fecha ao navegar, clicar fora, Esc ou abrir outro grupo. */
  let flyout = null, flyoutBt = null;
  function alternarFlyout(id, bt, peloTeclado) {
    if (flyout && flyout.dataset.grupo === id) return fecharFlyout();
    abrirFlyout(id, bt, peloTeclado);
  }
  function abrirFlyout(id, bt, peloTeclado) {
    fecharFlyout(true);
    const g = G.grupos.find(x => x.id === id); if (!g) return;
    B7.UI.esconderDica();
    const el = document.createElement('div');
    el.className = 'nav-flyout';
    el.id = 'nav-flyout';
    el.dataset.grupo = id;
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', g.rotulo);
    const ativoId = (document.querySelector('.nav .ng a.on') || {}).dataset;
    el.innerHTML = '<div class="nf-tit">' + esc(g.rotulo) + '</div>' + g.ids.map(i => {
      const it = ITENS[i], on = ativoId && ativoId.nav === i;
      return '<a class="nf-item' + (on ? ' on' : '') + '"' + (on ? ' aria-current="page"' : '') + (it.rota ? ' href="' + it.rota + '" data-ir="' + it.rota + '"' : ' href="#" role="button"') + ' data-nf="' + i + '">' +
        IC[i] + '<span>' + esc(rotuloDe(i)) + '</span></a>';
    }).join('');
    document.body.appendChild(el);
    const rl = document.querySelector('.lateral').getBoundingClientRect(), rb = bt.getBoundingClientRect();
    const alt = el.offsetHeight;
    el.style.left = Math.round(rl.right + 8) + 'px';
    el.style.top = Math.round(Math.max(8, Math.min(rb.top - 6, window.innerHeight - alt - 8))) + 'px';
    requestAnimationFrame(() => el.classList.add('aberto'));
    flyout = el; flyoutBt = bt;
    bt.setAttribute('aria-expanded', 'true');
    bt.setAttribute('aria-controls', 'nav-flyout');
    bt.classList.add('aberto');
    el.querySelectorAll('[data-nf]').forEach(a => {
      if (ITENS[a.dataset.nf].acao === 'atalhos') a.onclick = e => { e.preventDefault(); fecharFlyout(); B7.UI.atalhos(); };
    });
    el.addEventListener('keydown', e => {
      const links = [...el.querySelectorAll('a')], i = links.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); const b = flyoutBt; fecharFlyout(); if (b) b.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); links[(i + 1) % links.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
    });
    if (peloTeclado) { const a = el.querySelector('a.on') || el.querySelector('a'); if (a) a.focus(); }
  }
  function fecharFlyout(imediato) {
    if (!flyout) return;
    const el = flyout, bt = flyoutBt;
    flyout = null; flyoutBt = null;
    if (bt) { bt.setAttribute('aria-expanded', 'false'); bt.classList.remove('aberto'); }
    if (imediato) { el.remove(); return; }
    el.classList.remove('aberto');
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 170);
  }
  document.addEventListener('mousedown', e => {
    if (flyout && !e.target.closest('.nav-flyout') && !e.target.closest('.ntr-bt')) fecharFlyout();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && flyout && !flyout.contains(document.activeElement)) fecharFlyout(); });
  window.addEventListener('resize', () => fecharFlyout(true));
  window.addEventListener('hashchange', () => { fecharFlyout(); setTimeout(() => sincronizar(false), 0); });

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
    barra.innerHTML = '<span class="ni-luz" aria-hidden="true"></span><ul>' + r.inferior.map(id =>
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
    const podeVerComo = ehAdmin() && B7.PreviaUsuario && B7.PreviaUsuario.abrirSeletor &&
      !(B7.Auth && B7.Auth.naContaDeOutro && B7.Auth.naContaDeOutro());
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
    moverLuz(barra);
  }
  /* A luz do item ativo é UMA pílula que desliza de um item para o outro
     (só transform). Primeira vez, sem transição: nasce no lugar. */
  let luzPosta = false;
  function moverLuz(barra) {
    const luz = barra.querySelector('.ni-luz'), on = barra.querySelector('[data-inf].on .ni-ic');
    if (!luz) return;
    if (!on) { barra.classList.remove('com-luz'); return; }
    /* mede pelo item (sem transform) e pela posição de layout do ícone:
       o ícone ativo sobe 1px e cresce, e isso não pode mexer na luz */
    const li = on.closest('li');
    const rb = barra.getBoundingClientRect(), rl = li ? li.getBoundingClientRect() : on.getBoundingClientRect();
    if (!rb.width || !rl.width) return;
    if (!luzPosta) barra.classList.add('sem-trans');
    const w = luz.offsetWidth || 52, h = luz.offsetHeight || 30;
    const x = rl.left - rb.left + rl.width / 2 - w / 2;
    const y = rl.top - rb.top + on.offsetTop + on.offsetHeight / 2 - h / 2;
    luz.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y - 8) + 'px,0)';
    barra.classList.add('com-luz');
    if (!luzPosta) { luz.offsetWidth; requestAnimationFrame(() => barra.classList.remove('sem-trans')); luzPosta = true; }
  }
  window.addEventListener('resize', () => { const b = document.getElementById('nav-inferior'); if (b) { luzPosta = false; moverLuz(b); } }, { passive: true });
  window.addEventListener('hashchange', () => { marcarAtivo(); if (folhaMais) folhaMais.fechar(); });

  /* Topo do celular: com conteúdo passando por baixo, o vidro fica mais
     denso e ganha um filete. Um ouvinte passivo, uma classe, um rAF. */
  (function () {
    let pedido = 0;
    document.addEventListener('scroll', e => {
      const p = e.target;
      if (!p || p.id !== 'painel-dashboard' || pedido) return;
      pedido = requestAnimationFrame(() => {
        pedido = 0;
        document.body.classList.toggle('painel-rolou', p.scrollTop > 6);
      });
    }, { capture: true, passive: true });
    window.addEventListener('hashchange', () => document.body.classList.remove('painel-rolou'));
  })();

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
    fecharFlyout(true);
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

  return { sincronizar, fecharFlyout, montar, montarLateral, montarInferior, aplicarLargura, marcarAtivo, resolver, itemDaRota, abrirMais, rotuloDe, ITENS };
})();
