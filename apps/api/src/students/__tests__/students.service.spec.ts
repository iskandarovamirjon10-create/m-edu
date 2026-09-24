import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentsService } from '../students.service';
import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  const studentGroup = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  };
  const obj = {
    student: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    user: { findFirst: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    group: { findFirst: vi.fn() },
    studentGroup,
    payment: { count: vi.fn() },
    attendance: { count: vi.fn() },
    grade: { count: vi.fn() },
    invoice: { count: vi.fn() },
    faceEnrollment: { count: vi.fn() },
    recognitionAttempt: { count: vi.fn() },
    cameraAttendanceEvent: { count: vi.fn() },
    notification: { deleteMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    userSettings: { deleteMany: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  obj.$transaction.mockImplementation((fn: (tx: typeof obj) => Promise<unknown>) => fn(obj));
  return obj;
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('StudentsService delete semantics', () => {
  let prisma: MockPrisma;
  let svc: StudentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new StudentsService(prisma as unknown as PrismaService);
  });

  it('rejects deleting a student with historical records', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1', userId: 'u1' });
    prisma.payment.count.mockResolvedValue(1);
    prisma.attendance.count.mockResolvedValue(0);
    prisma.grade.count.mockResolvedValue(0);
    prisma.faceEnrollment.count.mockResolvedValue(0);
    prisma.recognitionAttempt.count.mockResolvedValue(0);
    prisma.cameraAttendanceEvent.count.mockResolvedValue(0);
    prisma.invoice.count.mockResolvedValue(0);

    await expect(svc.remove('org-1', 's1')).rejects.toThrow(
      'deactivate the student instead of deleting them',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deletes a clean student and their linked user in one transaction', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1', userId: 'u1' });
    prisma.payment.count.mockResolvedValue(0);
    prisma.attendance.count.mockResolvedValue(0);
    prisma.grade.count.mockResolvedValue(0);
    prisma.faceEnrollment.count.mockResolvedValue(0);
    prisma.recognitionAttempt.count.mockResolvedValue(0);
    prisma.cameraAttendanceEvent.count.mockResolvedValue(0);
    prisma.invoice.count.mockResolvedValue(0);

    const result = await svc.remove('org-1', 's1');

    expect(prisma.student.deleteMany).toHaveBeenCalledWith({ where: { id: 's1', organizationId: 'org-1' } });
    expect(prisma.studentGroup.deleteMany).toHaveBeenCalledWith({ where: { studentId: 's1', organizationId: 'org-1' } });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.userSettings.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: 'u1', organizationId: 'org-1' } });
    expect(result.message).toContain('deleted');
  });
});

describe('StudentsService findAll tenant scoping', () => {
  let prisma: MockPrisma;
  let svc: StudentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new StudentsService(prisma as unknown as PrismaService);
  });

  it('scopes the groupId filter by organizationId (cross-tenant group refs cannot leak)', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    await svc.findAll('org-1', { groupId: 'group-from-org-2', page: '1', limit: '20' });

    // The nested membership filter must include the caller's tenant.
    const where = prisma.student.findMany.mock.calls[0][0].where;
    expect(where.groups).toEqual({
      some: { groupId: 'group-from-org-2', isActive: true, organizationId: 'org-1' },
    });
    expect(where.organizationId).toBe('org-1');
  });

  it('applies search and role filters without a group filter', async () => {
    prisma.student.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    await svc.findAll('org-1', { search: 'Ali', page: '1', limit: '20' });

    const where = prisma.student.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe('org-1');
    expect(where.OR).toBeDefined();
    expect(where.groups).toBeUndefined();
  });
});

describe('StudentsService assignToGroup capacity enforcement', () => {
  let prisma: MockPrisma;
  let svc: StudentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new StudentsService(prisma as unknown as PrismaService);
  });

  it('rejects adding a student when the group is at capacity (20/20)', async () => {
    prisma.group.findFirst.mockResolvedValue({
      id: 'g1',
      organizationId: 'org-1',
      capacity: 20,
    });
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1' });
    prisma.studentGroup.count.mockResolvedValue(20);
    // findUnique must return null = not a current member
    prisma.studentGroup.findUnique.mockResolvedValue(null);

    await expect(svc.assignToGroup('org-1', 's1', 'g1')).rejects.toThrow(/sig.imiga/);
    expect(prisma.studentGroup.upsert).not.toHaveBeenCalled();
  });

  it('allows adding a student when capacity has a free slot (19/20)', async () => {
    prisma.group.findFirst.mockResolvedValue({
      id: 'g1',
      organizationId: 'org-1',
      capacity: 20,
    });
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1' });
    prisma.studentGroup.count.mockResolvedValue(19);
    prisma.studentGroup.findUnique.mockResolvedValue(null);
    prisma.studentGroup.upsert.mockResolvedValue({ id: 'm1' });

    const result = await svc.assignToGroup('org-1', 's1', 'g1');
    expect(result).toEqual({ id: 'm1' });
  });

  it('allows re-activating an existing inactive membership even when group is full', async () => {
    prisma.group.findFirst.mockResolvedValue({
      id: 'g1',
      organizationId: 'org-1',
      capacity: 20,
    });
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1' });
    // Re-activation: student is inactive, so active count = 19 (not 20)
    // because this student isn't in the active count.
    prisma.studentGroup.count.mockResolvedValue(19);
    prisma.studentGroup.findUnique.mockResolvedValue({
      studentId: 's1',
      groupId: 'g1',
      isActive: false,
    });
    prisma.studentGroup.upsert.mockResolvedValue({ id: 'm1' });

    const result = await svc.assignToGroup('org-1', 's1', 'g1');
    expect(result).toEqual({ id: 'm1' });
    expect(prisma.studentGroup.upsert).toHaveBeenCalled();
  });
});
