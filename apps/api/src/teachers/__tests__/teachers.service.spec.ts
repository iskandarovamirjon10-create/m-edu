import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TeachersService } from '../teachers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { userPublicSelect } from '../../common/selects/user.select';

function createMockPrisma() {
  const obj = {
    teacher: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    group: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    notification: { deleteMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    userSettings: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  obj.$transaction.mockImplementation((fn: (tx: typeof obj) => Promise<unknown>) => fn(obj));
  return obj;
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('TeachersService', () => {
  let prisma: MockPrisma;
  let svc: TeachersService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new TeachersService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns paginated teachers with search filter', async () => {
      prisma.teacher.findMany.mockResolvedValue([]);
      prisma.teacher.count.mockResolvedValue(0);

      const result = await svc.findAll('org-1', { search: 'John', page: '1', limit: '10' });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(prisma.teacher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns teacher when found', async () => {
      const teacher = { id: 't1', organizationId: 'org-1' };
      prisma.teacher.findFirst.mockResolvedValue(teacher);

      const result = await svc.findOne('org-1', 't1');
      expect(result).toBe(teacher);
    });

    it('throws NotFoundException when teacher not found', async () => {
      prisma.teacher.findFirst.mockResolvedValue(null);

      await expect(svc.findOne('org-1', 'unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('throws BadRequestException if email is already in use', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', email: 'teacher@test.com' });

      await expect(
        svc.create('org-1', {
          firstName: 'Anvar',
          lastName: 'Salimov',
          email: 'teacher@test.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates teacher with placeholder email when omitted', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const created = { id: 't1', organizationId: 'org-1' };
      prisma.teacher.create.mockResolvedValue(created);

      const result = await svc.create('org-1', {
        firstName: 'Anvar',
        lastName: 'Salimov',
      });
      expect(result).toBe(created);
      expect(prisma.teacher.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organization: { connect: { id: 'org-1' } },
            user: expect.objectContaining({
              create: expect.objectContaining({
                email: expect.stringMatching(/^teacher-.*@placeholder\.local$/),
                role: 'TEACHER',
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('returns existing teacher if update data is empty', async () => {
      const existing = { id: 't1', organizationId: 'org-1' };
      prisma.teacher.findFirst.mockResolvedValue(existing);

      const result = await svc.update('org-1', 't1', {});
      expect(result).toBe(existing);
      expect(prisma.teacher.update).not.toHaveBeenCalled();
    });

    it('updates teacher and user profile', async () => {
      const existing = { id: 't1', organizationId: 'org-1' };
      prisma.teacher.findFirst.mockResolvedValue(existing);
      prisma.teacher.update.mockResolvedValue({ ...existing, bio: 'Math Teacher' });

      const result = await svc.update('org-1', 't1', { bio: 'Math Teacher', firstName: 'Updated' });
      expect(prisma.teacher.update).toHaveBeenCalledWith({
        where: { id: 't1', organizationId: 'org-1' },
        data: {
          bio: 'Math Teacher',
          user: { update: { firstName: 'Updated' } },
        },
        include: { user: userPublicSelect },
      });
      expect(result.bio).toBe('Math Teacher');
    });
  });

  describe('remove', () => {
    it('rejects deleting a teacher assigned to groups', async () => {
      prisma.teacher.findFirst.mockResolvedValue({ id: 't1', organizationId: 'org-1', userId: 'u1' });
      prisma.group.count.mockResolvedValue(2);

      await expect(svc.remove('org-1', 't1')).rejects.toThrow(
        'deactivate the teacher instead of deleting them',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('deletes an unassigned teacher and their linked user in one transaction', async () => {
      prisma.teacher.findFirst.mockResolvedValue({ id: 't1', organizationId: 'org-1', userId: 'u1' });
      prisma.group.count.mockResolvedValue(0);

      const result = await svc.remove('org-1', 't1');

      expect(prisma.teacher.delete).toHaveBeenCalledWith({ where: { id: 't1', organizationId: 'org-1' } });
      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(prisma.userSettings.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(prisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: 'u1', organizationId: 'org-1' } });
      expect(result.message).toContain('deleted');
    });
  });
});
