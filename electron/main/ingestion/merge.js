import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

/**
 * Derives output filename from a component file name.
 *
 * @param {string} inputFilename
 * @returns {string}
 */
export function deriveOutputFilename(inputFilename) {
  if (inputFilename.includes('2025') || inputFilename.includes('2026')) {
    return inputFilename.slice(20);
  }
  return inputFilename;
}

/**
 * Merges component logs chronologically with merge markers.
 *
 * @param {Array<{archivePath:string, archiveName:string, logPath:string}>} sortedArchiveDirs
 * @param {string} outputDir
 * @param {(payload:{stage:string,current:number,total:number,detail?:string}) => void} [onProgress]
 * @param {AbortSignal} [abortSignal]
 * @returns {Promise<void>}
 */
export async function mergeAllComponents(sortedArchiveDirs, outputDir, onProgress, abortSignal) {
  await fsp.mkdir(outputDir, { recursive: true });

  const totalArchives = sortedArchiveDirs.length;

  for (let archiveIndex = 0; archiveIndex < sortedArchiveDirs.length; archiveIndex += 1) {
    if (abortSignal?.aborted) {
      throw new Error('Ingestion cancelled by a newer request.');
    }

    const archive = sortedArchiveDirs[archiveIndex];

    onProgress?.({
      stage: 'merge',
      current: archiveIndex + 1,
      total: totalArchives,
      detail: `Merging ${archive.archiveName}`,
    });

    const entries = await fsp.readdir(archive.logPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const filename = entry.name;
      const inputFilePath = path.join(archive.logPath, filename);
      const outputFilename = deriveOutputFilename(filename);
      const outputFilePath = path.join(outputDir, outputFilename);

      const marker = `\n****Merging ${inputFilePath} **********\n`;
      await fsp.appendFile(outputFilePath, marker, 'utf8');

      await pipeline(
        fs.createReadStream(inputFilePath),
        fs.createWriteStream(outputFilePath, { flags: 'a' }),
      );
    }
  }
}
