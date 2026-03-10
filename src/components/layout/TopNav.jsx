import { CirclePlus, Database, House, MoonStar, SunMedium, TerminalSquare, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Session tab element with inline rename support.
 *
 * @param {Object} props
 */
function SessionTab({ session, active, closable, onSelect, onRename, onClose }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);

  useEffect(() => {
    if (!isEditing) {
      setDraft(session.name);
    }
  }, [isEditing, session.name]);

  /**
   * Commits the edited tab name.
   */
  const confirmRename = () => {
    const nextName = draft.trim().slice(0, 24);
    setIsEditing(false);

    if (!nextName) {
      setDraft(session.name);
      return;
    }

    if (nextName !== session.name) {
      onRename(session.id, nextName);
    }
  };

  return (
    <div
      className={`group relative flex h-9 items-center gap-1 rounded-md border px-1 text-sm transition-colors ${
        active
          ? 'border-[color:var(--accent)]/50 bg-[color:var(--accent)]/10 text-[color:var(--text-primary)]'
          : 'border-transparent text-[color:var(--text-muted)] hover:border-[color:var(--border)] hover:bg-[color:var(--bg-hover)]'
      }`}
    >
      <span
        className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full ${
          active ? 'bg-[color:var(--accent)]' : 'bg-transparent'
        }`}
      />

      <button
        aria-label={`Switch to ${session.name}`}
        className="min-w-0 flex-1 px-2 text-left"
        onClick={() => {
          if (isEditing) {
            return;
          }
          onSelect(session.id);
        }}
        type="button"
      >
        {isEditing ? (
          <input
            aria-label={`Rename ${session.name}`}
            autoFocus
            className="w-28 border-b border-[color:var(--accent)] bg-transparent text-sm text-[color:var(--text-primary)] outline-none"
            maxLength={24}
            onBlur={confirmRename}
            onChange={(event) => setDraft(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                confirmRename();
              }

              if (event.key === 'Escape') {
                event.preventDefault();
                setDraft(session.name);
                setIsEditing(false);
              }
            }}
            value={draft}
          />
        ) : (
          <span
            className="block max-w-28 truncate"
            onDoubleClick={(event) => {
              event.stopPropagation();
              setIsEditing(true);
            }}
          >
            {session.name}
          </span>
        )}
      </button>

      {closable ? (
        <button
          aria-label={`Close ${session.name}`}
          className="rounded p-1 text-[color:var(--text-muted)] opacity-0 transition-opacity hover:bg-[color:var(--bg-hover)] hover:text-[color:var(--text-primary)] group-hover:opacity-100"
          onClick={() => onClose(session.id)}
          type="button"
        >
          <X size={12} />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Top navigation bar for app-level controls.
 *
 * @param {Object} props
 */
export default function TopNav({
  viewTab,
  onViewTabChange,
  hasData,
  hasTelemetry,
  sessions,
  activeSessionId,
  canAddSession,
  maxSessions,
  onAddSession,
  onSelectSession,
  onCloseSession,
  onRenameSession,
  sessionInfo,
  theme,
  onToggleTheme,
}) {
  const tabs = [
    { id: 'home', label: 'Home', icon: House, enabled: true },
    { id: 'log-viewer', label: 'Log Viewer', icon: TerminalSquare, enabled: hasData },
    { id: 'telemetry-viewer', label: 'Telemetry Viewer', icon: Database, enabled: hasData && hasTelemetry },
  ];

  const normalizedViewTab = viewTab === 'telemetry-table' ? 'telemetry-viewer' : viewTab;

  return (
    <header className="border-b border-[color:var(--border)] bg-[color:var(--bg-panel)]">
      <div className="flex h-14 items-center gap-4 px-4">
        <div className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--accent)]/20 text-[color:var(--accent)]">
            <TerminalSquare size={16} />
          </div>
          <span>CPE Log Analyser</span>
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex min-w-max items-center gap-1 pr-2">
            {sessions.map((session) => (
              <SessionTab
                active={session.id === activeSessionId}
                closable
                key={session.id}
                onClose={onCloseSession}
                onRename={onRenameSession}
                onSelect={onSelectSession}
                session={session}
              />
            ))}

            <button
              aria-label="Create new session"
              className={`inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm ${
                canAddSession
                  ? 'border-[color:var(--border)] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-hover)]'
                  : 'cursor-not-allowed border-[color:var(--border)] text-[color:var(--text-muted)] opacity-50'
              }`}
              disabled={!canAddSession}
              onClick={onAddSession}
              title={!canAddSession ? `Maximum ${maxSessions} sessions open` : 'Create new session'}
              type="button"
            >
              <CirclePlus size={14} />
              New Session
            </button>
          </div>
        </div>

        <button
          aria-label="Toggle theme"
          className="shrink-0 rounded-lg border border-[color:var(--border)] p-1.5 text-[color:var(--text-primary)] hover:bg-[color:var(--bg-hover)]"
          onClick={onToggleTheme}
          type="button"
        >
          {theme === 'dark' ? <SunMedium size={15} /> : <MoonStar size={15} />}
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-[color:var(--border)] px-4 py-2">
        <nav className="flex items-center gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-window)] p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = normalizedViewTab === tab.id;

            return (
              <button
                aria-label={`Open ${tab.label}`}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active ? 'bg-[color:var(--accent)] text-white' : 'text-[color:var(--text-muted)] hover:bg-[color:var(--bg-hover)]'
                } ${!tab.enabled ? 'cursor-not-allowed opacity-40' : ''}`}
                disabled={!tab.enabled}
                key={tab.id}
                onClick={() => onViewTabChange(tab.id)}
                type="button"
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-[11px] text-[color:var(--text-muted)]">
          {sessionInfo || 'No data loaded'}
        </span>
      </div>
    </header>
  );
}
