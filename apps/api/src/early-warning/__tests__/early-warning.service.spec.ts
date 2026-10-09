import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EarlyWarningService } from '../early-warning.service';
import type { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    payment: {
      findMany: vi.fn(),
    },
    lead: {
      findMany: vi.fn(),
    },
    attendance: {
      findMany: vi.fn(),
    },
  };
}

describe('EarlyWarningService', () => {
  let svc: EarlyWarningService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new EarlyWarningService(prisma as unknown as PrismaService);
    vi.clearAllMocks();
  });

  describe('getSummary', () => {
    it('aggregates overdue payments, stale leads, and low attendance', async () => {
      prisma.payment.findMany.mockResolvedValue([
        {
          id: 'pay-1',
          amount: 500,
          updatedAt: new Date(),
          student: { user: { firstName: 'Ali', lastName: 'Valiyev' } },
        },
      ]);
      prisma.lead.findMany.mockResolvedValue([
        {
          id: 'lead-1',
          firstName: 'John',
          lastName: 'Doe',
          updatedAt: new Date(),
        },
      ]);
      // 3 attendance records, 1 PRESENT -> 33% rate (<70%)
      prisma.attendance.findMany.mockResolvedValue([
        {
          studentId: 'st-1',
          status: 'PRESENT',
          student: { user: { firstName: 'Sardor', lastName: 'Karimov' } },
        },
        {
          studentId: 'st-1',
          status: 'ABSENT',
          student: { user: { firstName: 'Sardor', lastName: 'Karimov' } },
        },
        {
          studentId: 'st-1',
          status: 'ABSENT',
          student: { user: { firstName: 'Sardor', lastName: 'Karimov' } },
        },
      ]);

      const summary = await svc.getSummary('org-1');
      expect(summary.total).toBe(3);
      expect(summary.critical).toBe(1); // 1 payment
      expect(summary.high).toBe(1); // 1 low attendance
      expect(summary.byRule['payment-overdue']).toBe(1);
      expect(summary.byRule['lead-stale']).toBe(1);
      expect(summary.byRule['attendance-low']).toBe(1);
    });
  });

  describe('findAll', () => {
    it('filters by severity and applies pagination', async () => {
      prisma.payment.findMany.mockResolvedValue([
        {
          id: 'pay-1',
          amount: 500,
          updatedAt: new Date(),
          student: null,
        },
      ]);
      prisma.lead.findMany.mockResolvedValue([
        {
          id: 'lead-1',
          firstName: 'John',
          lastName: null,
          updatedAt: new Date(),
        },
      ]);
      prisma.attendance.findMany.mockResolvedValue([]);

      const res = await svc.findAll('org-1', { severity: 'CRITICAL', page: 1, limit: 10 });
      expect(res.total).toBe(1);
      expect(res.items[0].entityType).toBe('PAYMENT');
      expect(res.items[0].severity).toBe('CRITICAL');
    });

    it('filters by ruleId and entityType', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.lead.findMany.mockResolvedValue([
        {
          id: 'lead-1',
          firstName: 'Lead',
          lastName: 'One',
          updatedAt: new Date(),
        },
      ]);
      prisma.attendance.findMany.mockResolvedValue([]);

      const res = await svc.findAll('org-1', { ruleId: 'lead-stale', entityType: 'LEAD' });
      expect(res.total).toBe(1);
      expect(res.items[0].id).toBe('lead-lead-1');
    });
  });

  describe('runScan', () => {
    it('returns counts of scanned items', async () => {
      prisma.payment.findMany.mockResolvedValue([{ id: 'p1' }]);
      prisma.lead.findMany.mockResolvedValue([{ id: 'l1' }]);
      prisma.attendance.findMany.mockResolvedValue([]);

      const res = await svc.runScan('org-1');
      expect(res.detected).toBe(2);
      expect(res.scanned).toBe(2);
      expect(res.created).toBe(0);
      expect(res.fixed).toBe(0);
    });
  });

  describe('resolve', () => {
    it('fails loudly instead of faking success (M2)', async () => {
      await expect(
        svc.resolve('org-1', 'payment-1', 'user-1', 'Handled'),
      ).rejects.toThrow('EarlyWarning model');
    });
  });
});
