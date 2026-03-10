import { useCallback, useEffect, useMemo, useRef } from 'react';

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

/**
 * Loads telemetry manifest and report details from Electron main process.
 *
 * @param {{session:Object|null,telemetryComponentId:string|null|undefined,onSessionPatch:(patch:Object)=>void}} params
 */
export function useTelemetry({ session, telemetryComponentId, onSessionPatch }) {
  const reportManifest = session?.reportManifest ?? EMPTY_ARRAY;
  const selectedReportIndex = session?.selectedTelemetryIndex ?? null;
  const reportCache = session?.reportCache ?? EMPTY_OBJECT;
  const sessionId = session?.id;

  const requestVersionRef = useRef(0);

  useEffect(() => {
    let active = true;

    if (!telemetryComponentId || !sessionId) {
      onSessionPatch({
        reportManifest: [],
        selectedTelemetryIndex: null,
        reportCache: {},
      });
      return undefined;
    }

    requestVersionRef.current += 1;
    const requestVersion = requestVersionRef.current;

    window.electronAPI
      .parseTelemetry(telemetryComponentId)
      .then((payload) => {
        if (!active || requestVersionRef.current !== requestVersion) {
          return;
        }

        const reports = payload?.reports ?? [];
        onSessionPatch({
          reportManifest: reports,
          selectedTelemetryIndex: reports.length ? 0 : null,
          reportCache: {},
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }

        onSessionPatch({
          reportManifest: [],
          selectedTelemetryIndex: null,
          reportCache: {},
        });
      });

    return () => {
      active = false;
    };
  }, [onSessionPatch, sessionId, telemetryComponentId]);

  /**
   * Fetches and caches a specific telemetry report.
   *
   * @param {number} index
   * @returns {Promise<any | null>}
   */
  const getReportByIndex = useCallback(
    async (index) => {
      if (!telemetryComponentId || !sessionId || index == null) {
        return null;
      }

      if (reportCache[index]) {
        return reportCache[index];
      }

      const report = await window.electronAPI.getTelemetryReport(telemetryComponentId, index);
      onSessionPatch({
        reportCache: {
          ...reportCache,
          [index]: report,
        },
      });
      return report;
    },
    [onSessionPatch, reportCache, sessionId, telemetryComponentId],
  );

  /**
   * Loads all telemetry reports and returns them in manifest order.
   *
   * @returns {Promise<any[]>}
   */
  const ensureAllReportsLoaded = useCallback(async () => {
    if (!telemetryComponentId || !sessionId) {
      return [];
    }

    const reports = [];
    for (let index = 0; index < reportManifest.length; index += 1) {
      const report = await getReportByIndex(index);
      if (report) {
        reports.push(report);
      }
    }
    return reports;
  }, [getReportByIndex, reportManifest.length, sessionId, telemetryComponentId]);

  const selectedReport = useMemo(() => {
    if (selectedReportIndex == null) {
      return null;
    }
    return reportCache[selectedReportIndex] ?? null;
  }, [reportCache, selectedReportIndex]);

  return {
    reportManifest,
    selectedReportIndex,
    setSelectedReportIndex: (index) => onSessionPatch({ selectedTelemetryIndex: index }),
    selectedReport,
    getReportByIndex,
    ensureAllReportsLoaded,
  };
}
