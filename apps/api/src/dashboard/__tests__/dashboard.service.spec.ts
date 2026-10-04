import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from '../dashboard.service';

function createMockPrisma() {
  return {
    student: { count: vi.fn() },
    teacher: { count: vi.fn() },
    group: { count: vi.fn() },
    payment: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    refund: { aggregate: vi.fn() },
    lead: {
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    followUp: { findMany: vi.fn() },
    attendance: { groupBy: vi.fn() },
  };
}

function createMockFinance() {
  return {
    getDebtAndReceivables: vi.fn(),
    getMonthlyRevenueSeries: vi.fn(),
    getCashFlow: vi.fn(),
  };
}

describe('DashboardService.getStats', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let finance: ReturnType<typeof createMockFinance>;
  let svc: DashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    finance = createMockFinance();
    svc = new DashboardService(prisma as any, finance as any);
    // Default happy-path mocks
    prisma.student.count.mockResolvedValue(0);
    prisma.teacher.count.mockResolvedValue(0);
    prisma.group.count.mockResolvedValue(0);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: null } });
    prisma.lead.groupBy.mockResolvedValue([]);
    prisma.followUp.findMany.mockResolvedValue([]);
    prisma.attendance.groupBy.mockResolvedValue([]);
    prisma.lead.count.mockResolvedValue(0);

    finance.getDebtAndReceivables.mockResolvedValue({ totalReceivables: 0, overdueDebt: 0 });
    finance.getMonthlyRevenueSeries.mockResolvedValue([]);
  });

  it('returns zeroed metrics when the organization has no data', async () => {
    const stats = await svc.getStats('org-1');
    expect(stats.totalStudents).toBe(0);
    expect(stats.totalTeachers).toBe(0);
    expect(stats.activeGroups).toBe(0);
    expect(stats.totalPaid).toBe(0);
    expect(stats.conversionRate).toBe(0);
    expect(stats.attendanceRate).toBe(0);
    expect(stats.monthlyRevenue).toEqual([]);
    expect(stats.leadByStage).toEqual([]);
    expect(stats.attendanceStats).toEqual([]);
    expect(stats.upcomingFollowUps).toEqual([]);
  });

  it('aggregates payment totals accurately using financial brain data', async () => {
    finance.getDebtAndReceivables.mockResolvedValue({ totalReceivables: 550, overdueDebt: 150 });
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 1200 } });
    prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 200 } });

    const stats = await svc.getStats('org-1');
    expect(stats.totalPaid).toBe(1000); // 1200 - 200
    expect(stats.totalPending).toBe(400); // 550 - 150
    expect(stats.totalOverdue).toBe(150);
    expect(stats.totalRevenue).toBe(1000); // legacy alias
    expect(stats.pendingPayments).toBe(400);
    expect(stats.overduePayments).toBe(150);
  });

  it('computes the lead conversion rate', async () => {
    prisma.lead.groupBy.mockResolvedValue([
      { stage: 'NEW', _count: { stage: 70 } },
      { stage: 'WON', _count: { stage: 30 } },
    ]);
    prisma.lead.count.mockResolvedValue(10); // new leads this month
    const stats = await svc.getStats('org-1');
    expect(stats.totalLeads).toBe(100);
    expect(stats.wonLeads).toBe(30);
    expect(stats.conversionRate).toBe(30);
    expect(stats.newLeadsThisMonth).toBe(10);
  });

  it('computes the attendance rate from the last 30 days', async () => {
    prisma.attendance.groupBy.mockResolvedValue([
      { status: 'PRESENT', _count: { status: 80 } },
      { status: 'ABSENT', _count: { status: 20 } },
    ]);
    const stats = await svc.getStats('org-1');
    expect(stats.attendanceRate).toBe(80);
    expect(stats.attendanceStats).toEqual([
      { status: 'PRESENT', count: 80 },
      { status: 'ABSENT', count: 20 },
    ]);
  });

  it('passes through monthly revenue series from FinancialBrain', async () => {
    const series = [
      { bucket: new Date('2026-08-01'), total: 500, count: 3 },
      { bucket: new Date('2026-09-01'), total: 250.5, count: 2 },
    ];
    finance.getMonthlyRevenueSeries.mockResolvedValue(series);
    const stats = await svc.getStats('org-1');
    expect(stats.monthlyRevenue).toEqual(series);
  });

  it('includes counts for students, teachers and active groups', async () => {
    prisma.student.count
      .mockResolvedValueOnce(42) // totalStudents
      .mockResolvedValueOnce(30); // activeStudents
    prisma.teacher.count.mockResolvedValue(5);
    prisma.group.count.mockResolvedValue(4);
    const stats = await svc.getStats('org-1');
    expect(stats.totalStudents).toBe(42);
    expect(stats.activeStudents).toBe(30);
    expect(stats.totalTeachers).toBe(5);
    expect(stats.activeGroups).toBe(4);
  });
});
