import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnomalyDetectionService } from '../anomaly-detection.service';
import type { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}

describe('AnomalyDetectionService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: AnomalyDetectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new AnomalyDetectionService(prisma as unknown as PrismaService);
  });

  describe('detectRevenueDrop', () => {
    it('returns insufficientData when only one month of data exists', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ bucket: new Date('2026-01-01'), total: 1000 }]);
      const result = await svc.detectRevenueDrop('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].insufficientData).toBe(true);
      expect(result[0].type).toBe('REVENUE_DROP');
    });

    it('detects a >20% revenue drop', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { bucket: new Date('2025-11-01'), total: 10000 },
        { bucket: new Date('2025-12-01'), total: 7000 },
      ]);
      const result = await svc.detectRevenueDrop('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('REVENUE_DROP');
      expect(result[0].observed).toBe(7000);
      expect(result[0].baseline).toBe(10000);
      expect(result[0].severity).toBe('MEDIUM');
    });

    it('detects a >40% revenue drop as HIGH severity', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { bucket: new Date('2025-11-01'), total: 10000 },
        { bucket: new Date('2025-12-01'), total: 5000 },
      ]);
      const result = await svc.detectRevenueDrop('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('HIGH');
    });

    it('does not flag when revenue increases', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { bucket: new Date('2025-11-01'), total: 5000 },
        { bucket: new Date('2025-12-01'), total: 8000 },
      ]);
      const result = await svc.detectRevenueDrop('org-1');
      expect(result).toHaveLength(0);
    });

    it('does not flag when drop is under 20%', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { bucket: new Date('2025-11-01'), total: 10000 },
        { bucket: new Date('2025-12-01'), total: 8500 },
      ]);
      const result = await svc.detectRevenueDrop('org-1');
      expect(result).toHaveLength(0);
    });
  });

  describe('detectExpenseSpike', () => {
    it('returns insufficientData when fewer than 3 months exist', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { bucket: new Date('2025-12-01'), total: 1000 },
      ]);
      const result = await svc.detectExpenseSpike('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].insufficientData).toBe(true);
    });

    it('detects expenses exceeding 2x rolling average', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { bucket: new Date('2025-10-01'), total: 1000 },
        { bucket: new Date('2025-11-01'), total: 1200 },
        { bucket: new Date('2025-12-01'), total: 5000 },
      ]);
      const result = await svc.detectExpenseSpike('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('EXPENSE_SPIKE');
      expect(result[0].observed).toBe(5000);
      expect(result[0].severity).toBe('HIGH');
    });

    it('does not flag when expenses are within normal range', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { bucket: new Date('2025-10-01'), total: 1000 },
        { bucket: new Date('2025-11-01'), total: 1200 },
        { bucket: new Date('2025-12-01'), total: 1800 },
      ]);
      const result = await svc.detectExpenseSpike('org-1');
      expect(result).toHaveLength(0);
    });
  });

  describe('detectRefundAnomaly', () => {
    it('returns insufficientData when no data exists', async () => {
      const result = await svc.detectRefundAnomaly('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].insufficientData).toBe(true);
    });

    it('detects refund rate exceeding 10%', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 10000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 1500 }]);
      const result = await svc.detectRefundAnomaly('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('REFUND_ANOMALY');
      expect(result[0].observed).toBe(15);
    });

    it('detects refund rate exceeding 20% as HIGH severity', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 10000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 2500 }]);
      const result = await svc.detectRefundAnomaly('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('HIGH');
    });

    it('does not flag when refund rate is under 10%', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 10000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 500 }]);
      const result = await svc.detectRefundAnomaly('org-1');
      expect(result).toHaveLength(0);
    });
  });

  describe('detectDebtIncrease', () => {
    it('returns insufficientData when fewer than 2 months exist', async () => {
      const result = await svc.detectDebtIncrease('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].insufficientData).toBe(true);
    });

    it('detects debt increase exceeding 15%', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { bucket: new Date('2025-11-01'), debt: 10000 },
        { bucket: new Date('2025-12-01'), debt: 12000 },
      ]);
      const result = await svc.detectDebtIncrease('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('DEBT_INCREASE');
      expect(result[0].observed).toBe(12000);
      expect(result[0].baseline).toBe(10000);
    });

    it('does not flag when debt increase is under 15%', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { bucket: new Date('2025-11-01'), debt: 10000 },
        { bucket: new Date('2025-12-01'), debt: 11000 },
      ]);
      const result = await svc.detectDebtIncrease('org-1');
      expect(result).toHaveLength(0);
    });
  });

  describe('detectCashFlowDeterioration', () => {
    it('returns insufficientData when no data exists', async () => {
      const result = await svc.detectCashFlowDeterioration('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].insufficientData).toBe(true);
    });

    it('detects negative cash flow', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 5000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 3000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 4000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 500 }]);
      const result = await svc.detectCashFlowDeterioration('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('CASH_FLOW_NEGATIVE');
      expect(result[0].severity).toBe('HIGH');
    });

    it('does not flag when cash flow is positive', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 10000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 2000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 1000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 200 }]);
      const result = await svc.detectCashFlowDeterioration('org-1');
      expect(result).toHaveLength(0);
    });
  });

  describe('detectPayrollAnomaly', () => {
    it('returns insufficientData when no data exists', async () => {
      const result = await svc.detectPayrollAnomaly('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].insufficientData).toBe(true);
    });

    it('detects payroll exceeding revenue', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 15000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 10000 }]);
      const result = await svc.detectPayrollAnomaly('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('PAYROLL_EXCEEDS_REVENUE');
      expect(result[0].severity).toBe('HIGH');
    });

    it('does not flag when payroll is below revenue', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 5000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 10000 }]);
      const result = await svc.detectPayrollAnomaly('org-1');
      expect(result).toHaveLength(0);
    });
  });

  describe('detectUnusualPaymentTiming', () => {
    it('returns no anomaly when no late payments exist', async () => {
      const result = await svc.detectUnusualPaymentTiming('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('LATE_PAYMENT');
      expect(result[0].severity).toBe('LOW');
    });

    it('detects payments received more than 30 days late', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { paymentId: 'p-1', amount: 500, paidAt: new Date('2026-02-15'), issueDate: new Date('2026-01-01'), daysLate: 45 },
      ]);
      const result = await svc.detectUnusualPaymentTiming('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('LATE_PAYMENT');
      expect(result[0].observed).toBe(45);
    });

    it('classifies >60 days late as HIGH severity', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { paymentId: 'p-1', amount: 500, paidAt: new Date('2026-04-01'), issueDate: new Date('2026-01-01'), daysLate: 90 },
      ]);
      const result = await svc.detectUnusualPaymentTiming('org-1');
      expect(result[0].severity).toBe('HIGH');
    });

    it('classifies 31-60 days late as MEDIUM severity', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { paymentId: 'p-1', amount: 500, paidAt: new Date('2026-02-10'), issueDate: new Date('2026-01-01'), daysLate: 40 },
      ]);
      const result = await svc.detectUnusualPaymentTiming('org-1');
      expect(result[0].severity).toBe('MEDIUM');
    });
  });

  describe('detectEnrollmentDrop', () => {
    it('returns insufficientData when fewer than 4 months exist', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { bucket: new Date('2025-10-01'), count: 10 },
        { bucket: new Date('2025-11-01'), count: 12 },
        { bucket: new Date('2025-12-01'), count: 8 },
      ]);
      const result = await svc.detectEnrollmentDrop('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].insufficientData).toBe(true);
    });

    it('detects enrollment drop >25% below rolling average', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { bucket: new Date('2025-09-01'), count: 20 },
        { bucket: new Date('2025-10-01'), count: 22 },
        { bucket: new Date('2025-11-01'), count: 18 },
        { bucket: new Date('2025-12-01'), count: 5 },
      ]);
      const result = await svc.detectEnrollmentDrop('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ENROLLMENT_DROP');
      expect(result[0].observed).toBe(5);
    });

    it('does not flag when enrollment is within normal range', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { bucket: new Date('2025-09-01'), count: 20 },
        { bucket: new Date('2025-10-01'), count: 22 },
        { bucket: new Date('2025-11-01'), count: 18 },
        { bucket: new Date('2025-12-01'), count: 18 },
      ]);
      const result = await svc.detectEnrollmentDrop('org-1');
      expect(result).toHaveLength(0);
    });
  });

  describe('detectAll', () => {
    it('combines all detectors and sorts by severity', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { bucket: new Date('2025-11-01'), total: 10000 },
          { bucket: new Date('2025-12-01'), total: 5000 },
        ])
        .mockResolvedValueOnce([
          { bucket: new Date('2025-10-01'), total: 1000 },
          { bucket: new Date('2025-11-01'), total: 1200 },
          { bucket: new Date('2025-12-01'), total: 5000 },
        ])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 10000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 1500 }])
        .mockResolvedValueOnce([
          { bucket: new Date('2025-11-01'), debt: 10000 },
          { bucket: new Date('2025-12-01'), debt: 12000 },
        ])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 5000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 3000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 4000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 500 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 15000 }])
        .mockResolvedValueOnce([{ bucket: new Date('2025-12-01'), total: 10000 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { bucket: new Date('2025-09-01'), count: 20 },
          { bucket: new Date('2025-10-01'), count: 22 },
          { bucket: new Date('2025-11-01'), count: 18 },
          { bucket: new Date('2025-12-01'), count: 5 },
        ]);

      const result = await svc.detectAll('org-1');
      expect(result.length).toBeGreaterThan(0);
      const highCount = result.filter((a) => a.severity === 'HIGH').length;
      const mediumCount = result.filter((a) => a.severity === 'MEDIUM').length;
      const lowCount = result.filter((a) => a.severity === 'LOW').length;
      expect(highCount + mediumCount + lowCount).toBe(result.length);
      expect(result.findIndex((a) => a.severity === 'HIGH')).toBeLessThan(result.findIndex((a) => a.severity === 'MEDIUM'));
      expect(result.findIndex((a) => a.severity === 'MEDIUM')).toBeLessThanOrEqual(result.findIndex((a) => a.severity === 'LOW'));
    });
  });

  describe('tenant isolation', () => {
    it('uses parameterized queries for organizationId (no string concatenation)', async () => {
      await svc.detectRevenueDrop('org-tenant-A');
      const calls = prisma.$queryRaw.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        const flatArgs = call.flat();
        const hasTemplateStrings = flatArgs.some(
          (a: unknown) => Array.isArray(a) && a.length > 0 && typeof a[0] === 'string' && a[0].includes('SELECT'),
        );
        const hasOrgIdParam = flatArgs.some(
          (a: unknown) => typeof a === 'string' && a === 'org-tenant-A',
        );
        expect(hasTemplateStrings || hasOrgIdParam).toBe(true);
      }
    });
  });
});
