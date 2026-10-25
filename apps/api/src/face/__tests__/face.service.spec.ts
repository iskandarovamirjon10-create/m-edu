/**
 * FaceService unit tests.
 *
 * Scope:
 * - Face engine provider selection and production safety
 * - tenant isolation on every Prisma operation
 * - pagination normalization and boundary behavior
 * - date query normalization
 * - analytics calculations and zero-division safety
 * - deterministic facade behavior
 *
 * Heavy recognition/enrollment algorithms belong to @medu/core,
 * face-engine and integration/E2E suites.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { FaceService } from '../face.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { resetSharedFaceEngineCache } from '../face-engine.factory';

/* ────────────────────────────────────────────────────────────────────── */
/* Prisma mock                                                            */
/* ────────────────────────────────────────────────────────────────────── */

function makePrisma() {
  const prisma = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC' }),
    },

    faceEnrollment: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },

    faceAuditEvent: {
      create: vi.fn().mockImplementation((args) => Promise.resolve({ id: 'audit-1', createdAt: new Date(), ...args?.data })),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },

    recognitionSession: {
      count: vi.fn().mockResolvedValue(0),
    },

    recognitionAttempt: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue({
        _avg: {
          processingTimeMs: null,
        },
      }),
    },

    faceDevice: {
      count: vi.fn().mockResolvedValue(0),
    },

    cameraAttendanceEvent: {
      count: vi.fn().mockResolvedValue(0),
    },

    // Insufficient-funds entry gate (F-009): the gate reads the student's
    // invoices, not `Student.balance`.
    student: {
      findFirst: vi.fn().mockResolvedValue({ balance: 0 }),
    },

    invoice: {
      findMany: vi.fn().mockResolvedValue([]),
    },

    attendance: {
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUnique: vi.fn().mockResolvedValue({ groupId: 'g1' }),
    },

    $transaction: vi.fn(),
  } as unknown as PrismaService;

  return prisma;
}

async function makeService() {
  const prisma = makePrisma();

  const service = new FaceService(prisma, {
    validateGroupTime: vi.fn().mockResolvedValue(true),
  } as never);

  await service.onModuleInit();

  return {
    service,
    prisma,
  };
}

const manager = {
  organizationId: 'org-1',
  userId: 'user-1',
  role: 'MANAGER',
};

/* ────────────────────────────────────────────────────────────────────── */
/* Tests                                                                  */
/* ────────────────────────────────────────────────────────────────────── */

describe('FaceService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    resetSharedFaceEngineCache();

    process.env.NODE_ENV = 'test';
    process.env.FACE_ENGINE_PROVIDER = 'mock';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  /* ──────────────────────────────────────────────────────────────────── */
  /* Engine                                                               */
  /* ──────────────────────────────────────────────────────────────────── */

  describe('engine selection', () => {
    it('uses the mock engine outside production when explicitly configured', async () => {
      const { service } = await makeService();

      expect(service.getEngineStatus()).toMatchObject({
        provider: 'mock',
        isReal: false,
        initialized: true,
      });
    });

    it('never allows the mock engine in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.FACE_ENGINE_PROVIDER = 'mock';

      resetSharedFaceEngineCache();
      const service = new FaceService(makePrisma(), {
        validateGroupTime: vi.fn().mockResolvedValue(true),
      } as never);

      await expect(service.onModuleInit()).rejects.toThrow(
        /Mock engines are forbidden/,
      );
    });

    it('does not silently downgrade production to the mock engine', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.FACE_ENGINE_PROVIDER;

      resetSharedFaceEngineCache();
      const service = new FaceService(makePrisma(), {
        validateGroupTime: vi.fn().mockResolvedValue(true),
      } as never);

      // With the variable unset the resolver fails closed to `real-local`.
      // In production this must either initialise the REAL engine or throw —
      // it must never resolve as a mock engine.
      let rejected = false;
      try {
        await service.onModuleInit();
      } catch {
        rejected = true;
      }

      if (!rejected) {
        expect(service.getEngineStatus().provider).not.toBe('mock');
        expect(service.getEngineStatus().isReal).toBe(true);
      }
    });
  });

  /* ──────────────────────────────────────────────────────────────────── */
  /* Enrollment list                                                       */
  /* ──────────────────────────────────────────────────────────────────── */

  describe('listEnrollments', () => {
    it('scopes both data and count queries to the tenant', async () => {
      const { service, prisma } = await makeService();

      prisma.faceEnrollment.count.mockResolvedValue(25);

      const result = await service.listEnrollments(
        manager,
        {
          page: 2,
          limit: 10,
        },
      );

      expect(
        prisma.faceEnrollment.findMany,
      ).toHaveBeenCalledTimes(1);

      expect(
        prisma.faceEnrollment.count,
      ).toHaveBeenCalledTimes(1);

      const findArgs =
        prisma.faceEnrollment.findMany.mock.calls[0][0];

      const countArgs =
        prisma.faceEnrollment.count.mock.calls[0][0];

      expect(findArgs.where.organizationId).toBe('org-1');
      expect(countArgs.where.organizationId).toBe('org-1');

      expect(result).toEqual({
        items: [],
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
    });

    it('normalizes string pagination parameters', async () => {
      const { service, prisma } = await makeService();

      prisma.faceEnrollment.count.mockResolvedValue(7);

      const result = await service.listEnrollments(
        manager,
        {
          page: '1' as unknown as number,
          limit: '5' as unknown as number,
        },
      );

      expect(result.page).toBe(1);
      expect(result.limit).toBe(5);
      expect(result.totalPages).toBe(2);
    });

    it('uses one page when total is exactly divisible by limit', async () => {
      const { service, prisma } = await makeService();

      prisma.faceEnrollment.count.mockResolvedValue(20);

      const result = await service.listEnrollments(
        manager,
        {
          page: 1,
          limit: 10,
        },
      );

      expect(result.totalPages).toBe(2);
    });

    it('returns zero total pages when there are no records', async () => {
      const { service } = await makeService();

      const result = await service.listEnrollments(
        manager,
        {
          page: 1,
          limit: 10,
        },
      );

      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('calculates the correct Prisma pagination offset', async () => {
      const { service, prisma } = await makeService();

      await service.listEnrollments(
        manager,
        {
          page: 3,
          limit: 10,
        },
      );

      const args =
        prisma.faceEnrollment.findMany.mock.calls[0][0];

      expect(args.skip).toBe(20);
      expect(args.take).toBe(10);
    });

    it('strips templateData and templateHash from returned templates (M-EDU-BIO-002)', async () => {
      const { service, prisma } = await makeService();

      prisma.faceEnrollment.findMany.mockResolvedValue([
        {
          id: 'env-1',
          organizationId: 'org-1',
          studentId: 's-1',
          status: 'ACTIVE',
          faceTemplates: [
            {
              id: 'tmpl-1',
              templateData: 'ENCRYPTED_SECRET_CIPHERTEXT',
              templateHash: 'HASH_SECRET_VECTOR',
              version: 1,
              status: 'ACTIVE',
              modelVersion: 'sface-v1',
              qualityScore: 0.95,
            },
          ],
          student: null,
        },
      ]);
      prisma.faceEnrollment.count.mockResolvedValue(1);

      const result = await service.listEnrollments(manager, { page: 1, limit: 10 });
      expect(result.items).toHaveLength(1);
      const enrollment = result.items[0];
      expect(enrollment.templates).toHaveLength(1);
      const template = enrollment.templates[0];
      expect(template.id).toBe('tmpl-1');
      expect(template.version).toBe(1);
      expect((template as any).templateData).toBeUndefined();
      expect((template as any).templateHash).toBeUndefined();
    });
  });

  describe('getEnrollment (M-EDU-BIO-002)', () => {
    it('strips templateData and templateHash from getEnrollment', async () => {
      const { service, prisma } = await makeService();

      prisma.faceEnrollment.findFirst.mockResolvedValue({
        id: 'env-1',
        organizationId: 'org-1',
        studentId: 's-1',
        status: 'ACTIVE',
        faceTemplates: [
          {
            id: 'tmpl-1',
            templateData: 'ENCRYPTED_SECRET_CIPHERTEXT',
            templateHash: 'HASH_SECRET_VECTOR',
            version: 1,
            status: 'ACTIVE',
            modelVersion: 'sface-v1',
            qualityScore: 0.95,
          },
        ],
        student: null,
      });

      const enrollment = await service.getEnrollment(manager, 'env-1');
      expect(enrollment).toBeDefined();
      expect(enrollment.templates).toHaveLength(1);
      const template = enrollment.templates[0];
      expect(template.id).toBe('tmpl-1');
      expect((template as any).templateData).toBeUndefined();
      expect((template as any).templateHash).toBeUndefined();
    });
  });

  /* ──────────────────────────────────────────────────────────────────── */
  /* Recognition history                                                   */
  /* ──────────────────────────────────────────────────────────────────── */

  describe('getRecognitionHistory', () => {
    it('normalizes ISO date strings into day-bounded Date ranges', async () => {
      const { service, prisma } = await makeService();

      const dateFrom = '2026-09-01T00:00:00.000Z';
      const dateTo = '2026-09-30T00:00:00.000Z';

      await service.getRecognitionHistory(
        manager,
        {
          dateFrom,
          dateTo,
          page: 1,
          limit: 20,
        },
      );

      const args =
        prisma.recognitionAttempt.findMany.mock.calls[0][0];

      expect(args.where.organizationId).toBe('org-1');

      // P1-05 date-range helpers: gte = start of day, lte = end-of-day
      // inclusive (23:59:59.999) so a bare dateTo does not drop same-day rows.
      expect(args.where.occurredAt).toEqual(
        expect.objectContaining({
          gte: new Date(Date.UTC(2026, 8, 1)),
          lte: new Date(Date.UTC(2026, 8, 30, 23, 59, 59, 999)),
        }),
      );
    });

    it('does not leak another tenant through history queries', async () => {
      const { service, prisma } = await makeService();

      await service.getRecognitionHistory(
        manager,
        {
          page: 1,
          limit: 20,
        },
      );

      const args =
        prisma.recognitionAttempt.findMany.mock.calls[0][0];

      expect(args.where).not.toMatchObject({
        organizationId: 'org-2',
      });

      expect(args.where.organizationId).toBe('org-1');
    });

    it('does not add a date filter when dates are not provided', async () => {
      const { service, prisma } = await makeService();

      await service.getRecognitionHistory(
        manager,
        {
          page: 1,
          limit: 20,
        },
      );

      const args =
        prisma.recognitionAttempt.findMany.mock.calls[0][0];

      expect(args.where.organizationId).toBe('org-1');
      expect(args.where.occurredAt).toBeUndefined();
    });
  });

  /* ──────────────────────────────────────────────────────────────────── */
  /* Analytics                                                             */
  /* ──────────────────────────────────────────────────────────────────── */

  describe('getAnalytics', () => {
    it('calculates success, liveness and latency metrics correctly', async () => {
      const { service, prisma } = await makeService();

      prisma.recognitionAttempt.count
        .mockResolvedValueOnce(10)   // totalAttempts
        .mockResolvedValueOnce(8)    // successful (IDENTIFIED)
        .mockResolvedValueOnce(0)    // uncertain (MATCH_UNCERTAIN)
        .mockResolvedValueOnce(1)    // failed (MATCH_NOT_FOUND)
        .mockResolvedValueOnce(1)    // livenessFailures
        .mockResolvedValueOnce(0);   // qualityFailures

      prisma.recognitionAttempt.aggregate.mockResolvedValue({
        _avg: {
          processingTimeMs: 120.6,
        },
      });

      prisma.faceEnrollment.count.mockResolvedValue(12);
      prisma.recognitionSession.count.mockResolvedValue(4);
      prisma.faceDevice.count.mockResolvedValue(2);
      prisma.attendance.count.mockResolvedValue(3);

      const result = await service.getAnalytics(manager);

      expect(result.overview).toEqual(
        expect.objectContaining({
          totalEnrolled: 12,
          totalSessions: 4,
          totalAttempts: 10,

          recognitionSuccessRate: 80,
          livenessPassRate: 90,

          averageLatencyMs: 121,

          activeDevices: 2,
          todayAttendance: 3,
        }),
      );
    });

    it('is completely zero-division safe', async () => {
      const { service } = await makeService();

      const result = await service.getAnalytics(manager);

      expect(result.overview.recognitionSuccessRate).toBe(null);
      expect(result.overview.livenessPassRate).toBe(null);
      expect(result.overview.averageLatencyMs).toBe(0);
    });

    it('handles a 100% recognition success rate', async () => {
      const { service, prisma } = await makeService();

      prisma.recognitionAttempt.count
        .mockResolvedValueOnce(10)   // totalAttempts
        .mockResolvedValueOnce(10)   // successful
        .mockResolvedValueOnce(0)    // uncertain
        .mockResolvedValueOnce(0)    // failed
        .mockResolvedValueOnce(0)    // livenessFailures
        .mockResolvedValueOnce(0);   // qualityFailures

      const result = await service.getAnalytics(manager);

      expect(result.overview.recognitionSuccessRate).toBe(100);
      expect(result.overview.livenessPassRate).toBe(100);
    });

    it('handles a 0% recognition success rate', async () => {
      const { service, prisma } = await makeService();

      prisma.recognitionAttempt.count
        .mockResolvedValueOnce(10)   // totalAttempts
        .mockResolvedValueOnce(0)    // successful
        .mockResolvedValueOnce(0)    // uncertain
        .mockResolvedValueOnce(0)    // failed
        .mockResolvedValueOnce(0)    // livenessFailures
        .mockResolvedValueOnce(0);   // qualityFailures

      const result = await service.getAnalytics(manager);

      expect(result.overview.recognitionSuccessRate).toBe(0);
    });

    it('rounds fractional latency deterministically', async () => {
      const { service, prisma } = await makeService();

      prisma.recognitionAttempt.count
        .mockResolvedValueOnce(1)    // totalAttempts
        .mockResolvedValueOnce(1)    // successful
        .mockResolvedValueOnce(0)    // uncertain
        .mockResolvedValueOnce(0)    // failed
        .mockResolvedValueOnce(0)    // livenessFailures
        .mockResolvedValueOnce(0);   // qualityFailures

      prisma.recognitionAttempt.aggregate.mockResolvedValue({
        _avg: {
          processingTimeMs: 120.49,
        },
      });

      const result = await service.getAnalytics(manager);

      expect(result.overview.averageLatencyMs).toBe(120);
    });

    it('handles null average processing time', async () => {
      const { service, prisma } = await makeService();

      prisma.recognitionAttempt.count
        .mockResolvedValueOnce(0)    // totalAttempts
        .mockResolvedValueOnce(0)    // successful
        .mockResolvedValueOnce(0)    // uncertain
        .mockResolvedValueOnce(0)    // failed
        .mockResolvedValueOnce(0)    // livenessFailures
        .mockResolvedValueOnce(0);   // qualityFailures

      prisma.recognitionAttempt.aggregate.mockResolvedValue({
        _avg: {
          processingTimeMs: null,
        },
      });

      const result = await service.getAnalytics(manager);

      expect(result.overview.averageLatencyMs).toBe(0);
    });
  });

  /* ──────────────────────────────────────────────────────────────────── */
  /* Tenant isolation across analytics                                    */
  /* ──────────────────────────────────────────────────────────────────── */

  describe('tenant isolation', () => {
    it('applies organizationId to every analytics count', async () => {
      const { service, prisma } = await makeService();

      await service.getAnalytics(manager);

      const models = [
        prisma.faceEnrollment,
        prisma.recognitionSession,
        prisma.recognitionAttempt,
        prisma.faceDevice,
        prisma.cameraAttendanceEvent,
      ];

      for (const model of models) {
        for (const call of model.count.mock.calls) {
          expect(call[0]?.where?.organizationId).toBe('org-1');
        }
      }
    });

    it('applies organizationId to recognition aggregate/count queries', async () => {
      const { service, prisma } = await makeService();

      await service.getAnalytics(manager);

      const countCalls =
        prisma.recognitionAttempt.count.mock.calls;

      for (const call of countCalls) {
        expect(call[0]?.where?.organizationId).toBe('org-1');
      }

      const aggregateCalls =
        prisma.recognitionAttempt.aggregate.mock.calls;

      for (const call of aggregateCalls) {
        expect(call[0]?.where?.organizationId).toBe('org-1');
      }
    });
  });

  /* ──────────────────────────────────────────────────────────────────── */
  /* Insufficient-funds entry gate (F-009)                                */
  /* ──────────────────────────────────────────────────────────────────── */

  describe('insufficient-funds entry gate', () => {
    /** Minimal payload that passes magic-byte validation (JPEG SOI + APP0). */
    const JPEG_BASE64 = '/9j/4A==';

    function overdueInvoice() {
      return {
        status: 'ISSUED',
        total: 1_000,
        paidAmount: 0,
        refundedAmount: 0,
        dueDate: new Date('2020-01-01T00:00:00.000Z'),
      };
    }

    function attemptResult(overrides: Record<string, unknown> = {}) {
      return {
        attemptId: 'attempt-1',
        identified: true,
        status: 'IDENTIFIED',
        student: { id: 'student-1', firstName: 'A', lastName: 'B' },
        confidence: 'HIGH',
        liveness: 'PASS',
        qualityScore: 0.9,
        attendanceRecorded: true,
        attendanceDecision: 'RECORDED',
        attendanceRecordId: 'attendance-1',
        message: 'matched',
        ...overrides,
      };
    }

    function stubRecognition(service: FaceService, result: unknown) {
      vi.spyOn(
        service as unknown as { getRecognitionService: () => unknown },
        'getRecognitionService',
      ).mockReturnValue({
        processAttempt: vi.fn().mockResolvedValue(result),
      });
    }

    function makeTransactionClient() {
      return {
        cameraAttendanceEvent: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        attendance: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
    }

    it('rolls back only the attendance created by the refused attempt', async () => {
      const { service, prisma } = await makeService();

      stubRecognition(service, attemptResult());

      prisma.student.findFirst.mockResolvedValue({ balance: 0 });
      prisma.invoice.findMany.mockResolvedValue([overdueInvoice()]);

      const tx = makeTransactionClient();

      prisma.$transaction.mockImplementation(
        (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      );

      const result = await service.processAttempt(
        manager,
        'session-1',
        JPEG_BASE64,
      );

      expect(result).toMatchObject({
        accessDenied: true,
        accessReason: 'INSUFFICIENT_FUNDS',
        attendanceRecorded: false,
        overdue: 1_000,
      });

      // The Attendance row is deleted by exact id + tenant + attempt. A
      // student-scoped time-window delete would also wipe a teacher's manual
      // entry (or a second legitimate recognition) landing in that window.
      expect(tx.attendance.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'attendance-1',
          organizationId: 'org-1',
          studentId: 'student-1',
          recognitionAttemptId: 'attempt-1',
        },
      });

      expect(tx.cameraAttendanceEvent.deleteMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          studentId: 'student-1',
          attendanceId: 'attendance-1',
        },
      });
    });

    it('deletes nothing when the attempt created no attendance row', async () => {
      // DUPLICATE_PREVENTED → attendanceRecordId is null, so the pre-existing
      // row belongs to an earlier recognition and must survive untouched.
      const { service, prisma } = await makeService();

      stubRecognition(
        service,
        attemptResult({
          attendanceRecorded: false,
          attendanceDecision: 'DUPLICATE_PREVENTED',
          attendanceRecordId: null,
        }),
      );

      prisma.student.findFirst.mockResolvedValue({ balance: 0 });
      prisma.invoice.findMany.mockResolvedValue([overdueInvoice()]);

      const tx = makeTransactionClient();

      prisma.$transaction.mockImplementation(
        (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      );

      const result = await service.processAttempt(
        manager,
        'session-1',
        JPEG_BASE64,
      );

      expect(result).toMatchObject({
        accessDenied: true,
        attendanceRecorded: false,
      });

      expect(tx.attendance.deleteMany).not.toHaveBeenCalled();
      expect(tx.cameraAttendanceEvent.deleteMany).not.toHaveBeenCalled();
    });

    it('admits a student whose invoices are fully paid', async () => {
      const { service, prisma } = await makeService();

      stubRecognition(service, attemptResult());

      prisma.student.findFirst.mockResolvedValue({ balance: 0 });
      prisma.invoice.findMany.mockResolvedValue([
        {
          ...overdueInvoice(),
          status: 'PAID',
          paidAmount: 1_000,
        },
      ]);

      const result = await service.processAttempt(
        manager,
        'session-1',
        JPEG_BASE64,
      );

      expect(result).toMatchObject({ accessDenied: false });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('never resolves a student outside the caller\u2019s organization', async () => {
      const { service, prisma } = await makeService();

      stubRecognition(service, attemptResult());

      // Tenant-scoped read returns nothing → the gate cannot deny (or touch)
      // a student that does not belong to this organization.
      prisma.student.findFirst.mockResolvedValue(null);

      const result = await service.processAttempt(
        manager,
        'session-1',
        JPEG_BASE64,
      );

      expect(prisma.student.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'student-1', organizationId: 'org-1' },
        }),
      );

      expect(prisma.invoice.findMany).not.toHaveBeenCalled();
      expect(result).toMatchObject({ accessDenied: true, accessReason: 'STUDENT_NOT_FOUND' });
    });

    it('stores the denied response snapshot on the attempt for replay', async () => {
      const { service, prisma } = await makeService();

      stubRecognition(service, attemptResult());

      prisma.student.findFirst.mockResolvedValue({ balance: 0 });
      prisma.invoice.findMany.mockResolvedValue([overdueInvoice()]);

      const tx = makeTransactionClient();
      prisma.$transaction.mockImplementation(
        (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      );

      await service.processAttempt(
        manager,
        'session-1',
        JPEG_BASE64,
        'client-key-1',
      );

      const updateArgs =
        prisma.recognitionAttempt.update.mock.calls[0][0];
      expect(updateArgs.where).toEqual({ id: 'attempt-1' });
      expect(updateArgs.data.clientAttemptId).toBe('client-key-1');

      const snapshot =
        updateArgs.data.metadata.idempotencySnapshot;
      expect(snapshot).toMatchObject({
        accessDenied: true,
        accessReason: 'INSUFFICIENT_FUNDS',
        attendanceRecorded: false,
      });
    });

    it('replays the EXACT stored result including accessDenied', async () => {
      const { service, prisma } = await makeService();

      prisma.recognitionAttempt.findFirst.mockResolvedValue({
        id: 'attempt-1',
        status: 'IDENTIFIED',
        attendanceDecision: 'INSUFFICIENT_FUNDS',
        attendanceId: null,
        metadata: {
          idempotencySnapshot: {
            attemptId: 'attempt-1',
            status: 'IDENTIFIED',
            attendanceDecision: 'INSUFFICIENT_FUNDS',
            attendanceRecorded: false,
            attendanceRecordId: null,
            student: { id: 'student-1' },
            accessDenied: true,
            accessReason: 'INSUFFICIENT_FUNDS',
            overdue: 1_000,
          },
        },
        student: null,
      });

      const result = await service.processAttempt(
        manager,
        'session-1',
        'bm90LWRlY29kZWQ=', // must never be decoded — replay short-circuits
        'client-key-1',
      );

      expect(result).toMatchObject({
        idempotentReplay: true,
        accessDenied: true,
        accessReason: 'INSUFFICIENT_FUNDS',
        attendanceRecorded: false,
        overdue: 1_000,
      });
      expect(result.attemptId).toBe('attempt-1');
    });
  });
});
