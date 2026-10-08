import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { CoursesService } from '../../../courses/courses.service';

export function createCoursesTools(courses: CoursesService): AiToolDefinition[] {
  return [
    {
      name: 'courses.list',
      description: 'List courses in the current organization. Returns a bounded list.',
      inputSchema: z.object({
        search: z.string().optional(),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.COURSES_READ,
      execute: async (input: any, context) => {
        const result = await courses.findAll(context.organizationId, {
          search: input.search,
          limit: String(input.limit ?? 10)
        } as any);
        return {
          total: result.total,
          courses: result.items.map((i: any) => ({
            id: i.id,
            name: i.name,
            description: i.description,
            duration: i.duration,
            price: i.price,
          }))
        };
      },
    },
    {
      name: 'courses.create',
      description: 'Create a new course in the current organization.',
      inputSchema: z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(5000).optional(),
        duration: z.number().int().optional(),
        price: z.number().optional(),
      }),
      riskLevel: AiToolRiskLevel.MEDIUM,
      requiresConfirmation: true, // Must confirm course creation
      permission: AiPermission.COURSES_WRITE,
      execute: async (input: any, context) => {
        const result = await courses.create(context.organizationId, {
          name: input.name,
          description: input.description,
          duration: input.duration,
          price: input.price,
        } as any);
        return { success: true, courseId: result.id };
      },
    }
  ];
}
