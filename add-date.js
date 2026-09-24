const fs = require('fs');
let code = fs.readFileSync('apps/api/src/common/date-range.ts', 'utf8');
code += `

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
`;
fs.writeFileSync('apps/api/src/common/date-range.ts', code, 'utf8');
