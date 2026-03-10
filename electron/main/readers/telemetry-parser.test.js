import { describe, expect, it } from 'vitest';
import { flattenTelemetryReport, parseTelemetryFile, stripLogPrefix } from './telemetry-parser.js';

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
