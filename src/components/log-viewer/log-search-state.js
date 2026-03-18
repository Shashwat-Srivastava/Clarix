/**
 * Flattens per-component search results into a single ordered match list.
 *
 * @param {Array<{componentId:string,matches:Array<{lineNumber:number,preview?:string}>}>} results
 * @returns {Array<{componentId:string,lineNumber:number,preview:string}>}
 */
export function flattenComponentSearchResults(results) {
  return results.flatMap((result) =>
    (result.matches ?? []).map((match) => ({
      componentId: result.componentId,
      lineNumber: match.lineNumber,
      preview: match.preview ?? '',
    })),
  );
}

/**
 * Groups global log matches by component id.
 *
 * @param {Array<{componentId:string,lineNumber:number,preview?:string}>} matches
 * @returns {Record<string, number[]>}
 */
export function groupLogMatchesByComponentId(matches) {
  return matches.reduce((accumulator, match) => {
    accumulator[match.componentId] ??= [];
    accumulator[match.componentId].push(match.lineNumber);
    return accumulator;
  }, {});
}

/**
 * Builds a set of component ids that contain at least one match.
 *
 * @param {Array<{componentId:string}>} matches
 * @returns {Set<string>}
 */
export function buildMatchedComponentIdSet(matches) {
  return new Set(matches.map((match) => match.componentId));
}
