import { ChevronDown, ChevronUp, Copy, Download, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JsonRenderer from '../telemetry-viewer/JsonRenderer.jsx';
import { collectSearchEntries } from '../telemetry-viewer/search-utils.js';
import TopologyDiagram from './TopologyDiagram.jsx';
import { buildWifiTopologySnapshot, getWifiAnalysisTrees } from './topology-utils.js';

function formatCount(value) {
  return value == null || value === '' ? 'N/A' : String(value);
}

export default function WifiAnalysisDetail({ report, formattedTimestamp, mode, onModeChange }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const nodeRefs = useRef(new Map());

  const registerNodeRef = useCallback((path, node) => {
    if (node) {
      nodeRefs.current.set(path, node);
      return;
    }

    nodeRefs.current.delete(path);
  }, []);

  const trees = useMemo(() => getWifiAnalysisTrees(report), [report]);
  const snapshot = useMemo(() => buildWifiTopologySnapshot(report), [report]);

  const jsonPayload = useMemo(() => {
    const payload = {
      'Device.Hosts.Host.': trees.hosts,
      'Device.WiFi.DataElements.Network.Device.': trees.wifiDevices,
    };

    if (trees.connectedDeviceNumber !== '') {
      payload['Device.Hosts.X_CISCO_COM_ConnectedDeviceNumber'] = trees.connectedDeviceNumber;
    }

    return payload;
  }, [trees.connectedDeviceNumber, trees.hosts, trees.wifiDevices]);

  const jsonOutput = useMemo(() => JSON.stringify(jsonPayload, null, 2), [jsonPayload]);
  const matchedPaths = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return [...new Set(
      collectSearchEntries(jsonPayload)
        .filter((entry) => entry.text.toLowerCase().includes(normalizedQuery))
        .map((entry) => entry.path),
    )];
  }, [jsonPayload, searchQuery]);
  const activeMatchPath = matchedPaths.length ? matchedPaths[activeMatchIndex] : null;
  const matchedPathSet = useMemo(() => new Set(matchedPaths), [matchedPaths]);

  useEffect(() => {
    setSearchQuery('');
    setActiveMatchIndex(0);
  }, [report?.sequenceNumber]);

  useEffect(() => {
    if (!matchedPaths.length) {
      setActiveMatchIndex(0);
      return;
    }

    setActiveMatchIndex((previous) => {
      if (previous < 0) {
        return 0;
      }
      if (previous >= matchedPaths.length) {
        return matchedPaths.length - 1;
      }
      return previous;
    });
  }, [matchedPaths]);

  useEffect(() => {
    if (mode !== 'json' || !activeMatchPath) {
      return;
    }

    const node = nodeRefs.current.get(activeMatchPath);
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeMatchPath, mode]);

  if (!report) {
    return (
      <div className="grid h-full place-items-center text-[color:var(--text-muted)]">
        ← Select a telemetry report
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[color:var(--border)] px-4 py-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
            <div>
              <div className="text-xs text-[color:var(--text-muted)]">Report #{report.sequenceNumber}</div>
              <div className="font-semibold">{formattedTimestamp}</div>
            </div>

            {mode === 'json' ? (
              <div className="flex min-w-[320px] flex-1 items-center gap-2 rounded-lg border border-[color:var(--border)] p-2">
                <Search size={14} className="text-[color:var(--text-muted)]" />
                <input
                  aria-label="Search WiFi analysis JSON"
                  className="h-7 w-full bg-transparent outline-none"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || !matchedPaths.length) {
                      return;
                    }

                    event.preventDefault();
                    setActiveMatchIndex((index) => (index + 1) % matchedPaths.length);
                  }}
                  placeholder="Search current report JSON"
                  value={searchQuery}
                />
                <span className="text-xs text-[color:var(--text-muted)]">
                  {matchedPaths.length ? `${activeMatchIndex + 1} of ${matchedPaths.length}` : '0 matches'}
                </span>
                <button
                  aria-label="Previous WiFi JSON match"
                  className="rounded border border-[color:var(--border)] p-1 hover:bg-[color:var(--bg-hover)]"
                  onClick={() => {
                    if (!matchedPaths.length) {
                      return;
                    }
                    setActiveMatchIndex((index) => (index - 1 + matchedPaths.length) % matchedPaths.length);
                  }}
                  type="button"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  aria-label="Next WiFi JSON match"
                  className="rounded border border-[color:var(--border)] p-1 hover:bg-[color:var(--bg-hover)]"
                  onClick={() => {
                    if (!matchedPaths.length) {
                      return;
                    }
                    setActiveMatchIndex((index) => (index + 1) % matchedPaths.length);
                  }}
                  type="button"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-window)] p-1 text-sm">
              <button
                className={`rounded-lg px-3 py-1.5 ${
                  mode === 'json'
                    ? 'bg-[color:var(--accent)] text-white'
                    : 'text-[color:var(--text-muted)] hover:bg-[color:var(--bg-hover)]'
                }`}
                onClick={() => onModeChange('json')}
                type="button"
              >
                Show JSON data
              </button>
              <button
                className={`rounded-lg px-3 py-1.5 ${
                  mode === 'topology'
                    ? 'bg-[color:var(--accent)] text-white'
                    : 'text-[color:var(--text-muted)] hover:bg-[color:var(--bg-hover)]'
                }`}
                onClick={() => onModeChange('topology')}
                type="button"
              >
                Show topology
              </button>
            </div>

            {mode === 'json' ? (
              <>
                <button
                  className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-1.5 hover:bg-[color:var(--bg-hover)]"
                  onClick={() => navigator.clipboard.writeText(jsonOutput)}
                  type="button"
                >
                  <Copy size={14} />
                  Copy JSON
                </button>
                <button
                  className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-1.5 hover:bg-[color:var(--bg-hover)]"
                  onClick={() =>
                    window.electronAPI.exportJson(
                      jsonPayload,
                      `wifi-dataelements-report-${report.sequenceNumber}.json`,
                    )
                  }
                  type="button"
                >
                  <Download size={14} />
                  Download JSON
                </button>
              </>
            ) : (
              <>
                <button
                  className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-1.5 hover:bg-[color:var(--bg-hover)]"
                  onClick={() => navigator.clipboard.writeText(snapshot?.mermaid ?? '')}
                  type="button"
                >
                  <Copy size={14} />
                  Copy Mermaid
                </button>
                <button
                  className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-1.5 hover:bg-[color:var(--bg-hover)]"
                  onClick={() =>
                    window.electronAPI.exportJson(
                      snapshot ?? { error: 'No topology data available for this report.' },
                      `wifi-topology-report-${report.sequenceNumber}.json`,
                    )
                  }
                  type="button"
                >
                  <Download size={14} />
                  Download topology JSON
                </button>
              </>
            )}
          </div>
        </div>

        <div className="text-xs text-[color:var(--text-muted)]">
          Host rows: {trees.hosts.length} · WiFi DataElements devices: {trees.wifiDevices.length}
        </div>
      </div>

      {mode === 'json' ? (
        <div className="mono-log flex-1 overflow-auto p-4">
          {!trees.hosts.length && !trees.wifiDevices.length ? (
            <div className="rounded-lg border border-dashed border-[color:var(--border)] p-4 text-sm text-[color:var(--text-muted)]">
              This report does not contain `Device.Hosts.Host.` or `Device.WiFi.DataElements.Network.Device.`.
            </div>
          ) : (
            <JsonRenderer
              localActiveMatchPath={activeMatchPath}
              localMatchedPaths={matchedPathSet}
              localSearchQuery={searchQuery}
              registerNodeRef={registerNodeRef}
              value={jsonPayload}
            />
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {!snapshot ? (
            <div className="rounded-lg border border-dashed border-[color:var(--border)] p-4 text-sm text-[color:var(--text-muted)]">
              This report does not contain WiFi DataElements device data, so no topology can be rendered.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-window)] p-3">
                  <div className="text-xs text-[color:var(--text-muted)]">Mesh devices</div>
                  <div className="mt-1 text-2xl font-semibold">{snapshot.device_count}</div>
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-window)] p-3">
                  <div className="text-xs text-[color:var(--text-muted)]">Backhaul links</div>
                  <div className="mt-1 text-2xl font-semibold">{snapshot.edges.length}</div>
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-window)] p-3">
                  <div className="text-xs text-[color:var(--text-muted)]">Matched hosts</div>
                  <div className="mt-1 text-2xl font-semibold">{snapshot.matched_host_count}</div>
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-window)] p-3">
                  <div className="text-xs text-[color:var(--text-muted)]">Host-only rows</div>
                  <div className="mt-1 text-2xl font-semibold">{snapshot.unmatched_hosts.length}</div>
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-window)] p-3">
                  <div className="text-xs text-[color:var(--text-muted)]">Connected device count</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {formatCount(snapshot.connected_device_number)}
                  </div>
                </div>
              </div>

              <TopologyDiagram snapshot={snapshot} />

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-window)] p-4">
                  <div className="mb-3 text-sm font-semibold">Host reconciliation</div>
                  {!snapshot.unmatched_hosts.length ? (
                    <div className="text-sm text-[color:var(--text-muted)]">
                      Every host-table entry matched either a mesh node or a reported WiFi client.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {snapshot.unmatched_hosts.map((host) => (
                        <div
                          className="rounded-lg border border-[color:var(--border)] px-3 py-2 text-sm"
                          key={host.mac}
                        >
                          <div className="font-medium">{host.host_name || host.mac}</div>
                          <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                            {host.ip_address || 'No IP'} · {host.interface_type || 'Unknown interface'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <details className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-window)] p-4">
                  <summary className="cursor-pointer text-sm font-semibold">Generated Mermaid</summary>
                  <pre className="mono-log mt-3 overflow-auto rounded-lg bg-[color:var(--bg-panel)] p-3 text-xs">
                    {snapshot.mermaid}
                  </pre>
                </details>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
