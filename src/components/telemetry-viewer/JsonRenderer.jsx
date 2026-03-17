import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { renderHighlightedText } from './text-highlighter.jsx';

/**
 * Formats primitive values with color coding.
 *
 * @param {any} value
 * @param {Array<{query?:string,tone:'global'|'local'}>} highlightQueries
 * @returns {React.ReactNode}
 */
function renderPrimitive(value, highlightQueries) {
  if (value == null) {
    return <span className="text-purple-400">null</span>;
  }

  if (typeof value === 'string') {
    return <span className="text-green-400">"{renderHighlightedText(value, highlightQueries)}"</span>;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="text-sky-400">{renderHighlightedText(String(value), highlightQueries)}</span>;
  }

  return <span>{renderHighlightedText(String(value), highlightQueries)}</span>;
}

/**
 * Checks whether a value is a non-null object or array.
 *
 * @param {any} value
 * @returns {boolean}
 */
function isComplex(value) {
  return value != null && typeof value === 'object';
}

/**
 * Collapsible JSON renderer with key-first display and search highlighting.
 *
 * @param {{
 *  value:any,
 *  path?:string,
 *  depth?:number,
 *  localSearchQuery?:string,
 *  localMatchedPaths?:Set<string>,
 *  localActiveMatchPath?:string|null,
 *  globalSearchQuery?:string,
 *  globalMatchedPaths?:Set<string>,
 *  globalActiveMatchPath?:string|null,
 *  registerNodeRef?:(path:string,node:HTMLElement|null)=>void,
 * }} props
 */
export default function JsonRenderer({
  value,
  path = 'root',
  depth = 0,
  localSearchQuery = '',
  localMatchedPaths = new Set(),
  localActiveMatchPath = null,
  globalSearchQuery = '',
  globalMatchedPaths = new Set(),
  globalActiveMatchPath = null,
  registerNodeRef,
}) {
  const [collapsedPaths, setCollapsedPaths] = useState({});

  const matchedPathList = useMemo(
    () => [...new Set([...localMatchedPaths, ...globalMatchedPaths])],
    [globalMatchedPaths, localMatchedPaths],
  );
  const highlightQueries = useMemo(
    () => [
      { query: globalSearchQuery, tone: 'global' },
      { query: localSearchQuery, tone: 'local' },
    ],
    [globalSearchQuery, localSearchQuery],
  );
  const hasSearchQuery = Boolean(globalSearchQuery.trim() || localSearchQuery.trim());

  if (!isComplex(value)) {
    return (
      <div data-json-path={path} ref={(node) => registerNodeRef?.(path, node)}>
        {renderPrimitive(value, highlightQueries)}
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div
        className={`${depth > 0 ? 'ml-4 border-l border-[color:var(--border)] pl-3' : ''} space-y-0.5`}
        data-json-path={path}
        ref={(node) => registerNodeRef?.(path, node)}
      >
        {value.map((item, index) => {
          const itemPath = `${path}[${index}]`;

          if (isComplex(item)) {
            return (
              <JsonRenderer
                globalActiveMatchPath={globalActiveMatchPath}
                depth={depth + 1}
                globalMatchedPaths={globalMatchedPaths}
                globalSearchQuery={globalSearchQuery}
                key={itemPath}
                localActiveMatchPath={localActiveMatchPath}
                localMatchedPaths={localMatchedPaths}
                localSearchQuery={localSearchQuery}
                path={itemPath}
                registerNodeRef={registerNodeRef}
                value={item}
              />
            );
          }

          const localActive = localActiveMatchPath === itemPath;
          const globalActive = globalActiveMatchPath === itemPath;
          const localMatched = localMatchedPaths.has(itemPath);
          const globalMatched = globalMatchedPaths.has(itemPath);

          return (
            <div
              className={`py-0.5 ${
                localActive
                  ? 'rounded bg-[color:var(--accent)]/20 px-1'
                  : globalActive
                    ? 'rounded bg-sky-500/15 px-1'
                    : ''
              } ${localMatched ? 'bg-yellow-300/15' : globalMatched ? 'bg-sky-300/10' : ''}`}
              data-json-path={itemPath}
              key={itemPath}
              ref={(node) => registerNodeRef?.(itemPath, node)}
            >
              {renderPrimitive(item, highlightQueries)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`${depth > 0 ? 'ml-4 border-l border-[color:var(--border)] pl-3' : ''} space-y-0.5`}
      data-json-path={path}
      ref={(node) => registerNodeRef?.(path, node)}
    >
      {Object.entries(value).map(([key, childValue]) => {
        const childPath = path === 'root' ? key : `${path}.${key}`;

        if (!isComplex(childValue)) {
          const localActive = localActiveMatchPath === childPath;
          const globalActive = globalActiveMatchPath === childPath;
          const localMatched = localMatchedPaths.has(childPath);
          const globalMatched = globalMatchedPaths.has(childPath);

          return (
            <div
              className={`py-0.5 ${
                localActive
                  ? 'rounded bg-[color:var(--accent)]/20 px-1'
                  : globalActive
                    ? 'rounded bg-sky-500/15 px-1'
                    : ''
              } ${localMatched ? 'bg-yellow-300/15' : globalMatched ? 'bg-sky-300/10' : ''}`}
              data-json-path={childPath}
              key={childPath}
              ref={(node) => registerNodeRef?.(childPath, node)}
            >
              <span className="text-orange-300">{renderHighlightedText(key, highlightQueries)}</span>
              <span className="text-[color:var(--text-muted)]">: </span>
              {renderPrimitive(childValue, highlightQueries)}
            </div>
          );
        }

        const manuallyCollapsed = Boolean(collapsedPaths[childPath]);
        const containsMatchedDescendant = matchedPathList.some(
          (matchPath) =>
            matchPath === childPath ||
            matchPath.startsWith(`${childPath}.`) ||
            matchPath.startsWith(`${childPath}[`),
        );
        const isCollapsed = hasSearchQuery && containsMatchedDescendant ? false : manuallyCollapsed;

        return (
          <div key={childPath}>
            <button
              aria-label={`Toggle ${key}`}
              className="inline-flex items-center gap-1 py-0.5 text-[color:var(--text-primary)]"
              onClick={() => {
                setCollapsedPaths((previous) => ({
                  ...previous,
                  [childPath]: !previous[childPath],
                }));
              }}
              type="button"
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              <span className="text-orange-300">{renderHighlightedText(key, highlightQueries)}</span>
              <span className="text-[color:var(--text-muted)]">:</span>
            </button>

            {!isCollapsed ? (
              <JsonRenderer
                globalActiveMatchPath={globalActiveMatchPath}
                depth={depth + 1}
                globalMatchedPaths={globalMatchedPaths}
                globalSearchQuery={globalSearchQuery}
                localActiveMatchPath={localActiveMatchPath}
                localMatchedPaths={localMatchedPaths}
                localSearchQuery={localSearchQuery}
                path={childPath}
                registerNodeRef={registerNodeRef}
                value={childValue}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
