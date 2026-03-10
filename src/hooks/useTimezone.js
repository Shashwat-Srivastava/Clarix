import { useMemo } from 'react';

const TZ_TO_IANA = {
  UTC: 'UTC',
  CET: 'Europe/Berlin',
  IST: 'Asia/Kolkata',
};

/**
 * Parses timestamp-like input values and treats telemetry strings as UTC.
 *
 * @param {string | Date | number} value
 * @returns {Date}
 */
function parseTimestamp(value) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number') {
    return new Date(value);
  }

  if (typeof value !== 'string') {
    return new Date('invalid');
  }

  const compactDateTime = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  const isoNoZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

  if (compactDateTime.test(value)) {
    return new Date(`${value.replace(' ', 'T')}Z`);
  }

  if (isoNoZone.test(value)) {
    return new Date(`${value}Z`);
  }

  return new Date(value);
}

/**
 * Exposes timezone-aware date formatting helpers.
 *
 * @param {{timezone:'UTC'|'CET'|'IST',onChange?:(tz:'UTC'|'CET'|'IST')=>void}} params
 * @returns {{timezone:'UTC'|'CET'|'IST',setTimezone:(tz:'UTC'|'CET'|'IST')=>void,formatTimestamp:(value:string|Date|number)=>string}}
 */
export function useTimezone({ timezone, onChange }) {
  const formatter = useMemo(() => {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: TZ_TO_IANA[timezone],
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }, [timezone]);

  /**
   * Formats timestamp values in the selected timezone.
   *
   * @param {string | Date | number} value
   * @returns {string}
   */
  const formatTimestamp = (value) => {
    const date = parseTimestamp(value);
    if (Number.isNaN(date.getTime())) {
      return 'Invalid timestamp';
    }

    return `${formatter.format(date)} ${timezone}`;
  };

  return {
    timezone,
    setTimezone: (nextTimezone) => onChange?.(nextTimezone),
    formatTimestamp,
  };
}
