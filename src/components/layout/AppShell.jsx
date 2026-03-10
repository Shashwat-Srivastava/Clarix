import TopNav from './TopNav.jsx';

/**
 * Application shell with fixed top navigation.
 *
 * @param {Object} props
 */
export default function AppShell({
  children,
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
  return (
    <div className="flex h-full w-full flex-col">
      <TopNav
        activeSessionId={activeSessionId}
        canAddSession={canAddSession}
        hasData={hasData}
        hasTelemetry={hasTelemetry}
        maxSessions={maxSessions}
        onAddSession={onAddSession}
        onCloseSession={onCloseSession}
        onRenameSession={onRenameSession}
        onSelectSession={onSelectSession}
        onToggleTheme={onToggleTheme}
        onViewTabChange={onViewTabChange}
        sessionInfo={sessionInfo}
        sessions={sessions}
        theme={theme}
        viewTab={viewTab}
      />
      <main className="min-h-0 flex-1 w-full">{children}</main>
    </div>
  );
}
