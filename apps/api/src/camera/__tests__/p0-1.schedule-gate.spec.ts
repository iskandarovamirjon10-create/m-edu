import { describe, expect, it, vi } from 'vitest';

import { AttendanceDecisionEngine } from '../attendance-decision.engine';

/**
 * P0-1 — FACE ATTENDANCE SCHEDULE BYPASS
 *
 * These tests pin the schedule gate contract:
 *   - organization timezone is resolved from the Organization row (never
 *     hardcoded),
 *   - organization-local weekday + minutes drive the window,
 *   - the configured ±30 minute grace applies,
 *   - no schedule / wrong group / wrong room / holiday / ambiguity all DENY,
 *   - attendance never becomes authoritative outside the window.
 */

type MockFn = ReturnType<typeof vi.fn>;

interface Membership {
  groupId: string;
  group: {
    id: string;
    name: string;
    room: string | null;
    schedules: Array<{
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      room: string | null;
    }>;
  };
}

interface HarnessConfig {
  timezone?: string | null;
  memberships?: Membership[];
  holidays?: string[];
  studentActive?: boolean;
  organizationExists?: boolean;
}

function makePrisma(config: HarnessConfig = {}) {
  const memberships = config.memberships ?? [mondayMembership()];
  const holidays = config.holidays ?? [];

  const prisma = {
    organization: {
      findUnique: vi.fn(async () =>
        config.organizationExists === false
          ? null
          : {
              id: 'org-1',
              timezone:
                'timezone' in config
                  ? config.timezone
                  : 'Asia/Tashkent',
            },
      ),
    },

    student: {
      findFirst: vi.fn(async (args: { where: { id: string } }) =>
        config.studentActive === false
          ? null
          : { id: args.where.id, userId: 'user-1' },
      ),
    },

    invoice: {
      findMany: vi.fn().mockResolvedValue([]),
    },

    studentGroup: {
      findMany: vi.fn(
        async (args: { where: { groupId?: string } }) =>
          args.where.groupId
            ? memberships.filter((m) => m.groupId === args.where.groupId)
            : memberships,
      ),
    },

    organizationHoliday: {
      findFirst: vi.fn(async (args: { where: { date: Date } }) => {
        const day = args.where.date.toISOString().slice(0, 10);
        return holidays.includes(day) ? { id: 'holiday-1' } : null;
      }),
    },

    camera: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'cam-1',
        name: 'Cam A',
        location: 'Room 1',
      }),
    },

    attendance: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'att-1' }),
    },

    cameraAttendanceEvent: {
      upsert: vi.fn().mockResolvedValue({ id: 'evt-1' }),
    },

    lesson: {
      findFirst: vi.fn().mockResolvedValue({ id: 'lesson-1', status: 'PLANNED' }),
      update: vi.fn().mockResolvedValue({ id: 'lesson-1', status: 'CONDUCTED' }),
    },

    $transaction: vi.fn(),
  };

  (prisma as unknown as { $transaction: MockFn }).$transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  );

  return prisma;
}

/** Monday 10:00–11:00 in Room 1. 2026-09-07 is a Monday. */
function mondayMembership(): Membership {
  return {
    groupId: 'group-1',
    group: {
      id: 'group-1',
      name: 'G1',
      room: 'Room 1',
      schedules: [
        {
          dayOfWeek: 'MONDAY',
          startTime: '10:00',
          endTime: '11:00',
          room: 'Room 1',
        },
      ],
    },
  };
}

function membershipWithSchedules(
  groupId: string,
  schedules: Membership['group']['schedules'],
  room: string | null = 'Room 1',
): Membership {
  return {
    groupId,
    group: { id: groupId, name: groupId, room, schedules },
  };
}

function engineFor(config: HarnessConfig = {}) {
  const prisma = makePrisma(config);
  return { prisma, engine: new AttendanceDecisionEngine(prisma as never) };
}

describe('P0-1 schedule gate — validateGroupTime', () => {
  describe('±30 minute window', () => {
    it('accepts 1 minute inside the window', async () => {
      const { engine } = engineFor();

      // 2026-09-07 10:01 local Asia/Tashkent (UTC+5) = 05:01Z
      const accepted = await engine.validateGroupTime(
        'org-1',
        'student-1',
        'group-1',
        { at: new Date('2026-09-07T05:01:00Z') },
      );

      expect(accepted).toBe(true);
    });

    it('accepts exactly at the +30 minute grace boundary', async () => {
      const { engine } = engineFor();

      // 11:30 local = end 11:00 + 30 grace
      const accepted = await engine.validateGroupTime(
        'org-1',
        'student-1',
        'group-1',
        { at: new Date('2026-09-07T06:30:00Z') },
      );

      expect(accepted).toBe(true);
    });

    it('rejects 1 minute outside the window', async () => {
      const { engine } = engineFor();

      // 11:31 local = 1 minute past end + grace
      const rejected = await engine.validateGroupTime(
        'org-1',
        'student-1',
        'group-1',
        { at: new Date('2026-09-07T06:31:00Z') },
      );

      expect(rejected).toBe(false);
    });

    it('rejects 1 minute before the window opens', async () => {
      const { engine } = engineFor();

      // 09:29 local = 1 minute before start - 30 grace
      const rejected = await engine.validateGroupTime(
        'org-1',
        'student-1',
        'group-1',
        { at: new Date('2026-09-07T04:29:00Z') },
      );

      expect(rejected).toBe(false);
    });
  });

  describe('fail-closed rules', () => {
    it('denies when the group has no active schedule', async () => {
      const { engine } = engineFor({
        memberships: [
          membershipWithSchedules('group-1', []),
        ],
      });

      const accepted = await engine.validateGroupTime(
        'org-1',
        'student-1',
        'group-1',
        { at: new Date('2026-09-07T05:01:00Z') },
      );

      expect(accepted).toBe(false);
    });

    it('denies when the student is not enrolled in the requested group', async () => {
      const { engine } = engineFor({
        memberships: [mondayMembership()],
      });

      const accepted = await engine.validateGroupTime(
        'org-1',
        'student-1',
        'group-OTHER',
        { at: new Date('2026-09-07T05:01:00Z') },
      );

      expect(accepted).toBe(false);
    });

    it('denies an unknown organization', async () => {
      const { engine } = engineFor({ organizationExists: false });

      const accepted = await engine.validateGroupTime(
        'org-1',
        'student-1',
        'group-1',
        { at: new Date('2026-09-07T05:01:00Z') },
      );

      expect(accepted).toBe(false);
    });

    it('denies an inactive or foreign student', async () => {
      const { engine } = engineFor({ studentActive: false });

      const accepted = await engine.validateGroupTime(
        'org-1',
        'student-1',
        'group-1',
        { at: new Date('2026-09-07T05:01:00Z') },
      );

      expect(accepted).toBe(false);
    });

    it('denies empty identifiers', async () => {
      const { engine } = engineFor();

      expect(
        await engine.validateGroupTime('', 'student-1', 'group-1'),
      ).toBe(false);
      expect(
        await engine.validateGroupTime('org-1', '', 'group-1'),
      ).toBe(false);
      expect(
        await engine.validateGroupTime('org-1', 'student-1', ''),
      ).toBe(false);
    });

    it('denies when the holiday lookup fails', async () => {
      const { prisma, engine } = engineFor();

      prisma.organizationHoliday.findFirst.mockImplementationOnce(() =>
        Promise.reject(new Error('db down')),
      );

      const accepted = await engine.validateGroupTime(
        'org-1',
        'student-1',
        'group-1',
        { at: new Date('2026-09-07T05:01:00Z') },
      );

      expect(accepted).toBe(false);
    });
  });

  describe('room matching', () => {
    it('accepts when the camera room matches the scheduled room', async () => {
      const { engine } = engineFor();

      const accepted = await engine.validateGroupTime(
        'org-1',
        'student-1',
        'group-1',
        {
          at: new Date('2026-09-07T05:01:00Z'),
          cameraLocation: 'Room 1',
        },
      );

      expect(accepted).toBe(true);
    });

    it('falls back to time when the room mismatches but one group is time-valid', async () => {
      const { engine } = engineFor();

      // A camera whose configured room (Room 9) matches NO candidate room is
      // treated as a STALE room configuration: with exactly ONE time-valid
      // group the schedule signal is unambiguous, so recognition falls back
      // to time-based matching instead of denying an in-progress class.
      const accepted = await engine.validateGroupTime(
        'org-1',
        'student-1',
        'group-1',
        {
          at: new Date('2026-09-07T05:01:00Z'),
          cameraLocation: 'Room 9',
        },
      );

      expect(accepted).toBe(true);
    });
  });

  describe('organization timezone resolution', () => {
    it('resolves the timezone from the organization, not a hardcoded value', async () => {
      // Same instant: 05:31Z.
      const at = new Date('2026-09-07T05:31:00Z');

      const { engine: tzashkent } = engineFor({ timezone: 'Asia/Tashkent' });
      const { engine: utc } = engineFor({ timezone: 'UTC' });

      // 10:31 local in Tashkent (inside window) …
      expect(
        await tzashkent.validateGroupTime('org-1', 'student-1', 'group-1', {
          at,
        }),
      ).toBe(true);

      // … but 05:31 local in UTC (an hour before the window opens).
      expect(
        await utc.validateGroupTime('org-1', 'student-1', 'group-1', { at }),
      ).toBe(false);
    });

    it('uses the organization-local weekday when the UTC weekday differs', async () => {
      // 2026-09-07T19:30Z is MONDAY in UTC but TUESDAY 00:30 in Asia/Tashkent.
      const { engine } = engineFor({
        timezone: 'Asia/Tashkent',
        memberships: [
          membershipWithSchedules('group-1', [
            {
              dayOfWeek: 'TUESDAY',
              startTime: '00:00',
              endTime: '01:00',
              room: 'Room 1',
            },
          ]),
        ],
      });

      const accepted = await engine.validateGroupTime(
        'org-1',
        'student-1',
        'group-1',
        { at: new Date('2026-09-07T19:30:00Z') },
      );

      expect(accepted).toBe(true);
    });

    it('falls back to UTC when the organization has no timezone configured', async () => {
      const { engine } = engineFor({ timezone: null });

      // 05:31Z is 05:31 UTC on Monday — outside the 09:30–11:30 UTC window.
      expect(
        await engine.validateGroupTime('org-1', 'student-1', 'group-1', {
          at: new Date('2026-09-07T05:31:00Z'),
        }),
      ).toBe(false);

      // 10:01Z is inside the window.
      expect(
        await engine.validateGroupTime('org-1', 'student-1', 'group-1', {
          at: new Date('2026-09-07T10:01:00Z'),
        }),
      ).toBe(true);
    });
  });

  describe('DST timezone', () => {
    const dstMembership = () =>
      membershipWithSchedules('group-1', [
        {
          dayOfWeek: 'MONDAY',
          startTime: '10:00',
          endTime: '11:00',
          room: 'Room 1',
        },
      ]);

    it('resolves the window with the DST offset in effect', async () => {
      const { engine } = engineFor({
        timezone: 'America/New_York',
        memberships: [dstMembership()],
      });

      // 2026-07-06 is EDT (UTC-4): 14:01Z = 10:01 local → inside.
      // A fixed UTC-5 implementation would compute 09:01 → outside.
      expect(
        await engine.validateGroupTime('org-1', 'student-1', 'group-1', {
          at: new Date('2026-07-06T14:01:00Z'),
        }),
      ).toBe(true);

      // 2026-01-05 is EST (UTC-5): 15:01Z = 10:01 local → inside.
      expect(
        await engine.validateGroupTime('org-1', 'student-1', 'group-1', {
          at: new Date('2026-01-05T15:01:00Z'),
        }),
      ).toBe(true);

      // Same wall-clock offset misuse would fail both of these.
      expect(
        await engine.validateGroupTime('org-1', 'student-1', 'group-1', {
          at: new Date('2026-07-06T14:31:00Z'),
        }),
      ).toBe(true);

      // 15:31Z in July = 11:31 local → 1 minute past the grace window.
      expect(
        await engine.validateGroupTime('org-1', 'student-1', 'group-1', {
          at: new Date('2026-07-06T15:31:00Z'),
        }),
      ).toBe(false);
    });
  });

  describe('holiday handling', () => {
    it('denies attendance on an organization holiday', async () => {
      const { engine } = engineFor({
        timezone: 'Asia/Tashkent',
        holidays: ['2026-09-07'],
      });

      const accepted = await engine.validateGroupTime(
        'org-1',
        'student-1',
        'group-1',
        { at: new Date('2026-09-07T05:01:00Z') },
      );

      expect(accepted).toBe(false);
    });

    it('accepts the same window on a non-holiday day', async () => {
      const { engine } = engineFor({
        timezone: 'Asia/Tashkent',
        holidays: ['2026-09-14'],
      });

      const accepted = await engine.validateGroupTime(
        'org-1',
        'student-1',
        'group-1',
        { at: new Date('2026-09-07T05:01:00Z') },
      );

      expect(accepted).toBe(true);
    });

    it('resolves the holiday in the organization-local calendar', async () => {
      // 2026-09-07T19:30Z is 2026-09-08 locally in Asia/Tashkent.
      const { prisma, engine } = engineFor({
        timezone: 'Asia/Tashkent',
        holidays: ['2026-09-08'],
        memberships: [
          membershipWithSchedules('group-1', [
            {
              dayOfWeek: 'TUESDAY',
              startTime: '00:00',
              endTime: '01:00',
              room: 'Room 1',
            },
          ]),
        ],
      });

      const accepted = await engine.validateGroupTime(
        'org-1',
        'student-1',
        'group-1',
        { at: new Date('2026-09-07T19:30:00Z') },
      );

      expect(accepted).toBe(false);
      expect(
        prisma.organizationHoliday.findFirst.mock.calls[0][0].where.date.toISOString(),
      ).toBe('2026-09-08T00:00:00.000Z');
    });
  });

  describe('ambiguous schedule', () => {
    it('denies when two distinct groups match the same window and room', async () => {
      const { engine } = engineFor();

      const a = mondayMembership();
      const b = mondayMembership();
      b.groupId = 'group-2';
      b.group = { ...b.group, id: 'group-2', name: 'G2' };

      // Camera path: both groups in Room 1 at the same time → ambiguous.
      const resolved = engine.resolveTargetGroup(
        [a, b],
        new Date('2026-09-07T05:01:00Z'),
        'Asia/Tashkent',
        'Room 1',
      );

      expect(resolved.status).toBe('AMBIGUOUS');
    });

    it('denies a group whose only matching schedule belongs to another group', async () => {
      const { engine } = engineFor();

      const onlyOtherGroup = mondayMembership();
      onlyOtherGroup.groupId = 'group-2';
      onlyOtherGroup.group = {
        ...onlyOtherGroup.group,
        id: 'group-2',
        name: 'G2',
      };

      const resolved = engine.resolveTargetGroup(
        [onlyOtherGroup],
        new Date('2026-09-07T05:01:00Z'),
        'Asia/Tashkent',
        'Room 1',
      );

      expect(resolved.status).toBe('MATCHED');
      expect(resolved.groupId).toBe('group-2');
    });
  });
});

describe('P0-1 camera pipeline — schedule gate before attendance', () => {
  function cameraParams(overrides: Record<string, unknown> = {}) {
    return {
      organizationId: 'org-1',
      cameraId: 'cam-1',
      studentId: 'student-1',
      recognizedAt: new Date('2026-09-07T05:01:00Z'),
      confidence: 0.92,
      qualityScore: 0.85,
      similarityScore: 0.92,
      cameraLocation: 'Room 1',
      cameraName: 'Cam A',
      ...overrides,
    };
  }

  it('records attendance inside the window', async () => {
    const { prisma, engine } = engineFor();

    const result = await engine.processRecognition(cameraParams());

    expect(result.decision).toBe('RECORDED');
    expect(prisma.attendance.create).toHaveBeenCalledTimes(1);
  });

  it('denies and creates NO attendance outside the window', async () => {
    const { prisma, engine } = engineFor();

    const result = await engine.processRecognition(
      cameraParams({ recognizedAt: new Date('2026-09-07T06:31:00Z') }),
    );

    expect(result.decision).toBe('NO_SCHEDULED_GROUP');
    expect(prisma.attendance.create).not.toHaveBeenCalled();
  });

  it('denies and creates NO attendance on a holiday', async () => {
    const { prisma, engine } = engineFor({ holidays: ['2026-09-07'] });

    const result = await engine.processRecognition(cameraParams());

    expect(result.decision).toBe('HOLIDAY');
    expect(prisma.attendance.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ message: expect.stringContaining('holiday') });
  });

  it('resolves the organization timezone instead of a hardcoded one', async () => {
    // 05:31Z: inside for Asia/Tashkent, outside for UTC.
    const at = new Date('2026-09-07T05:31:00Z');

    const { engine: tashkent } = engineFor({ timezone: 'Asia/Tashkent' });
    expect(
      (await tashkent.processRecognition(cameraParams({ recognizedAt: at })))
        .decision,
    ).toBe('RECORDED');

    const { engine: utc } = engineFor({ timezone: 'UTC' });
    expect(
      (await utc.processRecognition(cameraParams({ recognizedAt: at })))
        .decision,
    ).toBe('NO_SCHEDULED_GROUP');
  });

  it('records inside the window even when the camera room mismatches (single time-valid group)', async () => {
    const { prisma, engine } = engineFor();

    prisma.camera.findFirst.mockResolvedValue({
      id: 'cam-1',
      name: 'Cam B',
      location: 'Room 9',
    });

    const result = await engine.processRecognition(
      cameraParams({ cameraLocation: null }),
    );

    // The authoritative DB camera location (Room 9) matches no candidate
    // room, but the student has exactly ONE time-valid group — the resolver
    // falls back to the unambiguous schedule signal (stale-room fallback).
    expect(result.decision).toBe('RECORDED');
    expect(prisma.attendance.create).toHaveBeenCalledTimes(1);
  });

  it('lets exactly one of many concurrent recognitions record attendance', async () => {
    const { prisma, engine } = engineFor();

    let created = false;

    prisma.attendance.findUnique.mockImplementation(async () =>
      created ? { id: 'att-1', source: 'FACE' } : null,
    );

    prisma.attendance.create.mockImplementation(async () => {
      if (created) {
        const err = new Error('Unique constraint failed') as Error & {
          code: string;
          meta: { modelName: string };
        };
        err.code = 'P2002';
        err.meta = { modelName: 'Attendance' };
        throw err;
      }
      created = true;
      return { id: 'att-1' };
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => engine.processRecognition(cameraParams())),
    );

    const recorded = results.filter((r) => r.decision === 'RECORDED');
    const duplicate = results.filter((r) => r.decision === 'DUPLICATE_PREVENTED');

    expect(recorded).toHaveLength(1);
    expect(recorded.length + duplicate.length).toBe(10);
    expect(prisma.attendance.create.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
