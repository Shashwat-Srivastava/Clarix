import { describe, expect, it } from 'vitest';
import { findTelemetryMatchPaths } from './search-utils.js';

describe('findTelemetryMatchPaths', () => {
  it('returns matched JSON paths for matching report data', () => {
    const report = {
      data: {
        Report: [
          { 'Profile.Name': 'Advance Profile' },
          { Metric: 'wifi-connected' },
        ],
      },
    };

    expect(findTelemetryMatchPaths(report, 'wifi')).toEqual(['Report[1].Metric']);
  });

  it('falls back to raw JSON text for malformed reports', () => {
    const report = {
      rawJson: '{"Metric":"wifi-connected"}',
    };

    expect(findTelemetryMatchPaths(report, 'wifi')).toEqual(['root']);
  });
});
