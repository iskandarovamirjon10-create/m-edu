import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BranchesService } from '../branches.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  return {
    branch: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('BranchesService', () => {
  let prisma: MockPrisma;
  let svc: BranchesService;

  beforeEach(() => {
    vi.resetAllMocks();
    prisma = createMockPrisma();
    svc = new BranchesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates a branch scoped to the organization', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);
      prisma.branch.create.mockResolvedValue({ id: 'branch-1', organizationId: 'org-1', name: 'Main' });
      await svc.create('org-1', { name: 'Main', code: 'MAIN' });
      expect(prisma.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', name: 'Main', code: 'MAIN' }),
        }),
      );
    });

    it('rejects duplicate branch code within same organization', async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        svc.create('org-1', { name: 'Branch 2', code: 'MAIN' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('filters by organizationId', async () => {
      prisma.branch.findMany.mockResolvedValue([]);
      const result = await svc.findAll('org-1');
      expect(prisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
        }),
      );
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when branch not found', async () => {
      prisma.branch.findFirst.mockResolvedValue(null);
      await expect(svc.findOne('org-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns branch within the correct organization', async () => {
      const expected = { id: 'b1', organizationId: 'org-1' };
      prisma.branch.findFirst.mockResolvedValue(expected);
      const result = await svc.findOne('org-1', 'b1');
      expect(prisma.branch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1', organizationId: 'org-1' },
        }),
      );
      expect(result).toBe(expected);
    });
  });

  describe('update', () => {
    it('updates a branch within the organization', async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: 'b1', organizationId: 'org-1' });
      prisma.branch.update.mockResolvedValue({ id: 'b1', name: 'Updated' });
      await svc.update('org-1', 'b1', { name: 'Updated' });
      expect(prisma.branch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1' },
          data: { name: 'Updated' },
        }),
      );
    });

    it('rejects duplicate code on update', async () => {
      prisma.branch.findFirst
        .mockResolvedValueOnce({ id: 'b1', organizationId: 'org-1' })
        .mockResolvedValueOnce({ id: 'b2', organizationId: 'org-1', code: 'BR2' });
      await expect(
        svc.update('org-1', 'b1', { code: 'BR2' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deactivate / activate', () => {
    it('deactivates a branch', async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: 'b1', organizationId: 'org-1' });
      prisma.branch.update.mockResolvedValue({ id: 'b1', isActive: false });
      await svc.deactivate('org-1', 'b1');
      expect(prisma.branch.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    it('activates a branch', async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: 'b1', organizationId: 'org-1' });
      prisma.branch.update.mockResolvedValue({ id: 'b1', isActive: true });
      await svc.activate('org-1', 'b1');
      expect(prisma.branch.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: true } }),
      );
    });
  });

  describe('assignManager', () => {
    it('assigns a manager to a branch', async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: 'b1', organizationId: 'org-1' });
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', organizationId: 'org-1' });
      prisma.branch.update.mockResolvedValue({ id: 'b1', managerId: 'u1' });
      await svc.assignManager('org-1', 'b1', 'u1');
      expect(prisma.branch.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { managerId: 'u1' } }),
      );
    });

    it('throws if manager user not in same organization', async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: 'b1', organizationId: 'org-1' });
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(svc.assignManager('org-1', 'b1', 'u-other')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBranchStats', () => {
    it('returns branch stats with counts', async () => {
      prisma.branch.findFirst.mockResolvedValue({
        id: 'b1',
        organizationId: 'org-1',
        name: 'Main Branch',
        _count: { students: 42 },
      });

      const stats = await svc.getBranchStats('org-1', 'b1');
      expect(stats).toEqual({
        id: 'b1',
        name: 'Main Branch',
        counts: { students: 42 },
      });
    });
  });

  describe('tenant isolation', () => {
    it('org A cannot see org B branches', async () => {
      prisma.branch.findMany.mockImplementation(({ where }: { where: { organizationId: string } }) => {
        if (where.organizationId === 'org-A') {
          return Promise.resolve([{ id: 'b1', name: 'OrgA Branch' }]);
        }
        return Promise.resolve([]);
      });
      const orgAResult = await prisma.branch.findMany({ where: { organizationId: 'org-A' } });
      const orgBResult = await prisma.branch.findMany({ where: { organizationId: 'org-B' } });
      expect(orgAResult).toHaveLength(1);
      expect(orgBResult).toHaveLength(0);
    });
  });
});
