import ResizablePanels from '../components/layout/ResizablePanels.jsx';
import ComponentList from '../components/log-viewer/ComponentList.jsx';
import LogPane from '../components/log-viewer/LogPane.jsx';

/**
 * Generic merged log viewer page.
 *
 * @param {{session:Object,onSessionPatch:(patch:Object)=>void}} props
 */
export default function LogViewerPage({ session, onSessionPatch }) {
  const components = session?.components ?? [];
  const selectedComponentId = session?.selectedComponentId ?? null;
  const filter = session?.componentFilter ?? '';
  const sort = session?.componentSort ?? 'asc';

  const selectedComponent = components.find((component) => component.id === selectedComponentId) ?? null;

  return (
    <ResizablePanels
      initialLeftWidth={280}
      left={
        <ComponentList
          components={components}
          filter={filter}
          onFilterChange={(componentFilter) => onSessionPatch({ componentFilter })}
          onSelect={(nextComponentId) => onSessionPatch({ selectedComponentId: nextComponentId })}
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
          onToggleWrap={() => onSessionPatch({ wrapLines: !session?.wrapLines })}
          sessionId={session?.id}
          wrapLines={Boolean(session?.wrapLines)}
        />
      }
    />
  );
}
