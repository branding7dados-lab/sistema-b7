/* Ponte mínima entre o programa e o site (contextIsolation ligado).
   O sistema não precisa dela para funcionar; serve para as telas
   saberem que estão no app de Windows e para "Procurar atualização". */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('B7Desktop', {
  ativo: true,
  versao: () => ipcRenderer.invoke('b7:versao'),
  procurarAtualizacao: () => ipcRenderer.invoke('b7:atualizar')
});
