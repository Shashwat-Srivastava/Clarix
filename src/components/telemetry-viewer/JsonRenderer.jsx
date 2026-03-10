import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

/**
 * Highlights search matches in text.
 *
 * @param {string} text
 * @param {string} query
 * @returns {React.ReactNode}
 */
function renderHighlighted(text, query) {
  if (!query?.trim()) {
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
 * Formats primitive values with color coding.
 *
 * @param {any} value
 * @param {string} query
 * @returns {React.ReactNode}
 */
function renderPrimitive(value, query) {
  if (value == null) {
    return <span className="text-purple-400">null</span>;
  }

  if (typeof value === 'string') {
    return <span className="text-green-400">"{renderHighlighted(value, query)}"</span>;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="text-sky-400">{renderHighlighted(String(value), query)}</span>;
  }

  return <span>{renderHighlighted(String(value), query)}</span>;
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
 *  searchQuery?:string,
 *  matchedPaths?:Set<string>,
 *  activeMatchPath?:string|null,
 *  registerNodeRef?:(path:string,node:HTMLElement|null)=>void,
 * }} props
 */
export default function JsonRenderer({
  value,
  path = 'root',
  depth = 0,
  searchQuery = '',
  matchedPaths = new Set(),
  activeMatchPath = null,
  registerNodeRef,
}) {
  const [collapsedPaths, setCollapsedPaths] = useState({});

  const matchedPathList = useMemo(() => [...matchedPaths], [matchedPaths]);

  if (!isComplex(value)) {
    return <div>{renderPrimitive(value, searchQuery)}</div>;
  }

  if (Array.isArray(value)) {
    return (
      <div className={`${depth > 0 ? 'ml-4 border-l border-[color:var(--border)] pl-3' : ''} space-y-0.5`}>
        {value.map((item, index) => {
          const itemPath = `${path}[${index}]`;

          if (isComplex(item)) {
            return (
              <JsonRenderer
                activeMatchPath={activeMatchPath}
                depth={depth + 1}
                key={itemPath}
                matchedPaths={matchedPaths}
                path={itemPath}
                registerNodeRef={registerNodeRef}
                searchQuery={searchQuery}
                value={item}
              />
            );
          }

          const active = activeMatchPath === itemPath;
          const matched = matchedPaths.has(itemPath);

          return (
            <div
              className={`py-0.5 ${active ? 'rounded bg-[color:var(--accent)]/20 px-1' : ''} ${matched ? 'bg-yellow-300/15' : ''}`}
              data-json-path={itemPath}
              key={itemPath}
              ref={(node) => registerNodeRef?.(itemPath, node)}
            >
              {renderPrimitive(item, searchQuery)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`${depth > 0 ? 'ml-4 border-l border-[color:var(--border)] pl-3' : ''} space-y-0.5`}>
      {Object.entries(value).map(([key, childValue]) => {
        const childPath = path === 'root' ? key : `${path}.${key}`;

        if (!isComplex(childValue)) {
          const active = activeMatchPath === childPath;
          const matched = matchedPaths.has(childPath);

          return (
            <div
              className={`py-0.5 ${active ? 'rounded bg-[color:var(--accent)]/20 px-1' : ''} ${matched ? 'bg-yellow-300/15' : ''}`}
              data-json-path={childPath}
              key={childPath}
              ref={(node) => registerNodeRef?.(childPath, node)}
            >
              <span className="text-orange-300">{renderHighlighted(key, searchQuery)}</span>
              <span className="text-[color:var(--text-muted)]">: </span>
              {renderPrimitive(childValue, searchQuery)}
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
        const isCollapsed = searchQuery && containsMatchedDescendant ? false : manuallyCollapsed;

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
              <span className="text-orange-300">{renderHighlighted(key, searchQuery)}</span>
              <span className="text-[color:var(--text-muted)]">:</span>
            </button>

            {!isCollapsed ? (
              <JsonRenderer
                activeMatchPath={activeMatchPath}
                depth={depth + 1}
                matchedPaths={matchedPaths}
                path={childPath}
                registerNodeRef={registerNodeRef}
                searchQuery={searchQuery}
                value={childValue}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
