export function formatDate(value?: string | null, locale?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const loc = locale || (typeof navigator !== 'undefined' ? navigator.language : undefined) || 'en-US';
  
  // [Fix #62] Prevent timezone shift for dates that are midnight UTC or date-only (YYYY-MM-DD)
  const isDateOnlyOrMidnight =
    typeof value === 'string' &&
    (/^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ||
      value.endsWith('T00:00:00.000Z') ||
      value.endsWith('T00:00:00Z') ||
      value.endsWith('T00:00:00'));

  return d.toLocaleDateString(loc, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: isDateOnlyOrMidnight ? 'UTC' : undefined,
  });
}

export function formatDateTime(value?: string | null, locale?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const loc = locale || (typeof navigator !== 'undefined' ? navigator.language : undefined) || 'en-US';
  return d.toLocaleString(loc, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Robust financial amount parser for enterprise multi-currency handling.
 * Safely parses:
 *  - Numbers and BigInts
 *  - Space separated thousands: "1 500 000", "1 500 000.50", "1 500 000,50"
 *  - Non-breaking spaces (\u00A0, \u202F)
 *  - Comma separated thousands: "1,500,000", "1,500,000.50"
 *  - European dot thousands: "1.500.000,50", "1.500.000"
 *  - Accounting negatives: "(1 500 000)", "-1 500 000"
 *  - Currency labels / suffixes: "1 500 000 UZS", "$1,500.00", "so'm"
 *  - Tiyin / cent precision rounding (2 decimal places)
 */
export function parseFinancialAmount(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return NaN;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : NaN;
  }
  let str = String(raw).trim();
  if (!str) return NaN;

  // Check negative signs
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  } else if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1).trim();
  } else if (str.startsWith('+')) {
    str = str.slice(1).trim();
  }

  // Remove common currency symbols and words
  str = str.replace(/[$\u20AC\u00A3\u00A5\u20BD\u058F]/g, '');
  str = str.replace(/\b(uzs|so'?m|сум|usd|eur|rub)\b/gi, '');

  // Strip all whitespace including non-breaking spaces
  str = str.replace(/[\s\u00A0\u202F\uFEFF]+/g, '');
  if (!str) return NaN;

  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastDot > lastComma) {
      // e.g. "1,500,000.50"
      str = str.replace(/,/g, '');
    } else {
      // e.g. "1.500.000,50"
      str = str.replace(/\./g, '').replace(/,/g, '.');
    }
  } else if (lastComma !== -1) {
    const parts = str.split(',');
    if (parts.length > 2) {
      // "1,500,000"
      str = str.replace(/,/g, '');
    } else if (parts.length === 2) {
      // "500,000" vs "123,50"
      if (parts[1].length === 3 && parts[1] === '000') {
        str = parts[0] + parts[1];
      } else if (parts[1].length === 3 && /^\d{1,3}$/.test(parts[0])) {
        str = parts[0] + parts[1];
      } else {
        str = parts[0] + '.' + parts[1];
      }
    }
  } else if (lastDot !== -1) {
    const parts = str.split('.');
    if (parts.length > 2) {
      str = str.replace(/\./g, '');
    } else if (parts.length === 2 && parts[1].length === 3 && parts[1] === '000') {
      str = parts[0] + parts[1];
    }
  }

  const val = parseFloat(str);
  if (!Number.isFinite(val)) return NaN;
  const result = isNegative ? -Math.abs(val) : val;
  return Math.round(result * 100) / 100;
}

export function formatCurrency(
  value: string | number | null | undefined,
  options?: { locale?: string; currency?: string },
): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : parseFinancialAmount(value);
  if (!Number.isFinite(n)) return '—';
  const currency = options?.currency || 'UZS';
  const loc = options?.locale || (currency === 'UZS' ? 'uz-UZ' : (typeof navigator !== 'undefined' ? navigator.language : undefined) || 'en-US');
  return new Intl.NumberFormat(loc, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'UZS' ? 0 : 2,
  }).format(n);
}

export function fullName(
  first?: string | null,
  last?: string | null,
): string {
  return [first, last].filter(Boolean).join(' ') || '—';
}

export function initials(first?: string | null, last?: string | null): string {
  return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase() || '?';
}

export function timeAgo(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return '—';
  const seconds = Math.floor((Date.now() - d) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


/**
 * Format an API month bucket (DATE_TRUNC('month') → Date ISO string) into a
 * short human label, e.g. "Aug 2026". Falls back to the raw value when the
 * input is not a parseable date.
 */
/**
 * Format a schedule time ("HH:MM" or "HH:MM:SS", 24h) into a 12h display
 * string ("9:00 AM"). Falls back to the raw value when unparseable.
 */
export function formatTime(value?: string | null): string {
  if (!value) return '—';
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!m) return value;
  const h = parseInt(m[1], 10);
  const min = m[2];
  if (Number.isNaN(h) || h < 0 || h > 23) return value;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${min} ${period}`;
}

export function formatMonth(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const loc = (typeof navigator !== 'undefined' ? navigator.language : undefined) || 'en-US';
  return d.toLocaleDateString(loc, { month: 'short', year: 'numeric' });
}

export function toLocalISOString(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
