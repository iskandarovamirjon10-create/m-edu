import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataGovernanceController } from '../data-governance.controller';
import { DataGovernanceService } from '../data-governance.service';
import { UpsertRetentionPolicyDto, ExportLogQueryDto, AccessAuditQueryDto } from '../dto/data-governance.dto';

describe('DataGovernanceController', () => {
  let controller: DataGovernanceController;
  let service: {
    getRetentionPolicies: ReturnType<typeof vi.fn>;
    upsertRetentionPolicy: ReturnType<typeof vi.fn>;
    getExportLog: ReturnType<typeof vi.fn>;
    getExportStats: ReturnType<typeof vi.fn>;
    getDataAccessAudit: ReturnType<typeof vi.fn>;
    executeRetentionCheck: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-1111-1111-1111-1111';

  beforeEach(() => {
    service = {
      getRetentionPolicies: vi.fn(),
      upsertRetentionPolicy: vi.fn(),
      getExportLog: vi.fn(),
      getExportStats: vi.fn(),
      getDataAccessAudit: vi.fn(),
      executeRetentionCheck: vi.fn(),
    };

    controller = new DataGovernanceController(service as unknown as DataGovernanceService);
  });

  it('delegates getRetentionPolicies to service', async () => {
    service.getRetentionPolicies.mockResolvedValue([]);
    const res = await controller.getRetentionPolicies(orgId);
    expect(service.getRetentionPolicies).toHaveBeenCalledWith(orgId);
    expect(res).toEqual([]);
  });

  it('delegates upsertRetentionPolicy to service', async () => {
    const dto: UpsertRetentionPolicyDto = {
      dataType: 'STUDENT_RECORDS',
      retentionDays: 2555,
      archivalDays: 365,
      deleteAfterDays: 3650,
      isActive: true,
    };
    service.upsertRetentionPolicy.mockResolvedValue({ id: 'p1' });

    const res = await controller.upsertRetentionPolicy(orgId, dto);

    expect(service.upsertRetentionPolicy).toHaveBeenCalledWith(
      orgId,
      'STUDENT_RECORDS',
      2555,
      365,
      3650,
      true,
    );
    expect(res).toEqual({ id: 'p1' });
  });

  it('delegates getExportLog to service', async () => {
    const query: ExportLogQueryDto = { page: '1', limit: '10' };
    service.getExportLog.mockResolvedValue({ items: [], total: 0 });

    const res = await controller.getExportLog(orgId, query);

    expect(service.getExportLog).toHaveBeenCalledWith(orgId, query);
    expect(res).toEqual({ items: [], total: 0 });
  });

  it('delegates getExportStats to service', async () => {
    service.getExportStats.mockResolvedValue({ totalExports: 5 });

    const res = await controller.getExportStats(orgId);

    expect(service.getExportStats).toHaveBeenCalledWith(orgId);
    expect(res).toEqual({ totalExports: 5 });
  });

  it('delegates getDataAccessAudit to service', async () => {
    const query: AccessAuditQueryDto = { entityType: 'STUDENT' };
    service.getDataAccessAudit.mockResolvedValue({ items: [], total: 0 });

    const res = await controller.getDataAccessAudit(orgId, query);

    expect(service.getDataAccessAudit).toHaveBeenCalledWith(orgId, query);
    expect(res).toEqual({ items: [], total: 0 });
  });

  it('delegates executeRetentionCheck to service', async () => {
    service.executeRetentionCheck.mockResolvedValue({ policiesChecked: 3 });

    const res = await controller.executeRetentionCheck(orgId);

    expect(service.executeRetentionCheck).toHaveBeenCalledWith(orgId);
    expect(res).toEqual({ policiesChecked: 3 });
  });
});
