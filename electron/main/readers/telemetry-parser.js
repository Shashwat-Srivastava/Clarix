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
 * Extracts telemetry reports from raw pasted text.
 *
 * This handles three scenarios:
 * 1. Text with log prefixes AND `Report Size = ` terminators (same as telemetry2_0.txt)
 *    — delegates to parseTelemetryFile which strips prefixes and joins multi-line JSON.
 * 2. Text with log prefixes but NO `Report Size = ` terminator — strips the
 *    `<ts> <prog>: T2.<LEVEL> [tid=<id>]` prefix from every line so the multi-line
 *    JSON becomes a single contiguous blob, then brace-matches {"Report":[...]}.
 * 3. Raw JSON (no prefix at all) — brace-matched directly.
 *
 * Users may paste surrounding log noise; only valid Report blocks are extracted.
 *
 * @param {string} rawText
 * @returns {Array}
 */
export function parseRawTelemetryText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return [];
  }

  // First, try the standard log-prefixed parser — it handles telemetry2_0.txt format
  // (with proper cJSON Report = / Report Size = markers).
  const fromLogFormat = parseTelemetryFile(rawText);
  if (fromLogFormat.length > 0) {
    return fromLogFormat;
  }

  // Strip any log prefixes from each line so multi-line pasted reports become
  // a single contiguous JSON blob. This handles the case where the user pastes
  // telemetry log lines without the trailing `Report Size = ` terminator.
  // Also strip any leading `cJSON Report = ` marker if present on any line.
  const stripped = rawText
    .split('\n')
    .map((line) => stripLogPrefix(line).replace(/^cJSON Report = /, ''))
    .join('');

  // Fallback: extract {"Report":[...]} JSON blocks via brace matching.
  const reports = [];
  let searchStart = 0;

  while (searchStart < stripped.length) {
    const marker = stripped.indexOf('"Report"', searchStart);
    if (marker < 0) {
      break;
    }

    // Walk backwards to find the opening brace of the object containing "Report".
    let openBrace = marker - 1;
    while (openBrace >= 0 && stripped[openBrace] !== '{') {
      if (!/\s/.test(stripped[openBrace])) {
        openBrace = -1;
        break;
      }
      openBrace -= 1;
    }

    if (openBrace < 0) {
      searchStart = marker + 1;
      continue;
    }

    // Walk forward from the opening brace counting braces to find the matching close.
    let depth = 0;
    let closeBrace = -1;
    let inString = false;
    let escape = false;

    for (let i = openBrace; i < stripped.length; i += 1) {
      const ch = stripped[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (ch === '\\' && inString) {
        escape = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          closeBrace = i;
          break;
        }
      }
    }

    if (closeBrace < 0) {
      searchStart = marker + 1;
      continue;
    }

    const jsonCandidate = stripped.slice(openBrace, closeBrace + 1);
    searchStart = closeBrace + 1;

    try {
      const parsed = JSON.parse(jsonCandidate);
      if (!parsed || !Array.isArray(parsed.Report)) {
        continue;
      }

      const flatData = flattenTelemetryReport(parsed);
      const reportTime = flatData.Time;
      let timestamp;
      let rawTimestamp;

      if (reportTime && typeof reportTime === 'string') {
        const isoCandidate = reportTime.replace(' ', 'T');
        const fromReport = new Date(`${isoCandidate}Z`);
        if (!Number.isNaN(fromReport.getTime())) {
          timestamp = fromReport;
          rawTimestamp = reportTime;
        }
      }

      if (!timestamp) {
        timestamp = new Date();
        rawTimestamp = timestamp.toISOString().slice(0, 19);
      }

      reports.push({
        timestamp,
        rawTimestamp,
        data: parsed,
        flatData,
      });
    } catch {
      // Not valid JSON — skip this candidate.
    }
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
