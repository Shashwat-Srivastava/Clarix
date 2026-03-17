/**
 * Returns whether a value is a non-null object or array.
 *
 * @param {any} value
 * @returns {boolean}
 */
export function isComplex(value) {
  return value != null && typeof value === 'object';
}

/**
 * Flattens JSON into searchable path entries.
 *
 * @param {any} value
 * @param {string} path
 * @returns {Array<{path:string,text:string}>}
 */
export function collectSearchEntries(value, path = 'root') {
  const output = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      if (isComplex(item)) {
        output.push(...collectSearchEntries(item, itemPath));
      } else {
        output.push({ path: itemPath, text: String(item) });
      }
    });
    return output;
  }

  if (isComplex(value)) {
    Object.entries(value).forEach(([key, childValue]) => {
      const childPath = path === 'root' ? key : `${path}.${key}`;
      output.push({ path: childPath, text: key });

      if (isComplex(childValue)) {
        output.push(...collectSearchEntries(childValue, childPath));
      } else {
        output.push({ path: childPath, text: `${key}: ${String(childValue)}` });
      }
    });
    return output;
  }

  output.push({ path, text: String(value) });
  return output;
}

/**
 * Returns the matching JSON paths for a report and query.
 *
 * @param {{data?:any,rawJson?:string|null}|null|undefined} report
 * @param {string} query
 * @returns {string[]}
 */
export function findTelemetryMatchPaths(report, query) {
  const normalizedQuery = String(query ?? '').trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  if (report?.data) {
    const matchedPaths = collectSearchEntries(report.data)
      .filter((entry) => entry.text.toLowerCase().includes(normalizedQuery))
      .map((entry) => entry.path);

    return [...new Set(matchedPaths)];
  }

  const rawJson = String(report?.rawJson ?? '');
  return rawJson.toLowerCase().includes(normalizedQuery) ? ['root'] : [];
}
