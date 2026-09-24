import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiKeyGuard } from '../api-keys.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { ApiKeysService } from '../api-keys.service';
import * as bcrypt from 'bcryptjs';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let apiKeysService: {
    findCandidatesByKeyPrefix: ReturnType<typeof vi.fn>;
    incrementUsage: ReturnType<typeof vi.fn>;
  };
  let reflector: {
    getAllAndOverride: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiKeysService = {
      findCandidatesByKeyPrefix: vi.fn(),
      incrementUsage: vi.fn().mockResolvedValue(undefined),
    };
    reflector = {
      getAllAndOverride: vi.fn(),
    };
    guard = new ApiKeyGuard(
      apiKeysService as unknown as ApiKeysService,
      reflector as unknown as Reflector,
    );
  });

  function createMockContext(headers: Record<string, string> = {}) {
    const req: { headers: Record<string, string>; user?: Record<string, unknown> } = { headers };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('returns false if authorization header is missing', async () => {
    const ctx = createMockContext({});
    const result = await guard.canActivate(ctx);
    expect(result).toBe(false);
  });

  it('returns false if authorization header does not start with ApiKey', async () => {
    const ctx = createMockContext({ authorization: 'Bearer token123' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(false);
  });

  it('throws UnauthorizedException if no candidate matches keyPrefix', async () => {
    const ctx = createMockContext({ authorization: 'ApiKey medu_12345678_some_secret' });
    apiKeysService.findCandidatesByKeyPrefix.mockResolvedValue([]);

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException if bcrypt compare fails', async () => {
    const ctx = createMockContext({ authorization: 'ApiKey medu_12345678_some_secret' });
    apiKeysService.findCandidatesByKeyPrefix.mockResolvedValue([
      {
        id: 'k1',
        keyHash: await bcrypt.hash('different_secret', 4),
        isActive: true,
      },
    ]);

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException if key is inactive', async () => {
    const rawKey = 'medu_12345678_some_secret';
    const ctx = createMockContext({ authorization: `ApiKey ${rawKey}` });
    apiKeysService.findCandidatesByKeyPrefix.mockResolvedValue([
      {
        id: 'k1',
        keyHash: await bcrypt.hash(rawKey, 4),
        isActive: false,
      },
    ]);

    await expect(guard.canActivate(ctx)).rejects.toThrow('API key is revoked');
  });

  it('throws UnauthorizedException if key is expired', async () => {
    const rawKey = 'medu_12345678_some_secret';
    const ctx = createMockContext({ authorization: `ApiKey ${rawKey}` });
    apiKeysService.findCandidatesByKeyPrefix.mockResolvedValue([
      {
        id: 'k1',
        keyHash: await bcrypt.hash(rawKey, 4),
        isActive: true,
        expiresAt: new Date(Date.now() - 10000),
      },
    ]);

    await expect(guard.canActivate(ctx)).rejects.toThrow('API key has expired');
  });

  it('throws ForbiddenException if endpoint has no required scopes defined (fail-closed)', async () => {
    const rawKey = 'medu_12345678_some_secret';
    const ctx = createMockContext({ authorization: `ApiKey ${rawKey}` });
    apiKeysService.findCandidatesByKeyPrefix.mockResolvedValue([
      {
        id: 'k1',
        keyHash: await bcrypt.hash(rawKey, 4),
        isActive: true,
        expiresAt: null,
        scopes: ['students:read'],
      },
    ]);
    reflector.getAllAndOverride.mockReturnValue([]);

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'This endpoint does not accept API-key authentication',
    );
  });

  it('throws ForbiddenException if key lacks a required scope', async () => {
    const rawKey = 'medu_12345678_some_secret';
    const ctx = createMockContext({ authorization: `ApiKey ${rawKey}` });
    apiKeysService.findCandidatesByKeyPrefix.mockResolvedValue([
      {
        id: 'k1',
        keyHash: await bcrypt.hash(rawKey, 4),
        isActive: true,
        expiresAt: null,
        scopes: ['students:read'],
      },
    ]);
    reflector.getAllAndOverride.mockReturnValue(['students:read', 'payments:write']);

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'API key is missing required scopes: payments:write',
    );
  });

  it('authenticates valid key, increments usage, and attaches synthetic principal', async () => {
    const rawKey = 'medu_12345678_some_secret';
    const ctx = createMockContext({ authorization: `ApiKey ${rawKey}` });
    apiKeysService.findCandidatesByKeyPrefix.mockResolvedValue([
      {
        id: 'k1',
        keyHash: await bcrypt.hash(rawKey, 4),
        isActive: true,
        expiresAt: null,
        scopes: ['students:read', 'payments:write'],
        createdBy: 'user-admin',
        organizationId: 'org-1',
      },
    ]);
    reflector.getAllAndOverride.mockReturnValue(['students:read']);

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(apiKeysService.incrementUsage).toHaveBeenCalledWith('k1');

    const req = ctx.switchToHttp().getRequest();
    expect(req.user).toEqual({
      sub: 'user-admin',
      id: 'user-admin',
      organizationId: 'org-1',
      apiKeyId: 'k1',
      apiKeyScopes: ['students:read', 'payments:write'],
      isApiKey: true,
    });
  });
});
