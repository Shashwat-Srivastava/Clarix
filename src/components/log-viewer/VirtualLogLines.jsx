import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { renderHighlightedText } from '../telemetry-viewer/text-highlighter.jsx';

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
  globalQuery = '',
  globalActiveMatchLine = null,
  globalMatchedLines = [],
  localActiveMatchLine,
  localMatchedLines = [],
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
    const activeLine = localActiveMatchLine ?? globalActiveMatchLine;
    if (!activeLine) {
      return;
    }

    const index = activeLine - 1;
    if (index >= 0 && index < lines.length) {
      rowVirtualizer.scrollToIndex(index, { align: 'center' });
    }
  }, [globalActiveMatchLine, lines.length, localActiveMatchLine, rowVirtualizer]);

  const items = rowVirtualizer.getVirtualItems();

  const lineClassCache = useMemo(
    () => lines.map((line) => getLevelClass(line)),
    [lines],
  );
  const globalMatchedLineSet = useMemo(
    () => new Set(globalMatchedLines),
    [globalMatchedLines],
  );
  const localMatchedLineSet = useMemo(
    () => new Set(localMatchedLines),
    [localMatchedLines],
  );
  const highlightQueries = useMemo(
    () => [
      { query: globalQuery, tone: 'global' },
      { query, tone: 'local' },
    ],
    [globalQuery, query],
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
          const localActive = localActiveMatchLine === lineNumber;
          const globalActive = globalActiveMatchLine === lineNumber;
          const localMatched = localMatchedLineSet.has(lineNumber);
          const globalMatched = globalMatchedLineSet.has(lineNumber);

          return (
            <div
              className={`absolute left-0 right-0 flex gap-3 border-b border-[color:var(--border)]/40 px-3 text-left ${
                localActive
                  ? 'bg-[color:var(--accent)]/20'
                  : globalActive
                    ? 'bg-sky-500/15'
                    : localMatched
                      ? 'bg-yellow-300/8'
                      : globalMatched
                        ? 'bg-sky-300/8'
                        : ''
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
                {renderHighlightedText(line, highlightQueries)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
