import { describe, it, expect, vi, afterEach } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';

import {
  DEFAULT_AUTH_TTL_MS,
  MAX_AUTH_TTL_MS,
  authCookieMaxAgeMs,
  authTtlMs,
  authTtlSeconds,
  parseDurationMs,
} from '../auth.ttl';
import { AuthService } from '../auth.service';
import { AuthController } from '../auth.controller';

/**
 * There must be exactly ONE duration configuration. This suite proves that the
 * JWT `expiresIn` (seconds), the DB session `expiresAt` (milliseconds) and the
 * `access_token` cookie `maxAge` (milliseconds) all describe the SAME
 * configured lifetime.
 */
describe('canonical auth TTL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('parseDurationMs', () => {
    it.each([
      ['24h', 24 * 3600_000],
      ['30m', 30 * 60_000],
      ['900s', 900_000],
      ['7d', 7 * 86_400_000],
      ['86400000', 86_400_000],
      [' 24h ', 86_400_000],
      ['500ms', 500],
    ])('parses %s', (raw, expected) => {
      expect(parseDurationMs(raw)).toBe(expected);
    });

    it.each([
      undefined,
      null,
      '',
      '   ',
      'tomorrow',
      '24h30m',
      '0',
      '-5h',
      '999999d',
      'abc123',
    ])('falls back to the default for %s', (raw) => {
      expect(parseDurationMs(raw)).toBe(DEFAULT_AUTH_TTL_MS);
    });

    it('honours an explicit fallback', () => {
      expect(parseDurationMs('nonsense', 1234)).toBe(1234);
    });

    it('refuses durations beyond the ceiling', () => {
      expect(parseDurationMs(`${MAX_AUTH_TTL_MS + 1}`)).toBe(DEFAULT_AUTH_TTL_MS);
    });
  });

  it('reads JWT_EXPIRES_IN at call time, not at module load', () => {
    vi.stubEnv('JWT_EXPIRES_IN', '2h');
    expect(authTtlMs()).toBe(2 * 3600_000);
    vi.stubEnv('JWT_EXPIRES_IN', '30m');
    expect(authTtlMs()).toBe(30 * 60_000);
    vi.unstubAllEnvs();
    expect(authTtlMs()).toBe(DEFAULT_AUTH_TTL_MS);
  });

  it('seconds and milliseconds describe the same configured lifetime', () => {
    for (const raw of ['24h', '2h', '30m', '7d', '86400000']) {
      const ms = authTtlMs(raw);
      const seconds = authTtlSeconds(raw);
      expect(seconds).toBe(Math.floor(ms / 1000));
      // Cookie maxAge and session expiresAt are the same number.
      expect(authCookieMaxAgeMs(raw)).toBe(ms);
      // And nothing is lost beyond sub-second rounding in the JWT.
      expect(seconds * 1000).toBeLessThanOrEqual(ms);
      expect(ms).toBeLessThan((seconds + 1) * 1000);
    }
  });

  it('JWT signOptions.expiresIn (seconds) yields the configured lifetime', () => {
    vi.stubEnv('JWT_EXPIRES_IN', '2h');
    const jwt = new JwtService({
      secret: 'ttl-proof-secret',
      signOptions: { expiresIn: authTtlSeconds() },
    });
    const payload = jwt.decode(jwt.sign({ sub: 'u1' })) as { iat: number; exp: number };

    expect((payload.exp - payload.iat) * 1000).toBe(authTtlMs());
    expect(authCookieMaxAgeMs()).toBe(authTtlMs());
  });

  it('Session.expiresAt is created from the same configured lifetime', async () => {
    vi.stubEnv('JWT_EXPIRES_IN', '90m');

    const sessionCreate = vi.fn().mockResolvedValue({ id: 's1' });
    const prisma = {
      session: { create: sessionCreate, count: vi.fn().mockResolvedValue(1), findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
      $transaction: vi.fn(),
    } as never;
    const jwt = new JwtService({ secret: 'ttl-proof-secret' });
    const svc = new AuthService(prisma, jwt);

    const before = Date.now();
    await svc['issueToken']({
      id: 'u1',
      email: 'a@b.com',
      role: 'STUDENT',
      organizationId: 'org-1',
    });
    const after = Date.now();

    const expiresAt: Date = sessionCreate.mock.calls[0][0].data.expiresAt;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 90 * 60_000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 90 * 60_000);
  });

  it('auth cookie maxAge comes from the same configured lifetime', async () => {
    vi.stubEnv('JWT_EXPIRES_IN', '90m');

    const login = vi.fn().mockResolvedValue({
      accessToken: 'tok',
      user: { id: 'u1', email: 'a@b.com', role: 'STUDENT', organizationId: 'org-1' },
    });
    const controller = new AuthController({ login } as never, {} as never);
    const res = {
      cookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;

    await controller.login({ email: 'a@b.com', password: 'x' } as never, res);

    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'tok',
      expect.objectContaining({ maxAge: authCookieMaxAgeMs() }),
    );
    expect(authCookieMaxAgeMs()).toBe(90 * 60_000);
  });
});
