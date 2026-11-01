import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  ChurnRiskTier,
  RecordInterventionDto,
  RetentionQueryDto,
} from './dto/student-retention.dto';

export interface StudentChurnProfile {
  studentId: string;
  studentName: string;
  phoneNumber?: string | null;
  groupNames: string[];
  riskScore: number; // 0 - 100
  riskTier: ChurnRiskTier;
  monthlyRevenueUz: number;
  primaryRiskFactor: string;
  recommendedPlaybook: string;
  metrics: {
    recentAttendanceRate: number; // last 14 days %
    unexcusedAbsences: number;
    overdueDebtAmount: number;
    academicAvgScore: number;
    homeworkCompletionRate: number;
  };
}

export interface RetentionCockpitSummary {
  totalActiveStudents: number;
  criticalRiskCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  atRiskRevenueMonthlyUz: number;
  averageHealthScore: number;
  topRiskDrivers: { factor: string; count: number; percentage: number }[];
  students: StudentChurnProfile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class StudentRetentionService {
  private readonly logger = new Logger(StudentRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Retrieves high-level retention cockpit summary and at-risk student roster.
   */
  async getRetentionCockpit(
    organizationId: string,
    query: RetentionQueryDto,
  ): Promise<RetentionCockpitSummary> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));

    // Fetch active students with academic, attendance, and financial context
    const students = await this.prisma.student.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        ...(query.groupId
          ? {
              groups: {
                some: { groupId: query.groupId, isActive: true },
              },
            }
          : {}),
      },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
        groups: {
          where: { isActive: true },
          include: {
            group: {
              select: {
                id: true,
                name: true,
                course: { select: { price: true } },
              },
            },
          },
        },
        attendance: {
          where: {
            date: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // last 30 days
            },
          },
          select: { status: true, date: true },
        },
        grades: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
            },
          },
          select: { value: true },
        },
        Invoice: {
          where: {
            status: { in: ['ISSUED', 'OVERDUE', 'PARTIALLY_PAID'] },
          },
          select: { total: true, paidAmount: true, dueDate: true },
        },
      },
    });

    const evaluatedProfiles: StudentChurnProfile[] = [];
    const factorCounts: Record<string, number> = {
      ATTENDANCE_DROP: 0,
      FINANCIAL_OVERDUE: 0,
      ACADEMIC_STRUGGLE: 0,
      HOMEWORK_NEGLECT: 0,
    };

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let atRiskRevenue = 0;
    let totalScoreSum = 0;

    const now = Date.now();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

    for (const student of students) {
      // 1. Attendance Analysis
      const recentAttendances = (student.attendance || []).filter(
        (a) => new Date(a.date) >= fourteenDaysAgo,
      );
      const recentTotal = recentAttendances.length;
      const recentPresent = recentAttendances.filter(
        (a) => a.status === 'PRESENT' || a.status === 'LATE',
      ).length;
      const unexcusedAbsences = recentAttendances.filter(
        (a) => a.status === 'ABSENT',
      ).length;

      const recentAttendanceRate =
        recentTotal > 0 ? Math.round((recentPresent / recentTotal) * 100) : 100;

      // 2. Financial Analysis
      let overdueDebtAmount = 0;
      for (const inv of student.Invoice || []) {
        const remaining = Number(inv.total) - Number(inv.paidAmount ?? 0);
        if (remaining > 0 && inv.dueDate && new Date(inv.dueDate) < new Date()) {
          overdueDebtAmount += remaining;
        }
      }
      if (Number(student.balance) < 0) {
        overdueDebtAmount += Math.abs(Number(student.balance));
      }

      // 3. Academic Grade Analysis
      const recentGrades = (student.grades || []).map((g) => Number(g.value)).filter(Number.isFinite);
      const academicAvgScore =
        recentGrades.length > 0
          ? Math.round(recentGrades.reduce((a, b) => a + b, 0) / recentGrades.length)
          : 85;

      // Estimate monthly revenue for this student
      let monthlyRevenue = 0;
      const groupNames: string[] = [];
      for (const sg of student.groups || []) {
        groupNames.push(sg.group.name);
        monthlyRevenue += Number(sg.group.course?.price ?? 0);
      }

      // Compute weighted Risk Score (0 to 100)
      let riskScore = 0;
      const primaryDriverList: { factor: string; points: number }[] = [];

      // Attendance degradation weight: max 40 points
      if (recentAttendanceRate < 50) {
        riskScore += 40;
        primaryDriverList.push({ factor: 'ATTENDANCE_DROP', points: 40 });
        factorCounts.ATTENDANCE_DROP++;
      } else if (recentAttendanceRate < 70) {
        riskScore += 25;
        primaryDriverList.push({ factor: 'ATTENDANCE_DROP', points: 25 });
        factorCounts.ATTENDANCE_DROP++;
      } else if (recentAttendanceRate < 85) {
        riskScore += 12;
      }

      if (unexcusedAbsences >= 3) {
        riskScore += 10;
      }

      // Financial overdue friction weight: max 35 points
      if (overdueDebtAmount > 500_000) {
        riskScore += 35;
        primaryDriverList.push({ factor: 'FINANCIAL_OVERDUE', points: 35 });
        factorCounts.FINANCIAL_OVERDUE++;
      } else if (overdueDebtAmount > 0) {
        riskScore += 20;
        primaryDriverList.push({ factor: 'FINANCIAL_OVERDUE', points: 20 });
        factorCounts.FINANCIAL_OVERDUE++;
      }

      // Academic struggle weight: max 25 points
      if (academicAvgScore < 55) {
        riskScore += 25;
        primaryDriverList.push({ factor: 'ACADEMIC_STRUGGLE', points: 25 });
        factorCounts.ACADEMIC_STRUGGLE++;
      } else if (academicAvgScore < 70) {
        riskScore += 15;
      }

      riskScore = Math.min(100, Math.max(0, riskScore));
      totalScoreSum += 100 - riskScore;

      // Determine Tier
      let riskTier: ChurnRiskTier = 'LOW';
      if (riskScore >= 75) {
        riskTier = 'CRITICAL';
        criticalCount++;
        atRiskRevenue += monthlyRevenue;
      } else if (riskScore >= 55) {
        riskTier = 'HIGH';
        highCount++;
        atRiskRevenue += monthlyRevenue;
      } else if (riskScore >= 30) {
        riskTier = 'MEDIUM';
        mediumCount++;
      } else {
        lowCount++;
      }

      // Determine primary human-readable driver
      primaryDriverList.sort((a, b) => b.points - a.points);
      const topDriver = primaryDriverList[0]?.factor;
      let primaryRiskFactor = 'Barqaror o‘qish jarayoni';
      let recommendedPlaybook = 'Muntazam monitoring';

      if (topDriver === 'ATTENDANCE_DROP') {
        primaryRiskFactor = `Davomat keskin pasayishi (${recentAttendanceRate}%)`;
        recommendedPlaybook = 'Ota-ona bilan bog‘lanish va dars jadvalini qayta ko‘rib chiqish';
      } else if (topDriver === 'FINANCIAL_OVERDUE') {
        primaryRiskFactor = `To‘lov kechikishi (${overdueDebtAmount.toLocaleString()} UZS)`;
        recommendedPlaybook = 'Bo‘lib to‘lash yoki sodiqlik chegirmasi taklif qilish';
      } else if (topDriver === 'ACADEMIC_STRUGGLE') {
        primaryRiskFactor = `O‘zlashtirish pasayishi (O‘rtacha ${academicAvgScore} ball)`;
        recommendedPlaybook = 'Bepul 1-ga-1 mentorlik yoki repetitorlik sessiyasini tayinlash';
      }

      evaluatedProfiles.push({
        studentId: student.id,
        studentName: `${student.user.firstName} ${student.user.lastName}`.trim(),
        phoneNumber: student.user.phone || student.parentPhone,
        groupNames,
        riskScore,
        riskTier,
        monthlyRevenueUz: monthlyRevenue,
        primaryRiskFactor,
        recommendedPlaybook,
        metrics: {
          recentAttendanceRate,
          unexcusedAbsences,
          overdueDebtAmount,
          academicAvgScore,
          homeworkCompletionRate: 85,
        },
      });
    }

    // Sort by riskScore descending
    evaluatedProfiles.sort((a, b) => b.riskScore - a.riskScore);

    // Apply tier filter if requested
    const filtered = query.tier
      ? evaluatedProfiles.filter((p) => p.riskTier === query.tier)
      : evaluatedProfiles;

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    // Top drivers chart calculation
    const totalDriverIssues = Object.values(factorCounts).reduce((a, b) => a + b, 0) || 1;
    const topRiskDrivers = [
      {
        factor: 'Davomatning susayishi (Absences)',
        count: factorCounts.ATTENDANCE_DROP,
        percentage: Math.round((factorCounts.ATTENDANCE_DROP / totalDriverIssues) * 100),
      },
      {
        factor: 'Moliyaviy qarzdorlik (Overdue Invoices)',
        count: factorCounts.FINANCIAL_OVERDUE,
        percentage: Math.round((factorCounts.FINANCIAL_OVERDUE / totalDriverIssues) * 100),
      },
      {
        factor: 'Akademik o‘zlashtirish qiyinchiligi (Grades)',
        count: factorCounts.ACADEMIC_STRUGGLE,
        percentage: Math.round((factorCounts.ACADEMIC_STRUGGLE / totalDriverIssues) * 100),
      },
    ].sort((a, b) => b.count - a.count);

    const averageHealthScore =
      students.length > 0 ? Math.round(totalScoreSum / students.length) : 100;

    return {
      totalActiveStudents: students.length,
      criticalRiskCount: criticalCount,
      highRiskCount: highCount,
      mediumRiskCount: mediumCount,
      lowRiskCount: lowCount,
      atRiskRevenueMonthlyUz: atRiskRevenue,
      averageHealthScore,
      topRiskDrivers,
      students: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Executes and records a formal retention intervention (e.g. director call, free mentoring, discount).
   */
  async recordIntervention(
    organizationId: string,
    studentId: string,
    actorId: string,
    dto: RecordInterventionDto,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    if (!student) {
      throw new NotFoundException(`Student ${studentId} not found in this organization`);
    }

    const actionText = `[Retention Playbook: ${dto.type}] ${dto.notes}`;
    const followUpDate = dto.followUpDays
      ? new Date(Date.now() + dto.followUpDays * 24 * 60 * 60 * 1000)
      : null;

    // Log in persistent Audit Log for executive tracking
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'RETENTION_INTERVENTION',
      resource: 'Student',
      resourceId: studentId,
      changes: {
        intervention: {
          old: null,
          new: {
            type: dto.type,
            notes: dto.notes,
            promisedOutcome: dto.promisedOutcome,
            followUpDate,
            studentName: `${student.user.firstName} ${student.user.lastName}`,
          },
        },
      },
    });

    // Append to student internal notes
    const timestamp = new Date().toISOString().slice(0, 10);
    const updatedNotes = student.notes
      ? `${student.notes}\n[${timestamp}] ${actionText}`
      : `[${timestamp}] ${actionText}`;

    await this.prisma.student.update({
      where: { id: studentId },
      data: { notes: updatedNotes },
    });

    this.logger.log(
      `Retention intervention [${dto.type}] successfully recorded for student [${studentId}] by user [${actorId}]`,
    );

    return {
      success: true,
      studentId,
      type: dto.type,
      recordedAt: new Date(),
      followUpDate,
      message: 'Intervention successfully registered and attached to student dossier.',
    };
  }
}
