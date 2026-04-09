import { useMemo } from 'react';
import { buildTopologyLayout } from './topology-utils.js';

function formatSecondary(value, fallback = 'N/A') {
  if (value == null || value === '') {
    return fallback;
  }

  return String(value);
}

export default function TopologyDiagram({ snapshot }) {
  const layout = useMemo(() => buildTopologyLayout(snapshot), [snapshot]);
  const canvasWidth = Math.max(layout.width, 720);

  if (!snapshot?.nodes?.length) {
    return (
      <div className="grid min-h-[320px] place-items-center rounded-xl border border-dashed border-[color:var(--border)] text-sm text-[color:var(--text-muted)]">
        No WiFi topology could be derived from this report.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-window)]">
      <div className="overflow-auto">
        <div className="relative" style={{ height: layout.height, width: canvasWidth }}>
          <svg className="absolute inset-0" height={layout.height} width={canvasWidth}>
            <defs>
              <marker
                id="wifi-topology-arrow"
                markerHeight="8"
                markerUnits="strokeWidth"
                markerWidth="8"
                orient="auto"
                refX="7"
                refY="4"
              >
                <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
              </marker>
            </defs>

            {snapshot.edges.map((edge) => {
              const from = layout.positions[edge.from_id];
              const to = layout.positions[edge.to_id];
              if (!from || !to) {
                return null;
              }

              const startX = from.x + from.width;
              const startY = from.centerY;
              const endX = to.x;
              const endY = to.centerY;
              const midX = (startX + endX) / 2;
              const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

              return (
                <g
                  className={edge.is_wifi ? 'text-sky-500' : 'text-emerald-500'}
                  key={`${edge.from_id}-${edge.to_id}`}
                >
                  <path
                    d={path}
                    fill="none"
                    markerEnd="url(#wifi-topology-arrow)"
                    stroke="currentColor"
                    strokeDasharray={edge.is_wifi ? '8 6' : undefined}
                    strokeWidth="2.5"
                  />
                </g>
              );
            })}
          </svg>

          {snapshot.nodes.map((node) => {
            const position = layout.positions[node.id];
            if (!position) {
              return null;
            }

            const visibleClients = node.clients.slice(0, 6);
            const overflowClients = Math.max(0, node.clients.length - visibleClients.length);

            return (
              <div
                className={`absolute rounded-2xl border p-4 shadow-sm ${
                  node.is_gateway
                    ? 'border-amber-400/60 bg-amber-500/10'
                    : 'border-[color:var(--border)] bg-[color:var(--bg-panel)]'
                }`}
                key={node.id}
                style={{
                  left: position.x,
                  minHeight: position.height,
                  top: position.y,
                  width: position.width,
                }}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                      {node.is_gateway ? 'Gateway' : 'Extender'}
                    </div>
                    <div className="font-semibold">{node.manufacturer_model || node.manufacturer || node.id}</div>
                    <div className="text-xs text-[color:var(--text-muted)]">{node.id}</div>
                  </div>
                  <div className="rounded-full border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--text-muted)]">
                    {node.connected_clients} clients
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-[color:var(--bg-window)]/70 p-2">
                    <div className="text-[color:var(--text-muted)]">Backhaul</div>
                    <div>{formatSecondary(node.backhaul_media_type, node.is_gateway ? 'Root' : 'Unknown')}</div>
                  </div>
                  <div className="rounded-lg bg-[color:var(--bg-window)]/70 p-2">
                    <div className="text-[color:var(--text-muted)]">Signal</div>
                    <div>{formatSecondary(node.backhaul_signal_strength, node.is_gateway ? 'N/A' : 'Unknown')}</div>
                  </div>
                  <div className="rounded-lg bg-[color:var(--bg-window)]/70 p-2">
                    <div className="text-[color:var(--text-muted)]">PHY Rate</div>
                    <div>{node.backhaul_phy_rate ? `${node.backhaul_phy_rate} Mbps` : 'N/A'}</div>
                  </div>
                  <div className="rounded-lg bg-[color:var(--bg-window)]/70 p-2">
                    <div className="text-[color:var(--text-muted)]">Host Table</div>
                    <div>{node.host_record?.host_name || node.host_record?.ip_address || 'No match'}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-2 text-xs font-medium text-[color:var(--text-muted)]">
                    Associated clients
                  </div>
                  {!visibleClients.length ? (
                    <div className="rounded-lg border border-dashed border-[color:var(--border)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
                      No fronthaul clients reported.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {visibleClients.map((client) => (
                        <div
                          className="rounded-lg border border-[color:var(--border)] px-3 py-2 text-xs"
                          key={client.mac}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{client.host_name || client.mac}</span>
                            <span className="text-[color:var(--text-muted)]">
                              {client.signal_strength || 'Signal n/a'}
                            </span>
                          </div>
                          <div className="mt-1 text-[color:var(--text-muted)]">
                            {client.ip_address || client.ssid || 'Unknown attachment'}
                          </div>
                        </div>
                      ))}
                      {overflowClients ? (
                        <div className="text-xs text-[color:var(--text-muted)]">
                          +{overflowClients} more client{overflowClients === 1 ? '' : 's'}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-5 border-t border-[color:var(--border)] px-4 py-3 text-xs text-[color:var(--text-muted)]">
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-10 rounded bg-emerald-500" />
          <span>Ethernet</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-10 rounded border-t-2 border-dashed border-sky-500" />
          <span>WiFi</span>
        </div>
      </div>
    </div>
  );
}
