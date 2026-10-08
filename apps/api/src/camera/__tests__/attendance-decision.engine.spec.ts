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
  invoice: {
    findMany: ReturnType<typeof vi.fn>;
  };
  studentGroup: {
    findMany: ReturnType<typeof vi.fn>;
  };
  attendance: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  lesson: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  cameraAttendanceEvent: {
    upsert: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  organizationHoliday: {
    findFirst: ReturnType<typeof vi.fn>;
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

    invoice: {
      findMany: vi.fn().mockResolvedValue([]),
    },

    studentGroup: {
      findMany: vi.fn(),
    },

    attendance: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },

    lesson: {
      findFirst: vi.fn().mockResolvedValue({ id: 'lesson-1', status: 'PLANNED' }),
      update: vi.fn().mockResolvedValue({ id: 'lesson-1', status: 'CONDUCTED' }),
    },

    cameraAttendanceEvent: {
      upsert: vi.fn(),
      findUnique: vi.fn().mockResolvedValue(null),
    },

    organizationHoliday: {
      findFirst: vi.fn().mockResolvedValue(null),
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

  describe('forensic production edge cases', () => {
    describe('UTC / local midnight and Asia/Tashkent timezone', () => {
      it('dates attendance using the organization local calendar date across midnight', async () => {
        const prisma = makePrisma();
        prisma.organization.findUnique.mockResolvedValue({
          id: 'org-1',
          timezone: 'Asia/Tashkent', // UTC+5
        });

        // 2026-09-07 19:30 UTC = 2026-09-08 00:30 local (TUESDAY)
        const recognizedAt = new Date('2026-09-07T19:30:00Z');

        mockStudent(prisma);
        prisma.studentGroup.findMany.mockResolvedValue([
          {
            groupId: 'group-midnight',
            group: {
              id: 'group-midnight',
              name: 'Night Owls',
              room: 'Room 1',
              schedules: [
                {
                  dayOfWeek: 'TUESDAY',
                  startTime: '00:00',
                  endTime: '02:00',
                  room: 'Room 1',
                },
              ],
            },
          },
        ]);
        mockNoAttendance(prisma);
        prisma.attendance.create.mockResolvedValue({ id: 'att-midnight' });
        prisma.cameraAttendanceEvent.upsert.mockResolvedValue({ id: 'evt-midnight', decision: 'RECORDED' });

        const engine = new AttendanceDecisionEngine(prisma);
        const result = await engine.processRecognition(
          makeParams({ recognizedAt }),
        );

        expect(result.decision).toBe('RECORDED');

        // Verify attendance.create received Tuesday 2026-09-08 UTC midnight, NOT Monday 2026-09-07
        const createdAttendance = prisma.attendance.create.mock.calls[0][0].data;
        expect(createdAttendance.date.toISOString()).toBe('2026-09-08T00:00:00.000Z');
      });
    });

    describe('overnight schedules (e.g. 23:00 -> 01:00)', () => {
      function setupOvernight(prisma: PrismaMock) {
        prisma.organization.findUnique.mockResolvedValue({
          id: 'org-1',
          timezone: 'Asia/Tashkent',
        });
        mockStudent(prisma);
        mockNoAttendance(prisma);
        prisma.studentGroup.findMany.mockResolvedValue([
          {
            groupId: 'group-overnight',
            group: {
              id: 'group-overnight',
              name: 'Overnight Code',
              room: 'Lab 1',
              schedules: [
                {
                  dayOfWeek: 'MONDAY',
                  startTime: '23:00',
                  endTime: '01:00',
                  room: 'Lab 1',
                },
              ],
            },
          },
        ]);
        prisma.camera.findFirst.mockResolvedValue({
          id: 'cam-1',
          name: 'Lab Cam',
          location: 'Lab 1',
        });
        prisma.attendance.create.mockResolvedValue({ id: 'att-overnight' });
        prisma.cameraAttendanceEvent.upsert.mockResolvedValue({ id: 'evt-overnight', decision: 'RECORDED' });
      }

      it('accepts recognition on Monday evening at start window and marks PRESENT', async () => {
        const prisma = makePrisma();
        setupOvernight(prisma);

        // Monday 23:10 local = Monday 18:10 UTC in Tashkent (10 min after start)
        const recognizedAt = new Date('2026-09-07T18:10:00Z');

        const engine = new AttendanceDecisionEngine(prisma);
        const result = await engine.processRecognition(
          makeParams({ recognizedAt }),
        );

        expect(result.decision).toBe('RECORDED');
        const created = prisma.attendance.create.mock.calls[0][0].data;
        expect(created.status).toBe('PRESENT');
        expect(created.date.toISOString()).toBe('2026-09-07T00:00:00.000Z');
      });

      it('accepts recognition on Tuesday morning rollover and marks LATE (70 min after 23:00 start)', async () => {
        const prisma = makePrisma();
        setupOvernight(prisma);

        // Tuesday 00:10 local = Monday 19:10 UTC in Tashkent
        const recognizedAt = new Date('2026-09-07T19:10:00Z');

        const engine = new AttendanceDecisionEngine(prisma);
        const result = await engine.processRecognition(
          makeParams({ recognizedAt }),
        );

        expect(result.decision).toBe('RECORDED');
        const created = prisma.attendance.create.mock.calls[0][0].data;
        expect(created.status).toBe('LATE');
        // Anchor date must remain Monday (the scheduled lesson's date)
        expect(created.date.toISOString()).toBe('2026-09-07T00:00:00.000Z');
      });

      it('accepts at Tuesday 01:30 (end + 30 grace) and denies at Tuesday 01:31', async () => {
        const prisma = makePrisma();
        setupOvernight(prisma);
        const engine = new AttendanceDecisionEngine(prisma);

        // Tuesday 01:30 local = Monday 20:30 UTC
        const atGraceBoundary = new Date('2026-09-07T20:30:00Z');
        const accepted = await engine.processRecognition(
          makeParams({ recognizedAt: atGraceBoundary }),
        );
        expect(accepted.decision).toBe('RECORDED');

        // Tuesday 01:31 local = Monday 20:31 UTC (outside window)
        prisma.cameraAttendanceEvent.upsert.mockResolvedValueOnce({ id: 'evt-outside', decision: 'NO_SCHEDULED_GROUP' });
        const atPastGrace = new Date('2026-09-07T20:31:00Z');
        const denied = await engine.processRecognition(
          makeParams({ recognizedAt: atPastGrace }),
        );
        expect(denied.decision).toBe('NO_SCHEDULED_GROUP');
      });
    });

    describe('camera-location spoofing prevention', () => {
      it('uses authoritative camera.location from DB and falls back when exactly one group is time-valid', async () => {
        const prisma = makePrisma();
        mockStudent(prisma);
        mockNoAttendance(prisma);

        // Camera is actually in Room 2 in the database
        prisma.camera.findFirst.mockResolvedValue({
          id: 'cam-1',
          name: 'Cam A',
          location: 'Room 2',
        });

        // Group is scheduled in Room 1
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

        prisma.cameraAttendanceEvent.upsert.mockResolvedValue({
          id: 'evt-spoof',
          decision: 'RECORDED',
        });
        // The single time-valid group may be recorded via the schedule
        // fallback even though its room does not match the camera.
        prisma.attendance.create.mockResolvedValue({
          id: 'att-spoof',
        });

        const engine = new AttendanceDecisionEngine(prisma);

        // Attacker sends cameraLocation: 'Room 1' attempting to spoof the
        // room signal. The engine MUST use the DB camera.location (Room 2)
        // for room matching — but with exactly ONE time-valid group the room
        // mismatch falls back to the unambiguous schedule signal instead of
        // denying an in-progress class (business rule for stale room config).
        const result = await engine.processRecognition(
          makeParams({
            cameraLocation: 'Room 1',
          }),
        );

        expect(result.decision).toBe('RECORDED');
      });

      it('still denies when multiple time-valid groups exist and no room matches', async () => {
        const prisma = makePrisma();
        mockStudent(prisma);
        mockNoAttendance(prisma);

        // Camera is in Room 2 (DB authoritative).
        prisma.camera.findFirst.mockResolvedValue({
          id: 'cam-1',
          name: 'Cam A',
          location: 'Room 2',
        });

        // Two groups, both time-valid, both in other rooms — the room signal
        // is the only disambiguator and it matches neither, so spoofing the
        // payload location must NOT force a recording.
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
          {
            groupId: 'group-2',
            group: {
              id: 'group-2',
              name: 'G2',
              room: 'Room 3',
              schedules: [
                {
                  dayOfWeek: 'SATURDAY',
                  startTime: '08:00',
                  endTime: '12:00',
                  room: 'Room 3',
                },
              ],
            },
          },
        ]);

        prisma.cameraAttendanceEvent.upsert.mockResolvedValue({
          id: 'evt-spoof-denied',
          decision: 'NO_SCHEDULED_GROUP',
        });

        const engine = new AttendanceDecisionEngine(prisma);
        const result = await engine.processRecognition(
          makeParams({ cameraLocation: 'Room 1' }),
        );

        expect(result.decision).toBe('NO_SCHEDULED_GROUP');
      });
    });

    describe('manual attendance authoritative preservation', () => {
      it('preserves existing manual attendance without overwriting it', async () => {
        const prisma = makePrisma();
        mockStudent(prisma);
        mockGroup(prisma);

        prisma.attendance.findUnique.mockResolvedValue({
          id: 'manual-att-id',
          source: 'MANUAL',
          status: 'PRESENT',
        });

        prisma.cameraAttendanceEvent.upsert.mockResolvedValue({
          id: 'evt-manual',
          decision: 'MANUAL_PRESERVED',
        });

        const engine = new AttendanceDecisionEngine(prisma);
        const result = await engine.processRecognition(makeParams());

        expect(result.decision).toBe('MANUAL_PRESERVED');
        expect(result.attendanceId).toBe('manual-att-id');
        expect(prisma.attendance.create).not.toHaveBeenCalled();
      });
    });

    describe('idempotency key conflicts', () => {
      it('detects and throws when an existing event has a conflicting decision', async () => {
        const prisma = makePrisma();
        setupSuccessfulRecognition(prisma);

        // Event already exists with 'HOLIDAY' decision
        prisma.cameraAttendanceEvent.upsert.mockResolvedValue({
          id: 'evt-conflict',
          decision: 'HOLIDAY',
          studentId: 'student-1',
          cameraId: 'cam-1',
          groupId: 'group-1',
        });

        const engine = new AttendanceDecisionEngine(prisma);

        // Incoming attempt expects 'RECORDED'
        await expect(engine.processRecognition(makeParams())).rejects.toThrow(
          /Idempotency key conflict/,
        );
      });
    });

    describe('concurrent P2002 race resolution', () => {
      it('resolves concurrent duplicate when P2002 matches attendance unique constraint', async () => {
        const prisma = makePrisma();
        mockStudent(prisma);
        mockGroup(prisma);
        mockNoAttendance(prisma);

        // First attempt to create throws P2002
        const p2002Error = new Error('Unique constraint failed');
        (p2002Error as any).code = 'P2002';
        (p2002Error as any).meta = { target: ['studentId', 'groupId', 'date'] };

        prisma.attendance.create.mockRejectedValue(p2002Error);

        // Concurrent row query in resolveConcurrentDuplicate succeeds
        prisma.attendance.findUnique.mockResolvedValue({
          id: 'concurrent-att-id',
          source: 'FACE',
        });

        prisma.cameraAttendanceEvent.upsert.mockResolvedValue({
          id: 'evt-dup',
          decision: 'DUPLICATE_PREVENTED',
        });

        const engine = new AttendanceDecisionEngine(prisma);
        const result = await engine.processRecognition(makeParams());

        expect(result.decision).toBe('DUPLICATE_PREVENTED');
        expect(result.attendanceId).toBe('concurrent-att-id');
      });

      it('re-throws P2002 if the constraint does not target attendance', async () => {
        const prisma = makePrisma();
        mockStudent(prisma);
        mockGroup(prisma);
        mockNoAttendance(prisma);

        const unrelatedP2002 = new Error('Unrelated unique constraint failed');
        (unrelatedP2002 as any).code = 'P2002';
        (unrelatedP2002 as any).meta = { target: ['barcode'] };

        prisma.attendance.create.mockRejectedValue(unrelatedP2002);

        const engine = new AttendanceDecisionEngine(prisma);
        await expect(engine.processRecognition(makeParams())).rejects.toThrow(
          unrelatedP2002,
        );
      });
    });
  });
});

describe('AttendanceDecisionEngine — financial gate (camera path)', () => {
  it('denies attendance for a student with overdue invoices', async () => {
    const prisma = makePrisma();
    mockStudent(prisma);
    mockGroup(prisma);
    mockNoAttendance(prisma);

    prisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      userId: 'user-1',
      balance: 0,
    });
    prisma.invoice.findMany.mockResolvedValue([
      {
        status: 'ISSUED',
        total: 1_000,
        paidAmount: 0,
        refundedAmount: 0,
        dueDate: new Date('2020-01-01T00:00:00.000Z'),
      },
    ]);
    prisma.cameraAttendanceEvent.upsert.mockResolvedValue({
      id: 'evt-financial',
      decision: 'INSUFFICIENT_FUNDS',
    });

    const engine = new AttendanceDecisionEngine(prisma);
    const result = await engine.processRecognition(makeParams());

    // Same business rule as FaceService.processAttempt: an overdue student
    // is denied at the camera too — parity, never a silent bypass.
    expect(result.decision).toBe('INSUFFICIENT_FUNDS');
    expect(prisma.attendance.create).not.toHaveBeenCalled();
  });
});

describe('AttendanceDecisionEngine — camera room fallback', () => {
  it('falls back to time-based matching when no room matches but one group is time-valid', async () => {
    const prisma = makePrisma();
    mockStudent(prisma);
    mockNoAttendance(prisma);

    // The camera lives in 'Room 1' (DB authoritative) but the only group's
    // schedule/room say 'Room 9' — a stale location. Exactly one group is
    // time-valid, so the resolver must accept it (previously this returned
    // NO_MATCH and silently denied every student in an otherwise-running
    // class).
    prisma.studentGroup.findMany.mockResolvedValue([
      {
        groupId: 'group-1',
        group: {
          id: 'group-1',
          name: 'G1',
          room: 'Room 9',
          schedules: [
            {
              dayOfWeek: 'SATURDAY',
              startTime: '08:00',
              endTime: '12:00',
              room: 'Room 9',
            },
          ],
        },
      },
    ]);

    prisma.attendance.create.mockResolvedValue({ id: 'att-fallback' });
    prisma.cameraAttendanceEvent.upsert.mockResolvedValue({
      id: 'evt-fallback',
      decision: 'RECORDED',
    });

    const engine = new AttendanceDecisionEngine(prisma);
    const result = await engine.processRecognition(makeParams());

    expect(result.decision).toBe('RECORDED');
  });
});
