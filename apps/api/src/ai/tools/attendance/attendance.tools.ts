import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { AttendanceService } from '../../../attendance/attendance.service';
import { computeAttendanceRate } from '../../../common/attendance-rate';
import type { AttendanceQuery } from '../../../common/dto/query';
import type { PrismaService } from '../../../prisma/prisma.service';

const summarySchema = z.object({
  dateFrom: z.string().max(32).optional(),
  dateTo: z.string().max(32).optional(),
  groupId: z.string().uuid().optional(),
});

export function createAttendanceTools(
  attendance: AttendanceService,
  prisma?: PrismaService,
): AiToolDefinition[] {
  return [
    {
      name: 'attendance.summary',
      description:
        'Summarise attendance (total, present, absent, late) for a date range and optionally a single group.',
      inputSchema: summarySchema,
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.ATTENDANCE_READ,
      execute: async (input: z.infer<typeof summarySchema>, context) => {
        const query = {
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          groupId: input.groupId,
        } as AttendanceQuery;

        const analytics = await attendance.getAnalytics(context.organizationId, query);
        return analytics;
      },
    },
    {
      name: 'attendance.groups',
      description:
        'Compare attendance rates across groups in the organization to identify cohorts with lowest or highest attendance.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).optional(),
        days: z.number().int().min(1).max(90).optional(),
      }),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.ATTENDANCE_READ,
      execute: async (input: { limit?: number; days?: number }, context) => {
        const limit = input.limit ?? 10;
        const days = input.days ?? 30;
        const since = new Date();
        since.setDate(since.getDate() - days);

        if (!prisma) {
          return { groups: [], message: 'Database client not available' };
        }

        const groups = await prisma.group.findMany({
          where: { organizationId: context.organizationId },
          select: {
            id: true,
            name: true,
            course: { select: { name: true } },
            teacher: { select: { user: { select: { firstName: true, lastName: true } } } },
            _count: { select: { enrollments: true } },
          },
        });

        if (groups.length === 0) {
          return { totalGroups: 0, groups: [] };
        }

        const groupIds = groups.map((g) => g.id);
        const attendanceStats = await prisma.attendance.groupBy({
          by: ['groupId', 'status'],
          where: {
            organizationId: context.organizationId,
            groupId: { in: groupIds },
            date: { gte: since },
          },
          _count: { status: true },
        });

        const statsMap = new Map<string, { total: number; present: number; absent: number; late: number }>();
        for (const row of attendanceStats) {
          const entry = statsMap.get(row.groupId) ?? { total: 0, present: 0, absent: 0, late: 0 };
          const count = row._count.status;
          entry.total += count;
          if (row.status === 'PRESENT') entry.present += count;
          else if (row.status === 'ABSENT') entry.absent += count;
          else if (row.status === 'LATE') entry.late += count;
          statsMap.set(row.groupId, entry);
        }

        const items = groups.map((group) => {
          const stats = statsMap.get(group.id) ?? { total: 0, present: 0, absent: 0, late: 0 };
          // Canonical rate: LATE counts as attended and EXCUSED is excluded
          // from the denominator, matching every other attendance surface.
          const rate =
            stats.total > 0
              ? computeAttendanceRate(
                  [
                    { status: 'PRESENT', count: stats.present },
                    { status: 'LATE', count: stats.late },
                    { status: 'ABSENT', count: stats.absent },
                  ],
                  true,
                )
              : null;
          const teacherName = group.teacher?.user
            ? `${group.teacher.user.firstName || ''} ${group.teacher.user.lastName || ''}`.trim()
            : "O'qituvchi tayinlanmagan";

          return {
            id: group.id,
            name: group.name,
            course: group.course?.name ?? null,
            teacher: teacherName,
            studentsCount: group._count.enrollments,
            attendanceRate: rate,
            totalRecords: stats.total,
            absentCount: stats.absent,
          };
        });

        // Sort ascending by attendance rate (lowest attendance first)
        items.sort((a, b) => {
          if (a.attendanceRate === null && b.attendanceRate === null) return 0;
          if (a.attendanceRate === null) return 1;
          if (b.attendanceRate === null) return -1;
          return a.attendanceRate - b.attendanceRate;
        });

        return {
          totalGroups: groups.length,
          periodDays: days,
          groups: items.slice(0, limit),
        };
      },
    },
  ];
}
