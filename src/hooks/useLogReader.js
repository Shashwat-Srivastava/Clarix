import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CHUNK_SIZE = 256 * 1024;

/**
 * Reads log files incrementally and provides search integration.
 *
 * @param {string | null | undefined} sessionId
 * @param {string | null | undefined} componentId
 * @returns {Object}
 */
export function useLogReader(sessionId, componentId) {
  const [text, setText] = useState('');
  const [offset, setOffset] = useState(0);
  const [fileSize, setFileSize] = useState(0);
  const [eof, setEof] = useState(false);
  const [isLoadingChunk, setIsLoadingChunk] = useState(false);
  const [matches, setMatches] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [error, setError] = useState(null);

  const pendingRef = useRef(false);

  const reset = useCallback(() => {
    setText('');
    setOffset(0);
    setFileSize(0);
    setEof(false);
    setMatches([]);
    setTotalMatches(0);
    setSearchQuery('');
    setActiveMatchIndex(0);
    setError(null);
    pendingRef.current = false;
  }, []);

  const loadChunk = useCallback(
    async (nextOffset) => {
      if (!componentId || !sessionId || pendingRef.current) {
        return;
      }

      pendingRef.current = true;
      setIsLoadingChunk(true);

      try {
        const chunk = await window.electronAPI.readLogFileChunk(componentId, nextOffset, CHUNK_SIZE);
        setText((previous) => previous + chunk.text);
        setOffset(nextOffset + chunk.bytesRead);
        setFileSize(chunk.fileSize);
        setEof(chunk.eof);
      } catch (chunkError) {
        setError(chunkError instanceof Error ? chunkError.message : 'Unable to load log chunk');
      } finally {
        pendingRef.current = false;
        setIsLoadingChunk(false);
      }
    },
    [componentId, sessionId],
  );

  useEffect(() => {
    reset();

    if (!sessionId || !componentId) {
      return;
    }

    loadChunk(0);
  }, [componentId, loadChunk, reset, sessionId]);

  const loadNextChunk = useCallback(() => {
    if (eof || isLoadingChunk || !sessionId || !componentId) {
      return;
    }
    loadChunk(offset);
  }, [componentId, eof, isLoadingChunk, loadChunk, offset, sessionId]);

  useEffect(() => {
    if (!sessionId || !componentId || !searchQuery.trim()) {
      setMatches([]);
      setTotalMatches(0);
      setActiveMatchIndex(0);
      return;
    }

    let active = true;

    window.electronAPI
      .searchLogFile(componentId, searchQuery.trim(), { caseSensitive: false, maxMatches: 5000 })
      .then((result) => {
        if (!active) {
          return;
        }

        setMatches(result.matches ?? []);
        setTotalMatches(result.totalMatches ?? 0);
        setActiveMatchIndex(0);
      })
      .catch((searchError) => {
        if (!active) {
          return;
        }
        setError(searchError instanceof Error ? searchError.message : 'Search failed');
      });

    return () => {
      active = false;
    };
  }, [componentId, searchQuery, sessionId]);

  const lines = useMemo(() => {
    if (!text) {
      return [];
    }
    return text.split('\n');
  }, [text]);

  const activeMatch = matches[activeMatchIndex] ?? null;

  const nextMatch = useCallback(() => {
    if (!matches.length) {
      return;
    }
    setActiveMatchIndex((index) => (index + 1) % matches.length);
  }, [matches.length]);

  const previousMatch = useCallback(() => {
    if (!matches.length) {
      return;
    }
    setActiveMatchIndex((index) => (index - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const copyEntireLog = useCallback(async () => {
    if (!sessionId || !componentId) {
      return;
    }
    const fullText = await window.electronAPI.readLogFile(componentId);
    await navigator.clipboard.writeText(fullText);
  }, [componentId, sessionId]);

  return {
    lines,
    fileSize,
    eof,
    isLoadingChunk,
    error,
    searchQuery,
    setSearchQuery,
    matches,
    totalMatches,
    activeMatchIndex,
    activeMatch,
    nextMatch,
    previousMatch,
    loadNextChunk,
    copyEntireLog,
  };
}
