import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialBrainService } from './financial-brain.service';

@Injectable()
export class PayrollAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialBrain: FinancialBrainService,
  ) {}

  async getPayrollSummary(organizationId: string, period?: string) {
    const where: Prisma.PayrollRunWhereInput = { organizationId };
    if (period) {
      const [yearStr, monthStr] = period.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      if (year && month) {
        where.periodYear = year;
        where.periodMonth = month;
      }
    }

    const [runs, agg] = await Promise.all([
      this.prisma.payrollRun.findMany({
        where,
        select: { status: true, netAmount: true, lessonsCount: true, teacherId: true },
      }),
      this.prisma.payrollRun.aggregate({
        where,
        _sum: { netAmount: true, grossAmount: true },
        _count: true,
      }),
    ]);

    if (runs.length === 0) {
      return { status: 'INSUFFICIENT_DATA' as const, message: 'No payroll data available' };
    }

    const totalPayroll = Number(agg._sum.netAmount ?? 0);
    const paidRuns = runs.filter((r) => r.status === 'PAID');
    const paidPayroll = paidRuns.reduce((sum, r) => sum + Number(r.netAmount), 0);
    const teachers = new Set(runs.map((r) => r.teacherId));
    const totalLessons = runs.reduce((sum, r) => sum + r.lessonsCount, 0);

    return {
      totalPayroll: Math.round(totalPayroll * 100) / 100,
      paidPayroll: Math.round(paidPayroll * 100) / 100,
      paidCount: paidRuns.length,
      totalCount: runs.length,
      averagePerTeacher: teachers.size > 0 ? Math.round((totalPayroll / teachers.size) * 100) / 100 : 0,
      totalLessons,
      teacherCount: teachers.size,
    };
  }

  async getPayrollByTeacher(organizationId: string, period?: string) {
    const where: Prisma.PayrollRunWhereInput = { organizationId };
    if (period) {
      const [yearStr, monthStr] = period.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      if (year && month) {
        where.periodYear = year;
        where.periodMonth = month;
      }
    }

    const runs = await this.prisma.payrollRun.findMany({
      where,
      include: {
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });

    if (runs.length === 0) {
      return { status: 'INSUFFICIENT_DATA' as const, message: 'No payroll data available' };
    }

    const byTeacher = new Map<string, {
      teacherId: string;
      name: string;
      totalLessons: number;
      totalNet: number;
      totalGross: number;
      runs: number;
      statuses: Record<string, number>;
    }>();

    for (const run of runs) {
      const key = run.teacherId;
      const existing = byTeacher.get(key);
      const firstName = run.teacher?.user?.firstName ?? '';
      const lastName = run.teacher?.user?.lastName ?? '';
      const name = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';

      if (existing) {
        existing.totalLessons += run.lessonsCount;
        if (run.status !== 'CANCELLED') {
          existing.totalNet += Number(run.netAmount);
          existing.totalGross += Number(run.grossAmount);
        }
        existing.runs += 1;
        existing.statuses[run.status] = (existing.statuses[run.status] ?? 0) + 1;
      } else {
        byTeacher.set(key, {
          teacherId: key,
          name,
          totalLessons: run.lessonsCount,
          totalNet: run.status !== 'CANCELLED' ? Number(run.netAmount) : 0,
          totalGross: run.status !== 'CANCELLED' ? Number(run.grossAmount) : 0,
          runs: 1,
          statuses: { [run.status]: 1 },
        });
      }
    }

    return {
      teachers: Array.from(byTeacher.values()).map((t) => ({
        ...t,
        totalNet: Math.round(t.totalNet * 100) / 100,
        totalGross: Math.round(t.totalGross * 100) / 100,
      })),
    };
  }

  async getPayrollTrend(organizationId: string, months: number = 6) {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const runs = await this.prisma.payrollRun.findMany({
      where: {
        organizationId,
        OR: [
          { periodYear: { gt: startMonth.getFullYear() } },
          {
            periodYear: startMonth.getFullYear(),
            periodMonth: { gte: startMonth.getMonth() + 1 },
          },
        ],
      },
      select: {
        periodYear: true,
        periodMonth: true,
        netAmount: true,
        status: true,
      },
    });

    if (runs.length === 0) {
      return { status: 'INSUFFICIENT_DATA' as const, message: 'No payroll trend data available' };
    }

    const monthlyMap = new Map<string, { total: number; paid: number; count: number }>();
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, { total: 0, paid: 0, count: 0 });
    }

    for (const run of runs) {
      const key = `${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}`;
      const entry = monthlyMap.get(key);
      if (entry) {
        if (run.status !== 'CANCELLED') {
          entry.total += Number(run.netAmount);
        }
        if (run.status === 'PAID') {
          entry.paid += Number(run.netAmount);
        }
        entry.count += 1;
      }
    }

    const trend = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      total: Math.round(data.total * 100) / 100,
      paid: Math.round(data.paid * 100) / 100,
      count: data.count,
    }));

    return { trend };
  }

  async getPayrollToRevenueRatio(organizationId: string, months: number = 6) {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const [runs, revenueData] = await Promise.all([
      this.prisma.payrollRun.findMany({
        where: {
          organizationId,
          OR: [
            { periodYear: { gt: startMonth.getFullYear() } },
            {
              periodYear: startMonth.getFullYear(),
              periodMonth: { gte: startMonth.getMonth() + 1 },
            },
          ],
          status: { not: 'CANCELLED' },
        },
        select: {
          periodYear: true,
          periodMonth: true,
          netAmount: true,
        },
      }),
      this.financialBrain.getMonthlyRevenueSeries(organizationId),
    ]);

    if (runs.length === 0) {
      return { status: 'INSUFFICIENT_DATA' as const, message: 'No payroll data for ratio calculation' };
    }

    const payrollByMonth = new Map<string, number>();
    for (const run of runs) {
      const key = `${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}`;
      payrollByMonth.set(key, (payrollByMonth.get(key) ?? 0) + Number(run.netAmount));
    }

    const revenueByMonth = new Map<string, number>();
    for (const r of revenueData) {
      revenueByMonth.set(r.month, r.total);
    }

    const months_result: Array<{ month: string; payroll: number; revenue: number; ratio: number | null }> = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const payroll = payrollByMonth.get(key) ?? 0;
      const revenue = revenueByMonth.get(key) ?? 0;
      months_result.push({
        month: key,
        payroll: Math.round(payroll * 100) / 100,
        revenue: Math.round(revenue * 100) / 100,
        ratio: revenue > 0 ? Math.round((payroll / revenue) * 10000) / 100 : null,
      });
    }

    return { months: months_result };
  }

  async getLessonEfficiency(organizationId: string) {
    const rows = await this.prisma.$queryRaw`
      SELECT 
        r."teacherId",
        u."firstName" || ' ' || u."lastName" as name,
        SUM(r."netAmount")::decimal as "totalNet",
        SUM(r."lessonsCount")::int as "totalLessons",
        COUNT(r.id)::int as runs
      FROM "PayrollRun" r
      JOIN "Teacher" t ON r."teacherId" = t.id
      JOIN "User" u ON t."userId" = u.id
      WHERE r."organizationId" = ${organizationId}::uuid
        AND r.status != 'CANCELLED'
      GROUP BY r."teacherId", u.id
    ` as Array<{
      teacherId: string;
      name: string;
      totalNet: number;
      totalLessons: number;
      runs: number;
    }>;

    if (rows.length === 0) {
      return { status: 'INSUFFICIENT_DATA' as const, message: 'No payroll data for efficiency calculation' };
    }

    const teachers = rows.map((t) => ({
      ...t,
      totalNet: Math.round(Number(t.totalNet) * 100) / 100,
      totalLessons: Number(t.totalLessons),
      runs: Number(t.runs),
      costPerLesson: Number(t.totalLessons) > 0
        ? Math.round((Number(t.totalNet) / Number(t.totalLessons)) * 100) / 100
        : 0,
    }));

    teachers.sort((a, b) => {
      if (a.costPerLesson === 0) return 1;
      if (b.costPerLesson === 0) return -1;
      return a.costPerLesson - b.costPerLesson;
    });

    const totalPayroll = teachers.reduce((sum, t) => sum + t.totalNet, 0);
    const totalLessons = teachers.reduce((sum, t) => sum + t.totalLessons, 0);

    return {
      teachers: teachers.map((t, idx) => ({
        ...t,
        rank: idx + 1,
      })),
      overallCostPerLesson: totalLessons > 0
        ? Math.round((totalPayroll / totalLessons) * 100) / 100
        : 0,
      totalPayroll: Math.round(totalPayroll * 100) / 100,
      totalLessons,
    };
  }
}
