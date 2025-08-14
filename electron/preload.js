const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),
  fileToDataURL: (p) => ipcRenderer.invoke('file-to-data-url', p), 
});
