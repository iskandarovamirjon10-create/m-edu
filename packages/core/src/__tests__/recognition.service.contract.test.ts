/**
 * Regression tests for the recognition flow contract fixes:
 *  1. POST /face/sessions returns { sessionId, status } (frontend consumes it).
 *  2. Matching iterates ALL active templates — a student whose template is
 *     beyond the first 5 candidates must still be identifiable.
 */
import { describe, it, expect, vi } from 'vitest';
import { RecognitionService } from '../application/recognition.service';
import { RecognitionDecisionPolicy, DEFAULT_FACE_RECOGNITION_CONFIG } from '../application/recognition-decision.policy';
import { FaceEmbedding } from '../domain/value-objects';
import type { FaceEngine } from '../ports/face-engine.port';
import type { AttendancePolicy } from '../application/attendance.policy';

const tenant = { userId: 'user-1', email: 'admin@t', role: 'ORG_ADMIN', organizationId: 'org-1' };

function makeFaceEngine(similaritiesByTemplate: Record<string, number>): FaceEngine {
  return {
    detectFaces: vi.fn().mockResolvedValue([{ boundingBox: { x: 0, y: 0, width: 10, height: 10 }, confidence: 0.99 }]),
    assessQuality: vi.fn().mockResolvedValue({
      overallScore: 0.85, sharpness: 0.8, brightness: 0.7, faceSizeRatio: 0.4,
      pose: { yaw: 0, pitch: 0, roll: 0 }, passesThreshold: true,
    }),
    checkLiveness: vi.fn().mockResolvedValue({ decision: 'PASS', confidence: 0.95 }),
    generateEmbedding: vi.fn().mockResolvedValue(new FaceEmbedding([0.5, 0.5])),
    compareEmbeddings: vi.fn(async ({ embeddingB }: any) => {
      const tag = Number(embeddingB.getData()[0]);
      return similaritiesByTemplate[tag] ?? 0.1;
    }),
    isAvailable: vi.fn().mockResolvedValue(true),
    getEmbeddingDimension: () => 128,
    getModelVersion: () => 'test-v1',
  } as any;
}

function makeTemplate(id: string, studentId: string, tag: number) {
  return {
    id,
    organizationId: 'org-1',
    enrollmentId: 'env-' + id,
    studentId,
    // templateData carries a serialized 1-dim embedding whose value is the
    // template tag; the decrypt mock returns it so compareEmbeddings can
    // map template -> similarity deterministically.
    templateData: new FaceEmbedding([tag]).serialize(),
    templateHash: 'h',
    version: 1,
    status: 'ACTIVE',
    modelVersion: 'v1',
    qualityScore: 0.9,
    enrolledAt: new Date(),
    expiresAt: null,
    revokedAt: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    student: { id: studentId, firstName: 'S', lastName: studentId },
  };
}

describe('RecognitionService contract (session start)', () => {
  it('POST /face/sessions returns { sessionId, status } — the shape the frontend consumes', async () => {
    const recogRepo = {
      countActiveSessions: vi.fn().mockResolvedValue(0),
      createSession: vi.fn().mockResolvedValue({
        id: 'sess-abc', organizationId: 'org-1', deviceId: null, actorId: 'user-1',
        groupId: 'group-1', lessonId: null, status: 'STARTED', startedAt: new Date(),
        endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date(),
      }),
    } as any;
    const svc = new RecognitionService(
      makeFaceEngine({}), ({} as any), recogRepo, ({} as any),
      { requirePermission: vi.fn().mockResolvedValue(undefined) } as any,
      { log: vi.fn().mockResolvedValue(undefined) } as any,
      new RecognitionDecisionPolicy(DEFAULT_FACE_RECOGNITION_CONFIG),
      ({ validate: vi.fn() } as any) as AttendancePolicy,
    );

    const result = await svc.startSession(tenant, { groupId: 'group-1' });
    expect(result.sessionId).toBe('sess-abc');
    expect(result.status).toBe('STARTED');
  });
});

describe('RecognitionService matching beyond maxCandidates', () => {
  it('identifies a student whose template is the 6th of 6 (regression: maxCandidates=5 sliced the list)', async () => {
    // 6 templates; only the 6th (tag 5) passes the 0.6 similarity threshold.
    const templates = [0, 1, 2, 3, 4, 5].map((i) => makeTemplate(`t${i}`, `student-${i}`, i));
    const similarities: Record<string, number> = { 5: 0.92 };
    const faceEngine = makeFaceEngine(similarities);

    const recogRepo = {
      findSession: vi.fn().mockResolvedValue({
        id: 'sess-1', organizationId: 'org-1', deviceId: null, actorId: 'user-1',
        groupId: 'group-1', lessonId: null, status: 'STARTED', startedAt: new Date(),
        endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date(),
      }),
      updateSessionStatus: vi.fn().mockResolvedValue(undefined),
      createAttempt: vi.fn().mockImplementation((data: any) =>
        Promise.resolve({ id: 'attempt-1', ...data, occurredAt: new Date(), createdAt: new Date() })),
      createAttendance: vi.fn().mockResolvedValue({
        id: 'att-1', organizationId: 'org-1', studentId: 'student-5', groupId: 'group-1',
        lessonId: null, sessionId: 'sess-1', decision: 'RECORDED', recordedAt: new Date(),
        metadata: null, createdAt: new Date(),
      }),
    } as any;

    const enrollmentRepo = {
      findAllActiveTemplates: vi.fn().mockResolvedValue(templates),
      streamActiveTemplates: vi.fn().mockImplementation(async function* () {
        yield templates;
      }),
    } as any;

    const attendancePolicy = {
      validate: vi.fn().mockResolvedValue({ decision: 'RECORDED', message: 'ok' }),
    } as any;

    const svc = new RecognitionService(
      faceEngine,
      {
        decrypt: vi.fn(async (ciphertext: string) => {
          // Decrypt is a pass-through of the serialized embedding payload.
          return ciphertext;
        }),
        verifyHash: vi.fn().mockResolvedValue(true),
      } as any,
      recogRepo,
      enrollmentRepo,
      { requirePermission: vi.fn().mockResolvedValue(undefined) } as any,
      { log: vi.fn().mockResolvedValue(undefined) } as any,
      new RecognitionDecisionPolicy(DEFAULT_FACE_RECOGNITION_CONFIG),
      attendancePolicy,
    );

    const result = await svc.processAttempt(tenant, 'sess-1', Buffer.from('img'));
    expect(result.identified).toBe(true);
    expect(result.student?.id).toBe('student-5');
    // The attempt must be persisted with the identified student.
    const attemptData = recogRepo.createAttempt.mock.calls[0][0];
    expect(attemptData.identifiedStudentId).toBe('student-5');
    expect(faceEngine.compareEmbeddings).toHaveBeenCalledTimes(6);
  });

  it('uses streamActiveTemplates with bounded batches instead of loading all templates at once', async () => {
    const templates = [0, 1, 2, 3, 4, 5].map((i) => makeTemplate(`t${i}`, `student-${i}`, i));
    const similarities: Record<string, number> = { 5: 0.92 };
    const faceEngine = makeFaceEngine(similarities);

    const recogRepo = {
      findSession: vi.fn().mockResolvedValue({
        id: 'sess-1', organizationId: 'org-1', deviceId: null, actorId: 'user-1',
        groupId: 'group-1', lessonId: null, status: 'STARTED', startedAt: new Date(),
        endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date(),
      }),
      updateSessionStatus: vi.fn().mockResolvedValue(undefined),
      createAttempt: vi.fn().mockImplementation((data: any) =>
        Promise.resolve({ id: 'attempt-1', ...data, occurredAt: new Date(), createdAt: new Date() })),
      createAttendance: vi.fn().mockResolvedValue({
        id: 'att-1', organizationId: 'org-1', studentId: 'student-5', groupId: 'group-1',
        lessonId: null, sessionId: 'sess-1', decision: 'RECORDED', recordedAt: new Date(),
        metadata: null, createdAt: new Date(),
      }),
    } as any;

    // Stream in batches of 3 to verify bounded memory consumption
    const batch1 = templates.slice(0, 3);
    const batch2 = templates.slice(3);
    const enrollmentRepo = {
      streamActiveTemplates: vi.fn(async function* () {
        yield batch1;
        yield batch2;
      }),
    } as any;

    const attendancePolicy = {
      validate: vi.fn().mockResolvedValue({ decision: 'RECORDED', message: 'ok' }),
    } as any;

    const svc = new RecognitionService(
      faceEngine,
      {
        decrypt: vi.fn(async (ciphertext: string) => ciphertext),
        verifyHash: vi.fn().mockResolvedValue(true),
      } as any,
      recogRepo,
      enrollmentRepo,
      { requirePermission: vi.fn().mockResolvedValue(undefined) } as any,
      { log: vi.fn().mockResolvedValue(undefined) } as any,
      new RecognitionDecisionPolicy(DEFAULT_FACE_RECOGNITION_CONFIG),
      attendancePolicy,
    );

    const result = await svc.processAttempt(tenant, 'sess-1', Buffer.from('img'));
    expect(result.identified).toBe(true);
    expect(result.student?.id).toBe('student-5');
    expect(enrollmentRepo.streamActiveTemplates).toHaveBeenCalledWith('org-1', 500);
  });

  it('logs TEMPLATE_CORRUPTED audit event and safely continues when a template fails decryption', async () => {
    const corruptedTemplate = makeTemplate('t-corrupt', 'student-bad', 999);
    const validTemplate = makeTemplate('t-valid', 'student-good', 1);

    const faceEngine = makeFaceEngine({ 1: 0.95 });
    const auditLogMock = vi.fn().mockResolvedValue(undefined);

    const recogRepo = {
      findSession: vi.fn().mockResolvedValue({
        id: 'sess-1', organizationId: 'org-1', deviceId: null, actorId: 'user-1',
        groupId: 'group-1', lessonId: null, status: 'STARTED', startedAt: new Date(),
        endedAt: null, metadata: null, createdAt: new Date(), updatedAt: new Date(),
      }),
      updateSessionStatus: vi.fn().mockResolvedValue(undefined),
      createAttempt: vi.fn().mockImplementation((data: any) =>
        Promise.resolve({ id: 'attempt-1', ...data, occurredAt: new Date(), createdAt: new Date() })),
      createAttendance: vi.fn().mockResolvedValue({
        id: 'att-1', organizationId: 'org-1', studentId: 'student-good', groupId: 'group-1',
        lessonId: null, sessionId: 'sess-1', decision: 'RECORDED', recordedAt: new Date(),
        metadata: null, createdAt: new Date(),
      }),
    } as any;

    const enrollmentRepo = {
      streamActiveTemplates: vi.fn(async function* () {
        yield [corruptedTemplate, validTemplate];
      }),
    } as any;

    const svc = new RecognitionService(
      faceEngine,
      {
        decrypt: vi.fn(async (ciphertext: string) => {
          if (ciphertext === corruptedTemplate.templateData) {
            throw new Error('Decryption integrity check failed');
          }
          return ciphertext;
        }),
        verifyHash: vi.fn().mockResolvedValue(true),
      } as any,
      recogRepo,
      enrollmentRepo,
      { requirePermission: vi.fn().mockResolvedValue(undefined) } as any,
      { log: auditLogMock } as any,
      new RecognitionDecisionPolicy(DEFAULT_FACE_RECOGNITION_CONFIG),
      { validate: vi.fn().mockResolvedValue({ decision: 'RECORDED', message: 'ok' }) } as any,
    );

    const result = await svc.processAttempt(tenant, 'sess-1', Buffer.from('img'));

    // Corrupted template was logged as TEMPLATE_CORRUPTED
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TEMPLATE_CORRUPTED',
        resourceId: 't-corrupt',
      })
    );

    // Valid template was still matched successfully
    expect(result.identified).toBe(true);
    expect(result.student?.id).toBe('student-good');
  });
});
