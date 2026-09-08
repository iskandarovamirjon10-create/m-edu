/**
 * Regression tests for the OAuth initiation 500:
 *
 * GET /api/auth/google previously ended with an uncaught
 * ERR_HTTP_HEADERS_SENT / ForbiddenException server exception (and a
 * misleading 403/500 in logs) because the guard wrote the redirect response
 * itself and then returned false/true through the Nest pipeline.
 *
 * The guard now NEVER writes the response: it signals the redirect via
 * OAuthRedirectException, which the global exception filter emits as a
 * single clean 302.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleAuthGuard } from '../google-auth.guard';
import { OAuthRedirectException } from '../oauth-redirect.exception';

describe('GoogleAuthGuard initiation behavior', () => {
  let guard: GoogleAuthGuard;

  beforeEach(() => {
    guard = new GoogleAuthGuard();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://front.test');
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function makeCtx(query: Record<string, unknown> = {}) {
    const res = { redirect: vi.fn(), status: vi.fn(), json: vi.fn(), end: vi.fn() } as any;
    const req = { query, headers: {}, ip: '127.0.0.1' } as any;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as any;
    return { ctx, res, req };
  }

  it('throws OAuthRedirectException (NOT a raw response write) when Google is not configured', () => {
    const { ctx, res } = makeCtx({});
    expect(() => guard.canActivate(ctx)).toThrow(OAuthRedirectException);
    try {
      guard.canActivate(ctx);
    } catch (e: any) {
      expect(e.url).toContain('http://front.test/auth/callback?error=');
      expect(e.url).toContain(encodeURIComponent('Google sign-in is not configured'));
    }
    // The guard must not write the response — the filter owns the single 302.
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('throws OAuthRedirectException with a safe message when Google returns an error (e.g. access_denied)', () => {
    const { ctx, res } = makeCtx({ error: 'access_denied' });
    expect(() => guard.canActivate(ctx)).toThrow(OAuthRedirectException);
    try {
      guard.canActivate(ctx);
    } catch (e: any) {
      expect(e.url).toContain(encodeURIComponent('You cancelled Google sign-in.'));
    }
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('delegates to passport when Google credentials are configured (initiation reaches the strategy)', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id.apps.googleusercontent.com');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
    const { ctx, res } = makeCtx({});
    // spy on the passport AuthGuard prototype's canActivate
    const spy = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate').mockReturnValue(true);
    const result = guard.canActivate(ctx);
    expect(spy).toHaveBeenCalledWith(ctx);
    expect(result).toBe(true);
    expect(res.redirect).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('delegates to passport on the callback leg (code present) even when not configured', () => {
    const { ctx } = makeCtx({ code: 'auth-code', state: 'nonce' });
    const spy = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate').mockReturnValue(true);
    expect(() => guard.canActivate(ctx)).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
