import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async getReconciliationReport(organizationId: string, year: number, month: number) {
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const [invoices, payments, refunds, expenses, payroll, studentBalances] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: {
          organizationId,
          issueDate: { gte: periodStart, lte: periodEnd },
          status: { notIn: ['DRAFT', 'CANCELLED'] },
        },
        _sum: { total: true, paidAmount: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: {
          organizationId,
          status: 'PAID',
          paidAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.refund.aggregate({
        where: {
          organizationId,
          status: 'PROCESSED',
          processedAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: {
          organizationId,
          date: { gte: periodStart, lte: periodEnd },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payrollRun.aggregate({
        where: {
          organizationId,
          periodYear: year,
          periodMonth: month,
          status: { notIn: ['CANCELLED'] },
        },
        _sum: { netAmount: true, lessonsCount: true },
        _count: true,
      }),
      this.prisma.student.aggregate({
        where: { organizationId, status: 'ACTIVE' },
        _sum: { balance: true },
        _count: true,
      }),
    ]);

    const totalInvoiced = Number(invoices._sum.total || 0);
    const totalPaid = Number(payments._sum.amount || 0);
    const totalRefunded = Number(refunds._sum.amount || 0);
    const totalExpenses = Number(expenses._sum.amount || 0);
    const totalPayroll = Number(payroll._sum.netAmount || 0);
    const totalLessonsCount = Number(payroll._sum.lessonsCount || 0);
    const totalStudentBalance = Number(studentBalances._sum.balance || 0);

    const receivableDifference = totalInvoiced - totalPaid;
    const netCashFlow = totalPaid - totalRefunded - totalExpenses - totalPayroll;
    const payrollRevenueRatio = totalPaid > 0 ? totalPayroll / totalPaid : 0;
    const costPerLesson = totalLessonsCount > 0 ? totalPayroll / totalLessonsCount : 0;

    const hasExpenses = totalExpenses > 0;
    const hasPayroll = totalPayroll > 0;
    const hasInvoices = totalInvoiced > 0;
    const hasPayments = totalPaid > 0;

    return {
      period: { year, month },
      summary: {
        totalInvoiced,
        totalPaid,
        totalRefunded,
        totalExpenses,
        totalPayroll,
        receivableDifference,
        netCashFlow,
        payrollRevenueRatio,
        costPerLesson,
        totalStudentBalance,
      },
      receivables: {
        totalInvoiced,
        totalPaid,
        difference: receivableDifference,
        invoiceCount: invoices._count,
        paymentCount: payments._count,
      },
      refundAnalysis: {
        totalRefunded,
        refundCount: refunds._count,
        refundToRevenueRatio: totalPaid > 0 ? totalRefunded / totalPaid : 0,
      },
      expenseAnalysis: {
        totalExpenses,
        expenseCount: expenses._count,
        hasExpenses,
      },
      payrollAnalysis: {
        totalPayroll,
        payrollCount: payroll._count,
        totalLessonsCount,
        payrollRevenueRatio,
        costPerLesson,
        hasPayroll,
      },
      studentBalances: {
        totalOutstanding: totalStudentBalance,
        activeStudentCount: studentBalances._count,
      },
      dataQuality: {
        hasInvoices,
        hasPayments,
        hasExpenses,
        hasPayroll,
        isFullyReconciled: receivableDifference === 0 && totalRefunded === 0,
      },
    };
  }

  async detectDiscrepancies(organizationId: string, year: number, month: number) {
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const discrepancies: Array<{
      type: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      description: string;
      details: Record<string, unknown>;
    }> = [];

    const [paymentsWithoutInvoices, overdueInvoices, payrollAnomalies, duplicatePayments] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          organizationId,
          status: 'PAID',
          paidAt: { gte: periodStart, lte: periodEnd },
          invoiceId: null,
        },
        select: { id: true, amount: true, studentId: true, paidAt: true, reference: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          organizationId,
          status: { in: ['OVERDUE', 'ISSUED', 'PARTIALLY_PAID'] },
          dueDate: { lt: periodEnd },
          issueDate: { gte: periodStart, lte: periodEnd },
        },
        select: { id: true, number: true, total: true, paidAmount: true, dueDate: true, studentId: true },
      }),
      this.prisma.payrollRun.findMany({
        where: {
          organizationId,
          periodYear: year,
          periodMonth: month,
          status: { notIn: ['CANCELLED'] },
          netAmount: { gt: 0 },
          lessonsCount: 0,
        },
        select: { id: true, teacherId: true, netAmount: true, lessonsCount: true, salaryType: true },
      }),
      this.prisma.$queryRaw`
        SELECT p1."studentId", p1.amount, p1."paidAt", COUNT(*)::int as cnt
        FROM "Payment" p1
        INNER JOIN "Payment" p2
          ON p1."studentId" = p2."studentId"
          AND p1.amount = p2.amount
          AND p1.id != p2.id
          AND ABS(EXTRACT(EPOCH FROM (p1."paidAt" - p2."paidAt"))) < 86400
        WHERE p1."organizationId" = ${organizationId}::uuid
          AND p1.status = 'PAID'
          AND p2.status = 'PAID'
          AND p1."paidAt" >= ${periodStart}
          AND p1."paidAt" <= ${periodEnd}
        GROUP BY p1."studentId", p1.amount, p1."paidAt", p1.id
        HAVING COUNT(*) > 1
      ` as unknown as Array<{ studentId: string; amount: string | number; paidAt: Date; cnt: number }>,
    ]);

    if (paymentsWithoutInvoices.length > 0) {
      for (const p of paymentsWithoutInvoices) {
        discrepancies.push({
          type: 'PAYMENT_WITHOUT_INVOICE',
          severity: 'MEDIUM',
          description: `Payment of ${Number(p.amount)} has no linked invoice`,
          details: { paymentId: p.id, amount: Number(p.amount), studentId: p.studentId, paidAt: p.paidAt },
        });
      }
    }

    for (const inv of overdueInvoices) {
      const unpaid = Number(inv.total) - Number(inv.paidAmount);
      if (unpaid > 0 && inv.dueDate) {
        const daysOverdue = Math.floor((periodEnd.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        discrepancies.push({
          type: 'OVERDUE_INVOICE',
          severity: daysOverdue > 30 ? 'HIGH' : 'MEDIUM',
          description: `Invoice ${inv.number} is ${daysOverdue} days overdue with ${unpaid} unpaid`,
          details: {
            invoiceId: inv.id,
            invoiceNumber: inv.number,
            unpaidAmount: unpaid,
            daysOverdue,
            studentId: inv.studentId,
          },
        });
      }
    }

    for (const pr of payrollAnomalies) {
      discrepancies.push({
        type: 'PAYROLL_WITHOUT_LESSONS',
        severity: 'HIGH',
        description: `Teacher ${pr.teacherId} has netAmount ${Number(pr.netAmount)} with 0 lessons taught`,
        details: {
          payrollRunId: pr.id,
          teacherId: pr.teacherId,
          netAmount: Number(pr.netAmount),
          lessonsCount: pr.lessonsCount,
          salaryType: pr.salaryType,
        },
      });
    }

    const seenDuplicateKeys = new Set<string>();
    for (const dp of duplicatePayments) {
      const key = `${dp.studentId}-${dp.amount}-${new Date(dp.paidAt).toISOString().slice(0, 13)}`;
      if (!seenDuplicateKeys.has(key)) {
        seenDuplicateKeys.add(key);
        discrepancies.push({
          type: 'POTENTIAL_DUPLICATE_PAYMENT',
          severity: 'CRITICAL',
          description: `Potential duplicate: ${dp.cnt} payments of ${Number(dp.amount)} by student ${dp.studentId} within 24h`,
          details: {
            studentId: dp.studentId,
            amount: Number(dp.amount),
            count: dp.cnt,
            firstPaidAt: dp.paidAt,
          },
        });
      }
    }

    return {
      period: { year, month },
      totalDiscrepancies: discrepancies.length,
      byType: {
        paymentsWithoutInvoices: paymentsWithoutInvoices.length,
        overdueInvoices: overdueInvoices.filter((i) => Number(i.total) - Number(i.paidAmount) > 0).length,
        payrollWithoutLessons: payrollAnomalies.length,
        potentialDuplicates: seenDuplicateKeys.size,
      },
      discrepancies,
    };
  }

  async getStudentBalanceReport(organizationId: string) {
    const rows = await this.prisma.$queryRaw`
      SELECT 
        s.id as "studentId",
        u."firstName" || ' ' || u."lastName" as "studentName",
        s.balance::decimal as balance,
        COALESCE(inv_agg."totalInvoiced", 0)::decimal as "totalInvoiced",
        COALESCE(pay_agg."totalPaid", 0)::decimal as "totalPaid",
        inv_agg."oldestDebtDate" as "oldestDebtDate",
        COALESCE(inv_agg."unpaidInvoiceCount", 0)::int as "unpaidInvoiceCount"
      FROM "Student" s
      JOIN "User" u ON s."userId" = u.id
      LEFT JOIN LATERAL (
        SELECT 
          SUM(i.total) as "totalInvoiced",
          MIN(CASE WHEN i.total - i."paidAmount" > 0 THEN COALESCE(i."dueDate", i."issueDate") END) as "oldestDebtDate",
          COUNT(CASE WHEN i.total - i."paidAmount" > 0 THEN 1 END) as "unpaidInvoiceCount"
        FROM "Invoice" i 
        WHERE i."studentId" = s.id 
          AND i.status NOT IN ('DRAFT', 'CANCELLED')
      ) inv_agg ON true
      LEFT JOIN LATERAL (
        SELECT SUM(p.amount) as "totalPaid"
        FROM "Payment" p
        WHERE p."studentId" = s.id
          AND p.status = 'PAID'
      ) pay_agg ON true
      WHERE s."organizationId" = ${organizationId}::uuid
        AND s.status = 'ACTIVE'
    ` as Array<{
      studentId: string;
      studentName: string;
      balance: number;
      totalInvoiced: number;
      totalPaid: number;
      oldestDebtDate: Date | null;
      unpaidInvoiceCount: number;
    }>;

    const report = rows.map((r) => {
      const totalInvoiced = Number(r.totalInvoiced);
      const totalPaid = Number(r.totalPaid);
      return {
        studentId: r.studentId,
        studentName: r.studentName,
        balance: Number(r.balance),
        totalInvoiced,
        totalPaid,
        outstandingAmount: Math.max(0, totalInvoiced - totalPaid),
        oldestDebtDate: r.oldestDebtDate,
        unpaidInvoiceCount: Number(r.unpaidInvoiceCount),
      };
    });

    const totalOutstanding = report.reduce((sum, r) => sum + r.outstandingAmount, 0);
    const studentsWithDebt = report.filter((r) => r.outstandingAmount > 0).length;

    return {
      students: report,
      summary: {
        totalStudents: report.length,
        studentsWithDebt,
        totalOutstanding,
        avgOutstandingPerStudent: studentsWithDebt > 0 ? totalOutstanding / studentsWithDebt : 0,
      },
    };
  }

  async getReconciliationHistory(organizationId: string) {
    const periods = await this.prisma.financialPeriod.findMany({
      where: { organizationId },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      take: 24,
    });

    if (periods.length === 0) {
      return { periods: [], summary: { totalPeriods: 0, reconciledCount: 0, closedCount: 0 } };
    }

    const history = periods.map((p) => ({
      year: p.periodYear,
      month: p.periodMonth,
      status: p.status,
      closedAt: p.closedAt,
      createdAt: p.createdAt,
    }));

    return {
      periods: history,
      summary: {
        totalPeriods: periods.length,
        reconciledCount: periods.filter((p) => p.status === 'RECONCILED').length,
        closedCount: periods.filter((p) => p.status === 'CLOSED').length,
        openCount: periods.filter((p) => p.status === 'OPEN').length,
        reviewCount: periods.filter((p) => p.status === 'REVIEW').length,
      },
    };
  }
}
