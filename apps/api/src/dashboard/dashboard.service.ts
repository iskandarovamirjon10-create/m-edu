import { computeAttendanceRate } from '../common/attendance-rate.js';
import { startOfDay } from '../common/date-range.js';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialBrainService } from '../analytics/financial-brain.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinancialBrainService,
  ) {}

  async getStats(organizationId: string) {
    const now = new Date();
    // Safely get UTC start of current month
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    // Safely get 30 days ago, aligned to UTC start of day
    const thirtyDaysAgo = startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const [
      totalStudents,
      activeStudents,
      totalTeachers,
      activeGroups,
      recentPayments,
      leadStats,
      upcomingFollowUps,
      attendanceStats,
      debt,
      monthlyRevenue,
    ] = await Promise.all([
      this.prisma.student.count({ where: { organizationId } }),
      this.prisma.student.count({ where: { organizationId, status: 'ACTIVE', user: { isActive: true } } }),
      this.prisma.teacher.count({ where: { organizationId } }),
      this.prisma.group.count({ where: { organizationId, isActive: true } }),
      this.prisma.payment.findMany({
        where: { organizationId },
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.lead.groupBy({
        by: ['stage'],
        where: { organizationId },
        _count: { stage: true },
      }),
      this.prisma.followUp.findMany({
        where: { organizationId, isCompleted: false, scheduledAt: { gte: now } },
        include: { lead: { select: { firstName: true, lastName: true } } },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
      }),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { organizationId, date: { gte: thirtyDaysAgo } },
        _count: { status: true },
      }),
      this.finance.getDebtAndReceivables(organizationId),
      this.finance.getMonthlyRevenueSeries(organizationId),
    ]);

    // Compute total paid (all-time) from cash flow service by not restricting dates
    // Since getCashFlow expects dates, we'll run a quick all-time aggregate here,
    // but using the exact same logic as cash flow (PAID payments - PROCESSED refunds).
    const [allTimePayments, allTimeRefunds] = await Promise.all([
      this.prisma.payment.aggregate({ where: { organizationId, status: 'PAID' }, _sum: { amount: true } }),
      this.prisma.refund.aggregate({ where: { organizationId, status: 'PROCESSED' }, _sum: { amount: true } }),
    ]);
    const totalPaid = Number(allTimePayments._sum.amount || 0) - Number(allTimeRefunds._sum.amount || 0);

    const totalOverdue = debt.overdueDebt;
    const totalPending = Math.max(0, debt.totalReceivables - debt.overdueDebt);

    const totalLeads = leadStats.reduce((sum, s) => sum + s._count.stage, 0);
    const wonLeads = leadStats.find((s) => s.stage === 'WON')?._count.stage || 0;

    const newLeadsThisMonth = await this.prisma.lead.count({
      where: { organizationId, createdAt: { gte: thisMonthStart } },
    });

    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

    const attendanceRate = computeAttendanceRate(attendanceStats) ?? 0;

    return {
      totalStudents,
      activeStudents,
      totalTeachers,
      activeGroups,
      totalPaid,
      totalPending,
      totalOverdue,
      totalRevenue: totalPaid,
      pendingPayments: totalPending,
      overduePayments: totalOverdue,
      totalLeads,
      wonLeads,
      newLeadsThisMonth,
      conversionRate,
      attendanceRate,
      monthlyRevenue,
      recentPayments,
      leadByStage: leadStats.map((s) => ({
        stage: s.stage,
        count: s._count.stage,
      })),
      attendanceStats: attendanceStats.map((s) => ({
        status: s.status,
        count: s._count.status,
      })),
      upcomingFollowUps,
    };
  }
}

