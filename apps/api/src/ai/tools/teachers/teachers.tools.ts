import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { TeachersService } from '../../../teachers/teachers.service';
import type { TeacherQuery } from '../../../common/dto/query';

const listSchema = z.object({
  search: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

export function createTeachersTools(teachers: TeachersService): AiToolDefinition[] {
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
  ];
}
