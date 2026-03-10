import { ChevronDown, ChevronUp, Search } from 'lucide-react';

/**
 * Search controls for log viewer.
 *
 * @param {Object} props
 */
export default function LogSearchBar({
  query,
  onQueryChange,
  onNext,
  onPrevious,
  activeIndex,
  totalMatches,
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] p-2">
      <Search size={14} className="text-[color:var(--text-muted)]" />
      <input
        aria-label="Search log text"
        className="h-7 w-full bg-transparent outline-none"
        id="log-search-input"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search logs (Cmd+F)"
        value={query}
      />
      <span className="text-xs text-[color:var(--text-muted)]">
        {totalMatches ? `${activeIndex + 1} of ${totalMatches}` : '0 matches'}
      </span>
      <button
        aria-label="Previous match"
        className="rounded border border-[color:var(--border)] p-1 hover:bg-[color:var(--bg-hover)]"
        onClick={onPrevious}
        type="button"
      >
        <ChevronUp size={14} />
      </button>
      <button
        aria-label="Next match"
        className="rounded border border-[color:var(--border)] p-1 hover:bg-[color:var(--bg-hover)]"
        onClick={onNext}
        type="button"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
}
