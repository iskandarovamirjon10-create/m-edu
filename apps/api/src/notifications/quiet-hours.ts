/**
 * Timezone-aware quiet-hours evaluation.
 *
 * Quiet hours must never DROP a notification — the pipeline defers it until the
 * window closes (see `NotificationDeliveryService` / the Telegram delivery
 * sweep). This module is the pure, testable core of that decision: no I/O, no
 * Prisma, no Nest, so every boundary case is unit-testable.
 *
 * Conventions (all deliberate):
 *   - `start` is INCLUSIVE, `end` is EXCLUSIVE: a window of 22:00–07:00 covers
 *     22:00:00 through 06:59:59.
 *   - A window whose start equals its end is treated as DISABLED (a zero-length
 *     window is far more likely a half-filled settings form than "all day"
 *     silence; "all day" is expressed by disabling Telegram instead).
 *   - Crossing midnight (start > end) is supported: 22:00–07:00.
 *   - The timezone is the user's, falling back to the organization's, falling
 *     back to UTC. UTC is never *assumed* when a real timezone is known.
 */

export const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Parse a wall-clock `HH:mm` into minutes since midnight, or null. */
export function parseClock(value?: string | null): number | null {
  if (!value) return null;
  const match = CLOCK_PATTERN.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * True when `now` falls inside the quiet-hours window.
 *
 * Returns false when the window is unconfigured, malformed, or zero-length —
 * i.e. the safe default is "not quiet" (deliver now).
 */
export function isWithinQuietHours(
  now: Date,
  start?: string | null,
  end?: string | null,
  timeZone?: string | null,
): boolean {
  const startMin = parseClock(start);
  const endMin = parseClock(end);
  if (startMin === null || endMin === null) return false;
  if (startMin === endMin) return false;

  const current = minutesOfDay(now, timeZone);
  if (current === null) return false;

  if (startMin > endMin) {
    // Window crosses midnight.
    return current >= startMin || current < endMin;
  }
  return current >= startMin && current < endMin;
}

/**
 * The instant the current quiet window ends, or null when `now` is not inside
 * one. Used to schedule the deferred re-delivery.
 */
export function nextQuietHoursEnd(
  now: Date,
  start?: string | null,
  end?: string | null,
  timeZone?: string | null,
): Date | null {
  if (!isWithinQuietHours(now, start, end, timeZone)) return null;

  const endMin = parseClock(end)!;
  const startMin = parseClock(start)!;
  const endHour = Math.floor(endMin / 60);
  const endMinute = endMin % 60;

  const local = localParts(now, timeZone);
  if (!local) return null;

  const crossesMidnight = startMin > endMin;
  // When the window crosses midnight and we are still in the pre-midnight part,
  // the end is the NEXT calendar day.
  const addDays = crossesMidnight && local.minutes >= startMin ? 1 : 0;

  return zonedWallTimeToUtc(
    local.year,
    local.month,
    local.day + addDays,
    endHour,
    endMinute,
    timeZone,
  );
}

/** Minutes since local midnight in `timeZone`, or null when it cannot be read. */
export function minutesOfDay(now: Date, timeZone?: string | null): number | null {
  const parts = localParts(now, timeZone);
  if (!parts) return null;
  return parts.minutes;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** Minutes since local midnight. */
  minutes: number;
}

function localParts(date: Date, timeZone?: string | null): LocalParts | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: safeZone(timeZone),
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const byType: Record<string, number> = {};
    for (const part of formatter.formatToParts(date)) {
      if (part.type !== 'literal') byType[part.type] = Number(part.value);
    }
    const hour = byType.hour === 24 ? 0 : byType.hour;
    return {
      year: byType.year,
      month: byType.month,
      day: byType.day,
      hour,
      minute: byType.minute,
      minutes: hour * 60 + byType.minute,
    };
  } catch {
    return null;
  }
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC instant.
 *
 * Two-pass: the first pass lands within an hour or two of the answer, the
 * second pass re-reads the offset at that instant so a DST transition between
 * "now" and the target does not skew the result.
 */
function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone?: string | null,
): Date {
  const zone = safeZone(timeZone);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let ts = wallAsUtc - zoneOffsetMs(new Date(wallAsUtc), zone);
  ts = wallAsUtc - zoneOffsetMs(new Date(ts), zone);
  return new Date(ts);
}

/** Offset (ms) of `timeZone` at `date`: local wall clock minus UTC. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const byType: Record<string, number> = {};
    for (const part of formatter.formatToParts(date)) {
      if (part.type !== 'literal') byType[part.type] = Number(part.value);
    }
    const hour = byType.hour === 24 ? 0 : byType.hour;
    const asUtc = Date.UTC(
      byType.year,
      byType.month - 1,
      byType.day,
      hour,
      byType.minute,
      byType.second,
    );
    return asUtc - date.getTime();
  } catch {
    return 0;
  }
}

/** Guard against a malformed timezone string turning into an exception. */
function safeZone(timeZone?: string | null): string {
  if (!timeZone) return 'UTC';
  try {
    // Throws RangeError for an unknown IANA zone.
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return 'UTC';
  }
}
