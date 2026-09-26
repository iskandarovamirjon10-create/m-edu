export function formatDate(value?: string | null, locale?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const loc = locale || (typeof navigator !== 'undefined' ? navigator.language : undefined) || 'en-US';
  
  // [Fix #62] Prevent timezone shift for dates that are midnight UTC
  const isMidnightUTC = typeof value === 'string' && value.endsWith('T00:00:00.000Z');
  
  return d.toLocaleDateString(loc, { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    timeZone: isMidnightUTC ? 'UTC' : undefined 
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

export function formatCurrency(
  value: string | number | null | undefined,
  options?: { locale?: string; currency?: string },
): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return '—';
  const loc = options?.locale || (typeof navigator !== 'undefined' ? navigator.language : undefined) || 'en-US';
  const currency = options?.currency || 'USD';
  return new Intl.NumberFormat(loc, { style: 'currency', currency }).format(n);
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
