import { Copy, Download, WrapText } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useLogReader } from '../../hooks/useLogReader.js';
import LogSearchBar from './LogSearchBar.jsx';
import VirtualLogLines from './VirtualLogLines.jsx';

const LINE_TIMESTAMP_REGEX = /^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/;

/**
 * Main log content pane.
 *
 * @param {{sessionId:string,component:Object|null,wrapLines:boolean,onToggleWrap:()=>void,globalSearchQuery?:string,globalActiveMatchLine?:number|null,globalMatchedLines?:number[]}} props
 */
export default function LogPane({
  sessionId,
  component,
  wrapLines,
  onToggleWrap,
  globalSearchQuery = '',
  globalActiveMatchLine = null,
  globalMatchedLines = [],
}) {
  const {
    lines,
    eof,
    isLoadingChunk,
    error,
    searchQuery,
    setSearchQuery,
    matches,
    totalMatches,
    activeMatchIndex,
    activeMatch,
    nextMatch,
    previousMatch,
    loadNextChunk,
    copyEntireLog,
  } = useLogReader(sessionId, component?.id);
  const localMatchedLines = useMemo(
    () => matches.map((match) => match.lineNumber),
    [matches],
  );
  const scrollTargetLine = activeMatch?.lineNumber ?? globalActiveMatchLine;

  useEffect(() => {
    const onKeydown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        const input = document.getElementById('log-search-input');
        if (input) {
          event.preventDefault();
          input.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, []);

  useEffect(() => {
    if (!scrollTargetLine || eof || isLoadingChunk || lines.length >= scrollTargetLine) {
      return;
    }

    loadNextChunk();
  }, [eof, isLoadingChunk, lines.length, loadNextChunk, scrollTargetLine]);

  if (!component) {
    return (
      <div className="grid h-full place-items-center text-[color:var(--text-muted)]">
        ← Select a component to view its log
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[color:var(--border)] p-3">
        <div className="flex-1">
          <LogSearchBar
            activeIndex={activeMatchIndex}
            onNext={nextMatch}
            onPrevious={previousMatch}
            onQueryChange={setSearchQuery}
            query={searchQuery}
            totalMatches={totalMatches}
          />
        </div>

        <button
          aria-label="Toggle line wrapping"
          className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-2 hover:bg-[color:var(--bg-hover)]"
          onClick={onToggleWrap}
          type="button"
        >
          <WrapText size={14} />
          Wrap
        </button>

        <button
          aria-label="Download merged logs as zip"
          className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-2 hover:bg-[color:var(--bg-hover)]"
          onClick={async () => {
            try {
              await window.electronAPI.exportMergedLogs();
            } catch {
              // Keep viewer responsive even if export fails or is cancelled.
            }
          }}
          type="button"
        >
          <Download size={14} />
          Merged logs
        </button>

        <button
          aria-label="Copy full log"
          className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-2 hover:bg-[color:var(--bg-hover)]"
          onClick={copyEntireLog}
          type="button"
        >
          <Copy size={14} />
          Copy
        </button>
      </div>

      {component.sizeBytes > 500 * 1024 * 1024 ? (
        <div className="border-b border-[color:var(--border)] bg-[color:var(--warning)]/10 px-3 py-2 text-xs text-[color:var(--warning)]">
          This file is larger than 500MB. Viewer will progressively load chunks.
        </div>
      ) : null}

      {error ? (
        <div className="border-b border-[color:var(--border)] bg-[color:var(--danger)]/10 px-3 py-2 text-xs text-[color:var(--danger)]">
          {error}
        </div>
      ) : null}

      <div className="h-[calc(100%-56px)]">
        <VirtualLogLines
          globalActiveMatchLine={globalActiveMatchLine}
          globalMatchedLines={globalMatchedLines}
          globalQuery={globalSearchQuery}
          localActiveMatchLine={activeMatch?.lineNumber}
          localMatchedLines={localMatchedLines}
          lines={lines}
          onLineClick={async (line) => {
            const selectedText = window.getSelection()?.toString();
            if (selectedText?.trim()) {
              return;
            }
            const timestampMatch = line.match(LINE_TIMESTAMP_REGEX);
            if (timestampMatch?.[1]) {
              await navigator.clipboard.writeText(timestampMatch[1]);
            }
          }}
          onReachEnd={loadNextChunk}
          query={searchQuery}
          wrapLines={wrapLines}
        />
      </div>

      <div className="flex items-center justify-between border-t border-[color:var(--border)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
        <span>{eof ? 'End of file reached' : isLoadingChunk ? 'Loading more lines…' : 'Scroll to load more'}</span>
        {!eof ? (
          <button
            aria-label="Load more lines"
            className="rounded border border-[color:var(--border)] px-2 py-1 hover:bg-[color:var(--bg-hover)]"
            onClick={loadNextChunk}
            type="button"
          >
            Load more
          </button>
        ) : null}
      </div>
    </div>
  );
}
