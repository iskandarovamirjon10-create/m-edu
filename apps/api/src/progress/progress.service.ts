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
          select: { id: true, score: true, status: true },
        },
        QuizAttempt: {
          select: { id: true, score: true, isPassed: true, status: true },
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
