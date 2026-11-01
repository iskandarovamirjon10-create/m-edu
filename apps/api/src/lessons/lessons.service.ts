import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLessonContentDto, UpdateLessonStatusDto } from './lesson.dto';
import { parsePagination } from '../lib/pagination';

export interface LessonQuery {
  page?: string | number;
  limit?: string | number;
  groupId?: string;
  teacherId?: string;
  date?: string;
  status?: string;
}

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: LessonQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: any = { organizationId };

    if (query.groupId) where.groupId = query.groupId;
    if (query.teacherId) {
      where.OR = [
        { teacherId: query.teacherId },
        { teacher: { userId: query.teacherId } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.date) {
      const d = new Date(query.date);
      if (!Number.isNaN(d.getTime())) {
        const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        where.date = { gte: start, lt: end };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.lesson.findMany({
        where,
        include: {
          Group: {
            select: {
              id: true,
              name: true,
              courseId: true,
              room: true,
              course: { select: { id: true, name: true } },
            },
          },
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          Topic: { select: { id: true, title: true } },
          _count: { select: { attendances: true, LessonMaterial: true, Assignment: true } },
        },
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
      }),
      this.prisma.lesson.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / (limit || 1)) };
  }

  async findOne(organizationId: string, id: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, organizationId },
      include: {
        Group: {
          select: {
            id: true,
            name: true,
            courseId: true,
            room: true,
            course: { select: { id: true, name: true } },
            enrollments: {
              where: { isActive: true },
              include: {
                student: {
                  include: {
                    user: { select: { firstName: true, lastName: true, phone: true } },
                  },
                },
              },
            },
          },
        },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        Topic: {
          include: {
            LearningObjective: true,
          },
        },
        LessonMaterial: {
          include: {
            Material: true,
          },
        },
        Assignment: {
          include: {
            _count: { select: { AssignmentSubmission: true } },
          },
        },
        attendances: {
          include: {
            student: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });

    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  async updateStatus(organizationId: string, id: string, dto: UpdateLessonStatusDto) {
    const lesson = await this.findOne(organizationId, id);

    const updateData: any = { status: dto.status };
    if (dto.status === 'CANCELLED') {
      updateData.cancelledAt = new Date();
      updateData.cancelReason = dto.cancelReason ?? 'Cancelled by teacher/administrator';
    } else {
      updateData.cancelledAt = null;
      updateData.cancelReason = null;
    }

    return this.prisma.lesson.update({
      where: { id: lesson.id },
      data: updateData,
    });
  }

  async updateContent(organizationId: string, id: string, dto: UpdateLessonContentDto) {
    const lesson = await this.findOne(organizationId, id);

    if (dto.topicId) {
      // Tenant isolation: only a topic that resolves back to the caller's
      // organization (Topic → CurriculumModule → Curriculum) may be linked.
      // A bare `findUnique({ id })` let one tenant attach another tenant's
      // topic to its own lesson.
      const topic = await this.prisma.topic.findFirst({
        where: {
          id: dto.topicId,
          CurriculumModule: { Curriculum: { organizationId } },
        },
      });
      if (!topic) throw new NotFoundException('Topic not found');
    }

    return this.prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        ...(dto.topicId !== undefined ? { topicId: dto.topicId } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.room !== undefined ? { room: dto.room } : {}),
      },
    });
  }

  async linkMaterial(organizationId: string, lessonId: string, materialId: string) {
    await this.findOne(organizationId, lessonId);

    const material = await this.prisma.material.findFirst({
      where: { id: materialId, organizationId },
    });
    if (!material) throw new NotFoundException('Material not found');

    return this.prisma.lessonMaterial.upsert({
      where: {
        lessonId_materialId: { lessonId, materialId },
      },
      create: { id: crypto.randomUUID(), lessonId, materialId },
      update: {},
    });
  }

  async unlinkMaterial(organizationId: string, lessonId: string, materialId: string) {
    await this.findOne(organizationId, lessonId);

    return this.prisma.lessonMaterial.deleteMany({
      where: { lessonId, materialId },
    });
  }

  async getLessonCopilotAnalysis(organizationId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, organizationId },
      include: {
        Group: {
          include: {
            course: { select: { id: true, name: true } },
            enrollments: {
              where: { isActive: true },
              include: {
                student: {
                  include: {
                    user: { select: { id: true, firstName: true, lastName: true, phone: true } },
                  },
                },
              },
            },
          },
        },
        Topic: {
          select: { id: true, title: true, LearningObjective: true },
        },
        Assignment: {
          include: {
            AssignmentSubmission: {
              select: { studentId: true, score: true, status: true },
            },
          },
        },
        attendances: {
          select: { id: true, studentId: true, status: true, note: true },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const groupId = lesson.groupId;
    const enrolledStudents = lesson.Group?.enrollments ?? [];
    const totalStudents = enrolledStudents.length;

    // Fetch past lessons of this group to calculate historical trends
    const pastLessons = await this.prisma.lesson.findMany({
      where: {
        groupId,
        organizationId,
        id: { not: lessonId },
        date: { lte: lesson.date },
      },
      take: 6,
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
      include: {
        attendances: {
          select: { studentId: true, status: true },
        },
      },
    });

    // Fetch recent group assignments to evaluate homework submission rates
    const pastAssignments = await this.prisma.assignment.findMany({
      where: {
        groupId,
        organizationId,
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        AssignmentSubmission: {
          select: { studentId: true, score: true, status: true },
        },
      },
    });

    // Today's attendance lookup
    const todayAttMap = new Map<string, string>();
    for (const att of lesson.attendances || []) {
      todayAttMap.set(att.studentId, att.status);
    }

    let presentToday = 0;
    let absentToday = 0;
    let lateToday = 0;

    const hasAttendanceData = (lesson.attendances || []).length > 0;
    for (const enr of enrolledStudents) {
      const sid = enr.student?.id || enr.studentId;
      const st = todayAttMap.get(sid);
      if (st === 'PRESENT') presentToday++;
      else if (st === 'ABSENT') absentToday++;
      else if (st === 'LATE') lateToday++;
    }

    const attendanceRateToday =
      hasAttendanceData && totalStudents > 0
        ? Math.round(((presentToday + lateToday) / totalStudents) * 100)
        : 0;

    // Student-level risk & historical aggregation
    const atRiskStudents: Array<{
      studentId: string;
      fullName: string;
      phone: string | null;
      riskType: 'ABSENCE_STREAK' | 'LOW_MASTERY' | 'FREQUENT_LATE';
      level: 'HIGH' | 'MEDIUM' | 'LOW';
      reason: string;
      stats: {
        absenceCount: number;
        absenceStreak: number;
        homeworkAverage: number;
        latesCount: number;
      };
      recommendedIntervention: string;
    }> = [];

    let totalHistoricalAttendances = 0;
    let totalHistoricalPresents = 0;
    const totalHwAssigned = pastAssignments.length * (totalStudents || 1);
    let totalHwSubmitted = 0;

    for (const enr of enrolledStudents) {
      const student = enr.student;
      const sid = student?.id || enr.studentId;
      const fullName = [student?.user?.firstName, student?.user?.lastName].filter(Boolean).join(' ') || "O'quvchi";
      const phone = student?.user?.phone || null;

      let studentPresents = 0;
      let studentAbsents = 0;
      let studentLates = 0;
      let absenceStreak = 0;
      let streakBroken = false;

      for (const pl of pastLessons) {
        const att = pl.attendances.find((a: any) => a.studentId === sid);
        const status = att?.status;
        if (status === 'PRESENT') {
          studentPresents++;
          streakBroken = true;
        } else if (status === 'ABSENT') {
          studentAbsents++;
          if (!streakBroken) absenceStreak++;
        } else if (status === 'LATE') {
          studentLates++;
          streakBroken = true;
        }
        if (att) {
          totalHistoricalAttendances++;
          if (status === 'PRESENT') totalHistoricalPresents++;
        }
      }

      const todayStatus = todayAttMap.get(sid);
      if (todayStatus === 'ABSENT') {
        absenceStreak++;
      }

      let hwSubmissionsCount = 0;
      let hwTotalScore = 0;
      for (const pas of pastAssignments) {
        const sub = pas.AssignmentSubmission.find((s: any) => s.studentId === sid);
        if (sub && (sub.status === 'SUBMITTED' || sub.status === 'GRADED')) {
          hwSubmissionsCount++;
          totalHwSubmitted++;
          const maxScore = pas.maxScore || 100;
          const scoreVal = sub.score !== null && sub.score !== undefined ? (sub.score / maxScore) * 100 : 75;
          hwTotalScore += scoreVal;
        }
      }

      const hwAverage = hwSubmissionsCount > 0 ? Math.round(hwTotalScore / hwSubmissionsCount) : (pastAssignments.length > 0 ? 0 : 80);

      if (absenceStreak >= 2 || (studentAbsents >= 2 && todayStatus === 'ABSENT')) {
        atRiskStudents.push({
          studentId: sid,
          fullName,
          phone,
          riskType: 'ABSENCE_STREAK',
          level: 'HIGH',
          reason: `Oxirgi ${absenceStreak} ta darsda qatnashmagan (surunkali dars qoldirish)`,
          stats: {
            absenceCount: studentAbsents + (todayStatus === 'ABSENT' ? 1 : 0),
            absenceStreak,
            homeworkAverage: hwAverage,
            latesCount: studentLates,
          },
          recommendedIntervention: "Ota-onasi bilan bog'lanib sababini aniqlash va o'tkazib yuborilgan mavzular bo'yicha konsultatsiya belgilash.",
        });
      } else if (pastAssignments.length >= 2 && (hwSubmissionsCount / pastAssignments.length < 0.5 || hwAverage < 60)) {
        atRiskStudents.push({
          studentId: sid,
          fullName,
          phone,
          riskType: 'LOW_MASTERY',
          level: 'MEDIUM',
          reason: `Uy vazifasi topshirish darajasi past (${hwSubmissionsCount}/${pastAssignments.length}) yoki o'rtacha ball < 60%`,
          stats: {
            absenceCount: studentAbsents,
            absenceStreak,
            homeworkAverage: hwAverage,
            latesCount: studentLates,
          },
          recommendedIntervention: "Mavzuni tushunishini mustahkamlash uchun darsda A-darajadagi sodda topshiriq berish va mustaqil yechimini tekshirish.",
        });
      } else if (studentLates >= 2 || todayStatus === 'LATE') {
        atRiskStudents.push({
          studentId: sid,
          fullName,
          phone,
          riskType: 'FREQUENT_LATE',
          level: 'LOW',
          reason: `Darslarga muntazam kechikish holatlari mavjud (${studentLates + (todayStatus === 'LATE' ? 1 : 0)} marta)`,
          stats: {
            absenceCount: studentAbsents,
            absenceStreak,
            homeworkAverage: hwAverage,
            latesCount: studentLates + (todayStatus === 'LATE' ? 1 : 0),
          },
          recommendedIntervention: "Darsga o'z vaqtida kelish muhimligini eslatish va boshlanishdagi warm-up qismiga jalb qilish.",
        });
      }
    }

    const averageHistoricalAttendance = totalHistoricalAttendances > 0
      ? Math.round((totalHistoricalPresents / totalHistoricalAttendances) * 100)
      : 92;

    const homeworkCompletionRate = totalHwAssigned > 0
      ? Math.round((totalHwSubmitted / totalHwAssigned) * 100)
      : 85;

    const groupMasteryIndex = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          averageHistoricalAttendance * 0.4 +
          attendanceRateToday * 0.3 +
          homeworkCompletionRate * 0.3
        )
      )
    );

    const comprehensionStatus =
      groupMasteryIndex >= 85
        ? 'EXCELLENT'
        : groupMasteryIndex >= 65
        ? 'STABLE'
        : 'NEEDS_ATTENTION';

    const rawTopic = lesson.topic || lesson.Topic?.title || lesson.notes || 'Bugungi mavzu';
    const courseName = lesson.Group?.course?.name || lesson.Group?.name || 'Fan kursi';

    const pedagogicalCheckpoints = [
      {
        phase: 'WARM_UP' as const,
        title: "Tezkor Kirish va Diqqatni Jamlash",
        durationMinutes: 7,
        instruction: `${courseName} bo'yicha o'tgan dars bilan bugungi "${rawTopic}" orasidagi bog'liqlikni 2 ta qisqa savol bilan tekshiring.`,
        promptExample: `1) O'tgan darsdagi eng asosiy qoida nima edi? 2) "${rawTopic}" mavzusining amaliy hayotdagi ahamiyati nima?`,
      },
      {
        phase: 'ACTIVE_PRACTICE' as const,
        title: "Interaktiv Amaliy Mashg'ulot & Juftlikda Ishlash",
        durationMinutes: 20,
        instruction: `O'quvchilarni 2 kishilik juftliklarga ajrating. O'zlashtirishda qiynalayotgan o'quvchini kuchliroq sherik bilan juftlang.`,
        promptExample: `"${rawTopic}" ga oid namunaviy misolni birgalikda tahlil qiling va doskaga xulosani yozing.`,
      },
      {
        phase: 'FORMATIVE_CHECK' as const,
        title: "Formativ Baholash & 3 Daqiqalik Mini-Quiz",
        durationMinutes: 10,
        instruction: `Har bir o'quvchining mavzuni o'zlashtirganlik darajasini aniqlash uchun tezkor savol bering.`,
        promptExample: `Tushunganlik darajasi: 🟢 Hammasi tushunarli, 🟡 Ayrim savollar bor, 🔴 Qayta tushuntirish kerak.`,
      },
      {
        phase: 'WRAP_UP' as const,
        title: "Xulosa & Differensial Uy Vazifasi",
        durationMinutes: 8,
        instruction: `Dars yakunida o'quvchilarga o'z darajalariga mos vazifalar belgilang.`,
        promptExample: `A-daraja: Asosiy 3 ta mashq. B-daraja: Mantiqiy 2 ta misol. C-daraja: Kreativ mini-loyiha.`,
      },
    ];

    const differentiatedTasks = [
      {
        tier: 'FOUNDATION' as const,
        targetAudience: "O'zlashtirishi sust yoki dars qoldirgan o'quvchilar uchun (Tier 1)",
        badgeText: "Boshlang'ich (Qo'llab-quvvatlash)",
        taskTitle: `"${rawTopic}" — Asosiy tushunchalar va namunaviy qoidalar`,
        taskPrompt: `Mavzuning 3 ta asosiy terminini daftarga yozing va darslikdagi 1-3 mashqlarni namuna asosida bajaring.`,
        solutionHint: `Darslikdagi 1-misol formulasiga qarang va qiymatlarni o'rniga qo'ying.`,
      },
      {
        tier: 'CORE' as const,
        targetAudience: "Guruhning asosiy o'quvchilari uchun standart talab (Tier 2)",
        badgeText: "Asosiy (Standart)",
        taskTitle: `"${rawTopic}" — Amaliy qo'llash va mustaqil tahlil`,
        taskPrompt: `Berilgan vaziyatli masalani mustaqil yeching va yechim algoritmini qadam-baqadam izohlab bering.`,
        solutionHint: `Avval ma'lum va noma'lum kattaliklarni ajrating, so'ng hisoblash qismini bajaring.`,
      },
      {
        tier: 'ADVANCED' as const,
        targetAudience: "Ilg'or, tez yechuvchi va olimpiada tayyorgarligidagi o'quvchilar (Tier 3)",
        badgeText: "Ilg'or (Challenge)",
        taskTitle: `"${rawTopic}" — Chuqurlashtirilgan muammo va nostandart holat`,
        taskPrompt: `Standart usuldan boshqa muqobil yechim toping va eng optimal variantni asoslab bering.`,
        solutionHint: `Cheklovlarni hisobga oling va ekstremal qiymatlar uchun natijani tekshiring.`,
      },
    ];

    return {
      lessonId: lesson.id,
      topic: rawTopic,
      courseName,
      groupName: lesson.Group?.name || 'Guruh',
      groupMetrics: {
        totalStudents,
        presentToday,
        absentToday,
        lateToday,
        attendanceRateToday,
        averageHistoricalAttendance,
        homeworkCompletionRate,
        groupMasteryIndex,
        comprehensionStatus,
      },
      atRiskStudents,
      pedagogicalCheckpoints,
      differentiatedTasks,
    };
  }
}
