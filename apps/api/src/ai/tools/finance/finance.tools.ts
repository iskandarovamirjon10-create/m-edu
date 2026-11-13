import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { ExpensesService } from '../../../expenses/expenses.service';
import type { PrismaService } from '../../../prisma/prisma.service';

const simulateScenarioSchema = z.object({
  studentDeltaPercent: z.number().min(-90).max(300).optional().describe("O'quvchilar sonining o'zgarishi foizda (masalan, +15 yoki -10)"),
  priceDeltaPercent: z.number().min(-50).max(200).optional().describe("Kurslar narxining o'zgarishi foizda (masalan, +10 yoki -5)"),
  expenseDeltaPercent: z.number().min(-50).max(200).optional().describe("Xarajatlarning o'zgarishi foizda (ijara, oyliklar, marketing)"),
  churnReductionPercent: z.number().min(0).max(100).optional().describe("O'quvchilar chiqib ketishini kamaytirish foizda"),
});

const recordExpenseSchema = z.object({
  category: z.string().min(2).max(100),
  amount: z.number().positive(),
  description: z.string().min(2).max(500),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER']).optional(),
});

function getTashkentStartOfMonth(): Date {
  const now = new Date();
  const tashkentOffsetMs = 5 * 60 * 60 * 1000;
  const tashkentTime = new Date(now.getTime() + tashkentOffsetMs);
  const year = tashkentTime.getUTCFullYear();
  const month = tashkentTime.getUTCMonth();
  return new Date(Date.UTC(year, month, 1, -5, 0, 0));
}

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
        const startOfMonth = getTashkentStartOfMonth();

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
    {
      name: 'finance.simulate_scenario',
      description:
        "O'quv markazining moliyaviy 'What-If' ssenariy simulyatori: o'quvchilar soni, narxlar va xarajatlar o'zgarishining oylik va yillik sof foydaga ta'sirini modellashtirish.",
      inputSchema: simulateScenarioSchema,
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.FINANCE_READ,
      execute: async (input: z.infer<typeof simulateScenarioSchema>, context) => {
        const now = new Date();
        const startOfMonth = getTashkentStartOfMonth();

        const [paymentsSum, expensesSummary, activeStudentsCount] = await Promise.all([
          prisma.payment.aggregate({
            where: {
              organizationId: context.organizationId,
              status: 'PAID',
              paidAt: { gte: startOfMonth },
            },
            _sum: { amount: true },
          }),
          expenses.getSummary(context.organizationId, {}).catch(() => ({ total: 0, categoryStats: [] })),
          prisma.student.count({
            where: { organizationId: context.organizationId, status: 'ACTIVE' },
          }),
        ]);

        const currentRevenue = Number(paymentsSum._sum?.amount || 0);
        const currentExpenses = Number(expensesSummary.total || 0);
        const currentNetProfit = currentRevenue - currentExpenses;

        const studentFactor = 1 + (input.studentDeltaPercent ?? 0) / 100;
        const priceFactor = 1 + (input.priceDeltaPercent ?? 0) / 100;
        const churnRetentionBonus = 1 + ((input.churnReductionPercent ?? 0) * 0.4) / 100;
        const expenseFactor = 1 + (input.expenseDeltaPercent ?? 0) / 100;

        const projectedRevenue = Math.round(currentRevenue * studentFactor * priceFactor * churnRetentionBonus);
        const projectedExpenses = Math.round(currentExpenses * expenseFactor);
        const projectedNetProfit = projectedRevenue - projectedExpenses;
        const netProfitDelta = projectedNetProfit - currentNetProfit;
        const profitGrowthPercent = currentNetProfit !== 0
          ? Number(((netProfitDelta / Math.abs(currentNetProfit)) * 100).toFixed(1))
          : 0;

        const projectedAnnualProfit = projectedNetProfit * 12;
        const currentAnnualProfit = currentNetProfit * 12;

        return {
          baseline: {
            activeStudents: activeStudentsCount,
            monthlyRevenueUzs: currentRevenue,
            monthlyExpensesUzs: currentExpenses,
            monthlyNetProfitUzs: currentNetProfit,
            annualProfitUzs: currentAnnualProfit,
          },
          scenarioApplied: {
            studentDeltaPercent: input.studentDeltaPercent ?? 0,
            priceDeltaPercent: input.priceDeltaPercent ?? 0,
            expenseDeltaPercent: input.expenseDeltaPercent ?? 0,
            churnReductionPercent: input.churnReductionPercent ?? 0,
          },
          projection: {
            projectedMonthlyRevenueUzs: projectedRevenue,
            projectedMonthlyExpensesUzs: projectedExpenses,
            projectedMonthlyNetProfitUzs: projectedNetProfit,
            monthlyProfitDeltaUzs: netProfitDelta,
            profitGrowthPercent,
            projectedAnnualProfitUzs: projectedAnnualProfit,
            marginPercent: projectedRevenue > 0
              ? Number(((projectedNetProfit / projectedRevenue) * 100).toFixed(1))
              : 0,
          },
        };
      },
    },
  ];

}
