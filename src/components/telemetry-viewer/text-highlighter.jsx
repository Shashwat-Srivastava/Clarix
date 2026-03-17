import { createElement } from 'react';

const HIGHLIGHT_PRIORITY = {
  global: 1,
  local: 2,
};

const HIGHLIGHT_CLASS_BY_TONE = {
  global: 'rounded bg-sky-300/55 px-0.5 text-inherit',
  local: 'rounded bg-yellow-300/60 px-0.5 text-inherit',
};

/**
 * Builds escaped regex-compatible text.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlights one or more search queries in text.
 *
 * @param {string} text
 * @param {Array<{query?:string,tone:'global'|'local'}>} queries
 * @returns {React.ReactNode}
 */
export function renderHighlightedText(text, queries = []) {
  const normalizedText = String(text);
  const activeQueries = queries
    .map((entry) => ({
      tone: entry.tone,
      query: String(entry.query ?? '').trim(),
    }))
    .filter((entry) => entry.query);

  if (!activeQueries.length) {
    return normalizedText;
  }

  const candidates = [];

  activeQueries.forEach(({ query, tone }) => {
    const matcher = new RegExp(escapeForRegex(query), 'ig');
    for (const match of normalizedText.matchAll(matcher)) {
      candidates.push({
        tone,
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
        value: normalizedText.slice(match.index ?? 0, (match.index ?? 0) + match[0].length),
        priority: HIGHLIGHT_PRIORITY[tone] ?? 0,
      });
    }
  });

  if (!candidates.length) {
    return normalizedText;
  }

  const output = [];
  let cursor = 0;
  let segmentIndex = 0;

  while (cursor < normalizedText.length) {
    const nextStart = candidates
      .filter((candidate) => candidate.start >= cursor)
      .reduce((lowest, candidate) => Math.min(lowest, candidate.start), Number.POSITIVE_INFINITY);

    if (nextStart === Number.POSITIVE_INFINITY) {
      output.push(createElement('span', { key: `text-${segmentIndex}` }, normalizedText.slice(cursor)));
      break;
    }

    if (nextStart > cursor) {
      output.push(
        createElement('span', { key: `text-${segmentIndex}` }, normalizedText.slice(cursor, nextStart)),
      );
      segmentIndex += 1;
    }

    const [bestCandidate] = candidates
      .filter((candidate) => candidate.start === nextStart)
      .sort((left, right) => {
        if (right.priority !== left.priority) {
          return right.priority - left.priority;
        }
        return right.end - left.end;
      });

    output.push(
      createElement(
        'mark',
        {
          className: HIGHLIGHT_CLASS_BY_TONE[bestCandidate.tone],
          key: `mark-${segmentIndex}`,
        },
        bestCandidate.value,
      ),
    );
    cursor = bestCandidate.end;
    segmentIndex += 1;
  }

  return output;
}
