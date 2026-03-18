import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as tar from 'tar';

const TIMESTAMP_REGEX = /(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/;
const execFileAsync = promisify(execFile);

/**
 * Resolves the directory where component log files are stored after extraction.
 *
 * @param {string} extractedTgzDir
 * @returns {string}
 */
export function resolveLogPath(extractedTgzDir) {
  const entries = fs.readdirSync(extractedTgzDir);
  if (entries.length === 1) {
    const inner = path.join(extractedTgzDir, entries[0]);
    if (fs.statSync(inner).isDirectory()) {
      return inner;
    }
  }
  return extractedTgzDir;
}

/**
 * Returns true when a path looks like a supported compressed archive.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export function isArchiveFile(filePath) {
  const lower = filePath.toLowerCase();
  return lower.endsWith('.tgz') || lower.endsWith('.tar.gz');
}

/**
 * Returns true when a path looks like a supported zip bundle input.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export function isZipFile(filePath) {
  return filePath.toLowerCase().endsWith('.zip');
}

/**
 * Extracts timestamp text from an archive filename.
 *
 * @param {string} filePath
 * @returns {string | null}
 */
export function getArchiveTimestamp(filePath) {
  const base = path.basename(filePath);
  const match = base.match(TIMESTAMP_REGEX);
  return match ? match[1] : null;
}

/**
 * Recursively scans a directory for archives up to max depth.
 *
 * @param {string} dirPath
 * @param {number} maxDepth
 * @param {number} currentDepth
 * @returns {Promise<string[]>}
 */
async function scanDirForArchives(dirPath, maxDepth, currentDepth = 0) {
  if (currentDepth > maxDepth) {
    return [];
  }

  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  const found = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const nested = await scanDirForArchives(fullPath, maxDepth, currentDepth + 1);
      found.push(...nested);
      continue;
    }

    if (entry.isFile() && isArchiveFile(fullPath)) {
      found.push(fullPath);
    }
  }

  return found;
}

/**
 * Collects archive file paths from a mixed list of files and folders.
 *
 * @param {string[]} inputPaths
 * @returns {Promise<string[]>}
 */
export async function collectArchivePaths(inputPaths) {
  const unique = new Set();

  for (const inputPath of inputPaths) {
    let stats;

    try {
      stats = await fsp.stat(inputPath);
    } catch {
      continue;
    }

    if (stats.isFile() && isArchiveFile(inputPath)) {
      unique.add(path.resolve(inputPath));
      continue;
    }

    if (stats.isDirectory()) {
      const discovered = await scanDirForArchives(inputPath, 2);
      for (const filePath of discovered) {
        unique.add(path.resolve(filePath));
      }
    }
  }

  return [...unique];
}

/**
 * Expands one zip file into a dedicated staging directory.
 *
 * @param {string} zipPath
 * @param {string} inputRoot
 * @returns {Promise<string>}
 */
export async function expandZipArchive(zipPath, inputRoot) {
  await fsp.mkdir(inputRoot, { recursive: true });

  const baseName = path.basename(zipPath, '.zip').replace(/[^a-zA-Z0-9._-]+/g, '-');
  const extractionDir = await fsp.mkdtemp(path.join(inputRoot, `${baseName || 'bundle'}-`));

  await execFileAsync('/usr/bin/unzip', ['-q', '-o', zipPath, '-d', extractionDir]);
  return extractionDir;
}

/**
 * Resolves mixed ingestion inputs into concrete .tgz archive paths.
 *
 * Supports direct .tgz files, folders containing .tgz files, and .zip files
 * that expand to folders containing .tgz files.
 *
 * @param {string[]} inputPaths
 * @param {string} inputRoot
 * @returns {Promise<string[]>}
 */
export async function resolveInputArchivePaths(inputPaths, inputRoot) {
  const unique = new Set();

  for (const inputPath of inputPaths) {
    let stats;

    try {
      stats = await fsp.stat(inputPath);
    } catch {
      continue;
    }

    if (stats.isFile() && isArchiveFile(inputPath)) {
      unique.add(path.resolve(inputPath));
      continue;
    }

    if (stats.isFile() && isZipFile(inputPath)) {
      const expandedZipDir = await expandZipArchive(inputPath, inputRoot);
      const discovered = await scanDirForArchives(expandedZipDir, 4);
      for (const archivePath of discovered) {
        unique.add(path.resolve(archivePath));
      }
      continue;
    }

    if (stats.isDirectory()) {
      const discovered = await scanDirForArchives(inputPath, 2);
      for (const archivePath of discovered) {
        unique.add(path.resolve(archivePath));
      }
    }
  }

  return [...unique];
}

/**
 * Sorts archive metadata chronologically by embedded timestamp, fallback mtime.
 *
 * @param {Array<{archivePath:string, archiveName:string, timestamp:string|null, mtimeMs:number}>} archives
 * @returns {Array<{archivePath:string, archiveName:string, timestamp:string|null, mtimeMs:number}>}
 */
export function sortArchivesChronologically(archives) {
  return [...archives].sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return a.timestamp.localeCompare(b.timestamp) || a.archiveName.localeCompare(b.archiveName);
    }

    if (a.timestamp && !b.timestamp) {
      return -1;
    }

    if (!a.timestamp && b.timestamp) {
      return 1;
    }

    return a.mtimeMs - b.mtimeMs || a.archiveName.localeCompare(b.archiveName);
  });
}

/**
 * Extracts one archive into a dedicated directory and resolves its log root path.
 *
 * @param {string} archivePath
 * @param {string} extractedRoot
 * @returns {Promise<{archivePath:string, archiveName:string, extractedDir:string, logPath:string, timestamp:string|null, mtimeMs:number}>}
 */
export async function extractArchive(archivePath, extractedRoot) {
  const archiveName = path.basename(archivePath);
  const extractionDirName = archiveName.replace(/\.(tar\.gz|tgz)$/i, '');
  const extractedDir = path.join(extractedRoot, extractionDirName);
  await fsp.mkdir(extractedDir, { recursive: true });

  await tar.x({
    file: archivePath,
    cwd: extractedDir,
    gzip: true,
    strict: false,
  });

  const stats = await fsp.stat(archivePath);

  return {
    archivePath,
    archiveName,
    extractedDir,
    logPath: resolveLogPath(extractedDir),
    timestamp: getArchiveTimestamp(archiveName),
    mtimeMs: stats.mtimeMs,
  };
}
