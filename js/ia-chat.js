/* =====================================================================
   CHAT COM O ASSISTENTE (zzz78) — B7.Chat

   Um botão flutuante no canto inferior direito abre a conversa com a IA:
   perguntar, pedir ideias e recomendações. É a mesma camada de IA do B7
   (B7.IA.pedir → função b7-ia, tarefa "chat"): o navegador não fala com
   provedor nenhum e não conhece chave.

   • O assistente SÓ LÊ: recebe do servidor um recorte do que a pessoa
     enxerga (vídeo e design em aberto, gravações próximas, clientes) e,
     se um cliente for escolhido aqui, a estratégia e a linha dele.
   • As conversas ficam guardadas por pessoa (ia_conversas/ia_mensagens);
     só o dono lê. Quem grava é o servidor.
   • Nada é chamado em segundo plano: a IA só roda quando a pessoa envia.
   • Cliente do Portal não tem o botão. O administrador liga/desliga em
     Configurações → Admin → Inteligência artificial.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Chat = (function () {
  const esc = s => (B7.UI && B7.UI.esc ? B7.UI.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const IC = {
    ia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4.6l1.6 4.3a1.5 1.5 0 0 0 .9.9l4.3 1.6-4.3 1.6a1.5 1.5 0 0 0-.9.9L10 18.2l-1.6-4.3a1.5 1.5 0 0 0-.9-.9l-4.3-1.6 4.3-1.6a1.5 1.5 0 0 0 .9-.9z"/><path d="M18.2 14.6l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    novo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    hist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 5v4h4M12 8v4.5l3 1.8"/></svg>',
    enviar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7.5h12l-.8 10.7a2.5 2.5 0 0 1-2.5 2.3H9.3a2.5 2.5 0 0 1-2.5-2.3z"/><path d="M4 7.5h16M9.5 7.5V5.6a1.6 1.6 0 0 1 1.6-1.6h1.8a1.6 1.6 0 0 1 1.6 1.6v1.9M10.2 11.5v5M13.8 11.5v5"/></svg>',
    seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    alvo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    volta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>'
  };
  /* zzz85: sugestões diferentes com e sem cliente em foco */
  const SUGESTOES_GERAL = [
    'Resumo do meu dia',
    'O que está atrasado hoje?',
    'O que os clientes aprovaram esta semana?',
    'Quantos vídeos entregamos este mês?'
  ];
  const SUGESTOES_CLIENTE = [
    'Resuma a situação deste cliente',
    'Me dê 5 ideias de conteúdo para este cliente',
    'O que este cliente aprovou ou pediu ajuste?',
    'O que está programado para publicar esta semana?'
  ];

  /* estado da conversa aberta */
  const S = { aberto: false, vista: 'conversa', conversaId: null, clienteId: '', msgs: [], enviando: false, clientes: null, lista: null };
  let fab = null, painel = null;

  const pode = () => !!(B7.Auth && B7.Auth.usuario && B7.Auth.usuario() && !(B7.Auth.ehCliente && B7.Auth.ehCliente()) &&
    B7.IA && B7.IA.ligada && B7.IA.ligada('chat'));

  /* ---------------------------------------------------------- botão */
  function montar() {
    if (!document.body) return;
    if (!pode()) {
      if (fab) { fab.remove(); fab = null; }
      if (painel) { painel.remove(); painel = null; S.aberto = false; }
      document.body.classList.remove('tem-chat', 'chat-aberto');
      return;
    }
    if (fab && fab.isConnected) return;
    fab = document.createElement('button');
    fab.type = 'button'; fab.className = 'ch-fab'; fab.id = 'b7-chat-fab';
    fab.setAttribute('aria-label', 'Abrir o assistente'); fab.title = 'Assistente B7';
    fab.innerHTML = IC.ia;
    fab.onclick = () => (S.aberto ? fechar() : abrir());
    document.body.appendChild(fab);
    document.body.classList.add('tem-chat');
  }

  /* ---------------------------------------------------------- painel */
  function abrir() {
    if (!pode()) return;
    if (B7.Notif && B7.Notif.fechar) { try { B7.Notif.fechar(); } catch (e) {} }
    if (!painel || !painel.isConnected) {
      painel = document.createElement('section');
      painel.className = 'ch-painel'; painel.id = 'b7-chat';
      painel.setAttribute('role', 'dialog'); painel.setAttribute('aria-label', 'Assistente B7');
      document.body.appendChild(painel);
      painel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } });
    }
    S.aberto = true; S.vista = 'conversa';
    document.body.classList.add('chat-aberto');
    fab.setAttribute('aria-expanded', 'true');
    pintar();
    if (!S.clientes) carregarClientes();
    const ta = painel.querySelector('#ch-texto'); if (ta && window.matchMedia('(min-width: 761px)').matches) ta.focus();
  }
  function fechar() {
    if (painel) { const ta = painel.querySelector('#ch-texto'); if (ta && !S.enviando) S.rascunho = ta.value; }
    S.aberto = false;
    document.body.classList.remove('chat-aberto');
    if (fab) fab.setAttribute('aria-expanded', 'false');
    if (painel) { painel.classList.add('saindo'); const p = painel; setTimeout(() => { if (!S.aberto && p.isConnected) p.remove(); }, 200); }
  }

  async function carregarClientes() {
    try {
      const l = await B7.DB.listarClientes();
      S.clientes = (l || []).map(c => ({ id: c.id, nome: c.nome, logo: c.logo_url || '' }));
    } catch (e) { S.clientes = []; }
    if (S.aberto && S.vista === 'conversa') { const aberta = !!(painel && painel.querySelector('.ch-pop')); fecharClientes(); pintarTopo(); if (aberta) abrirClientes(); }
  }

  /* texto do assistente: escapado, com **negrito**, listas "- " e parágrafos */
  function formatar(texto) {
    const linhas = String(texto || '').split('\n');
    let html = '', emLista = false;
    const inline = s => esc(s).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    linhas.forEach(l => {
      const m = /^\s*(?:[-•*]|\d+[.)])\s+(.*)$/.exec(l);
      if (m) { if (!emLista) { html += '<ul>'; emLista = true; } html += '<li>' + inline(m[1]) + '</li>'; return; }
      if (emLista) { html += '</ul>'; emLista = false; }
      if (l.trim()) html += '<p>' + inline(l.replace(/^#+\s*/, '')) + '</p>';
    });
    if (emLista) html += '</ul>';
    return html;
  }

  /* zzz79: o cliente em foco deixou de ser a lista nativa do navegador
     (feia e fora do padrão) e virou um botão que abre uma lista própria,
     com busca e a marca de cada cliente. */
  const iniciais = n => String(n || '').trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0)).join('').toUpperCase() || '?';
  const marca = cl => '<span class="ch-cli-av">' + (cl && cl.logo ? '<img src="' + esc(cl.logo) + '" alt="" loading="lazy">' : esc(iniciais(cl && cl.nome))) + '</span>';
  function topoHTML() {
    const atual = (S.clientes || []).find(c => c.id === S.clienteId) || null;
    return '<span class="ch-ic">' + IC.ia + '</span>' +
      '<div class="ch-tit"><b>Assistente B7</b>' +
        '<button type="button" id="ch-cliente" class="ch-cliente' + (atual ? ' tem' : '') + '" aria-haspopup="listbox" aria-expanded="false"' + (S.enviando ? ' disabled' : '') + '>' +
          (atual ? marca(atual) : IC.alvo) + '<span>' + esc(atual ? atual.nome : 'Escolher cliente') + '</span>' + IC.seta + '</button></div>' +
      '<button type="button" class="ch-bt" id="ch-hist" title="Conversas anteriores" aria-label="Conversas anteriores">' + IC.hist + '</button>' +
      '<button type="button" class="ch-bt" id="ch-nova" title="Nova conversa" aria-label="Nova conversa">' + IC.novo + '</button>' +
      '<button type="button" class="ch-bt" id="ch-fechar" title="Fechar" aria-label="Fechar">' + IC.x + '</button>';
  }
  function fecharClientes() {
    const pop = painel && painel.querySelector('.ch-pop'); if (pop) pop.remove();
    const bt = painel && painel.querySelector('#ch-cliente'); if (bt) bt.setAttribute('aria-expanded', 'false');
  }
  function abrirClientes() {
    if (!painel || S.enviando) return;
    if (painel.querySelector('.ch-pop')) return fecharClientes();
    const bt = painel.querySelector('#ch-cliente'); bt.setAttribute('aria-expanded', 'true');
    const pop = document.createElement('div');
    pop.className = 'ch-pop';
    pop.innerHTML = '<div class="ch-pop-cx" role="dialog" aria-label="Cliente em foco">' +
      '<div class="ch-pop-cab"><b>Cliente em foco</b><small>a IA lê a estratégia e a linha editorial dele</small></div>' +
      '<input type="search" class="ch-pop-busca" placeholder="Buscar cliente…" aria-label="Buscar cliente" name="b7-chat-cliente" autocomplete="off" ' +
        'data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other">' +
      '<div class="ch-pop-lista" role="listbox"></div></div>';
    painel.appendChild(pop);
    const busca = pop.querySelector('.ch-pop-busca'), lista = pop.querySelector('.ch-pop-lista');
    const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const desenhar = () => {
      const t = norm(busca.value.trim());
      const cl = (S.clientes || []).filter(c => !t || norm(c.nome).includes(t));
      const linha = (id, nome, av, sub) => '<button type="button" class="ch-pop-it' + (id === S.clienteId ? ' on' : '') + '" role="option" aria-selected="' + (id === S.clienteId) + '" data-cli="' + esc(id) + '">' +
        av + '<span class="ch-pop-nm"><b>' + esc(nome) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
        (id === S.clienteId ? '<i class="ch-pop-ok">' + IC.ok + '</i>' : '') + '</button>';
      lista.innerHTML = (t ? '' : linha('', 'Sem cliente em foco', '<span class="ch-cli-av neutro">' + IC.alvo + '</span>', 'conversa geral e operação da agência')) +
        (cl.length ? cl.map(c => linha(c.id, c.nome, marca(c), '')).join('')
          : '<div class="ch-nada">' + (S.clientes ? 'Nenhum cliente com esse nome.' : 'Carregando…') + '</div>');
      lista.querySelectorAll('[data-cli]').forEach(b => b.onclick = () => {
        S.clienteId = b.dataset.cli; fecharClientes(); pintarTopo(); pintarCorpo();
        const ta = painel.querySelector('#ch-texto'); if (ta && window.matchMedia('(min-width: 761px)').matches) ta.focus();
      });
    };
    busca.oninput = desenhar;
    busca.onkeydown = e => {
      if (e.key === 'Escape') { e.stopPropagation(); fecharClientes(); bt.focus(); }
      if (e.key === 'Enter') { e.preventDefault(); const r = lista.querySelectorAll('[data-cli]'); if (r.length === 1 || (busca.value.trim() && r.length)) r[0].click(); }
    };
    pop.addEventListener('pointerdown', e => { if (e.target === pop) fecharClientes(); });
    desenhar();
    if (window.matchMedia('(min-width: 761px)').matches) busca.focus();
  }
  function pintarTopo() {
    const t = painel && painel.querySelector('.ch-topo'); if (!t || S.vista !== 'conversa') return;
    t.innerHTML = topoHTML(); ligarTopo();
  }
  function ligarTopo() {
    painel.querySelector('#ch-fechar').onclick = fechar;
    painel.querySelector('#ch-nova').onclick = () => { if (S.enviando) return; S.conversaId = null; S.msgs = []; pintar(); const ta = painel.querySelector('#ch-texto'); if (ta) ta.focus(); };
    painel.querySelector('#ch-hist').onclick = () => { if (S.enviando) return; S.vista = 'lista'; pintar(); carregarLista(); };
    painel.querySelector('#ch-cliente').onclick = abrirClientes;
  }

  function corpoHTML() {
    if (!S.msgs.length) {
      const temCli = !!S.clienteId;
      return '<div class="ch-vazio"><span class="ch-vazio-ic">' + IC.ia + '</span>' +
        '<b>Como posso ajudar?</b>' +
        '<p>Pergunte sobre prazos, entregas, aprovações e publicações, ou peça ideias e recomendações. ' +
          (temCli ? 'Estou olhando a estratégia e a linha editorial do cliente escolhido.' : 'Escolha um cliente lá em cima para respostas sob medida.') + '</p>' +
        '<div class="ch-sugs">' + (temCli ? SUGESTOES_CLIENTE : SUGESTOES_GERAL).map(s =>
          '<button type="button" class="ch-sug">' + esc(s) + '</button>').join('') + '</div></div>';
    }
    return S.msgs.map((m, i) => '<div class="ch-msg ' + (m.papel === 'user' ? 'eu' : 'ia') + (m.erro ? ' erro' : '') + '">' +
      (m.papel === 'user' ? '<p>' + esc(m.texto).replace(/\n/g, '<br>') + '</p>' : formatar(m.texto)) + '</div>' +
      (m.acoes || []).map((a, j) => acaoHTML(a, i + ':' + j)).join('')).join('') +
      (S.enviando ? (S.parcial
        ? '<div class="ch-msg ia ch-fluindo" id="ch-fluxo">' + formatar(S.parcial) + '</div>'
        : '<div class="ch-msg ia ch-pensando" id="ch-fluxo" aria-label="Escrevendo"><i></i><i></i><i></i></div>') : '');
  }
  /* zzz123: a resposta aparece enquanto é escrita. Só a bolha em curso é
     redesenhada (uma vez por quadro), não a conversa inteira; a rolagem
     acompanha se a pessoa estava no fim. */
  let quadroFluxo = 0;
  function pintarFluxo() {
    if (quadroFluxo) return;
    quadroFluxo = requestAnimationFrame(() => {
      quadroFluxo = 0;
      const c = painel && painel.querySelector('.ch-corpo'), b = c && c.querySelector('#ch-fluxo');
      if (!b || !S.enviando || !S.parcial) return;
      const noFim = c.scrollHeight - c.scrollTop - c.clientHeight < 60;
      b.className = 'ch-msg ia ch-fluindo'; b.removeAttribute('aria-label');
      b.innerHTML = formatar(S.parcial);
      if (noFim) c.scrollTop = c.scrollHeight;
    });
  }
  /* zzz89: a IA só PROPÕE. Este cartão é a confirmação: nada é criado
     antes de a pessoa tocar em "Criar demanda". */
  const dataBR = iso => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : 'sem prazo');
  function acaoHTML(a, i) {
    const linha = (r, v) => '<div class="ch-ac-l"><span>' + r + '</span><b>' + esc(v) + '</b></div>';
    return '<div class="ch-acao' + (a.estado ? ' ' + a.estado : '') + '">' +
      '<div class="ch-ac-cab">' + IC.novo + '<b>Criar demanda de vídeo</b></div>' +
      linha('Cliente', a.cliente_nome) + linha('Título', a.titulo) + linha('Prazo', dataBR(a.prazo)) +
      (a.estado === 'feito' ? '<div class="ch-ac-fim ok">Demanda criada. <a href="#/video">Abrir a Edição de vídeo</a></div>'
        : a.estado === 'cancelado' ? '<div class="ch-ac-fim">Cancelado. Nada foi criado.</div>'
        : (a.erro ? '<div class="ch-ac-fim erro">' + esc(a.erro) + '</div>' : '') +
          '<div class="ch-ac-bts"><button type="button" class="ch-ac-nao" data-acao-nao="' + i + '"' + (a.estado === 'indo' ? ' disabled' : '') + '>Cancelar</button>' +
          '<button type="button" class="ch-ac-ok" data-acao-ok="' + i + '"' + (a.estado === 'indo' ? ' disabled' : '') + '>' + (a.estado === 'indo' ? 'Criando…' : 'Criar demanda') + '</button></div>') +
    '</div>';
  }
  /* zzz124: uma mensagem pode trazer várias propostas; "i:j" = mensagem i, proposta j */
  const acaoDe = ref => { const p = String(ref).split(':'), m = S.msgs[Number(p[0])]; return (m && m.acoes && m.acoes[Number(p[1])]) || null; };
  async function confirmarAcao(ref) {
    const a = acaoDe(ref);
    if (!a || a.estado === 'indo' || a.estado === 'feito') return;
    a.estado = 'indo'; a.erro = ''; pintarCorpo();
    try {
      await B7.DB.criarDemandaVideo({ clienteId: a.cliente_id, titulo: a.titulo, prazo: a.prazo || null });
      a.estado = 'feito';
      if (B7.UI && B7.UI.toast) B7.UI.toast('Demanda de vídeo criada.');
    } catch (e) {
      a.estado = ''; a.erro = (e && e.message) || 'Não foi possível criar a demanda.';
    }
    pintarCorpo();
  }

  function pintarCorpo() {
    const c = painel && painel.querySelector('.ch-corpo'); if (!c) return;
    c.innerHTML = corpoHTML();
    c.querySelectorAll('.ch-sug').forEach(b => b.onclick = () => enviar(b.textContent));
    c.querySelectorAll('[data-acao-ok]').forEach(b => b.onclick = () => confirmarAcao(b.dataset.acaoOk));
    c.querySelectorAll('[data-acao-nao]').forEach(b => b.onclick = () => { const a = acaoDe(b.dataset.acaoNao); if (a) { a.estado = 'cancelado'; pintarCorpo(); } });
    c.scrollTop = c.scrollHeight;
  }

  function pintar() {
    if (!painel) return;
    painel.classList.remove('saindo');
    if (S.vista === 'lista') {
      painel.innerHTML = '<header class="ch-topo">' +
          '<button type="button" class="ch-bt" id="ch-volta" aria-label="Voltar para a conversa">' + IC.volta + '</button>' +
          '<div class="ch-tit"><b>Conversas</b><small>só você vê as suas</small></div>' +
          '<button type="button" class="ch-bt" id="ch-fechar" aria-label="Fechar">' + IC.x + '</button></header>' +
        '<div class="ch-corpo ch-lista" id="ch-lista"><div class="ch-nada">Carregando…</div></div>';
      painel.querySelector('#ch-volta').onclick = () => { S.vista = 'conversa'; pintar(); };
      painel.querySelector('#ch-fechar').onclick = fechar;
      return;
    }
    painel.innerHTML = '<header class="ch-topo">' + topoHTML() + '</header>' +
      '<div class="ch-corpo" aria-live="polite"></div>' +
      '<form class="ch-form" autocomplete="off">' +
        '<textarea id="ch-texto" rows="1" maxlength="2000" placeholder="Pergunte ou peça uma ideia…" aria-label="Mensagem para o assistente" ' +
          'name="b7-chat-mensagem" autocomplete="off" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other"></textarea>' +
        '<button type="submit" class="ch-enviar" id="ch-enviar" aria-label="Enviar">' + IC.enviar + '</button>' +
      '</form>' +
      '<p class="ch-aviso">A IA pode errar. Confira antes de usar. Ela não altera nada sozinha: só propõe, e você confirma.</p>';
    ligarTopo();
    pintarCorpo();
    const form = painel.querySelector('.ch-form'), ta = painel.querySelector('#ch-texto');
    const ajustar = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; };
    ta.addEventListener('input', ajustar);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : enviar(ta.value); }
    });
    form.onsubmit = e => { e.preventDefault(); enviar(ta.value); };
    if (S.rascunho) { ta.value = S.rascunho; ajustar(); }
  }

  /* ---------------------------------------------------------- enviar */
  async function enviar(textoBruto) {
    const texto = String(textoBruto || '').trim();
    if (!texto || S.enviando || !painel) return;
    const ta = painel.querySelector('#ch-texto');
    S.msgs = S.msgs.filter(m => !m.erro);
    S.msgs.push({ papel: 'user', texto });
    S.enviando = true; S.rascunho = '';
    if (ta) { ta.value = ''; ta.style.height = 'auto'; ta.disabled = true; }
    const bt = painel.querySelector('#ch-enviar'); if (bt) bt.disabled = true;
    pintarTopo(); pintarCorpo();

    const dados = { texto, cliente_id: S.clienteId || null };
    if (S.conversaId) dados.conversa_id = S.conversaId;
    S.parcial = '';
    const r = await B7.IA.pedir('chat', dados, { aoTrecho: pedaco => { S.parcial += pedaco; pintarFluxo(); } });

    S.enviando = false; S.parcial = '';
    if (r && r.ok) {
      if (r.conversa_id) S.conversaId = r.conversa_id;
      S.msgs.push({ papel: 'assistant', texto: r.texto, acoes: (r.acoes && r.acoes.length) ? r.acoes : (r.acao ? [r.acao] : []) });
      S.lista = null;
    } else {
      /* a pergunta não foi guardada: sai da conversa e volta para o campo */
      S.msgs.pop();
      S.rascunho = texto;
      S.msgs.push({ papel: 'assistant', erro: true, texto: (r && r.mensagem) || 'Não foi possível responder agora. Tente de novo.' });
    }
    if (!painel || !painel.isConnected || S.vista !== 'conversa') return;
    const ta2 = painel.querySelector('#ch-texto'), bt2 = painel.querySelector('#ch-enviar');
    if (ta2) { ta2.disabled = false; if (S.rascunho) ta2.value = S.rascunho; if (window.matchMedia('(min-width: 761px)').matches) ta2.focus(); }
    if (bt2) bt2.disabled = false;
    pintarTopo(); pintarCorpo();
  }

  /* ---------------------------------------------------------- histórico */
  async function carregarLista() {
    const cx = painel && painel.querySelector('#ch-lista'); if (!cx) return;
    try {
      if (!S.lista) {
        const { data, error } = await B7.sb.from('ia_conversas').select('id, titulo, cliente_id, updated_at').order('updated_at', { ascending: false }).limit(40);
        if (error) throw error;
        S.lista = data || [];
      }
    } catch (e) { cx.innerHTML = '<div class="ch-nada">Não foi possível carregar as conversas.</div>'; return; }
    if (!painel || S.vista !== 'lista') return;
    const nomeCli = id => { const c = (S.clientes || []).find(x => x.id === id); return c ? c.nome : ''; };
    cx.innerHTML = S.lista.length ? S.lista.map(c =>
      '<div class="ch-item' + (c.id === S.conversaId ? ' on' : '') + '">' +
        '<button type="button" class="ch-item-ab" data-id="' + esc(c.id) + '"><b>' + esc(c.titulo || 'Conversa') + '</b>' +
          '<small>' + esc([nomeCli(c.cliente_id), B7.UI && B7.UI.quando ? B7.UI.quando(c.updated_at) : ''].filter(Boolean).join(' · ')) + '</small></button>' +
        '<button type="button" class="ch-bt ch-item-ap" data-apagar="' + esc(c.id) + '" aria-label="Apagar conversa" title="Apagar">' + IC.lixo + '</button></div>').join('')
      : '<div class="ch-nada">Nenhuma conversa guardada ainda.</div>';
    cx.querySelectorAll('[data-id]').forEach(b => b.onclick = () => abrirConversa(b.dataset.id));
    cx.querySelectorAll('[data-apagar]').forEach(b => b.onclick = () => apagar(b.dataset.apagar));
  }
  async function abrirConversa(id) {
    const cx = painel.querySelector('#ch-lista');
    try {
      const { data, error } = await B7.sb.from('ia_mensagens').select('papel, texto, created_at').eq('conversa_id', id).order('created_at', { ascending: true }).limit(200);
      if (error) throw error;
      const c = (S.lista || []).find(x => x.id === id) || {};
      S.conversaId = id; S.clienteId = c.cliente_id || ''; S.rascunho = '';
      S.msgs = (data || []).map(m => ({ papel: m.papel, texto: m.texto }));
      S.vista = 'conversa'; pintar();
    } catch (e) { if (cx) cx.insertAdjacentHTML('afterbegin', '<div class="ch-nada">Não foi possível abrir esta conversa.</div>'); }
  }
  function apagar(id) {
    const fazer = async () => {
      try {
        const { error } = await B7.sb.from('ia_conversas').delete().eq('id', id);
        if (error) throw error;
        S.lista = (S.lista || []).filter(c => c.id !== id);
        if (S.conversaId === id) { S.conversaId = null; S.msgs = []; }
        carregarLista();
      } catch (e) { if (B7.UI && B7.UI.toast) B7.UI.toast('Não foi possível apagar a conversa.'); }
    };
    if (B7.UI && B7.UI.confirmar) B7.UI.confirmar({ titulo: 'Apagar esta conversa?', texto: 'As mensagens dela somem de vez.', rotulo: 'Apagar', perigo: true, aoConfirmar: fazer });
    else fazer();
  }

  /* Clicar fora do painel ou trocar de tela fecha o assistente. O que
     estava sendo escrito fica guardado para a próxima abertura. */
  document.addEventListener('pointerdown', e => {
    if (!S.aberto || !painel) return;
    const t = e.target;
    if (!t || !t.isConnected || !t.closest) return;
    if (t.closest('#b7-chat, #b7-chat-fab, .b7-atu')) return;
    fechar();
  }, true);
  window.addEventListener('hashchange', () => { if (S.aberto) fechar(); });

  document.addEventListener('DOMContentLoaded', () => setTimeout(montar, 0));
  return { montar, abrir, fechar, _formatar: formatar };
})();
