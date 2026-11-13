import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { TeachersService } from '../../../teachers/teachers.service';
import type { TeacherQuery } from '../../../common/dto/query';
import type { PrismaService } from '../../../prisma/prisma.service';

const listSchema = z.object({
  search: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

const workloadSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
});

/** Minutes between two `HH:MM` strings; 0 when malformed. */
function lessonMinutes(start: string, end: string): number {
  const parse = (value: string): number | null => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };
  const from = parse(start);
  const to = parse(end);
  if (from === null || to === null || to <= from) return 0;
  return to - from;
}

export function createTeachersTools(
  teachers: TeachersService,
  prisma: PrismaService,
): AiToolDefinition[] {
  return [
    {
      name: 'teachers.list',
      description:
        'List teachers in the current organization, optionally filtered by name or email. Returns a bounded list and total count.',
      inputSchema: listSchema,
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.TEACHERS_READ,
      execute: async (input: z.infer<typeof listSchema>, context) => {
        const query = {
          search: input.search,
          ...(input.limit ? { limit: String(input.limit) } : {}),
        } as TeacherQuery;

        const result = await teachers.findAll(context.organizationId, query);
        return {
          total: result.total,
          teachers: result.items.slice(0, input.limit ?? 10).map((item) => ({
            id: item.id,
            firstName: item.user?.firstName ?? '',
            lastName: item.user?.lastName ?? '',
            groupCount: item._count?.groups ?? item.groups?.length ?? 0,
          })),
        };
      },
    },
    {
      name: 'teachers.workload',
      description:
        'Teaching load per teacher: active groups, students, weekly lesson hours and 30-day attendance rate. Use it for workload, capacity and distribution questions.',
      inputSchema: workloadSchema,
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.TEACHERS_READ,
      execute: async (input: z.infer<typeof workloadSchema>, context) => {
        const limit = input.limit ?? 20;
        const since = new Date();
        since.setDate(since.getDate() - 30);

        const rows = await prisma.teacher.findMany({
          where: { organizationId: context.organizationId },
          include: {
            user: { select: { firstName: true, lastName: true } },
            groups: {
              select: {
                id: true,
                _count: { select: { enrollments: true } },
                schedules: { select: { startTime: true, endTime: true } },
              },
            },
          },
          take: limit,
        });

        const groupIds = rows.flatMap((teacher) =>
          teacher.groups.map((group) => group.id),
        );

        const attendanceByGroup = groupIds.length
          ? await prisma.attendance.groupBy({
              by: ['groupId', 'status'],
              where: {
                organizationId: context.organizationId,
                groupId: { in: groupIds },
                date: { gte: since },
              },
              _count: { status: true },
            })
          : [];

        const attendanceMap = new Map<string, { total: number; present: number }>();
        for (const row of attendanceByGroup) {
          const entry = attendanceMap.get(row.groupId) ?? {
            total: 0,
            present: 0,
          };
          entry.total += row._count.status;
          if (row.status === 'PRESENT' || row.status === 'LATE') {
            entry.present += row._count.status;
          }
          attendanceMap.set(row.groupId, entry);
        }

        let totalHours = 0;
        let totalStudents = 0;
        let attendanceTotal = 0;
        let attendancePresent = 0;

        const items = rows.map((teacher) => {
          const weeklyMinutes = teacher.groups.reduce(
            (sum, group) =>
              sum +
              group.schedules.reduce(
                (minutes, lesson) =>
                  minutes + lessonMinutes(lesson.startTime, lesson.endTime),
                0,
              ),
            0,
          );
          const studentsCount = teacher.groups.reduce(
            (sum, group) => sum + (group._count?.enrollments ?? 0),
            0,
          );

          let teacherTotal = 0;
          let teacherPresent = 0;
          for (const group of teacher.groups) {
            const entry = attendanceMap.get(group.id);
            if (!entry) continue;
            teacherTotal += entry.total;
            teacherPresent += entry.present;
          }

          const weeklyHours = Math.round((weeklyMinutes / 60) * 10) / 10;
          totalHours += weeklyHours;
          totalStudents += studentsCount;
          attendanceTotal += teacherTotal;
          attendancePresent += teacherPresent;

          return {
            id: teacher.id,
            name:
              `${teacher.user?.firstName ?? ''} ${teacher.user?.lastName ?? ''}`.trim() ||
              "O'qituvchi",
            groupsCount: teacher.groups.length,
            studentsCount,
            weeklyHours,
            attendanceRate:
              teacherTotal > 0
                ? Math.round((teacherPresent / teacherTotal) * 100)
                : 0,
          };
        });

        return {
          totalTeachers: rows.length,
          totalHours: Math.round(totalHours * 10) / 10,
          totalStudents,
          averageAttendanceRate:
            attendanceTotal > 0
              ? Math.round((attendancePresent / attendanceTotal) * 100)
              : 0,
          teachers: items,
        };
      },
    },
    {
      name: 'teachers.create',
      description: 'Create a new teacher in the current organization.',
      inputSchema: z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        email: z.string().email(),
        phone: z.string().max(20).optional(),
      }),
      riskLevel: AiToolRiskLevel.MEDIUM,
      requiresConfirmation: true, // Must confirm user creation
      permission: AiPermission.TEACHERS_WRITE,
      execute: async (input: any, context) => {
        const result = await teachers.create(context.organizationId, {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          role: 'TEACHER',
        } as any);
        return { success: true, teacherId: result.id };
      },
    },
    {
      name: 'teachers.performance_review',
      description:
        "O'qituvchilarning pedagogik va operatsion samaradorlik audit reytingi: guruhlar soni, o'quvchilar soni, dars yuklamasi, davomat ko'rsatkichi va o'quvchilarni ushlab qolish (retention) sifati.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(25).optional(),
      }),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.TEACHERS_READ,
      execute: async (input: { limit?: number }, context) => {
        const rows = await (prisma.teacher.findMany as any)({
          where: { organizationId: context.organizationId },
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true, phone: true },
            },
            groups: {
              select: {
                id: true,
                name: true,
                isActive: true,
                students: {
                  select: {
                    studentId: true,
                  },
                },
                attendance: {
                  take: 60,
                  select: { status: true },
                },
              },
            },
          },
          take: input.limit ?? 15,
        });

        const scoredTeachers = (rows as any[]).map((t: any) => {
          let totalStudents = 0;
          let activeStudents = 0;
          let attPresent = 0;
          let attTotal = 0;

          const teacherGroups = t.groups || [];
          for (const g of teacherGroups) {
            const stList = g.students || [];
            totalStudents += stList.length;
            activeStudents += stList.length;
            const attList = g.attendance || [];
            for (const att of attList) {
              attTotal++;
              if (att.status === 'PRESENT') attPresent++;
            }
          }

          const retentionRate = totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 100;
          const attendanceRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 100;
          const overallScore = Math.round(retentionRate * 0.6 + attendanceRate * 0.4);

          const performanceTier =
            overallScore >= 90 ? 'STAR' : overallScore >= 75 ? 'CORE' : 'NEEDS_ATTENTION';

          const tName = [t.user?.firstName, t.user?.lastName].filter(Boolean).join(' ') || "O'qituvchi";
          return {
            teacherId: t.id,
            name: tName,
            email: t.user?.email || null,
            phone: t.user?.phone || null,
            groupsCount: teacherGroups.length,
            totalStudents,
            activeStudents,
            retentionRate,
            attendanceRate,
            overallScore,
            performanceTier,
          };
        });

        scoredTeachers.sort((a, b) => b.overallScore - a.overallScore);

        return {
          totalEvaluated: scoredTeachers.length,
          topPerformersCount: scoredTeachers.filter((t) => t.performanceTier === 'STAR').length,
          attentionNeededCount: scoredTeachers.filter((t) => t.performanceTier === 'NEEDS_ATTENTION').length,
          teachers: scoredTeachers,
        };
      },
    },
  ];
}
