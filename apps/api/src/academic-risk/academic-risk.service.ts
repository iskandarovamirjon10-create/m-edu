import { computeAttendanceRate } from '../common/attendance-rate';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AcademicRiskQueryDto } from './dto/academic-risk-query.dto';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskFactor {
  factorId: string;
  name: string;
  weight: number;
  score: number;
}

export interface AcademicRiskItem {
  studentId: string;
  studentName: string;
  groupId: string | null;
  groupName: string | null;
  riskLevel: RiskLevel;
  riskScore: number;
  factors: RiskFactor[];
  lastGrade: number | null;
  attendanceRate: number;
  homeworkCompletion: number;
  phone?: string | null;
  parentPhone?: string | null;
  suggestedAction?: string;
}

export interface AcademicRiskSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
  avgScore: number;
}

const WEIGHTS = {
  gradeTrend: 30,
  attendanceRate: 25,
  homeworkCompletion: 20,
  consecutiveAbsences: 15,
  lateSubmissions: 10,
};

@Injectable()
export class AcademicRiskService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(orgId: string): Promise<AcademicRiskSummary> {
    const items = await this.computeAllRisks(orgId);

    if (items.length === 0) {
      return { total: 0, high: 0, medium: 0, low: 0, avgScore: 0 };
    }

    const high = items.filter(i => i.riskLevel === 'HIGH').length;
    const medium = items.filter(i => i.riskLevel === 'MEDIUM').length;
    const low = items.filter(i => i.riskLevel === 'LOW').length;
    const avgScore =
      Math.round((items.reduce((s, i) => s + i.riskScore, 0) / items.length) * 100) / 100;

    return { total: items.length, high, medium, low, avgScore };
  }

  async findAll(
    orgId: string,
    query: AcademicRiskQueryDto,
  ): Promise<{ items: AcademicRiskItem[]; total: number }> {
    let items = await this.computeAllRisks(orgId);

    if (query.riskLevel) {
      items = items.filter(i => i.riskLevel === query.riskLevel);
    }
    if (query.groupId) {
      items = items.filter(i => i.groupId === query.groupId);
    }

    const limit = query.limit ?? 50;
    const page = query.page ?? 1;
    const total = items.length;
    items = items.slice((page - 1) * limit, page * limit);

    return { items, total };
  }

  private async computeAllRisks(orgId: string): Promise<AcademicRiskItem[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const students = await this.prisma.student.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
        groups: {
          where: { isActive: true },
          include: { group: { select: { id: true, name: true } } },
        },
      },
    });

    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        organizationId: orgId,
        date: { gte: thirtyDaysAgo },
      },
      select: { studentId: true, status: true },
    });

    let homeworkRecords: Array<{
      studentId: string;
      isLate: boolean;
      submittedAt: Date | null;
    }> = [];
    try {
      homeworkRecords = await this.prisma.homeworkSubmission.findMany({
        where: {
          organizationId: orgId,
          submittedAt: { gte: thirtyDaysAgo },
        },
        select: {
          studentId: true,
          isLate: true,
          submittedAt: true,
        },
      });
    } catch {
      homeworkRecords = [];
    }

    const absentRecords = await this.prisma.attendance.findMany({
      where: {
        organizationId: orgId,
        status: { in: ['ABSENT', 'EXCUSED'] },
        date: { gte: sixtyDaysAgo },
      },
      orderBy: { date: 'desc' },
      select: { studentId: true, date: true },
    });

    const absentMap = new Map<string, Date[]>();
    for (const r of absentRecords) {
      if (!absentMap.has(r.studentId)) absentMap.set(r.studentId, []);
      const dates = absentMap.get(r.studentId)!;
      if (dates.length < 10) dates.push(r.date);
    }

    const gradeRecords = await this.prisma.grade.findMany({
      where: {
        student: { organizationId: orgId },
        createdAt: { gte: sixtyDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        studentId: true,
        value: true,
        maxValue: true,
        createdAt: true,
      },
    });

    const attendanceMap = new Map<string, { total: number; present: number; absent: number; late: number }>();
    for (const r of attendanceRecords) {
      if (!attendanceMap.has(r.studentId)) {
        attendanceMap.set(r.studentId, { total: 0, present: 0, absent: 0, late: 0 });
      }
      const g = attendanceMap.get(r.studentId)!;
      g.total++;
      if (r.status === 'PRESENT') g.present++;
    }

    const homeworkMap = new Map<
      string,
      { total: number; late: number; submitted: number }
    >();
    for (const r of homeworkRecords) {
      if (!homeworkMap.has(r.studentId)) {
        homeworkMap.set(r.studentId, { total: 0, late: 0, submitted: 0 });
      }
      const g = homeworkMap.get(r.studentId)!;
      g.total++;
      if (r.submittedAt) {
        g.submitted++;
        if (r.isLate) g.late++;
      }
    }

    const gradeMap = new Map<
      string,
      Array<{ value: number; maxValue: number | null; createdAt: Date }>
    >();
    for (const g of gradeRecords) {
      if (!gradeMap.has(g.studentId)) gradeMap.set(g.studentId, []);
      gradeMap.get(g.studentId)!.push(g);
    }

    const items: AcademicRiskItem[] = [];

    for (const student of students) {
      const studentName = `${student.user.firstName} ${student.user.lastName}`;
      const group = student.groups[0]?.group ?? null;
      const groupId = group?.id ?? null;
      const groupName = group?.name ?? null;

      const grades = gradeMap.get(student.id) ?? [];
      const attendanceData = attendanceMap.get(student.id);
      const homeworkData = homeworkMap.get(student.id);

      const lastGrade =
        grades.length > 0 && grades[0].maxValue
          ? Math.round((grades[0].value / grades[0].maxValue) * 100)
          : null;

      const attendanceRate = attendanceData ? (computeAttendanceRate([{ status: 'PRESENT', count: attendanceData.present }, { status: 'ABSENT', count: attendanceData.absent }, { status: 'LATE', count: attendanceData.late }], true) ?? 100) : 100;

      const homeworkCompletion =
        homeworkData && homeworkData.total > 0
          ? Math.round((homeworkData.submitted / homeworkData.total) * 100)
          : 100;

      const consecutiveAbsences = this.calculateConsecutiveAbsences(
        absentMap.get(student.id) ?? [],
      );

      const lateSubmissionRate =
        homeworkData && homeworkData.total > 0
          ? (homeworkData.late / homeworkData.total) * 100
          : 0;

      const gradeTrendScore = this.computeGradeTrend(grades);
      const attendanceScore = attendanceRate;
      const homeworkScore = homeworkCompletion;
      const absencesScore = Math.max(0, 100 - consecutiveAbsences * 20);
      const lateScore = Math.max(0, 100 - lateSubmissionRate * 2);

      const rawScore =
        (gradeTrendScore * WEIGHTS.gradeTrend +
          attendanceScore * WEIGHTS.attendanceRate +
          homeworkScore * WEIGHTS.homeworkCompletion +
          absencesScore * WEIGHTS.consecutiveAbsences +
          lateScore * WEIGHTS.lateSubmissions) /
        100;

      const riskScore = Math.round(rawScore * 100) / 100;
      const riskLevel = this.scoreToLevel(riskScore);

      let suggestedAction = 'Holat barqaror';
      if (riskLevel === 'HIGH') {
        if (consecutiveAbsences >= 3) {
          suggestedAction = '📞 Ota-onasiga shoshilinch qo’ng’iroq (3+ kun kelmadi)';
        } else if (attendanceRate < 70) {
          suggestedAction = '⚠️ Davomat kritik past, 1-on-1 suhbat kerak';
        } else if (gradeTrendScore > 60) {
          suggestedAction = '📖 O’zlashtirish pasaygan, ustoz yordami kerak';
        } else {
          suggestedAction = '🤝 Administrator va mentor bilan uchrashuv';
        }
      } else if (riskLevel === 'MEDIUM') {
        suggestedAction = '👀 Keyingi darslarda faolligini nazoratga olish';
      }

      items.push({
        studentId: student.id,
        studentName,
        groupId,
        groupName,
        riskLevel,
        riskScore,
        factors: [
          { factorId: 'grade-trend', name: 'Grade Trend', weight: WEIGHTS.gradeTrend, score: gradeTrendScore },
          { factorId: 'attendance-rate', name: 'Attendance Rate', weight: WEIGHTS.attendanceRate, score: attendanceScore },
          { factorId: 'homework-completion', name: 'Homework Completion', weight: WEIGHTS.homeworkCompletion, score: homeworkScore },
          { factorId: 'consecutive-absences', name: 'Consecutive Absences', weight: WEIGHTS.consecutiveAbsences, score: absencesScore },
          { factorId: 'late-submissions', name: 'Late Submissions', weight: WEIGHTS.lateSubmissions, score: lateScore },
        ],
        lastGrade,
        attendanceRate,
        homeworkCompletion,
        phone: student.user?.phone ?? null,
        parentPhone: student.parentPhone ?? null,
        suggestedAction,
      });
    }

    items.sort((a, b) => b.riskScore - a.riskScore);
    return items;
  }

  private computeGradeTrend(
    grades: Array<{ value: number; maxValue: number | null; createdAt: Date }>,
  ): number {
    if (grades.length < 2) return 75;

    const sorted = [...grades].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    const recent = sorted.slice(-3);
    const prior = sorted.slice(0, -3).slice(-3);

    if (prior.length === 0) return 75;

    const avgPct = (gs: typeof sorted) => {
      const valid = gs.filter(g => g.maxValue && g.maxValue > 0);
      if (valid.length === 0) return 0;
      return (
        valid.reduce((s, g) => s + g.value / (g.maxValue as number), 0) /
        valid.length
      );
    };

    const recentAvg = avgPct(recent);
    const priorAvg = avgPct(prior);

    const diff = recentAvg - priorAvg;
    const trendScore = 75 + diff * 100;
    return Math.min(100, Math.max(0, Math.round(trendScore)));
  }

  private calculateConsecutiveAbsences(dates: Date[]): number {
    if (dates.length === 0) return 0;

    let consecutive = 0;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (let i = 0; i < dates.length; i++) {
      const expected = new Date(today);
      expected.setDate(today.getDate() - i);
      expected.setUTCHours(0, 0, 0, 0);

      const recDate = new Date(dates[i]);
      recDate.setUTCHours(0, 0, 0, 0);

      const diffDays = Math.abs(
        (expected.getTime() - recDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays <= 3) {
        consecutive++;
      } else {
        break;
      }
    }

    return consecutive;
  }

  private scoreToLevel(score: number): RiskLevel {
    if (score >= 70) return 'LOW';
    if (score >= 40) return 'MEDIUM';
    return 'HIGH';
  }
}







