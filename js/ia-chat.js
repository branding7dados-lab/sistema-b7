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
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></svg>',
    som: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3l4.5-3.7v12.4L7 14.5H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/></svg>',
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4.5 17l4.6-4.4 3.4 3.1 2.6-2.3 4.4 3.8"/></svg>',
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
  const S = { aberto: false, vista: 'conversa', conversaId: null, clienteId: '', msgs: [], enviando: false, clientes: null, lista: null, anexo: null };
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

  /* =================================================================
     DITADO POR VOZ (zzz125) — o microfone do campo de mensagem.
     A pessoa toca, fala, e o texto aparece no campo enquanto ela fala.
     NADA é enviado sozinho: ela lê, corrige se quiser e envia.
     Quem transforma a fala em texto é o reconhecimento de voz do próprio
     navegador (Web Speech API) — não passa pela IA do B7, não gasta a
     cota dela e nenhum áudio é guardado pelo sistema. Navegador sem esse
     recurso simplesmente não mostra o botão.
     ================================================================= */
  const Voz = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let rec = null, ouvindo = false;
  const AVISO_VOZ = {
    'not-allowed': 'Permita o uso do microfone neste site para ditar.',
    'service-not-allowed': 'O ditado por voz está bloqueado neste navegador.',
    'audio-capture': 'Nenhum microfone encontrado.',
    'network': 'O ditado precisa de internet. Confira a conexão.',
    'language-not-supported': 'Este navegador não dita em português.'
  };
  function marcarVoz() {
    const b = painel && painel.querySelector('#ch-mic'); if (!b) return;
    b.classList.toggle('ouvindo', ouvindo);
    b.setAttribute('aria-pressed', String(ouvindo));
    b.setAttribute('aria-label', ouvindo ? 'Parar de ditar' : 'Ditar por voz');
    b.title = ouvindo ? 'Parar de ditar' : 'Ditar por voz';
    const f = painel.querySelector('.ch-form'); if (f) f.classList.toggle('ditando', ouvindo);
  }
  function pararVoz() {
    if (grav) pararGravacao(true);      /* sair ou enviar descarta o que estava gravando */
    if (!rec) return;
    try { rec.stop(); } catch (e) {}
  }
  function ditarNavegador() {
    if (!Voz || !painel) return;
    if (ouvindo) { try { rec.stop(); } catch (e) {} return; }
    const ta = painel.querySelector('#ch-texto'); if (!ta || ta.disabled) return;
    const r = new Voz();
    r.lang = 'pt-BR'; r.interimResults = true; r.maxAlternatives = 1;
    /* no celular o modo contínuo repete trechos (defeito conhecido do
       Chrome no Android): lá vai uma frase por toque */
    r.continuous = !window.matchMedia('(pointer: coarse)').matches;
    const base = ta.value.trim() ? ta.value.replace(/\s+$/, '') + ' ' : '';
    r.onstart = () => { ouvindo = true; marcarVoz(); };
    r.onresult = e => {
      let falado = '';
      for (let i = 0; i < e.results.length; i++) falado += e.results[i][0].transcript;
      const campo = painel && painel.querySelector('#ch-texto'); if (!campo) return;
      campo.value = (base + falado.replace(/\s+/g, ' ').replace(/^\s+/, '')).slice(0, 2000);
      campo.dispatchEvent(new Event('input'));
      campo.scrollTop = campo.scrollHeight;
    };
    r.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (B7.UI && B7.UI.toast) B7.UI.toast(AVISO_VOZ[e.error] || 'Não foi possível ditar agora. Tente de novo.', { tipo: 'erro' });
    };
    r.onend = () => { if (rec === r) rec = null; ouvindo = false; marcarVoz(); };
    rec = r;
    try { r.start(); } catch (e) { rec = null; ouvindo = false; marcarVoz(); }
  }

  /* =================================================================
     VOZ PELA IA (zzz126) — o ditado do navegador "entendia embolado".
     Agora o microfone GRAVA a fala e a IA do B7 transcreve (tarefa "voz"
     da b7-ia): pontuação certa e os nomes dos clientes na grafia certa.
       toque 1 → grava (até 2 min; a faixa acima do campo mostra o tempo)
       toque 2 → para, transcreve e põe o texto no campo
     Nada é enviado sozinho. O áudio não é guardado em lugar nenhum.
     Navegador que não grava áudio cai no ditado antigo (ditarNavegador).
     ================================================================= */
  const podeGravar = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  const TIPO_GRAV = podeGravar ? (['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
    .find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '') : '';
  const MAX_GRAV_MS = 120000, MAX_GRAV_BYTES = 1000000;
  let grav = null;            /* { rec, stream, partes, t0, relogio, descartar } */
  let vozEstado = '';         /* '' | 'gravando' | 'transcrevendo' */
  const mmss = ms => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function pintarVoz() {
    if (!painel) return;
    const b = painel.querySelector('#ch-mic'), faixa = painel.querySelector('#ch-voz'), f = painel.querySelector('.ch-form');
    if (b) {
      b.classList.toggle('ouvindo', vozEstado === 'gravando');
      b.classList.toggle('pensando', vozEstado === 'transcrevendo');
      b.disabled = vozEstado === 'transcrevendo';
      b.setAttribute('aria-pressed', String(vozEstado === 'gravando'));
      const rot = vozEstado === 'gravando' ? 'Parar e transcrever' : vozEstado === 'transcrevendo' ? 'Transcrevendo…' : 'Falar em vez de digitar';
      b.setAttribute('aria-label', rot); b.title = rot;
    }
    if (f) f.classList.toggle('ditando', vozEstado === 'gravando');
    if (faixa) {
      faixa.hidden = !vozEstado;
      faixa.innerHTML = vozEstado === 'gravando'
        ? '<i class="ch-voz-ponto"></i><span>Gravando <b id="ch-voz-t">' + mmss(Date.now() - grav.t0) + '</b> · toque no microfone para terminar</span>' +
          '<button type="button" class="ch-voz-x" id="ch-voz-x">Cancelar</button>'
        : vozEstado === 'transcrevendo' ? '<i class="ch-voz-gira"></i><span>Transcrevendo o que você falou…</span>' : '';
      const x = faixa.querySelector('#ch-voz-x'); if (x) x.onclick = () => pararGravacao(true);
    }
  }
  async function iniciarGravacao() {
    const ta = painel && painel.querySelector('#ch-texto'); if (!ta || ta.disabled || vozEstado) return;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) {
      const n = e && e.name;
      B7.UI.toast(n === 'NotFoundError' || n === 'DevicesNotFoundError' ? 'Nenhum microfone encontrado.'
        : n === 'NotAllowedError' || n === 'SecurityError' ? 'Permita o uso do microfone neste site para falar com o assistente.'
        : 'Não foi possível usar o microfone agora.', { tipo: 'erro' });
      return;
    }
    let rec;
    try { rec = new MediaRecorder(stream, Object.assign({ audioBitsPerSecond: 32000 }, TIPO_GRAV ? { mimeType: TIPO_GRAV } : {})); }
    catch (e) { stream.getTracks().forEach(t => t.stop()); B7.UI.toast('Este navegador não consegue gravar áudio.', { tipo: 'erro' }); return; }
    const g = { rec, stream, partes: [], t0: Date.now(), relogio: 0, descartar: false };
    rec.ondataavailable = e => { if (e.data && e.data.size) g.partes.push(e.data); };
    rec.onstop = () => concluirGravacao(g);
    g.relogio = setInterval(() => {
      const el = painel && painel.querySelector('#ch-voz-t'); if (el) el.textContent = mmss(Date.now() - g.t0);
      if (Date.now() - g.t0 >= MAX_GRAV_MS) pararGravacao(false);
    }, 500);
    grav = g; vozEstado = 'gravando';
    try { rec.start(); } catch (e) { g.descartar = true; concluirGravacao(g); return; }
    pintarVoz();
  }
  function pararGravacao(descartar) {
    const g = grav; if (!g) return;
    if (descartar) g.descartar = true;
    try { if (g.rec.state !== 'inactive') g.rec.stop(); else concluirGravacao(g); } catch (e) { concluirGravacao(g); }
  }
  async function concluirGravacao(g) {
    if (g.feito) return; g.feito = true;
    clearInterval(g.relogio);
    try { g.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    if (grav === g) grav = null;
    const fim = () => { vozEstado = ''; pintarVoz(); };
    if (g.descartar) return fim();
    const blob = new Blob(g.partes, { type: g.rec.mimeType || TIPO_GRAV || 'audio/webm' });
    if (Date.now() - g.t0 < 700 || blob.size < 1500) { B7.UI.toast('Gravação muito curta. Segure um pouco mais e fale.', { tipo: 'erro' }); return fim(); }
    if (blob.size > MAX_GRAV_BYTES) { B7.UI.toast('Áudio longo demais. Fale em trechos de até 2 minutos.', { tipo: 'erro' }); return fim(); }
    vozEstado = 'transcrevendo'; pintarVoz();
    let r = null;
    try {
      const base64 = await new Promise((ok, erro) => { const l = new FileReader(); l.onload = () => ok(String(l.result).split(',')[1] || ''); l.onerror = erro; l.readAsDataURL(blob); });
      r = await B7.IA.pedir('voz', { audio: base64, mime: blob.type });
    } catch (e) { r = null; }
    fim();
    if (r && r.ok && r.texto) {
      const ta = painel && painel.querySelector('#ch-texto');
      if (!ta) { S.rascunho = ((S.rascunho || '').replace(/\s+$/, '') + ' ' + r.texto).trim().slice(0, 2000); return; }
      ta.value = ((ta.value.trim() ? ta.value.replace(/\s+$/, '') + ' ' : '') + r.texto).slice(0, 2000);
      ta.dispatchEvent(new Event('input'));
      if (!ta.disabled && window.matchMedia('(min-width: 761px)').matches) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    } else if (!(r && r.cancelado)) {
      B7.UI.toast((r && r.mensagem) || 'Não foi possível transcrever agora. Tente de novo.', { tipo: 'erro' });
    }
  }
  /* o botão: grava pela IA quando o navegador deixa; senão, o ditado antigo */
  function alternarVoz() {
    if (!painel) return;
    if (!podeGravar) return ditarNavegador();
    if (vozEstado === 'transcrevendo') return;
    if (vozEstado === 'gravando') return pararGravacao(false);
    iniciarGravacao();
  }

  /* =================================================================
     IMAGEM NO ASSISTENTE (zzz128) — anexar um print, uma referência ou
     uma arte à mensagem (botão, ou colar com Ctrl+V). A imagem é
     reduzida no navegador (lado maior até 1280 px, JPEG) antes de ir, e
     NÃO é guardada: no histórico fica só "[imagem anexada]".
     ================================================================= */
  const MAX_LADO = 1280, MAX_ORIGINAL = 15 * 1024 * 1024;
  async function prepararImagem(arquivo) {
    if (!arquivo || !/^image\//.test(arquivo.type)) throw new Error('Escolha um arquivo de imagem.');
    if (arquivo.size > MAX_ORIGINAL) throw new Error('Imagem grande demais (máximo 15 MB).');
    const url = URL.createObjectURL(arquivo);
    try {
      const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error('Não foi possível abrir esta imagem.')); i.src = url; });
      const k = Math.min(1, MAX_LADO / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
      const dados = cv.toDataURL('image/jpeg', 0.84);
      const base64 = dados.split(',')[1] || '';
      if (base64.length < 200 || base64.length > 1150000) throw new Error('Não foi possível preparar esta imagem.');
      return { mime: 'image/jpeg', base64, url: dados };
    } finally { URL.revokeObjectURL(url); }
  }
  async function anexar(arquivo) {
    if (S.enviando || !painel) return;
    try { S.anexo = await prepararImagem(arquivo); }
    catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível anexar a imagem.', { tipo: 'erro' }); return; }
    pintarAnexo();
    const ta = painel.querySelector('#ch-texto'); if (ta && window.matchMedia('(min-width: 761px)').matches) ta.focus();
  }
  function pintarAnexo() {
    const cx = painel && painel.querySelector('#ch-anexo-previa'); if (!cx) return;
    cx.hidden = !S.anexo;
    cx.innerHTML = S.anexo ? '<img src="' + S.anexo.url + '" alt="Imagem anexada"><span>Imagem anexada</span>' +
      '<button type="button" class="ch-voz-x" id="ch-anexo-x" aria-label="Remover a imagem">Remover</button>' : '';
    const x = cx.querySelector('#ch-anexo-x'); if (x) x.onclick = () => { S.anexo = null; pintarAnexo(); };
  }

  function fechar() {
    pararVoz(); pararFala();
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
      (m.papel === 'user' ? (m.img ? '<img class="ch-msg-img" src="' + m.img + '" alt="Imagem enviada">' : '') + '<p>' + esc(m.texto).replace(/\n/g, '<br>') + '</p>' : formatar(m.texto)) + '</div>' +
      (podeFalar && (!B7.Recursos || B7.Recursos.ligado('ia_ouvir')) && m.papel !== 'user' && !m.erro && m.texto ? '<button type="button" class="ch-falar' + (falando === i ? ' on' : '') + '" data-falar="' + i + '" aria-pressed="' + (falando === i) +
        '" aria-label="' + (falando === i ? 'Parar de ouvir' : 'Ouvir a resposta') + '" title="' + (falando === i ? 'Parar' : 'Ouvir') + '">' + IC.som + '<span>Ouvir</span></button>' : '') +
      /* zzz135: duas ou mais propostas pendentes ganham o "Criar todas" */
      ((n => n >= 2 ? '<div class="ch-ac-todas"><span>' + n + ' propostas pendentes</span><button type="button" class="ch-ac-ok" data-acao-todas="' + i + '"' +
        (criandoLote ? ' disabled' : '') + '>' + (criandoLote ? 'Criando…' : 'Criar todas (' + n + ')') + '</button></div>' : '')(pendentesDe(i).length + ((m.acoes || []).filter(a => a.estado === 'indo').length))) +
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
  /* zzz127: quatro tipos de proposta. Cada um tem o seu cartão e a SUA
     função de criar — a mesma que a tela daquele módulo usa, com a
     sessão e as permissões da pessoa. */
  const PECA_ROT = { card: 'Card', capa_reel: 'Capa de Reel', carrossel: 'Carrossel', stories: 'Stories', outro: 'Outro' };
  const TIPOS_ACAO = {
    video_demanda: {
      cab: 'Criar demanda de vídeo', bt: 'Criar demanda', feito: 'Demanda criada.', link: () => ['#/video', 'Abrir a Edição de vídeo'],
      /* zzz135: código, responsável e gravação entram quando a pessoa disse */
      linhas: a => [['Cliente', a.cliente_nome], ['Título', a.titulo]].concat(a.codigo ? [['Código', a.codigo]] : [],
        a.responsavel_nome ? [['Responsável', a.responsavel_nome]] : [], a.gravacao_nome ? [['Gravação', a.gravacao_nome]] : [], [['Prazo', dataBR(a.prazo)]]),
      criar: a => B7.DB.criarDemandaVideo({ clienteId: a.cliente_id, titulo: a.titulo, prazo: a.prazo || null, codigo: a.codigo || '',
        videomakerId: a.responsavel_id || null, gravacaoId: a.gravacao_id || null,
        competenciaAno: a.competencia_ano || null, competenciaMes: a.competencia_mes || null })
    },
    design_peca: {
      cab: 'Criar demanda de design', bt: 'Criar peça', feito: 'Peça criada.', link: () => ['#/design', 'Abrir a Produção de Design'],
      linhas: a => [['Cliente', a.cliente_nome], ['Título', a.titulo], ['Tipo', PECA_ROT[a.peca] || 'Outro'], ['Prazo', dataBR(a.prazo)]],
      criar: a => B7.DB.criarDesignManual({ titulo: a.titulo, clientId: a.cliente_id, tipo: a.peca || 'outro', prazo: a.prazo || null })
    },
    gravacao: {
      cab: 'Criar gravação', bt: 'Criar gravação', feito: 'Gravação criada.', link: a => [a.criado_id ? '#/gravacao/' + a.criado_id : '#/gravacoes', 'Abrir a gravação'],
      linhas: a => [['Cliente', a.cliente_nome], ['Nome', a.titulo], ['Data', a.data ? dataBR(a.data) + (a.hora ? ' às ' + a.hora : '') : 'sem data']],
      /* igual ao "Nova gravação": nasce pendente, no mês de referência da
         data (ou no mês atual); a data entra pela regra de agendar */
      criar: async a => {
        const ref = a.data || B7.UI.hojeISO();
        const g = await B7.DB.criarGravacao({ client_id: a.cliente_id, nome: a.titulo, competencia_ano: +ref.slice(0, 4), competencia_mes: +ref.slice(5, 7),
          status: 'Rascunho', situacao: 'Pendente' });
        a.criado_id = g.id;
        try { B7.DB.registrar({ tipo: 'criar', entidade: 'gravacao', id: g.id, cliente: a.cliente_id, gravacao: g.id, texto: 'Nova gravação: ' + g.nome }); } catch (e) {}
        if (a.data) {
          try {
            const rAg = await B7.DB.gravacaoAgendar(g.id, a.data, a.hora || null, null);
            if (B7.Gravacao && B7.Gravacao.googleAposAgendar) await B7.Gravacao.googleAposAgendar(rAg, { nome: g.nome, cliente_nome: a.cliente_nome }, a.data, a.hora || null, null);
          } catch (e) { a.aviso = 'A gravação foi criada, mas a data não foi salva. Marque a data na tela da gravação.'; }
        }
      }
    },
    /* zzz142: o administrador muda uma configuração conversando. O cartão mostra o antes e o depois; só aplica ao confirmar, pelas mesmas funções das Configurações. */
    admin: {
      cab: 'Alterar o sistema', bt: 'Aplicar', feito: 'Alteração aplicada.', link: () => ['#/config', 'Abrir Configurações'],
      linhas: a => B7.AdminChat ? B7.AdminChat.linhas(a.admin || {}) : [['Comando', a.titulo]],
      criar: async a => { if (!B7.AdminChat) throw new Error('Indisponível.'); await B7.AdminChat.aplicar(a.admin || {}); }
    },
    conteudo: {
      cab: 'Adicionar conteúdo à linha editorial', bt: 'Adicionar conteúdo', feito: 'Conteúdo adicionado como Ideia.', link: a => ['#/linha/' + a.linha_id, 'Abrir a linha editorial'],
      linhas: a => [['Cliente', a.cliente_nome], ['Linha', a.linha_nome], ['Formato', a.formato], ['Título', a.titulo]].concat(a.ideia ? [['Ideia', a.ideia]] : []),
      criar: async a => {
        const linha = await B7.DB.linha(a.linha_id);
        const novo = await B7.DB.criarConteudo({ client_id: a.cliente_id, linha_id: a.linha_id, tipo: a.formato, position: Number(linha && linha.total_conteudos) || 0,
          status: 'Ideia', titulo: a.titulo, ideia_geral: a.ideia || '' });
        a.criado_id = novo.id;
        try { B7.DB.registrar({ tipo: 'criar', entidade: 'conteudo', id: novo.id, cliente: a.cliente_id, texto: 'Novo ' + a.formato + ' em ' + (a.linha_nome || 'linha editorial') }); } catch (e) {}
      }
    }
  };
  function acaoHTML(a, i) {
    const T = TIPOS_ACAO[a.tipo] || TIPOS_ACAO.video_demanda;
    const linha = (r, v) => '<div class="ch-ac-l"><span>' + r + '</span><b>' + esc(v) + '</b></div>';
    const lk = T.link(a);
    return '<div class="ch-acao' + (a.estado ? ' ' + a.estado : '') + '">' +
      '<div class="ch-ac-cab">' + IC.novo + '<b>' + T.cab + '</b></div>' +
      T.linhas(a).map(l => linha(l[0], l[1])).join('') +
      (a.estado === 'feito' ? '<div class="ch-ac-fim ok">' + T.feito + ' <a href="' + esc(lk[0]) + '">' + lk[1] + '</a>' + (a.aviso ? '<br>' + esc(a.aviso) : '') + '</div>'
        : a.estado === 'cancelado' ? '<div class="ch-ac-fim">Cancelado. Nada foi criado.</div>'
        : (a.erro ? '<div class="ch-ac-fim erro">' + esc(a.erro) + '</div>' : '') +
          '<div class="ch-ac-bts"><button type="button" class="ch-ac-nao" data-acao-nao="' + i + '"' + (a.estado === 'indo' ? ' disabled' : '') + '>Cancelar</button>' +
          '<button type="button" class="ch-ac-ok" data-acao-ok="' + i + '"' + (a.estado === 'indo' ? ' disabled' : '') + '>' + (a.estado === 'indo' ? 'Criando…' : T.bt) + '</button></div>') +
    '</div>';
  }
  /* zzz124: uma mensagem pode trazer várias propostas; "i:j" = mensagem i, proposta j */
  const acaoDe = ref => { const p = String(ref).split(':'), m = S.msgs[Number(p[0])]; return (m && m.acoes && m.acoes[Number(p[1])]) || null; };
  /* zzz127: o que a pessoa fez com a proposta fica guardado com a resposta
     (ia_acao_estado), para o cartão voltar igual ao reabrir a conversa.
     Se não der para guardar, a tela segue: o registro já foi criado. */
  function guardarEstado(ref, estado) {
    const p = String(ref).split(':'), m = S.msgs[Number(p[0])];
    if (!m || !m.id || !B7.sb) return;
    B7.sb.rpc('ia_acao_estado', { p_mensagem: m.id, p_indice: Number(p[1]), p_estado: estado }).then(() => {}, () => {});
  }
  async function confirmarAcao(ref, emLote) {
    const a = acaoDe(ref);
    if (!a || a.estado === 'indo' || a.estado === 'feito') return false;
    const T = TIPOS_ACAO[a.tipo] || TIPOS_ACAO.video_demanda;
    a.estado = 'indo'; a.erro = ''; pintarCorpo();
    let ok = false;
    try {
      await T.criar(a);
      a.estado = 'feito'; ok = true;
      guardarEstado(ref, 'feito');
      if (!emLote && B7.UI && B7.UI.toast) B7.UI.toast(T.feito);
    } catch (e) {
      a.estado = ''; a.erro = (e && e.message) || 'Não foi possível criar.';
    }
    pintarCorpo();
    return ok;
  }
  /* zzz135 — várias propostas na mesma resposta: um toque cria todas as
     que ainda estão pendentes, uma depois da outra (a mesma criação de
     cada cartão). As que falharem ficam com o erro no próprio cartão. */
  const pendentesDe = i => ((S.msgs[i] && S.msgs[i].acoes) || []).map((a, j) => ({ a, j })).filter(x => !x.a.estado);
  let criandoLote = false;
  async function criarTodas(i) {
    if (criandoLote) return;
    const lista = pendentesDe(i); if (!lista.length) return;
    criandoLote = true;
    let feitas = 0;
    for (const x of lista) { if (await confirmarAcao(i + ':' + x.j, true)) feitas++; }
    criandoLote = false;
    pintarCorpo();
    if (B7.UI && B7.UI.toast) B7.UI.toast(feitas === lista.length ? feitas + ' registros criados.'
      : feitas + ' de ' + lista.length + ' criados. Os outros mostram o motivo no cartão.', feitas === lista.length ? {} : { tipo: 'erro' });
  }

  /* ---------------------------------------------------------------
     OUVIR A RESPOSTA (zzz127) — a voz do próprio navegador lê a resposta
     do assistente. Só quando a pessoa toca; não passa pela IA do B7.
     --------------------------------------------------------------- */
  const podeFalar = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  let falando = -1;
  function pararFala() {
    if (!podeFalar) return;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    if (falando !== -1) { falando = -1; marcarFala(); }
  }
  function marcarFala() {
    if (!painel) return;
    painel.querySelectorAll('[data-falar]').forEach(b => {
      const on = Number(b.dataset.falar) === falando;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? 'Parar de ouvir' : 'Ouvir a resposta'); b.title = on ? 'Parar' : 'Ouvir';
    });
  }
  function falar(i) {
    if (!podeFalar) return;
    const era = falando;
    pararFala();
    const m = S.msgs[i];
    if (era === i || !m || !m.texto) return;
    const texto = String(m.texto).replace(/\*\*/g, '').replace(/^\s*(?:[-•*]|\d+[.)])\s+/gm, '').replace(/^#+\s*/gm, '').replace(/\n{2,}/g, '.\n').trim();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    try { const vz = window.speechSynthesis.getVoices().filter(v => /^pt[-_]BR/i.test(v.lang)); const boa = vz.find(v => /google|natural|francisca|luciana/i.test(v.name)) || vz[0]; if (boa) u.voice = boa; } catch (e) {}
    u.onend = u.onerror = () => { if (falando === i) { falando = -1; marcarFala(); } };
    falando = i; marcarFala();
    try { window.speechSynthesis.speak(u); } catch (e) { falando = -1; marcarFala(); }
  }

  function pintarCorpo() {
    const c = painel && painel.querySelector('.ch-corpo'); if (!c) return;
    c.innerHTML = corpoHTML();
    c.querySelectorAll('.ch-sug').forEach(b => b.onclick = () => enviar(b.textContent));
    c.querySelectorAll('[data-acao-ok]').forEach(b => b.onclick = () => confirmarAcao(b.dataset.acaoOk));
    c.querySelectorAll('[data-acao-todas]').forEach(b => b.onclick = () => criarTodas(Number(b.dataset.acaoTodas)));
    c.querySelectorAll('[data-acao-nao]').forEach(b => b.onclick = () => { const a = acaoDe(b.dataset.acaoNao); if (a) { a.estado = 'cancelado'; guardarEstado(b.dataset.acaoNao, 'cancelado'); pintarCorpo(); } });
    c.querySelectorAll('[data-falar]').forEach(b => b.onclick = () => falar(Number(b.dataset.falar)));
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
      '<div class="ch-voz" id="ch-voz" role="status" aria-live="polite" hidden></div>' +
      '<div class="ch-anexo-previa" id="ch-anexo-previa" hidden></div>' +
      '<form class="ch-form" autocomplete="off">' +
        '<textarea id="ch-texto" rows="1" maxlength="2000" placeholder="Pergunte ou peça uma ideia…" aria-label="Mensagem para o assistente" ' +
          'name="b7-chat-mensagem" autocomplete="off" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other"></textarea>' +
        '<input type="file" id="ch-arquivo" accept="image/*" hidden>' +
        ((!B7.Recursos || B7.Recursos.ligado('ia_imagem')) ? '<button type="button" class="ch-mic ch-anexar" id="ch-anexar" aria-label="Anexar uma imagem" title="Anexar uma imagem (ou cole com Ctrl+V)">' + IC.img + '</button>' : '') +
        ((podeGravar || Voz) && (!B7.Recursos || B7.Recursos.ligado('ia_voz')) ? '<button type="button" class="ch-mic" id="ch-mic" aria-label="Falar em vez de digitar" aria-pressed="false" title="Falar em vez de digitar">' + IC.mic + '</button>' : '') +
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
    const mic = painel.querySelector('#ch-mic'); if (mic) mic.onclick = alternarVoz;
    const arq = painel.querySelector('#ch-arquivo'), btAnexo = painel.querySelector('#ch-anexar');
    if (arq && btAnexo) {
      btAnexo.onclick = () => { if (!S.enviando) arq.click(); };
      arq.onchange = () => { const f = arq.files && arq.files[0]; arq.value = ''; if (f) anexar(f); };
      /* colar um print direto no campo */
      ta.addEventListener('paste', e => {
        const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(i => i.kind === 'file' && /^image\//.test(i.type));
        if (it) { e.preventDefault(); const f = it.getAsFile(); if (f) anexar(f); }
      });
    }
    pintarAnexo();
    if (vozEstado) pintarVoz();
    if (S.rascunho) { ta.value = S.rascunho; ajustar(); }
  }

  /* ---------------------------------------------------------- enviar */
  async function enviar(textoBruto) {
    const anexo = S.anexo || null;
    const texto = String(textoBruto || '').trim() || (anexo ? 'O que você vê nesta imagem?' : '');
    if (!texto || S.enviando || !painel) return;
    pararVoz();
    const ta = painel.querySelector('#ch-texto');
    S.msgs = S.msgs.filter(m => !m.erro);
    S.msgs.push({ papel: 'user', texto, img: anexo ? anexo.url : null });
    S.anexo = null; pintarAnexo();
    S.enviando = true; S.rascunho = '';
    if (ta) { ta.value = ''; ta.style.height = 'auto'; ta.disabled = true; }
    const bt = painel.querySelector('#ch-enviar'); if (bt) bt.disabled = true;
    pintarTopo(); pintarCorpo();

    pararFala();
    /* acoes_v: 2 = esta tela sabe mostrar os quatro tipos de proposta; 3 = e o cartão de comando de administrador (zzz142) */
    const dados = { texto, cliente_id: S.clienteId || null, acoes_v: 3 };
    if (anexo) dados.imagem = { mime: anexo.mime, base64: anexo.base64 };
    if (S.conversaId) dados.conversa_id = S.conversaId;
    S.parcial = '';
    const r = await B7.IA.pedir('chat', dados, { aoTrecho: pedaco => { S.parcial += pedaco; pintarFluxo(); } });

    S.enviando = false; S.parcial = '';
    if (r && r.ok) {
      if (r.conversa_id) S.conversaId = r.conversa_id;
      S.msgs.push({ papel: 'assistant', id: r.mensagem_id || null, texto: r.texto, acoes: (r.acoes && r.acoes.length) ? r.acoes : (r.acao ? [r.acao] : []) });
      S.lista = null;
    } else {
      /* a pergunta não foi guardada: sai da conversa e volta para o campo */
      S.msgs.pop();
      S.rascunho = texto;
      S.anexo = anexo;      /* a imagem volta junto com o texto */
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
      const { data, error } = await B7.sb.from('ia_mensagens').select('id, papel, texto, acoes, created_at').eq('conversa_id', id).order('created_at', { ascending: true }).limit(200);
      if (error) throw error;
      const c = (S.lista || []).find(x => x.id === id) || {};
      S.conversaId = id; S.clienteId = c.cliente_id || ''; S.rascunho = '';
      S.msgs = (data || []).map(m => ({ papel: m.papel, id: m.id, texto: m.texto, acoes: Array.isArray(m.acoes) ? m.acoes.filter(a => a && typeof a === 'object') : [] }));
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
