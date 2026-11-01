/**
 * Core currency math helpers — pure, deterministic, decimal-safe.
 * 
 * Contract:
 *   - All money math is integer-based in MINOR units (tiyin for UZS:
 *     1 UZS = 100 tiyin). Inputs arrive as Prisma Decimal/string/number;
 *     they are converted once, quantized to minor units, and every
 *     intermediate value is an integer. No float ever touches money.
 *   - Round-half-up at each quantization, matching accounting norms.
 */

/** Number of minor units per major unit. UZS uses 2 (tiyin). */
export const MINOR_UNITS_PER_UNIT = 100;

const PLAIN_DECIMAL = /^[+-]?\d+\.?\d*$/;

/**
 * Exact decimal-string → minor units (round-half-up at the third decimal).
 * BigInt-based: "1.005" → 101, "8.165" → 817. The old `Number * 100` path
 * truncated such values (1.005*100 === 100.499…) and silently mis-rounded
 * three-decimal money (regression find F1).
 */
function decimalStringToMinor(raw: string): number {
  const neg = raw.startsWith('-');
  const hasSign = raw.startsWith('-') || raw.startsWith('+');
  const unsigned = raw.slice(Number(hasSign));
  const [intPart = '', fracPart = ''] = unsigned.split('.');
  const frac = (fracPart + '00').slice(0, 3); // minor digits + rounding digit
  const third = frac.length >= 3 ? Number(frac[2]) : 0;
  const minor = BigInt(intPart || '0') * 100n + BigInt(frac.slice(0, 2) || '0');
  const rounded = minor + (third >= 5 ? 1n : 0n);
  const result = Number(rounded);
  return neg ? -result : result;
}

export type DecimalLike = string | number | { toNumber(): number } | null | undefined;

export function asNumber(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber();
  return Number(value as unknown as number);
}

/**
 * Round-half-up a possibly-fractional value to an integer of minor units.
 * Applied once per external input so later math stays purely integral.
 */
export function toMinor(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;

  if (typeof value === 'object' && typeof (value as any).toString === 'function') {
    const str = (value as any).toString();
    if (typeof str === 'string' && PLAIN_DECIMAL.test(str.trim())) {
      return decimalStringToMinor(str.trim());
    }
  }

  if (typeof value === 'string' && PLAIN_DECIMAL.test(value.trim())) {
    return decimalStringToMinor(value.trim());
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const str = String(value);
    if (PLAIN_DECIMAL.test(str)) {
      return decimalStringToMinor(str);
    }
  }
  const scaled = asNumber(value) * MINOR_UNITS_PER_UNIT;
  // Round-half-up on the magnitude, then restore sign — avoids
  // Math.round's "round half towards +Infinity" asymmetry.
  const sign = scaled < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(scaled));
}

/** Minor units -> major-unit number with exactly 2 decimals. */
export function fromMinor(minor: number): number {
  return Math.round(minor) / MINOR_UNITS_PER_UNIT;
}

/**
 * Quantize an external value to a clean 2-decimal major-unit number.
 * Use for storing user-provided money in Decimal columns: guarantees the
 * stored value equals the value the engine used.
 */
export function toMajor2(value: DecimalLike): number {
  return fromMinor(toMinor(value));
}
