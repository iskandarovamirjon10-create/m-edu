import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { ExamsService } from '../../../exams/exams.service';

export function createExamsTools(exams: ExamsService): AiToolDefinition[] {
  return [
    {
      name: 'exams.overview',
      description:
        "O'quv markazidagi imtihonlar statistikasi, o'rtacha ballar va o'zlashtirish ko'rsatkichlari.",
      inputSchema: z.object({}),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.EXAMS_READ,
      execute: async (_input, context) => {
        const stats = await exams.getExamStats(context.organizationId);

        return {
          totalExams: stats.totalExams,
          publishedExams: stats.publishedExams,
          totalResults: stats.totalResults,
          averageScorePercent: Number(stats.averageScore),
          passRatePercent: stats.passRate,
        };
      },
    },
    {
      name: 'exams.list',
      description:
        "O'tkazilgan yoki rejalashtirilgan imtihonlar ro'yxatini ko'rish.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).optional(),
      }),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.EXAMS_READ,
      execute: async (input: { limit?: number }, context) => {
        const result = await exams.findAllExams(context.organizationId, {
          limit: String(input.limit ?? 10),
        });

        return {
          total: result.total,
          exams: result.exams.map((exam: any) => ({
            id: exam.id,
            title: exam.title,
            courseName: exam.group?.course?.name || 'Nomaʼlum',
            examDate: exam.date,
            totalMarks: exam.totalMarks,
            passingMarks: exam.passingMarks,
          })),
        };
      },
    },
  ];
}
