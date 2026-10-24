import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EarlyWarningService } from '../early-warning.service';
import type { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    payment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    lead: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    attendance: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'log-1' }),
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
      prisma.auditLog.findMany.mockResolvedValue([]);

      const summary = await svc.getSummary('org-1');
      expect(summary.total).toBe(3);
      expect(summary.critical).toBe(1); // 1 payment
      expect(summary.high).toBe(1); // 1 low attendance
      expect(summary.byRule['payment-overdue']).toBe(1);
      expect(summary.byRule['lead-stale']).toBe(1);
      expect(summary.byRule['attendance-low']).toBe(1);
    });

    it('does not falsely penalize LATE or EXCUSED attendance as truant (LOGIC-01)', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.lead.findMany.mockResolvedValue([]);
      // 3 records: 1 PRESENT, 1 LATE, 1 EXCUSED -> 100% attendance rate (not <70%)
      prisma.attendance.findMany.mockResolvedValue([
        {
          studentId: 'st-good',
          status: 'PRESENT',
          student: { user: { firstName: 'Jasur', lastName: 'Aliyev' } },
        },
        {
          studentId: 'st-good',
          status: 'LATE',
          student: { user: { firstName: 'Jasur', lastName: 'Aliyev' } },
        },
        {
          studentId: 'st-good',
          status: 'EXCUSED',
          student: { user: { firstName: 'Jasur', lastName: 'Aliyev' } },
        },
      ]);
      prisma.auditLog.findMany.mockResolvedValue([]);

      const summary = await svc.getSummary('org-1');
      expect(summary.total).toBe(0);
      expect(summary.high).toBe(0);
      expect(summary.byRule['attendance-low']).toBe(0);
    });

    it('filters out resolved warnings and counts resolvedThisWeek', async () => {
      prisma.payment.findMany.mockResolvedValue([
        {
          id: 'pay-1',
          amount: 500,
          updatedAt: new Date(),
          student: { user: { firstName: 'Ali', lastName: 'Valiyev' } },
        },
      ]);
      prisma.lead.findMany.mockResolvedValue([]);
      prisma.attendance.findMany.mockResolvedValue([]);
      prisma.auditLog.findMany.mockResolvedValue([
        { resourceId: 'payment-pay-1' },
      ]);

      const summary = await svc.getSummary('org-1');
      expect(summary.total).toBe(0);
      expect(summary.resolvedThisWeek).toBe(1);
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
      prisma.auditLog.findMany.mockResolvedValue([]);

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
      prisma.auditLog.findMany.mockResolvedValue([]);

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
      prisma.auditLog.findMany.mockResolvedValue([]);

      const res = await svc.runScan('org-1');
      expect(res.detected).toBe(2);
      expect(res.scanned).toBe(2);
      expect(res.created).toBe(0);
      expect(res.fixed).toBe(0);
    });
  });

  describe('resolve', () => {
    it('persists early warning resolution to audit log and returns ok', async () => {
      const res = await svc.resolve('org-1', 'payment-1', 'user-1', 'Handled');
      expect(res).toEqual({ ok: true });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          userId: 'user-1',
          action: 'EARLY_WARNING_RESOLVED',
          resource: 'EarlyWarning',
          resourceId: 'payment-1',
          changes: {
            warningId: 'payment-1',
            note: 'Handled',
            resolvedBy: 'user-1',
            resolvedAt: expect.any(String),
          },
        },
      });
    });
  });
});
