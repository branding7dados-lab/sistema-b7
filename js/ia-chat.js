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
    ia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    novo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    hist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 5v4h4M12 8v4.5l3 1.8"/></svg>',
    enviar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7"/></svg>',
    volta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>'
  };
  const SUGESTOES = [
    'O que está atrasado hoje?',
    'Quais gravações tenho nos próximos dias?',
    'Me dê 5 ideias de conteúdo para este cliente',
    'Resuma a situação deste cliente'
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
    S.aberto = false;
    document.body.classList.remove('chat-aberto');
    if (fab) fab.setAttribute('aria-expanded', 'false');
    if (painel) { painel.classList.add('saindo'); const p = painel; setTimeout(() => { if (!S.aberto && p.isConnected) p.remove(); }, 200); }
  }

  async function carregarClientes() {
    try {
      const l = await B7.DB.listarClientes();
      S.clientes = (l || []).map(c => ({ id: c.id, nome: c.nome }));
    } catch (e) { S.clientes = []; }
    if (S.aberto && S.vista === 'conversa') pintarTopo();
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

  function topoHTML() {
    const cl = S.clientes || [];
    return '<span class="ch-ic">' + IC.ia + '</span>' +
      '<div class="ch-tit"><b>Assistente B7</b>' +
        '<select id="ch-cliente" class="ch-cliente" aria-label="Cliente em foco na conversa"' + (S.enviando ? ' disabled' : '') + '>' +
          '<option value="">Sem cliente em foco</option>' +
          cl.map(c => '<option value="' + esc(c.id) + '"' + (c.id === S.clienteId ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('') +
        '</select></div>' +
      '<button type="button" class="ch-bt" id="ch-hist" title="Conversas anteriores" aria-label="Conversas anteriores">' + IC.hist + '</button>' +
      '<button type="button" class="ch-bt" id="ch-nova" title="Nova conversa" aria-label="Nova conversa">' + IC.novo + '</button>' +
      '<button type="button" class="ch-bt" id="ch-fechar" title="Fechar" aria-label="Fechar">' + IC.x + '</button>';
  }
  function pintarTopo() {
    const t = painel && painel.querySelector('.ch-topo'); if (!t || S.vista !== 'conversa') return;
    t.innerHTML = topoHTML(); ligarTopo();
  }
  function ligarTopo() {
    painel.querySelector('#ch-fechar').onclick = fechar;
    painel.querySelector('#ch-nova').onclick = () => { if (S.enviando) return; S.conversaId = null; S.msgs = []; pintar(); const ta = painel.querySelector('#ch-texto'); if (ta) ta.focus(); };
    painel.querySelector('#ch-hist').onclick = () => { if (S.enviando) return; S.vista = 'lista'; pintar(); carregarLista(); };
    const sel = painel.querySelector('#ch-cliente');
    sel.onchange = () => { S.clienteId = sel.value; pintarCorpo(); };
  }

  function corpoHTML() {
    if (!S.msgs.length) {
      const temCli = !!S.clienteId;
      return '<div class="ch-vazio"><span class="ch-vazio-ic">' + IC.ia + '</span>' +
        '<b>Como posso ajudar?</b>' +
        '<p>Pergunte sobre prazos, demandas e gravações, ou peça ideias e recomendações. ' +
          (temCli ? 'Estou olhando a estratégia e a linha editorial do cliente escolhido.' : 'Escolha um cliente lá em cima para respostas sob medida.') + '</p>' +
        '<div class="ch-sugs">' + SUGESTOES.filter(s => temCli || s.indexOf('este cliente') < 0).map(s =>
          '<button type="button" class="ch-sug">' + esc(s) + '</button>').join('') + '</div></div>';
    }
    return S.msgs.map(m => '<div class="ch-msg ' + (m.papel === 'user' ? 'eu' : 'ia') + (m.erro ? ' erro' : '') + '">' +
      (m.papel === 'user' ? '<p>' + esc(m.texto).replace(/\n/g, '<br>') + '</p>' : formatar(m.texto)) + '</div>').join('') +
      (S.enviando ? '<div class="ch-msg ia ch-pensando" aria-label="Escrevendo"><i></i><i></i><i></i></div>' : '');
  }
  function pintarCorpo() {
    const c = painel && painel.querySelector('.ch-corpo'); if (!c) return;
    c.innerHTML = corpoHTML();
    c.querySelectorAll('.ch-sug').forEach(b => b.onclick = () => enviar(b.textContent));
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
      '<p class="ch-aviso">A IA pode errar. Confira antes de usar. Ela só lê o B7: não altera nada.</p>';
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
    const r = await B7.IA.pedir('chat', dados);

    S.enviando = false;
    if (r && r.ok) {
      if (r.conversa_id) S.conversaId = r.conversa_id;
      S.msgs.push({ papel: 'assistant', texto: r.texto });
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

  document.addEventListener('DOMContentLoaded', () => setTimeout(montar, 0));
  return { montar, abrir, fechar, _formatar: formatar };
})();
