import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendanceService } from '../attendance.service';

function createMockPrisma() {
  const obj = {
    organization: { findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC' }) },
    group: { findFirst: vi.fn() },
    studentGroup: { findMany: vi.fn() },
    attendance: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      create: vi.fn()
    },
    lesson: {
      findMany: vi.fn().mockResolvedValue([{ id: 'mock-lesson', startTime: '10:00', status: 'PLANNED' }]),
      findFirst: vi.fn().mockResolvedValue({ id: 'lesson-1', status: 'PLANNED', groupId: 'g1' }),
      update: vi.fn(),
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
    await expect(svc.update('org-1', id, { status: 'LATE' })).rejects.toThrow(
      'Attendance record not found',
    );
    expect(prisma.attendance.findFirst.mock.calls[0][0].where).toEqual({
      id,
      organizationId: 'org-1',
    });
  });

  it('update patches status and note', async () => {
    prisma.attendance.findFirst.mockResolvedValue({ id, status: 'PRESENT' });
    prisma.attendance.update.mockResolvedValue({ id, status: 'LATE', note: 'late arrival' });

    const result = await svc.update('org-1', id, { status: 'LATE', note: 'late arrival' });

    expect(result.status).toBe('LATE');
    expect(prisma.attendance.update).toHaveBeenCalledWith({
      where: { id: '11111111-1111-4111-8111-111111111111' },
      data: expect.objectContaining({ status: 'LATE', note: 'late arrival' }),
    });
  });

  it('remove deletes the record when authorized', async () => {
    prisma.attendance.findFirst.mockResolvedValue({ id });
    prisma.attendance.delete.mockResolvedValue({ id });

    const result = await svc.remove('org-1', id);
    expect(prisma.attendance.delete).toHaveBeenCalledWith({
      where: { id },
    });
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
