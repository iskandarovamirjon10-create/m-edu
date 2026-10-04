/**
 * Financial domain models: payments, expenses, revenue analytics, cash flow.
 * Note: Individual ledger currency amounts from Prisma Decimal are serialized as strings.
 * Aggregated summary metrics are numbers.
 */

import type { Student } from './students';

export type PaymentStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED';

export type PaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'PAYME'
  | 'CLICK'
  | 'UZUM'
  | 'OTHER';

export type ExpenseCategory =
  | 'SALARY'
  | 'RENT'
  | 'UTILITIES'
  | 'MARKETING'
  | 'SUPPLIES'
  | 'MAINTENANCE'
  | 'SOFTWARE'
  | 'TRAINING'
  | 'OTHER';

export interface Payment {
  id: string;
  organizationId: string;
  studentId: string;
  /** Decimal string from Prisma */
  amount: string;
  status: PaymentStatus;
  description?: string | null;
  dueDate?: string | null;
  method?: string | null;
  reference?: string | null;
  createdAt: string;
  student?: Student;
}

export interface Expense {
  id: string;
  organizationId: string;
  category: ExpenseCategory;
  /** Decimal string from Prisma */
  amount: string;
  description?: string | null;
  date: string;
  receipt?: string | null;
}

export interface MonthlyRevenue {
  month: string;
  total: number;
  count?: number;
}

/**
 * Shape returned by GET /analytics/financial/anomalies
 */
export interface FinancialAnomaly {
  type: string;
  description: string;
  severity: string;
  metric: string;
}

/**
 * Shape returned by GET /analytics/financial/cash-flow
 */
export interface CashFlowData {
  period?: { startDate: string; endDate: string };
  inflows: {
    cashCollected: number;
    refundsTotal: number;
    netCashInflow: number;
  };
  outflows: {
    expensesTotal: number;
    payrollTotal: number;
    totalOutflow: number;
  };
  netCashFlow: number;
}

/**
 * Shape returned by GET /analytics/financial/reconciliation
 */
export interface ReconciliationData {
  receivables?: { totalInvoiced: number; totalPaid: number; difference: number };
  cashFlow?: { netCashFlow: number; outflows: number };
  expenses?: { total: number; general: number; payroll: number };
}
