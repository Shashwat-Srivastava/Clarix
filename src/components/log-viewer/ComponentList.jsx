import { ArrowDownAZ, ArrowUpAZ, FileText, Search } from 'lucide-react';
import { useMemo } from 'react';

/**
 * Sidebar list for merged component logs.
 *
 * @param {Object} props
 */
export default function ComponentList({
  components,
  selectedComponentId,
  onSelect,
  filter,
  onFilterChange,
  sort,
  onToggleSort,
}) {
  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const items = components.filter((component) => component.name.toLowerCase().includes(query));
    items.sort((a, b) =>
      sort === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
    );
    return items;
  }, [components, filter, sort]);

  const selectedIndex = filtered.findIndex((component) => component.id === selectedComponentId);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[color:var(--border)] p-3">
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-2">
          <Search size={14} className="text-[color:var(--text-muted)]" />
          <input
            aria-label="Filter components"
            className="h-8 w-full bg-transparent outline-none"
            onChange={(event) => onFilterChange(event.target.value)}
            placeholder="Filter components"
            value={filter}
          />
        </div>

        <button
          aria-label="Toggle component sort order"
          className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-xs hover:bg-[color:var(--bg-hover)]"
          onClick={onToggleSort}
          type="button"
        >
          {sort === 'asc' ? <ArrowDownAZ size={12} /> : <ArrowUpAZ size={12} />}
          {sort === 'asc' ? 'A→Z' : 'Z→A'}
        </button>
      </div>

      <div
        className="flex-1 overflow-auto p-2"
        onKeyDown={(event) => {
          if (!filtered.length) {
            return;
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            const nextIndex = selectedIndex < 0 ? 0 : Math.min(filtered.length - 1, selectedIndex + 1);
            onSelect(filtered[nextIndex].id);
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            const nextIndex = selectedIndex < 0 ? filtered.length - 1 : Math.max(0, selectedIndex - 1);
            onSelect(filtered[nextIndex].id);
          }

          if (event.key === 'Enter' && selectedIndex >= 0) {
            event.preventDefault();
            onSelect(filtered[selectedIndex].id);
          }
        }}
        role="listbox"
        tabIndex={0}
      >
        {filtered.map((component) => {
          const active = component.id === selectedComponentId;

          return (
            <button
              aria-label={`Open ${component.name}`}
              className={`mb-1 flex w-full items-center justify-between rounded-lg border px-2 py-2 text-left transition-colors ${
                active
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10'
                  : 'border-transparent hover:bg-[color:var(--bg-hover)]'
              }`}
              key={component.id}
              onClick={() => onSelect(component.id)}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText size={14} className="shrink-0 text-[color:var(--text-muted)]" />
                <span className="truncate">{component.name}</span>
              </span>
              <span className="ml-2 shrink-0 text-[11px] text-[color:var(--text-muted)]">
                {(component.sizeBytes / 1024).toFixed(1)} KB
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
