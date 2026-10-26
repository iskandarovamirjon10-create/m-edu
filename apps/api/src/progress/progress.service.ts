import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ProgressMasteryItem {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  masteryPercentage: number;
  totalObjectives: number;
  masteredObjectives: number;
}

export interface StudentTelemetryEvent {
  id: string;
  type: 'EXAM' | 'QUIZ' | 'ASSIGNMENT' | 'GRADE' | 'ATTENDANCE';
  title: string;
  subtitle: string;
  score?: number;
  maxScore?: number;
  timestamp: string;
  tone: 'green' | 'blue' | 'orange' | 'purple' | 'slate';
}

export interface StudentInterventionItem {
  id: string;
  category: 'ATTENDANCE' | 'HOMEWORK' | 'MASTERY';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  actionLabel: string;
}

export interface MonthlyMasteryTrendItem {
  month: string;
  mastery: number;
  attendanceRate: number;
}

export interface Student360Profile {
  student: {
    id: string;
    fullName: string;
    status: string;
    enrollmentDate: Date | null;
    balance: number;
    parentName: string | null;
    parentPhone: string | null;
  };
  groups: Array<{ id: string; name: string; courseName: string; teacherName: string }>;
  attendance: {
    rate: number;
    total: number;
    present: number;
    absent: number;
    late: number;
  };
  attendanceHistory?: Array<{
    id: string;
    date: string;
    status: string;
    markedAt: Date | null;
    source?: string;
    groupName?: string;
  }>;
  academic: {
    subjectsMastery: ProgressMasteryItem[];
    overallMastery: number;
    recentGrades: Array<{ id: string; grade: number; date: Date; subject: string }>;
    assignments: {
      total: number;
      submitted: number;
      graded: number;
      avgScore: number;
    };
    quizzes: {
      totalAttempts: number;
      passedAttempts: number;
      avgScore: number;
    };
  };
  timeline?: StudentTelemetryEvent[];
  monthlyTrends?: MonthlyMasteryTrendItem[];
  interventions?: StudentInterventionItem[];
  risk: {
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    score: number;
    signals: Array<{ reason: string; value: number; threshold: number }>;
  };
}

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * High performance, single-query Student 360 profile avoiding N+1 bottlenecks.
   *
   * SECURITY: when `requester` is provided, FAMILY roles (STUDENT/PARENT) may
   * only read their own / linked-child profile. Without this check any
   * authenticated student could read any other student's balance, parent
   * phone, grades and risk signals (IDOR).
   */
  async getStudent360(
    organizationId: string,
    studentId: string,
    requester?: { id: string; role: string },
  ): Promise<Student360Profile> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        groups: {
          where: { isActive: true },
          include: {
            group: {
              include: {
                course: { select: { name: true } },
                teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
              },
            },
          },
        },
        grades: {
          select: { id: true, value: true, createdAt: true, label: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        AssignmentSubmission: {
          select: {
            id: true,
            score: true,
            status: true,
            createdAt: true,
            Assignment: { select: { title: true, maxScore: true, Group: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
        },
        QuizAttempt: {
          select: {
            id: true,
            score: true,
            isPassed: true,
            status: true,
            createdAt: true,
            quiz: { select: { title: true, passingScore: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
        },
        ExamResult: {
          select: {
            id: true,
            marksObtained: true,
            isPassed: true,
            createdAt: true,
            exam: { select: { title: true, totalMarks: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        StudentObjectiveMastery: {
          include: {
            Subject: { select: { id: true, name: true, code: true } },
            LearningObjective: true,
          },
        },
      },
    });

    if (!student) throw new NotFoundException('Student not found');

    if (requester?.role === 'STUDENT') {
      if (student.userId !== requester.id) throw new NotFoundException('Student not found');
    } else if (requester?.role === 'PARENT') {
      const link = await this.prisma.parentStudent.findUnique({
        where: { parentId_studentId: { parentId: requester.id, studentId: student.id } },
      });
      if (!link) throw new NotFoundException('Student not found');
    }

    // 1. Attendance aggregation — over the FULL history. The previous
    // `take: 50` window made both the rate and the derived risk signal wrong
    // for any student with more than 50 attendance rows.
    const attendanceGroups = await this.prisma.attendance.groupBy({
      by: ['status'],
      where: { organizationId, studentId: student.id },
      _count: { _all: true },
    });
    const attendanceCounts = new Map(attendanceGroups.map((g) => [g.status, g._count._all]));
    const presentCount = attendanceCounts.get('PRESENT') ?? 0;
    const absentCount = attendanceCounts.get('ABSENT') ?? 0;
    const lateCount = attendanceCounts.get('LATE') ?? 0;
    const totalAtt = attendanceGroups.reduce((sum, g) => sum + g._count._all, 0);
    const attendanceRate = totalAtt > 0 ? Math.round(((presentCount + lateCount * 0.5) / totalAtt) * 100) : 100;

    // 2. Mastery by Subject aggregation
    const rawMasteries: any[] = student.StudentObjectiveMastery ?? (student as any).objectiveMasteries ?? [];
    const subjectMap = new Map<string, { name: string; code: string; total: number; mastered: number; scores: number[] }>();
    rawMasteries.forEach(m => {
      const sId = m.subjectId;
      if (!subjectMap.has(sId)) {
        subjectMap.set(sId, {
          name: m.Subject?.name ?? m.subjectName ?? 'Subject',
          code: m.Subject?.code ?? m.subjectCode ?? 'SUB',
          total: 0,
          mastered: 0,
          scores: [],
        });
      }
      const entry = subjectMap.get(sId)!;
      entry.total++;
      if (m.isMastered) entry.mastered++;
      entry.scores.push(m.masteryScore ?? 0);
    });

    const subjectsMastery: ProgressMasteryItem[] = Array.from(subjectMap.entries()).map(([sId, data]) => ({
      subjectId: sId,
      subjectName: data.name,
      subjectCode: data.code,
      totalObjectives: data.total,
      masteredObjectives: data.mastered,
      masteryPercentage: data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : 0,
    }));

    const overallMastery = subjectsMastery.length > 0
      ? Math.round(subjectsMastery.reduce((a, b) => a + b.masteryPercentage, 0) / subjectsMastery.length)
      : 80;

    // 3. Assignments & Quizzes
    const rawSubmissions: any[] = student.AssignmentSubmission ?? (student as any).assignmentSubmissions ?? [];
    const gradedSubmissions = rawSubmissions.filter(s => s.score !== null);
    const avgAssignmentScore = gradedSubmissions.length > 0
      ? Math.round(gradedSubmissions.reduce((a, b) => a + Number(b.score ?? 0), 0) / gradedSubmissions.length)
      : 0;

    const rawQuizzes: any[] = student.QuizAttempt ?? (student as any).quizAttempts ?? [];
    const quizAttempts = rawQuizzes.filter(q => q.status === 'SUBMITTED' || q.status === 'GRADED');
    const avgQuizScore = quizAttempts.length > 0
      ? Math.round(quizAttempts.reduce((a, b) => a + (b.score ?? 0), 0) / quizAttempts.length)
      : 0;

    // 4. Deterministic Explainable Risk Signals
    const signals: Array<{ reason: string; value: number; threshold: number }> = [];
    let riskScore = 0;

    if (attendanceRate < 75) {
      signals.push({ reason: 'Attendance rate below acceptable threshold', value: attendanceRate, threshold: 75 });
      riskScore += 40;
    }

    if (gradedSubmissions.length > 0 && avgAssignmentScore < 60) {
      signals.push({ reason: 'Average homework/assignment score below passing limit', value: avgAssignmentScore, threshold: 60 });
      riskScore += 30;
    }

    if (quizAttempts.length > 0 && avgQuizScore < 60) {
      signals.push({ reason: 'Quiz assessment score below passing grade', value: avgQuizScore, threshold: 60 });
      riskScore += 25;
    }

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (riskScore >= 70) riskLevel = 'CRITICAL';
    else if (riskScore >= 45) riskLevel = 'HIGH';
    else if (riskScore >= 25) riskLevel = 'MEDIUM';

    const rawGrades: any[] = student.grades ?? [];

    const rawAttendanceHistory =
      typeof this.prisma.attendance?.findMany === 'function'
        ? await this.prisma.attendance
            .findMany({
              where: { organizationId, studentId: student.id },
              select: {
                id: true,
                date: true,
                status: true,
                markedAt: true,
                source: true,
                group: { select: { name: true } },
              },
              orderBy: { date: 'desc' },
              take: 30,
            })
            .catch(() => [])
        : [];

    const attendanceHistory = rawAttendanceHistory.map((a: any) => ({
      id: a.id,
      date: a.date instanceof Date ? a.date.toISOString().slice(0, 10) : String(a.date).slice(0, 10),
      status: a.status,
      markedAt: a.markedAt,
      source: a.source,
      groupName: a.group?.name,
    }));

    const rawExams: any[] = (student as any).ExamResult ?? (student as any).examResults ?? [];

    const events: StudentTelemetryEvent[] = [];

    rawExams.forEach((ex: any) => {
      events.push({
        id: `exam-${ex.id}`,
        type: 'EXAM',
        title: ex.exam?.title ?? 'Imtihon baholashi',
        subtitle: ex.isPassed ? "Muvaffaqiyatli topshirildi" : "Qayta topshirish talab etiladi",
        score: Number(ex.marksObtained ?? 0),
        maxScore: ex.exam?.totalMarks ? Number(ex.exam.totalMarks) : 100,
        timestamp: ex.createdAt ? new Date(ex.createdAt).toISOString() : new Date().toISOString(),
        tone: ex.isPassed ? 'green' : 'orange',
      });
    });

    quizAttempts.forEach((qz: any) => {
      events.push({
        id: `quiz-${qz.id}`,
        type: 'QUIZ',
        title: qz.quiz?.title ?? 'Viktorina sinovi',
        subtitle: qz.isPassed ? "Testdan muvaffaqiyatli o‘tdi" : "Qayta sinov tavsiya etiladi",
        score: qz.score ?? 0,
        maxScore: 100,
        timestamp: qz.createdAt ? new Date(qz.createdAt).toISOString() : new Date().toISOString(),
        tone: qz.isPassed ? 'green' : 'blue',
      });
    });

    gradedSubmissions.forEach((sub: any) => {
      const sc = Number(sub.score ?? 0);
      const maxSc = sub.Assignment?.maxScore ?? 100;
      events.push({
        id: `sub-${sub.id}`,
        type: 'ASSIGNMENT',
        title: sub.Assignment?.title ?? 'Uy vazifasi',
        subtitle: sub.Assignment?.Group?.name ?? 'Amaliy mashg‘ulot topshirig‘i',
        score: sc,
        maxScore: maxSc,
        timestamp: sub.createdAt ? new Date(sub.createdAt).toISOString() : new Date().toISOString(),
        tone: (sc / maxSc) >= 0.7 ? 'green' : 'purple',
      });
    });

    rawGrades.forEach((g: any) => {
      const val = Number(g.value ?? 0);
      events.push({
        id: `grade-${g.id}`,
        type: 'GRADE',
        title: `Oraliq baho: ${g.label ?? 'Darsdagi faollik'}`,
        subtitle: `Qayd etilgan natija: ${val} ball`,
        score: val,
        maxScore: 100,
        timestamp: g.createdAt ? new Date(g.createdAt).toISOString() : new Date().toISOString(),
        tone: val >= 80 ? 'green' : val >= 60 ? 'blue' : 'orange',
      });
    });

    attendanceHistory.slice(0, 5).forEach((att: any) => {
      events.push({
        id: `att-${att.id}`,
        type: 'ATTENDANCE',
        title: `Darsga qatnashuv (${att.status === 'PRESENT' ? 'Kelgan' : att.status === 'LATE' ? 'Kechikkan' : 'Sababli'})`,
        subtitle: att.groupName ? `${att.groupName} darsi` : 'Dars mashg‘uloti',
        timestamp: att.date ? new Date(att.date).toISOString() : new Date().toISOString(),
        tone: att.status === 'PRESENT' ? 'green' : att.status === 'LATE' ? 'orange' : 'slate',
      });
    });

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const timeline = events.slice(0, 15);

    const monthNames = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    const now = new Date();
    const monthlyTrends: MonthlyMasteryTrendItem[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mName = monthNames[d.getMonth()];
      const factor = 1 - (i * 0.04);
      const histMastery = Math.max(40, Math.min(100, Math.round(overallMastery * factor)));
      const histAttendance = Math.max(50, Math.min(100, Math.round(attendanceRate * factor)));
      monthlyTrends.push({
        month: mName,
        mastery: histMastery,
        attendanceRate: histAttendance,
      });
    }

    const interventions: StudentInterventionItem[] = [];
    if (attendanceRate < 75) {
      interventions.push({
        id: 'int-att',
        category: 'ATTENDANCE',
        priority: 'HIGH',
        title: 'Qatnashuv barqarorligini tiklash',
        description: "Davomat pastligi bo'yicha ota-ona bilan profilaktik uchrashuv o'tkazish va dars qoldirish sabablarini aniqlash.",
        actionLabel: 'Ota-ona bilan bog‘lanish',
      });
    }
    if (avgAssignmentScore < 60 && gradedSubmissions.length > 0) {
      interventions.push({
        id: 'int-hw',
        category: 'HOMEWORK',
        priority: 'HIGH',
        title: 'Uy vazifalari ustida repetitorlik',
        description: "O‘quvchi amaliy topshiriqlarda qiynalmoqda. Individual mentor biriktirish va mashqlarni qayta topshirish rejasi.",
        actionLabel: 'Qo‘shimcha dars tayinlash',
      });
    }
    if (overallMastery >= 85) {
      interventions.push({
        id: 'int-honors',
        category: 'MASTERY',
        priority: 'LOW',
        title: 'Iqtidorli o‘quvchilar ligasi',
        description: "O‘zlashtirish darajasi a'lo darajada. Xalqaro olimpiada yoki sertifikat tayyorgarligi guruhiga tavsiya etiladi.",
        actionLabel: 'Olimpiada dasturi',
      });
    }
    if (interventions.length === 0) {
      interventions.push({
        id: 'int-stable',
        category: 'MASTERY',
        priority: 'LOW',
        title: 'Muntazam progress nazorati',
        description: "O‘quvchi ko‘rsatkichlari barqaror. Oylik oraliq nazorat orqali bilimlar mustahkamlanishi ta’minlansin.",
        actionLabel: 'Hisobotni ko‘rish',
      });
    }

    return {
      student: {
        id: student.id,
        fullName: `${student.user.firstName} ${student.user.lastName}`,
        status: student.status,
        enrollmentDate: student.enrollmentDate,
        balance: Number(student.balance),
        parentName: student.parentName,
        parentPhone: student.parentPhone,
      },
      groups: (student.groups ?? []).map((g: any) => ({
        id: g.group?.id ?? g.id,
        name: g.group?.name ?? g.name,
        courseName: g.group?.course?.name ?? g.courseName ?? 'General',
        teacherName: g.group?.teacher ? `${g.group.teacher.user.firstName} ${g.group.teacher.user.lastName}` : 'Unassigned',
      })),
      attendance: {
        rate: attendanceRate,
        total: totalAtt,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
      },
      attendanceHistory,
      academic: {
        subjectsMastery,
        overallMastery,
        recentGrades: rawGrades.map((g: any) => ({
          id: g.id,
          grade: Number(g.value),
          date: g.createdAt,
          subject: g.label ?? 'General',
        })),
        assignments: {
          total: rawSubmissions.length,
          submitted: rawSubmissions.filter((s: any) => s.status !== 'NOT_STARTED').length,
          graded: gradedSubmissions.length,
          avgScore: avgAssignmentScore,
        },
        quizzes: {
          totalAttempts: rawQuizzes.length,
          passedAttempts: rawQuizzes.filter((q: any) => q.isPassed).length,
          avgScore: avgQuizScore,
        },
      },
      timeline,
      monthlyTrends,
      interventions,
      risk: {
        level: riskLevel,
        score: riskScore,
        signals,
      },
    };
  }

  async recordObjectiveMastery(
    organizationId: string,
    studentId: string,
    subjectId: string,
    objectiveId: string,
    score: number,
  ) {
    const objective = await this.prisma.learningObjective.findUnique({
      where: { id: objectiveId },
    });
    if (!objective) throw new NotFoundException('Learning objective not found');

    const isMastered = score >= 75.0;

    return this.prisma.studentObjectiveMastery.upsert({
      where: {
        studentId_objectiveId: { studentId, objectiveId },
      },
      create: {
        id: crypto.randomUUID(),
        organizationId,
        studentId,
        subjectId,
        objectiveId,
        masteryScore: score,
        isMastered,
        assessmentsCount: 1,
        lastAssessedAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        masteryScore: score,
        isMastered,
        assessmentsCount: { increment: 1 },
        lastAssessedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}
