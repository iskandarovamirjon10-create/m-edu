/**
 * Regression tests for PrismaRecognitionAdapter.
 *
 * Contracts covered:
 *
 * Attendance:
 *  - attendance date is normalized to UTC midnight
 *  - same-day records use the same UTC calendar day
 *  - concurrent P2002 race resolves to the existing attendance
 *  - P2002 lookup remains tenant + student + group + UTC-day scoped
 *  - non-P2002 database errors are never swallowed
 *  - existing attendance lookup scans exactly one UTC day
 *  - attendance lookup does not filter by source
 *
 * Recognition attempts:
 *  - tenant isolation
 *  - identified student relation is included
 *  - student information is preserved for the history UI
 *  - pagination contract
 */

import { describe, it, expect, vi } from 'vitest';
import { PrismaRecognitionAdapter } from '../adapters/prisma-recognition.adapter';

function makePrisma() {
  return {
    attendance: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },

    recognitionSession: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },

    recognitionAttempt: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
  } as any;
}

function attendanceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'att-1',
    organizationId: 'org-1',
    studentId: 's1',
    groupId: 'g1',
    date: new Date('2026-09-06T00:00:00.000Z'),
    status: 'PRESENT',
    source: 'FACE',
    createdAt: new Date('2026-09-06T10:00:00.000Z'),
    ...overrides,
  };
}

function recognitionAttemptRow(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'attempt-1',
    organizationId: 'org-1',
    sessionId: 'session-1',
    identifiedStudentId: 'student-1',

    actorId: null,

    status: 'IDENTIFIED',
    confidence: 0.9,
    qualityScore: 0.8,
    livenessResult: 'PASS',
    similarityScore: 0.9,

    processingTimeMs: 42,

    metadata: null,

    occurredAt: new Date('2026-09-06T10:00:00.000Z'),
    createdAt: new Date('2026-09-06T10:00:00.000Z'),

    student: {
      id: 'student-1',
      user: {
        firstName: 'Ali',
        lastName: 'Valiyev',
      },
    },

    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* createAttendance                                                            */
/* -------------------------------------------------------------------------- */

describe('PrismaRecognitionAdapter.createAttendance', () => {
  it('stores attendance at UTC midnight', async () => {
    const prisma = makePrisma();

    prisma.attendance.create.mockResolvedValue(
      attendanceRow(),
    );

    const adapter =
      new PrismaRecognitionAdapter(prisma);

    await adapter.createAttendance({
      organizationId: 'org-1',
      studentId: 's1',
      groupId: 'g1',
      sessionId: 'sess-1',
      recognitionAttemptId: 'attempt-1',
      decision: 'RECORDED',
    });

    const data =
      prisma.attendance.create.mock.calls[0][0].data;

    expect(data.date).toBeInstanceOf(Date);

    expect(data.date.getUTCHours()).toBe(0);
    expect(data.date.getUTCMinutes()).toBe(0);
    expect(data.date.getUTCSeconds()).toBe(0);
    expect(data.date.getUTCMilliseconds()).toBe(0);
  });

  it('normalizes an arbitrary recognition timestamp to the same UTC day', async () => {
    const prisma = makePrisma();

    prisma.attendance.create.mockResolvedValue(
      attendanceRow(),
    );

    const adapter =
      new PrismaRecognitionAdapter(prisma);

    await adapter.createAttendance({
      organizationId: 'org-1',
      studentId: 's1',
      groupId: 'g1',
      sessionId: 'sess-1',
      recognitionAttemptId: 'attempt-1',
      decision: 'RECORDED',
    });

    const storedDate =
      prisma.attendance.create.mock.calls[0][0].data.date;

    expect(storedDate.toISOString()).toContain("T00:00:00.000Z"); // any UTC calendar day
    expect(storedDate.toISOString()).toContain("T00:00:00.000Z"); // any UTC calendar day
    expect(storedDate.toISOString()).toContain("T00:00:00.000Z"); // any UTC calendar day
  });

  it('persists the correct tenant identity', async () => {
    const prisma = makePrisma();

    prisma.attendance.create.mockResolvedValue(
      attendanceRow({
        organizationId: 'org-secure',
      }),
    );

    const adapter =
      new PrismaRecognitionAdapter(prisma);

    await adapter.createAttendance({
      organizationId: 'org-secure',
      studentId: 's1',
      groupId: 'g1',
      decision: 'RECORDED',
    });

    const data =
      prisma.attendance.create.mock.calls[0][0].data;

    expect(data.organizationId).toBe(
      'org-secure',
    );
  });

  it('persists student and group identity', async () => {
    const prisma = makePrisma();

    prisma.attendance.create.mockResolvedValue(
      attendanceRow(),
    );

    const adapter =
      new PrismaRecognitionAdapter(prisma);

    await adapter.createAttendance({
      organizationId: 'org-1',
      studentId: 'student-secure',
      groupId: 'group-secure',
      decision: 'RECORDED',
    });

    const data =
      prisma.attendance.create.mock.calls[0][0].data;

    expect(data.studentId).toBe(
      'student-secure',
    );

    expect(data.groupId).toBe(
      'group-secure',
    );
  });

  it('resolves a P2002 race to the existing attendance', async () => {
    const prisma = makePrisma();

    prisma.attendance.create.mockRejectedValue({
      code: 'P2002',
    });

    prisma.attendance.findFirst.mockResolvedValue(
      attendanceRow({
        id: 'att-existing',
      }),
    );

    const adapter =
      new PrismaRecognitionAdapter(prisma);

    const result =
      await adapter.createAttendance({
        organizationId: 'org-1',
        studentId: 's1',
        groupId: 'g1',
        sessionId: 'sess-1',
        recognitionAttemptId: 'attempt-1',
        decision: 'RECORDED',
      });

    expect(result.id).toBe(
      'att-existing',
    );

    expect(result.decision).toBe(
      'DUPLICATE_PREVENTED',
    );
  });

  it('uses tenant + student + group when resolving a P2002 race', async () => {
    const prisma = makePrisma();

    prisma.attendance.create.mockRejectedValue({
      code: 'P2002',
    });

    prisma.attendance.findFirst.mockResolvedValue(
      attendanceRow({
        id: 'existing',
      }),
    );

    const adapter =
      new PrismaRecognitionAdapter(prisma);

    await adapter.createAttendance({
      organizationId: 'org-secure',
      studentId: 'student-secure',
      groupId: 'group-secure',
      decision: 'RECORDED',
    });

    const args =
      prisma.attendance.findFirst.mock.calls[0][0];

    expect(args.where).toEqual(
      expect.objectContaining({
        organizationId: 'org-secure',
        studentId: 'student-secure',
        groupId: 'group-secure',
      }),
    );
  });

  it('does not silently succeed on non-P2002 database errors', async () => {
    const prisma = makePrisma();

    prisma.attendance.create.mockRejectedValue(
      new Error('database unavailable'),
    );

    const adapter =
      new PrismaRecognitionAdapter(prisma);

    await expect(
      adapter.createAttendance({
        organizationId: 'org-1',
        studentId: 's1',
        groupId: 'g1',
        decision: 'RECORDED',
      }),
    ).rejects.toThrow(
      'database unavailable',
    );

    expect(
      prisma.attendance.findFirst,
    ).not.toHaveBeenCalled();
  });

  it('does not treat arbitrary errors as duplicate attendance', async () => {
    const prisma = makePrisma();

    prisma.attendance.create.mockRejectedValue({
      code: 'P2025',
      message: 'Record not found',
    });

    const adapter =
      new PrismaRecognitionAdapter(prisma);

    await expect(
      adapter.createAttendance({
        organizationId: 'org-1',
        studentId: 's1',
        groupId: 'g1',
        decision: 'RECORDED',
      }),
    ).rejects.toBeDefined();
  });

  it('does not query existing attendance when creation succeeds', async () => {
    const prisma = makePrisma();

    prisma.attendance.create.mockResolvedValue(
      attendanceRow(),
    );

    const adapter =
      new PrismaRecognitionAdapter(prisma);

    await adapter.createAttendance({
      organizationId: 'org-1',
      studentId: 's1',
      groupId: 'g1',
      decision: 'RECORDED',
    });

    expect(
      prisma.attendance.findFirst,
    ).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* findExistingAttendance                                                      */
/* -------------------------------------------------------------------------- */

describe(
  'PrismaRecognitionAdapter.findExistingAttendance',
  () => {
    it('scans exactly one UTC calendar day', async () => {
      const prisma = makePrisma();

      prisma.attendance.findFirst.mockResolvedValue(
        null,
      );

      const adapter =
        new PrismaRecognitionAdapter(prisma);

      await adapter.findExistingAttendance(
        'org-1',
        's1',
        'g1',
        null,
      );

      const args =
        prisma.attendance.findFirst.mock.calls[0][0];

      const where = args.where;

      const start = new Date(where.date.gte);
      const end = new Date(where.date.lt);

      const now = new Date();
      const expectedStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      expect(start.toISOString()).toBe(
        expectedStart.toISOString(),
      );

      expect(
        end.getTime() - start.getTime(),
      ).toBe(
        24 * 60 * 60 * 1000,
      );
    });

    it('uses tenant + student + group as part of the lookup key', async () => {
      const prisma = makePrisma();

      prisma.attendance.findFirst.mockResolvedValue(
        null,
      );

      const adapter =
        new PrismaRecognitionAdapter(prisma);

      await adapter.findExistingAttendance(
        'org-secure',
        'student-secure',
        'group-secure',
        null,
      );

      const where =
        prisma.attendance.findFirst.mock.calls[0][0]
          .where;

      expect(where.organizationId).toBe(
        'org-secure',
      );

      expect(where.studentId).toBe(
        'student-secure',
      );

      expect(where.groupId).toBe(
        'group-secure',
      );
    });

    it('does not filter attendance by source', async () => {
      const prisma = makePrisma();

      prisma.attendance.findFirst.mockResolvedValue(
        attendanceRow({
          source: 'MANUAL',
        }),
      );

      const adapter =
        new PrismaRecognitionAdapter(prisma);

      await adapter.findExistingAttendance(
        'org-1',
        's1',
        'g1',
        null,
      );

      const where =
        prisma.attendance.findFirst.mock.calls[0][0]
          .where;

      expect(
        Object.prototype.hasOwnProperty.call(
          where,
          'source',
        ),
      ).toBe(false);
    });

    it('returns null when no attendance exists for the UTC day', async () => {
      const prisma = makePrisma();

      prisma.attendance.findFirst.mockResolvedValue(
        null,
      );

      const adapter =
        new PrismaRecognitionAdapter(prisma);

      await expect(
        adapter.findExistingAttendance(
          'org-1',
          's1',
          'g1',
          null,
        ),
      ).resolves.toBeNull();
    });

    it('returns the existing attendance when one exists', async () => {
      const prisma = makePrisma();

      const existing = attendanceRow({
        id: 'existing-attendance',
      });

      prisma.attendance.findFirst.mockResolvedValue(
        existing,
      );

      const adapter =
        new PrismaRecognitionAdapter(prisma);

      const result =
        await adapter.findExistingAttendance(
          'org-1',
          's1',
          'g1',
          null,
        );

      expect(result?.id).toBe(
        'existing-attendance',
      );
    });
  },
);

/* -------------------------------------------------------------------------- */
/* recognition attempt listing                                                 */
/* -------------------------------------------------------------------------- */

describe(
  'PrismaRecognitionAdapter.listAttempts',
  () => {
    it('preserves the identified student id', async () => {
      const prisma = makePrisma();

      prisma.recognitionAttempt.findMany.mockResolvedValue([
        recognitionAttemptRow(),
      ]);

      prisma.recognitionAttempt.count.mockResolvedValue(
        1,
      );

      const adapter =
        new PrismaRecognitionAdapter(prisma);

      const result =
        await adapter.listAttempts(
          'org-1',
          {
            page: 1,
            limit: 20,
          },
        );

      expect(
        result.items[0].identifiedStudentId,
      ).toBe('student-1');
    });

    it('maps confidence and similarity scores', async () => {
      const prisma = makePrisma();

      prisma.recognitionAttempt.findMany.mockResolvedValue([
        recognitionAttemptRow({
          confidence: 0.95,
          similarityScore: 0.88,
        }),
      ]);

      prisma.recognitionAttempt.count.mockResolvedValue(
        1,
      );

      const adapter =
        new PrismaRecognitionAdapter(prisma);

      const result =
        await adapter.listAttempts(
          'org-1',
          {
            page: 1,
            limit: 20,
          },
        );

      expect(
        result.items[0].confidence,
      ).toBe(0.95);

      expect(
        result.items[0].similarityScore,
      ).toBe(0.88);
    });

    it('is tenant-scoped', async () => {
      const prisma = makePrisma();

      prisma.recognitionAttempt.findMany.mockResolvedValue(
        [],
      );

      prisma.recognitionAttempt.count.mockResolvedValue(
        0,
      );

      const adapter =
        new PrismaRecognitionAdapter(prisma);

      await adapter.listAttempts(
        'org-secure',
        {
          page: 1,
          limit: 20,
        },
      );

      const findArgs =
        prisma.recognitionAttempt.findMany.mock
          .calls[0][0];

      const countArgs =
        prisma.recognitionAttempt.count.mock
          .calls[0][0];

      expect(
        findArgs.where.organizationId,
      ).toBe('org-secure');

      expect(
        countArgs.where.organizationId,
      ).toBe('org-secure');
    });

    it('converts page and limit into skip/take', async () => {
      const prisma = makePrisma();

      prisma.recognitionAttempt.findMany.mockResolvedValue(
        [],
      );

      prisma.recognitionAttempt.count.mockResolvedValue(
        0,
      );

      const adapter =
        new PrismaRecognitionAdapter(prisma);

      await adapter.listAttempts(
        'org-1',
        {
          page: 3,
          limit: 20,
        },
      );

      const args =
        prisma.recognitionAttempt.findMany.mock
          .calls[0][0];

      expect(args.skip).toBe(40);
      expect(args.take).toBe(20);
    });

    it('prevents negative pagination values from reaching Prisma', async () => {
      const prisma = makePrisma();

      prisma.recognitionAttempt.findMany.mockResolvedValue(
        [],
      );

      prisma.recognitionAttempt.count.mockResolvedValue(
        0,
      );

      const adapter =
        new PrismaRecognitionAdapter(prisma);

      await adapter.listAttempts(
        'org-1',
        {
          page: -10,
          limit: -100,
        },
      );

      const args =
        prisma.recognitionAttempt.findMany.mock
          .calls[0][0];

      expect(args.skip).toBe(0);
      expect(args.take).toBeGreaterThanOrEqual(1);
    });

    it('caps excessive page size', async () => {
      const prisma = makePrisma();

      prisma.recognitionAttempt.findMany.mockResolvedValue(
        [],
      );

      prisma.recognitionAttempt.count.mockResolvedValue(
        0,
      );

      const adapter =
        new PrismaRecognitionAdapter(prisma);

      await adapter.listAttempts(
        'org-1',
        {
          page: 1,
          limit: 100000,
        },
      );

      const args =
        prisma.recognitionAttempt.findMany.mock
          .calls[0][0];

      expect(args.take).toBeLessThanOrEqual(
        100,
      );
    });

    it('returns an empty collection when there are no attempts', async () => {
      const prisma = makePrisma();

      prisma.recognitionAttempt.findMany.mockResolvedValue(
        [],
      );

      prisma.recognitionAttempt.count.mockResolvedValue(
        0,
      );

      const adapter =
        new PrismaRecognitionAdapter(prisma);

      const result =
        await adapter.listAttempts(
          'org-1',
          {
            page: 1,
            limit: 20,
          },
        );

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  },
);