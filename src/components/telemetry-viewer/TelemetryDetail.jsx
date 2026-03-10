import { ChevronDown, ChevronUp, Copy, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JsonRenderer from './JsonRenderer.jsx';

/**
 * Returns whether a value is a non-null object or array.
 *
 * @param {any} value
 * @returns {boolean}
 */
function isComplex(value) {
  return value != null && typeof value === 'object';
}

/**
 * Flattens JSON into searchable path entries.
 *
 * @param {any} value
 * @param {string} path
 * @returns {Array<{path:string,text:string}>}
 */
function collectSearchEntries(value, path = 'root') {
  const output = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      if (isComplex(item)) {
        output.push(...collectSearchEntries(item, itemPath));
      } else {
        output.push({ path: itemPath, text: String(item) });
      }
    });
    return output;
  }

  if (isComplex(value)) {
    Object.entries(value).forEach(([key, childValue]) => {
      const childPath = path === 'root' ? key : `${path}.${key}`;
      output.push({ path: childPath, text: key });

      if (isComplex(childValue)) {
        output.push(...collectSearchEntries(childValue, childPath));
      } else {
        output.push({ path: childPath, text: `${key}: ${String(childValue)}` });
      }
    });
    return output;
  }

  output.push({ path, text: String(value) });
  return output;
}

/**
 * Telemetry detail pane for one selected report.
 *
 * @param {{report:any,formattedTimestamp:string}} props
 */
export default function TelemetryDetail({ report, formattedTimestamp }) {
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

  const searchEntries = useMemo(() => {
    if (!report?.data) {
      return [];
    }
    return collectSearchEntries(report.data);
  }, [report?.data]);

  const matchedPaths = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    const matched = searchEntries
      .filter((entry) => entry.text.toLowerCase().includes(query))
      .map((entry) => entry.path);

    return [...new Set(matched)];
  }, [searchEntries, searchQuery]);

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

  useEffect(() => {
    if (!activeMatchPath) {
      return;
    }

    const node = nodeRefs.current.get(activeMatchPath);
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeMatchPath]);

  const matchedPathSet = useMemo(() => new Set(matchedPaths), [matchedPaths]);

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
          <button
            aria-label="Copy JSON"
            className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-1.5 hover:bg-[color:var(--bg-hover)]"
            onClick={() => navigator.clipboard.writeText(JSON.stringify(outputData, null, 2))}
            type="button"
          >
            <Copy size={14} />
            Copy JSON
          </button>
        </div>

        {report.data ? (
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] p-2">
            <Search size={14} className="text-[color:var(--text-muted)]" />
            <input
              aria-label="Search telemetry JSON"
              className="h-7 w-full bg-transparent outline-none"
              onChange={(event) => setSearchQuery(event.target.value)}
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
            activeMatchPath={activeMatchPath}
            matchedPaths={matchedPathSet}
            registerNodeRef={registerNodeRef}
            searchQuery={searchQuery}
            value={report.data}
          />
        ) : (
          <pre>{report.rawJson}</pre>
        )}
      </div>
    </div>
  );
}
