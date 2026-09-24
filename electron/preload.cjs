const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getSources: () => ipcRenderer.invoke('get-screen-sources'),
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  hideWindow: () => ipcRenderer.send('hide-window'),
  toggleWindow: () => ipcRenderer.send('toggle-window'),
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', { width, height }),
  startNativeSpeech: () => ipcRenderer.send('start-native-speech'),
  stopNativeSpeech: () => ipcRenderer.send('stop-native-speech'),
  onNativeSpeech: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('native-speech-event', handler);
    return () => ipcRenderer.removeListener('native-speech-event', handler);
  }
});
