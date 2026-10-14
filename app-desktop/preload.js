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
  instalarAtualizacao: () => ipcRenderer.invoke('b7:instalar')
});
