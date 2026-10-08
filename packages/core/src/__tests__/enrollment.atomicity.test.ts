/**
 * Regression tests: revoke / re-enroll are ATOMIC.
 *
 * Previously EnrollmentService revoked templates, then updated the enrollment
 * status, then (for re-enrollment) created a replacement as three INDEPENDENT
 * writes. A crash between them left a REVOKED enrollment with ACTIVE biometric
 * templates or a student revoked without a replacement.
 *
 * The service must now delegate to the repository's transactional
 * `revokeEnrollmentAndTemplates` / `atomicReenroll` methods — never to the
 * individual non-atomic helpers.
 */
import { describe, it, expect, vi } from 'vitest';
import { EnrollmentService } from '../application/enrollment.service';
import type { EnrollmentRepository } from '../ports/enrollment-repository.port';

const tenant = { userId: 'user-1', email: 'admin@t', role: 'ORG_ADMIN', organizationId: 'org-1' };

function enrollmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'env-1', organizationId: 'org-1', studentId: 'student-1', status: 'ACTIVE',
    enrolledBy: 'user-1', enrolledAt: new Date(), activatedAt: new Date(),
    revokedAt: null, revokedBy: null, revocationReason: null,
    metadata: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  const repo: any = {
    findById: vi.fn().mockResolvedValue({ ...enrollmentRow(), faceTemplates: [], student: null }),
    revokeEnrollmentAndTemplates: vi.fn().mockResolvedValue(enrollmentRow({ status: 'REVOKED' })),
    atomicReenroll: vi.fn().mockResolvedValue({
      old: enrollmentRow({ status: 'REVOKED' }),
      enrolled: enrollmentRow({ id: 'env-2', status: 'PENDING', activatedAt: null }),
    }),
    // The unsafe primitives must NEVER be called directly anymore.
    revokeTemplates: vi.fn(),
    updateStatus: vi.fn(),
    create: vi.fn(),
    ...overrides,
  };
  return repo as EnrollmentRepository;
}

function makeService(repo: EnrollmentRepository) {
  return new EnrollmentService(
    repo,
    ({} as any),
    ({} as any),
    { requirePermission: vi.fn().mockResolvedValue(undefined) } as any,
    { log: vi.fn().mockResolvedValue(undefined) } as any,
    ({} as any),
    { maxFacesPerImage: 1, enrollmentRetryLimit: 3 },
  );
}

describe('EnrollmentService.revokeEnrollment atomicity', () => {
  it('delegates to revokeEnrollmentAndTemplates instead of the two-step path', async () => {
    const repo = makeRepo();
    const svc = makeService(repo);

    await svc.revokeEnrollment(tenant, 'env-1', 'left the school');

    expect(repo.revokeEnrollmentAndTemplates).toHaveBeenCalledTimes(1);
    expect(repo.revokeEnrollmentAndTemplates).toHaveBeenCalledWith(
      'org-1',
      'env-1',
      expect.objectContaining({
        revokedBy: 'user-1',
        revocationReason: 'left the school',
      }),
    );

    // Regression: the non-atomic primitives must not be used.
    expect(repo.revokeTemplates).not.toHaveBeenCalled();
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('still rejects unknown enrollments before touching templates', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const svc = makeService(repo);

    await expect(svc.revokeEnrollment(tenant, 'env-unknown', 'r')).rejects.toThrow(
      'Enrollment not found',
    );
    expect(repo.revokeEnrollmentAndTemplates).not.toHaveBeenCalled();
  });
});

describe('EnrollmentService.reenrollStudent atomicity', () => {
  it('delegates to atomicReenroll instead of three independent writes', async () => {
    const repo = makeRepo();
    const svc = makeService(repo);

    const result = await svc.reenrollStudent(tenant, 'env-1', 'new face');

    expect(repo.atomicReenroll).toHaveBeenCalledTimes(1);
    expect(repo.atomicReenroll).toHaveBeenCalledWith(
      'org-1',
      'env-1',
      expect.objectContaining({
        revokedBy: 'user-1',
        revocationReason: 'Re-enrollment: new face',
      }),
    );

    expect(result.newEnrollmentId).toBe('env-2');

    // Regression: the non-atomic primitives must not be used.
    expect(repo.revokeTemplates).not.toHaveBeenCalled();
    expect(repo.updateStatus).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });
});