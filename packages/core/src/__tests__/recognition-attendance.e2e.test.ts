/**
 * END-TO-END: face recognition -> attendance.
 *
 * Exercises the REAL production pipeline:
 *   RecognitionService        (detect -> quality -> liveness -> embed -> match -> decide)
 *   RecognitionDecisionPolicy (threshold + ambiguity margin + liveness policy)
 *   AttendancePolicy          (active -> in-group -> schedule gate -> day duplicate)
 *
 * against repository doubles that reproduce the Postgres semantics the real
 * adapters rely on:
 *   - every read is scoped by organizationId (tenant isolation)
 *   - Attendance @@unique([studentId, groupId, date]) with a day-normalised
 *     date (idempotency / duplicate prevention)
 *   - FaceTemplate.status = ACTIVE AND FaceEnrollment.status = ACTIVE before
 *     a template may be matched (revocation invariant)
 *
 * Only the ONNX engine, the crypto port and the clock are doubled.
 */

import { describe, expect, it, vi } from 'vitest';

import { RecognitionService } from '../application/recognition.service';
import {
  RecognitionDecisionPolicy,
  DEFAULT_FACE_RECOGNITION_CONFIG,
} from '../application/recognition-decision.policy';
import { AttendancePolicy } from '../application/attendance.policy';
import { FaceEmbedding } from '../domain/value-objects';
import type { FaceEngine } from '../ports/face-engine.port';
import type { EncryptionPort } from '../ports/encryption.port';
import type { StudentDirectoryPort } from '../ports/student-directory.port';
import type {
  RecognitionRepository,
  RecognitionSessionEntity,
  RecognitionAttemptEntity,
  AttendanceRecordEntity,
} from '../ports/recognition-repository.port';
import type {
  EnrollmentRepository,
  TemplateEntity,
} from '../ports/enrollment-repository.port';
import type { TenantContext } from '../ports/tenant-context.port';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const GROUP_1 = 'group-1';
const STUDENT_1 = 'student-1';
const STUDENT_2 = 'student-2';
const MODEL_VERSION = 'e2e-v1';

const tenantA: TenantContext = {
  userId: 'user-1',
  email: 'admin@a.test',
  role: 'ORG_ADMIN',
  organizationId: ORG_A,
};

/** Orthonormal basis vectors -> cosine 1.0 self-match, 0.0 otherwise. */
function basisVector(index: number): FaceEmbedding {
  const v = new Float32Array(4);
  v[index] = 1;
  return new FaceEmbedding(v);
}

function makeEngine(probe: { index: number }): FaceEngine {
  return {
    detectFaces: vi.fn().mockResolvedValue([
      { boundingBox: { x: 0, y: 0, width: 100, height: 100 }, confidence: 0.99 },
    ]),
    assessQuality: vi.fn().mockResolvedValue({
      overallScore: 0.9,
      sharpness: 0.9,
      brightness: 0.8,
      faceSizeRatio: 0.4,
      pose: { yaw: 0, pitch: 0, roll: 0 },
      passesThreshold: true,
      issues: [],
    }),
    checkLiveness: vi.fn().mockResolvedValue({ decision: 'PASS', confidence: 0.97 }),
    generateEmbedding: vi.fn(async () => basisVector(probe.index)),
    compareEmbeddings: vi.fn(
      async (input: { embeddingA: FaceEmbedding; embeddingB: FaceEmbedding }) =>
        input.embeddingA.cosineSimilarity(input.embeddingB),
    ),
    isAvailable: vi.fn().mockResolvedValue(true),
    getEmbeddingDimension: () => 4,
    getModelVersion: () => MODEL_VERSION,
  } as unknown as FaceEngine;
}

const encryption = {
  encrypt: vi.fn(async (d: string) => d),
  decrypt: vi.fn(async (d: string) => d),
  hash: vi.fn(async (d: string) => d),
  verifyHash: vi.fn(async () => true),
} as unknown as EncryptionPort;

// ---------------------------------------------------------------------------
// Enrollment double
// ---------------------------------------------------------------------------

interface Membership {
  organizationId: string;
  studentId: string;
  groupId: string;
  isActive: boolean;
  /** Mirrors StudentGroup.leftAt — drives the canonical day window. */
  leftAt?: Date | null;
}

interface StoredTemplate {
  template: TemplateEntity;
  enrollmentStatus: 'ACTIVE' | 'REVOKED' | 'PENDING';
}

function makeEnrollmentRepo(args: {
  templates: StoredTemplate[];
  memberships: Membership[];
}): EnrollmentRepository {
  const visible = (organizationId: string, groupId?: string) =>
    args.templates.filter(
      (t) =>
        t.template.organizationId === organizationId &&
        t.template.status === 'ACTIVE' &&
        t.enrollmentStatus === 'ACTIVE' &&
        (!groupId ||
          args.memberships.some(
            (m) =>
              m.organizationId === organizationId &&
              m.studentId === t.template.studentId &&
              m.groupId === groupId &&
              m.isActive,
          )),
    );

  return {
    async *streamActiveTemplates(organizationId, _batchSize, groupId) {
      const rows = visible(organizationId, groupId).map((t) => ({
        ...t.template,
        student: {
          id: t.template.studentId,
          firstName: 'Fixture',
          lastName: t.template.studentId,
        },
      }));
      if (rows.length > 0) yield rows;
    },
    findAllActiveTemplates: async (organizationId) =>
      visible(organizationId).map((t) => ({
        ...t.template,
        student: {
          id: t.template.studentId,
          firstName: 'F',
          lastName: t.template.studentId,
        },
      })),
    findActiveTemplatesByStudentId: async (organizationId, studentId) =>
      visible(organizationId)
        .filter((t) => t.template.studentId === studentId)
        .map((t) => t.template),
    findById: async () => null,
    findByStudentId: async () => null,
    findActiveByStudentId: async () => null,
    list: async () => ({ items: [], total: 0 }),
    create: async () => {
      throw new Error('not used');
    },
    updateStatus: async () => {
      throw new Error('not used');
    },
    addTemplate: async () => {
      throw new Error('not used');
    },
    addTemplateAndActivate: async () => {
      throw new Error('not used');
    },
    revokeTemplates: async () => undefined,
    revokeEnrollmentAndTemplates: async () => {
      throw new Error('not used');
    },
    atomicReenroll: async () => {
      throw new Error('not used');
    },
    countActive: async () => 0,
    countTotal: async () => 0,
  };
}

// ---------------------------------------------------------------------------
// Recognition/attendance double
// ---------------------------------------------------------------------------



function orgLocalDay(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

interface RecognitionRepoDouble extends RecognitionRepository {
  attendanceRows: AttendanceRecordEntity[];
}

function makeRecognitionRepo(args: {
  scheduleOpen: boolean;
  clock: { now: Date };
}): RecognitionRepoDouble {
  const sessions = new Map<string, RecognitionSessionEntity>();
  const attempts: RecognitionAttemptEntity[] = [];
  const attendanceRows: AttendanceRecordEntity[] = [];
  let seq = 0;
  const nextId = (p: string) => `${p}-${++seq}`;

  const repo = {
    attendanceRows,

    async createSession(data: {
      organizationId: string;
      groupId?: string;
      lessonId?: string;
      actorId?: string;
    }): Promise<RecognitionSessionEntity> {
      const row: RecognitionSessionEntity = {
        id: nextId('sess'),
        organizationId: data.organizationId,
        deviceId: null,
        actorId: data.actorId ?? null,
        groupId: data.groupId ?? null,
        lessonId: data.lessonId ?? null,
        status: 'STARTED',
        startedAt: args.clock.now,
        endedAt: null,
        metadata: null,
        createdAt: args.clock.now,
        updatedAt: args.clock.now,
      };
      sessions.set(row.id, row);
      return row;
    },

    async findSession(organizationId: string, sessionId: string) {
      const row = sessions.get(sessionId);
      return row && row.organizationId === organizationId ? row : null;
    },

    async updateSessionStatus(
      organizationId: string,
      sessionId: string,
      status: RecognitionSessionEntity['status'],
      endedAt?: Date,
    ) {
      const row = sessions.get(sessionId);
      if (!row || row.organizationId !== organizationId) throw new Error('Session not found');
      row.status = status;
      if (endedAt) row.endedAt = endedAt;
    },

    async countActiveSessions(organizationId: string) {
      return [...sessions.values()].filter(
        (s) =>
          s.organizationId === organizationId &&
          !['FINISHED', 'CANCELLED'].includes(s.status),
      ).length;
    },

    async createAttempt(data: Parameters<RecognitionRepository['createAttempt']>[0]) {
      const row: RecognitionAttemptEntity = {
        id: nextId('att'),
        organizationId: data.organizationId,
        sessionId: data.sessionId,
        identifiedStudentId: data.identifiedStudentId ?? null,
        actorId: data.actorId ?? null,
        status: data.status,
        confidence: data.confidence ?? null,
        qualityScore: data.qualityScore ?? null,
        livenessResult: data.livenessResult ?? null,
        similarityScore: data.similarityScore ?? null,
        processingTimeMs: data.processingTimeMs ?? null,
        metadata: data.metadata ?? null,
        occurredAt: args.clock.now,
        createdAt: args.clock.now,
      };
      attempts.push(row);
      return row;
    },

    async listAttempts() {
      return { items: attempts, total: attempts.length };
    },
    async getSessionAttempts() {
      return { items: attempts, total: attempts.length };
    },

    async createAttendance(data: Parameters<RecognitionRepository['createAttendance']>[0]) {
      const day = orgLocalDay(args.clock.now);
      const existing = attendanceRows.find(
        (r) =>
          r.organizationId === data.organizationId &&
          r.studentId === data.studentId &&
          r.groupId === data.groupId &&
          r.recordedAt.getTime() === day.getTime(),
      );

      // Mirrors Attendance @@unique([studentId, groupId, date]) and the P2002
      // branch of PrismaRecognitionAdapter.createAttendance.
      if (existing) return { ...existing, decision: 'DUPLICATE_PREVENTED' as const };

      const row: AttendanceRecordEntity = {
        id: nextId('row'),
        organizationId: data.organizationId,
        studentId: data.studentId,
        groupId: data.groupId,
        lessonId: data.lessonId ?? null,
        sessionId: data.sessionId ?? null,
        decision: data.decision,
        recordedAt: day,
        metadata: null,
        createdAt: args.clock.now,
      };
      attendanceRows.push(row);
      return row;
    },

    async findExistingAttendance(organizationId: string, studentId: string, groupId: string) {
      const day = orgLocalDay(args.clock.now);
      return (
        attendanceRows.find(
          (r) =>
            r.organizationId === organizationId &&
            r.studentId === studentId &&
            r.groupId === groupId &&
            r.recordedAt.getTime() === day.getTime(),
        ) ?? null
      );
    },

    async isWithinSchedule() {
      return args.scheduleOpen;
    },

    async listAttendance() {
      return { items: attendanceRows, total: attendanceRows.length };
    },

    async getRecognitionStats() {
      return {
        totalAttempts: attempts.length,
        successful: 0,
        uncertain: 0,
        failed: 0,
        livenessFailures: 0,
        qualityFailures: 0,
        averageLatencyMs: 0,
      };
    },

    async getAttendanceStats() {
      return {
        recorded: attendanceRows.length,
        duplicatePrevented: 0,
        notInGroup: 0,
        lessonInvalid: 0,
      };
    },
  };

  return repo as unknown as RecognitionRepoDouble;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Mirror of `common/student-membership.ts#canonicalMembershipWhere` — the ONE
 * rule the face gate, the camera path and the manual path must all agree on.
 */
function isEnrolledOn(
  memberships: Membership[],
  organizationId: string,
  studentId: string,
  groupId: string,
  now: Date,
): boolean {
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  return memberships.some(
    (m) =>
      m.organizationId === organizationId &&
      m.studentId === studentId &&
      m.groupId === groupId &&
      m.isActive &&
      // joinedAt: fixture memberships are created "now", always < dayEnd.
      // leftAt: removed before today's window starts -> NOT enrolled today.
      (m.leftAt == null || m.leftAt >= dayStart),
  );
}

function makeStudentDirectory(memberships: Membership[], now: Date): StudentDirectoryPort {
  const inGroup = (organizationId: string, studentId: string, groupId: string) =>
    isEnrolledOn(memberships, organizationId, studentId, groupId, now);

  return {
    getStudent: async (organizationId, studentId) => ({
      id: studentId,
      organizationId,
      firstName: 'A',
      lastName: studentId,
      email: `${studentId}@t`,
      studentId,
      isActive: true,
    }),
    isStudentActive: async () => true,
    isStudentInGroup: async (organizationId, studentId, groupId) =>
      inGroup(organizationId, studentId, groupId),
    getStudentGroups: async () => [],
    listStudentsInGroup: async () => [],
  };
}

function templateFor(studentId: string, organizationId: string, index: number): StoredTemplate {
  return {
    enrollmentStatus: 'ACTIVE',
    template: {
      id: `tpl-${studentId}`,
      organizationId,
      enrollmentId: `env-${studentId}`,
      studentId,
      templateData: basisVector(index).serialize(),
      templateHash: 'hash',
      version: 1,
      status: 'ACTIVE',
      modelVersion: MODEL_VERSION,
      qualityScore: 0.9,
      enrolledAt: new Date(),
      expiresAt: null,
      revokedAt: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

function buildPipeline(options?: {
  scheduleOpen?: boolean;
  probeIndex?: number;
  memberships?: Membership[];
}) {
  // The clock must be CURRENT: RecognitionService enforces the session TTL
  // on every attempt, so a back-dated fixture would be rejected as an
  // expired session before any pipeline stage runs.
  const clock = { now: new Date() };
  const memberships: Membership[] = options?.memberships ?? [
    { organizationId: ORG_A, studentId: STUDENT_1, groupId: GROUP_1, isActive: true },
  ];

  const enrollmentRepo = makeEnrollmentRepo({
    templates: [templateFor(STUDENT_1, ORG_A, 0), templateFor(STUDENT_2, ORG_A, 1)],
    memberships,
  });

  const recognitionRepo = makeRecognitionRepo({
    scheduleOpen: options?.scheduleOpen ?? true,
    clock,
  });

  const probeIndex = options?.probeIndex ?? 0;
  const engine = makeEngine({ index: probeIndex });

  const service = new RecognitionService(
    engine,
    encryption,
    recognitionRepo,
    enrollmentRepo,
    { requirePermission: async () => undefined } as never,
    { log: async () => undefined } as never,
    new RecognitionDecisionPolicy(DEFAULT_FACE_RECOGNITION_CONFIG),
    new AttendancePolicy(
      makeStudentDirectory(memberships, clock.now),
      recognitionRepo,
      DEFAULT_FACE_RECOGNITION_CONFIG.duplicatePrevention.windowMinutes,
    ),
  );

  return { service, recognitionRepo };
}

// ---------------------------------------------------------------------------
// The scenario
// ---------------------------------------------------------------------------

describe('E2E: organization -> group -> student -> enrollment -> frame -> attendance', () => {
  it('records attendance exactly once and prevents every subsequent duplicate', async () => {
    const { service, recognitionRepo } = buildPipeline();

    const { sessionId } = await service.startSession(tenantA, { groupId: GROUP_1 });

    const first = await service.processAttempt(tenantA, sessionId, Buffer.from('frame-1'));
    expect(first.status).toBe('IDENTIFIED');
    expect(first.identified).toBe(true);
    expect(first.student?.id).toBe(STUDENT_1);
    expect(first.attendanceDecision).toBe('RECORDED');
    expect(first.attendanceRecorded).toBe(true);
    expect(first.attendanceRecordId).toBeTruthy();
    expect(recognitionRepo.attendanceRows).toHaveLength(1);

    const second = await service.processAttempt(tenantA, sessionId, Buffer.from('frame-2'));
    expect(second.attendanceRecorded).toBe(false);
    expect(second.attendanceDecision).toBe('DUPLICATE_PREVENTED');
    expect(second.attendanceRecordId).toBeNull();
    expect(recognitionRepo.attendanceRows).toHaveLength(1);
  });

  it('DENIES a foreign organization session (tenant isolation)', async () => {
    const { service, recognitionRepo } = buildPipeline();
    const { sessionId } = await service.startSession(tenantA, { groupId: GROUP_1 });

    const intruder = { ...tenantA, organizationId: ORG_B };
    await expect(
      service.processAttempt(intruder, sessionId, Buffer.from('x')),
    ).rejects.toThrow(/not found/i);
    expect(recognitionRepo.attendanceRows).toHaveLength(0);
  });

  it('never even considers a student who is not a member of the session group', async () => {
    // Candidate retrieval is scoped to the session group, so a non-member's
    // template is not in the gallery at all: the face stays UNKNOWN instead of
    // being identified and then denied with a confusing enrollment error.
    const { service, recognitionRepo } = buildPipeline({ probeIndex: 1 });
    const { sessionId } = await service.startSession(tenantA, { groupId: GROUP_1 });

    const result = await service.processAttempt(tenantA, sessionId, Buffer.from('frame'));

    expect(result.identified).toBe(false);
    expect(result.attendanceRecorded).toBe(false);
    expect(recognitionRepo.attendanceRows).toHaveLength(0);
  });

  it('DENIES a member whose membership window excludes today (parity regression)', async () => {
    /*
     * REGRESSION for the four divergent membership rules. Candidate retrieval
     * deliberately omits the org-local joinedAt/leftAt window (it must stay a
     * superset of the gate), so this student IS identified â€” while the
     * attendance gate applies the window and must refuse. Before the fix,
     * PrismaStudentAdapter.isStudentInGroup had NO window at all and recorded
     * attendance for a student who had already left the group.
     */
    const { service, recognitionRepo } = buildPipeline({
      memberships: [
        {
          organizationId: ORG_A,
          studentId: STUDENT_1,
          groupId: GROUP_1,
          isActive: true,
          leftAt: new Date(Date.now() - DAY_MS),
        },
      ],
    });
    const { sessionId } = await service.startSession(tenantA, { groupId: GROUP_1 });

    const result = await service.processAttempt(tenantA, sessionId, Buffer.from('frame'));

    expect(result.identified).toBe(true);
    expect(result.student?.id).toBe(STUDENT_1);
    expect(result.attendanceRecorded).toBe(false);
    expect(result.attendanceDecision).toBe('STUDENT_NOT_IN_GROUP');
    expect(recognitionRepo.attendanceRows).toHaveLength(0);
  });

  it('DENIES attendance while the schedule gate is closed and writes nothing', async () => {
    const { service, recognitionRepo } = buildPipeline({ scheduleOpen: false });
    const { sessionId } = await service.startSession(tenantA, { groupId: GROUP_1 });

    const result = await service.processAttempt(tenantA, sessionId, Buffer.from('frame'));

    expect(result.identified).toBe(true);
    expect(result.attendanceRecorded).toBe(false);
    expect(result.attendanceDecision).toBe('OUT_OF_SCHEDULE');
    expect(recognitionRepo.attendanceRows).toHaveLength(0);
  });

  it('never exposes another organization template to the gallery', async () => {
    const enrollmentRepo = makeEnrollmentRepo({
      templates: [templateFor(STUDENT_1, ORG_B, 0)],
      memberships: [
        { organizationId: ORG_A, studentId: STUDENT_1, groupId: GROUP_1, isActive: true },
      ],
    });

    const rows: unknown[] = [];
    for await (const batch of enrollmentRepo.streamActiveTemplates(ORG_A, 500, GROUP_1)) {
      rows.push(...batch);
    }
    expect(rows).toHaveLength(0);
  });
});
