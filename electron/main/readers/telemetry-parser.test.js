import { describe, expect, it } from 'vitest';
import {
  buildTelemetryManifest,
  flattenTelemetryReport,
  parseRawTelemetryText,
  parseTelemetryFile,
  stripLogPrefix,
} from './telemetry-parser.js';

describe('stripLogPrefix', () => {
  it('removes telemetry line prefix', () => {
    const line =
      '2026-02-06T00:00:42 telekom: T2.INFO [tid=2847359] cJSON Report = {"Report":[]}';

    expect(stripLogPrefix(line)).toBe('cJSON Report = {"Report":[]}');
  });
});

describe('flattenTelemetryReport', () => {
  it('flattens Report array of key-value objects', () => {
    const report = {
      Report: [{ Time: '2026-02-06 00:00:33' }, { 'Device.WiFi.Radio.1.Channel': '11;11;11' }],
    };

    expect(flattenTelemetryReport(report)).toEqual({
      Time: '2026-02-06 00:00:33',
      'Device.WiFi.Radio.1.Channel': '11;11;11',
    });
  });
});

describe('parseTelemetryFile', () => {
  it('parses multiline cJSON report blocks and sorts by timestamp', () => {
    const content = [
      '2026-02-06T00:00:42 telekom: T2.INFO [tid=2847359] cJSON Report = {"Report":[{"Time":"2026-02-06 00:00:33"},',
      '2026-02-06T00:00:42 telekom: T2.INFO [tid=2847359] {"Metric":"A"}]}',
      '2026-02-06T00:00:42 telekom: T2.INFO [tid=2847359] Report Size = 53807',
      '2026-02-06T00:00:40 telekom: T2.INFO [tid=2847358] cJSON Report = {"Report":[{"Time":"2026-02-06 00:00:31"},{"Metric":"B"}]}',
      '2026-02-06T00:00:40 telekom: T2.INFO [tid=2847358] Report Size = 1200',
    ].join('\n');

    const reports = parseTelemetryFile(content);

    expect(reports).toHaveLength(2);
    expect(reports[0].flatData.Time).toBe('2026-02-06 00:00:31');
    expect(reports[1].flatData.Time).toBe('2026-02-06 00:00:33');
    expect(reports[0].sequenceNumber).toBe(1);
    expect(reports[1].sequenceNumber).toBe(2);
  });

  it('keeps malformed JSON payloads with parseError', () => {
    const content = [
      '2026-02-06T00:00:42 telekom: T2.INFO [tid=2847359] cJSON Report = {"Report":[{',
      '2026-02-06T00:00:42 telekom: T2.INFO [tid=2847359] Report Size = 100',
    ].join('\n');

    const reports = parseTelemetryFile(content);

    expect(reports).toHaveLength(1);
    expect(reports[0].data).toBeNull();
    expect(reports[0].parseError).toBeTruthy();
    expect(reports[0].rawJson).toContain('{"Report"');
  });
});

describe('buildTelemetryManifest', () => {
  it('includes Profile.Name for viewer-side profile filtering', () => {
    const reports = [
      {
        timestamp: new Date('2026-02-06T00:00:31.000Z'),
        rawTimestamp: '2026-02-06 00:00:31',
        sequenceNumber: 1,
        flatData: {
          Time: '2026-02-06 00:00:31',
          'Profile.Name': 'Advance Profile',
        },
      },
    ];

    expect(buildTelemetryManifest(reports)).toEqual([
      expect.objectContaining({
        profileName: 'Advance Profile',
      }),
    ]);
  });
});

describe('parseRawTelemetryText', () => {
  it('extracts a single raw cJSON Report block', () => {
    const pasted = `
      Some unrelated log noise
      {"Report":[{"Profile.Name":"Test"},{"Time":"2026-04-09 10:00:00"},{"FieldA":42}]}
      more noise after
    `;

    const reports = parseRawTelemetryText(pasted);

    expect(reports).toHaveLength(1);
    expect(reports[0].data.Report).toHaveLength(3);
    expect(reports[0].flatData['Profile.Name']).toBe('Test');
    expect(reports[0].flatData.FieldA).toBe(42);
    expect(reports[0].sequenceNumber).toBe(1);
  });

  it('extracts multiple Report blocks and sorts by Time', () => {
    const pasted = `
      {"Report":[{"Time":"2026-04-09 11:00:00"},{"Kind":"second"}]}
      random junk
      {"Report":[{"Time":"2026-04-09 10:00:00"},{"Kind":"first"}]}
    `;

    const reports = parseRawTelemetryText(pasted);

    expect(reports).toHaveLength(2);
    expect(reports[0].flatData.Kind).toBe('first');
    expect(reports[1].flatData.Kind).toBe('second');
  });

  it('returns an empty array when no Report block is present', () => {
    expect(parseRawTelemetryText('just some logs, no json here')).toEqual([]);
    expect(parseRawTelemetryText('')).toEqual([]);
  });

  it('ignores objects that do not contain a Report array', () => {
    const pasted = '{"NotAReport":{"x":1}} {"Report":[{"A":1}]}';
    const reports = parseRawTelemetryText(pasted);

    expect(reports).toHaveLength(1);
    expect(reports[0].flatData.A).toBe(1);
  });

  it('strips log prefixes from multi-line telemetry without a Report Size terminator', () => {
    // Simulates a user pasting telemetry log lines where each line has the
    // "<ts> telekom: T2.INFO [tid=<id>]" prefix and the JSON is split across
    // multiple lines, but the closing `Report Size = ` marker is missing.
    const pasted = [
      '2026-02-19T12:04:16 telekom: T2.INFO [tid=2905509] Elapsed Time for Collecting TR-181 params : Advanced_dynamic = 16.752140190 (Sec.NanoSec)',
      '2026-02-19T12:04:16 telekom: T2.INFO [tid=2905509] cJSON Report = {"Report":[{"Time":"2026-02-19 12:03:59"},{"Profile.Name":"Advanced_dynamic"},{"Profile.Version":"1"},{"mac":"55:55:55:50:6B:3F"},{"Device.DeviceInfo.UpTime":"128283"',
      '2026-02-19T12:04:16 telekom: T2.INFO [tid=2905509] },{"Device.IP.Interface.1.IPv6Address.1.IPAddress":"fe80::56b7:bdff:fe50:6b49"},{"Device.DeviceInfo.SoftwareVersion":"004.208.001"}',
      '2026-02-19T12:04:16 telekom: T2.INFO [tid=2905509] ]}',
    ].join('\n');

    const reports = parseRawTelemetryText(pasted);

    expect(reports).toHaveLength(1);
    expect(reports[0].flatData['Profile.Name']).toBe('Advanced_dynamic');
    expect(reports[0].flatData['Profile.Version']).toBe('1');
    expect(reports[0].flatData.mac).toBe('55:55:55:50:6B:3F');
    expect(reports[0].flatData['Device.DeviceInfo.UpTime']).toBe('128283');
    expect(reports[0].flatData['Device.DeviceInfo.SoftwareVersion']).toBe('004.208.001');
    expect(reports[0].rawTimestamp).toBe('2026-02-19 12:03:59');
  });

  it('parses log-prefixed telemetry via the standard parser', () => {
    const pasted = [
      '2026-02-06T00:00:42 telekom: T2.INFO [tid=2847] cJSON Report = {"Report":[{"A":1}]}',
      '2026-02-06T00:00:42 telekom: T2.INFO [tid=2847] Report Size = 20',
    ].join('\n');

    const reports = parseRawTelemetryText(pasted);

    expect(reports).toHaveLength(1);
    expect(reports[0].flatData.A).toBe(1);
  });
});
