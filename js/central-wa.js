/* =====================================================================
   CENTRAL DE CONVERSAS B7 (4.51.0) — o WhatsApp dentro do sistema, pelo
   Evolution API. Substitui o WhatsApp Web que rodava no programa de PC.

   • lê wa_conversas / wa_mensagens (RLS: administrador + videomakers);
   • tempo real (Supabase Realtime) — chega mensagem, a tela atualiza;
   • envia pela Edge Function wa-evolution (texto, fotos, vídeos,
     documentos, áudio gravado, citar, reagir, apagar);
   • mídia baixada sob demanda (a mensagem chega só com a miniatura);
   • celular: lista numa tela, conversa em tela cheia (‹ volta).
   Classes com prefixo wz- (não colidir com .cv, .lista… do sistema).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.CentralWA = (function () {
  const esc = s => B7.UI.esc(s);
  const sb = () => B7.sb;
  const eu = () => (B7.Auth && B7.Auth.usuario()) || {};
  const souAdmin = () => !!(B7.Auth && (B7.Auth.ehAdminReal ? B7.Auth.ehAdminReal() : B7.Auth.ehAdmin && B7.Auth.ehAdmin()));
  const PAL = ['#E8452C', '#1B8F6A', '#5E47DE', '#C21C83', '#2E8BFF', '#F0A443', '#0EA5A4', '#9333EA', '#D97706', '#DB2777'];
  const corDe = s => { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PAL[h % PAL.length]; };
  const ini = s => { const p = String(s || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : (p[0] || '')[1] || '')).toUpperCase(); };
  const num = jid => String(jid || '').split('@')[0];
  /* 4.52.6: @lid é um código interno do WhatsApp, não é telefone */
  const fone = jid => /@lid$/.test(String(jid || '')) ? 'Contato do WhatsApp' : '+' + num(jid);
  const ehGrupo = jid => /@g\.us$/.test(jid || '');

  const S = { conversas: [], porJid: new Map(), aberta: null, msgs: [], fim: false, filtro: 'tudo', busca: '', citar: null, canal: null, clientes: [], gravando: null, lado: true };
  let raiz = null;

  /* ------------------------------------------------------------ ícones */
  const I = {
    busca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5 12.4 20a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8"/></svg>',
    emoji: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="3"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    env: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>',
    volta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    lado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M14.5 4.5v15"/></svg>',
    mais: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
    lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    resp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v5"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.2 19.8l1.1-3.9A8.2 8.2 0 1 1 8.4 19z"/></svg>'
  };

  /* ------------------------------------------------------------ helpers */
  function hora(iso) {
    if (!iso) return '';
    const d = new Date(iso), h = new Date();
    const mesmo = (a, b) => a.toDateString() === b.toDateString();
    if (mesmo(d, h)) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const ontem = new Date(h); ontem.setDate(h.getDate() - 1);
    if (mesmo(d, ontem)) return 'ontem';
    if (h - d < 6 * 864e5) return d.toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
  const hm = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  function dia(iso) {
    const d = new Date(iso), h = new Date(), o = new Date(h); o.setDate(h.getDate() - 1);
    if (d.toDateString() === h.toDateString()) return 'HOJE';
    if (d.toDateString() === o.toDateString()) return 'ONTEM';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: d.getFullYear() !== h.getFullYear() ? 'numeric' : undefined }).toUpperCase();
  }
  const mmss = s => { s = Math.max(0, Math.round(Number(s) || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const tamanho = b => !b ? '' : b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  const espera = iso => { if (!iso) return ''; const min = (Date.now() - new Date(iso)) / 60000; if (min < 30) return ''; return min < 60 ? Math.round(min) + ' min sem resposta' : min < 1440 ? Math.floor(min / 60) + ' h sem resposta' : Math.floor(min / 1440) + ' d sem resposta'; };
  const ticks = st => st === 'READ' || st === 'PLAYED' ? '<i class="wz-tk lido">✓✓</i>' : st === 'DELIVERY_ACK' ? '<i class="wz-tk">✓✓</i>' : st === 'PENDING' ? '<i class="wz-tk">🕓</i>' : st === 'ERROR' ? '<i class="wz-tk erro">!</i>' : '<i class="wz-tk">✓</i>';
  function textoRico(t) {
    let h = esc(t || '');
    h = h.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    h = h.replace(/(^|[\s>])\*([^*\n]+)\*(?=[\s<.,!?]|$)/g, '$1<b>$2</b>').replace(/(^|[\s>])_([^_\n]+)_(?=[\s<.,!?]|$)/g, '$1<i>$2</i>')
      .replace(/(^|[\s>])~([^~\n]+)~(?=[\s<.,!?]|$)/g, '$1<s>$2</s>');
    return h.replace(/\n/g, '<br>');
  }
  async function chamar(acao, extra) { return B7.DB.waEvolution(acao, extra); }
  function avatar(c, cls) {
    const nome = c.nome || num(c.jid);
    const cli = c.cliente_id && S.clientes.find(x => x.id === c.cliente_id);
    const foto = c.foto_url || (cli && cli.logo_url);
    return '<span class="wz-av ' + (cls || '') + '" style="--c:' + corDe(nome) + '">' +
      (foto ? '<img src="' + esc(foto) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '<b>' + esc(ini(nome)) + '</b>' +
      (c.cliente_id ? '<small title="Cliente do B7">B7</small>' : '') + '</span>';
  }

  /* ------------------------------------------------------------ abrir */
  async function abrir() {
    const painel = document.getElementById('painel-dashboard');
    if (!painel) return;
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['WhatsApp']);
    painel.innerHTML = '<div class="wz" id="wz"><div class="wz-carrega"><i></i><span>Abrindo as conversas…</span></div></div>';
    raiz = painel.querySelector('#wz');
    let pode = false;
    try { const r = await sb().rpc('pode_ver_wa'); pode = !!r.data; } catch (e) {}
    if (!pode) { raiz.innerHTML = '<div class="wz-vazio"><span class="wz-vazio-ic">' + I.wa + '</span><b>As conversas do WhatsApp são da equipe de vídeo</b><p>Peça acesso a um administrador.</p></div>'; return; }
    try { S.clientes = (await sb().from('clientes_resumo').select('id,nome,logo_url').is('deleted_at', null).order('nome')).data || []; } catch (e) {}
    await carregarConversas();
    desenhar();
    ligarTempoReal();
    if (B7.Rota && B7.Rota.aoSair) B7.Rota.aoSair(sair);
    const alvo = (location.hash.split('?')[1] || '').match(/jid=([^&]+)/);
    if (alvo) abrirConversa(decodeURIComponent(alvo[1]));
  }
  function sair() {
    if (S.canal) { B7.DB.fecharCanal(S.canal); S.canal = null; }
    pararGravacao(true);
    S.aberta = null; document.body.classList.remove('wz-tela-cheia');
  }

  async function carregarConversas() {
    const { data } = await sb().from('wa_conversas').select('*').order('fixada', { ascending: false }).order('ultima_em', { ascending: false, nullsFirst: false }).limit(400);
    S.conversas = data || [];
    S.porJid = new Map(S.conversas.map(c => [c.jid, c]));
    pintarContagem();
  }

  /* ------------------------------------------------------------ desenho geral */
  function desenhar() {
    raiz.innerHTML =
      '<aside class="wz-lista">' +
        '<div class="wz-topo"><h2>Conversas</h2>' +
          (souAdmin() ? '<div class="menu"><button class="wz-ic" data-menu aria-label="Mais opções">' + I.mais + '</button><div class="lista">' +
            '<button data-wz="conexao">Conexão do número</button><button data-wz="importar">Puxar conversas recentes</button></div></div>' : '') +
        '</div>' +
        '<label class="wz-busca">' + I.busca + '<input id="wz-busca" placeholder="Buscar conversa ou cliente" autocomplete="off"></label>' +
        '<div class="wz-filtros" id="wz-filtros"></div>' +
        '<div class="wz-itens" id="wz-itens"></div>' +
      '</aside>' +
      '<section class="wz-chat" id="wz-chat"></section>' +
      '<aside class="wz-lado" id="wz-lado"></aside>';
    raiz.querySelector('#wz-busca').oninput = e => { S.busca = e.target.value.trim().toLowerCase(); pintarLista(); };
    if (B7.UI.ligarMenus) B7.UI.ligarMenus(raiz);
    raiz.addEventListener('click', cliqueGeral);
    pintarFiltros(); pintarLista(); pintarChat(); pintarLado();
  }

  const FILTROS = [['tudo', 'Tudo'], ['naolidas', 'Não lidas'], ['esperando', 'Esperando'], ['grupos', 'Grupos'], ['minhas', 'Minhas'], ['arquivadas', 'Arquivadas']];
  function filtrar(c) {
    if (S.busca) {
      const cli = c.cliente_id && S.clientes.find(x => x.id === c.cliente_id);
      if (!((c.nome || '') + ' ' + (cli ? cli.nome : '') + ' ' + num(c.jid)).toLowerCase().includes(S.busca)) return false;
    }
    if (S.filtro === 'arquivadas') return c.arquivada;
    if (c.arquivada) return false;
    if (S.filtro === 'naolidas') return c.nao_lidas > 0;
    if (S.filtro === 'esperando') return !!espera(c.esperando_desde);
    if (S.filtro === 'grupos') return c.tipo === 'grupo';
    if (S.filtro === 'minhas') return c.responsavel_id === eu().id;
    return true;
  }
  function pintarFiltros() {
    const cx = raiz && raiz.querySelector('#wz-filtros'); if (!cx) return;
    const n = { naolidas: S.conversas.filter(c => !c.arquivada && c.nao_lidas > 0).length, esperando: S.conversas.filter(c => !c.arquivada && espera(c.esperando_desde)).length };
    cx.innerHTML = FILTROS.map(([k, r]) => '<button class="' + (S.filtro === k ? 'on' : '') + '" data-filtro="' + k + '">' + r + (n[k] ? ' <b>' + n[k] + '</b>' : '') + '</button>').join('');
  }
  function pintarLista() {
    const cx = raiz && raiz.querySelector('#wz-itens'); if (!cx) return;
    const vis = S.conversas.filter(filtrar);
    if (!vis.length) {
      cx.innerHTML = '<div class="wz-lista-vazia">' + (S.conversas.length ? 'Nada por aqui com esse filtro.' :
        'Nenhuma conversa ainda.' + (souAdmin() ? '<br><button class="b contorno" data-wz="conexao">Conectar o número</button> <button class="b contorno" data-wz="importar">Puxar conversas recentes</button>' : '')) + '</div>';
      return;
    }
    cx.innerHTML = vis.map(c => {
      const esp = espera(c.esperando_desde);
      const autor = c.previa_de_mim ? 'Você: ' : (c.tipo === 'grupo' && c.previa_autor ? c.previa_autor.split(' ')[0] + ': ' : '');
      return '<button class="wz-it' + (S.aberta === c.jid ? ' on' : '') + (c.nao_lidas ? ' nl' : '') + '" data-jid="' + esc(c.jid) + '">' + avatar(c) +
        '<span class="wz-it-tx"><span class="wz-l1"><b>' + esc(c.nome || num(c.jid)) + '</b><time>' + esc(hora(c.ultima_em)) + '</time></span>' +
        '<span class="wz-l2"><span>' + esc(autor + (c.previa || '')) + '</span>' +
          (esp ? '<em class="wz-esp">' + esc(esp) + '</em>' : '') + (c.nao_lidas ? '<i class="wz-n">' + c.nao_lidas + '</i>' : '') + (c.fixada ? '<i class="wz-pin">📌</i>' : '') + '</span></span></button>';
    }).join('');
  }

  /* ------------------------------------------------------------ conversa */
  async function abrirConversa(jid) {
    if (!S.porJid.has(jid)) return;
    S.aberta = jid; S.msgs = []; S.fim = false; S.citar = null; S.grudado = true;
    raiz.classList.add('wz-com-chat'); document.body.classList.add('wz-tela-cheia');
    pintarLista(); pintarChat(true); pintarLado();
    await carregarMensagens();
    const c = S.porJid.get(jid);
    if (c && c.nao_lidas) { c.nao_lidas = 0; pintarLista(); pintarFiltros(); pintarContagem(); chamar('lida', { jid }).catch(() => {}); }
  }
  async function carregarMensagens(antigas) {
    const jid = S.aberta; if (!jid) return;
    let q = sb().from('wa_mensagens').select('*').eq('jid', jid).order('criada_em', { ascending: false }).limit(60);
    if (antigas && S.msgs.length) q = q.lt('criada_em', S.msgs[0].criada_em);
    const { data } = await q;
    if (S.aberta !== jid) return;
    const novas = (data || []).reverse();
    if (novas.length < 60) S.fim = true;
    const caixa = raiz.querySelector('#wz-msgs');
    const alt = caixa ? caixa.scrollHeight - caixa.scrollTop : 0;
    S.msgs = antigas ? novas.concat(S.msgs) : novas;
    pintarMensagens();
    const cx = raiz.querySelector('#wz-msgs');
    if (cx) cx.scrollTop = antigas ? cx.scrollHeight - alt : cx.scrollHeight;
  }

  function pintarChat() {
    const cx = raiz && raiz.querySelector('#wz-chat'); if (!cx) return;
    const c = S.aberta && S.porJid.get(S.aberta);
    if (!c) {
      cx.innerHTML = '<div class="wz-bemvindo"><span class="wz-vazio-ic">' + I.wa + '</span><b>WhatsApp do B7</b><p>Escolha uma conversa na lista. As mensagens chegam aqui na hora, para você e para o Kaique.</p></div>';
      return;
    }
    const cli = c.cliente_id && S.clientes.find(x => x.id === c.cliente_id);
    cx.innerHTML =
      '<header class="wz-cab"><button class="wz-ic wz-volta" data-wz="voltar" aria-label="Voltar">' + I.volta + '</button>' + avatar(c, 'p') +
        '<div class="wz-cab-tx"><b>' + esc(c.nome || num(c.jid)) + '</b><small>' + (c.tipo === 'grupo' ? 'Grupo' : esc(fone(c.jid))) + (cli ? ' · cliente ' + esc(cli.nome) : '') + '</small></div>' +
        '<div class="wz-cab-acoes"><button class="wz-ic wz-so-pc' + (S.lado ? ' on' : '') + '" data-wz="lado" title="Painel do cliente">' + I.lado + '</button>' +
          '<div class="menu"><button class="wz-ic" data-menu aria-label="Opções da conversa">' + I.mais + '</button><div class="lista">' +
            '<button data-wz="fixar">' + (c.fixada ? 'Desafixar' : 'Fixar no topo') + '</button>' +
            '<button data-wz="arquivar">' + (c.arquivada ? 'Desarquivar' : 'Arquivar') + '</button>' +
            '<button data-wz="semespera">Não precisa responder</button>' +
            '<button data-wz="vincular">Ligar a um cliente…</button>' +
          '</div></div></div></header>' +
      '<div class="wz-msgs" id="wz-msgs"></div>' +
      '<div class="wz-solta" id="wz-solta" hidden><b>Solte para enviar</b></div>' +
      '<div class="wz-cita" id="wz-cita" hidden></div>' +
      '<footer class="wz-comp" id="wz-comp">' +
        '<div class="menu wz-anexo"><button class="wz-ic" data-menu aria-label="Anexar">' + I.clip + '</button><div class="lista">' +
          '<button data-wz="anexo-midia">🖼️ Fotos e vídeos</button><button data-wz="anexo-doc">📄 Documento</button><button data-wz="anexo-cam" class="wz-so-cel">📷 Câmera</button><hr><button data-wz="nota">🔒 Nota interna (só a equipe vê)</button></div></div>' +
        '<div class="menu wz-emo"><button class="wz-ic" data-menu aria-label="Emoji">' + I.emoji + '</button><div class="lista wz-emojis">' +
          '😀 😂 😍 🥰 😎 🤩 😉 🙏 👍 👏 🙌 💪 ❤️ 🔥 ✨ 🎉 ✅ 📌 📷 🎬 🎨 📅 ⏰ 💜'.split(' ').map(e => '<button data-emoji="' + e + '">' + e + '</button>').join('') + '</div></div>' +
        '<textarea id="wz-texto" rows="1" placeholder="Digite uma mensagem"></textarea>' +
        '<button class="wz-env" id="wz-env" aria-label="Gravar áudio">' + I.mic + '</button>' +
      '</footer>' +
      '<input type="file" id="wz-arq-midia" accept="image/*,video/*" multiple hidden><input type="file" id="wz-arq-doc" multiple hidden><input type="file" id="wz-arq-cam" accept="image/*" capture="environment" hidden>';
    if (B7.UI.ligarMenus) B7.UI.ligarMenus(cx);
    ligarComposer(cx);
    const caixa = cx.querySelector('#wz-msgs');
    caixa.addEventListener('scroll', () => { S.grudado = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 60; if (caixa.scrollTop < 80 && !S.fim && !S._carregando) { S._carregando = true; carregarMensagens(true).finally(() => { S._carregando = false; }); } });
    ['dragenter', 'dragover'].forEach(ev => cx.addEventListener(ev, e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); cx.querySelector('#wz-solta').hidden = false; } }));
    cx.addEventListener('dragleave', e => { if (e.target === cx.querySelector('#wz-solta')) cx.querySelector('#wz-solta').hidden = true; });
    cx.addEventListener('drop', e => { e.preventDefault(); cx.querySelector('#wz-solta').hidden = true; if (e.dataTransfer.files.length) prepararArquivos([...e.dataTransfer.files]); });
  }

  function pintarMensagens() {
    const cx = raiz && raiz.querySelector('#wz-msgs'); if (!cx) return;
    const grupo = ehGrupo(S.aberta);
    let html = S.fim ? '<div class="wz-inicio">🔒 Conversa do WhatsApp do B7 · só a equipe de vídeo vê aqui</div>' : '<div class="wz-mais-antigas">Carregando mensagens anteriores…</div>';
    let ultDia = '';
    S.msgs.forEach((m, i) => {
      const d = dia(m.criada_em);
      if (d !== ultDia) { html += '<div class="wz-dia"><span>' + esc(d) + '</span></div>'; ultDia = d; }
      const ant = S.msgs[i - 1];
      const seguida = ant && ant.de_mim === m.de_mim && ant.autor_jid === m.autor_jid && !ant.nota && !m.nota && dia(ant.criada_em) === d;
      html += bolha(m, grupo, seguida);
    });
    cx.innerHTML = html;
    cx.querySelectorAll('[data-carregar]').forEach(el => { if (el.dataset.auto) carregarMidia(el); });
  }

  function bolha(m, grupo, seguida) {
    if (m.nota) return '<div class="wz-nota" data-id="' + esc(m.id) + '">🔒 <b>Nota interna</b> · ' + esc(m.enviada_por_nome || '') + ' · ' + hm(m.criada_em) + '<br>' + textoRico(m.texto) + '</div>';
    const lado = m.de_mim ? 'eu' : 'ele';
    let corpo = '';
    if (m.apagada) corpo = '<span class="wz-apagada">🚫 Mensagem apagada</span>';
    else {
      if (m.citada_id) {
        const q = S.msgs.find(x => x.id === m.citada_id);
        const qa = q ? (q.de_mim ? 'Você' : (q.autor_nome || '')) : (m.citada_autor ? (/^\d{14,}$/.test(m.citada_autor) ? 'Contato' : '+' + m.citada_autor) : '');
        corpo += '<span class="wz-q" data-ir="' + esc(m.citada_id) + '"><b style="--c:' + corDe(qa) + '">' + esc(qa || 'Mensagem') + '</b>' + esc((q && (q.texto || q.midia_nome)) || m.citada_previa || '') + '</span>';
      }
      corpo += midia(m);
      if (m.texto && m.tipo !== 'localizacao' && m.tipo !== 'contato' && m.tipo !== 'enquete') corpo += '<span class="wz-txt">' + textoRico(m.texto) + '</span>';
    }
    const autor = !m.de_mim && grupo && !seguida ? '<span class="wz-autor" style="--c:' + corDe(m.autor_nome || m.autor_jid) + '">' + esc(m.autor_nome || num(m.autor_jid)) + '</span>' : '';
    const quem = m.de_mim && m.enviada_por_nome ? '<span class="wz-quem">' + esc(m.enviada_por_nome.split(' ')[0]) + '</span>' : '';
    const reac = m.reacoes && Object.keys(m.reacoes).length ? '<span class="wz-reac">' + Object.entries(m.reacoes).map(([e, l]) => e + (l.length > 1 ? ' ' + l.length : '')).join(' ') + '</span>' : '';
    return '<div class="wz-b ' + lado + (seguida ? ' seg' : '') + (m.tipo === 'figurinha' ? ' fig' : '') + '" data-id="' + esc(m.id) + '">' + autor + corpo +
      '<span class="wz-h">' + quem + (m.editada ? 'editada · ' : '') + hm(m.criada_em) + (m.de_mim ? ticks(m.status) : '') + '</span>' + reac +
      (m.apagada ? '' : '<span class="wz-b-acoes"><button data-acao-msg="citar" title="Responder">' + I.resp + '</button><button data-acao-msg="reagir" title="Reagir">😊</button>' + (m.de_mim ? '<button data-acao-msg="apagar" title="Apagar para todos">' + I.lixo + '</button>' : '') + '</span>') +
      '</div>';
  }

  function midia(m) {
    const mini = m.miniatura ? 'data:image/jpeg;base64,' + m.miniatura : '';
    const id = esc(m.id);
    switch (m.tipo) {
      case 'imagem': return '<span class="wz-img" data-carregar="img" data-id="' + id + '" data-auto="1">' + (mini ? '<img class="borrada" src="' + mini + '" alt="">' : '<i class="wz-ph">📷</i>') + '</span>';
      case 'figurinha': return '<span class="wz-fig" data-carregar="img" data-id="' + id + '" data-auto="1"><i class="wz-ph">🙂</i></span>';
      case 'video': return '<span class="wz-vid" data-carregar="video" data-id="' + id + '">' + (mini ? '<img src="' + mini + '" alt="">' : '') + '<i class="wz-play">' + I.play + '</i>' + (m.duracao ? '<em>' + mmss(m.duracao) + '</em>' : '') + '</span>';
      case 'audio': {
        const ondas = Array.from({ length: 28 }, (_, k) => '<u style="height:' + (25 + ((k * 37 + (m.id || '').charCodeAt(k % ((m.id || 'x').length)) * 13) % 70)) + '%"></u>').join('');
        return '<span class="wz-aud" data-carregar="audio" data-id="' + id + '"><button class="wz-aud-p" aria-label="Tocar">' + I.play + '</button><span class="wz-onda">' + ondas + '</span><em>' + mmss(m.duracao) + '</em></span>';
      }
      case 'documento': {
        const ext = String(m.midia_nome || '').split('.').pop().slice(0, 4).toUpperCase() || 'DOC';
        return '<span class="wz-doc" data-carregar="doc" data-id="' + id + '"><i>' + esc(ext) + '</i><span><b>' + esc(m.midia_nome || 'Documento') + '</b><small>' + esc(tamanho(m.midia_tamanho)) + ' · clique para abrir</small></span></span>';
      }
      case 'localizacao': {
        const [nome, coord] = String(m.texto || '').split('|');
        return '<a class="wz-loc" href="https://maps.google.com/?q=' + esc(coord || '') + '" target="_blank" rel="noopener">📍 ' + esc(nome || 'Localização') + '<small>abrir no mapa</small></a>';
      }
      case 'contato': return '<span class="wz-ctt">👤 ' + esc(m.texto || 'Contato') + '</span>';
      case 'enquete': return '<span class="wz-ctt">📊 ' + esc(m.texto || 'Enquete') + '<small>responda pelo celular</small></span>';
      case 'outro': return '<span class="wz-ctt">Mensagem que o B7 ainda não mostra · veja no celular</span>';
    }
    return '';
  }

  const cacheUrl = new Map();
  async function urlMidia(id) {
    if (cacheUrl.has(id)) return cacheUrl.get(id);
    const r = await chamar('midia', { id });
    if (r.erro || !r.url) throw new Error(r.erro || 'Não deu para abrir.');
    cacheUrl.set(id, r.url);
    return r.url;
  }
  async function carregarMidia(el, tocar) {
    if (el.dataset.ok || el.dataset.busy) return;
    el.dataset.busy = '1'; el.classList.add('carregando');
    try {
      const url = await urlMidia(el.dataset.id);
      const t = el.dataset.carregar;
      if (t === 'img') { el.innerHTML = '<img src="' + esc(url) + '" alt="" data-zoom="' + esc(url) + '">'; const im = el.querySelector('img'); im.onload = () => { if (S.grudado !== false) rolarFim(); }; }
      else if (t === 'video') el.outerHTML = '<video class="wz-video" src="' + esc(url) + '" controls ' + (tocar ? 'autoplay' : '') + ' playsinline></video>';
      else if (t === 'doc') window.open(url, '_blank', 'noopener');
      else if (t === 'audio') {
        let a = el.querySelector('audio');
        if (!a) { a = new Audio(url); a.preload = 'auto'; el.appendChild(a); ligarAudio(el, a); }
        if (tocar) a.play().catch(() => {});
      }
      el.dataset.ok = '1';
    } catch (e) { if (tocar !== false) B7.UI.toast(e.message || 'Não deu para abrir.', { tipo: 'erro' }); }
    finally { delete el.dataset.busy; el.classList.remove('carregando'); }
  }
  function ligarAudio(el, a) {
    const bt = el.querySelector('.wz-aud-p'), em = el.querySelector('em'), ondas = [...el.querySelectorAll('u')];
    const pinta = () => { const p = a.duration ? a.currentTime / a.duration : 0; ondas.forEach((u, i) => u.classList.toggle('p', i / ondas.length < p)); em.textContent = mmss(a.paused && !a.currentTime ? a.duration : a.currentTime); };
    a.addEventListener('timeupdate', pinta);
    a.addEventListener('play', () => { bt.innerHTML = I.pause; document.querySelectorAll('.wz-aud audio').forEach(x => { if (x !== a) x.pause(); }); });
    a.addEventListener('pause', () => { bt.innerHTML = I.play; });
    a.addEventListener('ended', () => { a.currentTime = 0; pinta(); });
    el.querySelector('.wz-onda').addEventListener('click', e => { if (!a.duration) return; const r = e.currentTarget.getBoundingClientRect(); a.currentTime = a.duration * (e.clientX - r.left) / r.width; });
  }

  /* ------------------------------------------------------------ cliques */
  /* 4.52.2: os menus do sistema (⋮, anexar, emoji) são "soltos" no body para não
     serem cortados — os cliques neles não passam pela Central. Este ouvinte pega
     esses cliques (fase de captura, antes de o menu fechar e sumir). */
  document.addEventListener('click', e => {
    if (!raiz || !raiz.isConnected) return;
    const alvo = e.target.closest && e.target.closest('[data-wz], [data-emoji]');
    if (!alvo || raiz.contains(alvo) || !alvo.closest('.lista')) return;
    e.preventDefault(); e.stopPropagation();
    if (B7.UI.fecharMenus) B7.UI.fecharMenus();
    if (alvo.dataset.emoji) {
      const t = raiz.querySelector('#wz-texto');
      if (t) { t.setRangeText(alvo.dataset.emoji, t.selectionStart, t.selectionEnd, 'end'); t.focus(); t.dispatchEvent(new Event('input')); }
      return;
    }
    acao(alvo.dataset.wz);
  }, true);

  function cliqueGeral(e) {
    const it = e.target.closest('.wz-it'); if (it) return abrirConversa(it.dataset.jid);
    const f = e.target.closest('[data-filtro]'); if (f) { S.filtro = f.dataset.filtro; pintarFiltros(); pintarLista(); return; }
    const em = e.target.closest('[data-emoji]'); if (em) { const t = raiz.querySelector('#wz-texto'); if (t) { t.setRangeText(em.dataset.emoji, t.selectionStart, t.selectionEnd, 'end'); t.focus(); t.dispatchEvent(new Event('input')); } B7.UI.fecharMenus && B7.UI.fecharMenus(); return; }
    const md = e.target.closest('[data-carregar]');
    if (md) { if (md.dataset.carregar === 'audio' && md.querySelector('audio')) { const a = md.querySelector('audio'); if (e.target.closest('.wz-aud-p')) (a.paused ? a.play() : a.pause()); return; } if (md.dataset.carregar === 'img' && md.dataset.ok) return; return carregarMidia(md, true); }
    const z = e.target.closest('[data-zoom]'); if (z) return zoom(z.dataset.zoom);
    const q = e.target.closest('[data-ir]'); if (q) { const alvo = raiz.querySelector('.wz-b[data-id="' + CSS.escape(q.dataset.ir) + '"]'); if (alvo) { alvo.scrollIntoView({ block: 'center', behavior: 'smooth' }); alvo.classList.add('pisca'); setTimeout(() => alvo.classList.remove('pisca'), 1400); } return; }
    const am = e.target.closest('[data-acao-msg]'); if (am) return acaoMsg(am.dataset.acaoMsg, am.closest('.wz-b').dataset.id, am);
    const w = e.target.closest('[data-wz]'); if (w) return acao(w.dataset.wz);
    /* celular: tocar na mensagem mostra responder / reagir / apagar */
    const bl = e.target.closest('.wz-b');
    if (bl && !e.target.closest('a, button, video, audio') && matchMedia('(pointer:coarse)').matches) {
      raiz.querySelectorAll('.wz-b.mostra').forEach(x => { if (x !== bl) x.classList.remove('mostra'); });
      bl.classList.toggle('mostra');
    }
  }

  async function acao(a) {
    const c = S.aberta && S.porJid.get(S.aberta);
    if (a === 'voltar') { S.aberta = null; raiz.classList.remove('wz-com-chat'); document.body.classList.remove('wz-tela-cheia'); pintarLista(); pintarChat(); pintarLado(); return; }
    if (a === 'lado') { S.lado = !S.lado; raiz.classList.toggle('sem-lado', !S.lado); pintarChat(); pintarMensagens(); pintarLado(); return; }
    if (a === 'conexao') return B7.WaCentral && B7.WaCentral.abrir();
    if (a === 'importar') return importar();
    if (a === 'anexo-midia') return raiz.querySelector('#wz-arq-midia').click();
    if (a === 'anexo-doc') return raiz.querySelector('#wz-arq-doc').click();
    if (a === 'anexo-cam') return raiz.querySelector('#wz-arq-cam').click();
    if (a === 'nota') return notaInterna();
    if (!c) return;
    const marcar = async (campo, valor) => { try { await sb().rpc('wa_conversa_marcar', { p_jid: c.jid, p_campo: campo, p_valor: valor == null ? null : String(valor) }); } catch (e) { B7.UI.toast('Não deu certo.', { tipo: 'erro' }); } };
    if (a === 'fixar') { c.fixada = !c.fixada; await marcar('fixada', c.fixada); }
    if (a === 'arquivar') { c.arquivada = !c.arquivada; await marcar('arquivada', c.arquivada); B7.UI.toast(c.arquivada ? 'Conversa arquivada.' : 'Conversa de volta à lista.'); }
    if (a === 'semespera') { c.esperando_desde = null; await marcar('sem_espera'); }
    if (a === 'vincular') return vincularCliente(c);
    pintarLista(); pintarFiltros(); pintarChat(); pintarMensagens();
  }

  async function acaoMsg(a, id, bt) {
    const m = S.msgs.find(x => x.id === id); if (!m) return;
    if (a === 'citar') { S.citar = m; pintarCitacao(); raiz.querySelector('#wz-texto').focus(); return; }
    if (a === 'apagar') {
      const ok = await B7.UI.confirmar({ titulo: 'Apagar para todos?', texto: 'A mensagem some para todo mundo na conversa.', confirmar: 'Apagar', perigo: true });
      if (!ok) return;
      try { const r = await chamar('apagar', { id }); if (r.erro) throw new Error(r.erro); } catch (e) { B7.UI.toast(e.message, { tipo: 'erro' }); }
      return;
    }
    if (a === 'reagir') {
      const caixa = document.createElement('div'); caixa.className = 'wz-reagir';
      caixa.innerHTML = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'].map(e => '<button data-r="' + e + '">' + e + '</button>').join('');
      document.body.appendChild(caixa);
      const r = bt.getBoundingClientRect();
      caixa.style.left = Math.max(8, Math.min(innerWidth - 300, r.left - 120)) + 'px'; caixa.style.top = Math.max(8, r.top - 54) + 'px';
      const fora = ev => { if (!caixa.contains(ev.target)) { caixa.remove(); document.removeEventListener('pointerdown', fora, true); } };
      setTimeout(() => document.addEventListener('pointerdown', fora, true), 0);
      caixa.onclick = async ev => {
        const b = ev.target.closest('[data-r]'); if (!b) return;
        caixa.remove(); document.removeEventListener('pointerdown', fora, true);
        try { const x = await chamar('reagir', { id, emoji: b.dataset.r }); if (x.erro) throw new Error(x.erro); } catch (e2) { B7.UI.toast(e2.message, { tipo: 'erro' }); }
      };
    }
  }

  function pintarCitacao() {
    const cx = raiz.querySelector('#wz-cita'); if (!cx) return;
    if (!S.citar) { cx.hidden = true; cx.innerHTML = ''; return; }
    const q = S.citar;
    cx.hidden = false;
    cx.innerHTML = '<div><b>' + esc(q.de_mim ? 'Você' : (q.autor_nome || '')) + '</b><span>' + esc(q.texto || q.midia_nome || ({ imagem: '📷 Foto', video: '🎬 Vídeo', audio: '🎤 Áudio' })[q.tipo] || 'Mensagem') + '</span></div><button class="wz-ic" data-tira-cita aria-label="Cancelar resposta">✕</button>';
    cx.querySelector('[data-tira-cita]').onclick = () => { S.citar = null; pintarCitacao(); };
  }

  function zoom(url) {
    const z = document.createElement('div'); z.className = 'wz-zoom';
    z.innerHTML = '<img src="' + esc(url) + '" alt=""><a href="' + esc(url) + '" target="_blank" rel="noopener" download>Baixar</a>';
    z.onclick = e => { if (e.target.tagName !== 'A') z.remove(); };
    document.body.appendChild(z);
  }

  /* ------------------------------------------------------------ escrever / enviar */
  function assinatura() {
    let cfg = {}; try { cfg = B7.pref.ler('wa_cfg', {}) || {}; } catch (e) {}
    if (cfg.assinatura === false) return '';
    const nome = (cfg.nome || (eu().nome || '').split(' ')[0] || '').trim();
    return nome ? '*' + nome + ':*\n' : '';
  }
  function ligarComposer(cx) {
    const t = cx.querySelector('#wz-texto'), bt = cx.querySelector('#wz-env');
    const ajusta = () => { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; const tem = !!t.value.trim(); bt.innerHTML = tem ? I.env : I.mic; bt.setAttribute('aria-label', tem ? 'Enviar' : 'Gravar áudio'); bt.classList.toggle('envia', tem); };
    t.addEventListener('input', ajusta);
    t.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !matchMedia('(pointer:coarse)').matches) { e.preventDefault(); enviarTexto(); } });
    t.addEventListener('paste', e => { const fs = [...(e.clipboardData && e.clipboardData.files || [])]; if (fs.length) { e.preventDefault(); prepararArquivos(fs); } });
    bt.onclick = () => t.value.trim() ? enviarTexto() : gravar();
    ['#wz-arq-midia', '#wz-arq-doc', '#wz-arq-cam'].forEach(s => { const i = cx.querySelector(s); i.onchange = () => { if (i.files.length) prepararArquivos([...i.files], s === '#wz-arq-doc'); i.value = ''; }; });
    ajusta();
  }
  async function enviarTexto() {
    const t = raiz.querySelector('#wz-texto'); const jid = S.aberta;
    let texto = t.value.trim(); if (!texto || !jid) return;
    if (B7.Corretor && B7.Corretor.ligado && B7.Corretor.ligado()) {
      try { const r = await B7.Corretor.corrigir(texto); if (r && r.ok && r.mudou) texto = r.texto; } catch (e) {}
    }
    const corpo = assinatura() + texto;
    const citar = S.citar && S.citar.id;
    t.value = ''; t.dispatchEvent(new Event('input')); S.citar = null; pintarCitacao();
    const temp = { id: 'tmp_' + Date.now(), jid, de_mim: true, tipo: 'texto', texto: corpo, status: 'PENDING', criada_em: new Date().toISOString(), enviada_por_nome: eu().nome, citada_id: citar || null, reacoes: {} };
    S.msgs.push(temp); pintarMensagens(); rolarFim();
    try {
      const r = await chamar('enviar_texto', { jid, texto: corpo, citar });
      if (r.erro) throw new Error(r.erro);
      temp.id = r.id || temp.id; temp.status = 'SERVER_ACK';
    } catch (e) { temp.status = 'ERROR'; B7.UI.toast(e.message || 'Não enviou.', { tipo: 'erro' }); t.value = texto; t.dispatchEvent(new Event('input')); }
    pintarMensagens(); rolarFim();
  }
  async function notaInterna() {
    const texto = await B7.UI.perguntar({ titulo: 'Nota interna', rotulo: 'Fica na conversa só para a equipe. O cliente não recebe.', placeholder: 'Ex.: pediu para trocar o preço do card 1', confirmar: 'Salvar nota' });
    if (!texto || !S.aberta) return;
    try { await sb().rpc('wa_nota_interna', { p_jid: S.aberta, p_texto: texto }); } catch (e) { B7.UI.toast('Não deu para salvar a nota.', { tipo: 'erro' }); }
  }
  const rolarFim = () => { const cx = raiz && raiz.querySelector('#wz-msgs'); if (cx) cx.scrollTop = cx.scrollHeight; };

  /* arquivos: prévia → sobe para o armazenamento → o servidor manda pelo WhatsApp */
  function prepararArquivos(arqs, comoDoc) {
    if (!S.aberta || !arqs.length) return;
    const lista = arqs.slice(0, 10);
    const grande = lista.find(f => f.size > 95 * 1024 * 1024);
    if (grande) { B7.UI.toast('"' + grande.name + '" passa de 95 MB — mande pelo Drive.', { tipo: 'erro' }); return; }
    const m = B7.UI.modal('<h3>Enviar ' + (lista.length > 1 ? lista.length + ' arquivos' : 'arquivo') + '</h3><div class="wz-prev">' + lista.map((f, i) =>
      '<div class="wz-prev-it">' + (/^image\//.test(f.type) ? '<img src="' + URL.createObjectURL(f) + '" alt="">' : /^video\//.test(f.type) ? '<video src="' + URL.createObjectURL(f) + '" muted></video>' : '<i>' + esc((f.name.split('.').pop() || '').slice(0, 4).toUpperCase()) + '</i>') +
      '<span>' + esc(f.name) + '<small>' + tamanho(f.size) + '</small></span>' + (i === 0 ? '' : '') + '</div>').join('') + '</div>' +
      '<label class="rot">LEGENDA <em>opcional</em></label><textarea class="campo" id="wz-leg" rows="2" placeholder="Escreva uma legenda"></textarea>' +
      ((lista.some(f => /^video\//.test(f.type)) && !comoDoc) ? '<label class="wz-check"><input type="checkbox" id="wz-qual"> Enviar vídeo como arquivo (qualidade original, sem compressão)</label>' : '') +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" id="wz-ok">' + I.env + ' Enviar</button></div>', { extra: 'wz-modal' });
    m.querySelector('#wz-ok').onclick = async () => {
      const leg = m.querySelector('#wz-leg').value.trim();
      const qual = m.querySelector('#wz-qual'); const forcarDoc = comoDoc || (qual && qual.checked);
      m.fechar();
      for (let i = 0; i < lista.length; i++) await enviarArquivo(lista[i], i === 0 ? leg : '', forcarDoc);
    };
  }
  async function subir(blob, nome) {
    const limpo = String(nome || 'arquivo').normalize('NFD').replace(/[^\w.\-]+/g, '_').slice(-80);
    const path = 'envio/' + (eu().id || 'x') + '/' + Date.now() + '_' + limpo;
    const { error } = await sb().storage.from('wa-midia').upload(path, blob, { contentType: blob.type || 'application/octet-stream', upsert: false });
    if (error) throw new Error('Não consegui subir o arquivo.');
    return path;
  }
  async function enviarArquivo(f, legenda, comoDoc) {
    const jid = S.aberta;
    const tipo = comoDoc ? 'document' : /^image\//.test(f.type) ? 'image' : /^video\//.test(f.type) ? 'video' : 'document';
    const temp = { id: 'tmp_' + Date.now() + Math.random(), jid, de_mim: true, tipo: tipo === 'image' ? 'imagem' : tipo === 'video' ? 'video' : 'documento', midia_nome: f.name, midia_tamanho: f.size, texto: legenda || null, status: 'PENDING', criada_em: new Date().toISOString(), enviada_por_nome: eu().nome, reacoes: {} };
    S.msgs.push(temp); pintarMensagens(); rolarFim();
    try {
      const path = await subir(f, f.name);
      const r = await chamar('enviar_midia', { jid, path, tipo, nome: f.name, mime: f.type || undefined, legenda: legenda ? assinatura() + legenda : (tipo === 'document' ? undefined : assinatura().trim() || undefined), citar: S.citar && S.citar.id });
      if (r.erro) throw new Error(r.erro);
      temp.id = r.id || temp.id; temp.status = 'SERVER_ACK';
    } catch (e) { temp.status = 'ERROR'; B7.UI.toast(e.message || 'Não enviou.', { tipo: 'erro' }); }
    S.citar = null; pintarCitacao(); pintarMensagens(); rolarFim();
  }

  /* áudio: segura/clica no microfone → grava → envia como mensagem de voz */
  async function gravar() {
    if (S.gravando) return;
    if (!navigator.mediaDevices || !window.MediaRecorder) { B7.UI.toast('Este navegador não grava áudio.'); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { B7.UI.toast('Libere o microfone para gravar.', { tipo: 'erro' }); return; }
    const tipo = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(x => MediaRecorder.isTypeSupported(x)) || '';
    const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    const partes = []; const ini0 = Date.now();
    rec.ondataavailable = e => { if (e.data.size) partes.push(e.data); };
    S.gravando = { rec, stream, partes, ini0, cancelar: false };
    rec.start(250);
    const comp = raiz.querySelector('#wz-comp');
    comp.classList.add('gravando');
    comp.insertAdjacentHTML('beforeend', '<div class="wz-grav" id="wz-grav"><button class="wz-ic" data-grav="cancelar" aria-label="Descartar">' + I.lixo + '</button><i class="wz-rec"></i><b id="wz-grav-t">0:00</b><span>Gravando…</span><button class="wz-env envia" data-grav="enviar" aria-label="Enviar áudio">' + I.env + '</button></div>');
    const rel = setInterval(() => { const el = raiz.querySelector('#wz-grav-t'); if (el) el.textContent = mmss((Date.now() - ini0) / 1000); else clearInterval(rel); }, 300);
    S.gravando.rel = rel;
    comp.querySelector('[data-grav="cancelar"]').onclick = () => pararGravacao(true);
    comp.querySelector('[data-grav="enviar"]').onclick = () => pararGravacao(false);
  }
  function pararGravacao(cancelar) {
    const g = S.gravando; if (!g) return;
    S.gravando = null; clearInterval(g.rel);
    g.rec.onstop = async () => {
      g.stream.getTracks().forEach(tk => tk.stop());
      const comp = raiz && raiz.querySelector('#wz-comp');
      if (comp) { comp.classList.remove('gravando'); const gv = comp.querySelector('#wz-grav'); if (gv) gv.remove(); }
      if (cancelar || !S.aberta) return;
      const dur = (Date.now() - g.ini0) / 1000;
      if (dur < 1) { B7.UI.toast('Áudio curto demais.'); return; }
      const blob = new Blob(g.partes, { type: g.rec.mimeType || 'audio/webm' });
      const jid = S.aberta;
      const temp = { id: 'tmp_' + Date.now(), jid, de_mim: true, tipo: 'audio', duracao: Math.round(dur), status: 'PENDING', criada_em: new Date().toISOString(), enviada_por_nome: eu().nome, reacoes: {} };
      S.msgs.push(temp); pintarMensagens(); rolarFim();
      try {
        const ext = /ogg/.test(blob.type) ? 'ogg' : /mp4/.test(blob.type) ? 'm4a' : 'webm';
        const path = await subir(blob, 'audio.' + ext);
        const r = await chamar('enviar_audio', { jid, path });
        if (r.erro) throw new Error(r.erro);
        temp.id = r.id || temp.id; temp.status = 'SERVER_ACK';
      } catch (e) { temp.status = 'ERROR'; B7.UI.toast(e.message || 'O áudio não foi.', { tipo: 'erro' }); }
      pintarMensagens(); rolarFim();
    };
    try { g.rec.stop(); } catch (e) {}
  }

  /* ------------------------------------------------------------ painel do cliente */
  async function pintarLado() {
    const cx = raiz && raiz.querySelector('#wz-lado'); if (!cx) return;
    raiz.classList.toggle('sem-lado', !S.lado || !S.aberta);
    const c = S.aberta && S.porJid.get(S.aberta);
    if (!c) { cx.innerHTML = ''; return; }
    const cli = c.cliente_id && S.clientes.find(x => x.id === c.cliente_id);
    if (!S.equipe) { try { S.equipe = (await B7.DB.listarVideomakers()) || []; } catch (e) { S.equipe = []; } if (!S.aberta || S.aberta !== c.jid) return; }
    const pessoas = S.equipe;
    cx.innerHTML = '<div class="wz-cli">' + avatar(c, 'g') + '<b>' + esc(cli ? cli.nome : (c.nome || num(c.jid))) + '</b><small>' + (cli ? 'Cliente do B7' : c.tipo === 'grupo' ? 'Grupo ainda sem cliente' : esc(fone(c.jid))) + '</small>' +
      (cli ? '<a class="b fina contorno" href="#/cliente/' + esc(cli.id) + '">Abrir o cliente</a>' : '<button class="b fina contorno" data-wz="vincular">Ligar a um cliente</button>') + '</div>' +
      '<div class="wz-box" id="wz-pend"><h4>Com este cliente agora</h4>' + (cli ? '<p class="wz-carregando">Carregando…</p>' : '<p class="wz-mudo">Ligue a conversa a um cliente para ver as pendências.</p>') + '</div>' +
      '<div class="wz-box"><h4>Atendimento</h4><p><span>Esperando resposta</span><b>' + (espera(c.esperando_desde) || (c.esperando_desde ? 'há pouco' : 'não')) + '</b></p>' +
        '<p><span>Responsável</span><select class="campo fina" id="wz-resp"><option value="">Ninguém</option>' +
        pessoas.filter(p => p && p.id).map(p => '<option value="' + esc(p.id) + '"' + (p.id === c.responsavel_id ? ' selected' : '') + '>' + esc(p.nome || '') + '</option>').join('') + '</select></p></div>';
    const sel = cx.querySelector('#wz-resp');
    if (sel) sel.onchange = async () => { c.responsavel_id = sel.value || null; try { await sb().rpc('wa_conversa_marcar', { p_jid: c.jid, p_campo: 'responsavel', p_valor: sel.value }); } catch (e) {} pintarLista(); };
    if (cli) {
      const pend = cx.querySelector('#wz-pend');
      const contar = async (tab, filtro) => { try { let q = sb().from(tab).select('id', { count: 'exact', head: true }); q = filtro(q); const r = await q; return r.count || 0; } catch (e) { return '–'; } };
      const [ds, vd] = await Promise.all([
        contar('design_resumo', q => q.eq('client_id', cli.id).neq('status', 'finalizado')),
        contar('demandas_edicao', q => q.eq('client_id', cli.id).is('deleted_at', null).in('editing_status', ['pendente', 'em_edicao', 'aguardando_aprovacao']))
      ]);
      let grav = '';
      try { const g = await sb().from('gravacoes').select('nome,data_gravacao').eq('client_id', cli.id).is('deleted_at', null).gte('data_gravacao', new Date().toISOString().slice(0, 10)).order('data_gravacao').limit(1); if (g.data && g.data[0]) grav = B7.UI.dataBR ? B7.UI.dataBR(g.data[0].data_gravacao) : g.data[0].data_gravacao; } catch (e) {}
      if (pend && pend.isConnected) pend.innerHTML = '<h4>Com este cliente agora</h4><p><span>Design em produção</span><b>' + ds + '</b></p><p><span>Vídeos em edição</span><b>' + vd + '</b></p><p><span>Próxima gravação</span><b>' + (grav || '—') + '</b></p>';
    }
  }
  function vincularCliente(c) {
    const m = B7.UI.modal('<h3>Ligar a um cliente</h3><div class="sub">' + esc(c.nome || '') + '</div><input class="campo" id="wz-cli-b" placeholder="Buscar cliente…" data-foco>' +
      '<div class="lista solta mostrando wz-cli-lista" id="wz-cli-l" style="position:static;max-height:300px;overflow:auto"></div>' +
      '<div class="acoes">' + (c.cliente_id ? '<button class="b contorno" data-cli="">Desligar do cliente</button>' : '') + '<button class="b" data-fecha>Cancelar</button></div>');
    const l = m.querySelector('#wz-cli-l'), b = m.querySelector('#wz-cli-b');
    const pinta = () => { const t = b.value.trim().toLowerCase(); l.innerHTML = S.clientes.filter(x => !t || x.nome.toLowerCase().includes(t)).slice(0, 60).map(x => '<button data-cli="' + esc(x.id) + '">' + esc(x.nome) + '</button>').join(''); };
    b.oninput = pinta; pinta();
    m.addEventListener('click', async e => {
      const x = e.target.closest('[data-cli]'); if (!x) return;
      m.fechar(); c.cliente_id = x.dataset.cli || null;
      try { await sb().rpc('wa_conversa_marcar', { p_jid: c.jid, p_campo: 'cliente', p_valor: x.dataset.cli }); B7.UI.toast(c.cliente_id ? 'Conversa ligada ao cliente.' : 'Conversa desligada do cliente.'); } catch (er) { B7.UI.toast('Não deu certo.', { tipo: 'erro' }); }
      pintarLista(); pintarChat(); pintarMensagens(); pintarLado();
    });
  }

  /* ------------------------------------------------------------ histórico (admin) */
  async function importar() {
    const m = B7.UI.modal('<h3>Puxar conversas recentes</h3><div class="sub" id="wz-imp">Buscando no WhatsApp…</div><div class="wz-barra"><i id="wz-imp-b"></i></div><div class="acoes"><button class="b" data-fecha>Fechar</button></div>');
    let pagina = 0, tot = { grupos: 0, conversas: 0, mensagens: 0 };
    try {
      while (pagina != null && m.isConnected) {
        /* 4.52.3: direto na função, com até 2 min por pedaço (o atalho do sistema desiste em 20 s) */
        const inv = await Promise.race([B7.sb.functions.invoke('wa-evolution', { body: { acao: 'importar', pagina } }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('O WhatsApp demorou demais. Tente de novo — o que já veio fica guardado.')), 120000))]);
        if (inv.error) { let c = null; try { c = await inv.error.context.json(); } catch (x) {} throw new Error((c && c.erro) || 'Não consegui falar com o WhatsApp do B7.'); }
        const r = inv.data || {};
        if (r.erro) throw new Error(r.erro);
        tot.grupos += r.grupos || 0; tot.conversas += r.conversas || 0; tot.mensagens += r.mensagens || 0;
        const el = m.querySelector('#wz-imp'), b = m.querySelector('#wz-imp-b');
        if (el) el.textContent = tot.mensagens + ' mensagens trazidas' + (tot.grupos ? ' · ' + tot.grupos + ' grupos' : '') + '…';
        if (b && r.total) b.style.width = Math.min(100, Math.round((r.lidas || 0) / r.total * 100)) + '%';
        pagina = r.proxima;
      }
      const el = m.querySelector('#wz-imp'); if (el) el.textContent = 'Pronto: ' + tot.mensagens + ' mensagens trazidas. As novas chegam sozinhas daqui para frente.';
      const bb = m.querySelector('#wz-imp-b'); if (bb) bb.style.width = '100%';
    } catch (e) { const el = m.querySelector('#wz-imp'); if (el) el.textContent = e.message || 'Não deu para puxar agora.'; }
    await carregarConversas(); pintarFiltros(); pintarLista();
  }

  /* ------------------------------------------------------------ tempo real */
  function ligarTempoReal() {
    if (S.canal) B7.DB.fecharCanal(S.canal);
    S.canal = B7.DB.canal('wz-' + Date.now(), [{ table: 'wa_conversas' }, { table: 'wa_mensagens' }], p => {
      if (p.table === 'wa_conversas') {
        const n = p.new && p.new.jid ? p.new : null;
        if (p.eventType === 'DELETE') { S.conversas = S.conversas.filter(c => c.jid !== (p.old && p.old.jid)); }
        else if (n) {
          const i = S.conversas.findIndex(c => c.jid === n.jid);
          if (n.jid === S.aberta && n.nao_lidas > 0 && document.visibilityState === 'visible') { n.nao_lidas = 0; chamar('lida', { jid: n.jid }).catch(() => {}); }
          if (i >= 0) S.conversas[i] = Object.assign(S.conversas[i], n); else S.conversas.push(n);
          S.conversas.sort((a, b) => (b.fixada - a.fixada) || String(b.ultima_em || '').localeCompare(String(a.ultima_em || '')));
        }
        S.porJid = new Map(S.conversas.map(c => [c.jid, c]));
        pintarLista(); pintarFiltros(); pintarContagem();
        return;
      }
      const m = p.new; if (!m || m.jid !== S.aberta) return;
      const i = S.msgs.findIndex(x => x.id === m.id);
      if (i >= 0) S.msgs[i] = Object.assign(S.msgs[i], m);
      else {
        const t = S.msgs.findIndex(x => String(x.id).startsWith('tmp_') && x.de_mim && m.de_mim && x.tipo === m.tipo);
        if (t >= 0 && m.de_mim) S.msgs[t] = m; else S.msgs.push(m);
        S.msgs.sort((a, b) => String(a.criada_em).localeCompare(String(b.criada_em)));
      }
      const cx = raiz && raiz.querySelector('#wz-msgs');
      const noFim = cx && cx.scrollHeight - cx.scrollTop - cx.clientHeight < 140;
      pintarMensagens();
      if (noFim || m.de_mim) rolarFim();
    });
  }

  /* número de não lidas no menu lateral */
  function pintarContagem() {
    const n = S.conversas.filter(c => !c.arquivada).reduce((s, c) => s + (c.nao_lidas ? 1 : 0), 0);
    document.querySelectorAll('[data-nav="whatsapp"]').forEach(a => {
      let b = a.querySelector('.wz-nav-n');
      if (!n) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('i'); b.className = 'wz-nav-n'; a.appendChild(b); }
      b.textContent = n > 99 ? '99+' : n;
    });
  }
  /* fora da tela: mantém o número do menu em dia (leve: uma consulta a cada 60 s) */
  async function contarFora() {
    if (!B7.sb || !B7.Auth || !B7.Auth.usuario() || (S.canal && raiz && raiz.isConnected)) return;
    try {
      const r = await sb().from('wa_conversas').select('jid,nao_lidas,arquivada').gt('nao_lidas', 0).eq('arquivada', false).limit(200);
      if (r.error) return;
      S.conversas = S.canal ? S.conversas : (r.data || []);
      const n = (r.data || []).length;
      document.querySelectorAll('[data-nav="whatsapp"]').forEach(a => {
        let b = a.querySelector('.wz-nav-n');
        if (!n) { if (b) b.remove(); return; }
        if (!b) { b = document.createElement('i'); b.className = 'wz-nav-n'; a.appendChild(b); }
        b.textContent = n > 99 ? '99+' : n;
      });
    } catch (e) {}
  }
  setInterval(contarFora, 60000);
  addEventListener('hashchange', () => setTimeout(contarFora, 400));
  setTimeout(contarFora, 4000);

  return { abrir };
})();
