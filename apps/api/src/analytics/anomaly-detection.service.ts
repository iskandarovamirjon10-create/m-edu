import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type Redis from 'ioredis';

export interface Anomaly {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  metric: string;
  observed: number;
  baseline: number | null;
  period: string;
  recommendation: string;
  insufficientData?: boolean;
}

/** Cache TTL for the full anomaly sweep: 1 hour. */
const ANOMALY_CACHE_TTL_SECONDS = 60 * 60;

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);
  private redis: Redis | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async getRedis(): Promise<Redis | null> {
    if (this.redis !== null && this.redis !== undefined) return this.redis;
    try {
      const mod = await import('ioredis');
      const RedisCtor = mod.default;
      const host = process.env.REDIS_HOST || 'localhost';
      const port = Number(process.env.REDIS_PORT) || 6379;
      const client = new (RedisCtor as unknown as {
        new (opts: Record<string, unknown>): Redis;
      })({
        host,
        port,
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
      });
      client.on('error', () => {});
      this.redis = client;
    } catch {
      this.redis = null;
    }
    return this.redis;
  }

  async detectAll(organizationId: string): Promise<Anomaly[]> {
    const cacheKey = `anomalies:${organizationId}:v2`;

    // 1. Cache lookup (Redis, TTL 1h) — the sweep is expensive (8+ parallel
    // aggregations) and anomalies are computed on hour-old financial data,
    // so caching never misleads.
    try {
      const redis = await this.getRedis();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached) as Anomaly[];
        }
      }
    } catch {
      // Cache unavailable — fall through to a full computation.
    }

    // 2. Run every detector in parallel but ISOLATE failures with
    // allSettled: one broken detector (bad data, timeout, schema drift)
    // previously crashed the whole analysis. Now it logs and the remaining
    // detectors still report.
    const settled = await Promise.allSettled([
      this.detectRevenueDrop(organizationId),
      this.detectExpenseSpike(organizationId),
      this.detectRefundAnomaly(organizationId),
      this.detectDebtIncrease(organizationId),
      this.detectCashFlowDeterioration(organizationId),
      this.detectPayrollAnomaly(organizationId),
      this.detectUnusualPaymentTiming(organizationId),
      this.detectEnrollmentDrop(organizationId),
    ]);

    const detectorNames = [
      'REVENUE_DROP',
      'EXPENSE_SPIKE',
      'REFUND_ANOMALY',
      'DEBT_INCREASE',
      'CASH_FLOW_DETERIORATION',
      'PAYROLL_ANOMALY',
      'UNUSUAL_PAYMENT_TIMING',
      'ENROLLMENT_DROP',
    ] as const;

    const all: Anomaly[] = [];
    settled.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        all.push(...result.value);
      } else {
        this.logger.error(
          `Anomaly detector "${detectorNames[i]}" failed for org ${organizationId}: ${result.reason}`,
        );
      }
    });

    const severityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    all.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // 3. Cache the merged, sorted result for 1 hour (best-effort).
    try {
      const redis = await this.getRedis();
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(all), 'EX', ANOMALY_CACHE_TTL_SECONDS);
      }
    } catch {
      // Never fail the analysis because caching failed.
    }

    return all;
  }

  async detectRevenueDrop(organizationId: string, months = 6): Promise<Anomaly[]> {
    const series = await this.getMonthlyRevenue(organizationId, months);
    if (series.length < 2) {
      return [{ type: 'REVENUE_DROP', severity: 'HIGH', title: 'Revenue Drop Detection', description: 'Insufficient data to detect revenue drops', metric: 'Payment.amount', observed: 0, baseline: null, period: 'N/A', recommendation: 'Ensure at least 2 months of payment data exist', insufficientData: true }];
    }

    const anomalies: Anomaly[] = [];
    for (let i = 1; i < series.length; i++) {
      const current = series[i].total;
      const previous = series[i - 1].total;
      if (previous > 0 && current < previous * 0.8) {
        const dropPercent = Math.round(((previous - current) / previous) * 100);
        anomalies.push({
          type: 'REVENUE_DROP',
          severity: dropPercent >= 40 ? 'HIGH' : 'MEDIUM',
          title: `Revenue dropped ${dropPercent}% in ${series[i].month}`,
          description: `Revenue fell from ${previous} to ${current} compared to the previous month (${series[i - 1].month})`,
          metric: 'Payment.amount',
          observed: current,
          baseline: previous,
          period: series[i].month,
          recommendation: 'Investigate payment collection, enrollment changes, or seasonal patterns',
        });
      }
    }
    return anomalies;
  }

  async detectExpenseSpike(organizationId: string, months = 6): Promise<Anomaly[]> {
    const series = await this.getMonthlyExpenses(organizationId, months);
    if (series.length < 3) {
      return [{ type: 'EXPENSE_SPIKE', severity: 'HIGH', title: 'Expense Spike Detection', description: 'Insufficient data to detect expense spikes', metric: 'Expense.amount', observed: 0, baseline: null, period: 'N/A', recommendation: 'Ensure at least 3 months of expense data exist', insufficientData: true }];
    }

    const anomalies: Anomaly[] = [];
    for (let i = 2; i < series.length; i++) {
      const rollingAvg = (series[i - 1].total + series[i - 2].total) / 2;
      const current = series[i].total;
      if (rollingAvg > 0 && current > rollingAvg * 2) {
        anomalies.push({
          type: 'EXPENSE_SPIKE',
          severity: 'HIGH',
          title: `Expense spike detected in ${series[i].month}`,
          description: `Expenses of ${current} exceeded 2x the rolling average of ${Math.round(rollingAvg)} for ${series[i].month}`,
          metric: 'Expense.amount',
          observed: current,
          baseline: Math.round(rollingAvg),
          period: series[i].month,
          recommendation: 'Review recent expenses for unusual or unauthorized transactions',
        });
      }
    }
    return anomalies;
  }

  async detectRefundAnomaly(organizationId: string, months = 6): Promise<Anomaly[]> {
    const monthsData = await this.getMonthlyRevenueAndRefunds(organizationId, months);
    if (monthsData.length < 1) {
      return [{ type: 'REFUND_ANOMALY', severity: 'HIGH', title: 'Refund Rate Anomaly', description: 'Insufficient data to detect refund anomalies', metric: 'Refund.amount', observed: 0, baseline: null, period: 'N/A', recommendation: 'Ensure payment and refund data exist', insufficientData: true }];
    }

    const anomalies: Anomaly[] = [];
    for (const m of monthsData) {
      if (m.revenue > 0) {
        const refundRate = (m.refunds / m.revenue) * 100;
        if (refundRate > 10) {
          anomalies.push({
            type: 'REFUND_ANOMALY',
            severity: refundRate > 20 ? 'HIGH' : 'MEDIUM',
            title: `High refund rate in ${m.month} (${Math.round(refundRate)}%)`,
            description: `Refunds of ${m.refunds} represent ${Math.round(refundRate)}% of revenue (${m.revenue}) in ${m.month}`,
            metric: 'Refund.amount / Payment.amount',
            observed: Math.round(refundRate * 10) / 10,
            baseline: 10,
            period: m.month,
            recommendation: 'Investigate refund reasons, check for billing errors or student dissatisfaction',
          });
        }
      }
    }
    return anomalies;
  }

  async detectDebtIncrease(organizationId: string, months = 6): Promise<Anomaly[]> {
    const monthlyDebt = await this.getMonthlyDebt(organizationId, months);
    if (monthlyDebt.length < 2) {
      return [{ type: 'DEBT_INCREASE', severity: 'HIGH', title: 'Debt Increase Detection', description: 'Insufficient data to detect debt increases', metric: 'Invoice.total', observed: 0, baseline: null, period: 'N/A', recommendation: 'Ensure at least 2 months of invoice data exist', insufficientData: true }];
    }

    const anomalies: Anomaly[] = [];
    for (let i = 1; i < monthlyDebt.length; i++) {
      const current = monthlyDebt[i].debt;
      const previous = monthlyDebt[i - 1].debt;
      if (previous > 0 && current > previous * 1.15) {
        const increasePercent = Math.round(((current - previous) / previous) * 100);
        anomalies.push({
          type: 'DEBT_INCREASE',
          severity: increasePercent >= 30 ? 'HIGH' : 'MEDIUM',
          title: `Total debt increased ${increasePercent}% in ${monthlyDebt[i].month}`,
          description: `Outstanding debt rose from ${previous} to ${current} in ${monthlyDebt[i].month}`,
          metric: 'Invoice.outstanding',
          observed: current,
          baseline: previous,
          period: monthlyDebt[i].month,
          recommendation: 'Review collection efforts, follow up on overdue invoices, and consider payment plan options',
        });
      }
    }
    return anomalies;
  }

  async detectCashFlowDeterioration(organizationId: string, months = 6): Promise<Anomaly[]> {
    const monthlyCF = await this.getMonthlyCashFlow(organizationId, months);
    if (monthlyCF.length < 1) {
      return [{ type: 'CASH_FLOW_NEGATIVE', severity: 'HIGH', title: 'Cash Flow Deterioration', description: 'Insufficient data to detect cash flow issues', metric: 'netCashFlow', observed: 0, baseline: null, period: 'N/A', recommendation: 'Ensure payment and expense data exist', insufficientData: true }];
    }

    const anomalies: Anomaly[] = [];
    for (const m of monthlyCF) {
      if (m.netCashFlow < 0) {
        anomalies.push({
          type: 'CASH_FLOW_NEGATIVE',
          severity: 'HIGH',
          title: `Negative cash flow in ${m.month}`,
          description: `Net cash flow was ${m.netCashFlow} (inflows: ${m.inflows}, outflows: ${m.outflows}) in ${m.month}`,
          metric: 'netCashFlow',
          observed: m.netCashFlow,
          baseline: 0,
          period: m.month,
          recommendation: 'Review expenses and payroll costs, accelerate receivable collections, or adjust pricing',
        });
      }
    }
    return anomalies;
  }

  async detectPayrollAnomaly(organizationId: string, months = 6): Promise<Anomaly[]> {
    const monthlyData = await this.getMonthlyPayrollVsRevenue(organizationId, months);
    if (monthlyData.length < 1) {
      return [{ type: 'PAYROLL_EXCEEDS_REVENUE', severity: 'HIGH', title: 'Payroll Anomaly', description: 'Insufficient data to detect payroll anomalies', metric: 'PayrollRun.netAmount / Payment.amount', observed: 0, baseline: null, period: 'N/A', recommendation: 'Ensure payment and payroll data exist', insufficientData: true }];
    }

    const anomalies: Anomaly[] = [];
    for (const m of monthlyData) {
      if (m.revenue > 0 && m.payroll > m.revenue) {
        const ratio = Math.round((m.payroll / m.revenue) * 100);
        anomalies.push({
          type: 'PAYROLL_EXCEEDS_REVENUE',
          severity: 'HIGH',
          title: `Payroll exceeds revenue in ${m.month} (${ratio}%)`,
          description: `Payroll of ${m.payroll} exceeded revenue of ${m.revenue} in ${m.month}`,
          metric: 'PayrollRun.netAmount / Payment.amount',
          observed: ratio,
          baseline: 100,
          period: m.month,
          recommendation: 'Review staffing levels, scheduling efficiency, or revenue shortfalls',
        });
      }
    }
    return anomalies;
  }

  async detectUnusualPaymentTiming(organizationId: string): Promise<Anomaly[]> {
    const latePayments = (await this.prisma.$queryRaw`
      SELECT
        p.id AS "paymentId",
        p.amount,
        p."paidAt",
        i."issueDate",
        EXTRACT(DAY FROM (p."paidAt" - i."issueDate"))::int AS "daysLate"
      FROM "Payment" p
      JOIN "Invoice" i ON p."invoiceId" = i.id
      WHERE p."organizationId" = ${organizationId}::uuid
        AND p.status = 'PAID'
        AND p."paidAt" IS NOT NULL
        AND i."issueDate" IS NOT NULL
        AND EXTRACT(DAY FROM (p."paidAt" - i."issueDate")) > 30
      ORDER BY "daysLate" DESC
      LIMIT 10
    `) as Array<{ paymentId: string; amount: string | number; paidAt: Date; issueDate: Date; daysLate: number }>;

    if (latePayments.length === 0) {
      return [{ type: 'LATE_PAYMENT', severity: 'LOW', title: 'Unusual Payment Timing', description: 'No payments received more than 30 days after invoicing', metric: 'Payment.daysToPay', observed: 0, baseline: null, period: 'N/A', recommendation: 'No action needed — payment timing is within normal range', insufficientData: false }];
    }

    return latePayments.map((lp) => ({
      type: 'LATE_PAYMENT',
      severity: lp.daysLate > 60 ? 'HIGH' : 'MEDIUM',
      title: `Payment received ${lp.daysLate} days after invoice`,
      description: `Payment of ${lp.amount} for invoice issued on ${new Date(lp.issueDate).toISOString().slice(0, 10)} was received on ${new Date(lp.paidAt).toISOString().slice(0, 10)} (${lp.daysLate} days late)`,
      metric: 'Payment.daysToPay',
      observed: lp.daysLate,
      baseline: 30,
      period: new Date(lp.paidAt).toISOString().slice(0, 7),
      recommendation: 'Follow up on invoices approaching or exceeding the 30-day payment window',
    }));
  }

  async detectEnrollmentDrop(organizationId: string): Promise<Anomaly[]> {
    const monthlyEnrollments = await this.getMonthlyEnrollments(organizationId, 12);
    if (monthlyEnrollments.length < 4) {
      return [{ type: 'ENROLLMENT_DROP', severity: 'MEDIUM', title: 'Enrollment Drop Detection', description: 'Insufficient data to detect enrollment drops', metric: 'StudentGroup.count', observed: 0, baseline: null, period: 'N/A', recommendation: 'Ensure at least 4 months of enrollment data exist', insufficientData: true }];
    }

    const anomalies: Anomaly[] = [];
    for (let i = 3; i < monthlyEnrollments.length; i++) {
      const rollingAvg = (monthlyEnrollments[i - 1].count + monthlyEnrollments[i - 2].count + monthlyEnrollments[i - 3].count) / 3;
      const current = monthlyEnrollments[i].count;
      if (rollingAvg > 0 && current < rollingAvg * 0.75) {
        const dropPercent = Math.round(((rollingAvg - current) / rollingAvg) * 100);
        anomalies.push({
          type: 'ENROLLMENT_DROP',
          severity: dropPercent >= 50 ? 'HIGH' : 'MEDIUM',
          title: `Enrollment dropped ${dropPercent}% in ${monthlyEnrollments[i].month}`,
          description: `New enrollments of ${current} are ${dropPercent}% below the 3-month rolling average of ${Math.round(rollingAvg)} in ${monthlyEnrollments[i].month}`,
          metric: 'StudentGroup.count',
          observed: current,
          baseline: Math.round(rollingAvg),
          period: monthlyEnrollments[i].month,
          recommendation: 'Review marketing efforts, check competitor activity, or assess student satisfaction',
        });
      }
    }
    return anomalies;
  }

  private async getMonthlyRevenue(organizationId: string, months: number): Promise<Array<{ month: string; total: number }>> {
    const rows = (await this.prisma.$queryRaw`
      SELECT DATE_TRUNC('month', COALESCE("paidAt", "createdAt")) AS bucket, COALESCE(SUM(amount), 0) AS total
      FROM "Payment"
      WHERE "organizationId" = ${organizationId}::uuid AND status = 'PAID'
        AND COALESCE("paidAt", "createdAt") >= NOW() - (${months} * INTERVAL '1 month')
      GROUP BY 1
      ORDER BY 1 ASC
    `) as Array<{ bucket: Date; total: string | number }>;

    return rows.map((r) => ({
      month: new Date(r.bucket).toISOString().slice(0, 7),
      total: Number(r.total),
    }));
  }

  private async getMonthlyExpenses(organizationId: string, months: number): Promise<Array<{ month: string; total: number }>> {
    const rows = (await this.prisma.$queryRaw`
      SELECT DATE_TRUNC('month', date) AS bucket, COALESCE(SUM(amount), 0) AS total
      FROM "Expense"
      WHERE "organizationId" = ${organizationId}::uuid
        AND date >= NOW() - (${months} * INTERVAL '1 month')
      GROUP BY 1
      ORDER BY 1 ASC
    `) as Array<{ bucket: Date; total: string | number }>;

    return rows.map((r) => ({
      month: new Date(r.bucket).toISOString().slice(0, 7),
      total: Number(r.total),
    }));
  }

  private async getMonthlyRevenueAndRefunds(organizationId: string, months: number): Promise<Array<{ month: string; revenue: number; refunds: number }>> {
    const [revRows, refRows] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT DATE_TRUNC('month', COALESCE("paidAt", "createdAt")) AS bucket, COALESCE(SUM(amount), 0) AS total
        FROM "Payment"
        WHERE "organizationId" = ${organizationId}::uuid AND status = 'PAID'
          AND COALESCE("paidAt", "createdAt") >= NOW() - (${months} * INTERVAL '1 month')
        GROUP BY 1 ORDER BY 1 ASC
      ` as Promise<Array<{ bucket: Date; total: string | number }>>,
      this.prisma.$queryRaw`
        SELECT DATE_TRUNC('month', "createdAt") AS bucket, COALESCE(SUM(amount), 0) AS total
        FROM "Refund"
        WHERE "organizationId" = ${organizationId}::uuid AND status = 'PROCESSED'
          AND "createdAt" >= NOW() - (${months} * INTERVAL '1 month')
        GROUP BY 1 ORDER BY 1 ASC
      ` as Promise<Array<{ bucket: Date; total: string | number }>>,
    ]);

    const revenueMap = new Map<string, number>();
    for (const r of revRows) {
      revenueMap.set(new Date(r.bucket).toISOString().slice(0, 7), Number(r.total));
    }

    const refundMap = new Map<string, number>();
    for (const r of refRows) {
      refundMap.set(new Date(r.bucket).toISOString().slice(0, 7), Number(r.total));
    }

    const allMonths = new Set([...revenueMap.keys(), ...refundMap.keys()]);
    return [...allMonths].sort().map((m) => ({
      month: m,
      revenue: revenueMap.get(m) ?? 0,
      refunds: refundMap.get(m) ?? 0,
    }));
  }

  private async getMonthlyDebt(organizationId: string, months: number): Promise<Array<{ month: string; debt: number }>> {
    const rows = (await this.prisma.$queryRaw`
      SELECT
        DATE_TRUNC('month', "issueDate") AS bucket,
        COALESCE(SUM("total" - "paidAmount"), 0) AS debt
      FROM "Invoice"
      WHERE "organizationId" = ${organizationId}::uuid
        AND "status" IN ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE')
        AND "issueDate" >= NOW() - (${months} * INTERVAL '1 month')
      GROUP BY 1
      ORDER BY 1 ASC
    `) as Array<{ bucket: Date; debt: string | number }>;

    return rows.map((r) => ({
      month: new Date(r.bucket).toISOString().slice(0, 7),
      debt: Number(r.debt),
    }));
  }

  private async getMonthlyCashFlow(organizationId: string, months: number): Promise<Array<{ month: string; inflows: number; outflows: number; netCashFlow: number }>> {
    const [inflowRows, expenseRows, payrollRows, refundRows] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT DATE_TRUNC('month', COALESCE("paidAt", "createdAt")) AS bucket, COALESCE(SUM(amount), 0) AS total
        FROM "Payment"
        WHERE "organizationId" = ${organizationId}::uuid AND status = 'PAID'
          AND COALESCE("paidAt", "createdAt") >= NOW() - (${months} * INTERVAL '1 month')
        GROUP BY 1 ORDER BY 1 ASC
      ` as Promise<Array<{ bucket: Date; total: string | number }>>,
      this.prisma.$queryRaw`
        SELECT DATE_TRUNC('month', date) AS bucket, COALESCE(SUM(amount), 0) AS total
        FROM "Expense"
        WHERE "organizationId" = ${organizationId}::uuid
          AND date >= NOW() - (${months} * INTERVAL '1 month')
        GROUP BY 1 ORDER BY 1 ASC
      ` as Promise<Array<{ bucket: Date; total: string | number }>>,
      this.prisma.$queryRaw`
        SELECT DATE_TRUNC('month', "calculatedAt") AS bucket, COALESCE(SUM("netAmount"), 0) AS total
        FROM "PayrollRun"
        WHERE "organizationId" = ${organizationId}::uuid AND status = 'PAID'
          AND "calculatedAt" >= NOW() - (${months} * INTERVAL '1 month')
        GROUP BY 1 ORDER BY 1 ASC
      ` as Promise<Array<{ bucket: Date; total: string | number }>>,
      this.prisma.$queryRaw`
        SELECT DATE_TRUNC('month', "createdAt") AS bucket, COALESCE(SUM(amount), 0) AS total
        FROM "Refund"
        WHERE "organizationId" = ${organizationId}::uuid AND status = 'PROCESSED'
          AND "createdAt" >= NOW() - (${months} * INTERVAL '1 month')
        GROUP BY 1 ORDER BY 1 ASC
      ` as Promise<Array<{ bucket: Date; total: string | number }>>,
    ]);

    const toMap = (rows: Array<{ bucket: Date; total: string | number }>) => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(new Date(r.bucket).toISOString().slice(0, 7), Number(r.total));
      return m;
    };

    const inflowMap = toMap(inflowRows);
    const expenseMap = toMap(expenseRows);
    const payrollMap = toMap(payrollRows);
    const refundMap = toMap(refundRows);

    const allMonths = new Set([...inflowMap.keys(), ...expenseMap.keys(), ...payrollMap.keys(), ...refundMap.keys()]);
    return [...allMonths].sort().map((m) => {
      const inflows = inflowMap.get(m) ?? 0;
      const outflows = (expenseMap.get(m) ?? 0) + (payrollMap.get(m) ?? 0) + (refundMap.get(m) ?? 0);
      return { month: m, inflows, outflows, netCashFlow: inflows - outflows };
    });
  }

  private async getMonthlyPayrollVsRevenue(organizationId: string, months: number): Promise<Array<{ month: string; payroll: number; revenue: number }>> {
    const [payrollRows, revenueRows] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT DATE_TRUNC('month', "calculatedAt") AS bucket, COALESCE(SUM("netAmount"), 0) AS total
        FROM "PayrollRun"
        WHERE "organizationId" = ${organizationId}::uuid AND status = 'PAID'
          AND "calculatedAt" >= NOW() - (${months} * INTERVAL '1 month')
        GROUP BY 1 ORDER BY 1 ASC
      ` as Promise<Array<{ bucket: Date; total: string | number }>>,
      this.prisma.$queryRaw`
        SELECT DATE_TRUNC('month', COALESCE("paidAt", "createdAt")) AS bucket, COALESCE(SUM(amount), 0) AS total
        FROM "Payment"
        WHERE "organizationId" = ${organizationId}::uuid AND status = 'PAID'
          AND COALESCE("paidAt", "createdAt") >= NOW() - (${months} * INTERVAL '1 month')
        GROUP BY 1 ORDER BY 1 ASC
      ` as Promise<Array<{ bucket: Date; total: string | number }>>,
    ]);

    const payrollMap = new Map<string, number>();
    for (const r of payrollRows) payrollMap.set(new Date(r.bucket).toISOString().slice(0, 7), Number(r.total));

    const revenueMap = new Map<string, number>();
    for (const r of revenueRows) revenueMap.set(new Date(r.bucket).toISOString().slice(0, 7), Number(r.total));

    const allMonths = new Set([...payrollMap.keys(), ...revenueMap.keys()]);
    return [...allMonths].sort().map((m) => ({
      month: m,
      payroll: payrollMap.get(m) ?? 0,
      revenue: revenueMap.get(m) ?? 0,
    }));
  }

  private async getMonthlyEnrollments(organizationId: string, months: number): Promise<Array<{ month: string; count: number }>> {
    const rows = (await this.prisma.$queryRaw`
      SELECT DATE_TRUNC('month', "joinedAt") AS bucket, COUNT(*)::int AS count
      FROM "StudentGroup"
      WHERE "organizationId" = ${organizationId}::uuid
        AND "joinedAt" >= NOW() - (${months} * INTERVAL '1 month')
      GROUP BY 1
      ORDER BY 1 ASC
    `) as Array<{ bucket: Date; count: number }>;

    return rows.map((r) => ({
      month: new Date(r.bucket).toISOString().slice(0, 7),
      count: r.count,
    }));
  }
}
