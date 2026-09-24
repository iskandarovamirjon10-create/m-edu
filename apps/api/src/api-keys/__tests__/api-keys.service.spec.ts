import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeysService } from '../api-keys.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  apiKey: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
};

describe('ApiKeysService', () => {
  let service: ApiKeysService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);
    vi.clearAllMocks();
  });

  describe('generate', () => {
    it('should generate a new API key with hash', async () => {
      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'key-1',
        name: 'Test Key',
        keyPrefix: 'medu_abc12345',
        scopes: ['students:read'],
        isActive: true,
      });

      const result = await service.generate('org-1', {
        name: 'Test Key',
        scopes: ['students:read'],
      }, 'user-1');

      expect(result.key).toMatch(/^medu_/);
      expect(result.keyPrefix).toBe('medu_abc12345');
      expect(mockPrisma.apiKey.create).toHaveBeenCalled();
    });

    it('should reject invalid scopes', async () => {
      await expect(
        service.generate('org-1', {
          name: 'Bad Key',
          scopes: ['invalid:scope'],
        }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should support expiry and custom rate limit', async () => {
      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'key-2',
        name: 'Expiring Key',
        keyPrefix: 'medu_xyz99999',
        scopes: ['payments:read'],
        expiresAt: new Date('2026-12-31'),
        rateLimit: 500,
      });

      const result = await service.generate('org-1', {
        name: 'Expiring Key',
        scopes: ['payments:read'],
        expiresAt: '2026-12-31T00:00:00.000Z',
        rateLimit: 500,
      }, 'user-1');

      expect(result.expiresAt).toEqual(new Date('2026-12-31T00:00:00.000Z'));
      expect(mockPrisma.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rateLimit: 500 }),
        }),
      );
    });
  });

  describe('list', () => {
    it('should list keys for an organization', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([
        { id: 'k1', name: 'Key 1', keyPrefix: 'medu_a1b2' },
      ]);

      const result = await service.list('org-1');
      expect(result).toHaveLength(1);
      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1' } }),
      );
    });
  });

  describe('revoke', () => {
    it('should soft-deactivate a key', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue({ id: 'k1', organizationId: 'org-1' });
      mockPrisma.apiKey.update.mockResolvedValue({ id: 'k1', isActive: false });

      await service.revoke('org-1', 'k1');
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    it('should throw if key not found', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);
      await expect(service.revoke('org-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('rotate', () => {
    it('should revoke old key and generate new one', async () => {
      mockPrisma.apiKey.findFirst
        .mockResolvedValueOnce({ id: 'k1', name: 'Old', scopes: ['students:read'], rateLimit: 1000, expiresAt: null })
        .mockResolvedValueOnce(null);
      mockPrisma.apiKey.update.mockResolvedValue({ id: 'k1', isActive: false });
      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'k2', name: 'Old', keyPrefix: 'medu_newkey', scopes: ['students:read'],
      });

      const result = await service.rotate('org-1', 'k1', {}, 'user-1');
      expect(result.key).toMatch(/^medu_/);
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });
  });



  describe('incrementUsage', () => {
    it('should increment usage count and lastUsedAt', async () => {
      await service.incrementUsage('k1');
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'k1' },
          data: {
            usageCount: { increment: 1 },
            lastUsedAt: expect.any(Date),
          },
        }),
      );
    });
  });

  describe('getUsageStats', () => {
    it('should return stats for a single key', async () => {
      mockPrisma.apiKey.findFirst.mockReset();
      mockPrisma.apiKey.findFirst.mockResolvedValue({
        id: 'k1', name: 'Key', keyPrefix: 'medu_test', usageCount: 42, lastUsedAt: null, rateLimit: 1000, isActive: true, expiresAt: null, createdAt: new Date(),
      });
      const result = await service.getUsageStats('org-1', 'k1');
      expect(result.usageCount).toBe(42);
    });

    it('should return aggregate stats when no keyId', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([
        { id: 'k1', usageCount: 10, isActive: true },
        { id: 'k2', usageCount: 20, isActive: false },
      ]);
      const result = await service.getUsageStats('org-1');
      expect(result.totalUsage).toBe(30);
      expect(result.activeCount).toBe(1);
      expect(result.totalCount).toBe(2);
    });
  });

  describe('getScopes', () => {
    it('should return all available scopes', async () => {
      const scopes = await service.getScopes();
      expect(scopes).toContain('students:read');
      expect(scopes).toContain('payments:write');
      expect(scopes.length).toBeGreaterThan(0);
    });
  });

  describe('tenant isolation', () => {
    it('should scope list to organization', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([]);
      await service.list('org-A');
      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-A' } }),
      );
    });

    it('should scope revoke to organization', async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);
      await expect(service.revoke('org-A', 'key-from-org-B')).rejects.toThrow(NotFoundException);
    });
  });
});
