import { useEffect, useMemo } from 'react';
import { TableProperties } from 'lucide-react';
import ResizablePanels from '../components/layout/ResizablePanels.jsx';
import ReportList from '../components/telemetry-viewer/ReportList.jsx';
import TelemetryDetail from '../components/telemetry-viewer/TelemetryDetail.jsx';
import TimezoneSelector from '../components/telemetry-viewer/TimezoneSelector.jsx';
import { useTelemetry } from '../hooks/useTelemetry.js';
import { useTimezone } from '../hooks/useTimezone.js';

/**
 * Dedicated telemetry viewer page.
 *
 * @param {{session:Object,onSessionPatch:(patch:Object)=>void,onOpenTable:()=>void}} props
 */
export default function TelemetryViewerPage({ session, onSessionPatch, onOpenTable }) {
  const telemetryComponentId = session?.telemetryComponentId;
  const { timezone, setTimezone, formatTimestamp } = useTimezone({
    timezone: session?.timezone ?? 'UTC',
    onChange: (nextTimezone) => onSessionPatch({ timezone: nextTimezone }),
  });

  const reportFilter = session?.reportFilter ?? '';
  const reverseOrder = Boolean(session?.reverseOrder);

  const {
    reportManifest,
    selectedReportIndex,
    setSelectedReportIndex,
    selectedReport,
    getReportByIndex,
  } = useTelemetry({
    session,
    telemetryComponentId,
    onSessionPatch,
  });

  useEffect(() => {
    if (selectedReportIndex == null) {
      return;
    }
    getReportByIndex(selectedReportIndex);
  }, [getReportByIndex, selectedReportIndex]);

  const filteredReports = useMemo(() => {
    const needle = reportFilter.trim().toLowerCase();
    const filtered = reportManifest.filter((report) => {
      if (!needle) {
        return true;
      }

      return (
        String(report.rawTimestamp).toLowerCase().includes(needle) ||
        String(report.timestamp).toLowerCase().includes(needle) ||
        report.summary.toLowerCase().includes(needle) ||
        String(report.sequenceNumber).includes(needle)
      );
    });

    filtered.sort((a, b) => a.index - b.index);
    if (reverseOrder) {
      filtered.reverse();
    }

    return filtered;
  }, [reportFilter, reportManifest, reverseOrder]);

  return (
    <div className="h-full">
      <ResizablePanels
        initialLeftWidth={320}
        left={
          <div className="flex h-full flex-col">
            <div className="border-b border-[color:var(--border)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-[color:var(--text-muted)]">Select Timezone</span>
                <TimezoneSelector onChange={setTimezone} timezone={timezone} />
              </div>
            </div>

            <div className="min-h-0 flex-1">
              <ReportList
                filter={reportFilter}
                formatTimestamp={formatTimestamp}
                onFilterChange={(nextFilter) => onSessionPatch({ reportFilter: nextFilter })}
                onSelect={setSelectedReportIndex}
                onToggleOrder={() => onSessionPatch({ reverseOrder: !reverseOrder })}
                reports={filteredReports}
                reverseOrder={reverseOrder}
                selectedIndex={selectedReportIndex}
              />
            </div>

            <div className="border-t border-[color:var(--border)] p-3">
              <button
                aria-label="Open telemetry table view"
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-[color:var(--accent)] px-3 py-2 text-white"
                onClick={onOpenTable}
                type="button"
              >
                <TableProperties size={15} />
                View Tabular Data
              </button>
            </div>
          </div>
        }
        right={
          <TelemetryDetail
            formattedTimestamp={
              selectedReport?.timestamp
                ? formatTimestamp(selectedReport.timestamp)
                : selectedReport?.rawTimestamp
                  ? formatTimestamp(selectedReport.rawTimestamp)
                  : 'No report selected'
            }
            report={selectedReport}
          />
        }
      />
    </div>
  );
}
