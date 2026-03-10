/**
 * Overlay shown while archives are being processed.
 *
 * @param {{progress:{stage:string,current:number,total:number,detail?:string}}} props
 */
export default function ProgressOverlay({ progress }) {
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-panel)] p-6 shadow-2xl">
        <h2 className="mb-2 text-lg font-semibold">Processing archives</h2>
        <p className="mb-4 text-[color:var(--text-muted)]">{progress.detail || 'Working…'}</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--bg-hover)]">
          <div
            className="h-full rounded-full bg-[color:var(--accent)] transition-all duration-150"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="mt-2 text-right text-xs text-[color:var(--text-muted)]">
          {progress.current} / {progress.total}
        </div>
      </div>
    </div>
  );
}
