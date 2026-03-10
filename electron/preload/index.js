import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../../src/shared/ipc-channels.js';

/**
 * Invokes an IPC method with timeout protection.
 *
 * @param {string} channel
 * @param {Array<any>} args
 * @param {number} [timeoutMs=120000]
 * @returns {Promise<any>}
 */
function invokeWithTimeout(channel, args = [], timeoutMs = 120000) {
  const timeoutPromise = new Promise((_, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      reject(new Error(`IPC timeout on ${channel}`));
    }, timeoutMs);
  });

  return Promise.race([ipcRenderer.invoke(channel, ...args), timeoutPromise]);
}

contextBridge.exposeInMainWorld('electronAPI', {
  ingestFromPaths: (paths, sessionId, timeoutMs) =>
    invokeWithTimeout(IPC.INGEST_FROM_PATHS, [{ paths, sessionId }], timeoutMs),
  readLogFile: (componentId, timeoutMs) => invokeWithTimeout(IPC.READ_LOG_FILE, [componentId], timeoutMs),
  readLogFileChunk: (componentId, offset, length, timeoutMs) =>
    invokeWithTimeout(IPC.READ_LOG_CHUNK, [componentId, offset, length], timeoutMs),
  searchLogFile: (componentId, query, options, timeoutMs) =>
    invokeWithTimeout(IPC.SEARCH_LOG_FILE, [componentId, query, options], timeoutMs),
  parseTelemetry: (componentId, timeoutMs) =>
    invokeWithTimeout(IPC.PARSE_TELEMETRY, [componentId], timeoutMs),
  getTelemetryReport: (componentId, reportIndex, timeoutMs) =>
    invokeWithTimeout(IPC.GET_TELEMETRY_REPORT, [componentId, reportIndex], timeoutMs),
  getTelemetryTable: (componentId, timeoutMs) =>
    invokeWithTimeout(IPC.GET_TELEMETRY_TABLE, [componentId], timeoutMs),
  exportCsv: (payload, filename, timeoutMs) =>
    invokeWithTimeout(IPC.EXPORT_CSV, [payload, filename], timeoutMs),
  exportMergedLogs: (timeoutMs) =>
    invokeWithTimeout(IPC.EXPORT_MERGED_LOGS, [], timeoutMs),
  openFolderDialog: (timeoutMs) => invokeWithTimeout(IPC.OPEN_FOLDER, [], timeoutMs),
  openFileDialog: (timeoutMs) => invokeWithTimeout(IPC.OPEN_FILE, [], timeoutMs),
  setActiveSession: (sessionId, timeoutMs) =>
    invokeWithTimeout(IPC.SET_ACTIVE_SESSION, [sessionId], timeoutMs),
  saveSessions: (sessionsData, timeoutMs) =>
    invokeWithTimeout(IPC.SESSIONS_SAVE, [sessionsData], timeoutMs),
  loadSessions: (timeoutMs) =>
    invokeWithTimeout(IPC.SESSIONS_LOAD, [], timeoutMs),
  syncSessionsState: (sessionsData, timeoutMs) =>
    invokeWithTimeout(IPC.SESSIONS_SYNC, [sessionsData], timeoutMs),
  deleteSessionDir: (sessionId, timeoutMs) =>
    invokeWithTimeout(IPC.SESSIONS_DELETE_DIR, [sessionId], timeoutMs),
  onIngestionProgress: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on(IPC.INGESTION_PROGRESS, wrapped);
    return () => ipcRenderer.off(IPC.INGESTION_PROGRESS, wrapped);
  },
  onIngestionComplete: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on(IPC.INGESTION_COMPLETE, wrapped);
    return () => ipcRenderer.off(IPC.INGESTION_COMPLETE, wrapped);
  },
  onIngestionError: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on(IPC.INGESTION_ERROR, wrapped);
    return () => ipcRenderer.off(IPC.INGESTION_ERROR, wrapped);
  },
});
