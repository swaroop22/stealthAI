const { app, BrowserWindow, session, desktopCapturer, ipcMain, shell, globalShortcut } = require('electron');
const path = require('path');

// Pass Google API Key if provided via environment
if (process.env.GOOGLE_API_KEY) {
  app.commandLine.appendSwitch('google-api-key', process.env.GOOGLE_API_KEY);
}
app.commandLine.appendSwitch('enable-speech-dispatcher');

const isDev = !app.isPackaged || process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 860,
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
const fs = require('fs');

let speechProcess = null;

function stopSpeechProcess() {
  if (speechProcess) {
    try {
      speechProcess.stdin.write('stop\n');
    } catch (e) {}
    try {
      speechProcess.kill('SIGTERM');
    } catch (e) {}
    speechProcess = null;
  }
}

ipcMain.on('start-native-speech', (event) => {
  stopSpeechProcess();

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

    speechProcess.on('exit', (code) => {
      speechProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('native-speech-event', { type: 'stopped', code });
      }
    });
  } catch (err) {
    console.error('Failed to spawn speech helper:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('native-speech-event', { type: 'error', message: err.message });
    }
  }
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  try {
    globalShortcut.unregisterAll();
  } catch (e) {}
  stopSpeechProcess();
});

app.on('before-quit', () => {
  stopSpeechProcess();
});
