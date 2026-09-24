const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getSources: () => ipcRenderer.invoke('get-screen-sources'),
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', { width, height })
});
