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
  getStoredConfig: () => ipcRenderer.invoke('get-stored-config'),
  saveStoredConfig: (config) => ipcRenderer.send('save-stored-config', config),
  startSessionRecording: (data) => ipcRenderer.invoke('start-session-recording', data || {}),
  appendRecordingChunk: (buffer) => ipcRenderer.send('append-recording-chunk', buffer),
  finishSessionRecording: () => ipcRenderer.invoke('finish-session-recording'),
  openRecordingsFolder: () => ipcRenderer.invoke('open-recordings-folder'),
  getRecordingsFolder: () => ipcRenderer.invoke('get-recordings-folder'),
  onNativeSpeech: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('native-speech-event', handler);
    return () => ipcRenderer.removeListener('native-speech-event', handler);
  }
});
