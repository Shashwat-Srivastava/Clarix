/**
 * Flattens nested objects into dot-notation keys.
 *
 * @param {Object} value
 * @param {string} [prefix]
 * @param {Object} [output]
 * @returns {Object}
 */
export function flattenJson(value, prefix = '', output = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return output;
  }

  for (const [key, raw] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(raw)) {
      output[nextKey] = JSON.stringify(raw);
      continue;
    }

    if (raw && typeof raw === 'object') {
      flattenJson(raw, nextKey, output);
      continue;
    }

    output[nextKey] = raw;
  }

  return output;
}
