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
      "painel": "<svg viewBox=\"0 0 24 24\"><path class=\"f\" d=\"M3.5 17.5a8.5 8.5 0 1 1 17 0v.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z\"/><path class=\"d\" d=\"M12 16.2l3.5-4.7M12 16.2h.01\"/></svg>",
      "gestao": "<svg viewBox=\"0 0 24 24\"><rect class=\"f\" x=\"3.5\" y=\"12\" width=\"4\" height=\"8\" rx=\"1.6\"/><rect class=\"f\" x=\"10\" y=\"7.5\" width=\"4\" height=\"12.5\" rx=\"1.6\"/><rect class=\"f\" x=\"16.5\" y=\"3.5\" width=\"4\" height=\"16.5\" rx=\"1.6\"/></svg>",
      "central": "<svg viewBox=\"0 0 24 24\"><rect class=\"f\" x=\"3.5\" y=\"3.5\" width=\"7.2\" height=\"7.2\" rx=\"2.3\"/><rect class=\"f\" x=\"13.3\" y=\"3.5\" width=\"7.2\" height=\"7.2\" rx=\"2.3\"/><rect class=\"f\" x=\"3.5\" y=\"13.3\" width=\"7.2\" height=\"7.2\" rx=\"2.3\"/><rect class=\"f\" x=\"13.3\" y=\"13.3\" width=\"7.2\" height=\"7.2\" rx=\"2.3\"/></svg>",
      "clientes": "<svg viewBox=\"0 0 24 24\"><circle class=\"f\" cx=\"9\" cy=\"8\" r=\"3.4\"/><path class=\"f\" d=\"M2.8 19.2a6.2 6.2 0 0 1 12.4 0 .8.8 0 0 1-.8.8H3.6a.8.8 0 0 1-.8-.8z\"/><path class=\"o\" d=\"M15.8 4.9a3.4 3.4 0 0 1 0 6.2M17.9 13.7a6 6 0 0 1 3.4 5.5.8.8 0 0 1-.8.8h-1.3\"/></svg>",
      "publicacoes": "<svg viewBox=\"0 0 24 24\"><rect class=\"f\" x=\"3.5\" y=\"4.5\" width=\"17\" height=\"16\" rx=\"3.6\"/><path class=\"d\" d=\"M3.5 9.5h17\"/><rect class=\"d\" x=\"9.8\" y=\"12.3\" width=\"4.4\" height=\"4.4\" rx=\"1.3\"/><path class=\"o\" d=\"M8 2.8v3M16 2.8v3\"/></svg>",
      "aprovacoes": "<svg viewBox=\"0 0 24 24\"><circle class=\"f\" cx=\"12\" cy=\"12\" r=\"8.6\"/><path class=\"d\" d=\"M8.2 12.3l2.6 2.6 5-5.4\"/></svg>",
      "kanban": "<svg viewBox=\"0 0 24 24\"><rect class=\"f\" x=\"3.5\" y=\"4\" width=\"4.7\" height=\"16\" rx=\"1.9\"/><rect class=\"f\" x=\"9.65\" y=\"4\" width=\"4.7\" height=\"11\" rx=\"1.9\"/><rect class=\"f\" x=\"15.8\" y=\"4\" width=\"4.7\" height=\"7\" rx=\"1.9\"/></svg>",
      "design": "<svg viewBox=\"0 0 24 24\"><rect class=\"f\" x=\"3.5\" y=\"4.5\" width=\"17\" height=\"15\" rx=\"3.6\"/><path class=\"d\" d=\"M4.6 16.4l4-4a1.5 1.5 0 0 1 2.1 0l2.3 2.3 1.6-1.6a1.5 1.5 0 0 1 2.1 0l2.7 2.7M15.4 9.2h.01\"/></svg>",
      "video": "<svg viewBox=\"0 0 24 24\"><rect class=\"f\" x=\"2.5\" y=\"6.5\" width=\"12.5\" height=\"11\" rx=\"3.1\"/><path class=\"f\" d=\"M15 10.7l4.8-3a.8.8 0 0 1 1.2.7v7.2a.8.8 0 0 1-1.2.7l-4.8-3z\"/></svg>",
      "gravacoes": "<svg viewBox=\"0 0 24 24\"><rect class=\"f\" x=\"3.5\" y=\"4.5\" width=\"17\" height=\"15.5\" rx=\"3.2\"/><path class=\"d\" d=\"M3.5 9.6h17M8.4 4.8L6.8 9.4M13.2 4.8l-1.6 4.6M18 4.8l-1.6 4.6\"/></svg>",
      "calendario": "<svg viewBox=\"0 0 24 24\"><rect class=\"f\" x=\"3.5\" y=\"4.5\" width=\"17\" height=\"16\" rx=\"3.6\"/><path class=\"d\" d=\"M3.5 9.5h17M8 13.6h.01M12 13.6h.01M16 13.6h.01M8 17h.01M12 17h.01\"/><path class=\"o\" d=\"M8 2.8v3M16 2.8v3\"/></svg>",
      "oportunidades": "<svg viewBox=\"0 0 24 24\"><path class=\"f\" d=\"M10 4.6l1.6 4.3a1.5 1.5 0 0 0 .9.9l4.3 1.6-4.3 1.6a1.5 1.5 0 0 0-.9.9L10 18.2l-1.6-4.3a1.5 1.5 0 0 0-.9-.9l-4.3-1.6 4.3-1.6a1.5 1.5 0 0 0 .9-.9z\"/><path class=\"f\" d=\"M18.2 14.6l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7zM18.6 3.6l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z\"/></svg>",
      "whatsapp": "<svg viewBox=\"0 0 24 24\"><path class=\"f\" d=\"M4.2 19.8l1.1-3.9A8.2 8.2 0 1 1 8.4 19z\"/><path class=\"d\" d=\"M9.4 9c.4 2.4 2.3 4.6 5.4 5.7\"/></svg>",
      "trends": "<svg viewBox=\"0 0 24 24\"><path class=\"f\" d=\"M3.5 16.5l5-5.2 3.6 3.4 7.4-7.7\"/><path class=\"d\" d=\"M14.5 7h5v5\"/></svg>",
      "roteiros": "<svg viewBox=\"0 0 24 24\"><path class=\"f\" d=\"M7 3.5h6.1a2 2 0 0 1 1.4.6l4.4 4.4a2 2 0 0 1 .6 1.4V18a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 18V6A2.5 2.5 0 0 1 7 3.5z\"/><path class=\"d\" d=\"M8.5 12.6h7M8.5 16.2h4.5\"/></svg>",
      "linhas": "<svg viewBox=\"0 0 24 24\"><rect class=\"f\" x=\"3.5\" y=\"4.5\" width=\"17\" height=\"15\" rx=\"3.6\"/><path class=\"d\" d=\"M7.6 9.6h.01M7.6 14.4h.01M11 9.6h5.5M11 14.4h5.5\"/></svg>",
      "semanas": "<svg viewBox=\"0 0 24 24\"><rect class=\"f\" x=\"3.5\" y=\"4.5\" width=\"17\" height=\"16\" rx=\"3.6\"/><path class=\"d\" d=\"M3.5 9.5h17M9 15l2 2 3.9-4.1\"/><path class=\"o\" d=\"M8 2.8v3M16 2.8v3\"/></svg>",
      "arquivados": "<svg viewBox=\"0 0 24 24\"><rect class=\"f\" x=\"3\" y=\"4.5\" width=\"18\" height=\"4.6\" rx=\"1.9\"/><path class=\"f\" d=\"M4.8 9.1h14.4v8.4a2.5 2.5 0 0 1-2.5 2.5H7.3a2.5 2.5 0 0 1-2.5-2.5z\"/><path class=\"d\" d=\"M10 13.2h4\"/></svg>",
      "lixeira": "<svg viewBox=\"0 0 24 24\"><path class=\"f\" d=\"M6 7.5h12l-.8 10.7a2.5 2.5 0 0 1-2.5 2.3H9.3a2.5 2.5 0 0 1-2.5-2.3z\"/><path class=\"o\" d=\"M4 7.5h16M9.5 7.5V5.6a1.6 1.6 0 0 1 1.6-1.6h1.8a1.6 1.6 0 0 1 1.6 1.6v1.9\"/><path class=\"d\" d=\"M10.2 11.5v5M13.8 11.5v5\"/></svg>",
      "usuarios": "<svg viewBox=\"0 0 24 24\"><circle class=\"f\" cx=\"9.3\" cy=\"8\" r=\"3.4\"/><path class=\"f\" d=\"M3.0999999999999996 19.2a6.2 6.2 0 0 1 12.4 0 .8.8 0 0 1-.8.8H3.9a.8.8 0 0 1-.8-.8z\"/><path class=\"o\" d=\"M19 8.2v5.2M21.6 10.8h-5.2\"/></svg>",
      "config": "<svg viewBox=\"0 0 24 24\"><path class=\"f\" d=\"M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z\"/><circle class=\"d\" cx=\"12\" cy=\"12\" r=\"3.2\"/></svg>",
      "atalhos": "<svg viewBox=\"0 0 24 24\"><rect class=\"f\" x=\"2.5\" y=\"5.5\" width=\"19\" height=\"13\" rx=\"3.2\"/><path class=\"d\" d=\"M7 10h.01M10.3 10h.01M13.7 10h.01M17 10h.01M8 14.2h8\"/></svg>",
      "mais": "<svg viewBox=\"0 0 24 24\"><circle class=\"f\" cx=\"12\" cy=\"12\" r=\"8.6\"/><path class=\"d\" d=\"M8 12h.01M12 12h.01M16 12h.01\"/></svg>",
      "vercomo": "<svg viewBox=\"0 0 24 24\"><path class=\"f\" d=\"M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12z\"/><circle class=\"d\" cx=\"12\" cy=\"12\" r=\"3\"/></svg>"
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
    /* zzz266: Gestão — painel do dono, saúde dos clientes e pedidos (só admin) */
    gestao:      { rota: '#/gestao', rotulo: 'Gestão', curto: 'Gestão', id: 'nav-gestao', base: ['gestao'], pode: () => ehAdmin() },
    painel:      { rota: '#/painel', rotulo: 'Painel', curto: 'Painel', id: 'nav-painel', base: ['painel'],
                   pode: () => !!(perm() && perm().painelElegivel()) },
    /* Central: para o Designer (papel) a rota "#/" é a Central de Design;
       para o videomaker puro "#/" redireciona ao Painel, então some. */
    /* zzz269: o Panorama é a visão de gestão do mês, cliente a cliente —
       para a produção (fora o designer, cujo "#/" é a Central de Design)
       só aparece para quem tem o módulo Clientes */
    central:     { rota: '#/', rotulo: 'Panorama', curto: 'Panorama', base: [''],
                   pode: () => pode('') && !(papel() === 'videomaker' && perm().painelElegivel()) &&
                     (ehAdmin() || papel() === 'designer' || !perm().temModulo || perm().temModulo('clientes')) },
    clientes:    { rota: '#/clientes', rotulo: 'Clientes', curto: 'Clientes', base: ['clientes', 'cliente'], pode: () => pode('clientes') },
    publicacoes: { rota: '#/publicacoes', rotulo: 'Publicações do Dia', curto: 'Publicações', id: 'nav-publicacoes', base: ['publicacoes'], pode: () => pode('publicacoes') },
    aprovacoes:  { rota: '#/aprovacoes', rotulo: 'Aprovações', curto: 'Aprovações', id: 'nav-aprovacoes', base: ['aprovacoes'], pode: () => pode('aprovacoes') },
    kanban:      { rota: '#/kanban', rotulo: 'Produção', curto: 'Produção', id: 'nav-kanban', base: ['kanban'], pode: () => pode('kanban') },
    design:      { rota: '#/design', rotulo: 'Design', curto: 'Design', id: 'nav-design', base: ['design'], pode: () => pode('design') },
    video:       { rota: '#/video', rotulo: 'Edição de vídeo', curto: 'Vídeo', id: 'nav-video', base: ['video'], pode: () => pode('video') },
    gravacoes:   { rota: '#/gravacoes', rotulo: 'Gravações', curto: 'Gravações', base: ['gravacoes', 'gravacao', 'diaria'], pode: () => pode('gravacoes') },
    calendario:  { rota: '#/calendario', rotulo: 'Calendário', curto: 'Calendário', id: 'nav-calendario', base: ['calendario'], pode: () => pode('calendario') },
    oportunidades: { rota: '#/oportunidades', rotulo: 'Oportunidades', curto: 'Oportunidades', id: 'nav-oportunidades', base: ['oportunidades'], pode: () => pode('oportunidades') },
    /* zzz170: WhatsApp dentro do sistema (js/whatsapp.js) — só equipe */
    whatsapp:    { rota: '#/whatsapp', rotulo: 'WhatsApp', curto: 'WhatsApp', id: 'nav-whatsapp', base: ['whatsapp'],
                   pode: () => !!(B7.Auth && B7.Auth.usuario() && !B7.Auth.ehCliente()) && pode('whatsapp') },
    trends:      { rota: '#/trends', rotulo: 'Trends', curto: 'Trends', id: 'nav-trends', base: ['trends'], pode: () => pode('trends') },
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
                    'roteiros', 'trends', 'linhas', 'semanas'];
  /* Atalhos saiu da barra permanente: continua no menu da conta e na tecla "?" */
  /* zzz200: Usuários e acessos saiu da lateral e do "Mais": fica em
     Configurações → Admin → Pessoas e no menu da conta */
  const FERRAMENTAS = ['arquivados', 'lixeira', 'config'];

  function rotuloDe(id) {
    if (id === 'central' && papel() === 'designer') return 'Central de Design';
    /* zzz269: para a produção, os nomes falam do trabalho, não da gestão */
    if (!ehAdmin() && PRODUCAO[id]) return PRODUCAO[id];
    return ITENS[id].rotulo;
  }
  const PRODUCAO = { central: 'Visão do mês' };
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
    /* zzz119 — "Principal é só o meu Painel" (Kevin). O Panorama saiu do
       grupo Principal e abre a Operação. Exceções, para ninguém ficar sem
       casa: o designer (para ele "#/" é a Central de Design, a tela de
       trabalho dele) e quem não tem Painel (aí o Panorama é a casa). */
    const temPainel = permitido('painel');
    const centralEhCasa = papel() === 'designer' || !temPainel;
    const principal = (centralEhCasa ? ['painel', 'central', 'gestao', 'whatsapp'] : ['painel', 'gestao', 'whatsapp']).filter(permitido);
    const usados = new Set(principal);
    const trabalho = intercalar(funcoes.map(f => MEU_TRABALHO[f] || [])).filter(id => permitido(id) && !usados.has(id));
    trabalho.forEach(id => usados.add(id));
    const operacao = (centralEhCasa ? [] : ['central']).concat(OPERACAO).filter(id => permitido(id) && !usados.has(id));
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
  const SVGN = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const IC_GRUPO = {
    principal: SVGN('<path d="M4 10.8L12 4l8 6.8V18a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18z"/><path d="M9.8 20.5v-5a1 1 0 0 1 1-1h2.4a1 1 0 0 1 1 1v5"/>'),
    trabalho: SVGN('<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>'),
    operacao: SVGN('<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>'),
    ferramentas: SVGN('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>')
  };
  const CHEVRON = '<svg class="ng-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const CHAVE_GRUPO = 'b7-nav-grupo';
  let G = { grupos: [], aberto: null, rota: null, funcoes: [] };

  function gruposDe(r) {
    /* zzz269: o administrador vê a casa como gestão; a equipe, como produção */
    const adm = ehAdmin();
    return [
      { id: 'principal', rotulo: adm ? 'Principal' : 'Meu dia', ids: r.principal },
      { id: 'trabalho', rotulo: 'Meu trabalho', ids: r.trabalho },
      { id: 'operacao', rotulo: adm ? (r.trabalho.length ? 'Operação' : 'Produção') : (r.trabalho.length ? 'Produção da equipe' : 'Produção'), ids: r.operacao },
      { id: 'ferramentas', rotulo: adm ? 'Mais ferramentas' : 'Mais', ids: r.ferramentas }
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
    /* zzz115 — todos os grupos ficam abertos ao mesmo tempo (antes só um
       abria por vez e a barra ficava quase vazia). Cada grupo pode ser
       recolhido sozinho pelo título; a escolha fica guardada. */
    nav.classList.add('multi');
    const fechados = lerFechados();
    nav.querySelectorAll('.ng').forEach(sec => sec.classList.toggle('fechado', fechados.includes(sec.dataset.grupo)));
    nav.querySelectorAll('.ng-cab').forEach(b => b.onclick = () => {
      const sec = b.closest('.ng');
      sec.classList.toggle('fechado');
      try { localStorage.setItem(CHAVE_FECHADOS, JSON.stringify([...nav.querySelectorAll('.ng.fechado')].map(s => s.dataset.grupo))); } catch (e) {}
      ariaMulti(); marcarGrupoAtivo();
    });
    /* zzz116: recolhida, a barra mostra os ícones de cada destino (não
       mais um botão por grupo); o nome aparece numa dica ao passar */
    /* zzz118: ordem de cada peça de cima para baixo, para a cascata */
    nav.querySelectorAll('.ng-cab, .ng a').forEach((el, i) => el.style.setProperty('--n', i));
    nav.querySelectorAll('.ng a').forEach(a => {
      const dica = () => { if (document.body.classList.contains('recolhida')) B7.UI.dica(a, a.getAttribute('aria-label') || a.textContent.trim()); };
      a.addEventListener('mouseenter', dica);
      a.addEventListener('focus', dica);
      a.addEventListener('mouseleave', () => B7.UI.esconderDica());
      a.addEventListener('blur', () => B7.UI.esconderDica());
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
  const CHAVE_FECHADOS = 'b7-nav-fechados';
  function lerFechados() {
    try { const v = JSON.parse(localStorage.getItem(CHAVE_FECHADOS) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  /* com todos abertos, "expandido" é simplesmente "não recolhido" */
  function ariaMulti() {
    const nav = document.querySelector('.nav.multi'); if (!nav) return;
    nav.querySelectorAll('.ng').forEach(sec => {
      const cab = sec.querySelector('.ng-cab'); if (cab) cab.setAttribute('aria-expanded', String(!sec.classList.contains('fechado')));
    });
  }
  function abrirGrupo(id, manual) {
    G.aberto = id;
    /* a rota entrou num grupo que a pessoa tinha recolhido: ele abre,
       para a tela atual nunca ficar escondida */
    if (id && !manual) {
      const alvo = document.querySelector('.nav.multi .ng[data-grupo="' + id + '"]');
      if (alvo) alvo.classList.remove('fechado');
    }
    document.querySelectorAll('.nav .ng').forEach(sec => {
      const ab = sec.dataset.grupo === id;
      sec.classList.toggle('aberto', ab);
      const cab = sec.querySelector('.ng-cab');
      cab.setAttribute('aria-expanded', String(ab));
    });
    if (manual) { try { if (id) localStorage.setItem(CHAVE_GRUPO, id); } catch (e) {} }
    ariaMulti();
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
      const escondido = sec.closest('.nav.multi') ? sec.classList.contains('fechado') : !sec.classList.contains('aberto');
      if (leitor) leitor.textContent = tem && escondido ? ' (tela atual está aqui)' : '';
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
     documento — não alarga o contêiner de rolagem da barra).

     zzz48: esta função não é chamada, e é de propósito. Quando a barra
     recolhe, styles/nav.css esconde o acordeão inteiro
     (`body.recolhida .nav[data-shell="interno"] .nav-acordeao{display:none}`)
     e quem aparece é o trilho, cujos botões já ganham dica em
     montarLateral. Fica aqui porque volta a servir no dia em que a barra
     recolhida mostrar os itens em vez dos grupos. */
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

  /* ------------------------------------------------ folha "Mais"
     zzz243 — quarta versão (Kevin: "faltou a identidade da B7"; a lista
     do iOS com ícones de arco-íris saiu). Topo no degradê da marca com o
     símbolo, saudação e o "Meu dia"; busca; "Usados por você" (os que a
     pessoa mais abre por aqui); grupos com título visível e ícones que
     percorrem o degradê da B7 de cima para baixo. */
  let folhaMais = null;
  const USO_MAIS = 'b7-mais-uso';
  const IC_EXTRA = {
    ajuda: '<svg viewBox="0 0 24 24"><circle class="f" cx="12" cy="12" r="8.6"/><path class="d" d="M9.6 9.6a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.4M12 16.8h.01"/></svg>'
  };
  function lerUso() { try { return JSON.parse(localStorage.getItem(USO_MAIS) || '{}') || {}; } catch (e) { return {}; } }
  function contarUso(id) {
    try { const u = lerUso(); u[id] = (u[id] || 0) + 1; localStorage.setItem(USO_MAIS, JSON.stringify(u)); } catch (e) {}
  }
  const semAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function abrirMais() {
    const r = resolver(); if (!r) return;
    const ativo = itemDaRota();
    const fora = id => !r.inferior.includes(id);
    const ehCli = !!(B7.Auth && B7.Auth.ehCliente && B7.Auth.ehCliente());
    /* destinos extras que não moram na lateral */
    const EXTRA = {
      ajuda: { rota: '#/ajuda', rotulo: 'Ajuda', ic: IC_EXTRA.ajuda },
      prefs: { rota: '#/config', rotulo: 'Configurações', ic: IC.config }
    };
    const dados = id => ITENS[id] ? { rota: ITENS[id].rota, rotulo: rotuloDe(id), ic: IC[id], acao: ITENS[id].acao } : EXTRA[id];
    const naRota = id => { const d = dados(id); return d && d.rota && (location.hash || '#/').split('?')[0] === d.rota; };
    const item = (id, extra) => {
      const d = dados(id), on = ativo === id || (EXTRA[id] && naRota(id));
      return '<a class="nm-item' + (on ? ' on' : '') + '"' + (on ? ' aria-current="page"' : '') +
        (d.rota ? ' href="' + d.rota + '"' : ' href="#" role="button"') + ' data-mais="' + id + '"' + (extra || '') +
        ' data-busca="' + esc(semAcento(d.rotulo)) + '">' +
        '<span class="nm-ic" aria-hidden="true">' + d.ic + '</span><span class="nm-tx">' + esc(d.rotulo) + '</span>' +
        (on ? '<span class="nm-aqui">Você está aqui</span>' : '') + '</a>';
    };
    const secao = (titulo, ids, extraHtml) => (ids.length || extraHtml) ? '<section class="nm-secao"><h4>' + titulo + '</h4><div class="nm-grade">' +
      ids.map(id => item(id)).join('') + (extraHtml || '') + '</div></section>' : '';
    const gestao = r.ferramentas.filter(id => ['usuarios', 'config'].includes(id));
    const ferr = r.ferramentas.filter(id => !gestao.includes(id) && id !== 'atalhos');
    const podeVerComo = ehAdmin() && B7.PreviaUsuario && B7.PreviaUsuario.abrirSeletor &&
      !(B7.Auth && B7.Auth.naContaDeOutro && B7.Auth.naContaDeOutro());
    /* quem não é administrador também chega às Configurações por aqui */
    const extrasFerr = (!gestao.includes('config') && !ehCli ? ['prefs'] : []).concat(B7.Ajuda ? ['ajuda'] : []);
    const html =
      /* Principal e Meu trabalho num grupo só: quase tudo deles já está na barra */
      secao('Para você', r.principal.concat(r.trabalho.filter(id => !r.principal.includes(id))).filter(fora)) +
      secao(r.trabalho.length ? 'Operação' : 'Produção', r.operacao.filter(fora)) +
      secao('Gestão', gestao) +
      secao('Ferramentas', ferr.concat(extrasFerr),
        podeVerComo ? '<a class="nm-item" href="#" role="button" data-vercomo data-busca="visualizar como outra pessoa"><span class="nm-ic" aria-hidden="true">' + IC.vercomo + '</span><span class="nm-tx">Visualizar como…</span></a>' : '');
    /* usados por você: até 4, só quem não está na barra de baixo */
    const todos = [].concat(r.principal, r.trabalho, r.operacao, r.ferramentas).filter(fora);
    const uso = lerUso();
    const usados = Object.keys(uso).filter(id => todos.includes(id) && uso[id] >= 2 && id !== 'atalhos')
      .sort((a, b) => uso[b] - uso[a]).slice(0, 4);
    const u = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
    const primeiro = String((u && (u.nome || u.username)) || '').trim().split(/\s+/)[0];
    const h = new Date().getHours();
    const sauda = (h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite') + (primeiro ? ', ' + esc(primeiro) : '');
    let dataTx = '';
    try { dataTx = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); dataTx = dataTx.charAt(0).toUpperCase() + dataTx.slice(1); } catch (e) {}
    const temHoje = B7.Hoje && !ehCli;
    const bt = document.querySelector('#nav-inferior [data-inf="mais"]');
    if (bt) bt.setAttribute('aria-expanded', 'true');
    folhaMais = B7.UI.modal(
      '<header class="nm-topo">' +
        '<span class="nm-topo-marca" aria-hidden="true"></span>' +
        '<div class="nm-topo-tx"><small>' + esc(dataTx) + '</small><h3>' + sauda + '</h3></div>' +
        '<button type="button" class="nm-fechar" data-fecha aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        (temHoje ? '<button type="button" class="nm-hoje" data-hoje><span class="nm-hoje-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>' +
          '<span><b>Meu dia em 30 segundos</b><small>O que entra no ar, gravações e atrasos</small></span></button>' : '') +
      '</header>' +
      '<label class="nm-busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>' +
        '<input type="search" placeholder="Procurar uma tela" autocomplete="off" enterkeyhint="go" aria-label="Procurar uma tela"></label>' +
      '<nav class="nm-corpo" aria-label="Mais destinos">' +
        (usados.length ? '<section class="nm-usados"><h4>Usados por você</h4><div class="nm-usados-fila">' +
          usados.map(id => '<a class="nm-chip" href="' + ITENS[id].rota + '" data-mais="' + id + '"><span class="nm-ic" aria-hidden="true">' + IC[id] + '</span>' + esc(curtoDe(id)) + '</a>').join('') +
          '</div></section>' : '') +
        (html || '<p class="nm-vazio">Nada além da barra.</p>') +
        '<p class="nm-vazio nm-sem" hidden>Nenhuma tela com esse nome.</p>' +
      '</nav>',
      { classe: 'tp-folha nm-folha', aoFechar: () => { folhaMais = null; if (bt) bt.setAttribute('aria-expanded', 'false'); } });
    /* posição no degradê da marca (0 = violeta, 1 = magenta) e a cascata */
    const linhas = [...folhaMais.querySelectorAll('.nm-secao .nm-item')];
    linhas.forEach((a, i) => {
      a.style.setProperty('--i', Math.min(i, 16));
      a.style.setProperty('--k', linhas.length > 1 ? (i / (linhas.length - 1)).toFixed(3) : '0');
    });
    folhaMais.querySelectorAll('[data-mais]').forEach(a => a.onclick = e => {
      const id = a.dataset.mais, d = dados(id);
      e.preventDefault();
      if (ITENS[id]) contarUso(id);
      const m = folhaMais; if (m) m.fechar();
      if (d.acao === 'atalhos') return B7.UI.atalhos();
      location.hash = d.rota;
    });
    const hj = folhaMais.querySelector('[data-hoje]');
    if (hj) hj.onclick = () => { const m = folhaMais; if (m) m.fechar(); setTimeout(() => B7.Hoje.abrir(), 120); };
    const vc = folhaMais.querySelector('[data-vercomo]');
    if (vc) vc.onclick = e => { e.preventDefault(); const m = folhaMais; if (m) m.fechar(); B7.PreviaUsuario.abrirSeletor(); };
    /* busca: filtra as linhas, some com grupos vazios; Enter abre a primeira */
    const caixa = folhaMais.querySelector('.modal');
    const q = folhaMais.querySelector('.nm-busca input'), corpo = folhaMais.querySelector('.nm-corpo');
    if (q) {
      q.oninput = () => {
        const t = semAcento(q.value).trim();
        /* a folha não encolhe enquanto filtra (nada pula embaixo do dedo) */
        if (caixa && !caixa.style.height) caixa.style.height = caixa.offsetHeight + 'px';
        corpo.classList.toggle('nm-procurando', !!t);
        let algum = false;
        corpo.querySelectorAll('.nm-secao').forEach(sec => {
          let n = 0;
          sec.querySelectorAll('.nm-item').forEach(a => { const ok = !t || a.dataset.busca.includes(t); a.hidden = !ok; if (ok) n++; });
          sec.hidden = !n; if (n) algum = true;
        });
        const sem = corpo.querySelector('.nm-sem'); if (sem) sem.hidden = algum || !t;
      };
      q.onkeydown = e => {
        if (e.key !== 'Enter') return;
        const prim = corpo.querySelector('.nm-secao:not([hidden]) .nm-item:not([hidden])');
        if (prim) { e.preventDefault(); prim.click(); }
      };
    }
    /* foco no próprio diálogo (leitor de tela anuncia; Tab entra na
       grade) — sem anel de foco pintado num item ao tocar e sem abrir o
       teclado sozinho */
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
  let luzX = null;      /* última posição da luz (para saber o sentido da viagem) */
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
    /* zzz102: a luz cobre o item inteiro (ícone + nome), como a cápsula
       da barra de abas do iOS — largura do item, centrada na altura dele */
    const w = Math.round(rl.width);
    luz.style.width = w + 'px';
    const h = luz.offsetHeight || 54;
    const x = rl.left - rb.left - barra.clientLeft;
    const y = rl.top - rb.top - barra.clientTop + (rl.height - h) / 2;
    /* zzj: viajando entre itens, a luz estica no sentido do movimento e
       deixa um rastro; o ícone que recebe dá um pulinho */
    const xAnt = luzX;
    luzX = Math.round(x);
    if (luzPosta && xAnt != null && Math.abs(luzX - xAnt) > 4 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      luz.dataset.dir = luzX > xAnt ? '1' : '-1';
      luz.classList.remove('viaja'); void luz.offsetWidth; luz.classList.add('viaja');
      clearTimeout(luz._viaja); luz._viaja = setTimeout(() => luz.classList.remove('viaja'), 600);
      const svg = on.querySelector('svg');
      if (svg) { svg.classList.remove('pula'); void svg.offsetWidth; svg.classList.add('pula'); setTimeout(() => svg.classList.remove('pula'), 650); }
    }
    luz.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
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
