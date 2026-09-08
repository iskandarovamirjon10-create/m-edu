import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendanceService } from '../attendance.service';

function createMockPrisma() {
  return {
    group: { findFirst: vi.fn() },
    studentGroup: { findMany: vi.fn() },
    attendance: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  };
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
    prisma.attendance.createMany.mockResolvedValue({ count: 1 });
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
  });

  it('scopes queries by organizationId', async () => {
    prisma.attendance.count.mockResolvedValue(0);
    prisma.attendance.findMany.mockResolvedValue([]);
    const svc = new AttendanceService(prisma);
    await svc.findAll('org-1', {});
    const findManyArgs = prisma.attendance.findMany.mock.calls[0][0];
    expect(findManyArgs.where.organizationId).toBe('org-1');
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
    prisma.attendance.createMany.mockResolvedValue({ count: 1 });
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
    const payload = prisma.attendance.createMany.mock.calls[0][0].data;
    expect(payload).toHaveLength(1);
    expect(payload[0].status).toBe('LATE');
  });

  it('falls back to update when a concurrent create violates the unique constraint (P2002)', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);
    prisma.attendance.findMany
      .mockResolvedValueOnce([]) // initial "existing" lookup → none
      .mockResolvedValueOnce([{ id: 'a1', studentId: 's1' }]); // after P2002
    prisma.attendance.createMany.mockRejectedValue({ code: 'P2002' });
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

  it('rethrows non-unique errors from createMany', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.studentGroup.findMany.mockResolvedValue([{ studentId: 's1' }]);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.attendance.createMany.mockRejectedValue(new Error('db down'));
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
    // Stored manual/camera rows live at UTC midnight → boundary must be UTC.
    expect(start.toISOString()).toBe('2026-09-05T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-06T00:00:00.000Z');
  });

  it('applies the same UTC boundaries in analytics', async () => {
    prisma.attendance.groupBy.mockResolvedValue([]);
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    await svc.getAnalytics('org-1', { date: '2026-09-05' });
    const where = prisma.attendance.groupBy.mock.calls[0][0].where;
    const start = new Date(where.date.gte);
    expect(start.toISOString()).toBe('2026-09-05T00:00:00.000Z');
  });
});
