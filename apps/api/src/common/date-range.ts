/**
 * Inclusive/exclusive day-boundary helpers for Prisma date filters.
 *
 * Passing a bare `YYYY-MM-DD` string to Prisma parses it as UTC midnight.
 * Using that value directly with `lte` silently drops every row later on the
 * same day (the classic off-by-one). Always build ranges with these helpers:
 *
 *   where.date = { gte: startOfDay(d), lt: endOfDayExclusive(d) }
 *   // or, when only an upper bound is known:
 *   where.date = { lte: endOfDayInclusive(d) }
 */

function toDate(value: string | Date | undefined | null): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Start of the calendar day (00:00:00.000) for the given date, in UTC. */
export function startOfDay(value: string | Date): Date {
  const d = toDate(value);
  if (!d) throw new TypeError('startOfDay: invalid date');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Last millisecond of the calendar day (23:59:59.999), for use with `lte`.
 * When the input already carries a time component that is later than midnight,
 * the original timestamp is preserved (so `endOfDay('2026-01-01T15:00:00Z')`
 * does not rewind the upper bound).
 */
export function endOfDayInclusive(value: string | Date): Date {
  const d = toDate(value);
  if (!d) throw new TypeError('endOfDayInclusive: invalid date');
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const hasTime =
    d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0 || d.getUTCMilliseconds() !== 0;
  if (hasTime && d.getTime() > midnight + 23 * 3600 * 1000 + 59 * 60 * 1000 + 59 * 1000 + 999) {
    return d;
  }
  return new Date(midnight + 24 * 60 * 60 * 1000 - 1);
}

/**
 * Exclusive upper bound (next day 00:00:00.000), for use with `lt`.
 * Preferred when pairing with `startOfDay` so ranges never overlap.
 */
export function endOfDayExclusive(value: string | Date): Date {
  const d = toDate(value);
  if (!d) throw new TypeError('endOfDayExclusive: invalid date');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + 24 * 60 * 60 * 1000);
}

/**
 * Normalize a `dateTo` filter value to an inclusive end-of-day Date.
 * Returns null when the input is missing/invalid so callers can skip the filter.
 */
export function toDateToInclusive(value: string | Date | undefined | null): Date | null {
  const d = toDate(value ?? null);
  if (!d) return null;
  return endOfDayInclusive(d);
}


/**
 * Derives the canonical attendance date for a given timestamp and timezone.
 * Uses Intl.DateTimeFormat to avoid fixed UTC offset issues with DST.
 * This MUST be used by all attendance logic (camera, manual, etc.) to
 * guarantee consistent idempotency and business dates.
 */
export function getOrganizationDate(date: Date, timezone?: string | null): Date {
  const tz = timezone?.trim() || 'UTC';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    // Fallback if Intl fails
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  // The resulting Date is the UTC representation of midnight on that calendar day.
  return new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10)));
}

/**
 * Returns local day and minutes from midnight for arrival status checks.
 */
export function getLocalDateTime(date: Date, timezone?: string | null): { dayOfWeek: string; minutes: number } {
  const tz = timezone?.trim() || 'UTC';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const dayOfWeek = parts.find((p) => p.type === 'weekday')?.value?.toUpperCase() || 'MONDAY';
  let hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  
  if (hour === 24) hour = 0;
  
  return { dayOfWeek, minutes: hour * 60 + minute };
}
