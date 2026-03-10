import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * Highlights query substrings in a line.
 *
 * @param {string} text
 * @param {string} query
 * @returns {React.ReactNode}
 */
function renderHighlighted(text, query) {
  if (!query.trim()) {
    return text;
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'ig'));

  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark className="rounded bg-yellow-300/60 px-0.5 text-inherit" key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

/**
 * Returns line-level class by inferred log severity.
 *
 * @param {string} line
 * @returns {string}
 */
function getLevelClass(line) {
  const value = line.toUpperCase();

  const hasInfoToken = /\bINFO\b/.test(value) || /\bT2\.INFO\b/.test(value);
  const hasWarnToken = /\bWARN(?:ING)?\b/.test(value) || /\bT2\.WARN(?:ING)?\b/.test(value);
  const hasErrorToken = /\bERROR\b/.test(value) || /\bFATAL\b/.test(value) || /\bT2\.(ERROR|FATAL)\b/.test(value);
  const hasDebugToken = /\bDEBUG\b/.test(value) || /\bTRACE\b/.test(value) || /\bT2\.(DEBUG|TRACE)\b/.test(value);

  // INFO-tagged lines must never appear as error-highlighted.
  if (hasInfoToken) {
    return 'text-[color:var(--text-primary)]';
  }

  if (hasErrorToken) {
    return 'text-[color:var(--danger)]';
  }

  if (hasWarnToken) {
    return 'text-[color:var(--warning)]';
  }

  if (hasDebugToken) {
    return 'text-[color:var(--text-muted)]';
  }

  return 'text-[color:var(--text-primary)]';
}

/**
 * Virtualized log line renderer.
 *
 * @param {Object} props
 */
export default function VirtualLogLines({
  lines,
  wrapLines,
  query,
  activeMatchLine,
  onLineClick,
  onReachEnd,
}) {
  const parentRef = useRef(null);
  const [rowWidth, setRowWidth] = useState(0);

  const updateRowWidth = useCallback(() => {
    const parent = parentRef.current;
    if (!parent) {
      return;
    }

    const nextWidth = wrapLines
      ? parent.clientWidth
      : Math.max(parent.clientWidth, parent.scrollWidth);
    setRowWidth((previous) => (previous === nextWidth ? previous : nextWidth));
  }, [wrapLines]);

  const rowVirtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (wrapLines ? 24 : 22),
    measureElement: (element) => element?.getBoundingClientRect().height,
    overscan: 20,
  });

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) {
      return;
    }

    const onScroll = () => {
      const nearBottom = parent.scrollTop + parent.clientHeight >= parent.scrollHeight - 600;
      if (nearBottom) {
        onReachEnd?.();
      }
    };

    parent.addEventListener('scroll', onScroll);
    return () => parent.removeEventListener('scroll', onScroll);
  }, [onReachEnd]);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) {
      return;
    }

    updateRowWidth();

    const rafId = requestAnimationFrame(updateRowWidth);
    const onResize = () => updateRowWidth();

    window.addEventListener('resize', onResize);
    parent.addEventListener('scroll', onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      parent.removeEventListener('scroll', onResize);
    };
  }, [lines, updateRowWidth, wrapLines]);

  useEffect(() => {
    if (!activeMatchLine) {
      return;
    }

    const index = activeMatchLine - 1;
    if (index >= 0 && index < lines.length) {
      rowVirtualizer.scrollToIndex(index, { align: 'center' });
    }
  }, [activeMatchLine, lines.length, rowVirtualizer]);

  const items = rowVirtualizer.getVirtualItems();

  const lineClassCache = useMemo(
    () => lines.map((line) => getLevelClass(line)),
    [lines],
  );

  return (
    <div className="mono-log h-full w-full overflow-auto" ref={parentRef}>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: 'relative',
          width: rowWidth > 0 ? `${rowWidth}px` : '100%',
        }}
      >
        {items.map((virtualRow) => {
          const lineNumber = virtualRow.index + 1;
          const line = lines[virtualRow.index] ?? '';
          const active = activeMatchLine === lineNumber;

          return (
            <div
              className={`absolute left-0 right-0 flex gap-3 border-b border-[color:var(--border)]/40 px-3 text-left ${
                active ? 'bg-[color:var(--accent)]/20' : ''
              }`}
              data-index={virtualRow.index}
              key={virtualRow.key}
              onClick={(event) => onLineClick(line, lineNumber, event)}
              ref={rowVirtualizer.measureElement}
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                width: rowWidth > 0 ? `${rowWidth}px` : '100%',
              }}
            >
              <span className="w-14 shrink-0 select-none border-r border-[color:var(--border)]/40 pr-2 text-right text-[10px] text-[color:var(--text-muted)]">
                {lineNumber}
              </span>
              <span
                className={`min-w-0 flex-1 select-text ${lineClassCache[virtualRow.index]}`}
                style={{
                  whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
                  overflowWrap: wrapLines ? 'anywhere' : 'normal',
                  wordBreak: wrapLines ? 'break-word' : 'normal',
                }}
              >
                {renderHighlighted(line, query)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
