import { create } from 'zustand';

export const MAX_SESSIONS = 5;

const DEFAULT_PROGRESS = {
  stage: 'idle',
  current: 0,
  total: 0,
  detail: '',
};

const DEFAULT_VIEW_STATE = {
  activeView: 'home',
  selectedComponentId: null,
  selectedTelemetryIndex: null,
  timezone: 'UTC',
  columnVisibility: null,
  componentContentFilter: '',
  componentFilter: '',
  componentSort: 'asc',
  wrapLines: false,
  reportFilter: '',
  profileNameFilter: 'all',
  reverseOrder: false,
};

/**
 * Builds a new session object with default fields.
 *
 * @param {string} id
 * @param {string} name
 * @returns {Object}
 */
function createDefaultSession(id, name) {
  return {
    id,
    name,
    status: 'idle',
    archiveCount: 0,
    components: [],
    telemetryComponentId: null,
    errorMessage: null,
    createdAt: Date.now(),
    warnings: [],
    lastIngestPaths: [],
    progress: { ...DEFAULT_PROGRESS },
    reportManifest: [],
    reportCache: {},
    ...DEFAULT_VIEW_STATE,
  };
}

/**
 * Creates a fresh idle session with default values.
 *
 * @param {string} [name='Session 1']
 * @returns {Object}
 */
export function createFreshSession(name = 'Session 1') {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return createDefaultSession(id, name);
}

/**
 * Returns true when running in renderer with preload API available.
 *
 * @returns {boolean}
 */
function hasElectronAPI() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI);
}

/**
 * Chooses the lowest available Session N name (1..MAX_SESSIONS).
 *
 * @param {Array<Object>} sessions
 * @returns {string}
 */
function getNextSessionName(sessions) {
  const used = new Set(sessions.map((session) => session.name));

  for (let index = 1; index <= MAX_SESSIONS; index += 1) {
    const candidate = `Session ${index}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  return `Session ${sessions.length + 1}`;
}

/**
 * Trims and limits session tab names.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeSessionName(value) {
  return String(value ?? '').trim().slice(0, 24);
}

/**
 * Returns only fields that should be persisted to sessions.json.
 *
 * @param {Object} session
 * @returns {Object}
 */
function toPersistedSession(session) {
  return {
    id: session.id,
    name: session.name,
    status: session.status === 'loading' ? 'idle' : session.status,
    archiveCount: session.archiveCount,
    components: session.components,
    telemetryComponentId: session.telemetryComponentId,
    activeView: session.activeView,
    selectedComponentId: session.selectedComponentId,
    selectedTelemetryIndex: session.selectedTelemetryIndex,
    timezone: session.timezone,
    columnVisibility: session.columnVisibility,
    errorMessage: session.errorMessage,
    createdAt: session.createdAt,
    componentContentFilter: session.componentContentFilter,
    componentFilter: session.componentFilter,
    componentSort: session.componentSort,
    wrapLines: session.wrapLines,
    reportFilter: session.reportFilter,
    profileNameFilter: session.profileNameFilter,
    reverseOrder: session.reverseOrder,
    lastIngestPaths: Array.isArray(session.lastIngestPaths) ? session.lastIngestPaths : [],
  };
}

/**
 * Builds payload for save/sync IPC calls.
 *
 * @param {Array<Object>} sessions
 * @param {string | null} activeSessionId
 * @returns {{activeSessionId:string|null,sessions:Array<Object>}}
 */
function buildSessionsPayload(sessions, activeSessionId) {
  return {
    activeSessionId,
    sessions: sessions.map(toPersistedSession),
  };
}

/**
 * Sends renderer state snapshot to main process memory.
 *
 * @param {Array<Object>} sessions
 * @param {string|null} activeSessionId
 */
function syncSessionsState(sessions, activeSessionId) {
  if (!hasElectronAPI() || typeof window.electronAPI.syncSessionsState !== 'function') {
    return;
  }

  const payload = buildSessionsPayload(sessions, activeSessionId);
  void window.electronAPI.syncSessionsState(payload).catch(() => {});
}

/**
 * Persists session metadata to disk.
 *
 * @param {Array<Object>} sessions
 * @param {string|null} activeSessionId
 */
function persistSessions(sessions, activeSessionId) {
  if (!hasElectronAPI() || typeof window.electronAPI.saveSessions !== 'function') {
    return;
  }

  const payload = buildSessionsPayload(sessions, activeSessionId);
  void window.electronAPI.saveSessions(payload).catch(() => {});
}

/**
 * Ensures hydrated sessions always contain required defaults.
 *
 * @param {Object} session
 * @returns {Object}
 */
function normalizeHydratedSession(session) {
  const id = String(session?.id ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}`));
  const name = normalizeSessionName(session?.name) || 'Session';

  return {
    ...createDefaultSession(id, name),
    ...session,
    id,
    name,
    status: session?.status === 'loading' ? 'idle' : session?.status ?? 'idle',
    warnings: [],
    progress: { ...DEFAULT_PROGRESS },
    reportManifest: [],
    reportCache: {},
    lastIngestPaths: Array.isArray(session?.lastIngestPaths) ? session.lastIngestPaths : [],
    activeView: session?.activeView ?? 'home',
    componentContentFilter: session?.componentContentFilter ?? '',
    componentFilter: session?.componentFilter ?? '',
    componentSort: session?.componentSort ?? 'asc',
    wrapLines: Boolean(session?.wrapLines),
    reportFilter: session?.reportFilter ?? '',
    profileNameFilter: session?.profileNameFilter ?? 'all',
    reverseOrder: Boolean(session?.reverseOrder),
  };
}

/**
 * Zustand store for multi-session app state.
 */
export const useSessionStore = create((set, get) => ({
  sessions: [],
  activeSessionId: null,

  /**
   * Returns currently active session or null.
   *
   * @returns {Object|null}
   */
  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find((session) => session.id === activeSessionId) ?? null;
  },

  /**
   * Returns whether a new session can be created.
   *
   * @returns {boolean}
   */
  canAddSession: () => get().sessions.length < MAX_SESSIONS,

  /**
   * Creates a new session tab and activates it.
   */
  addSession: () => {
    const { sessions } = get();
    if (sessions.length >= MAX_SESSIONS) {
      return;
    }

    const session = createFreshSession(getNextSessionName(sessions));
    const id = session.id;
    const nextSessions = [...sessions, session].sort((a, b) => a.createdAt - b.createdAt);

    set({
      sessions: nextSessions,
      activeSessionId: id,
    });

    syncSessionsState(nextSessions, id);
    persistSessions(nextSessions, id);
  },

  /**
   * Removes a session tab and its on-disk workspace.
   *
   * @param {string} id
   */
  removeSession: (id) => {
    const { sessions, activeSessionId } = get();

    if (sessions.length <= 1) {
      return;
    }

    const nextSessions = sessions.filter((session) => session.id !== id);
    if (nextSessions.length === sessions.length) {
      return;
    }

    const nextActiveSessionId =
      activeSessionId === id
        ? (nextSessions[0]?.id ?? null)
        : activeSessionId;

    set({
      sessions: nextSessions,
      activeSessionId: nextActiveSessionId,
    });

    if (hasElectronAPI() && typeof window.electronAPI.deleteSessionDir === 'function') {
      void window.electronAPI.deleteSessionDir(id).catch(() => {});
    }

    syncSessionsState(nextSessions, nextActiveSessionId);
    persistSessions(nextSessions, nextActiveSessionId);
  },

  /**
   * Sets active session by id.
   *
   * @param {string} id
   */
  setActiveSession: (id) => {
    const { sessions, activeSessionId } = get();
    if (activeSessionId === id || !sessions.some((session) => session.id === id)) {
      return;
    }

    set({ activeSessionId: id });
    syncSessionsState(sessions, id);
  },

  /**
   * Renames a session tab.
   *
   * @param {string} id
   * @param {string} name
   */
  renameSession: (id, name) => {
    const { sessions, activeSessionId } = get();
    const normalized = normalizeSessionName(name);
    if (!normalized) {
      return;
    }

    let changed = false;
    const nextSessions = sessions.map((session) => {
      if (session.id !== id) {
        return session;
      }

      if (session.name === normalized) {
        return session;
      }

      changed = true;
      return { ...session, name: normalized };
    });

    if (!changed) {
      return;
    }

    set({ sessions: nextSessions });
    syncSessionsState(nextSessions, activeSessionId);
    persistSessions(nextSessions, activeSessionId);
  },

  /**
   * Applies a patch to one session object.
   *
   * @param {string} id
   * @param {Object} patch
   */
  updateSession: (id, patch) => {
    if (!id || !patch || typeof patch !== 'object') {
      return;
    }

    const { sessions, activeSessionId } = get();
    let changed = false;

    const nextSessions = sessions.map((session) => {
      if (session.id !== id) {
        return session;
      }

      changed = true;
      return {
        ...session,
        ...patch,
      };
    });

    if (!changed) {
      return;
    }

    set({ sessions: nextSessions });
    syncSessionsState(nextSessions, activeSessionId);
  },

  /**
   * Replaces state using persisted session data.
   *
   * @param {Array<Object>} savedSessions
   * @param {string|null} savedActiveId
   */
  hydrateFromDisk: (savedSessions, savedActiveId) => {
    const normalizedSessions = Array.isArray(savedSessions)
      ? savedSessions.slice(0, MAX_SESSIONS).map(normalizeHydratedSession)
      : [];

    const sessions = normalizedSessions.length
      ? normalizedSessions
      : [createFreshSession('Session 1')];

    const hasSavedActive = sessions.some((session) => session.id === savedActiveId);
    const activeSessionId = hasSavedActive ? savedActiveId : sessions[0].id;

    set({ sessions, activeSessionId });
    syncSessionsState(sessions, activeSessionId);
  },
}));
