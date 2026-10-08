/**
 * Regression test for AnalyticsService.getOverview daily attendance:
 * the raw query returns one row per (date, status); the API must collapse
 * them into ONE row per date (previously charts got duplicate/spurious
 * zero-point rows for the same day).
 */
import { describe, it, expect, vi } from 'vitest';
import { AnalyticsService } from '../analytics.service';
import type { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    student: { count: vi.fn() },
    teacher: { count: vi.fn() },
    group: { count: vi.fn() },
    payment: { aggregate: vi.fn() },
    attendance: { groupBy: vi.fn() },
    lead: { groupBy: vi.fn() },
    $queryRaw: vi.fn(),
  } as unknown as PrismaService;
}

describe('AnalyticsService.getOverview daily attendance', () => {
  it('collapses multiple status rows for the same date into one entry', async () => {
    const prisma = makePrisma();
    prisma.student.count.mockResolvedValue(0);
    prisma.teacher.count.mockResolvedValue(0);
    prisma.group.count.mockResolvedValue(0);
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prisma.attendance.groupBy.mockResolvedValue([]);
    prisma.lead.groupBy.mockResolvedValue([]);
    // Raw queries: monthlyRevenue (first $queryRaw) and dailyAttendance (second).
    prisma.$queryRaw
      .mockResolvedValueOnce([]) // monthly revenue
      .mockResolvedValueOnce([
        { date: new Date('2026-09-05T00:00:00Z'), status: 'PRESENT', count: 5 },
        { date: new Date('2026-09-05T00:00:00Z'), status: 'ABSENT', count: 2 },
        { date: new Date('2026-09-05T00:00:00Z'), status: 'LATE', count: 1 },
        { date: new Date('2026-09-06T00:00:00Z'), status: 'PRESENT', count: 4 },
      ]); // daily attendance

    const svc = new AnalyticsService(prisma, { get: vi.fn(), set: vi.fn() } as any);
    const result = await svc.getOverview('org-1');

    const daily = result.attendance.daily;
    expect(daily).toHaveLength(2);
    const sep5 = daily.find((d: { date: string }) => d.date === '2026-09-05') as
      { date: string; present: number; absent: number; late: number } | undefined;
    expect(sep5).toBeDefined();
    expect(sep5!.present).toBe(5);
    expect(sep5!.absent).toBe(2);
    expect(sep5!.late).toBe(1);
  });
});

