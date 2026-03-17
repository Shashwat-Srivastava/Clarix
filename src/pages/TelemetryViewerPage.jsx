import { useCallback, useEffect, useMemo, useState } from 'react';
import { TableProperties } from 'lucide-react';
import ResizablePanels from '../components/layout/ResizablePanels.jsx';
import ReportList from '../components/telemetry-viewer/ReportList.jsx';
import TelemetryDetail from '../components/telemetry-viewer/TelemetryDetail.jsx';
import {
  buildGlobalSearchMatches,
  buildMatchedReportIndexSet,
  getProfileNeedle,
  groupMatchesByReportIndex,
} from '../components/telemetry-viewer/viewer-search-state.js';
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
  const profileNameFilter = session?.profileNameFilter ?? 'all';
  const reverseOrder = Boolean(session?.reverseOrder);
  const trimmedReportFilter = reportFilter.trim();
  const [globalSearchMatches, setGlobalSearchMatches] = useState([]);
  const [activeGlobalMatchIndex, setActiveGlobalMatchIndex] = useState(0);

  const {
    reportManifest,
    selectedReportIndex,
    setSelectedReportIndex,
    selectedReport,
    getReportByIndex,
    ensureAllReportsLoaded,
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

  useEffect(() => {
    let active = true;

    setGlobalSearchMatches([]);
    setActiveGlobalMatchIndex(0);

    if (!trimmedReportFilter) {
      return () => {
        active = false;
      };
    }

    void ensureAllReportsLoaded().then((reports) => {
      if (!active) {
        return;
      }

      setGlobalSearchMatches(
        buildGlobalSearchMatches({
          reports,
          reportManifest,
          profileNameFilter,
          query: trimmedReportFilter,
        }),
      );
    });

    return () => {
      active = false;
    };
  }, [ensureAllReportsLoaded, profileNameFilter, reportManifest, trimmedReportFilter]);

  const matchedPathsByReportIndex = useMemo(
    () => groupMatchesByReportIndex(globalSearchMatches),
    [globalSearchMatches],
  );

  const matchedReportIndexSet = useMemo(
    () => buildMatchedReportIndexSet(globalSearchMatches),
    [globalSearchMatches],
  );

  useEffect(() => {
    if (!globalSearchMatches.length) {
      setActiveGlobalMatchIndex(0);
      return;
    }

    setActiveGlobalMatchIndex((previous) => {
      if (previous < 0) {
        return 0;
      }
      if (previous >= globalSearchMatches.length) {
        return globalSearchMatches.length - 1;
      }
      return previous;
    });
  }, [globalSearchMatches]);

  const filteredReports = useMemo(() => {
    const profileNeedle = getProfileNeedle(profileNameFilter);
    const filtered = reportManifest.filter((report) => {
      const reportProfileName = String(report.profileName ?? '').toLowerCase();
      if (profileNeedle && !reportProfileName.includes(profileNeedle)) {
        return false;
      }

      if (!trimmedReportFilter) {
        return true;
      }

      return matchedReportIndexSet.has(report.index);
    });

    filtered.sort((a, b) => a.index - b.index);
    if (reverseOrder) {
      filtered.reverse();
    }

    return filtered;
  }, [matchedReportIndexSet, profileNameFilter, reportManifest, reverseOrder, trimmedReportFilter]);

  const activeGlobalMatch = globalSearchMatches[activeGlobalMatchIndex] ?? null;

  useEffect(() => {
    if (!trimmedReportFilter || !activeGlobalMatch) {
      return;
    }

    const activeMatchStillVisible = filteredReports.some(
      (report) => report.index === activeGlobalMatch.reportIndex,
    );
    if (!activeMatchStillVisible) {
      return;
    }

    if (selectedReportIndex !== activeGlobalMatch.reportIndex) {
      setSelectedReportIndex(activeGlobalMatch.reportIndex);
    }
  }, [activeGlobalMatch, filteredReports, selectedReportIndex, setSelectedReportIndex, trimmedReportFilter]);

  const handleSelectReport = useCallback(
    (index) => {
      if (!trimmedReportFilter) {
        setSelectedReportIndex(index);
        return;
      }

      const firstMatchForReport = globalSearchMatches.findIndex((match) => match.reportIndex === index);
      if (firstMatchForReport >= 0) {
        setActiveGlobalMatchIndex(firstMatchForReport);
        setSelectedReportIndex(index);
        return;
      }

      setSelectedReportIndex(index);
    },
    [globalSearchMatches, setSelectedReportIndex, trimmedReportFilter],
  );

  const handleAdvanceSearch = useCallback(() => {
    if (!trimmedReportFilter) {
      if (!filteredReports.length) {
        return;
      }

      const currentIndex = filteredReports.findIndex((report) => report.index === selectedReportIndex);
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % filteredReports.length;
      setSelectedReportIndex(filteredReports[nextIndex].index);
      return;
    }

    if (!globalSearchMatches.length) {
      return;
    }

    setActiveGlobalMatchIndex((previous) => (previous + 1) % globalSearchMatches.length);
  }, [filteredReports, globalSearchMatches.length, selectedReportIndex, setSelectedReportIndex, trimmedReportFilter]);

  useEffect(() => {
    if (!filteredReports.length) {
      if (selectedReportIndex != null) {
        setSelectedReportIndex(null);
      }
      return;
    }

    const hasSelectedReport = filteredReports.some((report) => report.index === selectedReportIndex);
    if (!hasSelectedReport) {
      setSelectedReportIndex(filteredReports[0].index);
    }
  }, [filteredReports, selectedReportIndex, setSelectedReportIndex]);

  return (
    <div className="h-full">
      <ResizablePanels
        initialLeftWidth={320}
        left={
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <ReportList
                filter={reportFilter}
                onAdvanceSearch={handleAdvanceSearch}
                formatTimestamp={formatTimestamp}
                onFilterChange={(nextFilter) => onSessionPatch({ reportFilter: nextFilter })}
                onProfileFilterChange={(nextProfileNameFilter) =>
                  onSessionPatch({ profileNameFilter: nextProfileNameFilter })
                }
                onSelect={handleSelectReport}
                onTimezoneChange={setTimezone}
                onToggleOrder={() => onSessionPatch({ reverseOrder: !reverseOrder })}
                profileFilter={profileNameFilter}
                reports={filteredReports}
                reverseOrder={reverseOrder}
                selectedIndex={selectedReportIndex}
                timezone={timezone}
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
            globalActiveMatchPath={activeGlobalMatch?.reportIndex === selectedReportIndex ? activeGlobalMatch.path : null}
            globalMatchedPaths={matchedPathsByReportIndex[selectedReportIndex] ?? []}
            globalSearchQuery={trimmedReportFilter}
            report={selectedReport}
          />
        }
      />
    </div>
  );
}
