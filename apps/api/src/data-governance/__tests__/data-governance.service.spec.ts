import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataGovernanceService } from '../data-governance.service';
import { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    dataRetentionPolicy: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    dataExportLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      groupBy: vi.fn(),
      findFirst: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    student: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    payment: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    expense: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    lead: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  } as unknown as PrismaService;
}

describe('DataGovernanceService', () => {
  let svc: DataGovernanceService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new DataGovernanceService(prisma);
    vi.clearAllMocks();
  });

  describe('getRetentionPolicies — tenant isolation', () => {
    it('always filters by organizationId', async () => {
      prisma.dataRetentionPolicy.findMany.mockResolvedValue([]);
      await svc.getRetentionPolicies('org-xyz');
      expect(prisma.dataRetentionPolicy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-xyz' } }),
      );
    });
  });

  describe('upsertRetentionPolicy', () => {
    it('calls upsert with correct unique constraint', async () => {
      prisma.dataRetentionPolicy.upsert.mockResolvedValue({ id: 'p1' });
      await svc.upsertRetentionPolicy('org-1', 'STUDENT_RECORDS', 2555, 365, 3650, true);
      expect(prisma.dataRetentionPolicy.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId_dataType: { organizationId: 'org-1', dataType: 'STUDENT_RECORDS' } },
          create: expect.objectContaining({ retentionDays: 2555, archivalDays: 365, deleteAfterDays: 3650, isActive: true }),
          update: expect.objectContaining({ retentionDays: 2555, archivalDays: 365, deleteAfterDays: 3650, isActive: true }),
        }),
      );
    });
  });

  describe('getExportLog', () => {
    it('returns paginated results', async () => {
      prisma.dataExportLog.findMany.mockResolvedValue([]);
      prisma.dataExportLog.count.mockResolvedValue(0);
      const r = await svc.getExportLog('org-1', { page: '1', limit: '10' });
      expect(r.page).toBe(1);
      expect(r.limit).toBe(10);
      expect(r.total).toBe(0);
    });

    it('filters by exportType', async () => {
      prisma.dataExportLog.findMany.mockResolvedValue([]);
      prisma.dataExportLog.count.mockResolvedValue(0);
      await svc.getExportLog('org-1', { exportType: 'STUDENTS' });
      const where = prisma.dataExportLog.findMany.mock.calls[0][0].where;
      expect(where.exportType).toBe('STUDENTS');
    });

    it('filters by date range', async () => {
      prisma.dataExportLog.findMany.mockResolvedValue([]);
      prisma.dataExportLog.count.mockResolvedValue(0);
      await svc.getExportLog('org-1', { fromDate: '2024-01-01', toDate: '2024-12-31' });
      const where = prisma.dataExportLog.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(where.createdAt.lte).toBeInstanceOf(Date);
    });
  });

  describe('logExport', () => {
    it('creates export log entry with COMPLETED status', async () => {
      prisma.dataExportLog.create.mockResolvedValue({ id: 'e1' });
      await svc.logExport('org-1', 'u-1', 'STUDENTS', 'CSV', 100, '127.0.0.1', 'Audit');
      expect(prisma.dataExportLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            userId: 'u-1',
            exportType: 'STUDENTS',
            format: 'CSV',
            recordCount: 100,
            status: 'COMPLETED',
          }),
        }),
      );
    });
  });

  describe('getExportStats', () => {
    it('returns aggregated stats', async () => {
      prisma.dataExportLog.count.mockResolvedValueOnce(50);
      prisma.dataExportLog.groupBy.mockResolvedValue([
        { exportType: 'STUDENTS', _count: { id: 30 } },
        { exportType: 'PAYMENTS', _count: { id: 20 } },
      ]);
      prisma.dataExportLog.count.mockResolvedValueOnce(5);
      prisma.dataExportLog.findFirst.mockResolvedValue(null);

      const r = await svc.getExportStats('org-1');
      expect(r.totalExports).toBe(50);
      expect(r.byType).toHaveLength(2);
      expect(r.byType[0].type).toBe('STUDENTS');
      expect(r.byType[0].count).toBe(30);
    });
  });

  describe('getDataAccessAudit', () => {
    it('filters by sensitive resources only', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await svc.getDataAccessAudit('org-1', {});
      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.resource.in).toContain('STUDENT');
      expect(where.resource.in).toContain('PAYMENT');
      expect(where.resource.in).toContain('EMPLOYEE');
    });

    it('hydrates actor names', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        { id: 'a1', action: 'CREATE', resource: 'STUDENT', resourceId: 's1', userId: 'u-1', ipAddress: '127.0.0.1', timestamp: new Date() },
      ]);
      prisma.auditLog.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u-1', firstName: 'Ali', lastName: 'Karim', email: 'ali@x.com' },
      ]);

      const r = await svc.getDataAccessAudit('org-1', {});
      expect(r.items[0].userName).toBe('Ali Karim');
    });
  });

  describe('executeRetentionCheck', () => {
    it('returns results for each active policy without deleting data', async () => {
      prisma.dataRetentionPolicy.findMany.mockResolvedValue([
        { id: 'p1', dataType: 'STUDENT_RECORDS', retentionDays: 2555, archivalDays: 365, deleteAfterDays: 3650, isActive: true },
      ]);
      prisma.student.findFirst.mockResolvedValue({ createdAt: new Date('2020-01-01') });
      prisma.student.count.mockResolvedValue(5);
      prisma.dataRetentionPolicy.updateMany.mockResolvedValue({ count: 1 });

      const r = await svc.executeRetentionCheck('org-1');
      expect(r.policiesChecked).toBe(1);
      expect(r.results).toHaveLength(1);
      expect(r.results[0].dataType).toBe('STUDENT_RECORDS');
      expect(r.results[0].archivalCandidates).toBe(5);
    });

    it('updates lastRunAt after check', async () => {
      prisma.dataRetentionPolicy.findMany.mockResolvedValue([]);
      prisma.dataRetentionPolicy.updateMany.mockResolvedValue({ count: 0 });

      await svc.executeRetentionCheck('org-1');
      expect(prisma.dataRetentionPolicy.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', isActive: true },
          data: { lastRunAt: expect.any(Date) },
        }),
      );
    });

    it('does not delete any data', async () => {
      prisma.dataRetentionPolicy.findMany.mockResolvedValue([]);
      prisma.dataRetentionPolicy.updateMany.mockResolvedValue({ count: 0 });

      await svc.executeRetentionCheck('org-1');
      expect(prisma.student.deleteMany).toBeUndefined();
      expect(prisma.payment.deleteMany).toBeUndefined();
      expect(prisma.auditLog.deleteMany).toBeUndefined();
    });
  });
});
