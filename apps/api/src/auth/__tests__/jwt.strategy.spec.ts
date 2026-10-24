import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from '../jwt.strategy';

function createMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
    },
  };
}

function createStrategy(prisma: ReturnType<typeof createMockPrisma>, env: Record<string, string | undefined> = {}) {
  const configService = {
    get: (key: string) => env[key],
  };
  return new JwtStrategy(configService as unknown as ConfigService, prisma as unknown as PrismaService);
}

describe('JwtStrategy', () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
  });

  it('returns sid from the token payload so logout can revoke the session', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
      isActive: true,
    });
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-123',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      userId: 'u1',
      organizationId: 'org-1',
    });

    const strategy = createStrategy(prisma);
    const result = await strategy.validate({
      sub: 'u1',
      email: 'a@b.com',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
      sid: 'session-123',
    });

    expect(result.sid).toBe('session-123');
  });

  it('serves repeated validations from in-memory cache to prevent DB connection pool exhaustion (DB-01)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
      isActive: true,
    });
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-cache-test',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      userId: 'u1',
      organizationId: 'org-1',
    });

    const strategy = createStrategy(prisma, { AUTH_VALIDATION_CACHE_TTL_MS: '15000' });
    const payload = {
      sub: 'u1',
      email: 'a@b.com',
      role: 'ORG_ADMIN' as const,
      organizationId: 'org-1',
      sid: 'session-cache-test',
    };

    // First call: hits DB
    const firstResult = await strategy.validate(payload);
    expect(firstResult.id).toBe('u1');
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.session.findUnique).toHaveBeenCalledTimes(1);

    // Second & third call: hits cache, 0 extra DB calls
    const secondResult = await strategy.validate(payload);
    const thirdResult = await strategy.validate(payload);
    expect(secondResult).toEqual(firstResult);
    expect(thirdResult).toEqual(firstResult);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.session.findUnique).toHaveBeenCalledTimes(1);

    // Invalidation clears cache and hits DB again
    strategy.clearCache();
    await strategy.validate(payload);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.session.findUnique).toHaveBeenCalledTimes(2);
  });

  it('rejects legacy tokens without a sid', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
      isActive: true,
    });

    const strategy = createStrategy(prisma);
    await expect(strategy.validate({
      sub: 'u1',
      email: 'a@b.com',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
    })).rejects.toThrow(UnauthorizedException);
  });

  it('rejects revoked sessions', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
      isActive: true,
    });
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-123',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      userId: 'u1',
      organizationId: 'org-1',
    });

    const strategy = createStrategy(prisma);
    await expect(
      strategy.validate({ sub: 'u1', email: 'a@b.com', role: 'ORG_ADMIN', organizationId: 'org-1', sid: 'session-123' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects inactive users', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
      isActive: false,
    });

    const strategy = createStrategy(prisma);
    await expect(strategy.validate({ sub: 'u1', email: 'a@b.com', role: 'ORG_ADMIN', organizationId: 'org-1' })).rejects.toThrow(UnauthorizedException);
  });
});
