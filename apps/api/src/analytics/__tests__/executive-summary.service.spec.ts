import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutiveSummaryService } from '../executive-summary.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { FinancialBrainService } from '../financial-brain.service';
import type { AnomalyDetectionService } from '../anomaly-detection.service';

function createMockPrisma() {
  return {
    student: {
      count: vi.fn(),
    },
    attendance: {
      groupBy: vi.fn(),
    },
    lead: {
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    teacher: {
      count: vi.fn(),
    },
    group: {
      count: vi.fn(),
    },
    branch: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    payment: {
      aggregate: vi.fn(),
    },
  };
}

function createMockFinancialBrain() {
  return {
    getCashFlow: vi.fn(),
  };
}

function createMockAnomalyDetection() {
  return {
    detectAll: vi.fn(),
  };
}

describe('ExecutiveSummaryService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let financialBrain: ReturnType<typeof createMockFinancialBrain>;
  let anomalyDetection: ReturnType<typeof createMockAnomalyDetection>;
  let svc: ExecutiveSummaryService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    financialBrain = createMockFinancialBrain();
    anomalyDetection = createMockAnomalyDetection();

    svc = new ExecutiveSummaryService(
      prisma as unknown as PrismaService,
      financialBrain as unknown as FinancialBrainService,
      anomalyDetection as unknown as AnomalyDetectionService,
    );
  });

  it('calculates full summary for single-branch organization with positive trends', async () => {
    financialBrain.getCashFlow
      .mockResolvedValueOnce({
        inflows: { netCashInflow: 12000 },
        outflows: { totalOutflow: 8000 },
        netCashFlow: 4000,
      })
      .mockResolvedValueOnce({
        inflows: { netCashInflow: 10000 },
        outflows: { totalOutflow: 7000 },
        netCashFlow: 3000,
      });

    // totalStudents, newStudentsThisMonth, droppedThisMonth, activeStudents
    prisma.student.count
      .mockResolvedValueOnce(150)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(145);

    prisma.attendance.groupBy.mockResolvedValueOnce([
      { status: 'PRESENT', _count: { status: 80 } },
      { status: 'ABSENT', _count: { status: 20 } },
    ]);

    prisma.lead.groupBy.mockResolvedValueOnce([
      { stage: 'NEW', _count: { stage: 30 } },
      { stage: 'WON', _count: { stage: 10 } },
    ]);
    prisma.lead.count
      .mockResolvedValueOnce(35)
      .mockResolvedValueOnce(10);

    prisma.teacher.count.mockResolvedValueOnce(10);
    prisma.group.count.mockResolvedValueOnce(8);

    anomalyDetection.detectAll.mockResolvedValueOnce([
      { type: 'REVENUE_DROP', description: 'Drop alert', severity: 'HIGH' },
    ]);

    prisma.branch.count.mockResolvedValueOnce(1);

    const result = await svc.getSummary('org-1');

    expect(result.revenue.current).toBe(12000);
    expect(result.revenue.previous).toBe(10000);
    expect(result.revenue.trend).toBe(20);

    expect(result.expenses.current).toBe(8000);
    expect(result.expenses.previous).toBe(7000);
    expect(result.expenses.trend).toBe(14);

    expect(result.netCashFlow.current).toBe(4000);
    expect(result.netCashFlow.previous).toBe(3000);
    expect(result.netCashFlow.trend).toBe(33);

    expect(result.studentGrowth.total).toBe(150);
    expect(result.studentGrowth.newThisMonth).toBe(20);
    expect(result.studentGrowth.churnedThisMonth).toBe(5);
    expect(result.studentGrowth.churnRate).toBe(3);

    expect(result.attendanceRate.overall).toBe(80);
    expect(result.teacherUtilization.average).toBe(80);

    expect(result.crmConversion.leadsThisMonth).toBe(35);
    expect(result.crmConversion.converted).toBe(10);
    expect(result.crmConversion.rate).toBe(25);

    expect(result.topAlerts).toHaveLength(1);
    expect(result.topAlerts[0].type).toBe('REVENUE_DROP');
    expect(result.branchComparison).toBeNull();
  });

  it('handles anomaly detection failure gracefully without crashing', async () => {
    financialBrain.getCashFlow.mockResolvedValue({
      inflows: { netCashInflow: 0 },
      outflows: { totalOutflow: 0 },
      netCashFlow: 0,
    });

    prisma.student.count.mockResolvedValue(0);
    prisma.attendance.groupBy.mockResolvedValue([]);
    prisma.lead.groupBy.mockResolvedValue([]);
    prisma.lead.count.mockResolvedValue(0);
    prisma.teacher.count.mockResolvedValue(0);
    prisma.group.count.mockResolvedValue(0);
    prisma.branch.count.mockResolvedValue(0);

    anomalyDetection.detectAll.mockRejectedValue(new Error('Redis connection failed'));

    const result = await svc.getSummary('org-1');
    expect(result.topAlerts).toEqual([]);
    expect(result.revenue.trend).toBeNull();
    expect(result.attendanceRate.overall).toBeNull();
  });

  it('calculates branch comparison when multiple active branches exist', async () => {
    financialBrain.getCashFlow.mockResolvedValue({
      inflows: { netCashInflow: 1000 },
      outflows: { totalOutflow: 500 },
      netCashFlow: 500,
    });

    prisma.student.count
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(49)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(20);

    prisma.attendance.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ status: 'PRESENT', _count: { status: 15 } }])
      .mockResolvedValueOnce([{ status: 'PRESENT', _count: { status: 10 } }]);

    prisma.lead.groupBy.mockResolvedValue([]);
    prisma.lead.count.mockResolvedValue(0);
    prisma.teacher.count.mockResolvedValue(5);
    prisma.group.count.mockResolvedValue(3);
    anomalyDetection.detectAll.mockResolvedValue([]);

    prisma.branch.count.mockResolvedValueOnce(2);
    prisma.branch.findMany.mockResolvedValueOnce([
      { id: 'b-1', name: 'Downtown' },
      { id: 'b-2', name: 'Westside' },
    ]);

    prisma.payment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 600 } })
      .mockResolvedValueOnce({ _sum: { amount: 400 } });

    const result = await svc.getSummary('org-1');
    expect(result.branchComparison).toHaveLength(2);
    expect(result.branchComparison?.[0]).toEqual({
      branchId: 'b-1',
      name: 'Downtown',
      revenue: 600,
      students: 30,
      attendance: 100,
    });
    expect(result.branchComparison?.[1]).toEqual({
      branchId: 'b-2',
      name: 'Westside',
      revenue: 400,
      students: 20,
      attendance: 100,
    });
  });
});
