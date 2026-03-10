/**
 * Segmented control for telemetry timezone rendering.
 *
 * @param {{timezone:'UTC'|'CET'|'IST',onChange:(tz:'UTC'|'CET'|'IST')=>void}} props
 */
export default function TimezoneSelector({ timezone, onChange }) {
  const options = ['UTC', 'CET', 'IST'];

  return (
    <div className="inline-flex rounded-lg border border-[color:var(--border)] p-1">
      {options.map((option) => (
        <button
          aria-label={`Set timezone ${option}`}
          className={`rounded-md px-2 py-1 text-xs transition-colors ${
            timezone === option
              ? 'bg-[color:var(--accent)] text-white'
              : 'text-[color:var(--text-muted)] hover:bg-[color:var(--bg-hover)]'
          }`}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
