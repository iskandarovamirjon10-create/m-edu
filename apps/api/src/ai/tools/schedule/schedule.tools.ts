import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { ScheduleService, ScheduleQuery } from '../../../schedule/schedule.service';
import type { CreateScheduleDto } from '../../../common/dto';

const listSchema = z.object({
  groupId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  dayOfWeek: z
    .enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])
    .optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const createSchema = z.object({
  groupId: z.string().uuid(),
  dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  room: z.string().max(100).optional(),
});

export function createScheduleTools(schedule: ScheduleService): AiToolDefinition[] {
  return [
    {
      name: 'schedule.list',
      description:
        'List active lessons in the schedule, optionally filtered by group, teacher or day of week.',
      inputSchema: listSchema,
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.SCHEDULE_READ,
      execute: async (input: z.infer<typeof listSchema>, context) => {
        const query = {
          groupId: input.groupId,
          teacherId: input.teacherId,
          dayOfWeek: input.dayOfWeek,
          ...(input.limit ? { limit: String(input.limit) } : {}),
        } as unknown as ScheduleQuery;

        const result = await schedule.findAll(context.organizationId, query);
        return {
          total: result.total,
          lessons: result.items.slice(0, input.limit ?? 25).map((lesson) => ({
            id: lesson.id,
            group: lesson.group?.name ?? null,
            dayOfWeek: lesson.dayOfWeek,
            startTime: lesson.startTime,
            endTime: lesson.endTime,
          })),
        };
      },
    },
    {
      name: 'schedule.create',
      description:
        'Create a new lesson in the schedule for a group. This changes data and requires user confirmation.',
      inputSchema: createSchema,
      riskLevel: AiToolRiskLevel.MEDIUM,
      requiresConfirmation: true,
      permission: AiPermission.SCHEDULE_WRITE,
      execute: async (input: z.infer<typeof createSchema>, context) => {
        const dto = {
          groupId: input.groupId,
          dayOfWeek: input.dayOfWeek,
          startTime: input.startTime,
          endTime: input.endTime,
          ...(input.room ? { room: input.room } : {}),
        } as CreateScheduleDto;

        const created = await schedule.create(context.organizationId, dto);
        return {
          id: created.id,
          groupId: created.groupId,
          dayOfWeek: created.dayOfWeek,
          startTime: created.startTime,
          endTime: created.endTime,
        };
      },
    },
  ];
}
