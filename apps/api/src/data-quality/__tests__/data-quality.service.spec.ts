/**
 * Unit tests for DataQualityService — 8 deterministic rules.
 * NO AI. All logic is explicit threshold checks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataQualityService } from '../data-quality.service';
import { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    dataQualityIssue: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    student: {
      findMany: vi.fn(),
    },
    lead: {
      findMany: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
    },
    group: {
      findMany: vi.fn(),
    },
    teacher: {
      findMany: vi.fn(),
    },
    libraryBook: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
}

describe('DataQualityService', () => {
  let svc: DataQualityService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new DataQualityService(prisma);
    vi.clearAllMocks();
  });

  describe('getSummary', () => {
    it('returns zero counts when no issues exist', async () => {
      prisma.dataQualityIssue.count.mockResolvedValue(0);
      prisma.dataQualityIssue.groupBy.mockResolvedValue([]);
      const result = await svc.getSummary('org-1');
      expect(result.total).toBe(0);
    });

    it('counts unresolved issues', async () => {
      prisma.dataQualityIssue.count
        .mockResolvedValueOnce(5)   // total
        .mockResolvedValueOnce(7);  // resolvedThisWeek
      prisma.dataQualityIssue.groupBy
        .mockResolvedValueOnce([{ severity: 'HIGH', _count: 2 }])  // bySeverity
        .mockResolvedValueOnce([]);  // byCategory
      const result = await svc.getSummary('org-1');
      expect(result.total).toBe(5);
    });
  });

  describe('runAllChecks', () => {
    it('runs all 8 quality rules without crashing', async () => {
      prisma.student.findMany.mockResolvedValue([]);
      prisma.lead.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.group.findMany.mockResolvedValue([]);
      prisma.teacher.findMany.mockResolvedValue([]);
      prisma.libraryBook.findMany.mockResolvedValue([]);
      prisma.dataQualityIssue.upsert.mockResolvedValue({} as never);

      const result = await svc.runAllChecks('org-1');

      // 8 rules × 1 empty result = 0 total issues
      expect(result.total).toBe(0);
    });

    it('upserts issues detected by student-missing-email rule', async () => {
      // Simulate one student missing email
      prisma.student.findMany.mockResolvedValueOnce([
        { id: 's1', user: { firstName: 'Ali', lastName: 'Vali' } },
      ]);
      // All other rules return empty
      prisma.student.findMany.mockResolvedValue([]);
      prisma.lead.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.group.findMany.mockResolvedValue([]);
      prisma.teacher.findMany.mockResolvedValue([]);
      prisma.libraryBook.findMany.mockResolvedValue([]);
      prisma.dataQualityIssue.upsert.mockResolvedValue({} as never);

      const result = await svc.runAllChecks('org-1');

      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    it('continues running other rules when one throws', async () => {
      prisma.student.findMany
        .mockRejectedValueOnce(new Error('DB error')) // first student check fails
        .mockResolvedValue([]); // subsequent calls succeed
      prisma.lead.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.group.findMany.mockResolvedValue([]);
      prisma.teacher.findMany.mockResolvedValue([]);
      prisma.libraryBook.findMany.mockResolvedValue([]);
      prisma.dataQualityIssue.upsert.mockResolvedValue({} as never);

      // Should NOT throw — errors are caught internally
      const result = await svc.runAllChecks('org-1');
      expect(result).toBeDefined();
    });
  });

  describe('getIssues', () => {
    it('returns issues filtered by severity', async () => {
      const mockIssue = {
        id: 'q1', organizationId: 'org-1', entityType: 'STUDENT',
        entityId: 's1', ruleId: 'student-missing-email', category: 'OTHER',
        severity: 'HIGH', field: 'email', message: 'Missing email',
        detectedAt: new Date(), resolvedAt: null, resolvedBy: null, resolutionNote: null,
      };
      prisma.dataQualityIssue.findMany.mockResolvedValue([mockIssue]);

      const result = await svc.getIssues('org-1', { severity: 'HIGH', limit: 10 });

      expect(prisma.dataQualityIssue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ severity: 'HIGH' }) }),
      );
      expect(result).toHaveLength(1);
    });

    it('filters unresolved issues when resolved=false', async () => {
      prisma.dataQualityIssue.findMany.mockResolvedValue([]);
      await svc.getIssues('org-1', { resolved: 'false' });
      expect(prisma.dataQualityIssue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ resolvedAt: null }) }),
      );
    });
  });

  describe('resolveIssue', () => {
    it('updates resolvedAt, resolvedBy, resolutionNote', async () => {
      prisma.dataQualityIssue.updateMany.mockResolvedValue({ count: 1 });
      await svc.resolveIssue('org-1', 'q1', 'user-1', 'Fixed manually');
      expect(prisma.dataQualityIssue.updateMany).toHaveBeenCalledWith({
        where: { id: 'q1', organizationId: 'org-1' },
        data: expect.objectContaining({
          resolvedAt: expect.any(Date),
          resolvedBy: 'user-1',
          resolutionNote: 'Fixed manually',
        }),
      });
    });
  });

  describe('rule definitions', () => {
    it('has exactly 8 rules', () => {
      const rules = (svc as unknown as { rules: Array<{ id: string }> }).rules;
      expect(rules).toHaveLength(8);
    });

    it('every rule has a unique id', () => {
      const rules = (svc as unknown as { rules: Array<{ id: string }> }).rules;
      const ids = rules.map(r => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every rule has severity from the allowed set', () => {
      const rules = (svc as unknown as { rules: Array<{ severity: string }> }).rules;
      const allowed = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
      rules.forEach(r => {
        expect(allowed.has(r.severity)).toBe(true);
      });
    });
  });
});
