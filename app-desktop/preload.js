/* Ponte mínima entre o programa e o site (contextIsolation ligado).
   O sistema não precisa dela para funcionar; serve para as telas
   saberem que estão no app de Windows e para "Procurar atualização". */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('B7Desktop', {
  ativo: true,
  versao: () => ipcRenderer.invoke('b7:versao'),
  procurarAtualizacao: () => ipcRenderer.invoke('b7:atualizar'),
  abrirPasta: () => ipcRenderer.invoke('b7:pasta'),
  /* zzz169: estado da atualização do programa ({estado:'nada'|'baixando'|'pronta', versao, pct}) */
  estadoAtualizacao: () => ipcRenderer.invoke('b7:estado-atualizacao'),
  aoAtualizacao: cb => { ipcRenderer.on('b7:atualizacao', (ev, e) => { try { cb(e); } catch (x) {} }); },
  instalarAtualizacao: () => ipcRenderer.invoke('b7:instalar'),
  /* zzz170: WhatsApp encaixado na tela #/whatsapp (app-desktop/whatsapp.js) */
  wa: {
    mostrar: r => ipcRenderer.invoke('b7:wa:mostrar', r),
    esconder: comFoto => ipcRenderer.invoke('b7:wa:esconder', !!comFoto),
    zoom: passo => ipcRenderer.invoke('b7:wa:zoom', passo),
    desconectar: () => ipcRenderer.invoke('b7:wa:desconectar'),
    recarregar: () => ipcRenderer.invoke('b7:wa:recarregar'),
    config: () => ipcRenderer.invoke('b7:wa:config'),
    definirConfig: c => ipcRenderer.invoke('b7:wa:definir-config', c),
    escolherArquivo: o => ipcRenderer.invoke('b7:wa:escolher-arquivo', o),
    enviar: d => ipcRenderer.invoke('b7:wa:enviar', d),
    aoNaoLidas: cb => { ipcRenderer.on('b7:wa:naolidas', (ev, n) => { try { cb(n); } catch (x) {} }); },
    aoIr: cb => { ipcRenderer.on('b7:wa:ir', () => { try { cb(); } catch (x) {} }); }
  }
});
