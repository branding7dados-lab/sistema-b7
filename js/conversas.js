/* =====================================================================
   CONVERSAS (zzz134) — o chat interno da equipe, no jeito do WhatsApp.

   Um botão no topo, ao lado do sino, abre um painel lateral com a equipe
   e as conversas. Conversa direta entre duas pessoas: texto, áudio,
   imagem e arquivo; "online", "visto por último", "digitando…",
   "gravando áudio…"; um tique (enviado), dois (entregue), dois coloridos
   (lido); contador de não lidas; som ao chegar; aviso e push pelo mesmo
   caminho das notificações.

   De onde vem cada coisa:
     · mensagens e tiques — tabelas chat_* (migration_conversas.sql). Toda
       escrita passa por função do banco, que confere quem chama; a
       leitura obedece à regra "só quem participa".
     · chegada na hora — Realtime nas mesmas tabelas; sem Realtime, a
       lista se renova a cada minuto.
     · online / digitando / gravando — canal de presença do Realtime.
       Nada disso é gravado no banco: vale enquanto a aba está visível.
     · visto por último — perfis.last_seen_at (js/presenca.js) ou a hora
       em que a pessoa saiu do canal, o que for mais recente.
     · áudio e anexos — espaço privado "chat-arquivos", aberto só por link
       temporário para quem está na conversa.

   Não é o assistente de IA (js/ia-chat.js, B7.Chat): aqui é gente com
   gente. Cliente do Portal não entra.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Conversas = (function () {
  const esc = s => B7.UI.esc(s);
  const pad = n => String(n).padStart(2, '0');
  const BUCKET = 'chat-arquivos';
  const MAX_ARQUIVO = 10 * 1024 * 1024, MAX_AUDIO_MS = 180000, PAGINA = 40;
  const ROT_FUNCAO = { admin: 'Administração', coordenador: 'Coordenação', designer: 'Design', videomaker: 'Vídeo' };

  const sv = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const IC = {
    conversa: sv('<path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16h-5.2L8 19.4V16H7a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M8.5 9h7M8.5 12h4.5"/>'),
    voltar: sv('<path d="M15 6l-6 6 6 6"/>'),
    fechar: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
    enviar: sv('<path d="M4.5 12L19.5 5l-4.2 14-3.3-5.7z"/><path d="M12 13.3L19.5 5"/>'),
    mic: sv('<rect x="9" y="3.5" width="6" height="10.5" rx="3"/><path d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0M12 17.4V20.5M9 20.5h6"/>'),
    clipe: sv('<path d="M19 11.5l-6.9 6.9a4.4 4.4 0 0 1-6.2-6.2l7.3-7.3a3 3 0 0 1 4.2 4.2l-7.2 7.2a1.5 1.5 0 0 1-2.1-2.1l6.5-6.5"/>'),
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.6v12.8a.8.8 0 0 0 1.2.7l10.3-6.4a.8.8 0 0 0 0-1.4L9.2 4.9A.8.8 0 0 0 8 5.6z"/></svg>',
    pausa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>',
    arquivo: sv('<path d="M7 3.5h6.1a2 2 0 0 1 1.4.6l4.4 4.4a2 2 0 0 1 .6 1.4V18a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 18V6A2.5 2.5 0 0 1 7 3.5z"/><path d="M13.5 3.8V8a1.5 1.5 0 0 0 1.5 1.5h4.2"/>'),
    lixo: sv('<path d="M5 7h14M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M7 7l.8 11.2a2 2 0 0 0 2 1.8h4.4a2 2 0 0 0 2-1.8L17 7"/>'),
    um: '<svg viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7.5l3.4 3.4L15 3.2"/></svg>',
    dois: '<svg viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 7.5l3.4 3.4L12.5 3.2M8.6 10.3l.6.6L18.5 3.2"/></svg>',
    relogio: sv('<circle cx="12" cy="12" r="8"/><path d="M12 7.8V12l2.6 1.8"/>')
  };

  /* ------------------------------------------------------------ estado */
  let painel = null, aberto = false, montado = false;
  let pessoas = new Map();          /* id → perfil */
  let conversas = new Map();        /* outroId → linha de chat_lista */
  let porConversa = new Map();      /* conversaId → outroId */
  let atual = null;                 /* { outroId, conversaId, msgs, temMais, carregando } */
  let online = new Set(), saiuEm = new Map();
  let atividade = new Map();        /* outroId → { estado, ate } */
  let canalDados = null, canalPresenca = null, canalDe = null;
  let anexo = null;                 /* { arquivo, url, imagem } esperando o Enter */
  let grav = null;                  /* gravação em curso */
  let pendente = null;              /* conversa pedida antes de a lista chegar */
  const urls = new Map();           /* path → { url, ate } */
  let tocando = null;               /* <audio> em reprodução */
  let timers = { lista: 0, pessoas: 0, atividade: 0 };

  const eu = () => { const u = B7.Auth && B7.Auth.usuario && B7.Auth.usuario(); return u ? u.id : null; };
  const liberado = () => {
    const A = B7.Auth; if (!A || !A.usuario || !A.usuario()) return false;
    if (A.ehCliente && A.ehCliente()) return false;
    if (A.naContaDeOutro && A.naContaDeOutro()) return false;       /* dentro da conta de outra pessoa não se conversa por ela */
    if (A.emSimulacao && A.emSimulacao()) return false;
    return !B7.Recursos || B7.Recursos.ligado('conversas');
  };

  /* --------------------------------------------------------- formatação */
  const hora = iso => { const d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const chaveDia = iso => { const d = new Date(iso); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  function rotDia(iso) {
    const d = new Date(iso), h = new Date(), o = new Date(); o.setDate(h.getDate() - 1);
    if (d.toDateString() === h.toDateString()) return 'Hoje';
    if (d.toDateString() === o.toDateString()) return 'Ontem';
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  function quandoCurto(iso) {
    if (!iso) return '';
    const d = new Date(iso), h = new Date(), o = new Date(); o.setDate(h.getDate() - 1);
    if (d.toDateString() === h.toDateString()) return hora(iso);
    if (d.toDateString() === o.toDateString()) return 'ontem';
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
  }
  const mmss = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + pad(s % 60); };
  const tamanho = b => b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round((b || 0) / 1024)) + ' KB';
  /* texto do usuário: escapado, com quebra de linha preservada e endereço virando link */
  function textoRico(t) {
    return esc(t || '').replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}'"])/g, u => '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>');
  }
  function previa(m) {
    if (!m) return '';
    if (m.apagada || m.apagada_em) return 'Mensagem apagada';
    if (m.tipo === 'audio') return '🎤 Mensagem de voz';
    if (m.tipo === 'imagem') return '📷 ' + (m.texto || 'Imagem');
    if (m.tipo === 'arquivo') return '📎 ' + (m.arquivo_nome || 'Arquivo');
    return m.texto || '';
  }

  /* ------------------------------------------------------- online e visto */
  const estaOnline = id => online.has(id);
  function vistoEm(id) {
    const p = pessoas.get(id), a = p && p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0, b = saiuEm.get(id) || 0;
    return Math.max(a, b) || 0;
  }
  function statusDe(id) {
    const at = atividade.get(id);
    if (at && at.ate > Date.now()) return { cls: 'ativa', tx: at.estado === 'gravando' ? 'gravando áudio…' : 'digitando…' };
    if (estaOnline(id)) return { cls: 'online', tx: 'online' };
    const v = vistoEm(id);
    if (!v) return { cls: '', tx: 'ainda não entrou no B7' };
    const d = new Date(v), h = new Date(), o = new Date(); o.setDate(h.getDate() - 1);
    const dia = d.toDateString() === h.toDateString() ? 'hoje' : d.toDateString() === o.toDateString() ? 'ontem' : 'em ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
    return { cls: '', tx: 'visto por último ' + dia + ' às ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) };
  }

  /* ------------------------------------------------------------- dados */
  async function carregarPessoas() {
    try {
      const { data } = await B7.sb.from('perfis').select('id, nome, username, papel, funcao, avatar_url, last_seen_at')
        .neq('papel', 'cliente').eq('estado', 'ativa').order('nome', { ascending: true });
      if (data) pessoas = new Map(data.map(p => [p.id, p]));
    } catch (e) {}
  }
  async function carregarLista() {
    if (!liberado()) return;
    try {
      const linhas = await B7.DB.rpc('chat_lista', {});
      conversas = new Map(); porConversa = new Map();
      (linhas || []).forEach(l => { conversas.set(l.outro_id, l); porConversa.set(l.conversa_id, l.outro_id); });
    } catch (e) { return; }
    pintarBadge();
    if (aberto && !atual) pintarLista();
    if (aberto && atual) pintarTiques();
    if (pendente) { const c = pendente; pendente = null; abrirConversa(c); }
  }
  const totalNaoLidas = () => { let n = 0; conversas.forEach(c => { n += c.nao_lidas || 0; }); return n; };

  async function urlDe(path) {
    if (!path) return null;
    const c = urls.get(path);
    if (c && c.ate > Date.now() + 60000) return c.url;
    try {
      const { data } = await B7.sb.storage.from(BUCKET).createSignedUrl(path, 3600);
      if (data && data.signedUrl) { urls.set(path, { url: data.signedUrl, ate: Date.now() + 3600000 }); return data.signedUrl; }
    } catch (e) {}
    return null;
  }

  /* ------------------------------------------------------ tempo real */
  function ligarCanais() {
    const id = eu(); if (!id || !B7.sb || !B7.sb.channel) return;
    if (canalDe === id && canalDados && canalPresenca) return;
    desligarCanais();
    canalDe = id;
    canalDados = B7.DB.canal('conversas-' + id, [
      { event: 'INSERT', table: 'chat_mensagens' }, { event: 'UPDATE', table: 'chat_mensagens' },
      { event: 'UPDATE', table: 'chat_participantes' }, { event: 'INSERT', table: 'chat_participantes' }
    ], aoMudarBanco);
    try {
      canalPresenca = B7.sb.channel('b7-conversas-presenca', { config: { presence: { key: id }, broadcast: { self: false } } });
      canalPresenca
        .on('presence', { event: 'sync' }, () => {
          const st = canalPresenca.presenceState() || {}, agora = new Set(Object.keys(st));
          online.forEach(x => { if (!agora.has(x)) saiuEm.set(x, Date.now()); });
          online = agora; online.delete(id);
          pintarPresenca();
        })
        .on('broadcast', { event: 'atividade' }, ({ payload }) => {
          if (!payload || payload.para !== id || !payload.de) return;
          if (payload.estado) atividade.set(payload.de, { estado: payload.estado, ate: Date.now() + 5000 });
          else atividade.delete(payload.de);
          pintarPresenca();
        })
        .subscribe(st => { if (st === 'SUBSCRIBED') marcarPresenca(); });
    } catch (e) { canalPresenca = null; }
  }
  function desligarCanais() {
    if (canalDados) { B7.DB.fecharCanal(canalDados); canalDados = null; }
    if (canalPresenca) { B7.DB.fecharCanal(canalPresenca); canalPresenca = null; }
    canalDe = null; online = new Set();
  }
  /* "online" = com o B7 na frente; aba escondida sai da presença */
  function marcarPresenca() {
    if (!canalPresenca) return;
    try { if (document.hidden) canalPresenca.untrack(); else canalPresenca.track({ em: Date.now() }); } catch (e) {}
  }
  let ultimoSinal = 0;
  function sinalizar(estado, forcar) {
    if (!canalPresenca || !atual) return;
    const agora = Date.now();
    if (estado && !forcar && agora - ultimoSinal < 2500) return;
    ultimoSinal = estado ? agora : 0;
    try { canalPresenca.send({ type: 'broadcast', event: 'atividade', payload: { de: eu(), para: atual.outroId, estado: estado || null } }); } catch (e) {}
  }

  function aoMudarBanco(p) {
    const n = p && p.new; if (!n) return;
    if (p.table === 'chat_participantes') {
      /* conversa nova comigo, ou o outro recebeu/leu: a lista traz tudo */
      if (atual && n.conversa_id === atual.conversaId && n.perfil_id === atual.outroId) {
        const c = conversas.get(atual.outroId);
        if (c) { c.outro_lida_ate = n.lida_ate; c.outro_entregue_ate = n.entregue_ate; pintarTiques(); }
      }
      carregarListaLogo();
      return;
    }
    if (p.eventType === 'UPDATE') {           /* mensagem apagada */
      if (atual && n.conversa_id === atual.conversaId) {
        const i = atual.msgs.findIndex(m => m.id === n.id);
        if (i >= 0) { atual.msgs[i] = n; pintarMensagens(false); }
      }
      carregarListaLogo();
      return;
    }
    /* mensagem nova */
    const minha = n.autor_id === eu();
    const naTela = aberto && atual && atual.conversaId === n.conversa_id;
    if (naTela) {
      if (!atual.msgs.some(m => m.id === n.id)) { atual.msgs.push(n); pintarMensagens(true); }
      if (!minha) { atividade.delete(n.autor_id); pintarPresenca(); if (!document.hidden) marcarLida(n.conversa_id); else avisar(n); }
    } else if (!minha) {
      atividade.delete(n.autor_id); pintarPresenca();
      avisar(n);
    }
    if (!minha) B7.DB.rpc('chat_marcar_entregue', {}).catch(() => {});
    carregarListaLogo();
  }
  let tLista = 0;
  function carregarListaLogo() { clearTimeout(tLista); tLista = setTimeout(carregarLista, 250); }

  /* chegou mensagem e a conversa não está na frente: som e um aviso curto na tela */
  function avisar(m) {
    const p = pessoas.get(m.autor_id);
    try { if (B7.Notif && B7.Notif.prefs && B7.Notif.prefs().som && B7.Notif.tocarSom) B7.Notif.tocarSom(); } catch (e) {}
    document.querySelectorAll('.conv-bt').forEach(b => { b.classList.remove('toca'); void b.offsetWidth; b.classList.add('toca'); });
    if (document.hidden) return;
    B7.UI.toast(((p && (p.nome || p.username)) || 'Mensagem nova') + ': ' + previa(m).slice(0, 80),
      { acao: 'Abrir', aoClicar: () => abrirConversa(m.conversa_id) });
  }

  async function marcarLida(conversaId) {
    const outro = porConversa.get(conversaId), c = outro && conversas.get(outro);
    if (c) { c.nao_lidas = 0; pintarBadge(); }
    try { await B7.DB.rpc('chat_marcar_lida', { p_conversa: conversaId }); } catch (e) {}
    try { if (B7.Notif && B7.Notif.atualizar) B7.Notif.atualizar(); } catch (e) {}
  }

  /* -------------------------------------------------------- botão do topo */
  function montar() {
    if (!liberado()) { document.querySelectorAll('.conv-bt').forEach(b => b.remove()); desligarTudo(); return; }
    document.querySelectorAll('.topo .area-sessao').forEach(area => {
      if (area.parentNode.querySelector('.conv-bt')) return;
      const bt = document.createElement('button');
      bt.type = 'button'; bt.className = 'ico conv-bt'; bt.title = 'Conversas'; bt.setAttribute('aria-label', 'Conversas');
      bt.setAttribute('aria-haspopup', 'dialog'); bt.setAttribute('aria-expanded', 'false');
      bt.innerHTML = IC.conversa + '<span class="conv-n"></span>';
      bt.onclick = e => { e.stopPropagation(); aberto ? fechar() : abrir(); };
      const sino = area.parentNode.querySelector('.sino');
      area.parentNode.insertBefore(bt, sino || area);
    });
    if (!montado) {
      montado = true;
      document.addEventListener('visibilitychange', () => {
        marcarPresenca();
        if (!document.hidden) { carregarLista(); if (aberto && atual) marcarLida(atual.conversaId); }
      });
      window.addEventListener('online', () => { ligarCanais(); carregarLista(); });
      document.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || !aberto || document.querySelector('.fundo-modal')) return;
        if (grav) { pararGravacao(true); return; }
        if (atual) voltar(); else fechar();
      });
      timers.lista = setInterval(() => { if (!document.hidden) carregarLista(); }, 60000);
      timers.pessoas = setInterval(() => { if (!document.hidden && aberto) carregarPessoas().then(pintarPresenca); }, 120000);
      timers.atividade = setInterval(() => {
        let mudou = false; const agora = Date.now();
        atividade.forEach((v, k) => { if (v.ate <= agora) { atividade.delete(k); mudou = true; } });
        if (mudou) pintarPresenca();
      }, 1500);
    }
    ligarCanais();
    carregarPessoas().then(carregarLista).then(() => B7.DB.rpc('chat_marcar_entregue', {}).catch(() => {}));
  }
  function desligarTudo() {
    desligarCanais();
    if (painel) { painel.remove(); painel = null; }
    aberto = false; atual = null; document.body.classList.remove('conv-aberta');
  }
  function pintarBadge() {
    const n = totalNaoLidas();
    document.querySelectorAll('.conv-bt').forEach(b => {
      const s = b.querySelector('.conv-n'); if (!s) return;
      s.textContent = n > 99 ? '99+' : n ? String(n) : ''; s.hidden = !n;
      b.setAttribute('aria-label', n ? 'Conversas, ' + n + (n === 1 ? ' mensagem não lida' : ' mensagens não lidas') : 'Conversas');
    });
  }

  /* ------------------------------------------------------------- painel */
  function abrir(conversaId) {
    if (!liberado()) return;
    if (!painel) {
      painel = document.createElement('aside');
      painel.className = 'conv-painel'; painel.id = 'b7-conversas';
      painel.setAttribute('role', 'dialog'); painel.setAttribute('aria-label', 'Conversas');
      document.body.appendChild(painel);
    }
    /* o assistente de IA ocupa o mesmo canto: um de cada vez */
    try { if (B7.Chat && B7.Chat.fechar) B7.Chat.fechar(); } catch (e) {}
    aberto = true; document.body.classList.add('conv-aberta');
    document.querySelectorAll('.conv-bt').forEach(b => b.setAttribute('aria-expanded', 'true'));
    if (conversaId) abrirConversa(conversaId); else if (atual) pintarConversa(); else pintarLista();
    carregarPessoas().then(() => { if (aberto && !atual) pintarLista(); else pintarPresenca(); });
    carregarLista();
  }
  function fechar() {
    if (grav) pararGravacao(true);
    pararAudio(); largarAnexo();
    if (atual) sinalizar(null, true);
    aberto = false; atual = null;
    document.body.classList.remove('conv-aberta');
    if (painel) { painel.remove(); painel = null; }
    document.querySelectorAll('.conv-bt').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  function voltar() {
    if (grav) pararGravacao(true);
    pararAudio(); largarAnexo();
    if (atual) sinalizar(null, true);
    atual = null; pintarLista(); carregarLista();
  }

  const avatar = (p, cls) => '<span class="conv-av' + (cls ? ' ' + cls : '') + '">' + B7.UI.avatarPessoa(p || {}, 'conv-av-img') +
    '<i class="conv-ponto' + (p && estaOnline(p.id) ? ' on' : '') + '" data-ponto="' + esc((p && p.id) || '') + '"></i></span>';

  function ordemLista() {
    const meu = eu(), l = [...pessoas.values()].filter(p => p.id !== meu);
    return l.sort((a, b) => {
      const ca = conversas.get(a.id), cb = conversas.get(b.id);
      const ta = ca && ca.ultima_em ? new Date(ca.ultima_em).getTime() : 0, tb = cb && cb.ultima_em ? new Date(cb.ultima_em).getTime() : 0;
      return tb - ta || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });
  }
  function linhaPrevia(p) {
    const c = conversas.get(p.id), at = atividade.get(p.id);
    if (at && at.ate > Date.now()) return '<span class="conv-ativa">' + (at.estado === 'gravando' ? 'gravando áudio…' : 'digitando…') + '</span>';
    if (!c || !c.ultima) return '<span class="conv-fraca">' + esc(ROT_FUNCAO[p.funcao] || ROT_FUNCAO[p.papel] || 'Equipe') + '</span>';
    const m = c.ultima, minha = m.autor_id === eu();
    return (minha && !m.apagada ? '<i class="conv-tq ' + estadoTique(m.created_at, c) + '">' + (estadoTique(m.created_at, c) === 'enviada' ? IC.um : IC.dois) + '</i>' : '') +
      '<span>' + esc(previa(m)) + '</span>';
  }
  function pintarLista() {
    if (!painel) return;
    const l = ordemLista();
    painel.innerHTML = '<header class="conv-topo"><h2>Conversas</h2>' +
        '<button type="button" class="conv-ic" data-fechar aria-label="Fechar conversas">' + IC.fechar + '</button></header>' +
      '<div class="conv-lista" role="list">' + (l.length ? l.map(p => {
        const c = conversas.get(p.id), n = (c && c.nao_lidas) || 0;
        return '<button type="button" class="conv-linha' + (n ? ' nova' : '') + '" role="listitem" data-pessoa="' + esc(p.id) + '">' + avatar(p) +
          '<span class="conv-linha-tx"><b>' + esc(p.nome || p.username || '') + '</b><small data-previa="' + esc(p.id) + '">' + linhaPrevia(p) + '</small></span>' +
          '<span class="conv-linha-lado"><time>' + esc(c && c.ultima_em ? quandoCurto(c.ultima_em) : '') + '</time>' +
            (n ? '<i class="conv-conta">' + (n > 99 ? '99+' : n) + '</i>' : '') + '</span></button>';
      }).join('') : '<p class="conv-vazio">Ninguém mais da equipe por aqui ainda.</p>') + '</div>';
    painel.querySelector('[data-fechar]').onclick = fechar;
    painel.querySelectorAll('[data-pessoa]').forEach(b => b.onclick = () => abrirCom(b.dataset.pessoa));
  }

  /* presença, digitando e visto: só os pedaços que mudam, sem redesenhar a tela */
  function pintarPresenca() {
    if (!painel) return;
    painel.querySelectorAll('[data-ponto]').forEach(i => i.classList.toggle('on', estaOnline(i.dataset.ponto)));
    painel.querySelectorAll('[data-previa]').forEach(s => { const p = pessoas.get(s.dataset.previa); if (p) s.innerHTML = linhaPrevia(p); });
    const st = painel.querySelector('#conv-status');
    if (st && atual) { const s = statusDe(atual.outroId); st.textContent = s.tx; st.className = 'conv-status ' + s.cls; }
  }

  /* ------------------------------------------------------------ conversa */
  async function abrirCom(outroId) {
    const c = conversas.get(outroId);
    let conversaId = c && c.conversa_id;
    if (!conversaId) {
      try { conversaId = await B7.DB.rpc('chat_abrir_direta', { p_outro: outroId }); }
      catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível abrir a conversa.', { tipo: 'erro' }); return; }
      porConversa.set(conversaId, outroId);
      if (!conversas.has(outroId)) conversas.set(outroId, { conversa_id: conversaId, outro_id: outroId, nao_lidas: 0, ultima: null });
    }
    atual = { outroId, conversaId, msgs: [], temMais: false, carregando: true };
    pintarConversa();
    await carregarMensagens(false);
    marcarLida(conversaId);
  }
  /* abrir pela conversa (aviso, push): acha a pessoa pela lista */
  function abrirConversa(conversaId) {
    if (!liberado() || !conversaId) return;
    if (!aberto) { abrir(); }
    const outro = porConversa.get(conversaId);
    if (outro) abrirCom(outro); else pendente = conversaId;
  }

  async function carregarMensagens(antigas) {
    if (!atual) return;
    const conv = atual;
    try {
      let q = B7.sb.from('chat_mensagens').select('*').eq('conversa_id', conv.conversaId).order('created_at', { ascending: false }).limit(PAGINA + 1);
      if (antigas && conv.msgs.length) q = q.lt('created_at', conv.msgs[0].created_at);
      const { data, error } = await q;
      if (error) throw error;
      if (atual !== conv) return;
      const lote = (data || []).slice(0, PAGINA).reverse();
      conv.temMais = (data || []).length > PAGINA;
      const tenho = new Set(conv.msgs.map(m => m.id));
      conv.msgs = antigas ? lote.filter(m => !tenho.has(m.id)).concat(conv.msgs) : lote.concat(conv.msgs.filter(m => !lote.some(x => x.id === m.id)));
      conv.carregando = false;
      pintarMensagens(!antigas, antigas);
    } catch (e) {
      if (atual === conv) { conv.carregando = false; conv.erro = true; pintarMensagens(false); }
    }
  }

  function estadoTique(criadaEm, c) {
    if (!c) return 'enviada';
    const t = new Date(criadaEm).getTime();
    if (c.outro_lida_ate && new Date(c.outro_lida_ate).getTime() >= t) return 'lida';
    if (c.outro_entregue_ate && new Date(c.outro_entregue_ate).getTime() >= t) return 'entregue';
    return 'enviada';
  }
  const ROT_TIQUE = { enviando: 'Enviando', enviada: 'Enviada', entregue: 'Entregue', lida: 'Lida' };
  function tique(m) {
    if (m.enviando) return '<i class="conv-tq enviando" title="Enviando">' + IC.relogio + '</i>';
    const e = estadoTique(m.created_at, conversas.get(atual.outroId));
    return '<i class="conv-tq ' + e + '" data-tq="' + esc(m.created_at) + '" title="' + ROT_TIQUE[e] + '">' + (e === 'enviada' ? IC.um : IC.dois) + '</i>';
  }
  function pintarTiques() {
    if (!painel || !atual) return;
    const c = conversas.get(atual.outroId);
    painel.querySelectorAll('[data-tq]').forEach(i => {
      const e = estadoTique(i.dataset.tq, c);
      if (!i.classList.contains(e)) { i.className = 'conv-tq ' + e; i.title = ROT_TIQUE[e]; i.innerHTML = e === 'enviada' ? IC.um : IC.dois; }
    });
  }

  function balao(m) {
    const minha = m.autor_id === eu(), apagada = !!m.apagada_em;
    let corpo;
    if (apagada) corpo = '<p class="conv-apagada">Mensagem apagada</p>';
    else if (m.tipo === 'audio') {
      corpo = '<div class="conv-audio" data-audio="' + esc(m.arquivo_path || '') + '" data-dur="' + (m.duracao_s || 0) + '">' +
        '<button type="button" class="conv-play" aria-label="Ouvir mensagem de voz">' + IC.play + '</button>' +
        '<span class="conv-onda"><i></i></span><time>' + mmss(m.duracao_s) + '</time></div>';
    } else if (m.tipo === 'imagem') {
      corpo = '<button type="button" class="conv-img" data-img="' + esc(m.arquivo_path || '') + '" aria-label="Abrir imagem"><span class="conv-img-esp"></span></button>' +
        (m.texto ? '<p class="conv-tx">' + textoRico(m.texto) + '</p>' : '');
    } else if (m.tipo === 'arquivo') {
      corpo = '<button type="button" class="conv-arq" data-arq="' + esc(m.arquivo_path || '') + '" data-nome="' + esc(m.arquivo_nome || 'arquivo') + '">' +
        '<span class="conv-arq-ic">' + IC.arquivo + '</span><span class="conv-arq-tx"><b>' + esc(m.arquivo_nome || 'Arquivo') + '</b><small>' + tamanho(m.arquivo_tamanho) + ' · baixar</small></span></button>' +
        (m.texto ? '<p class="conv-tx">' + textoRico(m.texto) + '</p>' : '');
    } else corpo = '<p class="conv-tx">' + textoRico(m.texto) + '</p>';
    if (m.comunicado_id && !apagada) corpo = '<span class="conv-comun">Comunicado</span>' + corpo;
    return '<div class="conv-msg ' + (minha ? 'minha' : 'outra') + (apagada ? ' apagada' : '') + (m.falhou ? ' falhou' : '') + '" data-msg="' + esc(m.id) + '">' +
      '<div class="conv-balao">' + corpo +
        '<span class="conv-meta"><time>' + hora(m.created_at) + '</time>' + (minha && !apagada ? tique(m) : '') + '</span>' +
        (minha && !apagada && !m.enviando ? '<button type="button" class="conv-apagar" data-apagar="' + esc(m.id) + '" aria-label="Apagar mensagem" title="Apagar">' + IC.lixo + '</button>' : '') +
      '</div></div>';
  }

  function pintarConversa() {
    if (!painel || !atual) return;
    const p = pessoas.get(atual.outroId) || { id: atual.outroId, nome: 'Conversa' }, s = statusDe(atual.outroId);
    const podeGravar = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    painel.innerHTML = '<header class="conv-topo conv-topo-c">' +
        '<button type="button" class="conv-ic" data-voltar aria-label="Voltar para a lista">' + IC.voltar + '</button>' + avatar(p, 'p') +
        '<span class="conv-quem"><b>' + esc(p.nome || p.username || '') + '</b><small class="conv-status ' + s.cls + '" id="conv-status">' + esc(s.tx) + '</small></span>' +
        '<button type="button" class="conv-ic" data-fechar aria-label="Fechar conversas">' + IC.fechar + '</button></header>' +
      '<div class="conv-corpo" id="conv-corpo" aria-live="polite"></div>' +
      '<div class="conv-anexo" id="conv-anexo" hidden></div>' +
      '<div class="conv-grav" id="conv-grav" hidden></div>' +
      '<form class="conv-form" id="conv-form" autocomplete="off">' +
        '<input type="file" id="conv-arquivo" hidden>' +
        '<button type="button" class="conv-ic" id="conv-anexar" aria-label="Anexar imagem ou arquivo" title="Anexar (ou cole um print com Ctrl+V)">' + IC.clipe + '</button>' +
        '<textarea id="conv-texto" rows="1" maxlength="4000" placeholder="Mensagem" aria-label="Mensagem" name="b7-conversa-mensagem" autocomplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other"></textarea>' +
        (podeGravar ? '<button type="button" class="conv-ic conv-mic" id="conv-mic" aria-label="Gravar mensagem de voz" title="Gravar mensagem de voz">' + IC.mic + '</button>' : '') +
        '<button type="submit" class="conv-enviar" id="conv-enviar" aria-label="Enviar">' + IC.enviar + '</button>' +
      '</form>';
    painel.querySelector('[data-fechar]').onclick = fechar;
    painel.querySelector('[data-voltar]').onclick = voltar;
    const form = painel.querySelector('#conv-form'), ta = painel.querySelector('#conv-texto'), arq = painel.querySelector('#conv-arquivo');
    const ajustar = () => { ta.style.height = 'auto'; ta.style.height = Math.min(130, ta.scrollHeight) + 'px'; form.classList.toggle('com-texto', !!ta.value.trim() || !!anexo); };
    ta.addEventListener('input', () => { ajustar(); if (ta.value.trim()) sinalizar('digitando'); else sinalizar(null, true); });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); enviarTexto(); } });
    ta.addEventListener('paste', e => {
      const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(i => i.kind === 'file');
      if (it) { const f = it.getAsFile(); if (f) { e.preventDefault(); escolherAnexo(f); } }
    });
    form.onsubmit = e => { e.preventDefault(); enviarTexto(); };
    painel.querySelector('#conv-anexar').onclick = () => arq.click();
    arq.onchange = () => { const f = arq.files && arq.files[0]; arq.value = ''; if (f) escolherAnexo(f); };
    const mic = painel.querySelector('#conv-mic'); if (mic) mic.onclick = iniciarGravacao;
    const corpo = painel.querySelector('#conv-corpo');
    corpo.addEventListener('click', aoClicarNoCorpo);
    corpo.addEventListener('scroll', () => { if (corpo.scrollTop < 60 && atual && atual.temMais && !atual.buscando) { atual.buscando = true; carregarMensagens(true).then(() => { if (atual) atual.buscando = false; }); } });
    pintarMensagens(true);
    pintarAnexo();
    if (window.matchMedia('(min-width: 721px)').matches) ta.focus();
  }

  function pintarMensagens(descer, mantendo) {
    const corpo = painel && painel.querySelector('#conv-corpo'); if (!corpo || !atual) return;
    const perto = corpo.scrollHeight - corpo.scrollTop - corpo.clientHeight < 140, alturaAntes = corpo.scrollHeight;
    if (atual.carregando) { corpo.innerHTML = '<p class="conv-vazio">Carregando…</p>'; return; }
    if (atual.erro && !atual.msgs.length) { corpo.innerHTML = '<p class="conv-vazio">Não foi possível carregar a conversa. Feche e abra de novo.</p>'; return; }
    if (!atual.msgs.length) { corpo.innerHTML = '<p class="conv-vazio">Nenhuma mensagem ainda. Diga oi.</p>'; return; }
    let html = atual.temMais ? '<p class="conv-mais">Role para cima para ver mensagens anteriores</p>' : '', dia = '';
    atual.msgs.forEach(m => {
      const k = chaveDia(m.created_at);
      if (k !== dia) { dia = k; html += '<div class="conv-dia"><span>' + rotDia(m.created_at) + '</span></div>'; }
      html += balao(m);
    });
    corpo.innerHTML = html;
    if (mantendo) corpo.scrollTop = corpo.scrollHeight - alturaAntes;
    else if (descer || perto) corpo.scrollTop = corpo.scrollHeight;
    carregarImagens(corpo);
  }
  /* imagens: o link temporário é pedido depois que o balão existe */
  function carregarImagens(corpo) {
    corpo.querySelectorAll('[data-img]').forEach(async b => {
      const u = await urlDe(b.dataset.img); if (!u || !b.isConnected) return;
      const img = new Image(); img.alt = 'Imagem enviada na conversa';
      img.onload = () => { if (!b.isConnected) return; const perto = corpo.scrollHeight - corpo.scrollTop - corpo.clientHeight < 200; b.innerHTML = ''; b.appendChild(img); if (perto) corpo.scrollTop = corpo.scrollHeight; };
      img.src = u;
    });
  }

  async function aoClicarNoCorpo(e) {
    const play = e.target.closest('.conv-play'), img = e.target.closest('[data-img]'), arq = e.target.closest('[data-arq]'), del = e.target.closest('[data-apagar]');
    if (play) return tocar(play.closest('.conv-audio'));
    if (img) {
      const u = await urlDe(img.dataset.img); if (!u) { B7.UI.toast('Não foi possível abrir a imagem.', { tipo: 'erro' }); return; }
      const m = B7.UI.modal('<img class="conv-img-grande" src="' + esc(u) + '" alt="Imagem enviada na conversa">' +
        '<div class="acoes"><a class="b contorno" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">Abrir em outra aba</a><button type="button" class="b pri" data-fecha>Fechar</button></div>', { larga: true });
      m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
      return;
    }
    if (arq) {
      const u = await urlDe(arq.dataset.arq); if (!u) { B7.UI.toast('Não foi possível baixar o arquivo.', { tipo: 'erro' }); return; }
      const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.download = arq.dataset.nome || 'arquivo';
      document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    if (del) {
      B7.UI.confirmar({ titulo: 'Apagar esta mensagem?', texto: 'Ela some para as duas pessoas e fica o aviso “Mensagem apagada”. Não dá para desfazer.',
        rotulo: 'Apagar', perigo: true, aoConfirmar: () => apagar(del.dataset.apagar) });
    }
  }
  async function apagar(id) {
    try {
      const path = await B7.DB.rpc('chat_apagar', { p_mensagem: id });
      if (path) { try { await B7.sb.storage.from(BUCKET).remove([path]); } catch (e) {} urls.delete(path); }
      if (atual) { const m = atual.msgs.find(x => x.id === id); if (m) { m.apagada_em = new Date().toISOString(); m.texto = null; m.arquivo_path = null; pintarMensagens(false); } }
      carregarListaLogo();
    } catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível apagar.', { tipo: 'erro' }); }
  }

  /* --------------------------------------------------------------- áudio */
  function pararAudio() {
    if (!tocando) return;
    try { tocando.el.pause(); } catch (e) {}
    if (tocando.cx && tocando.cx.isConnected) { tocando.cx.classList.remove('tocando'); tocando.cx.querySelector('.conv-play').innerHTML = IC.play; }
    tocando = null;
  }
  async function tocar(cx) {
    if (!cx) return;
    if (tocando && tocando.cx === cx) { pararAudio(); return; }
    pararAudio();
    const u = await urlDe(cx.dataset.audio); if (!u) { B7.UI.toast('Não foi possível tocar o áudio.', { tipo: 'erro' }); return; }
    const el = new Audio(u), dur = Number(cx.dataset.dur) || 0, barra = cx.querySelector('.conv-onda i'), tempo = cx.querySelector('time');
    tocando = { el, cx };
    cx.classList.add('tocando'); cx.querySelector('.conv-play').innerHTML = IC.pausa;
    el.ontimeupdate = () => {
      const total = isFinite(el.duration) && el.duration > 0 ? el.duration : dur;
      if (barra && total) barra.style.width = Math.min(100, el.currentTime / total * 100) + '%';
      if (tempo) tempo.textContent = mmss(el.currentTime);
    };
    const fim = () => { if (barra) barra.style.width = '0%'; if (tempo) tempo.textContent = mmss(dur); if (tocando && tocando.el === el) pararAudio(); };
    el.onended = fim;
    el.onerror = () => { fim(); B7.UI.toast('Não foi possível tocar o áudio.', { tipo: 'erro' }); };
    el.play().catch(() => fim());
  }

  const TIPO_GRAV = (window.MediaRecorder ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
    .find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) : '') || '';
  async function iniciarGravacao() {
    if (grav || !atual) return;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) {
      const n = e && e.name;
      B7.UI.toast(n === 'NotFoundError' || n === 'DevicesNotFoundError' ? 'Nenhum microfone encontrado.'
        : n === 'NotAllowedError' || n === 'SecurityError' ? 'Permita o uso do microfone neste site para gravar.' : 'Não foi possível usar o microfone agora.', { tipo: 'erro' });
      return;
    }
    let rec;
    try { rec = new MediaRecorder(stream, Object.assign({ audioBitsPerSecond: 32000 }, TIPO_GRAV ? { mimeType: TIPO_GRAV } : {})); }
    catch (e) { stream.getTracks().forEach(t => t.stop()); B7.UI.toast('Este navegador não consegue gravar áudio.', { tipo: 'erro' }); return; }
    const g = { rec, stream, partes: [], t0: Date.now(), relogio: 0, descartar: false, conv: atual };
    rec.ondataavailable = e => { if (e.data && e.data.size) g.partes.push(e.data); };
    rec.onstop = () => concluirGravacao(g);
    grav = g;
    try { rec.start(); } catch (e) { g.descartar = true; concluirGravacao(g); return; }
    pararAudio();
    sinalizar('gravando', true);
    g.relogio = setInterval(() => {
      const el = painel && painel.querySelector('#conv-grav-t'); if (el) el.textContent = mmss((Date.now() - g.t0) / 1000);
      sinalizar('gravando');                              /* o outro lado segue vendo "gravando áudio…" */
      if (Date.now() - g.t0 >= MAX_AUDIO_MS) pararGravacao(false);
    }, 500);
    pintarGravacao();
  }
  function pintarGravacao() {
    const cx = painel && painel.querySelector('#conv-grav'), form = painel && painel.querySelector('#conv-form');
    if (!cx) return;
    cx.hidden = !grav; if (form) form.hidden = !!grav;
    if (!grav) { cx.innerHTML = ''; return; }
    cx.innerHTML = '<button type="button" class="conv-ic conv-grav-x" id="conv-grav-x" aria-label="Descartar gravação" title="Descartar">' + IC.lixo + '</button>' +
      '<span class="conv-grav-meio"><i class="conv-grav-ponto"></i><b id="conv-grav-t">0:00</b><span>gravando…</span></span>' +
      '<button type="button" class="conv-enviar" id="conv-grav-ok" aria-label="Enviar mensagem de voz" title="Enviar">' + IC.enviar + '</button>';
    cx.querySelector('#conv-grav-x').onclick = () => pararGravacao(true);
    cx.querySelector('#conv-grav-ok').onclick = () => pararGravacao(false);
  }
  function pararGravacao(descartar) {
    const g = grav; if (!g) return;
    g.descartar = !!descartar;
    try { if (g.rec.state !== 'inactive') g.rec.stop(); else concluirGravacao(g); } catch (e) { concluirGravacao(g); }
  }
  async function concluirGravacao(g) {
    clearInterval(g.relogio);
    try { g.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    if (grav === g) grav = null;
    pintarGravacao();
    sinalizar(null, true);
    const dur = Math.round((Date.now() - g.t0) / 1000);
    if (g.descartar || !g.partes.length) return;
    if (dur < 1) { B7.UI.toast('Gravação curta demais.'); return; }
    const mime = (g.rec.mimeType || TIPO_GRAV || 'audio/webm').split(';')[0];
    const blob = new Blob(g.partes, { type: mime });
    await enviarArquivo(g.conv, blob, 'audio', { nome: 'voz.' + (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'), mime, duracao: dur });
  }

  /* -------------------------------------------------------------- anexos */
  function largarAnexo() { if (anexo && anexo.url) { try { URL.revokeObjectURL(anexo.url); } catch (e) {} } anexo = null; }
  /* foto grande é reduzida antes de subir (lado maior até 1920 px); o resto vai como está */
  function reduzirImagem(arquivo) {
    return new Promise(ok => {
      if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type) || arquivo.size < 400000) return ok(arquivo);
      const u = URL.createObjectURL(arquivo), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(u);
        const esc2 = Math.min(1, 1920 / Math.max(img.width, img.height));
        if (esc2 === 1 && arquivo.size < 1500000) return ok(arquivo);
        const c = document.createElement('canvas'); c.width = Math.round(img.width * esc2); c.height = Math.round(img.height * esc2);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => ok(b && b.size < arquivo.size ? new File([b], arquivo.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : arquivo), 'image/jpeg', 0.86);
      };
      img.onerror = () => { URL.revokeObjectURL(u); ok(arquivo); };
      img.src = u;
    });
  }
  async function escolherAnexo(arquivo) {
    if (!atual) return;
    const f = await reduzirImagem(arquivo);
    if (f.size > MAX_ARQUIVO) { B7.UI.toast('O arquivo passa de 10 MB.', { tipo: 'erro' }); return; }
    if (!f.size) { B7.UI.toast('O arquivo está vazio.', { tipo: 'erro' }); return; }
    largarAnexo();
    const imagem = /^image\//.test(f.type);
    anexo = { arquivo: f, imagem, url: imagem ? URL.createObjectURL(f) : null };
    pintarAnexo();
    const ta = painel && painel.querySelector('#conv-texto'); if (ta) ta.focus();
  }
  function pintarAnexo() {
    const cx = painel && painel.querySelector('#conv-anexo'), form = painel && painel.querySelector('#conv-form'), ta = painel && painel.querySelector('#conv-texto');
    if (!cx) return;
    cx.hidden = !anexo;
    if (form) form.classList.toggle('com-texto', !!anexo || !!(ta && ta.value.trim()));
    if (ta) ta.placeholder = anexo ? 'Legenda (opcional)' : 'Mensagem';
    if (!anexo) { cx.innerHTML = ''; return; }
    cx.innerHTML = (anexo.imagem ? '<img src="' + esc(anexo.url) + '" alt="">' : '<span class="conv-arq-ic">' + IC.arquivo + '</span>') +
      '<span class="conv-anexo-tx"><b>' + esc(anexo.arquivo.name || 'Imagem colada') + '</b><small>' + tamanho(anexo.arquivo.size) + ' · Enter para enviar</small></span>' +
      '<button type="button" class="conv-ic" id="conv-anexo-x" aria-label="Tirar o anexo">' + IC.fechar + '</button>';
    cx.querySelector('#conv-anexo-x').onclick = () => { largarAnexo(); pintarAnexo(); };
  }

  /* ---------------------------------------------------------------- envio */
  function acrescentar(conv, m) { if (atual === conv) { conv.msgs.push(m); pintarMensagens(true); } }
  function trocar(conv, tempId, real) {
    const i = conv.msgs.findIndex(m => m.id === tempId);
    if (conv.msgs.some(m => m.id === real.id)) { if (i >= 0) conv.msgs.splice(i, 1); }   /* o Realtime chegou antes */
    else if (i >= 0) conv.msgs[i] = real; else conv.msgs.push(real);
    if (atual === conv) pintarMensagens(true);
    const c = conversas.get(conv.outroId); if (c) { c.ultima = real; c.ultima_em = real.created_at; }
  }
  function falhar(conv, tempId, e) {
    const i = conv.msgs.findIndex(m => m.id === tempId); if (i >= 0) conv.msgs.splice(i, 1);
    if (atual === conv) pintarMensagens(false);
    B7.UI.toast((e && e.message) || 'Não foi possível enviar. Confira a internet.', { tipo: 'erro' });
  }

  async function enviarTexto() {
    const ta = painel && painel.querySelector('#conv-texto'); if (!ta || !atual) return;
    const texto = ta.value.trim(), conv = atual;
    if (anexo) {
      const a = anexo; anexo = null; pintarAnexo();
      ta.value = ''; ta.style.height = 'auto';
      await enviarArquivo(conv, a.arquivo, a.imagem ? 'imagem' : 'arquivo', { nome: a.arquivo.name || 'imagem.png', mime: a.arquivo.type || 'application/octet-stream', texto });
      if (a.url) { try { URL.revokeObjectURL(a.url); } catch (e) {} }
      return;
    }
    if (!texto) return;
    ta.value = ''; ta.style.height = 'auto';
    const form = painel.querySelector('#conv-form'); if (form) form.classList.remove('com-texto');
    sinalizar(null, true);
    const temp = { id: 'temp-' + Date.now() + Math.random(), conversa_id: conv.conversaId, autor_id: eu(), tipo: 'texto', texto, created_at: new Date().toISOString(), enviando: true };
    acrescentar(conv, temp);
    try { trocar(conv, temp.id, await B7.DB.rpc('chat_enviar', { p_conversa: conv.conversaId, p_tipo: 'texto', p_texto: texto })); }
    catch (e) { falhar(conv, temp.id, e); if (atual === conv && ta.isConnected && !ta.value) { ta.value = texto; } }
  }

  async function enviarArquivo(conv, blob, tipo, o) {
    const ext = ((o.nome || '').match(/\.([a-z0-9]{1,8})$/i) || [, 'bin'])[1].toLowerCase();
    const id = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));
    const path = conv.conversaId + '/' + id + '.' + ext;
    const temp = { id: 'temp-' + id, conversa_id: conv.conversaId, autor_id: eu(), tipo: 'texto', created_at: new Date().toISOString(), enviando: true,
      texto: tipo === 'audio' ? 'Enviando mensagem de voz…' : 'Enviando ' + (o.nome || 'arquivo') + '…' };
    acrescentar(conv, temp);
    try {
      const { error } = await B7.sb.storage.from(BUCKET).upload(path, blob, { contentType: o.mime || 'application/octet-stream', upsert: false });
      if (error) throw error;
      const real = await B7.DB.rpc('chat_enviar', { p_conversa: conv.conversaId, p_tipo: tipo, p_texto: o.texto || null,
        p_arquivo: { path, nome: o.nome || '', mime: o.mime || '', tamanho: blob.size, duracao: o.duracao || 0 } });
      trocar(conv, temp.id, real);
    } catch (e) {
      try { await B7.sb.storage.from(BUCKET).remove([path]); } catch (x) {}
      falhar(conv, temp.id, e);
    }
  }

  return { montar, abrir, fechar, abrirConversa, liberado, naoLidas: totalNaoLidas };
})();
