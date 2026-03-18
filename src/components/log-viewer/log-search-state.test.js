import { describe, expect, it } from 'vitest';
import {
  buildMatchedComponentIdSet,
  flattenComponentSearchResults,
  groupLogMatchesByComponentId,
} from './log-search-state.js';

describe('log-search-state', () => {
  it('flattens per-component search results into an ordered global match list', () => {
    expect(
      flattenComponentSearchResults([
        {
          componentId: 'wan',
          matches: [{ lineNumber: 7, preview: 'wan generate' }],
        },
        {
          componentId: 'wifi',
          matches: [
            { lineNumber: 2, preview: 'wifi generate' },
            { lineNumber: 5, preview: 'wifi generate again' },
          ],
        },
      ]),
    ).toEqual([
      { componentId: 'wan', lineNumber: 7, preview: 'wan generate' },
      { componentId: 'wifi', lineNumber: 2, preview: 'wifi generate' },
      { componentId: 'wifi', lineNumber: 5, preview: 'wifi generate again' },
    ]);
  });

  it('groups global matches by component id and builds the visible-component set', () => {
    const matches = [
      { componentId: 'wan', lineNumber: 7, preview: 'wan generate' },
      { componentId: 'wifi', lineNumber: 2, preview: 'wifi generate' },
      { componentId: 'wifi', lineNumber: 5, preview: 'wifi generate again' },
    ];

    expect(groupLogMatchesByComponentId(matches)).toEqual({
      wan: [7],
      wifi: [2, 5],
    });

    expect(buildMatchedComponentIdSet(matches)).toEqual(new Set(['wan', 'wifi']));
  });
});
