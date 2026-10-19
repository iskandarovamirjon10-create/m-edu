import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
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
    payment: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
    refund: { count: vi.fn().mockResolvedValue(0), deleteMany: vi.fn() },
    paymentTransaction: { deleteMany: vi.fn() },
    attendance: { count: vi.fn(), deleteMany: vi.fn() },
    grade: { count: vi.fn(), deleteMany: vi.fn() },
    invoice: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
    invoiceItem: { deleteMany: vi.fn() },
    faceEnrollment: { count: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
    faceTemplate: { deleteMany: vi.fn() },
    recognitionAttempt: { count: vi.fn(), deleteMany: vi.fn() },
    cameraAttendanceEvent: { count: vi.fn(), deleteMany: vi.fn() },
    examResult: { deleteMany: vi.fn() },
    certificate: { deleteMany: vi.fn() },
    libraryBorrow: { deleteMany: vi.fn() },
    homeworkSubmission: { deleteMany: vi.fn() },
    assignmentSubmission: { deleteMany: vi.fn() },
    quizAttempt: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
    quizAttemptAnswer: { deleteMany: vi.fn() },
    studentObjectiveMastery: { deleteMany: vi.fn() },
    studentProgressSnapshot: { deleteMany: vi.fn() },
    gamificationXpEvent: { deleteMany: vi.fn() },
    studentGamification: { deleteMany: vi.fn() },
    discount: { deleteMany: vi.fn() },
    parentTeacherMessage: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    userSettings: { deleteMany: vi.fn() },
    parentAccount: { findFirst: vi.fn(), create: vi.fn() },
    parentStudent: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  obj.$transaction.mockImplementation((fn: (tx: typeof obj) => Promise<unknown>) => fn(obj));
  return obj;
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('StudentsService delete semantics & financial preservation (FIN-010)', () => {
  let prisma: MockPrisma;
  let svc: StudentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new StudentsService(prisma as unknown as PrismaService);
  });

  it('deletes a clean student without financial records in one transaction', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1', userId: 'u1' });
    prisma.payment.count.mockResolvedValue(0);
    prisma.invoice.count.mockResolvedValue(0);
    prisma.refund.count.mockResolvedValue(0);

    const result = await svc.remove('org-1', 's1');

    // Concurrency lock
    expect(prisma.$queryRaw).toHaveBeenCalled();

    // Student and non-financial associations deleted
    expect(prisma.student.deleteMany).toHaveBeenCalledWith({ where: { id: 's1', organizationId: 'org-1' } });
    expect(prisma.studentGroup.deleteMany).toHaveBeenCalledWith({ where: { studentId: 's1', organizationId: 'org-1' } });
    expect(prisma.attendance.deleteMany).toHaveBeenCalledWith({ where: { studentId: 's1', organizationId: 'org-1' } });
    expect(prisma.grade.deleteMany).toHaveBeenCalledWith({ where: { studentId: 's1', organizationId: 'org-1' } });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.userSettings.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: 'u1', organizationId: 'org-1' } });

    // Financial records are NEVER deleted
    expect(prisma.payment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.invoice.deleteMany).not.toHaveBeenCalled();
    expect(prisma.refund.deleteMany).not.toHaveBeenCalled();
    expect(prisma.paymentTransaction.deleteMany).not.toHaveBeenCalled();
    expect(prisma.invoiceItem.deleteMany).not.toHaveBeenCalled();

    expect(result.message).toContain('deleted successfully');
  });

  it('rejects deletion with ConflictException when student has existing payments', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1', userId: 'u1' });
    prisma.payment.count.mockResolvedValue(2);
    prisma.invoice.count.mockResolvedValue(0);
    prisma.refund.count.mockResolvedValue(0);

    await expect(svc.remove('org-1', 's1')).rejects.toThrow(ConflictException);
    await expect(svc.remove('org-1', 's1')).rejects.toThrow(
      /Cannot delete student with existing financial history/i,
    );

    // Assert NO deletions occurred on any table
    expect(prisma.student.deleteMany).not.toHaveBeenCalled();
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
    expect(prisma.payment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.invoice.deleteMany).not.toHaveBeenCalled();
    expect(prisma.refund.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects deletion with ConflictException when student has existing invoices', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1', userId: 'u1' });
    prisma.payment.count.mockResolvedValue(0);
    prisma.invoice.count.mockResolvedValue(1);
    prisma.refund.count.mockResolvedValue(0);

    await expect(svc.remove('org-1', 's1')).rejects.toThrow(ConflictException);
    await expect(svc.remove('org-1', 's1')).rejects.toThrow(
      /Cannot delete student with existing financial history/i,
    );

    expect(prisma.student.deleteMany).not.toHaveBeenCalled();
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
    expect(prisma.invoice.deleteMany).not.toHaveBeenCalled();
    expect(prisma.payment.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects deletion with ConflictException when student has existing refunds', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1', userId: 'u1' });
    prisma.payment.count.mockResolvedValue(0);
    prisma.invoice.count.mockResolvedValue(0);
    prisma.refund.count.mockResolvedValue(1);

    await expect(svc.remove('org-1', 's1')).rejects.toThrow(ConflictException);
    await expect(svc.remove('org-1', 's1')).rejects.toThrow(
      /Cannot delete student with existing financial history/i,
    );

    expect(prisma.student.deleteMany).not.toHaveBeenCalled();
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
    expect(prisma.refund.deleteMany).not.toHaveBeenCalled();
  });

  it('ensures all records remain completely untouched when deletion is rejected', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1', userId: 'u1' });
    prisma.payment.count.mockResolvedValue(1);
    prisma.invoice.count.mockResolvedValue(1);
    prisma.refund.count.mockResolvedValue(1);

    try {
      await svc.remove('org-1', 's1');
      expect.fail('Should have thrown ConflictException');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
    }

    // Verify zero mutations across the entire schema
    expect(prisma.student.deleteMany).not.toHaveBeenCalled();
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
    expect(prisma.studentGroup.deleteMany).not.toHaveBeenCalled();
    expect(prisma.attendance.deleteMany).not.toHaveBeenCalled();
    expect(prisma.grade.deleteMany).not.toHaveBeenCalled();
    expect(prisma.examResult.deleteMany).not.toHaveBeenCalled();
    expect(prisma.certificate.deleteMany).not.toHaveBeenCalled();
    expect(prisma.faceEnrollment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.faceTemplate.deleteMany).not.toHaveBeenCalled();
    expect(prisma.payment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.invoice.deleteMany).not.toHaveBeenCalled();
    expect(prisma.refund.deleteMany).not.toHaveBeenCalled();
    expect(prisma.paymentTransaction.deleteMany).not.toHaveBeenCalled();
    expect(prisma.invoiceItem.deleteMany).not.toHaveBeenCalled();
  });

  it('enforces organizationId scoping and rejects deleting a student belonging to another tenant', async () => {
    // Student belongs to org-2, caller is org-1
    prisma.student.findFirst.mockImplementation(({ where }) => {
      if (where.organizationId === 'org-1') return Promise.resolve(null);
      if (!where.organizationId && where.id === 's1') {
        return Promise.resolve({ id: 's1', organizationId: 'org-2' });
      }
      return Promise.resolve(null);
    });

    await expect(svc.remove('org-1', 's1')).rejects.toThrow(NotFoundException);

    // Verify no deletion occurred
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.student.deleteMany).not.toHaveBeenCalled();
  });

  it('scopes financial history queries strictly by organizationId', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1', userId: 'u1' });
    prisma.payment.count.mockResolvedValue(0);
    prisma.invoice.count.mockResolvedValue(0);
    prisma.refund.count.mockResolvedValue(0);

    await svc.remove('org-1', 's1');

    // Check payment.count scoping
    expect(prisma.payment.count).toHaveBeenCalledWith({
      where: { studentId: 's1', organizationId: 'org-1' },
    });

    // Check invoice.count scoping
    expect(prisma.invoice.count).toHaveBeenCalledWith({
      where: { studentId: 's1', organizationId: 'org-1' },
    });

    // Check refund.count scoping
    expect(prisma.refund.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
        }),
      }),
    );
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

    await expect(svc.assignToGroup('org-1', 's1', 'g1')).rejects.toThrow(/capacity/i);
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

describe('StudentsService parent management', () => {
  let prisma: MockPrisma;
  let svc: StudentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new StudentsService(prisma as unknown as PrismaService);
  });

  it('creates a new parent account and links it to the student', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1' });
    prisma.parentAccount.findFirst.mockResolvedValue(null);
    prisma.parentAccount.create.mockResolvedValue({
      id: 'p1',
      organizationId: 'org-1',
      email: 'parent@example.com',
      firstName: 'Farhod',
      lastName: 'Karimov',
    });
    prisma.parentStudent.findUnique.mockResolvedValue(null);
    prisma.parentStudent.create.mockResolvedValue({
      id: 'link1',
      parentId: 'p1',
      studentId: 's1',
      relationship: 'father',
    });

    const result = await svc.createOrLinkParent('org-1', 's1', {
      email: 'parent@example.com',
      firstName: 'Farhod',
      lastName: 'Karimov',
      relationship: 'father',
    });

    expect(prisma.parentAccount.create).toHaveBeenCalled();
    expect(prisma.parentStudent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentId: 'p1',
          studentId: 's1',
          relationship: 'father',
        }),
      }),
    );
    expect(result).toEqual({
      id: 'link1',
      parentId: 'p1',
      studentId: 's1',
      relationship: 'father',
    });
  });

  it('reuses existing parent account and prevents duplicate linking', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1' });
    prisma.parentAccount.findFirst.mockResolvedValue({
      id: 'p1',
      organizationId: 'org-1',
      email: 'parent@example.com',
    });
    prisma.parentStudent.findUnique.mockResolvedValue({ id: 'existing-link' });

    await expect(
      svc.createOrLinkParent('org-1', 's1', {
        email: 'parent@example.com',
        firstName: 'Farhod',
        lastName: 'Karimov',
      }),
    ).rejects.toThrow('Parent is already linked to this student');
    expect(prisma.parentAccount.create).not.toHaveBeenCalled();
  });

  it('unlinks parent from student', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1' });
    prisma.parentStudent.findFirst.mockResolvedValue({ id: 'link1' });
    prisma.parentStudent.delete.mockResolvedValue({ id: 'link1' });

    const result = await svc.unlinkParent('org-1', 's1', 'p1');
    expect(prisma.parentStudent.delete).toHaveBeenCalledWith({ where: { id: 'link1' } });
    expect(result).toEqual({ success: true });
  });

  it('runs createOrLinkParent in transaction and demotes other primary links when isPrimary is true', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1' });
    prisma.parentAccount.findFirst.mockResolvedValue({ id: 'p2', organizationId: 'org-1' });
    prisma.parentStudent.findUnique.mockResolvedValue(null);
    prisma.parentStudent.create.mockResolvedValue({ id: 'link2', isPrimary: true });

    await svc.createOrLinkParent('org-1', 's1', {
      email: 'parent2@example.com',
      firstName: 'Malika',
      lastName: 'Karimova',
      isPrimary: true,
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.parentStudent.updateMany).toHaveBeenCalledWith({
      where: { studentId: 's1', isPrimary: true },
      data: { isPrimary: false },
    });
    expect(prisma.parentStudent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isPrimary: true,
        }),
      }),
    );
  });

  it('runs updateParentLink in transaction and demotes other primary links when isPrimary is true', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1' });
    prisma.parentStudent.findFirst.mockResolvedValue({ id: 'link2', studentId: 's1', parentId: 'p2' });
    prisma.parentStudent.update.mockResolvedValue({ id: 'link2', isPrimary: true });

    await svc.updateParentLink('org-1', 's1', 'p2', {
      isPrimary: true,
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.parentStudent.updateMany).toHaveBeenCalledWith({
      where: { studentId: 's1', isPrimary: true, id: { not: 'link2' } },
      data: { isPrimary: false },
    });
    expect(prisma.parentStudent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'link2' },
        data: expect.objectContaining({
          isPrimary: true,
        }),
      }),
    );
  });
});

