/* =====================================================================
   WHATSAPP DENTRO DO PROGRAMA (zzz170)

   O WhatsApp Web oficial (web.whatsapp.com) numa "camada" encaixada na
   janela do B7, exatamente no espaço que a tela #/whatsapp do sistema
   reserva para ele (js/whatsapp.js manda o retângulo). Para quem usa,
   é uma tela do sistema; por dentro, são dois sites separados:
     • sessão própria ("persist:whatsapp"): o login do WhatsApp (QR Code)
       fica guardado só aqui — o sistema não lê as conversas;
     • ao sair da tela, a camada só some da vista: continua ligada, as
       mensagens chegam com aviso do Windows e o número de não lidas
       vai para o menu do sistema.

   preload-whatsapp.js roda dentro do WhatsApp Web e faz duas coisas:
     • a ASSINATURA: põe "*Nome:*" na primeira linha de cada mensagem
       quando a pessoa aperta Enter/enviar;
     • o "Enviar no WhatsApp" do sistema: entra no grupo do cliente,
       abre o anexo como documento e escreve a mensagem. O arquivo em si
       é posto pelo programa (protocolo de depuração do Chromium →
       DOM.setFileInputFiles), sem passar pela memória da página — vídeo
       grande não pesa. NADA é enviado sozinho: quem aperta enviar é a
       pessoa.
   ===================================================================== */
const { WebContentsView, session, shell, ipcMain, dialog, clipboard, app, Notification } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const URL_WA = 'https://web.whatsapp.com/';
const PARTICAO = 'persist:whatsapp';

module.exports = function ligarWhatsApp(pegarJanela) {
  let view = null, presa = false, visivel = false, naoLidas = 0;
  let respostas = new Map(), seq = 0;

  /* -------------------------------------------------------- ajustes */
  const arquivoCfg = () => path.join(app.getPath('userData'), 'whatsapp.json');
  let cfg = { nome: '', assinatura: true, usado: false };
  try { cfg = Object.assign(cfg, JSON.parse(fs.readFileSync(arquivoCfg(), 'utf8'))); } catch (e) {}
  const gravarCfg = () => { try { fs.writeFileSync(arquivoCfg(), JSON.stringify(cfg)); } catch (e) {} };
  const mandarCfg = () => { if (view) view.webContents.send('b7wa:config', { nome: cfg.nome, assinatura: cfg.assinatura }); };

  function avisarSite(canal, dado) {
    const j = pegarJanela();
    if (j && !j.isDestroyed()) j.webContents.send(canal, dado);
  }

  /* ------------------------------------------------------ a camada */
  function criar() {
    if (view) return view;
    const ses = session.fromPartition(PARTICAO);
    /* o WhatsApp só abre em navegador que ele conhece: se apresenta como o Chrome */
    ses.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' +
      process.versions.chrome + ' Safari/537.36');
    const doWa = u => { try { return /(^|\.)whatsapp\.(com|net)$/.test(new URL(u).hostname); } catch (e) { return false; } };
    ses.setPermissionRequestHandler((wc, perm, responder, det) =>
      responder(doWa((det && det.requestingUrl) || wc.getURL()) && ['notifications', 'media', 'clipboard-sanitized-write', 'clipboard-read', 'fullscreen'].includes(perm)));
    ses.setPermissionCheckHandler((wc, perm, origem) => doWa(origem || (wc && wc.getURL()) || '') &&
      ['notifications', 'media', 'clipboard-sanitized-write', 'clipboard-read'].includes(perm));
    /* arquivo baixado no WhatsApp: pasta Downloads, como no resto do programa */
    ses.on('will-download', (ev, item) => {
      try { item.setSavePath(path.join(app.getPath('downloads'), item.getFilename())); } catch (e) {}
      item.once('done', (e, estado) => {
        if (estado !== 'completed' || !Notification.isSupported()) return;
        const n = new Notification({ title: 'Sistema B7', body: 'Baixado do WhatsApp: ' + path.basename(item.getSavePath()) });
        n.on('click', () => shell.showItemInFolder(item.getSavePath())); n.show();
      });
    });

    view = new WebContentsView({
      webPreferences: {
        partition: PARTICAO,
        preload: path.join(__dirname, 'preload-whatsapp.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: true,
        spellcheck: true, backgroundThrottling: false
      }
    });
    view.setBackgroundColor('#00000000');
    const wc = view.webContents;
    /* zzz186: o WhatsApp Web pede "tem certeza que quer sair?" ao fechar —
       isso segurava o programa aberto e o instalador da atualização dizia
       "Não é possível fechar o Sistema B7". Fechar é sempre permitido. */
    wc.on('will-prevent-unload', ev => ev.preventDefault());
    wc.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
    wc.on('will-navigate', (ev, url) => { if (!doWa(url)) { ev.preventDefault(); shell.openExternal(url); } });
    /* "(3) WhatsApp" no título = 3 conversas não lidas */
    wc.on('page-title-updated', (ev, titulo) => {
      const m = /^\((\d+)\)/.exec(titulo || '');
      const n = m ? +m[1] : 0;
      if (n !== naoLidas) { naoLidas = n; avisarSite('b7:wa:naolidas', n); }
    });
    wc.on('did-finish-load', () => { mandarCfg(); if (cfg.zoom) wc.setZoomFactor(cfg.zoom); });
    /* zzz176: um acabamento leve por cima do WhatsApp — barras de rolagem
       finas e transições suaves; nada que mude como ele funciona */
    wc.on('dom-ready', () => {
      wc.insertCSS(`
        ::-webkit-scrollbar{width:7px;height:7px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(134,150,160,.32);border-radius:8px;}
        ::-webkit-scrollbar-thumb:hover{background:rgba(134,150,160,.55);}
        #pane-side [role="listitem"], #pane-side [role="row"]{transition:background-color .15s ease;}
      `).catch(() => {});
    });
    wc.on('render-process-gone', () => { setTimeout(() => { if (view) wc.reload(); }, 1500); });
    wc.loadURL(URL_WA);
    if (!cfg.usado) { cfg.usado = true; gravarCfg(); }
    return view;
  }

  function prender() {
    const j = pegarJanela();
    if (!j || j.isDestroyed() || !view) return;
    if (!presa) { j.contentView.addChildView(view); presa = true; }
  }

  function mostrar(r) {
    const j = pegarJanela();
    if (!j || j.isDestroyed() || !r) return;
    criar(); prender();
    const z = j.webContents.getZoomFactor() || 1;
    view.setBounds({ x: Math.round(r.x * z), y: Math.round(r.y * z), width: Math.round(r.width * z), height: Math.round(r.height * z) });
    /* zzz176: cantos arredondados, iguais aos cartões do sistema */
    if (view.setBorderRadius) { try { view.setBorderRadius(Math.round((r.raio || 16) * z)); } catch (e) {} }
    view.setVisible(true);
    if (!visivel) { visivel = true; view.webContents.focus(); }
  }
  /* zzz173: antes de sumir, tira uma foto — o sistema põe a foto no lugar
     enquanto o menu dele está aberto por cima (sem "buraco" na tela) */
  async function esconder(comFoto) {
    if (!view) return null;
    let foto = null;
    if (comFoto && visivel) {
      try { const img = await view.webContents.capturePage(); if (!img.isEmpty()) foto = 'data:image/jpeg;base64,' + img.toJPEG(82).toString('base64'); } catch (e) {}
    }
    visivel = false;
    view.setVisible(false);
    const j = pegarJanela();
    if (j && !j.isDestroyed()) j.webContents.focus();
    return foto;
  }

  /* ------------------------------------- conversa com o preload */
  function pedir(acao, dados, ms) {
    return new Promise(res => {
      const id = ++seq;
      respostas.set(id, res);
      view.webContents.send('b7wa:fazer', { id, acao, dados: dados || {} });
      setTimeout(() => { if (respostas.has(id)) { respostas.delete(id); res({ ok: false, motivo: 'O WhatsApp demorou para responder.' }); } }, ms || 15000);
    });
  }
  ipcMain.on('b7wa:resposta', (ev, r) => {
    const f = r && respostas.get(r.id);
    if (f) { respostas.delete(r.id); f(r); }
  });
  ipcMain.handle('b7wa:config', () => ({ nome: cfg.nome, assinatura: cfg.assinatura }));
  /* zzz176: o que o preload LÊ do WhatsApp vai para o sistema */
  let ultimaLista = [], ultimaConversa = null;
  ipcMain.on('b7wa:conversas', (ev, l) => { if (Array.isArray(l)) { ultimaLista = l; avisarSite('b7:wa:conversas', l); } });
  ipcMain.on('b7wa:conversa', (ev, c) => { ultimaConversa = c || null; avisarSite('b7:wa:conversa', ultimaConversa); });
  ipcMain.handle('b7:wa:estado-leitura', () => ({ lista: ultimaLista, conversa: ultimaConversa }));
  ipcMain.handle('b7:wa:escanear', async () => {
    if (!view) return { ok: false, motivo: 'Abra o WhatsApp primeiro.' };
    const p = await pedir('esperarPronto', {}, 20000);
    if (!p.ok) return p;
    return pedir('escanear', {}, 120000);
  });
  ipcMain.handle('b7:wa:abrir-grupo', async (ev, nome) => {
    if (!view) return { ok: false };
    const p = await pedir('esperarPronto', {}, 20000);
    if (!p.ok) return p;
    const r = await pedir('abrirGrupo', { nome });
    if (r.ok) view.webContents.focus();
    return r;
  });
  /* clicou num aviso de mensagem: traz o programa e vai para a tela do WhatsApp */
  ipcMain.on('b7wa:clique', () => {
    const j = pegarJanela();
    if (!j || j.isDestroyed()) return;
    if (j.isMinimized()) j.restore();
    j.show(); j.focus();
    avisarSite('b7:wa:ir', true);
  });

  /* põe o arquivo no campo de anexo marcado pelo preload (data-b7-alvo) */
  async function porArquivo(caminho) {
    const files = Array.isArray(caminho) ? caminho : [caminho];
    const dbg = view.webContents.debugger;
    let presoAqui = false;
    try {
      if (!dbg.isAttached()) { dbg.attach('1.3'); presoAqui = true; }
      const doc = await dbg.sendCommand('DOM.getDocument', { depth: 0 });
      const q = await dbg.sendCommand('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[data-b7-alvo]' });
      if (!q || !q.nodeId) return false;
      await dbg.sendCommand('DOM.setFileInputFiles', { nodeId: q.nodeId, files });
      return true;
    } catch (e) {
      return false;
    } finally {
      if (presoAqui) { try { dbg.detach(); } catch (e) {} }
    }
  }

  async function soltarArquivos(caminho) {
    const files = Array.isArray(caminho) ? caminho : [caminho];
    const dbg = view.webContents.debugger;
    let presoAqui = false;
    try {
      const r = await view.webContents.executeJavaScript(
        '(()=>{const m=document.querySelector("#main");if(!m)return null;const b=m.getBoundingClientRect();return {x:Math.round(b.left+b.width/2),y:Math.round(b.top+b.height/2)}})()');
      if (!r) return false;
      const z = view.webContents.getZoomFactor() || 1;
      r.x = Math.round(r.x * z); r.y = Math.round(r.y * z);
      if (!dbg.isAttached()) { dbg.attach('1.3'); presoAqui = true; }
      const data = { items: [], files, dragOperationsMask: 1 };
      for (const type of ['dragEnter', 'dragOver', 'drop']) {
        await dbg.sendCommand('Input.dispatchDragEvent', { type, x: r.x, y: r.y, data });
        await new Promise(ok => setTimeout(ok, 120));
      }
      return true;
    } catch (e) {
      return false;
    } finally {
      if (presoAqui) { try { dbg.detach(); } catch (e) {} }
    }
  }

  /* ------------------------------------------- pedidos do sistema */
  ipcMain.handle('b7:wa:mostrar', (ev, r) => { mostrar(r); return true; });
  ipcMain.handle('b7:wa:esconder', (ev, comFoto) => esconder(!!comFoto));
  /* zzz175: só a foto, sem esconder — o sistema põe a foto no lugar e
     DEPOIS pede para esconder (assim não pisca) */
  ipcMain.handle('b7:wa:foto', async () => {
    if (!view || !visivel) return null;
    try { const img = await view.webContents.capturePage(); return img.isEmpty() ? null : 'data:image/jpeg;base64,' + img.toJPEG(82).toString('base64'); }
    catch (e) { return null; }
  });
  /* tamanho da letra do WhatsApp (guardado) */
  ipcMain.handle('b7:wa:zoom', (ev, passo) => {
    cfg.zoom = Math.max(0.7, Math.min(1.5, Math.round(((cfg.zoom || 1) + (passo > 0 ? 0.1 : -0.1)) * 10) / 10));
    gravarCfg();
    if (view) view.webContents.setZoomFactor(cfg.zoom);
    return cfg.zoom;
  });
  /* desconectar: apaga o login do WhatsApp só deste programa */
  ipcMain.handle('b7:wa:desconectar', async () => {
    try { await session.fromPartition(PARTICAO).clearStorageData(); } catch (e) {}
    if (view) view.webContents.loadURL(URL_WA);
    return true;
  });
  ipcMain.handle('b7:wa:recarregar', () => { if (view) view.webContents.reload(); return true; });
  ipcMain.handle('b7:wa:config', () => ({ nome: cfg.nome, assinatura: cfg.assinatura }));
  ipcMain.handle('b7:wa:definir-config', (ev, c) => {
    if (c && typeof c.nome === 'string') cfg.nome = c.nome.slice(0, 40);
    if (c && typeof c.assinatura === 'boolean') cfg.assinatura = c.assinatura;
    gravarCfg(); mandarCfg();
    return true;
  });
  /* zzz186: arte → imagens e vários de uma vez (a mesma arte em
     proporções diferentes); vídeo continua um só */
  ipcMain.handle('b7:wa:escolher-arquivo', async (ev, o) => {
    const j = pegarJanela();
    const arte = o && o.tipo === 'design';
    const r = await dialog.showOpenDialog(j, {
      title: arte ? 'Escolha as artes para mandar ao cliente' : 'Escolha o vídeo para mandar ao cliente',
      properties: arte ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: arte
        ? [{ name: 'Imagens e PDF', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf', 'mp4', 'mov'] }, { name: 'Todos os arquivos', extensions: ['*'] }]
        : [{ name: 'Vídeos', extensions: ['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm', 'wmv'] }, { name: 'Todos os arquivos', extensions: ['*'] }]
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const arquivos = r.filePaths.map(caminho => {
      let tamanho = 0; try { tamanho = fs.statSync(caminho).size; } catch (e) {}
      return { caminho, nome: path.basename(caminho), tamanho };
    });
    return Object.assign({ arquivos }, arquivos[0]);
  });
  /* {grupo, texto, caminho, documento} → abre o grupo, anexa e escreve.
     Se alguma etapa falhar, a mensagem fica na área de transferência. */
  ipcMain.handle('b7:wa:enviar', async (ev, d) => {
    d = d || {};
    criar(); prender();
    const falhou = motivo => { if (d.texto) clipboard.writeText(d.texto); return { ok: false, motivo }; };
    try {
      const pronto = await pedir('esperarPronto', {}, 45000);
      if (!pronto.ok) return falhou(pronto.motivo || 'O WhatsApp ainda não está conectado (leia o QR Code).');
      const g = await pedir('abrirGrupo', { nome: d.grupo });
      if (!g.ok) return falhou(g.motivo || 'Não achei o grupo "' + d.grupo + '".');
      /* zzz185: arquivos do próprio B7 (peças de design): baixa para uma
         pasta temporária e anexa todos de uma vez */
      if (Array.isArray(d.urls) && d.urls.length) {
        const pasta = path.join(app.getPath('temp'), 'b7-whatsapp', String(Date.now()));
        fs.mkdirSync(pasta, { recursive: true });
        const locais = [];
        for (const [i, u] of d.urls.slice(0, 30).entries()) {
          if (!/^https:\/\//.test(String(u && u.url))) continue;
          const resp = await fetch(u.url).catch(() => null);
          if (!resp || !resp.ok) return falhou('Não consegui baixar "' + (u.nome || 'arquivo') + '".');
          const nome = String(u.nome || ('arquivo-' + (i + 1))).replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
          const destino = path.join(pasta, (d.urls.length > 1 ? String(i + 1).padStart(2, '0') + '-' : '') + nome);
          fs.writeFileSync(destino, Buffer.from(await resp.arrayBuffer()));
          locais.push(destino);
        }
        if (locais.length) d.caminho = locais.concat(Array.isArray(d.caminho) ? d.caminho : d.caminho ? [d.caminho] : []);
      }
      if (d.caminho) {
        /* zzz192: foto/arte vai ARRASTADA para a conversa (como a pessoa
           faria com o mouse) — o WhatsApp abre o editor de fotos com todas,
           na proporção certa. Escolher o campo de arquivo caía às vezes no
           de figurinha (quadrado, esticado). Documento continua pelo clipe. */
        let soltou = d.documento === false && await soltarArquivos(d.caminho);
        /* o editor de fotos abriu? (aparece o campo de legenda) — se não,
           volta para o caminho do clipe */
        if (soltou) soltou = (await pedir('legenda', { texto: '', espera: 6000 }, 9000)).ok;
        if (!soltou) {
          const a = await pedir('prepararAnexo', { documento: d.documento !== false });
          if (!a.ok) return falhou(a.motivo || 'Não consegui abrir o anexo.');
          if (!(await porArquivo(d.caminho))) return falhou('Não consegui anexar o arquivo.');
        }
        const l = await pedir('legenda', { texto: d.texto || '' }, 30000);
        if (!l.ok) return falhou(l.motivo || 'O arquivo foi anexado, mas não consegui escrever a mensagem.');
      } else if (d.texto) {
        const e = await pedir('escrever', { texto: d.texto });
        if (!e.ok) return falhou(e.motivo || 'Não consegui escrever a mensagem.');
      }
      view.webContents.focus();
      return { ok: true };
    } catch (e) {
      return falhou('O WhatsApp não respondeu.');
    }
  });

  /* quem já usou o WhatsApp no programa: liga junto com ele, para os
     avisos de mensagem chegarem mesmo sem abrir a tela */
  return {
    aoAbrirJanela() { if (cfg.usado) { criar(); prender(); view.setVisible(false); } },
    aoFecharJanela() { presa = false; visivel = false; },
    /* antes de instalar atualização: fecha o WhatsApp de vez */
    encerrar() {
      try { if (view && !view.webContents.isDestroyed()) view.webContents.close({ waitForBeforeUnload: false }); } catch (e) {}
      view = null; presa = false; visivel = false;
    }
  };
};
