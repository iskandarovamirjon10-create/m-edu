import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupsService } from '../groups.service';

function createMockPrisma() {
  const mock: any = {
    course: { findFirst: vi.fn() },
    teacher: { findFirst: vi.fn() },
    group: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    studentGroup: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    lesson: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn(mock)),
  };
  return mock;
}

describe('GroupsService cross-tenant reference guards', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: GroupsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new GroupsService(prisma as unknown as ConstructorParameters<typeof GroupsService>[0]);
  });

  it('rejects creating a group referencing a course from another organization', async () => {
    prisma.course.findFirst.mockResolvedValue(null); // course not in this org
    await expect(
      svc.create('org-1', { name: 'G', courseId: 'course-other-org' }),
    ).rejects.toThrow('Course not found');
    expect(prisma.group.create).not.toHaveBeenCalled();
  });

  it('rejects creating a group referencing a teacher from another organization', async () => {
    prisma.course.findFirst.mockResolvedValue({ id: 'course-1' });
    prisma.teacher.findFirst.mockResolvedValue(null); // teacher not in this org
    await expect(
      svc.create('org-1', { name: 'G', courseId: 'course-1', teacherId: 'teacher-other-org' }),
    ).rejects.toThrow('Teacher not found');
    expect(prisma.group.create).not.toHaveBeenCalled();
  });

  it('allows creating a group with an in-org course and teacher', async () => {
    prisma.course.findFirst.mockResolvedValue({ id: 'course-1' });
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' });
    prisma.group.create.mockResolvedValue({ id: 'group-1' });
    const result = await svc.create('org-1', {
      name: 'G', courseId: 'course-1', teacherId: 'teacher-1',
    });
    expect(prisma.group.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ courseId: 'course-1', teacherId: 'teacher-1' }),
      }),
    );
    expect(result).toBeDefined();
  });

  it('rejects re-assigning a group to a teacher from another organization', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'group-1', organizationId: 'org-1' });
    prisma.teacher.findFirst.mockResolvedValue(null);
    await expect(
      svc.update('org-1', 'group-1', { teacherId: 'teacher-other-org' }),
    ).rejects.toThrow('Teacher not found');
    expect(prisma.group.update).not.toHaveBeenCalled();
  });

  it('allows clearing the teacher (null) without a teacher lookup', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'group-1', organizationId: 'org-1' });
    prisma.group.update.mockResolvedValue({ id: 'group-1' });
    await svc.update('org-1', 'group-1', { teacherId: '' });
    expect(prisma.teacher.findFirst).not.toHaveBeenCalled();
    expect(prisma.group.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ teacherId: null }) }),
    );
  });

  describe('remove (soft delete)', () => {
    it('deactivates active enrollments and cancels future planned lessons on group removal', async () => {
      prisma.group.findFirst.mockResolvedValue({ id: 'group-1', organizationId: 'org-1' });
      prisma.group.update.mockResolvedValue({ id: 'group-1', isActive: false });

      await svc.remove('org-1', 'group-1');

      expect(prisma.studentGroup.updateMany).toHaveBeenCalledWith({
        where: { groupId: 'group-1', organizationId: 'org-1', isActive: true },
        data: expect.objectContaining({ isActive: false }),
      });
      expect(prisma.lesson.updateMany).toHaveBeenCalledWith({
        where: { groupId: 'group-1', organizationId: 'org-1', status: 'PLANNED', date: expect.any(Object) },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.group.update).toHaveBeenCalledWith({
        where: { id: 'group-1', organizationId: 'org-1' },
        data: { isActive: false },
      });
    });
  });

  describe('graduateAndPromote', () => {
    it('rejects targetGroupId that does not belong to the same organization', async () => {
      prisma.group.findFirst
        .mockResolvedValueOnce({ id: 'src-1', organizationId: 'org-1' }) // source group
        .mockResolvedValueOnce(null); // target group not found in org-1

      await expect(
        svc.graduateAndPromote('org-1', 'src-1', {
          studentIds: ['stu-1'],
          targetGroupId: 'target-foreign-org',
        }),
      ).rejects.toThrow('Target group not found in organization');
    });

    it('rejects studentIds that are not active members in source group', async () => {
      prisma.group.findFirst
        .mockResolvedValueOnce({ id: 'src-1', organizationId: 'org-1' })
        .mockResolvedValueOnce({ id: 'target-1', organizationId: 'org-1', isActive: true, capacity: 20 });

      prisma.studentGroup.findMany.mockResolvedValue([]); // stu-1 not in source group

      await expect(
        svc.graduateAndPromote('org-1', 'src-1', {
          studentIds: ['stu-1'],
          targetGroupId: 'target-1',
        }),
      ).rejects.toThrow('Student stu-1 is not an active member of the source group');
    });

    it('rejects promotion when target group capacity is exceeded', async () => {
      prisma.group.findFirst
        .mockResolvedValueOnce({ id: 'src-1', organizationId: 'org-1' })
        .mockResolvedValueOnce({ id: 'target-1', organizationId: 'org-1', isActive: true, capacity: 5 });

      prisma.studentGroup.findMany.mockResolvedValue([
        { studentId: 'stu-1' },
        { studentId: 'stu-2' },
      ]);
      prisma.studentGroup.count.mockResolvedValue(4); // 4 active + 2 promoted > 5 capacity

      await expect(
        svc.graduateAndPromote('org-1', 'src-1', {
          studentIds: ['stu-1', 'stu-2'],
          targetGroupId: 'target-1',
        }),
      ).rejects.toThrow('Target group capacity reached');
    });

    it('successfully graduates and promotes students to target group', async () => {
      prisma.group.findFirst
        .mockResolvedValueOnce({ id: 'src-1', organizationId: 'org-1' })
        .mockResolvedValueOnce({ id: 'target-1', organizationId: 'org-1', isActive: true, capacity: 10 });

      prisma.studentGroup.findMany.mockResolvedValue([
        { studentId: 'stu-1' },
      ]);
      prisma.studentGroup.count.mockResolvedValue(2);

      const result = await svc.graduateAndPromote('org-1', 'src-1', {
        studentIds: ['stu-1'],
        targetGroupId: 'target-1',
      });

      expect(result.success).toBe(true);
      expect(result.promotedCount).toBe(1);
      expect(prisma.studentGroup.updateMany).toHaveBeenCalledWith({
        where: {
          groupId: 'src-1',
          organizationId: 'org-1',
          studentId: { in: ['stu-1'] },
        },
        data: expect.objectContaining({ isActive: false }),
      });
      expect(prisma.studentGroup.upsert).toHaveBeenCalledWith({
        where: { studentId_groupId: { studentId: 'stu-1', groupId: 'target-1' } },
        update: expect.objectContaining({ isActive: true }),
        create: expect.objectContaining({ organizationId: 'org-1', studentId: 'stu-1', groupId: 'target-1', isActive: true }),
      });
    });
  });
});
