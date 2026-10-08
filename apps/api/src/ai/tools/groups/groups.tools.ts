import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { GroupsService } from '../../../groups/groups.service';

export function createGroupsTools(groups: GroupsService): AiToolDefinition[] {
  return [
    {
      name: 'groups.list',
      description: 'List groups in the current organization. Returns a bounded list.',
      inputSchema: z.object({
        search: z.string().optional(),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.GROUPS_READ,
      execute: async (input: any, context) => {
        const result = await groups.findAll(context.organizationId, {
          search: input.search,
          limit: String(input.limit ?? 10)
        } as any);
        return {
          total: result.total,
          groups: result.items.map((i: any) => ({
            id: i.id,
            name: i.name,
            courseName: i.course?.name,
            teacherName: `${i.teacher?.user?.firstName ?? ''} ${i.teacher?.user?.lastName ?? ''}`.trim(),
            studentsCount: i._count?.enrollments ?? 0
          }))
        };
      },
    },
    {
      name: 'groups.create',
      description: 'Create a new group in the current organization.',
      inputSchema: z.object({
        name: z.string().min(1).max(100),
        courseId: z.string().uuid(),
        teacherId: z.string().uuid(),
      }),
      riskLevel: AiToolRiskLevel.MEDIUM,
      requiresConfirmation: true, // Must confirm group creation
      permission: AiPermission.GROUPS_WRITE,
      execute: async (input: any, context) => {
        const result = await groups.create(context.organizationId, {
          name: input.name,
          courseId: input.courseId,
          teacherId: input.teacherId,
        } as any);
        return { success: true, groupId: result.id };
      },
    }
  ];
}
