/**
 * Payroll domain models, period summaries, and Smart KPI scorecards.
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

export interface TeacherSmartKpiScorecard {
  teacherId: string;
  teacherName: string;
  email?: string;
  salaryType: string;
  periodYear: number;
  periodMonth: number;
  groupCount: number;
  groups: Array<{
    id: string;
    name: string;
    courseName: string;
    studentsCount: number;
  }>;
  pillars: {
    attendance: {
      rate: number;
      threshold: number;
      stats: { total: number; present: number; late: number; absent: number };
      bonusPct: number;
      bonusEarned: number;
    };
    retention: {
      rate: number;
      threshold: number;
      activeStudents: number;
      totalStudents: number;
      bonusPct: number;
      bonusEarned: number;
    };
    academic: {
      averageScore: number;
      threshold: number;
      gradeCount: number;
      bonusPct: number;
      bonusEarned: number;
    };
    discipline: {
      conductedLessons: number;
      hoursWorked: number;
    };
  };
  compositeScore: number;
  tier: 'EXEMPLARY' | 'PROFICIENT' | 'DEVELOPING' | 'NEEDS_IMPROVEMENT';
  tierLabel: string;
  badgeColor: string;
  estimatedBase: number;
  totalRecommendedBonus: number;
  estimatedGross: number;
  formattedBonus: string;
  formattedGross: string;
}
