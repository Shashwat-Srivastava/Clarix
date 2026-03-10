import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { app, ipcMain, dialog } from 'electron';
import log from 'electron-log';
import { IPC } from '../../src/shared/ipc-channels.js';
import {
  collectArchivePaths,
  extractArchive,
  sortArchivesChronologically,
} from './ingestion/extract.js';
import { mergeAllComponents } from './ingestion/merge.js';
import {
  prepareSessionWorkspace,
  cleanupExtractedDir,
  getActiveSession,
  setActiveSession,
  updateSession,
  setTelemetryReports,
  findComponent,
  removeSessionWorkspace,
  hydrateSessionRecords,
} from './ingestion/session.js';
import {
  parseTelemetryFileFromPath,
  buildTelemetryManifest,
} from './readers/telemetry-parser.js';
import {
  readLogFile,
  readLogFileChunk,
  searchLogFile,
  clearSessionChunkCache,
} from './readers/log-reader.js';

let activeIngestionController = null;
let currentSessionsState = null;

const execFileAsync = promisify(execFile);

/**
 * Returns sessions.json absolute path.
 *
 * @returns {string}
 */
function getSessionsFilePath() {
  return path.join(app.getPath('userData'), 'sessions.json');
}

/**
 * Converts a string into a stable id.
 *
 * @param {string} value
 * @returns {string}
 */
function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Normalizes persisted sessions snapshot.
 *
 * @param {any} snapshot
 * @returns {{activeSessionId:string|null,sessions:Array<Object>}}
 */
function normalizeSessionsSnapshot(snapshot) {
  const sessions = Array.isArray(snapshot?.sessions)
    ? snapshot.sessions.filter((session) => session && typeof session === 'object')
    : [];

  const activeSessionId =
    typeof snapshot?.activeSessionId === 'string' ? snapshot.activeSessionId : null;

  return {
    activeSessionId,
    sessions,
  };
}

/**
 * Writes session snapshot to disk.
 *
 * @param {{activeSessionId:string|null,sessions:Array<Object>}} snapshot
 * @returns {Promise<void>}
 */
async function writeSessionsSnapshot(snapshot) {
  const filePath = getSessionsFilePath();
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
}

/**
 * Applies snapshot to main-process memory maps.
 *
 * @param {{activeSessionId:string|null,sessions:Array<Object>}} snapshot
 */
function applySessionsSnapshot(snapshot) {
  const normalized = normalizeSessionsSnapshot(snapshot);
  currentSessionsState = normalized;

  hydrateSessionRecords(normalized.sessions);
  if (normalized.activeSessionId) {
    setActiveSession(normalized.activeSessionId);
  }
}

/**
 * Updates one session entry inside currentSessionsState.
 *
 * @param {string} sessionId
 * @param {Object} patch
 */
function patchCurrentSessionState(sessionId, patch) {
  if (!sessionId || !patch || typeof patch !== 'object') {
    return;
  }

  const base = normalizeSessionsSnapshot(currentSessionsState ?? { sessions: [], activeSessionId: sessionId });
  const sessions = [...base.sessions];
  const index = sessions.findIndex((session) => session.id === sessionId);

  if (index === -1) {
    sessions.push({ id: sessionId, ...patch });
  } else {
    sessions[index] = {
      ...sessions[index],
      ...patch,
    };
  }

  applySessionsSnapshot({
    activeSessionId: base.activeSessionId ?? sessionId,
    sessions,
  });
}

/**
 * Builds component manifest entries from merged output files.
 *
 * @param {string} mergedRoot
 * @returns {Promise<Array>}
 */
async function buildComponentManifest(mergedRoot) {
  const entries = await fsp.readdir(mergedRoot, { withFileTypes: true });
  const components = [];
  const seen = new Set();

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const mergedFilePath = path.join(mergedRoot, entry.name);
    const stats = await fsp.stat(mergedFilePath);

    let id = slugify(entry.name.replace(/\.[^.]+$/, ''));
    if (!id) {
      id = slugify(entry.name);
    }

    while (seen.has(id)) {
      id = `${id}-dup`;
    }

    seen.add(id);

    components.push({
      id,
      name: entry.name,
      mergedFilePath,
      sizeBytes: stats.size,
      hasTelemetry: entry.name === 'telemetry2_0.txt',
    });
  }

  components.sort((a, b) => a.name.localeCompare(b.name));
  return components;
}

/**
 * Emits ingestion progress events to renderer.
 *
 * @param {import('electron').WebContents} webContents
 * @param {{stage:string,current:number,total:number,detail?:string,sessionId?:string}} payload
 */
function sendProgress(webContents, payload) {
  webContents.send(IPC.INGESTION_PROGRESS, payload);
}

/**
 * Ensures telemetry reports are loaded for a session.
 *
 * @param {Object} session
 * @returns {Promise<Array>}
 */
async function ensureTelemetryReportsLoaded(session) {
  if (!session || !session.telemetryComponentId) {
    return [];
  }

  if (Array.isArray(session.telemetryReports) && session.telemetryReports.length) {
    return session.telemetryReports;
  }

  const telemetryComponent = session.components?.find(
    (component) => component.id === session.telemetryComponentId || component.hasTelemetry,
  );

  if (!telemetryComponent?.mergedFilePath) {
    return [];
  }

  try {
    const reports = await parseTelemetryFileFromPath(telemetryComponent.mergedFilePath);
    setTelemetryReports(session.id, reports);
    return reports;
  } catch (error) {
    log.warn('Unable to parse telemetry for session', {
      sessionId: session.id,
      telemetryComponentId: session.telemetryComponentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Converts rows to CSV text.
 *
 * @param {Array<Object>} rows
 * @param {string[]} [preferredColumns]
 * @returns {string}
 */
function toCsv(rows, preferredColumns) {
  if (!rows.length) {
    return '';
  }

  const columns = preferredColumns?.length
    ? preferredColumns
    : [...new Set(rows.flatMap((row) => Object.keys(row)))];

  const escapeCell = (value) => {
    const cell = value == null ? '' : String(value);
    if (!/[",\n]/.test(cell)) {
      return cell;
    }
    return `"${cell.replaceAll('"', '""')}"`;
  };

  const header = columns.map(escapeCell).join(',');
  const body = rows
    .map((row) => columns.map((column) => escapeCell(row[column])).join(','))
    .join('\n');

  return `${header}\n${body}`;
}

/**
 * Persists latest known sessions snapshot synchronously.
 */
export function persistSessionsSnapshotSync() {
  const snapshot = normalizeSessionsSnapshot(currentSessionsState);
  const sanitized = {
    ...snapshot,
    sessions: snapshot.sessions.map((session) => ({
      ...session,
      status: session?.status === 'loading' ? 'idle' : session?.status,
    })),
  };

  const filePath = getSessionsFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2), 'utf8');
}

/**
 * Registers all IPC handlers.
 */
export function registerIpcHandlers() {
  ipcMain.handle(IPC.OPEN_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    return result.filePaths;
  });

  ipcMain.handle(IPC.OPEN_FILE, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Archives', extensions: ['tgz', 'tar.gz'] }],
    });

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    return result.filePaths;
  });

  ipcMain.handle(IPC.SESSIONS_LOAD, async () => {
    const filePath = getSessionsFilePath();

    try {
      const raw = await fsp.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const normalized = normalizeSessionsSnapshot(parsed);

      const sanitizedSessions = [];
      for (const session of normalized.sessions) {
        const status = session?.status === 'loading' ? 'idle' : session?.status;
        const components = Array.isArray(session?.components) ? session.components : [];
        let nextSession = {
          ...session,
          status,
          components,
        };

        if (status === 'ready') {
          const exists = await Promise.all(
            components.map((component) =>
              fsp
                .access(component.mergedFilePath)
                .then(() => true)
                .catch(() => false),
            ),
          );

          if (!components.length || exists.some((value) => !value)) {
            nextSession = {
              ...nextSession,
              status: 'idle',
              archiveCount: 0,
              components: [],
              telemetryComponentId: null,
              selectedComponentId: null,
              selectedTelemetryIndex: null,
            };
          }
        }

        sanitizedSessions.push(nextSession);
      }

      const sanitized = {
        ...normalized,
        sessions: sanitizedSessions,
      };

      applySessionsSnapshot(sanitized);
      return sanitized;
    } catch {
      return null;
    }
  });

  ipcMain.handle(IPC.SESSIONS_SYNC, async (_event, sessionsData) => {
    const normalized = normalizeSessionsSnapshot(sessionsData);
    applySessionsSnapshot(normalized);
    return { ok: true };
  });

  ipcMain.handle(IPC.SESSIONS_SAVE, async (_event, sessionsData) => {
    const normalized = normalizeSessionsSnapshot(sessionsData);
    applySessionsSnapshot(normalized);
    await writeSessionsSnapshot(normalized);
    return { ok: true };
  });

  ipcMain.handle(IPC.SESSIONS_DELETE_DIR, async (_event, sessionId) => {
    if (!sessionId || typeof sessionId !== 'string') {
      return { ok: true };
    }

    clearSessionChunkCache(sessionId);
    await removeSessionWorkspace(sessionId);

    const base = normalizeSessionsSnapshot(currentSessionsState);
    applySessionsSnapshot({
      activeSessionId: base.activeSessionId === sessionId ? null : base.activeSessionId,
      sessions: base.sessions.filter((session) => session.id !== sessionId),
    });

    return { ok: true };
  });

  ipcMain.handle(IPC.SET_ACTIVE_SESSION, async (_event, sessionId) => {
    if (typeof sessionId !== 'string' || !sessionId) {
      return { ok: true };
    }

    setActiveSession(sessionId);

    const base = normalizeSessionsSnapshot(currentSessionsState);
    applySessionsSnapshot({
      ...base,
      activeSessionId: sessionId,
    });

    return { ok: true };
  });

  ipcMain.handle(IPC.INGEST_FROM_PATHS, async (event, payload) => {
    const normalizedPayload = Array.isArray(payload)
      ? { paths: payload, sessionId: normalizeSessionsSnapshot(currentSessionsState).activeSessionId }
      : payload ?? {};

    const paths = Array.isArray(normalizedPayload.paths) ? normalizedPayload.paths : [];
    const sessionId = typeof normalizedPayload.sessionId === 'string' ? normalizedPayload.sessionId : null;

    if (!paths.length) {
      throw new Error('No input paths were provided.');
    }

    if (!sessionId) {
      throw new Error('No active session was selected.');
    }

    activeIngestionController?.abort();
    activeIngestionController = new AbortController();
    const { signal } = activeIngestionController;

    clearSessionChunkCache(sessionId);
    setActiveSession(sessionId);

    patchCurrentSessionState(sessionId, {
      status: 'loading',
      errorMessage: null,
      archiveCount: 0,
      components: [],
      telemetryComponentId: null,
      selectedComponentId: null,
      selectedTelemetryIndex: null,
    });

    try {
      const archivePaths = await collectArchivePaths(paths);

      if (!archivePaths.length) {
        const errorPayload = {
          sessionId,
          message: 'No .tgz files found in selected paths.',
          detail: 'Select .tgz files directly or a folder containing .tgz archives.',
        };

        event.sender.send(IPC.INGESTION_ERROR, errorPayload);
        throw new Error(errorPayload.message);
      }

      const session = await prepareSessionWorkspace(sessionId);
      updateSession(sessionId, { archiveCount: archivePaths.length, warnings: [] });

      const extractedArchives = [];
      const warnings = [];

      for (let index = 0; index < archivePaths.length; index += 1) {
        if (signal.aborted) {
          throw new Error('Ingestion cancelled by a newer request.');
        }

        const archivePath = archivePaths[index];
        sendProgress(event.sender, {
          sessionId,
          stage: 'extract',
          current: index + 1,
          total: archivePaths.length,
          detail: `Extracting archive ${index + 1} of ${archivePaths.length}`,
        });

        try {
          const extracted = await extractArchive(archivePath, session.extractedRoot);
          extractedArchives.push(extracted);
        } catch (error) {
          const warning = {
            archivePath,
            message: error instanceof Error ? error.message : 'Unknown extraction error',
          };
          warnings.push(warning);
          log.warn('Skipping unreadable archive', warning);
        }
      }

      if (!extractedArchives.length) {
        const errorPayload = {
          sessionId,
          message: 'All selected archives were unreadable.',
          detail: 'No archives were extracted successfully.',
        };
        event.sender.send(IPC.INGESTION_ERROR, errorPayload);
        throw new Error(errorPayload.message);
      }

      const sortedArchives = sortArchivesChronologically(extractedArchives);

      await mergeAllComponents(
        sortedArchives,
        session.mergedRoot,
        (progressPayload) => {
          sendProgress(event.sender, {
            sessionId,
            ...progressPayload,
          });
        },
        signal,
      );

      await cleanupExtractedDir(sessionId);

      const components = await buildComponentManifest(session.mergedRoot);
      let telemetryComponentId = null;

      const telemetryComponent = components.find((component) => component.hasTelemetry);
      if (telemetryComponent) {
        try {
          const reports = await parseTelemetryFileFromPath(telemetryComponent.mergedFilePath);
          if (reports.length) {
            setTelemetryReports(sessionId, reports);
            telemetryComponentId = telemetryComponent.id;
          }
        } catch (error) {
          warnings.push({
            archivePath: telemetryComponent.mergedFilePath,
            message: `Telemetry parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }

      updateSession(sessionId, {
        components,
        telemetryComponentId,
        warnings,
        archiveCount: archivePaths.length,
      });

      patchCurrentSessionState(sessionId, {
        status: 'ready',
        errorMessage: null,
        archiveCount: archivePaths.length,
        components,
        telemetryComponentId,
      });

      const payloadToRenderer = {
        sessionId,
        session: {
          id: session.id,
          loadedAt: session.loadedAt,
          archiveCount: archivePaths.length,
          components,
          telemetryComponentId,
        },
        components,
        warnings,
      };

      event.sender.send(IPC.INGESTION_COMPLETE, payloadToRenderer);
      return payloadToRenderer;
    } catch (error) {
      if (!String(error?.message || '').includes('cancelled')) {
        const errorPayload = {
          sessionId,
          message: error instanceof Error ? error.message : 'Unexpected ingestion error',
          detail: error instanceof Error ? error.stack : String(error),
        };
        patchCurrentSessionState(sessionId, {
          status: 'error',
          errorMessage: errorPayload.message,
        });

        event.sender.send(IPC.INGESTION_ERROR, errorPayload);
        log.error('Ingestion error', errorPayload);
      }

      throw error;
    } finally {
      activeIngestionController = null;
    }
  });

  ipcMain.handle(IPC.READ_LOG_FILE, async (_event, componentId) => {
    const session = getActiveSession();
    const component = findComponent(session?.id ?? null, componentId);
    if (!component) {
      throw new Error('Component not found.');
    }

    return readLogFile(component.mergedFilePath);
  });

  ipcMain.handle(IPC.READ_LOG_CHUNK, async (_event, componentId, offset = 0, length = 256 * 1024) => {
    const session = getActiveSession();
    const component = findComponent(session?.id ?? null, componentId);

    if (!session || !component) {
      throw new Error('Component not found.');
    }

    return readLogFileChunk({
      sessionId: session.id,
      componentId,
      filePath: component.mergedFilePath,
      offset,
      length,
    });
  });

  ipcMain.handle(IPC.SEARCH_LOG_FILE, async (_event, componentId, query, options) => {
    const session = getActiveSession();
    const component = findComponent(session?.id ?? null, componentId);
    if (!component) {
      throw new Error('Component not found.');
    }

    if (typeof query !== 'string' || !query.trim()) {
      return { matches: [], totalMatches: 0 };
    }

    return searchLogFile(component.mergedFilePath, query, options ?? {});
  });

  ipcMain.handle(IPC.PARSE_TELEMETRY, async (_event, componentId) => {
    const session = getActiveSession();
    if (!session || session.telemetryComponentId !== componentId) {
      return { reports: [], total: 0 };
    }

    const reports = await ensureTelemetryReportsLoaded(session);
    return {
      reports: buildTelemetryManifest(reports),
      total: reports.length,
    };
  });

  ipcMain.handle(IPC.GET_TELEMETRY_REPORT, async (_event, componentId, reportIndex) => {
    const session = getActiveSession();
    if (!session || session.telemetryComponentId !== componentId) {
      throw new Error('Telemetry component not available.');
    }

    const reports = await ensureTelemetryReportsLoaded(session);
    const report = reports?.[reportIndex];
    if (!report) {
      throw new Error('Telemetry report not found.');
    }

    return {
      index: reportIndex,
      timestamp: report.timestamp.toISOString(),
      rawTimestamp: report.rawTimestamp,
      sequenceNumber: report.sequenceNumber,
      data: report.data,
      flatData: report.flatData,
      parseError: report.parseError,
      rawJson: report.rawJson,
    };
  });

  ipcMain.handle(IPC.GET_TELEMETRY_TABLE, async (_event, componentId) => {
    const session = getActiveSession();
    if (!session || session.telemetryComponentId !== componentId) {
      return { rows: [], columns: [] };
    }

    const reports = await ensureTelemetryReportsLoaded(session);
    const columns = new Set(['Timestamp']);
    const rows = reports.map((report) => {
      const values = report.flatData ?? {};
      for (const key of Object.keys(values)) {
        columns.add(key);
      }

      return {
        timestamp: report.timestamp.toISOString(),
        rawTimestamp: report.rawTimestamp,
        sequenceNumber: report.sequenceNumber,
        values,
      };
    });

    return {
      rows,
      columns: [...columns],
    };
  });

  ipcMain.handle(IPC.EXPORT_CSV, async (_event, payload, fallbackName = 'telemetry.csv') => {
    const normalized = Array.isArray(payload)
      ? { rows: payload, columns: undefined }
      : {
          rows: Array.isArray(payload?.rows) ? payload.rows : [],
          columns: Array.isArray(payload?.columns) ? payload.columns : undefined,
        };

    const csv = toCsv(normalized.rows, normalized.columns);

    const result = await dialog.showSaveDialog({
      defaultPath: fallbackName,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (result.canceled || !result.filePath) {
      return { cancelled: true };
    }

    await fsp.writeFile(result.filePath, csv, 'utf8');
    return { cancelled: false, filePath: result.filePath };
  });

  ipcMain.handle(IPC.EXPORT_MERGED_LOGS, async () => {
    const session = getActiveSession();
    if (!session || !session.components?.length) {
      throw new Error('No active session with merged logs.');
    }

    const result = await dialog.showSaveDialog({
      defaultPath: `cpe-merged-logs-${session.id}.zip`,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    });

    if (result.canceled || !result.filePath) {
      return { cancelled: true };
    }

    await execFileAsync('/usr/bin/zip', ['-r', '-q', result.filePath, '.'], {
      cwd: session.mergedRoot,
    });

    return { cancelled: false, filePath: result.filePath };
  });
}
