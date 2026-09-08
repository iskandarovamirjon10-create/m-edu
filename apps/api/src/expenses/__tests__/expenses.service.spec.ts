/**
 * Regression tests for ExpensesService.getSummary:
 * the monthly series must respect the same dateFrom/dateTo filters as the
 * category totals (previously the raw monthly query ignored the filters,
 * producing an inconsistent report).
 */
import { describe, it, expect, vi } from 'vitest';
import { ExpensesService } from '../expenses.service';

function makePrisma() {
  return {
    expense: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    $queryRaw: vi.fn(),
  } as any;
}

// With a mocked $queryRaw the Prisma.sql fragments arrive as value objects
// carrying their own { strings, values }; recursively look for a bound Date
// so the assertion targets the parameter binding, not SQL text.
function containsBoundDate(values: any[], target?: Date): boolean {
  for (const v of values) {
    if (v instanceof Date) {
      if (!target || v.getTime() === target.getTime()) return true;
    } else if (v && typeof v === 'object' && Array.isArray(v.values)) {
      if (containsBoundDate(v.values, target)) return true;
    }
  }
  return false;
}

describe('ExpensesService.getSummary date filtering', () => {
  it('includes the date predicate in the monthly query when dateFrom is given', async () => {
    const prisma = makePrisma();
    prisma.expense.groupBy.mockResolvedValue([]);
    prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prisma.$queryRaw.mockResolvedValue([]);
    const svc = new ExpensesService(prisma);

    await svc.getSummary('org-1', { dateFrom: '2026-08-01' });

    expect(prisma.$queryRaw).toHaveBeenCalled();
    const call = prisma.$queryRaw.mock.calls[0];
    // The dateFrom fragment must bind 2026-08-01 to the monthly query.
    expect(containsBoundDate(call.slice(1), new Date('2026-08-01'))).toBe(true);
  });

  it('omits the date predicate when no date filters are given', async () => {
    const prisma = makePrisma();
    prisma.expense.groupBy.mockResolvedValue([]);
    prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prisma.$queryRaw.mockResolvedValue([]);
    const svc = new ExpensesService(prisma);

    await svc.getSummary('org-1', {});

    const call = prisma.$queryRaw.mock.calls[0];
    // Without filters no date parameter may be bound to the monthly query.
    expect(containsBoundDate(call.slice(1))).toBe(false);
  });
});
