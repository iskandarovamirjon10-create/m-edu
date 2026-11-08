import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../auth.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

function createMockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    organization: { create: vi.fn() },
    session: {
      create: vi.fn().mockResolvedValue({
        id: 'session-mock',
        userId: 'u1',
        organizationId: 'org-1',
        expiresAt: new Date(),
      }),
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([]),
    },
    // Default interactive-transaction stub: mirrors the real transaction client
    // shape used by AuthService (advisory lock + organization/user writes).
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        $executeRaw: vi.fn().mockResolvedValue(undefined),
        user: overrides.user ?? { create: vi.fn(), count: vi.fn(), update: vi.fn() },
        organization: { create: vi.fn().mockResolvedValue({ id: 'org-new', name: 'X' }) },
      }),
    ),
    authorizationCode: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    passwordResetToken: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  };
}

const mockJwt = {
  sign: vi.fn((payload: Record<string, unknown>) => `signed.${payload.sub}.token`),
  decode: vi.fn((token: string) => {
    // Test tokens are written as `jwt:<sid>` so the spec can assert the
    // session binding without a real signing key.
    if (typeof token === 'string' && token.startsWith('jwt:')) {
      return { sid: token.slice(4) };
    }
    return null;
  }),
} as unknown as JwtService;

describe('AuthService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
  });

  describe('login', () => {
    it('returns token + user for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('secret123', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
        isActive: true,
        firstName: 'Ali',
        lastName: 'Valiyev',
        role: 'ORG_ADMIN',
        organizationId: 'org-1',
        organization: { id: 'org-1' },
      });
      prisma.user.update.mockResolvedValue({});

      const svc = new AuthService(prisma, mockJwt);
      const result = await svc.login('a@b.com', 'secret123');
      expect(result.accessToken).toBeTruthy();
      // Email is globally unique: resolve through the unique index.
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'a@b.com' } }),
      );
      expect(result.user.email).toBe('a@b.com');
      // Local login must create a revocable session record (sid in JWT)
      expect(prisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u1', organizationId: 'org-1' }),
        }),
      );
    });

    it('rejects wrong password', async () => {
      const passwordHash = await bcrypt.hash('secret123', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
        isActive: true,
        role: 'ORG_ADMIN',
        organizationId: 'org-1',
      });

      const svc = new AuthService(prisma, mockJwt);
      await expect(svc.login('a@b.com', 'wrong-pass')).rejects.toThrow();
    });

    it('rejects google-only accounts for password login with generic error', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        email: 'g@b.com',
        passwordHash: null,
        isActive: true,
        role: 'ORG_ADMIN',
        organizationId: 'org-1',
      });
      const svc = new AuthService(prisma, mockJwt);
      await expect(svc.login('g@b.com', 'anything')).rejects.toThrow('Invalid credentials');
    });

    it('rejects a deactivated account with the same generic error', async () => {
      const passwordHash = await bcrypt.hash('secret123', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u3',
        email: 'off@b.com',
        passwordHash,
        isActive: false,
        role: 'TEACHER',
        organizationId: 'org-1',
      });

      const svc = new AuthService(prisma, mockJwt);
      await expect(svc.login('off@b.com', 'secret123')).rejects.toThrow('Invalid credentials');
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('normalizes email (trim + lowercase) before lookup', async () => {
      const passwordHash = await bcrypt.hash('secret123', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
        isActive: true,
        firstName: 'Ali',
        lastName: 'Valiyev',
        role: 'ORG_ADMIN',
        organizationId: 'org-1',
        organization: { id: 'org-1' },
      });
      prisma.user.update.mockResolvedValue({});

      const svc = new AuthService(prisma, mockJwt);
      await svc.login('  A@B.com  ', 'secret123');
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'a@b.com' } }),
      );
    });
  });

  describe('register (OWNER_ONLY enforced)', () => {
    it('rejects public registration unconditionally', async () => {
      const svc = new AuthService(prisma, mockJwt);
      await expect(
        svc.register({
          email: 'new@b.com',
          password: 'password123',
          firstName: 'Bob',
          lastName: 'Smith',
          organizationName: 'Test Center',
        }),
      ).rejects.toThrow('Public registration is disabled. Accounts can only be provisioned by the Platform Owner.');
    });

    it('rejects public registration even for duplicate email attempt', async () => {
      const svc = new AuthService(prisma, mockJwt);
      await expect(
        svc.register({
          email: 'dup@b.com',
          password: 'password123',
          firstName: 'A',
          lastName: 'B',
          organizationName: 'X',
        }),
      ).rejects.toThrow('Public registration is disabled. Accounts can only be provisioned by the Platform Owner.');
    });

    it('rejects registration attempt even when invite codes or config exist', async () => {
      prisma.accessControlConfig = {
        findUnique: vi.fn().mockResolvedValue({ id: 'global', inviteOnly: true, requireApproval: true }),
      };
      const svc = new AuthService(prisma, mockJwt);

      await expect(
        svc.register({
          email: 'attacker@evil.com',
          password: 'password123',
          firstName: 'Rogue',
          lastName: 'Admin',
          organizationName: 'Rogue Org',
        }),
      ).rejects.toThrow('Public registration is disabled. Accounts can only be provisioned by the Platform Owner.');
    });

    it('rejects registration attempt even when email is in whitelist', async () => {
      prisma.accessWhitelist = {
        findUnique: vi.fn().mockResolvedValue({ email: 'whitelisted@school.edu' }),
      };
      const svc = new AuthService(prisma, mockJwt);

      await expect(
        svc.register({
          email: 'whitelisted@school.edu',
          password: 'password123',
          firstName: 'White',
          lastName: 'Listed',
          organizationName: 'White Org',
        }),
      ).rejects.toThrow('Public registration is disabled. Accounts can only be provisioned by the Platform Owner.');
    });
  });

  describe('session revocation (P0)', () => {
    it('logout revokes only the current session for the user', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 1 });
      const svc = new AuthService(prisma, mockJwt);
      await svc.logout('session-1', 'u1');
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', userId: 'u1', revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date), revokedReason: 'user_logout' }),
      });
    });

    it('logoutAll revokes all active sessions for the user', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 3 });
      const svc = new AuthService(prisma, mockJwt);
      await svc.logoutAll('u1', 'security');
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date), revokedReason: 'security' }),
      });
    });

    it('login embeds sid (session id) in the JWT payload', async () => {
      const passwordHash = await bcrypt.hash('secret123', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
        isActive: true,
        firstName: 'Ali',
        lastName: 'Valiyev',
        role: 'ORG_ADMIN',
        organizationId: 'org-1',
        organization: { id: 'org-1' },
      });
      prisma.user.update.mockResolvedValue({});
      prisma.session.create.mockResolvedValue({ id: 'session-9' });

      const svc = new AuthService(prisma, mockJwt);
      const result = await svc.login('a@b.com', 'secret123');
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'u1', sid: 'session-9', organizationId: 'org-1' }),
      );
      expect(result.accessToken).toBeTruthy();
    });
  });

  describe('OAuth state + auth code (P0 CSRF / token-in-URL)', () => {
    let svc: AuthService;
    beforeEach(() => {
      svc = new AuthService(prisma, mockJwt);
    });

    const activeUser = {
      id: 'u1',
      email: 'u1@medu.dev',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
      isActive: true,
    };

    function codeRow(overrides: Record<string, unknown> = {}) {
      return {
        id: 'ac-1',
        code: 'test-code',
        accessToken: null,
        sessionId: null,
        userId: 'u1',
        expiresAt: new Date(Date.now() + 300000),
        usedAt: null,
        createdAt: new Date(),
        ...overrides,
      };
    }

    it('binds the code to the session id instead of storing the JWT', async () => {
      prisma.authorizationCode.create.mockResolvedValue(codeRow());
      await svc.generateAuthCode('jwt:sess-1', 'u1');
      expect(prisma.authorizationCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u1', sessionId: 'sess-1' }),
      });
      const data = prisma.authorizationCode.create.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('accessToken');
    });

    it('re-signs a live session on exchange', async () => {
      prisma.authorizationCode.findUnique.mockResolvedValue(codeRow({ sessionId: 'sess-1' }));
      prisma.authorizationCode.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 600000),
      });

      const token = await svc.exchangeAuthCode('test-code');
      expect(token).toBe('signed.u1.token');
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'u1', sid: 'sess-1' }),
      );
      expect(prisma.authorizationCode.updateMany).toHaveBeenCalledWith({
        where: { id: 'ac-1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('auth code exchange is single-use (second redeem loses the atomic claim)', async () => {
      prisma.authorizationCode.findUnique.mockResolvedValue(codeRow({ accessToken: 'jwt-token' }));
      prisma.authorizationCode.updateMany.mockResolvedValue({ count: 0 });

      await expect(svc.exchangeAuthCode('test-code')).rejects.toThrow(/already been used/);
    });

    it('rejects an already-redeemed code before it can claim it again', async () => {
      prisma.authorizationCode.findUnique.mockResolvedValue(
        codeRow({ usedAt: new Date(Date.now() - 1000) }),
      );
      await expect(svc.exchangeAuthCode('test-code')).rejects.toThrow(/already been used/);
      expect(prisma.authorizationCode.updateMany).not.toHaveBeenCalled();
    });

    it('refuses to mint a session for a deactivated account', async () => {
      prisma.authorizationCode.findUnique.mockResolvedValue(codeRow({ sessionId: 'sess-1' }));
      prisma.authorizationCode.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue({ ...activeUser, isActive: false });

      await expect(svc.exchangeAuthCode('test-code')).rejects.toThrow(/deactivated/);
      expect(mockJwt.sign).not.toHaveBeenCalled();
    });

    it('refuses when the bound session was revoked or expired', async () => {
      prisma.authorizationCode.findUnique.mockResolvedValue(codeRow({ sessionId: 'sess-1' }));
      prisma.authorizationCode.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
      });

      await expect(svc.exchangeAuthCode('test-code')).rejects.toThrow(/no longer valid/);
      expect(mockJwt.sign).not.toHaveBeenCalled();
    });

    it('still redeems legacy rows that carry their pre-session token', async () => {
      prisma.authorizationCode.findUnique.mockResolvedValue(
        codeRow({ accessToken: 'legacy-jwt' }),
      );
      prisma.authorizationCode.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue(activeUser);

      await expect(svc.exchangeAuthCode('test-code')).resolves.toBe('legacy-jwt');
      expect(mockJwt.sign).not.toHaveBeenCalled();
    });

    it('auth code does not contain the JWT', async () => {
      prisma.authorizationCode.create.mockResolvedValue(codeRow({ code: 'super-secret-code' }));
      const code = await svc.generateAuthCode('super-secret-jwt', 'u1');
      expect(code).not.toContain('secret');
      expect(code).not.toContain('jwt');
    });

    it('stores state nonce when provided during auth code generation', async () => {
      prisma.authorizationCode.create.mockResolvedValue(codeRow());
      await svc.generateAuthCode('jwt:sess-1', 'u1', 'state-nonce-abc');
      expect(prisma.authorizationCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ state: 'state-nonce-abc' }),
      });
    });

    it('successfully redeems code when matching state is provided', async () => {
      prisma.authorizationCode.findUnique.mockResolvedValue(
        codeRow({ sessionId: 'sess-1', state: 'expected-state-nonce' }),
      );
      prisma.authorizationCode.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue(activeUser);
      prisma.session.findUnique.mockResolvedValue({
        id: 'sess-1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 600000),
      });

      const token = await svc.exchangeAuthCode('test-code', 'expected-state-nonce');
      expect(token).toBe('signed.u1.token');
    });

    it('rejects exchange when state is required but not provided', async () => {
      prisma.authorizationCode.findUnique.mockResolvedValue(
        codeRow({ sessionId: 'sess-1', state: 'expected-state-nonce' }),
      );
      await expect(svc.exchangeAuthCode('test-code')).rejects.toThrow(/OAuth exchange state is required/);
    });

    it('rejects exchange when state does not match', async () => {
      prisma.authorizationCode.findUnique.mockResolvedValue(
        codeRow({ sessionId: 'sess-1', state: 'expected-state-nonce' }),
      );
      await expect(svc.exchangeAuthCode('test-code', 'attacker-state')).rejects.toThrow(
        /Invalid or expired OAuth exchange state/,
      );
    });
  });

  describe('expired session purge', () => {
    it('deletes DB sessions whose expiresAt is in the past', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 7 });
      prisma.authorizationCode.deleteMany.mockResolvedValue({ count: 0 });
      const svc = new AuthService(prisma as unknown as PrismaService, mockJwt);
      await (svc as unknown as { cleanupExpiredEntries: () => Promise<void> }).cleanupExpiredEntries();
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });

    it('does not throw when the DB purge fails', async () => {
      prisma.session.deleteMany.mockRejectedValue(new Error('db down'));
      prisma.authorizationCode.deleteMany.mockResolvedValue({ count: 0 });
      const svc = new AuthService(prisma as unknown as PrismaService, mockJwt);
      await expect((svc as unknown as { cleanupExpiredEntries: () => Promise<void> }).cleanupExpiredEntries()).resolves.toBeUndefined();
    });

    it('skips cleanup when another replica holds the distributed lock (DB-04)', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 5 });
      const mockRedis = {
        setIfNotExists: vi.fn().mockResolvedValue(false),
      };
      const svc = new AuthService(
        prisma as unknown as PrismaService,
        mockJwt,
        undefined,
        mockRedis as never,
      );
      await (svc as unknown as { cleanupExpiredEntries: () => Promise<void> }).cleanupExpiredEntries();
      expect(mockRedis.setIfNotExists).toHaveBeenCalledWith(
        'auth:session:cleanup:lock',
        'locked',
        expect.any(Number),
      );
      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });

    it('honors SESSION_RETENTION_HOURS as a purge grace period', async () => {
      const prev = process.env.SESSION_RETENTION_HOURS;
      process.env.SESSION_RETENTION_HOURS = '24';
      try {
        prisma.session.deleteMany.mockResolvedValue({ count: 0 });
        prisma.authorizationCode.deleteMany.mockResolvedValue({ count: 0 });
        const svc = new AuthService(prisma as unknown as PrismaService, mockJwt);
        await (svc as unknown as { cleanupExpiredEntries: () => Promise<void> }).cleanupExpiredEntries();
        const where = prisma.session.deleteMany.mock.calls[0][0].where;
        // cutoff = now - 24h; only sessions expired more than 24h ago are purged
        const cutoff = where.expiresAt.lt as Date;
        expect(Date.now() - cutoff.getTime()).toBeGreaterThan(23.9 * 3600 * 1000);
        expect(Date.now() - cutoff.getTime()).toBeLessThan(24.1 * 3600 * 1000);
      } finally {
        if (prev === undefined) delete process.env.SESSION_RETENTION_HOURS;
        else process.env.SESSION_RETENTION_HOURS = prev;
      }
    });
  });
});

  describe('bootstrap (first SUPER_ADMIN provisioning, P3)', () => {
    let prisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      vi.clearAllMocks();
      prisma = createMockPrisma();
    });

    beforeEach(() => {
      process.env.PLATFORM_BOOTSTRAP_SECRET = 'test-bootstrap-secret-long-enough-32';
    });

    afterEach(() => {
      delete process.env.PLATFORM_BOOTSTRAP_SECRET;
    });

    it('rejects bootstrap when PLATFORM_BOOTSTRAP_SECRET is not configured on server (fail-closed)', async () => {
      delete process.env.PLATFORM_BOOTSTRAP_SECRET;
      prisma.user.count.mockResolvedValue(0);
      const svc = new AuthService(prisma as unknown as PrismaService, mockJwt);
      await expect(
        svc.bootstrap({
          email: 'platform@medu.test',
          password: 'S3cure-Bootstrap-123!',
          firstName: 'Platform',
          lastName: 'Admin',
          organizationName: 'M-EDU Platform',
          inviteCode: 'some-secret',
        }),
      ).rejects.toThrow('Bootstrap is disabled: PLATFORM_BOOTSTRAP_SECRET is not configured on the server');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.organization.create).not.toHaveBeenCalled();
    });

    it('rejects bootstrap when secret is missing from request', async () => {
      prisma.user.count.mockResolvedValue(0);
      const svc = new AuthService(prisma as unknown as PrismaService, mockJwt);
      await expect(
        svc.bootstrap({
          email: 'platform@medu.test',
          password: 'S3cure-Bootstrap-123!',
          firstName: 'Platform',
          lastName: 'Admin',
          organizationName: 'M-EDU Platform',
        }),
      ).rejects.toThrow('Bootstrap secret is required');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.organization.create).not.toHaveBeenCalled();
    });

    it('rejects bootstrap when secret is incorrect', async () => {
      prisma.user.count.mockResolvedValue(0);
      const svc = new AuthService(prisma as unknown as PrismaService, mockJwt);
      await expect(
        svc.bootstrap({
          email: 'platform@medu.test',
          password: 'S3cure-Bootstrap-123!',
          firstName: 'Platform',
          lastName: 'Admin',
          organizationName: 'M-EDU Platform',
          inviteCode: 'wrong-secret-value-1234',
        }),
      ).rejects.toThrow('Invalid bootstrap secret');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.organization.create).not.toHaveBeenCalled();
    });

    it('creates the platform SUPER_ADMIN + organization and returns a token', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: vi.fn().mockResolvedValue(undefined),
          user: {
            count: vi.fn().mockResolvedValue(0),
            create: vi.fn().mockResolvedValue({
              id: 'u-super',
              email: 'platform@medu.test',
              firstName: 'Platform',
              lastName: 'Admin',
              role: 'SUPER_ADMIN',
              organizationId: 'org-super',
              organization: { id: 'org-super' },
            }),
          },
          organization: { create: vi.fn().mockResolvedValue({ id: 'org-super' }) },
        };
        return fn(tx);
      });

      const svc = new AuthService(prisma as unknown as PrismaService, mockJwt);
      const result = await svc.bootstrap({
        email: 'platform@medu.test',
        password: 'S3cure-Bootstrap-123!',
        firstName: 'Platform',
        lastName: 'Admin',
        organizationName: 'M-EDU Platform',
        inviteCode: 'test-bootstrap-secret-long-enough-32',
      });
      expect(result.user.role).toBe('SUPER_ADMIN');
      expect(result.accessToken).toBeTruthy();
      expect(prisma.session.create).toHaveBeenCalled();
    });

    it('rejects bootstrap once a SUPER_ADMIN already exists (one-time only)', async () => {
      prisma.user.count.mockResolvedValue(1);
      const svc = new AuthService(prisma as unknown as PrismaService, mockJwt);
      await expect(
        svc.bootstrap({
          email: 'second@medu.test',
          password: 'S3cure-Bootstrap-123!',
          firstName: 'A',
          lastName: 'B',
          organizationName: 'X',
          inviteCode: 'test-bootstrap-secret-long-enough-32',
        }),
      ).rejects.toThrow('Platform is already bootstrapped');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an email that is already registered', async () => {
      prisma.user.count.mockResolvedValue(0);
      // Email uniqueness is enforced by the database inside the bootstrap
      // transaction; the service translates P2002 into a clear conflict.
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: vi.fn().mockResolvedValue(undefined),
          user: {
            count: vi.fn().mockResolvedValue(0),
            create: vi.fn().mockRejectedValue(
              Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
            ),
          },
          organization: { create: vi.fn().mockResolvedValue({ id: 'org-1' }) },
        };
        return fn(tx);
      });
      const svc = new AuthService(prisma as unknown as PrismaService, mockJwt);
      await expect(
        svc.bootstrap({
          email: 'dup@medu.test',
          password: 'S3cure-Bootstrap-123!',
          firstName: 'A',
          lastName: 'B',
          organizationName: 'X',
          inviteCode: 'test-bootstrap-secret-long-enough-32',
        }),
      ).rejects.toThrow('Email already registered');
      // The conflict is detected inside the serialized transaction (advisory lock).
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('serializes concurrent first-bootstraps with an advisory lock + recheck', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findFirst.mockResolvedValue(null);
      const txExecuteRaw = vi.fn().mockResolvedValue(undefined);
      const txCount = vi.fn().mockResolvedValue(1); // second txn sees a SUPER_ADMIN
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: txExecuteRaw,
          user: { count: txCount, create: vi.fn() },
          organization: { create: vi.fn() },
        };
        return fn(tx);
      });

      const svc = new AuthService(prisma, mockJwt);
      await expect(
        svc.bootstrap({
          email: 'race@medu.test',
          password: 'S3cure-Bootstrap-123!',
          firstName: 'A',
          lastName: 'B',
          organizationName: 'X',
          inviteCode: 'test-bootstrap-secret-long-enough-32',
        }),
      ).rejects.toThrow('Platform is already bootstrapped');
      expect(txExecuteRaw).toHaveBeenCalled();
      expect(txCount).toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    let prisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      vi.clearAllMocks();
      prisma = createMockPrisma();
    });

    it('returns parent profile when role is PARENT', async () => {
      (prisma as any).parentAccount = {
        findUnique: vi.fn().mockResolvedValue({
          id: 'p-1',
          email: 'parent@example.com',
          firstName: 'Dilshod',
          lastName: 'Rahimov',
          phone: '+998901234567',
          isActive: true,
          organizationId: 'org-1',
          lastLoginAt: new Date(),
          organization: { id: 'org-1', name: 'Center A' },
        }),
      };

      const svc = new AuthService(prisma as unknown as PrismaService, mockJwt);
      const profile = await svc.getMe('p-1', 'PARENT');
      expect(profile.role).toBe('PARENT');
      expect(profile.id).toBe('p-1');
      expect(profile.email).toBe('parent@example.com');
      expect(profile.organization?.name).toBe('Center A');
    });

    it('falls back to parentAccount when user is not found and returns parent profile', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (prisma as any).parentAccount = {
        findUnique: vi.fn().mockResolvedValue({
          id: 'p-1',
          email: 'parent@example.com',
          firstName: 'Dilshod',
          lastName: 'Rahimov',
          phone: '+998901234567',
          isActive: true,
          organizationId: 'org-1',
          lastLoginAt: new Date(),
          organization: { id: 'org-1', name: 'Center A' },
        }),
      };

      const svc = new AuthService(prisma as unknown as PrismaService, mockJwt);
      const profile = await svc.getMe('p-1');
      expect(profile.role).toBe('PARENT');
      expect(profile.id).toBe('p-1');
    });

    it('throws UnauthorizedException when neither user nor parent is found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (prisma as any).parentAccount = {
        findUnique: vi.fn().mockResolvedValue(null),
      };

      const svc = new AuthService(prisma as unknown as PrismaService, mockJwt);
      await expect(svc.getMe('nonexistent')).rejects.toThrow('User not found');
    });
  });
