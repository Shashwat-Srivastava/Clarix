import { Download } from 'lucide-react';

/**
 * Export CSV button for telemetry table.
 *
 * @param {{onClick:()=>void}} props
 */
export default function ExportButton({ onClick }) {
  return (
    <button
      aria-label="Export visible telemetry data as CSV"
      className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-1.5 hover:bg-[color:var(--bg-hover)]"
      onClick={onClick}
      type="button"
    >
      <Download size={14} />
      Export CSV
    </button>
  );
}
