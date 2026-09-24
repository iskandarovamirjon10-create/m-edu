import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HomeworkService } from '../homework.service';

function createMockPrisma() {
  return {
    homework: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    group: { findFirst: vi.fn() },
  };
}

describe('HomeworkService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: HomeworkService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new HomeworkService(prisma as unknown as ConstructorParameters<typeof HomeworkService>[0]);
  });

  describe('create', () => {
    it('rejects assigning homework to a group outside the organization', async () => {
      prisma.group.findFirst.mockResolvedValue(null);
      await expect(
        svc.create('org-1', { groupId: 'g-other', title: 'HW' }),
      ).rejects.toThrow('Group not found');
      expect(prisma.homework.create).not.toHaveBeenCalled();
    });

    it('creates homework with a parsed deadline date', async () => {
      prisma.group.findFirst.mockResolvedValue({ id: 'g-1' });
      prisma.homework.create.mockResolvedValue({ id: 'hw-1' });
      await svc.create('org-1', { groupId: 'g-1', title: 'Worksheet', deadline: '2026-09-10T12:00:00Z', maxScore: 100 });
      const data = prisma.homework.create.mock.calls[0][0].data;
      expect(data.deadline).toBeInstanceOf(Date);
      expect(data.deadline.toISOString()).toBe('2026-09-10T12:00:00.000Z');
      expect(data.maxScore).toBe(100);
    });

    it('stores a null deadline when not provided', async () => {
      prisma.group.findFirst.mockResolvedValue({ id: 'g-1' });
      prisma.homework.create.mockResolvedValue({ id: 'hw-1' });
      await svc.create('org-1', { groupId: 'g-1', title: 'HW' });
      expect(prisma.homework.create.mock.calls[0][0].data.deadline).toBeNull();
    });
  });

  describe('findAll', () => {
    it('filters by groupId when provided and scopes to the organization', async () => {
      prisma.homework.findMany.mockResolvedValue([]);
      prisma.homework.count.mockResolvedValue(0);
      await svc.findAll('org-1', { groupId: 'g-1' });
      expect(prisma.homework.findMany.mock.calls[0][0].where).toEqual({
        organizationId: 'org-1',
        groupId: 'g-1',
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundException for homework outside the organization', async () => {
      prisma.homework.findFirst.mockResolvedValue(null);
      await expect(svc.update('org-1', 'hw-other', { title: 'X' })).rejects.toThrow('Homework not found');
    });

    it('converts a deadline string to a Date on update', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'hw-1' });
      prisma.homework.update.mockResolvedValue({ id: 'hw-1' });
      await svc.update('org-1', 'hw-1', { deadline: '2026-09-15T08:00:00Z' });
      const data = prisma.homework.update.mock.calls[0][0].data;
      expect(data.deadline).toBeInstanceOf(Date);
    });

    it('returns the existing homework when the payload is empty', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'hw-1', title: 'HW' });
      const result = await svc.update('org-1', 'hw-1', {});
      expect(result).toEqual({ id: 'hw-1', title: 'HW' });
      expect(prisma.homework.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('hard-deletes an in-org homework', async () => {
      prisma.homework.findFirst.mockResolvedValue({ id: 'hw-1' });
      prisma.homework.delete.mockResolvedValue({ id: 'hw-1' });
      await svc.remove('org-1', 'hw-1');
      expect(prisma.homework.delete).toHaveBeenCalledWith({ where: { id: 'hw-1', organizationId: 'org-1' } });
    });
  });
});
