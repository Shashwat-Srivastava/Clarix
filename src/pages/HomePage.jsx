import DropZone from '../components/ingestion/DropZone.jsx';
import IngestionError from '../components/ingestion/IngestionError.jsx';

/**
 * Home page for archive ingestion actions.
 *
 * @param {Object} props
 */
export default function HomePage({ onSelectFolder, onSelectFiles, onDropPaths, error, onRetry }) {
  return (
    <div className="relative h-full">
      <DropZone onDropPaths={onDropPaths} onSelectFiles={onSelectFiles} onSelectFolder={onSelectFolder} />
      <IngestionError error={error} onRetry={onRetry} />
    </div>
  );
}
