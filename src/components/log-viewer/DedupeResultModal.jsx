/**
 * Modal that displays stats after removing or restoring duplicate log lines.
 *
 * @param {{results:Array<{name:string,duplicatesRemoved:number,totalLines:number}>,onDismiss:()=>void}} props
 */
export default function DedupeResultModal({ results, onDismiss }) {
  const hasDuplicates = results.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex max-h-[420px] w-full max-w-md flex-col rounded-xl border border-[color:var(--border)] bg-neutral-900 shadow-lg">
        <div className="border-b border-[color:var(--border)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">
            {hasDuplicates ? 'Duplicate Logs Removed' : 'No Duplicates Found'}
          </h2>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          {hasDuplicates ? (
            <ul className="space-y-3">
              {results.map((entry) => (
                <li
                  className="rounded-lg border border-[color:var(--border)] px-3 py-2"
                  key={entry.name}
                >
                  <div className="text-xs font-medium text-[color:var(--text-primary)]">
                    {entry.name}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                    {entry.duplicatesRemoved} duplicate{entry.duplicatesRemoved > 1 ? 's' : ''} removed
                    {' '}out of {entry.totalLines} total lines
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[color:var(--text-muted)]">
              No duplicate logs found across any log file.
            </p>
          )}
        </div>

        <div className="border-t border-[color:var(--border)] px-5 py-3">
          <button
            className="w-full rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90"
            onClick={onDismiss}
            type="button"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
