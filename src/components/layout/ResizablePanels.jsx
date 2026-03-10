import { useEffect, useRef, useState } from 'react';

/**
 * Two-column resizable layout.
 *
 * @param {{left: React.ReactNode, right: React.ReactNode, initialLeftWidth?:number, minLeftWidth?:number, maxLeftWidth?:number}} props
 */
export default function ResizablePanels({
  left,
  right,
  initialLeftWidth = 280,
  minLeftWidth = 220,
  maxLeftWidth = 520,
}) {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const draggingRef = useRef(false);

  useEffect(() => {
    const onMouseMove = (event) => {
      if (!draggingRef.current) {
        return;
      }

      const width = Math.max(minLeftWidth, Math.min(maxLeftWidth, event.clientX));
      setLeftWidth(width);
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [maxLeftWidth, minLeftWidth]);

  return (
    <div className="grid h-full w-full" style={{ gridTemplateColumns: `${leftWidth}px 6px minmax(0, 1fr)` }}>
      <div className="h-full min-w-0 overflow-hidden border-r border-[color:var(--border)] bg-[color:var(--bg-panel)]">
        {left}
      </div>
      <button
        aria-label="Resize panels"
        className="group relative w-full cursor-col-resize bg-transparent"
        onMouseDown={() => {
          draggingRef.current = true;
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        type="button"
      >
        <span className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 rounded bg-transparent transition-colors group-hover:bg-[color:var(--accent)]" />
      </button>
      <div className="h-full min-w-0 overflow-hidden bg-[color:var(--bg-panel)]">{right}</div>
    </div>
  );
}
