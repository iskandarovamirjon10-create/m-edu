import { describe, it, expect, vi } from 'vitest';
import { EnrollmentService } from '../application/enrollment.service';
import { DuplicateFaceEnrollmentError } from '../domain/errors';
import { FaceEmbedding } from '../domain/value-objects';

const tenant = { userId: 'user-1', email: 'admin@t', role: 'ORG_ADMIN', organizationId: 'org-1' };

describe('EnrollmentService duplicate face detection (M-EDU-BIO-001)', () => {
  it('throws DuplicateFaceEnrollmentError when a match with another student exceeds threshold', async () => {
    const rawVector = new Float32Array(128).fill(0.1);
    const mockEmbedding = new FaceEmbedding(rawVector);

    const existingEmbedding = new FaceEmbedding(rawVector);
    const serializedExisting = existingEmbedding.serialize();

    const repo: any = {
      findById: vi.fn().mockResolvedValue({
        id: 'env-1',
        organizationId: 'org-1',
        studentId: 'student-new',
        status: 'PENDING',
        faceTemplates: [],
      }),
      streamActiveTemplates: vi.fn(async function* () {
        yield [
          {
            id: 'tmpl-1',
            studentId: 'student-existing',
            templateData: 'encrypted-bytes',
          },
        ];
      }),
      createTemplateAndActivateEnrollment: vi.fn(),
    };

    const faceEngine: any = {
      isAvailable: vi.fn().mockResolvedValue(true),
      detectFaces: vi.fn().mockResolvedValue([
        { boundingBox: { x: 0, y: 0, width: 100, height: 100 }, confidence: 0.95 },
      ]),
      assessQuality: vi.fn().mockResolvedValue({ overallScore: 0.95, passesThreshold: true }),
      checkLiveness: vi.fn().mockResolvedValue({ decision: 'PASS', confidence: 0.99 }),
      generateEmbedding: vi.fn().mockResolvedValue(mockEmbedding),
      compareEmbeddings: vi.fn().mockResolvedValue(0.92), // Exceeds default 0.8 threshold
    };

    const encryption: any = {
      decrypt: vi.fn().mockResolvedValue(serializedExisting),
      encrypt: vi.fn().mockResolvedValue('encrypted-data'),
      hash: vi.fn().mockResolvedValue('hash-123'),
    };

    const audit: any = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    const svc = new EnrollmentService(
      repo,
      faceEngine,
      encryption,
      { requirePermission: vi.fn().mockResolvedValue(undefined) } as any,
      audit,
      {} as any,
      { maxFacesPerImage: 1, enrollmentRetryLimit: 3, duplicateFaceThreshold: 0.8 },
    );

    const dummyBuffer = Buffer.from('fake-image-bytes');

    await expect(
      svc.processEnrollmentCapture(tenant, 'env-1', dummyBuffer)
    ).rejects.toThrow(DuplicateFaceEnrollmentError);

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'POTENTIAL_DUPLICATE_FACE',
        metadata: expect.objectContaining({
          studentId: 'student-new',
          duplicateStudentId: 'student-existing',
          similarityScore: 0.92,
        }),
      })
    );

    // Verify template was NOT persisted and enrollment was NOT activated
    expect(repo.createTemplateAndActivateEnrollment).not.toHaveBeenCalled();
  });
});
