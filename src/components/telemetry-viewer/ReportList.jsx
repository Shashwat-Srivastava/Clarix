import { ArrowDownUp, Search } from 'lucide-react';

/**
 * Sidebar list of telemetry report entries.
 *
 * @param {Object} props
 */
export default function ReportList({
  reports,
  selectedIndex,
  onSelect,
  filter,
  onFilterChange,
  reverseOrder,
  onToggleOrder,
  formatTimestamp,
}) {
  const selectedIndexInView = reports.findIndex((report) => report.index === selectedIndex);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[color:var(--border)] p-3">
        <h2 className="mb-2 text-sm font-semibold">Telemetry Reports</h2>

        <div className="mb-2 flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-2">
          <Search size={14} className="text-[color:var(--text-muted)]" />
          <input
            aria-label="Filter telemetry reports"
            className="h-8 w-full bg-transparent outline-none"
            onChange={(event) => onFilterChange(event.target.value)}
            placeholder="Filter reports"
            value={filter}
          />
        </div>

        <button
          aria-label="Reverse telemetry list order"
          className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-xs hover:bg-[color:var(--bg-hover)]"
          onClick={onToggleOrder}
          type="button"
        >
          <ArrowDownUp size={12} />
          {reverseOrder ? 'Newest first' : 'Oldest first'}
        </button>
      </div>

      <div
        className="flex-1 overflow-auto p-2"
        onKeyDown={(event) => {
          if (!reports.length) {
            return;
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            const next = selectedIndexInView < 0 ? 0 : Math.min(reports.length - 1, selectedIndexInView + 1);
            onSelect(reports[next].index);
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            const next =
              selectedIndexInView < 0 ? reports.length - 1 : Math.max(0, selectedIndexInView - 1);
            onSelect(reports[next].index);
          }

          if (event.key === 'Enter' && selectedIndexInView >= 0) {
            event.preventDefault();
            onSelect(reports[selectedIndexInView].index);
          }
        }}
        tabIndex={0}
      >
        {reports.map((report) => {
          const active = selectedIndex === report.index;

          return (
            <button
              aria-label={`Open telemetry report ${report.sequenceNumber}`}
              className={`mb-1 w-full rounded-lg border px-2 py-2 text-left transition-colors ${
                active
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10'
                  : 'border-transparent hover:bg-[color:var(--bg-hover)]'
              }`}
              key={report.index}
              onClick={() => onSelect(report.index)}
              type="button"
            >
              <div className="text-[12px] font-medium">
                {formatTimestamp(report.timestamp ?? report.rawTimestamp)}
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                #{report.sequenceNumber} · {report.summary}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
