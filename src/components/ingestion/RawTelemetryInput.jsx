import { ArrowLeft, ClipboardPaste, Loader2 } from 'lucide-react';
import { useState } from 'react';

/**
 * Full-screen overlay for pasting and submitting raw telemetry report text.
 *
 * @param {{onSubmit:(rawText:string)=>Promise<void>,onCancel:()=>void}} props
 */
export default function RawTelemetryInput({ onSubmit, onCancel }) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = text.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(text);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to parse telemetry reports from the pasted text.',
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8">
      <div className="flex w-full max-w-4xl flex-col rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-panel)] shadow-lg">
        <div className="flex items-center gap-3 border-b border-[color:var(--border)] px-6 py-4">
          <button
            aria-label="Go back"
            className="rounded-lg border border-[color:var(--border)] p-2 hover:bg-[color:var(--bg-hover)]"
            onClick={onCancel}
            type="button"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--accent)]/15 text-[color:var(--accent)]">
              <ClipboardPaste size={16} />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Paste Raw Telemetry</h2>
              <p className="text-xs text-[color:var(--text-muted)]">
                Paste telemetry report data below. Surrounding log lines will be ignored.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <textarea
            aria-label="Raw telemetry report text"
            className="h-80 w-full resize-y rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-window)] p-4 font-mono text-sm leading-relaxed text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent)]"
            disabled={isSubmitting}
            onChange={(event) => {
              setText(event.target.value);
              if (error) {
                setError(null);
              }
            }}
            placeholder={'Paste your telemetry report here...\n\nExpected format:\n{"Report":[\n  {"key": "value"},\n  ...\n]}'}
            value={text}
          />

          {error ? (
            <div className="mt-3 rounded-lg border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-2 text-sm text-[color:var(--danger)]">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-[color:var(--border)] px-6 py-4">
          <span className="text-xs text-[color:var(--text-muted)]">
            {text.trim()
              ? `${text.length.toLocaleString()} characters`
              : 'No text pasted yet'}
          </span>

          <div className="flex items-center gap-3">
            <button
              aria-label="Cancel"
              className="rounded-xl border border-[color:var(--border)] px-4 py-2 text-sm hover:bg-[color:var(--bg-hover)]"
              disabled={isSubmitting}
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>

            <button
              aria-label="Submit telemetry"
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm text-white ${
                canSubmit
                  ? 'bg-[color:var(--accent)] hover:opacity-90'
                  : 'cursor-not-allowed bg-[color:var(--accent)] opacity-50'
              }`}
              disabled={!canSubmit}
              onClick={handleSubmit}
              type="button"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Parsing...
                </>
              ) : (
                'Analyze Reports'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
