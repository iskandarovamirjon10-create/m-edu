import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FinancialPeriodService } from '../analytics/financial-period.service';
import { PrismaService } from '../prisma/prisma.service';
import { toDateToInclusive, startOfDay } from '../common/date-range';
import { parsePagination } from '../lib/pagination';
import { CreateExpenseDto, UpdateExpenseDto } from '../common/dto';
import { ExpenseQuery } from '../common/dto/query';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialPeriod: FinancialPeriodService,
  ) {}

  async findAll(organizationId: string, query: ExpenseQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.ExpenseWhereInput = { organizationId };

    if (query.category) where.category = query.category as Prisma.ExpenseWhereInput['category'];
    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = startOfDay(query.dateFrom);
      const dateTo = toDateToInclusive(query.dateTo);
      if (dateTo) where.date.lte = dateTo;
    }

    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({ where, orderBy: { date: 'desc' }, skip, take: limit }),
      this.prisma.expense.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(organizationId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, organizationId } });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async create(organizationId: string, data: CreateExpenseDto) {
    await this.financialPeriod.ensureNotClosed(organizationId, data.date ? new Date(data.date) : new Date());

    if (data.amount <= 0) throw new BadRequestException('Expense amount must be greater than zero');

    return this.prisma.expense.create({
      data: {
        organizationId,
        category: data.category,
        amount: data.amount,
        description: data.description,
        date: new Date(data.date),
        receipt: data.receipt,
      },
    });
  }

  async update(organizationId: string, id: string, data: UpdateExpenseDto) {
    const existing = await this.findOne(organizationId, id);
    await this.financialPeriod.ensureNotClosed(organizationId, existing.date || existing.createdAt);
    if (data.date !== undefined) {
      await this.financialPeriod.ensureNotClosed(organizationId, new Date(data.date));
    }

    const updateData: Prisma.ExpenseUpdateInput = {};
    if (data.category !== undefined) updateData.category = data.category;
    if (data.amount !== undefined) {
      if (data.amount <= 0) throw new BadRequestException('Expense amount must be greater than zero');
      updateData.amount = data.amount;
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.receipt !== undefined) updateData.receipt = data.receipt;

    if (Object.keys(updateData).length === 0) return existing;

    await this.prisma.expense.updateMany({ where: { id, organizationId }, data: updateData });
    return this.findOne(organizationId, id);
  }

  async remove(organizationId: string, id: string, actorId: string) {
    const existing = await this.findOne(organizationId, id);
    await this.financialPeriod.ensureNotClosed(organizationId, existing.date || existing.createdAt);

    await this.prisma.$transaction(async (tx) => {
      await tx.expense.deleteMany({ where: { id, organizationId } });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actorId,
          action: 'DELETE',
          resource: 'Expense',
          resourceId: id,
          changes: { deletedRecord: existing }
        }
      });
    });
    return existing;
  }

  async getSummary(organizationId: string, query: ExpenseQuery) {
    const where: Prisma.ExpenseWhereInput = { organizationId };
    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = startOfDay(query.dateFrom);
      const dateTo = toDateToInclusive(query.dateTo);
      if (dateTo) where.date.lte = dateTo;
    }

    const [categoryStats, monthlyExpenses, totalResult] = await Promise.all([
      this.prisma.expense.groupBy({
        by: ['category'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
      (async () => {
        const dateTo = toDateToInclusive(query.dateTo);
        return this.prisma.$queryRaw`
        SELECT DATE_TRUNC('month', date) as month, SUM(amount)::decimal as total, COUNT(*)::int as count
        FROM "Expense"
        WHERE "organizationId" = ${organizationId}::uuid
        ${query.dateFrom ? Prisma.sql`AND date >= ${startOfDay(query.dateFrom)}` : Prisma.empty}
        ${dateTo ? Prisma.sql`AND date <= ${dateTo}` : Prisma.empty}
        GROUP BY DATE_TRUNC('month', date)
        ORDER BY month DESC
        LIMIT 12
      ` as unknown as { month: Date; total: string; count: number }[];
      })(),
      this.prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    return {
      categoryStats,
      monthlyExpenses,
      total: totalResult._sum.amount || 0,
    };
  }
}


