import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { CreateExpenseDto, UpdateExpenseDto } from '../common/dto';
import { ExpenseQuery } from '../common/dto/query';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: ExpenseQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.ExpenseWhereInput = { organizationId };

    if (query.category) where.category = query.category as Prisma.ExpenseWhereInput['category'];
    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
      if (query.dateTo) where.date.lte = new Date(query.dateTo);
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
    await this.findOne(organizationId, id);

    const updateData: Prisma.ExpenseUpdateInput = {};
    if (data.category !== undefined) updateData.category = data.category;
    if (data.amount !== undefined) {
      if (data.amount <= 0) throw new BadRequestException('Expense amount must be greater than zero');
      updateData.amount = data.amount;
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.receipt !== undefined) updateData.receipt = data.receipt;

    if (Object.keys(updateData).length === 0) return this.findOne(organizationId, id);

    return this.prisma.expense.update({ where: { id, organizationId }, data: updateData });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.expense.delete({ where: { id, organizationId } });
  }

  async getSummary(organizationId: string, query: ExpenseQuery) {
    const where: Prisma.ExpenseWhereInput = { organizationId };
    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
      if (query.dateTo) where.date.lte = new Date(query.dateTo);
    }

    const [categoryStats, monthlyExpenses, totalResult] = await Promise.all([
      this.prisma.expense.groupBy({
        by: ['category'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.$queryRaw`
        SELECT DATE_TRUNC('month', date) as month, SUM(amount)::decimal as total, COUNT(*)::int as count
        FROM "Expense"
        WHERE "organizationId" = ${organizationId}::uuid
        ${query.dateFrom ? Prisma.sql`AND date >= ${new Date(query.dateFrom)}` : Prisma.empty}
        ${query.dateTo ? Prisma.sql`AND date <= ${new Date(query.dateTo)}` : Prisma.empty}
        GROUP BY DATE_TRUNC('month', date)
        ORDER BY month DESC
        LIMIT 12
      ` as unknown as { month: Date; total: string; count: number }[],
      this.prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    return {
      categoryStats,
      monthlyExpenses,
      total: totalResult._sum.amount || 0,
    };
  }
}
