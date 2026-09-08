import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetentionService } from '../retention.service';

describe('RetentionService — biometric lifecycle', () => {
  let mockEnrollmentRepo: any;
  let mockAudit: any;

  beforeEach(() => {
    mockEnrollmentRepo = {
      list: vi.fn(),
      findByStudentId: vi.fn(),
      revokeTemplates: vi.fn(),
      updateStatus: vi.fn(),
    };
    mockAudit = {
      log: vi.fn().mockResolvedValue({}),
      query: vi.fn(),
    };
  });

  it('expires enrollment when all templates are past expiry', async () => {
    const expired = new Date(Date.now() - 1000);
    mockEnrollmentRepo.list.mockResolvedValue({
      items: [
        {
          id: 'enr-1',
          organizationId: 'org-1',
          studentId: 'stu-1',
          templates: [
            { id: 't1', expiresAt: expired },
            { id: 't2', expiresAt: expired },
          ],
        },
      ],
      total: 1,
    });

    const svc = new RetentionService(mockEnrollmentRepo, mockAudit);
    const result = await svc.expireStaleEnrollments('org-1');

    expect(result.processed).toBe(1);
    expect(result.revoked).toBe(1);
    expect(mockEnrollmentRepo.revokeTemplates).toHaveBeenCalledWith('org-1', 'enr-1');
    expect(mockEnrollmentRepo.updateStatus).toHaveBeenCalledWith(
      'org-1',
      'enr-1',
      'EXPIRED',
      expect.any(Object),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'RETENTION_POLICY_APPLIED' }),
    );
  });

  it('does not expire enrollment with unexpired templates', async () => {
    const future = new Date(Date.now() + 100000);
    mockEnrollmentRepo.list.mockResolvedValue({
      items: [
        {
          id: 'enr-2',
          templates: [{ id: 't1', expiresAt: future }],
        },
      ],
      total: 1,
    });

    const svc = new RetentionService(mockEnrollmentRepo, mockAudit);
    const result = await svc.expireStaleEnrollments('org-1');
    expect(result.revoked).toBe(0);
  });

  it('deletes student biometrics on consent revocation', async () => {
    mockEnrollmentRepo.findByStudentId.mockResolvedValue({
      id: 'enr-3',
      organizationId: 'org-1',
      studentId: 'stu-1',
    });

    const svc = new RetentionService(mockEnrollmentRepo, mockAudit);
    const result = await svc.deleteStudentBiometrics('org-1', 'stu-1', 'consent revoked');

    expect(result.deleted).toBe(1);
    expect(mockEnrollmentRepo.revokeTemplates).toHaveBeenCalledWith('org-1', 'enr-3');
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TEMPLATE_DELETED' }),
    );
  });

  it('returns empty result when student has no enrollment', async () => {
    mockEnrollmentRepo.findByStudentId.mockResolvedValue(null);
    const svc = new RetentionService(mockEnrollmentRepo, mockAudit);
    const result = await svc.deleteStudentBiometrics('org-1', 'missing', 'test');
    expect(result.processed).toBe(0);
    expect(result.deleted).toBe(0);
  });
});
