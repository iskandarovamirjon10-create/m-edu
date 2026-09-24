import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { CsrfMiddleware } from '../csrf.middleware';
import { requiresCsrfValidation } from '../csrf.policy';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    originalUrl: '/api/payments',
    url: '/api/payments',
    headers: {},
    cookies: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const cookie = vi.fn();
  return { res: { cookie } as unknown as Response, cookie };
}

describe('CSRF policy (pure)', () => {
  it('protects cookie-authenticated mutations', () => {
    expect(
      requiresCsrfValidation({ method: 'POST', path: '/api/payments', headers: {} }),
    ).toBe(true);
    expect(
      requiresCsrfValidation({ method: 'DELETE', path: '/api/students/1', headers: {} }),
    ).toBe(true);
  });

  it('never protects safe methods', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(
        requiresCsrfValidation({ method, path: '/api/payments', headers: {} }),
      ).toBe(false);
    }
  });

  it('exempts machine webhooks that carry their own secret', () => {
    expect(
      requiresCsrfValidation({
        method: 'POST',
        path: '/api/webhooks/telegram',
        headers: {},
      }),
    ).toBe(false);
  });

  it('exempts Authorization-header callers (bearer / API key)', () => {
    expect(
      requiresCsrfValidation({
        method: 'POST',
        path: '/api/payments',
        headers: { authorization: 'Bearer abc.def.ghi' },
      }),
    ).toBe(false);
    expect(
      requiresCsrfValidation({
        method: 'POST',
        path: '/api/payments',
        headers: { authorization: 'ApiKey medu_live_xxx' },
      }),
    ).toBe(false);
  });

  it('honours CSRF_EXEMPT_PATHS additions', () => {
    expect(
      requiresCsrfValidation({
        method: 'POST',
        path: '/api/partner/ingest',
        headers: {},
        env: { CSRF_EXEMPT_PATHS: '/api/partner/' } as unknown as NodeJS.ProcessEnv,
      }),
    ).toBe(false);
    // Default exemptions remain in place for env-configured runs.
    expect(
      requiresCsrfValidation({
        method: 'POST',
        path: '/api/webhooks/telegram',
        headers: {},
        env: { CSRF_EXEMPT_PATHS: '/api/partner/' } as unknown as NodeJS.ProcessEnv,
      }),
    ).toBe(false);
  });
});

describe('CsrfMiddleware', () => {
  let middleware: CsrfMiddleware;

  beforeEach(() => {
    middleware = new CsrfMiddleware();
  });

  it('seeds the XSRF-TOKEN cookie when absent', () => {
    const { res, cookie } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    middleware.use(makeReq({ method: 'GET', originalUrl: '/api/health' }), res, next);
    expect(cookie).toHaveBeenCalledWith(
      'XSRF-TOKEN',
      expect.any(String),
      expect.objectContaining({ httpOnly: false, sameSite: 'lax' }),
    );
    expect(next).toHaveBeenCalled();
  });

  it('rejects a cookie-authenticated mutation without the header', () => {
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    expect(() =>
      middleware.use(makeReq({ cookies: { 'XSRF-TOKEN': 'tok-123' } }), res, next),
    ).toThrow(ForbiddenException);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a mutation whose header does not match the cookie', () => {
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    expect(() =>
      middleware.use(
        makeReq({ cookies: { 'XSRF-TOKEN': 'tok-123' }, headers: { 'x-xsrf-token': 'other' } }),
        res,
        next,
      ),
    ).toThrow(ForbiddenException);
  });

  it('accepts a mutation whose header matches the cookie', () => {
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    middleware.use(
      makeReq({ cookies: { 'XSRF-TOKEN': 'tok-123' }, headers: { 'x-xsrf-token': 'tok-123' } }),
      res,
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('lets the Telegram webhook through without any CSRF material (F-002)', () => {
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    middleware.use(
      makeReq({
        method: 'POST',
        originalUrl: '/api/webhooks/telegram',
        headers: { 'x-telegram-bot-api-secret-token': 'secret' },
      }),
      res,
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('lets bearer-authenticated mutations through', () => {
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    middleware.use(
      makeReq({ headers: { authorization: 'Bearer a.b.c' } }),
      res,
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('never throws on safe methods', () => {
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    middleware.use(makeReq({ method: 'GET' }), res, next);
    expect(next).toHaveBeenCalled();
  });
});
