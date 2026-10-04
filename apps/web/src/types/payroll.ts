/**
 * Payroll domain models and period summaries.
 */

import type { Teacher } from './academics';
import type { Employee } from './hr';

export type PayrollStatus =
  | 'DRAFT'
  | 'CALCULATED'
  | 'REVIEWED'
  | 'APPROVED'
  | 'PAID'
  | 'CANCELLED';

export interface PayrollRun {
  id: string;
  organizationId: string;
  teacherId?: string | null;
  employeeId?: string | null;
  period: string;
  year: number;
  month: number;
  periodYear: number;
  periodMonth: number;
  salaryType?: string;
  status: PayrollStatus;
  /** Decimal string from Prisma */
  baseSalary: string;
  adjustments: string;
  deductions: string;
  tax: string;
  grossAmount?: string;
  netPay: string;
  netAmount?: string;
  processedAt?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  teacher?: Teacher;
  employee?: Employee;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollPeriodSummary {
  year: number;
  month: number;
  totalTeachers: number;
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalTax: number;
  totalNet: number;
  paid?: number;
  unpaid?: number;
  teachersCount?: number;
  status: PayrollStatus;
}
