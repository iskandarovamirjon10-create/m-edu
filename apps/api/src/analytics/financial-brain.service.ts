import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeInvoiceOutstanding } from '../payments/invoice-outstanding';

@Injectable()
export class FinancialBrainService {
  constructor(private readonly prisma: PrismaService) {}

  async getCashFlow(organizationId: string, startDate: Date, endDate: Date) {
    const [inflows, refunds, expenses, payroll] = await Promise.all([
      this.prisma.payment.aggregate({ where: { organizationId, status: 'PAID', paidAt: { gte: startDate, lte: endDate } }, _sum: { amount: true } }),
      this.prisma.refund.aggregate({ where: { organizationId, status: 'PROCESSED', processedAt: { gte: startDate, lte: endDate } }, _sum: { amount: true } }),
      this.prisma.expense.aggregate({ where: { organizationId, date: { gte: startDate, lte: endDate } }, _sum: { amount: true } }),
      this.prisma.payrollRun.aggregate({ where: { organizationId, status: 'PAID', calculatedAt: { gte: startDate, lte: endDate } }, _sum: { netAmount: true } }),
    ]);
    const cashCollected = Number(inflows._sum.amount || 0);
    const refundsTotal = Number(refunds._sum.amount || 0);
    const expensesTotal = Number(expenses._sum.amount || 0);
    const payrollTotal = Number(payroll._sum.netAmount || 0);
    return {
      period: { startDate, endDate },
      inflows: { cashCollected, refundsTotal, netCashInflow: cashCollected - refundsTotal },
      outflows: { expensesTotal, payrollTotal, totalOutflow: expensesTotal + payrollTotal },
      netCashFlow: (cashCollected - refundsTotal) - (expensesTotal + payrollTotal),
    };
  }

  async getMonthlyRevenueSeries(organizationId: string) {
    const rows = await this.prisma.$queryRaw<any[]>`
      WITH latest AS (
        SELECT DATE_TRUNC('month', "paidAt") AS bucket, COALESCE(SUM(amount), 0) AS total, COUNT(*)::int AS count
        FROM "Payment"
        WHERE "organizationId" = ${organizationId}::uuid AND status = 'PAID'
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 12
      )
      SELECT * FROM latest ORDER BY bucket ASC
    `;
    return rows.map((r) => ({
      bucket: r.bucket,
      total: Number(r.total),
      count: Number(r.count),
    }));
  }

  async getDebtAndReceivables(organizationId: string) {
    const now = new Date();
    const openInvoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: { notIn: ['DRAFT', 'CANCELLED'] },
      },
      select: { status: true, total: true, paidAmount: true, refundedAmount: true, dueDate: true },
    });
    const { outstanding, overdue } = computeInvoiceOutstanding(openInvoices, now);
    return {
      totalReceivables: outstanding,
      overdueDebt: overdue,
    };
  }

  async getBreakEvenAnalysis(organizationId: string, startDate?: Date, endDate?: Date) {
    // Expense rows have no fixed/variable split, so any break-even number
    // would be fabricated. Fail honest instead of guessing.
    return {
      status: 'INSUFFICIENT_DATA',
      reason: 'Expense has no fixed/variable classification; break-even cannot be computed honestly.',
    };
  }

  async reconcilePeriod(organizationId: string, year: number, month: number) {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const periodFilter = { gte: startDate, lte: endDate };

    const [invoiced, paid, refunded, expensed, payroll] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { organizationId, createdAt: periodFilter },
        _sum: { total: true },
      }),
      this.prisma.payment.aggregate({
        where: { organizationId, status: 'PAID', paidAt: periodFilter },
        _sum: { amount: true },
      }),
      this.prisma.refund.aggregate({
        where: { organizationId, status: 'PROCESSED', processedAt: periodFilter },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: { organizationId, date: periodFilter },
        _sum: { amount: true },
      }),
      this.prisma.payrollRun.aggregate({
        where: { organizationId, status: 'PAID', calculatedAt: periodFilter },
        _sum: { netAmount: true },
      }),
    ]);

    const totalInvoiced = Number(invoiced._sum.total || 0);
    const totalPaid = Number(paid._sum.amount || 0);
    const totalRefunded = Number(refunded._sum.amount || 0);
    const totalExpensed = Number(expensed._sum.amount || 0);
    const totalPayroll = Number(payroll._sum.netAmount || 0);
    const outflows = totalRefunded + totalExpensed + totalPayroll;

    return {
      period: { year, month },
      receivables: {
        totalInvoiced,
        totalPaid,
        difference: totalInvoiced - totalPaid,
      },
      cashFlow: {
        inflows: totalPaid,
        outflows,
        netCashFlow: totalPaid - outflows,
      },
    };
  }

  async getRevenueTimeSeries(organizationId: string, period: string) {
    return []; // simplified
  }

  async getGroupContribution(organizationId: string, groupId: string, start: Date, end: Date) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, organizationId },
    });
    if (!group) {
      throw new Error('Group not found');
    }
    // Honest attribution would require allocating shared costs per group;
    // without that mapping we refuse to fabricate numbers.
    return {
      status: 'INSUFFICIENT_DATA',
      reason: 'Shared costs cannot be attributed to a single group without an allocation model.',
      groupId,
      groupName: (group as { name?: string }).name ?? null,
    };
  }

  async getForecast(organizationId: string, days: number) {
    if (!Number.isFinite(days) || days <= 0) {
      throw new Error('Forecast horizon must be a positive number of days');
    }

    const lookbackStart = new Date(Date.now() - 90 * 86_400_000);
    const [enrollments, payroll, expenses] = await Promise.all([
      this.prisma.studentGroup.findMany({
        where: { organizationId, isActive: true },
        select: { group: { select: { course: { select: { price: true } } } } },
      }),
      this.prisma.payrollRun.aggregate({
        where: { organizationId, status: 'PAID', calculatedAt: { gte: lookbackStart } },
        _sum: { netAmount: true },
      }),
      this.prisma.expense.aggregate({
        where: { organizationId, date: { gte: lookbackStart } },
        _sum: { amount: true },
      }),
    ]);

    const activeMonthlyRevenue = enrollments.reduce(
      (sum, e) => sum + Number(e.group?.course?.price || 0),
      0,
    );
    const payroll90 = Number(payroll._sum.netAmount || 0);
    const expenses90 = Number(expenses._sum.amount || 0);

    if (activeMonthlyRevenue === 0 && payroll90 === 0 && expenses90 === 0) {
      return {
        status: 'INSUFFICIENT_DATA',
        reason: 'No enrollments or 90-day financial history to project from.',
        forecastDays: days,
      };
    }

    const revenuePerDay = activeMonthlyRevenue / 30;
    const payrollPerDay = payroll90 / 90;
    const expensesPerDay = expenses90 / 90;

    const projectedRevenue = revenuePerDay * days;
    const projectedPayroll = payrollPerDay * days;
    const projectedExpenses = expensesPerDay * days;

    return {
      status: 'CALCULATED',
      forecastDays: days,
      projectedRevenue,
      projectedExpenses,
      projectedPayroll,
      projectedNetCashFlow: projectedRevenue - projectedPayroll - projectedExpenses,
    };
  }

  async detectAnomalies(organizationId: string, start?: Date, end?: Date) {
    return [];
  }

  simulateWhatIf(baseCashFlow: any, dto: any) {
    const baseRevenue = Number(baseCashFlow?.inflows?.netCashInflow || 0);
    const baseExpenses = Number(baseCashFlow?.outflows?.expensesTotal || 0);
    const basePayroll = Number(baseCashFlow?.outflows?.payrollTotal || 0);

    const priceFactor = 1 + (Number(dto?.priceIncreasePercent || 0) / 100);
    const volumeFactor = 1 + (Number(dto?.studentVolumePercent || 0) / 100);
    const payrollFactor = 1 + (Number(dto?.payrollIncreasePercent || 0) / 100);

    const projectedRevenue = baseRevenue * volumeFactor * priceFactor;
    const projectedPayroll = basePayroll * volumeFactor * payrollFactor;
    const projectedNetCashFlow = projectedRevenue - baseExpenses - projectedPayroll;
    const baseNetCashFlow = baseRevenue - baseExpenses - basePayroll;

    return {
      status: 'SIMULATED',
      projectedRevenue,
      baseRevenue,
      projectedPayroll,
      basePayroll,
      projectedNetCashFlow,
      baseNetCashFlow,
      difference: projectedNetCashFlow - baseNetCashFlow,
    };
  }
}
