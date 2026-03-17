import fsp from 'node:fs/promises';
import { flattenJson } from '../utils/flatten.js';

export const LOG_PREFIX_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2} \S+: T2\.\w+ \[tid=\d+\] /;

const PREFIX_MATCHER =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}) \S+: T2\.\w+ \[tid=(\d+)\] (.*)$/s;

/**
 * Removes telemetry log prefix metadata from a single line.
 *
 * @param {string} line
 * @returns {string}
 */
export function stripLogPrefix(line) {
  return line.replace(LOG_PREFIX_REGEX, '');
}

/**
 * Flattens telemetry report key-value array into an object map.
 *
 * @param {Object} reportData
 * @returns {Object}
 */
export function flattenTelemetryReport(reportData) {
  const flat = {};

  if (!reportData || !Array.isArray(reportData.Report)) {
    return flat;
  }

  for (const item of reportData.Report) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const [key] = Object.keys(item);
    if (!key) {
      continue;
    }

    const value = item[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = flattenJson(value, key, {});
      Object.assign(flat, nested);
      continue;
    }

    flat[key] = value;
  }

  return flat;
}

/**
 * Parses a telemetry report timestamp string.
 *
 * @param {string | undefined} reportTime
 * @param {string} fallbackRawTimestamp
 * @returns {{rawTimestamp:string, timestamp:Date}}
 */
function resolveTelemetryTimestamp(reportTime, fallbackRawTimestamp) {
  if (reportTime && typeof reportTime === 'string') {
    const isoCandidate = reportTime.replace(' ', 'T');
    const fromReport = new Date(`${isoCandidate}Z`);
    if (!Number.isNaN(fromReport.getTime())) {
      return {
        rawTimestamp: reportTime,
        timestamp: fromReport,
      };
    }
  }

  const fromLine = new Date(`${fallbackRawTimestamp}Z`);
  return {
    rawTimestamp: fallbackRawTimestamp,
    timestamp: Number.isNaN(fromLine.getTime()) ? new Date(0) : fromLine,
  };
}

/**
 * Parses a full telemetry2_0 merged log file.
 *
 * @param {string} fileContent
 * @returns {Array}
 */
export function parseTelemetryFile(fileContent) {
  const lines = fileContent.split('\n');
  const reports = [];

  let currentReportLines = null;
  let currentTimestamp = null;
  let currentTid = null;

  for (const line of lines) {
    const prefixMatch = line.match(PREFIX_MATCHER);
    if (!prefixMatch) {
      continue;
    }

    const [, timestamp, tid, content] = prefixMatch;

    if (content.startsWith('cJSON Report = ')) {
      currentTimestamp = timestamp;
      currentTid = tid;
      currentReportLines = [content.slice('cJSON Report = '.length)];
      continue;
    }

    if (!currentReportLines || tid !== currentTid) {
      continue;
    }

    if (content.startsWith('Report Size = ')) {
      const rawJson = currentReportLines.join('');

      try {
        const parsed = JSON.parse(rawJson);
        const flatData = flattenTelemetryReport(parsed);
        const { timestamp: reportTimestamp, rawTimestamp } = resolveTelemetryTimestamp(
          flatData.Time,
          currentTimestamp,
        );

        reports.push({
          timestamp: reportTimestamp,
          rawTimestamp,
          data: parsed,
          flatData,
        });
      } catch (error) {
        const fallbackTimestamp = new Date(`${currentTimestamp}Z`);

        reports.push({
          timestamp: Number.isNaN(fallbackTimestamp.getTime()) ? new Date(0) : fallbackTimestamp,
          rawTimestamp: currentTimestamp,
          data: null,
          flatData: {},
          rawJson,
          parseError: error instanceof Error ? error.message : 'Unknown telemetry parse error',
        });
      }

      currentReportLines = null;
      currentTid = null;
      currentTimestamp = null;
      continue;
    }

    currentReportLines.push(content);
  }

  reports.sort((a, b) => a.timestamp - b.timestamp);
  return reports.map((report, index) => ({ ...report, sequenceNumber: index + 1 }));
}

/**
 * Parses telemetry reports from a merged telemetry file path.
 *
 * @param {string} filePath
 * @returns {Promise<Array>}
 */
export async function parseTelemetryFileFromPath(filePath) {
  const content = await fsp.readFile(filePath, 'utf8');
  return parseTelemetryFile(content);
}

/**
 * Builds a lightweight telemetry list payload.
 *
 * @param {Array} reports
 * @returns {Array<{index:number,timestamp:string,rawTimestamp:string,sequenceNumber:number,summary:string,totalFields:number,hasError:boolean,profileName:string}>}
 */
export function buildTelemetryManifest(reports) {
  return reports.map((report, index) => ({
    index,
    timestamp: report.timestamp.toISOString(),
    rawTimestamp: report.rawTimestamp,
    sequenceNumber: report.sequenceNumber,
    summary: `${Object.keys(report.flatData || {}).length} fields`,
    totalFields: Object.keys(report.flatData || {}).length,
    hasError: Boolean(report.parseError),
    profileName: String(report.flatData?.['Profile.Name'] ?? ''),
  }));
}
