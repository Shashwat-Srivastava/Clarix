import { ListFilter, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

/**
 * Column visibility selector popover.
 *
 * @param {{columns:string[],visibleColumns:Object,onChange:(next:Object)=>void}} props
 */
export default function ColumnSelector({ columns, visibleColumns, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return columns.filter((column) => column.toLowerCase().includes(needle));
  }, [columns, query]);

  return (
    <div className="relative">
      <button
        aria-label="Select table columns"
        className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-1.5 hover:bg-[color:var(--bg-hover)]"
        onClick={() => setOpen((state) => !state)}
        type="button"
      >
        <ListFilter size={14} />
        Columns
      </button>

      {open ? (
        <div className="absolute right-0 z-[80] mt-2 w-96 max-w-[80vw] rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-panel)] p-3 shadow-2xl">
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-2">
            <Search size={13} className="text-[color:var(--text-muted)]" />
            <input
              aria-label="Search columns"
              className="h-7 w-full bg-transparent text-xs outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search columns"
              value={query}
            />
          </div>

          <div className="mb-2 flex gap-2 text-xs">
            <button
              aria-label="Select all columns"
              className="rounded border border-[color:var(--border)] px-2 py-1 hover:bg-[color:var(--bg-hover)]"
              onClick={() => {
                const next = {};
                for (const column of columns) {
                  next[column] = true;
                }
                onChange(next);
              }}
              type="button"
            >
              Select All
            </button>
            <button
              aria-label="Deselect all columns"
              className="rounded border border-[color:var(--border)] px-2 py-1 hover:bg-[color:var(--bg-hover)]"
              onClick={() => {
                const next = {};
                for (const column of columns) {
                  next[column] = false;
                }
                onChange(next);
              }}
              type="button"
            >
              Deselect All
            </button>
          </div>

          <div className="max-h-64 space-y-1 overflow-auto">
            {filtered.map((column) => (
              <label className="flex items-center gap-2 text-xs" key={column}>
                <input
                  checked={visibleColumns[column] !== false}
                  onChange={(event) =>
                    onChange({
                      ...visibleColumns,
                      [column]: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                <span>{column}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
