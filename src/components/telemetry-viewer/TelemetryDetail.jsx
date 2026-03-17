import { ChevronDown, ChevronUp, Copy, Download, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JsonRenderer from './JsonRenderer.jsx';
import { findTelemetryMatchPaths } from './search-utils.js';
import { renderHighlightedText } from './text-highlighter.jsx';

/**
 * Telemetry detail pane for one selected report.
 *
 * @param {{report:any,formattedTimestamp:string,globalSearchQuery?:string,globalMatchedPaths?:string[],globalActiveMatchPath?:string|null}} props
 */
export default function TelemetryDetail({
  report,
  formattedTimestamp,
  globalSearchQuery = '',
  globalMatchedPaths = [],
  globalActiveMatchPath = null,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const nodeRefs = useRef(new Map());

  const registerNodeRef = useCallback((path, node) => {
    if (node) {
      nodeRefs.current.set(path, node);
      return;
    }
    nodeRefs.current.delete(path);
  }, []);

  useEffect(() => {
    setSearchQuery('');
    setActiveMatchIndex(0);
  }, [report?.sequenceNumber]);
  const outputData = report?.data ?? report?.rawJson ?? null;

  const matchedPaths = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    return findTelemetryMatchPaths(report, searchQuery);
  }, [report, searchQuery]);

  useEffect(() => {
    if (!matchedPaths.length) {
      setActiveMatchIndex(0);
      return;
    }

    setActiveMatchIndex((previous) => {
      if (previous < 0) {
        return 0;
      }
      if (previous >= matchedPaths.length) {
        return matchedPaths.length - 1;
      }
      return previous;
    });
  }, [matchedPaths]);

  const activeMatchPath = matchedPaths.length ? matchedPaths[activeMatchIndex] : null;
  const scrollTargetPath = activeMatchPath ?? globalActiveMatchPath;

  useEffect(() => {
    if (!scrollTargetPath) {
      return;
    }

    const node = nodeRefs.current.get(scrollTargetPath);
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [scrollTargetPath]);

  const matchedPathSet = useMemo(() => new Set(matchedPaths), [matchedPaths]);
  const globalMatchedPathSet = useMemo(() => new Set(globalMatchedPaths), [globalMatchedPaths]);
  const outputJson = useMemo(
    () => (typeof outputData === 'string' ? outputData : JSON.stringify(outputData ?? null, null, 2)),
    [outputData],
  );
  const downloadFileName = useMemo(() => {
    const sequence = report?.sequenceNumber ?? 'report';
    return `telemetry-report-${sequence}.json`;
  }, [report?.sequenceNumber]);

  if (!report) {
    return (
      <div className="grid h-full place-items-center text-[color:var(--text-muted)]">
        ← Select a telemetry report
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[color:var(--border)] px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-xs text-[color:var(--text-muted)]">Report #{report.sequenceNumber}</div>
            <div className="font-semibold">{formattedTimestamp}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Copy JSON"
              className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-1.5 hover:bg-[color:var(--bg-hover)]"
              onClick={() => navigator.clipboard.writeText(outputJson)}
              type="button"
            >
              <Copy size={14} />
              Copy JSON
            </button>
            <button
              aria-label="Download JSON"
              className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-1.5 hover:bg-[color:var(--bg-hover)]"
              onClick={() => window.electronAPI.exportJson(outputData, downloadFileName)}
              type="button"
            >
              <Download size={14} />
              Download JSON
            </button>
          </div>
        </div>

        {report.data ? (
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] p-2">
            <Search size={14} className="text-[color:var(--text-muted)]" />
            <input
              aria-label="Search telemetry JSON"
              className="h-7 w-full bg-transparent outline-none"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || !matchedPaths.length) {
                  return;
                }

                event.preventDefault();
                setActiveMatchIndex((index) => (index + 1) % matchedPaths.length);
              }}
              placeholder="Search JSON"
              value={searchQuery}
            />
            <span className="text-xs text-[color:var(--text-muted)]">
              {matchedPaths.length ? `${activeMatchIndex + 1} of ${matchedPaths.length}` : '0 matches'}
            </span>
            <button
              aria-label="Previous JSON match"
              className="rounded border border-[color:var(--border)] p-1 hover:bg-[color:var(--bg-hover)]"
              onClick={() => {
                if (!matchedPaths.length) {
                  return;
                }
                setActiveMatchIndex((index) => (index - 1 + matchedPaths.length) % matchedPaths.length);
              }}
              type="button"
            >
              <ChevronUp size={14} />
            </button>
            <button
              aria-label="Next JSON match"
              className="rounded border border-[color:var(--border)] p-1 hover:bg-[color:var(--bg-hover)]"
              onClick={() => {
                if (!matchedPaths.length) {
                  return;
                }
                setActiveMatchIndex((index) => (index + 1) % matchedPaths.length);
              }}
              type="button"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="mono-log flex-1 overflow-auto p-4">
        {report.parseError ? (
          <div className="mb-3 rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 p-2 text-[color:var(--danger)]">
            Telemetry JSON parse error: {report.parseError}
          </div>
        ) : null}
        {report.data ? (
          <JsonRenderer
            globalActiveMatchPath={globalActiveMatchPath}
            globalMatchedPaths={globalMatchedPathSet}
            globalSearchQuery={globalSearchQuery}
            localActiveMatchPath={activeMatchPath}
            localMatchedPaths={matchedPathSet}
            localSearchQuery={searchQuery}
            registerNodeRef={registerNodeRef}
            value={report.data}
          />
        ) : (
          <pre ref={(node) => registerNodeRef('root', node)}>
            {renderHighlightedText(report.rawJson ?? '', [
              { query: globalSearchQuery, tone: 'global' },
              { query: searchQuery, tone: 'local' },
            ])}
          </pre>
        )}
      </div>
    </div>
  );
}
