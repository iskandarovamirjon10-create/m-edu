import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExpensesService } from '../expenses.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { FinancialPeriodService } from '../../analytics/financial-period.service';
import { ExpenseCategory } from '@prisma/client';

function makePrisma() {
  return {
    expense: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };
}

function makeFinancialPeriod() {
  return {
    ensureNotClosed: vi.fn(async () => {}),
  };
}

function containsBoundDate(values: unknown[], target?: Date): boolean {
  for (const v of values) {
    if (v instanceof Date) {
      if (!target || v.getTime() === target.getTime()) return true;
    } else if (v && typeof v === 'object' && 'values' in v && Array.isArray((v as { values: unknown[] }).values)) {
      if (containsBoundDate((v as { values: unknown[] }).values, target)) return true;
    }
  }
  return false;
}

describe('ExpensesService', () => {
  let svc: ExpensesService;
  let prisma: ReturnType<typeof makePrisma>;
  let financialPeriod: ReturnType<typeof makeFinancialPeriod>;

  beforeEach(() => {
    prisma = makePrisma();
    financialPeriod = makeFinancialPeriod();
    svc = new ExpensesService(
      prisma as unknown as PrismaService,
      financialPeriod as unknown as FinancialPeriodService,
    );
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('queries expenses scoped by organizationId with pagination', async () => {
      prisma.expense.findMany.mockResolvedValue([]);
      prisma.expense.count.mockResolvedValue(0);

      const res = await svc.findAll('org-1', { page: 1, limit: 10, category: 'RENT' });
      expect(prisma.expense.findMany).toHaveBeenCalled();
      const where = prisma.expense.findMany.mock.calls[0][0].where;
      expect(where.organizationId).toBe('org-1');
      expect(where.category).toBe('RENT');
      expect(res.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('returns expense when found', async () => {
      prisma.expense.findFirst.mockResolvedValue({ id: 'exp-1', amount: 500 });
      const res = await svc.findOne('org-1', 'exp-1');
      expect(res.id).toBe('exp-1');
      expect(prisma.expense.findFirst).toHaveBeenCalledWith({
        where: { id: 'exp-1', organizationId: 'org-1' },
      });
    });

    it('throws NotFoundException when not found', async () => {
      prisma.expense.findFirst.mockResolvedValue(null);
      await expect(svc.findOne('org-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates expense after verifying open financial period', async () => {
      prisma.expense.create.mockResolvedValue({ id: 'exp-1' });

      const res = await svc.create('org-1', {
        category: ExpenseCategory.RENT,
        amount: 1500,
        description: 'Office rent',
        date: '2026-09-01T00:00:00.000Z',
      });

      expect(financialPeriod.ensureNotClosed).toHaveBeenCalled();
      expect(prisma.expense.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          category: ExpenseCategory.RENT,
          amount: 1500,
          description: 'Office rent',
          date: new Date('2026-09-01T00:00:00.000Z'),
          receipt: undefined,
        },
      });
      expect(res.id).toBe('exp-1');
    });

    it('rejects non-positive amount', async () => {
      await expect(
        svc.create('org-1', {
          category: ExpenseCategory.RENT,
          amount: 0,
          date: '2026-09-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('updates expense after period validation', async () => {
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        organizationId: 'org-1',
        date: new Date('2026-09-01'),
      });
      prisma.expense.updateMany.mockResolvedValue({ count: 1 });

      const res = await svc.update('org-1', 'exp-1', { amount: 2000 });
      expect(financialPeriod.ensureNotClosed).toHaveBeenCalled();
      // Tenant-scoped write: the where clause carries organizationId so a
      // cross-tenant id can never be mutated.
      expect(prisma.expense.updateMany).toHaveBeenCalledWith({
        where: { id: 'exp-1', organizationId: 'org-1' },
        data: { amount: 2000 },
      });
      expect(res.id).toBe('exp-1');
    });

    it('rejects update with non-positive amount', async () => {
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        organizationId: 'org-1',
        date: new Date('2026-09-01'),
      });
      await expect(svc.update('org-1', 'exp-1', { amount: -50 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('deletes expense after verifying period is open', async () => {
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        organizationId: 'org-1',
        date: new Date('2026-09-01'),
      });
      prisma.expense.deleteMany.mockResolvedValue({ count: 1 });

      const res = await svc.remove('org-1', 'exp-1');
      expect(financialPeriod.ensureNotClosed).toHaveBeenCalled();
      expect(prisma.expense.deleteMany).toHaveBeenCalledWith({
        where: { id: 'exp-1', organizationId: 'org-1' },
      });
      expect(res.id).toBe('exp-1');
    });
  });

  describe('getSummary date filtering', () => {
    it('includes the date predicate in the monthly query when dateFrom is given', async () => {
      prisma.expense.groupBy.mockResolvedValue([]);
      prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prisma.$queryRaw.mockResolvedValue([]);

      await svc.getSummary('org-1', { dateFrom: '2026-08-01' });

      expect(prisma.$queryRaw).toHaveBeenCalled();
      const call = prisma.$queryRaw.mock.calls[0] as unknown[];
      expect(containsBoundDate(call.slice(1), new Date('2026-08-01'))).toBe(true);
    });

    it('omits the date predicate when no date filters are given', async () => {
      prisma.expense.groupBy.mockResolvedValue([]);
      prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prisma.$queryRaw.mockResolvedValue([]);

      await svc.getSummary('org-1', {});

      const call = prisma.$queryRaw.mock.calls[0] as unknown[];
      expect(containsBoundDate(call.slice(1))).toBe(false);
    });
  });
});
