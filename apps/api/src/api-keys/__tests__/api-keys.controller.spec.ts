import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { ApiKeysController } from '../api-keys.controller';
import { ApiKeysService } from '../api-keys.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { CreateApiKeyDto, RotateApiKeyDto } from '../dto/api-key.dto';

describe('ApiKeysController', () => {
  let controller: ApiKeysController;
  let service: {
    getScopes: ReturnType<typeof vi.fn>;
    getUsageStats: ReturnType<typeof vi.fn>;
    generate: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    rotate: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-test-123';
  const userId = 'user-test-456';

  beforeEach(async () => {
    service = {
      getScopes: vi.fn(),
      getUsageStats: vi.fn(),
      generate: vi.fn(),
      list: vi.fn(),
      rotate: vi.fn(),
      revoke: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeysController],
      providers: [
        {
          provide: ApiKeysService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<ApiKeysController>(ApiKeysController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('scopes', () => {
    it('delegates to apiKeysService.getScopes', async () => {
      const mockScopes = ['students:read', 'students:write', 'payments:read'];
      service.getScopes.mockResolvedValue(mockScopes);

      const result = await controller.scopes();

      expect(result).toEqual(mockScopes);
      expect(service.getScopes).toHaveBeenCalledTimes(1);
    });

    it('propagates service errors when getting scopes fails', async () => {
      service.getScopes.mockRejectedValue(new Error('Scopes fetch failed'));

      await expect(controller.scopes()).rejects.toThrow('Scopes fetch failed');
    });
  });

  describe('usageStats', () => {
    it('delegates to apiKeysService.getUsageStats with orgId and specific keyId', async () => {
      const keyId = 'key-789';
      const mockStat = {
        id: keyId,
        name: 'Integration Key',
        keyPrefix: 'medu_abc12345',
        usageCount: 42,
        lastUsedAt: new Date('2026-09-01'),
        rateLimit: 1000,
        isActive: true,
        expiresAt: null,
        createdAt: new Date('2026-01-01'),
      };
      service.getUsageStats.mockResolvedValue(mockStat);

      const result = await controller.usageStats(orgId, keyId);

      expect(result).toEqual(mockStat);
      expect(service.getUsageStats).toHaveBeenCalledWith(orgId, keyId);
    });

    it('delegates to apiKeysService.getUsageStats with undefined keyId for org summary', async () => {
      const mockSummary = {
        keys: [],
        totalUsage: 120,
        activeCount: 3,
        totalCount: 4,
      };
      service.getUsageStats.mockResolvedValue(mockSummary);

      const result = await controller.usageStats(orgId, undefined);

      expect(result).toEqual(mockSummary);
      expect(service.getUsageStats).toHaveBeenCalledWith(orgId, undefined);
    });

    it('propagates service errors (e.g. key not found)', async () => {
      service.getUsageStats.mockRejectedValue(new Error('API key not found'));

      await expect(controller.usageStats(orgId, 'missing-key')).rejects.toThrow('API key not found');
    });
  });

  describe('create', () => {
    const dto: CreateApiKeyDto = {
      name: 'Mobile App Key',
      scopes: ['students:read', 'attendance:read'],
      expiresAt: '2026-12-31T23:59:59.999Z',
      rateLimit: 500,
    };

    it('delegates to apiKeysService.generate with orgId, dto, and userId', async () => {
      const mockCreatedKey = {
        id: 'new-key-id',
        organizationId: orgId,
        name: dto.name,
        keyPrefix: 'medu_a1b2c3d4',
        key: 'medu_a1b2c3d4e5f6',
        scopes: dto.scopes,
        rateLimit: dto.rateLimit,
        expiresAt: new Date(dto.expiresAt!),
        createdBy: userId,
      };
      service.generate.mockResolvedValue(mockCreatedKey);

      const result = await controller.create(orgId, userId, dto);

      expect(result).toEqual(mockCreatedKey);
      expect(service.generate).toHaveBeenCalledWith(orgId, dto, userId);
    });

    it('propagates service errors (e.g. invalid scopes)', async () => {
      service.generate.mockRejectedValue(new Error('Invalid scopes: unsupported:scope'));

      await expect(controller.create(orgId, userId, dto)).rejects.toThrow(
        'Invalid scopes: unsupported:scope',
      );
    });
  });

  describe('list', () => {
    it('delegates to apiKeysService.list with orgId', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          name: 'Primary Key',
          keyPrefix: 'medu_1111',
          scopes: ['students:read'],
          isActive: true,
          lastUsedAt: null,
          expiresAt: null,
          rateLimit: 1000,
          usageCount: 10,
          createdBy: userId,
          createdAt: new Date(),
        },
      ];
      service.list.mockResolvedValue(mockKeys);

      const result = await controller.list(orgId);

      expect(result).toEqual(mockKeys);
      expect(service.list).toHaveBeenCalledWith(orgId);
    });

    it('propagates service errors', async () => {
      service.list.mockRejectedValue(new Error('Database error'));

      await expect(controller.list(orgId)).rejects.toThrow('Database error');
    });
  });

  describe('rotate', () => {
    const keyId = 'key-to-rotate';
    const dto: RotateApiKeyDto = {
      name: 'Rotated Key',
      scopes: ['students:read', 'students:write'],
      rateLimit: 2000,
    };

    it('delegates to apiKeysService.rotate with orgId, id, dto, and userId', async () => {
      const mockRotatedKey = {
        id: 'new-key-after-rotation',
        organizationId: orgId,
        name: dto.name,
        keyPrefix: 'medu_rot12345',
        key: 'medu_rot1234567890abcdef',
        scopes: dto.scopes,
        rateLimit: dto.rateLimit,
        createdBy: userId,
      };
      service.rotate.mockResolvedValue(mockRotatedKey);

      const result = await controller.rotate(orgId, userId, keyId, dto);

      expect(result).toEqual(mockRotatedKey);
      expect(service.rotate).toHaveBeenCalledWith(orgId, keyId, dto, userId);
    });

    it('propagates service errors (e.g. key not found)', async () => {
      service.rotate.mockRejectedValue(new Error('API key not found'));

      await expect(controller.rotate(orgId, userId, keyId, dto)).rejects.toThrow('API key not found');
    });
  });

  describe('revoke', () => {
    const keyId = 'key-to-revoke';

    it('delegates to apiKeysService.revoke with orgId and keyId', async () => {
      const mockRevoked = {
        id: keyId,
        organizationId: orgId,
        isActive: false,
      };
      service.revoke.mockResolvedValue(mockRevoked);

      const result = await controller.revoke(orgId, keyId);

      expect(result).toBeUndefined();
      expect(service.revoke).toHaveBeenCalledWith(orgId, keyId);
    });

    it('propagates service errors (e.g. key not found)', async () => {
      service.revoke.mockRejectedValue(new Error('API key not found'));

      await expect(controller.revoke(orgId, keyId)).rejects.toThrow('API key not found');
    });
  });

  describe('Guard and decorator verification (structural)', () => {
    it('has UseGuards decorator applied at the class level with JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', ApiKeysController);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(guards.length).toBeGreaterThanOrEqual(2);
    });

    it('has Roles decorator restricting access to SUPER_ADMIN and ORG_ADMIN', () => {
      const roles = Reflect.getMetadata('roles', ApiKeysController);
      expect(roles).toBeDefined();
      expect(roles).toContain(Role.SUPER_ADMIN);
      expect(roles).toContain(Role.ORG_ADMIN);
      expect(roles).not.toContain(Role.TEACHER);
      expect(roles).not.toContain(Role.STUDENT);
      expect(roles).not.toContain(Role.PARENT);
    });
  });
});
