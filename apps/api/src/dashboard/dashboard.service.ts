import { computeAttendanceRate } from '../common/attendance-rate.js';
import { startOfDay, getOrganizationDate } from '../common/date-range.js';
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

    // Timezone-aware today boundary for organization
    const org = await this.prisma.organization?.findUnique({
      where: { id: organizationId },
      select: { timezone: true },
    }).catch(() => null);
    const timezone = org?.timezone || 'Asia/Tashkent';
    const todayStart = getOrganizationDate(now, timezone);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [
      totalStudents,
      activeStudents,
      totalTeachers,
      activeGroups,
      totalCourses,
      recentPayments,
      leadStats,
      upcomingFollowUps,
      attendanceStats,
      debt,
      monthlyRevenue,
      allTimePayments,
      allTimeRefunds,
      newLeadsThisMonth,
      todayPaymentsAggregate,
      todayAttendanceGroup,
      todayLessonsCount,
    ] = await Promise.all([
      this.prisma.student.count({ where: { organizationId } }).catch(() => 0),
      this.prisma.student.count({ where: { organizationId, status: 'ACTIVE', user: { isActive: true } } }).catch(() => 0),
      this.prisma.teacher.count({ where: { organizationId } }).catch(() => 0),
      this.prisma.group.count({ where: { organizationId, isActive: true } }).catch(() => 0),
      this.prisma.course.count({ where: { organizationId, isActive: true } }).catch(() => 0),
      this.prisma.payment.findMany({
        where: { organizationId },
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }).catch(() => []),
      this.prisma.lead.groupBy({
        by: ['stage'],
        where: { organizationId },
        _count: { stage: true },
      }).catch(() => [] as any[]),
      this.prisma.followUp.findMany({
        where: { organizationId, isCompleted: false },
        include: { lead: { select: { id: true, firstName: true, lastName: true, phone: true } } },
        orderBy: { scheduledAt: 'asc' },
        take: 8,
      }).catch(() => [] as any[]),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { organizationId, date: { gte: thirtyDaysAgo } },
        _count: { status: true },
      }).catch(() => [] as any[]),
      this.finance.getDebtAndReceivables(organizationId).catch(() => ({ totalReceivables: 0, overdueDebt: 0 })),
      this.finance.getMonthlyRevenueSeries(organizationId).catch(() => []),
      this.prisma.payment.aggregate({ where: { organizationId, status: 'PAID' }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: null } })),
      this.prisma.refund.aggregate({ where: { organizationId, status: 'PROCESSED' }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: null } })),
      this.prisma.lead.count({
        where: { organizationId, createdAt: { gte: thisMonthStart } },
      }).catch(() => 0),
      this.prisma.payment.aggregate({
        where: {
          organizationId,
          status: 'PAID',
          OR: [
            { paidAt: { gte: todayStart, lt: todayEnd } },
            { paidAt: null, createdAt: { gte: todayStart, lt: todayEnd } },
          ],
        },
        _sum: { amount: true },
        _count: { id: true },
      }).catch(() => ({ _sum: { amount: null }, _count: { id: 0 } })),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { organizationId, date: { gte: todayStart, lt: todayEnd } },
        _count: { status: true },
      }).catch(() => [] as any[]),
      this.prisma.lesson?.count({
        where: {
          organizationId,
          date: { gte: todayStart, lt: todayEnd },
          status: { not: 'CANCELLED' },
        },
      }).catch(() => 0) ?? Promise.resolve(0),
    ]);

    const totalPaid = Number(allTimePayments._sum.amount || 0) - Number(allTimeRefunds._sum.amount || 0);

    const totalOverdue = debt.overdueDebt;
    const totalPending = Math.max(0, debt.totalReceivables - debt.overdueDebt);

    const todayRevenue = Number(todayPaymentsAggregate?._sum?.amount || 0);
    const todayPaymentsCount = Number(todayPaymentsAggregate?._count?.id || 0);

    const totalLeads = (leadStats as any[]).reduce((sum: number, s: any) => sum + Number(s?._count?.stage || 0), 0);
    const wonLeads = (leadStats as any[]).find((s: any) => s.stage === 'WON')?._count?.stage || 0;

    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

    const attendanceRate = computeAttendanceRate(attendanceStats as any) ?? 0;

    return {
      totalStudents,
      activeStudents,
      totalTeachers,
      activeGroups,
      totalCourses,
      totalPaid,
      totalPending,
      totalOverdue,
      todayRevenue,
      todayPaymentsCount,
      todayLessonsCount: todayLessonsCount ?? 0,
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
      todayAttendanceStats: (todayAttendanceGroup as any[]).map((s) => ({
        status: s.status,
        count: s._count.status,
      })),
      upcomingFollowUps,
    };
  }

  async getMonthlyRevenue(organizationId: string, period?: string) {
    return this.finance.getRevenueSeries(organizationId, period);
  }
}

