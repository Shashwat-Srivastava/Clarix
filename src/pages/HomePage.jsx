import DropZone from '../components/ingestion/DropZone.jsx';
import IngestionError from '../components/ingestion/IngestionError.jsx';
import RawTelemetryInput from '../components/ingestion/RawTelemetryInput.jsx';

/**
 * Home page for archive ingestion actions.
 *
 * @param {Object} props
 */
export default function HomePage({
  onSelectTgzFiles,
  onSelectZipFiles,
  onSelectTgzFolder,
  onSelectMergedFolder,
  onDropPaths,
  error,
  onRetry,
  showRawTelemetryInput,
  onShowRawTelemetryInput,
  onCancelRawTelemetryInput,
  onSubmitRawTelemetry,
}) {
  if (showRawTelemetryInput) {
    return (
      <RawTelemetryInput
        onCancel={onCancelRawTelemetryInput}
        onSubmit={onSubmitRawTelemetry}
      />
    );
  }

  return (
    <div className="relative h-full">
      <DropZone
        onDropPaths={onDropPaths}
        onPasteRawTelemetry={onShowRawTelemetryInput}
        onSelectMergedFolder={onSelectMergedFolder}
        onSelectTgzFiles={onSelectTgzFiles}
        onSelectTgzFolder={onSelectTgzFolder}
        onSelectZipFiles={onSelectZipFiles}
      />
      <IngestionError error={error} onRetry={onRetry} />
    </div>
  );
}
