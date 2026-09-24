/**
 * GoogleStrategy.validate + GoogleAuthGuard.handleRequest unit tests.
 *
 * These exercise the REAL passport validate() mapping (claim assertions,
 * profile → GoogleProfile) and the REAL guard handleRequest() callback-failure
 * mapping — the application's own OAuth processing, not a mock of it.
 * (Google's external token endpoint is the only thing a full OAuth e2e
 * cannot touch without live credentials — see AUTH_FORENSIC_REPORT.md,
 * Google OAuth: IMPLEMENTED — RUNTIME UNVERIFIED.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { GoogleStrategy } from '../google.strategy';
import { GoogleAuthGuard } from '../google-auth.guard';
import { OAuthRedirectException } from '../oauth-redirect.exception';

const config = { get: vi.fn() };

function makeStrategy(): GoogleStrategy {
  config.get.mockImplementation((key: string) => {
    if (key === 'GOOGLE_CLIENT_ID') return 'test-client-id.apps.googleusercontent.com';
    if (key === 'GOOGLE_CLIENT_SECRET') return 'test-client-secret';
    return undefined;
  });
  return new GoogleStrategy(config as unknown as ConfigService);
}

/** Build a passport-style Google profile. */
function googleProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'google-sub-123',
    emails: [{ value: 'Jane.Doe@Example.com', verified: true }],
    name: { givenName: 'Jane', familyName: 'Doe' },
    photos: [{ value: 'https://lh3.googleusercontent.com/avatar.jpg' }],
    provider: 'google',
    ...overrides,
  } as unknown as Profile;
}

const mockReq = {} as unknown as Request;

describe('GoogleStrategy.validate — profile mapping + claim assertions', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('maps a verified Google profile to the internal GoogleProfile shape', async () => {
    const strategy = makeStrategy();
    const done = vi.fn();
    await strategy.validate(mockReq, 'at', 'rt', googleProfile(), done);
    expect(done).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        googleSubject: 'google-sub-123',
        email: 'jane.doe@example.com',
        emailVerified: true,
        firstName: 'Jane',
        lastName: 'Doe',
        avatar: 'https://lh3.googleusercontent.com/avatar.jpg',
      }),
    );
  });

  it('rejects a profile without a subject id', async () => {
    const strategy = makeStrategy();
    const done = vi.fn();
    await strategy.validate(mockReq, 'at', 'rt', googleProfile({ id: undefined }), done);
    // done(err) — user argument is omitted entirely on the failure path
    expect(done).toHaveBeenCalledTimes(1);
    expect((done.mock.calls[0][0] as Error).message).toMatch(/missing subject/i);
    expect(done.mock.calls[0].length).toBe(1);
  });

  it('rejects a profile without an email', async () => {
    const strategy = makeStrategy();
    const done = vi.fn();
    await strategy.validate(mockReq, 'at', 'rt', googleProfile({ emails: [] }), done);
    expect(done).toHaveBeenCalledTimes(1);
    expect((done.mock.calls[0][0] as Error).message).toMatch(/email address/i);
    expect(done.mock.calls[0].length).toBe(1);
  });

  it('rejects an UNVERIFIED Google email (fail closed, no account linking on unverified claims)', async () => {
    const strategy = makeStrategy();
    const done = vi.fn();
    await strategy.validate(mockReq, 'at', 'rt', googleProfile({ emails: [{ value: 'x@y.com', verified: false }] }), done);
    expect(done).toHaveBeenCalledTimes(1);
    expect((done.mock.calls[0][0] as Error).message).toMatch(/verified/i);
    expect(done.mock.calls[0].length).toBe(1);
  });

  it('survives a profile with no photos (avatar optional, mapped to null)', async () => {
    const strategy = makeStrategy();
    const done = vi.fn();
    await strategy.validate(mockReq, 'at', 'rt', googleProfile({ photos: [] }), done);
    const [, user] = done.mock.calls[0];
    expect(user.avatar).toBeNull();
    expect(user.googleSubject).toBe('google-sub-123');
  });
});

describe('GoogleAuthGuard.handleRequest — callback failure mapping', () => {
  let guard: GoogleAuthGuard;

  beforeEach(() => {
    guard = new GoogleAuthGuard();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://front.test');
  });

  afterEach(() => vi.unstubAllEnvs());

  function ctxWithQuery(query: Record<string, unknown>) {
    return {
      switchToHttp: () => ({ getRequest: () => ({ query, headers: {}, ip: '127.0.0.1' }) }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  }

  it('on the callback leg, a passport failure becomes a controlled redirect with a safe message', () => {
    try {
      guard.handleRequest.call(guard, new Error('state mismatch'), undefined, 'info', ctxWithQuery({ code: 'c' }));
      expect.fail('expected OAuthRedirectException');
    } catch (e) {
      expect(e).toBeInstanceOf(OAuthRedirectException);
      const url = (e as OAuthRedirectException).url;
      expect(url).toContain('http://front.test/auth/callback?error=');
      expect(url).toContain(encodeURIComponent('Google sign-in failed. Please try again.'));
      // Never leaks the passport error text to the URL:
      expect(url).not.toContain('state%20mismatch');
    }
  });

  it('on the initiation leg (no code), a failure surfaces as a plain 401', () => {
    expect(() =>
      guard.handleRequest.call(guard, new Error('no session support'), undefined, 'info', ctxWithQuery({})),
    ).toThrow(UnauthorizedException);
  });

  it('a successful callback passes the user through untouched', () => {
    const user = { googleSubject: 'sub', email: 'a@b.c', emailVerified: true };
    expect(guard.handleRequest.call(guard, null, user, undefined, ctxWithQuery({ code: 'c' }))).toBe(user);
  });
});
