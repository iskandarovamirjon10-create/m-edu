/**
 * Regression test for the enrollment contract fix:
 * POST /face/enrollments returns { enrollmentId, status } — the shape the
 * frontend FaceEnrollment page consumes (previously it read `.id`).
 */
import { describe, it, expect, vi } from 'vitest';
import { EnrollmentService } from '../application/enrollment.service';
import type { EnrollmentRepository } from '../ports/enrollment-repository.port';
import type { StudentDirectoryPort } from '../ports/student-directory.port';

const tenant = { userId: 'user-1', email: 'admin@t', role: 'ORG_ADMIN', organizationId: 'org-1' };

describe('EnrollmentService contract (start enrollment)', () => {
  it('returns { enrollmentId, status: PENDING } — the shape the frontend consumes', async () => {
    const enrollmentRepo = {
      findByStudentId: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'env-abc', organizationId: 'org-1', studentId: 'student-1', status: 'PENDING',
        enrolledBy: 'user-1', enrolledAt: new Date(), activatedAt: null, revokedAt: null,
        revokedBy: null, revocationReason: null, metadata: null, createdAt: new Date(), updatedAt: new Date(),
      }),
    } as any;
    const studentDir = {
      getStudent: vi.fn().mockResolvedValue({ id: 'student-1', isActive: true }),
    } as any;

    const svc = new EnrollmentService(
      enrollmentRepo as EnrollmentRepository,
      ({} as any),
      ({} as any),
      { requirePermission: vi.fn().mockResolvedValue(undefined) } as any,
      { log: vi.fn().mockResolvedValue(undefined) } as any,
      studentDir as StudentDirectoryPort,
      { maxFacesPerImage: 1, enrollmentRetryLimit: 3 },
    );

    const result = await svc.startEnrollment(tenant, 'student-1');
    expect(result.enrollmentId).toBe('env-abc');
    expect(result.status).toBe('PENDING');
  });
});
