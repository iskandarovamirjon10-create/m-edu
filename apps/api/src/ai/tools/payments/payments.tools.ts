import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { InvoicesService } from '../../../payments/invoices.service';

const debtorsSchema = z.object({
  limit: z.number().int().min(1).max(20).optional(),
});

export function createPaymentsTools(invoices: InvoicesService): AiToolDefinition[] {
  return [
    {
      name: 'finance.debtors',
      description:
        'List overdue invoices (debtors) for the organization, with outstanding balance and per-student amount.',
      inputSchema: debtorsSchema,
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.PAYMENTS_READ,
      execute: async (input: z.infer<typeof debtorsSchema>, context) => {
        const limit = input.limit ?? 10;
        const result = await invoices.findAll(context.organizationId, { overdue: true, limit });
        return {
          total: result.total,
          outstanding: result.totals?.outstanding ?? 0,
          debtors: result.items.slice(0, limit).map((invoice) => ({
            id: invoice.id,
            student: `${invoice.student?.user?.firstName ?? ''} ${invoice.student?.user?.lastName ?? ''}`.trim(),
            total: invoice.total,
            paidAmount: invoice.paidAmount,
            status: invoice.status,
            dueDate: invoice.dueDate,
          })),
        };
      },
    },
  ];
}
