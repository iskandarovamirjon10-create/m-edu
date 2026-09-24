import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { StudentsService } from '../students.service';
import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  return {
    group: {
      findFirst: vi.fn(),
    },
    student: {
      findFirst: vi.fn(),
    },
    studentGroup: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('StudentsService group membership semantics', () => {
  let prisma: MockPrisma;
  let svc: StudentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new StudentsService(prisma as unknown as PrismaService);
  });

  describe('removeFromGroup', () => {
    it('throws NotFoundException if membership does not exist', async () => {
      prisma.studentGroup.findFirst.mockResolvedValue(null);

      await expect(svc.removeFromGroup('org-1', 's1', 'g1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sets isActive to false on studentGroup update', async () => {
      prisma.studentGroup.findFirst.mockResolvedValue({ studentId: 's1', groupId: 'g1' });
      prisma.studentGroup.update.mockResolvedValue({ studentId: 's1', groupId: 'g1', isActive: false });

      const result = await svc.removeFromGroup('org-1', 's1', 'g1');
      expect(prisma.studentGroup.update).toHaveBeenCalledWith({
        where: { studentId_groupId: { studentId: 's1', groupId: 'g1' } },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });
  });

  describe('assignToGroup guard checks', () => {
    it('throws NotFoundException if group not found', async () => {
      prisma.group.findFirst.mockResolvedValue(null);

      await expect(svc.assignToGroup('org-1', 's1', 'nonexistent-group')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException if student not found', async () => {
      prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(svc.assignToGroup('org-1', 'nonexistent-student', 'g1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
