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
    fig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12.5V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h5.5"/><path d="M20 12.5 12.5 20c0-4.1 3.4-7.5 7.5-7.5Z"/><path d="M9 10h.01M15 10h.01" stroke-width="3"/><path d="M9 14.5c.8.6 1.8 1 3 1"/></svg>',
    emoji: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="3"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    env: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>',
    volta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    lado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M14.5 4.5v15"/></svg>',
    mais: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
    ia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
    baixar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>',
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
  /* 4.53.1: "@178859651645554" (menção por código do WhatsApp) → "@Nome" */
  const nomeCodigo = d => {
    let n = S.contatos && (S.contatos.get(d + '@lid') || S.contatos.get(d + '@s.whatsapp.net'));
    /* 4.66.6: quem escreveu nesta conversa também serve (o @lid nem sempre está nos contatos) */
    if (!n || /^\+?\d+$/.test(n)) { const m = (S.msgs || []).find(x => x.autor_nome && (x.autor_jid === d + '@lid' || x.autor_jid === d + '@s.whatsapp.net')); n = m && m.autor_nome; }
    return n && !/^\+?\d+$/.test(n) ? n : null;
  };
  const semCodigos = t => String(t || '').replace(/@(\d{8,})/g, (x, d) => { const n = nomeCodigo(d); return n ? '@' + n : x; });
  function textoRico(t) {
    let h = esc(semCodigos(t));
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
    /* 4.55.0: acende o WhatsApp no menu lateral (cada tela marca o seu item) */
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/whatsapp');
    painel.innerHTML = '<div class="wz" id="wz"><div class="wz-carrega"><i></i><span>Abrindo as conversas…</span></div></div>';
    raiz = painel.querySelector('#wz');
    let pode = false;
    try { const r = await sb().rpc('pode_ver_wa'); pode = !!r.data; } catch (e) {}
    if (!pode) { raiz.innerHTML = '<div class="wz-vazio"><span class="wz-vazio-ic">' + I.wa + '</span><b>As conversas do WhatsApp são da equipe de vídeo</b><p>Peça acesso a um administrador.</p></div>'; return; }
    try { S.clientes = (await sb().from('clientes_resumo').select('id,nome,logo_url').is('deleted_at', null).order('nome')).data || []; } catch (e) {}
    S.contatos = null;
    await carregarConversas();
    if (!raiz.isConnected) return;   /* a pessoa já foi para outra tela */
    desenhar();
    ligarTempoReal();
    atualizarContatosDeVezEmQuando();
    if (B7.Rota && B7.Rota.aoSair) B7.Rota.aoSair(sair);
    const alvo = (location.hash.split('?')[1] || '').match(/jid=([^&]+)/);
    if (alvo) abrirConversa(decodeURIComponent(alvo[1]));
  }
  function sair() {
    if (S.canal) { B7.DB.fecharCanal(S.canal); S.canal = null; }
    pararGravacao(true);
    S.aberta = null; document.body.classList.remove('wz-tela-cheia');
  }

  async function carregarContatos() {
    try {
      const { data } = await sb().from('wa_contatos').select('jid,nome').not('nome', 'is', null).limit(5000);
      S.contatos = new Map((data || []).map(x => [x.jid, x.nome]));
    } catch (e) { S.contatos = S.contatos || new Map(); }
  }
  /* admin: nomes e fotos dos contatos, no máximo a cada 6 h (4.58.6: as fotos vencem) */
  function atualizarContatosDeVezEmQuando() {
    if (!souAdmin()) return;
    let ult = 0; try { ult = Number(localStorage.getItem('b7.wz.contatos2') || 0); } catch (e) {}
    if (Date.now() - ult < 6 * 3600e3) return;
    try { localStorage.setItem('b7.wz.contatos2', String(Date.now())); } catch (e) {}
    chamar('contatos').then(async () => { await Promise.all([carregarContatos(), carregarConversas()]); pintarLista(); }).catch(() => {});
  }
  async function carregarConversas() {
    /* 4.53.6: os nomes dos contatos chegam depois — não seguram a abertura da tela */
    if (!S.contatos) { S.contatos = new Map(); carregarContatos().then(() => { if (raiz && raiz.isConnected) pintarLista(); }); }
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
            '<button data-wz="conexao">Conexão do número</button><button data-wz="importar">Puxar conversas recentes</button><button data-wz="drive">Arquivos no Google Drive</button><button data-wz="assistente">🤖 Otto · assistente nos grupos</button></div></div>' : '') +
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

  const FILTROS = [['tudo', 'Tudo'], ['naolidas', 'Não lidas'], ['esperando', 'Esperando'], ['grupos', 'Grupos'], ['arquivadas', 'Arquivadas']];
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
      const pa = c.previa_autor && /^\+?\d+$/.test(c.previa_autor) ? (nomeCodigo(c.previa_autor.replace('+', '')) || '') : c.previa_autor;
      const autor = c.previa_de_mim ? 'Você: ' : (c.tipo === 'grupo' && pa ? pa.split(' ')[0] + ': ' : '');
      return '<button class="wz-it' + (S.aberta === c.jid ? ' on' : '') + (c.nao_lidas ? ' nl' : '') + '" data-jid="' + esc(c.jid) + '">' + avatar(c) +
        '<span class="wz-it-tx"><span class="wz-l1"><b>' + esc(c.nome || num(c.jid)) + '</b><time>' + esc(hora(c.ultima_em)) + '</time></span>' +
        '<span class="wz-l2"><span>' + esc(autor + semCodigos(c.previa)) + '</span>' +
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
    if (!antigas) pintarLado();   /* 4.66.6: última mensagem e mídia recente no painel */
    const cx = raiz.querySelector('#wz-msgs');
    if (cx) cx.scrollTop = antigas ? cx.scrollHeight - alt : cx.scrollHeight;
  }

  /* 4.73.1: tocar na mensagem citada leva até ela — se for antiga (ainda não carregada), carrega até lá */
  async function irParaMensagem(id) {
    const achar = () => raiz.querySelector('.wz-b[data-id="' + CSS.escape(id) + '"], .wz-nota[data-id="' + CSS.escape(id) + '"]');
    let alvo = achar();
    if (!alvo && S.aberta && S.msgs.length) {
      const jid = S.aberta;
      const { data: m } = await sb().from('wa_mensagens').select('criada_em').eq('id', id).eq('jid', jid).maybeSingle();
      if (!m) { B7.UI.toast('Essa mensagem não está mais aqui (apagada ou de antes do B7).'); return; }
      if (m.criada_em < S.msgs[0].criada_em) {
        const { data } = await sb().from('wa_mensagens').select('*').eq('jid', jid).gte('criada_em', m.criada_em).lt('criada_em', S.msgs[0].criada_em).order('criada_em', { ascending: true }).limit(1500);
        if (S.aberta !== jid) return;
        S.msgs = (data || []).concat(S.msgs);
        pintarMensagens();
      }
      alvo = achar();
    }
    if (!alvo) { B7.UI.toast('Não achei essa mensagem.'); return; }
    alvo.scrollIntoView({ block: 'center', behavior: 'smooth' });
    alvo.classList.remove('pisca'); void alvo.offsetWidth; alvo.classList.add('pisca');
    setTimeout(() => alvo.classList.remove('pisca'), 1800);
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
        '<div class="wz-cab-tx"><b class="wz-cab-nome" data-wz="renomear" title="Clique para renomear">' + esc(c.nome || num(c.jid)) + '</b><small>' + (c.tipo === 'grupo' ? 'Grupo' : esc(fone(c.jid))) + (cli ? ' · cliente ' + esc(cli.nome) : '') + '</small></div>' +
        '<div class="wz-cab-acoes"><button class="wz-ic wz-so-pc' + (S.lado ? ' on' : '') + '" data-wz="lado" title="Painel do cliente">' + I.lado + '</button>' +
          '<div class="menu"><button class="wz-ic" data-menu aria-label="Opções da conversa">' + I.mais + '</button><div class="lista">' +
            '<button data-wz="renomear">' + (c.tipo === 'grupo' ? 'Renomear grupo (só no B7)' : 'Renomear contato') + '</button>' +
            '<button data-wz="fixar">' + (c.fixada ? 'Desafixar' : 'Fixar no topo') + '</button>' +
            '<button data-wz="arquivar">' + (c.arquivada ? 'Desarquivar' : 'Arquivar') + '</button>' +
            '<button data-wz="semespera">Não precisa responder</button>' +
            (c.tipo === 'grupo' ? '<button data-wz="vincular">Ligar a um cliente…</button>' : '') +
          '</div></div></div></header>' +
      '<div class="wz-msgs" id="wz-msgs"></div>' +
      '<div class="wz-solta" id="wz-solta" hidden><b>Solte para enviar</b></div>' +
      '<div class="wz-cita" id="wz-cita" hidden></div>' +
      '<footer class="wz-comp" id="wz-comp">' +
        '<div class="menu wz-anexo"><button class="wz-ic" data-menu aria-label="Anexar">' + I.clip + '</button><div class="lista">' +
          '<button data-wz="anexo-midia">🖼️ Fotos e vídeos</button><button data-wz="anexo-doc">📄 Documento</button><button data-wz="anexo-cam" class="wz-so-cel">📷 Câmera</button><hr><button data-wz="nota">🔒 Nota interna (só a equipe vê)</button></div></div>' +
        '<div class="menu wz-emo"><button class="wz-ic" data-menu aria-label="Emoji">' + I.emoji + '</button><div class="lista wz-emojis">' +
          '😀 😂 😍 🥰 😎 🤩 😉 🙏 👍 👏 🙌 💪 ❤️ 🔥 ✨ 🎉 ✅ 📌 📷 🎬 🎨 📅 ⏰ 💜'.split(' ').map(e => '<button data-emoji="' + e + '">' + e + '</button>').join('') + '</div></div>' +
        '<button class="wz-ic wz-fig-bt" data-wz="figs" aria-label="Figurinhas" title="Figurinhas">' + I.fig + '</button>' +
        '<div class="wz-figs" id="wz-figs" hidden></div>' +
        '<div class="wz-men" id="wz-men" hidden></div>' +
        /* 4.69.0: ajuda da IA — sugerir resposta e corrigir o texto (nada é enviado sozinho) */
        '<div class="menu wz-ia"><button class="wz-ic" data-menu aria-label="Ajuda da IA" title="Sugerir ou corrigir com IA">' + I.ia + '</button><div class="lista">' +
          '<button data-ia="sugerir"><b>Sugerir resposta</b><small>O Otto escreve um rascunho com base na conversa. Se já tiver texto, ele usa como guia.</small></button><hr>' +
          '<button data-ia="manter"><b>Corrigir o texto</b><small>Ortografia e pontuação, sem mudar o jeito.</small></button>' +
          '<button data-ia="formal">Deixar mais formal</button><button data-ia="leve">Deixar mais leve</button><button data-ia="curto">Deixar mais curto</button></div></div>' +
        '<div class="wz-ia-aviso" id="wz-ia-aviso" hidden></div>' +
        '<textarea id="wz-texto" rows="1" placeholder="Digite uma mensagem"></textarea>' +
        '<button class="wz-env" id="wz-env" aria-label="Gravar áudio">' + I.mic + '</button>' +
      '</footer>' +
      '<input type="file" id="wz-arq-fig" accept="image/*" hidden><input type="file" id="wz-arq-midia" accept="image/*,video/*" multiple hidden><input type="file" id="wz-arq-doc" multiple hidden><input type="file" id="wz-arq-cam" accept="image/*" capture="environment" hidden>';
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
    repintarAudios();
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
        corpo += '<span class="wz-q" data-ir-msg="' + esc(m.citada_id) + '"><b style="--c:' + corDe(qa) + '">' + esc(qa || 'Mensagem') + '</b>' + esc(semCodigos((q && (q.texto || q.midia_nome)) || m.citada_previa || '')) + '</span>';
      }
      corpo += midia(m);
      if (m.texto && m.tipo !== 'localizacao' && m.tipo !== 'contato' && m.tipo !== 'enquete') corpo += '<span class="wz-txt">' + textoRico(m.texto) + '</span>';
    }
    const autor = !m.de_mim && grupo && !seguida ? '<span class="wz-autor" style="--c:' + corDe(m.autor_nome || m.autor_jid) + '">' + esc(m.autor_nome || num(m.autor_jid)) + '</span>' : '';
    const quem = m.de_mim && m.enviada_por_nome ? '<span class="wz-quem">' + esc(m.enviada_por_nome.split(' ')[0]) + '</span>' : '';
    /* 4.66.3: a bolinha de reações abre quem reagiu (e deixa tirar a sua) */
    const reac = m.reacoes && Object.keys(m.reacoes).length ? '<button type="button" class="wz-reac' + (Object.values(m.reacoes).some(l => l.includes('eu')) ? ' minha' : '') + '" data-acao-msg="reacoes" title="Ver quem reagiu">' + Object.entries(m.reacoes).map(([e, l]) => e + (l.length > 1 ? ' ' + l.length : '')).join(' ') + '</button>' : '';
    return '<div class="wz-b ' + lado + (seguida ? ' seg' : '') + (m.tipo === 'figurinha' ? ' fig' : '') + '" data-id="' + esc(m.id) + '">' + autor + corpo +
      '<span class="wz-h">' + quem + (m.editada ? 'editada · ' : '') + hm(m.criada_em) + (m.de_mim ? ticks(m.status) : '') + '</span>' + reac +
      (m.apagada ? '' : '<span class="wz-b-acoes"><button data-acao-msg="citar" title="Responder">' + I.resp + '</button><button data-acao-msg="reagir" title="Reagir">😊</button>' + (/^(imagem|video|audio|documento|figurinha)$/.test(m.tipo) ? '<button data-baixar="' + esc(m.id) + '" title="Baixar">' + I.baixar + '</button>' : '') + (m.de_mim && m.tipo === 'texto' && !m.nota && Date.now() - new Date(m.criada_em).getTime() < 15 * 60e3 ? '<button data-acao-msg="editar" title="Editar">✏️</button>' : '') + (m.de_mim ? '<button data-acao-msg="apagar" title="Apagar para todos">' + I.lixo + '</button>' : '') + '</span>') +
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
        return '<span class="wz-aud" data-carregar="audio" data-id="' + id + '"><button class="wz-aud-p" aria-label="Tocar">' + I.play + '</button><span class="wz-onda">' + ondas + '</span><em>' + mmss(m.duracao) + '</em><button class="wz-aud-vel" data-vel aria-label="Velocidade do áudio" title="Velocidade">' + velTx() + '</button><button class="wz-aud-dl" data-baixar="' + id + '" title="Baixar o áudio" aria-label="Baixar o áudio">' + I.baixar + '</button></span>'
          + (m.texto ? '' : '<button class="wz-transc" data-transc="' + id + '">Transcrever</button>');
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
      if (t === 'img') { el.innerHTML = '<img src="' + esc(url) + '" alt="" data-zoom="' + esc(url) + '">'; const im = el.querySelector('img'); im.onload = () => { if (S.grudado !== false) rolarFim(); }; if (tocar === true) previa(el.dataset.id, url); }
      else if (t === 'video') el.outerHTML = '<video class="wz-video" src="' + esc(url) + '" controls ' + (tocar ? 'autoplay' : '') + ' playsinline></video>';
      else if (t === 'doc') window.open(url, '_blank', 'noopener');
      else if (t === 'audio') {
        const a = player(el.dataset.id, url);
        if (tocar) a.play().catch(() => { B7.UI.toast('Não deu para tocar este áudio.', { tipo: 'erro' }); });
      }
      el.dataset.ok = '1';
    } catch (e) { if (tocar !== false) B7.UI.toast(e.message || 'Não deu para abrir.', { tipo: 'erro' }); }
    finally { delete el.dataset.busy; el.classList.remove('carregando'); }
  }
  /* 4.67.1: baixar áudio, foto, vídeo, documento ou figurinha — salva direto, com nome e data */
  const EXT_MIME = { 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/webm': 'webm', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'application/pdf': 'pdf' };
  async function baixarMidia(id, bt) {
    const m = S.msgs.find(x => x.id === id); if (!m) return;
    if (bt) bt.classList.add('carregando');
    try {
      const url = await urlMidia(id);
      const r = await fetch(url); if (!r.ok) throw new Error('O arquivo não veio (' + r.status + ').');
      const blob = await r.blob();
      const mime = String(m.midia_mime || blob.type || '').split(';')[0];
      const ext = EXT_MIME[mime] || (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin';
      const c = S.porJid.get(m.jid);
      const quando = new Date(m.criada_em); const dd = n => String(n).padStart(2, '0');
      const carimbo = quando.getFullYear() + '-' + dd(quando.getMonth() + 1) + '-' + dd(quando.getDate()) + ' ' + dd(quando.getHours()) + 'h' + dd(quando.getMinutes());
      const quem = (m.de_mim ? (m.enviada_por_nome || 'B7') : (m.autor_nome || (c && c.nome) || 'contato')).split(' ')[0];
      const tipo = { audio: 'Áudio', imagem: 'Foto', video: 'Vídeo', figurinha: 'Figurinha', documento: 'Documento' }[m.tipo] || 'Arquivo';
      const nome = (m.tipo === 'documento' && m.midia_nome ? m.midia_nome : tipo + ' ' + quem + ' ' + carimbo + '.' + ext).replace(/[\\/:*?"<>|]+/g, '');
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30e3);
    } catch (e) { B7.UI.toast(e.message || 'Não deu para baixar.', { tipo: 'erro' }); }
    finally { if (bt) bt.classList.remove('carregando'); }
  }
  /* 4.80.3: o áudio não mora mais dentro do balão. Quando a conversa se redesenha (mensagem nova, status,
     reação), o balão é trocado — antes o som continuava tocando num elemento que já tinha saído da tela e o
     botão novo ficava parado em "tocar". Agora cada áudio fica guardado pelo id da mensagem e a tela é
     repintada a partir dele, seja qual for o balão que estiver na tela. */
  const players = new Map();
  const VELS = [1, 1.5, 2];
  let vel = 1; try { vel = Number(localStorage.getItem('b7.wz.vel')) || 1; if (!VELS.includes(vel)) vel = 1; } catch (_e) { /* sem armazenamento */ }
  function velTx() { return String(vel).replace('.', ',') + '×'; }
  function baloesDe(id) { return raiz ? [...raiz.querySelectorAll('.wz-aud[data-id="' + CSS.escape(id) + '"]')] : []; }
  function pintarAudio(id) {
    const a = players.get(id); if (!a) return;
    const p = a.duration ? a.currentTime / a.duration : 0, tocando = !a.paused && !a.ended;
    baloesDe(id).forEach(el => {
      const bt = el.querySelector('.wz-aud-p'), em = el.querySelector('em');
      if (bt && bt.dataset.est !== String(tocando)) { bt.dataset.est = String(tocando); bt.innerHTML = tocando ? I.pause : I.play; bt.setAttribute('aria-label', tocando ? 'Pausar' : 'Tocar'); }
      el.classList.toggle('tocando', tocando); el.classList.toggle('esperando', tocando && a.readyState < 3);
      el.querySelectorAll('.wz-onda u').forEach((u, i, l) => u.classList.toggle('p', i / l.length < p));
      if (em) em.textContent = mmss(a.currentTime > 0 ? a.currentTime : a.duration);
      el.dataset.ok = '1';
    });
  }
  function player(id, url) {
    let a = players.get(id);
    if (a) return a;
    a = new Audio(url); a.preload = 'auto'; a.playbackRate = vel;
    const pinta = () => pintarAudio(id);
    ['timeupdate', 'play', 'playing', 'pause', 'waiting', 'loadedmetadata', 'canplay'].forEach(ev => a.addEventListener(ev, pinta));
    a.addEventListener('play', () => { a.playbackRate = vel; players.forEach((x, k) => { if (k !== id && !x.paused) x.pause(); }); });
    a.addEventListener('ended', () => { a.currentTime = 0; pinta(); });
    players.set(id, a);
    return a;
  }
  function trocarVelocidade() {
    vel = VELS[(VELS.indexOf(vel) + 1) % VELS.length];
    try { localStorage.setItem('b7.wz.vel', String(vel)); } catch (_e) { /* sem armazenamento */ }
    players.forEach(a => { a.playbackRate = vel; });
    if (raiz) raiz.querySelectorAll('.wz-aud-vel').forEach(b => { b.textContent = velTx(); });
  }
  /* depois de redesenhar a conversa, os balões novos pegam o estado do áudio que já está tocando */
  function repintarAudios() { players.forEach((_a, id) => pintarAudio(id)); }

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
    const ia = e.target.closest('[data-ia]'); if (ia) { B7.UI.fecharMenus && B7.UI.fecharMenus(); return ajudaIA(ia.dataset.ia); }
    const iad = e.target.closest('[data-ia-desfaz]'); if (iad) { const t = raiz.querySelector('#wz-texto'); if (t && S.iaAntes != null) { t.value = S.iaAntes; t.dispatchEvent(new Event('input')); t.focus(); } S.iaAntes = null; avisoIA(''); return; }
    const aj = e.target.closest('[data-abrir-jid]'); if (aj) return abrirConversa(aj.dataset.abrirJid);
    const bx = e.target.closest('[data-baixar]'); if (bx) { e.stopPropagation(); return baixarMidia(bx.dataset.baixar, bx); }
    const f = e.target.closest('[data-filtro]'); if (f) { S.filtro = f.dataset.filtro; pintarFiltros(); pintarLista(); return; }
    const em = e.target.closest('[data-emoji]'); if (em) { const t = raiz.querySelector('#wz-texto'); if (t) { t.setRangeText(em.dataset.emoji, t.selectionStart, t.selectionEnd, 'end'); t.focus(); t.dispatchEvent(new Event('input')); } B7.UI.fecharMenus && B7.UI.fecharMenus(); return; }
    const md = e.target.closest('[data-carregar]');
    if (md && md.dataset.carregar === 'audio') {
      if (e.target.closest('[data-vel]')) return trocarVelocidade();
      const a = players.get(md.dataset.id);
      if (!a) return carregarMidia(md, true);
      const onda = e.target.closest('.wz-onda');
      if (onda) { if (a.duration) { const r = onda.getBoundingClientRect(); a.currentTime = a.duration * Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); if (a.paused) a.play().catch(() => {}); } return; }
      if (a.paused) a.play().catch(() => {}); else a.pause();
      return;
    }
    if (md) { if (md.dataset.carregar === 'img' && md.dataset.ok) { const im = md.querySelector('img[data-zoom]'); if (im) previa(md.dataset.id, im.dataset.zoom); return; } return carregarMidia(md, true); }
    const mn = e.target.closest('[data-men]'); if (mn) { escolherMencao(mn.dataset.men); return; }
    const tr = e.target.closest('[data-transc]');
    if (tr) {
      if (tr.disabled) return; tr.disabled = true; tr.textContent = 'Transcrevendo…';
      chamar('transcrever', { id: tr.dataset.transc }).then(r => {
        if (r.erro) throw new Error(r.erro);
        const sp = document.createElement('span'); sp.className = 'wz-txt'; sp.textContent = r.texto; tr.replaceWith(sp);
      }).catch(err => { tr.disabled = false; tr.textContent = 'Transcrever'; B7.UI.toast(err.message || 'Não deu para transcrever.'); });
      return;
    }
    const fg = e.target.closest('[data-fig]'); if (fg) { if (fg.querySelector('img')) enviarFigurinha({ id: fg.dataset.fig }); return; }
    if (!e.target.closest('#wz-figs, .wz-fig-bt')) { const fx = raiz.querySelector('#wz-figs'); if (fx && !fx.hidden) fx.hidden = true; }
    const z = e.target.closest('[data-zoom]'); if (z) { const b = z.closest('[data-id]'); return previa(b ? b.dataset.id : '', z.dataset.zoom); }
    const q = e.target.closest('[data-ir-msg]'); if (q) { irParaMensagem(q.dataset.irMsg); return; }
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
    if (a === 'figs') return abrirFigurinhas();
    if (a === 'fig-nova') return raiz.querySelector('#wz-arq-fig').click();
    if (a === 'drive') return modalDrive();
    if (a === 'assistente') { location.hash = '#/whatsapp/assistente'; return; }
    if (a === 'anexo-midia') return raiz.querySelector('#wz-arq-midia').click();
    if (a === 'anexo-doc') return raiz.querySelector('#wz-arq-doc').click();
    if (a === 'anexo-cam') return raiz.querySelector('#wz-arq-cam').click();
    if (a === 'nota') return notaInterna();
    if (!c) return;
    const marcar = async (campo, valor) => { try { await sb().rpc('wa_conversa_marcar', { p_jid: c.jid, p_campo: campo, p_valor: valor == null ? null : String(valor) }); } catch (e) { B7.UI.toast('Não deu certo.', { tipo: 'erro' }); } };
    if (a === 'fixar') { c.fixada = !c.fixada; await marcar('fixada', c.fixada); }
    if (a === 'arquivar') { c.arquivada = !c.arquivada; await marcar('arquivada', c.arquivada); B7.UI.toast(c.arquivada ? 'Conversa arquivada.' : 'Conversa de volta à lista.'); }
    if (a === 'semespera') { c.esperando_desde = null; c.aguardando_cliente_desde = null; c.vez = 'ninguem'; c.vez_motivo = 'Marcado pela equipe como respondido'; await marcar('sem_espera'); }
    if (a === 'vincular') return vincularCliente(c);
    if (a === 'renomear') {
      /* 4.80.3: dar nome a quem chega sem nome ("." ou só o número). Fica fixo: o WhatsApp não troca de volta. */
      const novo = await B7.UI.perguntar({ titulo: c.tipo === 'grupo' ? 'Renomear grupo' : 'Renomear contato',
        rotulo: (c.tipo === 'grupo' ? 'O nome muda só aqui no B7 (o grupo no WhatsApp continua igual).' : 'Número: ' + fone(c.jid) + '. O nome vale aqui no B7 e para o Otto.') + ' Deixe vazio para voltar ao nome do WhatsApp.',
        placeholder: 'Ex.: Ana — Mercato', valor: c.nome && !/^\+?\d+$/.test(c.nome) && /[\p{L}\p{N}]/u.test(c.nome) ? c.nome : '', confirmar: 'Salvar' });
      if (novo == null) return;
      const { error } = await sb().rpc('wa_conversa_marcar', { p_jid: c.jid, p_campo: 'nome', p_valor: novo.replace(/\s+/g, ' ').slice(0, 80) });
      if (error) { B7.UI.toast('Não deu para renomear.', { tipo: 'erro' }); return; }
      if (novo) { c.nome = novo.replace(/\s+/g, ' ').slice(0, 80); c.nome_fixo = true; S.msgs && S.msgs.forEach(m => { if (m.autor_jid === c.jid && !m.de_mim) m.autor_nome = c.nome; }); }
      else { c.nome_fixo = false; if (c.tipo !== 'grupo') c.nome = num(c.jid); }
      B7.UI.toast(novo ? 'Nome salvo.' : 'Voltou ao nome do WhatsApp.');
    }
    pintarLista(); pintarFiltros(); pintarChat(); pintarMensagens();
  }

  async function acaoMsg(a, id, bt) {
    const m = S.msgs.find(x => x.id === id); if (!m) return;
    if (a === 'citar') { S.citar = m; pintarCitacao(); raiz.querySelector('#wz-texto').focus(); return; }
    if (a === 'editar') {
      const novo = await B7.UI.perguntar({ titulo: 'Editar mensagem', rotulo: 'O WhatsApp mostra “editada” para todos. Dá até 15 minutos depois de enviar.', valor: m.texto || '', confirmar: 'Salvar' });
      if (novo == null || !novo.trim() || novo.trim() === (m.texto || '').trim()) return;
      try { const r = await chamar('editar', { id, texto: novo.trim() }); if (r.erro) throw new Error(r.erro); m.texto = novo.trim(); m.editada = true; pintarMensagens(); }
      catch (e) { B7.UI.toast(e.message, { tipo: 'erro' }); }
      return;
    }
    if (a === 'apagar') {
      const ok = await B7.UI.confirmar({ titulo: 'Apagar para todos?', texto: 'A mensagem some para todo mundo na conversa.', confirmar: 'Apagar', perigo: true });
      if (!ok) return;
      try { const r = await chamar('apagar', { id }); if (r.erro) throw new Error(r.erro); } catch (e) { B7.UI.toast(e.message, { tipo: 'erro' }); }
      return;
    }
    if (a === 'reacoes') return quemReagiu(m, bt);
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

  /* quem reagiu: nome de cada pessoa + "Tirar" na sua reação */
  function nomeDoJid(jid) {
    if (jid === 'eu') return 'Você';
    const c = S.porJid.get(S.aberta);
    if (c && jid === c.jid && !/@g\.us$/.test(c.jid)) return c.nome || '+' + num(jid);
    const daMsg = S.msgs.find(x => x.autor_jid === jid && x.autor_nome);
    if (daMsg) return daMsg.autor_nome;
    const ct = S.contatos && S.contatos.get(jid);
    if (ct) return ct;
    return /@lid$/.test(jid) ? 'Contato' : '+' + num(jid);
  }
  function quemReagiu(m, bt) {
    document.querySelectorAll('.wz-reagiram').forEach(x => x.remove());
    const linhas = [];
    Object.entries(m.reacoes || {}).forEach(([e, l]) => l.forEach(j => linhas.push({ e, j })));
    linhas.sort((a, b) => (b.j === 'eu') - (a.j === 'eu'));
    const caixa = document.createElement('div'); caixa.className = 'wz-reagiram'; caixa.setAttribute('role', 'dialog');
    caixa.innerHTML = '<div class="wz-rg-cab">' + linhas.length + (linhas.length === 1 ? ' reação' : ' reações') + '</div>' +
      linhas.map(x => '<div class="wz-rg-l' + (x.j === 'eu' ? ' eu' : '') + '"><span class="wz-rg-n">' + esc(nomeDoJid(x.j)) +
        (x.j === 'eu' ? '<small>Clique para tirar</small>' : '') + '</span><span class="wz-rg-e">' + x.e + '</span></div>').join('');
    document.body.appendChild(caixa);
    const r = bt.getBoundingClientRect(), h = caixa.offsetHeight, w = caixa.offsetWidth;
    caixa.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    caixa.style.top = (r.top - h - 8 > 8 ? r.top - h - 8 : Math.min(innerHeight - h - 8, r.bottom + 8)) + 'px';
    const fechar = () => { caixa.remove(); document.removeEventListener('pointerdown', fora, true); document.removeEventListener('keydown', esc_); };
    const fora = ev => { if (!caixa.contains(ev.target)) fechar(); };
    const esc_ = ev => { if (ev.key === 'Escape') fechar(); };
    setTimeout(() => { document.addEventListener('pointerdown', fora, true); document.addEventListener('keydown', esc_); }, 0);
    caixa.onclick = async ev => {
      if (!ev.target.closest('.wz-rg-l.eu')) return;
      fechar();
      const antes = JSON.parse(JSON.stringify(m.reacoes || {}));
      for (const k of Object.keys(m.reacoes || {})) { m.reacoes[k] = m.reacoes[k].filter(x => x !== 'eu'); if (!m.reacoes[k].length) delete m.reacoes[k]; }
      pintarMensagens();
      try { const x = await chamar('reagir', { id: m.id, emoji: '' }); if (x.erro) throw new Error(x.erro); }
      catch (e2) { m.reacoes = antes; pintarMensagens(); B7.UI.toast(e2.message || 'Não deu para tirar a reação.', { tipo: 'erro' }); }
    };
  }

  function pintarCitacao() {
    const cx = raiz.querySelector('#wz-cita'); if (!cx) return;
    if (!S.citar) { cx.hidden = true; cx.innerHTML = ''; return; }
    const q = S.citar;
    cx.hidden = false;
    cx.innerHTML = '<div><b>' + esc(q.de_mim ? 'Você' : (q.autor_nome || '')) + '</b><span>' + esc(q.texto || q.midia_nome || ({ imagem: '📷 Foto', video: '🎬 Vídeo', audio: '🎤 Áudio' })[q.tipo] || 'Mensagem') + '</span></div><button class="wz-ic" data-tira-cita aria-label="Cancelar resposta">✕</button>';
    cx.querySelector('[data-tira-cita]').onclick = () => { S.citar = null; pintarCitacao(); };
  }

  function zoom(url) { previa('', url); }
  /* 4.67.2: prévia da foto em tela cheia — passa pelas fotos da conversa (setas / ← →), baixar, Esc fecha */
  function previa(id, url) {
    document.querySelectorAll('.wz-zoom').forEach(x => x.remove());
    const fotos = S.msgs.filter(m => m.tipo === 'imagem' && !m.apagada);
    let i = id ? fotos.findIndex(m => m.id === id) : -1;   /* -1: foto fora da lista (figurinha, etc.) — mostra só ela */
    const z = document.createElement('div'); z.className = 'wz-zoom'; z.setAttribute('role', 'dialog'); z.setAttribute('aria-label', 'Prévia da foto');
    z.innerHTML = '<div class="wz-zoom-topo"><div class="wz-zoom-info"><b></b><small></small></div><button class="wz-zoom-bt" data-z="baixar" title="Baixar">' + I.baixar + '</button><button class="wz-zoom-bt" data-z="fechar" title="Fechar (Esc)">✕</button></div>' +
      '<button class="wz-zoom-seta e" data-z="ant" aria-label="Foto anterior">‹</button><figure><img alt=""></figure><button class="wz-zoom-seta d" data-z="prox" aria-label="Próxima foto">›</button>' +
      '<div class="wz-zoom-legenda"></div>';
    document.body.appendChild(z);
    const img = z.querySelector('img');
    const mostra = async () => {
      const m = i >= 0 ? fotos[i] : null;
      const c = m && S.porJid.get(m.jid);
      z.querySelector('.wz-zoom-info b').textContent = m ? (m.de_mim ? (m.enviada_por_nome || 'Você') : (m.autor_nome || (c && c.nome) || 'Contato')) : 'Foto';
      z.querySelector('.wz-zoom-info small').textContent = m ? new Date(m.criada_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às') + (fotos.length > 1 ? ' · ' + (i + 1) + ' de ' + fotos.length : '') : '';
      z.querySelector('.wz-zoom-legenda').textContent = m && m.texto ? semCodigos(m.texto) : '';
      z.querySelector('[data-z="ant"]').hidden = !(i > 0);
      z.querySelector('[data-z="prox"]').hidden = !(i >= 0 && i < fotos.length - 1);
      z.querySelector('[data-z="baixar"]').hidden = !m;
      if (m && m.miniatura) img.src = 'data:image/jpeg;base64,' + m.miniatura;
      img.classList.add('carregando');
      try { const u = m ? (m.id === id && url ? url : await urlMidia(m.id)) : url; if (z.isConnected && (i < 0 || fotos[i] === m)) img.src = u; }
      catch (e) { B7.UI.toast('Não deu para abrir a foto.', { tipo: 'erro' }); }
      img.onload = () => img.classList.remove('carregando');
    };
    const fechar = () => { z.remove(); document.removeEventListener('keydown', tecla); };
    const vai = d => { const n = i + d; if (n < 0 || n >= fotos.length) return; i = n; mostra(); };
    const tecla = e => { if (e.key === 'Escape') fechar(); else if (e.key === 'ArrowLeft') vai(-1); else if (e.key === 'ArrowRight') vai(1); };
    document.addEventListener('keydown', tecla);
    z.addEventListener('click', e => {
      const b = e.target.closest('[data-z]');
      if (b) { e.stopPropagation(); const a = b.dataset.z; if (a === 'fechar') fechar(); else if (a === 'ant') vai(-1); else if (a === 'prox') vai(1); else if (a === 'baixar' && fotos[i]) baixarMidia(fotos[i].id, b); return; }
      if (e.target === img) return;
      fechar();
    });
    /* celular: arrastar para o lado troca de foto */
    let x0 = null;
    z.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    z.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) vai(dx < 0 ? 1 : -1); });
    mostra();
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
    t.addEventListener('keydown', e => {
      /* 4.56.0: lista de menção aberta — setas escolhem, Enter/Tab marca, Esc fecha */
      const men = raiz.querySelector('#wz-men');
      if (men && !men.hidden) {
        const itens = [...men.querySelectorAll('[data-men]')]; let i = itens.findIndex(x => x.classList.contains('on'));
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!itens.length) return; i = (i + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length; itens.forEach((x, k) => x.classList.toggle('on', k === i)); itens[i].scrollIntoView({ block: 'nearest' }); return; }
        if ((e.key === 'Enter' || e.key === 'Tab') && itens.length) { e.preventDefault(); escolherMencao(itens[Math.max(0, i)].dataset.men); return; }
        if (e.key === 'Escape') { e.preventDefault(); men.hidden = true; return; }
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !matchMedia('(pointer:coarse)').matches) { e.preventDefault(); enviarTexto(); }
    });
    t.addEventListener('input', () => verMencao(t));
    t.addEventListener('blur', () => setTimeout(() => { const m = raiz && raiz.querySelector('#wz-men'); if (m) m.hidden = true; }, 200));
    t.addEventListener('paste', e => { const fs = [...(e.clipboardData && e.clipboardData.files || [])]; if (fs.length) { e.preventDefault(); prepararArquivos(fs); } });
    bt.onclick = () => t.value.trim() ? enviarTexto() : gravar();
    const fi = cx.querySelector('#wz-arq-fig');
    if (fi) fi.onchange = async () => { const f = fi.files[0]; fi.value = ''; if (!f) return; if (f.size > 8 * 1024 * 1024) return B7.UI.toast('Imagem grande demais para figurinha (até 8 MB).');
      try { B7.UI.toast('Criando a figurinha…'); const path = await subir(f, f.name || 'figurinha.png'); await enviarFigurinha({ path }); } catch (e) { B7.UI.toast(e.message); } };
    ['#wz-arq-midia', '#wz-arq-doc', '#wz-arq-cam'].forEach(s => { const i = cx.querySelector(s); i.onchange = () => { if (i.files.length) prepararArquivos([...i.files], s === '#wz-arq-doc'); i.value = ''; }; });
    ajusta();
  }
  /* 4.69.0: ajuda da IA na caixa de mensagem */
  function avisoIA(html) { const a = raiz && raiz.querySelector('#wz-ia-aviso'); if (!a) return; a.innerHTML = html; a.hidden = !html; }
  async function ajudaIA(tipo) {
    const t = raiz.querySelector('#wz-texto'), jid = S.aberta; if (!t || !jid) return;
    const atual = t.value.trim();
    if (tipo !== 'sugerir' && !atual) { B7.UI.toast('Escreva a mensagem primeiro — aí eu corrijo.'); return t.focus(); }
    if (S.iaOcupado) return;
    S.iaOcupado = true;
    const ph = t.placeholder; t.readOnly = true; t.classList.add('ia-pensando');
    t.placeholder = tipo === 'sugerir' ? 'O Otto está escrevendo…' : 'Corrigindo…';
    avisoIA('<span class="wz-ia-gira"></span>' + (tipo === 'sugerir' ? 'Lendo a conversa e escrevendo um rascunho…' : 'Revisando o texto…'));
    try {
      const r = tipo === 'sugerir' ? await chamar('sugerir_resposta', { jid, pedido: atual }) : await chamar('corrigir_texto', { texto: atual, tom: tipo });
      if (S.aberta !== jid) return;
      if (r.erro || !r.texto) throw new Error(r.erro || 'Sem resposta.');
      S.iaAntes = t.value; t.value = r.texto; t.dispatchEvent(new Event('input'));
      avisoIA((tipo === 'sugerir' ? 'Rascunho do Otto — revise antes de enviar.' : 'Texto revisado.') + ' <button data-ia-desfaz>Desfazer</button>');
      t.focus(); t.setSelectionRange(t.value.length, t.value.length);
    } catch (e) { avisoIA(''); B7.UI.toast(e.message || 'Não deu certo.', { tipo: 'erro' }); }
    finally { S.iaOcupado = false; t.readOnly = false; t.classList.remove('ia-pensando'); t.placeholder = ph; }
  }
  async function enviarTexto() {
    const t = raiz.querySelector('#wz-texto'); const jid = S.aberta;
    let texto = t.value.trim(); if (!texto || !jid) return;
    /* 4.54.2: trava contra envio duplo — o campo esvazia NA HORA (antes só esvaziava depois do
       Corretor, e um segundo Enter nesse meio-tempo mandava a mensagem de novo) */
    if (S.enviando) return;
    S.enviando = true;
    const citar = S.citar && S.citar.id;
    t.value = ''; t.dispatchEvent(new Event('input')); S.citar = null; pintarCitacao(); S.iaAntes = null; avisoIA('');
    try {
      if (B7.Corretor && B7.Corretor.ligado && B7.Corretor.ligado()) {
        try { const r = await B7.Corretor.corrigir(texto); if (r && r.ok && r.mudou) texto = r.texto; } catch (e) {}
      }
    } finally { S.enviando = false; }
    /* 4.56.0: "@Nome" escolhido na lista vira "@<código>" + a marcação de verdade */
    const mencoes = [];
    (S.mencoes || []).forEach(m => { const alvo = '@' + m.nome; if (texto.includes(alvo)) { texto = texto.split(alvo).join('@' + String(m.jid).split('@')[0]); if (!mencoes.includes(m.jid)) mencoes.push(m.jid); if (S.contatos && !S.contatos.has(m.jid)) S.contatos.set(m.jid, m.nome); } });
    S.mencoes = [];
    const corpo = assinatura() + texto;
    const temp = { id: 'tmp_' + Date.now(), jid, de_mim: true, tipo: 'texto', texto: corpo, status: 'PENDING', criada_em: new Date().toISOString(), enviada_por_nome: eu().nome, citada_id: citar || null, reacoes: {} };
    S.msgs.push(temp); pintarMensagens(); rolarFim();
    try {
      const r = await chamar('enviar_texto', { jid, texto: corpo, citar, mencoes });
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
    const grupo = c.tipo === 'grupo';
    /* 4.66.6: painel novo — situação do atendimento em destaque, números em blocos, mídia recente */
    const msgs = (S.msgs || []).filter(m => m.jid === c.jid && !m.nota && !m.apagada);
    const ult = msgs[msgs.length - 1];
    const min = c.esperando_desde ? (Date.now() - new Date(c.esperando_desde)) / 60000 : 0;
    const nivel = !c.esperando_desde ? 'ok' : min >= 1440 ? 'quente' : min >= 60 ? 'morno' : 'leve';
    /* 4.80.0: quando a última palavra foi da equipe, a vez é do cliente */
    const durTx = m => m < 60 ? Math.round(m) + ' min' : m < 1440 ? Math.floor(m / 60) + ' h' : Math.floor(m / 1440) + (Math.floor(m / 1440) === 1 ? ' dia' : ' dias');
    const minC = c.aguardando_cliente_desde ? (Date.now() - new Date(c.aguardando_cliente_desde)) / 60000 : 0;
    const txtEspera = c.esperando_desde ? (min < 1 ? 'Esperando agora' : 'Esperando há ' + durTx(min))
      : c.aguardando_cliente_desde && minC >= 60 ? 'Aguardando o cliente há ' + durTx(minC) : 'Em dia';
    let subEspera = c.esperando_desde ? 'O cliente espera a nossa resposta desde ' + new Date(c.esperando_desde).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às')
      : c.aguardando_cliente_desde && minC >= 60 ? 'A última mensagem foi da equipe — a vez é do cliente.' : 'Ninguém esperando resposta nesta conversa.';
    /* 4.80.1: o Otto leu a conversa — mostra o que falta, nas palavras dele */
    const vezAtual = c.vez && ((c.vez === 'cliente') === !!c.esperando_desde) && ((c.vez === 'equipe') === !!c.aguardando_cliente_desde);
    if (vezAtual && c.vez_motivo) subEspera = (c.vez === 'ninguem' ? 'Assunto encerrado: ' : '') + c.vez_motivo;
    const quemUlt = ult ? (ult.do_assistente ? 'Otto' : ult.de_mim ? (ult.enviada_por_nome ? ult.enviada_por_nome.split(' ')[0] : 'Você') : (ult.autor_nome || c.nome || 'Contato').split(' ')[0]) : '';
    const resumoUlt = ult ? (ult.texto ? semCodigos(ult.texto) : ({ imagem: '📷 Foto', video: '🎬 Vídeo', audio: '🎤 Áudio', figurinha: '💟 Figurinha', documento: '📄 ' + (ult.midia_nome || 'Documento') })[ult.tipo] || 'Mensagem') : '';
    const fotos = msgs.filter(m => (m.tipo === 'imagem' || m.tipo === 'video') && m.miniatura).slice(-6).reverse();
    const ic = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
    const ultHtml = ult ? '<div class="wz-box wz-ld-ult"><h4>Última mensagem</h4><p><b>' + esc(quemUlt) + '</b><small>' + hm(ult.criada_em) + '</small></p><span>' + esc(resumoUlt).slice(0, 160) + '</span></div>' : '';
    const fotosHtml = fotos.length ? '<div class="wz-box"><h4>Mídia recente</h4><div class="wz-ld-fotos">' + fotos.map(m => '<button data-ir-msg="' + esc(m.id) + '" title="Ir para a mensagem"><img src="data:image/jpeg;base64,' + m.miniatura + '" alt="">' + (m.tipo === 'video' ? '<i>▶</i>' : '') + '</button>').join('') + '</div></div>' : '';
    /* 4.67.0: grupo da equipe ou privado de alguém da equipe → painel da equipe */
    if (!cli) {
      const eq = await painelEquipe(c.jid);
      if (S.aberta !== c.jid || !cx.isConnected) return;
      if (eq && eq.tipo === 'grupo') { cx.innerHTML = ladoGrupoEquipe(c, eq, ic) + ultHtml + fotosHtml; return; }
      if (eq && eq.tipo === 'pessoa') { cx.innerHTML = ladoPessoa(c, eq, ic, nivel, txtEspera, subEspera) + ultHtml + fotosHtml; return; }
    }
    cx.innerHTML =
      '<div class="wz-ld-topo">' + avatar(c, 'g') +
        '<b>' + esc(cli ? cli.nome : (c.nome || num(c.jid))) + '</b>' +
        '<small>' + (cli ? (grupo ? 'Grupo do cliente' : 'Contato do cliente') : grupo ? 'Grupo ainda sem cliente' : esc(fone(c.jid))) + '</small>' +
        (cli && grupo && c.nome && c.nome !== cli.nome ? '<span class="wz-ld-tag">' + esc(c.nome) + '</span>' : '') +
        '<div class="wz-ld-acoes">' +
          (cli ? '<a class="wz-ld-bt" href="#/cliente/' + esc(cli.id) + '">' + ic('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>') + 'Abrir cliente</a>' : '') +
          (grupo ? '<button class="wz-ld-bt' + (cli ? ' so-icone' : '') + '" data-wz="vincular" title="' + (cli ? 'Trocar o cliente' : 'Ligar a um cliente') + '">' + ic('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>') + (cli ? '' : 'Ligar a um cliente') + '</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="wz-ld-st ' + nivel + '"><i></i><div><b>' + txtEspera + '</b><span>' + esc(subEspera) + '</span></div>' +
        (c.esperando_desde ? '<button class="wz-ld-ok" data-wz="semespera" title="Marcar como respondida">' + ic('<path d="M20 6 9 17l-5-5"/>') + '</button>' : '') + '</div>' +
      ultHtml +
      (cli ? '<div class="wz-box" id="wz-pend"><h4>Com este cliente agora</h4><div class="wz-ld-num"><a href="#/design"><b>…</b><span>Design em produção</span></a><a href="#/video"><b>…</b><span>Vídeos em edição</span></a></div><div class="wz-ld-grav"><span>' + ic('<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>') + '</span><div><small>Próxima gravação</small><b>…</b></div></div></div>'
        : grupo ? '<div class="wz-box"><h4>Com este cliente agora</h4><p class="wz-mudo">Ligue a conversa a um cliente para ver design, vídeos e gravações.</p></div>' : '') +
      fotosHtml;
    if (cli) {
      const pend = cx.querySelector('#wz-pend');
      /* números do cliente guardados por 1 min (o painel repinta quando as mensagens chegam) */
      S.ladoCache = S.ladoCache || new Map();
      const guard = S.ladoCache.get(cli.id);
      if (guard && Date.now() - guard.em < 60e3) return preencher(guard.ds, guard.vd, guard.grav, guard.gravNome);
      const contar = async (tab, filtro) => { try { let q = sb().from(tab).select('id', { count: 'exact', head: true }); q = filtro(q); const r = await q; return r.count || 0; } catch (e) { return '–'; } };
      const [ds, vd] = await Promise.all([
        contar('design_resumo', q => q.eq('client_id', cli.id).neq('status', 'finalizado')),
        contar('demandas_edicao', q => q.eq('client_id', cli.id).is('deleted_at', null).in('editing_status', ['pendente', 'em_edicao', 'aguardando_aprovacao']))
      ]);
      let grav = '', gravNome = '';
      try { const g = await sb().from('gravacoes').select('nome,data_gravacao').eq('client_id', cli.id).is('deleted_at', null).gte('data_gravacao', new Date().toISOString().slice(0, 10)).order('data_gravacao').limit(1); if (g.data && g.data[0]) { grav = new Date(g.data[0].data_gravacao + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, ''); grav = grav.charAt(0).toUpperCase() + grav.slice(1); gravNome = g.data[0].nome || ''; } } catch (e) {}
      S.ladoCache.set(cli.id, { em: Date.now(), ds, vd, grav, gravNome });
      preencher(ds, vd, grav, gravNome);
    }
    function preencher(ds, vd, grav, gravNome) {
      const pend = cx.querySelector('#wz-pend');
      if (pend && pend.isConnected) {
        const n = pend.querySelectorAll('.wz-ld-num b'); n[0].textContent = ds; n[1].textContent = vd;
        n[0].parentNode.classList.toggle('zero', !ds); n[1].parentNode.classList.toggle('zero', !vd);
        const gb = pend.querySelector('.wz-ld-grav b'); gb.textContent = grav || 'Nada marcado';
        pend.querySelector('.wz-ld-grav').classList.toggle('zero', !grav);
        if (gravNome) gb.title = gravNome;
      }
    }
  }
  /* ---------- 4.67.0: painel da equipe ---------- */
  async function painelEquipe(jid) {
    S.eqCache = S.eqCache || new Map();
    const g = S.eqCache.get(jid);
    if (g && Date.now() - g.em < 60e3) return g.dados;
    let dados = null;
    try { const r = await sb().rpc('wa_painel_equipe', { p_jid: jid }); dados = r.error ? null : r.data; } catch (e) {}
    S.eqCache.set(jid, { em: Date.now(), dados });
    return dados;
  }
  const PRESENCA = { disponivel: ['Disponível', 'ok'], gravacao: ['Em gravação', 'roxo'], reuniao: ['Em reunião', 'morno'], ausente: ['Ausente', 'cinza'], nao_perturbe: ['Não perturbe', 'quente'] };
  const FUNCAO = { videomaker: 'Videomaker', designer: 'Designer', coordenador: 'Coordenação', admin: 'Administração' };
  const dataCurta = d => { if (!d) return ''; const x = new Date(String(d).slice(0, 10) + 'T12:00:00'), h = new Date(); h.setHours(12, 0, 0, 0); const dias = Math.round((x - h) / 864e5); if (dias === 0) return 'Hoje'; if (dias === 1) return 'Amanhã'; if (dias === -1) return 'Ontem'; const t = x.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, ''); return t.charAt(0).toUpperCase() + t.slice(1); };
  const atrasado = d => d && String(d).slice(0, 10) < new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
  const hojeD = d => d && String(d).slice(0, 10) === new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
  function avatarPessoa(p, cls) {
    const nome = p.nome || '';
    return '<span class="wz-av ' + (cls || '') + '" style="--c:' + corDe(nome) + '">' + (p.avatar_url ? '<img src="' + esc(p.avatar_url) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '<b>' + esc(ini(nome)) + '</b></span>';
  }
  function listaGravacoes(gs, ic) {
    if (!gs || !gs.length) return '<p class="wz-mudo">Nenhuma gravação marcada.</p>';
    return '<div class="wz-ld-lista">' + gs.map(g => '<div class="wz-ld-li"><span class="wz-ld-dia' + (hojeD(g.data) ? ' hoje' : '') + '"><b>' + esc(String(g.data).slice(8, 10)) + '</b><small>' + esc(new Date(String(g.data).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')) + '</small></span><div><b>' + esc(g.cliente || g.nome || 'Gravação') + '</b><small>' + esc(dataCurta(g.data) + (g.hora ? ' · ' + String(g.hora).slice(0, 5) : '') + (g.cliente && g.nome && g.nome !== g.cliente ? ' · ' + g.nome : '')) + '</small></div></div>').join('') + '</div>';
  }
  function ladoGrupoEquipe(c, eq, ic) {
    /* clientes esperando: das conversas ligadas a cliente */
    const esp = (S.conversas || []).filter(x => x.esperando_desde && x.cliente_id && !x.arquivada).sort((a, b) => new Date(a.esperando_desde) - new Date(b.esperando_desde));
    const maisVelho = esp[0] ? (Date.now() - new Date(esp[0].esperando_desde)) / 60000 : 0;
    const nivel = !esp.length ? 'ok' : maisVelho >= 1440 ? 'quente' : maisVelho >= 60 ? 'morno' : 'leve';
    const p = eq.producao || {};
    const nomeCli = x => { const cl = S.clientes.find(k => k.id === x.cliente_id); return cl ? cl.nome : (x.nome || 'Cliente'); };
    const tempo = iso => { const m = (Date.now() - new Date(iso)) / 60000; return m < 60 ? Math.round(m) + ' min' : m < 1440 ? Math.floor(m / 60) + ' h' : Math.floor(m / 1440) + ' d'; };
    const nivelDe = iso => { const m = (Date.now() - new Date(iso)) / 60000; return m >= 1440 ? 'quente' : m >= 60 ? 'morno' : 'leve'; };
    return '<div class="wz-ld-topo">' + avatar(c, 'g') + '<b>' + esc(c.nome || 'Grupo da equipe') + '</b><small>Grupo da equipe</small><span class="wz-ld-tag">🤖 Otto trabalha aqui</span></div>' +
      '<div class="wz-ld-st ' + nivel + '"><i></i><div><b>' + (esp.length ? esp.length + (esp.length === 1 ? ' cliente esperando' : ' clientes esperando') : 'Clientes em dia') + '</b><span>' + (esp.length ? 'O mais antigo espera há ' + tempo(esp[0].esperando_desde) : 'Nenhum cliente esperando resposta.') + '</span></div></div>' +
      (esp.length ? '<div class="wz-box"><h4>Esperando resposta</h4><div class="wz-ld-lista">' + esp.slice(0, 5).map(x => '<button class="wz-ld-li wz-ld-esp" data-abrir-jid="' + esc(x.jid) + '">' + avatar(x) + '<div><b>' + esc(nomeCli(x)) + '</b><small>' + esc(x.nome || '') + '</small></div><em class="' + nivelDe(x.esperando_desde) + '">' + tempo(x.esperando_desde) + '</em></button>').join('') + (esp.length > 5 ? '<p class="wz-mudo wz-ld-mais">+ ' + (esp.length - 5) + ' no filtro "Esperando"</p>' : '') + '</div></div>' : '') +
      '<div class="wz-box"><h4>Produção agora</h4><div class="wz-ld-num tres"><a href="#/design"' + (p.design ? '' : ' class="zero"') + '><b>' + (p.design ?? '–') + '</b><span>Design</span></a><a href="#/video"' + (p.videos ? '' : ' class="zero"') + '><b>' + (p.videos ?? '–') + '</b><span>Vídeos</span></a><a href="#/gravacoes"' + (p.gravacoes_semana ? '' : ' class="zero"') + '><b>' + (p.gravacoes_semana ?? '–') + '</b><span title="Nos próximos 7 dias">Gravações</span></a></div>' +
        (p.atrasados ? '<a class="wz-ld-alerta" href="#/video">⚠️ ' + p.atrasados + (p.atrasados === 1 ? ' vídeo com prazo vencido' : ' vídeos com prazo vencido') + '</a>' : '') + '</div>' +
      '<div class="wz-box"><h4>Próximas gravações</h4>' + listaGravacoes(eq.gravacoes, ic) + '</div>' +
      ((eq.membros || []).length ? '<div class="wz-box"><h4>Equipe · ' + eq.membros.length + '</h4><div class="wz-ld-lista">' + eq.membros.map(m => { const pr = PRESENCA[m.presenca] || null; return '<div class="wz-ld-li wz-ld-pessoa">' + '<span class="wz-ld-avp">' + avatarPessoa(m) + (pr ? '<i class="' + pr[1] + '" title="' + pr[0] + '"></i>' : '') + '</span><div><b>' + esc(m.nome) + '</b><small>' + esc(m.quem || m.assuntos || FUNCAO[m.funcao] || '') + '</small></div></div>'; }).join('') + '</div></div>' : '');
  }
  function ladoPessoa(c, eq, ic, nivel, txtEspera, subEspera) {
    const p = eq.pessoa || {};
    const pr = PRESENCA[p.presenca] || null;
    const primeiro = String(p.nome || c.nome || '').split(/\s+/)[0];
    const visto = p.visto ? (() => { const m = (Date.now() - new Date(p.visto)) / 60000; return m < 5 ? 'Online no B7 agora' : 'Visto no B7 ' + (m < 60 ? 'há ' + Math.round(m) + ' min' : m < 1440 ? 'há ' + Math.floor(m / 60) + ' h' : 'há ' + Math.floor(m / 1440) + ' d'); })() : '';
    const STATUS = { pendente: 'A fazer', em_edicao: 'Editando', aguardando_aprovacao: 'Em aprovação' };
    return '<div class="wz-ld-topo"><span class="wz-ld-avp g">' + avatarPessoa({ nome: p.nome || c.nome, avatar_url: p.avatar_url || c.foto_url }, 'g') + (pr ? '<i class="' + pr[1] + '"></i>' : '') + '</span>' +
        '<b>' + esc(p.nome || c.nome || '') + '</b><small>' + esc(p.quem || p.assuntos || FUNCAO[p.funcao] || 'Da equipe') + '</small>' +
        '<span class="wz-ld-tag">' + (pr ? pr[0] + (visto ? ' · ' : '') : '') + esc(visto || (pr ? '' : 'Da equipe')) + '</span></div>' +
      (c.esperando_desde ? '<div class="wz-ld-st ' + nivel + '"><i></i><div><b>' + txtEspera + '</b><span>' + esc(subEspera) + '</span></div><button class="wz-ld-ok" data-wz="semespera" title="Marcar como respondida">' + ic('<path d="M20 6 9 17l-5-5"/>') + '</button></div>' : '') +
      '<div class="wz-box"><h4>Com ' + esc(primeiro) + ' agora</h4><div class="wz-ld-num"><a href="#/video"' + (eq.videos_total ? '' : ' class="zero"') + '><b>' + (eq.videos_total ?? 0) + '</b><span>Vídeos em edição</span></a><a href="#/design"' + (eq.designs ? '' : ' class="zero"') + '><b>' + (eq.designs ?? 0) + '</b><span>Design em produção</span></a></div>' +
        ((eq.videos || []).length ? '<div class="wz-ld-lista wz-ld-vids">' + eq.videos.map(v => '<div class="wz-ld-li"><div><b>' + esc((v.codigo ? v.codigo + ' · ' : '') + (v.titulo || 'Vídeo')) + '</b><small>' + esc((v.cliente || '') + ' · ' + (STATUS[v.status] || v.status || '')) + '</small></div>' + (v.prazo ? '<em class="' + (atrasado(v.prazo) ? 'quente' : hojeD(v.prazo) ? 'morno' : 'leve') + '">' + esc(atrasado(v.prazo) ? 'Atrasado' : dataCurta(v.prazo)) + '</em>' : '') + '</div>').join('') + '</div>' : '') +
      '</div>' +
      '<div class="wz-box"><h4>Próximas gravações</h4>' + listaGravacoes(eq.gravacoes, ic) + '</div>';
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

  /* ------------------------------------------------------------ menção com @ (4.56.0) */
  S.part = S.part || {};
  async function participantes(jid) {
    if (S.part[jid]) return S.part[jid];
    try { const r = await chamar('participantes', { jid }); S.part[jid] = (r.lista || []).sort((a, b) => String(a.nome).localeCompare(String(b.nome))); } catch (e) { S.part[jid] = []; }
    return S.part[jid];
  }
  const semAc = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  async function verMencao(t) {
    const men = raiz.querySelector('#wz-men'); if (!men) return;
    const jid = S.aberta;
    const m = t.value.slice(0, t.selectionStart).match(/(^|\s)@([^\s@]{0,30})$/);
    if (!m || !jid || !/@g\.us$/.test(jid)) { men.hidden = true; return; }
    const lista = await participantes(jid);
    if (S.aberta !== jid) return;
    const f = semAc(m[2]);
    const achados = lista.filter(p => !f || semAc(p.nome).includes(f) || String(p.numero || '').includes(f)).slice(0, 8);
    if (!achados.length) { men.hidden = true; return; }
    men.innerHTML = '<small>Marcar no grupo</small>' + achados.map((p, i) => '<button type="button" class="' + (i === 0 ? 'on' : '') + '" data-men="' + esc(p.jid) + '"><span class="wz-av p" style="--c:' + corDe(p.nome) + '"><b>' + esc(ini(p.nome)) + '</b></span><span>' + esc(p.nome) + (p.numero && !String(p.nome).startsWith('+') ? '<em>+' + esc(p.numero) + '</em>' : '') + '</span></button>').join('');
    men.hidden = false;
  }
  function escolherMencao(pjid) {
    const t = raiz.querySelector('#wz-texto'), men = raiz.querySelector('#wz-men');
    const p = (S.part[S.aberta] || []).find(x => x.jid === pjid); if (!t || !p) return;
    const nome = String(p.nome).replace(/^\+/, '').split(/\s+/).slice(0, 2).join(' ');
    const antes = t.value.slice(0, t.selectionStart).replace(/@([^\s@]{0,30})$/, '@' + nome + ' ');
    const depois = t.value.slice(t.selectionStart);
    t.value = antes + depois; t.focus(); t.setSelectionRange(antes.length, antes.length);
    S.mencoes = (S.mencoes || []).filter(x => x.jid !== p.jid).concat([{ nome, jid: p.jid }]);
    if (men) men.hidden = true;
    t.dispatchEvent(new Event('input'));
  }

  /* ------------------------------------------------------------ figurinhas (4.54.1) */
  const FIG_FAV = 'b7.wz.figs';
  const figUrl = new Map();
  async function abrirFigurinhas() {
    const cx = raiz.querySelector('#wz-figs'); if (!cx) return;
    if (!cx.hidden) { cx.hidden = true; return; }
    cx.hidden = false;
    cx.innerHTML = '<div class="wz-figs-top"><b>Figurinhas</b><button class="b fina contorno" data-wz="fig-nova">＋ Criar de uma imagem</button></div><div class="wz-figs-grade"><p class="sub">Carregando…</p></div>';
    let usadas = []; try { usadas = JSON.parse(localStorage.getItem(FIG_FAV) || '[]'); } catch (e) {}
    const grade = cx.querySelector('.wz-figs-grade');
    /* 4.58.4: uma chamada só, já sem repetidas e com os links */
    let itens = [];
    try { const r = await chamar('figurinhas', {}); if (r.erro) throw new Error(r.erro); itens = r.itens || []; }
    catch (e) { grade.innerHTML = '<p class="sub">Não consegui carregar as figurinhas agora. Tenta de novo.</p>'; return; }
    if (cx.hidden) return;
    itens.forEach(f => { if (f.url) figUrl.set(f.id, f.url); });
    const ids = itens.map(f => f.id);
    const lista = [...usadas.filter(id => ids.includes(id) || figUrl.has(id)), ...ids].filter((id, i, a) => a.indexOf(id) === i).slice(0, 48);
    if (!lista.length) { grade.innerHTML = '<p class="sub">As figurinhas que chegarem nas conversas aparecem aqui. Ou crie uma de uma imagem.</p>'; return; }
    grade.innerHTML = lista.map(id => {
      const u = figUrl.get(id);
      return '<button class="wz-figs-it" data-fig="' + esc(id) + '" aria-label="Mandar figurinha">' + (u ? '<img src="' + esc(u) + '" alt="" loading="lazy">' : '<i class="wz-ph">🙂</i>') + '</button>';
    }).join('');
    /* imagem que não abrir sai da grade (em vez de ficar o quadradinho vazio) */
    grade.querySelectorAll('img').forEach(im => { im.onerror = () => { figUrl.delete(im.parentElement.dataset.fig); im.parentElement.remove(); }; });
    /* as que ainda não estão guardadas: busca 3 por vez */
    const fila = [...grade.querySelectorAll('[data-fig]')].filter(b => !b.querySelector('img'));
    const proxima = async () => {
      const b = fila.shift(); if (!b) return;
      try {
        const r = await chamar('midia', { id: b.dataset.fig });
        if (r && r.url) { figUrl.set(b.dataset.fig, r.url); b.innerHTML = '<img src="' + esc(r.url) + '" alt="" loading="lazy">'; } else b.remove();
      } catch (e) { b.remove(); }
      return proxima();
    };
    proxima(); proxima(); proxima();
  }
  async function enviarFigurinha(extra) {
    const jid = S.aberta; if (!jid) return;
    const cx = raiz.querySelector('#wz-figs'); if (cx) cx.hidden = true;
    try {
      const r = await chamar('enviar_figurinha', Object.assign({ jid }, extra));
      if (r.erro) throw new Error(r.erro);
      if (extra.id) { let u = []; try { u = JSON.parse(localStorage.getItem(FIG_FAV) || '[]'); } catch (e) {} u = [extra.id, ...u.filter(x => x !== extra.id)].slice(0, 16); try { localStorage.setItem(FIG_FAV, JSON.stringify(u)); } catch (e) {} }
    } catch (e) { B7.UI.toast(e.message || 'Não deu para mandar a figurinha.'); }
  }

  /* ------------------------------------------------------------ Google Drive (4.53.0) */
  async function modalDrive() {
    const m = B7.UI.modal('<h3>Arquivos no Google Drive</h3><div id="wz-drv" class="sub">Conferindo…</div><div class="acoes" id="wz-drv-ac"><button class="b" data-fecha>Fechar</button></div>');
    const corpo = m.querySelector('#wz-drv'), ac = m.querySelector('#wz-drv-ac');
    let ouvinte = null;
    const soltar = () => { if (ouvinte) window.removeEventListener('message', ouvinte); ouvinte = null; };
    async function pintar() {
      let st = { conectado: false };
      try { const r = await sb().rpc('wa_drive_status'); if (!r.error && r.data) st = r.data; } catch (e) {}
      if (!m.isConnected) return soltar();
      if (st.conectado && st.status === 'ativa') {
        corpo.innerHTML = '<p>✓ Conectado ao Drive de <b>' + esc(st.conta || 'conta do Google') + '</b>.</p>' +
          '<p>Fotos, vídeos, áudios e documentos do WhatsApp ficam na pasta <b>B7 · WhatsApp</b>, separados por conversa e mês — não pesam no sistema. ' +
          (st.arquivos ? '<b>' + st.arquivos + '</b> arquivo(s) já estão lá.' : '') + '</p>';
        ac.innerHTML = '<button class="b contorno perigo" data-drv="sair">Desconectar</button><button class="b" data-fecha>Fechar</button>';
      } else {
        corpo.innerHTML = (st.conectado ? '<p class="erro">A conexão com o Drive caiu' + (st.erro ? ' (' + esc(st.erro) + ')' : '') + '. Conecte de novo.</p>' : '') +
          '<p>Conecte a conta Google da agência: os arquivos do WhatsApp passam a ser guardados numa pasta <b>B7 · WhatsApp</b> no Drive, em vez do armazenamento do sistema.</p>' +
          '<p class="sub">O B7 só enxerga as pastas que ele mesmo criar — o resto do seu Drive fica fora do alcance.</p>';
        ac.innerHTML = '<button class="b" data-fecha>Fechar</button><button class="b pri" data-drv="entrar">Conectar o Google Drive</button>';
      }
    }
    m.addEventListener('click', async e => {
      const b = e.target.closest('[data-drv]'); if (!b) { if (e.target.closest('[data-fecha]')) soltar(); return; }
      if (b.dataset.drv === 'entrar') {
        try {
          const r = await B7.DB.chamarCalendarioGoogle({ acao: 'iniciar_conexao_drive' });
          const j = window.open(r.url, 'b7-google-drive', 'width=520,height=680');
          if (!j) { B7.UI.toast('O navegador bloqueou a janela — permita pop-ups e tente de novo.'); return; }
          soltar();
          ouvinte = ev => { if (ev.origin !== location.origin || !ev.data || ev.data.tipo !== 'b7-google-agenda') return; B7.UI.toast(ev.data.mensagem || (ev.data.ok ? 'Google Drive conectado.' : 'Não deu para conectar.')); pintar(); };
          window.addEventListener('message', ouvinte);
          const v = setInterval(() => { if (j.closed) { clearInterval(v); pintar(); } }, 1000);
        } catch (x) { B7.UI.toast(x.message || 'Não deu para iniciar a conexão.'); }
      } else if (b.dataset.drv === 'sair') {
        if (!(await B7.UI.confirmar({ titulo: 'Desconectar o Google Drive?', texto: 'Os arquivos já guardados continuam no Drive, mas o B7 deixa de abrir e guardar lá.', confirmar: 'Desconectar', perigo: true }))) return;
        try { await B7.DB.chamarCalendarioGoogle({ acao: 'desconectar_drive' }); } catch (x) { B7.UI.toast(x.message); }
        pintar();
      }
    });
    pintar();
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
