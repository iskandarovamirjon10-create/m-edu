import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { AttendanceService } from '../../../attendance/attendance.service';
import type { AttendanceQuery } from '../../../common/dto/query';

const summarySchema = z.object({
  dateFrom: z.string().max(32).optional(),
  dateTo: z.string().max(32).optional(),
  groupId: z.string().uuid().optional(),
});

export function createAttendanceTools(attendance: AttendanceService): AiToolDefinition[] {
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
  ];
}
