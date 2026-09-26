import { describe, it, expect } from 'vitest';
import {
  isWithinQuietHours,
  nextQuietHoursEnd,
  parseClock,
} from '../quiet-hours';

const TASHKENT = 'Asia/Tashkent'; // fixed UTC+5, no DST

describe('quiet-hours: parseClock', () => {
  it('parses valid HH:mm to minutes of day', () => {
    expect(parseClock('00:00')).toBe(0);
    expect(parseClock('07:30')).toBe(450);
    expect(parseClock('23:59')).toBe(1439);
  });

  it('rejects missing and malformed values instead of guessing', () => {
    expect(parseClock(null)).toBeNull();
    expect(parseClock(undefined)).toBeNull();
    expect(parseClock('')).toBeNull();
    expect(parseClock('24:00')).toBeNull();
    expect(parseClock('7:30')).toBeNull();
    expect(parseClock('07:60')).toBeNull();
    expect(parseClock('evening')).toBeNull();
  });
});

describe('quiet-hours: isWithinQuietHours', () => {
  it('is false when the window is unconfigured or malformed (fail-safe: deliver)', () => {
    const now = new Date('2026-06-01T14:00:00Z');
    expect(isWithinQuietHours(now, null, null, 'UTC')).toBe(false);
    expect(isWithinQuietHours(now, '13:00', null, 'UTC')).toBe(false);
    expect(isWithinQuietHours(now, 'nope', '15:00', 'UTC')).toBe(false);
  });

  it('treats an equal start/end as DISABLED, not as an all-day window', () => {
    const now = new Date('2026-06-01T14:00:00Z');
    expect(isWithinQuietHours(now, '13:00', '13:00', 'UTC')).toBe(false);
  });

  it('handles a same-day window with start inclusive and end exclusive', () => {
    expect(isWithinQuietHours(new Date('2026-06-01T12:59:00Z'), '13:00', '15:00', 'UTC')).toBe(
      false,
    );
    expect(isWithinQuietHours(new Date('2026-06-01T13:00:00Z'), '13:00', '15:00', 'UTC')).toBe(
      true,
    );
    expect(isWithinQuietHours(new Date('2026-06-01T14:59:00Z'), '13:00', '15:00', 'UTC')).toBe(
      true,
    );
    expect(isWithinQuietHours(new Date('2026-06-01T15:00:00Z'), '13:00', '15:00', 'UTC')).toBe(
      false,
    );
  });

  it('supports windows that cross midnight', () => {
    const window = (iso: string) => isWithinQuietHours(new Date(iso), '22:00', '07:00', 'UTC');
    expect(window('2026-06-01T21:59:00Z')).toBe(false);
    expect(window('2026-06-01T22:00:00Z')).toBe(true);
    expect(window('2026-06-01T23:30:00Z')).toBe(true);
    expect(window('2026-06-02T00:00:00Z')).toBe(true);
    expect(window('2026-06-02T06:59:00Z')).toBe(true);
    expect(window('2026-06-02T07:00:00Z')).toBe(false);
    expect(window('2026-06-02T12:00:00Z')).toBe(false);
  });

  it('evaluates in the supplied timezone, never in UTC by assumption', () => {
    const instant = new Date('2026-06-01T19:00:00Z'); // 00:00 in Tashkent (UTC+5)
    expect(isWithinQuietHours(instant, '22:00', '07:00', TASHKENT)).toBe(true);
    expect(isWithinQuietHours(instant, '22:00', '07:00', 'UTC')).toBe(false);
  });

  it('falls back to UTC for an unknown timezone instead of throwing', () => {
    const instant = new Date('2026-06-01T23:00:00Z');
    expect(isWithinQuietHours(instant, '22:00', '07:00', 'Not/AZone')).toBe(true);
  });
});

describe('quiet-hours: nextQuietHoursEnd (deferral target)', () => {
  it('returns null when now is outside quiet hours', () => {
    expect(
      nextQuietHoursEnd(new Date('2026-06-01T12:00:00Z'), '22:00', '07:00', 'UTC'),
    ).toBeNull();
  });

  it('targets the NEXT day when inside the pre-midnight part of a crossing window', () => {
    const end = nextQuietHoursEnd(
      new Date('2026-01-01T18:00:00Z'), // 23:00 Tashkent, Jan 1
      '22:00',
      '07:00',
      TASHKENT,
    );
    // 07:00 Jan 2 Tashkent == 02:00Z Jan 2
    expect(end?.toISOString()).toBe('2026-01-02T02:00:00.000Z');
  });

  it('targets the SAME day when inside the post-midnight part of a crossing window', () => {
    const end = nextQuietHoursEnd(
      new Date('2026-01-01T01:00:00Z'), // 06:00 Tashkent, Jan 1
      '22:00',
      '07:00',
      TASHKENT,
    );
    // 07:00 Jan 1 Tashkent == 02:00Z Jan 1
    expect(end?.toISOString()).toBe('2026-01-01T02:00:00.000Z');
    expect(end!.getTime()).toBeGreaterThan(new Date('2026-01-01T01:00:00Z').getTime());
  });

  it('targets the window end later the same day for a non-crossing window', () => {
    const end = nextQuietHoursEnd(
      new Date('2026-06-01T13:30:00Z'),
      '13:00',
      '15:00',
      'UTC',
    );
    expect(end?.toISOString()).toBe('2026-06-01T15:00:00.000Z');
  });
});
