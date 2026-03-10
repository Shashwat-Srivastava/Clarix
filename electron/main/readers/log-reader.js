import fs from 'node:fs';
import fsp from 'node:fs/promises';
import readline from 'node:readline';

const MAX_CACHE_BYTES = 50 * 1024 * 1024;
const chunkCache = new Map();
let cacheSizeBytes = 0;

/**
 * Creates an LRU cache key for chunk data.
 *
 * @param {string} sessionId
 * @param {string} componentId
 * @param {number} offset
 * @param {number} length
 * @returns {string}
 */
function chunkKey(sessionId, componentId, offset, length) {
  return `${sessionId}:${componentId}:${offset}:${length}`;
}

/**
 * Adds a chunk to the in-memory LRU cache.
 *
 * @param {string} key
 * @param {Buffer} buffer
 */
function putCache(key, buffer) {
  if (chunkCache.has(key)) {
    const previous = chunkCache.get(key);
    cacheSizeBytes -= previous.buffer.byteLength;
    chunkCache.delete(key);
  }

  chunkCache.set(key, {
    buffer,
    size: buffer.byteLength,
  });

  cacheSizeBytes += buffer.byteLength;

  while (cacheSizeBytes > MAX_CACHE_BYTES) {
    const oldestKey = chunkCache.keys().next().value;
    if (!oldestKey) {
      break;
    }

    const value = chunkCache.get(oldestKey);
    chunkCache.delete(oldestKey);
    cacheSizeBytes -= value?.size ?? 0;
  }
}

/**
 * Reads a UTF-8 chunk from a log file.
 *
 * @param {Object} options
 * @param {string} options.sessionId
 * @param {string} options.componentId
 * @param {string} options.filePath
 * @param {number} options.offset
 * @param {number} options.length
 * @returns {Promise<{text:string, bytesRead:number, offset:number, eof:boolean, fileSize:number}>}
 */
export async function readLogFileChunk({ sessionId, componentId, filePath, offset, length }) {
  const stats = await fsp.stat(filePath);
  const fileSize = stats.size;
  const safeOffset = Math.max(0, Math.min(offset, fileSize));
  const safeLength = Math.max(1, length);
  const key = chunkKey(sessionId, componentId, safeOffset, safeLength);

  if (chunkCache.has(key)) {
    const cached = chunkCache.get(key);
    chunkCache.delete(key);
    chunkCache.set(key, cached);

    return {
      text: cached.buffer.toString('utf8'),
      bytesRead: cached.buffer.byteLength,
      offset: safeOffset,
      eof: safeOffset + cached.buffer.byteLength >= fileSize,
      fileSize,
    };
  }

  const fd = await fsp.open(filePath, 'r');

  try {
    const buffer = Buffer.allocUnsafe(safeLength);
    const { bytesRead } = await fd.read(buffer, 0, safeLength, safeOffset);
    const readBuffer = buffer.subarray(0, bytesRead);

    putCache(key, readBuffer);

    return {
      text: readBuffer.toString('utf8'),
      bytesRead,
      offset: safeOffset,
      eof: safeOffset + bytesRead >= fileSize,
      fileSize,
    };
  } finally {
    await fd.close();
  }
}

/**
 * Reads a complete log file as UTF-8.
 *
 * @param {string} filePath
 * @returns {Promise<string>}
 */
export async function readLogFile(filePath) {
  const content = await fsp.readFile(filePath);
  return content.toString('utf8');
}

/**
 * Streams a log file and returns matching line positions for a query.
 *
 * @param {string} filePath
 * @param {string} query
 * @param {Object} [options]
 * @param {boolean} [options.caseSensitive=false]
 * @param {number} [options.maxMatches=10000]
 * @returns {Promise<{matches:Array<{lineNumber:number,preview:string}>, totalMatches:number}>}
 */
export async function searchLogFile(filePath, query, options = {}) {
  const caseSensitive = options.caseSensitive ?? false;
  const maxMatches = options.maxMatches ?? 10000;
  const matcher = caseSensitive ? query : query.toLowerCase();

  const input = fs.createReadStream(filePath, { encoding: 'utf8' });
  const lineReader = readline.createInterface({ input, crlfDelay: Infinity });

  let lineNumber = 0;
  let totalMatches = 0;
  const matches = [];

  for await (const line of lineReader) {
    lineNumber += 1;

    const candidate = caseSensitive ? line : line.toLowerCase();
    if (!matcher || !candidate.includes(matcher)) {
      continue;
    }

    totalMatches += 1;
    if (matches.length < maxMatches) {
      matches.push({
        lineNumber,
        preview: line.slice(0, 250),
      });
    }
  }

  return {
    matches,
    totalMatches,
  };
}

/**
 * Clears cached chunks for a session id.
 *
 * @param {string} sessionId
 */
export function clearSessionChunkCache(sessionId) {
  for (const key of [...chunkCache.keys()]) {
    if (!key.startsWith(`${sessionId}:`)) {
      continue;
    }
    const value = chunkCache.get(key);
    chunkCache.delete(key);
    cacheSizeBytes -= value?.size ?? 0;
  }
}

/**
 * Returns whether a log file should display a large-file warning.
 *
 * @param {number} fileSize
 * @returns {boolean}
 */
export function isVeryLargeFile(fileSize) {
  return fileSize > 500 * 1024 * 1024;
}
