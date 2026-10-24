import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityService } from '../security.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * SecurityService derives alerts from AuditLog.
 * Alerts are grouped by IP for repeated LOGIN_FAILED entries;
 * "resolving" an alert writes to DataQualityIssue.
 */
function createMockPrisma() {
  return {
    auditLog: { findMany: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'res-log-1' }) },
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
    service = new SecurityService(mockPrisma as unknown as PrismaService);
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

    it('does not silence a new wave of failed logins occurring after an earlier resolution', async () => {
      const earlierResolution = new Date(Date.now() - 3600_000);
      const newAttack = new Date(Date.now() - 60_000);

      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-res-1',
          action: 'SECURITY_ALERT_RESOLVED',
          resource: 'SecurityAlert',
          resourceId: 'login-failed-1.2.3.4',
          organizationId: 'org-1',
          userId: 'admin-1',
          changes: { note: 'old resolution' },
          timestamp: earlierResolution,
        },
        {
          id: 'log-attack-1',
          action: 'LOGIN_FAILED',
          resource: 'Auth',
          resourceId: null,
          organizationId: 'org-1',
          userId: null,
          ipAddress: '1.2.3.4',
          timestamp: newAttack,
        },
      ]);

      const result = await service.findAlerts('org-1', {});
      const ipAlert = result.items.find((a) => a.id === 'login-failed-1.2.3.4');
      expect(ipAlert).toBeDefined();
      expect(ipAlert?.resolvedAt).toBeNull();
    });
  });

  describe('resolve', () => {
    it('persists resolution in AuditLog and returns ok: true', async () => {
      const res = await service.resolve('org-1', 'evt-1', 'admin-1', 'handled');
      expect(res).toEqual({ ok: true });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          userId: 'admin-1',
          action: 'SECURITY_ALERT_RESOLVED',
          resource: 'SecurityAlert',
          resourceId: 'evt-1',
          changes: expect.objectContaining({
            note: 'handled',
            resolvedBy: 'admin-1',
          }),
        }),
      });
    });
  });
});
