import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sign } from 'jsonwebtoken';
import { authTracker } from '../auth-tracker';

const DEV_SECRET = 'medu-dev-secret-do-not-use-in-production';
const PREV_ENV = { ...process.env };

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    ip: '203.0.113.7',
    headers: {},
    ...overrides,
  };
}

describe('authTracker', () => {
  beforeAll(() => {
    delete process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = DEV_SECRET;
  });

  afterAll(() => {
    process.env = { ...PREV_ENV };
  });

  it('uses req.user.sub when the auth guard already ran', () => {
    const req = makeReq({ user: { sub: 'user-123' } });
    expect(authTracker(req)).toBe('user:user-123');
  });

  it('uses the signed JWT identity bucket for a valid token', () => {
    const token = sign({ sub: 'user-abc', role: 'ORG_ADMIN' }, DEV_SECRET, { expiresIn: '5m' });
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    expect(authTracker(req)).toBe('user:user-abc');
  });

  it('does not allow a forged token to select another identity bucket', () => {
    // Token signed with a wrong secret — sub must NOT be trusted.
    const forged = sign({ sub: 'victim-user' }, 'attacker-secret', { expiresIn: '5m' });
    const req = makeReq({ headers: { authorization: `Bearer ${forged}` } });
    expect(authTracker(req)).toBe('203.0.113.7');
  });

  it('falls back to the client IP for anonymous traffic', () => {
    const req = makeReq();
    expect(authTracker(req)).toBe('203.0.113.7');
  });

  it('falls back to the client IP for malformed tokens', () => {
    const req = makeReq({ headers: { authorization: 'Bearer not-a-jwt' } });
    expect(authTracker(req)).toBe('203.0.113.7');
  });

  it('falls back to the client IP for unsigned payload-only tokens', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'user-abc' })).toString('base64url');
    const req = makeReq({ headers: { authorization: `Bearer x.${payload}.sig` } });
    expect(authTracker(req)).toBe('203.0.113.7');
  });
});
