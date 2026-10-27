import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { PrismaService } from '../../../prisma/prisma.service';

const analyticsSchema = z.object({
  limit: z.number().int().min(1).max(20).optional(),
  groupId: z.string().uuid().optional(),
});

/**
 * Real exam analytics.
 *
 * The legacy copilot computed this inline and only ever reached it through a
 * keyword regex. Exposing it as a registered tool lets the model decide when
 * grade data is relevant, and keeps the numbers derived from `ExamResult`.
 */
export function createGradesTools(prisma: PrismaService): AiToolDefinition[] {
  return [
    {
      name: 'grades.analytics',
      description:
        'Analyse exam results in the organization: pass rate, average marks and a per-exam breakdown. Optionally scope to one group.',
      inputSchema: analyticsSchema,
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.REPORTS_READ,
      execute: async (input: z.infer<typeof analyticsSchema>, context) => {
        const limit = input.limit ?? 5;

        const exams = await prisma.exam.findMany({
          where: {
            organizationId: context.organizationId,
            ...(input.groupId
              ? { groupId: input.groupId, group: { organizationId: context.organizationId } }
              : {}),
          },
          include: {
            results: true,
            group: { select: { name: true } },
          },
          orderBy: { examDate: 'desc' },
          take: limit,
        });

        let allPassed = 0;
        let allTotal = 0;
        let allMarksSum = 0;

        const items = exams.map((exam) => {
          const results = exam.results ?? [];
          const passed = results.filter((result) => result.isPassed).length;
          const marksSum = results.reduce(
            (sum, result) => sum + Number(result.marksObtained || 0),
            0,
          );
          allPassed += passed;
          allTotal += results.length;
          allMarksSum += marksSum;

          return {
            id: exam.id,
            title: exam.title,
            subject: exam.subject,
            group: exam.group?.name ?? null,
            examDate: exam.examDate.toISOString(),
            averageMarks:
              results.length > 0
                ? Math.round((marksSum / results.length) * 10) / 10
                : 0,
            passingMarks: Number(exam.passingMarks),
            passedCount: passed,
            failedCount: results.length - passed,
            totalStudents: results.length,
            passRate:
              results.length > 0
                ? Math.round((passed / results.length) * 100)
                : 0,
          };
        });

        return {
          totalExams: exams.length,
          overallAverage:
            allTotal > 0 ? Math.round((allMarksSum / allTotal) * 10) / 10 : 0,
          overallPassRate:
            allTotal > 0 ? Math.round((allPassed / allTotal) * 100) : 0,
          exams: items,
        };
      },
    },
  ];
}
