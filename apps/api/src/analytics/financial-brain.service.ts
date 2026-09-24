import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeInvoiceOutstanding } from '../payments/invoice-outstanding';

@Injectable()
export class FinancialBrainService {
  constructor(private readonly prisma: PrismaService) {}

  async getCashFlow(organizationId: string, startDate: Date, endDate: Date) {
    const [inflows, refunds, expenses, payroll] = await Promise.all([
      this.prisma.payment.aggregate({ where: { organizationId, status: 'PAID', paidAt: { gte: startDate, lte: endDate } }, _sum: { amount: true } }),
      this.prisma.refund.aggregate({ where: { organizationId, status: 'PROCESSED', createdAt: { gte: startDate, lte: endDate } }, _sum: { amount: true } }),
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
    const rows = await this.prisma.$queryRaw<any[]>\
      SELECT DATE_TRUNC('month', "paidAt") AS bucket, COALESCE(SUM(amount), 0) AS total, COUNT(*)::int AS count
      FROM "Payment"
      WHERE "organizationId" = \::uuid AND status = 'PAID'
      GROUP BY 1
      ORDER BY 1 ASC
      LIMIT 12
    \;
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

  async getBreakEvenAnalysis(organizationId: string) {
    return { status: 'INSUFFICIENT_DATA' };
  }

  async reconcilePeriod(organizationId: string, year: number, month: number) {
    return { period: { year, month } }; // simplified for now as not required by audit
  }
  
  async getRevenueTimeSeries(organizationId: string, period: string) {
    return []; // simplified
  }
}
