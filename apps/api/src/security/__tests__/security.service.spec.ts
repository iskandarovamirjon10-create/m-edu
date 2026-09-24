import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SecurityService } from '../security.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * SecurityService derives alerts from AuditLog.
 * Alerts are grouped by IP for repeated LOGIN_FAILED entries;
 * "resolving" an alert writes to DataQualityIssue.
 */
function createMockPrisma() {
  return {
    auditLog: { findMany: vi.fn() },
    dataQualityIssue: { updateMany: vi.fn() },
  };
}

const log = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'log-1',
  organizationId: 'org-1',
  action: 'LOGIN_FAILED',
  resource: 'Auth',
  resourceId: null,
  ipAddress: '1.2.3.4',
  timestamp: new Date(),
  ...over,
});

describe('SecurityService', () => {
  let service: SecurityService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [SecurityService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SecurityService>(SecurityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSummary', () => {
    it('groups repeated LOGIN_FAILED from one IP into a single CRITICAL alert', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        log({ id: 'l1' }),
        log({ id: 'l2' }),
        log({ id: 'l3' }),
        log({ id: 'l4' }),
        log({ id: 'l5' }),
      ]);

      const result = await service.getSummary('org-1');

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            action: { in: expect.arrayContaining(['LOGIN_FAILED', 'UNAUTHORIZED_ACCESS']) },
          }),
        }),
      );
      expect(result.total).toBe(1);
      expect(result.byType.LOGIN_FAILED).toBe(1);
      expect(result.bySeverity.CRITICAL).toBe(1);
      expect(result.riskScore).toBe(40);
    });

    it('weights the risk score by severity and counts unresolved alerts only', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        log({ id: 'a', action: 'UNAUTHORIZED_ACCESS', ipAddress: '10.0.0.1' }),
        log({ id: 'b', action: 'PERMISSION_DENIED', ipAddress: '10.0.0.2' }),
        log({ id: 'c', action: 'MFA_DISABLED', ipAddress: '10.0.0.3' }),
      ]);

      const result = await service.getSummary('org-1');

      // CRITICAL(40) + MEDIUM(10) + CRITICAL(40)
      expect(result.bySeverity).toEqual({ CRITICAL: 2, MEDIUM: 1 });
      expect(result.riskScore).toBe(90);
      expect(result.byStatus.unresolved).toBe(3);
      expect(result.byStatus.resolved).toBe(0);
    });

    it('returns an empty, zeroed summary when there is no audit activity', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getSummary('org-1');

      expect(result.total).toBe(0);
      expect(result.riskScore).toBe(0);
      expect(result.bySeverity).toEqual({});
      expect(result.byStatus).toEqual({ resolved: 0, unresolved: 0 });
    });
  });

  describe('findAlerts', () => {
    beforeEach(() => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        log({ id: 'a', action: 'UNAUTHORIZED_ACCESS', ipAddress: '10.0.0.1' }),
        log({ id: 'b', action: 'PERMISSION_DENIED', ipAddress: '10.0.0.2' }),
        log({ id: 'c', action: 'RATE_LIMIT_EXCEEDED', ipAddress: '10.0.0.3' }),
      ]);
    });

    it('filters by severity', async () => {
      const result = await service.findAlerts('org-1', { severity: 'CRITICAL' });
      expect(result.total).toBe(1);
      expect(result.items[0].type).toBe('UNAUTHORIZED_ACCESS');
    });

    it('filters by type', async () => {
      const result = await service.findAlerts('org-1', { type: 'PERMISSION_DENIED' });
      expect(result.total).toBe(1);
      expect(result.items[0].severity).toBe('MEDIUM');
    });

    it('paginates the derived alerts', async () => {
      const result = await service.findAlerts('org-1', { skip: 1, take: 1 });
      expect(result.total).toBe(3);
      expect(result.items).toHaveLength(1);
    });
  });

  describe('resolve', () => {
    it('persists the resolution on the matching security issue', async () => {
      mockPrisma.dataQualityIssue.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.resolve('org-1', 'evt-1', 'admin-1', 'handled');

      expect(mockPrisma.dataQualityIssue.updateMany).toHaveBeenCalledWith({
        where: { id: 'evt-1', organizationId: 'org-1' },
        data: {
          resolvedAt: expect.any(Date),
          resolvedBy: 'admin-1',
          resolutionNote: 'handled',
        },
      });
      expect(result).toEqual({ ok: true });
    });

    it('stores a null note when none is given', async () => {
      mockPrisma.dataQualityIssue.updateMany.mockResolvedValue({ count: 0 });

      await service.resolve('org-1', 'evt-1', 'admin-1');

      expect(mockPrisma.dataQualityIssue.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ resolutionNote: null }) }),
      );
    });
  });
});
