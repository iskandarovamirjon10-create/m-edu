import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from '../dashboard.service';

function createMockPrisma() {
  return {
    student: { count: vi.fn() },
    teacher: { count: vi.fn() },
    group: { count: vi.fn() },
    payment: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    lead: {
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    followUp: { findMany: vi.fn() },
    attendance: { groupBy: vi.fn() },
    $queryRaw: vi.fn(),
  };
}

describe('DashboardService.getStats', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: DashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new DashboardService(prisma);
    // Default happy-path mocks; tests override what they need.
    prisma.student.count.mockResolvedValue(0);
    prisma.teacher.count.mockResolvedValue(0);
    prisma.group.count.mockResolvedValue(0);
    prisma.payment.groupBy.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.lead.groupBy.mockResolvedValue([]);
    prisma.followUp.findMany.mockResolvedValue([]);
    prisma.attendance.groupBy.mockResolvedValue([]);
    prisma.lead.count.mockResolvedValue(0);
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

  it('aggregates payment totals by status and keeps legacy aliases', async () => {
    prisma.payment.groupBy.mockResolvedValue([
      { status: 'PAID', _sum: { amount: 1000 } },
      { status: 'PENDING', _sum: { amount: 400 } },
      { status: 'OVERDUE', _sum: { amount: 150 } },
    ]);
    const stats = await svc.getStats('org-1');
    expect(stats.totalPaid).toBe(1000);
    expect(stats.totalPending).toBe(400);
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

  it('maps monthly revenue rows to plain numbers', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { month: new Date('2026-08-01'), total: '500.00', count: 3 },
      { month: new Date('2026-09-01'), total: '250.50', count: 2 },
    ]);
    const stats = await svc.getStats('org-1');
    expect(stats.monthlyRevenue).toEqual([
      { month: new Date('2026-08-01'), total: 500, count: 3 },
      { month: new Date('2026-09-01'), total: 250.5, count: 2 },
    ]);
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

  it('scopes the raw monthly revenue query to the organization', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await svc.getStats('org-1');
    expect(prisma.$queryRaw).toHaveBeenCalled();
    const call = prisma.$queryRaw.mock.calls[0];
    // The org id is bound as a parameter — search the parameter array.
    const params = call.slice(1);
    const orgBound = params.some((p: unknown) => p === 'org-1');
    expect(orgBound).toBe(true);
  });

  it('aggregates monthly revenue by paidAt, not createdAt', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await svc.getStats('org-1');
    const [strings, ...params] = prisma.$queryRaw.mock.calls[0] as [string[], ...unknown[]];
    const sql = strings.join('?');
    expect(sql).toContain('"paidAt"');
    expect(sql).toContain(`status = 'PAID'`);
    expect(sql).not.toContain(`DATE_TRUNC('month', "createdAt")`);
  });
});
