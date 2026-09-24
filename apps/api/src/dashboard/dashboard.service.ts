import { computeAttendanceRate } from '../common/attendance-rate';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(organizationId: string) {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalStudents,
      activeStudents,
      totalTeachers,
      activeGroups,
      paymentStats,
      monthlyRevenue,
      recentPayments,
      leadStats,
      upcomingFollowUps,
      attendanceStats,
    ] = await Promise.all([
      this.prisma.student.count({ where: { organizationId } }),
      this.prisma.student.count({ where: { organizationId, user: { isActive: true } } }),
      this.prisma.teacher.count({ where: { organizationId } }),
      this.prisma.group.count({ where: { organizationId, isActive: true } }),
      this.prisma.payment.groupBy({
        by: ['status'],
        where: { organizationId },
        _sum: { amount: true },
        _count: true,
      }),
      // Cash basis: revenue is grouped by when the payment was actually
      // collected (paidAt), not when the Payment row was created.
      this.prisma.$queryRaw`
        SELECT DATE_TRUNC('month', "paidAt") as month, SUM(amount)::decimal as total, COUNT(*)::int as count
        FROM "Payment"
        WHERE "organizationId" = ${organizationId}::uuid AND status = 'PAID' AND "paidAt" IS NOT NULL
        GROUP BY DATE_TRUNC('month', "paidAt")
        ORDER BY month DESC
        LIMIT 12
      ` as unknown as Array<{ month: Date; total: string | number; count: number }>,
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
    ]);

    const totalPaid = paymentStats.find((s) => s.status === 'PAID')?._sum.amount || 0;
    const totalPending = paymentStats.find((s) => s.status === 'PENDING')?._sum.amount || 0;
    const totalOverdue = paymentStats.find((s) => s.status === 'OVERDUE')?._sum.amount || 0;

    const totalLeads = leadStats.reduce((sum, s) => sum + s._count.stage, 0);
    const wonLeads = leadStats.find((s) => s.stage === 'WON')?._count.stage || 0;

    const newLeadsThisMonth = await this.prisma.lead.count({
      where: { organizationId, createdAt: { gte: thisMonthStart } },
    });

    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

    const totalAttendance = attendanceStats.reduce((sum, s) => sum + s._count.status, 0);
    const presentCount = attendanceStats.find((s) => s.status === 'PRESENT')?._count.status || 0;
    const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

    return {
      totalStudents,
      activeStudents,
      totalTeachers,
      activeGroups,
      // Frontend contract (apps/web DashboardStats): the web UI consumes
      // totalPaid/totalPending/totalOverdue + attendanceStats directly.
      // Legacy aliases (totalRevenue/pendingPayments/overduePayments) are
      // kept so any other consumer of /dashboard/stats does not break.
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
      monthlyRevenue: monthlyRevenue.map((r) => ({
        month: r.month,
        total: Number(r.total),
        count: r.count,
      })),
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

