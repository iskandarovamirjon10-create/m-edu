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

    const totalPaid = Math.max(
      0,
      Number(allTimePayments?._sum?.amount || 0) - Number(allTimeRefunds?._sum?.amount || 0),
    );

    const totalOverdue = Math.max(0, Number(debt?.overdueDebt || 0));
    const totalPending = Math.max(0, Number(debt?.totalReceivables || 0) - totalOverdue);

    const todayRevenue = Math.max(0, Number(todayPaymentsAggregate?._sum?.amount || 0));
    const todayPaymentsCount = Math.max(0, Number(todayPaymentsAggregate?._count?.id || 0));

    const rawLeads = Array.isArray(leadStats) ? leadStats : [];
    const totalLeads = rawLeads.reduce((sum: number, s: any) => sum + Number(s?._count?.stage || 0), 0);
    const wonLeads = Number(rawLeads.find((s: any) => s?.stage === 'WON')?._count?.stage || 0);

    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

    const rawAttendance = Array.isArray(attendanceStats) ? attendanceStats : [];
    const attendanceRate = computeAttendanceRate(rawAttendance as any) ?? 0;

    return {
      totalStudents: Number(totalStudents || 0),
      activeStudents: Number(activeStudents || 0),
      totalTeachers: Number(totalTeachers || 0),
      activeGroups: Number(activeGroups || 0),
      totalCourses: Number(totalCourses || 0),
      totalPaid,
      totalPending,
      totalOverdue,
      todayRevenue,
      todayPaymentsCount,
      todayLessonsCount: Number(todayLessonsCount || 0),
      totalRevenue: totalPaid,
      pendingPayments: totalPending,
      overduePayments: totalOverdue,
      totalLeads,
      wonLeads,
      newLeadsThisMonth: Number(newLeadsThisMonth || 0),
      conversionRate,
      attendanceRate,
      monthlyRevenue: Array.isArray(monthlyRevenue) ? monthlyRevenue : [],
      recentPayments: Array.isArray(recentPayments) ? recentPayments : [],
      leadByStage: rawLeads.map((s) => ({
        stage: s.stage,
        count: Number(s?._count?.stage || 0),
      })),
      attendanceStats: rawAttendance.map((s) => ({
        status: s.status,
        count: Number(s?._count?.status || 0),
      })),
      todayAttendanceStats: (Array.isArray(todayAttendanceGroup) ? todayAttendanceGroup : []).map((s) => ({
        status: s.status,
        count: Number(s?._count?.status || 0),
      })),
      upcomingFollowUps: Array.isArray(upcomingFollowUps) ? upcomingFollowUps : [],
    };
  }

  async getMonthlyRevenue(organizationId: string, period?: string) {
    return this.finance.getRevenueSeries(organizationId, period);
  }
}

