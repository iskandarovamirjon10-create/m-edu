import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendanceService } from '../attendance.service';

function createMockPrisma() {
  const obj = {
    organization: { findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC' }) },
    group: { findFirst: vi.fn() },
    teacher: { findFirst: vi.fn() },
    studentGroup: { findMany: vi.fn() },
    attendance: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      create: vi.fn()
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    lesson: {
      findMany: vi.fn().mockResolvedValue([{ id: 'mock-lesson', startTime: '10:00', status: 'PLANNED' }]),
      findFirst: vi.fn().mockResolvedValue({ id: 'lesson-1', status: 'PLANNED', groupId: 'g1' }),
      update: vi.fn(),
      create: vi.fn(),
    },
    schedule: {
      findMany: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
    $queryRaw: vi.fn(),
  };
  obj.$transaction = vi.fn().mockImplementation(async (cb) => cb(obj));
  return obj as any;
}

describe('AttendanceService', () => {
  let prisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
  });

  it('rejects when group does not belong to organization (tenant isolation)', async () => {
    prisma.group.findFirst.mockResolvedValue(null);
    const svc = new AttendanceService(prisma);
    await expect(
      svc.markAttendance('org-1', { groupId: 'g-other', date: '2026-09-04', records: [] }),
    ).rejects.toThrow('Group not found');
  });

  it('rejects students not enrolled in the group', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's-ok' }]);
    const svc = new AttendanceService(prisma);
    await expect(
      svc.markAttendance('org-1', {
        groupId: 'g1',
        date: '2026-09-04',
        records: [{ studentId: 's-other', status: 'PRESENT' }],
      }),
    ).rejects.toThrow(/not enrolled/);
  });

  it('creates attendance for new records and updates existing ones', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }, { studentId: 's2' }]);
    prisma.attendance.findMany.mockResolvedValue([{ id: 'a2', studentId: 's2' }]);
    prisma.attendance.create.mockResolvedValue({ id: 'a1' });
    prisma.attendance.update.mockResolvedValue({ id: 'a2' });

    const svc = new AttendanceService(prisma);
    const result = await svc.markAttendance('org-1', {
      groupId: 'g1',
      date: '2026-09-04',
      records: [
        { studentId: 's1', status: 'PRESENT' },
        { studentId: 's2', status: 'LATE' },
      ],
    });
    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.total).toBe(2);

    expect(prisma.attendance.create).toHaveBeenCalledTimes(1);
    expect(prisma.attendance.update).toHaveBeenCalledTimes(1);
  });
});

describe('AttendanceService payload hardening', () => {
  let prisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
  });

  it('deduplicates repeated studentIds within a single payload', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.attendance.create.mockResolvedValue({ id: 'a1' });
    const svc = new AttendanceService(prisma);

    const result = await svc.markAttendance('org-1', {
      groupId: 'g1',
      date: '2026-09-04',
      records: [
        { studentId: 's1', status: 'PRESENT' },
        { studentId: 's1', status: 'LATE' }, // duplicate — last wins
      ],
    });

    expect(result.total).toBe(1);
    expect(prisma.attendance.create).toHaveBeenCalledTimes(1);
    const payload = prisma.attendance.create.mock.calls[0][0].data;
    expect(payload.status).toBe('LATE');
  });

  it('falls back to update when a concurrent create violates the unique constraint (P2002)', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.attendance.findUnique = vi.fn().mockResolvedValue({ id: 'a1', studentId: 's1' });
    prisma.attendance.create.mockRejectedValueOnce({ code: 'P2002' });
    prisma.attendance.update.mockResolvedValue({ id: 'a1' });
    const svc = new AttendanceService(prisma);

    const result = await svc.markAttendance('org-1', {
      groupId: 'g1',
      date: '2026-09-04',
      records: [{ studentId: 's1', status: 'PRESENT' }],
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1' } }),
    );
  });

  it('rethrows non-unique errors from create', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.attendance.create.mockRejectedValue(new Error('db down'));
    const svc = new AttendanceService(prisma);

    await expect(
      svc.markAttendance('org-1', {
        groupId: 'g1',
        date: '2026-09-04',
        records: [{ studentId: 's1', status: 'PRESENT' }],
      }),
    ).rejects.toThrow('db down');
  });
});

describe('AttendanceService update/remove (edit & void)', () => {
  let prisma: any;
  let svc: AttendanceService;

  const id = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new AttendanceService(prisma);
  });

  it('update rejects records outside the organization (tenant isolation)', async () => {
    prisma.attendance.findFirst.mockResolvedValue(null);
    const user = { organizationId: 'org-1', sub: 'admin-1', id: 'admin-1' };
    await expect(svc.update(user, id, { status: 'LATE' })).rejects.toThrow(
      'Attendance record not found',
    );
    expect(prisma.attendance.findFirst.mock.calls[0][0].where).toEqual({
      id,
      organizationId: 'org-1',
    });
  });

  it('update patches status and note', async () => {
    prisma.attendance.findFirst.mockResolvedValue({ id, status: 'PRESENT' });
    prisma.attendance.updateMany.mockResolvedValue({ count: 1 });
    prisma.attendance.findFirst
      .mockResolvedValueOnce({ id, status: 'PRESENT' })
      .mockResolvedValueOnce({ id, status: 'LATE', note: 'late arrival', source: 'MANUAL' });

    const user = { organizationId: 'org-1', sub: 'admin-1', id: 'admin-1' };
    const result = await svc.update(user, id, { status: 'LATE', note: 'late arrival' });

    expect(result.status).toBe('LATE');
    expect(prisma.attendance.updateMany).toHaveBeenCalledWith({
      where: { id: '11111111-1111-4111-8111-111111111111', organizationId: 'org-1' },
      data: expect.objectContaining({ status: 'LATE', note: 'late arrival', source: 'MANUAL' }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('remove deletes the record when authorized', async () => {
    prisma.attendance.findFirst.mockResolvedValue({ id });
    prisma.attendance.deleteMany.mockResolvedValue({ count: 1 });

    const user = { organizationId: 'org-1', sub: 'admin-1', id: 'admin-1' };
    const result = await svc.remove(user, id);
    expect(prisma.attendance.deleteMany).toHaveBeenCalledWith({
      where: { id, organizationId: 'org-1' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(result).toEqual({ deleted: true, id });
  });
});

describe('AttendanceService date-boundary filtering', () => {
  let prisma: any;
  let svc: AttendanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.attendance.count.mockResolvedValue(0);
    svc = new AttendanceService(prisma);
  });

  it('filters a single day with UTC day boundaries (records are stored at UTC midnight)', async () => {
    await svc.findAll('org-1', { date: '2026-09-05' });
    const where = prisma.attendance.findMany.mock.calls[0][0].where;
    const start = new Date(where.date.gte);
    const end = new Date(where.date.lt);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(start.toISOString()).toBe('2026-09-05T00:00:00.000Z');
  });

  it('applies the same UTC boundaries in analytics', async () => {
    prisma.attendance.groupBy.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
    await svc.getAnalytics('org-1', { date: '2026-09-05' });
    const where = prisma.attendance.groupBy.mock.calls[0][0].where;
    const start = new Date(where.date.gte);
    expect(start.toISOString()).toBe('2026-09-05T00:00:00.000Z');
  });
});

describe('AttendanceService on-demand lesson materialization (P0-2)', () => {
  let prisma: any;
  let svc: AttendanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new AttendanceService(prisma);
  });

  it('TEST 1: materializes a lesson on-demand when schedule exists and marks it CONDUCTED', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1', teacherId: 't1', room: '101' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);
    
    // Initial lesson check: none exist; refreshed check: newly created lesson is returned
    prisma.lesson.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'lesson-new', startTime: '09:00', endTime: '10:30', status: 'PLANNED' }]);

    prisma.schedule.findMany.mockResolvedValue([
      { id: 'sch-1', dayOfWeek: 'FRIDAY', startTime: '09:00', endTime: '10:30', room: '101', isActive: true },
    ]);
    prisma.lesson.create.mockResolvedValue({ id: 'lesson-new', status: 'PLANNED' });
    prisma.lesson.update.mockResolvedValue({ id: 'lesson-new', status: 'CONDUCTED' });
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.attendance.create.mockResolvedValue({ id: 'att-1' });

    const result = await svc.markAttendance('org-1', {
      groupId: 'g1',
      date: '2026-09-04',
      records: [{ studentId: 's1', status: 'PRESENT' }],
    });

    expect(result.created).toBe(1);
    expect(prisma.schedule.findMany).toHaveBeenCalledWith({
      where: { groupId: 'g1', dayOfWeek: 'FRIDAY', isActive: true },
      orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
    });
    expect(prisma.lesson.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        groupId: 'g1',
        teacherId: 't1',
        scheduleId: 'sch-1',
        startTime: '09:00',
        endTime: '10:30',
        status: 'PLANNED',
      }),
    });
    expect(prisma.lesson.update).toHaveBeenCalledWith({
      where: { id: 'lesson-new' },
      data: { status: 'CONDUCTED' },
    });
    expect(prisma.attendance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        studentId: 's1',
        groupId: 'g1',
        lessonId: 'lesson-new',
        status: 'PRESENT',
      }),
    });
  });

  it('TEST 2: idempotent re-submission reuses existing conducted lesson without duplicating', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1', teacherId: 't1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);
    
    // Existing CONDUCTED lesson is already present
    prisma.lesson.findMany.mockResolvedValue([
      { id: 'lesson-existing', startTime: '09:00', endTime: '10:30', status: 'CONDUCTED' },
    ]);
    prisma.attendance.findMany.mockResolvedValue([
      { id: 'att-existing', studentId: 's1', status: 'PRESENT', lessonId: 'lesson-existing' },
    ]);
    prisma.attendance.update.mockResolvedValue({ id: 'att-existing', status: 'PRESENT' });

    const result = await svc.markAttendance('org-1', {
      groupId: 'g1',
      date: '2026-09-04',
      records: [{ studentId: 's1', status: 'PRESENT' }],
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(prisma.schedule.findMany).not.toHaveBeenCalled();
    expect(prisma.lesson.create).not.toHaveBeenCalled();
    expect(prisma.attendance.create).not.toHaveBeenCalled();
  });

  it('TEST 3: handles concurrent lesson creation gracefully via P2002 safe recovery', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1', teacherId: 't1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);

    prisma.lesson.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'lesson-concurrent', startTime: '09:00', endTime: '10:30', status: 'PLANNED' }]);

    prisma.schedule.findMany.mockResolvedValue([
      { id: 'sch-1', dayOfWeek: 'FRIDAY', startTime: '09:00', endTime: '10:30', isActive: true },
    ]);
    prisma.lesson.create.mockRejectedValueOnce({ code: 'P2002' });
    prisma.lesson.update.mockResolvedValue({ id: 'lesson-concurrent', status: 'CONDUCTED' });
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.attendance.create.mockResolvedValue({ id: 'att-1' });

    const result = await svc.markAttendance('org-1', {
      groupId: 'g1',
      date: '2026-09-04',
      records: [{ studentId: 's1', status: 'PRESENT' }],
    });

    expect(result.created).toBe(1);
    expect(prisma.lesson.update).toHaveBeenCalledWith({
      where: { id: 'lesson-concurrent' },
      data: { status: 'CONDUCTED' },
    });
  });

  it('TEST 4: existing planned lesson is reused and updated to CONDUCTED without querying schedule', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);
    prisma.lesson.findMany.mockResolvedValue([
      { id: 'lesson-planned', startTime: '10:00', status: 'PLANNED' },
    ]);
    prisma.lesson.update.mockResolvedValue({ id: 'lesson-planned', status: 'CONDUCTED' });
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.attendance.create.mockResolvedValue({ id: 'att-1' });

    const result = await svc.markAttendance('org-1', {
      groupId: 'g1',
      date: '2026-09-04',
      records: [{ studentId: 's1', status: 'PRESENT' }],
    });

    expect(result.created).toBe(1);
    expect(prisma.schedule.findMany).not.toHaveBeenCalled();
    expect(prisma.lesson.create).not.toHaveBeenCalled();
    expect(prisma.lesson.update).toHaveBeenCalledWith({
      where: { id: 'lesson-planned' },
      data: { status: 'CONDUCTED' },
    });
  });

  it('TEST 5: throws actionable error when no active schedule exists for the day', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);
    prisma.lesson.findMany.mockResolvedValue([]);
    prisma.schedule.findMany.mockResolvedValue([]);

    await expect(
      svc.markAttendance('org-1', {
        groupId: 'g1',
        date: '2026-09-04',
        records: [{ studentId: 's1', status: 'PRESENT' }],
      }),
    ).rejects.toThrow('Bu sana uchun guruh jadvali mavjud emas. Avval guruh jadvalini belgilang.');

    expect(prisma.lesson.create).not.toHaveBeenCalled();
    expect(prisma.attendance.create).not.toHaveBeenCalled();
  });
});

describe('AttendanceService.update teacher authorization (M-EDU-ATT-003)', () => {
  let prisma: any;
  let svc: AttendanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new AttendanceService(prisma);
  });

  it('allows teacher to update attendance for their assigned group', async () => {
    prisma.attendance.findFirst.mockResolvedValue({
      id: 'att-1',
      organizationId: 'org-1',
      status: 'PRESENT',
      groupId: 'g-assigned',
      group: { teacherId: 'teacher-1' },
      lesson: null,
    });
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' });
    prisma.attendance.updateMany.mockResolvedValue({ count: 1 });

    const user = { organizationId: 'org-1', sub: 'user-t1', role: 'TEACHER' };
    const res = await svc.update(user as any, 'att-1', { status: 'LATE', note: 'Traffic' });

    expect(prisma.teacher.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-t1', organizationId: 'org-1' },
      select: { id: true },
    });
    expect(res.status).toBe('PRESENT');
  });

  it('rejects teacher attempting to update attendance for another teacher group', async () => {
    prisma.attendance.findFirst.mockResolvedValue({
      id: 'att-1',
      organizationId: 'org-1',
      status: 'PRESENT',
      groupId: 'g-other',
      group: { teacherId: 'teacher-other' },
      lesson: null,
    });
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' });

    const user = { organizationId: 'org-1', sub: 'user-t1', role: 'TEACHER' };
    await expect(
      svc.update(user as any, 'att-1', { status: 'LATE' })
    ).rejects.toThrow('Teachers can only update attendance for their assigned groups or lessons');
  });

  it('allows ORG_ADMIN to update attendance regardless of group teacher', async () => {
    prisma.attendance.findFirst.mockResolvedValue({
      id: 'att-1',
      organizationId: 'org-1',
      status: 'PRESENT',
      groupId: 'g-other',
      group: { teacherId: 'teacher-other' },
      lesson: null,
    });
    prisma.attendance.updateMany.mockResolvedValue({ count: 1 });

    const user = { organizationId: 'org-1', sub: 'user-admin', role: 'ORG_ADMIN' };
    await svc.update(user as any, 'att-1', { status: 'EXCUSED' });

    expect(prisma.teacher.findFirst).not.toHaveBeenCalled();
    expect(prisma.attendance.updateMany).toHaveBeenCalled();
  });
});

describe('ATT-002: Multi-Lesson Attendance Integrity', () => {
  let prisma: any;
  let svc: AttendanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new AttendanceService(prisma);
  });

  it('records attendance independently for Lesson 1 and Lesson 2 on the same day', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);

    const lesson1Date = new Date('2026-09-04T09:00:00Z');
    const lesson2Date = new Date('2026-09-04T14:00:00Z');

    prisma.lesson.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.id === 'lesson-1') {
        return { id: 'lesson-1', groupId: 'g1', status: 'PLANNED', date: lesson1Date };
      }
      if (where.id === 'lesson-2') {
        return { id: 'lesson-2', groupId: 'g1', status: 'PLANNED', date: lesson2Date };
      }
      return null;
    });

    // Lesson 1 attendance
    prisma.attendance.findMany.mockResolvedValueOnce([]);
    prisma.attendance.create.mockResolvedValueOnce({ id: 'att-1', lessonId: 'lesson-1' });

    const res1 = await svc.markAttendance('org-1', {
      groupId: 'g1',
      date: '2026-09-04',
      lessonId: 'lesson-1',
      records: [{ studentId: 's1', status: 'PRESENT' }],
    });
    expect(res1.created).toBe(1);
    expect(prisma.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 's1',
          groupId: 'g1',
          lessonId: 'lesson-1',
          status: 'PRESENT',
        }),
      }),
    );

    // Lesson 2 attendance on same day
    prisma.attendance.findMany.mockResolvedValueOnce([]);
    prisma.attendance.create.mockResolvedValueOnce({ id: 'att-2', lessonId: 'lesson-2' });

    const res2 = await svc.markAttendance('org-1', {
      groupId: 'g1',
      date: '2026-09-04',
      lessonId: 'lesson-2',
      records: [{ studentId: 's1', status: 'LATE' }],
    });
    expect(res2.created).toBe(1);
    expect(prisma.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 's1',
          groupId: 'g1',
          lessonId: 'lesson-2',
          status: 'LATE',
        }),
      }),
    );
  });

  it('does not overwrite Lesson 1 attendance when Lesson 2 attendance is marked', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);

    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-2',
      groupId: 'g1',
      status: 'PLANNED',
      date: new Date('2026-09-04T14:00:00Z'),
    });

    // Query for existing records is scoped to lesson-2, so Lesson 1's record is NOT returned
    prisma.attendance.findMany.mockImplementation(async ({ where }: any) => {
      expect(where.lessonId).toBe('lesson-2');
      return [];
    });

    prisma.attendance.create.mockResolvedValue({ id: 'att-2' });

    const result = await svc.markAttendance('org-1', {
      groupId: 'g1',
      date: '2026-09-04',
      lessonId: 'lesson-2',
      records: [{ studentId: 's1', status: 'PRESENT' }],
    });

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(prisma.attendance.update).not.toHaveBeenCalled();
    expect(prisma.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lessonId: 'lesson-2',
        }),
      }),
    );
  });

  it('updates existing attendance for the SAME lesson instead of creating duplicate', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);

    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      groupId: 'g1',
      status: 'CONDUCTED',
      date: new Date('2026-09-04T09:00:00Z'),
    });

    // An attendance already exists for lesson-1
    prisma.attendance.findMany.mockResolvedValue([{ id: 'att-1', studentId: 's1', lessonId: 'lesson-1' }]);
    prisma.attendance.update.mockResolvedValue({ id: 'att-1', status: 'LATE' });

    const result = await svc.markAttendance('org-1', {
      groupId: 'g1',
      date: '2026-09-04',
      lessonId: 'lesson-1',
      records: [{ studentId: 's1', status: 'LATE' }],
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'att-1' },
        data: expect.objectContaining({ status: 'LATE', lessonId: 'lesson-1' }),
      }),
    );
    expect(prisma.attendance.create).not.toHaveBeenCalled();
  });

  it('rejects attendance for a CANCELLED lesson', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);

    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-cancelled',
      groupId: 'g1',
      status: 'CANCELLED',
      date: new Date('2026-09-04T09:00:00Z'),
    });

    await expect(
      svc.markAttendance('org-1', {
        groupId: 'g1',
        date: '2026-09-04',
        lessonId: 'lesson-cancelled',
        records: [{ studentId: 's1', status: 'PRESENT' }],
      }),
    ).rejects.toThrow(/bekor qilingan/i);
  });

  it('rejects attendance when lesson belongs to a different group', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);

    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-other-group',
      groupId: 'g2',
      status: 'PLANNED',
      date: new Date('2026-09-04T09:00:00Z'),
    });

    await expect(
      svc.markAttendance('org-1', {
        groupId: 'g1',
        date: '2026-09-04',
        lessonId: 'lesson-other-group',
        records: [{ studentId: 's1', status: 'PRESENT' }],
      }),
    ).rejects.toThrow(/does not belong to group/);
  });

  it('rejects attendance when lesson belongs to a different organization (tenant isolation)', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);

    // Scoped query by organizationId returns null
    prisma.lesson.findFirst.mockResolvedValue(null);

    await expect(
      svc.markAttendance('org-1', {
        groupId: 'g1',
        date: '2026-09-04',
        lessonId: 'foreign-lesson',
        records: [{ studentId: 's1', status: 'PRESENT' }],
      }),
    ).rejects.toThrow(/not found/);
  });

  it('rejects attendance when lesson date does not match the attendance date', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);

    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-tomorrow',
      groupId: 'g1',
      status: 'PLANNED',
      date: new Date('2026-09-05T09:00:00Z'),
    });

    await expect(
      svc.markAttendance('org-1', {
        groupId: 'g1',
        date: '2026-09-04',
        lessonId: 'lesson-tomorrow',
        records: [{ studentId: 's1', status: 'PRESENT' }],
      }),
    ).rejects.toThrow(/does not match/);
  });

  it('recovers cleanly on concurrent P2002 race for the same lesson', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);

    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      groupId: 'g1',
      status: 'PLANNED',
      date: new Date('2026-09-04T09:00:00Z'),
    });

    let pass = 0;
    prisma.$transaction.mockImplementation(async (cb: any) => {
      pass++;
      if (pass === 1) {
        // First attempt: simulate unique constraint race
        const p2002: any = new Error('Unique constraint failed on Attendance_studentId_lessonId_key');
        p2002.code = 'P2002';
        throw p2002;
      }
      // Second attempt: recovery pass with allowCreate = false
      return cb(prisma);
    });

    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.attendance.findUnique.mockResolvedValue({ id: 'att-race-winner', studentId: 's1', lessonId: 'lesson-1' });
    prisma.attendance.update.mockResolvedValue({ id: 'att-race-winner' });

    const result = await svc.markAttendance('org-1', {
      groupId: 'g1',
      date: '2026-09-04',
      lessonId: 'lesson-1',
      records: [{ studentId: 's1', status: 'PRESENT' }],
    });

    expect(result.updated).toBe(1);
    expect(prisma.attendance.update).toHaveBeenCalled();
  });

  it('rejects invalid date format with BadRequestException', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);

    await expect(
      svc.markAttendance('org-1', {
        groupId: 'g1',
        date: 'not-a-valid-date',
        records: [{ studentId: 's1', status: 'PRESENT' }],
      }),
    ).rejects.toThrow('Invalid date provided');
  });

  it('filters by teacherId matching both teacherId and teacher.userId in findAll', async () => {
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.attendance.count.mockResolvedValue(0);

    await svc.findAll('org-1', { teacherId: 't-uuid-1' });

    expect(prisma.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          group: {
            OR: [
              { teacherId: 't-uuid-1' },
              { teacher: { userId: 't-uuid-1' } },
            ],
          },
        }),
      }),
    );
  });

  it('applies date and status filters in getDailyStats and getAnalytics', async () => {
    prisma.attendance.groupBy.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);

    await svc.getAnalytics('org-1', {
      date: '2026-09-04',
      status: 'ABSENT',
      teacherId: 't-uuid-1',
    });

    // Check groupBy received status and teacher filter
    expect(prisma.attendance.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          status: 'ABSENT',
          group: {
            OR: [
              { teacherId: 't-uuid-1' },
              { teacher: { userId: 't-uuid-1' } },
            ],
          },
        }),
      }),
    );

    // Check $queryRaw was called for getDailyStats
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});

