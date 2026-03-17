import { describe, expect, it } from 'vitest';
import {
  buildGlobalSearchMatches,
  buildMatchedReportIndexSet,
  getProfileNeedle,
  groupMatchesByReportIndex,
} from './viewer-search-state.js';

describe('viewer-search-state', () => {
  const reportManifest = [
    { index: 0, profileName: 'Advance Profile' },
    { index: 1, profileName: 'Basic Profile' },
    { index: 2, profileName: 'generateOnDemand' },
  ];

  const reports = [
    {
      flatData: { 'Profile.Name': 'Advance Profile' },
      data: { Report: [{ Metric: 'advance-only' }] },
    },
    {
      flatData: { 'Profile.Name': 'Basic Profile' },
      data: { Report: [{ Metric: 'basic-only' }] },
    },
    {
      flatData: { 'Profile.Name': 'generateOnDemand' },
      data: { Report: [{ Metric: 'generate profile string' }] },
    },
  ];

  it('maps profile buttons to the expected case-insensitive substring filters', () => {
    expect(getProfileNeedle('all')).toBe('');
    expect(getProfileNeedle('advance')).toBe('advance');
    expect(getProfileNeedle('basic')).toBe('basic');
    expect(getProfileNeedle('adhoc')).toBe('generate');
  });

  it('returns no matches when a search term does not exist in the selected profile bucket', () => {
    expect(
      buildGlobalSearchMatches({
        reports,
        reportManifest,
        profileNameFilter: 'basic',
        query: 'generate',
      }),
    ).toEqual([]);

    expect(
      buildGlobalSearchMatches({
        reports,
        reportManifest,
        profileNameFilter: 'advance',
        query: 'generate',
      }),
    ).toEqual([]);
  });

  it('keeps only matches from the currently selected profile group', () => {
    expect(
      buildGlobalSearchMatches({
        reports,
        reportManifest,
        profileNameFilter: 'adhoc',
        query: 'generate',
      }),
    ).toEqual([{ reportIndex: 2, path: 'Report[0].Metric' }]);
  });

  it('groups report matches by report index for detail highlighting', () => {
    const matches = [
      { reportIndex: 2, path: 'Report[0].Metric' },
      { reportIndex: 2, path: 'Report[0].Profile.Name' },
      { reportIndex: 0, path: 'Report[0].Metric' },
    ];

    expect(groupMatchesByReportIndex(matches)).toEqual({
      0: ['Report[0].Metric'],
      2: ['Report[0].Metric', 'Report[0].Profile.Name'],
    });

    expect(buildMatchedReportIndexSet(matches)).toEqual(new Set([0, 2]));
  });
});
