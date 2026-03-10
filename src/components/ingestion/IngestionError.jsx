import { AlertCircle } from 'lucide-react';

/**
 * Inline error box for ingestion failures.
 *
 * @param {{error:{message:string,detail?:string}|null,onRetry:()=>void}} props
 */
export default function IngestionError({ error, onRetry }) {
  if (!error) {
    return null;
  }

  return (
    <div className="mx-auto mt-4 w-full max-w-3xl rounded-xl border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 p-4 text-left">
      <div className="mb-1 flex items-center gap-2 font-medium text-[color:var(--danger)]">
        <AlertCircle size={16} />
        <span>{error.message}</span>
      </div>
      {error.detail ? <p className="mb-3 whitespace-pre-wrap text-xs text-[color:var(--text-muted)]">{error.detail}</p> : null}
      <button
        aria-label="Retry ingestion"
        className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs hover:bg-[color:var(--bg-hover)]"
        onClick={onRetry}
        type="button"
      >
        Retry
      </button>
    </div>
  );
}
