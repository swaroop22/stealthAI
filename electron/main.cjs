const { app, BrowserWindow, session, desktopCapturer, ipcMain, shell, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// Pass Google API Key if provided via environment
if (process.env.GOOGLE_API_KEY) {
  app.commandLine.appendSwitch('google-api-key', process.env.GOOGLE_API_KEY);
}
app.commandLine.appendSwitch('enable-speech-dispatcher');

const isDev = !app.isPackaged || process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 520,
    minWidth: 500,
    minHeight: 80,
    title: 'StealthAI',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  // Keep window floating on top of all windows & full-screen apps
  mainWindow.setAlwaysOnTop(true, 'floating', 1);
  if (mainWindow.setVisibleOnAllWorkspaces) {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  // 1. Content Protection (Screen Share Invisibility):
  // Makes this window 100% invisible to screen sharing (Zoom, Google Meet, Microsoft Teams, Discord, etc.)
  // and screen recording software. Only the user looking at the physical screen can see it.
  mainWindow.setContentProtection(true);

  // Display capture handler for navigator.mediaDevices.getDisplayMedia
  if (session.defaultSession.setDisplayMediaRequestHandler) {
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen', 'window'] })
        .then((sources) => {
          if (sources.length > 0) {
            callback({ video: sources[0] });
          } else {
            callback({});
          }
        })
        .catch((err) => {
          console.error('DisplayMedia handler error:', err);
          callback({});
        });
    });
  }

  // Grant permissions for audio and screen recording
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'display-capture', 'notifications', 'audioCapture', 'screen'];
    if (allowedPermissions.includes(permission)) {
      return callback(true);
    }
    callback(false);
  });

  if (session.defaultSession.setPermissionCheckHandler) {
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      const allowedPermissions = ['media', 'display-capture', 'notifications', 'audioCapture', 'screen'];
      return allowedPermissions.includes(permission);
    });
  }

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    if (process.platform === 'darwin') {
      app.focus({ steal: true });
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    stopSpeechProcess();
    finalizeActiveRecording();
    mainWindow = null;
  });
}

// IPC handlers for window control
ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('hide-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
    if (process.platform === 'darwin' && app.dock) app.dock.hide();
  }
});

ipcMain.on('toggle-window', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
    if (process.platform === 'darwin' && app.dock) app.dock.hide();
  } else {
    if (process.platform === 'darwin' && app.dock) app.dock.show();
    mainWindow.show();
    mainWindow.focus();
    if (process.platform === 'darwin') app.focus({ steal: true });
  }
});

ipcMain.on('resize-window', (e, { width, height }) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSize(width, height);
  }
});

function getDiskConfigPath() {
  try {
    return path.join(app.getPath('userData'), 'stealthai_config.json');
  } catch (e) {
    return path.join(__dirname, '../.stealthai_config.json');
  }
}

function readPersistentConfig() {
  const rootConfigPath = path.join(__dirname, '../.stealthai_config.json');
  if (fs.existsSync(rootConfigPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(rootConfigPath, 'utf8'));
      if (data && data.apiKey) return data;
    } catch (e) {}
  }
  const userPath = getDiskConfigPath();
  if (fs.existsSync(userPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(userPath, 'utf8'));
      if (data && data.apiKey) return data;
    } catch (e) {}
  }
  return null;
}

function writePersistentConfig(config) {
  if (!config) return;
  try {
    const userPath = getDiskConfigPath();
    fs.writeFileSync(userPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {}
  try {
    const rootPath = path.join(__dirname, '../.stealthai_config.json');
    fs.writeFileSync(rootPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {}
}

ipcMain.handle('get-stored-config', () => {
  return readPersistentConfig();
});

ipcMain.on('save-stored-config', (_event, config) => {
  writePersistentConfig(config);
});

// SESSION AUDIO RECORDING TO COMPUTER (Documents/StealthAI_Recordings)
function getRecordingsDirectory() {
  let docPath;
  try {
    docPath = app.getPath('documents');
  } catch (e) {
    docPath = app.getPath('userData');
  }
  const recDir = path.join(docPath, 'StealthAI_Recordings');
  if (!fs.existsSync(recDir)) {
    try {
      fs.mkdirSync(recDir, { recursive: true });
    } catch (err) {
      console.warn('Failed to create recordings directory:', err);
    }
  }
  return recDir;
}

let activeRecordingFilePath = null;
let activeRecordingFileStream = null;

function finalizeActiveRecording() {
  if (activeRecordingFileStream) {
    try {
      activeRecordingFileStream.end();
    } catch (e) {}
    activeRecordingFileStream = null;
    activeRecordingFilePath = null;
  }
}

ipcMain.handle('start-session-recording', (_e, { fileName }) => {
  try {
    finalizeActiveRecording();
    const recDir = getRecordingsDirectory();
    const cleanDate = new Date().toISOString().replace(/[:.]/g, '-');
    const finalName = fileName || `StealthAI_Session_${cleanDate}.webm`;
    activeRecordingFilePath = path.join(recDir, finalName);
    activeRecordingFileStream = fs.createWriteStream(activeRecordingFilePath, { flags: 'w' });
    return { success: true, filePath: activeRecordingFilePath, dir: recDir };
  } catch (err) {
    console.error('Error starting session recording:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.on('append-recording-chunk', (_e, chunkBuffer) => {
  if (activeRecordingFileStream && chunkBuffer) {
    try {
      activeRecordingFileStream.write(Buffer.from(chunkBuffer));
    } catch (err) {
      console.warn('Failed to write recording chunk:', err);
    }
  }
});

ipcMain.handle('finish-session-recording', () => {
  return new Promise((resolve) => {
    if (activeRecordingFileStream) {
      const savedPath = activeRecordingFilePath;
      activeRecordingFileStream.end(() => {
        activeRecordingFileStream = null;
        activeRecordingFilePath = null;
        resolve({ success: true, filePath: savedPath });
      });
    } else {
      resolve({ success: true, filePath: null });
    }
  });
});

ipcMain.handle('open-recordings-folder', () => {
  const recDir = getRecordingsDirectory();
  shell.openPath(recDir);
  return recDir;
});

ipcMain.handle('get-recordings-folder', () => {
  return getRecordingsDirectory();
});

// IPC handler to list screen/window sources if needed by renderer
ipcMain.handle('get-screen-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 320, height: 180 },
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
    }));
  } catch (err) {
    console.error('Failed to get sources:', err);
    return [];
  }
});

// NATIVE REAL-TIME MACOS SPEECH RECOGNITION (SFSpeechRecognizer)
const { spawn } = require('child_process');
const readline = require('readline');

let speechProcess = null;
let isIntentionalStop = false;

function stopSpeechProcess() {
  if (speechProcess) {
    isIntentionalStop = true;
    try {
      speechProcess.stdin.write('stop\n');
    } catch (e) {}
    try {
      speechProcess.kill('SIGTERM');
    } catch (e) {}
    speechProcess = null;
  }
}

function startSpeechProcess() {
  if (speechProcess && !speechProcess.killed) {
    return;
  }
  isIntentionalStop = false;

  let binPath = null;
  if (app.isPackaged) {
    const packagedCandidates = [
      path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'stealth_speech_helper'),
      path.join(process.resourcesPath, 'electron', 'stealth_speech_helper'),
      path.join(path.dirname(process.execPath), 'stealth_speech_helper'),
      path.join(path.dirname(process.execPath), '..', 'Resources', 'electron', 'stealth_speech_helper')
    ];
    binPath = packagedCandidates.find((p) => fs.existsSync(p));
  } else {
    binPath = path.join(__dirname, 'stealth_speech_helper');
  }

  if (!binPath || !fs.existsSync(binPath)) {
    console.warn('Native speech helper binary not found. BinPath was:', binPath);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('native-speech-event', {
        type: 'error',
        message: 'Speech helper binary not found.'
      });
    }
    return;
  }

  try {
    speechProcess = spawn(binPath, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    speechProcess.on('error', (err) => {
      console.error('Speech process error:', err);
      speechProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('native-speech-event', { type: 'error', message: err.message });
      }
    });

    const rl = readline.createInterface({
      input: speechProcess.stdout,
      terminal: false
    });

    rl.on('line', (line) => {
      try {
        const data = JSON.parse(line.trim());
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('native-speech-event', data);
        }
      } catch (e) {}
    });

    speechProcess.stderr.on('data', (err) => {
      console.warn('Native speech helper stderr:', err.toString());
    });

    speechProcess.on('exit', (code, signal) => {
      speechProcess = null;
      if (!isIntentionalStop) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('native-speech-event', { type: 'stopped', code, signal });
        }
        // Auto-respawn helper after unexpected exit if listening should remain active
        setTimeout(() => {
          if (!isIntentionalStop && !speechProcess && mainWindow && !mainWindow.isDestroyed()) {
            console.log('Auto-respawning native speech helper...');
            startSpeechProcess();
          }
        }, 800);
      }
    });
  } catch (err) {
    console.error('Failed to spawn speech helper:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('native-speech-event', { type: 'error', message: err.message });
    }
  }
}

ipcMain.on('start-native-speech', () => {
  startSpeechProcess();
});

ipcMain.on('stop-native-speech', () => {
  stopSpeechProcess();
});

app.whenReady().then(() => {
  createWindow();

  // Register Global Panic Shortcuts (works system-wide from any app on macOS)
  // Press ⌘ + \ or ⌘ + Shift + H to instantly hide or reveal StealthAI
  try {
    const toggleAppVisibility = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isVisible()) {
        mainWindow.hide();
        if (process.platform === 'darwin' && app.dock) app.dock.hide();
      } else {
        if (process.platform === 'darwin' && app.dock) app.dock.show();
        mainWindow.show();
        mainWindow.focus();
        if (process.platform === 'darwin') app.focus({ steal: true });
      }
    };

    globalShortcut.register('CommandOrControl+\\', toggleAppVisibility);
    globalShortcut.register('CommandOrControl+Shift+H', toggleAppVisibility);
  } catch (err) {
    console.warn('Failed to register global shortcut:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      if (process.platform === 'darwin') app.focus({ steal: true });
    } else {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  try {
    globalShortcut.unregisterAll();
  } catch (e) {}
  stopSpeechProcess();
  finalizeActiveRecording();
});

app.on('before-quit', () => {
  stopSpeechProcess();
  finalizeActiveRecording();
});
