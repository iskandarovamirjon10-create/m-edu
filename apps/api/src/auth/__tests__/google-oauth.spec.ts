import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { buildOAuthSessionOptions, resolveOAuthSessionSecret } from '../oauth-session';

/**
 * Google OAuth policy + CSRF-state tests.
 *
 * Covers the account-linking policy, claim validation, inactive-account
 * protection, session issuance/revocation and the single-use OAuth state.
 */

function googleProfile(overrides: Record<string, unknown> = {}) {
  return {
    googleSubject: 'google-sub-123',
    email: 'user@gmail.com',
    emailVerified: true,
    firstName: 'Jane',
    lastName: 'Doe',
    avatar: 'https://pic',
    accessToken: 'at',
    ...overrides,
  };
}

function createMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    accessWhitelist: {
      findUnique: vi.fn(),
    },
    organization: { create: vi.fn() },
    session: {
      create: vi.fn().mockResolvedValue({ id: 'sess-1', userId: 'u1', organizationId: 'o1', expiresAt: new Date() }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(),
  };
}

const mockJwt = {
  sign: vi.fn((payload: Record<string, unknown>) => `jwt.${payload.sub}.${payload.sid}`),
} as unknown as JwtService;

const orgRow = { id: 'o1', name: 'Org' };

describe('AuthService.googleLogin — account-linking policy', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new AuthService(prisma as unknown as PrismaService, mockJwt);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1) rejects an unverified Google email (401, fail closed)', async () => {
    await expect(svc.googleLogin(googleProfile({ emailVerified: false }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('2) rejects a missing googleSubject (400)', async () => {
    await expect(svc.googleLogin(googleProfile({ googleSubject: undefined }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('3) rejects a missing email (400)', async () => {
    await expect(svc.googleLogin(googleProfile({ email: undefined }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('4) logs in an existing account by googleSubject and issues a token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'user@gmail.com', isActive: true, role: 'ORG_ADMIN',
      organizationId: 'o1', firstName: 'Jane', lastName: 'Doe',
      organization: orgRow,
    });
    prisma.user.update.mockResolvedValue({});
    const res = await svc.googleLogin(googleProfile());
    expect(res.accessToken).toContain('jwt.');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' } }),
    );
    expect(prisma.session.create).toHaveBeenCalledTimes(1);
  });

  it('5) rejects an INACTIVE account matched by googleSubject (401, no token)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'user@gmail.com', isActive: false, role: 'ORG_ADMIN',
      organizationId: 'o1', organization: orgRow,
    });
    await expect(svc.googleLogin(googleProfile())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  /**
   * `googleLogin` resolves BOTH the provider subject and the email through
   * unique indexes (`findUnique`), so the mock has to answer per argument.
   */
  function mockUserLookups(subjectRow: unknown, emailRow: unknown) {
    prisma.user.findUnique.mockImplementation(
      (args: { where: Record<string, unknown> }) => {
        if ('googleSubject' in args.where) return Promise.resolve(subjectRow);
        if ('email' in args.where) return Promise.resolve(emailRow);
        return Promise.resolve(null);
      },
    );
  }

  it('6) does NOT auto-merge a password-protected account on email match (409)', async () => {
    mockUserLookups(null, {
      id: 'u2', email: 'user@gmail.com', isActive: true, role: 'ORG_ADMIN',
      organizationId: 'o2', passwordHash: '$2a$10$hashed', organization: orgRow,
    });
    await expect(svc.googleLogin(googleProfile())).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('7) links a passwordless account on verified-email match when the account model allows it', async () => {
    mockUserLookups(null, {
      id: 'u3', email: 'user@gmail.com', isActive: true, role: 'STUDENT',
      organizationId: 'o3', passwordHash: null, googleLinkAllowed: true,
      organization: orgRow,
    });
    prisma.user.update.mockResolvedValue({
      id: 'u3', email: 'user@gmail.com', isActive: true, role: 'STUDENT',
      organizationId: 'o3', organization: orgRow,
    });
    const res = await svc.googleLogin(googleProfile());
    expect(res.accessToken).toContain('jwt.');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u3' },
        data: expect.objectContaining({ googleSubject: 'google-sub-123' }),
      }),
    );
  });

  it('7b) NEVER auto-links a privileged role, even passwordless (409)', async () => {
    // Audit P0-2: a verified Google email is not proof that the holder of a
    // teacher/admin account controls that mailbox (shared or mistyped
    // addresses are common in schools).
    mockUserLookups(null, {
      id: 'u5', email: 'user@gmail.com', isActive: true, role: 'ORG_ADMIN',
      organizationId: 'o5', passwordHash: null, googleLinkAllowed: true,
      organization: orgRow,
    });
    await expect(svc.googleLogin(googleProfile())).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('7c) refuses to link a passwordless account that has not opted in (409)', async () => {
    mockUserLookups(null, {
      id: 'u6', email: 'user@gmail.com', isActive: true, role: 'STUDENT',
      organizationId: 'o6', passwordHash: null, googleLinkAllowed: false,
      organization: orgRow,
    });
    await expect(svc.googleLogin(googleProfile())).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('8) rejects an INACTIVE passwordless account on email match (401)', async () => {
    mockUserLookups(null, {
      id: 'u4', email: 'user@gmail.com', isActive: false, role: 'STUDENT',
      organizationId: 'o4', passwordHash: null, googleLinkAllowed: true,
      organization: orgRow,
    });
    await expect(svc.googleLogin(googleProfile())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('9) creates a NEW org + ORG_ADMIN account for a brand-new identity', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    // Brand-new identities are gated by the email whitelist (invitation):
    // provision the ORG_ADMIN only when the email was invited.
    prisma.accessWhitelist.findUnique.mockResolvedValue({
      id: 'wl-1',
      email: 'user@gmail.com',
    });
    const txUser = {
      id: 'u9', email: 'user@gmail.com', isActive: true, role: 'ORG_ADMIN',
      organizationId: 'o9', firstName: 'Jane', lastName: 'Doe',
      organization: { id: 'o9', name: "Jane Doe's Education Center" },
    };
    prisma.$transaction.mockImplementation(async (_fn: unknown) => {
      const org = { id: 'o9', name: "Jane Doe's Education Center" };
      return { ...txUser, organization: org };
    });
    const res = await svc.googleLogin(googleProfile());
    expect(res.user.role).toBe('ORG_ADMIN');
    expect(res.user.organization).toBeTruthy();
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.session.create).toHaveBeenCalledTimes(1);
  });

  it('10) issues a revocable session — logout revokes the googleLogin session', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'user@gmail.com', isActive: true, role: 'ORG_ADMIN',
      organizationId: 'o1', organization: orgRow,
    });
    prisma.user.update.mockResolvedValue({});
    const res = await svc.googleLogin(googleProfile());
    const sid = mockJwt.sign.mock.calls[0][0].sid;
    await svc.logout(sid, 'u1');
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { id: sid, userId: 'u1', revokedAt: null },
      data: expect.objectContaining({ revokedAt: expect.any(Date) }),
    });
    expect(res.accessToken).toBeTruthy();
  });
});

describe('OAuth session (express-session + PostgreSQL store)', () => {
  it('requires OAUTH_SESSION_SECRET (>= 32 chars) in production (fail fast)', () => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://x' };
    expect(() => resolveOAuthSessionSecret(env, 'production')).toThrow(/OAUTH_SESSION_SECRET/);
  });

  it('requires OAUTH_SESSION_SECRET when Google OAuth is configured, even in dev', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'development',
      GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'secret',
      DATABASE_URL: 'postgresql://x',
    };
    expect(() => resolveOAuthSessionSecret(env, 'development')).toThrow(/OAUTH_SESSION_SECRET/);
  });

  it('uses an ephemeral per-process secret in dev WITHOUT Google OAuth (no hardcoded secret)', () => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'development', DATABASE_URL: 'postgresql://x' };
    const a = resolveOAuthSessionSecret(env, 'development');
    const b = resolveOAuthSessionSecret(env, 'development');
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).not.toBe(b); // fresh random per call
  });

  it('uses the provided OAUTH_SESSION_SECRET when present', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      OAUTH_SESSION_SECRET: 'super-secret-session-signing-key-1234567890!!',
      DATABASE_URL: 'postgresql://x',
    };
    expect(resolveOAuthSessionSecret(env, 'production')).toBe(env.OAUTH_SESSION_SECRET);
  });

  it('configures a short-lived, httpOnly, SameSite=Lax, Secure-in-prod cookie', () => {
    const dev = buildOAuthSessionOptions({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://x', OAUTH_SESSION_SECRET: 'dev-secret-123456789012345678901234567890' });
    expect(dev.name).toBe('medu.oauth');
    expect(dev.cookie.httpOnly).toBe(true);
    expect(dev.cookie.sameSite).toBe('lax');
    expect(dev.cookie.secure).toBe(false);
    expect(dev.cookie.maxAge).toBe(10 * 60 * 1000);
    expect(dev.resave).toBe(false);
    expect(dev.saveUninitialized).toBe(false);

    const prod = buildOAuthSessionOptions({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://x', OAUTH_SESSION_SECRET: 'prod-secret-123456789012345678901234567890' });
    expect(prod.cookie.secure).toBe(true);
  });

  it('keeps the OAuth `state` protection enabled on the Google strategy', async () => {
    // The strategy must use passport's built-in state (state: true), which
    // requires the express-session middleware — regression for
    // "OAuth 2.0 authentication requires session support".
    const { GoogleStrategy } = await import('../google.strategy');
    const instance = new GoogleStrategy({ get: (_k: string, _d?: unknown) => undefined } as unknown as ConfigService);
    expect(instance).toBeDefined();
    // passport-oauth2 installs a SessionStateStore on `_oauth2` exactly when
    // `options.state` is truthy. Assert that state protection is actually
    // wired (a regression here silently removes OAuth CSRF protection),
    // replacing the previous `expect(true).toBe(true)` placeholder.
    // passport-oauth2 installs a SessionStateStore directly on the strategy
    // instance when `options.state` is truthy. Assert that state protection
    // is actually wired (a regression here silently removes OAuth CSRF
    // protection), replacing the previous `expect(true).toBe(true)` placeholder.
    const stateStore = (instance as unknown as { _stateStore?: unknown })._stateStore;
    expect(stateStore).toBeDefined();
  });
});

describe('Google OAuth route rate limiting', () => {
  it('14) /auth/google initiation throttles at 10 req/min per IP', async () => {
    const { AuthController } = await import('../auth.controller');
    const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', AuthController.prototype.googleAuth);
    expect(limit).toBe(10);
  });

  it('15) /auth/google/callback throttles at 20 req/min per IP', async () => {
    const { AuthController } = await import('../auth.controller');
    const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', AuthController.prototype.googleAuthCallback);
    expect(limit).toBe(20);
  });
});
