import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoursesService } from '../courses.service';

function createMockPrisma() {
  return {
    course: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  };
}

describe('CoursesService', () => {
  let prisma: any;
  let svc: CoursesService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new CoursesService(prisma);
  });

  describe('create', () => {
    it('rejects a negative price', async () => {
      await expect(
        svc.create('org-1', { name: 'C', price: -5, duration: 10 }),
      ).rejects.toThrow('Price cannot be negative');
      expect(prisma.course.create).not.toHaveBeenCalled();
    });

    it('rejects a non-positive duration', async () => {
      await expect(
        svc.create('org-1', { name: 'C', price: 100, duration: 0 }),
      ).rejects.toThrow('Duration must be positive');
      expect(prisma.course.create).not.toHaveBeenCalled();
    });

    it('creates a course scoped to the organization', async () => {
      prisma.course.create.mockResolvedValue({ id: 'course-1' });
      await svc.create('org-1', { name: 'Math', description: 'Algebra', price: 250, duration: 12, level: 'BEGINNER' });
      expect(prisma.course.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', name: 'Math', price: 250, duration: 12 }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('applies the isActive filter only when explicitly provided', async () => {
      prisma.course.findMany.mockResolvedValue([]);
      prisma.course.count.mockResolvedValue(0);
      await svc.findAll('org-1', { page: '1', limit: '10' });
      const where = prisma.course.findMany.mock.calls[0][0].where;
      expect(where.organizationId).toBe('org-1');
      expect(where.isActive).toBeUndefined();
    });

    it('parses isActive=true from a string query', async () => {
      prisma.course.findMany.mockResolvedValue([]);
      prisma.course.count.mockResolvedValue(0);
      await svc.findAll('org-1', { isActive: 'true' });
      expect(prisma.course.findMany.mock.calls[0][0].where.isActive).toBe(true);
    });

    it('builds a case-insensitive OR search', async () => {
      prisma.course.findMany.mockResolvedValue([]);
      prisma.course.count.mockResolvedValue(0);
      await svc.findAll('org-1', { search: 'alge' });
      const where = prisma.course.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(2);
      expect(where.OR[0].name.contains).toBe('alge');
      expect(where.OR[0].name.mode).toBe('insensitive');
    });

    it('computes totalPages from total and limit', async () => {
      prisma.course.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
      prisma.course.count.mockResolvedValue(23);
      const result = await svc.findAll('org-1', { page: '2', limit: '10' });
      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for a course outside the organization', async () => {
      prisma.course.findFirst.mockResolvedValue(null);
      await expect(svc.findOne('org-1', 'course-other')).rejects.toThrow('Course not found');
    });

    it('returns the course with groups for an in-org course', async () => {
      prisma.course.findFirst.mockResolvedValue({ id: 'course-1', groups: [] });
      const result = await svc.findOne('org-1', 'course-1');
      expect(result.id).toBe('course-1');
      expect(prisma.course.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'course-1', organizationId: 'org-1' } }),
      );
    });
  });

  describe('update', () => {
    it('rejects a negative price on update', async () => {
      prisma.course.findFirst.mockResolvedValue({ id: 'course-1' });
      await expect(svc.update('org-1', 'course-1', { price: -1 })).rejects.toThrow('Price cannot be negative');
      expect(prisma.course.update).not.toHaveBeenCalled();
    });

    it('rejects a non-positive duration on update', async () => {
      prisma.course.findFirst.mockResolvedValue({ id: 'course-1' });
      await expect(svc.update('org-1', 'course-1', { duration: -3 })).rejects.toThrow('Duration must be positive');
      expect(prisma.course.update).not.toHaveBeenCalled();
    });

    it('returns the existing course when the payload is empty', async () => {
      prisma.course.findFirst.mockResolvedValue({ id: 'course-1', name: 'Math' });
      const result = await svc.update('org-1', 'course-1', {});
      expect(result).toEqual({ id: 'course-1', name: 'Math' });
      expect(prisma.course.update).not.toHaveBeenCalled();
    });

    it('updates only the provided fields', async () => {
      prisma.course.findFirst.mockResolvedValue({ id: 'course-1' });
      prisma.course.update.mockResolvedValue({ id: 'course-1', price: 300 });
      await svc.update('org-1', 'course-1', { price: 300 });
      expect(prisma.course.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'course-1', organizationId: 'org-1' }, data: { price: 300 } }),
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes by flipping isActive to false', async () => {
      prisma.course.findFirst.mockResolvedValue({ id: 'course-1' });
      prisma.course.update.mockResolvedValue({ id: 'course-1', isActive: false });
      await svc.remove('org-1', 'course-1');
      expect(prisma.course.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'course-1', organizationId: 'org-1' }, data: { isActive: false } }),
      );
    });

    it('throws NotFoundException when the course does not exist', async () => {
      prisma.course.findFirst.mockResolvedValue(null);
      await expect(svc.remove('org-1', 'missing')).rejects.toThrow('Course not found');
    });
  });
});
