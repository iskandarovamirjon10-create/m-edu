/**
 * Payroll calculation engine — pure, deterministic, decimal-safe.
 *
 * Contract:
 *   - Same inputs => identical output. No Date, no random, no I/O.
 *   - All money math is integer-based in MINOR units (tiyin for UZS:
 *     1 UZS = 100 tiyin). Inputs arrive as Prisma Decimal/string/number;
 *     they are converted once, quantized to minor units, and every
 *     intermediate value is an integer. No float ever touches money.
 *   - Percentages are expressed in basis points (1% = 100 bp) so tax
 *     rates like 12% never introduce binary fractions.
 *   - Round-half-up at each quantization, matching accounting norms.
 *
 * Determinism contract is enforced by unit tests (payroll-engine.spec.ts).
 */

import { toMinor, fromMinor, DecimalLike, asNumber } from './currency';

// ---------------------------------------------------------------------------
// Basis points
// ---------------------------------------------------------------------------

/** Basis points (1% = 100 bp) -> ratio applied to minor units. */
function bpRatio(basisPoints: number): number {
  return basisPoints / 10_000;
}

// ---------------------------------------------------------------------------
// Defaults (configurable per call — never hardcoded inside the formulas)
// ---------------------------------------------------------------------------

/** Default income tax: 12% expressed as 1200 basis points. */
export const DEFAULT_TAX_BASIS_POINTS = 1200;
/** Default overtime premium: 150% of the hourly rate. */
export const DEFAULT_OVERTIME_MULTIPLIER = 1.5;
/** Hours above this threshold count as overtime. */
export const STANDARD_MONTHLY_HOURS = 160;

// ---------------------------------------------------------------------------
// Input / output shapes
// ---------------------------------------------------------------------------

export interface PayrollInputs {
  salaryType: 'MONTHLY' | 'HOURLY' | 'PER_LESSON';
  /** Monthly base salary (MONTHLY), hourly rate (HOURLY) or per-lesson rate (PER_LESSON), in major units. */
  baseAmount: DecimalLike;
  /** Hours actually worked this period (HOURLY type). */
  hoursWorked?: DecimalLike;
  /** Lessons actually taught this period (PER_LESSON type). */
  lessonsCount?: number;
  /** Overtime hours (paid on top of base for MONTHLY, or extra for HOURLY). */
  overtimeHours?: DecimalLike;
  /** Overtime rate multiplier, e.g. 1.5. Default: DEFAULT_OVERTIME_MULTIPLIER. */
  overtimeMultiplier?: number;
  /** Positive amounts only — validated. */
  bonus?: DecimalLike;
  /** Unpaid absence days (deducted for MONTHLY as baseAmount/workdays). */
  absenceDays?: number;
  /** Working days in the month, for per-day absence valuation. Default 21. */
  workdaysInMonth?: number;
  lateCount?: number;
  /** Penalty per unexcused late arrival. */
  latePenaltyPerEvent?: DecimalLike;
  /** Explicit flat deduction (advances, fines). */
  otherDeduction?: DecimalLike;
  /** Income tax in basis points. Default: DEFAULT_TAX_BASIS_POINTS. */
  taxBasisPoints?: number;
}

export interface PayrollLine {
  key: string;
  label: string;
  /** Minor units — signed: positive adds to gross, negative subtracts. */
  amountMinor: number;
  detail?: string;
}

export interface PayrollBreakdown {
  lines: PayrollLine[];
  /** All values in minor units (integers). */
  totals: {
    baseMinor: number;
    earningsMinor: number;
    overtimeMinor: number;
    bonusMinor: number;
    absenceMinor: number;
    lateMinor: number;
    otherDeductionMinor: number;
    deductionsMinor: number;
    taxMinor: number;
    grossMinor: number;
    netMinor: number;
  };
}

export interface PayrollComputation {
  breakdown: PayrollBreakdown;
  /** Major-unit numbers with exactly 2 decimals, for storage/display. */
  grossAmount: number;
  netAmount: number;
  taxAmount: number;
  absenceDays: number;
  lateCount: number;
  engineVersion: string;
}

export const PAYROLL_ENGINE_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class PayrollValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayrollValidationError';
  }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Compute a teacher's payroll for one period.
 * Pure function: throws PayrollValidationError on invalid input, never
 * performs I/O, never reads the clock.
 */
export function computePayroll(inputs: PayrollInputs): PayrollComputation {
  validate(inputs);

  const bonusMinor = toMinor(inputs.bonus ?? 0);
  const otherDeductionMinor = toMinor(inputs.otherDeduction ?? 0);
  const latePerEventMinor = toMinor(inputs.latePenaltyPerEvent ?? 0);
  const lateCount = Math.max(0, Math.trunc(inputs.lateCount ?? 0));
  const absenceDays = Math.max(0, Math.trunc(inputs.absenceDays ?? 0));
  const overtimeHours = Math.max(0, asNumber(inputs.overtimeHours ?? 0));
  const overtimeMultiplier =
    inputs.overtimeMultiplier ?? DEFAULT_OVERTIME_MULTIPLIER;
  const workdays = inputs.workdaysInMonth ?? 21;
  const taxBp = inputs.taxBasisPoints ?? DEFAULT_TAX_BASIS_POINTS;

  const lines: PayrollLine[] = [];
  let earningsMinor = 0;
  let deductionsMinor = 0;

  // --- Base earnings (by salary type) --------------------------------------
  let baseMinor = 0;
  let overtimeMinor = 0;
  const baseAmountMinor = toMinor(inputs.baseAmount);

  if (inputs.salaryType === 'MONTHLY') {
    baseMinor = baseAmountMinor;
    lines.push({
      key: 'BASE_MONTHLY',
      label: 'Base salary (monthly)',
      amountMinor: baseMinor,
    });

    // Overtime: hourly value derived from monthly base over standard hours.
    if (overtimeHours > 0) {
      const monthlyHourlyValue = Math.round(baseAmountMinor / STANDARD_MONTHLY_HOURS);
      overtimeMinor = Math.round(
        monthlyHourlyValue * overtimeHours * overtimeMultiplier,
      );
      lines.push({
        key: 'OVERTIME',
        label: 'Overtime',
        amountMinor: overtimeMinor,
        detail: `${overtimeHours}h × ${overtimeMultiplier}× (monthly hourly value ${fromMinor(monthlyHourlyValue)})`,
      });
    }

    // Unpaid absence: pro-rata daily rate, deducted from gross.
    if (absenceDays > 0) {
      const dailyValue = Math.round(baseAmountMinor / workdays);
      const absenceMinor = dailyValue * absenceDays;
      deductionsMinor += absenceMinor;
      lines.push({
        key: 'ABSENCE',
        label: 'Unpaid absence',
        amountMinor: -absenceMinor,
        detail: `${absenceDays}d × (base / ${workdays} workdays)`,
      });
    }
  } else if (inputs.salaryType === 'HOURLY') {
    // baseAmount holds the hourly rate for HOURLY teachers.
    const hours = Math.max(0, asNumber(inputs.hoursWorked ?? 0));
    baseMinor = Math.round(baseAmountMinor * hours);
    lines.push({
      key: 'BASE_HOURLY',
      label: 'Hourly earnings',
      amountMinor: baseMinor,
      detail: `${hours}h × ${fromMinor(baseAmountMinor)}/h`,
    });

    if (overtimeHours > 0) {
      overtimeMinor = Math.round(
        baseAmountMinor * overtimeHours * overtimeMultiplier,
      );
      lines.push({
        key: 'OVERTIME',
        label: 'Overtime',
        amountMinor: overtimeMinor,
        detail: `${overtimeHours}h × ${overtimeMultiplier}×`,
      });
    }
  } else {
    // PER_LESSON — baseAmount holds the per-lesson rate.
    const lessons = Math.max(0, Math.trunc(inputs.lessonsCount ?? 0));
    baseMinor = baseAmountMinor * lessons;
    lines.push({
      key: 'BASE_LESSONS',
      label: 'Lesson earnings',
      amountMinor: baseMinor,
      detail: `${lessons} lessons × ${fromMinor(baseAmountMinor)}`,
    });
  }

  earningsMinor = baseMinor + overtimeMinor;

  // --- Bonus ----------------------------------------------------------------
  if (bonusMinor > 0) {
    lines.push({ key: 'BONUS', label: 'Bonus', amountMinor: bonusMinor });
  }

  // --- Late penalties -------------------------------------------------------
  if (lateCount > 0 && latePerEventMinor > 0) {
    const lateMinor = latePerEventMinor * lateCount;
    deductionsMinor += lateMinor;
    lines.push({
      key: 'LATE_PENALTY',
      label: 'Late penalties',
      amountMinor: -lateMinor,
      detail: `${lateCount} × ${fromMinor(latePerEventMinor)}`,
    });
  }

  // --- Other deductions -----------------------------------------------------
  if (otherDeductionMinor > 0) {
    deductionsMinor += otherDeductionMinor;
    lines.push({
      key: 'OTHER_DEDUCTION',
      label: 'Other deductions',
      amountMinor: -otherDeductionMinor,
    });
  }

  // --- Gross ----------------------------------------------------------------
  const grossMinor = earningsMinor + bonusMinor;

  // Tax base may not go below zero: deductions cannot create a negative
  // taxable amount, and tax is never refunded through this engine.
  const taxableMinor = Math.max(0, grossMinor - deductionsMinor);
  const taxMinor = Math.round(taxableMinor * bpRatio(taxBp));
  if (taxMinor > 0) {
    lines.push({
      key: 'TAX',
      label: 'Income tax',
      amountMinor: -taxMinor,
      detail: `${taxBp / 100}% of ${fromMinor(taxableMinor)}`,
    });
  }

  const netMinor = Math.max(0, taxableMinor - taxMinor);
  lines.push({ key: 'NET', label: 'Net payout', amountMinor: netMinor });

  return {
    breakdown: {
      lines,
      totals: {
        baseMinor,
        earningsMinor,
        overtimeMinor,
        bonusMinor,
        absenceMinor: absenceDays > 0 && inputs.salaryType === 'MONTHLY'
          ? Math.round(Math.round(baseAmountMinor / workdays) * absenceDays)
          : 0,
        lateMinor: latePerEventMinor * lateCount,
        otherDeductionMinor,
        deductionsMinor,
        taxMinor,
        grossMinor,
        netMinor,
      },
    },
    grossAmount: fromMinor(grossMinor),
    netAmount: fromMinor(netMinor),
    taxAmount: fromMinor(taxMinor),
    absenceDays,
    lateCount,
    engineVersion: PAYROLL_ENGINE_VERSION,
  };
}

function validate(inputs: PayrollInputs): void {
  const salaryTypes = ['MONTHLY', 'HOURLY', 'PER_LESSON'];
  if (!salaryTypes.includes(inputs.salaryType)) {
    throw new PayrollValidationError(`Unknown salaryType: ${inputs.salaryType}`);
  }
  const base = asNumber(inputs.baseAmount);
  if (!Number.isFinite(base) || base < 0) {
    throw new PayrollValidationError('baseAmount must be a non-negative number');
  }
  const rejectNegative = (v: DecimalLike, name: string) => {
    if (v !== null && v !== undefined && asNumber(v) < 0) {
      throw new PayrollValidationError(`${name} must be non-negative`);
    }
  };
  rejectNegative(inputs.bonus, 'bonus');
  rejectNegative(inputs.otherDeduction, 'otherDeduction');
  rejectNegative(inputs.latePenaltyPerEvent, 'latePenaltyPerEvent');
  rejectNegative(inputs.hoursWorked, 'hoursWorked');
  if (asNumber(inputs.overtimeHours ?? 0) < 0) {
    throw new PayrollValidationError('overtimeHours must be non-negative');
  }
  if (asNumber(inputs.overtimeMultiplier ?? DEFAULT_OVERTIME_MULTIPLIER) < 0) {
    throw new PayrollValidationError('overtimeMultiplier must be non-negative');
  }
  if ((inputs.absenceDays ?? 0) < 0) {
    throw new PayrollValidationError('absenceDays must be non-negative');
  }
  if ((inputs.lateCount ?? 0) < 0) {
    throw new PayrollValidationError('lateCount must be non-negative');
  }
  const bp = inputs.taxBasisPoints ?? DEFAULT_TAX_BASIS_POINTS;
  if (!Number.isInteger(bp) || bp < 0 || bp > 10_000) {
    throw new PayrollValidationError('taxBasisPoints must be an integer in [0, 10000]');
  }
  const workdays = inputs.workdaysInMonth ?? 21;
  if (!Number.isInteger(workdays) || workdays <= 0 || workdays > 31) {
    throw new PayrollValidationError('workdaysInMonth must be an integer in [1, 31]');
  }
}
