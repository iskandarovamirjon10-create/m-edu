import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudentsService } from '../students.service';
import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  const studentGroup = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  };

  const student = {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };

  const user = {
    updateMany: vi.fn(),
  };

  const group = {
    findFirst: vi.fn(),
  };

  const mock = {
    student,
    user,
    group,
    studentGroup,
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(async (cbOrArr: any) => {
      if (typeof cbOrArr === 'function') {
        return cbOrArr(mock);
      }
      return Promise.all(cbOrArr);
    }),
  };

  return mock;
}

describe('StudentsService Bulk Operations', () => {
  let service: StudentsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  const orgId = '00000000-0000-0000-0000-000000000001';
  const groupId = '11111111-1111-1111-1111-111111111111';
  const student1 = '22222222-2222-2222-2222-222222222221';
  const student2 = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new StudentsService(prisma as unknown as PrismaService);
  });

  describe('bulkAssignGroup', () => {
    it('returns 0 if studentIds is empty', async () => {
      const res = await service.bulkAssignGroup(orgId, { studentIds: [], groupId });
      expect(res).toEqual({ assignedCount: 0, studentIds: [] });
    });

    it('throws NotFoundException if group does not exist', async () => {
      prisma.group.findFirst.mockResolvedValue(null);
      await expect(
        service.bulkAssignGroup(orgId, { studentIds: [student1], groupId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if group capacity would be exceeded', async () => {
      prisma.group.findFirst.mockResolvedValue({ id: groupId, capacity: 10, isActive: true });
      prisma.studentGroup.count.mockResolvedValue(9);
      prisma.student.findMany.mockResolvedValue([{ id: student1 }, { id: student2 }]);
      prisma.studentGroup.findMany.mockResolvedValue([]);

      await expect(
        service.bulkAssignGroup(orgId, { studentIds: [student1, student2], groupId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully assigns students within capacity', async () => {
      prisma.group.findFirst.mockResolvedValue({ id: groupId, capacity: 10, isActive: true });
      prisma.studentGroup.count.mockResolvedValue(5);
      prisma.student.findMany.mockResolvedValue([{ id: student1 }, { id: student2 }]);
      prisma.studentGroup.findMany.mockResolvedValue([]);
      prisma.studentGroup.upsert.mockResolvedValue({ id: 'sg-1', isActive: true });

      const res = await service.bulkAssignGroup(orgId, { studentIds: [student1, student2], groupId });
      expect(res.assignedCount).toBe(2);
      expect(res.studentIds).toEqual([student1, student2]);
      expect(prisma.studentGroup.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('bulkFreeze', () => {
    it('freezes students and updates notes with reason and dates', async () => {
      prisma.student.findMany.mockResolvedValue([
        { id: student1, notes: 'Previous note' },
        { id: student2, notes: '' },
      ]);
      prisma.student.update.mockResolvedValue({});

      const res = await service.bulkFreeze(orgId, {
        studentIds: [student1, student2],
        startDate: '2026-11-01',
        endDate: '2026-11-15',
        reason: 'Sport training camp',
      });

      expect(res.count).toBe(2);
      expect(prisma.student.update).toHaveBeenCalledTimes(2);
      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: student1 },
          data: expect.objectContaining({
            status: 'PAUSED',
            notes: expect.stringContaining('Sport training camp'),
          }),
        }),
      );
    });
  });

  describe('bulkUnfreeze', () => {
    it('restores students to ACTIVE status', async () => {
      prisma.student.findMany.mockResolvedValue([
        { id: student1, notes: 'Frozen note' },
      ]);
      prisma.student.update.mockResolvedValue({});

      const res = await service.bulkUnfreeze(orgId, { studentIds: [student1] });
      expect(res.count).toBe(1);
      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: student1 },
          data: expect.objectContaining({
            status: 'ACTIVE',
            notes: expect.stringContaining("O'qish qayta tiklandi"),
          }),
        }),
      );
    });
  });

  describe('bulkStatus', () => {
    it('updates student status and linked user isActive flag', async () => {
      prisma.student.findMany.mockResolvedValue([
        { id: student1, userId: 'u-1' },
        { id: student2, userId: 'u-2' },
      ]);
      prisma.student.updateMany.mockResolvedValue({ count: 2 });
      prisma.user.updateMany.mockResolvedValue({ count: 2 });

      const res = await service.bulkStatus(orgId, {
        studentIds: [student1, student2],
        status: 'GRADUATED',
      });

      expect(res.count).toBe(2);
      expect(prisma.student.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [student1, student2] }, organizationId: orgId },
        data: { status: 'GRADUATED' },
      });
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['u-1', 'u-2'] }, organizationId: orgId },
        data: { isActive: false },
      });
    });
  });
});
