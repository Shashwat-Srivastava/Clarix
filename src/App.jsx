import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppShell from './components/layout/AppShell.jsx';
import ProgressOverlay from './components/ingestion/ProgressOverlay.jsx';
import HomePage from './pages/HomePage.jsx';
import LogViewerPage from './pages/LogViewerPage.jsx';
import TelemetryViewerPage from './pages/TelemetryViewerPage.jsx';
import TelemetryTablePage from './pages/TelemetryTablePage.jsx';
import { createFreshSession, MAX_SESSIONS, useSessionStore } from './store/session-store.js';

const IDLE_PROGRESS = { stage: 'idle', current: 0, total: 0, detail: '' };

/**
 * Root application component.
 *
 * @returns {JSX.Element}
 */
export default function App() {
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const addSession = useSessionStore((state) => state.addSession);
  const removeSession = useSessionStore((state) => state.removeSession);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const renameSession = useSessionStore((state) => state.renameSession);
  const updateSession = useSessionStore((state) => state.updateSession);
  const hydrateFromDisk = useSessionStore((state) => state.hydrateFromDisk);

  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('cpe-theme');
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const requestVersionRef = useRef(0);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('cpe-theme', theme);
  }, [theme]);

  useEffect(() => {
    async function restoreSessions() {
      const saved = await window.electronAPI.loadSessions();

      if (!saved || !saved.sessions?.length) {
        addSession();
        return;
      }

      const sanitized = saved.sessions.map((session) =>
        session.status === 'loading' ? { ...session, status: 'idle' } : session,
      );

      hydrateFromDisk(sanitized, saved.activeSessionId ?? null);
    }

    restoreSessions().catch(() => {
      addSession();
    });
  }, [addSession, hydrateFromDisk]);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    void window.electronAPI.setActiveSession(activeSessionId).catch(() => {});
  }, [activeSessionId]);

  useEffect(() => {
    const offProgress = window.electronAPI.onIngestionProgress((payload) => {
      const sessionId = payload?.sessionId;
      if (!sessionId) {
        return;
      }

      updateSession(sessionId, {
        status: 'loading',
        progress: {
          stage: payload.stage ?? 'loading',
          current: payload.current ?? 0,
          total: payload.total ?? 0,
          detail: payload.detail ?? '',
        },
      });
    });

    const offComplete = window.electronAPI.onIngestionComplete((payload) => {
      const sessionId = payload?.sessionId;
      if (!sessionId) {
        return;
      }

      const components = payload?.components ?? [];
      const firstComponentId = components[0]?.id ?? null;

      updateSession(sessionId, {
        status: 'ready',
        archiveCount: payload?.session?.archiveCount ?? components.length,
        components,
        telemetryComponentId: payload?.session?.telemetryComponentId ?? null,
        selectedComponentId: firstComponentId,
        selectedTelemetryIndex: null,
        reportManifest: [],
        reportCache: {},
        warnings: payload?.warnings ?? [],
        errorMessage: null,
        progress: { ...IDLE_PROGRESS },
        activeView: 'log-viewer',
      });
    });

    const offError = window.electronAPI.onIngestionError((payload) => {
      const sessionId = payload?.sessionId || activeSessionId;
      if (!sessionId) {
        return;
      }

      updateSession(sessionId, {
        status: 'error',
        errorMessage: payload?.message ?? 'Ingestion failed',
        progress: { ...IDLE_PROGRESS },
      });
    });

    return () => {
      offProgress?.();
      offComplete?.();
      offError?.();
    };
  }, [activeSessionId, updateSession]);

  /**
   * Applies a partial update to the active session.
   *
   * @param {Object} patch
   */
  const patchActiveSession = useCallback(
    (patch) => {
      if (!activeSessionId) {
        return;
      }

      updateSession(activeSessionId, patch);
    },
    [activeSessionId, updateSession],
  );

  /**
   * Starts ingestion in active session.
   *
   * @param {string[]} paths
   */
  const startIngestion = useCallback(
    async (paths) => {
      if (!activeSessionId || !paths?.length) {
        return;
      }

      requestVersionRef.current += 1;
      const requestVersion = requestVersionRef.current;

      updateSession(activeSessionId, {
        status: 'loading',
        errorMessage: null,
        warnings: [],
        lastIngestPaths: paths,
        components: [],
        telemetryComponentId: null,
        selectedComponentId: null,
        selectedTelemetryIndex: null,
        reportManifest: [],
        reportCache: {},
        progress: {
          stage: 'collect',
          current: 0,
          total: paths.length,
          detail: 'Collecting archives…',
        },
        activeView: 'home',
      });

      try {
        await window.electronAPI.ingestFromPaths(paths, activeSessionId, 30 * 60 * 1000);
        if (requestVersionRef.current !== requestVersion) {
          return;
        }
      } catch (ingestError) {
        if (requestVersionRef.current !== requestVersion) {
          return;
        }

        updateSession(activeSessionId, {
          status: 'error',
          errorMessage: ingestError instanceof Error ? ingestError.message : 'Ingestion failed',
          progress: { ...IDLE_PROGRESS },
        });
      }
    },
    [activeSessionId, updateSession],
  );

  useEffect(() => {
    if (!activeSession) {
      return;
    }

    if (activeSession.selectedComponentId) {
      return;
    }

    const first = activeSession.components?.[0];
    if (first) {
      patchActiveSession({ selectedComponentId: first.id });
    }
  }, [activeSession, patchActiveSession]);

  const hasData = Boolean(activeSession?.components?.length);
  const hasTelemetry = Boolean(activeSession?.telemetryComponentId);

  const sessionInfo = useMemo(() => {
    if (!activeSession || !activeSession.components?.length) {
      return null;
    }

    return `${activeSession.archiveCount} archives loaded · ${activeSession.components.length} components`;
  }, [activeSession]);

  const activeView = activeSession?.activeView ?? 'home';

  /**
   * Closes a session tab with confirmation.
   * For the last remaining session, performs a destructive app reset.
   *
   * @param {string} sessionId
   */
  const handleCloseSession = useCallback(
    async (sessionId) => {
      const targetSession = sessions.find((session) => session.id === sessionId);
      if (!targetSession) {
        return;
      }

      const isLastSession = sessions.length === 1;
      const confirmationMessage = isLastSession
        ? `Delete "${targetSession.name}" and reset the app to a fresh state?`
        : `Close "${targetSession.name}"?`;

      if (!window.confirm(confirmationMessage)) {
        return;
      }

      if (isLastSession) {
        // 1) Delete session directory recursively (also removes telemetry-cache.json if present).
        try {
          await window.electronAPI.deleteSessionDir(targetSession.id);
        } catch {
          // Continue reset flow even if directory is already missing or deletion fails.
        }

        // 3) Reset store to a single fresh session.
        const freshSession = createFreshSession('Session 1');
        hydrateFromDisk([freshSession], freshSession.id);

        // 4) Land on Home by keeping fresh session activeView as "home".
        // 5) Persist the fresh single-session snapshot immediately.
        await window.electronAPI.saveSessions({
          sessions: [freshSession],
          activeSessionId: freshSession.id,
        });
        return;
      }

      removeSession(sessionId);
    },
    [hydrateFromDisk, removeSession, sessions],
  );

  const content = (() => {
    if (!activeSession) {
      return null;
    }

    if (activeView === 'home') {
      return (
        <HomePage
          error={activeSession.errorMessage ? { message: activeSession.errorMessage } : null}
          onDropPaths={startIngestion}
          onRetry={() => {
            if (activeSession.lastIngestPaths?.length) {
              startIngestion(activeSession.lastIngestPaths);
            }
          }}
          onSelectFiles={async () => {
            const files = await window.electronAPI.openFileDialog();
            if (files?.length) {
              startIngestion(files);
            }
          }}
          onSelectFolder={async () => {
            const folders = await window.electronAPI.openFolderDialog();
            if (folders?.length) {
              startIngestion(folders);
            }
          }}
        />
      );
    }

    if (activeView === 'log-viewer') {
      return <LogViewerPage onSessionPatch={patchActiveSession} session={activeSession} />;
    }

    if (activeView === 'telemetry-viewer') {
      return (
        <TelemetryViewerPage
          onOpenTable={() => patchActiveSession({ activeView: 'telemetry-table' })}
          onSessionPatch={patchActiveSession}
          session={activeSession}
        />
      );
    }

    if (activeView === 'telemetry-table') {
      return (
        <TelemetryTablePage
          onBack={() => patchActiveSession({ activeView: 'telemetry-viewer' })}
          onSessionPatch={patchActiveSession}
          session={activeSession}
        />
      );
    }

    return null;
  })();

  return (
    <div className="relative h-full w-full">
      <AppShell
        activeSessionId={activeSessionId}
        canAddSession={sessions.length < MAX_SESSIONS}
        hasData={hasData}
        hasTelemetry={hasTelemetry}
        maxSessions={MAX_SESSIONS}
        onAddSession={addSession}
        onCloseSession={handleCloseSession}
        onRenameSession={renameSession}
        onSelectSession={(sessionId) => {
          if (sessionId === activeSessionId) {
            return;
          }

          const targetSession = sessions.find((session) => session.id === sessionId);
          const resolvedView =
            targetSession?.status === 'ready'
              ? targetSession?.activeView ?? 'home'
              : 'home';

          setActiveSession(sessionId);

          if (targetSession?.activeView !== resolvedView) {
            updateSession(sessionId, { activeView: resolvedView });
          }
        }}
        onToggleTheme={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
        onViewTabChange={(viewTab) => {
          patchActiveSession({ activeView: viewTab });
        }}
        sessionInfo={sessionInfo}
        sessions={sessions}
        theme={theme}
        viewTab={activeView}
      >
        {content}
      </AppShell>

      {activeSession?.warnings?.length ? (
        <div className="pointer-events-none absolute bottom-4 right-4 max-w-lg rounded-xl border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/15 p-3 text-xs text-[color:var(--text-primary)]">
          <div className="mb-1 font-semibold">Completed with warnings ({activeSession.warnings.length})</div>
          <div className="max-h-20 overflow-auto text-[color:var(--text-muted)]">
            {activeSession.warnings.map((warning) => warning.message).join(' · ')}
          </div>
        </div>
      ) : null}

      {activeSession?.status === 'loading' ? (
        <ProgressOverlay progress={activeSession.progress ?? IDLE_PROGRESS} />
      ) : null}
    </div>
  );
}
