import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import log from 'electron-log';
import { registerIpcHandlers, persistSessionsSnapshotSync } from './ipc-handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates the main application window.
 *
 * @returns {BrowserWindow}
 */
function createWindow() {
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'CPE Log Analyser',
    backgroundColor: '#1C1C1E',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  return window;
}

app.whenReady().then(() => {
  log.initialize();
  log.info('App ready');

  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  try {
    persistSessionsSnapshotSync();
  } catch (error) {
    log.error('Unable to persist sessions snapshot on quit', error);
  }
});
