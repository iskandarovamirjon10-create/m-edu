import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { StudentsService } from '../../../students/students.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { StudentQuery } from '../../../common/dto/query';

const searchSchema = z.object({
  search: z.string().max(120).optional(),
  groupId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

export function createStudentsTools(students: StudentsService, prisma?: PrismaService): AiToolDefinition[] {
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
      description:
        'Create a new student in the current organization. Only call this once the ' +
        'user has confirmed the first and last name. Email is optional: omit it ' +
        'instead of inventing an address.',
      inputSchema: z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        email: z.string().email().optional(),
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
          ...(input.email ? { email: input.email } : {}),
          ...(input.phone ? { phone: input.phone } : {}),
          role: 'STUDENT',
        } as any);
        return {
          success: true,
          studentId: result.id,
          name: `${input.firstName} ${input.lastName}`.trim(),
          email: input.email ?? null,
        };
      },
    },
    {
      name: 'students.academic_risk_radar',
      description:
        "O'quvchilarning kompleks akademik va moliyaviy xavf tahlili: past davomat (<75%), to'lov muddati o'tgan qarzdorlik va test/vazifa baholari pasaygan xavf ostidagi o'quvchilarni erta aniqlash.",
      inputSchema: z.object({
        minRiskScore: z.number().min(0).max(100).optional().describe("Minimal xavf balli (0-100)"),
        limit: z.number().int().min(1).max(30).optional(),
      }),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.STUDENTS_READ,
      execute: async (input: { minRiskScore?: number; limit?: number }, context) => {
        if (!prisma) {
          return { count: 0, students: [], message: "Prisma servisi mavjud emas" };
        }

        const studentsList = await (prisma.student.findMany as any)({
          where: { organizationId: context.organizationId, status: 'ACTIVE' },
          include: {
            user: { select: { firstName: true, lastName: true, phone: true } },
            groups: { include: { group: { select: { name: true } } } },
            attendance: { take: 15, orderBy: { createdAt: 'desc' }, select: { status: true } },
            Invoice: {
              where: { status: { in: ['ISSUED', 'OVERDUE', 'PARTIALLY_PAID'] as any } },
              select: { total: true, paidAmount: true, dueDate: true },
            },
          },
          take: 60,
        });

        const atRisk = (studentsList as any[]).map((st: any) => {
          const attRecords = st.attendance || [];
          const attTotal = attRecords.length;
          const attPresent = attRecords.filter((a: any) => a.status === 'PRESENT').length;
          const attendanceRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 100;

          let outstandingDebt = 0;
          let hasOverdueDate = false;
          const now = new Date();
          const invoices = st.Invoice || [];
          for (const inv of invoices) {
            const debt = Math.max(0, Number(inv.total) - Number(inv.paidAmount || 0));
            outstandingDebt += debt;
            if (inv.dueDate && new Date(inv.dueDate) < now) hasOverdueDate = true;
          }

          let riskScore = 0;
          const riskFactors: string[] = [];

          if (attendanceRate < 60) {
            riskScore += 45;
            riskFactors.push("Kritik past davomat: " + attendanceRate + "%");
          } else if (attendanceRate < 80) {
            riskScore += 25;
            riskFactors.push("Davomat pasaygan: " + attendanceRate + "%");
          }

          if (hasOverdueDate) {
            riskScore += 35;
            riskFactors.push("Muddati o'tgan qarzdorlik: " + outstandingDebt.toLocaleString() + " so'm");
          } else if (outstandingDebt > 0) {
            riskScore += 15;
            riskFactors.push("Joriy qarzdorlik: " + outstandingDebt.toLocaleString() + " so'm");
          }

          const riskLevel = riskScore >= 50 ? 'HIGH' : riskScore >= 25 ? 'MEDIUM' : 'LOW';
          const name = [st.user?.firstName, st.user?.lastName].filter(Boolean).join(' ') || "O'quvchi";
          const groupNames = (st.groups || []).map((g: any) => g.group?.name).filter(Boolean);

          return {
            studentId: st.id,
            name,
            phone: st.user?.phone || 'Mavjud emas',
            groups: groupNames,
            attendanceRate,
            outstandingDebtUzs: outstandingDebt,
            riskScore,
            riskLevel,
            riskFactors,
          };
        })
        .filter((s: any) => s.riskScore >= (input.minRiskScore ?? 25));

        atRisk.sort((a, b) => b.riskScore - a.riskScore);
        const clamped = atRisk.slice(0, input.limit ?? 15);

        return {
          totalAtRisk: atRisk.length,
          highRiskCount: atRisk.filter((s) => s.riskLevel === 'HIGH').length,
          mediumRiskCount: atRisk.filter((s) => s.riskLevel === 'MEDIUM').length,
          students: clamped,
        };
      },
    },
  ];
}
