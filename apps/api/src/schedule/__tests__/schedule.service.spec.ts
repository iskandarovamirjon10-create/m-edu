import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleService } from '../schedule.service';
import { LessonGeneratorService } from '../lesson-generator.service';

import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  const mockPrisma: any = {
    schedule: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    group: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma));
  return mockPrisma;
}

describe('ScheduleService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let lessonGenerator: { generate: ReturnType<typeof vi.fn> };
  let svc: ScheduleService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    lessonGenerator = {
      generate: vi.fn().mockResolvedValue({
        from: new Date(),
        to: new Date(),
        groupsScanned: 1,
        schedulesMatched: 1,
        created: 0,
        skipped: 0,
        pastPlannedCancelled: 0,
      }),
    };
    svc = new ScheduleService(
      prisma as unknown as PrismaService,
      lessonGenerator as unknown as LessonGeneratorService,
    );
  });

  describe('findAll', () => {
    it('scopes schedule rows by the group\u2019s organization (cross-tenant guard)', async () => {
      prisma.schedule.findMany.mockResolvedValue([]);
      prisma.schedule.count.mockResolvedValue(0);
      await svc.findAll('org-1', {});
      const where = prisma.schedule.findMany.mock.calls[0][0].where;
      expect(where.group).toEqual({ organizationId: 'org-1' });
    });

    it('only lists active schedules (soft-deleted rows are hidden)', async () => {
      prisma.schedule.findMany.mockResolvedValue([]);
      prisma.schedule.count.mockResolvedValue(0);
      await svc.findAll('org-1', {});
      const where = prisma.schedule.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(true);
      // The count query must use the exact same tenant-scoped predicate.
      const countWhere = prisma.schedule.count.mock.calls[0][0].where;
      expect(countWhere.group).toEqual({ organizationId: 'org-1' });
      expect(countWhere.isActive).toBe(true);
    });

    it('ignores an invalid dayOfWeek value instead of crashing the query', async () => {
      prisma.schedule.findMany.mockResolvedValue([]);
      prisma.schedule.count.mockResolvedValue(0);
      await svc.findAll('org-1', { dayOfWeek: 'NOT-A-DAY' });
      const where = prisma.schedule.findMany.mock.calls[0][0].where;
      expect(where.dayOfWeek).toBeUndefined();
    });

    it('filters by groupId and dayOfWeek when provided', async () => {
      prisma.schedule.findMany.mockResolvedValue([]);
      prisma.schedule.count.mockResolvedValue(0);
      await svc.findAll('org-1', { groupId: 'g-1', dayOfWeek: 'MONDAY' });
      const where = prisma.schedule.findMany.mock.calls[0][0].where;
      expect(where.groupId).toBe('g-1');
      expect(where.dayOfWeek).toBe('MONDAY');
    });

    it('orders by dayOfWeek then startTime and paginates', async () => {
      prisma.schedule.findMany.mockResolvedValue([]);
      prisma.schedule.count.mockResolvedValue(0);
      await svc.findAll('org-1', { page: '2', limit: '5' });
      expect(prisma.schedule.findMany.mock.calls[0][0].orderBy).toEqual([
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ]);
      expect(prisma.schedule.findMany.mock.calls[0][0].skip).toBe(5);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for a schedule outside the organization', async () => {
      prisma.schedule.findFirst.mockResolvedValue(null);
      await expect(svc.findOne('org-1', 's-other')).rejects.toThrow('Schedule not found');
    });

    it('returns an in-org schedule', async () => {
      prisma.schedule.findFirst.mockResolvedValue({ id: 's-1', group: { id: 'g-1' } });
      const result = await svc.findOne('org-1', 's-1');
      expect(result.id).toBe('s-1');
    });
  });

  describe('create', () => {
    it('rejects scheduling for a group outside the organization', async () => {
      prisma.group.findFirst.mockResolvedValue(null);
      await expect(
        svc.create('org-1', { groupId: 'g-other', dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:00' }),
      ).rejects.toThrow('Group not found');
      expect(prisma.schedule.create).not.toHaveBeenCalled();
    });

    it('creates a schedule for an in-org group', async () => {
      prisma.group.findFirst.mockResolvedValue({ id: 'g-1', teacherId: 't-1' });
      prisma.schedule.findMany.mockResolvedValue([]);
      prisma.schedule.create.mockResolvedValue({ id: 's-1' });
      await svc.create('org-1', { groupId: 'g-1', dayOfWeek: 'WEDNESDAY', startTime: '09:00', endTime: '10:30', room: 'A-101' });
      expect(prisma.schedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ groupId: 'g-1', dayOfWeek: 'WEDNESDAY', room: 'A-101' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('updates only whitelisted fields', async () => {
      prisma.schedule.findFirst.mockResolvedValue({ id: 's-1' });
      prisma.schedule.update.mockResolvedValue({ id: 's-1', room: 'B-204' });
      await svc.update('org-1', 's-1', { room: 'B-204' });
      expect(prisma.schedule.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 's-1', group: { organizationId: 'org-1' } }, data: { room: 'B-204' } }),
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes by flipping isActive to false', async () => {
      prisma.schedule.findFirst.mockResolvedValue({ id: 's-1' });
      prisma.schedule.update.mockResolvedValue({ id: 's-1', isActive: false });
      await svc.remove('org-1', 's-1');
      expect(prisma.schedule.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 's-1', group: { organizationId: 'org-1' } }, data: { isActive: false } }),
      );
    });
  });
});
