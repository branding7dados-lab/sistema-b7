/* =====================================================================
   SISTEMA B7 PARA WINDOWS (zzz157)

   Uma janela só, com o sistema de verdade dentro (o mesmo endereço do
   navegador). Por quê o endereço e não as telas embutidas, como no
   Android: assim toda atualização do sistema chega na hora, sem baixar
   um instalador novo — e o próprio sistema já guarda tudo no computador
   (service worker), então ele continua abrindo sem internet.

   O que o programa faz por fora do site:
     • lembra o tamanho e o lugar da janela;
     • abre link de fora no navegador do computador;
     • libera câmera e microfone (teleprompter) só para o site do B7;
     • AVISA E INSTALA SOZINHO a versão nova do próprio programa
       (electron-updater, lendo a release "app-desktop" do GitHub).

   O instalador e o latest.yml saem do .github/workflows/desktop.yml.
   ===================================================================== */
const { app, BrowserWindow, shell, dialog, Menu, screen, session, ipcMain, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs');
const ligarWhatsApp = require('./whatsapp');   /* zzz170: WhatsApp dentro do programa */

const SITE = 'https://branding7dados-lab.github.io/sistema-b7/';
const ORIGEM = new URL(SITE).origin;
const FUNDO = '#05030A';            /* o céu da abertura: nada de piscar branco */

/* uma janela só: clicar no atalho de novo traz a que já está aberta */
if (!app.requestSingleInstanceLock()) { app.quit(); return; }

let janela = null;
const whats = ligarWhatsApp(() => janela);

/* ------------------------------------------------- lugar da janela */
const arquivoJanela = () => path.join(app.getPath('userData'), 'janela.json');
function lerJanela() {
  try { return JSON.parse(fs.readFileSync(arquivoJanela(), 'utf8')); } catch (e) { return {}; }
}
function guardarJanela() {
  if (!janela || janela.isDestroyed()) return;
  try {
    const b = janela.getNormalBounds();
    fs.writeFileSync(arquivoJanela(), JSON.stringify({ ...b, maximizada: janela.isMaximized() }));
  } catch (e) { /* sem permissão de escrita: a janela só não é lembrada */ }
}
/* a janela tem de caber em alguma tela ligada agora (monitor desligado
   depois de fechar o programa deixava a janela fora da vista) */
function cabe(b) {
  if (!b || typeof b.x !== 'number') return false;
  return screen.getAllDisplays().some(d => {
    const a = d.workArea;
    return b.x + b.width > a.x + 60 && b.x < a.x + a.width - 60 &&
           b.y + b.height > a.y + 40 && b.y < a.y + a.height - 40;
  });
}

/* ------------------------------------------------------- a janela */
function criarJanela() {
  const salva = lerJanela();
  const usar = cabe(salva);
  janela = new BrowserWindow({
    width: usar ? salva.width : 1280,
    height: usar ? salva.height : 860,
    x: usar ? salva.x : undefined,
    y: usar ? salva.y : undefined,
    minWidth: 380,
    minHeight: 560,
    show: false,
    backgroundColor: FUNDO,
    title: 'Sistema B7',
    icon: path.join(__dirname, 'recursos', 'icone.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      backgroundThrottling: false
    }
  });
  if (usar && salva.maximizada) janela.maximize();

  /* o nome na barra de cima fica SEMPRE "Sistema B7": o site troca o título
     a cada tela ("Configurações · Branding7"), o que no computador fica
     piscando um nome diferente a toda hora */
  janela.on('page-title-updated', ev => ev.preventDefault());

  janela.once('ready-to-show', () => janela.show());
  ['resize', 'move', 'close'].forEach(ev => janela.on(ev, guardarJanela));
  janela.on('closed', () => { janela = null; whats.aoFecharJanela(); });
  janela.webContents.once('did-finish-load', () => whats.aoAbrirJanela());

  /* link de fora (ajuda, release, site de cliente) abre no navegador */
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  janela.webContents.on('will-navigate', (ev, url) => {
    if (new URL(url).origin !== ORIGEM) { ev.preventDefault(); shell.openExternal(url); }
  });

  /* o site fora do ar (ou sem internet na primeira vez): tela de espera
     com "Tentar de novo" — depois da primeira vez o próprio sistema
     abre do que já está guardado, mesmo sem internet */
  janela.webContents.on('did-fail-load', (ev, codigo, descricao, url, principal) => {
    if (!principal || codigo === -3) return;       /* -3 = navegação cancelada */
    janela.loadFile(path.join(__dirname, 'offline.html'));
  });

  janela.loadURL(SITE);
}

/* ------------------------------------------- permissões e downloads */
function ligarSessao() {
  const ses = session.defaultSession;
  /* câmera e microfone (teleprompter), avisos e tela cheia: só o B7.
     zzz160: a comparação era de texto cru ("https://host" × "https://host/")
     e por isso o Electron respondia "bloqueada" ao sistema — era o que
     aparecia em Avisos. Agora compara a ORIGEM de verdade. */
  const PERMITIDAS = ['media', 'notifications', 'fullscreen', 'clipboard-sanitized-write', 'clipboard-read'];
  const nossa = u => { try { return new URL(u).origin === ORIGEM; } catch (e) { return false; } };
  ses.setPermissionRequestHandler((wc, permissao, responder, detalhes) => {
    const origem = (detalhes && detalhes.requestingUrl) || (wc && wc.getURL()) || '';
    responder(nossa(origem) && PERMITIDAS.includes(permissao));
  });
  ses.setPermissionCheckHandler((wc, permissao, origem, detalhes) => {
    const u = origem || (detalhes && detalhes.requestingUrl) || (wc && wc.getURL()) || '';
    return nossa(u) && PERMITIDAS.includes(permissao);
  });

  /* arquivo baixado (PDF, planilha, vídeo do teleprompter): vai para a
     pasta Downloads e o programa mostra onde foi */
  ses.on('will-download', (ev, item) => {
    /* sem caixa de "salvar onde?": vai para Downloads com o nome que o
       sistema deu (se já existir, o Electron numera). Uma exportação de
       vários arquivos abria uma caixa atrás da outra. */
    try {
      const nome = item.getFilename();
      item.setSavePath(path.join(app.getPath('downloads'), nome));
    } catch (e) { /* sem permissão: o Electron pergunta onde salvar */ }
    item.once('done', (e, estado) => {
      const caminho = item.getSavePath();
      if (estado === 'completed') {
        avisoDoSistema('Baixado: ' + path.basename(caminho) + ' (toque para abrir a pasta)',
                       () => shell.showItemInFolder(caminho));
      } else {
        avisoDoSistema('Não foi possível baixar ' + item.getFilename() + '.');
      }
    });
  });
}

/* ------------------------------------------------------ atualização
   O workflow publica o instalador e o latest.yml sempre na MESMA release
   ("app-desktop"), então o endereço não muda e o programa só precisa ler
   esse arquivo para saber se há versão nova. Baixa em segundo plano e
   pergunta antes de instalar — nada fecha sozinho no meio do trabalho. */
let avisando = false, pedidoDaPessoa = false;

/* zzz169: o SITE também fica sabendo da atualização do programa e mostra
   um selo no topo ("Atualização do programa · baixando 40%" → "Instalar
   agora"). Antes só aparecia uma caixa quando o download acabava — e se
   a pessoa não visse, ficava sem saber que havia versão nova. */
let estadoAtualizacao = { estado: 'nada' };
function contarAoSite(e) {
  estadoAtualizacao = e;
  if (janela && !janela.isDestroyed()) { try { janela.webContents.send('b7:atualizacao', e); } catch (x) {} }
}

/* zzz162: os avisos eram injetados na página (B7.UI.toast). No programa
   eles saíam brancos e sem texto — a página não é nossa para mexer assim.
   Agora o programa fala pelos meios do Windows: caixa de diálogo quando a
   pessoa pediu alguma coisa, e aviso do sistema quando é só uma notícia. */
function caixa(titulo, detalhe, erro) {
  const op = { type: erro ? 'warning' : 'info', title: 'Sistema B7', message: titulo,
               detail: detalhe || '', buttons: ['Fechar'], noLink: true };
  if (janela && !janela.isDestroyed()) dialog.showMessageBox(janela, op); else dialog.showMessageBox(op);
}
function avisoDoSistema(texto, aoTocar) {
  try {
    if (!Notification.isSupported()) return;
    const n = new Notification({ title: 'Sistema B7', body: texto });
    if (aoTocar) n.on('click', aoTocar);
    n.show();
  } catch (e) { /* o Windows pode estar com avisos desligados */ }
}
function ligarAtualizacao() {
  if (!app.isPackaged) return;                 /* rodando do código: não atualiza */
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;     /* se a pessoa disser "depois", instala ao fechar */

  /* zzz161: quem clica em "Procurar atualização" precisa ver alguma coisa.
     Antes o programa conferia calado: sem versão nova, sem erro, sem nada —
     e parecia que o botão não funcionava. */
  autoUpdater.on('update-available', info => {
    const v = info && info.version ? info.version : '';
    contarAoSite({ estado: 'baixando', versao: v, pct: 0 });
    if (!pedidoDaPessoa) {
      avisoDoSistema('Versão nova do programa (' + (v || 'nova') + ') encontrada. Baixando em segundo plano — eu aviso quando puder instalar.');
      return;
    }
    caixa('Versão ' + (info && info.version ? info.version : 'nova') + ' encontrada',
          'Estou baixando agora (uns 78 MB). Quando terminar, pergunto se pode instalar. Pode continuar usando.');
  });
  autoUpdater.on('update-not-available', () => {
    if (!pedidoDaPessoa) return;
    pedidoDaPessoa = false;
    caixa('Tudo em dia', 'Você já está na versão mais nova do programa (' + app.getVersion() + ').');
  });
  autoUpdater.on('download-progress', p => {
    const pct = Math.round(p && p.percent ? p.percent : 0);
    if (estadoAtualizacao.estado === 'baixando' && pct !== estadoAtualizacao.pct) contarAoSite({ ...estadoAtualizacao, pct });
    if (!pedidoDaPessoa || !janela || janela.isDestroyed()) return;
    janela.setProgressBar(Math.max(0, Math.min(1, (p && p.percent ? p.percent : 0) / 100)));
  });
  autoUpdater.on('update-downloaded', async info => {
    pedidoDaPessoa = false;
    if (janela && !janela.isDestroyed()) janela.setProgressBar(-1);
    contarAoSite({ estado: 'pronta', versao: info && info.version ? info.version : '' });
    avisoDoSistema('Atualização do Sistema B7 pronta. Clique para instalar agora.', () => instalarAgora());
    if (avisando || !janela || janela.isDestroyed()) return;
    avisando = true;
    const r = await dialog.showMessageBox(janela, {
      type: 'info',
      title: 'Sistema B7',
      message: 'Tem uma versão nova do Sistema B7',
      detail: 'A versão ' + (info && info.version ? info.version : 'nova') +
        ' já foi baixada. Instalar agora leva uns segundos; nada do seu trabalho se perde.',
      buttons: ['Instalar agora', 'Depois, ao fechar'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    avisando = false;
    if (r.response === 0) setImmediate(() => autoUpdater.quitAndInstall(false, true));
  });
  autoUpdater.on('error', e => {
    if (janela && !janela.isDestroyed()) janela.setProgressBar(-1);
    if (estadoAtualizacao.estado === 'baixando') contarAoSite({ estado: 'nada' });
    if (!pedidoDaPessoa) return;               /* sozinho: tenta de novo depois, calado */
    pedidoDaPessoa = false;
    caixa('Não deu para conferir agora', ((e && e.message) || 'Sem resposta do servidor') +
          '.\n\nConfira a internet e tente de novo.', true);
  });
  setTimeout(() => conferir(false), 12000);
  /* zzz169: confere de 30 em 30 min e ao voltar para a janela (no máximo
     a cada 10 min) — antes eram 2 horas, e a versão nova demorava a aparecer */
  setInterval(() => conferir(false), 30 * 60 * 1000);
  let ultimaConferida = Date.now();
  app.on('browser-window-focus', () => {
    if (Date.now() - ultimaConferida < 10 * 60 * 1000) return;
    ultimaConferida = Date.now(); conferir(false);
  });
}
function instalarAgora() {
  if (estadoAtualizacao.estado !== 'pronta') return false;
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return true;
}

/* manual = true quando veio do menu Ajuda ou das Configurações */
function conferir(manual) {
  if (!app.isPackaged) {
    if (manual) caixa('Rodando do código', 'A atualização automática só vale na versão instalada.', true);
    return Promise.resolve(false);
  }
  if (manual) pedidoDaPessoa = true;
  return autoUpdater.checkForUpdates().then(() => true, () => false);
}

/* --------------------------------------------------------- menu
   Menu escondido (o sistema tem a navegação dele), mas os atalhos de
   sempre continuam valendo: copiar, colar, recarregar, zoom, F12. */
function montarMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Recarregar', accelerator: 'CmdOrCtrl+R', click: () => janela && janela.webContents.reload() },
        { label: 'Ir para o início', click: () => janela && janela.loadURL(SITE) },
        { type: 'separator' },
        { label: 'Sair', accelerator: 'Alt+F4', role: 'quit' }
      ]
    },
    { label: 'Editar', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    {
      label: 'Exibir',
      submenu: [
        { role: 'resetZoom', label: 'Zoom normal' }, { role: 'zoomIn', label: 'Aumentar' }, { role: 'zoomOut', label: 'Diminuir' },
        { type: 'separator' }, { role: 'togglefullscreen', label: 'Tela cheia' },
        { label: 'Ferramentas do desenvolvedor', accelerator: 'F12', click: () => janela && janela.webContents.toggleDevTools() }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        { label: 'Procurar atualização', click: () => conferir(true) },
        { label: 'Sobre', click: () => janela && dialog.showMessageBox(janela, {
            type: 'info', title: 'Sistema B7', message: 'Sistema B7 para Windows',
            detail: 'Versão do programa: ' + app.getVersion() + '\nO sistema por dentro se atualiza sozinho.', buttons: ['Fechar'] }) }
      ]
    }
  ]));
}

/* o site pergunta por window.B7Desktop (preload.js) */
ipcMain.handle('b7:versao', () => app.getVersion());
ipcMain.handle('b7:pasta', () => { shell.openPath(app.getPath('downloads')); return true; });
ipcMain.handle('b7:atualizar', () => conferir(true));
ipcMain.handle('b7:estado-atualizacao', () => estadoAtualizacao);
ipcMain.handle('b7:instalar', () => instalarAgora());

/* ------------------------------------------------------- arranque */
app.setAppUserModelId('br.com.branding7.sistemab7');
app.on('second-instance', () => {
  if (!janela) return;
  if (janela.isMinimized()) janela.restore();
  janela.focus();
});
app.whenReady().then(() => {
  ligarSessao();
  montarMenu();
  criarJanela();
  ligarAtualizacao();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) criarJanela(); });
});
app.on('window-all-closed', () => app.quit());
