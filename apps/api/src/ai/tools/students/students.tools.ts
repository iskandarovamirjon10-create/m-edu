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
    {
      name: 'students.create',
      description: 'Create a new student in the current organization.',
      inputSchema: z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        email: z.string().email(),
        phone: z.string().max(20).optional(),
      }),
      riskLevel: AiToolRiskLevel.MEDIUM,
      requiresConfirmation: true, // Must confirm user creation
      permission: AiPermission.STUDENTS_WRITE,
      execute: async (input: any, context) => {
        // We rely on service validation for CreateStudentDto
        const result = await students.create(context.organizationId, {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          role: 'STUDENT',
        } as any);
        return { success: true, studentId: result.id };
      },
    }
  ];
}
