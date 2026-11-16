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
  /* zzz273: Entrar com Google pelo navegador do computador (a volta chega no programa) */
  oauth: url => ipcRenderer.invoke('b7:oauth', url),
  /* zzz298: Tela do PC no "Acompanhar ao vivo" (uma foto da tela + a pílula "Tela compartilhada") */
  tela: {
    quadro: largura => ipcRenderer.invoke('b7:tela:quadro', largura),
    aviso: ligado => ipcRenderer.invoke('b7:tela:aviso', !!ligado)
  }
});
