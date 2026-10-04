import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { StudentsService } from '../../../students/students.service';
import type { StudentQuery } from '../../../common/dto/query';

const searchSchema = z.object({
  search: z.string().max(120).optional(),
  groupId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

export function createStudentsTools(students: StudentsService): AiToolDefinition[] {
  return [
    {
      name: 'students.search',
      description:
        'Search students in the current organization by name, email or group. Returns a bounded list and the total count.',
      inputSchema: searchSchema,
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.STUDENTS_READ,
      execute: async (input: z.infer<typeof searchSchema>, context) => {
        const query = {
          search: input.search,
          groupId: input.groupId,
          ...(input.limit ? { limit: String(input.limit) } : {}),
        } as StudentQuery;

        const result = await students.findAll(context.organizationId, query);
        return {
          total: result.total,
          students: result.items.slice(0, input.limit ?? 10).map((item) => ({
            id: item.id,
            firstName: item.user?.firstName ?? '',
            lastName: item.user?.lastName ?? '',
            groups: (item.groups ?? [])
              .map((membership) => membership.group?.name)
              .filter((name): name is string => Boolean(name)),
          })),
        };
      },
    },
  ];
}
