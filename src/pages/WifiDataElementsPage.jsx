import { useCallback, useEffect, useMemo, useState } from 'react';
import ResizablePanels from '../components/layout/ResizablePanels.jsx';
import ReportList from '../components/telemetry-viewer/ReportList.jsx';
import {
  buildGlobalSearchMatches,
  buildMatchedReportIndexSet,
} from '../components/telemetry-viewer/viewer-search-state.js';
import WifiAnalysisDetail from '../components/wifi-analysis/WifiAnalysisDetail.jsx';
import { useTelemetry } from '../hooks/useTelemetry.js';
import { useTimezone } from '../hooks/useTimezone.js';

export default function WifiDataElementsPage({ session, onSessionPatch }) {
  const telemetryComponentId = session?.telemetryComponentId;
  const { timezone, setTimezone, formatTimestamp } = useTimezone({
    timezone: session?.timezone ?? 'UTC',
    onChange: (nextTimezone) => onSessionPatch({ timezone: nextTimezone }),
  });

  const reportFilter = session?.reportFilter ?? '';
  const reverseOrder = Boolean(session?.reverseOrder);
  const viewMode = session?.wifiAnalysisMode ?? 'json';
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
          profileNameFilter: 'all',
          query: trimmedReportFilter,
        }),
      );
    });

    return () => {
      active = false;
    };
  }, [ensureAllReportsLoaded, reportManifest, trimmedReportFilter]);

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
    const filtered = reportManifest.filter((report) => {
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
  }, [matchedReportIndexSet, reportManifest, reverseOrder, trimmedReportFilter]);

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
          <div className="min-h-0 h-full">
            <ReportList
              filter={reportFilter}
              formatTimestamp={formatTimestamp}
              onAdvanceSearch={handleAdvanceSearch}
              onFilterChange={(nextFilter) => onSessionPatch({ reportFilter: nextFilter })}
              onProfileFilterChange={() => {}}
              onSelect={handleSelectReport}
              onTimezoneChange={setTimezone}
              onToggleOrder={() => onSessionPatch({ reverseOrder: !reverseOrder })}
              profileFilter="all"
              reports={filteredReports}
              reverseOrder={reverseOrder}
              selectedIndex={selectedReportIndex}
              showProfileFilter={false}
              timezone={timezone}
            />
          </div>
        }
        right={
          <WifiAnalysisDetail
            formattedTimestamp={
              selectedReport ? formatTimestamp(selectedReport.timestamp ?? selectedReport.rawTimestamp) : ''
            }
            mode={viewMode}
            onModeChange={(nextMode) => onSessionPatch({ wifiAnalysisMode: nextMode })}
            report={selectedReport}
          />
        }
      />
    </div>
  );
}
