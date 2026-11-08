import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { ExpensesService } from '../../../expenses/expenses.service';
import type { PrismaService } from '../../../prisma/prisma.service';

const recordExpenseSchema = z.object({
  category: z.string().min(2).max(100),
  amount: z.number().positive(),
  description: z.string().min(2).max(500),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER']).optional(),
});

export function createFinanceTools(
  expenses: ExpensesService,
  prisma: PrismaService,
): AiToolDefinition[] {
  return [
    {
      name: 'finance.overview',
      description:
        "O'quv markazining umumiy moliyaviy holati: joriy oydagi tushum, xarajatlar, sof foyda va umumiy qarzdorlik miqdori.",
      inputSchema: z.object({}),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.FINANCE_READ,
      execute: async (_input, context) => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [paymentsSum, expensesSummary, debtorsResult] = await Promise.all([
          prisma.payment.aggregate({
            where: {
              organizationId: context.organizationId,
              status: 'PAID',
              paidAt: { gte: startOfMonth },
            },
            _sum: { amount: true },
          }),
          expenses.getSummary(context.organizationId, {}).catch(() => ({ total: 0, categoryStats: [] })),
          prisma.invoice.aggregate({
            where: {
              organizationId: context.organizationId,
              status: { in: ['ISSUED', 'OVERDUE', 'PARTIALLY_PAID'] as any },
            },
            _sum: { total: true, paidAmount: true },
          }),
        ]);

        const totalRevenue = Number(paymentsSum._sum?.amount || 0);
        const totalExpenses = Number(expensesSummary.total || 0);
        const netProfit = totalRevenue - totalExpenses;
        const totalInvoiced = Number(debtorsResult._sum?.total || 0);
        const totalPaidOnInvoices = Number(debtorsResult._sum?.paidAmount || 0);
        const totalOutstandingDebt = Math.max(0, totalInvoiced - totalPaidOnInvoices);

        return {
          month: now.toLocaleString('uz-UZ', { month: 'long', year: 'numeric' }),
          totalRevenueUzs: totalRevenue,
          totalExpensesUzs: totalExpenses,
          netProfitUzs: netProfit,
          profitMarginPercent: totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0,
          totalOutstandingDebtUzs: totalOutstandingDebt,
          categoryStats: (expensesSummary as any).categoryStats || [],
        };
      },
    },
    {
      name: 'finance.overdue_debtors',
      description:
        "To'lov muddati o'tgan yoki qarzdorligi mavjud o'quvchilar ro'yxatini chiqarish.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(30).optional(),
      }),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.FINANCE_READ,
      execute: async (input: { limit?: number }, context) => {
        const take = input.limit ?? 15;
        const unpaidInvoices = await prisma.invoice.findMany({
          where: {
            organizationId: context.organizationId,
            status: { in: ['ISSUED', 'OVERDUE', 'PARTIALLY_PAID'] as any },
          },
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true, phone: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take,
        });

        const debtors = (unpaidInvoices as any[])
          .map((inv: any) => {
            const debt = Math.max(0, Number(inv.total) - Number(inv.paidAmount || 0));
            return {
              invoiceId: inv.id,
              studentId: inv.studentId,
              studentName: `${inv.student?.user?.firstName || ''} ${inv.student?.user?.lastName || ''}`.trim() || 'Nomaʼlum',
              phone: inv.student?.user?.phone || 'Mavjud emas',
              debtAmountUzs: debt,
              dueDate: inv.dueDate,
              status: inv.status,
            };
          })
          .filter((d) => d.debtAmountUzs > 0);

        return {
          count: debtors.length,
          debtors,
        };
      },
    },
    {
      name: 'finance.record_expense',
      description:
        "O'quv markazi uchun xarajat yozish (ijara, kommunal, kantselyariya, marketing va h.k.). Foydalanuvchi tasdiqlaganidan keyin saqlanadi.",
      inputSchema: recordExpenseSchema,
      riskLevel: AiToolRiskLevel.MEDIUM,
      requiresConfirmation: true,
      permission: AiPermission.FINANCE_WRITE,
      execute: async (input: z.infer<typeof recordExpenseSchema>, context) => {
        const record = await expenses.create(context.organizationId, {
          category: input.category,
          amount: input.amount,
          description: input.description,
          paymentMethod: input.paymentMethod || 'BANK_TRANSFER',
          expenseDate: new Date().toISOString(),
        } as any);

        return {
          success: true,
          expenseId: record.id,
          category: record.category,
          amountUzs: Number(record.amount),
          description: record.description,
        };
      },
    },
  ];
}
