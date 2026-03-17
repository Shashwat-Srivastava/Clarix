import { ArrowDownUp, Search } from 'lucide-react';
import TimezoneSelector from './TimezoneSelector.jsx';

const PROFILE_FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Advance', value: 'advance' },
  { label: 'Basic', value: 'basic' },
  { label: 'Adhoc', value: 'adhoc' },
];

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
  onAdvanceSearch,
  profileFilter,
  onProfileFilterChange,
  reverseOrder,
  onToggleOrder,
  formatTimestamp,
  timezone,
  onTimezoneChange,
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
            onKeyDown={(event) => {
              if (event.key !== 'Enter') {
                return;
              }

              event.preventDefault();
              onAdvanceSearch?.();
            }}
            placeholder="Search across reports"
            value={filter}
          />
        </div>

        <div className="mb-2 border-b border-[color:var(--border)]" />

        <div className="mb-2">
          <div className="mb-2 text-xs text-[color:var(--text-muted)]">Profile</div>
          <div className="flex flex-wrap gap-2">
          {PROFILE_FILTER_OPTIONS.map((option) => {
            const active = profileFilter === option.value;

            return (
              <button
                aria-label={`Filter telemetry reports by ${option.label}`}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  active
                    ? 'bg-[color:var(--accent)] text-white'
                    : 'border border-[color:var(--border)] hover:bg-[color:var(--bg-hover)]'
                }`}
                key={option.value}
                onClick={() => onProfileFilterChange(option.value)}
                type="button"
              >
                {option.label}
              </button>
            );
          })}
          </div>
        </div>

        <div className="mb-2 border-b border-[color:var(--border)]" />

        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-[color:var(--text-muted)]">Select timezone</span>
          <TimezoneSelector onChange={onTimezoneChange} timezone={timezone} />
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
        {!reports.length ? (
          <div className="rounded-lg border border-dashed border-[color:var(--border)] p-3 text-sm text-[color:var(--text-muted)]">
            No telemetry reports matched the current filters.
          </div>
        ) : null}

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
