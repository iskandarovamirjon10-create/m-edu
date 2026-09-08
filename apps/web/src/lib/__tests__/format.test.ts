import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatCurrency, fullName, initials, timeAgo, toBase64 } from '@/lib/format';

describe('format helpers', () => {
  it('formats dates', () => {
    expect(formatDate('2026-09-05T00:00:00.000Z')).toMatch(/Sep/);
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
  });

  it('formats date-times', () => {
    const out = formatDateTime('2026-09-05T10:30:00.000Z');
    expect(out).toContain('2026');
    expect(out).toContain('Sep');
  });

  it('formats currency', () => {
    expect(formatCurrency('120.5')).toBe('$120.50');
    expect(formatCurrency(1000)).toBe('$1,000.00');
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency('')).toBe('—');
    expect(formatCurrency('abc')).toBe('—');
  });

  it('joins names', () => {
    expect(fullName('Aziz', 'Karimov')).toBe('Aziz Karimov');
    expect(fullName('Aziz', null)).toBe('Aziz');
    expect(fullName(null, null)).toBe('—');
  });

  it('computes initials', () => {
    expect(initials('Aziz', 'Karimov')).toBe('AK');
    expect(initials(null, null)).toBe('?');
  });

  it('timeAgo', () => {
    expect(timeAgo(new Date().toISOString())).toBe('just now');
    expect(timeAgo(null)).toBe('—');
  });

  it('toBase64 strips the data URL prefix', async () => {
    // minimal PNG header
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'x.png', { type: 'image/png' });
    const b64 = await toBase64(file);
    expect(b64).not.toContain('data:');
    expect(b64.length).toBeGreaterThan(0);
  });
});
