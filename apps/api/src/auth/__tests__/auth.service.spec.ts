import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../auth.service';
import * as bcrypt from 'bcryptjs';

function createMockPrisma(overrides: Record<string, any> = {}) {
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
      updateMany: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn((fn: any) => fn({ user: overrides.user ?? {}, organization: { create: vi.fn() } })),
    authorizationCode: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  };
}

const mockJwt: any = {
  sign: vi.fn((payload: any) => `signed.${payload.sub}.token`),
};

describe('AuthService', () => {
  let prisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
  });

  describe('login', () => {
    it('returns token + user for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('secret123', 4);
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
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
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
        role: 'ORG_ADMIN',
        organizationId: 'org-1',
      });

      const svc = new AuthService(prisma, mockJwt);
      await expect(svc.login('a@b.com', 'wrong-pass')).rejects.toThrow();
    });

    it('rejects google-only accounts for password login with generic error', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u2',
        email: 'g@b.com',
        passwordHash: null,
        role: 'ORG_ADMIN',
        organizationId: 'org-1',
      });
      const svc = new AuthService(prisma, mockJwt);
      await expect(svc.login('g@b.com', 'anything')).rejects.toThrow('Invalid credentials');
    });
  });

  describe('register', () => {
    it('creates organization + user and returns token', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          organization: { create: vi.fn().mockResolvedValue({ id: 'org-new' }) },
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'u-new',
              email: 'new@b.com',
              firstName: 'Bob',
              lastName: 'Smith',
              role: 'ORG_ADMIN',
              organizationId: 'org-new',
              organization: { id: 'org-new' },
            }),
          },
        };
        return fn(tx);
      });

      const svc = new AuthService(prisma, mockJwt);
      const result = await svc.register({
        email: 'new@b.com',
        password: 'password123',
        firstName: 'Bob',
        lastName: 'Smith',
        organizationName: 'Test Center',
      });
      expect(result.user.role).toBe('ORG_ADMIN');
      expect(result.accessToken).toBeTruthy();
      // Registration must also create a revocable session record
      expect(prisma.session.create).toHaveBeenCalled();
    });

    it('rejects duplicate email', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'existing', email: 'dup@b.com' });
      const svc = new AuthService(prisma, mockJwt);
      await expect(
        svc.register({
          email: 'dup@b.com',
          password: 'password123',
          firstName: 'A',
          lastName: 'B',
          organizationName: 'X',
        }),
      ).rejects.toThrow(/already registered/);
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
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash,
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

    it('auth code exchange is single-use', async () => {
      prisma.authorizationCode.create.mockResolvedValue({ id: 'ac-1', code: 'test-code', accessToken: 'jwt-token', userId: 'u1', expiresAt: new Date(Date.now() + 300000), usedAt: null, createdAt: new Date() });
      prisma.authorizationCode.findUnique.mockResolvedValue({ id: 'ac-1', code: 'test-code', accessToken: 'jwt-token', userId: 'u1', expiresAt: new Date(Date.now() + 300000), usedAt: null, createdAt: new Date() });
      prisma.authorizationCode.update.mockResolvedValue({});

      const code = await svc.generateAuthCode('jwt-token', 'u1');
      const token = await svc.exchangeAuthCode(code);
      expect(token).toBe('jwt-token');

      prisma.authorizationCode.findUnique.mockResolvedValue({ id: 'ac-1', code: 'test-code', accessToken: 'jwt-token', userId: 'u1', expiresAt: new Date(Date.now() + 300000), usedAt: new Date(), createdAt: new Date() });
      await expect(svc.exchangeAuthCode(code)).rejects.toThrow(/already been used/);
    });

    it('auth code does not contain the JWT', async () => {
      prisma.authorizationCode.create.mockResolvedValue({ id: 'ac-2', code: 'super-secret-code', accessToken: 'super-secret-jwt', userId: 'u1', expiresAt: new Date(Date.now() + 300000), usedAt: null, createdAt: new Date() });
      const code = await svc.generateAuthCode('super-secret-jwt', 'u1');
      expect(code).not.toContain('secret');
      expect(code).not.toContain('jwt');
    });
  });

  describe('expired session purge', () => {
    it('deletes DB sessions whose expiresAt is in the past', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 7 });
      prisma.authorizationCode.deleteMany.mockResolvedValue({ count: 0 });
      const svc = new AuthService(prisma, mockJwt);
      await (svc as any).cleanupExpiredEntries();
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });

    it('does not throw when the DB purge fails', async () => {
      prisma.session.deleteMany.mockRejectedValue(new Error('db down'));
      prisma.authorizationCode.deleteMany.mockResolvedValue({ count: 0 });
      const svc = new AuthService(prisma, mockJwt);
      await expect((svc as any).cleanupExpiredEntries()).resolves.toBeUndefined();
    });

    it('honors SESSION_RETENTION_HOURS as a purge grace period', async () => {
      const prev = process.env.SESSION_RETENTION_HOURS;
      process.env.SESSION_RETENTION_HOURS = '24';
      try {
        prisma.session.deleteMany.mockResolvedValue({ count: 0 });
        prisma.authorizationCode.deleteMany.mockResolvedValue({ count: 0 });
        const svc = new AuthService(prisma, mockJwt);
        await (svc as any).cleanupExpiredEntries();
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
    let prisma: any;

    beforeEach(() => {
      vi.clearAllMocks();
      prisma = createMockPrisma();
    });

    it('creates the platform SUPER_ADMIN + organization and returns a token', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (fn: any) => {
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

      const svc = new AuthService(prisma, mockJwt);
      const result = await svc.bootstrap({
        email: 'platform@medu.test',
        password: 'S3cure-Bootstrap-123!',
        firstName: 'Platform',
        lastName: 'Admin',
        organizationName: 'M-EDU Platform',
      });
      expect(result.user.role).toBe('SUPER_ADMIN');
      expect(result.accessToken).toBeTruthy();
      expect(prisma.session.create).toHaveBeenCalled();
    });

    it('rejects bootstrap once a SUPER_ADMIN already exists (one-time only)', async () => {
      prisma.user.count.mockResolvedValue(1);
      const svc = new AuthService(prisma, mockJwt);
      await expect(
        svc.bootstrap({
          email: 'second@medu.test',
          password: 'S3cure-Bootstrap-123!',
          firstName: 'A',
          lastName: 'B',
          organizationName: 'X',
        }),
      ).rejects.toThrow('Platform is already bootstrapped');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an email that is already registered', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findFirst.mockResolvedValue({ id: 'existing', email: 'dup@medu.test' });
      const svc = new AuthService(prisma, mockJwt);
      await expect(
        svc.bootstrap({
          email: 'dup@medu.test',
          password: 'S3cure-Bootstrap-123!',
          firstName: 'A',
          lastName: 'B',
          organizationName: 'X',
        }),
      ).rejects.toThrow('Email already registered');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('serializes concurrent first-bootstraps with an advisory lock + recheck', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findFirst.mockResolvedValue(null);
      const txExecuteRaw = vi.fn().mockResolvedValue(undefined);
      const txCount = vi.fn().mockResolvedValue(1); // second txn sees a SUPER_ADMIN
      prisma.$transaction.mockImplementation(async (fn: any) => {
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
        }),
      ).rejects.toThrow('Platform is already bootstrapped');
      expect(txExecuteRaw).toHaveBeenCalled();
      expect(txCount).toHaveBeenCalled();
    });
  });
