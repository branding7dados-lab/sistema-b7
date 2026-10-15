/* =====================================================================
   DENTRO DO WHATSAPP WEB (zzz170) — ver app-desktop/whatsapp.js

   1. ASSINATURA. Ao apertar Enter (ou o botão de enviar) com texto no
      campo, põe "*Nome:*" + quebra de linha no começo — o WhatsApp
      mostra "Nome:" em negrito. Não repete se a mensagem já começa com
      o nome; não mexe em mensagem vazia (só foto/arquivo sem legenda) nem
      na busca. O texto é inserido como "colar", que é o caminho que o
      editor do WhatsApp entende sem perder emojis nem formatação.
   2. PEDIDOS DO SISTEMA ("Enviar no WhatsApp"): esperar o WhatsApp
      conectar, abrir um grupo pelo nome, preparar o anexo (marca o campo
      de arquivo para o programa pôr o vídeo) e escrever a mensagem.
      Nunca envia: quem aperta enviar é a pessoa.

   O WhatsApp muda o site de vez em quando. Cada passo procura por mais
   de um jeito; se nenhum servir, devolve um motivo e o programa deixa a
   mensagem copiada para a pessoa colar.
   ===================================================================== */
const { ipcRenderer, webFrame } = require('electron');

let cfg = { nome: '', assinatura: true };
ipcRenderer.invoke('b7wa:config').then(c => { if (c) cfg = c; }).catch(() => {});
ipcRenderer.on('b7wa:config', (ev, c) => { if (c) cfg = c; });

const esperar = ms => new Promise(r => setTimeout(r, ms));
async function ate(fn, ms, passo) {
  const fim = Date.now() + (ms || 5000);
  while (Date.now() < fim) { const v = fn(); if (v) return v; await esperar(passo || 120); }
  return null;
}
const qs = (s, el) => (el || document).querySelector(s);
const qsa = (s, el) => [...(el || document).querySelectorAll(s)];
const visivel = el => !!el && el.getClientRects().length > 0;
const normal = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/* --------------------------------------------------------- texto */
function colar(el, texto) {
  el.focus();
  const dt = new DataTransfer();
  dt.setData('text/plain', texto);
  el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}
function cursorNoComeco(el) {
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function cursorNoFim(el) {
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
const editavel = el => el && el.closest ? el.closest('[contenteditable="true"]') : null;
const naBusca = el => !!(el.closest('#side') || el.closest('[role="search"]') ||
  /pesquis|search|buscar/i.test(el.getAttribute('aria-label') || '') || /pesquis|search|buscar/i.test(el.getAttribute('title') || ''));
const campoDaConversa = () => qs('#main footer [contenteditable="true"]') || qsa('footer [contenteditable="true"]').find(visivel);

/* --------------------------------------------------- 1. assinatura */
const prefixo = () => '*' + String(cfg.nome || '').trim() + ':*';
let nosso = false, ultimoCampo = null;
document.addEventListener('focusin', e => { const c = editavel(e.target); if (c && !naBusca(c)) ultimoCampo = c; }, true);

function precisa(campo) {
  if (!cfg.assinatura || !String(cfg.nome || '').trim() || !campo || naBusca(campo)) return false;
  const t = (campo.innerText || '').replace(/​/g, '').trim();
  if (!t) return false;
  const n = normal(String(cfg.nome).trim());
  const inicio = normal(t.split('\n')[0]).replace(/\*/g, '');
  return !(inicio === n + ':' || inicio.startsWith(n + ':'));
}
async function assinarEnviar(campo, enviarDepois) {
  cursorNoComeco(campo);
  await esperar(40);                               /* o editor lê a posição do cursor um instante depois */
  colar(campo, prefixo() + '\n');
  await esperar(80);
  nosso = true;
  try { enviarDepois(); } finally { setTimeout(() => { nosso = false; }, 50); }
}
function teclaEnter(campo) {
  campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
}
document.addEventListener('keydown', e => {
  if (nosso || e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
  const campo = editavel(e.target);
  if (!precisa(campo)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  assinarEnviar(campo, () => teclaEnter(campo));
}, true);

const BOTAO_ENVIAR = '[data-icon="send"], [data-icon="wds-ic-send-filled"], [data-icon="send-light"], button[aria-label="Enviar"], button[aria-label="Send"], [role="button"][aria-label="Enviar"], [role="button"][aria-label="Send"]';
document.addEventListener('click', e => {
  if (nosso) return;
  const bt = e.target.closest && e.target.closest(BOTAO_ENVIAR);
  if (!bt) return;
  const campo = (ultimoCampo && ultimoCampo.isConnected && visivel(ultimoCampo)) ? ultimoCampo : campoDaConversa();
  if (!precisa(campo)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const alvo = bt.closest('button, [role="button"]') || bt;
  assinarEnviar(campo, () => alvo.click());
}, true);

/* aviso de mensagem clicado → o programa vem para a frente na tela do
   WhatsApp. O aviso é criado pela página: um envelope no Notification
   dela conta o clique para cá. */
try {
  webFrame.executeJavaScript(`(() => {
    const N = window.Notification; if (!N || N.__b7) return;
    function B7N(t, o) { const n = new N(t, o); n.addEventListener('click', () => window.postMessage({ b7wa: 'clique' }, '*')); return n; }
    B7N.prototype = N.prototype; B7N.__b7 = true;
    Object.defineProperty(B7N, 'permission', { get: () => N.permission });
    B7N.requestPermission = (...a) => N.requestPermission(...a);
    window.Notification = B7N;
  })()`);
} catch (e) {}
window.addEventListener('message', e => { if (e.source === window && e.data && e.data.b7wa === 'clique') ipcRenderer.send('b7wa:clique'); });

/* ------------------------------------------ 2. pedidos do sistema */
const conectado = () => !!(qs('#side') || qs('#pane-side'));
/* zzz180: o cabeçalho do grupo tem o NOME e, embaixo, a lista dos
   participantes ("César, Kevin, Yury…") — e às vezes o title fica nos
   participantes. Prefere o texto que é nome de uma conversa da lista, e
   nunca uma lista separada por vírgulas. */
const tituloDaConversa = () => {
  const h = qs('#main header');
  if (!h) return '';
  const textos = qsa('span, div', h).filter(e => e.childElementCount === 0)
    .map(e => (e.getAttribute('title') || e.textContent || '').trim()).filter(Boolean);
  let nomes = new Set();
  try { nomes = new Set(lerLista().map(x => x.nome)); } catch (e) {}
  const daLista = textos.find(t => nomes.has(t));
  if (daLista) return daLista;
  const sel = qs('#pane-side [aria-selected="true"] span[title]');
  if (sel) return sel.getAttribute('title');
  return textos.find(t => !/,\s/.test(t) && !/^(online|digitando|clique|visto|toque)/i.test(t)) || textos[0] || '';
};
function campoBusca() {
  const lista = qsa('#side input, #side [contenteditable="true"]').concat(qsa('input[role="textbox"], [contenteditable="true"][role="textbox"]'))
    .filter(el => visivel(el) && !el.closest('#main') && !el.closest('footer'));
  return lista[0] || null;
}
function escreverNaBusca(el, texto) {
  el.focus();
  if (el.tagName === 'INPUT') {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(el, texto);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    document.execCommand('selectAll', false);
    if (texto) document.execCommand('insertText', false, texto); else document.execCommand('delete', false);
  }
}
function clicar(el) {
  const alvo = el.closest('[role="listitem"], [role="row"], [role="gridcell"], [tabindex="-1"], [tabindex="0"]') || el;
  ['mousedown', 'mouseup', 'click'].forEach(t => alvo.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })));
}

const ACOES = {
  async esperarPronto() {
    const ok = await ate(conectado, 40000, 300);
    return ok ? { ok: true } : { ok: false, motivo: 'O WhatsApp ainda não está conectado. Abra a tela do WhatsApp e leia o QR Code com o celular.' };
  },

  async abrirGrupo({ nome }) {
    const alvo = normal(nome);
    if (!alvo) return { ok: false, motivo: 'Este cliente não tem o grupo do WhatsApp cadastrado.' };
    if (normal(tituloDaConversa()) === alvo) return { ok: true };
    const busca = campoBusca();
    if (!busca) return { ok: false, motivo: 'Não achei a busca do WhatsApp.' };
    escreverNaBusca(busca, nome);
    const achado = await ate(() => {
      const cands = qsa('#pane-side span[title], #side span[title], [aria-label] span[title]');
      return cands.find(s => normal(s.getAttribute('title')) === alvo) || null;
    }, 6000, 150);
    if (!achado) { escreverNaBusca(busca, ''); return { ok: false, motivo: 'Não achei o grupo "' + nome + '" no WhatsApp. Confira o nome no cadastro do cliente.' }; }
    clicar(achado);
    const abriu = await ate(() => normal(tituloDaConversa()) === alvo, 5000, 120);
    escreverNaBusca(busca, '');
    return abriu ? { ok: true } : { ok: false, motivo: 'Achei o grupo, mas ele não abriu.' };
  },

  async prepararAnexo({ documento }) {
    qsa('input[data-b7-alvo]').forEach(i => i.removeAttribute('data-b7-alvo'));
    const acharCampo = () => {
      const files = qsa('input[type="file"]');
      if (documento) return files.find(i => (i.getAttribute('accept') || '') === '*') || files.find(i => !i.getAttribute('accept'));
      /* zzz187: "Fotos e vídeos" aceita vídeo e vários arquivos; o campo só
         de imagem é o de FIGURINHA (corta quadrado e aceita uma só) */
      /* zzz191: o WhatsApp nem sempre marca vídeo no campo de fotos — acha
         pelo NOME do item do menu ("Fotos e vídeos"), depois pelo tipo, e
         só por último qualquer campo de imagem que NÃO seja de figurinha */
      const rotulo = i => { const c = i.closest('li, [role="button"], [role="menuitem"], div[aria-label]'); return ((c && (c.getAttribute('aria-label') || c.textContent)) || '').toLowerCase(); };
      const img = files.filter(i => /image/.test(i.getAttribute('accept') || ''));
      const figurinha = i => /figurinha|sticker/.test(rotulo(i));
      return img.find(i => /foto|photo|v[íi]deo|video/.test(rotulo(i)) && !figurinha(i)) ||
             img.find(i => /video/.test(i.getAttribute('accept') || '')) ||
             img.find(i => i.multiple && !figurinha(i)) ||
             img.find(i => !figurinha(i)) || null;
    };
    let campo = acharCampo();
    if (!campo) {
      const bt = qs('#main footer [data-icon="plus"], #main footer [data-icon="plus-rounded"], #main footer [data-icon="clip"], #main footer [data-icon="attach-menu-plus"], ' +
        '#main footer [title="Anexar"], #main footer [aria-label="Anexar"], #main footer [title="Attach"], #main footer [aria-label="Attach"]');
      if (!bt) return { ok: false, motivo: 'Não achei o botão de anexar do WhatsApp.' };
      clicar(bt.closest('button, [role="button"]') || bt);
      campo = await ate(acharCampo, 3000, 100);
    }
    if (!campo) return { ok: false, motivo: 'Não achei onde anexar ' + (documento ? 'o documento.' : 'o arquivo.') };
    campo.setAttribute('data-b7-alvo', '1');
    if (!documento) campo.multiple = true;
    return { ok: true };
  },

  async legenda({ texto, espera }) {
    /* depois do arquivo, o WhatsApp abre a prévia com o campo de legenda */
    const campo = await ate(() => {
      const a = document.activeElement;
      if (a && a.isContentEditable && !naBusca(a) && !a.closest('#main footer')) return a;
      return qsa('[contenteditable="true"]').find(el => visivel(el) && !naBusca(el) && !el.closest('#main footer') && !el.closest('#side')) || null;
    }, espera || 25000, 200);
    if (!campo) return { ok: false, motivo: 'O arquivo foi anexado, mas não achei o campo da legenda.' };
    if (texto) { cursorNoFim(campo); await esperar(40); colar(campo, texto); }
    return { ok: true };
  },

  async escrever({ texto }) {
    const campo = await ate(campoDaConversa, 4000);
    if (!campo) return { ok: false, motivo: 'Não achei o campo de mensagem.' };
    cursorNoFim(campo); await esperar(40);
    colar(campo, texto);
    return { ok: true };
  }
};


/* ------------------------------------------ 3. LEITURA (zzz176)
   Só LÊ o que já está na tela do WhatsApp — nada é clicado nem enviado:
     • a lista de conversas (nome, última mensagem, se foi nossa, não
       lidas, hora) → o sistema casa os grupos com os clientes e vê quem
       está esperando resposta;
     • a conversa aberta (nome e as últimas mensagens) → o cartão do
       cliente ao lado e o "possível aprovação".
   A lista do WhatsApp só tem na tela as conversas visíveis; "escanear"
   rola a lista do começo ao fim uma vez para conhecer todos os grupos. */
const HORA_RE = /^(\d{1,2}:\d{2}|ontem|yesterday|\d{1,2}\/\d{1,2}\/\d{2,4}|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|sábado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i;
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const DIAS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
function quandoDe(t) {
  if (!t) return '';
  const agora = new Date(), d = new Date(agora);
  let m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (m) { d.setHours(+m[1], +m[2], 0, 0); if (d - agora > 5 * 60000) d.setDate(d.getDate() - 1); return d.toISOString(); }
  const tl = t.toLowerCase();
  if (tl === 'ontem' || tl === 'yesterday') { d.setDate(d.getDate() - 1); d.setHours(12, 0, 0, 0); return d.toISOString(); }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t);
  if (m) { const a = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return new Date(a, +m[2] - 1, +m[1], 12).toISOString(); }
  let i = DIAS.indexOf(tl); if (i < 0) i = DIAS_EN.indexOf(tl);
  if (i >= 0) { let k = (d.getDay() - i + 7) % 7 || 7; d.setDate(d.getDate() - k); d.setHours(12, 0, 0, 0); return d.toISOString(); }
  return '';
}
const linhasDaLista = () => { const p = qs('#pane-side'); return p ? qsa('[role="listitem"], [role="row"]', p).filter(r => qs('span[title]', r)) : []; };
function lerLinha(r) {
  const tit = qsa('span[title]', r);
  if (!tit.length) return null;
  const nome = (tit[0].getAttribute('title') || '').trim();
  if (!nome) return null;
  const previa = tit.length > 1 ? (tit[tit.length - 1].getAttribute('title') || '').trim() : '';
  let autor = '';
  /* zzz183: o remetente fica num pedaço ao lado da prévia ("Atendimento
     Suporte Branding7: Prorizando…"). Sobe a partir da prévia até achar a
     linha inteira e pega o que vem antes dos dois-pontos. */
  if (previa && tit.length > 1) {
    let el = tit[tit.length - 1];
    for (let k = 0; k < 4 && el && el !== r; k++) {
      el = el.parentElement;
      const linha = (el && el.textContent || '').trim();
      const i = linha.lastIndexOf(previa.slice(0, 15));
      if (i > 0) { const m = /~?\s*([^:]{1,60}):\s*$/.exec(linha.slice(0, i)); if (m) { autor = m[1].trim(); break; } }
    }
  }
  if (!autor && previa) {
    const tx = r.innerText || '', i = tx.lastIndexOf(previa.slice(0, 20));
    const antes = i > 0 ? tx.slice(0, i).split('\n').pop() : '';
    const m = /~?\s*([^:\n]{1,40}):\s*$/.exec(antes || '');
    if (m) autor = m[1].trim();
  }
  const minha = !!r.querySelector('[data-icon^="status-"], [data-icon*="dblcheck"], [data-icon="msg-check"], [data-icon*="msg-time"], [data-icon="status-check"]');
  let naoLidas = 0;
  const badge = qsa('[aria-label]', r).find(e => /\d+\s*(mensage|unread|não lida|nao lida)/i.test(e.getAttribute('aria-label') || ''));
  if (badge) { const m = /(\d+)/.exec(badge.getAttribute('aria-label')); naoLidas = m ? +m[1] : 0; }
  const hora = qsa('div, span', r).filter(e => e.childElementCount === 0).map(e => (e.textContent || '').trim()).find(t => HORA_RE.test(t)) || '';
  return { nome, previa, autor, minha, nao_lidas: naoLidas, ultima_em: quandoDe(hora) };
}
const lerLista = () => linhasDaLista().map(lerLinha).filter(Boolean);

function lerConversa() {
  const titulo = tituloDaConversa();
  if (!titulo) return null;
  const msgs = qsa('#main [data-pre-plain-text]').slice(-14).map(el => {
    const pre = el.getAttribute('data-pre-plain-text') || '';
    const m = /^\[([^\]]+)\]\s*([^:]*):/.exec(pre);
    const caixa = el.closest('.message-out, .message-in');
    return { de: m ? m[2].trim() : '', quando: m ? m[1] : '', minha: !!(caixa && caixa.classList.contains('message-out')),
             texto: ((el.querySelector('.selectable-text') || el).innerText || '').trim().slice(0, 400) };
  }).filter(x => x.texto);
  return { titulo, msgs };
}

let ultimaLista = '', ultimaConversa = '', tLer = 0;
function lerEMandar() {
  clearTimeout(tLer);
  tLer = setTimeout(() => {
    try {
      const l = lerLista(), jl = JSON.stringify(l);
      if (l.length && jl !== ultimaLista) { ultimaLista = jl; ipcRenderer.send('b7wa:conversas', l); }
      const c = lerConversa(), jc = JSON.stringify(c);
      if (jc !== ultimaConversa) { ultimaConversa = jc; ipcRenderer.send('b7wa:conversa', c); }
    } catch (e) {}
  }, 1200);
}
new MutationObserver(lerEMandar).observe(document, { childList: true, subtree: true, characterData: true });
setInterval(lerEMandar, 60000);   /* "há quanto tempo" muda mesmo sem mensagem nova */

ACOES.escanear = async () => {
  const p = qs('#pane-side');
  if (!p) return { ok: false, motivo: 'O WhatsApp ainda não está conectado.' };
  const rolo = [p].concat(qsa('*', p)).find(e => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)) || p;
  const antes = rolo.scrollTop, achados = new Map();
  rolo.scrollTop = 0; await esperar(400);
  for (let i = 0; i < 400; i++) {
    lerLista().forEach(x => achados.set(x.nome, x));
    if (rolo.scrollTop + rolo.clientHeight >= rolo.scrollHeight - 4) break;
    rolo.scrollTop += Math.max(200, rolo.clientHeight * 0.8);
    await esperar(260);
  }
  rolo.scrollTop = antes;
  return { ok: true, lista: [...achados.values()] };
};

ipcRenderer.on('b7wa:fazer', async (ev, p) => {
  let r;
  try { r = await (ACOES[p.acao] ? ACOES[p.acao](p.dados || {}) : { ok: false, motivo: 'Pedido desconhecido.' }); }
  catch (e) { r = { ok: false, motivo: 'O WhatsApp mudou algo na tela e este passo falhou.' }; }
  ipcRenderer.send('b7wa:resposta', Object.assign({ id: p.id }, r));
});
