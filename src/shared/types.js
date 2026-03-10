/**
 * @typedef {Object} ComponentManifest
 * @property {string} id
 * @property {string} name
 * @property {string} mergedFilePath
 * @property {number} sizeBytes
 * @property {number} [lineCount]
 * @property {boolean} hasTelemetry
 */

/**
 * @typedef {Object} TelemetryReport
 * @property {Date} timestamp
 * @property {string} rawTimestamp
 * @property {number} [sequenceNumber]
 * @property {Object | null} data
 * @property {Object} flatData
 * @property {string} [rawJson]
 * @property {string} [parseError]
 */

/**
 * @typedef {Object} SessionState
 * @property {string} id
 * @property {string} name
 * @property {'idle'|'loading'|'ready'|'error'} status
 * @property {number} archiveCount
 * @property {ComponentManifest[]} components
 * @property {string|null} telemetryComponentId
 * @property {'home'|'log-viewer'|'telemetry-viewer'|'telemetry-table'} activeView
 * @property {string|null} selectedComponentId
 * @property {number|null} selectedTelemetryIndex
 * @property {Timezone} timezone
 * @property {Object|null} columnVisibility
 * @property {string|null} errorMessage
 * @property {number} createdAt
 */

/**
 * @typedef {'UTC' | 'CET' | 'IST'} Timezone
 */

export {};
