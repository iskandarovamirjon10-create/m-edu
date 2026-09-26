/**
 * Telegram message formatting helpers.
 *
 * Messages are sent with `parse_mode: 'HTML'`. Any value derived from user
 * data (names, group titles, course names, notes) MUST pass through
 * `escapeHtml` before being interpolated, otherwise a student named
 * `A&B <b>` could break — or forge — the message layout.
 *
 * Only `&`, `<` and `>` are significant in Telegram's HTML subset; escaping
 * exactly those (and in that order) is sufficient and keeps the text readable.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** `First Last`, trimmed, or a dash when both parts are empty. */
export function formatName(
  first?: string | null,
  last?: string | null,
): string {
  const name = `${first ?? ''} ${last ?? ''}`.trim();
  return name.length > 0 ? name : '—';
}

/**
 * Format a monetary value for display.
 *
 * Prisma `Decimal` exposes `toFixed`; numbers/strings are normalised through
 * `Number`. Non-numeric input is rendered as an empty string rather than
 * `NaN` leaking into a user-facing message.
 */
export function formatMoney(value: unknown, currency = 'UZS'): string {
  if (value === null || value === undefined) return `0 ${currency}`;
  const decimal =
    typeof value === 'object' && value !== null && 'toFixed' in value
      ? Number((value as { toFixed: (n: number) => string }).toFixed(2))
      : Number(value);
  if (!Number.isFinite(decimal)) return `0 ${currency}`;
  const formatted = decimal.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currency}`;
}

/** `YYYY-MM-DD` for a Date/ISO string, in UTC (stable across server locales). */
export function formatDate(value: unknown): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().slice(0, 10);
}

/** Hard-truncate a rendered line so one field cannot dominate the message. */
export function truncate(value: string, max = 4000): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
