import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinancialBrainService } from '../financial-brain.service';
import type { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  return {
    payment: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    refund: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    expense: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    payrollRun: { aggregate: vi.fn().mockResolvedValue({ _sum: { netAmount: 0 } }) },
    invoice: { aggregate: vi.fn().mockResolvedValue({ _sum: { total: 0, paidAmount: 0 } }) },
    group: { findUnique: vi.fn(), findFirst: vi.fn() },
    lesson: { count: vi.fn().mockResolvedValue(0) },
    studentGroup: {
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}

function sumPayment(amount: number) {
  return { _sum: { amount } };
}

describe('FinancialBrainService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: FinancialBrainService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new FinancialBrainService(prisma as unknown as PrismaService);
  });

  describe('getCashFlow (single source of financial truth)', () => {
    it('calculates net cash inflow properly (PAID payments minus PROCESSED refunds)', async () => {
      prisma.payment.aggregate.mockResolvedValue(sumPayment(1500));
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 300 } });
      prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 200 } });
      prisma.payrollRun.aggregate.mockResolvedValue({ _sum: { netAmount: 100 } });

      const result = await svc.getCashFlow('org-1', new Date('2026-01-01'), new Date('2026-01-31'));

      expect(result.inflows.cashCollected).toBe(1500);
      expect(result.inflows.refundsTotal).toBe(300);
      expect(result.inflows.netCashInflow).toBe(1200);
      expect(result.outflows.expensesTotal).toBe(200);
      expect(result.outflows.payrollTotal).toBe(100);
      expect(result.outflows.totalOutflow).toBe(300);
      expect(result.netCashFlow).toBe(900);
    });

    it('only counts PAID payments (pending payments excluded)', async () => {
      await svc.getCashFlow('org-1', new Date('2026-01-01'), new Date('2026-01-31'));

      expect(prisma.payment.aggregate).toHaveBeenCalledTimes(1);
      const where = prisma.payment.aggregate.mock.calls[0][0].where;
      expect(where.status).toBe('PAID');
    });

    it('filters payments on paidAt, not createdAt (cash basis)', async () => {
      await svc.getCashFlow('org In-basis', new Date('2026-01-01'), new Date('2026-01-31')).catch(() => {});
      const where = prisma.payment.aggregate.mock.calls[0][0].where;
      expect(where.paidAt).toEqual({ gte: expect.any(Date), lte: expect.any(Date) });
      expect(where.createdAt).toBeUndefined();
    });

    it('only counts PROCESSED refunds', async () => {
      await svc.getCashFlow('org-1', new Date('2026-01-01'), new Date('2026-01-31'));
      const where = prisma.refund.aggregate.mock.calls[0][0].where;
      expect(where.status).toBe('PROCESSED');
    });

    it('returns zeroed flow when there is no data', async () => {
      const result = await svc.getCashFlow('org-empty', new Date('2026-01-01'), new Date('2026-01-31'));
      expect(result.inflows.cashCollected).toBe(0);
      expect(result.inflows.netCashInflow).toBe(0);
      expect(result.netCashFlow).toBe(0);
    });
  });

  describe('paidAt period boundary (cash basis, mandatory)', () => {
    it('assigns a payment created Jan 31 but paid Feb 1 to February, not January', async () => {
      const januaryStart = new Date(Date.UTC(2026, 0, 1));
      const januaryEnd = new Date(Date.UTC(2026, 0, 31, 23, 59, 59, 999));
      const februaryStart = new Date(Date.UTC(2026, 1, 1));
      const februaryEnd = new Date(Date.UTC(2026, 1, 28, 23, 59, 59, 999));
      // const createdAt = new Date(Date.UTC(2026, 0, 31, 23, 0, 0)); // Jan 31 23:00
      const paidAt = new Date(Date.UTC(2026, 1, 1, 9, 0, 0)); // Feb 1 09:00

      // Emulate the database: payment rows are only visible when the queried
      // paidAt window overlaps the payment's actual paidAt.
      prisma.payment.aggregate.mockImplementation(async ({ where }: { where: { paidAt: { gte: Date; lte: Date } } }) => {
        const inWindow = paidAt >= where.paidAt.gte && paidAt <= where.paidAt.lte;
        return { _sum: { amount: inWindow ? 400 : 0 } };
      });

      const january = await svc.getCashFlow('org-1', januaryStart, januaryEnd);
      const february = await svc.getCashFlow('org-1', februaryStart, februaryEnd);

      expect(january.inflows.cashCollected).toBe(0); // createdAt is Jan 31, paidAt is Feb 1
      expect(february.inflows.cashCollected).toBe(400);
    });
  });

  describe('getDebtAndReceivables (DB-side aggregation, bounded memory)', () => {
    it('uses a single database-side aggregation without loading invoice/payment history', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { bucket: 'current', totalBilled: '800', totalPaid: '300' },
      ]);

      const result = await svc.getDebtAndReceivables('org-1');

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.invoice.aggregate).not.toHaveBeenCalled();
      expect(result.totalReceivables).toBe(500); // 800 billed - 300 paid
      expect(result.overdueDebt).toBe(0);
    });

    it('computes overdue debt from the overdue bucket only', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { bucket: 'overdue', totalBilled: '1000', totalPaid: '250' },
        { bucket: 'current', totalBilled: '400', totalPaid: '0' },
      ]);

      const result = await svc.getDebtAndReceivables('org-1');
      expect(result.totalReceivables).toBe(1150); // (1000-250) + (400-0)
      expect(result.overdueDebt).toBe(750);
    });

    it('returns zero for an organization with no outstanding invoices', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const result = await svc.getDebtAndReceivables('org-1');
      expect(result.totalReceivables).toBe(0);
      expect(result.overdueDebt).toBe(0);
    });

    it('never reports negative receivables for a fully paid or overpaid invoice', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { bucket: 'current', totalBilled: '100', totalPaid: '150' },
      ]);
      const result = await svc.getDebtAndReceivables('org-1');
      expect(result.totalReceivables).toBe(0);
    });

    it('aggregates multiple partial payments on one invoice without N+1 loads', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { bucket: 'current', totalBilled: '300', totalPaid: '100' },
      ]);
      const result = await svc.getDebtAndReceivables('org-1');
      expect(result.totalReceivables).toBe(200);
    });

    it('excludes cancelled invoices via the status filter in the SQL', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await svc.getDebtAndReceivables('org-1');
      const sql = prisma.$queryRaw.mock.calls[0][0];
      const sqlText = sql instanceof Object ? (sql as { sql?: string }).sql ?? String(sql) : String(sql);
      expect(sqlText).toContain('ISSUED');
      expect(sqlText).toContain('PARTIALLY_PAID');
      expect(sqlText).toContain('OVERDUE');
      expect(sqlText).not.toContain('CANCELLED');
    });
  });

  describe('getGroupContribution (honest attribution)', () => {
    it('returns INSUFFICIENT_DATA instead of fabricating per-group attribution', async () => {
      prisma.group.findFirst.mockResolvedValue({ id: 'g-1', name: 'Group A' });

      const result = await svc.getGroupContribution(
        'org-1',
        'g-1',
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result).toHaveProperty('reason');
      expect(result.groupId).toBe('g-1');
      expect(result.groupName).toBe('Group A');
      // No fabricated numbers may be present
      expect(result).not.toHaveProperty('profit');
      expect(result).not.toHaveProperty('margin');
      expect(result).not.toHaveProperty('contribution');
      expect(result).not.toHaveProperty('contributionMargin');
      expect(result).not.toHaveProperty('attributableRevenue');
    });

    it('does not even query payments/payrolls for attribution', async () => {
      prisma.group.findFirst.mockResolvedValue({ id: 'g-1', name: 'Group A' });
      await svc.getGroupContribution('org-1', 'g-1', new Date('2026-01-01'), new Date('2026-01-31'));
      expect(prisma.payment.groupBy).not.toHaveBeenCalled();
      expect(prisma.payrollRun.aggregate).not.toHaveBeenCalled();
    });

    it('throws NotFound for a group outside the organization (tenant isolation)', async () => {
      prisma.group.findFirst.mockResolvedValue(null);
      await expect(
        svc.getGroupContribution('org-1', 'g-other', new Date('2026-01-01'), new Date('2026-01-31')),
      ).rejects.toThrow('Group not found');
    });
  });

  describe('getBreakEvenAnalysis (honest fixed/variable classification)', () => {
    it('returns INSUFFICIENT_DATA because Expense has no fixed/variable classification', async () => {
      const result = await svc.getBreakEvenAnalysis(
        'org-1',
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );

      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result).toHaveProperty('reason');
      expect(result).not.toHaveProperty('breakEvenRevenue');
    });
  });

  describe('getForecast (deterministic, no LLM numbers)', () => {
    it('returns INSUFFICIENT_DATA if no enrollments and no historical data', async () => {
      const result = await svc.getForecast('org-empty', 30);
      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result).toHaveProperty('reason');
    });

    it('forecasts 7/30/90 days deterministically from enrollments and 90-day averages', async () => {
      prisma.studentGroup.findMany.mockResolvedValue([
        { group: { course: { price: 3000 } } },
        { group: { course: { price: 6000 } } },
      ]); // 9000/month → 300/day
      prisma.payrollRun.aggregate.mockResolvedValue({ _sum: { netAmount: 9000 } }); // 100/day
      prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 4500 } }); // 50/day

      const f7 = await svc.getForecast('org-1', 7);
      const f30 = await svc.getForecast('org-1', 30);
      const f90 = await svc.getForecast('org-1', 90);

      expect(f7.status).toBe('CALCULATED');
      expect(f7.forecastDays).toBe(7);
      expect(f7.projectedRevenue).toBeCloseTo(2100, 5); // 300 * 7
      expect(f7.projectedPayroll).toBeCloseTo(700, 5); // 100 * 7
      expect(f7.projectedExpenses).toBeCloseTo(350, 5); // 50 * 7
      expect(f7.projectedNetCashFlow).toBeCloseTo(2100 - 700 - 350, 5);

      expect(f30.projectedRevenue).toBeCloseTo(9000, 5);
      expect(f90.projectedRevenue).toBeCloseTo(27000, 5);

      // Deterministic: same inputs → same outputs
      const f30again = await svc.getForecast('org-1', 30);
      expect(f30again).toEqual(f30);
    });

    it('rejects non-positive horizons', async () => {
      await expect(svc.getForecast('org-1', 0)).rejects.toThrow();
      await expect(svc.getForecast('org-1', -5)).rejects.toThrow();
    });

    it('projected net cash flow is internally consistent', async () => {
      prisma.studentGroup.findMany.mockResolvedValue([{ group: { course: { price: 3000 } } }]);
      prisma.payrollRun.aggregate.mockResolvedValue({ _sum: { netAmount: 9000 } });
      prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 4500 } });

      const f = await svc.getForecast('org-1', 30);
      expect(f.projectedNetCashFlow).toBeCloseTo(
        f.projectedRevenue - f.projectedPayroll - f.projectedExpenses,
        5,
      );
    });
  });

  describe('simulateWhatIf (pure function, DB immutable)', () => {
    it('scales revenue and payroll and never touches the database', async () => {
      const base = {
        inflows: { netCashInflow: 10000 },
        outflows: { expensesTotal: 2000, payrollTotal: 3000 },
      };

      const result = svc.simulateWhatIf(base, {
        priceIncreasePercent: 10,
        studentVolumePercent: 20,
        payrollIncreasePercent: 5,
      });

      // 10000 * 1.2 * 1.1 = 13200; 3000 * 1.2 * 1.05 = 3780
      expect(result.projectedRevenue).toBeCloseTo(13200, 5);
      expect(result.projectedPayroll).toBeCloseTo(3780, 5);
      expect(result.projectedNetCashFlow).toBeCloseTo(13200 - 2000 - 3780, 5);
      expect(result.status).toBe('SIMULATED');
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.payment.aggregate).not.toHaveBeenCalled();
    });

    it('with no parameters returns the baseline (identity check)', () => {
      const base = {
        inflows: { netCashInflow: 5000 },
        outflows: { expensesTotal: 1000, payrollTotal: 1000 },
      };
      const result = svc.simulateWhatIf(base, {});
      expect(result.projectedRevenue).toBe(5000);
      expect(result.projectedNetCashFlow).toBe(5000 - 1000 - 1000);
      expect(result.difference).toBe(0);
    });
  });

  describe('reconcilePeriod', () => {
    it('compares invoiced vs paid vs refunded vs expensed vs payroll for a month', async () => {
      prisma.invoice.aggregate.mockResolvedValue({ _sum: { total: 10000 } });
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 7000 } });
      prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 500 } });
      prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 1500 } });
      prisma.payrollRun.aggregate.mockResolvedValue({ _sum: { netAmount: 2000 } });

      const result = await svc.reconcilePeriod('org-1', 2026, 1);

      expect(result.period).toEqual({ year: 2026, month: 1 });
      expect(result.receivables.totalInvoiced).toBe(10000);
      expect(result.receivables.totalPaid).toBe(7000);
      expect(result.receivables.difference).toBe(3000);
      expect(result.cashFlow.inflows).toBe(7000);
      expect(result.cashFlow.outflows).toBe(4000); // 500 + 1500 + 2000
      expect(result.cashFlow.netCashFlow).toBe(3000);
    });
  });
});
