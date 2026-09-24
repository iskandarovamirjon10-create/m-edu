import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GradesService } from '../grades.service';

function createMockPrisma() {
  return {
    grade: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    student: { findFirst: vi.fn() },
    group: { findFirst: vi.fn() },
    studentGroup: { findFirst: vi.fn() },
  };
}

describe('GradesService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: GradesService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new GradesService(prisma as unknown as ConstructorParameters<typeof GradesService>[0]);
  });

  describe('create', () => {
    it('rejects grading a student outside the organization', async () => {
      prisma.student.findFirst.mockResolvedValue(null);
      await expect(
        svc.create('org-1', { studentId: 's-other', groupId: 'g-1', value: 90 }),
      ).rejects.toThrow('Student not found');
      expect(prisma.grade.create).not.toHaveBeenCalled();
    });

    it('rejects grading into a group outside the organization', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 's-1' });
      prisma.group.findFirst.mockResolvedValue(null);
      await expect(
        svc.create('org-1', { studentId: 's-1', groupId: 'g-other', value: 90 }),
      ).rejects.toThrow('Group not found');
      expect(prisma.grade.create).not.toHaveBeenCalled();
    });

    it('rejects grading a student who is not enrolled in the group', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 's-1' });
      prisma.group.findFirst.mockResolvedValue({ id: 'g-1' });
      prisma.studentGroup.findFirst.mockResolvedValue(null);
      await expect(
        svc.create('org-1', { studentId: 's-1', groupId: 'g-1', value: 90 }),
      ).rejects.toThrow('is not enrolled in group');
      expect(prisma.grade.create).not.toHaveBeenCalled();
    });

    it('creates a grade for an enrolled in-org student', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 's-1' });
      prisma.group.findFirst.mockResolvedValue({ id: 'g-1' });
      prisma.studentGroup.findFirst.mockResolvedValue({ id: 'sg-1' });
      prisma.grade.create.mockResolvedValue({ id: 'grade-1' });
      await svc.create('org-1', { studentId: 's-1', groupId: 'g-1', value: 95, maxValue: 100, label: 'A', notes: 'Excellent' });
      expect(prisma.grade.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', studentId: 's-1', groupId: 'g-1', value: 95 }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('filters by studentId and groupId when provided', async () => {
      prisma.grade.findMany.mockResolvedValue([]);
      prisma.grade.count.mockResolvedValue(0);
      await svc.findAll('org-1', { studentId: 's-1', groupId: 'g-1' });
      const where = prisma.grade.findMany.mock.calls[0][0].where;
      expect(where).toEqual({ organizationId: 'org-1', studentId: 's-1', groupId: 'g-1' });
    });
  });

  describe('update', () => {
    it('throws NotFoundException for a grade outside the organization', async () => {
      prisma.grade.findFirst.mockResolvedValue(null);
      await expect(svc.update('org-1', 'grade-other', { value: 80 })).rejects.toThrow('Grade not found');
    });

    it('updates only whitelisted fields', async () => {
      prisma.grade.findFirst.mockResolvedValue({ id: 'grade-1' });
      prisma.grade.update.mockResolvedValue({ id: 'grade-1', value: 80 });
      await svc.update('org-1', 'grade-1', { value: 80, notes: 'Retake' });
      expect(prisma.grade.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'grade-1', organizationId: 'org-1' }, data: { value: 80, notes: 'Retake' } }),
      );
    });
  });

  describe('remove', () => {
    it('hard-deletes an in-org grade', async () => {
      prisma.grade.findFirst.mockResolvedValue({ id: 'grade-1' });
      prisma.grade.delete.mockResolvedValue({ id: 'grade-1' });
      await svc.remove('org-1', 'grade-1');
      expect(prisma.grade.delete).toHaveBeenCalledWith({ where: { id: 'grade-1', organizationId: 'org-1' } });
    });

    it('throws NotFoundException for a cross-tenant grade', async () => {
      prisma.grade.findFirst.mockResolvedValue(null);
      await expect(svc.remove('org-1', 'grade-other')).rejects.toThrow('Grade not found');
    });
  });
});
