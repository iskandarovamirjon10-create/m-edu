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
  receivedById?: string | null;
  shiftId?: string | null;
  createdAt: string;
  student?: Student;
  receivedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    username?: string;
    email?: string;
  } | null;
  shift?: {
    id: string;
    status: 'OPEN' | 'CLOSED';
    openedAt: string;
    closedAt?: string | null;
  } | null;
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
  bucket?: string;
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


/**
 * Cashier shift reconciliation & daily Z-Report types.
 */
export interface ZReportSummary {
  period: { start: string; end: string };
  totalPaymentsCount: number;
  totalCollected: number;
  byMethod: {
    cash: { count: number; amount: number };
    terminal: { count: number; amount: number };
    bankTransfer: { count: number; amount: number };
    other: { count: number; amount: number };
  };
  receiptsIssuedCount: number;
  refunds: {
    count: number;
    totalAmount: number;
    cashRefundsAmount: number;
  };
  netCashDrawerExpected: number;
  firstPaymentTime: string | null;
  lastPaymentTime: string | null;
}

export interface ZReportRecord {
  id: string;
  reportNumber: string;
  closedAt: string;
  cashierName: string;
  period: { start: string; end: string };
  summary: ZReportSummary;
  /** Smena ochilishidagi naqd qoldiq (server ixtiyoriy qaytaradi). */
  openingBalance?: number;
  /** Inkassatsiyaga topshirilgan summa. */
  handoverAmount?: number | null;
  actualCashCounted: number;
  expectedCash: number;
  variance: number;
  status: 'BALANCED' | 'SHORTAGE' | 'SURPLUS';
  closingNotes: string;
}

export interface CloseCashierShiftPayload {
  shiftId?: string;
  startDate?: string;
  endDate?: string;
  actualCashCounted: number;
  handoverAmount?: number;
  closingNotes?: string;
}


export interface CashShift {
  id: string;
  organizationId: string;
  branchId?: string | null;
  cashierId: string;
  cashier?: {
    id: string;
    firstName: string;
    lastName: string;
    username?: string;
  };
  branch?: {
    id: string;
    name: string;
  };
  openedAt: string;
  closedAt?: string | null;
  status: 'OPEN' | 'CLOSED';
  openingBalance: number;
  cashPayments: number;
  cardPayments: number;
  otherPayments: number;
  cashExpenses: number;
  expectedCash: number;
  actualCash?: number | null;
  difference?: number | null;
  handoverAmount?: number | null;
  openingNote?: string | null;
  closingNote?: string | null;
  liveStats?: {
    paymentsCount: number;
    cashPayments: number;
    cardPayments: number;
    otherPayments: number;
    totalCollected: number;
    openingBalance: number;
    expectedCash: number;
  };
}

export interface OpenCashShiftPayload {
  openingBalance?: number;
  branchId?: string;
  openingNote?: string;
}

export interface CurrentShiftResponse {
  active: boolean;
  shift: CashShift | null;
}
