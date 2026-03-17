import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ColumnSelector from './ColumnSelector.jsx';
import ExportButton from './ExportButton.jsx';

const columnHelper = createColumnHelper();

/**
 * Telemetry table with virtualized rows and dynamic columns.
 *
 * @param {Object} props
 */
export default function TelemetryTable({
  rows,
  visibleColumns,
  onVisibleColumnsChange,
  onExport,
}) {
  const [sorting, setSorting] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchRowIndex, setActiveSearchRowIndex] = useState(0);
  const parentRef = useRef(null);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return rows;
    }

    return rows.filter((row) => {
      const hasValueMatch = Object.values(row).some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(query),
      );

      if (hasValueMatch) {
        return true;
      }

      return Object.keys(row).some((key) => key.toLowerCase().includes(query));
    });
  }, [rows, searchQuery]);

  useEffect(() => {
    setActiveSearchRowIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (!filteredRows.length) {
      setActiveSearchRowIndex(0);
      return;
    }

    setActiveSearchRowIndex((previous) => {
      if (previous < 0) {
        return 0;
      }
      if (previous >= filteredRows.length) {
        return filteredRows.length - 1;
      }
      return previous;
    });
  }, [filteredRows.length]);

  const columnNames = useMemo(() => {
    const names = new Set(['Timestamp']);

    for (const row of rows) {
      for (const key of Object.keys(row)) {
        names.add(key);
      }
    }

    return [...names];
  }, [rows]);

  const resolvedVisibility = visibleColumns ?? {};

  const applyVisibilityChange = (updater) => {
    const next = typeof updater === 'function' ? updater(resolvedVisibility) : updater;
    onVisibleColumnsChange(next);
  };

  useEffect(() => {
    if (visibleColumns) {
      return;
    }

    const next = {};
    for (const name of columnNames) {
      next[name] = true;
    }

    onVisibleColumnsChange(next);
  }, [columnNames, onVisibleColumnsChange, visibleColumns]);

  const columns = useMemo(() => {
    return columnNames.map((columnName) =>
      columnHelper.accessor((row) => row[columnName] ?? '', {
        id: columnName,
        header: columnName,
        size: columnName === 'Timestamp' ? 260 : 220,
        minSize: columnName === 'Timestamp' ? 220 : 140,
        enableSorting: true,
      }),
    );
  }, [columnNames]);

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: {
      sorting,
      columnVisibility: resolvedVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: applyVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  });

  const allRows = table.getRowModel().rows;
  const visibleLeafColumns = table.getVisibleLeafColumns();
  const totalWidth = Math.max(table.getTotalSize(), 900);

  const gridTemplateColumns = useMemo(
    () => visibleLeafColumns.map((column) => `${column.getSize()}px`).join(' '),
    [visibleLeafColumns],
  );

  const rowVirtualizer = useVirtualizer({
    count: allRows.length,
    estimateSize: () => 44,
    getScrollElement: () => parentRef.current,
    overscan: 20,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="relative z-40 flex items-center justify-between border-b border-[color:var(--border)] p-3">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold">Telemetry Table View</div>
          <div className="text-xs text-[color:var(--text-muted)]">
            {filteredRows.length} / {rows.length} rows
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-2">
            <Search size={13} className="text-[color:var(--text-muted)]" />
            <input
              aria-label="Search telemetry table"
              className="h-8 w-56 bg-transparent text-xs outline-none"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || !filteredRows.length) {
                  return;
                }

                event.preventDefault();
                setActiveSearchRowIndex((index) => {
                  const nextIndex = (index + 1) % filteredRows.length;
                  rowVirtualizer.scrollToIndex(nextIndex, { align: 'center' });
                  return nextIndex;
                });
              }}
              placeholder="Search table"
              value={searchQuery}
            />
          </div>

          <ColumnSelector
            columns={columnNames}
            onChange={applyVisibilityChange}
            visibleColumns={resolvedVisibility}
          />

          <ExportButton
            onClick={() => onExport?.(visibleLeafColumns.map((column) => column.id))}
          />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto" ref={parentRef}>
        <div className="relative" style={{ width: `${totalWidth}px` }}>
          <div className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color:var(--bg-panel)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <div
                className="grid"
                key={headerGroup.id}
                style={{ gridTemplateColumns, width: `${totalWidth}px` }}
              >
                {headerGroup.headers.map((header, headerIndex) => {
                  const sorted = header.column.getIsSorted();

                  return (
                    <div
                      className={`relative flex items-center gap-2 border-r border-[color:var(--border)]/40 px-3 py-2 text-xs font-semibold ${
                        headerIndex === 0 ? 'sticky left-0 z-30 bg-[color:var(--bg-panel)]' : ''
                      }`}
                      key={header.id}
                    >
                      <button
                        aria-label={`Sort by ${header.column.id}`}
                        className="inline-flex min-w-0 items-center gap-1"
                        onClick={header.column.getToggleSortingHandler()}
                        type="button"
                      >
                        <span className="truncate">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {sorted === 'asc' ? (
                          <ArrowUp size={12} />
                        ) : sorted === 'desc' ? (
                          <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={12} className="text-[color:var(--text-muted)]" />
                        )}
                      </button>

                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-[color:var(--accent)]"
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        role="separator"
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
              width: `${totalWidth}px`,
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = allRows[virtualRow.index];
              const isActiveSearchRow = virtualRow.index === activeSearchRowIndex && Boolean(searchQuery.trim());

              return (
                <div
                  className={`group absolute left-0 grid border-b border-[color:var(--border)]/50 hover:bg-[color:var(--bg-hover)] ${
                    isActiveSearchRow ? 'bg-[color:var(--accent)]/8' : ''
                  }`}
                  key={row.id}
                  style={{
                    gridTemplateColumns,
                    transform: `translateY(${virtualRow.start}px)`,
                    height: `${virtualRow.size}px`,
                    width: `${totalWidth}px`,
                  }}
                >
                  {row.getVisibleCells().map((cell, cellIndex) => (
                    <div
                      className={`truncate border-r border-[color:var(--border)]/20 px-3 py-2 ${
                        cellIndex === 0
                          ? `sticky left-0 z-10 ${
                              isActiveSearchRow
                                ? 'bg-[color:var(--accent)]/8 group-hover:bg-[color:var(--accent)]/10'
                                : 'bg-[color:var(--bg-panel)] group-hover:bg-[color:var(--bg-hover)]'
                            }`
                          : ''
                      }`}
                      key={cell.id}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
