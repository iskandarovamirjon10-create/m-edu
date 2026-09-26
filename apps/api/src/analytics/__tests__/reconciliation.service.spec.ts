import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReconciliationService } from '../reconciliation.service';
import type { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  return {
    invoice: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { total: 0, paidAmount: 0 }, _count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    payment: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    refund: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: 0 }),
    },
    expense: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    payrollRun: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { netAmount: 0, lessonsCount: 0 }, _count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    student: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { balance: 0 }, _count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    financialPeriod: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}

describe('ReconciliationService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: ReconciliationService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new ReconciliationService(prisma as unknown as PrismaService);
  });

  describe('getReconciliationReport', () => {
    it('returns detailed comparison of invoiced vs paid vs refunded vs expenses vs payroll', async () => {
      prisma.invoice.aggregate.mockResolvedValue({ _sum: { total: 10000, paidAmount: 7000 }, _count: 5 });
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 7000 }, _count: 10 });
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 500 }, _count: 2 });
      prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 1500 }, _count: 8 });
      prisma.payrollRun.aggregate.mockResolvedValue({ _sum: { netAmount: 2000, lessonsCount: 40 }, _count: 3 });
      prisma.student.aggregate.mockResolvedValue({ _sum: { balance: 3000 }, _count: 20 });

      const result = await svc.getReconciliationReport('org-1', 2026, 1);

      expect(result.period).toEqual({ year: 2026, month: 1 });
      expect(result.summary.totalInvoiced).toBe(10000);
      expect(result.summary.totalPaid).toBe(7000);
      expect(result.summary.receivableDifference).toBe(3000);
      expect(result.summary.netCashFlow).toBe(3000);
      expect(result.receivables.invoiceCount).toBe(5);
      expect(result.refundAnalysis.totalRefunded).toBe(500);
      expect(result.payrollAnalysis.totalLessonsCount).toBe(40);
      expect(result.payrollAnalysis.costPerLesson).toBe(50);
      expect(result.studentBalances.totalOutstanding).toBe(3000);
    });

    it('returns zeroed report when no data exists', async () => {
      const result = await svc.getReconciliationReport('org-empty', 2026, 1);
      expect(result.summary.totalInvoiced).toBe(0);
      expect(result.summary.totalPaid).toBe(0);
      expect(result.summary.netCashFlow).toBe(0);
      expect(result.dataQuality.isFullyReconciled).toBe(true);
    });

    it('computes payrollRevenueRatio correctly', async () => {
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 10000 }, _count: 1 });
      prisma.payrollRun.aggregate.mockResolvedValue({ _sum: { netAmount: 3000, lessonsCount: 0 }, _count: 1 });

      const result = await svc.getReconciliationReport('org-1', 2026, 1);
      expect(result.summary.payrollRevenueRatio).toBeCloseTo(0.3, 5);
    });

    it('handles zero payments without division by zero', async () => {
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: 0 });
      prisma.payrollRun.aggregate.mockResolvedValue({ _sum: { netAmount: 500, lessonsCount: 0 }, _count: 1 });

      const result = await svc.getReconciliationReport('org-1', 2026, 1);
      expect(result.summary.payrollRevenueRatio).toBe(0);
    });

    it('costPerLesson is zero when no lessons', async () => {
      prisma.payrollRun.aggregate.mockResolvedValue({ _sum: { netAmount: 1000, lessonsCount: 0 }, _count: 1 });
      const result = await svc.getReconciliationReport('org-1', 2026, 1);
      expect(result.payrollAnalysis.costPerLesson).toBe(0);
    });
  });

  describe('detectDiscrepancies', () => {
    it('finds payments without matching invoices', async () => {
      prisma.payment.findMany.mockResolvedValue([
        { id: 'p-1', amount: 500, studentId: 's-1', paidAt: new Date('2026-01-15'), reference: 'ref-1' },
      ]);

      const result = await svc.detectDiscrepancies('org-1', 2026, 1);
      expect(result.totalDiscrepancies).toBeGreaterThanOrEqual(1);
      expect(result.discrepancies.some((d: { type: string }) => d.type === 'PAYMENT_WITHOUT_INVOICE')).toBe(true);
      expect(result.byType.paymentsWithoutInvoices).toBe(1);
    });

    it('finds overdue invoices past due date', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        { id: 'inv-1', number: 'INV-001', total: 1000, paidAmount: 0, dueDate: new Date('2026-01-05'), studentId: 's-1' },
      ]);

      const result = await svc.detectDiscrepancies('org-1', 2026, 1);
      expect(result.discrepancies.some((d: { type: string }) => d.type === 'OVERDUE_INVOICE')).toBe(true);
    });

    it('finds payroll entries with netAmount > 0 but lessonsCount = 0', async () => {
      prisma.payrollRun.findMany.mockResolvedValue([
        { id: 'pr-1', teacherId: 't-1', netAmount: 2000, lessonsCount: 0, salaryType: 'MONTHLY' },
      ]);

      const result = await svc.detectDiscrepancies('org-1', 2026, 1);
      expect(result.discrepancies.some((d: { type: string }) => d.type === 'PAYROLL_WITHOUT_LESSONS')).toBe(true);
      expect(result.byType.payrollWithoutLessons).toBe(1);
    });

    it('detects potential duplicate payments within 24h', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { studentId: 's-1', amount: 500, paidAt: new Date('2026-01-15T10:00:00Z'), cnt: 2 },
      ]);

      const result = await svc.detectDiscrepancies('org-1', 2026, 1);
      expect(result.discrepancies.some((d: { type: string }) => d.type === 'POTENTIAL_DUPLICATE_PAYMENT')).toBe(true);
      expect(result.byType.potentialDuplicates).toBe(1);
    });

    it('returns empty discrepancies when no issues found', async () => {
      const result = await svc.detectDiscrepancies('org-1', 2026, 1);
      expect(result.totalDiscrepancies).toBe(0);
      expect(result.discrepancies).toEqual([]);
    });
  });

  describe('getStudentBalanceReport', () => {
    it('returns per-student balance report with totals', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          studentId: 's-1',
          studentName: 'John Doe',
          balance: 500,
          totalInvoiced: 1000,
          totalPaid: 500,
          totalOutstanding: 500,
          oldestDebtDate: new Date('2026-01-15'),
          unpaidInvoiceCount: 1,
        },
      ]);

      const result = await svc.getStudentBalanceReport('org-1');
      expect(result.students).toHaveLength(1);
      expect(result.students[0].studentName).toBe('John Doe');
      expect(result.students[0].totalInvoiced).toBe(1000);
      expect(result.students[0].totalPaid).toBe(500);
      expect(result.students[0].outstandingAmount).toBe(500);
      expect(result.summary.studentsWithDebt).toBe(1);
      expect(result.summary.totalOutstanding).toBe(500);
    });

    it('returns empty report when no students', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const result = await svc.getStudentBalanceReport('org-empty');
      expect(result.students).toEqual([]);
      expect(result.summary.totalStudents).toBe(0);
    });

    it('handles student with no invoices or payments', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          studentId: 's-1',
          studentName: 'Jane Smith',
          balance: 0,
          totalInvoiced: 0,
          totalPaid: 0,
          totalOutstanding: 0,
          oldestDebtDate: null,
          unpaidInvoiceCount: 0,
        },
      ]);

      const result = await svc.getStudentBalanceReport('org-1');
      expect(result.students[0].outstandingAmount).toBe(0);
      expect(result.summary.studentsWithDebt).toBe(0);
    });
  });

  describe('getReconciliationHistory', () => {
    it('returns period history with status summary', async () => {
      prisma.financialPeriod.findMany.mockResolvedValue([
        { periodYear: 2026, month: 1, status: 'RECONCILED', closedAt: new Date(), createdAt: new Date() },
        { periodYear: 2025, month: 12, status: 'CLOSED', closedAt: new Date(), createdAt: new Date() },
        { periodYear: 2025, month: 11, status: 'OPEN', closedAt: null, createdAt: new Date() },
      ]);

      const result = await svc.getReconciliationHistory('org-1');
      expect(result.periods).toHaveLength(3);
      expect(result.summary.reconciledCount).toBe(1);
      expect(result.summary.closedCount).toBe(1);
      expect(result.summary.openCount).toBe(1);
    });

    it('returns empty history when no periods exist', async () => {
      const result = await svc.getReconciliationHistory('org-empty');
      expect(result.periods).toEqual([]);
      expect(result.summary.totalPeriods).toBe(0);
    });
  });
});
