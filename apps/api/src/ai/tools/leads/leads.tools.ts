import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { LeadsService } from '../../../leads/leads.service';

const searchLeadsSchema = z.object({
  search: z.string().max(120).optional(),
  stage: z.string().optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

export function createLeadsTools(leads: LeadsService): AiToolDefinition[] {
  return [
    {
      name: 'leads.summary',
      description:
        "O'quv markazining barcha lidlari, konversiya darajasi va sinov darslari bo'yicha tahliliy hisobotni olish.",
      inputSchema: z.object({}),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.LEADS_READ,
      execute: async (_input, context) => {
        const [allLeadsResult, trialAnalytics] = await Promise.all([
          leads.findAll(context.organizationId, { limit: '100' }),
          leads.getTrialAnalytics(context.organizationId).catch(() => null),
        ]);

        const stagesCount: Record<string, number> = {};
        const sourcesCount: Record<string, number> = {};

        for (const item of allLeadsResult.items) {
          stagesCount[item.stage] = (stagesCount[item.stage] || 0) + 1;
          const src = item.source || 'Boshqa';
          sourcesCount[src] = (sourcesCount[src] || 0) + 1;
        }

        const converted = stagesCount['WON'] || stagesCount['CONVERTED'] || 0;
        const total = allLeadsResult.total || allLeadsResult.items.length;
        const conversionRate = total > 0 ? Number(((converted / total) * 100).toFixed(1)) : 0;

        return {
          totalLeads: total,
          conversionRatePercent: conversionRate,
          byStage: stagesCount,
          bySource: sourcesCount,
          trialAnalytics: trialAnalytics ?? { scheduled: 0, attended: 0, converted: 0 },
        };
      },
    },
    {
      name: 'leads.search',
      description:
        "Lidlar ro'yxatidan ism, telefon raqam yoki bosqich bo'yicha qidirish.",
      inputSchema: searchLeadsSchema,
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.LEADS_READ,
      execute: async (input: z.infer<typeof searchLeadsSchema>, context) => {
        const result = await leads.findAll(context.organizationId, {
          search: input.search,
          stage: input.stage,
          limit: String(input.limit ?? 10),
        });

        return {
          total: result.total,
          leads: result.items.slice(0, input.limit ?? 10).map((lead) => ({
            id: lead.id,
            name: `${lead.firstName} ${lead.lastName || ''}`.trim(),
            phone: lead.phone,
            stage: lead.stage,
            source: lead.source,
            courseInterest: (lead as any).courseInterest ?? (lead as any).course?.name ?? null,
            createdAt: lead.createdAt,
          })),
        };
      },
    },
    {
      name: 'leads.create',
      description:
        "Yangi qiziquvchi lid (talabgor) yaratish. Foydalanuvchi ism va telefon raqamini tasdiqlaganidan keyin chaqiriladi.",
      inputSchema: z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().max(100).optional(),
        phone: z.string().min(5).max(25),
        source: z.string().optional(),
        notes: z.string().optional(),
      }),
      riskLevel: AiToolRiskLevel.MEDIUM,
      requiresConfirmation: true,
      permission: AiPermission.LEADS_WRITE,
      execute: async (input: any, context) => {
        const lead = await leads.create(context.organizationId, {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          source: input.source || 'AI_COPILOT',
          notes: input.notes,
        });

        return {
          success: true,
          leadId: lead.id,
          name: `${input.firstName} ${input.lastName || ''}`.trim(),
          phone: input.phone,
          stage: lead.stage,
        };
      },
    },
  ];
}
