import { describe, it, expect } from 'vitest';
import { toMinor, fromMinor, toMajor2, MINOR_UNITS_PER_UNIT, asNumber } from './currency';

describe('toMinor — exact decimal quantization (regression F1)', () => {
  it('rounds half-up on the third decimal instead of truncating via float', () => {
    expect(toMinor('1.005')).toBe(101); // old: 100
    expect(toMinor('8.165')).toBe(817); // old: 816
    expect(toMinor('2.675')).toBe(268);
    expect(toMinor('10.005')).toBe(1001);
    expect(toMinor('1234.56')).toBe(123456);
    expect(toMinor(1.005)).toBe(101);
    expect(toMinor(8.165)).toBe(817);
  });

  it('correctly rounds Prisma Decimal-like objects without IEEE 754 precision loss (M-EDU-FIN-006)', () => {
    const mockDecimal1 = {
      toString: () => '1.005',
      toNumber: () => 1.005,
    };
    expect(toMinor(mockDecimal1)).toBe(101);

    const mockDecimal2 = {
      toString: () => '8.165',
      toNumber: () => 8.165,
    };
    expect(toMinor(mockDecimal2)).toBe(817);

    const mockDecimal3 = {
      toString: () => '1234.56',
      toNumber: () => 1234.56,
    };
    expect(toMinor(mockDecimal3)).toBe(123456);
  });

  it('handles negatives and explicit positives symmetrically', () => {
    expect(toMinor('-3.005')).toBe(-301);
    expect(toMinor('-0.01')).toBe(-1);
    expect(toMinor('+1.005')).toBe(101);
    expect(toMinor('+8.165')).toBe(817);
  });

  it('keeps the float path for numeric inputs (incl. float noise)', () => {
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor(1000)).toBe(100000);
  });

  it('normalizes null/undefined/empty/non-numeric safely', () => {
    expect(toMinor(null)).toBe(0);
    expect(toMinor(undefined)).toBe(0);
    expect(Number.isNaN(toMinor('abc' as never))).toBe(true);
    expect(toMajor2('')).toBe(0);
  });
});

describe('fromMinor / toMajor2 round-trip', () => {
  it('round-trips typical money', () => {
    expect(fromMinor(123456)).toBe(1234.56);
    expect(toMajor2('120.5')).toBe(120.5);
    expect(toMajor2('0')).toBe(0);
  });
});

describe('asNumber heuristics', () => {
  it('accepts Prisma Decimal-like objects', () => {
    expect(asNumber({ toNumber: () => 42.5 })).toBe(42.5);
  });
  it('null/undefined coerce to 0', () => {
    expect(asNumber(null)).toBe(0);
    expect(asNumber(undefined)).toBe(0);
  });
});

describe('unit contract', () => {
  it('UZS has 100 minor units', () => {
    expect(MINOR_UNITS_PER_UNIT).toBe(100);
  });
});
