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
      updateMany: vi.fn(),
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

  describe('getStats', () => {
    it('aggregates total, active, capacity, and occupancy metrics', async () => {
      prisma.group.findMany.mockResolvedValue([
        {
          id: 'g-1',
          isActive: true,
          capacity: 20,
          room: 'Room 101',
          teacher: { id: 't-1', user: { firstName: 'Ali', lastName: 'Valiyev' } },
          _count: { enrollments: 18 },
        },
        {
          id: 'g-2',
          isActive: true,
          capacity: 15,
          room: 'Room 102',
          teacher: { id: 't-1', user: { firstName: 'Ali', lastName: 'Valiyev' } },
          _count: { enrollments: 5 },
        },
        {
          id: 'g-3',
          isActive: false,
          capacity: 10,
          room: 'Room 101',
          teacher: null,
          _count: { enrollments: 0 },
        },
      ]);

      const stats = await svc.getStats('org-1');

      expect(stats.totalGroups).toBe(3);
      expect(stats.activeGroups).toBe(2);
      expect(stats.inactiveGroups).toBe(1);
      expect(stats.totalCapacity).toBe(35);
      expect(stats.enrolledStudents).toBe(23);
      expect(stats.nearFullGroups).toBe(1); // 18/20 = 90%
      expect(stats.vacantGroups).toBe(1); // 5/15 = 33%
      expect(stats.uniqueRoomsCount).toBe(2);
      expect(stats.roomDistribution['Room 101']).toBe(2);
      expect(stats.topTeachers[0].teacherName).toBe('Ali Valiyev');
      expect(stats.topTeachers[0].groupCount).toBe(2);
    });
  });

  describe('bulkStatus', () => {
    it('deactivates groups and cancels future planned lessons', async () => {
      prisma.group.findMany.mockResolvedValue([{ id: 'g-1' }, { id: 'g-2' }]);
      prisma.group.updateMany.mockResolvedValue({ count: 2 });

      const res = await svc.bulkStatus('org-1', { groupIds: ['g-1', 'g-2'], isActive: false });

      expect(res.success).toBe(true);
      expect(res.count).toBe(2);
      expect(prisma.studentGroup.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ groupId: { in: ['g-1', 'g-2'] } }) }),
      );
      expect(prisma.lesson.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ groupId: { in: ['g-1', 'g-2'] }, status: 'PLANNED' }) }),
      );
      expect(prisma.group.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['g-1', 'g-2'] }, organizationId: 'org-1' },
        data: { isActive: false },
      });
    });

    it('rejects when some groups do not belong to organization', async () => {
      prisma.group.findMany.mockResolvedValue([{ id: 'g-1' }]); // g-2 not in org

      await expect(
        svc.bulkStatus('org-1', { groupIds: ['g-1', 'g-2'], isActive: true }),
      ).rejects.toThrow('Barcha tanlangan guruhlar ushbu tashkilotga tegishli emas');
    });
  });

  describe('bulkTeacher', () => {
    it('updates teacher for multiple groups after verifying teacher belongs to org', async () => {
      prisma.teacher.findFirst.mockResolvedValue({ id: 't-1' });
      prisma.group.findMany.mockResolvedValue([{ id: 'g-1' }, { id: 'g-2' }]);
      prisma.group.updateMany.mockResolvedValue({ count: 2 });

      const res = await svc.bulkTeacher('org-1', { groupIds: ['g-1', 'g-2'], teacherId: 't-1' });

      expect(res.success).toBe(true);
      expect(res.count).toBe(2);
      expect(prisma.group.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['g-1', 'g-2'] }, organizationId: 'org-1' },
        data: { teacherId: 't-1' },
      });
    });

    it('rejects when teacher belongs to another organization', async () => {
      prisma.teacher.findFirst.mockResolvedValue(null);

      await expect(
        svc.bulkTeacher('org-1', { groupIds: ['g-1'], teacherId: 't-foreign' }),
      ).rejects.toThrow('Teacher not found in organization');
    });
  });

  describe('bulkRoom', () => {
    it('updates room for multiple groups', async () => {
      prisma.group.findMany.mockResolvedValue([{ id: 'g-1' }, { id: 'g-2' }]);
      prisma.group.updateMany.mockResolvedValue({ count: 2 });

      const res = await svc.bulkRoom('org-1', { groupIds: ['g-1', 'g-2'], room: 'Room 204' });

      expect(res.success).toBe(true);
      expect(res.count).toBe(2);
      expect(prisma.group.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['g-1', 'g-2'] }, organizationId: 'org-1' },
        data: { room: 'Room 204' },
      });
    });
  });
});
