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
    }
  ];
}
