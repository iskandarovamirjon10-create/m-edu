import { describe, it, expect } from 'vitest';
import { authTracker } from '../auth-tracker';

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    ip: '203.0.113.7',
    headers: {},
    ...overrides,
  };
}

describe('authTracker', () => {
  it('uses req.user.sub when the auth guard already ran', () => {
    const req = makeReq({ user: { sub: 'user-123' } });
    expect(authTracker(req)).toBe('user-123');
  });

  it('extracts the sub claim from a bearer JWT (ThrottlerGuard runs before JwtAuthGuard)', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'user-abc', role: 'ORG_ADMIN' })).toString('base64url');
    const req = makeReq({ headers: { authorization: `Bearer x.${payload}.sig` } });
    expect(authTracker(req)).toBe('user:user-abc');
  });

  it('falls back to the client IP for anonymous traffic', () => {
    const req = makeReq();
    expect(authTracker(req)).toBe('203.0.113.7');
  });

  it('falls back to the client IP for malformed tokens (guard will reject them anyway)', () => {
    const req = makeReq({ headers: { authorization: 'Bearer not-a-jwt' } });
    expect(authTracker(req)).toBe('203.0.113.7');
  });
});
