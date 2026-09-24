import { computeAttendanceRate } from '../common/attendance-rate';
import { Injectable } from '@nestjs/common';
import type { StudentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialBrainService } from './financial-brain.service';
import { AnomalyDetectionService } from './anomaly-detection.service';

@Injectable()
export class ExecutiveSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialBrain: FinancialBrainService,
    private readonly anomalyDetection: AnomalyDetectionService,
  ) {}

  async getSummary(organizationId: string) {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(thisMonthStart.getTime() - 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [currentCashFlow, previousCashFlow] = await Promise.all([
      this.financialBrain.getCashFlow(organizationId, thisMonthStart, now),
      this.financialBrain.getCashFlow(organizationId, lastMonthStart, lastMonthEnd),
    ]);

    const currentRevenue = currentCashFlow.inflows.netCashInflow;
    const previousRevenue = previousCashFlow.inflows.netCashInflow;
    const currentExpenses = currentCashFlow.outflows.totalOutflow;
    const previousExpenses = previousCashFlow.outflows.totalOutflow;
    const currentNetCashFlow = currentCashFlow.netCashFlow;
    const previousNetCashFlow = previousCashFlow.netCashFlow;

    const revenueTrend = previousRevenue > 0
      ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
      : null;
    const expenseTrend = previousExpenses > 0
      ? Math.round(((currentExpenses - previousExpenses) / previousExpenses) * 100)
      : null;
    const netCashFlowTrend = previousNetCashFlow !== 0
      ? Math.round(((currentNetCashFlow - previousNetCashFlow) / Math.abs(previousNetCashFlow)) * 100)
      : null;

    const [
      totalStudents,
      newStudentsThisMonth,
      attendanceStats,
      leadStats,
      newLeadsThisMonth,
      convertedLeads,
    ] = await Promise.all([
      this.prisma.student.count({ where: { organizationId } }),
      this.prisma.student.count({
        where: { organizationId, createdAt: { gte: thisMonthStart } },
      }),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { organizationId, date: { gte: thirtyDaysAgo } },
        _count: { status: true },
      }),
      this.prisma.lead.groupBy({
        by: ['stage'],
        where: { organizationId },
        _count: { stage: true },
      }),
      this.prisma.lead.count({
        where: { organizationId, createdAt: { gte: thisMonthStart } },
      }),
      this.prisma.lead.count({
        where: { organizationId, stage: 'WON', updatedAt: { gte: thisMonthStart } },
      }),
    ]);

    const attendanceRate = computeAttendanceRate(attendanceStats, true);

    const totalLeads = leadStats.reduce((sum, s) => sum + s._count.stage, 0);
    const wonLeads = leadStats.find((s) => s.stage === 'WON')?._count.stage || 0;
    const crmConversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : null;

    // Churn = students who LEFT during the month as a share of the students
    // active at the start of that month. The previous formula compared the
    // NEW-student counts of two months — it reported growth deceleration,
    // not churn, so a healthy academy hiring more students every month
    // looked like a 100% "churn" crisis when growth merely plateaued.
    //
    // Real attrition is observed directly on Student.status: anyone who
    // moved to DROPPED (or COMPLETED, which also ends their enrollment)
    // during the current month is a churned student.
    const droppedThisMonth = await this.prisma.student.count({
      where: {
        organizationId,
        status: { in: ['DROPPED', 'COMPLETED'] satisfies StudentStatus[] },
        updatedAt: { gte: thisMonthStart },
      },
    });
    const activeStudents = await this.prisma.student.count({
      where: { organizationId, status: { notIn: ['DROPPED', 'COMPLETED'] satisfies StudentStatus[] } },
    });
    const churnRate = activeStudents + droppedThisMonth > 0
      ? Math.round((droppedThisMonth / (activeStudents + droppedThisMonth)) * 100)
      : null;

    const teacherCount = await this.prisma.teacher.count({ where: { organizationId } });
    const activeGroups = await this.prisma.group.count({ where: { organizationId, isActive: true } });
    const teacherUtilization = teacherCount > 0 && activeGroups > 0
      ? Math.min(100, Math.round((activeGroups / teacherCount) * 100))
      : null;

    let anomalies: Array<{ type: string; message: string; severity: string }> = [];
    try {
      const raw = await this.anomalyDetection.detectAll(organizationId);
      anomalies = raw.slice(0, 5).map((a) => ({
        type: a.type || 'unknown',
        message: a.description || a.title || '',
        severity: a.severity || 'INFO',
      }));
    } catch {
      // Anomaly detection is supplementary intel — a failure must never break
      // the executive summary. Errors are surfaced through the service logs.
      anomalies = [];
    }

    let branchComparison: Array<{
      branchId: string;
      name: string;
      revenue: number;
      students: number;
      attendance: number;
    }> | null = null;
    const branchCount = await this.prisma.branch.count({ where: { organizationId, isActive: true } });
    if (branchCount > 1) {
      const branches = await this.prisma.branch.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true },
      });

      branchComparison = await Promise.all(
        branches.map(async (branch) => {
          const [branchRevenue, branchStudents, branchAttendance] = await Promise.all([
            this.prisma.payment.aggregate({
              where: {
                organizationId,
                student: { branchId: branch.id },
                status: 'PAID',
                paidAt: { gte: thisMonthStart, lte: now },
              },
              _sum: { amount: true },
            }),
            this.prisma.student.count({
              where: { organizationId, branchId: branch.id },
            }),
            this.prisma.attendance.groupBy({
              by: ['status'],
              where: {
                organizationId,
                student: { branchId: branch.id },
                date: { gte: thirtyDaysAgo },
              },
              _count: { status: true },
            }),
          ]);

          const total = branchAttendance.reduce((s, a) => s + a._count.status, 0);
          const present = branchAttendance.find((a) => a.status === 'PRESENT')?._count.status || 0;
          const att = total > 0 ? Math.round((present / total) * 100) : 0;

          return {
            branchId: branch.id,
            name: branch.name,
            revenue: Number(branchRevenue._sum.amount || 0),
            students: branchStudents,
            attendance: att,
          };
        }),
      );
    }

    return {
      revenue: {
        current: currentRevenue,
        previous: previousRevenue,
        trend: revenueTrend,
      },
      expenses: {
        current: currentExpenses,
        previous: previousExpenses,
        trend: expenseTrend,
      },
      netCashFlow: {
        current: currentNetCashFlow,
        previous: previousNetCashFlow,
        trend: netCashFlowTrend,
      },
      studentGrowth: {
        total: totalStudents,
        newThisMonth: newStudentsThisMonth,
        churnRate,
        churnedThisMonth: droppedThisMonth,
      },
      attendanceRate: {
        overall: attendanceRate,
        trend: null,
      },
      teacherUtilization: {
        average: teacherUtilization,
        topPerformers: null,
      },
      crmConversion: {
        leadsThisMonth: newLeadsThisMonth,
        converted: convertedLeads,
        rate: crmConversionRate,
      },
      topAlerts: anomalies,
      branchComparison,
    };
  }
}

