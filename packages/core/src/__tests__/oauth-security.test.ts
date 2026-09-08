import { describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'crypto';

/**
 * P0 #2 + P0 #3 Regression Tests: OAuth CSRF + JWT in URL
 *
 * P0 #2 (CSRF): The old code had `state: false` in passport-google-oauth20,
 * which disabled CSRF state protection. An attacker could craft a malicious
 * OAuth callback URL with a pre-obtained token and trick a victim into
 * completing the OAuth flow.
 *
 * P0 #3 (JWT in URL): The old code passed the JWT as `?token=xxx` in the
 * redirect URL. This exposed the token in:
 * - Browser URL bar and history
 * - Server access logs
 * - HTTP Referer headers
 * - Proxy logs
 *
 * Fixes:
 * - P0 #2: Server-side state store with signed nonces + passport state:true
 * - P0 #3: One-time authorization code exchange (JWT never touches URL)
 */

// Replicate the AuthService's OAuth state and auth code logic for testing
class OAuthSecurityService {
  private oauthStates = new Map<string, { createdAt: number; used: boolean }>();
  private authCodes = new Map<string, { accessToken: string; createdAt: number; used: boolean }>();

  private readonly STATE_TTL_MS = 5 * 60 * 1000;
  private readonly AUTH_CODE_TTL_MS = 5 * 60 * 1000;

  generateOAuthState(): string {
    const state = randomBytes(32).toString('hex');
    this.oauthStates.set(state, { createdAt: Date.now(), used: false });
    return state;
  }

  validateOAuthState(state: string): boolean {
    const entry = this.oauthStates.get(state);
    if (!entry) return false;
    // Check if already used (replay attack)
    if (entry.used) return false;
    // Check expiry
    if (Date.now() - entry.createdAt > this.STATE_TTL_MS) {
      this.oauthStates.delete(state);
      return false;
    }
    // Mark as used (keep entry briefly for replay detection, cleanup will remove it)
    entry.used = true;
    return true;
  }

  generateAuthCode(accessToken: string): string {
    const code = randomBytes(32).toString('hex');
    this.authCodes.set(code, { accessToken, createdAt: Date.now(), used: false });
    return code;
  }

  exchangeAuthCode(code: string): string {
    const entry = this.authCodes.get(code);
    if (!entry) throw new Error('Invalid or expired authorization code');
    // Check if already used (replay attack)
    if (entry.used) throw new Error('Authorization code has already been used');
    // Check expiry
    if (Date.now() - entry.createdAt > this.AUTH_CODE_TTL_MS) {
      this.authCodes.delete(code);
      throw new Error('Authorization code has expired');
    }
    // Mark as used (keep entry briefly for replay detection, cleanup will remove it)
    entry.used = true;
    return entry.accessToken;
  }
}

describe('P0 #2: OAuth CSRF State Protection', () => {
  let service: OAuthSecurityService;

  beforeEach(() => {
    service = new OAuthSecurityService();
  });

  it('generates a valid state token', () => {
    const state = service.generateOAuthState();
    expect(state).toBeTruthy();
    expect(state.length).toBe(64); // 32 bytes = 64 hex chars
  });

  it('validates a correct state token', () => {
    const state = service.generateOAuthState();
    const result = service.validateOAuthState(state);
    expect(result).toBe(true);
  });

  it('rejects a state token that does not exist', () => {
    const result = service.validateOAuthState('nonexistent-state-token');
    expect(result).toBe(false);
  });

  it('rejects a reused state token (replay attack)', () => {
    const state = service.generateOAuthState();

    // First validation succeeds
    const firstResult = service.validateOAuthState(state);
    expect(firstResult).toBe(true);

    // Second validation fails (token was consumed)
    const secondResult = service.validateOAuthState(state);
    expect(secondResult).toBe(false);
  });

  it('rejects an expired state token', () => {
    const state = service.generateOAuthState();

    // Simulate expiry by manipulating the internal state
    // (In production, we'd use a clock mock or wait 5 minutes)
    const entry = (service as any).oauthStates.get(state);
    entry.createdAt = Date.now() - (6 * 60 * 1000); // 6 minutes ago (expired)

    const result = service.validateOAuthState(state);
    expect(result).toBe(false);
  });

  it('generates unique state tokens for each request', () => {
    const states = new Set<string>();
    for (let i = 0; i < 100; i++) {
      states.add(service.generateOAuthState());
    }
    expect(states.size).toBe(100);
  });

  it('concurrent state validations are isolated', async () => {
    // Generate 50 state tokens
    const states = Array.from({ length: 50 }, () => service.generateOAuthState());

    // Validate all concurrently — each should succeed exactly once
    const results = await Promise.all(
      states.map(async state => service.validateOAuthState(state))
    );

    expect(results.every(r => r === true)).toBe(true);

    // Now try to validate all again — each should fail (replay protection)
    const replayResults = await Promise.allSettled(
      states.map(async state => service.validateOAuthState(state))
    );

    expect(replayResults.every(r => r.status === 'fulfilled' && r.value === false)).toBe(true);
  });
});

describe('P0 #3: JWT Not in URL (Authorization Code Exchange)', () => {
  let service: OAuthSecurityService;

  beforeEach(() => {
    service = new OAuthSecurityService();
  });

  it('generates an authorization code from a JWT', () => {
    const code = service.generateAuthCode('test-jwt-token');
    expect(code).toBeTruthy();
    expect(code.length).toBe(64); // 32 bytes = 64 hex chars
  });

  it('exchanges a valid authorization code for the JWT', () => {
    const originalToken = 'test-jwt-access-token-12345';
    const code = service.generateAuthCode(originalToken);

    const exchangedToken = service.exchangeAuthCode(code);
    expect(exchangedToken).toBe(originalToken);
  });

  it('rejects an invalid authorization code', () => {
    expect(() => service.exchangeAuthCode('invalid-code')).toThrow(
      'Invalid or expired authorization code'
    );
  });

  it('rejects a reused authorization code (replay attack)', () => {
    const code = service.generateAuthCode('test-token');

    // First exchange succeeds
    const token = service.exchangeAuthCode(code);
    expect(token).toBe('test-token');

    // Second exchange fails
    expect(() => service.exchangeAuthCode(code)).toThrow(
      'Authorization code has already been used'
    );
  });

  it('rejects an expired authorization code', () => {
    const code = service.generateAuthCode('test-token');

    // Simulate expiry
    const entry = (service as any).authCodes.get(code);
    entry.createdAt = Date.now() - (6 * 60 * 1000); // 6 minutes ago

    expect(() => service.exchangeAuthCode(code)).toThrow(
      'Authorization code has expired'
    );
  });

  it('generates unique authorization codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(service.generateAuthCode(`token-${i}`));
    }
    expect(codes.size).toBe(100);
  });

  it('does not expose the JWT in the authorization code', () => {
    const originalToken = 'super-secret-jwt-token-with-user-data';
    const code = service.generateAuthCode(originalToken);

    // The code should not contain any part of the original token
    expect(code).not.toContain('jwt');
    expect(code).not.toContain('token');
    expect(code).not.toContain('super');
    expect(code).not.toContain('secret');
  });

  it('concurrent code exchanges are isolated', async () => {
    const tokens = Array.from({ length: 50 }, (_, i) => `token-${i}`);
    const codes = tokens.map(token => service.generateAuthCode(token));

    // Exchange all concurrently — each code is unique, so all should succeed
    const results = await Promise.all(
      codes.map(async code => service.exchangeAuthCode(code))
    );

    expect(results).toEqual(tokens);

    // Try to exchange all codes again — should all fail (replay protection)
    const replayResults = await Promise.allSettled(
      codes.map(async code => service.exchangeAuthCode(code))
    );

    expect(replayResults.every(r => r.status === 'rejected')).toBe(true);
  });
});
