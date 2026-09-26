import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PayrollAnalyticsService } from '../payroll-analytics.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { FinancialBrainService } from '../financial-brain.service';

function makePrisma() {
  return {
    payrollRun: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    $queryRaw: vi.fn(),
  } as unknown as PrismaService;
}

function makeFinancialBrain() {
  return {
    getMonthlyRevenueSeries: vi.fn().mockResolvedValue([]),
  } as unknown as FinancialBrainService;
}

describe('PayrollAnalyticsService', () => {
  let svc: PayrollAnalyticsService;
  let prisma: ReturnType<typeof makePrisma>;
  let fb: ReturnType<typeof makeFinancialBrain>;

  beforeEach(() => {
    prisma = makePrisma();
    fb = makeFinancialBrain();
    svc = new PayrollAnalyticsService(prisma, fb);
  });

  describe('getPayrollSummary', () => {
    it('returns INSUFFICIENT_DATA when no runs exist', async () => {
      prisma.payrollRun.findMany.mockResolvedValue([]);
      prisma.payrollRun.aggregate.mockResolvedValue({ _sum: { netAmount: null, grossAmount: null }, _count: 0 });

      const result = await svc.getPayrollSummary('org-1');
      expect(result.status).toBe('INSUFFICIENT_DATA');
    });

    it('returns summary with correct totals', async () => {
      prisma.payrollRun.findMany.mockResolvedValue([
        { status: 'PAID', netAmount: 1000, lessonsCount: 10, teacherId: 't1' },
        { status: 'PAID', netAmount: 2000, lessonsCount: 20, teacherId: 't2' },
        { status: 'CALCULATED', netAmount: 500, lessonsCount: 5, teacherId: 't3' },
      ]);
      prisma.payrollRun.aggregate.mockResolvedValue({
        _sum: { netAmount: 3500, grossAmount: 4000 },
        _count: 3,
      });

      const result = await svc.getPayrollSummary('org-1');
      expect(result.totalPayroll).toBe(3500);
      expect(result.paidPayroll).toBe(3000);
      expect(result.paidCount).toBe(2);
      expect(result.totalCount).toBe(3);
      expect(result.teacherCount).toBe(3);
      expect(result.totalLessons).toBe(35);
      expect(result.averagePerTeacher).toBeCloseTo(1166.67, 1);
    });
  });

  describe('getPayrollByTeacher', () => {
    it('returns INSUFFICIENT_DATA when no runs exist', async () => {
      prisma.payrollRun.findMany.mockResolvedValue([]);

      const result = await svc.getPayrollByTeacher('org-1');
      expect(result.status).toBe('INSUFFICIENT_DATA');
    });

    it('groups runs by teacher correctly', async () => {
      prisma.payrollRun.findMany.mockResolvedValue([
        {
          teacherId: 't1', netAmount: 1000, grossAmount: 1200, lessonsCount: 10, status: 'PAID',
          teacher: { user: { firstName: 'John', lastName: 'Doe' } },
        },
        {
          teacherId: 't1', netAmount: 800, grossAmount: 960, lessonsCount: 8, status: 'CALCULATED',
          teacher: { user: { firstName: 'John', lastName: 'Doe' } },
        },
        {
          teacherId: 't2', netAmount: 1500, grossAmount: 1800, lessonsCount: 15, status: 'PAID',
          teacher: { user: { firstName: 'Jane', lastName: 'Smith' } },
        },
      ]);

      const result = await svc.getPayrollByTeacher('org-1');
      expect(result.teachers).toHaveLength(2);
      const john = result.teachers.find((t: { teacherId: string }) => t.teacherId === 't1');
      expect(john.name).toBe('John Doe');
      expect(john.totalNet).toBe(1800);
      expect(john.totalLessons).toBe(18);
      expect(john.statuses.PAID).toBe(1);
      expect(john.statuses.CALCULATED).toBe(1);
    });

    it('excludes cancelled runs from totals', async () => {
      prisma.payrollRun.findMany.mockResolvedValue([
        {
          teacherId: 't1', netAmount: 1000, grossAmount: 1200, lessonsCount: 10, status: 'CANCELLED',
          teacher: { user: { firstName: 'John', lastName: 'Doe' } },
        },
      ]);

      const result = await svc.getPayrollByTeacher('org-1');
      expect(result.teachers[0].totalNet).toBe(0);
      expect(result.teachers[0].totalGross).toBe(0);
      expect(result.teachers[0].statuses.CANCELLED).toBe(1);
    });
  });

  describe('getPayrollTrend', () => {
    it('returns INSUFFICIENT_DATA when no runs exist', async () => {
      prisma.payrollRun.findMany.mockResolvedValue([]);

      const result = await svc.getPayrollTrend('org-1', 6);
      expect(result.status).toBe('INSUFFICIENT_DATA');
    });

    it('builds monthly trend correctly', async () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      prisma.payrollRun.findMany.mockResolvedValue([
        { periodYear: y, periodMonth: m, netAmount: 5000, status: 'PAID' },
        { periodYear: y, periodMonth: m, netAmount: 3000, status: 'CALCULATED' },
      ]);

      const result = await svc.getPayrollTrend('org-1', 1);
      expect(result.trend).toHaveLength(1);
      expect(result.trend[0].total).toBe(8000);
      expect(result.trend[0].paid).toBe(5000);
      expect(result.trend[0].count).toBe(2);
    });
  });

  describe('getPayrollToRevenueRatio', () => {
    it('returns INSUFFICIENT_DATA when no runs exist', async () => {
      prisma.payrollRun.findMany.mockResolvedValue([]);
      fb.getMonthlyRevenueSeries.mockResolvedValue([]);

      const result = await svc.getPayrollToRevenueRatio('org-1', 1);
      expect(result.status).toBe('INSUFFICIENT_DATA');
    });

    it('computes ratio when both payroll and revenue exist', async () => {
      const now = new Date();
      prisma.payrollRun.findMany.mockResolvedValue([
        { periodYear: now.getFullYear(), periodMonth: now.getMonth() + 1, netAmount: 10000 },
      ]);
      fb.getMonthlyRevenueSeries.mockResolvedValue([
        { bucket: new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString(), total: 50000 },
      ]);

      const result = await svc.getPayrollToRevenueRatio('org-1', 1);
      expect(result.months).toHaveLength(1);
      expect(result.months[0].payroll).toBe(10000);
      expect(result.months[0].revenue).toBe(50000);
      expect(result.months[0].ratio).toBe(20);
    });
  });

  describe('getLessonEfficiency', () => {
    it('returns INSUFFICIENT_DATA when no runs exist', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await svc.getLessonEfficiency('org-1');
      expect(result.status).toBe('INSUFFICIENT_DATA');
    });

    it('ranks teachers by cost per lesson', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { teacherId: 't1', name: 'A B', totalNet: 2000, totalLessons: 20, runs: 1 },
        { teacherId: 't2', name: 'C D', totalNet: 1000, totalLessons: 10, runs: 1 },
        { teacherId: 't3', name: 'E F', totalNet: 3000, totalLessons: 20, runs: 1 },
      ]);

      const result = await svc.getLessonEfficiency('org-1');
      expect(result.teachers).toHaveLength(3);
      expect(result.teachers[0].costPerLesson).toBeLessThanOrEqual(result.teachers[1].costPerLesson);
      expect(result.teachers[1].costPerLesson).toBeLessThanOrEqual(result.teachers[2].costPerLesson);
      expect(result.teachers[0].rank).toBe(1);
      expect(result.overallCostPerLesson).toBeCloseTo(120, 1);
    });
  });
});
