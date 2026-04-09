import { useCallback, useEffect, useMemo, useState } from 'react';
import ResizablePanels from '../components/layout/ResizablePanels.jsx';
import ComponentList from '../components/log-viewer/ComponentList.jsx';
import DedupeResultModal from '../components/log-viewer/DedupeResultModal.jsx';
import LogPane from '../components/log-viewer/LogPane.jsx';
import {
  buildMatchedComponentIdSet,
  flattenComponentSearchResults,
  groupLogMatchesByComponentId,
} from '../components/log-viewer/log-search-state.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';

const EMPTY_COMPONENTS = [];

/**
 * Generic merged log viewer page.
 *
 * @param {{session:Object,onSessionPatch:(patch:Object)=>void}} props
 */
export default function LogViewerPage({ session, onSessionPatch }) {
  const components = session?.components ?? EMPTY_COMPONENTS;
  const selectedComponentId = session?.selectedComponentId ?? null;
  const globalFilter = session?.componentContentFilter ?? '';
  const filter = session?.componentFilter ?? '';
  const sort = session?.componentSort ?? 'asc';
  const debouncedGlobalFilter = useDebouncedValue(globalFilter, 300);
  const trimmedGlobalFilter = debouncedGlobalFilter.trim();
  const [globalSearchMatches, setGlobalSearchMatches] = useState([]);
  const [activeGlobalMatchIndex, setActiveGlobalMatchIndex] = useState(0);
  const [isDeduplicated, setIsDeduplicated] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [dedupeResults, setDedupeResults] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    setGlobalSearchMatches([]);
    setActiveGlobalMatchIndex(0);

    if (!trimmedGlobalFilter || !components.length) {
      return () => {
        active = false;
      };
    }

    void Promise.all(
      components.map(async (component) => {
        try {
          const result = await window.electronAPI.searchLogFile(component.id, trimmedGlobalFilter, {
            caseSensitive: false,
            maxMatches: 5000,
          });

          return {
            componentId: component.id,
            matches: result.matches ?? [],
          };
        } catch {
          return {
            componentId: component.id,
            matches: [],
          };
        }
      }),
    ).then((results) => {
      if (!active) {
        return;
      }

      setGlobalSearchMatches(flattenComponentSearchResults(results));
    });

    return () => {
      active = false;
    };
  }, [components, trimmedGlobalFilter]);

  const matchedLinesByComponentId = useMemo(
    () => groupLogMatchesByComponentId(globalSearchMatches),
    [globalSearchMatches],
  );
  const matchedComponentIdSet = useMemo(
    () => buildMatchedComponentIdSet(globalSearchMatches),
    [globalSearchMatches],
  );
  const filteredComponents = useMemo(() => {
    const nameNeedle = filter.trim().toLowerCase();
    const nextComponents = components.filter((component) => {
      if (trimmedGlobalFilter && !matchedComponentIdSet.has(component.id)) {
        return false;
      }

      if (!nameNeedle) {
        return true;
      }

      return component.name.toLowerCase().includes(nameNeedle);
    });

    nextComponents.sort((left, right) =>
      sort === 'asc'
        ? left.name.localeCompare(right.name)
        : right.name.localeCompare(left.name),
    );
    return nextComponents;
  }, [components, filter, matchedComponentIdSet, sort, trimmedGlobalFilter]);

  useEffect(() => {
    if (!globalSearchMatches.length) {
      setActiveGlobalMatchIndex(0);
      return;
    }

    setActiveGlobalMatchIndex((previous) => {
      if (previous < 0) {
        return 0;
      }
      if (previous >= globalSearchMatches.length) {
        return globalSearchMatches.length - 1;
      }
      return previous;
    });
  }, [globalSearchMatches]);

  const activeGlobalMatch = globalSearchMatches[activeGlobalMatchIndex] ?? null;

  useEffect(() => {
    if (!trimmedGlobalFilter || !activeGlobalMatch) {
      return;
    }

    const activeMatchStillVisible = filteredComponents.some(
      (component) => component.id === activeGlobalMatch.componentId,
    );
    if (!activeMatchStillVisible) {
      return;
    }

    if (selectedComponentId !== activeGlobalMatch.componentId) {
      onSessionPatch({ selectedComponentId: activeGlobalMatch.componentId });
    }
  }, [activeGlobalMatch, filteredComponents, onSessionPatch, selectedComponentId, trimmedGlobalFilter]);

  useEffect(() => {
    if (!filteredComponents.length) {
      if (selectedComponentId != null) {
        onSessionPatch({ selectedComponentId: null });
      }
      return;
    }

    const hasSelectedComponent = filteredComponents.some(
      (component) => component.id === selectedComponentId,
    );
    if (!hasSelectedComponent) {
      onSessionPatch({ selectedComponentId: filteredComponents[0].id });
    }
  }, [filteredComponents, onSessionPatch, selectedComponentId]);

  const handleSelectComponent = useCallback(
    (nextComponentId) => {
      if (!trimmedGlobalFilter) {
        onSessionPatch({ selectedComponentId: nextComponentId });
        return;
      }

      const firstMatchForComponent = globalSearchMatches.findIndex(
        (match) => match.componentId === nextComponentId,
      );
      if (firstMatchForComponent >= 0) {
        setActiveGlobalMatchIndex(firstMatchForComponent);
      }

      onSessionPatch({ selectedComponentId: nextComponentId });
    },
    [globalSearchMatches, onSessionPatch, trimmedGlobalFilter],
  );

  const handleAdvanceGlobalSearch = useCallback(() => {
    if (!trimmedGlobalFilter || !globalSearchMatches.length) {
      return;
    }

    setActiveGlobalMatchIndex((previous) => (previous + 1) % globalSearchMatches.length);
  }, [globalSearchMatches.length, trimmedGlobalFilter]);

  const selectedComponent = components.find((component) => component.id === selectedComponentId) ?? null;

  const handleToggleDedupe = useCallback(async () => {
    if (!components.length || isDeduplicating) {
      return;
    }

    setIsDeduplicating(true);

    try {
      const allComponentIds = components.map((c) => c.id);

      if (isDeduplicated) {
        // Restore originals
        await window.electronAPI.restoreLogFiles(allComponentIds);
        setIsDeduplicated(false);
        setReloadKey((k) => k + 1);
      } else {
        // Deduplicate
        const results = await window.electronAPI.dedupeLogFiles(allComponentIds);
        setDedupeResults(results);

        if (results.length > 0) {
          setIsDeduplicated(true);
        }

        setReloadKey((k) => k + 1);
      }
    } catch {
      // Silently handle errors — viewer stays usable.
    } finally {
      setIsDeduplicating(false);
    }
  }, [components, isDeduplicated, isDeduplicating]);

  const handleDismissDedupeModal = useCallback(() => {
    setDedupeResults(null);
  }, []);

  return (
    <>
      <ResizablePanels
        initialLeftWidth={280}
        left={
          <ComponentList
            components={filteredComponents}
            filter={filter}
            globalFilter={globalFilter}
            onAdvanceGlobalSearch={handleAdvanceGlobalSearch}
            onFilterChange={(componentFilter) => onSessionPatch({ componentFilter })}
            onGlobalFilterChange={(componentContentFilter) => onSessionPatch({ componentContentFilter })}
            onSelect={handleSelectComponent}
            onToggleSort={() =>
              onSessionPatch({ componentSort: sort === 'asc' ? 'desc' : 'asc' })
            }
            selectedComponentId={selectedComponentId}
            sort={sort}
          />
        }
        right={
          <LogPane
            component={selectedComponent}
            globalActiveMatchLine={
              activeGlobalMatch?.componentId === selectedComponentId ? activeGlobalMatch.lineNumber : null
            }
            globalMatchedLines={matchedLinesByComponentId[selectedComponentId] ?? []}
            globalSearchQuery={trimmedGlobalFilter}
            isDeduplicated={isDeduplicated}
            isDeduplicating={isDeduplicating}
            onToggleDedupe={handleToggleDedupe}
            onToggleWrap={() => onSessionPatch({ wrapLines: !session?.wrapLines })}
            reloadKey={reloadKey}
            sessionId={session?.id}
            wrapLines={Boolean(session?.wrapLines)}
          />
        }
      />

      {dedupeResults !== null ? (
        <DedupeResultModal
          onDismiss={handleDismissDedupeModal}
          results={dedupeResults}
        />
      ) : null}
    </>
  );
}
