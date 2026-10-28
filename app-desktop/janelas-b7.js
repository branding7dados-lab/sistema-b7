/* =====================================================================
   JANELAS COM A CARA DO B7 (zzz279) — no lugar das caixas cinzas do
   Windows ("Tudo em dia", "Instalar agora / Depois") e do menu nativo
   que aparecia ao apertar Alt (Arquivo/Editar/Exibir/Ajuda, com parte em
   inglês). Mesmo desenho da janela "Sobre": fundo roxo, cantos redondos,
   botões em gradiente.

   aviso(pai, { titulo, texto, tipo: 'ok'|'info'|'erro'|'nova', botoes: [{ id, rotulo, pri }] })
       → Promise com o id do botão escolhido ('fechar' se fechou)
   menu(pai, grupos, aoEscolher)
       grupos = [{ titulo, itens: [{ id, rotulo, atalho }] }]

   As janelas não têm moldura nem Node; os cliques chegam por endereços
   b7janela://<id>, que a janela intercepta — nada é aberto de verdade.
   ===================================================================== */
const { BrowserWindow, screen } = require('electron');

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const idOk = s => String(s).replace(/[^a-z0-9_-]/gi, '');

const BASE_CSS = `*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;font-family:'Segoe UI Variable','Segoe UI',system-ui,sans-serif;color:#fff;background:transparent;user-select:none}
.c{position:absolute;inset:8px;border-radius:20px;overflow:hidden;background:radial-gradient(130% 90% at 15% 0%,#3d1f73 0%,#170e2b 52%,#0c0818 100%);border:1px solid #ffffff1f;box-shadow:0 24px 60px -18px #000c;animation:e .32s cubic-bezier(.2,.9,.25,1) both}
.c:before{content:"";position:absolute;right:-90px;top:-110px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,#d6336c55 0%,transparent 68%);pointer-events:none}
@keyframes e{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

function pagina(css, corpo, script) {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${BASE_CSS}${css}</style></head><body>${corpo}<script>${script || ''}</script></body></html>`);
}
const ir = id => `location.href='b7janela://${idOk(id)}'`;

function janelaSolta(pai, w, h, x, y) {
  const j = new BrowserWindow({
    width: w, height: h, x, y, parent: pai || undefined, modal: false, show: false, frame: false, resizable: false,
    minimizable: false, maximizable: false, transparent: true, backgroundColor: '#00000000', skipTaskbar: true, title: 'Sistema B7',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true }
  });
  j.setMenu(null);
  j.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  return j;
}
function centro(pai, w, h) {
  const area = pai && !pai.isDestroyed() ? pai.getBounds() : screen.getPrimaryDisplay().workArea;
  return { x: Math.round(area.x + (area.width - w) / 2), y: Math.round(area.y + Math.max(40, (area.height - h) / 2.6)) };
}

/* ------------------------------------------------------------- aviso */
const ICONES = { ok: '✓', info: 'i', erro: '!', nova: '↓' };
function aviso(pai, op) {
  op = op || {};
  const botoes = (op.botoes && op.botoes.length ? op.botoes : [{ id: 'fechar', rotulo: 'Fechar', pri: true }]).slice(0, 3);
  const tipo = ICONES[op.tipo] ? op.tipo : 'info';
  const W = 440, H = op.texto && op.texto.length > 140 ? 330 : 300;
  const css = `.c{display:flex;flex-direction:column;align-items:center;text-align:center;padding:30px 28px 22px}
.c:after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:linear-gradient(90deg,#7c4dff,#9a44a8,#d6336c)}
.ic{position:relative;width:58px;height:58px;border-radius:18px;display:grid;place-items:center;font-size:27px;font-weight:800;background:linear-gradient(140deg,#7c4dff,#d6336c);box-shadow:0 16px 40px -12px #7c4dffcc;animation:p 2.6s ease-in-out infinite}
.ic.ok{background:linear-gradient(140deg,#20b07a,#4fd69f);box-shadow:0 16px 40px -12px #20b07acc}
.ic.erro{background:linear-gradient(140deg,#b3264f,#e2409c);box-shadow:0 16px 40px -12px #e2409ccc}
h1{position:relative;margin:16px 0 6px;font-size:19px;font-weight:700;letter-spacing:-.2px}
p{position:relative;margin:0;color:#d2c7ec;font-size:13.5px;line-height:1.5;white-space:pre-line}
.a{position:relative;display:flex;gap:10px;width:100%;margin-top:auto;padding-top:18px}
button{flex:1;padding:11px 0;border-radius:12px;font:700 13.5px 'Segoe UI',system-ui,sans-serif;color:#fff;background:#ffffff14;border:1px solid #ffffff22;cursor:pointer;transition:background .15s,transform .15s}
button:hover{background:#ffffff26;transform:translateY(-1px)}button.pri{background:linear-gradient(120deg,#7c4dff,#9a44a8 52%,#d6336c);border-color:transparent}
button:focus-visible{outline:2px solid #ffffff88;outline-offset:2px}
.x{position:absolute;top:12px;right:12px;width:28px;height:28px;flex:none;padding:0;border-radius:50%;font-size:13px}
@keyframes p{50%{transform:scale(1.05)}}`;
  const corpo = `<div class="c"><button class="x" onclick="${ir('fechar')}" title="Fechar (Esc)" aria-label="Fechar">✕</button>
<div class="ic ${tipo}">${ICONES[tipo]}</div><h1>${esc(op.titulo)}</h1><p>${esc(op.texto)}</p>
<div class="a">${botoes.map(b => `<button class="${b.pri ? 'pri' : ''}" onclick="${ir(b.id)}">${esc(b.rotulo)}</button>`).join('')}</div></div>`;
  const script = `addEventListener('keydown',e=>{if(e.key==='Escape')${ir('fechar')}});setTimeout(()=>{const b=document.querySelector('button.pri')||document.querySelector('.a button');b&&b.focus()},60)`;
  return new Promise(resolve => {
    const p = centro(pai, W, H);
    const j = janelaSolta(pai, W, H, p.x, p.y);
    let feito = false;
    const fim = id => { if (feito) return; feito = true; resolve(id); if (!j.isDestroyed()) j.close(); };
    j.webContents.on('will-navigate', (ev, url) => { ev.preventDefault(); if (url.startsWith('b7janela://')) fim(url.slice(11).replace(/\/$/, '') || 'fechar'); });
    j.on('closed', () => fim('fechar'));
    j.once('ready-to-show', () => { j.show(); j.focus(); });
    j.loadURL(pagina(css, corpo, script)).catch(() => fim('fechar'));
  });
}

/* -------------------------------------------------------------- menu */
let menuAberto = null;
function menu(pai, grupos, aoEscolher) {
  if (menuAberto && !menuAberto.isDestroyed()) { menuAberto.close(); return; }
  const linhas = grupos.reduce((n, g) => n + g.itens.length, 0);
  const W = 300, H = 40 + grupos.length * 30 + linhas * 36 + (grupos.length - 1) * 11;
  const b = pai && !pai.isDestroyed() ? pai.getContentBounds() : screen.getPrimaryDisplay().workArea;
  const j = janelaSolta(pai, W, H, b.x + 6, b.y + 6);
  menuAberto = j;
  const css = `.c{padding:10px 8px}
.g{position:relative;padding:0 2px}.g+.g{margin-top:5px;padding-top:5px;border-top:1px solid #ffffff17}
.t{margin:4px 10px 4px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#a99cc8;font-weight:700;height:22px;line-height:22px}
a{display:flex;align-items:center;justify-content:space-between;gap:12px;height:36px;padding:0 10px;border-radius:10px;color:#fff;text-decoration:none;font-size:13.5px;font-weight:600;outline:none}
a:hover,a:focus{background:linear-gradient(120deg,#7c4dff55,#d6336c44)}
a kbd{font:600 11px 'Segoe UI',system-ui,sans-serif;color:#c9bde6;background:#ffffff12;border:1px solid #ffffff1c;border-radius:6px;padding:2px 6px}`;
  const corpo = `<div class="c" role="menu">${grupos.map(g => `<div class="g"><div class="t">${esc(g.titulo)}</div>${g.itens.map(i =>
    `<a href="b7janela://${idOk(i.id)}" role="menuitem">${esc(i.rotulo)}${i.atalho ? `<kbd>${esc(i.atalho)}</kbd>` : ''}</a>`).join('')}</div>`).join('')}</div>`;
  const script = `const l=[...document.querySelectorAll('a')];let k=-1;
addEventListener('keydown',e=>{if(e.key==='Escape'||e.key==='Alt'){e.preventDefault();${ir('fechar')}}
if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();k=(k+(e.key==='ArrowDown'?1:-1)+l.length)%l.length;l[k].focus()}});
setTimeout(()=>{k=0;l[0]&&l[0].focus()},40)`;
  const fechar = () => { if (!j.isDestroyed()) j.close(); };
  j.webContents.on('will-navigate', (ev, url) => {
    ev.preventDefault();
    const id = url.startsWith('b7janela://') ? url.slice(11).replace(/\/$/, '') : 'fechar';
    fechar();
    if (id && id !== 'fechar') setImmediate(() => aoEscolher(id));
  });
  j.on('blur', () => setTimeout(fechar, 80));
  j.on('closed', () => { if (menuAberto === j) menuAberto = null; if (pai && !pai.isDestroyed()) pai.focus(); });
  j.once('ready-to-show', () => { j.show(); j.focus(); });
  j.loadURL(pagina(css, corpo, script)).catch(fechar);
}

module.exports = { aviso, menu };
