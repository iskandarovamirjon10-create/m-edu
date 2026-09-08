/**
 * Fail-closed liveness regression tests for enrollment.
 *
 * Security rule: biometric enrollment must NEVER activate a face template
 * without a successful mandatory liveness check (livenessPolicy.required === true).
 */
import { describe, it, expect, vi } from 'vitest';
import { EnrollmentService } from '../application/enrollment.service';
import { LivenessFailedError, LivenessUnavailableError } from '../domain/errors';

const tenant = { userId: 'user-1', email: 'admin@t', role: 'ORG_ADMIN', organizationId: 'org-1' };

function makeService(overrides: { livenessDecision?: string; acceptUncertain?: boolean; qualityPass?: boolean } = {}) {
  const { livenessDecision = 'PASS', acceptUncertain = false, qualityPass = true } = overrides;
  const faceEngine = {
    isAvailable: vi.fn().mockResolvedValue(true),
    detectFaces: vi.fn().mockResolvedValue([{ boundingBox: { x: 0, y: 0, width: 10, height: 10 }, confidence: 0.99 }]),
    assessQuality: vi.fn().mockResolvedValue({ passesThreshold: qualityPass, overallScore: 0.9 }),
    checkLiveness: vi.fn().mockResolvedValue({ decision: livenessDecision as any, confidence: 0.95 }),
    generateEmbedding: vi.fn().mockResolvedValue({ serialize: () => Buffer.from('emb'), deserialize: () => ({}) } as any),
    getModelVersion: vi.fn().mockReturnValue('v1'),
    compareEmbeddings: vi.fn().mockResolvedValue(0.99),
  } as any;

  const enrollmentRepo = {
    findById: vi.fn().mockResolvedValue({ id: 'env-1', organizationId: 'org-1', studentId: 's-1', status: 'PENDING', student: { id: 's-1', firstName: 'A', lastName: 'B' } }),
    findByStudentId: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'env-1', status: 'PENDING', studentId: 's-1', organizationId: 'org-1', enrolledBy: 'user-1', enrolledAt: new Date(), activatedAt: null, revokedAt: null, revokedBy: null, revocationReason: null, metadata: null, createdAt: new Date(), updatedAt: new Date() }),
    addTemplate: vi.fn().mockResolvedValue({ id: 'tpl-1' }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    revokeTemplates: vi.fn().mockResolvedValue(undefined),
    streamActiveTemplates: vi.fn().mockReturnValue((async function* () { yield []; })()),
  } as any;

  const encryption = {
    encrypt: vi.fn().mockResolvedValue(Buffer.from('enc')),
    hash: vi.fn().mockResolvedValue('hash'),
    decrypt: vi.fn().mockResolvedValue(Buffer.from('emb')),
    verifyHash: vi.fn().mockResolvedValue(true),
  } as any;

  return new EnrollmentService(
    enrollmentRepo,
    faceEngine,
    encryption,
    { requirePermission: vi.fn().mockResolvedValue(undefined) } as any,
    { log: vi.fn().mockResolvedValue(undefined) } as any,
    { getStudent: vi.fn().mockResolvedValue({ id: 's-1', isActive: true }) } as any,
    { maxFacesPerImage: 1, enrollmentRetryLimit: 3, acceptUncertainLiveness: acceptUncertain }
  );
}

describe('EnrollmentService liveness fail-closed', () => {
  it('PASS → enrollment continues and activates', async () => {
    const svc = makeService({ livenessDecision: 'PASS' });
    const res = await svc.processEnrollmentCapture(tenant, 'env-1', Buffer.from('img'));
    expect(res.status).toBe('ACTIVE');
    expect(res.livenessResult).toBe('PASS');
  });

  it('FAIL → enrollment rejected with LivenessFailedError', async () => {
    const svc = makeService({ livenessDecision: 'FAIL' });
    await expect(svc.processEnrollmentCapture(tenant, 'env-1', Buffer.from('img'))).rejects.toThrow(LivenessFailedError);
  });

  it('UNAVAILABLE → enrollment rejected with LivenessUnavailableError', async () => {
    const svc = makeService({ livenessDecision: 'UNAVAILABLE' });
    await expect(svc.processEnrollmentCapture(tenant, 'env-1', Buffer.from('img'))).rejects.toThrow(LivenessUnavailableError);
  });

  it('UNCERTAIN → enrollment rejected by default (fail-closed)', async () => {
    const svc = makeService({ livenessDecision: 'UNCERTAIN', acceptUncertain: false });
    await expect(svc.processEnrollmentCapture(tenant, 'env-1', Buffer.from('img'))).rejects.toThrow(LivenessFailedError);
  });

  it('UNCERTAIN → allowed only when config explicitly permits (not default)', async () => {
    const svc = makeService({ livenessDecision: 'UNCERTAIN', acceptUncertain: true });
    const res = await svc.processEnrollmentCapture(tenant, 'env-1', Buffer.from('img'));
    expect(res.status).toBe('ACTIVE');
    expect(res.livenessResult).toBe('UNCERTAIN');
  });
});
