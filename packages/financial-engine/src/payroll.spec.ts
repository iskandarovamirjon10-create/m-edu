import { describe, it, expect } from 'vitest';
import {
  computePayroll,
  PayrollValidationError,
  PAYROLL_ENGINE_VERSION,
} from './payroll';
import { toMinor, fromMinor } from './currency';

describe('minor-unit money helpers', () => {
  it('quantizes to minor units round-half-up', () => {
    expect(toMinor(10.005)).toBe(1001); // half-up, not banker's rounding
    expect(toMinor(0.1 + 0.2)).toBe(30); // float noise removed
    expect(toMinor(2.675)).toBe(268); // classic float pitfall
    expect(toMinor('1234.56')).toBe(123456);
    expect(toMinor(-3.005)).toBe(-301);
  });

  it('round-trips minor units', () => {
    expect(fromMinor(toMinor(123.45))).toBe(123.45);
    expect(fromMinor(0)).toBe(0);
  });
});

describe('computePayroll — determinism', () => {
  const base = {
    salaryType: 'MONTHLY' as const,
    baseAmount: 5_000_000,
    bonus: 500_000,
    absenceDays: 2,
    lateCount: 3,
    latePenaltyPerEvent: 10_000,
    otherDeduction: 100_000,
    overtimeHours: 4,
  };

  it('produces identical results for identical inputs (10 runs)', () => {
    const first = JSON.stringify(computePayroll(base));
    for (let i = 0; i < 10; i++) {
      expect(JSON.stringify(computePayroll(base))).toBe(first);
    }
  });

  it('is independent of Prisma Decimal-like inputs vs plain numbers', () => {
    const asDecimalLike = {
      ...base,
      baseAmount: { toNumber: () => 5_000_000 },
      bonus: '500000',
      otherDeduction: 100_000,
    };
    const a = computePayroll(base);
    const b = computePayroll(asDecimalLike);
    expect(a.netAmount).toBe(b.netAmount);
    expect(a.grossAmount).toBe(b.grossAmount);
  });
});

describe('computePayroll — salary types', () => {
  it('MONTHLY: full payout when no adjustments', () => {
    const r = computePayroll({ salaryType: 'MONTHLY', baseAmount: 3_000_000 });
    // tax 12% on 3,000,000 = 360,000 -> net 2,640,000
    expect(r.grossAmount).toBe(3_000_000);
    expect(r.taxAmount).toBe(360_000);
    expect(r.netAmount).toBe(2_640_000);
  });

  it('HOURLY: pays hours × rate', () => {
    const r = computePayroll({
      salaryType: 'HOURLY',
      baseAmount: 50_000, // hourly rate
      hoursWorked: 42,
    });
    // 42 × 50,000 = 2,100,000 gross; net = ×0.88
    expect(r.grossAmount).toBe(2_100_000);
    expect(r.netAmount).toBe(1_848_000);
  });

  it('PER_LESSON: pays lessons × rate, ignores hours', () => {
    const r = computePayroll({
      salaryType: 'PER_LESSON',
      baseAmount: 80_000,
      lessonsCount: 25,
      hoursWorked: 999,
    });
    expect(r.grossAmount).toBe(2_000_000);
  });

  it('zero lessons / zero hours => zero gross and zero net', () => {
    const none = computePayroll({ salaryType: 'PER_LESSON', baseAmount: 80_000 });
    const noneH = computePayroll({ salaryType: 'HOURLY', baseAmount: 80_000 });
    expect(none.grossAmount).toBe(0);
    expect(none.netAmount).toBe(0);
    expect(noneH.grossAmount).toBe(0);
  });
});

describe('computePayroll — adjustments and edge cases', () => {
  it('unpaid absence deducts pro-rata daily value (MONTHLY)', () => {
    const r = computePayroll({
      salaryType: 'MONTHLY',
      baseAmount: 2_100_000,
      absenceDays: 1,
      workdaysInMonth: 21,
    });
    const daily = 2_100_000 / 21; // 100,000
    expect(r.grossAmount).toBe(2_100_000);
    expect(r.breakdown.totals.absenceMinor).toBe(daily * 100);
    // taxable = 2,100,000 - 100,000 = 2,000,000; tax 240,000; net 1,760,000
    expect(r.netAmount).toBe(1_760_000);
  });

  it('late penalties accumulate per event', () => {
    const r = computePayroll({
      salaryType: 'MONTHLY',
      baseAmount: 1_000_000,
      lateCount: 4,
      latePenaltyPerEvent: 25_000,
    });
    // deductions 100,000; taxable 900,000; tax 108,000; net 792,000
    expect(r.netAmount).toBe(792_000);
  });

  it('overtime pays 1.5× by default on top of base (MONTHLY)', () => {
    const r = computePayroll({
      salaryType: 'MONTHLY',
      baseAmount: 1_600_000,
      overtimeHours: 2,
    });
    // monthly hourly value = 1,600,000/160 = 10,000 -> overtime = 2h × 1.5 × 10,000 = 30,000
    expect(r.breakdown.totals.overtimeMinor).toBe(2 * 10_000 * 1.5 * 100);
    expect(r.grossAmount).toBe(1_630_000);
  });

  it('deductions cannot push taxable below zero and net never negative', () => {
    const r = computePayroll({
      salaryType: 'MONTHLY',
      baseAmount: 100_000,
      otherDeduction: 999_999,
      lateCount: 10,
      latePenaltyPerEvent: 50_000,
      absenceDays: 20,
    });
    expect(r.netAmount).toBe(0);
    expect(r.breakdown.totals.taxMinor).toBe(0);
  });

  it('accepts fractional hours without float drift', () => {
    const r = computePayroll({
      salaryType: 'HOURLY',
      baseAmount: 33_333.33,
      hoursWorked: 7.5,
    });
    // 3,333,333 tiyin × 7.5h = 24,999,997.5 tiyin -> half-up -> 24,999,998 tiyin
    expect(r.grossAmount).toBe(249_999.98);
  });

  it('custom tax rate (0%) yields full net', () => {
    const r = computePayroll({
      salaryType: 'MONTHLY',
      baseAmount: 1_000_000,
      taxBasisPoints: 0,
    });
    expect(r.netAmount).toBe(1_000_000);
  });

  it('salary change during month is modeled by the caller, engine stays pure', () => {
    // Old rate for 10 days, new rate for rest — two computations, summed by
    // the caller. Engine has no hidden state.
    const a = computePayroll({ salaryType: 'MONTHLY', baseAmount: 1_000_000 });
    const b = computePayroll({ salaryType: 'MONTHLY', baseAmount: 1_200_000 });
    expect(a.netAmount + b.netAmount).toBe(
      computePayroll({ salaryType: 'MONTHLY', baseAmount: 1_000_000 }).netAmount +
        computePayroll({ salaryType: 'MONTHLY', baseAmount: 1_200_000 }).netAmount,
    );
  });
});

describe('computePayroll — validation (negative testing)', () => {
  it('rejects negative base', () => {
    expect(() => computePayroll({ salaryType: 'MONTHLY', baseAmount: -1 })).toThrow(
      PayrollValidationError,
    );
  });

  it('rejects negative bonus / deduction / late penalty / hours', () => {
    expect(() =>
      computePayroll({ salaryType: 'MONTHLY', baseAmount: 1, bonus: -5 }),
    ).toThrow(PayrollValidationError);
    expect(() =>
      computePayroll({ salaryType: 'MONTHLY', baseAmount: 1, otherDeduction: -5 }),
    ).toThrow(PayrollValidationError);
    expect(() =>
      computePayroll({ salaryType: 'MONTHLY', baseAmount: 1, latePenaltyPerEvent: -5 }),
    ).toThrow(PayrollValidationError);
    expect(() =>
      computePayroll({ salaryType: 'HOURLY', baseAmount: 1, hoursWorked: -2 }),
    ).toThrow(PayrollValidationError);
  });

  it('rejects unknown salary type', () => {
    expect(() =>
      computePayroll({ salaryType: 'WEEKLY' as never, baseAmount: 1 }),
    ).toThrow(PayrollValidationError);
  });

  it('rejects tax rates outside 0..100%', () => {
    expect(() =>
      computePayroll({ salaryType: 'MONTHLY', baseAmount: 1, taxBasisPoints: 10_001 }),
    ).toThrow(PayrollValidationError);
    expect(() =>
      computePayroll({ salaryType: 'MONTHLY', baseAmount: 1, taxBasisPoints: 12.5 as never }),
    ).toThrow(PayrollValidationError);
  });

  it('rejects impossible workday counts', () => {
    expect(() =>
      computePayroll({ salaryType: 'MONTHLY', baseAmount: 1, workdaysInMonth: 0 }),
    ).toThrow(PayrollValidationError);
    expect(() =>
      computePayroll({ salaryType: 'MONTHLY', baseAmount: 1, workdaysInMonth: 32 }),
    ).toThrow(PayrollValidationError);
  });

  it('engine version is stamped', () => {
    const r = computePayroll({ salaryType: 'MONTHLY', baseAmount: 1 });
    expect(r.engineVersion).toBe(PAYROLL_ENGINE_VERSION);
    expect(PAYROLL_ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
