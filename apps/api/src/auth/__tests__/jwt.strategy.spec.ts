import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
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

function createStrategy(prisma: any, env: Record<string, string | undefined> = {}) {
  const configService = {
    get: (key: string) => env[key],
  };
  return new JwtStrategy(configService as any, prisma);
}

describe('JwtStrategy', () => {
  let prisma: any;

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

  it('returns null sid for legacy tokens without one', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
      isActive: true,
    });

    const strategy = createStrategy(prisma);
    const result = await strategy.validate({
      sub: 'u1',
      email: 'a@b.com',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
    });

    expect(result.sid).toBeNull();
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
