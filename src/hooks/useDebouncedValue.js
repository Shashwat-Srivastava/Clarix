import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms of
 * inactivity.  Useful for search / filter inputs where the downstream effect
 * (IPC calls, heavy computation) should not fire on every keystroke or paste.
 *
 * @param {T} value
 * @param {number} [delay=300]
 * @returns {T}
 * @template T
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
