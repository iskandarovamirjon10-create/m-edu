import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(organizationId: string) {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalStudents,
      newStudentsThisMonth,
      newStudentsLastMonth,
      totalTeachers,
      activeGroups,
      revenueStats,
      monthlyRevenue,
      attendanceStats,
      dailyAttendance,
      leadStats,
    ] = await Promise.all([
      this.prisma.student.count({ where: { organizationId } }),
      this.prisma.student.count({
        where: { organizationId, createdAt: { gte: thisMonthStart } },
      }),
      this.prisma.student.count({
        where: { organizationId, createdAt: { gte: lastMonthStart, lt: thisMonthStart } },
      }),
      this.prisma.teacher.count({ where: { organizationId } }),
      this.prisma.group.count({ where: { organizationId, isActive: true } }),
      this.prisma.payment.aggregate({
        where: { organizationId, status: 'PAID' },
        _sum: { amount: true },
      }),
      this.prisma.$queryRaw`
        SELECT DATE_TRUNC('month', "createdAt") as month, SUM(amount)::decimal as total
        FROM "Payment"
        WHERE "organizationId" = ${organizationId}::uuid AND status = 'PAID'
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month DESC
        LIMIT 12
      ` as unknown as { month: Date; total: string }[],
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { organizationId, date: { gte: thirtyDaysAgo } },
        _count: { status: true },
      }),
      this.prisma.$queryRaw`
        SELECT date, status, COUNT(*)::int as count
        FROM "Attendance"
        WHERE "organizationId" = ${organizationId}::uuid AND date >= ${thirtyDaysAgo}
        GROUP BY date, status
        ORDER BY date DESC
        LIMIT 30
      ` as unknown as { date: Date; status: string; count: number }[],
      this.prisma.lead.groupBy({
        by: ['stage'],
        where: { organizationId },
        _count: { stage: true },
      }),
    ]);

    const totalLeads = leadStats.reduce((sum, s) => sum + s._count.stage, 0);
    const wonLeads = leadStats.find((s) => s.stage === 'WON')?._count.stage || 0;
    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

    const totalAttendance = attendanceStats.reduce((sum, s) => sum + s._count.status, 0);
    const presentCount = attendanceStats.find((s) => s.status === 'PRESENT')?._count.status || 0;
    const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

    const studentGrowth =
      newStudentsLastMonth > 0
        ? Math.round(((newStudentsThisMonth - newStudentsLastMonth) / newStudentsLastMonth) * 100)
        : newStudentsThisMonth > 0
          ? 100
          : 0;

    return {
      students: {
        total: totalStudents,
        newThisMonth: newStudentsThisMonth,
        growth: studentGrowth,
      },
      teachers: {
        total: totalTeachers,
        activeGroups,
      },
      revenue: {
        total: Number(revenueStats._sum.amount || 0),
        monthly: monthlyRevenue.map((r) => ({
          month: r.month,
          total: Number(r.total),
        })),
      },
      attendance: {
        rate: attendanceRate,
        // The raw query returns one row per (date, status); collapse into a
        // single row per date so charts get exactly one point per day.
        daily: (() => {
          const byDate = new Map<string, { present: number; absent: number; late: number; excused: number }>();
          for (const r of dailyAttendance) {
            const key = r.date.toISOString().slice(0, 10);
            const entry = byDate.get(key) ?? { present: 0, absent: 0, late: 0, excused: 0 };
            if (r.status === 'PRESENT') entry.present += r.count;
            else if (r.status === 'ABSENT') entry.absent += r.count;
            else if (r.status === 'LATE') entry.late += r.count;
            else if (r.status === 'EXCUSED') entry.excused += r.count;
            byDate.set(key, entry);
          }
          return Array.from(byDate.entries()).map(([date, counts]) => ({ date, ...counts }));
        })(),
      },
      leads: {
        total: totalLeads,
        conversionRate,
        byStage: leadStats.map((s) => ({
          stage: s.stage,
          count: s._count.stage,
        })),
      },
    };
  }
}
