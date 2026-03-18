import path from 'node:path';
import fs from 'node:fs/promises';
import { app } from 'electron';

const sessions = new Map();
let activeSessionId = null;

/**
 * Returns root directory for all persisted session workspaces.
 *
 * @returns {string}
 */
function getSessionsRootDir() {
  return path.join(app.getPath('userData'), 'sessions');
}

/**
 * Returns per-session workspace directory.
 *
 * @param {string} sessionId
 * @returns {string}
 */
function getSessionRootDir(sessionId) {
  return path.join(getSessionsRootDir(), sessionId);
}

/**
 * Returns or creates an in-memory session record.
 *
 * @param {string} sessionId
 * @returns {Object}
 */
function ensureSessionRecord(sessionId) {
  const existing = sessions.get(sessionId);
  if (existing) {
    return existing;
  }

  const rootDir = getSessionRootDir(sessionId);
  const extractedRoot = path.join(rootDir, 'extracted');
  const mergedRoot = path.join(rootDir, 'merged');
  const inputRoot = path.join(rootDir, 'input');

  const session = {
    id: sessionId,
    rootDir,
    extractedRoot,
    mergedRoot,
    inputRoot,
    loadedAt: new Date(),
    archiveCount: 0,
    components: [],
    telemetryComponentId: null,
    warnings: [],
    telemetryReports: [],
  };

  sessions.set(sessionId, session);
  return session;
}

/**
 * Ensures on-disk directories exist for a session workspace.
 *
 * @param {Object} session
 * @returns {Promise<void>}
 */
async function ensureSessionDirs(session) {
  await fs.mkdir(session.inputRoot, { recursive: true });
  await fs.mkdir(session.extractedRoot, { recursive: true });
  await fs.mkdir(session.mergedRoot, { recursive: true });
}

/**
 * Prepares a session for a new ingestion run.
 *
 * @param {string} sessionId
 * @returns {Promise<Object>}
 */
export async function prepareSessionWorkspace(sessionId) {
  const session = ensureSessionRecord(sessionId);

  await ensureSessionDirs(session);
  await fs.rm(session.inputRoot, { recursive: true, force: true });
  await fs.rm(session.extractedRoot, { recursive: true, force: true });
  await fs.rm(session.mergedRoot, { recursive: true, force: true });
  await fs.mkdir(session.inputRoot, { recursive: true });
  await fs.mkdir(session.extractedRoot, { recursive: true });
  await fs.mkdir(session.mergedRoot, { recursive: true });

  session.loadedAt = new Date();
  session.archiveCount = 0;
  session.components = [];
  session.telemetryComponentId = null;
  session.warnings = [];
  session.telemetryReports = [];

  sessions.set(sessionId, session);
  activeSessionId = sessionId;

  return session;
}

/**
 * Returns active session from in-memory map.
 *
 * @returns {Object|null}
 */
export function getActiveSession() {
  if (!activeSessionId) {
    return null;
  }

  return sessions.get(activeSessionId) ?? null;
}

/**
 * Returns session by id.
 *
 * @param {string} sessionId
 * @returns {Object|null}
 */
export function getSessionById(sessionId) {
  if (!sessionId) {
    return null;
  }

  return sessions.get(sessionId) ?? null;
}

/**
 * Sets active session id for main-process lookups.
 *
 * @param {string} sessionId
 */
export function setActiveSession(sessionId) {
  if (!sessionId) {
    activeSessionId = null;
    return;
  }

  ensureSessionRecord(sessionId);
  activeSessionId = sessionId;
}

/**
 * Applies updates to a session record.
 *
 * @param {string} sessionId
 * @param {Object} updates
 */
export function updateSession(sessionId, updates) {
  if (!sessionId) {
    return;
  }

  const session = ensureSessionRecord(sessionId);
  Object.assign(session, updates);
}

/**
 * Stores parsed telemetry reports for a session.
 *
 * @param {string} sessionId
 * @param {Array} reports
 */
export function setTelemetryReports(sessionId, reports) {
  if (!sessionId) {
    return;
  }

  const session = ensureSessionRecord(sessionId);
  session.telemetryReports = Array.isArray(reports) ? reports : [];
}

/**
 * Finds a component entry within a session.
 *
 * @param {string} sessionId
 * @param {string} componentId
 * @returns {Object|undefined}
 */
export function findComponent(sessionId, componentId) {
  const session = getSessionById(sessionId) ?? getActiveSession();
  if (!session) {
    return undefined;
  }

  return session.components.find((component) => component.id === componentId);
}

/**
 * Removes only extracted directory after merge completion.
 *
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
export async function cleanupExtractedDir(sessionId) {
  const session = getSessionById(sessionId);
  if (!session) {
    return;
  }

  await fs.rm(session.extractedRoot, { recursive: true, force: true });
  await fs.mkdir(session.extractedRoot, { recursive: true });
}

/**
 * Deletes a session workspace directory and memory state.
 *
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
export async function removeSessionWorkspace(sessionId) {
  const rootDir = getSessionRootDir(sessionId);

  sessions.delete(sessionId);
  if (activeSessionId === sessionId) {
    activeSessionId = null;
  }

  await fs.rm(rootDir, { recursive: true, force: true });
}

/**
 * Syncs in-memory session records from renderer snapshot.
 *
 * @param {Array<Object>} snapshotSessions
 */
export function hydrateSessionRecords(snapshotSessions) {
  if (!Array.isArray(snapshotSessions)) {
    return;
  }

  const ids = new Set(snapshotSessions.map((session) => session.id));

  for (const id of [...sessions.keys()]) {
    if (!ids.has(id)) {
      sessions.delete(id);
    }
  }

  for (const snapshotSession of snapshotSessions) {
    const session = ensureSessionRecord(snapshotSession.id);

    session.archiveCount = snapshotSession.archiveCount ?? session.archiveCount;
    session.components = Array.isArray(snapshotSession.components)
      ? snapshotSession.components
      : session.components;
    session.telemetryComponentId = snapshotSession.telemetryComponentId ?? null;
  }
}

/**
 * Clears all in-memory session records.
 */
export function clearSessionRecords() {
  sessions.clear();
  activeSessionId = null;
}
