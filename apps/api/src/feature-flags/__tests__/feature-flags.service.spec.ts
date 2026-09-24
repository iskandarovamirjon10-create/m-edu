import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { FeatureFlagsService } from '../feature-flags.service';
import type { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    featureFlag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe('FeatureFlagsService', () => {
  let svc: FeatureFlagsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new FeatureFlagsService(prisma as unknown as PrismaService);
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns flags applicable to organization or globally', async () => {
      prisma.featureFlag.findMany.mockResolvedValue([{ key: 'f1' }]);
      prisma.featureFlag.count.mockResolvedValue(1);

      const res = await svc.findAll('org-1');
      expect(prisma.featureFlag.findMany).toHaveBeenCalled();
      expect(res.total).toBe(1);
    });
  });

  describe('create', () => {
    it('creates new feature flag', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(null);
      prisma.featureFlag.create.mockResolvedValue({ key: 'new-flag', name: 'New Flag' });

      const res = await svc.create('org-1', {
        key: 'new-flag',
        name: 'New Flag',
        enabled: true,
      });

      expect(prisma.featureFlag.create).toHaveBeenCalled();
      expect(res.key).toBe('new-flag');
    });

    it('seeds rolloutOrganizations with the creating org only', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(null);
      prisma.featureFlag.create.mockResolvedValue({ key: 'scoped' });

      await svc.create('org-1', { key: 'scoped', name: 'Scoped' });

      expect(prisma.featureFlag.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rolloutOrganizations: ['org-1'] }),
        }),
      );
    });

    it('rejects empty key or name with BadRequestException', async () => {
      await expect(svc.create('org-1', { key: '   ', name: 'Name' })).rejects.toThrow(BadRequestException);
      await expect(svc.create('org-1', { key: 'key', name: '   ' })).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate key with ConflictException', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({ key: 'existing' });
      await expect(svc.create('org-1', { key: 'existing', name: 'Existing' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('updates flag when applies to org', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({
        key: 'my-flag',
        rolloutOrganizations: ['org-1'],
        enabled: false,
        value: null,
      });
      prisma.featureFlag.update.mockResolvedValue({ key: 'my-flag', enabled: true });

      const res = await svc.update('org-1', 'my-flag', { enabled: true });
      expect(prisma.featureFlag.update).toHaveBeenCalledWith({
        where: { key: 'my-flag' },
        data: expect.objectContaining({ enabled: true }),
      });
      expect(res.enabled).toBe(true);
    });

    it('throws NotFoundException if flag does not exist', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue(null);
      await expect(svc.update('org-1', 'missing', { enabled: true })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException if flag does not apply to tenant org', async () => {
      prisma.featureFlag.findUnique.mockResolvedValue({
        key: 'restricted',
        rolloutOrganizations: ['other-org'],
      });
      await expect(svc.update('org-1', 'restricted', { enabled: true })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
