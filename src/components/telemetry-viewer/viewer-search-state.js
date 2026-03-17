import { findTelemetryMatchPaths } from './search-utils.js';

export const PROFILE_FILTERS = {
  all: '',
  advance: 'advance',
  basic: 'basic',
  adhoc: 'generate',
};

/**
 * Returns the profile substring for a selected profile filter.
 *
 * @param {string} profileNameFilter
 * @returns {string}
 */
export function getProfileNeedle(profileNameFilter) {
  return PROFILE_FILTERS[profileNameFilter] ?? '';
}

/**
 * Builds global search matches for telemetry viewer search.
 *
 * @param {{reports:any[],reportManifest:any[],profileNameFilter:string,query:string}} params
 * @returns {Array<{reportIndex:number,path:string}>}
 */
export function buildGlobalSearchMatches({
  reports,
  reportManifest,
  profileNameFilter,
  query,
}) {
  const trimmedQuery = String(query ?? '').trim();
  if (!trimmedQuery) {
    return [];
  }

  const profileNeedle = getProfileNeedle(profileNameFilter);
  const matches = [];

  reports.forEach((report, index) => {
    const manifestReport = reportManifest[index];
    const profileName = String(report?.flatData?.['Profile.Name'] ?? manifestReport?.profileName ?? '')
      .toLowerCase();

    if (profileNeedle && !profileName.includes(profileNeedle)) {
      return;
    }

    findTelemetryMatchPaths(report, trimmedQuery).forEach((path) => {
      matches.push({ reportIndex: index, path });
    });
  });

  return matches;
}

/**
 * Groups match paths by report index.
 *
 * @param {Array<{reportIndex:number,path:string}>} matches
 * @returns {Record<number, string[]>}
 */
export function groupMatchesByReportIndex(matches) {
  return matches.reduce((accumulator, match) => {
    accumulator[match.reportIndex] ??= [];
    accumulator[match.reportIndex].push(match.path);
    return accumulator;
  }, {});
}

/**
 * Builds a set of report indexes that contain at least one search match.
 *
 * @param {Array<{reportIndex:number,path:string}>} matches
 * @returns {Set<number>}
 */
export function buildMatchedReportIndexSet(matches) {
  return new Set(matches.map((match) => match.reportIndex));
}
