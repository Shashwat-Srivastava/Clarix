import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import TelemetryTable from '../components/telemetry-table/TelemetryTable.jsx';
import { useTimezone } from '../hooks/useTimezone.js';

/**
 * Telemetry table aggregation page.
 *
 * @param {{session:Object,onSessionPatch:(patch:Object)=>void,onBack:()=>void}} props
 */
export default function TelemetryTablePage({ session, onSessionPatch, onBack }) {
  const telemetryComponentId = session?.telemetryComponentId;
  const { formatTimestamp } = useTimezone({
    timezone: session?.timezone ?? 'UTC',
  });

  const visibleColumns = session?.columnVisibility ?? null;

  const [tableRows, setTableRows] = useState([]);

  useEffect(() => {
    let active = true;

    if (!telemetryComponentId) {
      setTableRows([]);
      return () => {
        active = false;
      };
    }

    window.electronAPI
      .getTelemetryTable(telemetryComponentId)
      .then((payload) => {
        if (!active) {
          return;
        }
        setTableRows(payload?.rows ?? []);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setTableRows([]);
      });

    return () => {
      active = false;
    };
  }, [telemetryComponentId]);

  const rows = useMemo(() => {
    return tableRows.map((row) => ({
      Timestamp: formatTimestamp(row.timestamp ?? row.rawTimestamp),
      ...(row.values ?? {}),
    }));
  }, [formatTimestamp, tableRows]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[color:var(--border)] p-3">
        <button
          aria-label="Back to telemetry viewer"
          className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-1.5 hover:bg-[color:var(--bg-hover)]"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft size={14} />
          Back to Telemetry Viewer
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <TelemetryTable
          onExport={async (visibleColumnIds) => {
            const selectedRows = rows;
            const selectedColumns = (visibleColumnIds ?? []).filter(Boolean);

            await window.electronAPI.exportCsv(
              {
                rows: selectedRows,
                columns: selectedColumns,
              },
              'telemetry-data.csv',
            );
          }}
          onVisibleColumnsChange={(columnVisibility) => onSessionPatch({ columnVisibility })}
          rows={rows}
          visibleColumns={visibleColumns}
        />
      </div>
    </div>
  );
}
