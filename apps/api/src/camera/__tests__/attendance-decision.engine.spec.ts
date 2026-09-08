import { describe, expect, it, vi } from 'vitest';

import { AttendanceDecisionEngine } from '../attendance-decision.engine';

type PrismaMock = {
  $transaction: ReturnType<typeof vi.fn>;
  organization: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  camera: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  student: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  studentGroup: {
    findMany: ReturnType<typeof vi.fn>;
  };
  attendance: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  cameraAttendanceEvent: {
    upsert: ReturnType<typeof vi.fn>;
  };
};

function makePrisma(): PrismaMock {
  const prisma: PrismaMock = {
    $transaction: vi.fn(async (fn: (tx: PrismaMock) => Promise<unknown>) => fn(prisma)),

    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-1' }),
    },

    camera: {
      findFirst: vi.fn().mockResolvedValue({ id: 'cam-1', name: 'Cam A', location: 'Room 1' }),
    },

    student: {
      findFirst: vi.fn(),
    },

    studentGroup: {
      findMany: vi.fn(),
    },

    attendance: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },

    cameraAttendanceEvent: {
      upsert: vi.fn(),
    },
  };
  return prisma;
}

function makeParams(
  overrides: Record<string, unknown> = {},
) {
  return {
    organizationId: 'org-1',
    cameraId: 'cam-1',
    studentId: 'student-1',

    recognizedAt: new Date(
      '2026-09-05T10:30:00Z',
    ),

    confidence: 0.92,
    qualityScore: 0.85,
    similarityScore: 0.92,

    cameraLocation: 'Room 1',
    cameraName: 'Cam A',

    ...overrides,
  };
}

function mockStudent(prisma: PrismaMock) {
  prisma.student.findFirst.mockResolvedValue({
    id: 'student-1',
    userId: 'user-1',
  });
}

function mockGroup(prisma: PrismaMock) {
  prisma.studentGroup.findMany.mockResolvedValue([
    {
      groupId: 'group-1',
      group: {
        id: 'group-1',
        name: 'G1',
        room: 'Room 1',
        schedules: [
          {
            dayOfWeek: 'SATURDAY',
            startTime: '08:00',
            endTime: '12:00',
            room: 'Room 1',
          },
        ],
      },
    },
  ]);
}

function mockNoAttendance(prisma: PrismaMock) {
  prisma.attendance.findUnique.mockResolvedValue(
    null,
  );
}

function setupSuccessfulRecognition(
  prisma: PrismaMock,
) {
  mockStudent(prisma);
  mockGroup(prisma);
  mockNoAttendance(prisma);

  prisma.attendance.create.mockResolvedValue({
    id: 'att-1',
  });

  prisma.cameraAttendanceEvent.upsert.mockResolvedValue(
    {
      id: 'evt-real-123',
    },
  );
}

describe('AttendanceDecisionEngine', () => {
  describe('event durability', () => {
    it('returns the real persisted event id', async () => {
      const prisma = makePrisma();

      setupSuccessfulRecognition(prisma);

      const engine =
        new AttendanceDecisionEngine(
          prisma,
        );

      const result =
        await engine.processRecognition(
          makeParams(),
        );

      expect(
        result.decision,
      ).toBe('RECORDED');

      expect(
        result.attendanceId,
      ).toBe('att-1');

      expect(
        result.eventId,
      ).toBe('evt-real-123');

      expect(
        result.eventId,
      ).not.toMatch(/^evt-\d+$/);

      expect(
        prisma.cameraAttendanceEvent
          .upsert,
      ).toHaveBeenCalledTimes(1);
    });

    it('never fabricates an event id', async () => {
      const prisma = makePrisma();

      setupSuccessfulRecognition(prisma);

      prisma.cameraAttendanceEvent.upsert.mockResolvedValue(
        {
          id: 'db-cuid-987abc',
        },
      );

      const engine =
        new AttendanceDecisionEngine(
          prisma,
        );

      const result =
        await engine.processRecognition(
          makeParams(),
        );

      expect(result.eventId).toBe(
        'db-cuid-987abc',
      );

      expect(result.eventId).not.toMatch(
        /^evt-/,
      );
    });

    it('propagates event persistence failure', async () => {
      const prisma = makePrisma();

      mockStudent(prisma);
      mockGroup(prisma);
      mockNoAttendance(prisma);

      prisma.attendance.create.mockResolvedValue(
        {
          id: 'att-1',
        },
      );

      const databaseError =
        new Error('db down');

      prisma.cameraAttendanceEvent.upsert.mockRejectedValue(
        databaseError,
      );

      const engine =
        new AttendanceDecisionEngine(
          prisma,
        );

      await expect(
        engine.processRecognition(
          makeParams(),
        ),
      ).rejects.toThrow('db down');
    });

    it('does not convert event persistence failure into RECORDED', async () => {
      const prisma = makePrisma();

      mockStudent(prisma);
      mockGroup(prisma);
      mockNoAttendance(prisma);

      prisma.attendance.create.mockResolvedValue(
        {
          id: 'att-1',
        },
      );

      prisma.cameraAttendanceEvent.upsert.mockRejectedValue(
        new Error(
          'event persistence unavailable',
        ),
      );

      const engine =
        new AttendanceDecisionEngine(
          prisma,
        );

      await expect(
        engine.processRecognition(
          makeParams(),
        ),
      ).rejects.toThrow(
        'event persistence unavailable',
      );

      /*
       * If the promise rejected, the engine must not
       * have returned a fabricated successful result.
       */
      expect(
        prisma.cameraAttendanceEvent
          .upsert,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('manual attendance authority', () => {
    it('preserves an existing MANUAL same-day record', async () => {
      const prisma = makePrisma();

      mockStudent(prisma);
      mockGroup(prisma);

      prisma.attendance.findUnique.mockResolvedValue(
        {
          id: 'att-manual',
          source: 'MANUAL',
          status: 'PRESENT',
        },
      );

      prisma.cameraAttendanceEvent.upsert.mockResolvedValue(
        {
          id: 'evt-1',
        },
      );

      const engine =
        new AttendanceDecisionEngine(
          prisma,
        );

      const result =
        await engine.processRecognition(
          makeParams(),
        );

      expect(
        result.decision,
      ).toBe('MANUAL_PRESERVED');

      expect(
        result.attendanceId,
      ).toBe('att-manual');

      expect(
        prisma.attendance.create,
      ).not.toHaveBeenCalled();
    });

    it('still persists the recognition event when manual attendance is preserved', async () => {
      const prisma = makePrisma();

      mockStudent(prisma);
      mockGroup(prisma);

      prisma.attendance.findUnique.mockResolvedValue(
        {
          id: 'att-manual',
          source: 'MANUAL',
          status: 'PRESENT',
        },
      );

      prisma.cameraAttendanceEvent.upsert.mockResolvedValue(
        {
          id: 'evt-manual-1',
        },
      );

      const engine =
        new AttendanceDecisionEngine(
          prisma,
        );

      const result =
        await engine.processRecognition(
          makeParams(),
        );

      expect(
        result.decision,
      ).toBe('MANUAL_PRESERVED');

      expect(
        result.eventId,
      ).toBe('evt-manual-1');

      expect(
        prisma.cameraAttendanceEvent
          .upsert,
      ).toHaveBeenCalledTimes(1);
    });

    it('propagates event failure even when manual attendance is authoritative', async () => {
      const prisma = makePrisma();

      mockStudent(prisma);
      mockGroup(prisma);

      prisma.attendance.findUnique.mockResolvedValue(
        {
          id: 'att-manual',
          source: 'MANUAL',
          status: 'PRESENT',
        },
      );

      prisma.cameraAttendanceEvent.upsert.mockRejectedValue(
        new Error('event db failure'),
      );

      const engine =
        new AttendanceDecisionEngine(
          prisma,
        );

      await expect(
        engine.processRecognition(
          makeParams(),
        ),
      ).rejects.toThrow(
        'event db failure',
      );

      expect(
        prisma.attendance.create,
      ).not.toHaveBeenCalled();
    });
  });

  describe('successful attendance recording', () => {
    it('creates attendance before persisting the recognition event', async () => {
      const prisma = makePrisma();

      setupSuccessfulRecognition(prisma);

      const callOrder: string[] = [];

      prisma.attendance.create.mockImplementation(
        async () => {
          callOrder.push(
            'attendance.create',
          );

          return {
            id: 'att-1',
          };
        },
      );

      prisma.cameraAttendanceEvent.upsert.mockImplementation(
        async () => {
          callOrder.push(
            'cameraAttendanceEvent.upsert',
          );

          return {
            id: 'evt-1',
          };
        },
      );

      const engine =
        new AttendanceDecisionEngine(
          prisma,
        );

      await engine.processRecognition(
        makeParams(),
      );

      expect(callOrder).toEqual([
        'attendance.create',
        'cameraAttendanceEvent.upsert',
      ]);
    });

    it('returns both attendanceId and eventId', async () => {
      const prisma = makePrisma();

      setupSuccessfulRecognition(prisma);

      const engine =
        new AttendanceDecisionEngine(
          prisma,
        );

      const result =
        await engine.processRecognition(
          makeParams(),
        );

      expect(result).toMatchObject({
        decision: 'RECORDED',
        attendanceId: 'att-1',
        eventId: 'evt-real-123',
      });
    });
  });
});