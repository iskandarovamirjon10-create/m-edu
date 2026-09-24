import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupsService } from '../groups.service';

function createMockPrisma() {
  return {
    course: { findFirst: vi.fn() },
    teacher: { findFirst: vi.fn() },
    group: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  };
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
});
