/**
 * Payroll calculation engine — pure, deterministic, decimal-safe.
 *
 * Contract:
 *   - Same inputs => identical output. No Date, no random, no I/O.
 *   - All money math is integer-based in MINOR units (tiyin for UZS:
 *     1 UZS = 100 tiyin). Inputs arrive as Prisma Decimal/string/number;
 *     they are converted once, quantized to minor units, and every
 *     intermediate value is an integer. Floats are used only at the
 *     single external-input quantization boundary (toMinor) — including
 *     its known binary-representation caveat — never inside the formulas.
 *   - Percentages are expressed in basis points (1% = 100 bp) so tax
 *     rates like 12% never introduce binary fractions.
 *   - Round-half-up at each quantization, matching accounting norms.
 *
 * Invariants (enforced by tests):
 *   - Every numeric input must be finite; NaN/Infinity are rejected with
 *     PayrollValidationError (a NaN input must never produce NaN money).
 *   - gross − deductions − tax − employeeContribution === net (the applied
 *     deduction lines always reconcile with the totals).
 *   - Applied deductions never exceed gross: excess requests are capped
 *     (priority: absence → late penalties → other deductions → employee
 *     contribution) so a single oversized deduction cannot silently
 *     swallow pay without being visible in the breakdown.
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
  /**
   * Employee social/pension contribution withheld from the payout, in
   * basis points (1% = 100 bp). Default 0 — jurisdictions differ, so the
   * caller (organization payroll settings) must opt in explicitly.
   * Applied after income tax; included in totals.deductionsMinor.
   */
  employeeContributionBasisPoints?: number;
  /**
   * Employer social contribution in basis points (1% = 100 bp).
   * Default 0. Employer cost — reported in totals only, never deducted
   * from the employee's net payout.
   */
  employerContributionBasisPoints?: number;
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
    employeeContributionMinor: number;
    employerContributionMinor: number;
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

export const PAYROLL_ENGINE_VERSION = '1.1.0';

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
  const lateCount = Math.max(0, Math.trunc(asNumber(inputs.lateCount ?? 0)));
  const absenceDays = Math.max(0, Math.trunc(asNumber(inputs.absenceDays ?? 0)));
  const overtimeHours = Math.max(0, asNumber(inputs.overtimeHours ?? 0));
  const overtimeMultiplier =
    inputs.overtimeMultiplier ?? DEFAULT_OVERTIME_MULTIPLIER;
  const workdays = inputs.workdaysInMonth ?? 21;
  const taxBp = inputs.taxBasisPoints ?? DEFAULT_TAX_BASIS_POINTS;
  const employeeContributionBp = inputs.employeeContributionBasisPoints ?? 0;
  const employerContributionBp = inputs.employerContributionBasisPoints ?? 0;

  const lines: PayrollLine[] = [];

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

  const earningsMinor = baseMinor + overtimeMinor;
  const grossMinor = earningsMinor + bonusMinor;

  // --- Bonus ----------------------------------------------------------------
  if (bonusMinor > 0) {
    lines.push({ key: 'BONUS', label: 'Bonus', amountMinor: bonusMinor });
  }

  // --- Pre-tax deductions (each capped so their sum never exceeds gross) ----
  // Priority order when capping: absence → late penalties → other deductions.
  // Capping keeps the reconciliation invariant
  //   gross − deductions − tax − employeeContribution === net
  // instead of silently clamping net to 0 while reporting the full
  // (unpayable) deduction in the totals.
  let appliedDeductions = 0;
  const applyDeduction = (requestedMinor: number): number => {
    const applied = Math.max(0, Math.min(requestedMinor, grossMinor - appliedDeductions));
    appliedDeductions += applied;
    return applied;
  };

  // Unpaid absence: pro-rata daily rate, deducted from gross.
  let appliedAbsenceMinor = 0;
  if (inputs.salaryType === 'MONTHLY' && absenceDays > 0) {
    const dailyValue = Math.round(baseAmountMinor / workdays);
    const requestedMinor = dailyValue * absenceDays;
    appliedAbsenceMinor = applyDeduction(requestedMinor);
    if (appliedAbsenceMinor > 0) {
      lines.push({
        key: 'ABSENCE',
        label: 'Unpaid absence',
        amountMinor: -appliedAbsenceMinor,
        detail:
          appliedAbsenceMinor < requestedMinor
            ? `${absenceDays}d × (base / ${workdays} workdays), capped at remaining gross pay`
            : `${absenceDays}d × (base / ${workdays} workdays)`,
      });
    }
  }

  // Late penalties.
  let appliedLateMinor = 0;
  if (lateCount > 0 && latePerEventMinor > 0) {
    const requestedMinor = latePerEventMinor * lateCount;
    appliedLateMinor = applyDeduction(requestedMinor);
    if (appliedLateMinor > 0) {
      lines.push({
        key: 'LATE_PENALTY',
        label: 'Late penalties',
        amountMinor: -appliedLateMinor,
        detail:
          appliedLateMinor < requestedMinor
            ? `${lateCount} × ${fromMinor(latePerEventMinor)}, capped at remaining gross pay`
            : `${lateCount} × ${fromMinor(latePerEventMinor)}`,
      });
    }
  }

  // --- Other deductions -----------------------------------------------------
  let appliedOtherMinor = 0;
  if (otherDeductionMinor > 0) {
    appliedOtherMinor = applyDeduction(otherDeductionMinor);
    // Never emit a `-0` line (amountMinor of zero is noise, not a deduction).
    if (appliedOtherMinor > 0) {
      lines.push({
        key: 'OTHER_DEDUCTION',
        label: 'Other deductions',
        amountMinor: -appliedOtherMinor,
        ...(appliedOtherMinor < otherDeductionMinor
          ? { detail: `Requested ${fromMinor(otherDeductionMinor)}, capped at remaining gross pay` }
          : {}),
      });
    }
  }

  // --- Income tax ------------------------------------------------------------
  // Tax base may not go below zero: deductions cannot create a negative
  // taxable amount, and tax is never refunded through this engine.
  const taxableMinor = Math.max(0, grossMinor - appliedDeductions);
  const taxMinor = Math.round(taxableMinor * bpRatio(taxBp));
  if (taxMinor > 0) {
    lines.push({
      key: 'TAX',
      label: 'Income tax',
      amountMinor: -taxMinor,
      detail: `${taxBp / 100}% of ${fromMinor(taxableMinor)}`,
    });
  }

  // --- Employee contribution (after income tax, capped at remaining pay) ----
  const requestedContributionMinor = Math.round(grossMinor * bpRatio(employeeContributionBp));
  const employeeContributionMinor = Math.max(
    0,
    Math.min(requestedContributionMinor, taxableMinor - taxMinor),
  );
  if (employeeContributionMinor > 0) {
    appliedDeductions += employeeContributionMinor;
    lines.push({
      key: 'EMPLOYEE_CONTRIBUTION',
      label: 'Employee social contribution',
      amountMinor: -employeeContributionMinor,
      detail:
        employeeContributionMinor < requestedContributionMinor
          ? `${employeeContributionBp / 100}% of gross, capped at remaining payout`
          : `${employeeContributionBp / 100}% of ${fromMinor(grossMinor)}`,
    });
  }

  // --- Employer contribution (employer cost, reported but never withheld) ---
  const employerContributionMinor = Math.round(grossMinor * bpRatio(employerContributionBp));

  const netMinor = Math.max(0, taxableMinor - taxMinor - employeeContributionMinor);
  lines.push({ key: 'NET', label: 'Net payout', amountMinor: netMinor });

  return {
    breakdown: {
      lines,
      totals: {
        baseMinor,
        earningsMinor,
        overtimeMinor,
        bonusMinor,
        absenceMinor: appliedAbsenceMinor,
        lateMinor: appliedLateMinor,
        otherDeductionMinor: appliedOtherMinor,
        employeeContributionMinor,
        employerContributionMinor,
        deductionsMinor: appliedDeductions,
        taxMinor,
        grossMinor,
        netMinor,
      },
    },
    grossAmount: fromMinor(grossMinor),
    netAmount: fromMinor(netMinor),
    taxAmount: fromMinor(taxMinor),
    absenceDays: inputs.salaryType === 'MONTHLY' ? absenceDays : 0,
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
    throw new PayrollValidationError('baseAmount must be a non-negative finite number');
  }
  // Every numeric input must be finite: `NaN < 0` is false, so a plain
  // negativity check silently accepts NaN and produces NaN money.
  const requireFiniteNonNegative = (v: DecimalLike | number | undefined, name: string) => {
    if (v === null || v === undefined) return;
    const n = typeof v === 'number' ? v : asNumber(v);
    if (!Number.isFinite(n)) {
      throw new PayrollValidationError(`${name} must be a finite number (received: ${String(v)})`);
    }
    if (n < 0) {
      throw new PayrollValidationError(`${name} must be non-negative`);
    }
  };
  requireFiniteNonNegative(inputs.bonus, 'bonus');
  requireFiniteNonNegative(inputs.otherDeduction, 'otherDeduction');
  requireFiniteNonNegative(inputs.latePenaltyPerEvent, 'latePenaltyPerEvent');
  requireFiniteNonNegative(inputs.hoursWorked, 'hoursWorked');
  requireFiniteNonNegative(inputs.overtimeHours, 'overtimeHours');
  requireFiniteNonNegative(inputs.overtimeMultiplier, 'overtimeMultiplier');
  requireFiniteNonNegative(inputs.absenceDays, 'absenceDays');
  requireFiniteNonNegative(inputs.lateCount, 'lateCount');
  requireFiniteNonNegative(inputs.lessonsCount, 'lessonsCount');
  const bp = inputs.taxBasisPoints ?? DEFAULT_TAX_BASIS_POINTS;
  if (!Number.isInteger(bp) || bp < 0 || bp > 10_000) {
    throw new PayrollValidationError('taxBasisPoints must be an integer in [0, 10000]');
  }
  const empBp = inputs.employeeContributionBasisPoints ?? 0;
  if (!Number.isInteger(empBp) || empBp < 0 || empBp > 10_000) {
    throw new PayrollValidationError('employeeContributionBasisPoints must be an integer in [0, 10000]');
  }
  const erBp = inputs.employerContributionBasisPoints ?? 0;
  if (!Number.isInteger(erBp) || erBp < 0 || erBp > 10_000) {
    throw new PayrollValidationError('employerContributionBasisPoints must be an integer in [0, 10000]');
  }
  const workdays = inputs.workdaysInMonth ?? 21;
  if (!Number.isInteger(workdays) || workdays <= 0 || workdays > 31) {
    throw new PayrollValidationError('workdaysInMonth must be an integer in [1, 31]');
  }
}
