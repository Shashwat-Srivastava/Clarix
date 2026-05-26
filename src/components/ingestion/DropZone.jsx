import { Archive, ClipboardPaste, FileArchive, FolderOpen, FolderTree, UploadCloud } from 'lucide-react';
import { useState } from 'react';

/**
 * Landing drop zone to start a new ingest operation.
 *
 * @param {Object} props
 */
export default function DropZone({
  onSelectTgzFiles,
  onSelectZipFiles,
  onSelectTgzFolder,
  onSelectMergedFolder,
  onDropPaths,
  onPasteRawTelemetry,
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div
        className={`w-full max-w-3xl rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-150 ${
          dragging
            ? 'scale-[1.01] border-[color:var(--accent)] bg-[color:var(--accent)]/10'
            : 'border-[color:var(--border)] bg-[color:var(--bg-panel)]'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);

          const paths = Array.from(event.dataTransfer.files)
            .map((file) => file.path)
            .filter(Boolean);

          if (paths.length) {
            onDropPaths(paths);
          }
        }}
      >
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--accent)]/15 text-[color:var(--accent)]">
          <UploadCloud size={24} />
        </div>

        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Load CPE Archives</h1>
        <p className="mx-auto mb-8 max-w-2xl text-[color:var(--text-muted)]">
          Drag and drop <code>.tgz</code> archives, a <code>.zip</code> bundle of <code>.tgz</code> files, or choose a folder to merge logs chronologically.
        </p>

        <div className="mx-auto grid max-w-lg grid-cols-2 gap-3">
          <button
            aria-label="Select .tgz files"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[color:var(--accent)] px-4 py-2.5 text-sm text-white"
            onClick={onSelectTgzFiles}
            type="button"
          >
            <FileArchive size={16} />
            Select .tgz Files
          </button>
          <button
            aria-label="Select .zip files"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[color:var(--accent)] px-4 py-2.5 text-sm text-white"
            onClick={onSelectZipFiles}
            type="button"
          >
            <Archive size={16} />
            Select .zip Files
          </button>
          <button
            aria-label="Select folder with .tgz archives"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] px-4 py-2.5 text-sm hover:bg-[color:var(--bg-hover)]"
            onClick={onSelectTgzFolder}
            type="button"
          >
            <FolderOpen size={16} />
            Folder (.tgz)
          </button>
          <button
            aria-label="Select folder with merged or expanded logs"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] px-4 py-2.5 text-sm hover:bg-[color:var(--bg-hover)]"
            onClick={onSelectMergedFolder}
            type="button"
          >
            <FolderTree size={16} />
            Folder (Merged Logs)
          </button>
        </div>

        <div className="mt-6 border-t border-[color:var(--border)] pt-6">
          <p className="mb-3 text-sm text-[color:var(--text-muted)]">Or analyze raw telemetry data directly:</p>
          <button
            aria-label="Paste raw telemetry"
            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] px-4 py-2 hover:bg-[color:var(--bg-hover)]"
            onClick={onPasteRawTelemetry}
            type="button"
          >
            <ClipboardPaste size={16} />
            Paste Raw Telemetry
          </button>
        </div>
      </div>
    </div>
  );
}
